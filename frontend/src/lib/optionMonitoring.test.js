import test from 'node:test'
import assert from 'node:assert/strict'
import { optionEstimate } from './options.js'
import { openOptionPaperPosition, recordOptionPaperExit, recordOptionPaperMark, optionPaperSummary, optionRemainingContracts, loadOptionPaperJournal, optionPaperMarkStatus, OPTION_PAPER_KEY } from './optionPaperJournal.js'
const start=Date.parse('2026-10-23T15:00:00Z'),later=start+10000
const memory=()=>{const map=new Map([[OPTION_PAPER_KEY,JSON.stringify({version:1,riskLimit:1000,positions:[]})]]);return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}}
const plan={symbol:'EOSE',type:'call',strike:5,expiration:'2026-10-30',bid:.9,ask:1,contracts:3,multiplier:100,fee:.65,quoteTime:new Date(start).toISOString(),budget:1000,maxSpreadPct:20,plannedExit:'2026-10-29'}
function opened(){const s=memory();const id=openOptionPaperPosition(s,{plan,estimate:optionEstimate(plan,start)},{sourceName:'Dime manual',termsConfirmed:true},start).id;return {s,id}}
const exit=(contracts,time=later)=>({contracts,kind:'bid_reference',bid:1.2,fee:.65,quoteTime:new Date(time).toISOString(),sourceName:'Dime manual',termsConfirmed:true,note:''})
test('partial exits allocate original cost once, release only remaining premium and close on final quantity',()=>{
  const {s,id}=opened();let data=recordOptionPaperExit(s,id,exit(1),later)
  let p=data.positions[0];assert.equal(optionRemainingContracts(p),2);assert.equal(p.outcome,null)
  assert.equal(optionPaperSummary(data.positions).openEntryCost,201.30)
  assert.equal(optionPaperSummary(data.positions).realizedPnl,18.70)
  assert.throws(()=>recordOptionPaperExit(s,id,exit(1),later+1),/already recorded/)
  assert.equal(optionRemainingContracts(loadOptionPaperJournal(s).positions[0]),2)
  assert.throws(()=>recordOptionPaperExit(s,id,exit(3),later+1))
  data=recordOptionPaperExit(s,id,exit(2,later+2000),later+2000);p=data.positions[0]
  assert.equal(optionRemainingContracts(p),0);assert.equal(p.outcome.pnlDollar,56.10)
  assert.equal(optionPaperSummary(data.positions).realizedPnl,56.10)
  assert.equal(optionPaperSummary(data.positions).openEntryCost,0)
  assert.equal(loadOptionPaperJournal(s).positions[0].exits.length,2)
})
test('zero-recovery can cover only remaining quantity and corrupted partial history blocks mutations',()=>{
  const {s,id}=opened();recordOptionPaperExit(s,id,exit(1),later)
  const data=recordOptionPaperExit(s,id,{kind:'zero_recovery',contracts:2,zeroRecoveryConfirmed:true,note:'Paper loss assumption'},later+1000)
  assert.equal(data.positions[0].outcome.pnlDollar,-182.60)
  const bad=JSON.parse(s.getItem(OPTION_PAPER_KEY));bad.positions[0].exits[0].contracts=99;s.setItem(OPTION_PAPER_KEY,JSON.stringify(bad));const raw=s.getItem(OPTION_PAPER_KEY)
  assert.throws(()=>loadOptionPaperJournal(s));assert.equal(s.getItem(OPTION_PAPER_KEY),raw)
})
test('manual marks preserve quote time, distinguish stale and quantity changes, and never realize profit',()=>{
  const {s,id}=opened();let data=recordOptionPaperMark(s,id,exit(3),later)
  assert.equal(optionPaperSummary(data.positions).realizedPnl,0)
  assert.equal(optionPaperMarkStatus(data.positions[0],later).kind,'fresh_reference')
  assert.equal(optionPaperMarkStatus(data.positions[0],later+61000).kind,'stale')
  data=recordOptionPaperExit(s,id,exit(1,later+1000),later+1000)
  assert.equal(optionPaperMarkStatus(data.positions[0],later+1000).kind,'quantity_changed')
  assert.throws(()=>recordOptionPaperMark(s,id,exit(2,start),later+90000))
  assert.equal(loadOptionPaperJournal(s).positions[0].marks.length,1)
})

test('monitoring rejects values beyond the cent-safe supported range without writing',()=>{
  const s=memory(),large={...plan,multiplier:10000,contracts:10000,fee:0,bid:.0001,ask:.0001,budget:1e9}
  s.setItem(OPTION_PAPER_KEY,JSON.stringify({version:1,riskLimit:1e9,positions:[]}))
  const id=openOptionPaperPosition(s,{plan:large,estimate:optionEstimate(large,start)},{sourceName:'Dime manual',termsConfirmed:true},start).id
  const raw=s.getItem(OPTION_PAPER_KEY)
  assert.throws(()=>recordOptionPaperMark(s,id,{...exit(10000),bid:1e6},later))
  assert.equal(s.getItem(OPTION_PAPER_KEY),raw)
})
