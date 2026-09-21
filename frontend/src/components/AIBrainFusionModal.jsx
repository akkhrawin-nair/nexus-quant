import { useState, useEffect } from 'react'
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
  Search
} from 'lucide-react'

const QUICK_TICKERS = ['QQQ', 'NVDA', 'AAPL', 'TSLA', 'SPY', 'BTC-USD', 'MSFT', 'AMZN']

export default function AIBrainFusionModal({
  isOpen,
  onClose,
  initialSymbol = 'QQQ',
  API_BASE_URL = 'http://127.0.0.1:8000',
  onOpenPaperTrade,
  onOpenFullChart
}) {
  const [symbol, setSymbol] = useState(initialSymbol)
  const [customTicker, setCustomTicker] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [brainData, setBrainData] = useState(null)
  const [activeTab, setActiveTab] = useState('fusion') // 'fusion' | 'news' | 'technicals'

  useEffect(() => {
    if (initialSymbol) {
      setSymbol(initialSymbol)
    }
  }, [initialSymbol])

  useEffect(() => {
    if (isOpen) {
      fetchBrainFusion(symbol)
    }
  }, [isOpen, symbol])

  const fetchBrainFusion = async (targetSymbol, query = '') => {
    if (!targetSymbol) return
    setLoading(true)
    setError(null)
    try {
      const url = `${API_BASE_URL}/api/brain/fusion/?symbol=${encodeURIComponent(targetSymbol)}&query=${encodeURIComponent(query)}`
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`)
      }
      const data = await res.json()
      setBrainData(data)
    } catch (err) {
      console.error('Failed to fetch AI Brain fusion:', err)
      setError('Could not reach AI Brain dual-engine. Please check connection or retry.')
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
      fetchBrainFusion(clean, userQuery)
    }
  }

  const handleQuerySubmit = (e) => {
    e.preventDefault()
    fetchBrainFusion(symbol, userQuery)
  }

  if (!isOpen) return null

  const confluence = brainData?.confluence_score || 75
  const newsScore = brainData?.news_sentiment_score || 70
  const techScore = brainData?.technical_score || 75
  const verdict = brainData?.verdict || 'BULLISH'
  const isBull = verdict.includes('BULL')
  const isBear = verdict.includes('BEAR')

  const badgeColor = isBull ? '#10b981' : isBear ? '#ef4444' : '#f59e0b'
  const badgeBg = isBull ? 'rgba(16, 185, 129, 0.12)' : isBear ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)'

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
                  <span className="brain-title">KAPPA AI CONFLUENCE BRAIN</span>
                  <span className="brain-version-tag">NEWS + TECH ENGINE v3.4</span>
                </div>
                <p className="brain-subtitle">
                  Synchronizes breaking financial headlines with multi-timeframe quantitative momentum to eliminate false breakouts.
                </p>
              </div>
            </div>

            <button className="brain-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* Quick Switcher Bar */}
          <div className="brain-ticker-bar">
            <div className="quick-ticker-pills">
              <span className="quick-label">POPULAR:</span>
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
                placeholder="Enter Ticker (e.g. MSFT)..."
                value={customTicker}
                onChange={(e) => setCustomTicker(e.target.value)}
              />
              <button type="submit" className="ticker-submit-btn">
                Analyze
              </button>
            </form>
          </div>

          {/* User Query / Scenario Tester Input */}
          <form onSubmit={handleQuerySubmit} className="brain-query-bar">
            <Sparkles size={14} className="query-sparkle" />
            <input
              type="text"
              className="brain-query-input"
              placeholder={`Ask AI Brain about ${symbol}: e.g. "Will ${symbol} break resistance today on earnings news?"`}
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
            />
            <button type="submit" className="query-ask-btn" disabled={loading}>
              {loading ? <RefreshCw size={13} className="spin-icon" /> : <Zap size={13} />}
              <span>{loading ? 'Synthesizing...' : 'Ask Brain'}</span>
            </button>
          </form>

          {/* Main Body */}
          <div className="brain-modal-content">
            {loading && !brainData ? (
              <div className="brain-loading-state">
                <RefreshCw size={36} className="spin-icon text-cyan" />
                <h4>Synthesizing Live Financial Feeds & Indicators...</h4>
                <p>Ingesting fastest Yahoo/RSS news + Computing EMA 20/50, MACD Delta, and expected moves</p>
              </div>
            ) : error ? (
              <div className="brain-error-state">
                <AlertTriangle size={32} className="text-rose" />
                <h4>Dual-Engine Query Failed</h4>
                <p>{error}</p>
                <button className="retry-pill" onClick={() => fetchBrainFusion(symbol)}>
                  <RefreshCw size={13} /> Try Again
                </button>
              </div>
            ) : brainData ? (
              <>
                {/* 1. Confluence Accuracy Hero Banner */}
                <div className="brain-confluence-hero">
                  <div className="confluence-verdict-box" style={{ borderColor: badgeColor, background: badgeBg }}>
                    <div className="verdict-label-row">
                      <span className="verdict-sub">DUAL-ENGINE VERDICT</span>
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
                        <span className="score-title">Fused Confluence Accuracy</span>
                        <span className="score-desc">
                          {confluence >= 75
                            ? 'High statistical probability: News sentiment & technical moving averages strongly agree.'
                            : confluence >= 60
                            ? 'Moderate probability: Signal confirmed with minor divergence on momentum.'
                            : 'Caution: News sentiment and price structure are conflicting. Small size advised.'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dual Meters Split: News vs Tech */}
                  <div className="confluence-split-meters">
                    <div className="meter-card">
                      <div className="meter-head">
                        <span className="meter-name">
                          <Newspaper size={13} /> Fastest Breaking News
                        </span>
                        <span className="meter-weight">Weight: 48%</span>
                      </div>
                      <div className="meter-bar-track">
                        <div
                          className="meter-bar-fill news-fill"
                          style={{ width: `${Math.min(100, Math.max(10, newsScore))}%` }}
                        />
                      </div>
                      <div className="meter-footer">
                        <span>Sentiment: {brainData.news_summary?.sentiment_label || 'BULLISH'}</span>
                        <span className="meter-val">{newsScore}%</span>
                      </div>
                    </div>

                    <div className="meter-card">
                      <div className="meter-head">
                        <span className="meter-name">
                          <BarChart3 size={13} /> Quantitative Technicals
                        </span>
                        <span className="meter-weight">Weight: 52%</span>
                      </div>
                      <div className="meter-bar-track">
                        <div
                          className="meter-bar-fill tech-fill"
                          style={{ width: `${Math.min(100, Math.max(10, techScore))}%` }}
                        />
                      </div>
                      <div className="meter-footer">
                        <span>Trend: {brainData.technicals?.trend || 'STRONG_UPTREND'}</span>
                        <span className="meter-val">{techScore}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Dual Radar Columns: Fastest News Wire + Live Technical Indicators */}
                <div className="brain-dual-columns">
                  {/* Left Column: Fastest Breaking News Wire */}
                  <div className="brain-column-card">
                    <div className="column-card-header">
                      <div className="header-left">
                        <Newspaper size={15} className="col-icon" />
                        <span className="col-title">FASTEST BREAKING NEWS WIRE</span>
                      </div>
                      <span className="col-count-chip">
                        {brainData.news?.length || 0} ARTICLES INGESTED
                      </span>
                    </div>

                    <div className="news-stream-list">
                      {brainData.news && brainData.news.length > 0 ? (
                        brainData.news.map((item, idx) => {
                          const artSent = item.sentiment_score || 0
                          const isPos = artSent >= 0.1
                          const isNeg = artSent <= -0.1
                          const chipColor = isPos ? '#10b981' : isNeg ? '#ef4444' : '#64748b'
                          const chipBg = isPos ? 'rgba(16, 185, 129, 0.1)' : isNeg ? 'rgba(239, 68, 68, 0.1)' : 'rgba(100, 116, 139, 0.1)'

                          return (
                            <div key={idx} className="news-wire-item">
                              <div className="news-item-top">
                                <span className="news-provider-badge">{item.publisher || 'Wire Service'}</span>
                                <span
                                  className="news-sentiment-chip font-mono"
                                  style={{ color: chipColor, background: chipBg, borderColor: chipColor }}
                                >
                                  {isPos ? `+${artSent.toFixed(2)} BULLISH` : isNeg ? `${artSent.toFixed(2)} BEARISH` : '0.00 NEUTRAL'}
                                </span>
                              </div>
                              <a
                                href={item.link}
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
                          <span>No breaking news headlines detected in the last cycle.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Quantitative Technicals Radar */}
                  <div className="brain-column-card">
                    <div className="column-card-header">
                      <div className="header-left">
                        <BarChart3 size={15} className="col-icon" />
                        <span className="col-title">LIVE TECHNICAL STRUCTURE</span>
                      </div>
                      <span className="col-price-chip font-mono">
                        ${brainData.technicals?.current_price?.toFixed(2) || '0.00'}
                      </span>
                    </div>

                    <div className="tech-metrics-grid">
                      <div className="tech-metric-box">
                        <span className="t-label">20-Day EMA</span>
                        <span className="t-val font-mono">${brainData.technicals?.ema_20?.toFixed(2) || 'N/A'}</span>
                        <span className="t-sub">
                          {brainData.technicals?.current_price > brainData.technicals?.ema_20 ? 'Above (Bullish)' : 'Below (Bearish)'}
                        </span>
                      </div>

                      <div className="tech-metric-box">
                        <span className="t-label">50-Day EMA</span>
                        <span className="t-val font-mono">${brainData.technicals?.ema_50?.toFixed(2) || 'N/A'}</span>
                        <span className="t-sub">
                          {brainData.technicals?.ema_20 > brainData.technicals?.ema_50 ? 'Golden Alignment' : 'Death Cross Risk'}
                        </span>
                      </div>

                      <div className="tech-metric-box">
                        <span className="t-label">MACD Delta</span>
                        <span className={`t-val font-mono ${brainData.technicals?.macd_delta >= 0 ? 'text-emerald' : 'text-rose'}`}>
                          {brainData.technicals?.macd_delta >= 0 ? '+' : ''}{brainData.technicals?.macd_delta?.toFixed(2) || '0.00'}
                        </span>
                        <span className="t-sub">
                          {brainData.technicals?.macd_delta >= 0 ? 'Bullish Acceleration' : 'Bearish Momentum'}
                        </span>
                      </div>

                      <div className="tech-metric-box">
                        <span className="t-label">RSI (14-Day)</span>
                        <span className="t-val font-mono">{brainData.technicals?.rsi_14?.toFixed(1) || '50.0'}</span>
                        <span className="t-sub">
                          {brainData.technicals?.rsi_14 > 70 ? 'Overbought' : brainData.technicals?.rsi_14 < 30 ? 'Oversold' : 'Balanced Momentum'}
                        </span>
                      </div>

                      <div className="tech-metric-box">
                        <span className="t-label">Volume Surge</span>
                        <span className="t-val font-mono">{brainData.technicals?.volume_multiplier?.toFixed(2)}x</span>
                        <span className="t-sub">Relative to 20-day avg</span>
                      </div>

                      <div className="tech-metric-box">
                        <span className="t-label">1-Day Expected Move</span>
                        <span className="t-val font-mono text-cyan">±{brainData.technicals?.one_day_expected_move || '1.8%'}</span>
                        <span className="t-sub">Derived from historical Vol</span>
                      </div>
                    </div>

                    {/* Pivot Levels Row */}
                    <div className="pivots-row">
                      <div className="pivot-item">
                        <span className="p-tag">SUPPORT S1</span>
                        <span className="p-num font-mono">${brainData.technicals?.pivot_support?.toFixed(2)}</span>
                      </div>
                      <div className="pivot-item highlight">
                        <span className="p-tag">CURRENT SPOT</span>
                        <span className="p-num font-mono">${brainData.technicals?.current_price?.toFixed(2)}</span>
                      </div>
                      <div className="pivot-item">
                        <span className="p-tag">RESISTANCE R1</span>
                        <span className="p-num font-mono">${brainData.technicals?.pivot_resistance?.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. AI Confluence Synthesis & Actionable Trade Plan */}
                <div className="brain-synthesis-card">
                  <div className="synthesis-header">
                    <Sparkles size={16} className="text-amber" />
                    <span className="synthesis-title">INSTITUTIONAL AI SYNTHESIS & EXECUTION ROADMAP</span>
                  </div>
                  <p className="synthesis-body">{brainData.ai_synthesis}</p>

                  {/* Trade Setup Matrix */}
                  {brainData.trade_setup && (
                    <div className="trade-setup-grid">
                      <div className="setup-box">
                        <span className="s-label">STRATEGY</span>
                        <span className="s-val text-cyan">{brainData.trade_setup.strategy}</span>
                      </div>
                      <div className="setup-box">
                        <span className="s-label">ENTRY ZONE</span>
                        <span className="s-val font-mono">{brainData.trade_setup.entry_zone}</span>
                      </div>
                      <div className="setup-box">
                        <span className="s-label">TARGET 1 (1-DAY)</span>
                        <span className="s-val font-mono text-emerald">{brainData.trade_setup.take_profit_target_1}</span>
                      </div>
                      <div className="setup-box">
                        <span className="s-label">TARGET 2 (RUNNER)</span>
                        <span className="s-val font-mono text-emerald">{brainData.trade_setup.take_profit_target_2}</span>
                      </div>
                      <div className="setup-box">
                        <span className="s-label">INVALIDATION STOP</span>
                        <span className="s-val font-mono text-rose">{brainData.trade_setup.stop_loss}</span>
                      </div>
                      <div className="setup-box">
                        <span className="s-label">RISK/REWARD</span>
                        <span className="s-val font-mono">{brainData.trade_setup.risk_reward_ratio}</span>
                      </div>
                    </div>
                  )}

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
                      <span>Execute in Paper Trading Desk</span>
                    </button>

                    <button
                      className="action-btn chart-btn font-mono"
                      onClick={() => {
                        onClose?.()
                        onOpenFullChart?.({ symbol, current_price: brainData.technicals?.current_price })
                      }}
                    >
                      <BarChart3 size={14} />
                      <span>Open Interactive Chart</span>
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
