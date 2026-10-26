import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from './api'
import { AUTO_SYNC_ENABLED_KEY, AUTO_SYNC_ATTEMPT_KEY, autoSyncAllowed, scheduleSyncChecks } from './marketSync'

export default function useMarketSync(signals,loaded,onUpdated) {
  const [enabled,setEnabled]=useState(()=>{try{return localStorage.getItem(AUTO_SYNC_ENABLED_KEY)!=='false'}catch{return false}})
  const [state,setState]=useState({busy:false,message:'',error:''})
  const pending=useRef(null)
  useEffect(()=>()=>pending.current?.abort(),[])
  const refresh=useCallback(async()=>{
    if(pending.current)return
    const controller=new AbortController();pending.current=controller
    try{localStorage.setItem(AUTO_SYNC_ATTEMPT_KEY,String(Date.now()))}catch{/* Manual refresh still works without storage. */}
    setState({busy:true,message:'Fetching new daily history from Yahoo Finance…',error:''})
    try{
      const result=await apiRequest('/api/trigger-ingest/',{method:'POST',body:'{}',signal:controller.signal,timeoutMs:240000})
      if(controller.signal.aborted)return
      const failed=Object.keys(result.errors||{})
      setState({busy:false,message:`${result.message} Provider request completed ${new Date().toLocaleString()}.`,
        error:failed.length?`Refresh failed for ${failed.join(', ')}. Their older saved data remains; they may be excluded from watch candidates.`:''})
      onUpdated()
    }catch(error){if(!controller.signal.aborted)setState({busy:false,message:'',error:`Provider sync failed: ${error.message} Saved observations were kept.`})}
    finally{if(pending.current===controller)pending.current=null}
  },[onUpdated])
  useEffect(()=>{
    if(!enabled||!loaded)return
    // Delayed dispatch prevents StrictMode's setup/cleanup replay from sending two refreshes.
    return scheduleSyncChecks(()=>{
      try{if(!pending.current&&autoSyncAllowed(localStorage,signals))void refresh()}catch{/* Storage may be disabled; manual refresh remains available. */}
    })
  },[enabled,loaded,signals,refresh])
  const toggle=value=>{setEnabled(value);try{localStorage.setItem(AUTO_SYNC_ENABLED_KEY,String(value))}catch{setState(previous=>({...previous,error:'Auto-sync preference could not be saved in this browser.'}))}}
  return {...state,enabled,toggle,refresh}
}
