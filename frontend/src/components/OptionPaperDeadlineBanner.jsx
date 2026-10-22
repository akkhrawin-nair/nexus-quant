import { useEffect, useState } from 'react'
import { loadOptionPaperJournal, optionPaperStatus, OPTION_PAPER_EVENT } from '../lib/optionPaperJournal'

const read=()=>{try{return {journal:loadOptionPaperJournal(window.localStorage),now:Date.now(),error:''}}catch(error){return {journal:null,now:Date.now(),error:error.message}}}
export default function OptionPaperDeadlineBanner({onReview}) {
  const [state,setState]=useState(read)
  useEffect(()=>{
    const update=()=>setState(read()), timer=setInterval(update,30000)
    window.addEventListener(OPTION_PAPER_EVENT,update);window.addEventListener('storage',update);window.addEventListener('focus',update)
    return ()=>{clearInterval(timer);window.removeEventListener(OPTION_PAPER_EVENT,update);window.removeEventListener('storage',update);window.removeEventListener('focus',update)}
  },[])
  const due=(state.journal?.positions || []).map(position=>({position,status:optionPaperStatus(position,state.now)}))
    .filter(({status})=>['expired','overdue','due_today','due_soon'].includes(status.kind))
  if(!state.error && !due.length)return null
  return <section aria-label="Options paper deadline notices" role="status" className="paper-deadline-banner">
    <strong>{state.error ? 'Options paper journal needs attention' : `${due.length} options paper deadline(s) need attention`}</strong>
    {state.error ? <p>{state.error}</p> : <ul>{due.slice(0,5).map(({position,status})=><li key={position.id}>
      {position.ticket.symbol} {position.ticket.type.toUpperCase()} {position.ticket.strike} · expiration {position.ticket.expiration} · planned exit {status.date} (New York) · {status.kind==='expired' ? 'EXPIRED — outcome unrecorded' : status.kind==='overdue' ? 'OVERDUE' : status.kind==='due_today' ? 'DUE TODAY' : `${status.daysRemaining} calendar day(s) remaining`}
    </li>)}</ul>}
    <button type="button" onClick={onReview}>Review options paper positions</button>
    <small>Local reminders while the app is open. No automatic close, expiration pricing or background notification.</small>
  </section>
}
