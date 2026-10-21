"""Chronological holdout checks for fixed rules; no optimizer sees holdout prices."""
import numpy as np
from .backtesting import backtest_ohlcv, finite_number, maximum_drawdown
from .market_data import data_quality


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
