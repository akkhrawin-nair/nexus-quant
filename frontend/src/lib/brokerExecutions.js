import { marketDate } from './options.js'
import { confirmOptionContract } from './optionContract.js'
const cents=value=>Math.round((value+Number.EPSILON)*100)/100
const text=(value,max,label)=>{
  if(typeof value!=='string' || !value.trim() || value.trim().length>max || [...value].some(c=>c.charCodeAt(0)<32 || c.charCodeAt(0)===127))throw new Error(`Enter a valid ${label}, up to ${max} characters.`)
  return value.trim()
}

export function normalizeBrokerExecution(ticket,input,now) {
  if(!ticket)throw new Error('Save a broker order ticket before recording executions.')
  if(!Number.isFinite(now))throw new Error('A valid recording time is required.')
  const number=(key,min,max,whole=false)=>{
    const raw=String(input[key]??'').trim(), value=Number(raw)
    if(!raw || !Number.isFinite(value) || value<min || value>max || (whole && !Number.isInteger(value)))throw new Error(`Enter a valid execution ${key}.`)
    return value
  }
  if(!['broker_paper','reported_real'].includes(input.environment))throw new Error('Choose broker paper or user-reported real execution.')
  if(input.termsConfirmed!==true)throw new Error('Confirm this individual execution matches the saved buy-to-open contract, deliverable and USD currency.')
  const contractSymbol=input.contractSymbol!==undefined && input.contractSymbol!=='' ? confirmOptionContract(input.contractSymbol,ticket) : null
  const executed=Date.parse(input.executedAt)
  if(!Number.isFinite(executed) || executed<Date.parse(ticket.ticketTime) || executed>now+5000)throw new Error('Execution time must be at or after the saved preview time and no more than 5 seconds ahead of recording time (clock tolerance).')
  if(marketDate(executed)>ticket.expiration)throw new Error('A buy-to-open execution cannot be dated after expiration. Recheck the contract and timestamp.')
  const contracts=number('contracts',1,ticket.contracts,true), price=number('price',.0001,1e6)
  const totalFees=number('totalFees',0,1e8), brokerDebit=number('brokerDebit',0,1e12)
  if(cents(brokerDebit)!==brokerDebit)throw new Error('Enter the reported execution debit to the cent.')
  if(price*contracts*ticket.multiplier+totalFees>1e12)throw new Error('Execution debit exceeds the supported range.')
  const note=String(input.note??'').trim()
  if(note.length>300)throw new Error('Keep execution notes within 300 characters.')
  return {executionRef:text(input.executionRef,60,'execution label'),source:text(input.source,60,'execution source'),environment:input.environment,
    contracts,price,totalFees,brokerDebit,executedAt:new Date(executed).toISOString(),termsConfirmed:true,note,
    ...(contractSymbol ? {contractSymbol} : {})}
}

export function validateBrokerExecutions(record) {
  if(!('executions' in record))return true
  try{
    const list=record.executions
    if(!record.orderTicket || !Array.isArray(list) || list.length>100)return false
    let quantity=0
    const ids=new Set(), refs=new Set()
    for(const execution of list){
      if(!execution || execution.version!==1 || typeof execution.id!=='string' || !execution.id || ids.has(execution.id) ||
        typeof execution.recordedAt!=='string' || !Number.isFinite(Date.parse(execution.recordedAt)) || Date.parse(execution.recordedAt)<Date.parse(record.savedAt))return false
      const normalized=normalizeBrokerExecution(record.orderTicket,execution.input,Date.parse(execution.recordedAt))
      if(Object.keys(normalized).length!==Object.keys(execution.input).length || !Object.entries(normalized).every(([key,value])=>execution.input[key]===value) ||
        refs.has(normalized.executionRef) || (list[0].input.environment!==normalized.environment))return false
      ids.add(execution.id);refs.add(normalized.executionRef);quantity+=normalized.contracts
    }
    return quantity<=record.orderTicket.contracts
  }catch{return false}
}

export function reconcileBrokerExecutions(record) {
  const ticket=record.orderTicket, executions=record.executions || []
  if(!ticket)return null
  const reports=executions.map(execution=>{
    const input=execution.input, calculatedDebit=cents(input.price*input.contracts*ticket.multiplier+input.totalFees)
    return {...execution,calculatedDebit,debitDifference:cents(input.brokerDebit-calculatedDebit),
      limitPriceBreach:input.price-ticket.limitPrice>1e-9,afterPlannedExit:marketDate(Date.parse(input.executedAt))>ticket.plannedExit}
  })
  const sum=fn=>cents(reports.reduce((total,report)=>total+fn(report),0))
  const filledContracts=reports.reduce((total,report)=>total+report.input.contracts,0)
  const totalFees=sum(report=>report.input.totalFees), calculatedDebit=sum(report=>report.calculatedDebit), reportedDebit=sum(report=>report.input.brokerDebit)
  const reference=record[ticket.reference], referenceMatches=ticket.termsConfirmed &&
    ['symbol','type','strike','expiration','multiplier'].every(key=>reference[key]===ticket[key]) && record.contracts===ticket.contracts
  const limitCostForFilled=cents(ticket.limitPrice*filledContracts*ticket.multiplier+ticket.totalFees*filledContracts/ticket.contracts)
  const referenceCostForFilled=referenceMatches ? cents(reference.ask*filledContracts*ticket.multiplier+reference.fee*filledContracts) : null
  return {reports,filledContracts,remainingContracts:ticket.contracts-filledContracts,
    status:!filledContracts ? 'no_reports' : filledContracts===ticket.contracts ? 'fully_reported' : 'partial',
    environment:reports[0]?.input.environment || null,
    weightedPrice:filledContracts ? reports.reduce((total,report)=>total+report.input.price*report.input.contracts,0)/filledContracts : null,
    totalFees,calculatedDebit,reportedDebit,totalDebitDifference:cents(reportedDebit-calculatedDebit),
    limitCostForFilled,limitCostDifference:cents(calculatedDebit-limitCostForFilled),
    referenceCostForFilled,referenceCostDifference:referenceMatches ? cents(calculatedDebit-referenceCostForFilled) : null,
    feeDifference:cents(totalFees-ticket.totalFees*filledContracts/ticket.contracts),
    debitMismatches:reports.filter(report=>report.debitDifference!==0).length,
    limitPriceBreaches:reports.filter(report=>report.limitPriceBreach).length,
    afterPlannedExit:reports.filter(report=>report.afterPlannedExit).length}
}

export function brokerExecutionSummary(records) {
  const reviews=records.filter(record=>record.executions?.length).map(reconcileBrokerExecutions)
  return {ordersWithReports:reviews.length,executionReports:reviews.reduce((sum,review)=>sum+review.reports.length,0),
    reportedRealOrders:reviews.filter(review=>review.environment==='reported_real').length,
    brokerPaperOrders:reviews.filter(review=>review.environment==='broker_paper').length,
    fullyReported:reviews.filter(review=>review.status==='fully_reported').length,
    partial:reviews.filter(review=>review.status==='partial').length,
    withDiscrepancies:reviews.filter(review=>review.debitMismatches || review.limitPriceBreaches || review.afterPlannedExit).length,
    independentlyVerified:0}
}
