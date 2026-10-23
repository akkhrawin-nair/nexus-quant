import { useEffect, useState } from 'react'
import { WORKFLOW_EVENT, loadCatalysts, saveCatalyst, catalystStatus } from '../lib/researchWorkflow'

const read=()=>{try{return {data:loadCatalysts(localStorage)}}catch(e){return {error:e.message}}}
export default function CatalystJournal({symbol}) {
  const [state,setState]=useState(read),[form,setForm]=useState({symbol:symbol||'',title:'',eventDate:'',publishedDate:'',url:'',kind:'issuer',note:''}),[message,setMessage]=useState(''),[error,setError]=useState(''),[now,setNow]=useState(Date.now)
  useEffect(()=>{const update=()=>{setState(read());setNow(Date.now())};window.addEventListener('storage',update);window.addEventListener(WORKFLOW_EVENT,update);const timer=setInterval(update,30000);return()=>{window.removeEventListener('storage',update);window.removeEventListener(WORKFLOW_EVENT,update);clearInterval(timer)}},[])
  const field=(key,label,props={})=><label>{label}<input required {...props} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>
  const save=e=>{e.preventDefault();setError('');setMessage('');try{const result=saveCatalyst(localStorage,form);setState({data:result});setMessage(result.added?'Sourced catalyst saved locally; source contents were not independently verified.':'This catalyst is already saved.')}catch(e){setError(e.message)}}
  const records=state.data?.records.filter(r=>!symbol||r.symbol===symbol)||[]
  return <section aria-label="Sourced catalyst journal"><h3>Sourced catalyst journal {symbol&&`· ${symbol}`}</h3><p>Copy a confirmed date from an issuer or regulator release, or label a secondary news source. Keep publication and event dates separate. Saving a link does not verify its contents or completeness.</p>
    <details><summary>Add a sourced catalyst</summary><form aria-label="Add sourced catalyst" onSubmit={save}>
      <div className="research-controls">{field('symbol','Catalyst ticker',{maxLength:20})}{field('title','Catalyst title',{maxLength:160})}</div>
      <div className="research-controls">{field('eventDate','Event date (New York)',{type:'date'})}{field('publishedDate','Source publication date',{type:'date'})}</div>
      <div className="research-controls">{field('url','Source HTTPS link',{type:'url'})}<label>Source type<select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})}><option value="issuer">Issuer release</option><option value="regulator">Regulator filing</option><option value="news">Secondary news</option></select></label></div>
      {field('note','Catalyst note',{required:false,maxLength:500})}<button disabled={!state.data}>Save sourced catalyst</button>
    </form></details>
    {(state.error||error)&&<p role="alert">{state.error||error}</p>}{message&&<p role="status">{message}</p>}
    {!records.length&&<p>No sourced catalysts saved here. This does not mean no event risk.</p>}
    {records.map(record=>{const status=catalystStatus(record,now);return <article className="analyst-note" key={record.id}><h4><a href={record.url} target="_blank" rel="noreferrer">{record.symbol} · {record.title}</a></h4><p>Event {record.eventDate} · published {record.publishedDate} · {record.kind} · {status.window.replaceAll('_',' ')}</p><p>Recorded {new Date(record.recordedAt).toLocaleString()} · {status.stale?'Review older than 7 days or clock mismatch — recheck source.':'User-recorded source; independent verification unavailable.'}</p>{record.note&&<p>{record.note}</p>}</article>})}
    <p>Up to 200 records, browser-local. Export and restore through Backups. Dates do not establish market hours, event time or a trading recommendation.</p>
  </section>
}
