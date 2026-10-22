import test from 'node:test'
import assert from 'node:assert/strict'
import { checkBrokerTicket } from './brokerTicket.js'
const now=Date.parse('2026-10-22T15:00:00Z')
const reference={symbol:'AAPL',type:'call',strike:250,expiration:'2026-10-30',multiplier:100,bid:.9,ask:1,fee:.65,quoteTime:'2026-10-22T14:59:30Z'}
const ticket={reference:'a',source:'Dime order preview',symbol:'AAPL',type:'call',strike:'250',expiration:'2026-10-30',multiplier:'100',contracts:'2',limitPrice:'1.05',totalFees:'1',brokerTotal:'211',ticketTime:'2026-10-22T14:59:40Z',budget:'250',plannedExit:'2026-10-29',termsConfirmed:true}
test('reconciles buy-to-open limit debit, total fees and ask reference without treating either as a fill',()=>{
  const result=checkBrokerTicket(reference,2,ticket,now)
  assert.equal(result.expectedDebit,211);assert.equal(result.totalDifference,0)
  assert.equal(result.referenceAskCost,201.30);assert.equal(result.costDifference,9.70)
  assert.equal(result.feeDifference,-.30);assert.equal(result.timeGapSeconds,10)
  assert.equal(result.verifiedForTrading,false)
  assert.equal(result.checks.find(c=>c.id==='timeGap').attention,true)
})
test('mismatches block cross-contract differences; totals and acknowledgements still require review',()=>{
  for(const change of [{symbol:'EOSE'},{type:'put'},{strike:'251'},{expiration:'2026-10-29'},{multiplier:'10'},{contracts:'1'}]){
    const result=checkBrokerTicket(reference,2,{...ticket,...change},now)
    assert.equal(result.comparable,false);assert.equal(result.costDifference,null)
  }
  const result=checkBrokerTicket(reference,2,{...ticket,brokerTotal:'211.02',budget:'210',termsConfirmed:false,plannedExit:'2026-10-31'},now)
  for(const id of ['total','budget','terms','exit'])assert.equal(result.checks.find(c=>c.id===id).attention,true)
})
test('ages original timestamps and rejects invalid ticket inputs',()=>{
  const result=checkBrokerTicket(reference,2,ticket,now+120000)
  assert.equal(result.checks.find(c=>c.id==='freshness').attention,true)
  for(const change of [{limitPrice:'0'},{totalFees:'-1'},{brokerTotal:'NaN'},{ticketTime:'2026-10-22T15:01:00Z'},{contracts:'1.5'},{source:''},{plannedExit:'2026-02-30'},{reference:'c'}])assert.throws(()=>checkBrokerTicket(reference,2,{...ticket,...change},now))
})

test('broker identifier is preserved and a wrong contract blocks reconciliation',()=>{
  const checked=checkBrokerTicket(reference,2,{...ticket,contractSymbol:'AAPL  261030C00250000'},now)
  assert.equal(checked.input.contractSymbol,'AAPL261030C00250000')
  assert.equal(checked.checks.find(c=>c.id==='identifier').attention,false)
  assert.equal(checkBrokerTicket(reference,2,ticket,now).checks.find(c=>c.id==='identifier').attention,true)
  for(const contractSymbol of ['AAPL261030P00250000','EOSE261030C00250000','AAPL261030C00251000'])assert.throws(()=>checkBrokerTicket(reference,2,{...ticket,contractSymbol},now),/differs/i)
})
