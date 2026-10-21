# Data and methodology

KAPPA supports personal historical market research and browser-local paper trading. It is not connected to a broker. It has no validated prediction model, verified option feed, exchange order book, or earnings calendar.

## Observation integrity

The provider is Yahoo Finance through yfinance. Prices use adjusted OHLCV bars, not executable bid/ask quotes. The latest daily bar may be in progress. Stored bars include a session date and retrieval time; cached or stored observations are identified as historical/stale. Retrieval time is not observation time. Missing provider responses never create substitute prices, candles, headlines, or publishers.

Yahoo availability, delays, licensing, revisions, adjustments, and rate limits apply. The local cache lives in `.cache/yfinance/`, or `MARKET_CACHE_PATH`, so the application does not depend on writing to a user's system cache. In-memory caches are bounded to 256 entries per category. HTTP requests are bounded; total sequential portfolio/ingestion duration can exceed a single provider timeout.

The tracked universe is limited to 60 symbols, including the default eight. Individual additions enforce the same limit as full synchronization. No ticker is inserted past that limit.

Saved daily bars can support research while the provider is unavailable. Results report actual stored coverage. Requesting ten years does not create ten years of history when only one year is saved. Intraday bars require a provider response and do not silently fall back to daily bars.

News uses Yahoo Finance RSS through a request with an eight-second timeout. Headlines link to their source; no sentiment probabilities or Fear & Greed index are inferred. Offline news is an empty, explicitly unavailable state.

## Indicators

EMA20/50 and MACD12/26/9 use pandas exponentially weighted means with `adjust=False`. RSI uses the mean gains/losses over the last 14 changes; this is a simple rolling RSI, not Wilder smoothing. Relative volume compares the latest bar with the previous 20 bars. Bollinger bands use a 20-observation mean and population standard deviation.

The research checklist awards 20 points for each satisfied rule: price above EMA20, EMA20 above EMA50, MACD above its signal, RSI in 40–64, and relative volume at least 1.25. It is a descriptive agreement score. **80/100 does not mean an 80% win probability.** Asset direction refers to MACD relative to its signal, not a confirmed new crossover or an order recommendation.

Historical volatility uses the standard deviation of log returns over up to 30 observations and a 252-observation annualization convention. IV, IV rank, put/call ratio, and gamma exposure remain unavailable without appropriate option observations. Earnings calendar status remains unknown.

## Backtesting

- Long-only adjusted daily OHLCV; 50-bar indicator warmup; at least 55 bars required.
- MACD holds when MACD is above signal; EMA holds when EMA20 is above EMA50. Confluence requires bullish MACD, price above EMA20, EMA20 above EMA50, and volume at least 1.25 times its prior 20-bar average. These are explicitly coded research rules, not historical news or macro filters.
- A signal determined at one close can execute only at the next available open. A final-bar signal cannot create an executable trade.
- Default fee: 10 basis points per side. Default slippage: 5 basis points per side.
- Stop: 7.5% below entry; target: 15% above entry. When one daily bar touches both, the stop is assumed to occur first. Gaps below stops execute at the worse opening price. The target receives no optimistic gap improvement.
- A stopped position may re-enter at a later open while the prior-bar trend rule remains active. All open positions are liquidated at the final close, including exit costs.
- Drawdown uses compounded marked-to-market equity. Sample win rate and profit factor describe the sample; no losses means profit factor is undefined, not an invented large number.
- Taxes, liquidity constraints, market impact, borrowing, and survivorship bias are not modeled. Full-sample mode remains exploratory. Historical option performance cannot be established from underlying daily high/low ranges, so the previous options backtest and scalp recommendations are unavailable.

### Chronological holdout check

The default Backtest UI splits at `floor(0.70 × bar count)` and requires at least
150 unique daily bars. The first 50 bars initialize indicators. The earlier
segment compares three fixed rules against zero-interest cash using net return;
ties prefer fewer closed trades, then cash. No later prices choose that rule.
Evaluation starts with fresh capital at the first later-segment open. Earlier
data initializes causal indicators, but no earlier position carries over.

Holdout strategy positions use a 14-calendar-day maximum. If an observed next
session would exceed the deadline, the simulation exits at the prior session's
close; otherwise it exits at the deadline open. This retrospective session
schedule uses observed dates, and missing observations can bias it. It is not a
live market calendar or an automatic exit service.

Buy-and-hold uses the same holdout dates, initial capital, and per-side cost
model, buying at the first open and selling at the final close. It is an
unrestricted passive reference; it does not use the strategy's holding cap or
stops. Reports show both returns/drawdowns, excess percentage-point return,
closed-trade count, training selection, and source freshness. Cash is a possible
selection; a positive comparison is not proof of future profitability. Fewer
than 20 holdout trades triggers a descriptive small-sample warning, not a
statistical test. A single split does not address regime changes or selection
bias. Repeatedly inspecting tickers or adjusting rules against the holdout
contaminates that evaluation; prospective paper observation remains necessary.

## Portfolio research

Prices align by common session dates before returns are calculated. All assets use the same pair of observation dates. Missing prices are never forward-filled. At least 20 common returns are required. Mixing equity/crypto calendars removes unmatched sessions; annualization uses 252 observations for consistency and is an approximation.

Covariance uses sample covariance; contributions are weight times marginal covariance divided by portfolio variance. Negative contributions are possible for hedging assets. Sample arithmetic returns and covariance drive an approximate search across 5,000 seeded long-only, fully invested candidates plus equal-weight, inverse-volatility, and boundary portfolios. The plotted frontier contains nondominated searched candidates and does not promise exact mathematical optimality. Historical sample means are not forecast returns.

Historical VaR/CVaR use observed portfolio returns. Sharpe uses a fixed 4% annual risk-free assumption; Sortino uses root-mean-square downside returns relative to zero. Both are undefined when their denominator is zero. Drawdown uses cumulative compounded returns.

Risk scenarios fit normal log-return increments to historical portfolio returns, with 500 paths, seed 42 by default, and horizons bounded to 1–252 observations. Bands show scenario percentiles, not prediction confidence. Normal models underrepresent extreme events and changing regimes. No random historical observations or hardcoded crisis results are substituted for missing data.

## Paper portfolio and alerts

The paper portfolio lives in `localStorage` under `nexus_quant_paper_portfolio`, schema version 2. No shared backend account exists. Valid previous records are retained, including portfolios whose balance happens to equal $10,000. Invalid saved data is preserved and trading is blocked with an explanation. Browser storage is not an account backup; clearing it removes local history. Export closed trades to CSV.

Buys use at most 12 decimal places of fractional quantity; cash is rounded to cents and agrees with quantity times price to that precision. This precision is a simulation convention, not a broker's minimum order size. Fills use observed daily closes and cannot be treated as live executions. Deposits increase the capital basis rather than recorded trading profit. Missing quotes cannot fill trades; indicative valuation uses entry cost and is labeled accordingly. No automatic stop/target execution runs in the background.

Cash and price inputs are bounded to $1 trillion and computed account values must remain finite before saving. Paper trading requests quotes for the selected ticker and up to 11 other position symbols at a time; when holding more distinct symbols, load a missing position's ticker to value or close it. This pagination improvement remains deferred.

Saved alerts compare thresholds to observed stored price/RSI values while the dashboard is open. They do not establish live crossings. No push notifications, unattended monitoring, or webhook transmission is connected.

## Local configuration and existing SQL Server data

SQLite is the explicit default. SQL Server requires optional dependencies and configuration. Never run an initial migration against an existing `MarketPrices` table without checking its columns, primary key, uniqueness, and retrieval timestamp compatibility. `--fake-initial` only checks table existence; it does not establish schema compatibility. The supported safe route for an older installation is a separate new database and an explicit reviewed data migration. Existing SQL Server data is not deleted or modified by selecting SQLite. SQL Server migration against an existing schema has not been validated in this environment.

Keep the service bound to localhost. Environment-based secrets, allowed hosts/origins, request validation, and throttles improve the local baseline; authentication, production hosting, TLS, user separation, and operational backups require separate deployment work.
