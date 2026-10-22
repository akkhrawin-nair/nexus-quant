import './DataQualityNotice.css'

function DataTimestamp({label,stamp}) {
  const date=typeof stamp==='string' ? new Date(stamp) : null
  return <small>{label}: {date && Number.isFinite(date.getTime()) ? <time dateTime={stamp} title={stamp}>{new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'long'}).format(date)}</time> : 'Unknown / not recorded'}</small>
}

export default function DataQualityNotice({ quality, lang = 'en' }) {
  if (!quality) return null
  return <aside className="data-quality-notice" aria-label={lang === 'th' ? 'แหล่งข้อมูล' : 'Data source'}>
    <strong>{quality.status === 'simulated' ? (lang === 'th' ? 'แบบจำลอง' : 'Scenario simulation') :
      quality.status === 'unavailable' ? (lang === 'th' ? 'ไม่มีข้อมูล' : 'Unavailable') :
      quality.status === 'stale' ? (lang === 'th' ? 'ข้อมูลย้อนหลัง' : 'Historical / cached data') :
      (lang === 'th' ? 'ข้อมูลที่สังเกตได้' : 'Observed data')}</strong>
    <span>{quality.source}{quality.observed_at ? ` · ${quality.observed_at}` : ''}</span>
    {quality.observed_at && (quality.retrieval_kind==='provider_response' || quality.stored_at) && <DataTimestamp label={lang==='th' ? 'เวลารับข้อมูลจากผู้ให้บริการ' : 'Provider data received'} stamp={quality.retrieved_at}/>}
    {quality.stored_at && <DataTimestamp label={lang==='th' ? 'เวลาบันทึกลงฐานข้อมูล' : 'Database row saved'} stamp={quality.stored_at}/>}
    {quality.limitations?.map(line => <small key={line}>{line}</small>)}
  </aside>
}
