import test from 'node:test'
import assert from 'node:assert/strict'
import { optionEstimate, reviewOptionEstimate } from './options.js'

const now = Date.parse('2026-10-16T15:00:00Z')
const input = { symbol: 'AAPL', type: 'call', strike: '250', expiration: '2026-10-23', bid: '0.80', ask: '1.00', contracts: '2', multiplier: '100', fee: '0.65', quoteTime: '2026-10-16T14:59:30Z' }
const plan = {bidSize:'5', askSize:'5', budget:'250', maxSpreadPct:'10', plannedExit:'2026-10-22'}

test('reviews premium budget, relative spread, displayed sizes, and manual provenance separately', () => {
  const review = reviewOptionEstimate(optionEstimate(input, now), plan, now)
  assert.ok(Math.abs(review.spreadPct - 22.22222222222222) < 1e-10)
  assert.equal(review.checks.find(c => c.id === 'budget').status, 'pass')
  assert.equal(review.checks.find(c => c.id === 'spread').status, 'attention')
  assert.equal(review.checks.find(c => c.id === 'buySize').status, 'pass')
  assert.equal(review.checks.find(c => c.id === 'source').status, 'unverified')
  assert.equal(review.verifiedForTrading, false)
  assert.equal(review.breakEvenExitBid, 1.013)
})

test('insufficient or missing sizes and over-budget purchases require attention', () => {
  const review = reviewOptionEstimate(optionEstimate(input, now), {...plan, askSize:'1', bidSize:'', budget:'100'}, now)
  for (const id of ['buySize', 'budget']) assert.equal(review.checks.find(c => c.id === id).status, 'attention')
  assert.equal(review.checks.find(c => c.id === 'sellSize').status, 'unverified')
  assert.equal(reviewOptionEstimate(optionEstimate(input, now), {...plan, bidSize:'0'}, now).checks.find(c=>c.id==='sellSize').status, 'attention')
})

test('freshness and date checks update as time passes without replacing the quote time', () => {
  const estimate = optionEstimate(input, now)
  const later = now + 61000
  assert.equal(reviewOptionEstimate(estimate, plan, later).checks.find(c=>c.id==='age').status, 'attention')
  const afterExpiry = Date.parse('2026-10-24T15:00:00Z')
  const review = reviewOptionEstimate(estimate, plan, afterExpiry)
  assert.equal(review.checks.find(c=>c.id==='expiry').status, 'attention')
  assert.equal(review.checks.find(c=>c.id==='exit').status, 'attention')
  assert.equal(estimate.quoteTime, Date.parse(input.quoteTime))
})

test('review thresholds handle exact spreads and the same 60-second freshness boundary as estimates', () => {
  const estimate = optionEstimate({...input, bid:'0.95', ask:'1.05'}, now)
  assert.equal(reviewOptionEstimate(estimate, plan, now).checks.find(c=>c.id==='spread').status, 'pass')
  const boundary = estimate.quoteTime + 60001
  assert.equal(reviewOptionEstimate(estimate, plan, boundary).checks.find(c=>c.id==='age').status, 'attention')
})

test('exit plan cannot pass beyond expiration or the 14-day holding window', () => {
  for (const plannedExit of ['2026-10-24','2026-10-31','2026-10-15']) {
    const review = reviewOptionEstimate(optionEstimate(input, now), {...plan, plannedExit}, now)
    assert.equal(review.checks.find(c=>c.id==='exit').status, 'attention')
  }
  for (const update of [{plannedExit:''}, {plannedExit:'2026-02-30'}, {budget:''}, {budget:'Infinity'}, {bidSize:'1.5'}, {askSize:'-1'}, {maxSpreadPct:'-1'}]) {
    assert.throws(()=>reviewOptionEstimate(optionEstimate(input, now), {...plan,...update}, now))
  }
})

test('uses ask for buy cost and bid for sell proceeds with per-side fees', () => {
  const result = optionEstimate(input, now)
  assert.equal(result.buyCost, 201.3)
  assert.equal(result.sellProceeds, 158.7)
  assert.equal(result.spreadCost, 40)
  assert.equal(result.roundTripLoss, 42.6)
  assert.equal(result.midpoint, 0.9)
  assert.equal(result.stale, false)
})

test('flags old quotes and uses the entered contract multiplier', () => {
  const result = optionEstimate({...input, multiplier: '10', quoteTime: '2026-10-16T14:00:00Z'}, now)
  assert.equal(result.buyCost, 21.3)
  assert.equal(result.stale, true)
})

test('rejects missing, crossed, nonfinite and invalid contract inputs', () => {
  for (const update of [{bid: ''}, {ask: ''}, {ask: 'NaN'}, {bid: '1.1'}, {bid: '-1'}, {ask: 'Infinity'}, {contracts: '1.5'}, {contracts: '0'}, {multiplier: '0'}, {fee: '-1'}, {quoteTime: ''}, {quoteTime: '2026-10-16T15:01:00Z'}, {strike: '0'}, {symbol: ''}, {type: 'other'}]) {
    assert.throws(() => optionEstimate({...input, ...update}, now), Error, JSON.stringify(update))
  }
  assert.equal(optionEstimate({...input, bid: '0'}, now).sellProceeds, -1.3)
})

test('enforces expiration within 14 New York calendar days including the boundary', () => {
  assert.doesNotThrow(() => optionEstimate({...input, expiration: '2026-10-30'}, now))
  for (const expiration of ['2026-10-31', '2026-10-15', '2026-02-30', '']) {
    assert.throws(() => optionEstimate({...input, expiration}, now), /expiration/i)
  }
  // Bangkok is already October 17, but the US market date is still October 16.
  assert.doesNotThrow(() => optionEstimate({...input, expiration: '2026-10-16', quoteTime:'2026-10-17T00:29:50Z'}, Date.parse('2026-10-17T00:30:00Z')))
})
