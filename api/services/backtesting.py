"""Long-only daily-bar research backtests; signal close precedes execution open."""
import numpy as np
import pandas as pd
from .market_data import data_quality


def finite_number(value, name, minimum, maximum):
    try:
        value = float(value)
    except (ValueError, TypeError):
        raise ValueError(f'{name} must be a finite number.') from None
    if not np.isfinite(value) or not minimum <= value <= maximum:
        raise ValueError(f'{name} must be between {minimum} and {maximum}.')
    return value


def maximum_drawdown(equity):
    values = np.asarray(equity, dtype=float)
    if len(values) == 0:
        return 0.0
    peaks = np.maximum.accumulate(values)
    return float(np.max(1 - values / peaks) * 100)


def strategy_signals(frame, strategy):
    close = frame.Close
    ema20 = close.ewm(span=20, adjust=False).mean()
    ema50 = close.ewm(span=50, adjust=False).mean()
    macd = close.ewm(span=12, adjust=False).mean() - close.ewm(span=26, adjust=False).mean()
    line = macd.ewm(span=9, adjust=False).mean()
    if strategy == 'EMA':
        active = ema20 > ema50
    elif strategy == 'MACD':
        active = macd > line
    else:
        volume = frame.Volume / frame.Volume.shift(1).rolling(20).mean().replace(0, np.nan)
        active = (macd > line) & (close > ema20) & (ema20 > ema50) & (volume >= 1.25)
    return active & (np.arange(len(frame)) >= 50)


def backtest_ohlcv(frame, strategy='MACD', capital=10000, fee_bps=10, slippage_bps=5,
                   stop_pct=0.075, target_pct=0.15, evaluation_start=0, max_holding_days=None):
    strategy = strategy.upper()
    if strategy not in {'MACD', 'EMA', 'CONFLUENCE'}:
        raise ValueError('Supported strategies: MACD, EMA, CONFLUENCE.')
    capital = finite_number(capital, 'capital', 1, 1e9)
    fee = finite_number(fee_bps, 'fee_bps', 0, 100) / 10000
    slip = finite_number(slippage_bps, 'slippage_bps', 0, 100) / 10000
    stop_pct = finite_number(stop_pct, 'stop_pct', 0.001, 0.9)
    target_pct = finite_number(target_pct, 'target_pct', 0.001, 5)
    if len(frame) < 55:
        raise ValueError('At least 55 historical bars are required, including 50 warmup bars.')
    frame = frame.sort_index()
    if frame.index.has_duplicates:
        raise ValueError('Historical dates must be unique.')
    start = finite_number(evaluation_start, 'evaluation_start', 0, len(frame) - 1)
    if not start.is_integer():
        raise ValueError('evaluation_start must be a whole bar index.')
    evaluation_start = int(start)
    if max_holding_days is not None:
        holding = finite_number(max_holding_days, 'max_holding_days', 1, 14)
        if not holding.is_integer():
            raise ValueError('max_holding_days must be a whole number.')
        max_holding_days = int(holding)
    if not np.isfinite(frame[['Open', 'High', 'Low', 'Close']].to_numpy()).all() or (frame[['Open', 'High', 'Low', 'Close']] <= 0).any().any():
        raise ValueError('Prices must be positive finite observations.')
    signals = strategy_signals(frame, strategy)
    cash, qty, entry, entry_date, cost = capital, 0., 0., None, 0.
    trades, curve = [], []

    def exit_position(price, stamp, reason):
        nonlocal cash, qty
        fill = float(price) * (1 - slip)
        proceeds = qty * fill * (1 - fee)
        trades.append({'entry_date': entry_date, 'exit_date': str(stamp.date()),
                       'entry_price': entry, 'exit_price': fill, 'quantity': qty,
                       'pnl': proceeds - cost, 'return_pct': (proceeds / cost - 1) * 100,
                       'exit_reason': reason})
        cash += proceeds
        qty = 0.

    for i, (stamp, row) in enumerate(frame.iterrows()):
        if i < evaluation_start:
            continue
        deadline_exit = False
        if qty and max_holding_days and (stamp.date() - pd.Timestamp(entry_date).date()).days >= max_holding_days:
            exit_position(row.Open, stamp, 'holding_deadline')
            deadline_exit = True
        if i and qty and not bool(signals.iloc[i - 1]):
            exit_position(row.Open, stamp, 'signal')
        if i and not qty and not deadline_exit and bool(signals.iloc[i - 1]):
            entry = float(row.Open) * (1 + slip)
            qty = cash / (entry * (1 + fee))
            cost, cash, entry_date = cash, 0., str(stamp.date())
        if qty:
            stop, target = entry * (1 - stop_pct), entry * (1 + target_pct)
            if row.Open <= stop:
                exit_position(row.Open, stamp, 'gap_stop')
            elif row.Low <= stop:
                exit_position(stop, stamp, 'stop')
            elif row.High >= target:
                # No optimistic gap improvement; daily-bar stop is checked first.
                exit_position(target, stamp, 'target')
        if qty and max_holding_days and i + 1 < len(frame):
            deadline = pd.Timestamp(entry_date).date() + pd.Timedelta(days=max_holding_days)
            if stamp.date() < deadline < frame.index[i + 1].date():
                exit_position(row.Close, stamp, 'holding_deadline_prior_session')
        curve.append({'date': str(stamp.date()), 'equity': cash + qty * float(row.Close)})
    if qty:
        exit_position(float(frame.Close.iloc[-1]), frame.index[-1], 'end_of_sample')
        curve[-1]['equity'] = cash
    wins = sum(t['pnl'] > 0 for t in trades)
    profit = sum(max(0, t['pnl']) for t in trades)
    loss = -sum(min(0, t['pnl']) for t in trades)
    return {'strategy': strategy, 'initial_capital': capital, 'final_equity': cash,
            'return_pct': (cash / capital - 1) * 100,
            'max_drawdown_pct': maximum_drawdown([capital] + [p['equity'] for p in curve]),
            'total_trades': len(trades), 'win_rate_pct': wins / len(trades) * 100 if trades else None,
            'profit_factor': profit / loss if loss else None,
            'start_date': str(frame.index[evaluation_start].date()), 'end_date': str(frame.index[-1].date()),
            'observations': len(frame) - evaluation_start, 'trades': trades, 'equity_curve': curve,
            'assumptions': ['Long-only adjusted daily OHLCV; 50-bar warmup.',
                            'Signals use prior close; fills occur at next open.',
                            'Stop checked before target when daily bar touches both; gaps may exceed stops.',
                            f'{fee_bps} bps fee and {slippage_bps} bps slippage per side.',
                            'Open positions liquidated at final close; no market impact or tax model.',
                            'Confluence uses local trend and prior-volume baseline; no historical news or macro filter.',
                            'In-sample research, not a forecast or validated trading edge.'] +
                           ([f'Maximum {max_holding_days} calendar days per strategy position; no same-open reentry after a deadline exit.',
                             'Deadline scheduling uses observed session dates; exit at prior session close if the next observed session exceeds the deadline. Missing bars can bias this retrospective schedule.'] if max_holding_days else []),
            'data_quality': frame.attrs.get('data_quality') or data_quality('Adjusted historical market bars', 'available')}
