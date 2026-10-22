import { useEffect, useState } from 'react'
import { getPortfolio, plannedDeadline } from '../utils/paperTradingStorage'

const snapshot=()=>({portfolio:getPortfolio(),now:Date.now()})
export default function PaperDeadlineBanner({onReview}) {
  const [state,setState]=useState(snapshot)
  useEffect(()=>{
    const update=()=>setState(snapshot())
    window.addEventListener('paperPortfolioUpdated',update);window.addEventListener('storage',update);window.addEventListener('focus',update)
    const timer=setInterval(update,30000)
    return ()=>{window.removeEventListener('paperPortfolioUpdated',update);window.removeEventListener('storage',update);window.removeEventListener('focus',update);clearInterval(timer)}
  },[])
  const due=state.portfolio.positions.map(position=>({position,deadline:plannedDeadline(position,state.now)}))
    .filter(item=>item.deadline && item.deadline.kind!=='scheduled')
  if (!state.portfolio.storageError && !due.length) return null
  return <section className="paper-deadline-banner" aria-label="Paper trade deadline notices" role="status">
    <strong>{state.portfolio.storageError ? 'Paper portfolio needs attention' : `${due.length} paper position deadline(s) need attention`}</strong>
    {state.portfolio.storageError ? <p>{state.portfolio.storageError}</p> : <ul>{due.slice(0,5).map(({position,deadline})=><li key={position.id}>
      {position.symbol} · exit by {deadline.date} (New York) · {deadline.kind==='overdue' ? 'OVERDUE' : deadline.kind==='due_today' ? 'DUE TODAY' : `${deadline.daysRemaining} calendar day(s) remaining`}
    </li>)}</ul>}
    <button type="button" onClick={onReview}>Review paper positions</button>
    <small>Local reminders while the app is open. No automatic exit or background notification.</small>
  </section>
}
