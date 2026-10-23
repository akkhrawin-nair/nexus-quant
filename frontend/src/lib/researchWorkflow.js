import { marketDate } from './options.js'
export const CATALYST_KEY='kappa.catalysts.v1'
export const WORKFLOW_EVENT='kappaResearchWorkflowUpdated'
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max&&![...value].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
function normalizeCatalyst(input,now) {
  if(!Number.isFinite(now)||!text(input.symbol,20)||!/^[A-Z0-9.^=-]+$/i.test(input.symbol))throw new Error('Enter a valid catalyst ticker.')
  if(!text(input.title,160)||!date(input.eventDate)||!date(input.publishedDate)||input.publishedDate>marketDate(now))throw new Error('Enter a title, valid event date and publication date no later than today in New York.')
  let url;try{url=new URL(input.url)}catch{throw new Error('Enter an HTTPS source URL.')}
  if(url.protocol!=='https:'||url.username||url.password||url.href.length>2048)throw new Error('Use an HTTPS source URL without credentials, up to 2048 characters.')
  if(!['issuer','regulator','news'].includes(input.kind)||String(input.note??'').length>500)throw new Error('Choose a source type and keep notes within 500 characters.')
  return {symbol:input.symbol.trim().toUpperCase(),title:input.title.trim(),eventDate:input.eventDate,publishedDate:input.publishedDate,url:url.href,kind:input.kind,note:String(input.note??'').trim()}
}
export function loadCatalysts(storage) {
  const raw=storage.getItem(CATALYST_KEY)
  if(raw===null)return {version:1,records:[]}
  try{
    const data=JSON.parse(raw)
    if(data.version!==1||!Array.isArray(data.records)||data.records.length>200||new Set(data.records.map(r=>r.id)).size!==data.records.length)throw Error()
    for(const record of data.records){
      if(!text(record.id,100)||typeof record.recordedAt!=='string'||!Number.isFinite(Date.parse(record.recordedAt)))throw Error()
      const normalized=normalizeCatalyst(record,Date.parse(record.recordedAt))
      if(!Object.entries(normalized).every(([key,value])=>record[key]===value))throw Error()
    }
    return data
  }catch{throw new Error('Catalyst journal is invalid. Original data was preserved; export a backup before repair.')}
}
export function saveCatalyst(storage,input,now=Date.now()) {
  const data=loadCatalysts(storage),record=normalizeCatalyst(input,now)
  if(data.records.some(r=>Object.entries(record).every(([key,value])=>r[key]===value)))return {...data,added:false}
  if(data.records.length>=200)throw new Error('The 200-catalyst limit has been reached. Export a backup.')
  const next={version:1,records:[{...record,id:crypto.randomUUID(),recordedAt:new Date(now).toISOString()},...data.records]}
  storage.setItem(CATALYST_KEY,JSON.stringify(next))
  if(typeof window!=='undefined')window.dispatchEvent(new Event(WORKFLOW_EVENT))
  return {...next,added:true}
}
export function catalystStatus(record,now=Date.now()) {
  const days=(Date.parse(record.eventDate)-Date.parse(marketDate(now)))/86400000
  return {days,window:days<0?'past':days<=14?'within_14_days':'outside_14_days',stale:now-Date.parse(record.recordedAt)>7*86400000||now<Date.parse(record.recordedAt)}
}
export function dimeEvidence(records) {
  const rows=records.filter(r=>/\bdime\b/i.test(r.a.source)||/\bdime\b/i.test(r.b.source))
  const reports=records.flatMap(r=>(r.executions||[]).filter(e=>/\bdime\b/i.test(e.input.source)).map(e=>({e,ticket:r.orderTicket})))
  return {comparisons:rows.length,exactIdentifiers:rows.filter(r=>r.a.contractSymbol&&r.a.contractSymbol===r.b.contractSymbol&&r.deliverableConfirmed).length,
    closeTiming:rows.filter(r=>Math.abs(Date.parse(r.a.quoteTime)-Date.parse(r.b.quoteTime))<=5000).length,
    paperReports:reports.filter(({e})=>e.input.environment==='broker_paper').length,
    realReports:reports.filter(({e})=>e.input.environment==='reported_real').length,
    debitMismatches:reports.filter(({e,ticket})=>Math.abs(Math.round((e.input.price*e.input.contracts*ticket.multiplier+e.input.totalFees)*100)-Math.round(e.input.brokerDebit*100))>0).length,
    independentlyVerified:0}
}
export function dailyResearchSummary(signals,positions,catalysts,now=Date.now()) {
  const today=marketDate(now),dates=signals.map(s=>s.signal_date).filter(date).sort()
  return {date:today,latestSession:dates.at(-1)||null,observations:signals.length,
    bullish:signals.filter(s=>Number.isFinite(Number(s.macd))&&Number.isFinite(Number(s.macd_signal))&&s.macd!==null&&s.macd_signal!==null&&Number(s.macd)>Number(s.macd_signal)).length,
    staleSymbols:signals.filter(s=>!date(s.signal_date)||(Date.parse(today)-Date.parse(s.signal_date))/86400000>1||s.signal_date>today).map(s=>s.symbol),
    dueOptions:positions.filter(p=>!p.outcome&&p.ticket.plannedExit<=today).map(p=>p.ticket.symbol),
    upcoming:catalysts.filter(c=>catalystStatus(c,now).window==='within_14_days').sort((a,b)=>a.eventDate.localeCompare(b.eventDate))}
}
