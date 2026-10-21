# KAPPA Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make KAPPA a dependable personal market research and paper-trading application with truthful data and reproducible analytics.

**Architecture:** Preserve React/Vite and Django REST. Extract market-data, ingestion, backtesting, and portfolio services; integrate their explicit availability contracts into the existing UI.

**Tech Stack:** Python, Django, pandas, NumPy, yfinance, React, Vite, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-16-kappa-reliability-design.md`

## Global Constraints

- Preserve the existing React/Django application and English/Thai interface.
- No brokerage execution, paid data subscriptions, new AI credentials, deployment, or externally published changes are included.
- Do not describe polling as a tick stream or claim exchange-grade realtime data.
- Scores are heuristics, not calibrated win probabilities.
- Tests must not depend on live market availability or consume AI API credits.
- Independent inventory examples and the NewsPulse experiment are outside the critical application path.
- Implement in the current session without parallel agents unless the user selects delegation.
- Use port 8001 consistently for local Django startup and frontend defaults.
- Preserve user data; do not commit databases, secrets, dependency directories, or generated builds.

## Review Focus

- Empty, stale, or partially failed upstream observations must never become fabricated live data (Tasks 1 and 3).
- Nonfinite numbers, oversized horizons, and malformed weights must return validation errors without excessive work (Tasks 1, 3, and 5).
- Mixed equity/crypto calendars and short overlapping histories must align by date or report insufficient observations (Task 3).
- Ambiguous daily bars and final-bar signals must not create optimistic or impossible executions (Task 2).
- Legacy or corrupt local portfolios, tiny fractional purchases, and stale asynchronous responses must preserve accounting and current UI state (Tasks 4 and 5).

---

### Task 1: Portable market storage, honest data access, and ingestion

**Files:** Modify `core/settings.py`, `api/models.py`, `api/views.py`, `api/scheduler.py`, `api/management/commands/fetch_market_data.py`, `api/management/commands/run_scheduler.py`, `api/serializers.py`, `requirements.txt`; create `api/services/__init__.py`, `api/services/market_data.py`, `api/services/ingestion.py`, migrations, and `api/test_market_data.py`.

**Interfaces:**
- `data_quality(source, status, observed_at=None, limitations=None) -> dict`: UTC retrieval timestamp, source, status, observation timestamp, limitations.
- `get_history(symbol, period='1y', interval='1d') -> pandas.DataFrame`: real observations only; empty on unavailable data; bounded upstream timeout.
- `get_quote(symbol) -> dict`: price fields nullable, with `data_quality`; cached observed values may be stale, never replaced by default prices.
- `ingest_market_data(symbols=None) -> dict`: created/updated/failed counts and per-symbol failures; shared by command, scheduler, and HTTP trigger.
- Managed `MarketPrice` model mapped to `MarketPrices`, with unique symbol/date constraint and existing column mappings.

- [x] Write tests: unavailable quote has `current_price is None` and status `unavailable`; stale cached quote preserves its observation timestamp; duplicate ingestion leaves one row per symbol/date; invalid ticker is rejected; scheduler command can load; missing news has an empty list without invented publishers.
- [x] Run `venv/Scripts/python.exe manage.py test api.test_market_data` and confirm failures exercise missing behavior.
- [x] Implement portable model and migrations, explicit SQLite/SQL Server selection, environment-backed settings, shared ingestion and cache invalidation. Support existing SQL Server tables through documented schema inspection/fake-initial steps only when schema matches. Replace fabricated signal/news/candle fallbacks with explicit unavailability. Keep list response compatibility for signals; attach quality per item and expose empty-state reasons through appropriate error responses.
- [x] Run the tests, `manage.py check`, `manage.py makemigrations --check --dry-run`, and migration against a disposable SQLite database. Verify scheduler help loads without starting ingestion.
- [x] Review the diff for secret exposure, destructive migration steps, unbounded provider calls, and SQL Server-only syntax in supported SQLite paths.

### Task 2: Historical backtesting with observable execution rules

**Files:** Create `api/services/backtesting.py`, `api/test_backtesting.py`; modify `api/views.py`, `api/urls.py`, and `frontend/src/components/BacktestModal.jsx`.

**Interfaces:**
- `backtest_ohlcv(frame, strategy='MACD', capital=10000, fee_bps=10, slippage_bps=5, stop_pct=0.075, target_pct=0.15) -> dict`: trades, equity curve, statistics, date coverage, assumptions, and quality metadata.
- `GET /api/strategies/backtest/?symbol=...&period=...&strategy=...&capital=...`: bounded supported periods/strategies; insufficient data returns a clear error.
- Existing ten-year route delegates to calculated historical results and reports actual coverage; existing options route explicitly identifies its underlying-price approximation.

- [x] Write deterministic fixtures asserting next-bar execution, no trade on a final-bar signal, stop-first treatment when stop and target occur in one daily bar, fees reducing net return, and drawdown of 20% for an equity path `[100, 120, 96]`.
- [x] Run `manage.py test api.test_backtesting` to confirm expected failures.
- [x] Implement MACD/EMA/confluence rules from prior available observations. Execute at next eligible open, handle gaps conservatively, mark open positions to market, and document liquidation behavior. Replace frontend sine-generated prices and hardcoded audit data with API results and explicit assumptions.
- [x] Run calculation/API tests and verify no hardcoded performance claims remain in the connected backtest flow.

### Task 3: Date-aligned portfolio, correlation, and risk calculations

**Files:** Create `api/services/portfolio.py`, `api/test_portfolio.py`; modify portfolio/risk/volatility views and routes, `frontend/src/components/PortfolioOptimizerModal.jsx`, `CorrelationMatrixModal.jsx`, `PortfolioSimulatorModal.jsx`.

**Interfaces:**
- `aligned_returns(histories: dict) -> pandas.DataFrame`: common dated simple returns, at least 20 overlapping observations; explicit insufficient-data error.
- `portfolio_metrics(returns, weights, capital, horizon=30, seed=42) -> dict`: covariance-based volatility/contributions, compounded drawdown, historical VaR/CVaR, and seeded 500-path scenario bands.
- `allocation_candidates(returns, seed=42) -> dict`: nonnegative normalized candidates, approximate nondominated frontier, minimum-volatility and maximum-Sharpe candidates, inverse-volatility and equal-weight allocations clearly named.
- `GET /api/portfolio/correlation/`: dated historical correlation matrix and observation count.

- [x] Write tests for mixed calendars, no overlapping dates, constant-price assets, negative/nonfinite weights, horizon bounds `1..252`, reproducible seeds, allocations summing to one, covariance contributions summing to portfolio variance, and insufficient option observations leaving IV/GEX unavailable.
- [x] Run `manage.py test api.test_portfolio` to confirm expected failures.
- [x] Implement services using actual histories, finite validated inputs, documented 252-session annualization and simulation assumptions. Remove random historical return substitution and fixed optimizer/frontier values. Label price-derived volatility as historical volatility. Update connected UI to handle nullable options metrics and show limitations.
- [x] Run portfolio tests and API contracts. Verify frontend no longer generates synthetic correlation or silently substitutes risk results after API failures.

### Task 4: Versioned paper-trading accounting

**Files:** Modify `frontend/src/utils/paperTradingStorage.js`, `frontend/src/components/PaperTradingModal.jsx`, `api/views.py`, `frontend/package.json`; create `frontend/src/utils/paperTradingStorage.test.js`.

**Interfaces:** Keep exported utility signatures, adding a storage schema version and safe validation/migration. Browser-local portfolio is the sole supported personal portfolio. Deprecate the global backend trading endpoint with an explanatory response, removing shared mutable trading state.

- [x] Add Node tests with isolated storage/event mocks: existing records survive migration; corrupt JSON loads safely; nonfinite/negative deposits, buys, and exits fail; purchase cost matches stored quantity times entry price to cash precision; buy then close at the same price preserves equity to cent precision; deposit increases capital without becoming profit; tiny purchases cannot charge cash for zero quantity.
- [x] Run `node --test src/utils/paperTradingStorage.test.js` from `frontend` and confirm expected failures.
- [x] Implement finite number checks, consistent precision, safe version migration, and explicit storage errors. Preserve all valid legacy positions/history; do not reset a portfolio merely because its balance equals a former default.
- [x] Run the accounting suite, then manually exercise open, close, deposit, reload, and export during browser verification.

### Task 5: Shared API integration and truthful interface states

**Files:** Create `frontend/src/lib/api.js`, `frontend/src/components/DataQualityNotice.jsx`, and focused utility tests; modify `frontend/src/App.jsx`, `frontend/src/App.css`, `frontend/src/components/SignalCard.jsx`, `AssetDetailSheet.jsx`, `AIBrainFusionModal.jsx`, `TwoWeekSwingStation.jsx`, `MicroRecoveryHub.jsx`, `AIMentorModal.jsx`, `AICopilotDrawer.jsx`, `NewsSentimentModal.jsx`, `OrderbookModal.jsx`, `MarketSentimentBar.jsx`, `UpcomingNewsAlertBar.jsx`, and affected utilities/translations.

**Interfaces:**
- `API_BASE_URL`: `VITE_API_BASE_URL` override, hostname-aware port 8001 default.
- `apiRequest(path, {signal, ...options}={}) -> Promise`: JSON handling, status/error checking, bounded timeout, caller cancellation.
- `DataQualityNotice({quality})`: source, freshness/status, and limitations rendered accessibly.

- [x] Add tests for API HTTP failures, cancellation, timeout, zero versus missing values, and MACD sorting using the same field for both operands.
- [x] Run the frontend tests to establish failures.
- [x] Integrate shared requests in touched flows; reject stale request results on symbol/mode changes; refresh changed metadata even if prices are identical. Replace synthetic health/latency and probability/accuracy claims with measured/request-aware states and heuristic labels. Remove fabricated news text and generic simulated recommendations presented as observed facts. Render unavailable/simulated states explicitly in both languages. Fix keyboard dismissal/focus and responsive overflow in touched dialogs.
- [x] Run frontend tests, `npm run lint`, and `npm run build`. Fix surfaced defects without suppressing checks wholesale.

### Task 6: Integrated verification and user documentation

**Files:** Modify `README.md`, `frontend/README.md`, `.gitignore` if necessary; create `.env.example`, `frontend/.env.example`, and `docs/data-and-methodology.md`.

**Interfaces:** Documentation explains local startup on port 8001, migration, scheduler, configuration, tests, data sources, historical coverage, costs, ambiguity rules, heuristic scoring, simulation assumptions, and browser-local persistence.

- [x] Run all backend tests with mocked market providers, Django system checks, fresh disposable database migration, frontend tests/lint/build; inspect all results and fix regressions.
- [x] Start local servers and inspect the dashboard, signal search/sorting, source states, chart timeframe changes, backtest, optimizer/correlation/risk views, and paper-trading workflow. Verify an unavailable-provider case and one narrow viewport. Use the browser-testing skill/tool available in the session; document actual coverage and blockers.
- [x] Review the entire diff against the approved spec, including residual fabricated claims and missing-data fallbacks. Repeat only checks affected by subsequent fixes.
- [x] Update setup/methodology documentation and record remaining limitations. Report evidence and an honest reassessment without promising trading profitability or an automatic 8/10 score.

## Execution and checkpoints

Recommended execution: native, sequential implementation in this session, because these changes share the market-data contract and database foundation. No parallel agents are required. Review each task's completed diff and verification before proceeding. Keep changes reviewable; do not push, publish, or deploy.
