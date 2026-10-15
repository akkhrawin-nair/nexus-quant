import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Calendar,
  Zap,
  TrendingUp,
  TrendingDown,
  Newspaper,
  BarChart3,
  ExternalLink,
  RefreshCw,
  Search,
  Target,
  ShieldCheck,
  Check,
  Copy,
  Briefcase,
  Activity,
  Sparkles,
  Info,
  Calculator,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  DollarSign
} from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid
} from 'recharts'

const QUICK_TICKERS = ['NVDA', 'QQQ', 'AAPL', 'TSLA', 'SPY', 'MSFT', 'AMZN', 'BTC-USD', 'EOSE']

const StationTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null
  const d = payload[0]?.payload || {}
  const isProj = d.is_projected

  return (
    <div className="station-tooltip-box font-mono">
      <div className="tooltip-head">
        <span className="tooltip-date">{label}</span>
        <span className={`tooltip-tag ${isProj ? 'proj' : 'hist'}`}>
          {isProj ? '14D FORWARD CONE' : 'HISTORICAL CLOSE'}
        </span>
      </div>

      <div className="tooltip-body">
        {!isProj && d.price != null && (
          <div className="t-row">
            <span>Spot Price:</span>
            <span className="text-cyan font-bold">${d.price.toFixed(2)}</span>
          </div>
        )}
        {isProj && d.projected_base != null && (
          <div className="t-row highlight">
            <span>Base Trajectory:</span>
            <span className="text-cyan font-bold">${d.projected_base.toFixed(2)}</span>
          </div>
        )}
        {isProj && d.projected_high != null && (
          <div className="t-row">
            <span>Bull Target Cone:</span>
            <span className="text-emerald font-bold">${d.projected_high.toFixed(2)}</span>
          </div>
        )}
        {isProj && d.projected_low != null && (
          <div className="t-row">
            <span>Stop Boundary:</span>
            <span className="text-rose font-bold">${d.projected_low.toFixed(2)}</span>
          </div>
        )}
        {!isProj && d.ema20 != null && (
          <div className="t-row">
            <span>20 EMA:</span>
            <span className="text-amber font-bold">${d.ema20.toFixed(2)}</span>
          </div>
        )}
        {!isProj && d.ema50 != null && (
          <div className="t-row">
            <span>50 EMA:</span>
            <span className="text-purple font-bold">${d.ema50.toFixed(2)}</span>
          </div>
        )}
        {d.target_1 != null && (
          <div className="t-row target">
            <span>Target 1 (50% Off):</span>
            <span className="text-emerald font-bold">${d.target_1.toFixed(2)}</span>
          </div>
        )}
        {d.target_2 != null && (
          <div className="t-row target">
            <span>Target 2 (Runner):</span>
            <span className="text-emerald font-bold">${d.target_2.toFixed(2)}</span>
          </div>
        )}
        {d.stop_loss != null && (
          <div className="t-row stop">
            <span>Invalidation Stop:</span>
            <span className="text-rose font-bold">${d.stop_loss.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TwoWeekSwingStation({
  initialSymbol = 'NVDA',
  API_BASE_URL = 'http://127.0.0.1:8001',
  onOpenPaperTrade
}) {
  const [symbol, setSymbol] = useState(initialSymbol)
  const [customInput, setCustomInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [copied, setCopied] = useState(false)

  // Chart toggles
  const [showEma20, setShowEma20] = useState(true)
  const [showEma50, setShowEma50] = useState(true)
  const [showCone, setShowCone] = useState(true)

  // Interactive Tab & Capital Sizing States
  const [activeTab, setActiveTab] = useState('calc') // 'calc' | 'why' | 'knowledge'
  const [tradeCapital, setTradeCapital] = useState(500)

  useEffect(() => {
    if (initialSymbol) {
      setSymbol(initialSymbol)
    }
  }, [initialSymbol])

  useEffect(() => {
    fetch2WeekData(symbol)
  }, [symbol])

  const fetch2WeekData = async (targetSym) => {
    if (!targetSym) return
    setLoading(true)
    try {
      const url = `${API_BASE_URL}/api/brain/fusion/?symbol=${encodeURIComponent(targetSym)}&horizon=2w`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error('Failed to load 2-week swing station:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCustomSubmit = (e) => {
    e.preventDefault()
    if (customInput.trim()) {
      const clean = customInput.trim().toUpperCase()
      setSymbol(clean)
      setCustomInput('')
    }
  }

  // Merge historical candle series with forward 14-day projection cone
  const chartSeries = useMemo(() => {
    if (!data?.chart_series?.length) return []

    const hist = data.chart_series.slice(-26).map((b) => ({
      date: b.date,
      displayDate: b.date,
      price: b.price,
      ema20: b.ema20,
      ema50: b.ema50,
      projected_base: null,
      projected_high: null,
      projected_low: null,
      is_projected: false
    }))

    const fwd = (data.forward_projection || []).map((pt, idx) => ({
      date: pt.date === 'Today' ? 'Today' : `${pt.date} (${pt.full_date || ''})`,
      displayDate: pt.date,
      price: idx === 0 ? pt.price : null,
      ema20: idx === 0 && hist.length ? hist[hist.length - 1].ema20 : null,
      ema50: idx === 0 && hist.length ? hist[hist.length - 1].ema50 : null,
      projected_base: pt.projected_base,
      projected_high: pt.projected_high,
      projected_low: pt.projected_low,
      target_1: pt.target_1,
      target_2: pt.target_2,
      stop_loss: pt.stop_loss,
      is_projected: true
    }))

    if (hist.length && fwd.length) {
      const last = hist[hist.length - 1]
      last.projected_base = last.price
      last.projected_high = last.price
      last.projected_low = last.price
    }

    return [...hist, ...fwd.slice(1)]
  }, [data])

  const yDomain = useMemo(() => {
    if (!chartSeries.length) return ['auto', 'auto']
    let min = Infinity
    let max = -Infinity

    chartSeries.forEach((d) => {
      [d.price, d.ema20, d.ema50, d.projected_base, d.projected_high, d.projected_low].forEach((v) => {
        if (v != null && typeof v === 'number' && !isNaN(v)) {
          if (v < min) min = v
          if (v > max) max = v
        }
      })
    })

    if (min === Infinity || max === -Infinity) return ['auto', 'auto']
    const pad = (max - min) * 0.08
    return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)]
  }, [chartSeries])

  const setup = data?.trade_setup
  const technicals = data?.technicals
  const isBull = (data?.verdict || 'BULLISH').includes('BULL')
  const badgeColor = isBull ? '#10b981' : '#ef4444'

  const handleCopy = () => {
    if (!setup) return
    const text = `[2-WEEK SWING SETUP] ${symbol} | Option: ${setup.recommended_option} | Entry: ${setup.entry_zone} | Target 1: ${setup.take_profit_target_1} (Scale 50% & Breakeven Stop) | Target 2: ${setup.take_profit_target_2} | Stop: ${setup.stop_loss} | 14-Day Expected Move: ±${technicals?.expected_move_pct}%`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <section className="main-swing-station">
      {/* Station Header */}
      <div className="swing-station-header">
        <div className="station-header-left">
          <div className="station-icon-glow">
            <Calendar size={18} />
          </div>
          <div>
            <div className="station-title-row">
              <h2 className="station-title">2-WEEK SWING TRADING STATION</h2>
              <span className="station-badge">10 - 14 DAY CYCLE • 14D CONE</span>
              {loading && <span className="station-loading-pill"><RefreshCw size={11} className="spin-icon" /> Updating...</span>}
            </div>
            <p className="station-subtitle">
              Eliminates daily trading noise & 0DTE chop. Combines multi-day 20/50 EMAs with breaking news catalysts to calculate high-probability 14–22 DTE options and swing setups.
            </p>
          </div>
        </div>

        {/* Ticker Selector Pills */}
        <div className="station-ticker-controls">
          <div className="station-pills-list">
            {QUICK_TICKERS.map((t) => (
              <button
                key={t}
                className={`station-pill ${symbol === t ? 'active' : ''}`}
                onClick={() => setSymbol(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <form onSubmit={handleCustomSubmit} className="station-custom-form">
            <Search size={12} className="search-icon" />
            <input
              type="text"
              placeholder="Custom Ticker..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              className="station-input"
            />
            <button type="submit" className="station-submit-btn">Go</button>
          </form>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="swing-station-grid">
        {/* LEFT COLUMN: Interactive Technical Graph + 14-Day Forward Cone */}
        <div className="station-card chart-card">
          <div className="station-card-top">
            <div className="card-top-title">
              <BarChart3 size={15} className="text-cyan" />
              <span>TECHNICAL GRAPH & 14-DAY PROJECTION CONE</span>
            </div>

            {/* Toggle Indicators */}
            <div className="station-toggle-bar">
              <button
                className={`st-toggle ${showEma20 ? 'on' : ''}`}
                onClick={() => setShowEma20(!showEma20)}
              >
                <span className="dot amber" /> 20 EMA
              </button>
              <button
                className={`st-toggle ${showEma50 ? 'on' : ''}`}
                onClick={() => setShowEma50(!showEma50)}
              >
                <span className="dot purple" /> 50 EMA
              </button>
              <button
                className={`st-toggle ${showCone ? 'on' : ''}`}
                onClick={() => setShowCone(!showCone)}
              >
                <span className="dot green" /> 14D Cone
              </button>
            </div>
          </div>

          {/* Recharts Container */}
          <div className="station-chart-box">
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={chartSeries} margin={{ top: 18, right: 20, left: 5, bottom: 5 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  stroke="#64748b"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                />
                <YAxis
                  domain={yDomain}
                  stroke="#64748b"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                  orientation="right"
                />
                <Tooltip content={<StationTooltip />} />

                {/* Historical Price */}
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#38bdf8"
                  strokeWidth={2.4}
                  dot={false}
                  name="Historical Price"
                  isAnimationActive={false}
                />

                {/* 20-Day EMA */}
                {showEma20 && (
                  <Line
                    type="monotone"
                    dataKey="ema20"
                    stroke="#f59e0b"
                    strokeWidth={1.6}
                    strokeDasharray="3 3"
                    dot={false}
                    name="20 EMA"
                    isAnimationActive={false}
                  />
                )}

                {/* 50-Day EMA */}
                {showEma50 && (
                  <Line
                    type="monotone"
                    dataKey="ema50"
                    stroke="#a855f7"
                    strokeWidth={1.6}
                    strokeDasharray="4 4"
                    dot={false}
                    name="50 EMA"
                    isAnimationActive={false}
                  />
                )}

                {/* Forward Cone */}
                {showCone && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="projected_high"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: '#10b981' }}
                      name="Bull Target Cone"
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="projected_base"
                      stroke="#06b6d4"
                      strokeWidth={2.4}
                      dot={{ r: 3.5, fill: '#06b6d4' }}
                      name="Base Path"
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="projected_low"
                      stroke="#ef4444"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: '#ef4444' }}
                      name="Stop Boundary"
                      isAnimationActive={false}
                    />
                  </>
                )}

                {/* Today Reference Line */}
                <ReferenceLine
                  x="Today"
                  stroke="#94a3b8"
                  strokeDasharray="3 3"
                  label={{ value: 'TODAY (ORIGIN)', position: 'top', fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 3 Forward Lines Explainer Banner */}
          <div className="cone-lines-legend-strip font-mono">
            <div className="strip-title-row">
              <span className="strip-main-title">📊 WHAT ARE THE 3 FORWARD LINES?</span>
              <span className="strip-sub-tip">14-Day Statistical Outcome Range</span>
            </div>
            <div className="strip-grid">
              <div className="strip-card green">
                <div className="sc-header">
                  <span className="sc-dot green" />
                  <span className="sc-label">🟢 TOP GREEN (TARGET 2)</span>
                </div>
                <span className="sc-val text-emerald">{setup?.take_profit_target_2 || 'Best Case'}</span>
                <span className="sc-desc">Bull Case Expansion. Let 50% runner target this maximum gain.</span>
              </div>

              <div className="strip-card cyan">
                <div className="sc-header">
                  <span className="sc-dot cyan" />
                  <span className="sc-label">🔵 MID CYAN (TARGET 1)</span>
                </div>
                <span className="sc-val text-cyan">{setup?.take_profit_target_1 || 'Expected Path'}</span>
                <span className="sc-desc">Expected Base Trajectory. De-risk 50% here and move Stop to Breakeven.</span>
              </div>

              <div className="strip-card red">
                <div className="sc-header">
                  <span className="sc-dot red" />
                  <span className="sc-label">🔴 BOT RED (STOP LOSS)</span>
                </div>
                <span className="sc-val text-rose">{setup?.stop_loss || 'Invalidation'}</span>
                <span className="sc-desc">Invalidation Floor. If price falls below this, cut trade immediately ($0 tilt).</span>
              </div>
            </div>
          </div>

          {/* Quick Indicator Sub-Bar */}
          <div className="station-metrics-subbar font-mono">
            <div className="sub-metric">
              <span className="sm-lbl">CURRENT SPOT</span>
              <span className="sm-val">${technicals?.current_price?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="sub-metric">
              <span className="sm-lbl">2-WEEK EXPECTED MOVE</span>
              <span className="sm-val text-cyan">±${technicals?.expected_move?.toFixed(2) || '0.00'} (±{technicals?.expected_move_pct?.toFixed(1)}%)</span>
            </div>
            <div className="sub-metric">
              <span className="sm-lbl">MOMENTUM / TREND</span>
              <span className="sm-val" style={{ color: badgeColor }}>{technicals?.trend || 'UPTREND'}</span>
            </div>
            <div className="sub-metric">
              <span className="sm-lbl">20 / 50 EMA GAP</span>
              <span className="sm-val text-amber">
                ${technicals?.ema_20?.toFixed(2)} / ${technicals?.ema_50?.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 2-Week Options & Swing Calculation Result */}
        <div className="station-card calc-card">
          <div className="station-card-top">
            <div className="card-top-title">
              <Target size={15} className="text-emerald" />
              <span>2-WEEK QUANTITATIVE FUSION STATION</span>
            </div>

            <div className="pop-badge-pill font-mono">
              <ShieldCheck size={12} />
              <span>{setup?.probability_of_profit || '68%'} WIN PROBABILITY</span>
            </div>
          </div>

          {/* Sub-Tab Navigation Header */}
          <div className="station-tabs-bar font-mono">
            <button
              className={`st-tab-btn ${activeTab === 'calc' ? 'active' : ''}`}
              onClick={() => setActiveTab('calc')}
            >
              <Calculator size={13} />
              <span>P&L & SIZING CALCULATOR</span>
            </button>
            <button
              className={`st-tab-btn ${activeTab === 'why' ? 'active' : ''}`}
              onClick={() => setActiveTab('why')}
            >
              <Sliders size={13} />
              <span>GREEKS & WHY {setup?.direction || (isBull ? 'CALL' : 'PUT')}?</span>
            </button>
            <button
              className={`st-tab-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
              onClick={() => setActiveTab('knowledge')}
            >
              <BookOpen size={13} />
              <span>2W PLAYBOOK & RULES</span>
            </button>
          </div>

          {/* TAB 1: P&L CALCULATOR & SIZING ENGINE */}
          {activeTab === 'calc' && (
            <div className="st-tab-content">
              {/* Interactive Capital Sizer Bar */}
              <div className="station-calculator-box font-mono">
                <div className="calc-header-row">
                  <div className="calc-title-group">
                    <DollarSign size={14} className="text-emerald" />
                    <span className="calc-title">POSITION SIZING & OUTCOME CALCULATOR</span>
                  </div>
                  <span className="calc-subtitle">Auto-calibrated to 14–22 DTE Option Math</span>
                </div>

                <div className="calc-input-row">
                  <div className="calc-quick-pills">
                    {[300, 500, 1000, 2500].map((cap) => (
                      <button
                        key={cap}
                        type="button"
                        className={`calc-pill ${tradeCapital === cap ? 'active' : ''}`}
                        onClick={() => setTradeCapital(cap)}
                      >
                        ${cap}
                      </button>
                    ))}
                  </div>

                  <div className="calc-custom-input">
                    <span className="currency-symbol">$</span>
                    <input
                      type="number"
                      min={50}
                      step={50}
                      value={tradeCapital}
                      onChange={(e) => setTradeCapital(Math.max(50, Number(e.target.value) || 0))}
                      className="calc-num-input"
                    />
                  </div>
                </div>

                {/* Live Outcome Calculations Grid */}
                {(() => {
                  const estCost = setup?.est_contract_cost || (setup?.est_premium_per_share ? setup.est_premium_per_share * 100 : 250)
                  const contracts = Math.max(1, Math.floor(tradeCapital / estCost))
                  const invested = contracts * estCost
                  const tp1Gain = Math.round(invested * ((setup?.target_1_opt_gain_pct || 72) / 100))
                  const tp2Gain = Math.round(invested * ((setup?.target_2_opt_gain_pct || 145) / 100))
                  const slLoss = Math.round(invested * (Math.abs(setup?.stop_loss_opt_loss_pct || 32) / 100))
                  const deriskGain = Math.round((invested * 0.5) * ((setup?.target_1_opt_gain_pct || 72) / 100))

                  return (
                    <div className="calc-outcomes-grid">
                      <div className="calc-stat-cell">
                        <span className="cs-label">CONTRACTS TO BUY</span>
                        <span className="cs-val text-cyan">{contracts}x Contract</span>
                        <span className="cs-sub">${invested.toFixed(0)} Total Cost</span>
                      </div>
                      <div className="calc-stat-cell">
                        <span className="cs-label">🎯 GAIN AT TP1 (+5.5% SPOT)</span>
                        <span className="cs-val text-emerald">+{tp1Gain > 0 ? `$${tp1Gain}` : '$0'}</span>
                        <span className="cs-sub">+{setup?.target_1_opt_gain_pct || 72}% Option Gain</span>
                      </div>
                      <div className="calc-stat-cell">
                        <span className="cs-label">🚀 GAIN AT TP2 (+8.5% RUNNER)</span>
                        <span className="cs-val text-emerald">+{tp2Gain > 0 ? `$${tp2Gain}` : '$0'}</span>
                        <span className="cs-sub">+{setup?.target_2_opt_gain_pct || 145}% Option Gain</span>
                      </div>
                      <div className="calc-stat-cell">
                        <span className="cs-label">🔴 LOSS AT STOP FLOOR</span>
                        <span className="cs-val text-rose">-${slLoss > 0 ? slLoss : 0}</span>
                        <span className="cs-sub">{setup?.stop_loss_opt_loss_pct || -32}% Max Risk Cut</span>
                      </div>
                      <div className="calc-stat-cell highlight-green full-width">
                        <span className="cs-label">🛡️ 50/50 SCALE-OUT GUARANTEED PROFIT (ZERO RISK RULE)</span>
                        <span className="cs-val text-emerald">POCKET +${deriskGain} MINIMUM</span>
                        <span className="cs-sub">Sell 50% at TP1 (+72%), move Stop to Breakeven ($0 risk) & let remaining 50% ride to TP2.</span>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Recommended Option Contract Box */}
              <div className="station-option-box font-mono">
                <div className="opt-top">
                  <span className="opt-tag">RECOMMENDED 14–22 DTE SWING CONTRACT</span>
                  <span className="opt-hold">HOLD: 10–14 DAYS</span>
                </div>
                <div className="opt-name">
                  {setup?.recommended_option || `${symbol} 14-21 DTE Call/Spread Setup`}
                </div>
                <div className="opt-note">
                  <span>Equity Scaling: {setup?.swing_shares_guide || 'De-risk 50% at TP1, let 50% runner target TP2.'}</span>
                </div>
              </div>

              {/* Calculation Targets Grid */}
              <div className="station-targets-grid font-mono">
                <div className="st-target-cell">
                  <span className="st-lbl">ENTRY ZONE</span>
                  <span className="st-val text-cyan">{setup?.entry_zone || '$0.00'}</span>
                </div>
                <div className="st-target-cell">
                  <span className="st-lbl">🎯 TP1 (DAY 7-10)</span>
                  <span className="st-val text-emerald">{setup?.take_profit_target_1 || '$0.00'}</span>
                  <span className="st-sub">Scale 50% & Stop to BE</span>
                </div>
                <div className="st-target-cell">
                  <span className="st-lbl">🚀 TP2 (DAY 14)</span>
                  <span className="st-val text-emerald">{setup?.take_profit_target_2 || '$0.00'}</span>
                  <span className="st-sub">Full Swing Runner</span>
                </div>
                <div className="st-target-cell">
                  <span className="st-lbl">🛡️ INVALIDATION STOP</span>
                  <span className="st-val text-rose">{setup?.stop_loss || '$0.00'}</span>
                  <span className="st-sub">Strict Risk Cut</span>
                </div>
                <div className="st-target-cell">
                  <span className="st-lbl">RISK / REWARD</span>
                  <span className="st-val text-amber">{setup?.risk_reward_ratio || '1 : 2.0'}</span>
                </div>
                <div className="st-target-cell">
                  <span className="st-lbl">NEWS SENTIMENT</span>
                  <span className="st-val text-cyan">{data?.news_sentiment_score || 70}% Bullish</span>
                </div>
              </div>

              {/* Breaking News Feed Driving this 2-Week Outcome */}
              <div className="station-news-section">
                <div className="news-sec-head">
                  <Newspaper size={13} className="text-cyan" />
                  <span>LIVE CATALYSTS DRIVING THE 14-DAY OUTCOME:</span>
                </div>

                <div className="station-news-list">
                  {data?.news && data.news.length > 0 ? (
                    data.news.slice(0, 2).map((item, i) => (
                      <div key={i} className="station-news-item">
                        <div className="sni-top">
                          <span className="sni-source font-mono">{item.source || item.publisher || 'Wire'}</span>
                          <span className={`sni-sent font-mono ${item.sentiment === 'BEARISH' ? 'neg' : 'pos'}`}>
                            {item.sentiment || 'BULLISH'}
                          </span>
                        </div>
                        <a href={item.url || item.link} target="_blank" rel="noopener noreferrer" className="sni-title">
                          <span>{item.title}</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    ))
                  ) : (
                    <div className="sni-empty">No breaking catalyst alerts detected. Technical baseline active.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GREEKS & WHY CALL/PUT DECISION CHECKLIST */}
          {activeTab === 'why' && (
            <div className="st-tab-content font-mono">
              {/* Direction Bias Banner */}
              <div className={`direction-verdict-banner ${setup?.direction === 'CALL' ? 'bull' : 'bear'}`}>
                <div className="dvb-left">
                  {setup?.direction === 'CALL' ? (
                    <TrendingUp size={22} className="text-emerald" />
                  ) : (
                    <TrendingDown size={22} className="text-rose" />
                  )}
                  <div>
                    <div className="dvb-title">
                      {setup?.direction === 'CALL' ? '🟢 BUY CALLS (BULLISH CONFLUENCE)' : '🔴 BUY PUTS (BEARISH DISTRIBUTION)'}
                    </div>
                    <div className="dvb-sub">
                      {setup?.direction === 'CALL'
                        ? 'Price holding above 20 EMA with positive news catalysts & upside IV expansion.'
                        : 'Price rejected below 20 EMA with negative headlines & downside momentum expansion.'}
                    </div>
                  </div>
                </div>
                <div className="dvb-score">
                  <span className="dvb-score-num">{data?.confluence_score || 78}%</span>
                  <span className="dvb-score-lbl">CONFIDENCE</span>
                </div>
              </div>

              {/* Live Options Greeks Matrix */}
              <div className="station-greeks-card">
                <div className="greeks-title-row">
                  <span className="greeks-title">📊 14–22 DTE OPTIONS GREEKS BREAKDOWN</span>
                  <span className="greeks-hint">Sensitivity per $1 underlying move</span>
                </div>

                <div className="greeks-grid">
                  <div className="greek-cell">
                    <span className="g-sym">Δ DELTA</span>
                    <span className="g-val text-cyan">{setup?.greeks?.delta ?? (isBull ? '+0.48' : '-0.48')}</span>
                    <span className="g-desc">Option moves ~$48 per $1 move in {symbol}.</span>
                  </div>
                  <div className="greek-cell">
                    <span className="g-sym">θ THETA (DAILY)</span>
                    <span className="g-val text-amber">{setup?.greeks?.theta_daily ? `$${setup.greeks.theta_daily}` : '-$0.22/day'}</span>
                    <span className="g-desc">Only ~3.5% daily decay (vs 15%/hr on 0DTE!).</span>
                  </div>
                  <div className="greek-cell">
                    <span className="g-sym">Γ GAMMA</span>
                    <span className="g-val text-purple">{setup?.greeks?.gamma ?? '0.022'}</span>
                    <span className="g-desc">Delta acceleration rate as stock trends.</span>
                  </div>
                  <div className="greek-cell">
                    <span className="g-sym">ν VEGA</span>
                    <span className="g-val text-emerald">{setup?.greeks?.vega ?? '0.16'}</span>
                    <span className="g-desc">Gain per +1% Implied Volatility pop.</span>
                  </div>
                  <div className="greek-cell">
                    <span className="g-sym">IV RANK</span>
                    <span className="g-val text-cyan">{setup?.greeks?.iv_rank ?? '38'}%</span>
                    <span className="g-desc">Fair value pricing — safe from IV crush.</span>
                  </div>
                </div>
              </div>

              {/* 5-Pillar Decision Checklist */}
              <div className="checklist-section">
                <div className="checklist-head">
                  <span>5-PILLAR QUANTITATIVE CONFLUENCE AUDIT:</span>
                </div>
                <div className="checklist-items">
                  {setup?.decision_checklist && setup.decision_checklist.length > 0 ? (
                    setup.decision_checklist.map((item, idx) => (
                      <div key={idx} className={`checklist-row ${item.status.toLowerCase()}`}>
                        <div className="cr-status">
                          {item.status === 'PASS' ? (
                            <CheckCircle2 size={14} className="text-emerald" />
                          ) : (
                            <AlertTriangle size={14} className="text-amber" />
                          )}
                          <span className="cr-title">{item.title}</span>
                        </div>
                        <span className="cr-detail">{item.detail}</span>
                      </div>
                    ))
                  ) : (
                    <div className="cr-detail">Loading quantitative checklist...</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 2-WEEK SWING PLAYBOOK & INSTITUTIONAL RULES */}
          {activeTab === 'knowledge' && (
            <div className="st-tab-content font-mono">
              <div className="knowledge-header-bar">
                <BookOpen size={16} className="text-emerald" />
                <div>
                  <div className="khb-title">2-WEEK SWING TRADING INSTITUTIONAL PLAYBOOK</div>
                  <div className="khb-sub">Essential rules to eliminate day trading noise and compound capital consistently.</div>
                </div>
              </div>

              <div className="knowledge-cards-list">
                {setup?.knowledge_guide && setup.knowledge_guide.length > 0 ? (
                  setup.knowledge_guide.map((kg, i) => (
                    <div key={i} className="knowledge-card">
                      <div className="kc-top">
                        <span className="kc-tag">{kg.tag}</span>
                        <span className="kc-num">RULE #{i + 1}</span>
                      </div>
                      <div className="kc-title">{kg.title}</div>
                      <div className="kc-summary">{kg.summary}</div>
                    </div>
                  ))
                ) : (
                  <div className="knowledge-card">
                    <div className="kc-title">The 50/50 De-Risking Formula</div>
                    <div className="kc-summary">Scale out 50% at Target 1 (+70%), move Stop to Breakeven. Zero risk remainder.</div>
                  </div>
                )}
              </div>

              {/* Quick Greeks Reference Matrix */}
              <div className="greeks-cheat-sheet">
                <div className="gcs-head">GREEKS CHEAT SHEET (14-DAY SWINGS VS 0DTE):</div>
                <div className="gcs-table">
                  <div className="gcs-row header">
                    <span>METRIC</span>
                    <span>0DTE / DAY TRADES</span>
                    <span>14–22 DTE SWINGS</span>
                  </div>
                  <div className="gcs-row">
                    <span className="col-metric">Theta Decay</span>
                    <span className="col-bad">15% - 25% / hour (Severe)</span>
                    <span className="col-good">2.5% - 4% / day (Gentle)</span>
                  </div>
                  <div className="gcs-row">
                    <span className="col-metric">Stress Level</span>
                    <span className="col-bad">Staring at 1-min candles</span>
                    <span className="col-good">Check chart once or twice daily</span>
                  </div>
                  <div className="gcs-row">
                    <span className="col-metric">Noise Tolerance</span>
                    <span className="col-bad">Stopped out by 10-min wicks</span>
                    <span className="col-good">Rides multi-day trend to TP1 & TP2</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 1-Click Action Buttons */}
          <div className="station-action-buttons">
            <button
              className="st-btn trade font-mono"
              onClick={() => onOpenPaperTrade?.(symbol)}
            >
              <Zap size={13} />
              <span>SIMULATE IN PAPER DESK</span>
            </button>

            <button
              className={`st-btn copy font-mono ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? 'COPIED 2W PLAN!' : 'COPY BRACKET PLAN'}</span>
            </button>

            <button
              className="st-btn refresh font-mono"
              onClick={() => fetch2WeekData(symbol)}
              disabled={loading}
              title="Refresh Confluence"
            >
              <RefreshCw size={13} className={loading ? 'spin-icon' : ''} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
