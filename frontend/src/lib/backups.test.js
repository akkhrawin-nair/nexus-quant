import test from 'node:test'
import assert from 'node:assert/strict'
import { backupBundle, previewBackup, restoreBackup, BACKUP_DATASETS } from './backups.js'
import { saveCatalyst } from './researchWorkflow.js'
import { optionEstimate } from './options.js'
import { openOptionPaperPosition, recordOptionPaperMark, OPTION_PAPER_KEY } from './optionPaperJournal.js'
import { saveForecast } from './forecastJournal.js'
import { compareOptionSnapshots, saveOptionComparison } from './optionComparison.js'
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}}
const now=Date.parse('2026-10-23T15:00:00Z')
test('all five legacy dataset exports validate and round trip without adding secrets',()=>{
  const s=memory(),target=memory()
  const shapes={forecasts:{version:1,records:[]},comparisons:{version:1,records:[]},options:{version:1,positions:[],riskLimit:50},portfolio:{version:2,balance:6,initialBalance:6,positions:[],history:[],tradePlans:[]},catalysts:{version:1,records:[]}}
  for(const [kind,data]of Object.entries(shapes)){
    const raw=JSON.stringify(data),preview=previewBackup(target,kind,raw)
    restoreBackup(target,kind,raw,preview.baseRaw)
    assert.deepEqual(JSON.parse(target.getItem(BACKUP_DATASETS[kind].key)),data)
    s.setItem(BACKUP_DATASETS[kind].key,raw)
  }
  s.setItem('ALPACA_SECRET','never-export-this')
  const bundle=backupBundle(s,now);assert(!bundle.includes('never-export-this'))
  assert.equal(previewBackup(memory(),'options',bundle).total,0)
})
test('restore preview merges identical records, blocks conflicting data and detects cross-tab changes',()=>{
  const source=memory(),target=memory()
  saveCatalyst(source,{symbol:'EOSE',title:'Event',eventDate:'2026-10-30',publishedDate:'2026-10-23',url:'https://example.com',kind:'issuer'},now)
  const raw=source.getItem(BACKUP_DATASETS.catalysts.key),preview=previewBackup(target,'catalysts',raw)
  assert.equal(target.getItem(BACKUP_DATASETS.catalysts.key),null)
  restoreBackup(target,'catalysts',raw,preview.baseRaw)
  assert.equal(previewBackup(target,'catalysts',raw).duplicates,1)
  const conflict=JSON.parse(raw);conflict.records[0].title='Changed'
  assert.throws(()=>previewBackup(target,'catalysts',JSON.stringify(conflict)),/conflict/i)
  assert.throws(()=>restoreBackup(target,'catalysts',raw,null),/changed/i)
  assert.equal(target.getItem(BACKUP_DATASETS.catalysts.key),raw)
})
test('cash cannot be merged; malformed, oversized and failed writes never claim success',()=>{
  const s=memory(),raw=JSON.stringify({version:2,balance:10,initialBalance:10,positions:[],history:[],tradePlans:[]})
  restoreBackup(s,'portfolio',raw,null)
  assert.throws(()=>previewBackup(s,'portfolio',raw.replaceAll('10','20')),/cash|portfolio/i)
  for(const bad of ['{}','broken','x'.repeat(32*1024*1024+1)])assert.throws(()=>previewBackup(s,'forecasts',bad))
  const failing={getItem:()=>null,setItem:()=>{throw Error('Disk full')}}
  assert.throws(()=>restoreBackup(failing,'forecasts',JSON.stringify({version:1,records:[]}),null),/Disk full/)
})

test('imported share snapshots reject malformed history, duplicate IDs and inconsistent cash/P&L',()=>{
  const s=memory(),base={version:2,balance:1000,initialBalance:1000,positions:[],history:[],tradePlans:[]}
  for(const data of [{...base,history:[{pnlDollar:0}]},{...base,balance:2000},{...base,positions:[{id:'p',symbol:'EOSE',entryPrice:1,quantity:1,totalCost:1}]}])assert.throws(()=>previewBackup(s,'portfolio',JSON.stringify(data)))
  assert.equal(s.getItem(BACKUP_DATASETS.portfolio.key),null)
})

test('nonempty forecast, comparison and legacy share exports restore original values',()=>{
  const s=memory(),target=memory()
  saveForecast(s,{symbol:'EOSE',outlook:{anchor_date:'2026-10-22',anchor_price:5,end_date:'2026-10-30',model_version:'v1',method:'Synthetic test',points:[{date:'2026-10-30',lower:4,central:5,upper:6}]}},now)
  const a={source:'Dime',symbol:'EOSE',type:'call',strike:5,expiration:'2026-10-30',multiplier:100,bid:.9,ask:1,fee:.65,quoteTime:new Date(now).toISOString()}
  saveOptionComparison(s,compareOptionSnapshots(a,{...a,source:'Webull'},{contracts:1,deliverableConfirmed:true},now),now)
  const position={id:'legacy-open',symbol:'EOSE',entryPrice:5,quantity:2,totalCost:10,entryDate:'2026-10-22T15:00:00Z'}
  const history={id:'legacy-closed',symbol:'ONDS',entryPrice:5,quantity:2,totalCost:10,entryDate:'2026-10-21T15:00:00Z',exitPrice:6,exitValue:12,pnlDollar:2,pnlPercent:20,exitDate:'2026-10-22T15:00:00Z'}
  s.setItem(BACKUP_DATASETS.portfolio.key,JSON.stringify({balance:92,initialBalance:100,positions:[position],history:[history]}))
  const bundle=backupBundle(s,now)
  for(const kind of ['forecasts','comparisons','portfolio']){
    const preview=previewBackup(target,kind,bundle);restoreBackup(target,kind,bundle,preview.baseRaw)
    assert.equal(preview.added,1)
  }
  assert.equal(JSON.parse(target.getItem(BACKUP_DATASETS.forecasts.key)).records[0].points[0].central,5)
  assert.equal(JSON.parse(target.getItem(BACKUP_DATASETS.portfolio.key)).history[0].exitPrice,6)
})

test('monitoring histories above the old 2 MB limit export and restore through the backup center',()=>{
  const s=memory(),target=memory(),plan={symbol:'EOSE',type:'call',strike:5,expiration:'2026-10-30',bid:.9,ask:1,contracts:1,multiplier:100,fee:.65,quoteTime:new Date(now).toISOString(),budget:1000,maxSpreadPct:20,plannedExit:'2026-10-29'}
  s.setItem(OPTION_PAPER_KEY,JSON.stringify({version:1,positions:[],riskLimit:100000}))
  const id=openOptionPaperPosition(s,{plan,estimate:optionEstimate(plan,now)},{sourceName:'Dime manual',termsConfirmed:true},now).id
  const position=recordOptionPaperMark(s,id,{bid:1.2,fee:.65,quoteTime:new Date(now).toISOString(),sourceName:'Dime manual',termsConfirmed:true},now).positions[0]
  const marks=Array.from({length:100},(_,i)=>({...position.marks[0],sourceName:`Dime ${'x'.repeat(45)} ${i}`}))
  const positions=Array.from({length:100},(_,i)=>({...position,id:`position-${i}`,ticket:{...position.ticket,strike:5+i},marks}))
  s.setItem(OPTION_PAPER_KEY,JSON.stringify({version:1,positions,riskLimit:100000}))
  const bundle=backupBundle(s,now)
  assert(new TextEncoder().encode(s.getItem(OPTION_PAPER_KEY)).length>2*1024*1024)
  const preview=previewBackup(target,'options',bundle)
  assert.equal(preview.total,100)
  restoreBackup(target,'options',bundle,preview.baseRaw)
  assert.equal(JSON.parse(target.getItem(OPTION_PAPER_KEY)).positions[99].marks.length,100)
})
