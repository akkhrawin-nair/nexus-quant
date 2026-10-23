# Options quotes while trading in Dime

## Free manual quote comparison

Open **Options bid / ask → Compare and save broker quotes**. This feature makes
no broker/provider requests and needs no subscription. Enter two named manual
snapshots, each with its own ticker, call/put, strike, expiration, multiplier,
bid, ask, per-contract per-side fee and source timestamp. Quote times are entered
in the displayed browser timezone and saved as UTC instants. Quantity is shared.
Expiration is restricted to 14 calendar days from the New York comparison date.

Copy A contract terms to B copies only identity fields. Prices, source, fees and
timestamp remain separate. Numeric B-minus-A differences are blocked if any
entered identity field differs or if the user has not confirmed matching
deliverable/settlement terms. That confirmation is an attestation, not automated
contract verification. Contract-field edits clear it. Independent per-snapshot
costs may still be inspected when the combined comparison is blocked.

Buy cost uses ask × quantity × multiplier + entered buy fees. Sell proceeds use
bid × quantity × multiplier − entered sell fees. The panel reports premium,
total cost/proceeds and fee differences separately. It never ranks brokers or
claims an executable arbitrage. Source-time gaps are shown explicitly; a local
5-second threshold does not establish simultaneous quotes. Ages over 60 seconds
are flagged while the panel is open. Zero bids are flagged; sizes/depth, market
hours, source authenticity, deliverables and fills are unverified. Differences
do not establish why prices changed. Fees default to zero and must be supplied.

Saving writes immutable normalized inputs, comparison/save timestamps, quantity,
deliverable attestation and method version to browser-local storage at
`kappa.optionQuoteComparisons.v1`. Identical snapshots/settings are deduplicated.
History remains readable after expiration and never changes source timestamps to
the current time. Up to 200 comparisons are retained; the UI shows the latest 10,
and JSON export includes all. Invalid storage blocks saving and remains
exportable. No cloud synchronization, import, order submission or position
tracking is included. Browser QA uses isolated synthetic quotes and confirms no
provider requests from this workflow.

## Options paper-position journal

Open **Options bid / ask**, calculate a complete ticket, then choose **Options
paper journal**. The journal saves long-call/long-put simulations only. It uses
the ask, whole contract quantity, entered multiplier and fees to preserve an
immutable entry cost. Confirm contract/deliverable/multiplier terms and name the
manual source. Optional OPRA provenance is whitelisted and matched to the exact
contract/price/timestamp; no credentials or unselected provider fields are saved.
Even a provider snapshot does not verify a broker fill or deliverable.

Opening requires a current-day calculation, source quote age at most 60 seconds,
valid expiration within 14 New York calendar days, planned exit no later than
expiration/14 days, cost within the entered budget, spread within the entered
threshold, and a sufficient ask size if supplied. Unknown quote sizes remain
unverified. Invalid or zero-cost entries are rejected. Identical same-day tickets
are deduplicated. Each ticket uses its own budget; no account cash is reserved.

Record a full-position outcome with an entered positive exit option bid, per-
contract exit fee, source, timestamp and contract acknowledgement. Proceeds are
`bid * contracts * multiplier - exit fees`, rounded to cents. Net paper P&L is
proceeds less original entry cost, including original buy fees. Percentage return
uses that original entry cost. The entered source timestamp is the assumed paper
exit time and must follow entry and be on/before expiration. Historical quotes
may be recorded later; actual recording time and source time are both preserved.
Missed planned/hard dates are evaluated from the assumed exit date. Hours,
broker cutoffs, fills, taxes, FX and additional slippage remain unverified.

A zero bid never establishes a sale. An explicit **zero-recovery assumption**
requires acknowledgement and an explanation, uses zero proceeds/no exit trading
fee, and records no verified sale, exercise or settlement. Expiration alone does
not price or close a position. Expired and overdue records remain open until a
user records an outcome; option exercise/deliverable obligations are not modeled.

The journal and a dashboard deadline banner identify approaching (within two
calendar days), due-today, overdue and expired positions using New York dates.
The banner links directly to the journal. Updates run while the app is open,
with no automatic closing or unattended notifications. Closed records preserve
their original ticket and cannot receive a second outcome.

`kappa.optionPaperJournal.v1` is browser-local, with up to 200 total records.
The UI shows every open record and the latest 20 outcomes. JSON backup includes
all records; export before clearing storage. Local JSON restoration is available
with preview and conflict checks; there is no cloud backup. Invalid storage
blocks writes and remains exportable. Stored data can
be edited through browser tools and is not independently audited. Automated
browser verification uses isolated synthetic quotes, no broker requests and no
real positions. Stock-paper cash and quote-comparison records are separate.

## Optional provider adapter

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

## Combined options paper premium cap

In the options paper journal, set **Total open paper premium cap ($)** before
opening another position. There is no suggested or automatic default. The cap
counts original ask-based entry costs plus entered buy fees for all open records,
including expired records without outcomes. New positions must fit both this cap
and their individual ticket budgets. Comparisons use integer cents; an entry
exactly at the cap is accepted.

Existing journals remain readable. Lowering a cap below existing commitments
preserves records and blocks new entries; no position is closed automatically.
Recording a full-position outcome releases its original entry commitment. Losses
do not automatically shrink the cap, and proceeds are not an account cash ledger.
Zero blocks new entries. The setting is included in JSON exports. Invalid saved
settings preserve original data and block writes. This browser-local guard is not
broker enforcement, a cash reservation, or a guarantee of maximum actual loss.

## Options paper outcome review

The journal review summarizes all recorded outcomes, even records beyond the
latest 20 displayed cards. Open records never receive an assumed mark-to-market
profit or loss. The review shows the sample size, net paper P&L, wins/losses/
breakeven, win rate, average net P&L, original entry costs, return on those entry
costs, and modeled fees. No outcomes means percentage and average statistics are
unavailable. Fees are already deducted from net results, not deducted twice.

Bid-reference outcomes and explicit zero-recovery assumptions are counted
separately and both contribute to aggregate results. These remain user-entered
simulations, not verified fills. Returns use the sum of closed entry costs and
are not account or annualized returns. Missed planned exits and latest allowed
dates use the original saved outcome's assumed exit time; recording a historical
quote later does not itself make that exit late. Open records past planned exit
or expiration are counted separately and may overlap. The review does not write
to storage or alter saved tickets. Results describe the selected recorded sample
and do not establish a trading edge.

## Restore an options journal backup

Expand **Restore options journal backup**, select a JSON export (maximum 2 MB),
review the counts and resulting cap/commitment, then confirm the merge. Preview
and cancel do not write records. The file is read locally without upload.

Restoration validates original entry calculations, contract dates, recorded
outcomes, supported version and cap values. Identical records are skipped,
including matching records with different IDs or JSON key order. Any conflicting
entry/outcome aborts the entire merge; originals are never replaced. A changed
local journal invalidates the preview. More than 200 merged records, malformed
files, and damaged local storage block restoration and preserve existing data.

Existing local cap settings win, including an unset legacy cap. Only an absent
local journal recovers the cap from the backup. Historical open positions can be
restored above the cap; new entries remain blocked. Export the current journal
before merging. Imported records retain their assumptions and timestamps, not
verified broker provenance. There is no cloud synchronization or automatic
reconciliation of conflicting outcomes.

## Broker buy-to-open order-ticket check

Expand **Compare and save broker quotes**, enter the reference snapshots and
select **Include a broker buy-to-open order-ticket check**. Independently copy
the broker order preview's contract fields, quantity, multiplier, buy limit,
USD total debit, total entry fees and source timestamp. Confirm the exact broker
contract identifier/deliverable and buy-to-open action. Enter the premium budget
and planned exit date. This supports long calls/puts, USD and buy-to-open only;
it is not an order-entry connection or a sell-to-open/multi-leg calculator.

The check computes buy-limit debit plus total entry fees, reconciles the entered
broker total to the cent, and compares it with the selected snapshot's ask cost.
Contract or quantity mismatches and missing confirmation block cross-contract
cost differences. Total fees are for the whole order, not per contract. The
budget and current combined paper-cap check use the higher of calculated debit
and broker-displayed debit. The cap check does not reserve cash; a ticket already
recorded as open is counted again as a proposed additional entry here.

Source age uses 60 seconds and source-time separation uses 5 seconds as local
review thresholds. Expiration stays within 14 New York calendar days and the
planned exit cannot exceed expiration. Current age/past-date warnings update
while the tool is open; these checks do not verify exchange sessions, broker
cutoffs, permitted limit increments, available cash or fills.

**Save comparison** preserves the normalized order-preview inputs and original
comparison/save timestamps alongside the two snapshots. Existing comparison
exports remain compatible; invalid added ticket fields block storage writes.
Repeated saves deduplicate the same inputs. Exports include the ticket, and
historical records reload using their original comparison date, with explicit
old/expired labels. The paper-cap check always describes the current local cap,
not a saved historical cap. No broker/provider requests or orders are sent by
this manual workflow. Broker previews, prices, contract terms and currency remain
user-confirmed assumptions, not independently verified execution evidence.

## Reconcile individual broker execution reports

Save a quote comparison with a broker buy-to-open order preview, expand that
record under **Saved comparisons**, then choose **Add an individual execution
report**. Older records are available through **Show all saved comparisons**.

Copy one execution's filled contracts, average fill price, total fees, reported
USD debit and execution source timestamp. Give it a unique local execution label
and source name, choose broker-paper or user-reported-real, and confirm the exact
saved contract/deliverable and buy-to-open action. Do not enter cumulative filled
quantity or the order's running average as another individual execution. If only
cumulative broker data is available, obtain its execution breakdown first.

An execution time must be at or after the saved preview, no later than recording
time (5-second clock tolerance), and no later than expiration using New York
dates. Historical pre-expiration reports may be recorded later; source time and
recording time remain distinct. Up to 100 reports are supported per saved order.
Total reported quantity cannot exceed the original order quantity. Matching
execution labels and identical inputs are skipped without rewriting originals;
conflicting reuse is rejected. Broker-paper and reported-real executions cannot
be mixed on one saved order.

The review weights prices by filled quantity and calculates each execution's
debit as price times contracts times multiplier plus its entered total fees.
Only reported filled contracts contribute to costs. Original limit-estimated
fees are allocated pro rata to that quantity. Reference ask comparisons require
matching contract terms, original quantity and deliverable acknowledgement;
otherwise cross-contract differences remain blocked. This does not calculate
trade P&L, close positions or value unreported contracts.

Reported averages above the original limit, individual debit discrepancies and
executions after the original planned exit date are retained and flagged.
Discrepancies are counted individually even when their signed totals cancel.
A different price or fee is not proof of broker error: time gaps, order changes,
fee allocation and source-entry mistakes need review. A matching total is not
verification of an execution. Partial/full labels describe report coverage only,
not actual broker order status or outstanding orders.

The evidence summary counts every saved comparison, distinguishes broker-paper
and user-reported-real samples, and never claims independent verification.
Existing comparisons without execution reports remain compatible. JSON exports
include every execution, source and recording timestamp; invalid records or
failed writes preserve original stored data and report errors. Export before
clearing storage. No account cash, broker holding, exit or order is updated.
Browser-local records can be changed using browser tools and are not an audit
trail authenticated by the broker. Automated QA uses synthetic isolated records;
actual broker quote/execution reconciliation is still unverified.

## Exact contract-identifier checks and remaining live-data blocker

As of October 22, 2026, new broker-preview checks and execution-report forms
require an independently copied exact OCC identifier. Optional identifiers can
also be captured on quote snapshots. Compact identifiers and standard 21-character
identifiers with a six-column space-padded root are normalized to compact form.
The parser checks the calendar expiration, positive strike (including fractional
strikes), call/put and standard alphabetic root against the entered fields.
Mismatches reject comparison or report submission before writing records.
Partial padding, adjusted/digit roots and root-to-underlying aliases are
unsupported; no mapping is guessed. Multiplier/deliverable/authenticity remain
user-confirmed and are not encoded or verified by this parser.

Captured identifiers are preserved in comparison/execution exports and displayed
with saved records. Invalid/tampered identifiers block loading and mutations.
Legacy records without identifiers remain readable with missing-identifier
caveats. New execution forms clear the identifier after a successful report so
it must be copied again for the next execution. Nothing backfills an identifier
into an original record or treats a parsed string as authenticated broker data.

The local offline Webull check currently reports missing credentials. Webull
Thailand states that [API options data requires a paid market-data subscription](https://developer.webull.co.th/apis/docs/trade-api/option/)
and that [mobile/desktop subscriptions are separate from OpenAPI](https://developer.webull.co.th/apis/docs/market-data-api/faq/).
The configured Alpaca account's previous OPRA request was denied. No paid
subscription has been purchased, and no repeated denied request is made as part
of these checks. Under the current no-paid-data constraint, automatic live-option
quote verification remains unavailable. Manual broker quote/execution samples
can validate arithmetic, identities and record handling, but are not a live feed
or independently authenticated execution record. No software-only rating can
substitute for that missing validation.

## Options workspace navigation

The options dialog now has three keyboard-accessible sections: **Plan an option**,
**Compare broker quotes**, and **Paper journal**. Tabs remain visible in the
sticky modal header. Left/Right arrows wrap between tabs; Home/End select the
first/last tab. Switching sections preserves unsaved form inputs and current
calculations while the workspace stays open. Closing it clears unsaved drafts;
saved browser journals/comparisons remain unchanged.

In **Plan an option**, copy a standard OCC identifier and choose **Fill contract
fields**. This validates the 14-calendar-day expiration window using New York
dates and fills ticker, call/put, strike and expiration. Old bid, ask, displayed
sizes and quote timestamp are deliberately cleared. Quantity, fees, multiplier,
budget, spread limit and planned exit stay as entered and must be rechecked for
the new contract. No quote is fetched and no multiplier is inferred. A supplied
identifier must also agree with the final manually edited fields when calculating.

Provider quote access is in a separate optional disclosure. Manual calculations
do not need it. After calculating, **Review this ticket in paper journal** opens
the journal section with the exact ticket; an entry is not created automatically.
The dashboard's deadline shortcut also selects the journal directly. Existing
storage keys and legacy records remain readable. Partial exits, monitoring,
model scenarios and the backup center are described in
[the research workflow guide](research-workflow.md). Broker limitations remain.
