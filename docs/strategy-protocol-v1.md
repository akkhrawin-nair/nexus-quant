# Fixed stock research protocol v1

This is an unvalidated paper research experiment, not a recommendation to buy.
Version: `confluence-risk-v1`. Do not tune these rules after seeing a result and
describe the new result as an unseen test.

## Rules

- Long shares only, one symbol and at most one position at a time. No options,
  leverage, shorting or portfolio-wide risk simulation. The input supports
  letter-based tickers and single-letter share classes (for example BRK-B);
  this syntax check does not independently verify exchange listing or liquidity.
- Use adjusted daily OHLCV and 50 warmup bars. At the previous close all four
  conditions must hold: MACD(12,26) above its EMA9 signal, close above EMA20,
  EMA20 above EMA50, and volume at least 1.25 times the previous 20 sessions'
  average volume. Missing/nonpositive volume cannot qualify.
- Enter at the next observed open plus configured slippage. This is a continuing
  condition, not a crossover: reentry on a later session is permitted while the
  condition remains true. No same-session reentry after an exit.
- Buy whole shares, rounded down. Spend no more than 20% of current simulated
  equity including entry fees, and size planned loss at the stop (including both
  sides' fees and slippage) to no more than 1% of that equity. Skip a qualifying
  entry session if even one share does not fit. Count these sessions explicitly.
- Stop 7.5% below slipped entry; target 15% above it. Exit next open if the prior
  close no longer qualifies. Stop precedes target if both are touched; an open
  below the stop exits at that open. Gaps can lose more than the planned 1%.
- Exit no later than 14 calendar days from entry. Use the deadline open, or the
  preceding observed close if the next observed session would be too late.
  Missing bars can bias this retrospective schedule. Close any remaining
  position at the sample's final close.
- Fees and slippage are editable research assumptions, applied per side. They
  are not a Dime fee schedule or an executable quote. Uninvested cash earns zero.

## Historical holdout and limits

The Backtest dialog defaults to **Fixed-rule 70/30 historical holdout**. At least
150 unique daily session dates are required. Bars dated today or later in New
York are excluded before splitting. Earlier 70% supplies indicator context only;
later 30% contributes returns. No rule is fitted or selected, and no earlier
position or P&L carries across the split. A prior-close signal may enter at the
first holdout open. Full-sample exploratory and legacy rule-selection modes
remain separate.

Cash earns zero. The whole-share passive reference buys all affordable shares
at the first holdout open and sells at the last close, with the same costs per
side. Its exposure differs and it has no 14-day cap. A predetermined stress case
adds 10 bps to fees and 10 bps to slippage per side, each capped at 100 bps;
sizing and trade outcomes may change. Costs are assumptions, not verified Dime
fees. No annualized return or future win probability is inferred.

Download the evaluation JSON to preserve exact OHLCV inputs, rule version,
parameters, dates, comparisons, trades and SHA256 content fingerprint. This is
a research report, not an authenticated statement or an importable journal.
Future source revisions produce different fingerprints. Nonfinite/unknown
volume is preserved as null and cannot qualify a signal.

Historical holdout does not prove data was genuinely unseen: prices may already
have been inspected. Repeated ticker, window or cost choices can overfit results.
Small samples, adjustments, missing sessions, intraday ambiguity, news/earnings,
liquidity and changing regimes remain limitations. No profitable edge has been
demonstrated. The next evidence step is a complete forward paper signal record.
See the [first four-ticker evaluation](fixed-strategy-holdout-results-2026-10-23.md).
