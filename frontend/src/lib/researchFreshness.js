import { marketDate } from './options.js'

const sessionDate = value => {
  const text=typeof value==='string' ? value.slice(0,10) : ''
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(Date.parse(text)) && new Date(text).toISOString().slice(0,10)===text ? text : null
}
export function researchFreshness(observationDate,endDate,now=Date.now()) {
  const observed=sessionDate(observationDate), end=sessionDate(endDate), today=marketDate(now)
  if (!observed) return {kind:'unknown',ageDays:null,expired:!!end && today>end}
  const ageDays=(Date.parse(today)-Date.parse(observed))/86400000
  return {ageDays,expired:!!end && today>end,kind:ageDays<0 ? 'future' : ageDays===0 ? 'current_unconfirmed' : ageDays<=3 ? 'recent' : 'older'}
}
