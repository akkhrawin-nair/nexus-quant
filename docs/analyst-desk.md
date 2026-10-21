# Analyst desk

The desk supports research and a user-defined trade scenario; it is not an
automated investment adviser, live execution service, or calibrated prediction
model. No subscription or OpenAI API is used. It places no orders.

## Reading path

1. Check the source and latest saved session. The report reads saved daily bars;
   reloading the report does not download new bars. Use dashboard **Sync market
   data** to update history. A daily close is not an executable quote.
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
   chart. It does not choose a suitable risk budget or save a broker position.

## Technical conventions

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

## Scenario arithmetic

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
