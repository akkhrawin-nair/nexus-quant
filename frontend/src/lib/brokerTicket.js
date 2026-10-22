import { optionEstimate, marketDate } from './options.js'
import { confirmOptionContract } from './optionContract.js'
const cents=value=>Math.round((value+Number.EPSILON)*100)/100
export const emptyOrderTicket=()=>({reference:'a',source:'',contractSymbol:'',symbol:'',type:'call',strike:'',expiration:'',multiplier:'100',contracts:'1',limitPrice:'',totalFees:'',brokerTotal:'',ticketTime:'',budget:'',plannedExit:'',termsConfirmed:false})

export function checkBrokerTicket(reference,referenceContracts,input,now=Date.now()) {
  const number=(key,max)=>{
    const raw=String(input[key]??'').trim(), value=Number(raw)
    if(!raw || !Number.isFinite(value) || value<0 || value>max)throw new Error(`Enter a valid ${key} from 0 to ${max}.`)
    return value
  }
  const source=String(input.source??'').trim()
  if(!source || source.length>60 || [...source].some(c=>c.charCodeAt(0)<32 || c.charCodeAt(0)===127))throw new Error('Enter the broker order-preview source (up to 60 characters).')
  if(!['a','b'].includes(input.reference))throw new Error('Choose reference snapshot A or B.')
  const estimate=optionEstimate({...input,bid:input.limitPrice,ask:input.limitPrice,fee:0,quoteTime:input.ticketTime},now)
  const ref=optionEstimate({...reference,contracts:referenceContracts},now)
  const contractSymbol=input.contractSymbol!==undefined && input.contractSymbol!=='' ? confirmOptionContract(input.contractSymbol,estimate) : null
  const totalFees=number('totalFees',1e8), brokerTotal=number('brokerTotal',1e12), budget=number('budget',1e9)
  const exit=Date.parse(`${input.plannedExit}T00:00:00Z`)
  if(!Number.isFinite(exit) || new Date(exit).toISOString().slice(0,10)!==input.plannedExit)throw new Error('Enter a valid planned exit date.')
  const normalized={reference:input.reference,source,symbol:estimate.symbol,type:estimate.type,strike:estimate.strike,expiration:estimate.expiration,
    multiplier:estimate.multiplier,contracts:estimate.contracts,limitPrice:estimate.ask,totalFees,brokerTotal,budget,
    ticketTime:new Date(estimate.quoteTime).toISOString(),plannedExit:input.plannedExit,termsConfirmed:input.termsConfirmed===true,
    ...(contractSymbol ? {contractSymbol} : {})}
  const mismatches=['symbol','type','strike','expiration','multiplier','contracts'].filter(key=>estimate[key]!==ref[key])
  const comparable=!mismatches.length && normalized.termsConfirmed
  const expectedDebit=cents(estimate.buyCost+totalFees), totalDifference=cents(brokerTotal-expectedDebit)
  const timeGapSeconds=Math.abs(estimate.quoteTime-ref.quoteTime)/1000
  const checks=[
    {id:'identifier',label:'Broker option identifier',attention:!contractSymbol,detail:contractSymbol ? `${contractSymbol} parses consistently with the entered ticker, expiration, call/put and strike. Deliverable and multiplier remain user-confirmed.` : 'No exact identifier captured in this legacy/manual input. Identity has not been parsed; independently recheck the broker contract.'},
    {id:'contract',label:'Entered contract and quantity',attention:!!mismatches.length,detail:mismatches.length ? `Mismatch: ${mismatches.join(', ')}. Cross-contract cost differences are blocked.` : 'Entered fields match the selected reference.'},
    {id:'terms',label:'Exact contract / deliverable acknowledgement',attention:!normalized.termsConfirmed,detail:'Broker contract identifier, deliverable and multiplier require your confirmation; inputs are not independently verified.'},
    {id:'total',label:'Broker total reconciliation',attention:totalDifference!==0,detail:`Broker debit minus calculated limit debit: $${totalDifference.toFixed(2)}. Recheck currency, fee basis and quantity if different.`},
    {id:'freshness',label:'Entered timestamps',attention:estimate.stale || ref.stale,detail:'Both source timestamps must be within the local 60-second threshold. A recent entered time does not establish a live quote.'},
    {id:'timeGap',label:'Time between snapshots',attention:timeGapSeconds>5,detail:`${timeGapSeconds.toFixed(1)} seconds apart; local threshold 5 seconds. Differences do not establish a pricing error or opportunity.`},
    {id:'budget',label:'Ticket premium budget',attention:Math.max(expectedDebit,brokerTotal)>budget,detail:`Uses the higher of calculated limit debit and entered broker debit against your $${budget.toFixed(2)} cap.`},
    {id:'exit',label:'14-day exit plan',attention:input.plannedExit<marketDate(now) || input.plannedExit>estimate.expiration,detail:`Exit ${input.plannedExit}; expiration ${estimate.expiration} is within 14 New York calendar days. Market hours and broker cutoffs are unverified.`},
  ]
  return {input:normalized,expectedDebit,totalDifference,referenceQuoteTime:new Date(ref.quoteTime).toISOString(),referenceAskCost:ref.buyCost,mismatches,comparable,timeGapSeconds,checks,
    costDifference:comparable ? cents(expectedDebit-ref.buyCost) : null,
    feeDifference:comparable ? cents(totalFees-ref.fees) : null,verifiedForTrading:false}
}
