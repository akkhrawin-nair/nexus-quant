import test from 'node:test'
import assert from 'node:assert/strict'
import { researchFreshness } from './researchFreshness.js'

const now=Date.parse('2026-10-22T15:00:00Z')
test('today daily bars remain unconfirmed and recent history is not labeled live',()=>{
  assert.equal(researchFreshness('2026-10-22','2026-11-05',now).kind,'current_unconfirmed')
  const previous=researchFreshness('2026-10-21','2026-11-04',now)
  assert.equal(previous.ageDays,1)
  assert.equal(previous.kind,'recent')
})
test('old and expired projections are distinguished without reanchoring their dates',()=>{
  const old=researchFreshness('2026-10-16','2026-10-30',now)
  assert.equal(old.kind,'older')
  assert.equal(old.ageDays,6)
  assert.equal(old.expired,false)
  assert.equal(researchFreshness('2026-10-01','2026-10-15',now).expired,true)
})
test('New York dates control aging; missing, impossible and future dates remain explicit',()=>{
  assert.equal(researchFreshness('2026-10-21','2026-11-04',Date.parse('2026-10-22T01:00:00Z')).ageDays,0)
  for(const stamp of [null,'bad','2026-02-30'])assert.equal(researchFreshness(stamp,null,now).kind,'unknown')
  assert.equal(researchFreshness('2026-10-23','2026-11-06',now).kind,'future')
})
