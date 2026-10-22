"""Transparent technical reading and explicitly dated, reviewed issuer context."""
import copy
import json
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
import numpy as np
import pandas as pd
from .market_data import data_quality, validate_symbol
from .research import candles, indicator_snapshot
from .technical_outlook import technical_outlook


def reviewed_context(symbol, today=None):
    today = today or datetime.now(ZoneInfo('America/New_York')).date()
    payload = json.loads((Path(__file__).resolve().parent.parent / 'data' / 'issuer_briefs.json').read_text(encoding='utf-8'))
    context = copy.deepcopy(payload.get(symbol, {'business':'No issuer review is maintained for this ticker.', 'bull_case':'Unreviewed.', 'bear_case':'Unreviewed.', 'notes':[], 'events':[]}))
    reviewed = date.fromisoformat(payload['reviewed_at'])
    age = (today - reviewed).days
    context.update({'reviewed_at':payload['reviewed_at'] if symbol in payload else None, 'needs_review':symbol not in payload or age > 7 or age < 0,
        'coverage':'Selected issuer releases, manually reviewed; not exhaustive or continuously updated. No confirmed event listed does not mean no event risk.'})
    for event in context['events']:
        stamp = date.fromisoformat(event['date'])
        event['window'] = 'past' if stamp < today else 'within_14_days' if stamp <= today + timedelta(days=14) else 'outside_14_days'
    return context


def technical_brief(symbol, frame, today=None):
    symbol = validate_symbol(symbol)
    if len(frame) < 60 or frame.index.has_duplicates:
        raise ValueError('An analyst brief requires at least 60 unique daily observations. Sync this ticker first.')
    frame = frame.sort_index()
    values = frame[['Open','High','Low','Close','Volume']].to_numpy(dtype=float)
    if not np.isfinite(values).all() or (values[:,:4] <= 0).any() or (values[:,4] < 0).any():
        raise ValueError('Price and volume observations must be valid and finite.')
    snapshot = indicator_snapshot(frame)
    previous = frame.iloc[-21:-1]
    support, resistance = float(previous.Low.min()), float(previous.High.max())
    near_high = float(frame.High.iloc[-6:-1].max())
    true_range = pd.concat([frame.High-frame.Low, (frame.High-frame.Close.shift()).abs(), (frame.Low-frame.Close.shift()).abs()], axis=1).max(axis=1)
    atr = float(true_range.tail(14).mean())
    price, ema20, ema50 = snapshot['price'], snapshot['ema20'], snapshot['ema50']
    trend = 'Uptrend' if price > ema20 > ema50 else 'Downtrend' if price < ema20 < ema50 else 'Mixed / transition'
    momentum = 'MACD above signal' if snapshot['macd'] > snapshot['macd_signal'] else 'MACD at or below signal'
    reading = f'{trend}: close ${price:.4f}, EMA20 ${ema20:.4f}, EMA50 ${ema50:.4f}. {momentum}. '
    reading += f'Relative volume {snapshot["vol_spike_ratio"]:.2f}× its prior-20-session baseline. '
    reading += 'A headline is not confirmation that price has changed trend.'
    if price < support:
        headline = 'Range breakdown; a recovery thesis is unconfirmed.'
        interpretation = f'The latest close is below the prior-20-session low (${support:.4f}). That former range floor may become resistance. Positive business news does not establish that selling has ended.'
    elif price > resistance and snapshot['vol_spike_ratio'] >= 1.25:
        headline = 'Historical breakout with increased volume.'
        interpretation = 'The latest saved close cleared the prior range with elevated volume. This is historical technical alignment, not proof of a profitable entry or a live fill.'
    elif trend == 'Downtrend':
        headline = 'Long-side recovery remains countertrend.'
        interpretation = 'Price and EMA structure are falling. A bullish company story has not yet been confirmed by this trend model; an attempted recovery can fail.'
    else:
        headline = 'Trend and price confirmation need a defined entry condition.'
        interpretation = 'Use the scenario conditions below and the issuer bull/bear cases together. A constructive trend or growing order book alone is not sufficient evidence of a future gain.'
    view = frame.tail(90)
    overlays = []
    for span, color in [(20,'#0284c7'),(50,'#8b5cf6')]:
        series = frame.Close.ewm(span=span, adjust=False).mean().loc[view.index]
        overlays.append({'name':f'EMA{span}', 'color':color, 'data':[{'time':str(stamp.date()), 'value':float(value)} for stamp,value in series.items()]})
    return {'symbol':symbol, 'as_of':str(frame.index[-1].date()), 'trend':trend, 'reading':reading,
        'indicators':{**snapshot, 'atr14':atr}, 'levels':{'support':support, 'resistance':resistance, 'near_high':near_high},
        'assessment':{'headline':headline,'interpretation':interpretation},
        'candles':candles(view), 'overlays':overlays, 'outlook':technical_outlook(symbol,frame,today),
        'scenarios':[
            {'title':'Bullish confirmation to watch', 'condition':f'A daily close above EMA20 (${ema20:.4f}) and the prior-5-session high (${near_high:.4f}) with relative volume at least 1.25×. The wider 20-session high (${resistance:.4f}) is a separate reference, not a promised target. This is a heuristic, not a buy signal.',
             'invalidation':f'A failed recovery back below its entry reference weakens that thesis. A close below the prior-20-session low (${support:.4f}) is further contrary evidence; choose a separate executable stop in your broker.'},
            {'title':'Downside / failed recovery', 'condition':f'A daily close below the prior-20-session low (${support:.4f}) weakens the recent range. A falling EMA structure adds contrary evidence to a long trade.',
             'invalidation':'A recovery into the range and improving EMA/MACD readings would require reassessment, not an automatic reversal.'}
        ],
        'context':reviewed_context(symbol,today),
        'data_quality':frame.attrs.get('data_quality') or data_quality('Historical daily bars','stale',str(frame.index[-1].date())),
        'method':'Rule-based technical interpretation, not a calibrated forecast. Levels use the 20 completed bars before the latest bar; support/resistance are references, not barriers. EMA20/50 and MACD use causal exponential averages; ATR14 is a simple mean of true range. Daily bars cannot establish executable intraday prices.'}
