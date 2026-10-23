# Fixed strategy implementation plan

Goal: implement the first bounded step of the approved improvement list.
Spec: docs/strategy-protocol-v1.md.
Architecture: reuse the existing daily-bar engine behind a separate fixed
research mode; preserve legacy exploratory and training-selection modes.
No new dependencies or provider calls. Keep current options workspace changes.

- [x] Add behavioral tests for whole-share sizing, cost-aware risk, insufficient
  funds, gap losses, deadline and fixed API mode. Observe failure before code.
- [x] Implement the versioned protocol, expose rules and skipped entry sessions,
  and add the fixed mode to the existing backtest dialog.
- [x] Run backend/frontend suites, lint, build, isolated browser QA and review.

Review focus: tiny accounts must stay in cash; fees must affect sizing; gaps
must exceed planned risk when appropriate; deadlines must survive weekends;
legacy modes and existing options workspace must remain usable.

Ruling: implement directly in the existing user workspace, as requested across
this session; no automatic commit or GitHub upload. The user has opted out of
design and implementation approval questions. This step stops at a defined,
executable protocol; later testing work remains separate.

Verification: 78 backend tests and 89 frontend tests pass; ESLint and Vite build
pass. Isolated Playwright/Edge desktop (1440x1080) and mobile (390x844) tested
fixed rules, tiny-account skips, legacy mode switching, and existing options
workspace flows. Browser plugin unavailable. API smoke test returned the fixed
protocol for QQQ with Yahoo history. No orders or paid data requests.

Independent review found alternate-quote crypto could pass the old asset-type
gate. Added a failing BTC-EUR regression, then restricted fixed-mode symbol
syntax while retaining BRK-B. Full backend suite passed after the fix.
