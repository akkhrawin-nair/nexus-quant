import test from 'node:test'
import assert from 'node:assert/strict'
import { loadCatalysts, saveCatalyst, catalystStatus, CATALYST_KEY, dimeEvidence, dailyResearchSummary } from './researchWorkflow.js'
const now=Date.parse('2026-10-23T15:00:00Z')
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}}
const event={symbol:'EOSE',title:'Issuer earnings date',eventDate:'2026-10-30',publishedDate:'2026-10-22',url:'https://example.com/issuer',kind:'issuer',note:'Check the linked release'}
test('sourced catalysts are immutable, deduplicated, bounded and stale reviews remain explicit',()=>{
  const s=memory();saveCatalyst(s,event,now);saveCatalyst(s,event,now)
  const saved=loadCatalysts(s).records[0];assert.equal(loadCatalysts(s).records.length,1)
  assert.equal(catalystStatus(saved,now).window,'within_14_days')
  assert.equal(catalystStatus(saved,now+8*86400000).stale,true)
  for(const change of [{url:'javascript:alert(1)'},{eventDate:'2026-02-30'},{publishedDate:'2026-10-24'},{title:''}])assert.throws(()=>saveCatalyst(s,{...event,...change},now))
  s.setItem(CATALYST_KEY,'broken');assert.throws(()=>saveCatalyst(s,event,now));assert.equal(s.getItem(CATALYST_KEY),'broken')
})
test('Dime evidence distinguishes missing identifiers and clock gaps without claiming independent verification',()=>{
  const a={source:'Dime',contractSymbol:'AAPL261030C00250000',quoteTime:'2026-10-23T14:59:50Z'}, b={...a,source:'Webull',quoteTime:'2026-10-23T14:59:59Z'}
  const result=dimeEvidence([{a,b,deliverableConfirmed:true,executions:[]}])
  assert.equal(result.comparisons,1);assert.equal(result.exactIdentifiers,1);assert.equal(result.closeTiming,0);assert.equal(result.independentlyVerified,0)
  assert.equal(dimeEvidence([{a:{...a,contractSymbol:undefined},b,executions:[]}]).exactIdentifiers,0)
})
test('daily summary shows daily observations and deadlines rather than recommendations',()=>{
  const report=dailyResearchSummary([{symbol:'EOSE',signal_date:'2026-10-20',macd:1,macd_signal:0}], [{ticket:{symbol:'EOSE',plannedExit:'2026-10-23'},outcome:null}],[],now)
  assert.equal(report.staleSymbols[0],'EOSE');assert.equal(report.dueOptions[0],'EOSE');assert.equal(report.bullish,1)
  assert.equal(report.date,'2026-10-23');assert.equal(dailyResearchSummary([],[],[],now).latestSession,null)
})
