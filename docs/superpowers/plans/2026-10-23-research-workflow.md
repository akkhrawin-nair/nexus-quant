# Research workflow items 5–10

User requested all six items, stepwise with rechecks, and previously opted out
of approval questions. Extend the existing React browser-local workflows; no
new dependencies, broker orders, account access, subscriptions or invented data.

- [x] 5. Summarize Dime-labelled manual comparisons and reported executions,
  distinguishing exact identifiers, timing, debit discrepancies and unverified
  provenance. Reuse existing validated records.
- [x] 6. Add European Black–Scholes model Greeks, optional midpoint-implied IV
  and explicit time/price scenarios for calculated tickets. Require user model
  inputs, disclose American exercise/dividend limitations and never use model
  prices as executable marks.
- [x] 7. Add an immutable source-linked catalyst journal with publication date,
  event date and recording time; classify 14-day windows and aging. No automatic
  source verification or complete earnings-calendar claim.
- [x] 8. Add partial paper exits with cost allocation, remaining commitment and
  timestamped manual bid monitoring. Preserve legacy outcomes, entry records,
  exports, restoration, deadlines and fee-aware arithmetic.
- [x] 9. Add a backup center for forecast, comparison, share-portfolio, options
  and catalyst JSON exports. Preview, validate, detect conflicts/stale previews,
  write one dataset at a time; never merge portfolio cash balances. Old exports
  remain accepted. No credentials included in backups.
- [x] 10. Add a daily summary from saved daily observations, open paper
  deadlines, model evidence and sourced catalysts. Explicitly show missing data,
  local storage errors and that this is not a buy recommendation.
- [x] Run all suites, lint/build, desktop/mobile browser interactions and an
  independent review. Fix important findings before completion.

Review focus: malformed backups preserve data; changing tabs cannot overwrite
newer storage; partial exits cannot exceed original quantity or double-count
cost/P&L; stale marks cannot appear current; IV inversion must reject unsupported
prices; source links cannot execute scripts. Keep previous uncommitted work.

Review ledger: independent review caught insufficient share-import schema
validation and the legacy 2 MB options restore limit. Both now have regression
tests observed failing before fixes, and a clean focused re-review. Added
32 MB center imports/exports with explicit legacy-form guidance, strict imported
portfolio records and cash/P&L reconciliation, and a >2 MB roundtrip test.
Added duplicate partial-exit protection and monitoring-value range validation.

Ruling: reuse the already maintained issuer context in a small read-only
calendar endpoint and the daily brief. No new external service, fetched news
automation, dates invented for ONDS or changes to existing issuer data.
EOSE's Nov5 announcement was rechecked against its primary release on Oct23.

External validation remains outstanding: no independently authenticated Dime
quotes/executions or broker Greeks are available. Software features do not
establish broker accuracy, American-option pricing accuracy or profitability.

Final verification: 106 frontend tests, 80 backend tests, ESLint and Vite build
pass. Playwright/Edge desktop 1440x1080 and mobile 390x844 passed daily observations,
maintained/personal catalysts, backup download/preview/restore and malformed-file
rejection, Dime evidence, model results, monitoring marks and partial-exit quantity
checks. Existing options navigation/identity/paper-entry regression flow passed
both viewports. No page errors, modal overflow or provider quote requests in QA.
Browser plugin unavailable; isolated Playwright contexts used synthetic records.
Fresh focused calendar review found no Important/Critical issues. Local changes
only; no commit, push, deployment, paid data purchase or broker order performed.
