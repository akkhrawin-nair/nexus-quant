import { useEffect, useMemo, useRef, useState } from 'react'
import CatalystJournal from './CatalystJournal'
import { ToolModal } from './ResearchTools'
import TradingChart from './TradingChart'
import DataQualityNotice from './DataQualityNotice'
import ForecastJournal from './ForecastJournal'
import SavedSharePlans from './SavedSharePlans'
import ResearchFreshness from './ResearchFreshness'
import { apiRequest } from '../lib/api'
import { shareTradePlan } from '../lib/tradePlan'
import './AnalystDesk.css'

const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value)
const value = number => Number(number).toLocaleString('en-US',{maximumFractionDigits:4})
const emptyPlan = {entry:'',stop:'',target:'',capital:'',riskBudget:'',feeBps:'10',slippageBps:'5',exitDate:''}

export default function AnalystDesk({onClose,initialSymbol='EOSE'}) {
  const [symbol,setSymbol] = useState(initialSymbol), [draft,setDraft] = useState(initialSymbol)
  const [revision,setRevision] = useState(0), [brief,setBrief] = useState({}), [headlines,setHeadlines] = useState({})
  const [form,setForm] = useState(emptyPlan), [plan,setPlan] = useState(null), [planError,setPlanError] = useState('')
  const [showOutlook,setShowOutlook] = useState(true)
  const [refresh,setRefresh] = useState({})
  const refreshRef = useRef(null)
  const key = `${symbol}:${revision}`
  useEffect(()=>()=>{refreshRef.current?.controller.abort();refreshRef.current=null},[key])
  useEffect(()=>{
    const controller = new AbortController()
    apiRequest(`/api/research/brief/?${new URLSearchParams({symbol})}`,{signal:controller.signal})
      .then(data=>{if(!controller.signal.aborted)setBrief({key,data})})
      .catch(error=>{if(!controller.signal.aborted)setBrief({key,error:error.message})})
    apiRequest(`/api/sentiment/?${new URLSearchParams({symbol})}`,{signal:controller.signal,timeoutMs:15000})
      .then(data=>{if(!controller.signal.aborted)setHeadlines({key,data})})
      .catch(error=>{if(!controller.signal.aborted)setHeadlines({key,error:error.message})})
    return ()=>controller.abort()
  },[symbol,key])
  const data = brief.key === key ? brief.data : null
  const chartData = useMemo(()=>data ? (showOutlook ? data.candles.slice(-20) : data.candles) : [],[data,showOutlook])
  const chartOverlays = useMemo(()=>data ? (showOutlook ? data.overlays.map(line=>({...line,
    data:line.data.filter(point=>point.time>=chartData[0].time)})) : data.overlays) : [],[data,showOutlook,chartData])
  const outlookEnd = data?.outlook?.points.at(-1)
  const news = headlines.key === key ? headlines : null
  const levels = useMemo(()=>data ? [
    {title:'Prior 20-session low',price:data.levels.support,color:'#059669'},
    {title:'Prior 20-session high',price:data.levels.resistance,color:'#d97706'},
    ...(plan ? [{title:'Your entry',price:plan.entry,color:'#2563eb'},{title:'Your stop trigger',price:plan.stop,color:'#dc2626'},{title:'Your target',price:plan.target,color:'#7c3aed'}] : []),
  ] : [],[data,plan])
  const select = next => {
    const clean=next.trim().toUpperCase()
    setSymbol(clean);setDraft(clean);setPlan(null);setPlanError('')
    setForm(previous=>({...previous,entry:'',stop:'',target:'',exitDate:''}))
  }
  const field = (name,label,props={}) => <label>{label}<input required {...props} value={form[name]} onChange={event=>{setForm(previous=>({...previous,[name]:event.target.value}));setPlan(null);setPlanError('')}}/></label>
  const calculate = event => {
    event.preventDefault()
    try {setPlan(shareTradePlan(form));setPlanError('')} catch(error){setPlan(null);setPlanError(error.message)}
  }
  const refreshTicker = async () => {
    if (refreshRef.current?.key===key) return
    const operation={key,controller:new AbortController()}
    refreshRef.current=operation
    setRefresh({key,loading:true})
    try {
      const updated=await apiRequest('/api/research/brief/refresh/',{method:'POST',body:JSON.stringify({symbol}),signal:operation.controller.signal,timeoutMs:60000})
      if (refreshRef.current!==operation || operation.controller.signal.aborted) return
      setBrief({key,data:updated});setPlan(null)
      setRefresh({key,message:updated.as_of===data?.as_of ? `Refresh completed for ${symbol}. The latest stored session is still ${updated.as_of}; no newer session was added. Daily data remains delayed/historical.` : `Refresh completed for ${symbol}. Latest stored session: ${updated.as_of}. Daily data remains delayed/historical.`})
    } catch(error) {
      if (refreshRef.current===operation && !operation.controller.signal.aborted) setRefresh({key,error:`Refresh failed: ${error.message} ${data ? 'The previously loaded report and saved journals have been kept.' : 'Saved journals have not been cleared.'}`})
    } finally {if(refreshRef.current===operation)refreshRef.current=null}
  }
  return <ToolModal title={`${symbol} · Analyst desk`} onClose={onClose}>
    <p>Technical evidence, reviewed issuer news, and your trade scenario in one place. Focus: up to 14 calendar days. Daily data and conditional scenarios; no live investment advisory service or guaranteed return.</p>
    <form className="research-controls" onSubmit={event=>{event.preventDefault();select(draft)}}>
      <label>Research ticker<input value={draft} onChange={event=>setDraft(event.target.value)} maxLength={20} required/></label>
      <button type="submit">Analyze ticker</button><button type="button" onClick={()=>select('EOSE')}>EOSE</button><button type="button" onClick={()=>select('ONDS')}>ONDS</button>
      <button type="button" onClick={()=>{setRevision(n=>n+1);setPlan(null)}}>Reload saved analysis</button>
      <button type="button" disabled={brief.key!==key || (refresh.key===key && refresh.loading)} onClick={refreshTicker}>{refresh.key===key && refresh.loading ? `Refreshing ${symbol}…` : `Refresh ${symbol} prices`}</button>
    </form>
    <p className="analyst-legend">Reload reads saved records. Refresh prices requests new daily history for this ticker only; it does not refresh the reviewed issuer news.</p>
    {refresh.key===key && refresh.loading && <p role="status">Requesting provider data for {symbol}. Existing analysis stays visible while the request runs.</p>}
    {refresh.key===key && refresh.message && <p role="status">{refresh.message}</p>}
    {refresh.key===key && refresh.error && <p role="alert" className="research-error">{refresh.error}</p>}
    {!data && brief.key !== key && <p role="status">Building analysis from saved daily history…</p>}
    {brief.key === key && brief.error && <p role="alert" className="research-error">{brief.error}</p>}
    {data && <>
      <DataQualityNotice quality={data.data_quality}/>
      <ResearchFreshness brief={data}/>
      <section aria-label="Technical reading" className="analyst-reading"><p className="analyst-kicker">TECHNICAL VIEW · SESSION {data.as_of} · {data.trend}</p><h3>{data.assessment.headline}</h3><p>{data.assessment.interpretation}</p><p>{data.reading}</p>
        <p>Latest observed close: <strong>{money(data.indicators.price)}</strong>. Use <strong>Refresh {symbol} prices</strong> above to request updated daily history before relying on old observations.</p></section>
      <div className="analyst-chart-controls" role="group" aria-label="Chart view">
        <button type="button" aria-pressed={showOutlook} onClick={()=>setShowOutlook(true)}>Future outlook · 14 days</button>
        <button type="button" aria-pressed={!showOutlook} onClick={()=>setShowOutlook(false)}>90-session history</button>
      </div>
      <div className="analyst-chart"><TradingChart data={chartData} height={380} showAutoLevels={false}
        overlays={chartOverlays}
        priceLevels={levels} events={data.context.notes} forecast={showOutlook ? data.outlook : null}/></div>
      <p className="analyst-legend">Candles: daily OHLC · Blue: EMA20 · Purple: EMA50 · Green: prior 20-session low · Amber: prior 20-session high · News dots: dated issuer releases, not proof of price impact.</p>
      {outlookEnd && <section aria-label="Future price projection" className="analyst-outlook">
        <p className="analyst-kicker">FUTURE PROJECTION · THROUGH {data.outlook.end_date}</p>
        <h3>Where could the recent trend lead?</h3>
        <p>The shaded area to the right of the last candle contains estimated future paths. Dashed blue is the central trend estimate; dotted amber and rose show upper and lower volatility scenarios. No future candles are actual observations.</p>
        <p><strong>Based on {data.outlook.anchor_date}, close {money(data.outlook.anchor_price)}.</strong> {data.outlook.observation_age_days > 0 && `Saved observations are ${data.outlook.observation_age_days} calendar day(s) old. Sync market data to update the projection.`}</p>
        {data.outlook.expired && <p role="alert" className="research-error">This projection window has already ended. Sync this ticker before using the outlook.</p>}
        <div className="analyst-outlook-table"><table><caption>Illustrative closing-price paths · USD</caption>
          <thead><tr><th scope="col">Projected date</th><th scope="col">Lower scenario</th><th scope="col">Trend estimate</th><th scope="col">Upper scenario</th></tr></thead>
          <tbody>{data.outlook.points.filter((_,index,points)=>index===Math.floor(points.length/2)-1 || index===points.length-1).map(point=><tr key={point.date}>
            <th scope="row">{point.date}</th><td>{money(point.lower)}</td><td><strong>{money(point.central)}</strong></td><td>{money(point.upper)}</td></tr>)}</tbody>
        </table></div>
        <p><strong>These paths are estimates, not guaranteed targets or probability bounds.</strong> Actual prices can move outside both scenarios. News surprises, gaps and changing conditions are not predicted.</p>
        <details><summary>Historical forecast check · {data.outlook.evaluation.samples} completed windows</summary>
          {data.outlook.evaluation.samples ? <><dl className="research-metrics">
            <div><dt>Trend estimate average error</dt><dd>{value(data.outlook.evaluation.model_mae_pct)}%</dd></div>
            <div><dt>Unchanged-price average error</dt><dd>{value(data.outlook.evaluation.flat_mae_pct)}%</dd></div>
            <div><dt>Comparison on saved history</dt><dd>{data.outlook.evaluation.beats_flat ? 'Trend error was lower' : 'Trend did not beat flat'}</dd></div>
          </dl><p>Lower error is better. {data.outlook.evaluation.samples < 20 ? 'Small sample: fewer than 20 completed windows. ' : ''}This does not establish a profitable trading edge.</p></> : <p>Not enough eligible completed windows to compare forecast errors.</p>}
          <p>{data.outlook.evaluation_note}</p>
        </details>
        <details><summary>How the projection is calculated</summary><p>{data.outlook.method}</p><p>{data.outlook.calendar}</p></details>
        <ForecastJournal brief={data}/>
      </section>}
      <dl className="research-metrics">{[['RSI14 (simple rolling)',value(data.indicators.rsi)],['ATR14 (simple mean)',money(data.indicators.atr14)],['Relative volume',`${value(data.indicators.vol_spike_ratio)}×`],['Range low',money(data.levels.support)],['Range high',money(data.levels.resistance)],['Latest session',data.as_of]].map(([label,amount])=><div key={label}><dt>{label}</dt><dd>{amount}</dd></div>)}</dl>
      <section aria-label="Conditional scenarios"><h3>What would strengthen or weaken the setup?</h3><div className="analyst-columns">{data.scenarios.map(scenario=><article key={scenario.title}><h4>{scenario.title}</h4><p>{scenario.condition}</p><p><strong>Reassessment:</strong> {scenario.invalidation}</p></article>)}</div></section>
      <section aria-label="Reviewed issuer analysis"><h3>Business thesis and news context</h3><p>{data.context.business}</p>
        <div className="analyst-columns"><article><h4>Bull case · interpretation</h4><p>{data.context.bull_case}</p></article><article><h4>Bear case · interpretation</h4><p>{data.context.bear_case}</p></article></div>
        <p className="data-quality-notice">Issuer notes reviewed: {data.context.reviewed_at || 'Not reviewed'}. {data.context.needs_review ? 'Review is overdue or unavailable; check the issuer for changes.' : 'A dated review, not a live news analysis.'} {data.context.coverage}</p>
        {data.context.notes.map(note=><article className="analyst-note" key={note.url}><h4><a href={note.url} target="_blank" rel="noreferrer">{note.title}</a></h4><small>Published {note.date} · Primary issuer source</small><p><strong>Reported fact:</strong> {note.fact}</p><p><strong>Interpretation:</strong> {note.interpretation}</p></article>)}
        <h4>Known scheduled catalysts</h4>{data.context.events.length ? <ul>{data.context.events.map(event=><li key={event.url}><a href={event.url} target="_blank" rel="noreferrer">{event.date} · {event.title}</a> · {event.window.replaceAll('_',' ')}</li>)}</ul> : <p>No future catalyst has been verified in this maintained brief. Check the issuer calendar; this does not mean no event risk.</p>}
      </section>
      <CatalystJournal key={symbol} symbol={symbol}/>
      <section aria-label="Retrieved headlines"><h3>Additional headlines · not editorially reviewed</h3>
        {!news ? <p role="status">Checking the news feed…</p> : news.error ? <p>{news.error}</p> : <>
          <DataQualityNotice quality={news.data.data_quality}/>
          {!news.data.news.length && <p>News feed unavailable or empty. The dated issuer review above remains separate.</p>}
          <ul className="research-news">{news.data.news.map(item=><li key={item.url}><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a><small>{item.time} · {item.source}</small></li>)}</ul>
        </>}
      </section>
      <section aria-label="Share trade scenario"><h3>Draw your trade scenario · shares only</h3><p>Enter your proposed prices and USD limits. These values are your assumptions. They are not prices or risk limits recommended by KAPPA. Planning assumes entry today.</p>
        <form onSubmit={calculate}>
          <div className="research-controls">{field('entry','Planned entry ($)',{type:'number',min:'.0001',step:'any'})}{field('stop','Stop trigger ($)',{type:'number',min:'.0001',step:'any'})}{field('target','Target ($)',{type:'number',min:'.0001',step:'any'})}</div>
          <div className="research-controls">{field('capital','Available trade capital (USD)',{type:'number',min:'.01',step:'any'})}{field('riskBudget','Planned loss budget (USD)',{type:'number',min:'.01',step:'any'})}{field('exitDate','Exit by (New York date)',{type:'date'})}</div>
          <div className="research-controls">{field('feeBps','Fees per side (bps)',{type:'number',min:'0',max:'100',step:'any'})}{field('slippageBps','Slippage per side (bps)',{type:'number',min:'0',max:'100',step:'any'})}<button type="submit">Draw and size scenario</button></div>
        </form>
        {planError && <p role="alert" className="research-error">{planError}</p>}
        {plan && <div role="status" className="analyst-plan"><strong>{symbol}: {plan.quantity} whole shares within the entered planning limits</strong>
          <dl className="research-metrics">{[['Entry cost estimate',money(plan.entryCost)],['Loss at assumed stop fill',money(plan.plannedLoss)],['Gain at assumed target fill',money(plan.plannedGain)],['Net reward / risk',`${value(plan.rewardRisk)} : 1`],['Planned exit',plan.exitDate],['Latest allowed date',plan.deadline]].map(([label,amount])=><div key={label}><dt>{label}</dt><dd>{amount}</dd></div>)}</dl>
          {plan.quantity===0 && <p>Your entered capital or loss budget cannot support one whole share under these assumptions.</p>}
          {plan.rewardRisk<=0 && <p>Entered costs consume the target gain; this scenario has no positive net reward.</p>}
          <p>Your entry, stop trigger and target are drawn on the chart above. This scenario is not saved as a position and places no order.</p></div>}
        <SavedSharePlans key={symbol} symbol={symbol} draft={form} scenario={plan}/>
        <p>Gaps, trading halts, liquidity, changing spreads and extra fees can produce losses beyond the planned budget. A stop trigger is not a guaranteed fill price. FX and taxes are not modeled. Close actual positions yourself before your deadline and the broker’s cutoff.</p>
      </section>
      <details><summary>Technical method and limits</summary><p>{data.method}</p></details>
    </>}
  </ToolModal>
}
