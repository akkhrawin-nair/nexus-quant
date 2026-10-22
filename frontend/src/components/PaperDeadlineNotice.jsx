import { plannedDeadline } from '../utils/paperTradingStorage'

export default function PaperDeadlineNotice({position,now}) {
  const deadline=plannedDeadline(position,now)
  if (!deadline) return <span>No saved deadline</span>
  const text={overdue:'OVERDUE — record an exit or review now',due_today:'DUE TODAY — exit before your broker’s cutoff',
    due_soon:`DUE SOON — ${deadline.daysRemaining} calendar day(s) remaining`,scheduled:`${deadline.daysRemaining} calendar day(s) remaining`}[deadline.kind]
  return <span className={deadline.kind==='overdue' ? 'research-error' : ''} role={deadline.kind==='overdue' ? 'alert' : undefined}>
    Exit by {deadline.date} (New York) · {text}
  </span>
}
