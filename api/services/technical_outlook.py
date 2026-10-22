"""Causal, deliberately simple trend projection; scenarios are not probabilities."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import numpy as np


def _estimate(closes, steps):
    logs = np.log(np.asarray(closes, dtype=float))
    x = np.arange(20, dtype=float) - 9.5
    slope = float(np.dot(x, logs[-20:] - logs[-20:].mean()) / np.dot(x, x))
    sigma = float(np.std(np.diff(logs[-61:]), ddof=1))
    h = np.arange(1, steps + 1)
    center = logs[-1] + slope * np.cumsum(.85 ** (h - 1))
    spread = sigma * np.sqrt(h)
    # Bounds protect JSON/renderer arithmetic for pathological inputs.
    lower, central, upper = [np.exp(np.clip(v, -690, 690)) for v in (center-spread, center, center+spread)]
    return lower, central, upper


def technical_outlook(symbol, frame, today=None):
    today = today or datetime.now(ZoneInfo('America/New_York')).date()
    frame = frame.sort_index()
    closes = frame.Close.to_numpy(dtype=float)
    if len(closes) < 60 or frame.index.has_duplicates or not np.isfinite(closes).all() or (closes <= 0).any():
        raise ValueError('A technical outlook needs 60 unique observations with finite positive closes.')
    anchor = frame.index[-1].date()
    end = anchor + timedelta(days=14)
    daily = symbol.endswith('-USD')
    dates = [anchor + timedelta(days=day) for day in range(1, 15)
             if daily or (anchor + timedelta(days=day)).weekday() < 5]
    lower, central, upper = _estimate(closes, len(dates))
    points = [{'date': str(stamp), 'lower': float(lo), 'central': float(mid), 'upper': float(hi)}
              for stamp, lo, mid, hi in zip(dates, lower, central, upper)]
    # Fixed rule, sequential non-overlapping evaluation windows. Every forecast
    # is fit only on its origin's prefix; neither model selection nor refitting
    # uses the evaluation endpoints. Weekend/holiday gaps >14 days are omitted.
    steps = 14 if daily else 10
    windows = []
    for origin in range(59, len(closes) - steps, steps):
        endpoint = origin + steps
        if (frame.index[endpoint].date() - frame.index[origin].date()).days > 14:
            continue
        predicted = float(_estimate(closes[:origin+1], steps)[1][-1])
        windows.append({'origin': str(frame.index[origin].date()), 'end': str(frame.index[endpoint].date()),
                        'predicted': predicted, 'actual': float(closes[endpoint]), 'flat': float(closes[origin])})
    evaluation = {'samples': len(windows), 'horizon_sessions': steps, 'windows': windows,
                  'model_mae_pct': None, 'flat_mae_pct': None, 'beats_flat': None}
    if windows:
        evaluation['model_mae_pct'] = float(np.mean([abs(w['predicted']-w['actual'])/w['actual']*100 for w in windows]))
        evaluation['flat_mae_pct'] = float(np.mean([abs(w['flat']-w['actual'])/w['actual']*100 for w in windows]))
        # A floating-point round trip through log/exp must not turn a tie into
        # a claim of improved forecasting accuracy (errors are percentage points).
        evaluation['beats_flat'] = evaluation['flat_mae_pct'] - evaluation['model_mae_pct'] > 1e-9
    return {'model_version': 'damped-logtrend-v1', 'anchor_date': str(anchor), 'anchor_price': float(closes[-1]), 'end_date': str(end),
            'expired': today > end, 'observation_age_days': (today-anchor).days,
            'points': points, 'evaluation': evaluation,
            'method': 'Central estimate: least-squares slope of the last 20 log closes, with each future step retaining 85% of the preceding step’s trend. Lower/upper scenarios: central log estimate ± trailing-60-return sample volatility × square root of projected sessions. These are illustrative volatility scenarios, not calibrated confidence bounds or price targets. Exponentials are bounded for numerical safety. No news or option prices enter this model.',
            'calendar': 'Calendar days for -USD crypto; weekdays for other assets. Exchange holidays are not excluded, so projected dates are illustrative. The horizon ends 14 calendar days after the latest saved session, never silently moved to today.',
            'evaluation_note': 'Fixed-rule historical walk-forward endpoint error on sequential non-overlapping windows, using only data known at each origin. MAE is mean absolute percentage error relative to actual endpoint close. Compare with an unchanged-price forecast. Sparse/missing observations can alter the horizon; windows spanning more than 14 calendar days are excluded. This retrospective diagnostic is not independent live validation or a trading-return backtest.'}
