import test from 'node:test'
import assert from 'node:assert/strict'
import { parseOptionContract, confirmOptionContract } from './optionContract.js'

const terms={symbol:'AAPL',type:'call',strike:250.125,expiration:'2026-10-30'}
test('parses compact and padded standard identifiers without losing fractional strike precision',()=>{
  const compact=parseOptionContract('aapl261030c00250125')
  assert.deepEqual(compact,{contractSymbol:'AAPL261030C00250125',symbol:'AAPL',type:'call',strike:250.125,expiration:'2026-10-30'})
  assert.deepEqual(parseOptionContract('AAPL  261030C00250125'),compact)
  assert.equal(confirmOptionContract('AAPL261030C00250125',terms),'AAPL261030C00250125')
})
test('rejects invalid dates, zero strike, malformed and adjusted identifiers',()=>{
  for(const input of ['',null,'AAPL260230C00250000','AAPL261030C00000000','AAPL1261030C00250000','../../bad','A APL261030C00250000','AAPL261030X00250000','AAPL 261030C00250000'])assert.throws(()=>parseOptionContract(input))
})
test('independently entered identifier must agree with all standard-root contract fields',()=>{
  for(const change of [{symbol:'EOSE'},{type:'put'},{strike:250},{expiration:'2026-10-29'}])assert.throws(()=>confirmOptionContract('AAPL261030C00250125',{...terms,...change}),/differs/i)
  assert.throws(()=>confirmOptionContract('BRKB261030C00250125',{...terms,symbol:'BRK.B'}),/root/i)
})
