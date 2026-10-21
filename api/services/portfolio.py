"""Historical covariance, approximate allocations, and reproducible risk scenarios."""
import numpy as np
import pandas as pd
from .backtesting import finite_number, maximum_drawdown
from .market_data import data_quality

LIMITATIONS = ['Returns use common dated observations; missing prices are not forward-filled.',
               '252 observations per year is a convention, including mixed equity/crypto portfolios.',
               'Historical moments and normal log-return scenarios are estimates, not forecasts.',
               'No historical returns are simulated to replace missing data.']


def aligned_returns(histories):
    if not histories or len(histories) > 12:
        raise ValueError('Provide 1 to 12 asset histories.')
    columns = {}
    for symbol, frame in histories.items():
        if frame.empty or 'Close' not in frame:
            raise ValueError(f'Historical observations unavailable for {symbol}.')
        series = pd.to_numeric(frame.Close, errors='coerce').copy()
        # Align by local session date, preserving the date represented by each bar.
        series.index = pd.DatetimeIndex([pd.Timestamp(x).date() for x in series.index])
        series = series[~series.index.duplicated(keep='last')]
        columns[symbol] = series
    prices = pd.concat(columns, axis=1).sort_index().replace([np.inf, -np.inf], np.nan)
    prices = prices.where(prices > 0).dropna()
    returns = prices.pct_change(fill_method=None).replace([np.inf, -np.inf], np.nan).dropna()
    if len(returns) < 20:
        raise ValueError('At least 20 common return observations are required.')
    returns.attrs['input_data_quality'] = {s: frame.attrs.get('data_quality', {}) for s, frame in histories.items()}
    return returns


def input_quality(returns):
    return returns.attrs.get('input_data_quality', {})


def aggregate_quality(returns, source):
    inputs = input_quality(returns)
    stale = any(q.get('status') == 'stale' for q in inputs.values())
    limitations = list(dict.fromkeys(line for q in inputs.values() for line in q.get('limitations', [])))
    return data_quality(source, 'stale' if stale else 'available', str(returns.index[-1].date()), limitations)


def normalized_weights(returns, raw):
    if not isinstance(raw, dict) or not raw or len(raw) > 12:
        raise ValueError('Provide a weight object with 1 to 12 symbols.')
    weights = {}
    for symbol, value in raw.items():
        if symbol not in returns:
            raise ValueError(f'Missing observations for {symbol}.')
        weights[symbol] = finite_number(value, 'weight', 0, 1e6)
    total = sum(weights.values())
    if total <= 0:
        raise ValueError('Weights must have a positive total.')
    return pd.Series({k: v / total for k, v in weights.items()}).reindex(returns.columns, fill_value=0)


def portfolio_metrics(returns, weights, capital, horizon=30, seed=42):
    capital = finite_number(capital, 'capital', .01, 1e9)
    raw_horizon = finite_number(horizon, 'horizon', 1, 252)
    if raw_horizon != int(raw_horizon):
        raise ValueError('horizon must be an integer number of observations.')
    horizon = int(raw_horizon)
    seed = int(finite_number(seed, 'seed', 0, 2**32 - 1))
    w = normalized_weights(returns, weights)
    daily = returns.to_numpy() @ w.to_numpy()
    annual_cov = returns.cov().to_numpy() * 252
    variance = float(w.to_numpy() @ annual_cov @ w.to_numpy())
    vol = np.sqrt(max(0., variance))
    annual_mean = float(np.mean(daily) * 252)
    rf = .04
    sharpe = (annual_mean - rf) / vol if vol > 1e-12 else None
    downside_dev = np.sqrt(np.mean(np.minimum(daily, 0) ** 2)) * np.sqrt(252)
    sortino = (annual_mean - rf) / downside_dev if downside_dev > 1e-12 else None
    equity = np.r_[capital, capital * np.cumprod(1 + daily)]
    var95 = max(0., -float(np.quantile(daily, .05)))
    var99 = max(0., -float(np.quantile(daily, .01)))
    tail = daily[daily <= np.quantile(daily, .05)]
    cvar = max(0., -float(np.mean(tail)))
    log_returns = np.log1p(daily)
    rng = np.random.default_rng(seed)
    paths = np.empty((500, horizon + 1))
    paths[:, 0] = capital
    # Fit directly to historical log returns; no second drift correction.
    shocks = rng.normal(np.mean(log_returns), np.std(log_returns, ddof=1), size=(500, horizon))
    paths[:, 1:] = capital * np.exp(np.cumsum(shocks, axis=1))
    quantiles = np.percentile(paths, [5, 25, 50, 75, 95], axis=0)
    curves = [{'day': i, **{key: round(float(quantiles[j, i]), 2) for j, key in enumerate(['p5', 'p25', 'p50', 'p75', 'p95'])}}
              for i in range(horizon + 1)]
    marginal = annual_cov @ w.to_numpy()
    contributions = w.to_numpy() * marginal / variance * 100 if variance > 1e-24 else np.zeros(len(w))
    breakdown = [{'symbol': s, 'weight': float(w[s] * 100), 'weight_usd': float(w[s] * capital),
                  'annual_volatility': float(np.sqrt(max(0, annual_cov[i, i])) * 100),
                  'risk_contribution_pct': float(contributions[i])} for i, s in enumerate(returns.columns)]
    return {'capital': capital, 'horizon_days': horizon, 'seed': seed, 'observations': len(returns),
            'start_date': str(returns.index[0]), 'end_date': str(returns.index[-1]),
            'sharpe_ratio': sharpe, 'sortino_ratio': sortino, 'max_drawdown_pct': maximum_drawdown(equity),
            'annual_volatility': float(vol * 100), 'annual_expected_return': annual_mean * 100,
            'var_95_1d_usd': capital * var95, 'var_95_1d_pct': var95 * 100,
            'var_99_1d_usd': capital * var99, 'var_99_1d_pct': var99 * 100,
            'cvar_95_usd': capital * cvar, 'cvar_95_pct': cvar * 100,
            'monte_carlo_curves': curves, 'asset_breakdown': breakdown,
            'macro_scenarios': [], 'assumptions': LIMITATIONS,
            'input_data_quality': input_quality(returns),
            'data_quality': data_quality('Historical observations / seeded scenario simulation', 'simulated',
                                          observed_at=str(returns.index[-1]), limitations=LIMITATIONS + aggregate_quality(returns, '')['limitations'])}


def allocation_candidates(returns, seed=42):
    names = list(returns.columns)
    n = len(names)
    rng = np.random.default_rng(seed)
    covariance = returns.cov().to_numpy() * 252
    mean = returns.mean().to_numpy() * 252
    std = np.sqrt(np.maximum(np.diag(covariance), 0))
    inverse = np.divide(1, std, out=np.zeros(n), where=std > 1e-12)
    inverse = inverse / inverse.sum() if inverse.sum() else np.ones(n) / n
    samples = np.vstack([np.eye(n), np.ones((1, n)) / n, inverse, rng.dirichlet(np.ones(n), size=5000)])
    risks = np.sqrt(np.maximum(np.einsum('ij,jk,ik->i', samples, covariance, samples), 0))
    expected = samples @ mean
    sharpes = np.divide(expected - .04, risks, out=np.full(len(risks), -np.inf), where=risks > 1e-12)
    maximum = int(np.argmax(sharpes)) if np.isfinite(sharpes).any() else int(np.argmin(risks))
    presets = {'max_sharpe': samples[maximum], 'min_volatility': samples[np.argmin(risks)],
               'inverse_volatility': inverse, 'equal_weight': np.ones(n) / n}
    frontier = []
    best = -np.inf
    for i in np.argsort(risks):
        if expected[i] > best:
            best = expected[i]
            frontier.append({'volatility': float(risks[i]), 'expected_return': float(best)})
    return {'presets': {key: {s: float(vec[i] * 100) for i, s in enumerate(names)} for key, vec in presets.items()},
            'assets': {s: {'expected_return': float(mean[i]), 'volatility': float(std[i])} for i, s in enumerate(names)},
            'frontier_points': frontier, 'observations': len(returns),
            'start_date': str(returns.index[0]), 'end_date': str(returns.index[-1]),
            'assumptions': LIMITATIONS + ['Approximate frontier from 5,000 seeded candidates plus boundary portfolios; no exact optimality guarantee.',
                                         'Long-only, fully invested; historical sample means, no expected-return forecast.'],
            'input_data_quality': input_quality(returns),
            'data_quality': aggregate_quality(returns, 'Historical covariance and seeded candidate search')}
