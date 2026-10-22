import { optionPaperReview } from '../lib/optionPaperJournal'

const usd=value=>value===null ? 'Not available' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value)
const percent=value=>value===null ? 'Not available' : `${value.toFixed(2)}%`

export default function OptionPaperReview({positions,now}) {
  const review=optionPaperReview(positions,now)
  const metrics=[['Recorded outcomes',review.closed],['Net paper P&L after fees',usd(review.netPnl)],
    ['Wins / losses / breakeven',`${review.wins} / ${review.losses} / ${review.breakeven}`],
    ['Win rate of recorded outcomes',percent(review.winRatePct)],['Average net P&L per outcome',usd(review.averagePnl)],
    ['Closed-record entry cost',usd(review.closedEntryCost)],['Return on closed-record entry cost',percent(review.returnOnClosedEntryPct)],
    ['Modeled fees on closed records',usd(review.closedFees)]]
  return <section className="option-paper-card" aria-label="Options paper outcome review">
    <h4>Review your recorded outcomes</h4>
    <p>Sample: <strong>{review.closed} recorded outcome(s)</strong> from all saved records, including those beyond the latest 20 cards below. Open positions are excluded from performance results.</p>
    {!review.closed && <p>No outcomes recorded yet. Percentage and average results will appear after you record an outcome.</p>}
    <dl className="research-metrics">{metrics.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p><strong>Outcome sources:</strong> {review.bidReferences} assumed bid-reference exit(s); {review.zeroRecovery} explicit zero-recovery assumption(s). Both are included in the totals above. None are verified broker fills or settlement results.</p>
    <p><strong>Recorded deadline checks:</strong> {review.missedPlannedExit} / {review.closed} missed their planned exit date; {review.missedDeadline} / {review.closed} exceeded the latest allowed date. These counts can overlap. They use the assumed exit date, not the date a historical quote was recorded.</p>
    <p><strong>Open records needing review:</strong> {review.openPastPlannedExit} past their planned exit date; {review.openExpired} past expiration. These counts can overlap and are not assigned a profit or loss.</p>
    <details className="option-paper-limits"><summary>How to read these results</summary>
      <p>Win rate = positive net outcomes divided by all recorded outcomes, including losses and breakeven. Average = total net paper P&amp;L divided by the number of recorded outcomes. Return = total net paper P&amp;L divided by the summed original entry costs of closed records. This is not an account return or an annualized return.</p>
      <p>Net results already subtract entered buy and exit fees; the fee total is shown for review and must not be subtracted again. Zero-recovery assumptions include original buy fees and no exit trading fee. FX, taxes, exercise costs and additional execution costs are not modeled.</p>
      <p>This is a descriptive, user-selected sample of paper assumptions. A small sample can change sharply with one outcome. These results do not establish a profitable strategy or predict future performance. Review contract terms and actual broker outcomes separately.</p>
    </details>
  </section>
}
