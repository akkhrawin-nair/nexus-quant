import { useEffect, useState } from 'react'
import { marketDate } from '../lib/options'
import { OPTION_PAPER_KEY, OPTION_PAPER_EVENT, loadOptionPaperJournal, openOptionPaperPosition, recordOptionPaperExit, recordOptionPaperMark, optionRemainingContracts, optionPaperStatus, optionPaperSummary, setOptionPaperRiskLimit } from '../lib/optionPaperJournal'
import OptionPositionMonitoring from './OptionPositionMonitoring'
import './OptionPaperJournal.css'
import OptionPaperReview from './OptionPaperReview'
import OptionPaperRestore from './OptionPaperRestore'

const usd=(amount,digits=2)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:digits}).format(amount)
const read=()=>{try{return {journal:loadOptionPaperJournal(window.localStorage),error:''}}catch(error){return {journal:null,error:error.message}}}

function RiskLimitForm({limit,committed,disabled,onSave}) {
  const [value,setValue]=useState(limit===undefined ? '' : String(limit))
  const remaining=limit===undefined ? null : Math.round((limit-committed)*100)/100
  return <form className="option-paper-entry" aria-label="Combined options paper risk limit" onSubmit={event=>{event.preventDefault();onSave(value)}}>
    <h4>Combined paper premium limit</h4>
    <p>Counts allocated entry cost plus buy fees for the remaining contracts in every open options record, including expired records without an outcome.</p>
    <dl className="research-metrics">{[['Saved limit',limit===undefined ? 'Not set' : usd(limit)],['Open commitment',usd(committed)],['Remaining capacity',remaining===null ? 'Set your limit first' : usd(Math.max(0,remaining))]].map(([label,amount])=><div key={label}><dt>{label}</dt><dd>{amount}</dd></div>)}</dl>
    {remaining!==null && remaining<0 && <p role="alert" className="research-error">Open commitment exceeds your saved limit by {usd(-remaining)}. Existing records are preserved; new entries are blocked.</p>}
    <label>Total open paper premium cap ($)<input required type="number" min="0" max="1000000000" step=".01" value={value} onChange={event=>setValue(event.target.value)}/></label>
    <button type="submit" disabled={disabled}>Save combined paper limit</button>
    <p className="option-paper-note">You choose this cap; it is not a suggested allocation. Zero blocks new entries. Paper exits release only the allocated entry commitment of the exited quantity. Losses do not reduce this cap automatically. This is a browser-local exposure guard, not an account balance, cash reservation or limit on actual losses and costs.</p>
  </form>
}

function OpenTicketForm({ticket,now,disabled,riskLimit,committed,onOpen}) {
  const [sourceName,setSourceName]=useState(''), [confirmed,setConfirmed]=useState(false)
  const stale=now-ticket.estimate.quoteTime>60000, oldDay=ticket.estimate.entryDate!==marketDate(now)
  const exceeds=riskLimit!==undefined && Math.round(committed*100)+Math.round(ticket.estimate.buyCost*100)>Math.round(riskLimit*100)
  return <form className="option-paper-entry" aria-label="Open options paper ticket" onSubmit={event=>{event.preventDefault();onOpen({sourceName,termsConfirmed:confirmed})}}>
    <h4>Save the calculated long-option ticket</h4>
    <p>{ticket.estimate.symbol} · {ticket.estimate.type.toUpperCase()} · strike {usd(ticket.estimate.strike,4)} · expires {ticket.estimate.expiration} · {ticket.estimate.contracts} contract(s).</p>
    <p>Assumed ask-based entry cost, including entered buy fees: <strong>{usd(ticket.estimate.buyCost)}</strong>.</p>
    {ticket.quote ? <p>Entry quote source: Alpaca OPRA snapshot. Broker fill and deliverable remain unverified.</p> : <label>Entry quote source<input required maxLength={60} placeholder="e.g. Dime, manually copied" value={sourceName} onChange={event=>setSourceName(event.target.value)}/></label>}
    <label className="option-paper-check"><input required type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>I checked the contract, deliverable and multiplier in my broker and understand this records an assumed paper entry.</label>
    {(stale || oldDay) && <p role="alert" className="research-error">{oldDay ? 'Recalculate the ticket for today’s New York date.' : 'The entry quote is over 60 seconds old. Update its source quote and recalculate before opening.'}</p>}
    {(riskLimit===undefined || exceeds) && <p role="alert" className="research-error">{riskLimit===undefined ? 'Set your combined paper premium limit before opening a position.' : 'This ticket would exceed your combined paper premium limit.'}</p>}
    <button type="submit" disabled={disabled || stale || oldDay || riskLimit===undefined || exceeds}>Open options paper position</button>
    <p className="option-paper-note">Freshness, budget, spread threshold, dates and a supplied ask size must pass the entered checks. Unknown broker/source details remain unverified. Both the ticket premium budget and saved combined paper limit apply; this journal does not reserve account cash.</p>
  </form>
}

function PositionCard({position,now,disabled,onExit,onMark}) {
  const [form,setForm]=useState({kind:'bid_reference',contracts:String(optionRemainingContracts(position)),bid:'',fee:String(position.ticket.fee),quoteTime:'',sourceName:'',termsConfirmed:false,zeroRecoveryConfirmed:false,note:''})
  const change=(key,value)=>setForm(previous=>({...previous,[key]:value,...(key==='kind' ? {termsConfirmed:false,zeroRecoveryConfirmed:false} : {})}))
  const field=(key,label,props={})=><label>{label}<input required {...props} value={form[key]} onChange={event=>change(key,event.target.value)}/></label>
  const state=optionPaperStatus(position,now), ticket=position.ticket, outcome=position.outcome
  const status={closed:'Outcome recorded',expired:'EXPIRED — no outcome recorded',overdue:'OVERDUE — planned exit date passed',due_today:'DUE TODAY',due_soon:`DUE SOON — ${state.daysRemaining} calendar day(s)`,open:`Open — ${state.daysRemaining} calendar day(s) until planned exit`}[state.kind]
  return <article className="option-paper-card" aria-label={`${ticket.symbol} ${ticket.type} paper position`}>
    <h4>{ticket.symbol} · {ticket.type.toUpperCase()} · strike {usd(ticket.strike,4)} · expires {ticket.expiration}</h4>
    <p role={['expired','overdue'].includes(state.kind) ? 'alert' : undefined} className={['expired','overdue'].includes(state.kind) ? 'research-error' : ''}><strong>{status}</strong></p>
    <dl className="research-metrics">{[['Contracts / multiplier',`${ticket.contracts} / ${ticket.multiplier}`],['Original entry ask',usd(ticket.ask,4)],['Entry cost + buy fees',usd(position.entryCost)],
      ['Buy fees paid in simulation',usd(position.entryFees)],['Planned exit (New York)',ticket.plannedExit],['Latest allowed date',position.deadline]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className="option-paper-note">Opened {new Date(position.openedAt).toLocaleString()} · source: {position.source.name} · source quote <time dateTime={ticket.quoteTime}>{new Date(ticket.quoteTime).toLocaleString()}</time>. Times display in your browser timezone. Original contract and entry assumptions are preserved.</p>
    {outcome ? <div className="option-paper-outcome" role="status"><strong>Net paper P&amp;L: {usd(outcome.pnlDollar)} · {outcome.returnPct.toFixed(2)}%</strong>
      <p>{outcome.kind==='exit_series' ? `All contracts covered by recorded paper exits; ${outcome.zeroRecoveryContracts} under zero-recovery assumptions. Net proceeds ${usd(outcome.proceeds)}. No sale or settlement is verified.` : outcome.kind==='zero_recovery' ? 'Zero-recovery assumption — no sale or settlement was verified.' : `Assumed exit option bid ${usd(outcome.bid,4)} · ${usd(outcome.fee)} fee per contract · net proceeds ${usd(outcome.proceeds)}.`}</p>
      <p>Recorded {new Date(outcome.recordedAt).toLocaleString()}. {outcome.quoteTime && <>Source quote / simulated exit time: {new Date(outcome.quoteTime).toLocaleString()} · {outcome.sourceName}.</>}</p>
      <p>{outcome.exitDateMissed ? 'The entered outcome date missed the planned exit date.' : 'The entered outcome date was within the planned date.'} {outcome.afterExpiration && 'This outcome assumption was recorded after expiration.'} Market hours and broker cutoffs remain unverified.</p>
      {outcome.note && <p>Note: {outcome.note}</p>}
    </div> : <details className="option-paper-exit"><summary>Record full or partial paper outcome</summary>
      <form onSubmit={event=>{event.preventDefault();onExit(position.id,form)}}>
        {field('contracts','Contracts to exit',{type:'number',min:'1',max:optionRemainingContracts(position),step:'1'})}
        <label>Outcome method<select aria-label="Outcome method" value={form.kind} onChange={event=>change('kind',event.target.value)}><option value="bid_reference">Assumed sale at an entered option bid</option><option value="zero_recovery">Zero-recovery assumption — no sale recorded</option></select></label>
        {form.kind==='bid_reference' ? <><div className="research-controls">{field('bid','Exit option bid per unit ($)',{type:'number',min:'.0001',max:'1000000',step:'any'})}{field('fee','Exit fee per contract ($)',{type:'number',min:'0',max:'10000',step:'any'})}</div>
          <div className="research-controls">{field('quoteTime','Exit source quote time',{type:'datetime-local',step:'1'})}{field('sourceName','Exit quote source',{maxLength:60,placeholder:'e.g. Webull, manually copied'})}</div>
          <label className="option-paper-check"><input required type="checkbox" checked={form.termsConfirmed} onChange={event=>change('termsConfirmed',event.target.checked)}/>I checked this bid belongs to the original exact contract and deliverable.</label>
          <p className="option-paper-note">The entered source timestamp is the simulated exit time. It must be after entry and on/before expiration; an older historical quote can be recorded later, with both times preserved. Quote freshness and execution are unverified. Only the entered whole-contract quantity is closed; the remaining quantity keeps its deadline.</p>
        </> : <><label className="option-paper-check"><input required type="checkbox" checked={form.zeroRecoveryConfirmed} onChange={event=>change('zeroRecoveryConfirmed',event.target.checked)}/>I explicitly assume zero recovery for this paper outcome; this is not a verified sale, exercise or settlement.</label><p className="option-paper-note">No sale proceeds or exit trading fee are assumed. Check actual broker treatment separately.</p></>}
        <label>Outcome note<input required={form.kind==='zero_recovery'} maxLength={300} value={form.note} onChange={event=>change('note',event.target.value)}/></label>
        <button type="submit" disabled={disabled}>Record options paper outcome</button>
      </form>
    </details>}
    {!!position.exits?.length&&<div className="research-table-scroll"><table><caption>Preserved partial paper exits</caption><thead><tr><th>Quantity</th><th>Method / source time</th><th>Allocated entry cost</th><th>Net paper P&amp;L</th></tr></thead><tbody>{position.exits.map(exit=><tr key={exit.id}><td>{exit.contracts}</td><td>{exit.outcome.kind} · {new Date(exit.outcome.assumedExitAt).toLocaleString()}</td><td>{usd(exit.entryCost)}</td><td>{usd(exit.outcome.pnlDollar)}</td></tr>)}</tbody></table></div>}
    <OptionPositionMonitoring position={position} now={now} disabled={disabled} onMark={onMark}/>
  </article>
}

export default function OptionPaperJournal({ticket}) {
  const [state,setState]=useState(read), [now,setNow]=useState(Date.now), [message,setMessage]=useState(''), [error,setError]=useState('')
  useEffect(()=>{
    const update=()=>{setState(read());setNow(Date.now())}
    window.addEventListener(OPTION_PAPER_EVENT,update);window.addEventListener('storage',update);window.addEventListener('focus',update)
    const timer=setInterval(()=>setNow(Date.now()),10000)
    return ()=>{window.removeEventListener(OPTION_PAPER_EVENT,update);window.removeEventListener('storage',update);window.removeEventListener('focus',update);clearInterval(timer)}
  },[])
  const operate=(operation,success)=>{
    setMessage('');setError('')
    try{const next=operation();setState({journal:{version:1,positions:next.positions,...(next.riskLimit===undefined ? {} : {riskLimit:next.riskLimit})},error:''});setNow(Date.now());setMessage(success || ('added' in next ? (next.added ? 'Options paper position saved with the original entry assumptions.' : 'This original ticket already has a paper record; no duplicate was opened.') : 'Options paper outcome recorded. Original entry assumptions were kept.'))}
    catch(failure){setError(failure.message)}
  }
  const exportJournal=()=>{
    setError('');setMessage('')
    try{const raw=window.localStorage.getItem(OPTION_PAPER_KEY);if(raw===null)throw new Error('There is no options paper journal to export yet.')
      const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})), link=document.createElement('a')
      link.href=url;link.download=`kappa-options-paper-journal-${new Date().toISOString().slice(0,10)}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Options paper journal backup downloaded.')
    }catch(failure){setError(failure.message)}
  }
  const positions=state.journal?.positions || [], summary=optionPaperSummary(positions)
  const shown=[...positions.filter(p=>!p.outcome),...positions.filter(p=>p.outcome).slice(0,20)]
  return <section aria-label="Options paper journal" className="option-paper-journal">
    <h3>Options paper-position journal</h3><p>Long calls/puts only. Save a calculated ticket as an ask-based paper entry, then record an exit option bid or an explicit outcome assumption. These are simulations; no broker order is sent.</p>
    {(state.error || error) && <p role="alert" className="research-error">{state.error || error}</p>}{message && <p role="status">{message}</p>}
    {state.journal && <dl className="research-metrics">{[['Open records',summary.open],['Closed records',summary.closed],['Open entry cost',usd(summary.openEntryCost)],['Recorded net paper P&L',usd(summary.realizedPnl)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    <button type="button" disabled={!!state.journal && !positions.length} onClick={exportJournal}>{state.error ? 'Export preserved options journal' : 'Export options journal'}</button>
    <OptionPaperRestore onRestored={()=>{setState(read());setNow(Date.now());setError('');setMessage('')}}/>
    {state.journal && <OptionPaperReview positions={positions} now={now}/>}
    <RiskLimitForm key={String(state.journal?.riskLimit)} limit={state.journal?.riskLimit} committed={summary.openEntryCost} disabled={!state.journal} onSave={value=>operate(()=>setOptionPaperRiskLimit(window.localStorage,value),'Combined paper premium limit saved.')}/>
    {ticket ? <OpenTicketForm key={JSON.stringify(ticket.plan)+(ticket.quote?.contract||'manual')} ticket={ticket} now={now} disabled={!state.journal} riskLimit={state.journal?.riskLimit} committed={summary.openEntryCost} onOpen={confirmation=>operate(()=>openOptionPaperPosition(window.localStorage,ticket,confirmation))}/> : <p>Calculate a ticket in Plan an option to open a new paper position. Existing records remain below.</p>}
    {!positions.length && state.journal && <p>No options paper positions recorded yet.</p>}
    {shown.map(position=><PositionCard key={`${position.id}:${optionRemainingContracts(position)}`} position={position} now={now} disabled={!state.journal} onExit={(id,input)=>operate(()=>recordOptionPaperExit(window.localStorage,id,input))} onMark={(id,input)=>operate(()=>recordOptionPaperMark(window.localStorage,id,input),'Monitoring snapshot saved; position quantity and realized P&L were not changed.')}/>)}
    <details className="option-paper-limits"><summary>Journal method and limits</summary><p>Buy cost = ask × contracts × multiplier + buy fees. Exit proceeds = entered bid × contracts × multiplier − exit fees. P&amp;L = net exit proceeds − original entry cost. Return is P&amp;L divided by entry cost. Fees default from the ticket but can be changed for exit. FX, taxes, exercise/assignment costs and extra slippage are not modeled.</p>
      <p>Expiration must be within 14 calendar days of entry. The planned exit must be no later than expiration or 14 days after entry, using New York dates. Notices refresh while the app is open. No automatic exit, background notification, contract settlement or expired-option pricing runs. Expired records stay open until an explicit outcome is recorded. Date checks do not verify market hours or broker cutoff times.</p>
      <p>Source names, deliverables and manually entered prices remain unverified. A positive entered bid is a reference, not a guaranteed fill. A zero-recovery assumption records no sale and cannot establish the actual economic outcome of an expired contract.</p>
      <p>Browser-local storage: up to 200 total records, all open positions and the latest 20 outcomes shown. JSON export includes every record, partial exit and monitoring snapshot. Export before clearing storage; local JSON restoration is available, and there is no cloud backup. New entries must fit both the per-ticket budget and your combined paper premium limit. Remaining contracts count their allocated original entry cost until explicitly exited, including expired contracts. Original costs are allocated cumulatively to cents, so entry fees are never counted twice. This does not reserve account cash. Monitoring marks do not change realized P&amp;L. Records can be edited using browser tools and are not independently audited.</p>
    </details>
  </section>
}
