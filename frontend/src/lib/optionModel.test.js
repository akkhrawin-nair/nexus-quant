import test from 'node:test'
import assert from 'node:assert/strict'
import { optionModel, impliedVolatility, modelScenarios } from './optionModel.js'

const input={spot:100,strike:100,days:14,iv:30,rate:4,dividend:0,type:'call'}
test('absolute prices and Greeks agree with an independent math.erf reference',()=>{
  // Reference calculated independently with Python math.erf for the normal CDF.
  const result=optionModel(input)
  assert(Math.abs(result.price-2.419271138060509)<.00002)
  assert(Math.abs(optionModel({...input,type:'put'}).price-2.2659641159856676)<.00002)
  assert(Math.abs(result.delta-.522125978805019)<.000001)
  assert(Math.abs(result.gamma-.06779576990908649)<.000001)
})
test('model satisfies put-call parity and Greeks match finite differences with explicit units',()=>{
  const c=optionModel(input), p=optionModel({...input,type:'put'}), h=.001
  assert(Math.abs(c.price-p.price-(100-100*Math.exp(-.04*14/365)))<1e-6)
  const up=optionModel({...input,spot:100+h}).price, down=optionModel({...input,spot:100-h}).price
  assert(Math.abs(c.delta-(up-down)/(2*h))<1e-4)
  assert(Math.abs(c.gamma-(up-2*c.price+down)/(h*h))<.001)
  assert(Math.abs(c.vega-(optionModel({...input,iv:30.001}).price-c.price)/.001)<1e-4)
  assert(c.theta<0); assert.equal(optionModel({...input,days:0}).price,0)
})
test('IV inversion recovers input and rejects prices outside the model range',()=>{
  const price=optionModel(input).price
  assert(Math.abs(impliedVolatility(input,price)-30)<1e-5)
  assert.equal(impliedVolatility(input,101),null)
  assert.equal(impliedVolatility({...input,days:0},1),null)
  for(const bad of [{iv:0},{spot:0},{days:15},{rate:NaN},{type:'bad'}])assert.throws(()=>optionModel({...input,...bad}))
})
test('scenarios stop at expiry, include intrinsic at expiry and do not mutate inputs',()=>{
  const rows=modelScenarios({...input,days:2})
  assert(rows.every(row=>row.elapsedDays<=2))
  assert(Math.abs(rows.find(row=>row.elapsedDays===2&&row.movePct===10).price-10)<1e-10)
  assert.equal(input.days,14)
})
