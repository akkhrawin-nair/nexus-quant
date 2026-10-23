import { FORECAST_JOURNAL_KEY, loadForecastJournal } from './forecastJournal.js'
import { OPTION_COMPARISONS_KEY, loadOptionComparisons } from './optionComparison.js'
import { OPTION_PAPER_KEY, loadOptionPaperJournal, previewOptionPaperRestore } from './optionPaperJournal.js'
import { CATALYST_KEY, loadCatalysts, WORKFLOW_EVENT } from './researchWorkflow.js'
import { getPortfolio } from '../utils/paperTradingStorage.js'

export const BACKUP_DATASETS={
  forecasts:{label:'Forecast journal',key:FORECAST_JOURNAL_KEY,load:loadForecastJournal,array:'records'},
  comparisons:{label:'Quote comparisons and execution reports',key:OPTION_COMPARISONS_KEY,load:loadOptionComparisons,array:'records'},
  options:{label:'Options paper journal and monitoring',key:OPTION_PAPER_KEY,load:loadOptionPaperJournal,array:'positions'},
  portfolio:{label:'Share portfolio and saved plans',key:'nexus_quant_paper_portfolio',load:getPortfolio,array:'positions'},
  catalysts:{label:'Sourced catalysts',key:CATALYST_KEY,load:loadCatalysts,array:'records'},
}
export const MAX_BACKUP_BYTES=32*1024*1024
const canonical=value=>value&&typeof value==='object'?(Array.isArray(value)?`[${value.map(canonical)}]`:`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`):JSON.stringify(value)
const identity=record=>canonical(Object.fromEntries(Object.entries(record).filter(([key])=>key!=='id')))
const datasetFor=kind=>{
  if(!Object.hasOwn(BACKUP_DATASETS,kind))throw new Error('Choose a supported backup dataset.')
  return BACKUP_DATASETS[kind]
}
function validate(kind,raw) {
  const dataset=datasetFor(kind),data=dataset.load({getItem:()=>raw})
  if(data.storageError)throw new Error(data.storageError)
  if(kind==='portfolio')validatePortfolioSnapshot(data)
  return data
}
function validatePortfolioSnapshot(data) {
  const fail=()=>{throw new Error('Share portfolio backup has invalid records, dates, quantities or cash/P&L arithmetic. Nothing was restored.')}
  const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=1e12
  const stamp=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))
  const cents=n=>Math.round((n+Number.EPSILON)*100)/100
  const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<.011
  const ids=new Set()
  for(const row of [...data.positions,...data.history]){
    if(typeof row.id!=='string'||!row.id||ids.has(row.id)||typeof row.symbol!=='string'||!/^[A-Z0-9^][A-Z0-9.^=-]{0,19}$/.test(row.symbol)||!positive(row.quantity)||!positive(row.entryPrice)||!positive(row.totalCost)||!stamp(row.entryDate))fail()
    ids.add(row.id)
    const planned=row.tradePlan
    if(planned){
      if(planned.positionId!==row.id||planned.scenario.quantity!==row.quantity||planned.scenario.entry!==row.entryPrice||!close(planned.scenario.entryCost,row.totalCost))fail()
    }else if(!close(cents(row.quantity*row.entryPrice),row.totalCost))fail()
  }
  for(const row of data.history){
    const fee=row.tradePlan?row.tradePlan.inputs.feeBps/10000:0,slip=row.tradePlan?row.tradePlan.inputs.slippageBps/10000:0
    if(!positive(row.exitPrice)||!stamp(row.exitDate)||Date.parse(row.exitDate)<Date.parse(row.entryDate)||!close(row.exitValue,cents(row.quantity*row.exitPrice*(1-slip)*(1-fee)))||!close(row.pnlDollar,cents(row.exitValue-row.totalCost))||!close(row.pnlPercent,cents(row.pnlDollar/row.totalCost*100)))fail()
  }
  const cash=data.initialBalance+data.history.reduce((sum,p)=>sum+p.pnlDollar,0)-data.positions.reduce((sum,p)=>sum+p.totalCost,0)
  if(!close(data.balance,cash))fail()
}
export function backupBundle(storage,now=Date.now()) {
  const raw=JSON.stringify({format:'kappa-backup-v1',createdAt:new Date(now).toISOString(),datasets:Object.fromEntries(Object.entries(BACKUP_DATASETS).map(([kind,d])=>[kind,storage.getItem(d.key)]))},null,2)
  if(new TextEncoder().encode(raw).length>MAX_BACKUP_BYTES)throw new Error('Combined backup exceeds 32 MB. Use individual exports and retain them for review.')
  return raw
}
export function previewBackup(storage,kind,raw) {
  const dataset=datasetFor(kind)
  if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_BACKUP_BYTES)throw new Error('Choose a JSON backup no larger than 32 MB.')
  let parsed;try{parsed=JSON.parse(raw)}catch{throw new Error('This is not a readable JSON backup. No data was changed.')}
  if(parsed?.format==='kappa-backup-v1'){
    if(typeof parsed.datasets?.[kind]!=='string')throw new Error('This bundle has no saved data for the selected dataset.')
    raw=parsed.datasets[kind]
  }
  const incoming=validate(kind,raw),baseRaw=storage.getItem(dataset.key)
  const current=validate(kind,baseRaw)
  if(kind==='options'){
    const preview=previewOptionPaperRestore(storage,raw,MAX_BACKUP_BYTES)
    return {baseRaw,data:preview.journal,added:preview.added,duplicates:preview.duplicates,total:preview.total,kind}
  }
  if(kind==='portfolio'){
    if(baseRaw!==null&&canonical(current)!==canonical(incoming))throw new Error('Share portfolio cash balances cannot be merged. Restore into a browser/profile with no saved share portfolio; existing cash and trades were preserved.')
    return {baseRaw,data:incoming,added:baseRaw===null?1:0,duplicates:baseRaw===null?0:1,total:incoming.positions.length+incoming.history.length+incoming.tradePlans.length,kind}
  }
  const list=[...current[dataset.array]];let added=0,duplicates=0
  for(const record of incoming[dataset.array]){
    const old=list.find(row=>row.id===record.id||identity(row)===identity(record))
    if(old){if(identity(old)!==identity(record))throw new Error('Backup conflict: a saved record differs. Keep both exports for review; no data was changed.');duplicates++}
    else{list.push(record);added++}
  }
  if(list.length>200)throw new Error('Restoring exceeds the 200-record limit. No data was changed.')
  const data={version:1,[dataset.array]:list}
  validate(kind,JSON.stringify(data))
  return {baseRaw,data,added,duplicates,total:list.length,kind}
}
export function restoreBackup(storage,kind,raw,expectedRaw) {
  const dataset=datasetFor(kind)
  if(storage.getItem(dataset.key)!==expectedRaw)throw new Error('Local data changed after preview. Preview the file again.')
  const preview=previewBackup(storage,kind,raw)
  storage.setItem(dataset.key,JSON.stringify(preview.data))
  if(typeof window!=='undefined'){
    window.dispatchEvent(new StorageEvent('storage',{key:dataset.key}))
    window.dispatchEvent(new Event(WORKFLOW_EVENT))
    window.dispatchEvent(new Event('paperPortfolioUpdated'))
  }
  return preview
}
