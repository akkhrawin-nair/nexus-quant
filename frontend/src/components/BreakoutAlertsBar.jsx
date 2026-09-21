import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  TrendingUp,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Maximize2,
  ChevronRight,
  Volume2,
  VolumeX,
  Target,
  Sliders,
  Sparkles,
  ChevronDown,
  Briefcase
} from 'lucide-react'
import { scanRealTimeBreakouts } from '../utils/breakoutAlertUtils'

/**
 * Plays a subtle high-tech synthesizer notification sound using Web Audio API
 */
function playAlertChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12) // A5

    gain.gain.setValueAtTime(0.06, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch (e) {
    // AudioContext blocked or unsupported
  }
}

export default function BreakoutAlertsBar({
  signals = [],
  candleMap = {},
  onOpenFullChart,
  onOpenPaperTrade
}) {
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [isMuted, setIsMuted] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const previousAlertCountRef = useRef(0)

  // Run Real-Time Breakout Scanner across all active assets
  const alerts = useMemo(() => {
    return scanRealTimeBreakouts(signals, candleMap)
  }, [signals, candleMap])

  // Trigger optional audio chime when new critical breakouts are discovered
  useEffect(() => {
    if (!isMuted && alerts.length > previousAlertCountRef.current && previousAlertCountRef.current > 0) {
      playAlertChime()
    }
    previousAlertCountRef.current = alerts.length
  }, [alerts.length, isMuted])

  // Filter alerts by category
  const filteredAlerts = useMemo(() => {
    if (activeFilter === 'ALL') return alerts
    if (activeFilter === 'WHALE') return alerts.filter(a => a.type === 'WHALE' || a.isWhale)
    if (activeFilter === 'BREAKOUT') return alerts.filter(a => a.type === 'BREAKOUT')
    if (activeFilter === 'BOUNCE') return alerts.filter(a => a.type === 'BOUNCE')
    if (activeFilter === 'MOMENTUM') return alerts.filter(a => a.type === 'MOMENTUM')
    return alerts
  }, [alerts, activeFilter])

  const whaleCount = alerts.filter(a => a.type === 'WHALE' || a.isWhale).length
  const breakoutCount = alerts.filter(a => a.type === 'BREAKOUT').length
  const bounceCount = alerts.filter(a => a.type === 'BOUNCE').length
  const momentumCount = alerts.filter(a => a.type === 'MOMENTUM').length

  if (alerts.length === 0) return null

  return (
    <div className="breakout-alerts-wrapper font-mono">
      {/* Top Banner Control Header */}
      <div className="breakout-alerts-header">
        <div className="alerts-beacon-group">
          <span className="live-pulse-dot" />
          <span className="alerts-title">REAL-TIME BREAKOUT & PRE-NEWS WHALE RADAR</span>
          <span className="alerts-total-count font-mono">{alerts.length} ACTIVE SIGNALS</span>
        </div>

        {/* Filter Pills */}
        <div className="alerts-filter-group">
          <button
            className={`alert-filter-pill ${activeFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveFilter('ALL')}
          >
            All ({alerts.length})
          </button>
          {whaleCount > 0 && (
            <button
              className={`alert-filter-pill whale ${activeFilter === 'WHALE' ? 'active' : ''}`}
              onClick={() => setActiveFilter('WHALE')}
            >
              🐋 Whale Radar ({whaleCount})
            </button>
          )}
          <button
            className={`alert-filter-pill breakout ${activeFilter === 'BREAKOUT' ? 'active' : ''}`}
            onClick={() => setActiveFilter('BREAKOUT')}
          >
            🚨 Breakouts ({breakoutCount})
          </button>
          <button
            className={`alert-filter-pill bounce ${activeFilter === 'BOUNCE' ? 'active' : ''}`}
            onClick={() => setActiveFilter('BOUNCE')}
          >
            🛡️ Support Bounces ({bounceCount})
          </button>
          <button
            className={`alert-filter-pill momentum ${activeFilter === 'MOMENTUM' ? 'active' : ''}`}
            onClick={() => setActiveFilter('MOMENTUM')}
          >
            ⚡ Golden Cross ({momentumCount})
          </button>
        </div>

        {/* Right Tools: Audio Mute & Collapse */}
        <div className="alerts-tools-group">
          <button
            className={`alert-tool-btn ${!isMuted ? 'active-audio' : ''}`}
            onClick={() => setIsMuted(prev => !prev)}
            title={isMuted ? 'Unmute Breakout Audio Chime' : 'Mute Breakout Audio Chime'}
          >
            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          <button
            className="alert-tool-btn"
            onClick={() => setIsCollapsed(prev => !prev)}
            title={isCollapsed ? 'Expand Alerts Bar' : 'Collapse Alerts Bar'}
          >
            <ChevronDown size={13} className={`collapse-icon ${isCollapsed ? 'collapsed' : ''}`} />
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Real-Time Alert Cards */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            className="breakout-cards-scroll"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {filteredAlerts.map(alert => {
              const isPositive = alert.changePct >= 0
              const badgeClass = alert.isWhale || alert.type === 'WHALE'
                ? 'badge-whale'
                : alert.type === 'BREAKOUT'
                  ? 'badge-breakout'
                  : alert.type === 'BOUNCE'
                    ? 'badge-bounce'
                    : 'badge-momentum'

              return (
                <div key={alert.id} className={`breakout-alert-card ${badgeClass}`}>
                  {/* Card Top Row */}
                  <div className="card-header-row">
                    <div className="ticker-badge-stack">
                      <span className="alert-ticker">{alert.symbol}</span>
                      <span className="alert-asset-type">{alert.asset_type}</span>
                    </div>

                    <span className={`alert-urgency-badge ${badgeClass}`}>
                      {alert.badge}
                    </span>
                  </div>

                  {/* Price & Change Row */}
                  <div className="card-price-row">
                    <span className="alert-current-price font-mono">
                      ${alert.price.toFixed(2)}
                    </span>
                    <span className={`alert-change-badge ${isPositive ? 'bullish' : 'bearish'} font-mono`}>
                      {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                      {isPositive ? '+' : ''}{alert.changePct.toFixed(2)}%
                    </span>
                  </div>

                  {/* Pre-News Whale Flow Footprint Ribbon */}
                  {alert.isWhale && (
                    <div className="alert-whale-flow-ribbon font-mono">
                      <span>🐋 PRE-NEWS FOOTPRINT</span>
                      <span className="vol-mult">+{alert.volumeMultiplier}x VOL · ${alert.estFlowMillions}M FLOW</span>
                    </div>
                  )}

                  {/* Level Context Note */}
                  <p className="alert-desc">{alert.description}</p>

                  {/* Risk-to-Reward Execution Preview */}
                  <div className="alert-rr-strip font-mono">
                    <div className="rr-cell">
                      <span className="rr-lbl">R:R RATIO</span>
                      <span className="rr-val highlight">1 : {alert.rrRatio}</span>
                    </div>
                    <div className="rr-cell">
                      <span className="rr-lbl">TARGET</span>
                      <span className="rr-val target font-mono">${alert.targetPrice.toFixed(2)}</span>
                    </div>
                    <div className="rr-cell">
                      <span className="rr-lbl">STOP</span>
                      <span className="rr-val stop font-mono">${alert.stopLossPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Action Buttons: 1-Click Chart & 1-Click Paper Trade */}
                  <div className="alert-actions-row">
                    <button
                      className="alert-act-btn chart"
                      onClick={() => onOpenFullChart?.(alert.asset)}
                      title="Open interactive auto-technical chart"
                    >
                      <Maximize2 size={11} />
                      <span>Chart</span>
                    </button>

                    <button
                      className="alert-act-btn trade"
                      onClick={() => onOpenPaperTrade?.(alert.asset)}
                      title="1-Click Track in Live Desk"
                    >
                      <Zap size={11} />
                      <span>Track</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
