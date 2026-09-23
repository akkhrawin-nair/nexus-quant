import React, { memo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Star,
  GraduationCap,
  ArrowUpRight,
  ArrowDownRight,
  Maximize2,
  ChevronDown,
  Loader2,
  Zap,
  Cpu,
  Check,
  Copy,
  AlertCircle
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  YAxis,
  Tooltip,
  AreaChart,
  Area
} from 'recharts'
import TradingChart from './TradingChart'
import { getRiskRatingMeta, calculateDynamicTradePlan } from '../utils/riskUtils'

const formatCurrency = (val) => {
  const num = parseFloat(val)
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num)
}

const getAssetCapsuleMeta = (type = '') => {
  const lower = type.toLowerCase()
  if (lower.includes('crypto')) return { label: 'Crypto', styleClass: 'crypto' }
  if (lower.includes('stock') || lower.includes('equity')) return { label: 'US Equity', styleClass: 'equity' }
  if (lower.includes('commodity') || lower.includes('gold')) return { label: 'Commodity', styleClass: 'commodity' }
  return { label: type || 'Index', styleClass: 'index' }
}

const get24hChangeBadge = (signal) => {
  const rawPct = signal?.daily_change_pct !== undefined ? signal.daily_change_pct : signal?.percent_change
  const pct = parseFloat(rawPct) || 0
  const isPos = pct >= 0
  return {
    percent: `${isPos ? '+' : ''}${pct.toFixed(2)}%`,
    positive: isPos,
    val: pct
  }
}

const ScrubberTooltip = ({ active, payload, glowColor }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="scrubber-tooltip-box">
        <span className="tooltip-price">${data.price ? data.price.toFixed(2) : ''}</span>
        <span className="tooltip-date">{data.date}</span>
      </div>
    )
  }
  return null
}

const SignalCard = memo(({
  signal,
  signalType,
  lang,
  t,
  isFavorite,
  toggleFavorite,
  setSelectedTicker,
  setAcademySignal,
  setIsAcademyOpen,
  setFullChartAsset,
  currentTab,
  handleCardTabChange,
  isExpanded,
  toggleDrawer,
  hoveredPoint,
  handleChartMouseMove,
  handleChartMouseLeave,
  volatilityData,
  isVolLoading,
  candleSeries,
  trendData,
  priceFlash,
  onOpenBrain
}) => {
  const macdVal = parseFloat(signal.macd) || 0
  const macdSigVal = parseFloat(signal.macd_signal) || 0
  const diff = macdVal - macdSigVal
  const isBuy = signalType === 'buy'
  const capsuleMeta = getAssetCapsuleMeta(signal.asset_type)
  const changeBadge = get24hChangeBadge(signal)

  const isPositiveTrend = changeBadge.positive
  const glowColor = isPositiveTrend ? '#10B981' : '#EF4444'
  const gradientId = `gradient-${signal.symbol.replace(/[^a-zA-Z0-9]/g, '')}`

  const livePriceVal = signal.current_price !== undefined ? parseFloat(signal.current_price) : parseFloat(signal.close_price)
  const displayedPrice = hoveredPoint ? hoveredPoint.price : livePriceVal
  const displayedDate = hoveredPoint
    ? hoveredPoint.date
    : (signal.last_updated ? `Live ${signal.last_updated}` : `Signal: ${signal.signal_trigger_date || signal.signal_date}`)

  const vol = volatilityData ? volatilityData[signal.symbol] : null
  const ivRankVal = vol ? vol.iv_rank : (signal.symbol === 'QQQ' || signal.symbol === 'TSLA' || signal.symbol === 'NVDA' ? 88 : 34)
  const pcRatio = vol ? vol.pc_ratio : (signal.symbol === 'QQQ' ? '1.15' : '0.92')
  const impliedMove = vol ? vol.implied_move : (signal.symbol === 'QQQ' ? '±$4.50' : '±$12.30')
  const gammaVal = vol ? vol.gamma_exposure : (signal.symbol === 'QQQ' || signal.symbol === 'TSLA' || !isBuy ? 'Negative' : 'Positive')

  const isHighIv = vol ? vol.is_high_iv : ivRankVal >= 80
  const isLowIv = vol ? vol.is_low_iv : ivRankVal <= 20
  const isNegGamma = vol ? vol.is_neg_gamma : gammaVal === 'Negative'

  const riskMeta = getRiskRatingMeta(signal.symbol, signal.asset_type, lang)
  const [copied, setCopied] = useState(false)
  const entryPrice = livePriceVal || 100
  const tradePlan = calculateDynamicTradePlan(signal, entryPrice)
  const tp1Str = formatCurrency(tradePlan.tp1Val)
  const tp2Str = formatCurrency(tradePlan.tp2Val)
  const slStr = formatCurrency(tradePlan.slVal)

  const handleCopySetup = (e) => {
    e.stopPropagation()
    const text = `${signal.symbol} | Entry: ${formatCurrency(entryPrice)} | TP1 (+${tradePlan.tp1Pct}%): ${tp1Str} (Lock 50% & Stop to Breakeven) | TP2 (+${tradePlan.tp2Pct}%): ${tp2Str} | Stop (-${tradePlan.slPct}%): ${slStr} | Horizon: ${tradePlan.duration}`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={`minimal-card ${priceFlash || ''}`}
      onClick={() => setSelectedTicker(signal.symbol)}
      style={{ cursor: 'pointer', willChange: 'transform, opacity' }}
    >
      {/* Card Header */}
      <div className="card-top-row">
        <div className="ticker-info" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`star-fav-btn ${isFavorite ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              toggleFavorite(signal.symbol)
            }}
            title={isFavorite ? "Remove from Favorites" : "Pin to Favorites (Top of Screen)"}
          >
            <Star
              size={14}
              fill={isFavorite ? "#f59e0b" : "none"}
              stroke={isFavorite ? "#f59e0b" : "#94a3b8"}
            />
          </button>
          <span className="ticker-symbol">{signal.symbol}</span>
          <span className="ticker-type">{capsuleMeta.label}</span>

          {/* Sector Diversity Pill */}
          {signal.sector && (
            <span className="ticker-sector-pill font-mono" title={`Sector: ${signal.sector}`}>
              {signal.sector}
            </span>
          )}

          {/* Earnings Timeline & Blackout Badge */}
          {signal.earnings_blackout ? (
            <span className="earnings-pill blackout font-mono" title={`Earnings in ${signal.earnings_info?.days_to_earnings} days on ${signal.earnings_info?.earnings_date}. High binary gap risk.`}>
              ⛔ ER {signal.earnings_info?.days_to_earnings}d
            </span>
          ) : signal.earnings_info?.has_earnings ? (
            <span className="earnings-pill safe font-mono" title={`Next earnings: ${signal.earnings_info?.earnings_date} (${signal.earnings_info?.days_to_earnings} days away). Safe trading window.`}>
              📅 ER {signal.earnings_info?.days_to_earnings}d
            </span>
          ) : null}

          {/* Risk Rating Badge */}
          <span
            className={`risk-badge-pill ${riskMeta.badgeClass}`}
            title={`${riskMeta.label}: ${riskMeta.description}`}
          >
            <span className="risk-icon">{riskMeta.icon}</span>
            <span className="risk-text">{riskMeta.shortLabel}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            type="button"
            className="why-signal-btn font-mono"
            onClick={(e) => {
              e.stopPropagation()
              setAcademySignal(signal)
              setIsAcademyOpen(true)
            }}
            title="Click to view plain-English signal breakdown & risk rules"
          >
            <GraduationCap size={11} />
            <span>{t.whySignal}</span>
          </button>

          <div className={`ticker-change-badge ${changeBadge.positive ? 'positive' : 'negative'}`}>
            {changeBadge.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            <span>{changeBadge.percent}</span>
          </div>
        </div>
      </div>

      {/* Dynamic Price & Date Scrubber Header */}
      <div className={`card-price-row ${hoveredPoint ? 'scrubbing' : ''}`}>
        <span className={`card-price tabular-nums ${priceFlash || ''}`}>{formatCurrency(displayedPrice)}</span>
        <div className="price-meta-stack" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
          <span className="card-date tabular-nums">{displayedDate}</span>
          {!hoveredPoint && (signal.signal_trigger_date || signal.signal_date) && (
            <span className="card-trigger-sub" style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
              Triggered: {signal.signal_trigger_date || signal.signal_date}
            </span>
          )}
        </div>
      </div>

      {/* Dynamic Multi-Tier Technical Game Plan */}
      <div className="wealth-plan-box font-mono" onClick={(e) => e.stopPropagation()}>
        <div className="wealth-plan-row four-col">
          <div className="plan-item tp1" title="Target 1: Sell 50% shares and move Stop-Loss to Breakeven ($0 risk)">
            <span className="plan-lbl">🎯 TP1 (+{tradePlan.tp1Pct}%)</span>
            <span className="plan-val">{tp1Str}</span>
            <span className="plan-sub-tip">De-Risk 50%</span>
          </div>
          <div className="plan-item tp2" title="Target 2: Full swing expansion target for remaining 50% runner">
            <span className="plan-lbl">🚀 TP2 (+{tradePlan.tp2Pct}%)</span>
            <span className="plan-val">{tp2Str}</span>
            <span className="plan-sub-tip">Full Runner</span>
          </div>
          <div className="plan-item loss" title="Strict technical invalidation level">
            <span className="plan-lbl">🛡️ STOP (-{tradePlan.slPct}%)</span>
            <span className="plan-val">{slStr}</span>
            <span className="plan-sub-tip">Max Invalidation</span>
          </div>
          <div className="plan-item shield" title="Holding window & Earnings safety check">
            <span className="plan-lbl">⏱️ {tradePlan.duration}</span>
            <span className={`plan-val ${signal.earnings_blackout ? 'blackout' : 'safe'}`}>
              {signal.earnings_blackout ? '⛔ Risk' : '✓ Safe ER'}
            </span>
            <span className="plan-sub-tip">{tradePlan.riskRewardRatio}:1 R/R</span>
          </div>
        </div>
        <button
          type="button"
          className={`copy-order-btn ${copied ? 'copied' : ''}`}
          onClick={handleCopySetup}
          title="Click to copy exact Entry, TP1, TP2, and Stop-Loss to paste into your broker"
        >
          {copied ? (
            <>
              <Check size={12} />
              <span>COPIED BRACKET PLAN!</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>COPY BRACKET PLAN (TP1 + TP2 + STOP)</span>
            </>
          )}
        </button>
      </div>

      {/* Signal Insight Pill */}
      <div className="signal-insight-wrapper">
        <div className={`insight-pill ${isBuy ? 'bullish' : 'bearish'}`}>
          <span className="insight-icon">{isBuy ? '⚡' : '⚠️'}</span>
          <span className="insight-text">
            {isBuy ? 'Bullish EMA (20/50) Golden Cross' : 'MACD Momentum Bearish Divergence'}
          </span>
        </div>
        <div className="insight-tooltip">
          {isBuy
            ? `20-day EMA crossed above 50-day EMA for ${signal.symbol} with expanding positive MACD delta (+${diff.toFixed(2)}), signaling strong upside momentum.`
            : `MACD line broke below signal line for ${signal.symbol} with negative momentum divergence (${diff.toFixed(2)}), indicating increased downside risk.`}
        </div>
      </div>

      {/* Earnings Blackout Alert Banner */}
      {signal.earnings_blackout && (
        <div className="earnings-blackout-card-alert font-mono" onClick={(e) => e.stopPropagation()}>
          <AlertCircle size={12} />
          <span>⛔ EARNINGS BLACKOUT ({signal.earnings_info?.days_to_earnings}d to ER) — Swing Entry Locked</span>
        </div>
      )}

      {/* Institutional 5-Layer Confluence Checklist Bar */}
      {signal.golden_opportunity?.layers && signal.golden_opportunity.layers.length > 0 && (
        <div className="confluence-layers-bar font-mono" onClick={(e) => e.stopPropagation()}>
          <div className="confluence-layers-header">
            <span className="confluence-layers-title">
              {signal.golden_opportunity.is_70_plus_edge ? '🎯 70%+ STATISTICAL EDGE' : '⚡ 5-LAYER CONFLUENCE'}
            </span>
            <span className={`confluence-score-pill ${signal.golden_opportunity.is_70_plus_edge ? 'edge-70' : 'edge-sub'}`}>
              {signal.golden_opportunity.confluence_score || signal.golden_opportunity.conviction_score}%
            </span>
          </div>
          <div className="confluence-chips-grid">
            {signal.golden_opportunity.layers.map((layer) => (
              <span
                key={layer.id}
                className={`layer-chip ${layer.passed ? 'passed' : 'failed'}`}
                title={`${layer.name}: ${layer.detail}`}
              >
                {layer.passed ? '✓' : '✕'} {layer.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Chart Container */}
      <div className="card-chart-block" style={{ position: 'relative' }}>
        <button
          type="button"
          className="chart-expand-btn"
          onClick={(e) => {
            e.stopPropagation()
            setFullChartAsset(signal)
          }}
          title="Expand Full-Screen Chart Modal"
        >
          <Maximize2 size={12} />
        </button>

        <div className="chart-micro-header">
          <span className="chart-label">PRICE ACTION</span>
          <div className="chart-tabs">
            {['CANDLE', 'EMA', 'MACD'].map((tab) => {
              const isActive = currentTab === tab
              return (
                <button
                  key={tab}
                  className={`micro-tab-btn ${isActive ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCardTabChange(signal.symbol, tab)
                  }}
                >
                  <span>{tab}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="chart-canvas-area">
          {currentTab === 'CANDLE' && (
            <TradingChart
              data={candleSeries}
              isBuy={isPositiveTrend}
              height={100}
              showAutoLevels={true}
              asset={signal}
            />
          )}

          {currentTab === 'EMA' && (
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart
                data={trendData}
                margin={{ top: 6, right: 0, left: 0, bottom: 6 }}
                onMouseMove={(state) => handleChartMouseMove && handleChartMouseMove(signal.symbol, state)}
                onMouseLeave={() => handleChartMouseLeave && handleChartMouseLeave(signal.symbol)}
              >
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip
                  content={<ScrubberTooltip glowColor={glowColor} />}
                  cursor={{ stroke: '#94A3B8', strokeDasharray: '2 2', strokeWidth: 1 }}
                />
                <Line type="monotone" dataKey="macd" stroke={glowColor} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: glowColor, stroke: '#ffffff', strokeWidth: 2 }} />
                <Line type="monotone" dataKey="signal" stroke="#0284c7" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
              </RechartsLineChart>
            </ResponsiveContainer>
          )}

          {currentTab === 'MACD' && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trendData}
                margin={{ top: 6, right: 0, left: 0, bottom: 6 }}
                onMouseMove={(state) => handleChartMouseMove && handleChartMouseMove(signal.symbol, state)}
                onMouseLeave={() => handleChartMouseLeave && handleChartMouseLeave(signal.symbol)}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={glowColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={glowColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip
                  content={<ScrubberTooltip glowColor={glowColor} />}
                  cursor={{ stroke: '#94A3B8', strokeDasharray: '2 2', strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="macd"
                  stroke={glowColor}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={`url(#${gradientId})`}
                  activeDot={{ r: 5, fill: glowColor, stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Technical Readout Footer: OHLC in CANDLE mode */}
        <div className="chart-footer-metrics">
          {currentTab === 'CANDLE' ? (() => {
            const parseVal = (val, fb) => {
              const n = typeof val === 'number' ? val : parseFloat(val)
              return isNaN(n) ? fb : n
            }
            const latestCandle = (candleSeries && candleSeries.length > 0)
              ? candleSeries[candleSeries.length - 1]
              : {}
            const oVal = parseVal(latestCandle.open ?? latestCandle.OpenPrice, displayedPrice * 0.995)
            const hVal = parseVal(latestCandle.high ?? latestCandle.HighPrice, displayedPrice * 1.008)
            const lVal = parseVal(latestCandle.low ?? latestCandle.LowPrice, displayedPrice * 0.992)
            const cVal = parseVal(latestCandle.close ?? latestCandle.ClosePrice, displayedPrice)

            return (
              <>
                <span>O: ${oVal.toFixed(2)}</span>
                <span>H: ${hVal.toFixed(2)}</span>
                <span>L: ${lVal.toFixed(2)}</span>
                <span>C: ${cVal.toFixed(2)}</span>
              </>
            )
          })() : (
            <>
              <span>MACD {macdVal > 0 ? `+${macdVal.toFixed(2)}` : macdVal.toFixed(2)}</span>
              <span>SIG {macdSigVal > 0 ? `+${macdSigVal.toFixed(2)}` : macdSigVal.toFixed(2)}</span>
              <span>DELTA {diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}</span>
            </>
          )}
        </div>
      </div>

      {/* Quant Volatility & AI Radar Drawer Toggle */}
      <div className="drawer-btn-wrapper">
        <button
          className="minimal-drawer-btn"
          onClick={(e) => {
            e.stopPropagation()
            toggleDrawer(signal.symbol)
          }}
        >
          <span>QUANT & VOLATILITY RADAR</span>
          <span style={{ display: 'inline-flex', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
            <ChevronDown size={13} />
          </span>
        </button>
      </div>

      {/* Quant Volatility & AI Radar Drawer Content */}
      {isExpanded && (
        <div className="minimal-drawer-panel" style={{ marginTop: '0.5rem' }}>
          {isVolLoading ? (
            <div className="drawer-loading-row">
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Loading metrics...</span>
            </div>
          ) : (
            <>
              <div className="minimal-options-grid">
                <div className="opt-cell">
                  <span className="opt-label">IV RANK</span>
                  <span className={`opt-value ${isHighIv ? 'high-iv' : isLowIv ? 'low-iv' : ''}`}>
                    {ivRankVal}%
                  </span>
                </div>

                <div className="opt-cell">
                  <span className="opt-label">HIST VOL</span>
                  <span className="opt-value">{vol ? vol.historical_volatility : '18.5%'}</span>
                </div>

                <div className="opt-cell">
                  <span className="opt-label">IMPLIED VOL</span>
                  <span className="opt-value">{vol ? vol.implied_volatility : '22.4%'}</span>
                </div>

                <div className="opt-cell">
                  <span className="opt-label">GEX</span>
                  <span className={`opt-value ${isNegGamma ? 'neg-gamma' : 'pos-gamma'}`}>
                    {gammaVal}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="open-brain-modal-btn font-mono"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenBrain?.(signal.symbol)
                }}
                style={{
                  width: '100%',
                  marginTop: '0.65rem',
                  padding: '0.45rem 0.75rem',
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 2px 6px rgba(14, 165, 233, 0.3)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Cpu size={13} />
                <span>AI Brain Confluence: Fastest News + Tech Radar ({signal.symbol})</span>
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  )
})

SignalCard.displayName = 'SignalCard'

export default SignalCard
