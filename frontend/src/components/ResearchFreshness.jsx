import { useEffect, useState } from 'react'
import { researchFreshness } from '../lib/researchFreshness'

export default function ResearchFreshness({brief}) {
  const [now,setNow]=useState(Date.now)
  useEffect(()=>{
    const update=()=>setNow(Date.now()), timer=setInterval(update,30000)
    window.addEventListener('focus',update)
    return ()=>{clearInterval(timer);window.removeEventListener('focus',update)}
  },[])
  const state=researchFreshness(brief.as_of,brief.outlook?.end_date,now)
  const text={unknown:'Observation date unavailable — freshness cannot be checked.',
    future:'Future-dated observation — verify the source and clock.',
    current_unconfirmed:'Current-date daily bar — final close is unconfirmed.',
    recent:`Daily history is ${state.ageDays} calendar day(s) old — verify before trading.`,
    older:`Daily history is ${state.ageDays} calendar days old — check for newer observations.`}[state.kind]
  const warning=state.expired || ['unknown','future','older','current_unconfirmed'].includes(state.kind)
  return <aside aria-label="Research data freshness" className={`research-freshness${warning ? ' research-freshness-warning' : ''}`}>
    <strong>{text}</strong>
    <p>{state.expired ? 'The projection window has ended. Refresh prices before using this outlook.' : `Projection ends ${brief.outlook?.end_date || 'on an unknown date'}; its origin remains the saved observation date.`}</p>
    <small>Age uses New York calendar dates, not an exchange calendar. Weekends, holidays and provider delays can explain gaps. Refreshing daily data does not make it a live executable quote.</small>
  </aside>
}
