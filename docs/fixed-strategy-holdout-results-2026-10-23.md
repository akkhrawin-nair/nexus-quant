# Fixed-strategy historical holdout — 2026-10-23

Conclusion: this run does not demonstrate a profitable edge. QQQ and SPY had
small net losses, and EOSE/ONDS produced no trades. The rules were not changed
after observing these results. No real money was traded.

The four tickers and assumptions were declared before this run: QQQ, SPY, EOSE,
ONDS; 1y history; $10,000 starting cash; 10 bps fee and 5 bps slippage per side.
Method `fixed-holdout-v1`, protocol `confluence-risk-v1`. Source metadata reports
Yahoo Finance via yfinance adjusted daily history. This is not independent
broker verification.

Inputs: 251 observations from 2025-10-23 through 2026-10-22. Context-only dates:
2025-10-23 through 2026-07-07. Holdout: 2026-07-08 through 2026-10-22, 76 daily
bars. No current/future-date bars were present to exclude. Cash resets at the
boundary; only later-period trades contribute strategy P&L.

| Ticker | Closed trades | Strategy net return | Net paper P&L | Strategy drawdown | Passive return | Higher-cost strategy return |
|---|---:|---:|---:|---:|---:|---:|
| QQQ | 4 | −0.1253% | −$12.53 | 0.2055% | −0.2603% | −0.2428% |
| SPY | 2 | −0.0553% | −$5.53 | 0.0794% | +2.6498% | −0.1168% |
| EOSE | 0 | 0.0000% | $0.00 | 0.0000% | −63.3937% | 0.0000% |
| ONDS | 0 | 0.0000% | $0.00 | 0.0000% | −17.8814% | 0.0000% |

Cash return was 0% for every ticker. Higher costs were 20 bps fees and 15 bps
slippage per side, with all strategy rules fixed. Drawdown uses daily closing
marks and does not capture all intraday losses. No ticker skipped entry because
one share could not fit the limits; the two zero-trade tickers had no qualifying
entry in this window.

Passive buy-and-hold invests all affordable whole shares and retains leftover
cash, whereas the strategy limits planned stop risk to 1% and position cost to
20% of simulated equity. Passive holding has no 14-day cap. Consequently these
are descriptive references with different exposure, not a controlled risk-matched
comparison. No-trade results are not proof of downside protection or a successful
strategy. Four/two trades are inadequate to infer a reliable win rate or edge.

## Reproducibility

Final reports were generated at approximately 09:23 UTC on 2026-10-23. Each report
contains exact input bars, original parameters, fixed rules, trades, curves and
source metadata. Download JSON through Backtest to preserve the result you see;
subsequent provider data revisions can change it. These IDs identify this run:

| Ticker | Evaluation ID | Input SHA256 |
|---|---|---|
| QQQ | `def831ba2281eecd2769` | `3eec8214dabd9b25a6b766a63ed9e63c7014b405bd023b4e70e0162e141b446c` |
| SPY | `bfd0b3cb2cfe0c9d01bd` | `31b05d7f4fd67ec51f7b32f6fd043e02336045ad339109c569a0f3a9801beda0` |
| EOSE | `b8ad3b8f1c9b05d26f75` | `815d5c39edb1bc299d90e0615420d0f36d90191756be3d354505738136611a20` |
| ONDS | `87a79e509ba7c26f3c34` | `6707e8d46c334e77b4b2cf99431dc20b141fc3fe8d5ceb24483a7bbddfded3fa` |

Session dates in snapshots are canonical YYYY-MM-DD labels, so daylight-saving
offsets do not obstruct replay. A repeat fetch during development returned tiny
earlier-price revisions for QQQ/SPY: hashes changed while strategy returns did
not. This is why the JSON inputs, not just a ticker/period request, are preserved.

These are retrospective later-period checks, not pristine unseen-data or live
forward results. Historical inspection, ticker choice, adjustment revisions,
missing-session scheduling and unverified fills remain biases. Nothing here
establishes a recommendation to buy/short these tickers. A complete forward
paper signal record is the next evidence step.
