import './DataQualityNotice.css'

export default function DataQualityNotice({ quality, lang = 'en' }) {
  if (!quality) return null
  return <aside className="data-quality-notice" aria-label={lang === 'th' ? 'แหล่งข้อมูล' : 'Data source'}>
    <strong>{quality.status === 'simulated' ? (lang === 'th' ? 'แบบจำลอง' : 'Scenario simulation') :
      quality.status === 'unavailable' ? (lang === 'th' ? 'ไม่มีข้อมูล' : 'Unavailable') :
      quality.status === 'stale' ? (lang === 'th' ? 'ข้อมูลย้อนหลัง' : 'Historical / cached data') :
      (lang === 'th' ? 'ข้อมูลที่สังเกตได้' : 'Observed data')}</strong>
    <span>{quality.source}{quality.observed_at ? ` · ${quality.observed_at}` : ''}</span>
    {quality.limitations?.map(line => <small key={line}>{line}</small>)}
  </aside>
}
