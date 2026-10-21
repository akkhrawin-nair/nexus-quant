import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { apiRequest, numericValue, compareMacdStrength } from './api.js'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
test('HTTP errors preserve the server explanation', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({error:'No observed history'}), {status:503})
  await assert.rejects(apiRequest('/x'), /No observed history/)
})
test('zero is observed; null and missing are unavailable', () => {
  assert.equal(numericValue(0), 0)
  assert.equal(numericValue(null), null)
  assert.equal(numericValue(undefined), null)
  assert.equal(numericValue(''), null)
})
test('MACD sorting compares MACD on both operands', () => {
  const data = [{macd:2, macd_signal:9}, {macd:5, macd_signal:1}]
  assert.equal(data.sort(compareMacdStrength)[0].macd, 5)
})
test('requests accept caller cancellation', async () => {
  globalThis.fetch = async (_url, {signal}) => new Promise((_resolve, reject) => {
    if (signal.aborted) reject(signal.reason)
    signal.addEventListener('abort', () => reject(signal.reason), {once:true})
  })
  const controller = new AbortController()
  const promise = apiRequest('/x', {signal:controller.signal})
  controller.abort()
  await assert.rejects(promise, {name:'AbortError'})
})
test('requests time out', async () => {
  globalThis.fetch = async (_url, {signal}) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), {once:true})
  })
  await assert.rejects(apiRequest('/x', {timeoutMs:10}), /timed out/i)
})
