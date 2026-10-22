import test from 'node:test'
import assert from 'node:assert/strict'
import { compareOptionSnapshots, saveOptionComparison, loadOptionComparisons, OPTION_COMPARISONS_KEY } from './optionComparison.js'

const now=Date.parse('2026-10-22T15:00:00Z')
const snapshot=(source='Dime')=>({source,symbol:'AAPL',type:'call',strike:'250',expiration:'2026-10-30',multiplier:'100',bid:'.90',ask:'1.00',fee:'.65',quoteTime:'2026-10-22T14:59:30Z'})
const settings={contracts:2,deliverableConfirmed:true}
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}}

test('compares bid to bid and ask to ask, with fee impact separate from premium differences',()=>{
  const b={...snapshot('Webull'),bid:'.95',ask:'1.05',fee:'.50',quoteTime:'2026-10-22T14:59:40Z'}
  const result=compareOptionSnapshots(snapshot(),b,settings,now)
  assert.equal(result.comparable,true)
  assert.equal(result.a.estimate.buyCost,201.30)
  assert.equal(result.b.estimate.buyCost,211)
  assert.equal(result.differences.buyCost,9.70)
  assert.equal(result.differences.sellProceeds,10.30)
  assert.equal(result.differences.fees,-.30)
  assert.ok(Math.abs(result.differences.ask-.05)<1e-12)
  assert.equal(result.timeGapSeconds,10)
  assert.equal(result.verifiedForTrading,false)
})

test('changed contract terms block numeric comparisons instead of comparing different instruments',()=>{
  for(const [field,value] of [['symbol','EOSE'],['type','put'],['strike','251'],['expiration','2026-10-29'],['multiplier','10']]){
    const result=compareOptionSnapshots(snapshot(),{...snapshot('Webull'),[field]:value},settings,now)
    assert.equal(result.comparable,false)
    assert.ok(result.mismatches.includes(field))
    assert.equal(result.differences,null)
  }
  const unconfirmed=compareOptionSnapshots(snapshot(),snapshot('Webull'),{...settings,deliverableConfirmed:false},now)
  assert.equal(unconfirmed.comparable,false)
  assert.equal(unconfirmed.differences,null)
})

test('rejects invalid prices, timestamps, sources and expiration beyond fourteen days',()=>{
  for(const change of [{bid:'2'},{ask:'NaN'},{source:''},{source:'a\nb'},{quoteTime:'2026-10-22T15:00:10Z'},{expiration:'2026-11-06'},{multiplier:'0'}])
    assert.throws(()=>compareOptionSnapshots({...snapshot(),...change},snapshot('Webull'),settings,now))
  assert.throws(()=>compareOptionSnapshots(snapshot(),snapshot('Webull'),{...settings,contracts:1.5},now))
})

test('saving preserves snapshots, deduplicates identical quotes, and reloads history after expiration',t=>{
  const store=storage(), original=compareOptionSnapshots(snapshot(),snapshot('Webull'),settings,now)
  const saved=saveOptionComparison(store,original,now+1000)
  original.a.input.ask=99
  const again=saveOptionComparison(store,compareOptionSnapshots(snapshot(),snapshot('Webull'),settings,now+2000),now+3000)
  assert.equal(saved.records.length,1)
  assert.equal(again.added,false)
  t.mock.method(Date,'now',()=>Date.parse('2026-11-20T15:00:00Z'))
  const restored=loadOptionComparisons(store).records[0]
  assert.equal(restored.a.ask,1)
  assert.equal(restored.a.quoteTime,'2026-10-22T14:59:30.000Z')
  assert.equal(restored.savedAt,'2026-10-22T15:00:01.000Z')
  assert.equal(restored.comparedAt,'2026-10-22T15:00:00.000Z')
})

test('damaged storage and failed writes preserve existing records and report errors',()=>{
  const store=storage();store.setItem(OPTION_COMPARISONS_KEY,'{broken')
  const comparison=compareOptionSnapshots(snapshot(),snapshot('Webull'),settings,now)
  assert.throws(()=>loadOptionComparisons(store))
  assert.throws(()=>saveOptionComparison(store,comparison,now))
  assert.equal(store.getItem(OPTION_COMPARISONS_KEY),'{broken')
  const denied={getItem:()=>null,setItem:()=>{throw Error('quota exceeded')}}
  assert.throws(()=>saveOptionComparison(denied,comparison,now),/quota exceeded/)
})

test('broker ticket survives saving and expiration; duplicate saves preserve it and damaged fields block writes',()=>{
  const orderTicket={reference:'a',source:'Dime order preview',symbol:'AAPL',type:'call',strike:'250',expiration:'2026-10-30',multiplier:'100',contracts:'2',limitPrice:'1.05',totalFees:'1',brokerTotal:'211',ticketTime:'2026-10-22T14:59:40Z',budget:'250',plannedExit:'2026-10-29',termsConfirmed:true}
  const store=storage(), result=compareOptionSnapshots(snapshot(),snapshot('Webull'),{...settings,orderTicket},now)
  saveOptionComparison(store,result,now+1000)
  assert.equal(loadOptionComparisons(store).records[0].orderTicket.brokerTotal,211)
  assert.equal(saveOptionComparison(store,result,now+2000).added,false)
  assert.equal(loadOptionComparisons(store).records[0].savedAt,'2026-10-22T15:00:01.000Z')
  for(const bad of [false,null,{...orderTicket,brokerTotal:NaN}]){
    const raw=JSON.stringify({version:1,records:[{...loadOptionComparisons(store).records[0],orderTicket:bad}]})
    const broken=storage();broken.setItem(OPTION_COMPARISONS_KEY,raw)
    assert.throws(()=>loadOptionComparisons(broken))
    assert.equal(broken.getItem(OPTION_COMPARISONS_KEY),raw)
  }
})

test('captured snapshot identifiers normalize, persist and reject mismatched or tampered codes',()=>{
  const store=storage(), a={...snapshot(),contractSymbol:'AAPL  261030C00250000'}, b={...snapshot('Webull'),contractSymbol:'AAPL261030C00250000'}
  const result=compareOptionSnapshots(a,b,settings,now)
  saveOptionComparison(store,result,now)
  const saved=loadOptionComparisons(store).records[0]
  assert.equal(saved.a.contractSymbol,'AAPL261030C00250000')
  assert.equal(saved.b.contractSymbol,'AAPL261030C00250000')
  assert.throws(()=>compareOptionSnapshots({...a,contractSymbol:'AAPL261030P00250000'},b,settings,now),/differs/i)
  const bad={version:1,records:[{...saved,a:{...saved.a,contractSymbol:'EOSE261030C00250000'}}]}
  const raw=JSON.stringify(bad);store.setItem(OPTION_COMPARISONS_KEY,raw)
  assert.throws(()=>loadOptionComparisons(store))
  assert.throws(()=>saveOptionComparison(store,result,now))
  assert.equal(store.getItem(OPTION_COMPARISONS_KEY),raw)
})
