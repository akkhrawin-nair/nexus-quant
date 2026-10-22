import { useRef, useState } from 'react'
import { previewOptionPaperRestore, restoreOptionPaperBackup } from '../lib/optionPaperJournal'

const usd=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value)

export default function OptionPaperRestore({onRestored}) {
  const [preview,setPreview]=useState(null), [error,setError]=useState(''), [message,setMessage]=useState(''), [busy,setBusy]=useState(false)
  const selection=useRef(0)
  const select=async event=>{
    const file=event.target.files?.[0], request=++selection.current
    setPreview(null);setError('');setMessage('');setBusy(false)
    if(!file)return
    try{
      if(file.size>2*1024*1024)throw new Error('Choose a journal JSON backup no larger than 2 MB.')
      setBusy(true)
      const raw=await file.text()
      if(request!==selection.current)return
      setPreview({...previewOptionPaperRestore(window.localStorage,raw),raw,name:file.name})
    }catch(failure){if(request===selection.current)setError(failure.message)}
    finally{if(request===selection.current)setBusy(false)}
  }
  const restore=()=>{
    setError('');setMessage('')
    try{
      const next=restoreOptionPaperBackup(window.localStorage,preview.raw,preview.baseRaw)
      setPreview(null);setMessage(`Restored ${next.restored} record(s); skipped ${next.duplicates} identical duplicate(s).`)
      onRestored()
    }catch(failure){setPreview(null);setError(failure.message)}
  }
  const cancel=()=>{selection.current++;setPreview(null);setBusy(false);setError('');setMessage('Backup preview cancelled; no records changed.')}
  return <details className="option-paper-limits">
    <summary>Restore options journal backup</summary>
    <section className="option-paper-entry" aria-label="Restore options journal backup">
      <p>Choose a KAPPA options journal JSON export (up to 2 MB). The file is read locally. Previewing does not change your records.</p>
      <label>Options journal backup file<input type="file" accept=".json,application/json" onChange={select}/></label>
      {busy && <p role="status">Validating backup…</p>}
      {error && <p role="alert" className="research-error">{error}</p>}
      {message && <p role="status">{message}</p>}
      {preview && <div>
        <p>File: {preview.name}</p>
        <dl className="research-metrics">{[['Records in file',preview.incomingCount],['New records to add',preview.added],['Identical duplicates to skip',preview.duplicates],['Total after restore',preview.total],['Combined cap after restore',preview.riskLimit===undefined ? 'Not set' : usd(preview.riskLimit)],['Open commitment after restore',usd(preview.openEntryCost)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <p>Existing entries and outcomes will be kept. Existing local cap settings take priority; a backup cap is recovered only when this browser has no journal.</p>
        {(preview.riskLimit===undefined || preview.openEntryCost>preview.riskLimit) && <p role="alert">Restored records will be preserved, but new entries will be blocked until your combined cap allows them.</p>}
        <button type="button" onClick={restore}>Confirm merge of journal backup</button>
      </div>}
      {(preview || busy) && <button type="button" onClick={cancel}>Cancel backup preview</button>}
      <p className="option-paper-note">Export your current journal before merging. Identical records are skipped even if their IDs differ. Conflicting records, invalid files and merges above 200 records are rejected. If local records change after preview, preview again. A damaged local journal must be preserved and reviewed separately; this merge does not overwrite it. Imported prices, sources and outcomes remain unverified paper assumptions.</p>
    </section>
  </details>
}
