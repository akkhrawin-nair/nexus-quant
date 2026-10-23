import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, BarChart3, RefreshCw, Search, Plus, Star, Bell, BookOpen, Briefcase, ShieldCheck } from 'lucide-react'
import { apiRequest, compareMacdStrength } from './lib/api'
import { matchingAlerts } from './lib/alerts'
import DataQualityNotice from './components/DataQualityNotice'
import TradingChart from './components/TradingChart'
import PaperDeadlineBanner from './components/PaperDeadlineBanner'
import OptionPaperDeadlineBanner from './components/OptionPaperDeadlineBanner'
import './App.css'
import './Dashboard.css'

const Tools = lazy(() => import('./components/ToolRouter'))
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
const fmt = value => value == null ? '—' : Number(value).toLocaleString('en-US', {maximumFractionDigits:2})

export default function Dashboard() {
  const [lang, setLang] = useState(() => localStorage.getItem('kappa_lang') || 'en')
  const th = lang === 'th'
  const label = (en, thai) => th ? thai : en
  const [mode, setMode] = useState('all')
  const [view, setView] = useState('cards')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL')
  const [sort, setSort] = useState('symbol')
  const [favorites, setFavorites] = useState(() => read('kappa_favorites', []))
  const [alerts, setAlerts] = useState(() => read('kappa_alert_rules', []))
  const [feed, setFeed] = useState({signals:[], loading:true, error:null})
  const [revision, setRevision] = useState(0)
  const [tool, setTool] = useState(null)
  const [ticker, setTicker] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [latency, setLatency] = useState(null)
  const [poll, setPoll] = useState(true)
  const mutation = useRef(null)
  useEffect(() => () => mutation.current?.abort(), [])
  useEffect(() => {
    let controller
    let disposed = false
    const load = async () => {
      controller?.abort()
      controller = new AbortController()
      const start = performance.now()
      try {
        const results = await Promise.all(['/api/signals/buy/','/api/signals/sell/'].map(path => apiRequest(path, {signal:controller.signal})))
        if (disposed || controller.signal.aborted) return
        const signals = [...new Map(results.flat().map(s => [s.symbol, s])).values()]
        setFeed({signals, loading:false, error:null})
        setLatency(Math.round(performance.now() - start))
      } catch (error) {
        if (!disposed && !controller.signal.aborted) {
          setFeed(prev => ({...prev, loading:false, error:error.message}))
          setLatency(null)
        }
      }
    }
    void load()
    const interval = poll ? setInterval(load, 30000) : null
    return () => {disposed = true; controller?.abort(); clearInterval(interval)}
  }, [revision, poll])
  useEffect(() => {
    const key = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); document.getElementById('ticker-search')?.focus()
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
  const toggleFavorite = symbol => setFavorites(previous => {
    const next = previous.includes(symbol) ? previous.filter(s => s !== symbol) : [...previous, symbol]
    try {localStorage.setItem('kappa_favorites', JSON.stringify(next))} catch {setNotice('Favorites could not be saved in this browser.')}
    return next
  })
  const saveAlerts = next => {
    try {localStorage.setItem('kappa_alert_rules',JSON.stringify(next)); setAlerts(next)}
    catch {setNotice('Alert rules could not be saved in this browser.')}
  }
  const matches = matchingAlerts(alerts, feed.signals)
  const signals = useMemo(() => feed.signals.filter(s => {
    const bullish = Number(s.macd) > Number(s.macd_signal)
    return (mode === 'all' || (mode === 'buy' ? bullish : !bullish)) &&
      (!search || `${s.symbol} ${s.asset_type}`.toLowerCase().includes(search.trim().toLowerCase())) &&
      (category === 'ALL' || (category === 'Favorites' ? favorites.includes(s.symbol) : category === 'Checklist 80+' ? s.golden_opportunity.confluence_score >= 80 : s.asset_type === category))
  }).sort((a,b) => {
    const pin = Number(favorites.includes(b.symbol)) - Number(favorites.includes(a.symbol))
    if (pin) return pin
    if (sort === 'macd') return compareMacdStrength(a,b)
    if (sort === 'price') return b.current_price - a.current_price
    if (sort === 'change') return b.daily_change_pct - a.daily_change_pct
    return a.symbol.localeCompare(b.symbol)
  }), [feed.signals, mode, search, category, favorites, sort])

  const mutate = async (path, body) => {
    if (busy) return
    mutation.current?.abort()
    const controller = new AbortController()
    mutation.current = controller
    setBusy(true); setNotice('')
    try {
      const result = await apiRequest(path,{method:'POST',body:JSON.stringify(body),signal:controller.signal,timeoutMs:180000})
      if (!controller.signal.aborted) {
        setNotice(result.message || `${result.symbol} saved. Change the direction filter if it does not appear.`)
        setTicker(''); setRevision(n => n+1)
      }
    } catch (error) {
      if (!controller.signal.aborted) setNotice(error.message)
    } finally {if (!controller.signal.aborted) setBusy(false)}
  }
  const exportSignals = () => {
    const rows = [['Symbol','Type','Observed close','Daily change (%)','Session','Heuristic score'],
      ...signals.map(s => [s.symbol,s.asset_type,s.current_price,s.daily_change_pct,s.signal_date,s.golden_opportunity.confluence_score])]
    const csv = rows.map(row => row.map(x => `"${String(x).replaceAll('"','""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
    const a = document.createElement('a'); a.href=url; a.download='kappa-observed-signals.csv'; a.click(); URL.revokeObjectURL(url)
  }
  const buttons = [['analyst','Analyst desk','วิเคราะห์หุ้นและข่าว'],['options','Options bid / ask','คำนวณ Bid / Ask ออปชัน'],['backtest','Backtest','ทดสอบย้อนหลัง'],['optimizer','Allocation','สัดส่วนพอร์ต'],['correlation','Correlation','สหสัมพันธ์'],['risk','Risk scenarios','แบบจำลองความเสี่ยง'],['news','News','ข่าว'],['indicator','Indicators','ตัวชี้วัด'],['paper','Paper portfolio','พอร์ตจำลอง'],['education','Research guide','แนวทางวิจัย'],['alerts','Alerts','การแจ้งเตือน']]
  buttons.unshift(['brief','Daily brief','Daily brief'],['backups','Backups','Backups'])
  const latestDate = feed.signals.map(s => s.signal_date).sort().at(-1)
  const bullishCount = feed.signals.filter(s => s.macd > s.macd_signal).length
  return <div className="minimal-app-root reliability-app">
    <header className="minimal-header">
      <div className="header-left-group"><div className="minimal-brand-logo"><Activity size={20}/></div><div className="minimal-brand-text">KAPPA <span className="brand-divider">//</span> <span className="brand-sub">ANALYTICS</span></div></div>
      <div className="header-right-group"><span className="connection-state">{latency == null ? label('Connecting / offline','กำลังเชื่อมต่อ / ออฟไลน์') : `${label('API response','เวลาตอบกลับ')} ${latency} ms`}</span>
        <button onClick={() => {const next = th ? 'en':'th'; localStorage.setItem('kappa_lang',next); setLang(next)}} aria-label="Switch language">{th ? 'EN' : 'ไทย'}</button>
        <button onClick={() => setTool({kind:'paper'})}><Briefcase size={15}/>{label('Paper portfolio','พอร์ตจำลอง')}</button></div>
    </header>
    <main className="kappa-main">
      <section className="kappa-intro">
        <div><p className="kappa-eyebrow">{label('PERSONAL MARKET RESEARCH','เครื่องมือวิจัยตลาดส่วนบุคคล')}</p><h1>{label('Understand the data. Measure the risk.','เข้าใจข้อมูล ประเมินความเสี่ยง')}</h1>
          <p>{label('Observed market history, transparent indicators, and a local paper-trading journal.','ข้อมูลตลาดย้อนหลัง ตัวชี้วัดที่โปร่งใส และบันทึกการซื้อขายจำลอง')}</p></div>
        <button disabled={busy} onClick={() => mutate('/api/trigger-ingest/',{})}><RefreshCw size={16}/>{busy ? label('Syncing…','กำลังอัปเดต…') : label('Sync market data','อัปเดตข้อมูลตลาด')}</button>
      </section>
      <DataQualityNotice lang={lang} quality={{source:'Yahoo Finance · adjusted historical daily bars',status:'stale',observed_at:latestDate,
        limitations:[label('Prices may be delayed; the latest daily bar may be in progress. Checklist scores are heuristic agreement, not a probability of profit.','ราคาอาจล่าช้า แท่งรายวันล่าสุดอาจยังไม่ปิด คะแนนคือความสอดคล้องของตัวชี้วัด ไม่ใช่โอกาสได้กำไร'),
          label('Options, exchange order books, and earnings calendars are not connected.','ยังไม่ได้เชื่อมต่อข้อมูลออปชัน สมุดคำสั่งซื้อขาย และปฏิทินผลประกอบการ')]}}/>
      <section className="kappa-summary" aria-label="Market research summary">
        {[[label('Tracked assets','สินทรัพย์ที่ติดตาม'),feed.signals.length],[label('MACD above signal','MACD เหนือเส้นสัญญาณ'),bullishCount],[label('MACD at/below signal','MACD เท่ากับ/ต่ำกว่าเส้นสัญญาณ'),feed.signals.length-bullishCount],[label('Latest stored session','วันที่ข้อมูลล่าสุด'),latestDate || '—']].map(([name,value]) => <div key={name}><span>{name}</span><strong>{value}</strong></div>)}
      </section>
      <PaperDeadlineBanner onReview={()=>setTool({kind:'paper'})}/>
      <OptionPaperDeadlineBanner onReview={()=>setTool({kind:'options',focusJournal:true})}/>
      <nav className="kappa-tools" aria-label={label('Research tools','เครื่องมือวิจัย')}>{buttons.map(([kind,en,thai]) => <button key={kind} onClick={() => setTool({kind})}>{kind==='paper' ? <Briefcase size={15}/> : kind==='alerts' ? <Bell size={15}/> : kind==='education' ? <BookOpen size={15}/> : <BarChart3 size={15}/>} {label(en,thai)}</button>)}</nav>
      <div className="kappa-status" aria-live="polite">{notice}{busy && <p>{label('Fetching and saving observations. This may take a few minutes; provider failures will be reported.','กำลังดึงและบันทึกข้อมูล อาจใช้เวลาสักครู่ ระบบจะแสดงข้อผิดพลาดจากแหล่งข้อมูล')}</p>}</div>
      {feed.error && <div role="alert" className="kappa-error">{feed.error} {feed.signals.length>0 && label('Previous observations remain visible.','ยังแสดงข้อมูลที่บันทึกไว้ก่อนหน้า')}<button onClick={() => setRevision(n=>n+1)}>{label('Retry','ลองอีกครั้ง')}</button></div>}
      {matches.length>0 && <aside className="kappa-alerts"><Bell size={18}/><div>{label('Stored observation matches','ข้อมูลที่บันทึกตรงตามเงื่อนไข')}: {matches.map(a=>`${a.ticker} ${a.condition} ${a.targetValue}`).join(' · ')}<small>{label('Checked while this page is open; these are not live execution alerts.','ตรวจสอบขณะเปิดหน้านี้ ไม่ใช่การแจ้งเตือนราคาซื้อขายแบบสด')}</small></div></aside>}
      <section className="kappa-watchlist">
        <div className="kappa-watchlist-heading"><h2>{label('Market watchlist','รายการติดตามตลาด')}</h2><form onSubmit={e=>{e.preventDefault(); mutate('/api/tickers/add/',{symbol:ticker.trim().toUpperCase()})}}>
          <label className="sr-only" htmlFor="new-ticker">{label('New ticker','เพิ่มสัญลักษณ์')}</label><input id="new-ticker" placeholder={label('Add ticker, e.g. MSFT','เพิ่มสัญลักษณ์ เช่น MSFT')} value={ticker} onChange={e=>setTicker(e.target.value)} required maxLength={20}/><button disabled={busy}><Plus size={16}/>{label('Add','เพิ่ม')}</button></form></div>
        <div className="kappa-filters"><label className="kappa-search"><Search size={17}/><input id="ticker-search" placeholder={label('Search ticker or type…  Ctrl K','ค้นหาสัญลักษณ์หรือประเภท… Ctrl K')} value={search} onChange={e=>setSearch(e.target.value)} aria-label={label('Search watchlist','ค้นหารายการติดตาม')}/></label>
          <select value={mode} onChange={e=>setMode(e.target.value)} aria-label="MACD direction"><option value="all">{label('All directions','ทุกทิศทาง')}</option><option value="buy">MACD &gt; Signal</option><option value="sell">MACD ≤ Signal</option></select>
          <select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort assets"><option value="symbol">{label('Symbol','สัญลักษณ์')}</option><option value="price">{label('Highest price','ราคาสูงสุด')}</option><option value="macd">{label('MACD magnitude','ขนาด MACD')}</option><option value="change">{label('Daily change','การเปลี่ยนแปลงรายวัน')}</option></select>
          <button onClick={()=>setView(v=>v==='cards'?'heatmap':'cards')}>{view==='cards'?label('Heatmap','แผนที่ความร้อน'):label('Cards','การ์ด')}</button><button onClick={exportSignals} disabled={!signals.length}>CSV</button>
        </div>
        <div className="kappa-categories">{['ALL','Favorites','Stock','ETF','Crypto','Commodity','Checklist 80+'].map(c=><button key={c} aria-pressed={category===c} className={category===c?'selected':''} onClick={()=>setCategory(c)}>{c==='Favorites'?<Star size={13}/>:null}{c}</button>)}<label className="kappa-poll"><input type="checkbox" checked={poll} onChange={e=>setPoll(e.target.checked)}/>{label('Refresh every 30s','รีเฟรชทุก 30 วินาที')}</label></div>
        {feed.loading ? <p role="status" className="kappa-empty">{label('Loading stored market observations…','กำลังโหลดข้อมูลตลาดที่บันทึกไว้…')}</p> : !signals.length ? <div className="kappa-empty"><Search size={32}/><h3>{label('No matching observations','ไม่มีข้อมูลที่ตรงกัน')}</h3><p>{label('Sync market data or add a ticker. If data is already saved, adjust your search and filters.','อัปเดตข้อมูลตลาดหรือเพิ่มสัญลักษณ์ หากมีข้อมูลอยู่แล้วให้ปรับการค้นหาและตัวกรอง')}</p></div> : view==='heatmap' ?
          <div className="kappa-heatmap">{signals.map(s=><button key={s.symbol} style={{background:s.daily_change_pct>=0?'#047857':'#be123c'}} onClick={()=>setTool({kind:'chart',symbol:s.symbol})}><strong>{s.symbol}</strong><span>{fmt(s.daily_change_pct)}%</span><small>{s.signal_date}</small></button>)}</div> :
          <div className="kappa-card-grid">{signals.map(s=><article className="minimal-card kappa-signal-card" key={s.symbol}>
            <div className="kappa-card-header"><div><strong>{s.symbol}</strong><span>{s.asset_type}</span></div><button onClick={()=>toggleFavorite(s.symbol)} aria-label={`${favorites.includes(s.symbol)?'Unpin':'Pin'} ${s.symbol}`} aria-pressed={favorites.includes(s.symbol)}><Star size={17} fill={favorites.includes(s.symbol)?'#f59e0b':'none'}/></button></div>
            <div className="kappa-card-price"><strong>${fmt(s.current_price)}</strong><span className={s.daily_change_pct>=0?'positive':'negative'}>{s.daily_change_pct>=0?'+':''}{fmt(s.daily_change_pct)}%</span></div>
            <small>{label('Observed session','วันที่ข้อมูล')}: {s.signal_date} · {label('daily close','ราคาปิดรายวัน')}</small>
            <TradingChart data={s.candles} height={150} showAutoLevels={false}/>
            <dl className="kappa-card-indicators"><div><dt>RSI 14</dt><dd>{fmt(s.radar.rsi)}</dd></div><div><dt>MACD</dt><dd>{fmt(s.macd)}</dd></div><div><dt>{label('Relative volume','ปริมาณเทียบเฉลี่ย')}</dt><dd>{fmt(s.radar.vol_spike_ratio)}x</dd></div></dl>
            <p className="kappa-score"><ShieldCheck size={15}/>{label('Heuristic checklist','คะแนนตัวชี้วัด')}: {s.golden_opportunity.confluence_score}/100 · {s.golden_opportunity.passed_count}/5</p>
            <div className="kappa-card-actions"><button onClick={()=>setTool({kind:'chart',symbol:s.symbol})}>{label('Chart','กราฟ')}</button><button onClick={()=>setTool({kind:'analyst',symbol:s.symbol})}>{label('Analyze','วิเคราะห์')}</button><button onClick={()=>setTool({kind:'paper',symbol:s.symbol})}>{label('Paper trade','ซื้อขายจำลอง')}</button></div>
          </article>)}</div>}
      </section>
      <footer className="kappa-footer">{label('Historical research • No brokerage connection • Browser-local paper portfolio','วิจัยข้อมูลย้อนหลัง • ไม่เชื่อมต่อโบรกเกอร์ • พอร์ตจำลองบันทึกในเบราว์เซอร์')}</footer>
    </main>
    {tool && <Suspense fallback={<div role="status" className="kappa-loading-tools">Loading tools…</div>}><Tools tool={tool} onClose={()=>setTool(null)} alerts={alerts} saveAlerts={saveAlerts} signals={feed.signals}/></Suspense>}
  </div>
}
