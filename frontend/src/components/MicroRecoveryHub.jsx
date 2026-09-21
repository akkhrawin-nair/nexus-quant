import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  X,
  Zap,
  CheckCircle2,
  DollarSign,
  Briefcase,
  ChevronRight,
  Flame,
  ArrowRight,
  Copy,
  Check,
  Newspaper,
  ExternalLink,
  RefreshCw
} from 'lucide-react'

export default function MicroRecoveryHub({
  isOpen = false,
  onClose,
  signals = [],
  paperStats = {},
  onOpenPaperTrade = null,
  onOpenChart = null
}) {
  // Current tracking balance (defaults to paper portfolio balance if <= 50, otherwise 6.00)
  const [accountBalance, setAccountBalance] = useState(() => {
    const bal = paperStats?.balance
    return (bal && bal > 0 && bal <= 50) ? bal : 6.00
  })

  const [copiedOrder, setCopiedOrder] = useState(false)

  // Sizing Calculator State (Wider swing volatility buffer: -7.5% Stop, +15% Target)
  const [calcSymbol, setCalcSymbol] = useState('NVDA')
  const [calcEntry, setCalcEntry] = useState(219.74)
  const [calcStopLoss, setCalcStopLoss] = useState(203.26)
  const [calcTakeProfit, setCalcTakeProfit] = useState(252.70)
  const [riskTolerancePct, setRiskTolerancePct] = useState(8) // 8% risk buffer ($0.48 on $6)
  const [activeBuffer, setActiveBuffer] = useState('swing') // 'tight' (-4.5%), 'swing' (-7.5%), 'wide' (-10%)
  const [newsCatalyst, setNewsCatalyst] = useState(null)
  const [loadingNews, setLoadingNews] = useState(false)

  // Fetch real-time news catalyst whenever symbol changes or modal opens
  useEffect(() => {
    if (!isOpen || !calcSymbol) return
    let isMounted = true
    setLoadingNews(true)
    fetch(`http://127.0.0.1:8000/api/brain/fusion/?symbol=${encodeURIComponent(calcSymbol)}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          setNewsCatalyst(data)
          setLoadingNews(false)
        }
      })
      .catch(() => {
        if (isMounted) setLoadingNews(false)
      })
    return () => { isMounted = false }
  }, [isOpen, calcSymbol])

  // Apply stop loss buffer preset
  const applyBufferPreset = (type, basePrice = calcEntry) => {
    setActiveBuffer(type)
    const price = parseFloat(basePrice) || 100
    if (type === 'tight') {
      setCalcStopLoss(parseFloat((price * 0.955).toFixed(2)))
      setCalcTakeProfit(parseFloat((price * 1.091).toFixed(2)))
    } else if (type === 'swing') {
      // Expanded swing volatility buffer: absorbs normal intraday 3.5%-5% market noise
      setCalcStopLoss(parseFloat((price * 0.925).toFixed(2)))
      setCalcTakeProfit(parseFloat((price * 1.150).toFixed(2)))
    } else if (type === 'wide') {
      setCalcStopLoss(parseFloat((price * 0.900).toFixed(2)))
      setCalcTakeProfit(parseFloat((price * 1.200).toFixed(2)))
    }
  }

  // Sync selected symbol from signals
  const handleSelectSignalForCalc = (sig) => {
    if (!sig) return
    const sym = sig.symbol || 'NVDA'
    const price = parseFloat(sig.current_price || sig.close_price || 150)
    setCalcSymbol(sym)
    setCalcEntry(price)
    applyBufferPreset(activeBuffer, price)
  }

  const [brokerFormat, setBrokerFormat] = useState('robinhood') // 'robinhood' | 'webull_ibkr' | 'alpaca'
  const [hardStopCommitted, setHardStopCommitted] = useState(true)

  // Copy exact formatted bracket order based on selected broker platform
  const handleCopyBrokerOrder = () => {
    let text = ''
    if (brokerFormat === 'robinhood') {
      text = `[ROBINHOOD FRACTIONAL BRACKET ORDER]
TICKER: ${calcSymbol}
ACTION: BUY IN DOLLARS
DOLLAR AMOUNT: $${sizingAnalysis.totalAllocation} USD (~${sizingAnalysis.shares} shares)
CONDITIONAL STOP-LOSS: $${calcStopLoss} (-$${sizingAnalysis.actualRiskDollars})
CONDITIONAL TAKE-PROFIT: $${calcTakeProfit} (+$${sizingAnalysis.potentialProfitDollars})
RULE: Set conditional stop-loss immediately upon fill. Do not adjust or cancel.`
    } else if (brokerFormat === 'webull_ibkr') {
      text = `[OCO BRACKET TICKET - WEBULL / IBKR / TOS]
BUY ${sizingAnalysis.shares} ${calcSymbol} LMT @ $${calcEntry} GTC
  | STOP LOSS: STP $${calcStopLoss} GTC (-$${sizingAnalysis.actualRiskDollars} USD)
  | TAKE PROFIT: LMT $${calcTakeProfit} GTC (+${sizingAnalysis.potentialProfitDollars} USD)
OCO BRACKET: TRIGGERED UPON FILL (SERVER-SIDE LOCKED)`
    } else {
      // Alpaca API JSON Bracket Payload
      text = JSON.stringify({
        symbol: calcSymbol,
        qty: sizingAnalysis.shares,
        side: "buy",
        type: "limit",
        limit_price: calcEntry,
        time_in_force: "gtc",
        order_class: "bracket",
        take_profit: {
          limit_price: calcTakeProfit
        },
        stop_loss: {
          stop_price: calcStopLoss
        }
      }, null, 2)
    }
    navigator.clipboard?.writeText(text)
    setCopiedOrder(true)
    setTimeout(() => setCopiedOrder(false), 2500)
  }

  // Calculate Risk / Reward & Fractional Sizing
  const sizingAnalysis = useMemo(() => {
    const balance = Math.max(1, parseFloat(accountBalance) || 6.00)
    const entry = parseFloat(calcEntry) || 1
    const stop = parseFloat(calcStopLoss) || entry * 0.97
    const target = parseFloat(calcTakeProfit) || entry * 1.09

    // Max dollar risk allowed based on selected risk tolerance %
    const maxRiskDollars = Number((balance * (riskTolerancePct / 100)).toFixed(2))

    // Per-share risk and reward
    const riskPerShare = Math.max(0.0001, entry - stop)
    const rewardPerShare = Math.max(0, target - entry)

    // Risk to Reward Ratio
    const rrRatio = riskPerShare > 0 ? (rewardPerShare / riskPerShare).toFixed(2) : '0.00'

    // How many shares to risk max allowed dollars
    let shares = riskPerShare > 0 ? maxRiskDollars / riskPerShare : 0
    let totalAllocation = shares * entry

    // Hard ceiling: Cannot allocate more than available cash
    if (totalAllocation > balance) {
      shares = balance / entry
      totalAllocation = balance
    }

    const actualRiskDollars = Number((shares * riskPerShare).toFixed(2))
    const potentialProfitDollars = Number((shares * rewardPerShare).toFixed(2))
    const isAntiTiltBreached = (actualRiskDollars / balance) > 0.10 || (stop >= entry)

    return {
      maxRiskDollars,
      actualRiskDollars,
      potentialProfitDollars,
      shares: Number(shares.toFixed(4)),
      totalAllocation: Number(totalAllocation.toFixed(2)),
      rrRatio,
      isAntiTiltBreached,
      riskPerSharePct: ((riskPerShare / entry) * 100).toFixed(1),
      rewardPerSharePct: ((rewardPerShare / entry) * 100).toFixed(1)
    }
  }, [accountBalance, calcEntry, calcStopLoss, calcTakeProfit, riskTolerancePct])

  // Filter signals strictly for Grade A+ Confluence setups (70%+ Institutional Edge)
  const gradeASignals = useMemo(() => {
    return signals
      .filter(s => {
        const is70 = s.golden_opportunity?.is_70_plus_edge
        const score = s.golden_opportunity?.confluence_score || s.golden_opportunity?.conviction_score || 0
        return is70 || score >= 85
      })
      .slice(0, 5)
  }, [signals])

  // 14-Step Compounding Roadmap from $6 to $30 (compounding ~12.5% per winning trade)
  const compoundingSteps = useMemo(() => {
    const steps = []
    let current = 6.00
    const targetVal = 30.00
    const stepGain = 0.125 // +12.5% per trade

    for (let i = 1; i <= 14; i++) {
      const nextVal = current * (1 + stepGain)
      const profit = nextVal - current
      steps.push({
        step: i,
        startVal: current.toFixed(2),
        endVal: (nextVal > targetVal ? targetVal : nextVal).toFixed(2),
        gain: profit.toFixed(2),
        isReached: (paperStats?.totalEquity || 6.00) >= nextVal
      })
      current = nextVal
      if (current >= targetVal) break
    }
    return steps
  }, [paperStats?.totalEquity])

  // Overall Recovery Progress %
  const currentEquity = paperStats?.totalEquity || accountBalance
  const progressPercent = Math.min(100, Math.max(0, (((currentEquity - 6.00) / (30.00 - 6.00)) * 100))).toFixed(1)

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="recovery-hub-backdrop" onClick={onClose}>
        <motion.div
          className="recovery-hub-modal font-mono"
          initial={{ opacity: 0, scale: 0.95, y: -15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="recovery-hub-header">
            <div className="hub-header-left">
              <div className="hub-badge-icon">
                <Target size={20} />
              </div>
              <div>
                <div className="hub-title-row">
                  <h2 className="hub-title">$6.00 ➔ $30.00 RECOVERY TERMINAL</h2>
                  <span className="hub-pill-chip" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #10b981' }}>
                    REAL-TIME EXECUTION
                  </span>
                </div>
                <p className="hub-subtitle">
                  Live risk-controlled sizing, broker order copy, and real-time capital tracker to grow your $6.00 back to $30.00.
                </p>
              </div>
            </div>
            <button className="hub-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* Progress Milestone Bar */}
          <div className="hub-milestone-panel">
            <div className="milestone-top-row">
              <div className="milestone-stat">
                <span className="milestone-label">Starting Capital</span>
                <span className="milestone-val red">$6.00</span>
              </div>
              <div className="milestone-stat center">
                <span className="milestone-label">Current Progress</span>
                <span className="milestone-val gold">{progressPercent}%</span>
              </div>
              <div className="milestone-stat right">
                <span className="milestone-label">Recovery Target</span>
                <span className="milestone-val green">$30.00</span>
              </div>
            </div>

            <div className="milestone-bar-track">
              <div className="milestone-bar-fill" style={{ width: `${progressPercent}%` }} />
              {/* Milestone Markers */}
              <div className="milestone-checkpoint" style={{ left: '0%' }}>
                <span>$6 (Start)</span>
              </div>
              <div className="milestone-checkpoint" style={{ left: '16.6%' }}>
                <span>$10 (Stage 1)</span>
              </div>
              <div className="milestone-checkpoint" style={{ left: '50%' }}>
                <span>$18 (Stage 2)</span>
              </div>
              <div className="milestone-checkpoint" style={{ left: '100%' }}>
                <span>$30 (Goal Reached)</span>
              </div>
            </div>

            {/* Stages Overview */}
            <div className="milestone-stages-grid">
              <div className={`stage-card ${currentEquity < 10 ? 'active' : 'completed'}`}>
                <span className="stage-num">STAGE 1</span>
                <span className="stage-name">Capital Defense</span>
                <span className="stage-target">$6.00 ➔ $10.00</span>
                <span className="stage-desc">Risk max $0.30 per trade. Tight stops, base hits only.</span>
              </div>
              <div className={`stage-card ${currentEquity >= 10 && currentEquity < 18 ? 'active' : currentEquity >= 18 ? 'completed' : ''}`}>
                <span className="stage-num">STAGE 2</span>
                <span className="stage-name">Acceleration</span>
                <span className="stage-target">$10.00 ➔ $18.00</span>
                <span className="stage-desc">Trail winning swings. Reinvest gains into A+ confluence setups.</span>
              </div>
              <div className={`stage-card ${currentEquity >= 18 ? 'active' : ''}`}>
                <span className="stage-num">STAGE 3</span>
                <span className="stage-name">Full Recovery</span>
                <span className="stage-target">$18.00 ➔ $30.00</span>
                <span className="stage-desc">Account fully restored. Transition to long-term wealth building.</span>
              </div>
            </div>
          </div>

          {/* Main Grid: Calculator & Roadmap */}
          <div className="hub-body-grid">
            {/* Left Column: Anti-Ruin Sizing Calculator */}
            <div className="hub-card">
              <div className="card-header">
                <ShieldCheck size={16} className="card-icon green" />
                <span className="card-title">ANTI-RUIN POSITION SIZING ENGINE</span>
              </div>

              {/* Anti-Tilt Warning Shield */}
              {sizingAnalysis.isAntiTiltBreached && (
                <div className="hub-tilt-alert">
                  <AlertTriangle size={18} className="alert-icon" />
                  <div className="alert-content">
                    <strong>⚠️ GAMBLER&apos;S RUIN WARNING</strong>
                    <p>
                      Risking more than 10% on a $6 account has an 87% statistical probability of total wipeout. Lower your allocation or tighten your stop-loss!
                    </p>
                  </div>
                </div>
              )}

              <div className="calculator-form">
                <div className="calc-row">
                  <div className="calc-group">
                    <label>Account Balance ($)</label>
                    <input
                      type="number"
                      step="0.10"
                      min="1"
                      value={accountBalance}
                      onChange={(e) => setAccountBalance(Number(e.target.value))}
                      className="calc-input"
                    />
                  </div>
                  <div className="calc-group">
                    <label>Risk Per Trade (%)</label>
                    <div className="calc-risk-pills">
                      {[3, 5, 8].map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRiskTolerancePct(r)}
                          className={`risk-pill ${riskTolerancePct === r ? 'active' : ''}`}
                        >
                          {r}% (${((accountBalance * r) / 100).toFixed(2)})
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="calc-row">
                  <div className="calc-group">
                    <label>Target Asset Ticker</label>
                    <select
                      value={calcSymbol}
                      onChange={(e) => {
                        const sig = signals.find(s => s.symbol === e.target.value)
                        if (sig) handleSelectSignalForCalc(sig)
                        else setCalcSymbol(e.target.value)
                      }}
                      className="calc-input"
                    >
                      {signals.map(s => (
                        <option key={s.symbol} value={s.symbol}>
                          {s.symbol} (${Number(s.current_price || s.close_price).toFixed(2)}) {s.sector ? `• ${s.sector}` : ''} {s.earnings_blackout ? '⚠️ ER BLACKOUT' : ''}
                        </option>
                      ))}
                    </select>
                    {/* Active Asset Sector & Earnings Metadata Ribbon */}
                    <div style={{ display: 'flex', gap: '5px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {(() => {
                        const activeSig = signals.find(s => s.symbol === calcSymbol)
                        if (!activeSig) return null
                        return (
                          <>
                            <span style={{
                              fontSize: '0.62rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontWeight: 700,
                              border: '1px solid #bfdbfe'
                            }}>
                              Sector: {activeSig.sector || 'Equities'}
                            </span>
                            {activeSig.earnings_blackout ? (
                              <span style={{
                                fontSize: '0.62rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: '#fee2e2',
                                color: '#b91c1c',
                                fontWeight: 800,
                                border: '1px solid #fca5a5'
                              }}>
                                ⛔ ER in {activeSig.earnings_info?.days_to_earnings}d (BLACKOUT)
                              </span>
                            ) : activeSig.earnings_info?.has_earnings ? (
                              <span style={{
                                fontSize: '0.62rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: '#f1f5f9',
                                color: '#475569',
                                fontWeight: 600,
                                border: '1px solid #cbd5e1'
                              }}>
                                📅 ER in {activeSig.earnings_info?.days_to_earnings}d
                              </span>
                            ) : null}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                  <div className="calc-group">
                    <label>Entry Price ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={calcEntry}
                      onChange={(e) => setCalcEntry(Number(e.target.value))}
                      className="calc-input"
                    />
                  </div>
                </div>

                <div className="calc-row">
                  <div className="calc-group">
                    <label style={{ color: '#ef4444' }}>Stop-Loss ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={calcStopLoss}
                      onChange={(e) => {
                        setCalcStopLoss(Number(e.target.value))
                        setActiveBuffer('custom')
                      }}
                      className="calc-input stop"
                    />
                  </div>
                  <div className="calc-group">
                    <label style={{ color: '#10b981' }}>Take-Profit Target ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={calcTakeProfit}
                      onChange={(e) => {
                        setCalcTakeProfit(Number(e.target.value))
                        setActiveBuffer('custom')
                      }}
                      className="calc-input target"
                    />
                  </div>
                </div>

                {/* Volatility Stop-Loss Buffer Presets */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '0.65rem' }}>
                  <button
                    type="button"
                    onClick={() => applyBufferPreset('tight')}
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      borderRadius: '4px',
                      border: activeBuffer === 'tight' ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                      background: activeBuffer === 'tight' ? '#eff6ff' : '#f8fafc',
                      color: activeBuffer === 'tight' ? '#1d4ed8' : '#64748b',
                      cursor: 'pointer'
                    }}
                    title="Tight Intraday Buffer (-4.5% Stop / +9.1% Target)"
                  >
                    Tight (-4.5%)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBufferPreset('swing')}
                    style={{
                      flex: 1.4,
                      padding: '4px 6px',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      borderRadius: '4px',
                      border: activeBuffer === 'swing' ? '1px solid #10b981' : '1px solid #e2e8f0',
                      background: activeBuffer === 'swing' ? '#ecfdf5' : '#f8fafc',
                      color: activeBuffer === 'swing' ? '#047857' : '#64748b',
                      cursor: 'pointer'
                    }}
                    title="Recommended: Expands stop-loss to -7.5% to absorb normal ATR market noise and avoid premature morning stop-outs"
                  >
                    🛡️ Swing Buffer (-7.5%)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBufferPreset('wide')}
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      borderRadius: '4px',
                      border: activeBuffer === 'wide' ? '1px solid #8b5cf6' : '1px solid #e2e8f0',
                      background: activeBuffer === 'wide' ? '#f5f3ff' : '#f8fafc',
                      color: activeBuffer === 'wide' ? '#6d28d9' : '#64748b',
                      cursor: 'pointer'
                    }}
                    title="Wide Trend Buffer (-10% Stop / +20% Target)"
                  >
                    Wide (-10%)
                  </button>
                </div>

                {/* Sizing Output Display Box */}
                <div className="calc-output-box">
                  <div className="output-row">
                    <span>Safe Position Sizing:</span>
                    <strong className="green">${sizingAnalysis.totalAllocation}</strong>
                  </div>
                  <div className="output-row">
                    <span>Exact Fractional Shares:</span>
                    <strong>{sizingAnalysis.shares} shares</strong>
                  </div>
                  <div className="output-row">
                    <span>Maximum Dollar Risk:</span>
                    <strong className="red">-${sizingAnalysis.actualRiskDollars}</strong>
                  </div>
                  <div className="output-row">
                    <span>Potential Dollar Reward:</span>
                    <strong className="green">+${sizingAnalysis.potentialProfitDollars}</strong>
                  </div>
                  <div className="output-row rr">
                    <span>Risk-to-Reward Ratio:</span>
                    <span className={`rr-badge ${parseFloat(sizingAnalysis.rrRatio) >= 2.0 ? 'great' : 'warning'}`}>
                      1 : {sizingAnalysis.rrRatio} {parseFloat(sizingAnalysis.rrRatio) >= 2.0 ? '✅ EXCELLENT' : '⚠️ LOW R/R'}
                    </span>
                  </div>

                  {/* Real-Time Breaking News Catalyst Banner */}
                  <div style={{
                    marginTop: '0.6rem',
                    padding: '0.55rem',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Newspaper size={12} color="#0284c7" />
                        <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#0f172a' }}>
                          REAL-TIME NEWS CATALYST ({calcSymbol})
                        </span>
                      </div>
                      {newsCatalyst?.news_score ? (
                        <span style={{
                          fontSize: '0.6rem',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '3px',
                          background: newsCatalyst.news_score >= 65 ? '#dcfce7' : '#fee2e2',
                          color: newsCatalyst.news_score >= 65 ? '#15803d' : '#b91c1c'
                        }}>
                          {newsCatalyst.news_score >= 65 ? '🔥 BULLISH' : '⚠️ CAUTION'} {newsCatalyst.news_score}%
                        </span>
                      ) : null}
                    </div>

                    {loadingNews ? (
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        Listening to live financial news wire for {calcSymbol}...
                      </div>
                    ) : newsCatalyst?.news && newsCatalyst.news.length > 0 ? (
                      <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.3, marginBottom: '0.2rem' }}>
                          "{newsCatalyst.news[0].title}"
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.62rem', color: '#64748b' }}>
                          <span>{newsCatalyst.news[0].source} • {newsCatalyst.news[0].time}</span>
                          {newsCatalyst.news[0].url && (
                            <a
                              href={newsCatalyst.news[0].url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}
                            >
                              Source <ExternalLink size={9} />
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                        No acute high-impact catalyst detected in last 60m. Technical confluence holds priority.
                      </div>
                    )}
                  </div>

                  {/* Institutional 5-Layer Confluence Edge Verification */}
                  {(() => {
                    const activeSig = signals.find(s => s.symbol === calcSymbol)
                    const layers = activeSig?.golden_opportunity?.layers || []
                    const is70 = activeSig?.golden_opportunity?.is_70_plus_edge
                    if (!layers.length) return null
                    return (
                      <div style={{ marginTop: '0.6rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#0f172a' }}>
                            {is70 ? '🎯 70%+ STATISTICAL EDGE' : '⚡ 5-LAYER CONFLUENCE AUDIT'}
                          </span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: is70 ? '#15803d' : '#64748b' }}>
                            {activeSig.golden_opportunity.passed_count}/5 PASSED
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                          {layers.map(l => (
                            <span
                              key={l.id}
                              style={{
                                fontSize: '0.6rem',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                background: l.passed ? '#ecfdf5' : '#fef2f2',
                                color: l.passed ? '#047857' : '#b91c1c',
                                border: `1px solid ${l.passed ? '#a7f3d0' : '#fecaca'}`,
                                fontWeight: 700
                              }}
                              title={`${l.name}: ${l.detail}`}
                            >
                              {l.passed ? '✓' : '✕'} {l.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Earnings Blackout Guardrail Warning */}
                  {(() => {
                    const activeSig = signals.find(s => s.symbol === calcSymbol)
                    if (!activeSig?.earnings_blackout) return null
                    return (
                      <div style={{
                        marginTop: '0.6rem',
                        padding: '0.6rem',
                        background: '#fef2f2',
                        border: '1px solid #f87171',
                        borderRadius: '6px',
                        color: '#991b1b',
                        fontSize: '0.68rem',
                        lineHeight: 1.4
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 800 }}>
                          <AlertTriangle size={13} color="#dc2626" />
                          <span>⛔ EARNINGS BLACKOUT ACTIVE (Reports in {activeSig.earnings_info?.days_to_earnings}d on {activeSig.earnings_info?.earnings_date})</span>
                        </div>
                        <div style={{ marginTop: '3px', color: '#b91c1c' }}>
                          Wall Street quant rule: Never hold swing setups into quarterly earnings due to binary -15% gap risk. Wait until post-earnings volatility crush settles.
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Universal Broker Bracket Ticket Selector (Zero-Emotion Execution) */}
                <div style={{ marginTop: '0.6rem', padding: '0.55rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#0f172a' }}>
                      BROKER BRACKET FORMAT (OCO)
                    </span>
                    <span style={{ fontSize: '0.58rem', color: '#15803d', fontWeight: 700, background: '#dcfce7', padding: '1px 5px', borderRadius: '3px' }}>
                      ⚡ ZERO-EMOTION BRACKET
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr 1fr', gap: '4px', marginBottom: '0.45rem' }}>
                    {[
                      { id: 'robinhood', label: 'Robinhood' },
                      { id: 'webull_ibkr', label: 'Webull / IBKR' },
                      { id: 'alpaca', label: 'Alpaca (JSON)' }
                    ].map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setBrokerFormat(b.id)}
                        style={{
                          padding: '4px 6px',
                          fontSize: '0.62rem',
                          fontWeight: brokerFormat === b.id ? 800 : 600,
                          borderRadius: '4px',
                          border: brokerFormat === b.id ? '1px solid #2563eb' : '1px solid #cbd5e1',
                          background: brokerFormat === b.id ? '#eff6ff' : '#fff',
                          color: brokerFormat === b.id ? '#1d4ed8' : '#64748b',
                          cursor: 'pointer'
                        }}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>

                  {/* Hard-Stop Psychological Commitment Checkbox */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.61rem', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={hardStopCommitted}
                      onChange={(e) => setHardStopCommitted(e.target.checked)}
                      style={{ accentColor: '#10b981' }}
                    />
                    <span>I commit to setting this bracket stop at the broker level and not canceling it.</span>
                  </label>
                </div>

                {/* Real Broker Order Copy & Live Tracking Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleCopyBrokerOrder}
                    className="calc-copy-btn font-mono"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      padding: '0.55rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: copiedOrder ? '#dcfce7' : '#f8fafc',
                      color: copiedOrder ? '#15803d' : '#0f172a',
                      fontWeight: 800,
                      fontSize: '0.72rem',
                      cursor: 'pointer'
                    }}
                    title="Copy formatted bracket order ticket to paste directly into your brokerage app"
                  >
                    {copiedOrder ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedOrder ? 'Bracket Copied!' : `📋 Copy ${brokerFormat === 'robinhood' ? 'Robinhood' : brokerFormat === 'webull_ibkr' ? 'IBKR' : 'Alpaca'} Ticket`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      onOpenPaperTrade?.(calcSymbol)
                    }}
                    className="calc-execute-btn font-mono"
                    style={{ margin: 0 }}
                  >
                    <Zap size={14} />
                    <span>Track Live</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Grade A+ Setup Feed & Compounding Roadmap */}
            <div className="hub-card">
              <div className="card-header">
                <Flame size={16} className="card-icon gold" />
                <span className="card-title">GRADE A+ HIGH-CONVICTION (70%+ STATISTICAL EDGE)</span>
              </div>

              <div className="hub-signals-list">
                {gradeASignals.length === 0 ? (
                  <p className="no-signals-text">
                    🛡️ No Grade A+ setups currently meeting strict 70%+ confluence criteria. Wait patiently for market alignment.
                  </p>
                ) : (
                  gradeASignals.map(sig => {
                    const price = parseFloat(sig.current_price || sig.close_price || 0)
                    const score = sig.golden_opportunity?.conviction_score || 85
                    const layers = sig.golden_opportunity?.layers || []
                    return (
                      <div key={sig.symbol} className="hub-signal-item">
                        <div className="sig-info">
                          <div className="sig-sym-row">
                            <span className="sig-symbol">{sig.symbol}</span>
                            {sig.sector && (
                              <span style={{ fontSize: '0.58rem', padding: '1px 5px', borderRadius: '3px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, border: '1px solid #bfdbfe' }}>
                                {sig.sector}
                              </span>
                            )}
                            <span className="sig-badge" style={{ background: '#dcfce7', color: '#15803d', borderColor: '#86efac' }}>
                              70%+ EDGE ({score}%)
                            </span>
                          </div>
                          <span className="sig-price">${price.toFixed(2)} • {sig.asset_type || 'Stock'}</span>
                          {layers.length > 0 && (
                            <div style={{ display: 'flex', gap: '3px', marginTop: '4px', flexWrap: 'wrap' }}>
                              {layers.map(l => (
                                <span
                                  key={l.id}
                                  style={{
                                    fontSize: '0.58rem',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    background: l.passed ? '#ecfdf5' : '#fef2f2',
                                    color: l.passed ? '#047857' : '#b91c1c',
                                    border: `1px solid ${l.passed ? '#a7f3d0' : '#fecaca'}`,
                                    fontWeight: 700
                                  }}
                                  title={`${l.name}: ${l.detail}`}
                                >
                                  {l.passed ? '✓' : '✕'} {l.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="sig-actions">
                          <button
                            onClick={() => handleSelectSignalForCalc(sig)}
                            className="sig-calc-btn"
                            title="Calculate exact $6 sizing"
                          >
                            Size Trade
                          </button>
                          <button
                            onClick={() => {
                              onClose()
                              onOpenPaperTrade?.(sig.symbol)
                            }}
                            className="sig-trade-btn"
                          >
                            Track Live
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* 14-Step Compounding Roadmap Accordion / Table */}
              <div className="roadmap-section">
                <div className="roadmap-header">
                  <TrendingUp size={14} className="green" />
                  <span>14-TRADE COMPOUNDING BLUEPRINT</span>
                </div>
                <div className="roadmap-table-wrap">
                  <table className="roadmap-table">
                    <thead>
                      <tr>
                        <th>Trade</th>
                        <th>Start</th>
                        <th>Target (+12.5%)</th>
                        <th>Profit</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compoundingSteps.map(step => (
                        <tr key={step.step} className={step.isReached ? 'reached' : ''}>
                          <td>#{step.step}</td>
                          <td>${step.startVal}</td>
                          <td style={{ fontWeight: 700, color: '#059669' }}>${step.endVal}</td>
                          <td>+${step.gain}</td>
                          <td>
                            {step.isReached ? (
                              <span className="status-pill done"><CheckCircle2 size={11} /> Reached</span>
                            ) : (
                              <span className="status-pill pending">Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
