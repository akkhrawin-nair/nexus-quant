import { useRef, useState } from 'react'
import { ToolModal } from './ResearchTools'
import { BACKUP_DATASETS, MAX_BACKUP_BYTES, backupBundle, previewBackup, restoreBackup } from '../lib/backups'
export default function BackupCenter({onClose}) {
  const [kind,setKind]=useState('forecasts'),[preview,setPreview]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState('')
  const selection=useRef(0),fileRef=useRef(null)
  const download=()=>{setError('');try{const blob=new Blob([backupBundle(localStorage)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`kappa-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Backup downloaded. Raw saved data is preserved, including any damaged dataset; damaged data cannot be restored until repaired.')}catch(e){setError(e.message)}}
  const choose=async e=>{
    const file=e.target.files?.[0],revision=++selection.current;setPreview(null);setError('');setMessage('')
    if(!file)return
    try{if(file.size>MAX_BACKUP_BYTES)throw Error('Choose a JSON file no larger than 32 MB.');const raw=await file.text();if(revision!==selection.current)return;setPreview({...previewBackup(localStorage,kind,raw),raw,name:file.name})}catch(e){if(revision===selection.current)setError(e.message)}
  }
  const restore=()=>{setError('');setMessage('');try{const done=restoreBackup(localStorage,kind,preview.raw,preview.baseRaw);setPreview(null);setMessage(`Restored ${done.added} new record(s) or portfolio snapshot; skipped ${done.duplicates} identical duplicate(s).`)}catch(e){setPreview(null);setError(e.message)}}
  return <ToolModal title="Backups and restoration" onClose={onClose}><p>Back up forecasts, quote comparisons and reported executions, options paper positions and monitoring, share portfolios/plans, and sourced catalysts. Files stay on your computer. API credentials are not included.</p>
    <button onClick={download}>Download all research backups</button><p>Restore one dataset at a time from this bundle or an older individual JSON export. Preview is read-only. Conflicts block restoration; identical records are skipped. Share portfolio balances cannot be merged and require an empty destination. Existing options premium limits take precedence.</p>
    <label>Dataset to restore<select aria-label="Dataset to restore" value={kind} onChange={e=>{selection.current++;setKind(e.target.value);setPreview(null);setError('');setMessage('');if(fileRef.current)fileRef.current.value=''}}>{Object.entries(BACKUP_DATASETS).map(([key,d])=><option key={key} value={key}>{d.label}</option>)}</select></label>
    <label>Choose backup JSON<input ref={fileRef} type="file" accept="application/json,.json" onChange={choose}/></label>
    {error&&<p role="alert" className="research-error">{error}</p>}{message&&<p role="status">{message}</p>}
    {preview&&<section aria-label="Backup restoration preview"><h3>{preview.name}</h3><p>{BACKUP_DATASETS[kind].label}: {preview.added} new, {preview.duplicates} identical duplicates, {preview.total} total records after restoration.</p><button onClick={restore}>Confirm restoration of selected dataset</button></section>}
    <p>This center accepts up to 32 MB, including larger monitoring histories; the older options-only restore form accepts 2 MB. CSV reports are summaries and cannot reconstruct full records. Favorites, alert rules, language settings, credentials and the backend database are outside this research-data backup. Keep the export private if it contains your notes or execution reports.</p>
  </ToolModal>
}
