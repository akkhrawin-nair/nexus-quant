import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap,
  X,
  BookOpen,
  ShieldCheck,
  Zap,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  HelpCircle,
  Award,
  ArrowRight,
  Target,
  ShieldAlert,
  Sparkles,
  Lightbulb
} from 'lucide-react'

import { translations } from '../i18n/translations'

export default function TradingAcademyModal({
  isOpen = false,
  onClose,
  signal = null,
  lang = 'en'
}) {
  const t = translations[lang] || translations.en

  const [activeTab, setActiveTab] = useState('explainer') // 'explainer' | 'rules' | 'course'
  const [currentCourseStep, setCurrentCourseStep] = useState(0)

  // ESC Key Listener
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const activeSymbol = signal?.symbol || 'NVDA'
  const activePrice = parseFloat(signal?.current_price || signal?.close_price || 150)
  const isBuySignal = (signal?.macd || 0) >= (signal?.macd_signal || 0)

  // Safe Trading Targets Calculation
  const suggestedStopLoss = (activePrice * 0.96).toFixed(2) // 4% Risk Stop Loss
  const suggestedTakeProfit = (activePrice * 1.08).toFixed(2) // 8% Reward Target (1:2 Risk/Reward Ratio)

  const courseSteps = [
    {
      title: 'Step 1: Reading Green vs Red Candlesticks',
      icon: TrendingUp,
      content: 'Green candles mean buyers drove the price UP during that time period. Red candles mean sellers drove the price DOWN. Never buy when candles are making consecutive lower red lows.'
    },
    {
      title: 'Step 2: Understanding Golden Cross Signals',
      icon: Zap,
      content: 'A Golden Cross happens when the fast 20-Day Moving Average crosses ABOVE the slow 50-Day Moving Average. This signals that big institutional buyers are stepping in.'
    },
    {
      title: 'Step 3: Setting Your Risk Protection (Stop Loss)',
      icon: ShieldCheck,
      content: 'Always set a Stop Loss order BEFORE entering a trade. If you buy at $100 and set a Stop Loss at $96, the system automatically sells if price drops, capping your max loss at 4%.'
    },
    {
      title: 'Step 4: Real-Time Sizing & Trade Execution Discipline',
      icon: GraduationCap,
      content: 'Always calculate your exact position size using the Anti-Ruin Engine before entering. Never risk more than 3-5% of your total balance on a single trade, and log every real execution immediately.'
    }
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="ta-modal-root">
          {/* Backdrop */}
          <motion.div
            className="ta-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Modal Card */}
          <div className="ta-modal-wrapper">
            <motion.div
              className="ta-card"
              initial={{ opacity: 0, scale: 0.96, y: -15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -15 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              {/* Header */}
              <div className="ta-header">
                <div className="header-title-group">
                  <div className="ta-icon-badge">
                    <GraduationCap size={20} />
                  </div>
                  <div>
                    <h2 className="ta-title">{t.academyTitle}</h2>
                    <p className="ta-sub">{t.academySub}</p>
                  </div>
                </div>

                <button className="ta-close-btn" onClick={onClose} title="Close (ESC)">
                  <X size={18} />
                </button>
              </div>

              {/* Navigation Tabs Bar */}
              <div className="ta-tabs-bar font-mono">
                <button
                  className={`ta-tab ${activeTab === 'explainer' ? 'active' : ''}`}
                  onClick={() => setActiveTab('explainer')}
                >
                  <Lightbulb size={14} />
                  <span>{t.whyTriggeredTab}</span>
                </button>

                <button
                  className={`ta-tab ${activeTab === 'rules' ? 'active' : ''}`}
                  onClick={() => setActiveTab('rules')}
                >
                  <ShieldCheck size={14} />
                  <span>{t.rulesTab}</span>
                </button>

                <button
                  className={`ta-tab ${activeTab === 'course' ? 'active' : ''}`}
                  onClick={() => setActiveTab('course')}
                >
                  <BookOpen size={14} />
                  <span>{t.courseTab}</span>
                </button>
              </div>

              {/* Body Content */}
              <div className="ta-body font-mono">
                {activeTab === 'explainer' && (
                  <div className="ta-explainer-view">
                    {/* Active Ticker Signal HUD */}
                    <div className="signal-summary-card">
                      <div className="card-left">
                        <span className="ticker-tag">{activeSymbol}</span>
                        <div className="signal-badge-row">
                          <span className={`bias-badge ${isBuySignal ? 'bullish' : 'bearish'}`}>
                            {isBuySignal ? t.bullishSignalBadge : t.bearishSignalBadge}
                          </span>
                          <span className="price-tag">${activePrice.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>


                    {/* Plain-English Signal Explanation Grid */}
                    <div className="explainer-grid">
                      <div className="explain-box">
                        <div className="box-title">
                          <Zap size={14} className="title-icon" />
                          <span>1. WHY DID THIS SIGNAL TRIGGER?</span>
                        </div>
                        <p className="box-desc">
                          {isBuySignal
                            ? `The MACD momentum line for ${activeSymbol} crossed ABOVE its signal baseline. This means buying momentum is accelerating and institutional volume is pushing the stock higher.`
                            : `The MACD momentum line for ${activeSymbol} crossed BELOW its signal baseline. This indicates momentum is weakening and seller volume is taking control.`}
                        </p>
                      </div>

                      <div className="explain-box">
                        <div className="box-title">
                          <Target size={14} className="title-icon" />
                          <span>2. RECOMMENDED SAFE TRADE SETUP</span>
                        </div>
                        <div className="setup-target-list">
                          <div className="target-item">
                            <span>Entry Spot Price:</span>
                            <span className="val">${activePrice.toFixed(2)}</span>
                          </div>
                          <div className="target-item stop-loss">
                            <span>Suggested Stop Loss (Risk Limit):</span>
                            <span className="val">${suggestedStopLoss} (-4.0%)</span>
                          </div>
                          <div className="target-item take-profit">
                            <span>Suggested Take Profit Target:</span>
                            <span className="val">${suggestedTakeProfit} (+8.0%)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Key Lesson Alert */}
                    <div className="lesson-alert-box">
                      <Lightbulb size={16} />
                      <div>
                        <strong>Pro Tip for Beginners:</strong> Never place a trade without a Stop Loss. By placing a Stop Loss at ${suggestedStopLoss}, if the market moves against you, your account automatically exits with a small, manageable 4% loss instead of a big drawdown!
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'rules' && (
                  <div className="ta-rules-view">
                    <h3 className="section-heading">THE 5 GOLDEN RULES OF PROFITABLE TRADING</h3>
                    <div className="rules-list">
                      <div className="rule-card">
                        <div className="rule-num">1</div>
                        <div className="rule-content">
                          <span className="rule-title">The 1-2% Capital Protection Rule</span>
                          <p className="rule-desc">Never risk more than 1% to 2% of your total account balance on a single trade. If you have $10,000, your maximum loss on any single trade should never exceed $100-$200.</p>
                        </div>
                      </div>

                      <div className="rule-card">
                        <div className="rule-num">2</div>
                        <div className="rule-content">
                          <span className="rule-title">Always Set a Stop Loss Before Buying</span>
                          <p className="rule-desc">A Stop Loss acts as an automatic safety net. It cuts your losses automatically if the stock price drops, protecting your account while you sleep.</p>
                        </div>
                      </div>

                      <div className="rule-card">
                        <div className="rule-num">3</div>
                        <div className="rule-content">
                          <span className="rule-title">Trade With the Trend, Not Against It</span>
                          <p className="rule-desc">Only buy stocks when the 20-Day Moving Average is ABOVE the 50-Day Moving Average. Trying to pick bottoms on falling stocks is how beginners lose money.</p>
                        </div>
                      </div>

                      <div className="rule-card">
                        <div className="rule-num">4</div>
                        <div className="rule-content">
                          <span className="rule-title">Strict Position Sizing & Real Execution Rules</span>
                          <p className="rule-desc">Use the Anti-Ruin Sizing Engine to calculate the exact fractional shares for your broker. Never enter any trade without a predefined Stop Loss and Take Profit target.</p>
                        </div>
                      </div>

                      <div className="rule-card">
                        <div className="rule-num">5</div>
                        <div className="rule-content">
                          <span className="rule-title">Keep a Trade Journal & Control Emotions</span>
                          <p className="rule-desc">Never trade out of FOMO (Fear Of Missing Out). Follow your entry checklist and record every trade to learn from your mistakes.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'course' && (
                  <div className="ta-course-view">
                    <div className="course-progress-bar">
                      <span className="progress-label">LESSON {currentCourseStep + 1} OF {courseSteps.length}</span>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${((currentCourseStep + 1) / courseSteps.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="step-card">
                      <div className="step-card-header">
                        {(() => {
                          const IconComp = courseSteps[currentCourseStep].icon
                          return <IconComp size={24} className="step-icon" />
                        })()}
                        <h4>{courseSteps[currentCourseStep].title}</h4>
                      </div>
                      <p className="step-desc">{courseSteps[currentCourseStep].content}</p>
                    </div>

                    <div className="course-nav font-mono">
                      <button
                        className="nav-btn prev"
                        disabled={currentCourseStep === 0}
                        onClick={() => setCurrentCourseStep(prev => prev - 1)}
                      >
                        Previous Step
                      </button>

                      {currentCourseStep < courseSteps.length - 1 ? (
                        <button
                          className="nav-btn next"
                          onClick={() => setCurrentCourseStep(prev => prev + 1)}
                        >
                          Next Step <ArrowRight size={14} />
                        </button>
                      ) : (
                        <button
                          className="nav-btn finish"
                          onClick={onClose}
                        >
                          Finish Course <CheckCircle size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="ta-footer font-mono">
                <span className="footer-brand">KAPPA // BEGINNER TRADER ACADEMY</span>
                <button className="ta-done-btn" onClick={onClose}>
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
