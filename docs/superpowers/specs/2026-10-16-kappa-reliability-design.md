# KAPPA reliability and analytical integrity upgrade

## Intended outcome

Improve the existing application toward an 8/10 personal market research and paper-trading tool. The user requested improvements after a source review rated reliability and analytical validity as its main weaknesses. Preserve the existing React/Django application and English/Thai interface. An 8/10 score is a target, not a promised measurement or evidence of trading profitability.

## Approach and boundaries

Improve the existing application incrementally. A cosmetic refresh would not address analytical validity; a full rewrite would increase risk without a demonstrated need. Prioritize the main KAPPA application. Independent inventory examples and the NewsPulse experiment are outside the critical application path.

No brokerage execution, paid data subscriptions, new AI credentials, deployment, or externally published changes are included. Market data remains dependent on Yahoo Finance availability and limitations. Do not describe polling as a tick stream or claim exchange-grade realtime data.

## 1. Truthful data and failure behavior

Add a consistent data-quality contract to analytical responses: source, observation time where known, retrieval time, status (available, stale, simulated, or unavailable), and limitations. Preserve existing response fields when practical and update consumers with each contract change.

Remove fabricated news and invented publisher attribution from fallback responses. Missing news produces an explicit empty state. Failed quotes must not silently become plausible current prices. Synthetic candles and random order books must not appear as observed market data. Where no real source exists, retain an explicitly labeled educational simulation or show unavailability.

Replace unsupported probability, accuracy, and institutional claims with descriptive indicator scores. Scores are heuristics, not calibrated win probabilities. Apply this consistently to dashboard cards, trade plans, mentor text, and API output.

Acceptance: mocked upstream failures never produce fabricated observed prices or news; every remaining simulation is labeled in the rendered UI; stale values carry their source and age.

## 2. Startup, configuration, and database consistency

Use a configurable frontend API base and one documented backend port. Default local storage to SQLite; make SQL Server an explicit configuration option. Introduce managed market-price records and migrations, including a unique symbol/date constraint. Replace SQL Server-specific reads in supported SQLite paths with portable access. Retain compatibility with existing SQL Server installations through documented migration steps rather than deleting existing data.

Fix the scheduler entry point and make both manual ingestion and scheduled ingestion call the same service. Validate ticker input, make ingestion idempotent, and report partial failures accurately. Invalidate dependent caches after successful changes. Bound upstream calls and expensive request parameters.

Move production-sensitive settings to environment configuration. Keep local development straightforward and document production requirements. Do not introduce authentication-dependent flows without implementing their frontend support.

Acceptance: a fresh SQLite setup can migrate and serve the application; the scheduler command loads; repeated ingestion does not create duplicates; documented startup matches frontend connectivity.

## 3. Reproducible analytics

Extract calculation functions from HTTP views into focused services with deterministic fixtures.

Backtesting: use actual historical OHLCV observations, generate signals using data available before execution, and execute on a subsequent eligible bar. Include configurable transaction costs and explicit same-bar target/stop ambiguity rules. Report trades, equity curve, drawdown, date range, and assumptions. Replace hardcoded ten-year claims with calculated results or an explicit insufficient-data response. Underlying-price option approximations remain educational scenarios and must not be represented as historical option-contract performance.

Portfolio analysis: align returns by trading date; compute covariance from aligned observations; calculate correlations, compounded equity drawdown, and risk contributions consistently. Derive allocation candidates from data under long-only, fully invested constraints. Distinguish an approximate searched frontier from an exact optimizer. No fixed returns or allocation presets may be presented as empirically optimized results.

Risk simulation: validate capital, horizon, symbols, and weights; bound computation; document return assumptions and use a seed for reproducibility. Do not substitute random historical returns for missing market observations. Volatility derived from prices is historical volatility; option IV, IV rank, put/call ratio, and gamma exposure require appropriate option observations or must be unavailable.

Acceptance: known fixtures demonstrate no look-ahead execution, correct drawdown and date alignment, normalized allocations, reproducible simulation, and honest insufficient-data handling.

## 4. Paper trading and interface reliability

Choose browser-local paper trading as the supported personal workflow and remove ambiguity with the separate global backend portfolio. Preserve existing local records with a versioned migration. Validate finite positive amounts and prices; ensure fractional quantities and charged cash agree within documented precision. Keep account balance, open valuation, realized profit, and deposits consistent.

Refresh indicators and metadata even when prices do not change. Correct sorting, loading/error/empty states, request cancellation, and stale response handling. Consolidate API access and shared response handling. Preserve existing visual identity while improving source labels, keyboard operation, and small-screen usability in touched flows.

Acceptance: open/close/deposit flows preserve accounting invariants; old saved portfolios load safely; metadata refreshes without a price movement; failed requests have actionable states.

## 5. Verification and delivery

Add backend calculation and API contract tests with mocked upstream data, plus frontend utility/accounting tests. Run Django checks, migrations against a disposable database, the relevant test suites, frontend lint/build, and browser checks of the dashboard and modified workflows. Tests must not depend on live market availability or consume AI API credits.

Document setup, data provenance, known limitations, and commands. Report which checks passed and any remaining limitations. Reassess the original score using evidence; do not announce 8/10 merely because code was changed.

## Delivery order

1. Data truthfulness, shared failure contract, configuration, and database foundation.
2. Historical backtesting and portfolio/risk calculation services.
3. Frontend integration, paper-trading correctness, and interface reliability.
4. Regression checks, browser verification, and documentation.

Each increment must leave the application usable and have its own validation. Implement in the current session without parallel agents unless the user selects delegation.
