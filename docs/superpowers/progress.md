# SDD ledger — plan: docs/superpowers/plans/2026-10-16-kappa-reliability.md

User approved design and requested sequential implementation for personal real-life use.

Ruling: Work in place because Git ref creation is denied by workspace permissions; no commits, merges, or publishing. Existing files and installed environments stay available. Cost: changes require manual Git integration later.
Pre-flight Tasks 1→2/3/5: real market-data service owns timestamps and availability; consumers cannot substitute invented observations.
Pre-flight Tasks 2/3→5: existing UI formats differ from new analytical responses; replace the affected tool interiors while preserving their modal entry points.
Pre-flight Tasks 4→5: keep paper-trading utility exports and browser-local storage key stable.
Ruling: Use a visible ledger in docs instead of POSIX-only skill shell helpers on Windows. Cost: bookkeeping is manual.
Baseline: Django check passes; api test suite contains zero tests. Deprecated Gemini SDK warning present.

Ruling: Replace simulated tool interiors and the tightly coupled dashboard state with a focused Dashboard and shared research dialogs; retain the light visual theme and primary research workflows. Cost: unsupported AI/options/order-book features become explicit unavailability/education instead of faux recommendations.
Ruling: Use real historical daily closes for paper fills and clearly label the simulation; no executable quote or broker connection is available. Cost: cannot assess actual order fills or intraday execution quality.
Ruling: Use cached runtime Playwright with installed headless Edge because no Browser plugin/browser surface was available (CUA inventory empty; iab unavailable). Cost: no in-app browser handoff; browser QA is an isolated local profile.
Ruling: A single final read-only reviewer was dispatched under the executing-plans/requesting-code-review skill requirements; implementation remained sequential. Cost: one additional review context, with no parallel implementation or edits.

Task 1: complete — 34-test backend suite includes idempotent ingestion, unavailable/stale quotes, scheduler loading, writable provider cache, observation/retrieval timestamps, and watchlist capacity. Django checks pass; initial migration tested against fresh disposable SQLite and applied to the existing SQLite database after confirming it held only Django tables. Real Yahoo ingestion saved 2,236 bars across eight default assets.
Task 2: complete — next-open execution, final-bar signal, ambiguous stops, cost impact, and compounded drawdown verified. Historical API and rendered backtest use actual saved observations with actual coverage.
Task 3: complete — common-date alignment, covariance calculations, normalized sampled allocations, seeded simulations, input limits, constant series, and stale input provenance verified. Options analytics remain unavailable without observed options data.
Task 4: complete — 17-test frontend suite includes legacy preservation, invalid storage, finite accounting, fractional round trips, deposits, storage-write failure, breakeven/profit-factor handling, and overflow rejection. Browser buy/close/deposit/reload passed in a new isolated profile.
Task 5: complete — shared cancellable API requests; honest source states; observed-data dashboard; corrected sorting; fresh metadata on polling; lazy research tools; local alerts; EN/TH navigation. Lint and production build pass without suppressing rules. Browser desktop 1440×1000/mobile 390×844 flows pass with no runtime errors.
Task 6: complete — final post-review rerun passes: 34 backend tests, 17 frontend tests, Django checks, no pending migrations, frontend lint/build, git diff whitespace checks, and the 12-flow desktop/mobile Playwright browser check. Initial migration also passed on a fresh disposable SQLite database. README, environment examples, pinned tested Python dependencies, synchronized npm lock, and methodology added. Existing SQL Server migrations, production security/deployment, trading profitability, and unconnected feeds are explicitly outside verified coverage.

Final review: three Important findings, all reproduced RED→GREEN: overflowing paper account computations, lost stale-input provenance, and additions exceeding the synchronization universe limit. Suites: 34 backend / 17 frontend green after fixes. Additional retrieval-time provenance regression reproduced and fixed.
Final: minor (deferred): More than 12 distinct paper holdings require selecting an older position's ticker to retrieve its quote; quote batching/pagination remains an improvement. No valid positions are removed; documented workaround works.
Final: Ruling: Provider licensing guarantees, trading profitability, existing SQL Server schema migration, and production deployment are not established by these local tests — retain explicit limitations rather than assert readiness for those uses — cost: this release supports personal historical research/paper trading, not validated real-money trade guidance.

Handoff: development frontend at http://127.0.0.1:5173 (session 16323); updated localhost Django server with approved public-provider access at http://127.0.0.1:8001 (session 69369). No external deployment, commits, or merges. QA screenshots and script are outside the repository in the user's temporary directory. The local dataset holds 2,236 actual Yahoo bars for AAPL, BTC-USD, ETH-USD, GLD, NVDA, QQQ, SPY, and TSLA. Retained final working-tree changes because Git writes are restricted.
