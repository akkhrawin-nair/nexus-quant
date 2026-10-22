import test from 'node:test'
import assert from 'node:assert/strict'
import { loadForecastJournal, saveForecast, checkForecasts, forecastStatus, journalSummary, FORECAST_JOURNAL_KEY } from './forecastJournal.js'

const now = Date.parse('2026-10-22T15:00:00Z')
const finished = Date.parse('2026-11-05T15:00:00Z')
const brief = () => ({symbol:'EOSE',data_quality:{source:'Stored adjusted daily bars'},candles:[],outlook:{
  anchor_date:'2026-10-21',anchor_price:100,end_date:'2026-11-04',model_version:'damped-logtrend-v1',method:'Fixed trend rule',
  points:[{date:'2026-10-22',lower:90,central:105,upper:120},{date:'2026-11-04',lower:80,central:110,upper:130}]}})
function memoryStorage() {
  const entries=new Map()
  return {getItem:key=>entries.get(key)??null,setItem:(key,val)=>entries.set(key,val)}
}

test('original projection survives reload and a duplicate save cannot replace it',()=>{
  const storage=memoryStorage(), input=brief()
  const first=saveForecast(storage,input,now)
  input.outlook.points[1].central=125
  const duplicate=saveForecast(storage,input,now+1000)
  assert.equal(first.records.length,1)
  assert.equal(duplicate.added,false)
  const saved=loadForecastJournal(storage).records[0]
  assert.equal(saved.points[1].central,110)
  assert.equal(saved.savedAt,'2026-10-22T15:00:00.000Z')
  assert.equal(saved.source,'Stored adjusted daily bars')
})

test('checks exact target close against frozen forecast and flat baseline',()=>{
  const storage=memoryStorage();saveForecast(storage,brief(),now)
  const observations={symbol:'EOSE',candles:[{time:'2026-11-03',close:99},{time:'2026-11-04',close:120}]}
  const checked=checkForecasts(storage,observations,finished)
  const result=checked.records[0].result
  assert.equal(result.actualClose,120)
  assert.equal(result.actualDate,'2026-11-04')
  assert.ok(Math.abs(result.errorPct-100/12)<1e-10)
  assert.ok(Math.abs(result.flatErrorPct-100/6)<1e-10)
  assert.equal(journalSummary(checked.records).completed,1)
  assert.equal(journalSummary(checked.records).modelErrorPct,result.errorPct)
  observations.candles[1].close=500
  assert.equal(checkForecasts(storage,observations,finished+1000).records[0].result.actualClose,120)
})

test('pending, target-day, missing and other-ticker data cannot become scored outcomes',()=>{
  const storage=memoryStorage(), record=saveForecast(storage,brief(),now).records[0]
  const observations={symbol:'EOSE',candles:[{time:'2026-11-04',close:120}]}
  assert.equal(forecastStatus(record,observations,now),'pending')
  assert.equal(forecastStatus(record,observations,Date.parse('2026-11-05T00:00:00Z')),'pending') // Still Nov 4 in New York.
  assert.equal(forecastStatus(record,{...observations,symbol:'ONDS'},finished),'other_ticker')
  assert.equal(forecastStatus(record,{symbol:'EOSE',candles:[{time:'2026-11-05',close:120}]},finished),'missing')
  for(const data of [{...observations,symbol:'ONDS'},{symbol:'EOSE',candles:[]}]) {
    assert.equal(checkForecasts(storage,data,finished).records[0].result,null)
  }
  assert.equal(journalSummary([record]).completed,0)
  assert.equal(journalSummary([record]).modelErrorPct,null)
})

test('malformed storage is preserved and blocked rather than overwritten',()=>{
  for(const raw of ['{bad','{"version":2,"records":[]}','{"version":1,"records":[{}]}']) {
    const storage=memoryStorage();storage.setItem(FORECAST_JOURNAL_KEY,raw)
    assert.throws(()=>loadForecastJournal(storage))
    assert.throws(()=>saveForecast(storage,brief(),now))
    assert.equal(storage.getItem(FORECAST_JOURNAL_KEY),raw)
  }
})

test('invalid prices, impossible dates, expired and overlong forecasts are rejected',()=>{
  for(const alter of [b=>b.outlook.anchor_price=0,b=>b.outlook.points[1].central=Infinity,
    b=>b.outlook.points[1].lower=125,b=>b.outlook.anchor_date='2026-02-30',
    b=>b.outlook.end_date='2026-11-05']) {
    const input=brief();alter(input);assert.throws(()=>saveForecast(memoryStorage(),input,now))
  }
  assert.throws(()=>saveForecast(memoryStorage(),brief(),finished))
})

test('failed browser writes do not report a successful save',()=>{
  const storage={getItem:()=>null,setItem:()=>{throw Error('Storage full')}}
  assert.throws(()=>saveForecast(storage,brief(),now),/Storage full/)
})

test('failed outcome writes preserve the pending record for a later retry',()=>{
  const storage=memoryStorage();saveForecast(storage,brief(),now)
  storage.setItem=()=>{throw Error('Storage full')}
  assert.throws(()=>checkForecasts(storage,{symbol:'EOSE',candles:[{time:'2026-11-04',close:120}]},finished),/Storage full/)
  assert.equal(loadForecastJournal(storage).records[0].result,null)
})
