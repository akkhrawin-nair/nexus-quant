export const AUTO_SYNC_ENABLED_KEY='kappa.autoMarketSync.v1'
export const AUTO_SYNC_ATTEMPT_KEY='kappa.marketSyncAttempt.v1'
export const PROVIDER_MAX_AGE_MS=6*3600000
export const AUTO_SYNC_COOLDOWN_MS=15*60000
export function scheduleSyncChecks(check,timers=globalThis,events=globalThis) {
  const initial=timers.setTimeout(check,150)
  const interval=timers.setInterval(check,60000)
  events.addEventListener('focus',check)
  return()=>{timers.clearTimeout(initial);timers.clearInterval(interval);events.removeEventListener('focus',check)}
}
const stamp=row=>typeof row.data_quality?.retrieved_at==='string'?Date.parse(row.data_quality.retrieved_at):NaN
export function providerSyncDue(signals,now=Date.now()) {
  return !signals.length||signals.some(row=>!Number.isFinite(stamp(row))||now-stamp(row)>PROVIDER_MAX_AGE_MS||stamp(row)>now+5000)
}
export function autoSyncAllowed(storage,signals,now=Date.now()) {
  if(!providerSyncDue(signals,now))return false
  try{
    const previous=Number(storage.getItem(AUTO_SYNC_ATTEMPT_KEY))
    return !Number.isFinite(previous)||previous<=0||now-previous>=AUTO_SYNC_COOLDOWN_MS
  }catch{return false}
}
export function providerFreshness(signals,now=Date.now()) {
  const receipts=signals.map(stamp).filter(t=>Number.isFinite(t)&&t<=now+5000).sort((a,b)=>a-b)
  const dates=rows=>rows.map(row=>row.signal_date).filter(value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)).sort()
  return {stockSession:dates(signals.filter(row=>row.asset_type==='Stock')).at(-1)||null,
    latestSession:dates(signals).at(-1)||null,oldestReceipt:receipts.length?new Date(receipts[0]).toISOString():null,
    unknownReceipts:signals.length-receipts.length,needsSync:providerSyncDue(signals,now)}
}
