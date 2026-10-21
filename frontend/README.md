# KAPPA frontend

React/Vite personal research dashboard. Start the backend on `127.0.0.1:8001`, then run `npm ci` and `npm run dev` here. Open `http://127.0.0.1:5173`.

Copy `.env.example` to `.env` only to override `VITE_API_BASE_URL`. Restart Vite after environment changes.

Commands: `npm test`, `npm run lint`, `npm run build`.

The dashboard uses actual stored historical bars. Detailed tools load on demand. Browser-local paper trading is a simulation, and missing source data has explicit states. See the root README and `docs/data-and-methodology.md` for setup, accounting conventions, backtest assumptions, and limitations.
