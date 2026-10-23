import test from 'node:test'
import assert from 'node:assert/strict'
import { optionPanelForKey, fillOptionContract } from './optionWorkspace.js'

const now=Date.parse('2026-10-23T15:00:00Z')
test('contract import fills identity but clears prices, sizes and timestamps while preserving user limits',()=>{
  const form={symbol:'EOSE',type:'put',strike:'2',expiration:'2026-10-29',bid:'.9',ask:'1',quoteTime:'old',bidSize:'5',askSize:'8',contracts:'2',fee:'.65',multiplier:'10',budget:'250',maxSpreadPct:'12',plannedExit:'2026-10-29'}
  const imported=fillOptionContract(form,'AAPL  261030C00250125',now)
  assert.equal(imported.contractSymbol,'AAPL261030C00250125')
  assert.equal(imported.form.symbol,'AAPL');assert.equal(imported.form.type,'call')
  assert.equal(imported.form.strike,'250.125');assert.equal(imported.form.expiration,'2026-10-30')
  for(const key of ['bid','ask','quoteTime','bidSize','askSize'])assert.equal(imported.form[key],'')
  for(const key of ['contracts','fee','multiplier','budget','maxSpreadPct','plannedExit'])assert.equal(imported.form[key],form[key])
  assert.equal(form.symbol,'EOSE');assert.equal(form.ask,'1')
})
test('contract import enforces the fourteen-day window using New York dates',()=>{
  assert.throws(()=>fillOptionContract({},'AAPL261022C00250000',now),/14 calendar days/)
  assert.throws(()=>fillOptionContract({},'AAPL261107C00250000',now),/14 calendar days/)
  assert.equal(fillOptionContract({},'AAPL261106C00250000',now).form.expiration,'2026-11-06')
  assert.equal(fillOptionContract({},'AAPL261023C00250000',Date.parse('2026-10-24T01:00:00Z')).form.expiration,'2026-10-23')
  assert.throws(()=>fillOptionContract({},'AAPL260230C00250000',now))
})
test('workspace keyboard navigation wraps tabs and supports Home/End without consuming other keys',()=>{
  assert.equal(optionPanelForKey('ArrowRight','plan'),'compare')
  assert.equal(optionPanelForKey('ArrowRight','journal'),'plan')
  assert.equal(optionPanelForKey('ArrowLeft','plan'),'journal')
  assert.equal(optionPanelForKey('Home','journal'),'plan')
  assert.equal(optionPanelForKey('End','plan'),'journal')
  assert.equal(optionPanelForKey('Tab','plan'),null)
  assert.equal(optionPanelForKey('ArrowRight','unknown'),null)
})
