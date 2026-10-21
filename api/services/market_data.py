"""Bounded Yahoo history access with explicit source and observation freshness."""
import copy
import logging
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from django.conf import settings

import numpy as np
import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)
QUOTE_CACHE = {}
HISTORY_CACHE = {}
NEWS_CACHE = {}
_lock = threading.RLock()
SOURCE = 'Yahoo Finance via yfinance'


def validate_symbol(symbol):
    if not isinstance(symbol, str) or not re.fullmatch(r'[A-Z0-9^][A-Z0-9.^=\-]{0,19}', symbol.strip().upper()):
        raise ValueError('Use a valid ticker symbol (maximum 20 characters).')
    return symbol.strip().upper()


def data_quality(source, status, observed_at=None, limitations=None):
    return {'source': source, 'status': status, 'observed_at': observed_at,
            'retrieved_at': datetime.now(timezone.utc).isoformat(),
            'limitations': limitations or []}


def clear_caches():
    with _lock:
        QUOTE_CACHE.clear()
        HISTORY_CACHE.clear()
        NEWS_CACHE.clear()


def _store(cache, key, value):
    with _lock:
        if len(cache) >= 256 and key not in cache:
            cache.pop(next(iter(cache)))
        cache[key] = (time.monotonic(), value)


def get_history(symbol, period='1y', interval='1d'):
    symbol = validate_symbol(symbol)
    if period not in {'5d', '1mo', '3mo', '6mo', '1y', '5y', '10y'} or interval not in {'1m', '5m', '15m', '1h', '1d', '1wk', '1mo'}:
        raise ValueError('Unsupported history period or interval.')
    key = (symbol, period, interval)
    with _lock:
        cached = HISTORY_CACHE.get(key)
    if cached and time.monotonic() - cached[0] < 120:
        return cached[1].copy()
    try:
        cache_path = str(settings.MARKET_CACHE_PATH)
        Path(cache_path).mkdir(parents=True, exist_ok=True)
        yf.set_tz_cache_location(cache_path)
        frame = yf.Ticker(symbol).history(period=period, interval=interval, auto_adjust=True, timeout=10)
        required = ['Open', 'High', 'Low', 'Close', 'Volume']
        if frame.empty or not set(required).issubset(frame.columns):
            return pd.DataFrame()
        frame = frame[required].apply(pd.to_numeric, errors='coerce').replace([np.inf, -np.inf], np.nan).dropna()
        frame = frame[(frame[['Open', 'High', 'Low', 'Close']] > 0).all(axis=1) & (frame['Volume'] >= 0)]
        frame = frame[~frame.index.duplicated(keep='last')].sort_index()
        frame.attrs['data_quality'] = data_quality(SOURCE, 'available', _observed(frame),
            ['Adjusted historical bars; quotes may be delayed. Daily timestamps identify sessions, not quote times.'])
        _store(HISTORY_CACHE, key, frame.copy())
        return frame
    except Exception as exc:
        logger.warning('History unavailable for %s (%s)', symbol, type(exc).__name__)
        return pd.DataFrame()


def _observed(frame):
    return pd.Timestamp(frame.index[-1]).isoformat() if not frame.empty else None


def get_quote(symbol):
    symbol = validate_symbol(symbol)
    with _lock:
        cached = QUOTE_CACHE.get(symbol)
    if cached and time.monotonic() - cached[0] < 120:
        return copy.deepcopy(cached[1])
    frame = get_history(symbol, period='5d')
    if frame.empty and not cached:
        from .research import stored_history
        frame = stored_history(symbol)
    if not frame.empty:
        price = float(frame['Close'].iloc[-1])
        prev = float(frame['Close'].iloc[-2]) if len(frame) > 1 else None
        change = (price / prev - 1) * 100 if prev else None
        result = {'symbol': symbol, 'current_price': price, 'previous_close': prev,
                  'daily_change_pct': change, 'percent_change': change,
                  'last_updated': _observed(frame),
                  'data_quality': data_quality(frame.attrs.get('data_quality', {}).get('source', SOURCE), 'stale', _observed(frame),
                      ['Latest available daily close; this is not a live executable quote.'])}
        if frame.attrs.get('data_quality', {}).get('retrieved_at'):
            result['data_quality']['retrieved_at'] = frame.attrs['data_quality']['retrieved_at']
        _store(QUOTE_CACHE, symbol, result)
        return copy.deepcopy(result)
    if cached:
        result = copy.deepcopy(cached[1])
        result['data_quality']['status'] = 'stale'
        result['data_quality']['limitations'] = ['Provider unavailable; last observed close retained.']
        return result
    return {'symbol': symbol, 'current_price': None, 'previous_close': None,
            'daily_change_pct': None, 'percent_change': None, 'last_updated': None,
            'data_quality': data_quality(SOURCE, 'unavailable', limitations=['No observed price available.'])}


def get_news(symbol='QQQ'):
    symbol = validate_symbol(symbol)
    with _lock:
        cached = NEWS_CACHE.get(symbol)
    if cached and time.monotonic() - cached[0] < 240:
        return copy.deepcopy(cached[1])
    news = []
    try:
        # yfinance news has no supported per-call timeout; avoid its unbounded call.
        # Use the provider's RSS endpoint through a request with a timeout instead.
        import requests
        import xml.etree.ElementTree as ET
        response = requests.get('https://feeds.finance.yahoo.com/rss/2.0/headline',
                                params={'s': symbol, 'region': 'US', 'lang': 'en-US'}, timeout=8)
        response.raise_for_status()
        root = ET.fromstring(response.content)
        for index, item in enumerate(root.findall('.//item')[:10]):
            title = item.findtext('title')
            url = item.findtext('link') or ''
            if title and url.startswith('https://'):
                news.append({'id': index, 'symbol': symbol, 'title': title, 'url': url,
                             'source': 'Yahoo Finance RSS', 'time': item.findtext('pubDate') or 'Unknown',
                             'sentiment': 'UNSCORED', 'score': 0})
    except Exception:
        logger.warning('News unavailable for %s', symbol)
    result = {'news': news, 'fear_greed_score': None, 'fear_greed_label': 'Not measured',
              'data_quality': data_quality('Yahoo Finance RSS', 'available' if news else 'unavailable',
                  limitations=['Headlines are not a Fear & Greed index. No calibrated sentiment model is applied.'])}
    if news:
        _store(NEWS_CACHE, symbol, result)
    return result
