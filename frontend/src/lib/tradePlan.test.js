import test from 'node:test'
import assert from 'node:assert/strict'
import { shareTradePlan } from './tradePlan.js'

const draft={entry:'10', stop:'9', target:'12', capital:'1000', riskBudget:'50', feeBps:'10', slippageBps:'5', exitDate:'2026-11-04'}
const now=Date.parse('2026-10-21T15:00:00Z')
test('sizes whole shares using costs, available capital and the entered risk budget',()=>{
 const plan=shareTradePlan(draft,now)
 assert.ok(plan.quantity > 0)
 assert.ok(plan.entryCost<=1000)
 assert.ok(plan.plannedLoss<=50)
 assert.ok(plan.rewardRisk<2)
 assert.equal(plan.deadline,'2026-11-04')
})
test('insufficient budget produces zero shares rather than exceeding the risk limit',()=>{
 assert.equal(shareTradePlan({...draft, riskBudget:'0.10'},now).quantity,0)
})
test('rejects malformed levels, nonfinite amounts, and exit dates beyond 14 days',()=>{
 for(const update of [{entry:''},{stop:'10'},{target:'9'},{capital:'NaN'},{riskBudget:'-1'},{riskBudget:'2000'},{feeBps:'Infinity'},{exitDate:'2026-11-05'},{exitDate:'2026-10-20'},{exitDate:'2026-02-30'}])assert.throws(()=>shareTradePlan({...draft,...update},now))
})
