import { useState } from 'react'
import { optionPaperMarkStatus, optionRemainingContracts } from '../lib/optionPaperJournal'
const usd=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n)
export default function OptionPositionMonitoring({position,now,disabled,onMark}) {
  const [form,setForm]=useState({bid:'',fee:String(position.ticket.fee),quoteTime:'',sourceName:'',termsConfirmed:false})
  const status=optionPaperMarkStatus(position,now),mark=status.mark
  const field=(key,label,props={})=><label>{label}<input required {...props} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>
  return <section aria-label="Paper position monitoring"><h5>Remaining quantity: {optionRemainingContracts(position)} contracts</h5>
    {mark&&<div className="data-quality-notice"><strong>Saved manual bid reference · {status.kind.replaceAll('_',' ')}</strong><p>Source {mark.sourceName} · quoted {new Date(mark.quoteTime).toLocaleString()} · {mark.contracts} contracts at bid ${mark.bid}. Net proceeds reference {usd(mark.proceeds)}; hypothetical unrealized P&amp;L {usd(mark.pnlDollar)}.</p><p>{status.kind==='fresh_reference'?'Timestamp is within 60 seconds; source and execution remain unverified.':'This is a historical snapshot. Re-enter a current quote for the remaining quantity.'} {mark.bid===0&&'Zero bid does not establish an available sale.'} No realized profit, cash or position quantity changes from a mark.</p></div>}
    {!position.outcome&&<details><summary>Save a current bid monitoring snapshot</summary><form aria-label="Save paper monitoring quote" onSubmit={e=>{e.preventDefault();onMark(position.id,form)}}>
      <div className="research-controls">{field('bid','Monitoring option bid ($)',{type:'number',min:'0',step:'any'})}{field('fee','Monitoring exit fee per contract ($)',{type:'number',min:'0',step:'any'})}</div>
      <div className="research-controls">{field('quoteTime','Monitoring source quote time',{type:'datetime-local',step:'1'})}{field('sourceName','Monitoring source name',{maxLength:60})}</div>
      <label className="option-paper-check"><input type="checkbox" required checked={form.termsConfirmed} onChange={e=>setForm({...form,termsConfirmed:e.target.checked})}/>I checked this bid matches the original exact contract and deliverable.</label><button disabled={disabled}>Save monitoring snapshot</button>
    </form></details>}
  </section>
}
