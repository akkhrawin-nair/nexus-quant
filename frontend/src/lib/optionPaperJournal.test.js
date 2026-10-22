import test from 'node:test'
import assert from 'node:assert/strict'
import { optionEstimate } from './options.js'
import { openOptionPaperPosition, loadOptionPaperJournal, recordOptionPaperExit, optionPaperStatus, optionPaperSummary, optionPaperReview, setOptionPaperRiskLimit, previewOptionPaperRestore, restoreOptionPaperBackup, OPTION_PAPER_KEY } from './optionPaperJournal.js'

const now=Date.parse('2026-10-22T15:00:00Z')
const ticket=(change={})=>{
  const plan={symbol:'AAPL',type:'call',strike:'250',expiration:'2026-10-30',bid:'.90',ask:'1',contracts:'2',multiplier:'100',fee:'.65',quoteTime:'2026-10-22T14:59:45Z',bidSize:'5',askSize:'5',budget:'250',maxSpreadPct:'20',plannedExit:'2026-10-29',...change}
  return {plan,estimate:optionEstimate(plan,now),quote:null}
}
const confirmation={sourceName:'Webull manually copied',termsConfirmed:true}
const memory=()=>{const map=new Map([[OPTION_PAPER_KEY,JSON.stringify({version:1,positions:[],riskLimit:1000})]]);return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}}
const exit=(change={})=>({kind:'bid_reference',bid:'1.20',fee:'.65',quoteTime:'2026-10-23T15:00:00Z',sourceName:'Webull manually copied',termsConfirmed:true,note:'Paper assumption',...change})

test('backup preview is read-only; restore merges, preserves local cap and skips equivalent duplicates',()=>{
  const source=memory(), target=memory()
  openOptionPaperPosition(source,ticket(),confirmation,now)
  const first=loadOptionPaperJournal(source).positions[0]
  const reordered=Object.fromEntries(Object.entries({...first,id:'different-id'}).reverse())
  target.setItem(OPTION_PAPER_KEY,JSON.stringify({version:1,riskLimit:100,positions:[reordered]}))
  openOptionPaperPosition(source,ticket({symbol:'EOSE'}),confirmation,now)
  const raw=source.getItem(OPTION_PAPER_KEY), before=target.getItem(OPTION_PAPER_KEY)
  const preview=previewOptionPaperRestore(target,raw)
  assert.equal(preview.added,1);assert.equal(preview.duplicates,1)
  assert.equal(preview.riskLimit,100);assert.equal(preview.openEntryCost,402.60)
  assert.equal(target.getItem(OPTION_PAPER_KEY),before)
  restoreOptionPaperBackup(target,raw,preview.baseRaw)
  assert.equal(loadOptionPaperJournal(target).positions.length,2)
  assert.equal(loadOptionPaperJournal(target).riskLimit,100)
  const again=previewOptionPaperRestore(target,raw)
  assert.equal(again.added,0);assert.equal(again.duplicates,2)
})

test('empty-browser restore recovers exported cap and expired outcomes without changing originals',()=>{
  const source=memory(), target={...memory(),getItem:()=>null}
  const id=openOptionPaperPosition(source,ticket(),confirmation,now).id
  recordOptionPaperExit(source,id,exit(),Date.parse('2026-11-01T15:00:00Z'))
  const raw=source.getItem(OPTION_PAPER_KEY), written=[]
  target.setItem=(key,value)=>written.push([key,value])
  const preview=previewOptionPaperRestore(target,raw)
  assert.equal(preview.riskLimit,1000)
  restoreOptionPaperBackup(target,raw,preview.baseRaw)
  assert.deepEqual(JSON.parse(written[0][1]),JSON.parse(raw))
})

test('conflicts, malformed files, stale previews and write failures preserve local records',()=>{
  const source=memory(), target=memory()
  const id=openOptionPaperPosition(source,ticket(),confirmation,now).id
  const raw=source.getItem(OPTION_PAPER_KEY)
  target.setItem(OPTION_PAPER_KEY,raw)
  recordOptionPaperExit(source,id,exit(),now+86400000)
  const before=target.getItem(OPTION_PAPER_KEY)
  assert.throws(()=>previewOptionPaperRestore(target,source.getItem(OPTION_PAPER_KEY)),/conflict/i)
  for(const bad of ['{broken',JSON.stringify({version:2,positions:[]}), ' '.repeat(2*1024*1024+1)])assert.throws(()=>previewOptionPaperRestore(target,bad))
  assert.equal(target.getItem(OPTION_PAPER_KEY),before)
  const preview=previewOptionPaperRestore(target,raw)
  setOptionPaperRiskLimit(target,500)
  assert.throws(()=>restoreOptionPaperBackup(target,raw,preview.baseRaw),/changed.*preview/i)
  const changed=target.getItem(OPTION_PAPER_KEY)
  target.setItem=()=>{throw Error('quota exceeded')}
  assert.throws(()=>restoreOptionPaperBackup(target,raw,changed),/quota/)
  assert.equal(target.getItem(OPTION_PAPER_KEY),changed)
})

test('restoration refuses a merge beyond 200 positions and preserves unreadable local data',()=>{
  const store=memory(), source=memory()
  const record=openOptionPaperPosition(source,ticket(),confirmation,now).positions[0]
  const positions=Array.from({length:200},(_,i)=>({...record,id:`id-${i}`,ticket:{...record.ticket,symbol:`T${i}`}}))
  store.setItem(OPTION_PAPER_KEY,JSON.stringify({version:1,positions}))
  assert.throws(()=>previewOptionPaperRestore(store,source.getItem(OPTION_PAPER_KEY)),/200/)
  store.setItem(OPTION_PAPER_KEY,'{broken')
  assert.throws(()=>previewOptionPaperRestore(store,source.getItem(OPTION_PAPER_KEY)))
  assert.equal(store.getItem(OPTION_PAPER_KEY),'{broken')
})

test('outcome review uses all closed records, net fees, separate assumptions and explicit denominators',()=>{
  const store=memory()
  setOptionPaperRiskLimit(store,2000)
  const ids=['AAPL','EOSE','ONDS','MSFT','QQQ'].map(symbol=>openOptionPaperPosition(store,ticket({symbol}),confirmation,now).id)
  const later=Date.parse('2026-10-31T15:00:00Z')
  recordOptionPaperExit(store,ids[0],exit(),later)
  recordOptionPaperExit(store,ids[1],exit({bid:'.90',quoteTime:'2026-10-30T15:00:00Z'}),later)
  recordOptionPaperExit(store,ids[2],exit({bid:'1.013'}),later)
  recordOptionPaperExit(store,ids[3],{kind:'zero_recovery',zeroRecoveryConfirmed:true,note:'Synthetic assumption'},later)
  const journal=loadOptionPaperJournal(store), before=store.getItem(OPTION_PAPER_KEY)
  const review=optionPaperReview(journal.positions,later)
  assert.equal(review.closed,4)
  assert.equal(review.wins,1);assert.equal(review.losses,2);assert.equal(review.breakeven,1)
  assert.equal(review.winRatePct,25)
  assert.equal(review.netPnl,-186.50)
  assert.equal(review.closedEntryCost,805.20)
  assert.equal(review.closedFees,9.10)
  assert.equal(review.averagePnl,-46.625)
  assert.ok(Math.abs(review.returnOnClosedEntryPct-(-186.5/805.2*100))<1e-9)
  assert.equal(review.bidReferences,3);assert.equal(review.zeroRecovery,1)
  assert.equal(review.missedPlannedExit,2);assert.equal(review.missedDeadline,1)
  assert.equal(review.openPastPlannedExit,1);assert.equal(review.openExpired,1)
  assert.equal(store.getItem(OPTION_PAPER_KEY),before)
})

test('outcome review never scores open positions or invents percentages for an empty sample',()=>{
  const empty=optionPaperReview([],now)
  assert.equal(empty.closed,0);assert.equal(empty.netPnl,0)
  assert.equal(empty.winRatePct,null);assert.equal(empty.averagePnl,null)
  assert.equal(empty.returnOnClosedEntryPct,null)
  const store=memory(), opened=openOptionPaperPosition(store,ticket(),confirmation,now)
  const review=optionPaperReview(opened.positions,now)
  assert.equal(review.closedFees,0);assert.equal(review.closedEntryCost,0)
  assert.equal(review.openPastPlannedExit,0);assert.equal(review.openExpired,0)
})

test('combined cap includes fees, accepts its exact boundary and blocks excess without mutation',()=>{
  const store=memory()
  setOptionPaperRiskLimit(store,'402.60')
  openOptionPaperPosition(store,ticket(),confirmation,now)
  openOptionPaperPosition(store,ticket({symbol:'EOSE'}),confirmation,now)
  const before=store.getItem(OPTION_PAPER_KEY)
  assert.equal(optionPaperSummary(loadOptionPaperJournal(store).positions).openEntryCost,402.60)
  assert.throws(()=>openOptionPaperPosition(store,ticket({symbol:'ONDS'}),confirmation,now),/combined.*limit/i)
  assert.equal(store.getItem(OPTION_PAPER_KEY),before)
  assert.equal(openOptionPaperPosition(store,ticket(),confirmation,now).added,false)
})

test('legacy journals remain readable but need a cap for new entries; exits release commitment',()=>{
  const store=memory()
  store.setItem(OPTION_PAPER_KEY,JSON.stringify({version:1,positions:[]}))
  assert.equal(loadOptionPaperJournal(store).positions.length,0)
  assert.throws(()=>openOptionPaperPosition(store,ticket(),confirmation,now),/set.*limit/i)
  setOptionPaperRiskLimit(store,201.30)
  const opened=openOptionPaperPosition(store,ticket(),confirmation,now)
  assert.equal(optionPaperStatus(opened.positions[0],now+20*86400000).kind,'expired')
  assert.equal(optionPaperSummary(opened.positions).openEntryCost,201.30)
  recordOptionPaperExit(store,opened.id,{kind:'zero_recovery',zeroRecoveryConfirmed:true,note:'Synthetic zero recovery'},now+1000)
  assert.equal(loadOptionPaperJournal(store).riskLimit,201.30)
  assert.equal(openOptionPaperPosition(store,ticket({symbol:'EOSE'}),confirmation,now+2000).added,true)
})

test('lowering the cap preserves positions and blocks entries; invalid settings preserve stored data',()=>{
  const store=memory()
  openOptionPaperPosition(store,ticket(),confirmation,now)
  setOptionPaperRiskLimit(store,100)
  assert.equal(loadOptionPaperJournal(store).positions.length,1)
  assert.throws(()=>openOptionPaperPosition(store,ticket({symbol:'EOSE'}),confirmation,now),/combined.*limit/i)
  const before=store.getItem(OPTION_PAPER_KEY)
  for(const value of ['',-1,'NaN',Infinity,1000000001,'1.001'])assert.throws(()=>setOptionPaperRiskLimit(store,value))
  assert.equal(store.getItem(OPTION_PAPER_KEY),before)
  store.setItem=()=>{throw Error('quota exceeded')}
  assert.throws(()=>setOptionPaperRiskLimit(store,500),/quota/)
  assert.equal(store.getItem(OPTION_PAPER_KEY),before)
})

test('invalid stored cap blocks writes without damaging legacy positions',()=>{
  const store=memory()
  openOptionPaperPosition(store,ticket(),confirmation,now)
  const journal=loadOptionPaperJournal(store)
  for(const cap of [-1,'500',null,1.001]){
    const raw=JSON.stringify({...journal,riskLimit:cap});store.setItem(OPTION_PAPER_KEY,raw)
    assert.throws(()=>loadOptionPaperJournal(store))
    assert.throws(()=>setOptionPaperRiskLimit(store,500))
    assert.equal(store.getItem(OPTION_PAPER_KEY),raw)
  }
})

test('saves original contract, entry assumptions and provenance without duplicating a ticket',()=>{
  const store=memory(), input=ticket()
  const saved=openOptionPaperPosition(store,input,confirmation,now)
  input.plan.ask='5'
  const record=loadOptionPaperJournal(store).positions[0]
  assert.equal(record.entryCost,201.30)
  assert.equal(record.ticket.ask,1)
  assert.equal(record.ticket.multiplier,100)
  assert.equal(record.source.name,'Webull manually copied')
  assert.equal(record.source.kind,'manual')
  assert.equal(record.deadline,'2026-10-30')
  assert.equal(openOptionPaperPosition(store,ticket(),confirmation,now+1000).added,false)
  assert.equal(saved.positions.length,1)
  assert.equal(store.getItem('nexus_quant_paper_portfolio'),null)
})

test('bid-based exits include both entry and exit fees and preserve the entry ticket',()=>{
  const store=memory(), opened=openOptionPaperPosition(store,ticket(),confirmation,now)
  const closed=recordOptionPaperExit(store,opened.positions[0].id,exit(),Date.parse('2026-10-23T15:01:00Z'))
  const position=closed.positions[0]
  assert.equal(position.outcome.proceeds,238.70)
  assert.equal(position.outcome.pnlDollar,37.40)
  assert.ok(Math.abs(position.outcome.returnPct-18.5792)<.0001)
  assert.equal(position.outcome.quoteTime,'2026-10-23T15:00:00.000Z')
  assert.equal(position.outcome.exitDateMissed,false)
  assert.equal(position.ticket.ask,1)
  assert.equal(optionPaperSummary(closed.positions).realizedPnl,37.40)
  assert.throws(()=>recordOptionPaperExit(store,position.id,exit(),Date.parse('2026-10-23T15:02:00Z')),/already/)
})

test('entry requires current reviewed limits, recent quote and contract acknowledgement',()=>{
  for(const change of [{budget:'100'},{maxSpreadPct:'5'},{askSize:'1'},{plannedExit:'2026-10-31'},{quoteTime:'2026-10-22T14:58:00Z'}])
    assert.throws(()=>openOptionPaperPosition(memory(),ticket(change),confirmation,now))
  assert.throws(()=>openOptionPaperPosition(memory(),ticket(),{...confirmation,termsConfirmed:false},now))
  assert.throws(()=>openOptionPaperPosition(memory(),ticket(),confirmation,now+86400000))
})

test('expired positions remain open until an explicit outcome; zero bid is never called a sale',()=>{
  const store=memory(), record=openOptionPaperPosition(store,ticket(),confirmation,now).positions[0]
  assert.equal(optionPaperStatus(record,Date.parse('2026-10-27T15:00:00Z')).kind,'due_soon')
  assert.equal(optionPaperStatus(record,Date.parse('2026-10-29T15:00:00Z')).kind,'due_today')
  assert.equal(optionPaperStatus(record,Date.parse('2026-10-30T15:00:00Z')).kind,'overdue')
  const later=Date.parse('2026-10-31T15:00:00Z')
  assert.equal(optionPaperStatus(record,later).kind,'expired')
  assert.equal(loadOptionPaperJournal(store).positions[0].outcome,null)
  assert.throws(()=>recordOptionPaperExit(store,record.id,exit({bid:'0'}),later),/zero/i)
  assert.throws(()=>recordOptionPaperExit(store,record.id,exit({quoteTime:'2026-10-31T14:59:00Z'}),later),/expir/i)
  assert.throws(()=>recordOptionPaperExit(store,record.id,{kind:'zero_recovery',zeroRecoveryConfirmed:false,note:'Assumption'},later))
  const closed=recordOptionPaperExit(store,record.id,{kind:'zero_recovery',zeroRecoveryConfirmed:true,note:'Assumed no recovery; settlement not verified'},later).positions[0]
  assert.equal(closed.outcome.proceeds,0)
  assert.equal(closed.outcome.pnlDollar,-201.30)
  assert.equal(closed.outcome.returnPct,-100)
  assert.equal(closed.outcome.kind,'zero_recovery')
  assert.equal(closed.outcome.afterExpiration,true)
})

test('historical pre-expiration exit quotes retain their source time and flag a missed planned date',()=>{
  const store=memory(), record=openOptionPaperPosition(store,ticket(),confirmation,now).positions[0]
  const result=recordOptionPaperExit(store,record.id,exit({quoteTime:'2026-10-30T15:00:00Z'}),Date.parse('2026-11-01T15:00:00Z'))
  assert.equal(result.positions[0].outcome.exitDateMissed,true)
  assert.equal(result.positions[0].outcome.afterExpiration,false)
  assert.equal(result.positions[0].outcome.recordedAt,'2026-11-01T15:00:00.000Z')
  assert.equal(loadOptionPaperJournal(store).positions[0].outcome.proceeds,238.70)
})

test('corrupt data and failed writes preserve the journal and never report successful recording',()=>{
  const store=memory();store.setItem(OPTION_PAPER_KEY,'{broken')
  assert.throws(()=>loadOptionPaperJournal(store))
  assert.throws(()=>openOptionPaperPosition(store,ticket(),confirmation,now))
  assert.equal(store.getItem(OPTION_PAPER_KEY),'{broken')
  const good=memory(), record=openOptionPaperPosition(good,ticket(),confirmation,now).positions[0]
  good.setItem=()=>{throw Error('quota exceeded')}
  assert.throws(()=>recordOptionPaperExit(good,record.id,exit(),Date.parse('2026-10-23T15:01:00Z')),/quota/)
  assert.equal(loadOptionPaperJournal(good).positions[0].outcome,null)
})

test('provider metadata must match the exact ticket and only selected provenance is saved',()=>{
  const input=ticket()
  input.quote={provider:'Alpaca',feed:'opra',contract:'AAPL261030C00250000',symbol:'AAPL',type:'call',strike:'250',expiration:'2026-10-30',bid:.9,ask:1,quote_time:'2026-10-22T14:59:45Z',fetched_at:'2026-10-22T14:59:50Z',unused:'not saved'}
  const store=memory(), opened=openOptionPaperPosition(store,input,{termsConfirmed:true},now)
  assert.equal(opened.positions[0].source.kind,'provider_snapshot')
  assert.equal(opened.positions[0].source.contract,'AAPL261030C00250000')
  assert.equal(JSON.stringify(opened).includes('not saved'),false)
  assert.equal(loadOptionPaperJournal(store).positions.length,1)
  input.quote.contract='EOSE261030C00250000'
  assert.throws(()=>openOptionPaperPosition(memory(),input,{termsConfirmed:true},now),/provenance/)
})

test('invalid or misdated exits cannot alter an open record, and damaged entry costs block writes',()=>{
  const store=memory(), record=openOptionPaperPosition(store,ticket(),confirmation,now).positions[0]
  const before=store.getItem(OPTION_PAPER_KEY), later=Date.parse('2026-10-23T15:01:00Z')
  for(const change of [{bid:'NaN'},{fee:'-1'},{termsConfirmed:false},{sourceName:''},{quoteTime:'2026-10-22T14:00:00Z'},{quoteTime:'2026-10-24T15:00:00Z'}]){
    assert.throws(()=>recordOptionPaperExit(store,record.id,exit(change),later))
    assert.equal(store.getItem(OPTION_PAPER_KEY),before)
  }
  const bad=JSON.parse(before);bad.positions[0].entryCost=1
  const raw=JSON.stringify(bad);store.setItem(OPTION_PAPER_KEY,raw)
  assert.throws(()=>loadOptionPaperJournal(store))
  assert.throws(()=>recordOptionPaperExit(store,record.id,exit(),later))
  assert.equal(store.getItem(OPTION_PAPER_KEY),raw)
})
