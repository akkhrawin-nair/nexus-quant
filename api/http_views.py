"""HTTP adapters for observed-data research services."""
import logging
import threading

import pandas as pd
from django.db import DatabaseError
from django.utils import timezone
from django.conf import settings
from rest_framework.exceptions import PermissionDenied
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from api.models import MarketPrice
from api.services import market_data as md
from api.services.backtesting import backtest_ohlcv, finite_number
from api.services.ingestion import asset_type, ingest_market_data
from api.services.portfolio import aligned_returns, allocation_candidates, portfolio_metrics, aggregate_quality, input_quality
from api.services.research import candles, signal_payload, stored_history, volatility

logger = logging.getLogger(__name__)
_ingestion_lock = threading.Lock()


class Unavailable(Exception):
    pass


class OptionQuoteView(APIView):
    def get(self, request):
        from api.services.option_quotes import fetch_option_quote, QuoteUnavailable
        try:
            return Response(fetch_option_quote(request.query_params.get('contract', '')),
                            headers={'Cache-Control':'no-store'})
        except ValueError as exc:
            return Response({'error':str(exc)}, status=400, headers={'Cache-Control':'no-store'})
        except QuoteUnavailable as exc:
            return Response({'error':str(exc), 'provider':'Alpaca', 'feed':'opra', 'status':'unavailable'},
                            status=503, headers={'Cache-Control':'no-store'})


class ResearchView(APIView):
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {'POST', 'PUT', 'PATCH', 'DELETE'}:
            origin = request.headers.get('Origin')
            if origin and origin not in settings.CORS_ALLOWED_ORIGINS:
                raise PermissionDenied('This origin is not allowed to change local research data.')
            if not isinstance(request.data, dict):
                raise ValueError('Request body must be a JSON object.')

    def handle_exception(self, exc):
        if isinstance(exc, (ValueError, TypeError, OverflowError)):
            return Response({'error': str(exc)}, status=400)
        if isinstance(exc, Unavailable):
            return Response({'error': str(exc), 'data_quality': md.data_quality('Market provider', 'unavailable')}, status=503)
        if isinstance(exc, DatabaseError):
            logger.exception('Market database operation failed')
            return Response({'error': 'Market database unavailable. Run migrations and retry.'}, status=503)
        return super().handle_exception(exc)


class AnalystBriefView(ResearchView):
    def get(self, request):
        from api.services.analyst_brief import technical_brief
        symbol = md.validate_symbol(request.query_params.get('symbol','EOSE'))
        frame = stored_history(symbol)
        if frame.empty:
            raise Unavailable('No saved daily history for this ticker. Add or sync it in the watchlist first.')
        return Response(technical_brief(symbol,frame), headers={'Cache-Control':'no-store'})


class RefreshAnalystBriefView(ResearchView):
    throttle_scope = 'ingestion'

    def post(self, request):
        from api.services.analyst_brief import technical_brief
        symbol = md.validate_symbol(request.data.get('symbol'))
        if not _ingestion_lock.acquire(blocking=False):
            return Response({'error':'A market-data refresh is already running. Retry shortly.'}, status=409)
        try:
            result = ingest_market_data({symbol:asset_type(symbol)}, force_refresh=True)
            if result['failed']:
                raise Unavailable('Provider refresh failed. Existing saved observations remain available; retry later.')
            frame = stored_history(symbol)
            if len(frame) < 60:
                raise Unavailable('Refresh returned fewer than 60 daily observations. A complete analyst brief is unavailable.')
            return Response(technical_brief(symbol,frame), headers={'Cache-Control':'no-store'})
        finally:
            _ingestion_lock.release()


def required_history(symbol, period='1y', interval='1d'):
    frame = md.get_history(md.validate_symbol(symbol), period=period, interval=interval)
    if frame.empty:
        if interval == '1d':
            frame = stored_history(symbol)
            if not frame.empty:
                days = {'5d': 7, '1mo': 31, '3mo': 93, '6mo': 186, '1y': 366, '5y': 1830, '10y': 3660}[period]
                cutoff = frame.index[-1] - pd.Timedelta(days=days)
                frame = frame.loc[frame.index >= cutoff].copy()
                frame.attrs['data_quality']['limitations'].append('Provider unavailable; actual stored date coverage is reported.')
        if frame.empty:
            raise Unavailable(f'Historical observations unavailable for {symbol}; retry later.')
    return frame


def portfolio_histories(params):
    raw = params.get('symbols', 'QQQ,SPY,NVDA,GLD')
    if not isinstance(raw, str):
        raise ValueError('symbols must be comma-separated tickers.')
    symbols = list(dict.fromkeys(md.validate_symbol(s) for s in raw.split(',')))
    if not 1 <= len(symbols) <= 12:
        raise ValueError('Provide 1 to 12 symbols.')
    return {s: required_history(s) for s in symbols}


class MarketPingView(ResearchView):
    def get(self, request):
        return Response({'status': 'ONLINE', 'timestamp': timezone.now().isoformat(),
                         'data_feed': 'Historical bars / HTTP polling',
                         'database_ready': MarketPrice.objects.exists(),
                         'data_quality': md.data_quality('Local Django server', 'available')})


class MarketQuotesView(ResearchView):
    def get(self, request):
        symbols = list(dict.fromkeys(md.validate_symbol(s) for s in request.query_params.get('symbols', 'QQQ').split(',')))
        if len(symbols) > 12:
            raise ValueError('At most 12 quotes per request.')
        return Response({s: md.get_quote(s) for s in symbols})


class BullishSignalList(ResearchView):
    bullish = True

    def get(self, request):
        symbols = list(MarketPrice.objects.order_by().values_list('symbol', 'asset_type').distinct())
        payload = []
        for symbol, kind in symbols:
            frame = stored_history(symbol)
            if len(frame) < 20:
                continue
            signal = signal_payload(symbol, frame, kind)
            if (signal['macd'] > signal['macd_signal']) == self.bullish:
                payload.append(signal)
        return Response(payload)


class BearishSignalList(BullishSignalList):
    bullish = False


class AddAsset(ResearchView):
    def post(self, request):
        symbol = md.validate_symbol(request.data.get('symbol'))
        with _ingestion_lock:
            result = ingest_market_data({symbol: asset_type(symbol)})
        if result['failed']:
            raise Unavailable(result['errors'][symbol])
        frame = stored_history(symbol)
        if len(frame) < 20:
            raise Unavailable('Ticker saved, but fewer than 20 daily observations are available.')
        return Response(signal_payload(symbol, frame, asset_type(symbol)))


class TriggerIngest(ResearchView):
    throttle_scope = 'ingestion'

    def post(self, request):
        if not _ingestion_lock.acquire(blocking=False):
            return Response({'error': 'An ingestion cycle is already running.'}, status=409)
        try:
            result = ingest_market_data()
        finally:
            _ingestion_lock.release()
        status = 'partial' if result['failed'] else 'success'
        return Response({**result, 'status': status,
                         'message': f"{result['created']} created, {result['updated']} updated, {result['failed']} symbols failed."},
                        status=200 if not result['failed'] else 207)


class CandleDataView(ResearchView):
    def get(self, request, symbol=None):
        symbol = md.validate_symbol(symbol or request.query_params.get('symbol', 'QQQ'))
        raw = request.query_params.get('tf', request.query_params.get('interval', '1D'))
        mappings = {'1D': ('1y', '1d'), '1W': ('5y', '1wk'), '1M': ('5y', '1mo'), '1Y': ('10y', '1d'),
                    '1m': ('5d', '1m'), '5m': ('5d', '5m'), '15m': ('5d', '15m'), '1h': ('1mo', '1h')}
        if raw not in mappings:
            raise ValueError('Unsupported candle timeframe.')
        period, interval = mappings[raw]
        frame = stored_history(symbol) if raw == '1D' else pd.DataFrame()
        if frame.empty:
            frame = required_history(symbol, period, interval)
        payload = candles(frame)
        if interval in {'1m', '5m', '15m', '1h'}:
            for item, stamp in zip(payload, frame.index):
                item['time'] = int(pd.Timestamp(stamp).timestamp())
                item['date'] = pd.Timestamp(stamp).isoformat()
        quality = frame.attrs.get('data_quality', {})
        return Response(payload, headers={'X-Data-Source': quality.get('source', md.SOURCE),
                                          'X-Data-Status': quality.get('status', 'available')})


class VolatilityDataViewSet(viewsets.ViewSet):
    def list(self, request):
        try:
            symbol = md.validate_symbol(request.query_params.get('symbol', 'QQQ'))
            frame = stored_history(symbol)
            if frame.empty:
                frame = required_history(symbol)
            return Response(volatility(frame, symbol))
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)
        except (Unavailable, DatabaseError) as exc:
            return Response({'error': str(exc)}, status=503)

    def retrieve(self, request, pk=None):
        try:
            symbol = md.validate_symbol(pk)
            return Response(volatility(required_history(symbol), symbol))
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)
        except Unavailable as exc:
            return Response({'error': str(exc)}, status=503)

    @action(detail=False, methods=['get'])
    def qqq(self, request):
        return self.retrieve(request, 'QQQ')


class SentimentDataView(ResearchView):
    def get(self, request):
        return Response(md.get_news(request.query_params.get('symbol', 'QQQ')))


class OrderbookDataView(ResearchView):
    def get(self, request):
        raise Unavailable('No exchange order-book feed is connected. Random depth and whale orders are not market observations.')


class AnalyzeSignals(ResearchView):
    def post(self, request):
        return Response({'analysis': 'Indicator research only. Review data timestamps, historical backtests, transaction costs, and uncertainty. No AI model or calibrated probability is connected.',
                         'data_quality': md.data_quality('Local explanatory text', 'available')})


class AIBrainFusionView(ResearchView):
    def get(self, request):
        symbol = md.validate_symbol(request.query_params.get('symbol', 'QQQ'))
        frame = required_history(symbol, '6mo')
        if len(frame) < 20:
            raise Unavailable('At least 20 observations are needed for indicators.')
        signal = signal_payload(symbol, frame, asset_type(symbol))
        return Response({'symbol': symbol, 'signal': signal, 'data_quality': signal['data_quality'],
                         'method': 'Historical indicator checklist; no LLM, no calibrated probability, no option-price forecast.'})

    def post(self, request):
        symbol = md.validate_symbol(request.data.get('symbol', 'QQQ'))
        frame = required_history(symbol, '6mo')
        if len(frame) < 20:
            raise Unavailable('At least 20 observations are needed for indicators.')
        signal = signal_payload(symbol, frame, asset_type(symbol))
        return Response({'symbol': symbol, 'signal': signal, 'data_quality': signal['data_quality']})


class BudgetScalpFinderView(ResearchView):
    def get(self, request):
        raise Unavailable('Options recommendations require verified executable option quotes, spreads, and Greeks. No such feed is connected.')


class Options6MoBacktestView(ResearchView):
    def get(self, request):
        raise Unavailable('Historical option-contract data is not connected. Underlying daily ranges cannot establish historical option performance.')


class PaperTradingView(ResearchView):
    def get(self, request):
        return Response({'error': 'Use browser-local paper trading. The shared global backend account has been retired.'}, status=410)

    post = get


class HistoricalBacktestView(ResearchView):
    def get(self, request):
        params = request.query_params
        symbol = md.validate_symbol(params.get('symbol', 'QQQ'))
        period = params.get('period', '1y')
        if period not in {'3mo', '6mo', '1y', '5y', '10y'}:
            raise ValueError('Unsupported backtest period.')
        capital = finite_number(params.get('capital', 10000), 'capital', 1, 1e9)
        fee = finite_number(params.get('fee_bps', 10), 'fee_bps', 0, 100)
        slippage = finite_number(params.get('slippage_bps', 5), 'slippage_bps', 0, 100)
        strategy = params.get('strategy', 'MACD').upper()
        if strategy not in {'MACD', 'EMA', 'CONFLUENCE'}:
            raise ValueError('Supported strategies: MACD, EMA, CONFLUENCE.')
        mode = params.get('validation', 'full')
        if mode not in {'full','holdout'}:
            raise ValueError('Supported validation modes: full, holdout.')
        if mode == 'holdout':
            from api.services.strategy_validation import validate_strategy
            return Response({'symbol':symbol, **validate_strategy(required_history(symbol, period), capital, fee, slippage)})
        result = backtest_ohlcv(required_history(symbol, period), strategy=params.get('strategy', 'MACD'),
                               capital=capital, fee_bps=fee, slippage_bps=slippage)
        return Response({'symbol': symbol, **result})


class TenYearBacktestView(HistoricalBacktestView):
    def get(self, request):
        symbol = md.validate_symbol(request.query_params.get('symbol', 'QQQ'))
        return Response({'symbol': symbol, **backtest_ohlcv(required_history(symbol, '10y'),
                         strategy=request.query_params.get('strategy', 'CONFLUENCE'))})


class PortfolioOptimizerView(ResearchView):
    def get(self, request):
        return Response(allocation_candidates(aligned_returns(portfolio_histories(request.query_params))))


class CorrelationView(ResearchView):
    def get(self, request):
        returns = aligned_returns(portfolio_histories(request.query_params))
        matrix = returns.corr().astype(object).where(pd.notna(returns.corr()), None).to_dict()
        return Response({'symbols': list(returns.columns), 'matrix': matrix, 'observations': len(returns),
                         'start_date': str(returns.index[0].date()), 'end_date': str(returns.index[-1].date()),
                         'input_data_quality': input_quality(returns),
                         'data_quality': aggregate_quality(returns, 'Historical common-date returns')})


class PortfolioRiskAnalyticsView(ResearchView):
    def get(self, request):
        return self._calculate(request.query_params)

    def post(self, request):
        return self._calculate(request.data)

    def _calculate(self, params):
        weights = params.get('weights', {'QQQ': .5, 'SPY': .5})
        if not isinstance(weights, dict) or not 1 <= len(weights) <= 12:
            raise ValueError('weights must be an object with 1 to 12 tickers.')
        # Validate bounds before fetching data.
        from api.services.backtesting import finite_number
        finite_number(params.get('capital', 10000), 'capital', .01, 1e9)
        finite_number(params.get('horizon', 30), 'horizon', 1, 252)
        clean = {md.validate_symbol(s): finite_number(v, 'weight', 0, 1e6) for s, v in weights.items()}
        if sum(clean.values()) <= 0:
            raise ValueError('Weights must have a positive total.')
        histories = {s: required_history(s) for s, w in clean.items() if w > 0}
        active = {s: w for s, w in clean.items() if w > 0}
        return Response(portfolio_metrics(aligned_returns(histories), active, params.get('capital', 10000),
                                           params.get('horizon', 30), params.get('seed', 42)))
