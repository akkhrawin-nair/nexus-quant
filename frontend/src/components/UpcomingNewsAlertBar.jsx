import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flame,
  X,
  Volume2,
  VolumeX,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react'

// Curated high-impact upcoming news catalysts & macro events
export const UPCOMING_NEWS_ALERTS = [
  {
    id: 'news-eose-1',
    symbol: 'EOSE',
    title: 'EOSE // DOE Clean Energy Loan & Multi-Gigawatt Utility Battery Order Milestone Approaching',
    summary: 'Department of Energy clean energy financing confirmation and utility-scale zinc-hybrid storage expansion ramp.',
    timeframe: 'Today • 2:30 PM EST',
    countdown: 'In 45m',
    impact: 'HIGH IMPACT',
    impactLevel: 'high', // 'high' | 'extreme' | 'moderate'
    sentiment: 'BULLISH',
    source: 'Reuters Clean Energy',
    actionTicker: 'EOSE'
  },
  {
    id: 'news-fed-2',
    symbol: 'QQQ / SPY',
    title: 'MACRO // Federal Reserve FOMC Policy Decision & Powell Press Conference Live Today',
    summary: 'Interest rate trajectory guidance and balance sheet runoff cadence. Expect rapid volatility spikes across tech equities and bonds.',
    timeframe: 'Today • 2:00 PM EST',
    countdown: 'In 1h 15m',
    impact: 'EXTREME IMPACT',
    impactLevel: 'extreme',
    sentiment: 'VOLATILE',
    source: 'Federal Reserve / Bloomberg',
    actionTicker: 'QQQ'
  },
  {
    id: 'news-pce-3',
    symbol: 'ALL MARKETS',
    title: 'INFLATION // US Core PCE Price Index Monthly Release Tomorrow Morning',
    summary: 'The Fed’s primary inflation benchmark. Forecasts consensus expects +0.2% MoM. Critical driver for year-end rate cut probabilities.',
    timeframe: 'Tomorrow • 8:30 AM EST',
    countdown: 'Tomorrow',
    impact: 'HIGH IMPACT',
    impactLevel: 'high',
    sentiment: 'NEUTRAL',
    source: 'Bureau of Economic Analysis',
    actionTicker: 'SPY'
  },
  {
    id: 'news-nvda-4',
    symbol: 'NVDA / TSM',
    title: 'TECH // Hyperscaler AI Infrastructure Spending & Blackwell Cluster Deployments Update',
    summary: 'Cloud hyperscalers release updated capex guidance, affirming sustained multi-billion accelerator demand.',
    timeframe: 'This Week',
    countdown: 'In 2 Days',
    impact: 'HIGH IMPACT',
    impactLevel: 'high',
    sentiment: 'BULLISH',
    source: 'Wall Street Journal Tech',
    actionTicker: 'NVDA'
  }
]

export default function UpcomingNewsAlertBar({
  onOpenNewsModal,
  onSelectTicker,
  customAlerts = null
}) {
  const alerts = customAlerts && customAlerts.length > 0 ? customAlerts : UPCOMING_NEWS_ALERTS
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isAutoPlay, setIsAutoPlay] = useState(true)

  // Cycle through alerts automatically every 8 seconds if not paused
  useEffect(() => {
    if (!isAutoPlay || isDismissed || isCollapsed || alerts.length <= 1) return

    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % alerts.length)
    }, 8000)

    return () => clearInterval(timer)
  }, [isAutoPlay, isDismissed, isCollapsed, alerts.length])

  if (isDismissed) {
    return (
      <div className="upcoming-news-bar-reopen-wrap">
        <button
          className="upcoming-news-reopen-btn font-mono"
          onClick={() => setIsDismissed(false)}
          title="Restore Upcoming News Catalyst Alert Banner"
        >
          <Bell size={11} className="bell-shake-anim" />
          <span>UPCOMING NEWS ALERTS ({alerts.length})</span>
        </button>
      </div>
    )
  }

  const current = alerts[currentIndex] || alerts[0]

  const handlePrev = (e) => {
    e.stopPropagation()
    setIsAutoPlay(false)
    setCurrentIndex(prev => (prev - 1 + alerts.length) % alerts.length)
  }

  const handleNext = (e) => {
    e.stopPropagation()
    setIsAutoPlay(false)
    setCurrentIndex(prev => (prev + 1) % alerts.length)
  }

  const handleInspect = (e) => {
    e.stopPropagation()
    if (onOpenNewsModal) {
      onOpenNewsModal(current.actionTicker || 'ALL')
    }
  }

  return (
    <div
      className={`upcoming-news-alert-bar ${isCollapsed ? 'collapsed' : ''} impact-${current.impactLevel}`}
      onMouseEnter={() => setIsAutoPlay(false)}
      onMouseLeave={() => setIsAutoPlay(true)}
    >
      <div className="upcoming-news-bar-inner">
        {/* Left: Pulsing Alert Badge */}
        <div className="alert-badge-group">
          <div className="alert-live-pulse-dot" />
          <div className="alert-header-badge font-mono">
            <Bell size={12} className="alert-bell-icon" />
            <span className="badge-text">UPCOMING CATALYST</span>
          </div>
          <span className={`impact-pill font-mono ${current.impactLevel}`}>
            {current.impact}
          </span>
        </div>

        {/* Center: Headline & Summary with Slide Transition */}
        <div className="alert-headline-viewport" onClick={handleInspect}>
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              className="alert-headline-content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <span className="alert-ticker-capsule font-mono">{current.symbol}</span>
              <span className="alert-title-text">{current.title}</span>
              <span className="alert-countdown-tag font-mono">
                <Clock size={11} /> {current.countdown}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right: Controls & Actions */}
        <div className="alert-actions-group">
          <button
            className="alert-inspect-btn font-mono"
            onClick={handleInspect}
            title="Inspect detailed catalyst breakdown & sentiment"
          >
            <span>Inspect</span>
            <ExternalLink size={11} />
          </button>

          {/* Carousel Navigator */}
          <div className="alert-nav-arrows font-mono">
            <button
              className="alert-nav-arrow"
              onClick={handlePrev}
              title="Previous Alert"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="alert-counter-text">
              {currentIndex + 1}/{alerts.length}
            </span>
            <button
              className="alert-nav-arrow"
              onClick={handleNext}
              title="Next Alert"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Dismiss Button */}
          <button
            className="alert-close-btn"
            onClick={() => setIsDismissed(true)}
            title="Dismiss Alert Bar"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
