export const FORECAST_JOURNAL_KEY = 'kappa.forecastJournal.v1'
const MAX_RECORDS = 200
const fail = () => { throw new Error('Forecast journal is unreadable or invalid. Existing data was preserved; export it before clearing browser storage.') }
const nyDate = now => new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now))
const validDate = text => typeof text === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(Date.parse(text)) && new Date(text).toISOString().slice(0,10) === text
const positive = n => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 1e12
const validStamp = stamp => typeof stamp === 'string' && Number.isFinite(Date.parse(stamp))
const idFor = record => `${record.symbol}|${record.anchorDate}|${record.modelVersion}`

function validRecord(record) {
  if (!record || typeof record !== 'object' || !/^[A-Z0-9^=.-]{1,20}$/.test(record.symbol) ||
    !validDate(record.anchorDate) || !validDate(record.endDate) || !positive(record.anchorPrice) ||
    !validStamp(record.savedAt) || typeof record.modelVersion !== 'string' || !record.modelVersion ||
    typeof record.source !== 'string' || typeof record.method !== 'string' || record.id !== idFor(record) ||
    record.endDate <= record.anchorDate || Date.parse(record.endDate)-Date.parse(record.anchorDate) > 14*86400000 ||
    !Array.isArray(record.points) || !record.points.length || record.points.length > 14) return false
  let previous = record.anchorDate
  for (const point of record.points) {
    if (!validDate(point.date) || point.date <= previous || point.date > record.endDate ||
      !positive(point.lower) || !positive(point.central) || !positive(point.upper) ||
      point.lower > point.central || point.central > point.upper) return false
    previous = point.date
  }
  if (previous !== record.endDate) return false
  if (nyDate(Date.parse(record.savedAt)) < record.anchorDate || nyDate(Date.parse(record.savedAt)) >= record.endDate) return false
  if (record.result !== null) {
    const result = record.result
    if (!result || result.actualDate !== record.endDate || !positive(result.actualClose) ||
      !validStamp(result.checkedAt) || nyDate(Date.parse(result.checkedAt)) <= record.endDate ||
      !Number.isFinite(result.errorPct) || !Number.isFinite(result.flatErrorPct)) return false
    const estimate = record.points.at(-1).central
    if (Math.abs(result.errorPct - Math.abs(estimate-result.actualClose)/result.actualClose*100) > 1e-8 ||
      Math.abs(result.flatErrorPct - Math.abs(record.anchorPrice-result.actualClose)/result.actualClose*100) > 1e-8) return false
  }
  return true
}

export function loadForecastJournal(storage) {
  const raw = storage.getItem(FORECAST_JOURNAL_KEY)
  if (raw === null) return {version:1,records:[]}
  let journal
  try { journal=JSON.parse(raw) } catch { fail() }
  if (!journal || journal.version !== 1 || !Array.isArray(journal.records) || journal.records.length > MAX_RECORDS ||
    !journal.records.every(validRecord) || new Set(journal.records.map(record=>record.id)).size !== journal.records.length) fail()
  return journal
}

export function saveForecast(storage, brief, now=Date.now()) {
  const journal=loadForecastJournal(storage), outlook=brief?.outlook
  if (!outlook || !Number.isFinite(now)) throw new Error('A valid forecast and save time are required.')
  const record={symbol:brief.symbol,anchorDate:outlook.anchor_date,anchorPrice:outlook.anchor_price,
    endDate:outlook.end_date,modelVersion:outlook.model_version || 'damped-logtrend-v1',method:outlook.method,
    source:brief.data_quality?.source || 'Saved adjusted daily bars',savedAt:new Date(now).toISOString(),
    points:outlook.points?.map(point=>({...point})),result:null}
  record.id=idFor(record)
  if (!validRecord(record)) throw new Error('Forecast prices, dates or model details are invalid; nothing was saved.')
  if (record.endDate <= nyDate(now) || record.anchorDate > nyDate(now)) throw new Error('Save a forecast with a future deadline and observations dated no later than today.')
  if (journal.records.some(previous=>previous.id===record.id)) return {...journal,added:false}
  if (journal.records.length >= MAX_RECORDS) throw new Error('The journal has reached its 200-record limit. Export a backup before managing browser storage.')
  const next={version:1,records:[...journal.records,record]}
  storage.setItem(FORECAST_JOURNAL_KEY,JSON.stringify(next))
  return {...next,added:true}
}

export function forecastStatus(record, observations, now=Date.now()) {
  if (record.result) return 'completed'
  if (nyDate(now) <= record.endDate) return 'pending'
  if (record.symbol !== observations?.symbol) return 'other_ticker'
  const matches=(observations.candles || []).filter(candle=>candle.time===record.endDate)
  if (matches.length !== 1 || !positive(matches[0].close)) return 'missing'
  return 'ready'
}

export function checkForecasts(storage, observations, now=Date.now()) {
  const journal=loadForecastJournal(storage)
  let updated=0
  const records=journal.records.map(record=>{
    if (forecastStatus(record,observations,now)!=='ready') return record
    const actual=observations.candles.find(candle=>candle.time===record.endDate).close
    updated++
    return {...record,result:{actualDate:record.endDate,actualClose:actual,checkedAt:new Date(now).toISOString(),
      errorPct:Math.abs(record.points.at(-1).central-actual)/actual*100,
      flatErrorPct:Math.abs(record.anchorPrice-actual)/actual*100}}
  })
  const next={version:1,records}
  if (updated) storage.setItem(FORECAST_JOURNAL_KEY,JSON.stringify(next))
  return {...next,updated}
}

export function journalSummary(records) {
  const complete=records.filter(record=>record.result)
  return {completed:complete.length,modelErrorPct:complete.length ? complete.reduce((sum,r)=>sum+r.result.errorPct,0)/complete.length : null,
    flatErrorPct:complete.length ? complete.reduce((sum,r)=>sum+r.result.flatErrorPct,0)/complete.length : null}
}
