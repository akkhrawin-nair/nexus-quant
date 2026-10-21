# KAPPA // Market Research & Paper Trading

Personal historical market research with observed Yahoo Finance bars, transparent indicator checklists, reproducible backtests, portfolio covariance/risk analysis, and browser-local paper trading. An optional read-only Alpaca OPRA options quote adapter requires separate credentials and data permissions; it is not connected or live-verified by default. No brokerage order connection, calibrated prediction model, or exchange order book is included.

## Start locally (Windows PowerShell)

Tested with Python 3.14 and Node 24. Python requirements pin the versions used for this verification.

```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py fetch_market_data --symbols QQQ SPY
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8001
```

In another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Add tickers or use **Sync market data** to save the default watchlist. An empty fresh database displays an explicit empty state. Data fetches need internet access; failures are reported, and saved observations remain available. Refreshing the page polls saved records; **Sync market data** actually refreshes provider observations.

SQLite is the default and needs no SQL Server installation. Configuration examples are in `.env.example` and `frontend/.env.example`. The frontend reads `VITE_API_BASE_URL` when overridden. Both startup instructions and defaults use backend port **8001**.

## What the application does

- **Analyst desk** combines annotated daily candles, EMA20/50, prior-20-session range references, dated issuer-news notes, bull/bear cases, known catalyst dates, and a long-share scenario calculator. Start with EOSE or ONDS, or use each card's **Analyze** button. Reviewed issuer context is currently maintained for those two names only, with a visible review date and an overdue flag after seven days. Other tickers receive technical analysis and retrieved headlines without invented issuer coverage. See [analyst desk methodology](docs/analyst-desk.md).

- Watches stocks, ETFs, crypto and commodities with source/session labels, search, sorting, favorites, CSV export, and a heatmap.
- **Options bid / ask** calculates manual buy-at-ask and sell-at-bid estimates, fees, spread costs, and the future exit bid needed to break even. Review checks compare entered quote sizes with quantity, premium cost with your budget, and spread percentage with your editable threshold (initially 10%, not a recommendation). Enter the source quote time in the shown browser timezone; a quote older than 60 seconds is flagged. Live freshness and liquidity remain unverified. Expiration is restricted to today through 14 calendar days ahead using the New York date. The exit-plan check flags dates outside expiration or the 14-day window from assumed entry today. This calculator does not save/monitor actual positions, enforce broker exits, or place orders.
- Computes EMA, MACD, simple rolling RSI, relative volume, and a descriptive five-rule checklist. Scores do not represent win probabilities.
- Backtests long-only MACD/EMA/confluence rules on observed adjusted OHLCV with next-open fills, fees, slippage, and conservative daily-bar stop/target ordering.
- **Backtest → 70/30 holdout check** selects MACD, EMA, confluence, or cash using the earliest 70% of bars, then evaluates only the final 30% without refitting. Shows the same-date, same-cost buy-and-hold reference, drawdowns, sample size, and training selection. Strategy positions have a 14-calendar-day cap using the observed session calendar (missing bars can bias scheduling); passive buy-and-hold is an unrestricted reference. At least 150 unique daily bars are required. Defaults are 10 bps fees and 5 bps slippage per side, both editable. A positive comparison is hypothetical, not proof of a profitable live strategy; repeatedly choosing tickers or revising rules after seeing holdout results can overfit it.
- Aligns portfolio observations by date; computes historical correlations, covariance-based risk, approximate searched allocations, VaR/CVaR, and seeded scenario bands.
- Saves fractional paper positions, cash, deposits, and trade history in this browser. Quotes are daily observations, not executable broker prices. Export history before clearing browser storage.
- Monitors local threshold rules while the page is open. No automatic orders or unattended push/webhook alerts run.
- Shows retrieved Yahoo RSS headlines when available; it does not fabricate headlines or infer an external Fear & Greed index.

English/Thai navigation is available. Technical methods and limitations also appear in English in the research dialogs.

## Optional background ingestion

For optional provider options quotes while continuing to trade in Dime, see
[options data setup](docs/options-data-setup.md). **Load OPRA quote** fetches an
exact-contract snapshot; the free indicative feed is never substituted.

For the first options-data setup step, follow the
[Webull Thailand setup guide](docs/webull-thailand-options-setup.md) and run
`venv/Scripts/python.exe manage.py check_options_access`. This is an offline
credential-presence check, not a connected or verified live options feed.

```powershell
.\venv\Scripts\python.exe manage.py run_scheduler --run-now
# Or every five minutes:
.\venv\Scripts\python.exe manage.py run_scheduler --interval 300
```

Cron defaults to weekdays at 16:30 in `America/New_York`, including daylight-saving changes. Holidays are not filtered. Use `--timezone` and `--cron HH:MM` to override. Minimum interval: 60 seconds. Run a single scheduler worker. Provider throttling and failures may still occur. Commands, scheduler, and Sync use the same ingestion service.

## Verification

```powershell
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\venv\Scripts\python.exe manage.py test api --noinput
cd frontend
npm test
npm run lint
npm run build
```

Automated tests mock market access, so they need no live provider or AI credentials. Browser QA additionally covered desktop/mobile dashboard, real stored data, filters/favorites, research tools, unavailable intraday data, paper buy/close/deposit persistence, alerts, and Thai labels in an isolated browser profile. No personal browser portfolio was changed during QA.

## Scope and limitations

Read [data and methodology](docs/data-and-methodology.md) before interpreting results. Models are in-sample historical research and scenarios. No performance edge is statistically validated, and actual execution, liquidity, taxes, market impact, and changing regimes are not fully modeled. Missing options, order-book, and earnings data is explicitly unavailable.

Keep this personal-use server on localhost. Production deployment, authentication, user separation, secure hosting, and operational backups require separate work. `DJANGO_DEBUG=0` requires a private `DJANGO_SECRET_KEY`; allowed hosts/origins are configurable.

For SQL Server, install `requirements-mssql.txt` and use explicit environment configuration. Existing legacy `MarketPrices` tables require schema review and a separate data-migration plan; do not blindly use `--fake-initial`. No existing SQL Server data is removed by the SQLite default.

The `newpulse/` RSS experiment and inventory example scripts are independent of the main KAPPA application.
