"""Idempotent market ingestion shared by HTTP, CLI, and scheduled jobs."""
from django.db import transaction
from django.utils.dateparse import parse_datetime
from django.utils.timezone import is_aware

from api.models import MarketPrice
from .market_data import clear_caches, get_history, validate_symbol

DEFAULT_SYMBOLS = {'QQQ': 'ETF', 'SPY': 'ETF', 'NVDA': 'Stock', 'AAPL': 'Stock',
                   'TSLA': 'Stock', 'BTC-USD': 'Crypto', 'ETH-USD': 'Crypto', 'GLD': 'Commodity'}


def asset_type(symbol):
    if symbol.endswith('-USD'):
        return 'Crypto'
    if symbol in {'QQQ', 'SPY', 'VOO', 'IWM', 'DIA', 'TLT', 'XLK', 'XLF', 'XLE'}:
        return 'ETF'
    return 'Commodity' if symbol in {'GLD', 'SLV', 'USO', 'UNG'} else 'Stock'


def ingest_market_data(symbols=None, force_refresh=False):
    stored = dict(MarketPrice.objects.order_by().values_list('symbol', 'asset_type').distinct())
    if symbols is None:
        symbols = {**DEFAULT_SYMBOLS, **stored}
    requested = {validate_symbol(symbol): kind for symbol, kind in symbols.items()}
    if len(set(DEFAULT_SYMBOLS) | set(stored) | set(requested)) > 60:
        raise ValueError('The watchlist supports at most 60 symbols, including the default universe. No data was changed.')
    symbols = requested
    result = {'created': 0, 'updated': 0, 'failed': 0, 'errors': {}}
    for raw_symbol, kind in symbols.items():
        try:
            symbol = validate_symbol(raw_symbol)
            frame = get_history(symbol, force_refresh=True) if force_refresh else get_history(symbol)
            if frame.empty:
                raise ValueError('No historical observations returned by provider.')
            frame = frame.copy()
            stamp = frame.attrs.get('data_quality', {}).get('retrieved_at')
            try:
                provider_time = parse_datetime(stamp) if isinstance(stamp, str) else None
            except ValueError:
                provider_time = None
            if provider_time is not None and not is_aware(provider_time):
                provider_time = None
            frame['EMA_20'] = frame.Close.ewm(span=20, adjust=False).mean()
            frame['MACD'] = frame.Close.ewm(span=12, adjust=False).mean() - frame.Close.ewm(span=26, adjust=False).mean()
            frame['MACD_Signal'] = frame.MACD.ewm(span=9, adjust=False).mean()
            created = updated = 0
            with transaction.atomic():
                for timestamp, row in frame.iterrows():
                    _, is_new = MarketPrice.objects.update_or_create(
                        symbol=symbol, trade_date=timestamp.date(), defaults={
                            'asset_type': kind or asset_type(symbol), 'open_price': float(row.Open),
                            'high_price': float(row.High), 'low_price': float(row.Low),
                            'close_price': float(row.Close), 'volume': int(row.Volume),
                            'ema_20': float(row.EMA_20), 'macd': float(row.MACD),
                            'macd_signal': float(row.MACD_Signal), 'provider_retrieved_at': provider_time})
                    created += int(is_new)
                    updated += int(not is_new)
            result['created'] += created
            result['updated'] += updated
        except Exception as exc:
            result['failed'] += 1
            result['errors'][str(raw_symbol)] = str(exc)
    clear_caches()
    return result
