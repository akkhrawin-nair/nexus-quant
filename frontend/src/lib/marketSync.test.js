import test from 'node:test'
import assert from 'node:assert/strict'
import { providerSyncDue, autoSyncAllowed, providerFreshness, scheduleSyncChecks, AUTO_SYNC_ATTEMPT_KEY } from './marketSync.js'
const now=Date.parse('2026-10-26T09:00:00Z')
const row=(symbol,time='2026-10-26T08:59:00Z',type='Stock')=>({symbol,asset_type:type,signal_date:type==='Crypto'?'2026-10-26':'2026-10-23',data_quality:{retrieved_at:time}})

test('independent sync clock crosses age threshold and retries after cooldown without feed updates',()=>{
  let time=now, attempts=0, last=null, interval, initial, focus
  const signals=[row('AAPL','2026-10-26T03:01:00Z')]
  const storage={getItem:()=>last}
  const timers={setTimeout:(fn,ms)=>{assert.equal(ms,150);initial=fn;return 1},setInterval:(fn,ms)=>{assert.equal(ms,60000);interval=fn;return 2},clearTimeout:id=>assert.equal(id,1),clearInterval:id=>assert.equal(id,2)}
  const events={addEventListener:(name,fn)=>{assert.equal(name,'focus');focus=fn},removeEventListener:(name,fn)=>{assert.equal(name,'focus');assert.equal(fn,focus)}}
  const stop=scheduleSyncChecks(()=>{if(autoSyncAllowed(storage,signals,time)){attempts++;last=String(time)}},timers,events)
  initial();assert.equal(attempts,0)
  time+=2*60000;interval();assert.equal(attempts,1)
  time+=14*60000;focus();assert.equal(attempts,1)
  time+=60000;interval();assert.equal(attempts,2)
  stop()
})
test('provider age controls sync; a fresh crypto row cannot hide stale stocks',()=>{
  assert.equal(providerSyncDue([row('AAPL')],now),false)
  assert.equal(providerSyncDue([row('AAPL',null),row('BTC-USD',undefined,'Crypto')],now),true)
  assert.equal(providerSyncDue([row('AAPL','2026-10-25T01:00:00Z')],now),true)
  assert.equal(providerSyncDue([],now),true)
  assert.equal(providerSyncDue([row('AAPL','2026-10-27T09:00:00Z')],now),true)
})
test('automatic retries respect persistent 15-minute cooldown and unavailable storage',()=>{
  const signals=[row('AAPL',null)]
  assert.equal(autoSyncAllowed({getItem:()=>null},signals,now),true)
  assert.equal(autoSyncAllowed({getItem:key=>key===AUTO_SYNC_ATTEMPT_KEY?String(now-1000):null},signals,now),false)
  assert.equal(autoSyncAllowed({getItem:()=>String(now-16*60000)},signals,now),true)
  assert.equal(autoSyncAllowed({getItem:()=>{throw Error('Blocked')}},signals,now),false)
})
test('summary separates stock and crypto dates and reports oldest known receipt',()=>{
  const summary=providerFreshness([row('AAPL'),row('ONDS',null),row('BTC-USD','2026-10-26T08:58:00Z','Crypto')],now)
  assert.equal(summary.stockSession,'2026-10-23')
  assert.equal(summary.latestSession,'2026-10-26')
  assert.equal(summary.oldestReceipt,'2026-10-26T08:58:00.000Z')
  assert.equal(summary.unknownReceipts,1)
})
