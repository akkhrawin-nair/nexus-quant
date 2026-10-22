# Run KAPPA on another Windows PC

Install Git, Python and Node.js first. This version was verified with Python
3.14 and Node.js 24. Keep the app on localhost.

## Get the code

For a new checkout, open PowerShell in the folder where you want the project:

```powershell
git clone https://github.com/akkhrawin-nair/nexus-quant.git
cd nexus-quant
```

For an existing checkout, open PowerShell inside that project instead:

```powershell
git status
git pull --ff-only origin main
```

Preserve any existing local edits before pulling. Do not use a hard reset to
resolve conflicts or overwrite your local configuration.

## Backend

Run from the project root. Create the virtual environment only if it does not
already exist; the other commands apply to both new and existing checkouts.

```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py fetch_market_data --symbols QQQ SPY EOSE ONDS
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8001
```

SQLite is created locally. The new migration adds the provider-response timestamp
without inventing timestamps for old observations. If a data fetch fails, retry
later; the backend can still start with an empty watchlist or saved local bars.
The server command keeps that terminal open.

## Frontend

Open a second PowerShell terminal in the project root:

```powershell
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open **http://127.0.0.1:5173**. Keep both terminals running. If either port is
already occupied, stop your earlier KAPPA process before starting another copy.

## Larger starter watchlist

A fresh database does not contain the other PC's saved watchlist. To load the
same 50 public ticker symbols used during local verification, run this in the
project root before starting the backend, or in a third terminal:

```powershell
.\venv\Scripts\python.exe manage.py fetch_market_data --symbols AAPL ABBV ADBE AMD AMZN ARM AVGO BA BAC BRK-B BTC-USD CAT COIN COST CRM CVX DIS EOSE ETH-USD GE GLD GOOGL GS HD HOOD INTC JNJ JPM KO LLY MA META MSFT MU NFLX NVDA ONDS ORCL PEP PLTR QQQ SOFI SPY TSLA TSM UBER UNH V WMT XOM
```

This is a research universe, not a recommendation. It downloads historical bars
and may take time or encounter provider throttling. Retry failed symbols later;
successful records remain saved. **Sync market data** subsequently refreshes
the default symbols plus symbols saved in that PC's database.

## What transfers through GitHub

The source code, dependencies list, database migrations, tests and documentation
transfer. API credentials, SQLite market data, virtual environments and browser
storage do not. Manual options calculations and paper features work without
configuring a paid quote provider. Live options data is not enabled by cloning.

Browser journals are tied to the browser profile and exact site origin. Use the
same `http://127.0.0.1:5173` address consistently; `localhost` is a different
storage origin. On the old PC, export any journals or comparisons you need before
clearing browser storage. The options paper journal supports validated JSON
restore on the new PC. Forecast, share-portfolio and quote/execution comparison
exports are backups; their tools do not currently offer in-app restoration.

If you choose to configure provider access later, enter credentials privately
into the new PC's ignored root `.env` file and restart the backend. Preserve any
existing configuration. Do not put credentials into Git, frontend source or
browser storage. See [options data setup](options-data-setup.md) for current
access requirements and limitations.
