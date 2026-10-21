import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { getPortfolio, resetPortfolio, openPosition, closePosition, addFunds, calculatePortfolioStats } from './paperTradingStorage.js'

let values
beforeEach(() => {
  values = new Map()
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }
  globalThis.window = { dispatchEvent() {} }
  globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail } }
})

test('legacy $10000 portfolio survives migration', () => {
  values.set('nexus_quant_paper_portfolio', JSON.stringify({balance: 10000, initialBalance: 10000, positions: [], history: [{id: 'saved', pnlDollar: 5}]}))
  const p = getPortfolio()
  assert.equal(p.balance, 10000)
  assert.equal(p.history[0].id, 'saved')
  assert.equal(p.version, 2)
})

test('malformed stored data is preserved and reported, not overwritten', () => {
  values.set('nexus_quant_paper_portfolio', '{broken')
  const p = getPortfolio()
  assert.ok(p.storageError)
  assert.equal(values.get('nexus_quant_paper_portfolio'), '{broken')
  assert.equal(openPosition({symbol:'QQQ', entryPrice: 100, amount: 1}).success, false)
})

test('nonfinite and negative prices, amounts, and deposits are rejected', () => {
  resetPortfolio(100)
  for (const bad of [Infinity, NaN, -1, 0]) {
    assert.equal(openPosition({symbol:'QQQ', entryPrice: bad, amount: 1}).success, false)
    assert.equal(openPosition({symbol:'QQQ', entryPrice: 100, amount: bad}).success, false)
    assert.equal(addFunds(bad).success, false)
  }
  const {position} = openPosition({symbol:'QQQ', entryPrice: 100, amount: 1})
  for (const bad of [Infinity, NaN, -1, 0]) assert.equal(closePosition(position.id, bad).success, false)
})

test('fractional crypto buy and close preserve cent-precision equity', () => {
  resetPortfolio(6)
  const result = openPosition({symbol: 'BTC-USD', entryPrice: 124567.89, amount: 1.5})
  assert.equal(result.success, true)
  assert.ok(Math.abs(result.position.quantity * result.position.entryPrice - result.position.totalCost) < .005)
  assert.equal(closePosition(result.position.id, 124567.89).success, true)
  assert.equal(getPortfolio().balance, 6)
})

test('deposit increases capital without becoming profit', () => {
  resetPortfolio(6)
  addFunds(4)
  const stats = calculatePortfolioStats(getPortfolio())
  assert.equal(stats.totalEquity, 10)
  assert.equal(stats.allTimeRoiDollar, 0)
})

test('zero-cost or zero-quantity buys are rejected', () => {
  resetPortfolio(10)
  assert.equal(openPosition({symbol:'QQQ', entryPrice: 100, amount: .001}).success, false)
  assert.equal(openPosition({symbol:'QQQ', entryPrice: 1e20, amount: 1}).success, false)
})

test('storage write failure does not report a successful trade', () => {
  resetPortfolio(10)
  globalThis.localStorage.setItem = () => { throw new Error('quota exceeded') }
  assert.equal(openPosition({symbol:'QQQ', entryPrice: 100, amount: 1}).success, false)
})

test('profit factor is undefined without losses; breakeven is not a win streak', () => {
  const base = {balance:10, initialBalance:10, positions:[], history:[{id:'even',pnlDollar:0,exitDate:'2026-01-03'}, {id:'win',pnlDollar:1,exitDate:'2026-01-02'}]}
  const stats = calculatePortfolioStats(base)
  assert.equal(stats.profitFactor,null)
  assert.equal(stats.currentStreak,0)
  assert.equal(stats.wins,1)
})

test('invalid legacy history blocks trading while preserving storage', () => {
  const raw=JSON.stringify({balance:10,initialBalance:10,positions:[],history:[null]})
  values.set('nexus_quant_paper_portfolio',raw)
  assert.ok(getPortfolio().storageError)
  assert.equal(values.get('nexus_quant_paper_portfolio'),raw)
})

test('overflowing prices and deposits cannot corrupt a saved portfolio', () => {
  resetPortfolio(10)
  const {position}=openPosition({symbol:'TEST',entryPrice:1,amount:5})
  const before=values.get('nexus_quant_paper_portfolio')
  assert.equal(closePosition(position.id,1e308).success,false)
  assert.equal(values.get('nexus_quant_paper_portfolio'),before)
  assert.equal(addFunds(1e308).success,false)
  assert.equal(values.get('nexus_quant_paper_portfolio'),before)
  assert.throws(()=>resetPortfolio(1e308),/balance|cash|range|finite/i)
  assert.equal(values.get('nexus_quant_paper_portfolio'),before)
})
