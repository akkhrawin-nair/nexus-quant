# Options quotes while trading in Dime

KAPPA now includes a read-only Alpaca OPRA quote adapter. This is a separate data
connection, not a Dime account connection. It cannot place orders, access your
Dime account, guarantee fills, or verify your broker's contract deliverable.

## Access required

1. Check eligibility to obtain Alpaca API credentials and the options OPRA data
   subscription from Thailand directly with Alpaca. Account eligibility, data
   licensing, and pricing must be confirmed before purchasing anything. KAPPA
   has not created an account, purchased data, or verified account access.
2. Alpaca's Basic options feed is **indicative**: quotes are modified. This does
   not solve the price comparison problem. The adapter always requests
   `feed=opra` and never falls back to indicative.
3. If eligible, obtain API credentials in the provider dashboard and configure
   them privately in the project's root `.env`:

```dotenv
APCA_API_KEY_ID=
APCA_API_SECRET_KEY=
```

Preserve existing settings. Never put secrets in frontend source, `VITE_`
variables, screenshots, chat, or Git. Restart the Django backend after changing
environment configuration. No new Python dependency is needed.

Official references, checked October 21, 2026:

- [Latest options quotes and OPRA vs indicative](https://docs.alpaca.markets/us/reference/optionlatestquotes)
- [Market data access, subscription plans, and authentication](https://docs.alpaca.markets/us/docs/about-market-data-api)

## Use

Open **Options bid / ask**. Copy the exact OCC contract symbol from the broker
(underlying, expiration, C/P, and strike must all match) and click **Load OPRA
quote**. The endpoint `/api/options/quote/?contract=...` accepts one standard
alphabetic-root OCC symbol, with expiration within 14 New York calendar days.
Adjusted roots are not supported by this first adapter.

The snapshot fills bid, ask, displayed sizes, source timestamp, and contract
identity. Multiplier and fees remain user-entered and unverified. Source time is
preserved separately from fetch time; quotes older than 60 seconds are flagged.
Refresh explicitly for a new snapshot. This is not continuous streaming.

Changing price, quote time, size, or contract fields returns the calculator to
manual mode. Editing budget, fees, quantity, or planned exit preserves quote
provenance. Source checks never claim a guaranteed execution price.

## Verification status

Automated tests exercise provider responses with mocks. Without credentials and
OPRA entitlement, real quote retrieval and cross-broker comparisons remain
unverified. Missing credentials, denied access, throttling, timeout, invalid
quotes, and missing contracts produce explicit errors; old timestamps are never
replaced with the current time.

After connecting, compare several exact contracts against Dime during market
hours, recording quote time, bid/ask, sizes, multiplier and estimated fees. Price
changes between snapshots, broker routing, liquidity, and execution can still
produce different fills. The adapter requests no trading or account endpoints.
