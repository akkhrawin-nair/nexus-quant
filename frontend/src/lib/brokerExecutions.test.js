import test from 'node:test'
import assert from 'node:assert/strict'
import { compareOptionSnapshots, saveOptionComparison, loadOptionComparisons, recordBrokerExecution, OPTION_COMPARISONS_KEY } from './optionComparison.js'
import { reconcileBrokerExecutions, brokerExecutionSummary } from './brokerExecutions.js'

const now=Date.parse('2026-10-22T15:00:00Z'), later=Date.parse('2026-11-02T15:00:00Z')
const snapshot={source:'Dime',symbol:'AAPL',type:'call',strike:'250',expiration:'2026-10-30',multiplier:'100',bid:'.90',ask:'1',fee:'.65',quoteTime:'2026-10-22T14:59:30Z'}
const orderTicket={reference:'a',source:'Dime preview',symbol:'AAPL',type:'call',strike:'250',expiration:'2026-10-30',multiplier:'100',contracts:'2',limitPrice:'1.05',totalFees:'1',brokerTotal:'211',ticketTime:'2026-10-22T14:59:40Z',budget:'250',plannedExit:'2026-10-29',termsConfirmed:true}
const store=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)}}
const setup=(change={})=>{const storage=store();const saved=saveOptionComparison(storage,compareOptionSnapshots(snapshot,{...snapshot,source:'Webull'},{contracts:2,deliverableConfirmed:true,orderTicket:{...orderTicket,...change}},now),now);return {storage,record:saved.records[0]}}
const fill=(change={})=>({executionRef:'fill-1',source:'Dime execution history',environment:'broker_paper',contracts:'1',price:'1.02',totalFees:'.50',brokerDebit:'102.50',executedAt:'2026-10-22T15:01:00Z',termsConfirmed:true,note:'Copied individual execution',...change})

test('partial reports count only filled contracts; full fill uses weighted prices and actual entered fees',()=>{
  const {storage,record}=setup(), original=JSON.stringify(record)
  recordBrokerExecution(storage,record.id,fill(),later)
  let saved=loadOptionComparisons(storage).records[0], result=reconcileBrokerExecutions(saved)
  assert.equal(result.filledContracts,1);assert.equal(result.remainingContracts,1);assert.equal(result.status,'partial')
  assert.equal(result.calculatedDebit,102.50);assert.equal(result.limitCostForFilled,105.50)
  assert.equal(result.referenceCostForFilled,100.65);assert.equal(result.referenceCostDifference,1.85)
  assert.equal(result.feeDifference,0);assert.equal(result.weightedPrice,1.02)
  recordBrokerExecution(storage,record.id,fill({executionRef:'fill-2',price:'1.04',brokerDebit:'104.50',executedAt:'2026-10-22T15:02:00Z'}),later)
  saved=loadOptionComparisons(storage).records[0];result=reconcileBrokerExecutions(saved)
  assert.equal(result.status,'fully_reported');assert.equal(result.filledContracts,2)
  assert.equal(result.calculatedDebit,207);assert.equal(result.reportedDebit,207)
  assert.equal(result.weightedPrice,1.03);assert.equal(result.limitCostDifference,-4)
  assert.equal(result.referenceCostDifference,5.70)
  assert.deepEqual({...saved,executions:undefined},{...JSON.parse(original),executions:undefined})
  assert.equal(storage.getItem('kappa.optionPaperJournal.v1'),null)
  assert.equal(brokerExecutionSummary([saved]).ordersWithReports,1)
  assert.equal(brokerExecutionSummary([saved]).executionReports,2)
  const again=saveOptionComparison(storage,compareOptionSnapshots(snapshot,{...snapshot,source:'Webull'},{contracts:2,deliverableConfirmed:true,orderTicket},now),later)
  assert.equal(again.added,false)
  assert.equal(loadOptionComparisons(storage).records[0].executions.length,2)
})

test('identical execution labels deduplicate; conflicts and excess quantity preserve originals',()=>{
  const {storage,record}=setup()
  recordBrokerExecution(storage,record.id,fill(),later)
  const before=storage.getItem(OPTION_COMPARISONS_KEY)
  assert.equal(recordBrokerExecution(storage,record.id,fill(),later+1000).added,false)
  assert.equal(storage.getItem(OPTION_COMPARISONS_KEY),before)
  assert.throws(()=>recordBrokerExecution(storage,record.id,fill({price:'1.03'}),later),/already.*different/i)
  assert.throws(()=>recordBrokerExecution(storage,record.id,fill({executionRef:'fill-2',contracts:'2'}),later),/quantity/i)
  assert.equal(storage.getItem(OPTION_COMPARISONS_KEY),before)
  assert.throws(()=>recordBrokerExecution(storage,record.id,fill({executionRef:'real-fill',environment:'reported_real'}),later),/cannot be mixed/i)
  assert.equal(storage.getItem(OPTION_COMPARISONS_KEY),before)
})

test('evidence counts separate reported real and broker paper without asserting verification',()=>{
  const paper=setup(), real=setup()
  recordBrokerExecution(paper.storage,paper.record.id,fill(),later)
  recordBrokerExecution(real.storage,real.record.id,fill({environment:'reported_real',contracts:'2',brokerDebit:'204.50'}),later)
  const records=[loadOptionComparisons(paper.storage).records[0],loadOptionComparisons(real.storage).records[0]]
  const summary=brokerExecutionSummary(records)
  assert.equal(summary.ordersWithReports,2);assert.equal(summary.executionReports,2)
  assert.equal(summary.reportedRealOrders,1);assert.equal(summary.brokerPaperOrders,1)
  assert.equal(summary.partial,1);assert.equal(summary.fullyReported,1)
  assert.equal(summary.independentlyVerified,0)
})

test('source clock tolerance accepts five seconds and rejects six without changing records',()=>{
  const {storage,record}=setup()
  const captured=Date.parse('2026-10-22T15:00:55Z')
  recordBrokerExecution(storage,record.id,fill(),captured)
  const before=storage.getItem(OPTION_COMPARISONS_KEY)
  assert.throws(()=>recordBrokerExecution(storage,record.id,fill({executionRef:'fill-2',executedAt:'2026-10-22T15:01:01Z'}),captured),/5 seconds/)
  assert.equal(storage.getItem(OPTION_COMPARISONS_KEY),before)
})

test('execution contract identifiers are checked independently and saved with the original report',()=>{
  const {storage,record}=setup()
  const before=storage.getItem(OPTION_COMPARISONS_KEY)
  assert.throws(()=>recordBrokerExecution(storage,record.id,fill({contractSymbol:'AAPL261030P00250000'}),later),/differs/i)
  assert.equal(storage.getItem(OPTION_COMPARISONS_KEY),before)
  recordBrokerExecution(storage,record.id,fill({contractSymbol:'AAPL  261030C00250000'}),later)
  assert.equal(loadOptionComparisons(storage).records[0].executions[0].input.contractSymbol,'AAPL261030C00250000')
})

test('preserves adverse evidence and reconciles each report instead of cancelling discrepancies',()=>{
  const {storage,record}=setup()
  recordBrokerExecution(storage,record.id,fill({price:'1.06',brokerDebit:'106.51'}),later)
  recordBrokerExecution(storage,record.id,fill({executionRef:'fill-2',price:'1',brokerDebit:'100.49',executedAt:'2026-10-30T15:02:00Z'}),later)
  const result=reconcileBrokerExecutions(loadOptionComparisons(storage).records[0])
  assert.equal(result.limitPriceBreaches,1);assert.equal(result.debitMismatches,2)
  assert.equal(result.totalDebitDifference,0);assert.equal(result.afterPlannedExit,1)
  assert.equal(result.feeDifference,0)
})

test('invalid and future reports, non-ticket comparisons and failed writes cannot change history',()=>{
  const {storage,record}=setup(), before=storage.getItem(OPTION_COMPARISONS_KEY)
  for(const change of [{contracts:'1.5'},{price:'NaN'},{price:'0'},{totalFees:'-1'},{brokerDebit:'1.001'},{termsConfirmed:false},{executionRef:''},{executedAt:'2026-10-22T14:00:00Z'},{executedAt:'2026-11-03T15:00:00Z'},{executedAt:'2026-10-31T15:00:00Z'}]){
    assert.throws(()=>recordBrokerExecution(storage,record.id,fill(change),later))
    assert.equal(storage.getItem(OPTION_COMPARISONS_KEY),before)
  }
  const noTicket=saveOptionComparison(storage,compareOptionSnapshots(snapshot,snapshot,{contracts:2,deliverableConfirmed:true},now),now).records[0]
  assert.throws(()=>recordBrokerExecution(storage,noTicket.id,fill(),later),/order.*ticket/i)
  const current=storage.getItem(OPTION_COMPARISONS_KEY)
  storage.setItem=()=>{throw Error('quota exceeded')}
  assert.throws(()=>recordBrokerExecution(storage,record.id,fill(),later),/quota/)
  assert.equal(storage.getItem(OPTION_COMPARISONS_KEY),current)
})

test('damaged execution records block reads and writes; unmatched references have no cost comparison',()=>{
  const {storage,record}=setup({symbol:'EOSE'})
  recordBrokerExecution(storage,record.id,fill(),later)
  const saved=loadOptionComparisons(storage).records[0]
  assert.equal(reconcileBrokerExecutions(saved).referenceCostDifference,null)
  const bad={...saved,executions:saved.executions.map(e=>({...e,input:{...e.input,contracts:3}}))}
  const raw=JSON.stringify({version:1,records:[bad]});storage.setItem(OPTION_COMPARISONS_KEY,raw)
  assert.throws(()=>loadOptionComparisons(storage))
  assert.throws(()=>recordBrokerExecution(storage,record.id,fill(),later))
  assert.equal(storage.getItem(OPTION_COMPARISONS_KEY),raw)
  assert.equal(brokerExecutionSummary([]).ordersWithReports,0)
})
