import { useState } from 'react'
import { IndicatorTool } from './ResearchTools'
export default function TwoWeekSwingStation({ initialSymbol = 'QQQ' }) {
  const [open, setOpen] = useState(false)
  return <section><h2>Historical indicator research</h2><p>No validated two-week forecast model is connected.</p><button onClick={() => setOpen(true)}>Inspect indicators</button>{open && <IndicatorTool initialSymbol={initialSymbol} onClose={() => setOpen(false)}/>}</section>
}
