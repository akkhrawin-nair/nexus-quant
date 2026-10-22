import { useEffect, useState } from 'react'
import { FORECAST_JOURNAL_KEY, loadForecastJournal, saveForecast, checkForecasts, forecastStatus, journalSummary } from '../lib/forecastJournal'

const money = amount => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:4}).format(amount)
const percent = amount => `${amount.toFixed(2)}%`
function readJournal() {
  try { return {journal:loadForecastJournal(window.localStorage),error:''} }
  catch (error) { return {journal:null,error:error.message} }
}

export default function ForecastJournal({brief}) {
  const [state,setState] = useState(readJournal)
  const [message,setMessage] = useState(''), [operationError,setOperationError] = useState('')
  const [now,setNow] = useState(Date.now)
  useEffect(()=>{
    const listener = event => {
      if (event.key === FORECAST_JOURNAL_KEY || event.key === null) {setState(readJournal());setMessage('')}
    }
    window.addEventListener('storage',listener)
    const timer=setInterval(()=>setNow(Date.now()),30000)
    return ()=>{window.removeEventListener('storage',listener);clearInterval(timer)}
  },[])
  const records=state.journal?.records.filter(record=>record.symbol===brief.symbol) || []
  const summary=journalSummary(records)
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now))
  const saved=records.some(record=>record.anchorDate===brief.outlook.anchor_date && record.modelVersion===(brief.outlook.model_version || 'damped-logtrend-v1'))
  const action = operation => {
    setMessage('');setOperationError('')
    try {
      const result=operation(window.localStorage)
      setState({journal:{version:1,records:result.records},error:''});setNow(Date.now())
      if ('added' in result) setMessage(result.added ? 'Original forecast saved in this browser.' : 'Already saved. The original projection was kept.')
      else setMessage(result.updated ? `${result.updated} result(s) recorded. Original projections were kept.` : 'No new completed results. Check the row status and sync/reload market data when needed.')
    } catch(error) {setOperationError(error.message)}
  }
  const exportJournal = () => {
    setOperationError('')
    try {
      const raw=window.localStorage.getItem(FORECAST_JOURNAL_KEY)
      if (raw === null) throw new Error('There are no stored forecasts to export.')
      const blob=new Blob([raw],{type:'application/json'})
      const url=URL.createObjectURL(blob), anchor=document.createElement('a')
      anchor.href=url;anchor.download=`kappa-forecast-journal-${new Date().toISOString().slice(0,10)}.json`
      document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
      setMessage('Journal export downloaded. It contains all tickers saved in this browser.')
    } catch(error) {setOperationError(error.message)}
  }
  const statusText = record => ({completed:'Result recorded',pending:'Waiting for target date to finish',
    missing:'Matching close unavailable — sync/reload data',other_ticker:'Open this ticker to check',ready:'Ready — check loaded data'})[forecastStatus(record,brief,now)]
  return <section aria-label="Forecast journal" className="analyst-journal">
    <h3>Forecast journal · {brief.symbol}</h3>
    <p>Save the original forecast before its deadline, then check it against the actual daily close. Updating the outlook does not replace a saved prediction.</p>
    <div className="analyst-chart-controls">
      <button type="button" disabled={!state.journal || saved || brief.outlook.end_date<=today} onClick={()=>action(storage=>saveForecast(storage,brief))}>{saved ? 'Forecast already saved' : 'Save this forecast'}</button>
      <button type="button" disabled={!state.journal || !records.length} onClick={()=>action(storage=>checkForecasts(storage,brief))}>Check loaded data</button>
      <button type="button" onClick={exportJournal} disabled={!!state.journal && !state.journal.records.length}>{state.error ? 'Export preserved journal data' : 'Export all saved forecasts'}</button>
    </div>
    {(state.error || operationError) && <p role="alert" className="research-error">{state.error || operationError}</p>}
    {message && <p role="status">{message}</p>}
    <p className="analyst-legend">Stored only in this browser, with up to 200 records across all tickers. Export before clearing browser storage. No cloud backup or import is included. {state.journal ? `${state.journal.records.length} saved across all tickers.` : ''}</p>
    {!records.length && state.journal && <p>No forecasts saved for {brief.symbol} yet. Save one to begin tracking.</p>}
    {!!records.length && <>
      <p className="analyst-legend">On a narrow screen, scroll the table sideways to see the actual close, errors and status.</p>
      <div className="analyst-outlook-table" tabIndex={0} role="region" aria-label="Saved forecast results table"><table><caption>Original forecasts and observed results · {brief.symbol} · USD</caption>
        <thead><tr><th scope="col">Based on / target</th><th scope="col">Saved at</th><th scope="col">Original estimate</th><th scope="col">Actual close</th><th scope="col">Error / flat baseline</th><th scope="col">Status</th></tr></thead>
        <tbody>{[...records].reverse().map(record=><tr key={record.id}>
          <th scope="row">{record.anchorDate}<br/>→ {record.endDate}</th>
          <td><time dateTime={record.savedAt}>{new Date(record.savedAt).toLocaleString()}</time><br/><small>Browser local time</small></td>
          <td>{money(record.points.at(-1).central)}</td><td>{record.result ? money(record.result.actualClose) : '—'}</td>
          <td>{record.result ? `${percent(record.result.errorPct)} / ${percent(record.result.flatErrorPct)}` : 'Not scored'}</td><td>{statusText(record)}</td>
        </tr>)}</tbody>
      </table></div>
      <dl className="research-metrics">
        <div><dt>Recorded outcomes · {brief.symbol}</dt><dd>{summary.completed} / {records.length}</dd></div>
        <div><dt>Average forecast error</dt><dd>{summary.modelErrorPct === null ? 'Not available yet' : percent(summary.modelErrorPct)}</dd></div>
        <div><dt>Average unchanged-price error</dt><dd>{summary.flatErrorPct === null ? 'Not available yet' : percent(summary.flatErrorPct)}</dd></div>
      </dl>
      <details><summary>Inspect original saved projections</summary>{[...records].reverse().map(record=><article key={record.id} className="analyst-note">
        <h4>{record.anchorDate} → {record.endDate}</h4><p>Saved {record.savedAt} · Model {record.modelVersion} · {record.source}</p>
        <p>Origin close {money(record.anchorPrice)}. Save time may be later than the data date; this is not a claim the forecast was issued on that earlier date.</p>
        <p>{record.method}</p>
        <div className="analyst-outlook-table"><table><caption>Preserved future paths · USD</caption><thead><tr><th scope="col">Date</th><th scope="col">Lower</th><th scope="col">Central</th><th scope="col">Upper</th></tr></thead>
          <tbody>{record.points.map(point=><tr key={point.date}><th scope="row">{point.date}</th><td>{money(point.lower)}</td><td>{money(point.central)}</td><td>{money(point.upper)}</td></tr>)}</tbody></table></div>
        {record.result && <p>Result recorded {record.result.checkedAt}. The observed close is preserved with this check; later data revisions do not silently change it.</p>}
      </article>)}</details>
    </>}
    <p className="analyst-legend">Sync market data on the dashboard, reopen/reload this analysis, then choose Check loaded data. This button checks the loaded daily bars; it does not download market prices. Scoring waits until the target date has ended in New York and requires that exact date’s close. Missing dates are not substituted. Only 90 sessions are loaded here, so check and record outcomes promptly.</p>
    <details><summary>Scoring rules and limits</summary><p className="analyst-legend">Error is the absolute difference from the actual close as a percentage of that close; lower is better. The flat baseline uses the original observed close. These are descriptive errors, not returns or win probabilities. Saved windows may overlap, and saving after the origin leaves only part of the forecast horizon ahead. Adjusted-price revisions, splits and dividends can affect comparisons; review corporate actions. Records can be changed through browser tools; this is a personal journal, not an independently audited record.</p></details>
  </section>
}
