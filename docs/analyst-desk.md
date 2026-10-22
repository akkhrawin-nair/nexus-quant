# Analyst desk

The desk supports research and a user-defined trade scenario; it is not an
automated investment adviser, live execution service, or calibrated prediction
model. No subscription or OpenAI API is used. It places no orders.

## Reading path

1. Check the source and latest saved session. The report reads saved daily bars;
   reloading the report does not download new bars. Use **Refresh [ticker]
   prices** in the desk to request this ticker's history, or dashboard **Sync
   market data** for the watchlist. A daily close is not an executable quote.
2. Read the current technical assessment. Below both ordered EMAs is labeled a
   downtrend. A close below the prior range low is explicitly described as a
   breakdown, even if the company has reported growth.
3. Inspect candles with EMA20/50 overlays, range references, and news dots. The
   numeric metrics and written reading provide an accessible alternative to the
   canvas. Chart interaction supports zoom/pan; responsive sizing includes mobile.
4. Review both issuer cases and source-linked facts. The curated EOSE and ONDS
   notes were reviewed October 21, 2026. These are selected issuer disclosures,
   not exhaustive independent due diligence. Interpretations are separate from
   reported facts. After seven days the review is flagged overdue; it does not
   automatically refresh or become current when the report reloads.
5. Check known catalyst dates against the current 14-day window in New York.
   Unknown schedules are unknown, not confirmed absence of events.
6. Enter your proposed entry, stop trigger, target, USD capital, loss budget and
   exit date. The tool sizes whole shares and draws these assumptions on the
   chart. Save it in Saved share plans to open a simulated paper position. It
   does not choose a suitable risk budget or save a broker position.

## Technical conventions

### Data freshness and ticker refresh

The source notice separates observation/session date, provider-response receipt
time and database row-save time. Migration `0002_provider_retrieval_time` adds a
nullable provider timestamp; old rows remain unknown rather than inventing fetch
times from save/report generation time. New ingestion preserves the provider
timestamp even when ingesting a cached frame. Reloading a report changes neither
stored timestamp. Received/saved instants display in the browser timezone with
timezone details; the observation/session date is not a quote timestamp.

`POST /api/research/brief/refresh/` accepts one ticker, uses existing origin
validation and ingestion throttling, and bypasses the 120-second history cache.
A nonblocking ingestion lock rejects concurrent refreshes with 409. Provider
failure returns 503 and does not substitute cached prices as a successful refresh.
The browser keeps the loaded report on refresh failure. A successful response
updates the chart/technical brief, explicitly reports an unchanged latest session,
and clears only the current unsaved drawn scenario. Saved forecasts/plans and
paper balances/results are untouched. Changing ticker, reloading saved analysis
or closing the desk aborts the UI request and prevents late results from replacing
the current ticker. An already-running server ingestion may still finish.

The age panel uses New York calendar dates and refreshes while open. Same-date
daily bars have unconfirmed final closes; 1–3-day data is recent daily history;
older observations request a check for newer data. These are age descriptions,
not exchange-session validation. Holidays/weekends are not modeled. Future or
missing observation dates are explicit; ended projection windows require refresh.
No data is labeled executable/live. Refreshing prices does not update the manual
issuer review or establish news completeness. This remains free daily research.

### Future outlook

The default chart shows 20 recent daily candles plus dashed projected paths
extending beyond the last observed candle. The shaded area is projected;
the 90-session history button removes it. A numeric table supplies midpoint
and endpoint values without requiring hover or interpreting the canvas.

The central path fits a least-squares slope to the last 20 log closes and
decays each subsequent trend increment by a factor of 0.85. Upper and lower
paths add/subtract trailing daily log-return sample volatility (up to 60 returns)
times the square root of projected steps. These are illustrative volatility
scenarios, not statistically calibrated confidence intervals. Both scenarios
can fall in a downtrend; neither is a guaranteed price target. Numeric
exponentials are bounded to avoid overflow. EMA, RSI and MACD remain contextual
indicators; they are not independent inputs to this projection. News is not
an input. There is no fitted machine-learning model or API subscription.

The horizon is 14 calendar days from the latest saved observation. Weekdays
are used for stocks and calendar days for -USD crypto. Exchange holidays are
not modeled; chart dates are illustrative. Old data never gets silently
re-anchored to today. Observation age and an expired-window warning are visible.

A fixed-rule walk-forward diagnostic starts after 60 observations and uses
sequential non-overlapping 10-observation equity windows or 14-observation
crypto windows. Windows spanning more than 14 calendar days are omitted.
Every forecast uses only the prefix available at its origin. Endpoint mean
absolute percentage errors are compared with an unchanged-price baseline on
identical windows. This is descriptive retrospective testing of a fixed rule,
not independent prospective validation, directional accuracy or trading profit.
Fewer than 20 windows is flagged as a small sample. No calibrated probability
or validated trading edge is claimed.

Minimum 60 unique observations. Chart shows up to 90 sessions. EMA20/50 use all
available earlier bars with pandas `adjust=False`. RSI14 is the existing simple
rolling gain/loss method, not Wilder RSI. ATR14 is the simple mean of true range.
Relative volume compares the last volume with the preceding 20 sessions.

Range high and low use the 20 observations before the most recent bar. The
five-session high in the bullish scenario also excludes the latest bar. These
levels are historical references, not guaranteed support/resistance. Scenario
conditions are fixed heuristics, not tested entry recommendations. The 1.25×
volume threshold is not a validated probability or proof of a breakout.

News markers use the publication date of maintained issuer notes only when the
same date exists among chart sessions; they do not prove causal price impact.
Unreviewed Yahoo RSS headlines are fetched separately and can be unavailable
without blocking the saved-price report. No sentiment score or win probability
is inferred from headlines.

## Forecast journal

The forecast panel includes a browser-local journal (`kappa.forecastJournal.v1`).
Save a forecast before its target date. It preserves the symbol, model version,
origin close/date, complete upper/central/lower paths, target date, actual save
timestamp, method and source label. One record per ticker/origin/model is kept;
reloading or saving a changed forecast with that same identity does not overwrite
the original. A save after the origin date is explicitly not represented as a
forecast issued on that earlier date. The rule currently has version
`damped-logtrend-v1`; change that version if the projection model changes.

Use dashboard Sync, reload the Analyst desk, then **Check loaded data**. The check
uses this ticker's loaded daily candles, not a new provider download. It waits
until the target date has ended in New York, requires exactly one matching
target-date close, and never substitutes a later or earlier date. Holidays and
missing observations therefore remain unscored. The desk only loads 90 sessions;
record outcomes promptly. Each recorded result preserves the observed close and
check timestamp; later price revisions do not silently rewrite it.

Endpoint absolute percentage error is `abs(predicted - actual) / actual * 100`.
The same-date unchanged-price baseline substitutes the original origin close.
Per-ticker average errors use only completed records. Pending and unavailable
outcomes contribute nothing. These are descriptive errors, not portfolio profit,
win probabilities or independent evidence of an edge. Saved windows may overlap;
historical adjusted-price revisions and corporate actions affect comparability.

Up to 200 records across all tickers are retained in this browser. Export downloads
the entire stored journal as JSON; there is no import, account synchronization,
cloud backup or background checking. Browser storage can be edited manually and
is not an independently audited record. Invalid data blocks writes and stays
exportable. Storage read/write failures are reported without claiming success.
No real user's forecasts or portfolio are created by automated QA; completed
outcome browser tests use isolated synthetic observations.

## Share scenario arithmetic

Entry/share = entry × (1 + slippage) × (1 + fee).
Assumed stop proceeds/share = stop × (1 − slippage) × (1 − fee).
Quantity is the smaller whole-share count supported by available capital and the
entered planned-loss budget after these costs. Target proceeds use the same
sell-side convention. Net reward/risk is calculated after entered costs.
If one share cannot fit, quantity is zero. Exit must be from today through
14 New York calendar days ahead; actual exit scheduling is the user's job.

A stop trigger does not guarantee a fill. Gaps, halts, liquidity, fees beyond the
model, FX and taxes can change realized losses. This is a shares-only calculator;
it cannot value options or replace broker contract and quote verification.

## Saved share plans and paper results

**Saved share plans** stores up to 200 immutable user-entered plans in the existing
browser-local paper portfolio (`nexus_quant_paper_portfolio`, compatible version 2).
The snapshot contains the ticker, creation timestamp, normalized inputs, fee and
slippage assumptions, calculated whole-share quantity, planned loss/gain, exit
date and 14-day deadline. Saving does not spend paper cash. Identical same-day
plans are deduplicated. Existing positions/history are preserved; invalid saved
plans block mutations and remain available through the raw JSON backup export.

Each plan can open one simulated position on its saved New York date only.
Older plans require recalculation and a new save. Opening uses the entered entry
reference, not a provider quote or a broker fill. Buy cost is
`quantity * entry * (1 + slippage) * (1 + fee)`, rounded to cents. The whole-share
quantity is not changed during opening. Insufficient paper cash, zero quantities,
or cent rounding that would exceed the saved capital/loss budget block opening.
Simulated cash can be added explicitly and is shared with Paper portfolio.

Record an exit reference in Saved share plans, or use the observed daily close
in Paper portfolio. The exit source is saved. For linked positions, proceeds are
`quantity * exit * (1 - slippage) * (1 - fee)`, rounded to cents. Net P&L is proceeds
less actual entry cash cost. Realized R is net P&L divided by the original
unrounded planned loss; the entry/stop/target/risk snapshot is retained in history.
Existing simple fractional paper buys retain their zero-cost convention. Current
portfolio valuations include assumed exit costs for linked plans when a quote is
available; missing quotes retain cost as a valuation placeholder.

Plan deadlines use New York calendar dates. Due within two days, due today and
overdue notices appear in the relevant open-plan view and a dashboard banner
with a shortcut to Paper portfolio. Dates refresh every 30 seconds while the
app is open; the dashboard also refreshes on focus. Closed records identify a
missed exit date and a missed 14-day deadline. Late exits remain recordable.
This does not model market hours, holidays or broker cutoff times. No automatic
stop/target/deadline execution, unattended notification or broker order runs.

JSON backup includes saved plans, open positions, cash and history, with no
automatic import. Closed-history CSV includes original levels, costs, dates,
planned risk, realized R and exit source. Export before clearing browser storage.
Paper results are hypothetical, not evidence of future profitability. Browser QA
uses isolated simulated funds and exit prices and does not alter a user's data.
