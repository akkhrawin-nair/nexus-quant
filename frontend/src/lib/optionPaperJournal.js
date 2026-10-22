import { optionEstimate, reviewOptionEstimate, marketDate } from './options.js'

export const OPTION_PAPER_KEY='kappa.optionPaperJournal.v1'
export const OPTION_PAPER_EVENT='optionPaperJournalUpdated'
const cents=value=>Math.round((value+Number.EPSILON)*100)/100
const validTime=value=>typeof value==='string' && Number.isFinite(Date.parse(value))
const safeText=(value,max=60)=>typeof value==='string' && value.trim().length>0 && value.trim().length<=max && ![...value].some(c=>c.charCodeAt(0)<32 || c.charCodeAt(0)===127)
const number=(value,min,max,label)=>{
  const text=String(value??'').trim(), parsed=Number(text)
  if(!text || !Number.isFinite(parsed) || parsed<min || parsed>max)throw new Error(`Enter a valid ${label} between ${min} and ${max}.`)
  return parsed
}

function entryDetails(plan,quoteTime,now) {
  const estimate=optionEstimate({...plan,quoteTime},now), review=reviewOptionEstimate(estimate,plan,now)
  const blocked=review.checks.find(check=>['age','expiry','exit','budget','spread','buySize'].includes(check.id) && check.status==='attention')
  if(blocked)throw new Error(`Cannot open this paper ticket: ${blocked.label} needs attention. Recheck the calculator inputs.`)
  if(estimate.buyCost<.01 || estimate.buyCost>1e9)throw new Error('The entry cost must be between $0.01 and $1 billion.')
  const ticket={symbol:estimate.symbol,type:estimate.type,strike:estimate.strike,expiration:estimate.expiration,
    bid:estimate.bid,ask:estimate.ask,contracts:estimate.contracts,multiplier:estimate.multiplier,fee:Number(plan.fee),
    quoteTime:new Date(estimate.quoteTime).toISOString(),bidSize:String(plan.bidSize??'').trim()==='' ? '' : Number(plan.bidSize),
    askSize:String(plan.askSize??'').trim()==='' ? '' : Number(plan.askSize),budget:Number(plan.budget),maxSpreadPct:Number(plan.maxSpreadPct),plannedExit:review.plannedExit}
  return {ticket,estimate,deadline:review.deadline,reviewFlags:review.checks.filter(check=>check.status!=='pass').map(check=>`${check.id}:${check.status}`)}
}

function contractMatches(contract,ticket) {
  const match=typeof contract==='string' && /^([A-Z]{1,6})(\d{6})([CP])(\d{8})$/.exec(contract)
  return !!match && match[1]===ticket.symbol && `20${match[2].slice(0,2)}-${match[2].slice(2,4)}-${match[2].slice(4,6)}`===ticket.expiration &&
    (match[3]==='C' ? 'call' : 'put')===ticket.type && Number(match[4])/1000===ticket.strike
}

function sourceFor(result,name,estimate) {
  if(!result.quote){
    if(!safeText(name))throw new Error('Enter the manually copied entry quote source (up to 60 characters).')
    return {kind:'manual',name:name.trim(),contract:null,fetchedAt:null}
  }
  const quote=result.quote
  if(quote.provider!=='Alpaca' || quote.feed!=='opra' || !contractMatches(quote.contract,estimate) ||
    quote.symbol!==estimate.symbol || quote.type!==estimate.type || Number(quote.strike)!==estimate.strike || quote.expiration!==estimate.expiration ||
    Number(quote.bid)!==estimate.bid || Number(quote.ask)!==estimate.ask || Date.parse(quote.quote_time)!==estimate.quoteTime)throw new Error('Provider provenance does not match the calculated ticket. Recalculate the quote.')
  return {kind:'provider_snapshot',name:'Alpaca OPRA snapshot',contract:quote.contract,
    fetchedAt:validTime(quote.fetched_at) ? new Date(quote.fetched_at).toISOString() : null}
}

function outcomeFor(position,input,now) {
  if(!Number.isFinite(now) || now<Date.parse(position.openedAt))throw new Error('Outcome recording cannot precede entry.')
  const recordedAt=new Date(now).toISOString()
  let bid=null,fee=0,quoteTime=null,sourceName,proceeds,kind=input.kind,termsConfirmed=false,zeroRecoveryConfirmed=false
  const note=String(input.note??'').trim()
  if(note.length>300)throw new Error('Keep outcome notes within 300 characters.')
  if(kind==='zero_recovery'){
    if(input.zeroRecoveryConfirmed!==true || !note)throw new Error('Explicitly confirm zero recovery and enter an explanation. No sale or settlement is verified.')
    sourceName='User-assumed zero recovery; no sale recorded';zeroRecoveryConfirmed=true;proceeds=0
  }else if(kind==='bid_reference'){
    bid=number(input.bid,0,1e6,'exit option bid')
    if(bid===0)throw new Error('A zero bid does not establish a sale. Use an explicit zero-recovery assumption if appropriate for your paper record.')
    fee=number(input.fee,0,10000,'exit fee per contract')
    if(input.termsConfirmed!==true || !safeText(input.sourceName))throw new Error('Confirm this exit bid belongs to the original contract and enter its source.')
    const stamp=Date.parse(input.quoteTime)
    if(!Number.isFinite(stamp) || stamp<Date.parse(position.openedAt) || stamp>now+5000)throw new Error('Enter an exit quote time after entry and no later than now.')
    if(marketDate(stamp)>position.ticket.expiration)throw new Error('An option sale reference cannot be dated after expiration. Record a pre-expiration quote or an explicit zero-recovery assumption.')
    quoteTime=new Date(stamp).toISOString();sourceName=input.sourceName.trim();termsConfirmed=true
    proceeds=cents(bid*position.ticket.contracts*position.ticket.multiplier-fee*position.ticket.contracts)
    if(!Number.isFinite(proceeds) || Math.abs(proceeds)>1e12)throw new Error('Exit proceeds exceed the supported finite range.')
  }else throw new Error('Choose an exit bid reference or a zero-recovery assumption.')
  const assumedExitAt=quoteTime || recordedAt, date=marketDate(Date.parse(assumedExitAt)), pnlDollar=cents(proceeds-position.entryCost)
  return {kind,bid,fee,quoteTime,sourceName,termsConfirmed,zeroRecoveryConfirmed,note,recordedAt,assumedExitAt,
    proceeds,pnlDollar,returnPct:pnlDollar/position.entryCost*100,
    exitDateMissed:date>position.ticket.plannedExit,deadlineMissed:date>position.deadline,afterExpiration:date>position.ticket.expiration}
}

function validPosition(position) {
  try {
    if(!position || position.version!==1 || typeof position.id!=='string' || !position.id || !validTime(position.openedAt) ||
      position.termsConfirmed!==true || !position.source || !safeText(position.source.name) ||
      !['manual','provider_snapshot'].includes(position.source.kind))return false
    if(position.source.kind==='manual' && (position.source.contract!==null || position.source.fetchedAt!==null))return false
    if(position.source.kind==='provider_snapshot' && (position.source.name!=='Alpaca OPRA snapshot' ||
      !contractMatches(position.source.contract,position.ticket) || (position.source.fetchedAt!==null && !validTime(position.source.fetchedAt))))return false
    const original=entryDetails(position.ticket,position.ticket.quoteTime,Date.parse(position.openedAt))
    if(position.entryDate!==original.estimate.entryDate || position.entryCost!==original.estimate.buyCost || position.entryFees!==original.estimate.fees || position.deadline!==original.deadline ||
      Object.keys(original.ticket).length!==Object.keys(position.ticket).length ||
      !Object.entries(original.ticket).every(([key,value])=>position.ticket[key]===value) ||
      JSON.stringify(position.reviewFlags)!==JSON.stringify(original.reviewFlags))return false
    if(position.outcome!==null){
      if(!validTime(position.outcome?.recordedAt))return false
      const rebuilt=outcomeFor(position,position.outcome,Date.parse(position.outcome.recordedAt))
      if(Object.keys(rebuilt).length!==Object.keys(position.outcome).length || !Object.entries(rebuilt).every(([key,value])=>position.outcome[key]===value))return false
    }
    return true
  }catch{return false}
}

export function loadOptionPaperJournal(storage) {
  const raw=storage.getItem(OPTION_PAPER_KEY)
  if(raw===null)return {version:1,positions:[]}
  let journal
  try{journal=JSON.parse(raw)}catch{throw new Error('Options paper journal is unreadable. Original data was preserved; export it before clearing storage.')}
  if(!journal || journal.version!==1 || !Array.isArray(journal.positions) || journal.positions.length>200 ||
    !journal.positions.every(validPosition) || new Set(journal.positions.map(p=>p.id)).size!==journal.positions.length ||
    (journal.riskLimit!==undefined && (typeof journal.riskLimit!=='number' || !Number.isFinite(journal.riskLimit) || journal.riskLimit<0 || journal.riskLimit>1e9 || cents(journal.riskLimit)!==journal.riskLimit)))
    throw new Error('Options paper journal has invalid or unsupported records. Original data was preserved; export a backup.')
  return journal
}

function writeJournal(storage,journal) {
  storage.setItem(OPTION_PAPER_KEY,JSON.stringify(journal))
  if(typeof window!=='undefined')window.dispatchEvent(new Event(OPTION_PAPER_EVENT))
}

const canonical=value=>value && typeof value==='object' ? (Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`) : JSON.stringify(value)
const entryIdentity=position=>canonical(Object.fromEntries(Object.entries(position).filter(([key])=>!['id','outcome'].includes(key))))
const recordIdentity=position=>canonical(Object.fromEntries(Object.entries(position).filter(([key])=>key!=='id')))

export function previewOptionPaperRestore(storage,raw) {
  if(typeof raw!=='string' || new TextEncoder().encode(raw).length>2*1024*1024)throw new Error('Choose a journal JSON backup no larger than 2 MB.')
  const incoming=loadOptionPaperJournal({getItem:()=>raw}), baseRaw=storage.getItem(OPTION_PAPER_KEY)
  const current=loadOptionPaperJournal({getItem:()=>baseRaw}), merged=[...current.positions], added=[]
  let duplicates=0
  for(const position of incoming.positions){
    const existing=merged.find(p=>p.id===position.id || entryIdentity(p)===entryIdentity(position))
    if(existing){
      if(recordIdentity(existing)!==recordIdentity(position))throw new Error('Backup conflict: an existing entry or outcome differs. No records were changed. Keep both exports for review.')
      duplicates++
    }else{merged.push(position);added.push(position)}
  }
  if(merged.length>200)throw new Error('Restoring would exceed the 200-position journal limit. No records were changed.')
  // Existing local settings always win, including an unset legacy limit.
  const riskLimit=baseRaw===null ? incoming.riskLimit : current.riskLimit
  const journal={version:1,positions:[...added,...current.positions],...(riskLimit===undefined ? {} : {riskLimit})}
  return {baseRaw,journal,added:added.length,duplicates,total:journal.positions.length,riskLimit,
    incomingCount:incoming.positions.length,openEntryCost:optionPaperSummary(journal.positions).openEntryCost}
}

export function restoreOptionPaperBackup(storage,raw,expectedRaw) {
  if(storage.getItem(OPTION_PAPER_KEY)!==expectedRaw)throw new Error('Your local journal changed since the preview. Preview this backup again before restoring.')
  const preview=previewOptionPaperRestore(storage,raw)
  writeJournal(storage,preview.journal)
  return {...preview.journal,restored:preview.added,duplicates:preview.duplicates}
}

export function setOptionPaperRiskLimit(storage,value) {
  const journal=loadOptionPaperJournal(storage), riskLimit=number(value,0,1e9,'combined paper premium limit')
  if(cents(riskLimit)!==riskLimit)throw new Error('Enter the combined paper premium limit with at most two decimal places.')
  const next={...journal,riskLimit}
  writeJournal(storage,next)
  return next
}

export function openOptionPaperPosition(storage,result,confirmation,now=Date.now()) {
  const journal=loadOptionPaperJournal(storage)
  if(!Number.isFinite(now) || !result?.plan || !result.estimate || result.estimate.entryDate!==marketDate(now))throw new Error('Calculate a current-day option ticket before opening a paper position.')
  if(confirmation.termsConfirmed!==true)throw new Error('Confirm the original contract, deliverable and multiplier in your broker first.')
  const entry=entryDetails(result.plan,result.quote?.quote_time || result.plan.quoteTime,now)
  if(!['symbol','type','strike','expiration','contracts','multiplier','bid','ask','quoteTime','buyCost'].every(key=>entry.estimate[key]===result.estimate[key]))throw new Error('The calculated ticket no longer matches the inputs. Recalculate it.')
  const source=sourceFor(result,confirmation.sourceName,entry.estimate)
  const existing=journal.positions.find(p=>p.entryDate===entry.estimate.entryDate && p.source.kind===source.kind && p.source.name===source.name &&
    Object.entries(entry.ticket).every(([key,value])=>p.ticket[key]===value))
  if(existing)return {...journal,added:false,id:existing.id}
  if(journal.riskLimit===undefined)throw new Error('Set a combined paper premium limit before opening a new position.')
  const committed=optionPaperSummary(journal.positions).openEntryCost
  if(Math.round(committed*100)+Math.round(entry.estimate.buyCost*100)>Math.round(journal.riskLimit*100))
    throw new Error('This entry exceeds your combined paper premium limit. Review open commitments or explicitly change the limit.')
  if(journal.positions.length>=200)throw new Error('The 200-position journal limit is reached. Export a backup before managing storage.')
  const position={version:1,id:crypto.randomUUID(),openedAt:new Date(now).toISOString(),entryDate:entry.estimate.entryDate,
    termsConfirmed:true,ticket:entry.ticket,source,entryCost:entry.estimate.buyCost,entryFees:entry.estimate.fees,
    deadline:entry.deadline,reviewFlags:entry.reviewFlags,outcome:null}
  const next={...journal,positions:[position,...journal.positions]}
  writeJournal(storage,next)
  return {...next,added:true,id:position.id}
}

export function recordOptionPaperExit(storage,id,input,now=Date.now()) {
  const journal=loadOptionPaperJournal(storage), position=journal.positions.find(p=>p.id===id)
  if(!position)throw new Error('Options paper position not found.')
  if(position.outcome)throw new Error('This position already has a recorded outcome; the original record was kept.')
  const outcome=outcomeFor(position,input,now)
  const next={...journal,positions:journal.positions.map(p=>p.id===id ? {...p,outcome} : p)}
  writeJournal(storage,next)
  return next
}

export function optionPaperStatus(position,now=Date.now()) {
  const today=marketDate(now), daysRemaining=(Date.parse(position.ticket.plannedExit)-Date.parse(today))/86400000
  return {date:position.ticket.plannedExit,daysRemaining,kind:position.outcome ? 'closed' : today>position.ticket.expiration ? 'expired' : daysRemaining<0 ? 'overdue' : daysRemaining===0 ? 'due_today' : daysRemaining<=2 ? 'due_soon' : 'open'}
}

export function optionPaperSummary(positions) {
  const closed=positions.filter(p=>p.outcome)
  return {open:positions.length-closed.length,closed:closed.length,
    openEntryCost:cents(positions.filter(p=>!p.outcome).reduce((sum,p)=>sum+p.entryCost,0)),
    realizedPnl:cents(closed.reduce((sum,p)=>sum+p.outcome.pnlDollar,0))}
}

// Descriptive statistics of recorded assumptions, never unrealized marks or fills.
export function optionPaperReview(positions,now=Date.now()) {
  const closed=positions.filter(p=>p.outcome), open=positions.filter(p=>!p.outcome)
  const sum=fn=>cents(closed.reduce((total,p)=>total+fn(p),0))
  const netPnl=sum(p=>p.outcome.pnlDollar), closedEntryCost=sum(p=>p.entryCost)
  const wins=closed.filter(p=>p.outcome.pnlDollar>0).length
  const today=marketDate(now)
  return {closed:closed.length,wins,losses:closed.filter(p=>p.outcome.pnlDollar<0).length,
    breakeven:closed.filter(p=>p.outcome.pnlDollar===0).length,
    winRatePct:closed.length ? wins/closed.length*100 : null,netPnl,closedEntryCost,
    averagePnl:closed.length ? netPnl/closed.length : null,
    returnOnClosedEntryPct:closedEntryCost ? netPnl/closedEntryCost*100 : null,
    closedFees:sum(p=>p.entryFees+(p.outcome.kind==='bid_reference' ? p.outcome.fee*p.ticket.contracts : 0)),
    bidReferences:closed.filter(p=>p.outcome.kind==='bid_reference').length,
    zeroRecovery:closed.filter(p=>p.outcome.kind==='zero_recovery').length,
    missedPlannedExit:closed.filter(p=>p.outcome.exitDateMissed).length,
    missedDeadline:closed.filter(p=>p.outcome.deadlineMissed).length,
    openPastPlannedExit:open.filter(p=>today>p.ticket.plannedExit).length,
    openExpired:open.filter(p=>today>p.ticket.expiration).length}
}
