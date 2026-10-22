import { loadOptionPaperJournal, optionPaperSummary } from '../lib/optionPaperJournal'
import { marketDate } from '../lib/options'

const usd=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n)

export function BrokerOrderTicketFields({value,change}) {
  const field=(key,label,props={})=><label>{label}<input required {...props} value={value[key]} onChange={event=>change(key,event.target.value)}/></label>
  return <fieldset className="option-snapshot"><legend>Broker buy-to-open order preview</legend>
    <p>Copy the broker preview independently. Long calls/puts, buy-to-open and USD only. Do not enter a sell-to-open, closing or multi-leg order. This tool never submits an order.</p>
    <div className="research-controls">{field('contractSymbol','Broker exact OCC contract',{maxLength:21,placeholder:'e.g. AAPL261030C00250000'})}</div>
    <p className="option-comparison-note">Copied identifier must agree with the fields below. Standard same-root contracts only; adjusted/digit roots and root aliases are unsupported. Parsing does not verify deliverable, multiplier or broker authenticity.</p>
    <div className="research-controls"><label>Reference snapshot<select aria-label="Reference snapshot" value={value.reference} onChange={event=>change('reference',event.target.value)}><option value="a">A</option><option value="b">B</option></select></label>{field('source','Broker preview source',{maxLength:60,placeholder:'e.g. Dime order preview'})}</div>
    <div className="research-controls">{field('symbol','Broker underlying ticker',{maxLength:15})}<label>Broker option type<select aria-label="Broker option type" value={value.type} onChange={event=>change('type',event.target.value)}><option value="call">Call</option><option value="put">Put</option></select></label>{field('strike','Broker strike ($)',{type:'number',min:'.0001',step:'any'})}{field('expiration','Broker expiration (US date)',{type:'date'})}</div>
    <div className="research-controls">{field('contracts','Broker contracts',{type:'number',min:'1',max:'10000',step:'1'})}{field('multiplier','Broker multiplier',{type:'number',min:'1',max:'10000',step:'1'})}{field('limitPrice','Buy limit price per unit ($)',{type:'number',min:'.0001',step:'any'})}</div>
    <div className="research-controls">{field('totalFees','Broker total entry fees ($)',{type:'number',min:'0',max:'100000000',step:'any'})}{field('brokerTotal','Broker displayed total debit ($)',{type:'number',min:'0',max:'1000000000000',step:'.01'})}{field('ticketTime','Broker preview source time',{type:'datetime-local',step:'1'})}</div>
    <div className="research-controls">{field('budget','Order premium budget ($)',{type:'number',min:'0',max:'1000000000',step:'.01'})}{field('plannedExit','Order planned exit (US date)',{type:'date'})}</div>
    <label className="option-deliverable-check"><input type="checkbox" checked={value.termsConfirmed} onChange={event=>change('termsConfirmed',event.target.checked)}/>I checked the exact contract identifier, deliverable, multiplier, buy-to-open action and USD currency in the broker. Fees above are the total for this entry, not per contract.</label>
  </fieldset>
}

export function BrokerOrderTicketResult({check,now,historical=false}) {
  let risk
  try{
    const journal=loadOptionPaperJournal(window.localStorage), committed=optionPaperSummary(journal.positions).openEntryCost
    risk={cap:journal.riskLimit,committed,attention:journal.riskLimit===undefined || Math.round(committed*100)+Math.round(Math.max(check.expectedDebit,check.input.brokerTotal)*100)>Math.round(journal.riskLimit*100)}
  }catch{risk={attention:true,error:true}}
  const old=now-Date.parse(check.input.ticketTime)>60000
  const expired=check.input.expiration<marketDate(now), pastExit=check.input.plannedExit<marketDate(now)
  return <section className="option-snapshot options-review" aria-label="Broker order-ticket check">
    <h4>{historical ? 'Saved historical broker order preview' : 'Broker order-ticket check'}</h4>
    <p><strong>Execution unverified.</strong> This compares entered values. A matched total does not establish a live price, broker permission, fill, permitted price increment or available cash.</p>
    <p>{check.input.source} · buy-to-open {check.input.contracts} {check.input.symbol} {check.input.expiration} {check.input.type.toUpperCase()} {usd(check.input.strike)} · multiplier {check.input.multiplier}. Reference {check.input.reference.toUpperCase()}.</p>
    <p>Captured broker identifier: <strong>{check.input.contractSymbol || 'Not captured in this older record'}</strong>.</p>
    <p>Broker source time: <time dateTime={check.input.ticketTime}>{new Date(check.input.ticketTime).toLocaleString()}</time>. {old ? 'OLD PREVIEW — over 60 seconds.' : 'Recent entered timestamp; source remains unverified.'} {expired && 'EXPIRED CONTRACT.'} {pastExit && 'PLANNED EXIT DATE HAS PASSED.'}</p>
    <dl className="research-metrics">{[['Calculated debit at buy limit',usd(check.expectedDebit)],['Broker displayed debit',usd(check.input.brokerTotal)],['Broker minus calculated debit',usd(check.totalDifference)],['Reference buy cost at ask',usd(check.referenceAskCost)],['Limit cost minus reference ask cost',check.comparable ? usd(check.costDifference) : 'Blocked: terms or quantity differ / unconfirmed'],['Total entry fee difference',check.comparable ? usd(check.feeDifference) : 'Blocked']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <ul>{check.checks.map(original=>{
      const item={...original,attention:original.attention || (original.id==='freshness' && (old || now-Date.parse(check.referenceQuoteTime)>60000)) || (original.id==='exit' && (expired || pastExit))}
      return <li key={item.id} data-status={item.attention ? 'attention' : 'pass'}><strong>{item.label}: {item.attention ? 'Needs attention' : 'Within entered check'}</strong><span>{item.detail}</span></li>
    })}</ul>
    <p role={risk.attention ? 'alert' : undefined} className={risk.attention ? 'research-error' : ''}><strong>Current paper cap check: </strong>{risk.error ? 'Journal unavailable; capacity cannot be checked.' : risk.cap===undefined ? 'Set a combined paper premium cap in the journal below.' : `${usd(risk.committed)} open commitment + ${usd(Math.max(check.expectedDebit,check.input.brokerTotal))} proposed debit versus ${usd(risk.cap)} cap. ${risk.attention ? 'Exceeds cap.' : 'Within entered cap.'}`}</p>
    <p className="option-comparison-note">The current cap comparison is indicative and does not reserve funds. If this ticket is already recorded in the paper journal, its cost is counted again here as a proposed additional entry. Broker cash, market hours, liquidity and actual fees remain unverified. Price differences can reflect different timestamps or order limits.</p>
  </section>
}
