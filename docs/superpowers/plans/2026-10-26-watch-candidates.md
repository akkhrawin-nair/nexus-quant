# Fresh data and directional watch candidates

User request: refresh stale saved data and show up to three stocks with bullish
technical alignment and three with bearish alignment. User previously opted out
of design approval questions; proceed with existing Django/React architecture.

Diagnosis: dashboard polling reads the database only. The backend was launched
without outbound network access; all 50 provider requests failed. A network-enabled
QQQ request succeeded and returned Oct23 daily bars. Restarted the owned backend
with network access and initiated a full watchlist sync. Do not fabricate dates.

- [x] Force provider refresh for explicit Sync. Add automatic stale-data sync
  with a visible opt-out, six-hour provider-age threshold, 15-minute retry cooldown
  and shared server ingestion lock; retain manual Sync. Clarify 30-second DB polling.
- [x] Add tested stock-only ranking from completed daily observations: price vs
  EMA20, EMA20 vs EMA50 and MACD vs signal must agree in the direction. Rank by
  number of directional checks including RSI band and relative volume, then
  price-normalized MACD separation and symbol. No tuned win probabilities.
- [x] Exclude old/unknown provider snapshots (six-hour maximum age), sessions
  older than four calendar days relative to approximate completed weekday,
  invalid data and insufficient history. Approximate close cutoff is 16:15 New
  York on weekdays; no complete exchange holiday/early-close calendar is modeled.
  Filter current unfinished bars before computing indicators.
- [x] Render two groups of up to three cards with dates, evidence, caution and
  Analyze links; never pad with unqualified stocks or include crypto/ETFs.
- [x] Verify real provider refresh, suites, lint/build, desktop/mobile UI,
  failure/partial refresh and candidate-empty states, plus independent review.

Keep previous records on failed refresh. Partial failures remain explicit. No
orders, paid feeds or background notifications. Candidate alignment is a
heuristic research alert, not a promise that price will rise/fall. Retain 14-day
planning context. Current GitHub commit004b258; this work stays local until asked.


Verification completed 2026-10-26:
- Network-enabled provider sync: all 50 assets succeeded, 304 created / 12476 updated;
  saved stock sessions Oct23, crypto Oct26. Stocks remain daily observations.
- Backend 97 tests and frontend 110 tests passed; ESLint and Vite production build passed.
- Headless Edge/Playwright (Browser plugin unavailable): actual API shows three
  bullish and three bearish cards; Analyze opens ADBE; 390px layout has no horizontal
  overflow; desktop/mobile screenshots inspected, no runtime errors.
- Simulated browser clock: six-hour threshold with saved-data polling disabled,
  persistent 15-minute retry, partial failure retains 50 cards, reload cooldown,
  opt-out, manual refresh and StrictMode duplicate prevention all passed.
- Empty candidate states exercised by mocked API during sync regression.
- Independent read-only review found an auto-sync timer issue; fixed with independent
  minute/focus checks and cleanup. Re-review reports no Important/Critical issues.
