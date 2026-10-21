import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchingAlerts } from './alerts.js'
test('alerts only match actual finite observed values', () => {
  const rules = [{id:'one', ticker:'QQQ', condition:'ABOVE', targetValue:100, enabled:true}]
  assert.equal(matchingAlerts(rules, [{symbol:'QQQ', current_price:110}]).length,1)
  assert.equal(matchingAlerts(rules, [{symbol:'QQQ', current_price:null}]).length,0)
  assert.equal(matchingAlerts(rules, [{symbol:'QQQ', current_price:Infinity}]).length,0)
})
test('disabled and unsupported rules never trigger', () => {
  const rules = [{id:'off', ticker:'QQQ', condition:'ABOVE', targetValue:100, enabled:false},
    {id:'bad', ticker:'QQQ', condition:'WHALE', targetValue:1, enabled:true}]
  assert.deepEqual(matchingAlerts(rules,[{symbol:'QQQ',current_price:110}]),[])
})
