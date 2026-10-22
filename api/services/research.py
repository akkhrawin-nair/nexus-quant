"""Observed indicator snapshots and explicitly heuristic setup scores."""
import numpy as np
import pandas as pd
from api.models import MarketPrice
from .market_data import data_quality, get_history


def stored_history(symbol):
    rows = list(MarketPrice.objects.filter(symbol=symbol).order_by('trade_date').values())
    if not rows:
        return pd.DataFrame()
    frame = pd.DataFrame(rows).rename(columns={'open_price': 'Open', 'high_price': 'High',
        'low_price': 'Low', 'close_price': 'Close', 'volume': 'Volume'})
    frame.index = pd.to_datetime(frame.trade_date)
    frame.attrs['data_quality'] = data_quality('Stored Yahoo Finance adjusted daily bars', 'stale',
        str(frame.index[-1].date()), ['Stored session data; sync to update. Not a live quote.'])
    provider_time = rows[-1]['provider_retrieved_at']
    frame.attrs['data_quality']['retrieved_at'] = provider_time.isoformat() if provider_time else None
    frame.attrs['data_quality']['stored_at'] = rows[-1]['retrieved_at'].isoformat()
    frame.attrs['data_quality']['retrieval_kind'] = 'provider_response'
    return frame


def candles(frame):
    result = []
    for stamp, row in frame.iterrows():
        timestamp = pd.Timestamp(stamp)
        result.append({'time': str(timestamp.date()), 'date': str(timestamp.date()),
                       'open': float(row.Open), 'high': float(row.High), 'low': float(row.Low),
                       'close': float(row.Close), 'price': float(row.Close), 'volume': int(row.Volume)})
    return result


def indicator_snapshot(frame):
    close = frame.Close
    price = float(close.iloc[-1])
    ema20 = close.ewm(span=20, adjust=False).mean()
    ema50 = close.ewm(span=50, adjust=False).mean()
    macd = close.ewm(span=12, adjust=False).mean() - close.ewm(span=26, adjust=False).mean()
    line = macd.ewm(span=9, adjust=False).mean()
    changes = close.diff().tail(14)
    up, down = float(changes.clip(lower=0).mean()), float(-changes.clip(upper=0).mean())
    rsi = 100 - 100 / (1 + up / down) if down > 0 else (100. if up > 0 else 50.)
    mean, std = float(close.tail(20).mean()), float(close.tail(20).std(ddof=0))
    upper, lower = mean + 2 * std, mean - 2 * std
    baseline_vol = float(frame.Volume.iloc[:-1].tail(20).mean())
    rv = float(frame.Volume.iloc[-1] / baseline_vol) if baseline_vol > 0 else 0.
    return {'price': price, 'ema20': float(ema20.iloc[-1]), 'ema50': float(ema50.iloc[-1]),
            'macd': float(macd.iloc[-1]), 'macd_signal': float(line.iloc[-1]), 'rsi': rsi,
            'pct_b': (price - lower) / (upper - lower) * 100 if upper > lower else 50.,
            'bb_width_pct': (upper - lower) / mean * 100, 'vol_spike_ratio': rv}


def volatility(frame, symbol):
    hv = float(np.log(frame.Close).diff().dropna().tail(30).std(ddof=1) * np.sqrt(252)) if len(frame) > 5 else None
    return {'symbol': symbol, 'close_price': float(frame.Close.iloc[-1]),
            'historical_volatility': f'{hv * 100:.1f}%' if hv is not None and np.isfinite(hv) else None,
            'implied_volatility': None, 'iv_rank': None, 'pc_ratio': None,
            'implied_move': None, 'gamma_exposure': None, 'volume': int(frame.Volume.iloc[-1]),
            'is_high_iv': False, 'is_low_iv': False, 'is_neg_gamma': False,
            'data_quality': {**frame.attrs.get('data_quality', data_quality('Historical daily bars', 'available', str(frame.index[-1].date()))),
                'limitations': frame.attrs.get('data_quality', {}).get('limitations', []) +
                    ['Historical volatility is not option IV. IV rank, put/call ratio, and GEX require an options feed.']}}


def signal_payload(symbol, frame, kind='Stock'):
    if len(frame) < 20:
        raise ValueError('At least 20 bars are required for an indicator snapshot.')
    stats = indicator_snapshot(frame)
    price = stats['price']
    previous = float(frame.Close.iloc[-2])
    change = (price / previous - 1) * 100
    checks = [
        ('trend', 'Price above EMA20', price > stats['ema20']),
        ('alignment', 'EMA20 above EMA50', stats['ema20'] > stats['ema50']),
        ('volume', 'Relative volume at least 1.25x', stats['vol_spike_ratio'] >= 1.25),
        ('rsi', 'RSI between 40 and 64', 40 <= stats['rsi'] <= 64),
        ('macd', 'MACD above signal', stats['macd'] > stats['macd_signal'])]
    layers = [{'id': key, 'name': title, 'passed': bool(passed), 'detail': title} for key, title, passed in checks]
    count = sum(bool(x[2]) for x in checks)
    score = count * 20
    # ATR-derived educational levels; not probability or calibrated target forecasts.
    prev = frame.Close.shift(1)
    tr = pd.concat([frame.High - frame.Low, (frame.High - prev).abs(), (frame.Low - prev).abs()], axis=1).max(axis=1)
    atr = float(tr.tail(14).mean())
    stop_pct = max(.1, atr / price * 200)
    target_pct = stop_pct * 2
    quality = frame.attrs.get('data_quality') or data_quality('Observed historical bars', 'stale', str(frame.index[-1].date()))
    radar = {**stats, 'rsi_label': f'RSI {stats["rsi"]:.1f}', 'rsi_state': 'overbought' if stats['rsi'] >= 70 else 'oversold' if stats['rsi'] <= 30 else 'neutral',
             'bb_label': 'Historical Bollinger Bands', 'bb_state': 'normal',
             'vol_label': f'{stats["vol_spike_ratio"]:.2f}x relative volume', 'vol_state': 'surge' if stats['vol_spike_ratio'] >= 1.5 else 'normal'}
    meta = {'conviction_score': score, 'confluence_score': score, 'score_kind': 'heuristic',
            'is_golden_opportunity': count >= 4, 'is_70_plus_edge': False,
            'passed_count': count, 'layers': layers, 'holding_duration': 'Research scenario',
            'target_pct': target_pct, 'stop_pct': stop_pct, 'target_price_num': price * (1 + target_pct / 100),
            'stop_loss_num': price * (1 - stop_pct / 100), 'risk_reward_ratio': 2.,
            'trade_setup_reason': 'Indicator checklist score; no calibrated win probability. Levels are 2x/4x ATR scenarios.',
            'earnings_blackout': False, 'earnings_info': {'status': 'UNKNOWN', 'earnings_date': None, 'has_earnings': False},
            'macro_regime': {'status': 'NOT_EVALUATED', 'is_safe': False}}
    recent = candles(frame.tail(60))
    return {'symbol': symbol, 'asset_type': kind, 'current_price': price, 'close_price': price,
            'previous_close': previous, 'percent_change': change, 'daily_change_pct': change, 'change_24h': change,
            'signal_date': str(frame.index[-1].date()), 'signal_trigger_date': str(frame.index[-1].date()),
            'last_updated': str(frame.index[-1].date()), 'macd': stats['macd'], 'macd_signal': stats['macd_signal'],
            'radar': radar, 'golden_opportunity': meta, 'volatility': volatility(frame, symbol),
            'observed_range_low': float(frame.Low.min()), 'observed_range_high': float(frame.High.max()),
            'candles': recent, 'history': recent, 'data_quality': quality,
            'earnings_info': meta['earnings_info'], 'earnings_blackout': False}
