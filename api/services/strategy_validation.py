"""Chronological holdout checks for fixed rules; no optimizer sees holdout prices."""
import numpy as np
import pandas as pd
import hashlib
import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from .backtesting import fixed_strategy_backtest
from .backtesting import backtest_ohlcv, finite_number, maximum_drawdown
from .market_data import data_quality


def _whole_share_reference(test, capital, fee_bps, slippage_bps):
    fee, slip = fee_bps / 10000, slippage_bps / 10000
    unit_cost = float(test.Open.iloc[0]) * (1 + slip) * (1 + fee)
    quantity = int(np.floor(capital / unit_cost))
    cash = capital - quantity * unit_cost
    values = [cash + quantity * float(close) for close in test.Close]
    values[-1] = cash + quantity * float(test.Close.iloc[-1]) * (1 - slip) * (1 - fee)
    return {'strategy':'BUY_AND_HOLD', 'initial_capital':capital, 'final_equity':values[-1],
            'quantity':quantity, 'uninvested_cash':cash, 'return_pct':(values[-1] / capital - 1) * 100,
            'max_drawdown_pct':maximum_drawdown([capital] + values),
            'start_date':str(test.index[0].date()), 'end_date':str(test.index[-1].date()),
            'equity_curve':[{'date':str(stamp.date()), 'equity':value} for stamp,value in zip(test.index,values)]}


def validate_fixed_strategy(frame, capital=10000, fee_bps=10, slippage_bps=5):
    """Retrospective later-period check of the frozen protocol, never an optimizer."""
    capital = finite_number(capital, 'capital', 1, 1e9)
    fee_bps = finite_number(fee_bps, 'fee_bps', 0, 100)
    slippage_bps = finite_number(slippage_bps, 'slippage_bps', 0, 100)
    if not isinstance(frame.index, pd.DatetimeIndex) or frame.index.hasnans or frame.index.has_duplicates:
        raise ValueError('Fixed-rule holdout requires unique, valid daily session timestamps.')
    if pd.Index(frame.index.date).has_duplicates:
        raise ValueError('Fixed-rule holdout requires one bar per daily session, not intraday rows.')
    today = datetime.now(ZoneInfo('America/New_York')).date()
    original_count = len(frame)
    frame = frame.loc[frame.index.date < today].sort_index().copy()
    if len(frame) < 150:
        raise ValueError('Fixed-rule holdout needs at least 150 unique daily bars. Choose 1y or longer.')
    frame[['Open','High','Low','Close','Volume']] = frame[['Open','High','Low','Close','Volume']].apply(pd.to_numeric, errors='coerce')
    if frame.attrs.get('data_quality'):
        frame.attrs['data_quality'] = {**frame.attrs['data_quality'], 'observed_at':frame.index[-1].isoformat()}
    prices = frame[['Open','High','Low','Close']].to_numpy(dtype=float)
    if (not np.isfinite(prices).all() or (prices <= 0).any() or
        (frame.High < frame[['Open','Close']].max(axis=1)).any() or
        (frame.Low > frame[['Open','Close']].min(axis=1)).any()):
        raise ValueError('Holdout prices must be positive finite and internally consistent OHLC bars.')
    split = int(len(frame) * .7)
    result = fixed_strategy_backtest(frame, capital, fee_bps, slippage_bps, evaluation_start=split)
    stress_fee, stress_slip = min(100., fee_bps + 10), min(100., slippage_bps + 10)
    stressed = fixed_strategy_backtest(frame, capital, stress_fee, stress_slip, evaluation_start=split)
    benchmark = _whole_share_reference(frame.iloc[split:], capital, fee_bps, slippage_bps)
    stress_benchmark = _whole_share_reference(frame.iloc[split:], capital, stress_fee, stress_slip)
    snapshot = {'bars':[{'date':str(stamp.date()), 'open':float(row.Open), 'high':float(row.High),
        'low':float(row.Low), 'close':float(row.Close),
        'volume':float(row.Volume) if np.isfinite(float(row.Volume)) else None} for stamp,row in frame.iterrows()]}
    fingerprint = hashlib.sha256(json.dumps(snapshot, sort_keys=True, allow_nan=False, separators=(',',':')).encode()).hexdigest()
    parameters = {'capital':capital, 'fee_bps':fee_bps, 'slippage_bps':slippage_bps}
    identity = {'method':'fixed-holdout-v1', 'protocol':result['protocol']['version'],
                'data_fingerprint':fingerprint, 'parameters':parameters, 'split_index':split}
    evaluation_id = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()[:20]
    excess = result['return_pct'] - benchmark['return_pct']
    verdict = ('Not validated: no closed trades in this holdout.' if not result['total_trades'] else
        'Not validated: the fixed rule did not produce a positive net holdout return.' if result['return_pct'] <= 0 else
        'Not validated: positive net return, but below the passive reference.' if excess <= 0 else
        'Not validated: positive historical comparison; forward evidence is still required.')
    warnings = [
        'Historical holdout, not pristine unseen data: these prices may already have been inspected. No future profitability is established.',
        'The earlier 70% supplies indicator context only. No rule is selected, fitted or optimized; holdout starts from fresh cash with no prior position.',
        'One split only. Repeated ticker, date-window or cost selection after viewing results creates hindsight and selection bias.',
        'Strategy uses a 1% planned stop-risk and 20% entry-cost cap. Passive reference invests all affordable whole shares, has different exposure, and is not limited to 14 days.',
        'Adjusted-price revisions, missing sessions, survivorship, unverified intraday fills/liquidity, taxes, FX and changing conditions remain limitations.',
        'Drawdown uses daily closing marks; it does not measure all intraday losses. Cash earns zero interest.',
    ]
    if result['total_trades'] < 20:
        warnings.append('Fewer than 20 closed holdout trades: small descriptive sample; this threshold is not a test of statistical significance.')
    result['protocol']['status'] = 'Frozen rules, later-period historical evaluation. Future trading edge is not validated.'
    result['validation'] = {'mode':'fixed_rule_holdout', **identity, 'evaluation_id':evaluation_id,
        'context_start':str(frame.index[0].date()), 'context_end':str(frame.index[split-1].date()),
        'split_date':result['start_date'], 'holdout_fraction':.3, 'verdict':verdict,
        'completed_before_date':today.isoformat(), 'excluded_unfinished_or_future_bars':original_count-len(frame),
        'excess_return_pct_points':excess, 'warnings':warnings,
        'generated_at':datetime.now(timezone.utc).isoformat()}
    result['parameters'] = parameters
    result['input_snapshot'] = snapshot
    result['benchmark'] = benchmark
    result['cash_benchmark'] = {'strategy':'CASH', 'initial_capital':capital, 'final_equity':capital,
        'return_pct':0., 'max_drawdown_pct':0., 'start_date':result['start_date'], 'end_date':result['end_date']}
    metrics = lambda r: {key:r[key] for key in ('return_pct','final_equity','max_drawdown_pct','total_trades','skipped_entry_sessions')}
    result['cost_sensitivity'] = {
        'method':'Add 10 bps to both per-side fees and slippage, each capped at 100 bps. Rules and starting cash stay fixed; quantities and trades can change.',
        'base':{**parameters, **metrics(result), 'buy_and_hold_return_pct':benchmark['return_pct']},
        'stress':{'capital':capital, 'fee_bps':stress_fee, 'slippage_bps':stress_slip,
                  **metrics(stressed), 'buy_and_hold_return_pct':stress_benchmark['return_pct']}}
    result['equity_curve'] = [{**point, 'buy_and_hold':bench['equity'], 'cash':capital}
        for point,bench in zip(result['equity_curve'],benchmark['equity_curve'])]
    result['assumptions'] = [item for item in result['assumptions'] if 'In-sample' not in item] + [
        '70% earlier daily bars provide context; only the last 30% contributes strategy or reference returns. No rule selection or fitting.',
        'Bars dated today or later in New York are excluded before splitting; intraday completeness and exchange sessions are not otherwise independently verified.',
        'Cash resets at the first holdout open; a prior-close signal may enter on that first open. Whole shares only; unused cash retained.',
        'Buy-and-hold buys at first holdout open and liquidates at final holdout close, with costs per side. It does not share the strategy risk sizing or holding cap.',
        'The JSON report preserves exact input bars and a SHA256 content fingerprint, not independent source verification. Historical figures may be revised.']
    return result


def validate_strategy(frame, capital=10000, fee_bps=10, slippage_bps=5):
    capital = finite_number(capital, 'capital', 1, 1e9)
    fee = finite_number(fee_bps, 'fee_bps', 0, 100) / 10000
    slip = finite_number(slippage_bps, 'slippage_bps', 0, 100) / 10000
    if len(frame) < 150 or frame.index.has_duplicates:
        raise ValueError('Holdout validation needs at least 150 unique daily bars. Choose 1y or longer, or sync more history.')
    frame = frame.sort_index()
    prices = frame[['Open','High','Low','Close']].to_numpy(dtype=float)
    if not np.isfinite(prices).all() or (prices <= 0).any():
        raise ValueError('Training and holdout prices must be positive finite observations.')
    split = int(len(frame) * .7)
    train = frame.iloc[:split].copy()
    training = []
    for rule in ['MACD', 'EMA', 'CONFLUENCE']:
        result = backtest_ohlcv(train, rule, capital, fee_bps, slippage_bps, evaluation_start=50, max_holding_days=14)
        training.append({'strategy':rule, 'return_pct':result['return_pct'],
                         'total_trades':result['total_trades'], 'max_drawdown_pct':result['max_drawdown_pct']})
    training.append({'strategy':'CASH', 'return_pct':0., 'total_trades':0, 'max_drawdown_pct':0.})
    best = max(training, key=lambda item: (item['return_pct'], -item['total_trades'], item['strategy'] == 'CASH'))
    test = frame.iloc[split:]
    if best['strategy'] == 'CASH':
        selected = {'strategy':'CASH', 'initial_capital':capital, 'final_equity':capital, 'return_pct':0.,
            'max_drawdown_pct':0., 'total_trades':0, 'win_rate_pct':None, 'profit_factor':None,
            'start_date':str(test.index[0].date()), 'end_date':str(test.index[-1].date()),
            'observations':len(test), 'trades':[],
            'equity_curve':[{'date':str(stamp.date()), 'equity':capital} for stamp in test.index]}
    else:
        selected = backtest_ohlcv(frame, best['strategy'], capital, fee_bps, slippage_bps,
                                 evaluation_start=split, max_holding_days=14)
    # Equal initial capital, same evaluation dates, and the same per-side cost model.
    quantity = capital / (float(test.Open.iloc[0]) * (1 + slip) * (1 + fee))
    values = [quantity * float(close) for close in test.Close]
    values[-1] *= (1 - slip) * (1 - fee)
    benchmark = {'strategy':'BUY_AND_HOLD', 'initial_capital':capital, 'final_equity':values[-1],
        'return_pct':(values[-1] / capital - 1) * 100,
        'max_drawdown_pct':maximum_drawdown([capital] + values),
        'start_date':selected['start_date'], 'end_date':selected['end_date'],
        'equity_curve':[{'date':str(stamp.date()), 'equity':value} for stamp, value in zip(test.index, values)]}
    excess = selected['return_pct'] - benchmark['return_pct']
    warnings = ['Historical selection and holdout simulation; no validated future trading edge.',
        'One split only. Repeatedly checking tickers or changing rules after viewing holdout results can overfit this test.',
        'Ticker selection and adjusted-price revisions can introduce survivorship or hindsight bias.',
        'Strategy positions use a 14-calendar-day cap; passive buy-and-hold is an unrestricted reference.',
        'Daily bars do not verify intraday execution, market impact, taxes, or live liquidity.']
    if selected['total_trades'] < 20:
        warnings.append('Fewer than 20 holdout trades: a small descriptive sample, not statistical evidence of an edge.')
    verdict = 'Not validated: cash selected because no tested training rule outperformed cash.' if best['strategy'] == 'CASH' else (
        'Not validated: selected rule lost money in the holdout.' if selected['return_pct'] <= 0 else
        'Not validated: positive holdout return, but no outperformance versus buy-and-hold.' if excess <= 0 else
        'Positive historical holdout comparison; future profitability is not validated.')
    selected['validation'] = {'mode':'chronological_holdout', 'training_fraction':.7,
        'training_start':str(train.index[50].date()), 'training_end':str(train.index[-1].date()),
        'split_date':selected['start_date'], 'training_results':training,
        'selection_rule':'Highest net training return versus cash; ties prefer fewer closed trades, then cash.',
        'excess_return_pct_points':excess, 'verdict':verdict, 'warnings':warnings}
    selected['benchmark'] = benchmark
    selected['equity_curve'] = [{**point, 'buy_and_hold':bench['equity']} for point, bench in zip(selected['equity_curve'],benchmark['equity_curve'])]
    selected['data_quality'] = frame.attrs.get('data_quality') or data_quality('Adjusted historical market bars', 'available')
    selected['assumptions'] = [f'{fee_bps} bps fees and {slippage_bps} bps slippage per side.',
        '70% earlier data selects a fixed rule or cash; 30% later data is evaluated without refitting.',
        'Indicators warm up on earlier observations; cash resets at first holdout open; no training position carries over.',
        'Strategy positions use next-open entry and a 14-calendar-day cap. Session schedule comes from observed dates; missing bars can bias retrospective deadline scheduling.',
        'Open positions liquidated at final close; passive benchmark buys at first holdout open and holds until final close.']
    return selected
