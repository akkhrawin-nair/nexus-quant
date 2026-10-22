import { useState } from 'react'
import { reconcileBrokerExecutions, brokerExecutionSummary } from '../lib/brokerExecutions'

const usd=(value,digits=2)=>value===null ? 'Not available' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:digits}).format(value)

export function BrokerExecutionEvidence({records}) {
  const summary=brokerExecutionSummary(records)
  return <section className="option-snapshot" aria-label="Broker execution evidence summary">
    <h3>Execution evidence</h3>
    <p>Record individual buy-to-open executions against a saved comparison with an order ticket. Existing confirmations or broker-paper reports can be used; no new trade is required.</p>
    <dl className="research-metrics">{[['Orders with reports',summary.ordersWithReports],['Individual execution reports',summary.executionReports],['User-reported real orders',summary.reportedRealOrders],['Broker-paper orders',summary.brokerPaperOrders],['Full quantity reported',summary.fullyReported],['Partial quantity reported',summary.partial],['Orders with review flags',summary.withDiscrepancies],['Independently verified orders',summary.independentlyVerified]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className="option-comparison-note">Counts cover every saved comparison, including older records beyond the latest 10 shown. Real and broker-paper orders are counted separately. These are user-reported records, not authenticated broker data. No sample size automatically establishes trading readiness, execution quality or a profitable strategy.</p>
  </section>
}

export function BrokerExecutionReview({record,onRecord}) {
  const review=reconcileBrokerExecutions(record), ticket=record.orderTicket
  const [form,setForm]=useState({executionRef:'',source:'',contractSymbol:'',environment:review.environment || '',contracts:'',price:'',totalFees:'',brokerDebit:'',executedAt:'',termsConfirmed:false,note:''})
  const [error,setError]=useState(''), [message,setMessage]=useState('')
  const environment=review.environment || form.environment
  const change=(key,value)=>{setForm(previous=>({...previous,[key]:value,...(key==='contractSymbol' ? {termsConfirmed:false} : {})}));setError('');setMessage('')}
  const field=(key,label,props={})=><label>{label}<input required {...props} value={form[key]} onChange={event=>change(key,event.target.value)}/></label>
  const submit=event=>{
    event.preventDefault();setError('');setMessage('')
    try{
      const added=onRecord(record.id,{...form,environment})
      setMessage(added ? 'Execution report saved. Original quote and order preview were preserved.' : 'This execution label is already recorded with identical inputs; no duplicate was added.')
      if(added)setForm(previous=>({...previous,executionRef:'',contractSymbol:'',contracts:'',price:'',totalFees:'',brokerDebit:'',executedAt:'',termsConfirmed:false,note:''}))
    }catch(failure){setError(failure.message)}
  }
  return <section className="option-snapshot" aria-label="Broker execution reconciliation">
    <h4>Reported executions against this order preview</h4>
    <p><strong>User-reported, not broker-verified.</strong> Buy-to-open {ticket.contracts} {ticket.symbol} {ticket.expiration} {ticket.type.toUpperCase()} {usd(ticket.strike,4)} · multiplier {ticket.multiplier} · original limit {usd(ticket.limitPrice,4)}.</p>
    <p>Saved preview identifier: {ticket.contractSymbol || 'Not captured in this older preview; recheck the broker contract independently.'}</p>
    <p>Status of submitted reports: <strong>{review.status==='fully_reported' ? 'Full order quantity reported' : review.status==='partial' ? 'Partial quantity reported' : 'No executions reported'}</strong>. This does not establish whether a broker order is working, canceled or completed.</p>
    <dl className="research-metrics">{[['Reported filled contracts',review.filledContracts],['Contracts not covered by reports',review.remainingContracts],['Weighted reported fill price',usd(review.weightedPrice,4)],['Reported execution fees',usd(review.totalFees)],['Calculated debit for reported fills',usd(review.calculatedDebit)],['Broker-reported debit for these fills',usd(review.reportedDebit)],['Difference from limit estimate for filled quantity',usd(review.limitCostDifference)],['Difference from reference ask for filled quantity',usd(review.referenceCostDifference)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {!!review.reports.length && <p role={review.debitMismatches || review.limitPriceBreaches || review.afterPlannedExit ? 'alert' : undefined}>Review flags: {review.debitMismatches} debit discrepancy report(s), {review.limitPriceBreaches} execution average(s) above the saved buy limit, {review.afterPlannedExit} execution(s) after the planned exit date. Adverse reports are preserved for review, not silently discarded.</p>}
    <p className="option-comparison-note">Differences use only reported filled quantity. Original estimated total fees are allocated pro rata; entered execution fees replace that estimate. Weighted price weights each execution by its quantity. A positive cost difference means the calculated debit is higher than the reference. Different timestamps, limits and fee allocation can explain differences; this is not a measured broker slippage guarantee or trade P&amp;L. Unreported quantity is never treated as purchased.</p>
    {error && <p role="alert" className="research-error">{error}</p>}{message && <p role="status">{message}</p>}
    {review.remainingContracts>0 && <details className="option-saved-comparison"><summary>Add an individual execution report</summary>
      <form aria-label="Record individual broker execution" onSubmit={submit}>
        <p>Enter one individual execution, not the order's cumulative filled quantity or running average. Use a unique local label to avoid counting the same execution twice. Do not enter account numbers or credentials.</p>
        <div className="research-controls">{field('contractSymbol','Execution exact OCC contract',{maxLength:21,placeholder:'Copy from the execution report'})}</div>
        <div className="research-controls">{field('executionRef','Execution label (unique within this order)',{maxLength:60,placeholder:'e.g. fill-1'})}{field('source','Execution source',{maxLength:60,placeholder:'e.g. Dime execution history'})}
          <label>Execution environment<select required aria-label="Execution environment" value={environment} disabled={!!review.environment} onChange={event=>change('environment',event.target.value)}><option value="">Choose source environment</option><option value="broker_paper">Broker paper execution</option><option value="reported_real">User-reported real execution</option></select></label></div>
        <div className="research-controls">{field('contracts','Contracts in this execution only',{type:'number',min:'1',max:ticket.contracts,step:'1'})}{field('price','Average fill price for this execution ($)',{type:'number',min:'.0001',max:'1000000',step:'any'})}{field('executedAt','Execution source time',{type:'datetime-local',step:'1'})}</div>
        <div className="research-controls">{field('totalFees','Total fees for this execution ($)',{type:'number',min:'0',max:'100000000',step:'any'})}{field('brokerDebit','Broker debit for this execution ($)',{type:'number',min:'0',max:'1000000000000',step:'.01'})}</div>
        <label className="option-deliverable-check"><input required type="checkbox" checked={form.termsConfirmed} onChange={event=>change('termsConfirmed',event.target.checked)}/>I checked this individual execution belongs to the saved buy-to-open order, exact contract and deliverable, with USD prices and fees.</label>
        <label>Execution note (optional)<input maxLength={300} value={form.note} onChange={event=>change('note',event.target.value)}/></label>
        <p className="option-comparison-note">Times use your browser timezone. Historical pre-expiration executions can be recorded later; both source and recording times are preserved. A source time up to 5 seconds ahead is allowed for clock tolerance. Fees must apply to this execution only. If the broker only shows a cumulative total, obtain its individual execution details before adding a report.</p>
        <button type="submit">Save execution report</button>
      </form>
    </details>}
    {!!review.reports.length && <div className="research-table-scroll" tabIndex={0} role="region" aria-label="Reported broker executions table"><table>
      <caption>Immutable individual execution reports · USD · scroll sideways on narrow screens</caption>
      <thead><tr>{['Execution','Source / environment','Executed / recorded (browser time)','Contracts','Average price','Fees','Calculated / reported debit','Debit difference','Review flags'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{review.reports.map(report=><tr key={report.id}><th scope="row">{report.input.executionRef}<br/>{report.input.contractSymbol || 'Identifier not captured'}</th><td>{report.input.source}<br/>{report.input.environment==='broker_paper' ? 'Broker paper' : 'User-reported real'}{report.input.note && <p>{report.input.note}</p>}</td><td><time dateTime={report.input.executedAt}>{new Date(report.input.executedAt).toLocaleString()}</time><br/><time dateTime={report.recordedAt}>{new Date(report.recordedAt).toLocaleString()}</time></td><td>{report.input.contracts}</td><td>{usd(report.input.price,4)}</td><td>{usd(report.input.totalFees,4)}</td><td>{usd(report.calculatedDebit)} / {usd(report.input.brokerDebit)}</td><td>{usd(report.debitDifference)}</td><td>{report.limitPriceBreach ? 'Average above saved limit. ' : ''}{report.afterPlannedExit ? 'After planned exit date. ' : ''}{report.debitDifference!==0 ? 'Debit discrepancy.' : ''}{!report.limitPriceBreach && !report.afterPlannedExit && report.debitDifference===0 ? 'No entered discrepancy; unverified.' : ''}</td></tr>)}</tbody>
    </table></div>}
    <p className="option-comparison-note">Up to 100 reports per order, within the original order quantity. Execution labels are immutable: identical re-entry is skipped and conflicting reuse is rejected. Reported-real and broker-paper reports cannot be mixed on one record. These entries do not alter paper cash, reserve broker cash, monitor holdings, or record an exit.</p>
  </section>
}
