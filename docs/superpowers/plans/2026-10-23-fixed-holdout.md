# Fixed-rule historical holdout

Goal: evaluate the frozen confluence-risk-v1 stock protocol on later observations
without selecting or refitting a rule. The user authorized implementation and
previously opted out of approval questions. Keep existing uncommitted work.

Design: 70% earlier bars supply indicator context only; evaluate the last 30%
from fresh cash with no position carried across the boundary. Require 150 unique
daily bars. Use the same whole-share, cost-aware 1% risk/20% position sizing,
7.5% stop, 15% target and 14-calendar-day cap. Compare cash and whole-share
buy-and-hold over identical dates. Passive exposure differs and has no 14-day cap.

Also evaluate a predetermined stress case: add 10 bps to each per-side fee and
slippage assumption, each capped at the existing supported 100 bps. Do not claim
strategy returns must decrease monotonically when sizing/trades can change.
No fees are represented as a verified Dime schedule.

Save method/version, split, parameters, source metadata, SHA256 input fingerprint
and exact historical OHLCV snapshot in downloadable JSON. Report small samples,
repeated-use/ticker-selection/adjustment bias and no pristine-unseen-data claim.

- [x] Write and observe failing tests for boundaries, fixed rules, no future
  leakage into earlier fills, reference arithmetic, cash/whole shares, stress,
  malformed inputs, serialization and replay from the snapshot.
- [x] Implement the service and API mode, preserving legacy modes.
- [x] Add the default fixed-holdout UI, explanations, chart and JSON download.
- [x] Evaluate predeclared QQQ, SPY, EOSE and ONDS at 1y with $10,000, 10 bps fee,
  5 bps slippage; retain all results and describe limitations, not recommendations.
- [x] Run suites, lint/build, desktop/mobile QA and independent review.

Review focus: no pre-holdout P&L/carryover; stop-risk sizing unchanged; passive
cash remainder/fees are correct; empty results never imply proven failure/success;
future bars cannot change prior signals/fills (end-of-sample liquidation excluded).

Ruling: work directly in the current authorized workspace without automatic git
commit/push. Historical data may already have been seen; call this a historical
holdout. A genuinely forward, complete paper signal record remains future work.

Independent review found no Important/Critical issues. Its minor session-date
uniqueness suggestion was fixed with a regression observed failing first.
Additional tests cover today/future-bar exclusion, nullable volume, snapshot
replay and timezone/daylight-saving-independent daily labels. An ambiguous
Period accessible label was corrected after browser QA; rerun passed.

Isolated Playwright/Edge desktop 1440x1080 and mobile 390x844 verify default mode,
negative/no-trade results, cost stress, downloadable JSON contents, period reset,
legacy modes and daily brief. No modal overflow, page errors or provider quote
requests. Browser plugin not available; temporary artifacts remain outside git.

All four results are retained in docs/fixed-strategy-holdout-results-2026-10-23.md:
QQQ −0.1253%, SPY −0.0553%, EOSE/ONDS no trades. No demonstrated edge; rules
unchanged. Local work only; no broker orders, paid data, commit or push.

Final checks: 91 backend tests and 106 frontend tests pass; ESLint and production
build pass. Final desktop/mobile interaction rerun passes. Archived final JSON
for all four symbols replays the exact trades and evaluation IDs independently
of provider refetches. Reports preserved in the task's temporary ZIP artifact
KAPPA-holdout-2026-10-23-0923.zip; source dates use YYYY-MM-DD session labels.
