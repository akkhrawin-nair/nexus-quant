import { optionEstimate } from './options.js'
import { checkBrokerTicket } from './brokerTicket.js'
import { normalizeBrokerExecution, validateBrokerExecutions } from './brokerExecutions.js'
import { confirmOptionContract } from './optionContract.js'

export const OPTION_COMPARISONS_KEY='kappa.optionQuoteComparisons.v1'
const METHOD='bid-ask-comparison-v1'
const cents=value=>Math.round((value+Number.EPSILON)*100)/100
const validTime=value=>typeof value==='string' && Number.isFinite(Date.parse(value))

function normalize(snapshot,contracts,now) {
  const source=typeof snapshot?.source==='string' ? snapshot.source.trim() : ''
  if (!source || source.length>60 || [...source].some(char=>char.charCodeAt(0)<32 || char.charCodeAt(0)===127)) throw new Error('Enter a source name of 1–60 characters for each snapshot.')
  const estimate=optionEstimate({...snapshot,contracts},now)
  const contractSymbol=snapshot.contractSymbol!==undefined && snapshot.contractSymbol!=='' ? confirmOptionContract(snapshot.contractSymbol,estimate) : null
  if (estimate.buyCost>1e12) throw new Error('The comparison cost exceeds the supported $1 trillion range.')
  const input={source,symbol:estimate.symbol,type:estimate.type,strike:estimate.strike,expiration:estimate.expiration,
    multiplier:estimate.multiplier,bid:estimate.bid,ask:estimate.ask,fee:Number(snapshot.fee),quoteTime:new Date(estimate.quoteTime).toISOString(),
    ...(contractSymbol ? {contractSymbol} : {})}
  return {input,estimate}
}

export function compareOptionSnapshots(a,b,{contracts,deliverableConfirmed=false,orderTicket=null},now=Date.now()) {
  if (!Number.isFinite(now)) throw new Error('A valid comparison time is required.')
  const first=normalize(a,contracts,now), second=normalize(b,contracts,now)
  const mismatches=['symbol','type','strike','expiration','multiplier'].filter(key=>first.input[key]!==second.input[key])
  const confirmed=deliverableConfirmed===true
  const comparable=mismatches.length===0 && confirmed
  return {methodVersion:METHOD,comparedAt:new Date(now).toISOString(),contracts:first.estimate.contracts,
    deliverableConfirmed:confirmed,a:first,b:second,mismatches,comparable,
    timeGapSeconds:Math.abs(first.estimate.quoteTime-second.estimate.quoteTime)/1000,
    orderTicket:orderTicket ? checkBrokerTicket(orderTicket.reference==='b' ? second.input : first.input,first.estimate.contracts,orderTicket,now) : null,
    verifiedForTrading:false,differences:comparable ? {
      bid:second.estimate.bid-first.estimate.bid,ask:second.estimate.ask-first.estimate.ask,
      buyCost:cents(second.estimate.buyCost-first.estimate.buyCost),
      sellProceeds:cents(second.estimate.sellProceeds-first.estimate.sellProceeds),
      fees:cents(second.estimate.fees-first.estimate.fees),
    } : null}
}

function fingerprint(record) {
  const snapshot=input=>['source','symbol','type','strike','expiration','multiplier','bid','ask','fee','quoteTime','contractSymbol'].map(key=>input[key]??null)
  return JSON.stringify([snapshot(record.a),snapshot(record.b),record.contracts,record.deliverableConfirmed,record.orderTicket || null])
}
function validateRecord(record) {
  try {
    if(record && 'orderTicket' in record && (!record.orderTicket || typeof record.orderTicket!=='object' || Array.isArray(record.orderTicket)))return false
    if (!record || record.methodVersion!==METHOD || typeof record.id!=='string' || !record.id ||
      !validTime(record.comparedAt) || !validTime(record.savedAt) || Date.parse(record.savedAt)<Date.parse(record.comparedAt) ||
      typeof record.deliverableConfirmed!=='boolean' || typeof record.contracts!=='number') return false
    if(!validateBrokerExecutions(record))return false
    const rebuilt=compareOptionSnapshots(record.a,record.b,record,Date.parse(record.comparedAt))
    if(record.orderTicket && (Object.keys(rebuilt.orderTicket.input).length!==Object.keys(record.orderTicket).length ||
      !Object.entries(rebuilt.orderTicket.input).every(([key,value])=>record.orderTicket[key]===value)))return false
    return [[rebuilt.a.input,record.a],[rebuilt.b.input,record.b]].every(([normalized,stored])=>
      Object.keys(normalized).length===Object.keys(stored).length && Object.entries(normalized).every(([key,value])=>stored[key]===value))
  } catch {return false}
}

export function loadOptionComparisons(storage) {
  const raw=storage.getItem(OPTION_COMPARISONS_KEY)
  if (raw===null) return {version:1,records:[]}
  let journal
  try {journal=JSON.parse(raw)} catch {throw new Error('Option comparison history is unreadable. Original data was preserved; export a backup before clearing storage.')}
  if (!journal || journal.version!==1 || !Array.isArray(journal.records) || journal.records.length>200 ||
    !journal.records.every(validateRecord) || new Set(journal.records.map(r=>r.id)).size!==journal.records.length)
    throw new Error('Option comparison history has an invalid or unsupported format. Original data was preserved; export a backup.')
  return journal
}

export function saveOptionComparison(storage,comparison,now=Date.now()) {
  const journal=loadOptionComparisons(storage)
  if (!comparison || !validTime(comparison.comparedAt) || !Number.isFinite(now) || now<Date.parse(comparison.comparedAt)) throw new Error('A valid completed comparison is required before saving.')
  const original=compareOptionSnapshots(comparison.a.input,comparison.b.input,{...comparison,orderTicket:comparison.orderTicket?.input || null},Date.parse(comparison.comparedAt))
  const record={id:crypto.randomUUID(),methodVersion:METHOD,savedAt:new Date(now).toISOString(),comparedAt:original.comparedAt,
    contracts:original.contracts,deliverableConfirmed:original.deliverableConfirmed,a:original.a.input,b:original.b.input,
    ...(original.orderTicket ? {orderTicket:original.orderTicket.input} : {})}
  if (journal.records.some(old=>fingerprint(old)===fingerprint(record))) return {...journal,added:false}
  if (journal.records.length>=200) throw new Error('The 200-comparison limit is reached. Export a backup before managing browser storage.')
  const next={version:1,records:[record,...journal.records]}
  storage.setItem(OPTION_COMPARISONS_KEY,JSON.stringify(next))
  return {...next,added:true}
}

export function recordBrokerExecution(storage,recordId,input,now=Date.now()) {
  const journal=loadOptionComparisons(storage), record=journal.records.find(row=>row.id===recordId)
  if(!record?.orderTicket)throw new Error('Save a comparison with a broker order ticket before recording executions.')
  if(!Number.isFinite(now) || now<Date.parse(record.savedAt))throw new Error('Recording time cannot precede the saved comparison.')
  const normalized=normalizeBrokerExecution(record.orderTicket,input,now), executions=record.executions || []
  const existing=executions.find(execution=>execution.input.executionRef===normalized.executionRef)
  if(existing){
    if(!Object.entries(normalized).every(([key,value])=>existing.input[key]===value))throw new Error('This execution label already has different inputs. The original report was kept.')
    return {...journal,added:false}
  }
  if(executions.length>=100)throw new Error('The 100-execution report limit for this order is reached.')
  if(executions.length && executions[0].input.environment!==normalized.environment)throw new Error('Broker-paper and reported-real executions cannot be mixed on the same saved order.')
  const quantity=executions.reduce((sum,execution)=>sum+execution.input.contracts,0)+normalized.contracts
  if(quantity>record.orderTicket.contracts)throw new Error('Total reported execution quantity exceeds the saved order quantity. Do not enter cumulative totals as new executions.')
  const execution={version:1,id:crypto.randomUUID(),recordedAt:new Date(now).toISOString(),input:normalized}
  const next={version:1,records:journal.records.map(row=>row.id===recordId ? {...row,executions:[...executions,execution]} : row)}
  storage.setItem(OPTION_COMPARISONS_KEY,JSON.stringify(next))
  return {...next,added:true}
}
