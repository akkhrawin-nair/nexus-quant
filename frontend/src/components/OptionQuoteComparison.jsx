import { useEffect, useMemo, useState } from 'react'
import { marketDate } from '../lib/options'
import { compareOptionSnapshots, saveOptionComparison, loadOptionComparisons, recordBrokerExecution, OPTION_COMPARISONS_KEY } from '../lib/optionComparison'
import './OptionQuoteComparison.css'
import { BrokerOrderTicketFields, BrokerOrderTicketResult } from './BrokerOrderTicket'
import { emptyOrderTicket } from '../lib/brokerTicket'
import { BrokerExecutionReview, BrokerExecutionEvidence } from './BrokerExecutionReview'

const usd=(n,digits=2)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:digits,maximumFractionDigits:digits}).format(n)
const empty=source=>({source,contractSymbol:'',symbol:'',type:'call',strike:'',expiration:'',multiplier:'100',bid:'',ask:'',fee:'0',quoteTime:''})
const names={symbol:'underlying',type:'call/put',strike:'strike',expiration:'expiration',multiplier:'multiplier'}
const readHistory=()=>{try{return {journal:loadOptionComparisons(window.localStorage),error:''}}catch(error){return {journal:null,error:error.message}}}

function SnapshotFields({label,value,change}) {
  const field=(name,title,props={})=><label>{title}<input required {...props} value={value[name]} onChange={event=>change(name,event.target.value)}/></label>
  return <fieldset className="option-snapshot"><legend>{label}</legend>
    <div className="research-controls">{field('source','Quote source name',{maxLength:60})}{field('symbol','Underlying ticker',{maxLength:15})}</div>
    <div className="research-controls">{field('contractSymbol','Exact OCC contract (optional for quote snapshot)',{required:false,maxLength:21,placeholder:'Copy identifier if available'})}</div>
    <div className="research-controls"><label>Option type<select aria-label="Option type" value={value.type} onChange={event=>change('type',event.target.value)}><option value="call">Call</option><option value="put">Put</option></select></label>
      {field('strike','Strike ($)',{type:'number',min:'.0001',step:'any'})}{field('expiration','Expiration (US date)',{type:'date'})}</div>
    <div className="research-controls">{field('bid','Bid — sell reference ($)',{type:'number',min:'0',step:'any'})}{field('ask','Ask — buy reference ($)',{type:'number',min:'.0001',step:'any'})}</div>
    <div className="research-controls">{field('quoteTime','Source quote time',{type:'datetime-local',step:'1'})}{field('multiplier','Contract multiplier',{type:'number',min:'1',max:'10000',step:'1'})}{field('fee','Fee per contract, per side ($)',{type:'number',min:'0',max:'10000',step:'any'})}</div>
  </fieldset>
}

function ComparisonResult({comparison,now,historical=false}) {
  const a=comparison.a,b=comparison.b
  const age=snapshot=>Math.max(0,Math.ceil((now-snapshot.estimate.quoteTime)/1000))
  const contract=snapshot=>`${snapshot.input.symbol} · ${snapshot.input.expiration} · ${snapshot.input.type.toUpperCase()} · ${usd(snapshot.input.strike)} · multiplier ${snapshot.input.multiplier} · identifier: ${snapshot.input.contractSymbol || 'not captured'}`
  const time=snapshot=><time dateTime={snapshot.input.quoteTime} title={snapshot.input.quoteTime}>{new Date(snapshot.input.quoteTime).toLocaleString()} (browser time)</time>
  return <div className="option-comparison-result">
    {historical && <p><strong>Saved historical snapshots — these are not current quotes.</strong></p>}
    <p>Compared {new Date(comparison.comparedAt).toLocaleString()} · {comparison.contracts} contract(s) per snapshot.</p>
    {comparison.mismatches.length ? <p role="alert" className="research-error">Contract terms differ: {comparison.mismatches.map(key=>names[key]).join(', ')}. Combined price/cost differences are blocked.</p> : !comparison.deliverableConfirmed ? <p role="alert" className="research-error">Entered terms match, but deliverable/settlement confirmation is missing. Combined price/cost differences are blocked.</p> : <p>Entered terms match; deliverable/settlement was user-confirmed. Broker contract identity and fills remain unverified.</p>}
    <p>Source times are {comparison.timeGapSeconds.toFixed(1)} seconds apart. {comparison.timeGapSeconds>5 ? 'Over the local 5-second comparison threshold; price changes between snapshots may affect the difference.' : 'Within the local 5-second threshold; this does not establish simultaneous quotes.'} A time gap does not establish why prices differ.</p>
    <div className="research-table-scroll" tabIndex={0} role="region" aria-label="Quote snapshot comparison table"><table>
      <caption>Manual snapshot inputs and estimates · USD · scroll sideways on narrow screens</caption>
      <thead><tr><th scope="col">Reference</th><th scope="col">A · {a.input.source}</th><th scope="col">B · {b.input.source}</th></tr></thead>
      <tbody><tr><th scope="row">Entered contract</th><td>{contract(a)}</td><td>{contract(b)}</td></tr>
        <tr><th scope="row">Source quote time</th><td>{time(a)}</td><td>{time(b)}</td></tr>
        <tr><th scope="row">Age now</th>{[a,b].map((snapshot,i)=><td key={i}>{age(snapshot)}s · {now-snapshot.estimate.quoteTime>60000 ? 'OLD — over 60s' : 'Recent entered time; unverified'}{snapshot.input.expiration<marketDate(now) ? ' · EXPIRED' : ''}</td>)}</tr>
        {[['Bid · sell reference',usd(a.estimate.bid,4),usd(b.estimate.bid,4)],['Ask · buy reference',usd(a.estimate.ask,4),usd(b.estimate.ask,4)],
          ['Fees for quantity · per side',usd(a.estimate.fees),usd(b.estimate.fees)],['Buy cost at ask + fees',usd(a.estimate.buyCost),usd(b.estimate.buyCost)],
          ['Sell proceeds at bid − fees',usd(a.estimate.sellProceeds),usd(b.estimate.sellProceeds)],['Immediate round-trip loss estimate',usd(a.estimate.roundTripLoss),usd(b.estimate.roundTripLoss)]].map(([label,first,second])=><tr key={label}><th scope="row">{label}</th><td>{first}</td><td>{second}</td></tr>)}
      </tbody></table></div>
    {(a.estimate.zeroBid || b.estimate.zeroBid) && <p role="alert" className="research-error">At least one snapshot has a zero bid. A positive-price sale may be unavailable.</p>}
    {comparison.differences && <div className="option-comparison-differences"><h4>Difference · B minus A</h4><dl className="research-metrics">
      {[['Bid premium difference',usd(comparison.differences.bid,4)],['Ask premium difference',usd(comparison.differences.ask,4)],
        ['Buy cost difference · after fees',usd(comparison.differences.buyCost)],['Sell proceeds difference · after fees',usd(comparison.differences.sellProceeds)],
        ['Fee difference · per side',usd(comparison.differences.fees)]].map(([label,amount])=><div key={label}><dt>{label}</dt><dd>{amount}</dd></div>)}</dl>
      <p>Positive buy-cost difference means B costs more under the entered assumptions. Positive sell-proceeds difference means B pays more under those assumptions. This is not a broker ranking or an executable opportunity.</p></div>}
    <p className="option-comparison-note">Prices, timestamps, sources, deliverables, displayed depth and market session are not independently verified. Both bid and ask must come from the same contract and source time within each snapshot. Midpoint/last prices are not substituted. Cost estimates assume fills at the entered bid/ask; actual fills and fees can differ.</p>
    {comparison.orderTicket && <BrokerOrderTicketResult check={comparison.orderTicket} now={now} historical={historical}/>}
  </div>
}

export default function OptionQuoteComparison() {
  const [a,setA]=useState(()=>empty('Dime')), [b,setB]=useState(()=>empty('Webull'))
  const [contracts,setContracts]=useState('1'), [confirmed,setConfirmed]=useState(false)
  const [result,setResult]=useState(null), [error,setError]=useState(''), [message,setMessage]=useState('')
  const [history,setHistory]=useState(readHistory), [now,setNow]=useState(Date.now)
  const [ticketEnabled,setTicketEnabled]=useState(false), [orderTicket,setOrderTicket]=useState(emptyOrderTicket)
  const [showAll,setShowAll]=useState(false)
  useEffect(()=>{
    const listener=event=>{if(event.key===OPTION_COMPARISONS_KEY || event.key===null){setHistory(readHistory());setMessage('')}}
    const timer=setInterval(()=>setNow(Date.now()),10000)
    window.addEventListener('storage',listener)
    return ()=>{clearInterval(timer);window.removeEventListener('storage',listener)}
  },[])
  const reset=()=>{setResult(null);setError('');setMessage('')}
  const change=(setter,key,value)=>{setter(previous=>({...previous,[key]:value}));reset();if(['symbol','type','strike','expiration','multiplier','contractSymbol'].includes(key))setConfirmed(false)}
  const compare=event=>{
    event.preventDefault();setError('');setMessage('')
    try {const time=Date.now();setResult(compareOptionSnapshots(a,b,{contracts,deliverableConfirmed:confirmed,orderTicket:ticketEnabled ? orderTicket : null},time));setNow(time)}catch(failure){setResult(null);setError(failure.message)}
  }
  const save=()=>{
    setError('');setMessage('')
    try {const saved=saveOptionComparison(window.localStorage,result);setHistory({journal:{version:1,records:saved.records},error:''});setMessage(saved.added ? 'Original quote comparison saved in this browser.' : 'These snapshots are already saved; the original comparison was kept.')}catch(failure){setError(failure.message)}
  }
  const addExecution=(id,input)=>{
    const saved=recordBrokerExecution(window.localStorage,id,input)
    setHistory({journal:{version:1,records:saved.records},error:''})
    return saved.added
  }
  const exportHistory=()=>{
    setError('');setMessage('')
    try {
      const raw=window.localStorage.getItem(OPTION_COMPARISONS_KEY)
      if(raw===null)throw new Error('No comparison history is stored yet.')
      const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})), link=document.createElement('a')
      link.href=url;link.download=`kappa-option-comparisons-${new Date().toISOString().slice(0,10)}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
      setMessage('Option comparison backup downloaded.')
    } catch(failure){setError(failure.message)}
  }
  const savedRows=useMemo(()=>history.journal?.records.slice(0,showAll ? undefined : 10).map(record=>({record,comparison:compareOptionSnapshots(record.a,record.b,record,Date.parse(record.comparedAt))})) || [],[history.journal,showAll])
  return <details className="option-quote-comparison"><summary>Compare and save broker quotes</summary>
    <section aria-label="Broker quote comparison">
      <h3>Compare two exact-contract snapshots</h3><p>Copy the bid, ask and source timestamp from Dime/Webull or another source. This free manual tool does not connect to those accounts. Ask is the buy reference; bid is the sell reference.</p>
      <p>Enter source times in your browser timezone: <strong>{Intl.DateTimeFormat().resolvedOptions().timeZone}</strong>. Convert broker-displayed times when needed. Fees default to zero; enter the charges you expect.</p>
      <form onSubmit={compare}>
        <SnapshotFields label="Snapshot A" value={a} change={(key,value)=>change(setA,key,value)}/>
        <button type="button" onClick={()=>{setB(previous=>({...previous,...Object.fromEntries(['symbol','type','strike','expiration','multiplier','contractSymbol'].map(key=>[key,a[key]]))}));setConfirmed(false);reset()}}>Copy A contract terms to B</button>
        <p className="option-comparison-note">Copies ticker, type, strike, expiration, multiplier and the optional identifier. B’s source, prices, fees and timestamp stay separate.</p>
        <SnapshotFields label="Snapshot B" value={b} change={(key,value)=>change(setB,key,value)}/>
        <div className="research-controls"><label>Contracts per snapshot<input required type="number" min="1" max="10000" step="1" value={contracts} onChange={event=>{setContracts(event.target.value);reset()}}/></label></div>
        <label className="option-deliverable-check"><input type="checkbox" checked={confirmed} onChange={event=>{setConfirmed(event.target.checked);reset()}}/>I checked in the broker that the deliverable and settlement terms match, including any contract adjustments.</label>
        <p className="option-comparison-note">Matching the entered fields alone does not verify an exact contract. Verify the actual contract identifiers and deliverables in the broker. Expiration must be within 14 New York calendar days.</p>
        <label className="option-deliverable-check"><input type="checkbox" checked={ticketEnabled} onChange={event=>{setTicketEnabled(event.target.checked);reset()}}/>Include a broker buy-to-open order-ticket check</label>
        {ticketEnabled && <BrokerOrderTicketFields value={orderTicket} change={(key,value)=>{setOrderTicket(previous=>({...previous,[key]:value,...(['symbol','type','strike','expiration','multiplier','contracts','reference','contractSymbol'].includes(key) ? {termsConfirmed:false} : {})}));reset()}}/>}
        <button type="submit">Compare snapshots</button>
      </form>
      {error && <p role="alert" className="research-error">{error}</p>}{message && <p role="status">{message}</p>}
      {result && <section aria-label="Current quote comparison"><ComparisonResult comparison={result} now={now}/><button type="button" disabled={!history.journal} onClick={save}>Save comparison</button></section>}
      <section aria-label="Saved option comparisons"><h3>Saved comparisons · {history.journal?.records.length ?? 'unavailable'}</h3>
        {history.journal && <BrokerExecutionEvidence records={history.journal.records}/>}
        {history.error && <p role="alert" className="research-error">{history.error}</p>}
        <button type="button" disabled={!!history.journal && !history.journal.records.length} onClick={exportHistory}>{history.error ? 'Export preserved comparison data' : 'Export comparison history'}</button>
        <p className="option-comparison-note">Up to 200 records in this browser. Showing the latest {savedRows.length}; export includes all saved comparisons. Export before clearing browser storage. No cloud backup or import is included.</p>
        {history.journal?.records.length>10 && <button type="button" onClick={()=>setShowAll(previous=>!previous)}>{showAll ? 'Show latest 10 comparisons' : 'Show all saved comparisons'}</button>}
        {savedRows.map(({record,comparison})=><details key={record.id} className="option-saved-comparison"><summary>{record.a.source} vs {record.b.source} · {record.a.symbol} · saved {new Date(record.savedAt).toLocaleString()}{record.orderTicket ? ` · ${record.executions?.length || 0} execution report(s)` : ''}</summary>{record.orderTicket && <BrokerExecutionReview record={record} onRecord={addExecution}/>}<ComparisonResult comparison={comparison} now={now} historical/></details>)}
      </section>
    </section>
  </details>
}
