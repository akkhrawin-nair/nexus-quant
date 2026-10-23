import { useEffect, useState } from 'react'
import { ToolModal } from './ResearchTools'
import { loadOptionPaperJournal } from '../lib/optionPaperJournal'
import { loadOptionComparisons } from '../lib/optionComparison'
import { loadForecastJournal, journalSummary } from '../lib/forecastJournal'
import { getPortfolio, plannedDeadline } from '../utils/paperTradingStorage'
import { loadCatalysts, dailyResearchSummary, dimeEvidence, WORKFLOW_EVENT, catalystStatus } from '../lib/researchWorkflow'
import CatalystJournal from './CatalystJournal'
import { apiRequest } from '../lib/api'

function readLocal() {
  const errors=[],read=(name,fn,fallback)=>{try{return fn(localStorage)}catch(e){errors.push(`${name}: ${e.message}`);return fallback}}
  const options=read('Options journal',loadOptionPaperJournal,{positions:[]}),comparisons=read('Quote comparisons',loadOptionComparisons,{records:[]})
  const forecasts=read('Forecast journal',loadForecastJournal,{records:[]}),catalysts=read('Catalysts',loadCatalysts,{records:[]}),portfolio=getPortfolio()
  if(portfolio.storageError)errors.push(`Share portfolio: ${portfolio.storageError}`)
  return {options,comparisons,forecasts,catalysts,portfolio,errors}
}
export default function DailyResearchBrief({onClose,signals=[]}) {
  const [local,setLocal]=useState(readLocal),[now,setNow]=useState(Date.now)
  const [calendar,setCalendar]=useState({loading:true})
  useEffect(()=>{const controller=new AbortController();apiRequest('/api/research/catalysts/',{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setCalendar({data})}).catch(e=>{if(!controller.signal.aborted)setCalendar({error:e.message})});return()=>controller.abort()},[])
  useEffect(()=>{const update=()=>{setLocal(readLocal());setNow(Date.now())};window.addEventListener('storage',update);window.addEventListener(WORKFLOW_EVENT,update);window.addEventListener('optionPaperJournalUpdated',update);const timer=setInterval(update,30000);return()=>{window.removeEventListener('storage',update);window.removeEventListener(WORKFLOW_EVENT,update);window.removeEventListener('optionPaperJournalUpdated',update);clearInterval(timer)}},[])
  const summary=dailyResearchSummary(signals,local.options.positions,local.catalysts.records,now),evidence=dimeEvidence(local.comparisons.records),forecast=journalSummary(local.forecasts.records)
  const maintained=(calendar.data?.events||[]).filter(event=>event.date>=summary.date&&(Date.parse(event.date)-Date.parse(summary.date))/86400000<=14)
  const personal=summary.upcoming.filter(record=>!maintained.some(event=>event.symbol===record.symbol&&event.date===record.eventDate&&event.url===record.url))
  const dueShares=local.portfolio.positions.filter(p=>{const deadline=plannedDeadline(p,now);return deadline&&['due_today','overdue'].includes(deadline.kind)})
  return <ToolModal title="Daily research brief" onClose={onClose}><p>New York date {summary.date} · generated from loaded daily observations and browser-local records. This is a research checklist, not an investment recommendation or a live broker account report.</p>
    {local.errors.map(error=><p role="alert" className="research-error" key={error}>{error} Counts below exclude the unreadable dataset.</p>)}
    <section aria-label="Daily research summary"><dl className="research-metrics">{[['Observed symbols',summary.observations],['Latest saved session',summary.latestSession||'Unavailable'],['MACD above signal',`${summary.bullish} / ${summary.observations}`],['Options due/overdue records',summary.dueOptions.length],['Share plans due/overdue',dueShares.length],['Sourced catalysts in next 14 days',calendar.data?maintained.length+personal.length:'Issuer calendar unavailable/pending']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {!signals.length&&<p role="alert">No market observations are loaded. Refresh or reload the dashboard before research.</p>}
      {!!summary.staleSymbols.length&&<details><summary>{summary.staleSymbols.length} symbols have observations older than one calendar day, future-dated or missing dates</summary><p>{summary.staleSymbols.join(', ')}. Weekends/holidays can explain age; this is not an exchange-session check.</p></details>}
      <h3>First checks today</h3><ol><li>Review deadlines: options {summary.dueOptions.join(', ')||'none due in readable local records'}; shares {dueShares.map(p=>p.symbol).join(', ')||'none due in readable local records'}. No automatic exits or background alerts.</li><li>Recheck exact-contract bid/ask and fees in Dime. Saved Dime-labelled comparisons: {evidence.comparisons}; reported executions: {evidence.paperReports+evidence.realReports}; independent verification: 0.</li><li>Recheck dated catalyst sources before using a technical scenario. A complete earnings/calendar feed is not connected.</li></ol>
      <h3>Saved forecast evidence</h3><p>{forecast.completed} recorded outcomes. Mean model error {forecast.modelErrorPct===null?'unavailable':`${forecast.modelErrorPct.toFixed(2)}%`}; unchanged-price error {forecast.flatErrorPct===null?'unavailable':`${forecast.flatErrorPct.toFixed(2)}%`}. These are descriptive errors, not trading returns or a profitable edge.</p>
      <h3>Next sourced events · 14 calendar days</h3>
      {calendar.loading&&<p role="status">Loading maintained issuer calendar…</p>}{calendar.error&&<p role="alert">Maintained issuer calendar unavailable: {calendar.error}. Personal records below do not replace missing coverage.</p>}
      {calendar.data&&<p>{calendar.data.coverage} Maintained coverage: {calendar.data.issuers.map(issuer=>`${issuer.symbol}: ${issuer.known_events} listed, reviewed ${issuer.reviewed_at}`).join('; ')}.</p>}
      <ul>{maintained.map(event=><li key={`${event.symbol}:${event.url}:${event.date}`}><a href={event.url} target="_blank" rel="noreferrer">{event.date} · {event.symbol} · {event.title}</a> · maintained issuer source · reviewed {event.reviewed_at}{(Date.parse(summary.date)-Date.parse(event.reviewed_at))/86400000>7?' — recheck overdue review':''}</li>)}{personal.map(event=><li key={event.id}><a href={event.url} target="_blank" rel="noreferrer">{event.eventDate} · {event.symbol} · {event.title}</a> · {catalystStatus(event,now).stale?'source review older than 7 days':'user-recorded link; unverified'}</li>)}</ul>
      {!maintained.length&&!personal.length&&!calendar.loading&&<p>No upcoming events in available records. No complete event coverage is implied.</p>}
    </section><CatalystJournal/>
  </ToolModal>
}
