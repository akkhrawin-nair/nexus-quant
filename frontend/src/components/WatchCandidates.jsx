import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import './WatchCandidates.css'

const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:4}).format(value)
export default function WatchCandidates({revision,refreshing,onAnalyze,lang='en'}) {
  const [state,setState]=useState({}),[attempt,setAttempt]=useState(0)
  const key=`${revision}:${attempt}:${refreshing}`
  useEffect(()=>{
    if(refreshing)return
    let controller
    const load=()=>{controller?.abort();controller=new AbortController();const current=controller
      apiRequest('/api/research/watch-candidates/',{signal:current.signal}).then(data=>{if(!current.signal.aborted)setState({key,data})}).catch(error=>{if(!current.signal.aborted)setState({key,error:error.message})})}
    load();const timer=setInterval(load,30000)
    return()=>{controller?.abort();clearInterval(timer)}
  },[key,refreshing])
  const data=state.key===key?state.data:null,error=state.key===key?state.error:null
  const th=lang==='th'
  return <section className="watch-candidates" aria-label="Directional stock watch candidates">
    <div className="watch-candidates-heading"><div><p className="kappa-eyebrow">{th?'จับตาทิศทางหุ้น':'DIRECTIONAL STOCK WATCH'}</p><h2>{th?'3 หุ้นฝั่งขาขึ้น · 3 หุ้นฝั่งขาลง':'3 upside watches · 3 downside watches'}</h2></div><span>≤ 14 calendar days · daily-bar research</span></div>
    <p>Trend and momentum candidates, not guaranteed moves or buy/short instructions. Only qualified stocks with recent provider snapshots appear; fewer than three is possible.</p>
    {refreshing?<p role="status">Updating provider data. Candidate lists will refresh after the sync finishes.</p>:error?<div role="alert" className="kappa-error">Candidates unavailable: {error}<button onClick={()=>setAttempt(n=>n+1)}>Retry watch candidates</button></div>:!data?<p role="status">Checking saved stock trend and momentum…</p>:<>
      <p className="watch-candidates-meta">Completed-session cutoff: {data.session_cutoff} · checked {new Date(data.generated_at).toLocaleString()} · {data.coverage.stock_count} stocks reviewed. Freshness and close-time filters are approximate; no complete holiday calendar.</p>
      <div className="watch-candidates-columns">{['bullish','bearish'].map(direction=><section key={direction} className={`watch-candidate-group ${direction}`} aria-label={`${direction==='bullish'?'Bullish':'Bearish'} stock candidates`}><h3>{direction==='bullish'?'↑ Bullish alignment':'↓ Bearish alignment'} <small>{data[direction].length} / 3 shown</small></h3>
        {!data[direction].length&&<p>No qualified {direction} stocks. Sync provider data or review the exclusions below; no candidates are invented.</p>}
        {data[direction].map(row=><article className="watch-candidate-card" key={row.symbol} aria-label={`${row.symbol} ${direction} watch`}>
          <header><strong>{row.symbol}</strong><span>{money(row.price)}</span><small>{row.aligned_checks}/5 checks</small></header>
          <p className="watch-candidates-meta">Observed daily close: {row.session} · provider receipt {new Date(row.provider_retrieved_at).toLocaleString()}</p>
          <ul>{row.checks.slice(0,3).map(check=><li key={check.id}>{check.label} <small>{check.detail}</small></li>)}</ul>
          <p>RSI {row.rsi.toFixed(1)} · relative volume {row.relative_volume.toFixed(2)}x. {row.caution}</p>
          <details><summary>Reassessment and remaining checks</summary><p>{row.reassessment}</p><ul>{row.checks.slice(3).map(check=><li key={check.id}>{check.label}: {check.passed?'aligned':'not aligned'} · {check.detail}</li>)}</ul><p>{row.source}. Neither future price direction nor execution is verified.</p></details>
          <button onClick={()=>onAnalyze(row.symbol)}>Analyze {row.symbol}</button>
        </article>)}
      </section>)}</div>
      <details><summary>Ranking rules, excluded data and limits</summary><p>{data.method}</p><p>Qualified before top-three limit: {data.coverage.qualified_by_direction.bullish} bullish / {data.coverage.qualified_by_direction.bearish} bearish.</p><ul>{Object.entries(data.coverage.excluded).map(([reason,count])=><li key={reason}>{reason.replaceAll('_',' ')}: {count}</li>)}</ul><ul>{data.limitations.map(text=><li key={text}>{text}</li>)}</ul></details>
    </>}
  </section>
}
