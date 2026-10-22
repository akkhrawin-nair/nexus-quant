import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { getPortfolio, resetPortfolio, openPosition, closePosition, addFunds, calculatePortfolioStats, saveShareTradePlan, openPlannedPosition, plannedDeadline } from './paperTradingStorage.js'

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

const planNow=Date.parse('2026-10-21T15:00:00Z')
const planDraft=()=>({entry:'10',stop:'9',target:'12',capital:'1000',riskBudget:'50',feeBps:'100',slippageBps:'100',exitDate:'2026-11-04'})

test('saved share plan survives reload, remains fixed, and duplicate saving does not duplicate it',()=>{
  resetPortfolio(1000)
  const draft=planDraft(), saved=saveShareTradePlan('EOSE',draft,planNow)
  assert.equal(saved.success,true)
  draft.entry='20'
  assert.equal(getPortfolio().tradePlans[0].scenario.entry,10)
  assert.equal(getPortfolio().tradePlans[0].scenario.quantity,36)
  assert.equal(saveShareTradePlan('EOSE',planDraft(),planNow+1000).plan.id,saved.plan.id)
  assert.equal(getPortfolio().tradePlans.length,1)
  assert.equal(getPortfolio().balance,1000)
  assert.equal(getPortfolio().positions.length,0)
})

test('planned position uses whole shares and both entry and exit costs, preserving original risk',()=>{
  resetPortfolio(1000)
  const saved=saveShareTradePlan('EOSE',planDraft(),planNow)
  const opened=openPlannedPosition(saved.plan.id,planNow)
  assert.equal(opened.success,true)
  assert.equal(opened.position.quantity,36)
  assert.equal(opened.position.totalCost,367.24)
  assert.equal(getPortfolio().balance,632.76)
  assert.equal(openPlannedPosition(saved.plan.id,planNow).success,false)
  const closed=closePosition(opened.position.id,12,{now:planNow+86400000,priceSource:'Manual simulation'})
  assert.equal(closed.success,true)
  assert.equal(closed.closedTrade.exitValue,423.40)
  assert.equal(closed.closedTrade.pnlDollar,56.16)
  assert.ok(Math.abs(closed.closedTrade.realizedR-1.1304)<.0001)
  assert.equal(closed.closedTrade.tradePlan.scenario.stop,9)
  assert.equal(closed.closedTrade.exitPriceSource,'Manual simulation')
  assert.equal(getPortfolio().balance,1056.16)
  assert.equal(getPortfolio().tradePlans[0].positionId,opened.position.id)
  assert.equal(openPlannedPosition(saved.plan.id,planNow).success,false)
})

test('insufficient cash, stale plans and invalid scenarios cannot open a planned position',()=>{
  resetPortfolio(6)
  const saved=saveShareTradePlan('EOSE',planDraft(),planNow)
  const before=values.get('nexus_quant_paper_portfolio')
  assert.equal(openPlannedPosition(saved.plan.id,planNow).success,false)
  assert.equal(values.get('nexus_quant_paper_portfolio'),before)
  addFunds(1000)
  assert.equal(openPlannedPosition(saved.plan.id,planNow+86400000).success,false)
  assert.equal(saveShareTradePlan('EOSE',{...planDraft(),stop:'11'},planNow).success,false)
  assert.equal(saveShareTradePlan('EOSE',{...planDraft(),exitDate:'2026-11-05'},planNow).success,false)
  assert.equal(getPortfolio().positions.length,0)
})

test('date notices identify approaching and missed deadlines without blocking a late exit',()=>{
  resetPortfolio(1000)
  const saved=saveShareTradePlan('EOSE',planDraft(),planNow), opened=openPlannedPosition(saved.plan.id,planNow)
  assert.equal(plannedDeadline(opened.position,Date.parse('2026-11-02T15:00:00Z')).kind,'due_soon')
  assert.equal(plannedDeadline(opened.position,Date.parse('2026-11-04T15:00:00Z')).kind,'due_today')
  assert.equal(plannedDeadline(opened.position,Date.parse('2026-11-05T01:00:00Z')).kind,'due_today') // NY is still Nov 4.
  assert.equal(plannedDeadline(opened.position,Date.parse('2026-11-05T15:00:00Z')).kind,'overdue')
  const result=closePosition(opened.position.id,8,{now:Date.parse('2026-11-05T15:00:00Z')})
  assert.equal(result.success,true)
  assert.equal(result.closedTrade.exitDateMissed,true)
  assert.equal(plannedDeadline({entryPrice:10},planNow),null)
})

test('failed plan and planned-position writes do not claim success or alter balances',()=>{
  resetPortfolio(1000)
  const saved=saveShareTradePlan('EOSE',planDraft(),planNow)
  const before=values.get('nexus_quant_paper_portfolio')
  globalThis.localStorage.setItem=()=>{throw Error('quota exceeded')}
  assert.equal(openPlannedPosition(saved.plan.id,planNow).success,false)
  assert.equal(saveShareTradePlan('ONDS',planDraft(),planNow).success,false)
  assert.equal(values.get('nexus_quant_paper_portfolio'),before)
})

test('cent rounding cannot exceed a saved loss budget and missing quotes do not invent a loss',()=>{
  resetPortfolio(1000)
  const saved=saveShareTradePlan('EOSE',{...planDraft(),entry:'1.005',stop:'.994',target:'1.02',riskBudget:'.011',feeBps:'0',slippageBps:'0'},planNow)
  assert.equal(saved.success,true)
  assert.equal(openPlannedPosition(saved.plan.id,planNow).success,false)
  const normal=saveShareTradePlan('ONDS',planDraft(),planNow)
  const position=openPlannedPosition(normal.plan.id,planNow).position
  assert.equal(calculatePortfolioStats(getPortfolio(),{}).totalEquity,1000)
  assert.equal(calculatePortfolioStats(getPortfolio(),{ONDS:12}).totalEquity,1056.16)
  assert.equal(closePosition(position.id,12,{now:planNow}).success,true)
  assert.equal(closePosition(position.id,12,{now:planNow}).success,false)
})

test('damaged saved-plan details block mutations and preserve existing data',()=>{
  resetPortfolio(1000)
  saveShareTradePlan('EOSE',planDraft(),planNow)
  const broken=JSON.parse(values.get('nexus_quant_paper_portfolio'))
  broken.tradePlans[0].scenario.quantity=100
  const raw=JSON.stringify(broken)
  values.set('nexus_quant_paper_portfolio',raw)
  assert.ok(getPortfolio().storageError)
  assert.equal(saveShareTradePlan('ONDS',planDraft(),planNow).success,false)
  assert.equal(values.get('nexus_quant_paper_portfolio'),raw)
})
