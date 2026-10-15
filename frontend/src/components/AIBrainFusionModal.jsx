import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu,
  Zap,
  TrendingUp,
  TrendingDown,
  Newspaper,
  BarChart3,
  ExternalLink,
  RefreshCw,
  X,
  Sliders,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Search,
  Calendar,
  Layers,
  Clock,
  Target,
  Percent,
  Activity,
  ChevronRight,
  Info
} from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid
} from 'recharts'

const QUICK_TICKERS = ['QQQ', 'NVDA', 'AAPL', 'TSLA', 'SPY', 'MSFT', 'AMZN', 'BTC-USD', 'EOSE']

// Custom Interactive Tooltip for the 2-Week Technical + Forward Corridor Chart
const BrainChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null

  const dataPoint = payload[0]?.payload || {}
  const isProjected = dataPoint.is_projected
  const priceVal = dataPoint.price
  const ema20Val = dataPoint.ema20
  const ema50Val = dataPoint.ema50
  const projBase = dataPoint.projected_base
  const projHigh = dataPoint.projected_high
  const projLow = dataPoint.projected_low
  const target1 = dataPoint.target_1
  const target2 = dataPoint.target_2
  const stopLoss = dataPoint.stop_loss

  return (
    <div className="brain-chart-tooltip font-mono">
      <div className="tooltip-head">
        <span className="tooltip-date">{label}</span>
        <span className={`tooltip-phase-tag ${isProjected ? 'projected' : 'historical'}`}>
          {isProjected ? '2-WEEK PROJECTION' : 'HISTORICAL SPOT'}
        </span>
      </div>

      <div className="tooltip-body">
        {!isProjected && priceVal != null && (
          <div className="tooltip-row">
            <span className="t-row-label">Spot Close:</span>
            <span className="t-row-val text-cyan">${priceVal.toFixed(2)}</span>
          </div>
        )}

        {isProjected && projBase != null && (
          <div className="tooltip-row highlight">
            <span className="t-row-label">Projected Base:</span>
            <span className="t-row-val text-cyan">${projBase.toFixed(2)}</span>
          </div>
        )}

        {isProjected && projHigh != null && (
          <div className="tooltip-row">
            <span className="t-row-label">Bull Target Corridor:</span>
            <span className="t-row-val text-emerald">${projHigh.toFixed(2)}</span>
          </div>
        )}

        {isProjected && projLow != null && (
          <div className="tooltip-row">
            <span className="t-row-label">Stop Boundary Cone:</span>
            <span className="t-row-val text-rose">${projLow.toFixed(2)}</span>
          </div>
        )}

        {!isProjected && ema20Val != null && (
          <div className="tooltip-row">
            <span className="t-row-label">20-Day EMA:</span>
            <span className="t-row-val text-amber">${ema20Val.toFixed(2)}</span>
          </div>
        )}

        {!isProjected && ema50Val != null && (
          <div className="tooltip-row">
            <span className="t-row-label">50-Day EMA:</span>
            <span className="t-row-val text-purple">${ema50Val.toFixed(2)}</span>
          </div>
        )}

        {target1 != null && (
          <div className="tooltip-row target">
            <span className="t-row-label">Take Profit 1:</span>
            <span className="t-row-val text-emerald">${target1.toFixed(2)}</span>
          </div>
        )}

        {target2 != null && (
          <div className="tooltip-row target">
            <span className="t-row-label">Take Profit 2 (Runner):</span>
            <span className="t-row-val text-emerald">${target2.toFixed(2)}</span>
          </div>
        )}

        {stopLoss != null && (
          <div className="tooltip-row stop">
            <span className="t-row-label">Invalidation Stop:</span>
            <span className="t-row-val text-rose">${stopLoss.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AIBrainFusionModal({
  isOpen,
  onClose,
  initialSymbol = 'QQQ',
  API_BASE_URL = 'http://127.0.0.1:8001',
  onOpenPaperTrade,
  onOpenFullChart
}) {
  const [symbol, setSymbol] = useState(initialSymbol)
  const [customTicker, setCustomTicker] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const [horizon, setHorizon] = useState('2w') // '2w' (10-14 days swing) | '1d' (intraday)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [brainData, setBrainData] = useState(null)
  const [activeTab, setActiveTab] = useState('chart') // 'chart' | 'news' | 'calculator' | 'all'

  // Indicator Visibility Toggles for Technical Graph
  const [showEma20, setShowEma20] = useState(true)
  const [showEma50, setShowEma50] = useState(true)
  const [showCorridor, setShowCorridor] = useState(true)
  const [showTargets, setShowTargets] = useState(true)

  useEffect(() => {
    if (initialSymbol) {
      setSymbol(initialSymbol)
    }
  }, [initialSymbol])

  useEffect(() => {
    if (isOpen) {
      fetchBrainFusion(symbol, userQuery, horizon)
    }
  }, [isOpen, symbol, horizon])

  const fetchBrainFusion = async (targetSymbol, query = '', targetHorizon = horizon) => {
    if (!targetSymbol) return
    setLoading(true)
    setError(null)
    try {
      const url = `${API_BASE_URL}/api/brain/fusion/?symbol=${encodeURIComponent(targetSymbol)}&query=${encodeURIComponent(query)}&horizon=${targetHorizon}`
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`)
      }
      const data = await res.json()
      setBrainData(data)
    } catch (err) {
      console.error('Failed to fetch AI Brain fusion:', err)
      setError('Could not reach AI Brain dual-engine. Please check server connection or retry.')
    } finally {
      setLoading(false)
    }
  }

  const handleCustomSubmit = (e) => {
    e.preventDefault()
    if (customTicker.trim()) {
      const clean = customTicker.trim().toUpperCase()
      setSymbol(clean)
      setCustomTicker('')
      fetchBrainFusion(clean, userQuery, horizon)
    }
  }

  const handleQuerySubmit = (e) => {
    e.preventDefault()
    fetchBrainFusion(symbol, userQuery, horizon)
  }

  const handleHorizonChange = (newHorizon) => {
    setHorizon(newHorizon)
    fetchBrainFusion(symbol, userQuery, newHorizon)
  }

  // Seamlessly merge historical candle series with forward 2-week projection corridor
  const chartData = useMemo(() => {
    if (!brainData?.chart_series?.length) return []

    // Take last 28 historical daily sessions for optimal readability
    const historyBars = brainData.chart_series.slice(-28).map((bar) => ({
      date: bar.date,
      displayDate: bar.date,
      price: bar.price,
      ema20: bar.ema20,
      ema50: bar.ema50,
      upper_band: bar.upper_band,
      lower_band: bar.lower_band,
      projected_base: null,
      projected_high: null,
      projected_low: null,
      is_projected: false
    }))

    const forwardPoints = (brainData.forward_projection || []).map((pt, idx) => ({
      date: pt.date === 'Today' ? 'Today' : `${pt.date} (${pt.full_date || ''})`,
      displayDate: pt.date,
      price: idx === 0 ? pt.price : null,
      ema20: idx === 0 && historyBars.length ? historyBars[historyBars.length - 1].ema20 : null,
      ema50: idx === 0 && historyBars.length ? historyBars[historyBars.length - 1].ema50 : null,
      upper_band: null,
      lower_band: null,
      projected_base: pt.projected_base,
      projected_high: pt.projected_high,
      projected_low: pt.projected_low,
      target_1: pt.target_1,
      target_2: pt.target_2,
      stop_loss: pt.stop_loss,
      is_projected: true
    }))

    // Tie the last historical point with the origin of the forward cone
    if (historyBars.length && forwardPoints.length) {
      const lastHist = historyBars[historyBars.length - 1]
      lastHist.projected_base = lastHist.price
      lastHist.projected_high = lastHist.price
      lastHist.projected_low = lastHist.price
    }

    return [...historyBars, ...forwardPoints.slice(1)]
  }, [brainData])

  // Calculate dynamic Min/Max for Recharts Y-Axis
  const yDomain = useMemo(() => {
    if (!chartData.length) return ['auto', 'auto']
    let min = Infinity
    let max = -Infinity

    chartData.forEach((d) => {
      [d.price, d.ema20, d.ema50, d.projected_base, d.projected_high, d.projected_low].forEach((v) => {
        if (v != null && typeof v === 'number' && !isNaN(v)) {
          if (v < min) min = v
          if (v > max) max = v
        }
      })
    })

    if (min === Infinity || max === -Infinity) return ['auto', 'auto']
    const padding = (max - min) * 0.08
    return [Math.max(0, Math.floor(min - padding)), Math.ceil(max + padding)]
  }, [chartData])

  if (!isOpen) return null

  const confluence = brainData?.confluence_score || 72
  const newsScore = brainData?.news_sentiment_score || 70
  const techScore = brainData?.technical_score || 75
  const verdict = brainData?.verdict || 'BULLISH'
  const isBull = verdict.includes('BULL')
  const isBear = verdict.includes('BEAR')

  const badgeColor = isBull ? '#10b981' : isBear ? '#ef4444' : '#f59e0b'
  const badgeBg = isBull ? 'rgba(16, 185, 129, 0.12)' : isBear ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)'

  const currentPrice = brainData?.technicals?.current_price || 0
  const expMove = brainData?.technicals?.expected_move || 0
  const expMovePct = brainData?.technicals?.expected_move_pct || 0
  const tradeSetup = brainData?.trade_setup

  return (
    <AnimatePresence>
      <div className="brain-modal-overlay" onClick={onClose}>
        <motion.div
          className="brain-modal-container font-mono"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Header Bar */}
          <div className="brain-modal-header">
            <div className="brain-header-title-group">
              <div className="brain-icon-glow">
                <Cpu size={20} />
              </div>
              <div>
                <div className="brain-title-row">
                  <span className="brain-title">KAPPA 2-WEEK SWING & AI CONFLUENCE TERMINAL</span>
                  <span className="brain-version-tag">ENGINE v4.0 • 14D CONE</span>
                </div>
                <p className="brain-subtitle">
                  Combines multi-day quantitative moving averages & volatility bands with breaking news catalysts to calculate 10–14 day swing probability.
                </p>
              </div>
            </div>

            <button className="brain-close-btn" onClick={onClose} title="Close Terminal">
              <X size={18} />
            </button>
          </div>

          {/* Horizon Selection Bar (2-Week Swing vs 1-Day Scalp) */}
          <div className="brain-horizon-bar">
            <div className="horizon-tabs-group">
              <button
                className={`horizon-pill ${horizon === '2w' ? 'active' : ''}`}
                onClick={() => handleHorizonChange('2w')}
              >
                <Calendar size={13} />
                <span>📅 2-WEEK SWING HORIZON (10 - 14 DAYS)</span>
                {horizon === '2w' && <span className="horizon-active-dot" />}
              </button>

              <button
                className={`horizon-pill ${horizon === '1d' ? 'active' : ''}`}
                onClick={() => handleHorizonChange('1d')}
              >
                <Zap size={13} />
                <span>⚡ 1-DAY SCALP (INTRADAY)</span>
                {horizon === '1d' && <span className="horizon-active-dot" />}
              </button>
            </div>

            <div className="horizon-meta-info">
              <Clock size={12} className="text-cyan" />
              <span>Target Model: <strong>{horizon === '2w' ? '14-Day Forward Implied Volatility Cone' : '1-Day Expected Range'}</strong></span>
            </div>
          </div>

          {/* Quick Switcher & Ticker Search Bar */}
          <div className="brain-ticker-bar">
            <div className="quick-ticker-pills">
              <span className="quick-label">POPULAR ASSETS:</span>
              {QUICK_TICKERS.map((t) => (
                <button
                  key={t}
                  className={`ticker-chip ${symbol === t ? 'active' : ''}`}
                  onClick={() => setSymbol(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <form onSubmit={handleCustomSubmit} className="ticker-custom-form">
              <Search size={13} className="custom-input-icon" />
              <input
                type="text"
                className="ticker-custom-input"
                placeholder="Custom Ticker (e.g. AMD, META)..."
                value={customTicker}
                onChange={(e) => setCustomTicker(e.target.value)}
              />
              <button type="submit" className="ticker-submit-btn">
                Analyze
              </button>
            </form>
          </div>

          {/* Interactive Query / Catalyst Bar */}
          <form onSubmit={handleQuerySubmit} className="brain-query-bar">
            <Sparkles size={14} className="query-sparkle" />
            <input
              type="text"
              className="brain-query-input"
              placeholder={`Ask AI Brain about 2-week scenario for ${symbol}: e.g. "Will ${symbol} break resistance over the next 2 weeks on upcoming earnings?"`}
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
            />
            <button type="submit" className="query-ask-btn" disabled={loading}>
              {loading ? <RefreshCw size={13} className="spin-icon" /> : <Zap size={13} />}
              <span>{loading ? 'Synthesizing...' : 'Calculate 2W Plan'}</span>
            </button>
          </form>

          {/* View Mode Navigation Tabs */}
          <div className="brain-view-tabs-bar">
            <button
              className={`view-tab-btn ${activeTab === 'chart' ? 'active' : ''}`}
              onClick={() => setActiveTab('chart')}
            >
              <BarChart3 size={13} />
              <span>Technical Graph & 2-Week Cone</span>
            </button>

            <button
              className={`view-tab-btn ${activeTab === 'news' ? 'active' : ''}`}
              onClick={() => setActiveTab('news')}
            >
              <Newspaper size={13} />
              <span>Breaking News Catalysts ({brainData?.news?.length || 0})</span>
            </button>

            <button
              className={`view-tab-btn ${activeTab === 'calculator' ? 'active' : ''}`}
              onClick={() => setActiveTab('calculator')}
            >
              <Target size={13} />
              <span>2-Week Swing & Options Calculator</span>
            </button>

            <button
              className={`view-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <Layers size={13} />
              <span>Full Workstation View</span>
            </button>
          </div>

          {/* Modal Main Content */}
          <div className="brain-modal-content">
            {loading && !brainData ? (
              <div className="brain-loading-state">
                <RefreshCw size={36} className="spin-icon text-cyan" />
                <h4>Calculating 2-Week Confluence Result...</h4>
                <p>Computing 45-day technical moving averages + 14-day implied volatility cone + Live news wire sentiment</p>
              </div>
            ) : error ? (
              <div className="brain-error-state">
                <AlertTriangle size={32} className="text-rose" />
                <h4>Calculation Failed</h4>
                <p>{error}</p>
                <button className="retry-pill" onClick={() => fetchBrainFusion(symbol, userQuery, horizon)}>
                  <RefreshCw size={13} /> Try Again
                </button>
              </div>
            ) : brainData ? (
              <>
                {/* 1. Confluence Result Hero Summary */}
                <div className="brain-confluence-hero">
                  <div className="confluence-verdict-box" style={{ borderColor: badgeColor, background: badgeBg }}>
                    <div className="verdict-label-row">
                      <span className="verdict-sub">
                        {horizon === '2w' ? '2-WEEK SWING STATISTICAL VERDICT' : 'INTRADAY SCALP VERDICT'}
                      </span>
                      <span className="verdict-tag" style={{ color: badgeColor, borderColor: badgeColor }}>
                        {isBull ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {verdict}
                      </span>
                    </div>

                    <div className="confluence-score-row">
                      <span className="score-num font-mono" style={{ color: badgeColor }}>
                        {confluence}%
                      </span>
                      <div className="score-meta">
                        <span className="score-title">
                          Fused 2-Week Confluence Accuracy ({tradeSetup?.probability_of_profit || `${confluence}%`} PoP)
                        </span>
                        <span className="score-desc">
                          {confluence >= 70
                            ? 'High statistical probability: Technical EMA alignment and news catalyst momentum strongly point in the same direction for a 10–14 day swing.'
                            : confluence >= 55
                            ? 'Moderate probability: Signal confirmed with mild resistance overhead. Target 1 scaling advised.'
                            : 'Cautious probability: Conflicting news sentiment vs technical trend. Small position or spread recommended.'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2-Week Metrics Snapshot Cards */}
                  <div className="confluence-split-meters">
                    <div className="meter-card">
                      <div className="meter-head">
                        <span className="meter-name">
                          <Activity size={13} /> 2-Week Implied Move
                        </span>
                        <span className="meter-weight font-mono">14-Day Vol</span>
                      </div>
                      <div className="calc-stat-hero">
                        <span className="calc-stat-val text-cyan font-mono">
                          ±${expMove.toFixed(2)}
                        </span>
                        <span className="calc-stat-sub font-mono">
                          (±{expMovePct.toFixed(2)}% Range)
                        </span>
                      </div>
                      <div className="meter-footer">
                        <span>Current Spot: ${currentPrice.toFixed(2)}</span>
                        <span className="text-emerald">Target: {tradeSetup?.take_profit_target_1 || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="meter-card">
                      <div className="meter-head">
                        <span className="meter-name">
                          <Newspaper size={13} /> News Catalyst Factor
                        </span>
                        <span className="meter-weight font-mono">{newsScore}% Bullish</span>
                      </div>
                      <div className="meter-bar-track">
                        <div
                          className="meter-bar-fill news-fill"
                          style={{ width: `${Math.min(100, Math.max(10, newsScore))}%` }}
                        />
                      </div>
                      <div className="meter-footer">
                        <span>Sentiment: {brainData.news_summary?.sentiment_label || 'BULLISH'}</span>
                        <span className="meter-val font-mono">{brainData.news?.length || 0} Articles Ingested</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Interactive Technical Graph + 2-Week Forward Corridor Cone */}
                {(activeTab === 'chart' || activeTab === 'all') && (
                  <div className="brain-chart-card">
                    <div className="chart-header-row">
                      <div className="chart-header-left">
                        <BarChart3 size={16} className="text-cyan" />
                        <div>
                          <span className="chart-title">TECHNICAL GRAPH & 2-WEEK FORWARD CORRIDOR</span>
                          <span className="chart-subtitle">
                            Historical price with 20/50 EMAs + 14-day forward expected move cone (Target 1, Target 2, Invalidation Stop)
                          </span>
                        </div>
                      </div>

                      {/* Indicator Toggles */}
                      <div className="chart-toggle-group">
                        <button
                          className={`chart-toggle-btn ${showEma20 ? 'active' : ''}`}
                          onClick={() => setShowEma20(!showEma20)}
                        >
                          <span className="toggle-dot" style={{ background: '#f59e0b' }} />
                          <span>EMA 20</span>
                        </button>

                        <button
                          className={`chart-toggle-btn ${showEma50 ? 'active' : ''}`}
                          onClick={() => setShowEma50(!showEma50)}
                        >
                          <span className="toggle-dot" style={{ background: '#a855f7' }} />
                          <span>EMA 50</span>
                        </button>

                        <button
                          className={`chart-toggle-btn ${showCorridor ? 'active' : ''}`}
                          onClick={() => setShowCorridor(!showCorridor)}
                        >
                          <span className="toggle-dot" style={{ background: '#10b981' }} />
                          <span>2W Corridor Cone</span>
                        </button>
                      </div>
                    </div>

                    {/* Chart Container */}
                    <div className="brain-chart-wrapper">
                      <ResponsiveContainer width="100%" height={320}>
                        <ComposedChart data={chartData} margin={{ top: 20, right: 25, left: 10, bottom: 5 }}>
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
                          <Tooltip content={<BrainChartTooltip />} />

                          {/* Historical Price Line */}
                          <Line
                            type="monotone"
                            dataKey="price"
                            stroke="#38bdf8"
                            strokeWidth={2.4}
                            dot={false}
                            name="Historical Spot"
                            isAnimationActive={false}
                          />

                          {/* 20-Day EMA Line */}
                          {showEma20 && (
                            <Line
                              type="monotone"
                              dataKey="ema20"
                              stroke="#f59e0b"
                              strokeWidth={1.7}
                              strokeDasharray="3 3"
                              dot={false}
                              name="20-Day EMA"
                              isAnimationActive={false}
                            />
                          )}

                          {/* 50-Day EMA Line */}
                          {showEma50 && (
                            <Line
                              type="monotone"
                              dataKey="ema50"
                              stroke="#a855f7"
                              strokeWidth={1.7}
                              strokeDasharray="4 4"
                              dot={false}
                              name="50-Day EMA"
                              isAnimationActive={false}
                            />
                          )}

                          {/* Forward Projection Corridor Cone */}
                          {showCorridor && (
                            <>
                              {/* Upper Bull Target Corridor Line */}
                              <Line
                                type="monotone"
                                dataKey="projected_high"
                                stroke="#10b981"
                                strokeWidth={2.2}
                                strokeDasharray="4 4"
                                dot={{ r: 3.5, fill: '#10b981' }}
                                name="Upper Bull Target Corridor"
                                isAnimationActive={false}
                              />

                              {/* Base Case Trajectory Line */}
                              <Line
                                type="monotone"
                                dataKey="projected_base"
                                stroke="#06b6d4"
                                strokeWidth={2.5}
                                dot={{ r: 4, fill: '#06b6d4' }}
                                name="2-Week Base Trajectory"
                                isAnimationActive={false}
                              />

                              {/* Lower Invalidation Stop Corridor Line */}
                              <Line
                                type="monotone"
                                dataKey="projected_low"
                                stroke="#ef4444"
                                strokeWidth={2.2}
                                strokeDasharray="4 4"
                                dot={{ r: 3.5, fill: '#ef4444' }}
                                name="Invalidation Stop Cone"
                                isAnimationActive={false}
                              />
                            </>
                          )}

                          {/* Today Origin Reference Line */}
                          <ReferenceLine
                            x="Today"
                            stroke="#94a3b8"
                            strokeDasharray="3 3"
                            label={{
                              value: 'TODAY (ORIGIN)',
                              position: 'top',
                              fill: '#94a3b8',
                              fontSize: 10,
                              fontWeight: 700
                            }}
                          />

                          {/* Target 1 Reference Line */}
                          {showTargets && tradeSetup?.take_profit_target_1 && (
                            <ReferenceLine
                              y={parseFloat(tradeSetup.take_profit_target_1.replace(/[^0-9.]/g, ''))}
                              stroke="#10b981"
                              strokeDasharray="2 2"
                              label={{
                                value: `TARGET 1: ${tradeSetup.take_profit_target_1.split(' ')[0]}`,
                                position: 'insideTopLeft',
                                fill: '#10b981',
                                fontSize: 10
                              }}
                            />
                          )}

                          {/* Stop Loss Reference Line */}
                          {showTargets && tradeSetup?.stop_loss && (
                            <ReferenceLine
                              y={parseFloat(tradeSetup.stop_loss.replace(/[^0-9.]/g, ''))}
                              stroke="#ef4444"
                              strokeDasharray="2 2"
                              label={{
                                value: `STOP: ${tradeSetup.stop_loss.split(' ')[0]}`,
                                position: 'insideBottomLeft',
                                fill: '#ef4444',
                                fontSize: 10
                              }}
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Chart Legend / Footnote */}
                    <div className="chart-legend-row">
                      <div className="legend-chip">
                        <span className="legend-indicator blue" />
                        <span>Historical Price</span>
                      </div>
                      <div className="legend-chip">
                        <span className="legend-indicator amber" />
                        <span>20 EMA (${brainData.technicals?.ema_20?.toFixed(2)})</span>
                      </div>
                      <div className="legend-chip">
                        <span className="legend-indicator purple" />
                        <span>50 EMA (${brainData.technicals?.ema_50?.toFixed(2)})</span>
                      </div>
                      <div className="legend-chip">
                        <span className="legend-indicator green-dash" />
                        <span>Bull Target Cone</span>
                      </div>
                      <div className="legend-chip">
                        <span className="legend-indicator cyan" />
                        <span>Base Trajectory</span>
                      </div>
                      <div className="legend-chip">
                        <span className="legend-indicator red-dash" />
                        <span>Stop Boundary</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. 2-Week Options & Swing Calculation Result Card */}
                {(activeTab === 'calculator' || activeTab === 'all') && tradeSetup && (
                  <div className="brain-calculator-card">
                    <div className="calc-card-header">
                      <div className="header-left">
                        <Target size={16} className="text-emerald" />
                        <div>
                          <span className="calc-title">2-WEEK SWING & OPTIONS CALCULATION RESULT</span>
                          <span className="calc-subtitle">
                            Algorithmic position structure designed for 10–14 day hold (14–22 DTE options or swing shares)
                          </span>
                        </div>
                      </div>
                      <span className="pop-pill font-mono">
                        {tradeSetup.probability_of_profit || `${confluence}%`} WIN PROBABILITY
                      </span>
                    </div>

                    {/* Recommended Option Contract Banner */}
                    <div className="option-contract-hero-box">
                      <div className="contract-top-row">
                        <span className="contract-tag">RECOMMENDED 14–22 DTE OPTION CONTRACT</span>
                        <span className="contract-dte font-mono">SWING DURATION: 10 - 14 DAYS</span>
                      </div>
                      <div className="contract-name font-mono">
                        {tradeSetup.recommended_option}
                      </div>
                      <div className="contract-guide">
                        <span>Equity Plan: {tradeSetup.swing_shares_guide}</span>
                      </div>
                    </div>

                    {/* Trade Setup Matrix */}
                    <div className="trade-setup-grid">
                      <div className="setup-box">
                        <span className="s-label">ENTRY ZONE</span>
                        <span className="s-val font-mono text-cyan">{tradeSetup.entry_zone}</span>
                      </div>
                      <div className="setup-box">
                        <span className="s-label">TARGET 1 (7-10 DAYS)</span>
                        <span className="s-val font-mono text-emerald">{tradeSetup.take_profit_target_1}</span>
                      </div>
                      <div className="setup-box">
                        <span className="s-label">TARGET 2 (14-DAY RUNNER)</span>
                        <span className="s-val font-mono text-emerald">{tradeSetup.take_profit_target_2}</span>
                      </div>
                      <div className="setup-box">
                        <span className="s-label">INVALIDATION STOP</span>
                        <span className="s-val font-mono text-rose">{tradeSetup.stop_loss}</span>
                      </div>
                      <div className="setup-box">
                        <span className="s-label">RISK / REWARD RATIO</span>
                        <span className="s-val font-mono text-amber">{tradeSetup.risk_reward_ratio}</span>
                      </div>
                      <div className="setup-box">
                        <span className="s-label">2-WEEK EXPECTED MOVE</span>
                        <span className="s-val font-mono text-cyan">±{expMovePct.toFixed(2)}% (±${expMove.toFixed(2)})</span>
                      </div>
                    </div>

                    {/* Key Technical Pivots Grid */}
                    <div className="pivots-row">
                      <div className="pivot-item">
                        <span className="p-tag">2-WEEK SUPPORT S1</span>
                        <span className="p-num font-mono">${brainData.technicals?.pivot_support?.toFixed(2)}</span>
                      </div>
                      <div className="pivot-item highlight">
                        <span className="p-tag">CURRENT SPOT</span>
                        <span className="p-num font-mono">${currentPrice.toFixed(2)}</span>
                      </div>
                      <div className="pivot-item">
                        <span className="p-tag">2-WEEK RESISTANCE R1</span>
                        <span className="p-num font-mono">${brainData.technicals?.pivot_resistance?.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Live News Catalysts with 2-Week Impact */}
                {(activeTab === 'news' || activeTab === 'all') && (
                  <div className="brain-news-catalysts-card">
                    <div className="column-card-header">
                      <div className="header-left">
                        <Newspaper size={16} className="text-cyan" />
                        <div>
                          <span className="col-title">BREAKING NEWS CATALYSTS (FEEDING 2-WEEK CALCULATION)</span>
                          <span className="col-sub">
                            Live headlines parsed for sentiment to confirm whether macro flow supports the technical move
                          </span>
                        </div>
                      </div>
                      <span className="col-count-chip">
                        {brainData.news?.length || 0} HEADLINES INGESTED
                      </span>
                    </div>

                    <div className="news-stream-list">
                      {brainData.news && brainData.news.length > 0 ? (
                        brainData.news.map((item, idx) => {
                          const artSent = item.score != null ? item.score : (item.sentiment_score || 0.5)
                          const isPos = artSent >= 0.55 || (item.sentiment === 'BULLISH')
                          const isNeg = artSent <= 0.40 || (item.sentiment === 'BEARISH')
                          const chipColor = isPos ? '#10b981' : isNeg ? '#ef4444' : '#64748b'
                          const chipBg = isPos ? 'rgba(16, 185, 129, 0.1)' : isNeg ? 'rgba(239, 68, 68, 0.1)' : 'rgba(100, 116, 139, 0.1)'
                          const sentimentText = item.sentiment || (isPos ? 'BULLISH' : isNeg ? 'BEARISH' : 'NEUTRAL')

                          return (
                            <div key={idx} className="news-wire-item">
                              <div className="news-item-top">
                                <span className="news-provider-badge">{item.source || item.publisher || 'Financial Wire'}</span>
                                <div className="news-badge-group">
                                  <span className="news-time-tag">{item.time || 'Recent'}</span>
                                  <span
                                    className="news-sentiment-chip font-mono"
                                    style={{ color: chipColor, background: chipBg, borderColor: chipColor }}
                                  >
                                    {sentimentText} ({(artSent * 100).toFixed(0)}%)
                                  </span>
                                </div>
                              </div>
                              <a
                                href={item.url || item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="news-wire-title"
                              >
                                <span>{item.title}</span>
                                <ExternalLink size={12} className="link-ext" />
                              </a>
                              {item.summary && (
                                <p className="news-wire-snippet">{item.summary}</p>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <div className="empty-news-box">
                          <span>No breaking news catalysts found in current cycle. Technical baseline active.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. Institutional AI Synthesis & Actionable Trade Plan */}
                <div className="brain-synthesis-card">
                  <div className="synthesis-header">
                    <Sparkles size={16} className="text-amber" />
                    <span className="synthesis-title">INSTITUTIONAL AI 2-WEEK SYNTHESIS & EXECUTION ROADMAP</span>
                  </div>
                  <p className="synthesis-body">{brainData.ai_synthesis}</p>

                  {/* Quick Action Buttons */}
                  <div className="brain-actions-row">
                    <button
                      className="action-btn paper-btn font-mono"
                      onClick={() => {
                        onClose?.()
                        onOpenPaperTrade?.(symbol)
                      }}
                    >
                      <Briefcase size={14} />
                      <span>Track in Live Execution Desk</span>
                    </button>

                    <button
                      className="action-btn chart-btn font-mono"
                      onClick={() => {
                        onClose?.()
                        onOpenFullChart?.({ symbol, current_price: currentPrice })
                      }}
                    >
                      <BarChart3 size={14} />
                      <span>Open Full Candlestick Chart</span>
                    </button>

                    <button
                      className="action-btn refresh-btn font-mono"
                      onClick={() => fetchBrainFusion(symbol, userQuery, horizon)}
                    >
                      <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
                      <span>Recalculate Confluence</span>
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
