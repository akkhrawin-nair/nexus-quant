# Research workflow improvements 5–10

All records described here are browser-local and user-entered unless explicitly
identified as retrieved daily market data. No broker account is connected and
no order, paid-data subscription, background notification or automatic exit runs.

## 5. Dime comparison evidence

Open **Options bid / ask → Compare broker quotes → Compare and save broker
quotes**. The Dime evidence panel summarizes Dime-labelled comparisons, matching
copied identifiers/confirmed terms, source timestamps within five seconds, and
reported executions/debit discrepancies. These are separate descriptive checks.
Independently verified records remain zero. Source names are typed by the user;
the app cannot authenticate that Dime supplied a record. Existing broker records
are sufficient; no new trade is required. Bid, ask, last and midpoint must not
be confused; buy and sell arithmetic uses ask and bid respectively.

## 6. Greeks and model scenarios

Calculate an option ticket, then expand **Greeks, IV and time-decay scenarios**.
Enter underlying price, remaining model days, annual volatility, annual rate and
continuous dividend yield. Days must fit within the ticket's expiry date window
and 14-day limit; the exact broker cutoff is not verified. Values are per unit:
delta/gamma per $1 underlying change, theta per calendar day and vega per one
percentage-point volatility change. Use the actual deliverable to interpret
contract exposure.

The model uses European Black–Scholes, a numerical normal CDF, and ACT/365.
Midpoint-implied IV uses bisection over 0.01–500% and returns no solution outside
that bracket. Scenarios keep IV and rates constant, move the underlying by
−10/0/+10%, and stop at the entered model expiry. At expiry only intrinsic value
is shown; Greeks are unavailable. American exercise, discrete dividends,
adjusted deliverables, volatility changes and executable spreads are absent.
Model prices never become paper marks or exits automatically. See
[OCC's model discussion](https://www.optionseducation.org/advancedconcepts/black-scholes-formula).

## 7. Sourced catalysts

**Daily brief** and the **Analyst desk** have a catalyst journal. Save a ticker,
title, event date, publication date, HTTPS source, source type and optional note.
The immutable record preserves recording time, classifies the next 14 calendar
days and flags reviews older than seven days. It does not fetch or authenticate
the linked contents. Issuer, regulator and secondary-news labels are user
classifications. Missing records never imply no event risk. Existing maintained
issuer notes remain separate from these personal records.

## 8. Paper monitoring and partial exits

Open a paper position, then save current manually copied bid snapshots or record
a full/partial exit. Monitoring requires a source timestamp within 60 seconds
and exact-contract acknowledgement; after 60 seconds the snapshot is stale.
Changing the remaining quantity invalidates its use as a current mark. Zero
bid is permitted for monitoring but does not establish an available sale.
Snapshot values never realize P&L or change quantity.

Exits require whole contracts no greater than the remaining quantity. Cumulative
cent allocation distributes original entry cost including buy fees exactly
once; exit fees apply only to the exited contracts. Source and recording times
are preserved. Identical repeated exit inputs are blocked to prevent accidental
double submission. A new exit must have a distinct source time or explanation.
Zero-recovery assumptions can cover a partial quantity but require explicit
confirmation and a note; they are not settlement evidence.

The combined premium cap counts remaining allocated entry cost. It is an
exposure guard, not a cash ledger; recorded losses do not reduce the chosen cap.
Overall recorded P&L includes partial exits. Outcome win-rate/return statistics
include fully closed records only. Mixed bid/zero-recovery closed records appear
in both source categories but enter P&L once. Remaining contracts retain their
original deadline. Legacy full-position outcomes remain readable.

## 9. Backups

**Backups → Download all research backups** exports five named datasets:
forecasts, quote comparisons and execution reports, options journals with
monitoring/partial exits, share portfolios with saved plans, and catalysts.
Credentials, alert/favorite/language settings and the backend database are not
included. Raw damaged datasets can be exported for preservation but cannot be
restored until repaired.

Choose one dataset and upload either a bundle or its older individual JSON
export. Preview validates records and shows counts without changing storage.
Identical records are skipped; differing versions of the same record block the
merge. Changed local storage invalidates a preview. Options preserve existing
local premium-cap settings. Share portfolios must be restored into an empty
destination (or match the existing snapshot); cash balances cannot be merged.
Imports validate dates, positions, cost/P&L arithmetic and cash reconciliation.
Malformed legacy records require separate repair and are never silently fixed.

The backup center accepts up to 32 MB including bundle encoding overhead; larger
bundles are refused on export. The older options-only restore form remains at
2 MB and directs larger histories to the backup center. Browser storage quota
can still reject a valid file; failed writes are reported. Each confirmation
writes one dataset, not a multi-dataset transaction. CSV summaries cannot
reconstruct full journals. Keep backup files private.

## 10. Daily brief

The brief summarizes loaded daily observations and their dates, MACD alignment,
options/share deadlines, Dime-labelled evidence, recorded forecast error versus
the flat baseline, and sourced upcoming events. The read-only
`/api/research/catalysts/` endpoint exposes the existing dated EOSE/ONDS issuer
review, including no-listed-event uncertainty. Personal entries matching a
maintained event's symbol/date/URL count once. Coverage is limited to those
maintained issuers plus your personal records, not a complete market calendar.
Local read errors, calendar request errors and missing
observations remain explicit. Calendar age is not an exchange-session freshness
check. The brief is neither a stock ranking nor a buy/sell recommendation and
does not demonstrate profitability.
