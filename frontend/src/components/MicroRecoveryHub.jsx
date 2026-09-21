import { useState, useMemo } from 'react'
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
  Check
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

  // Sizing Calculator State
  const [calcSymbol, setCalcSymbol] = useState('NVDA')
  const [calcEntry, setCalcEntry] = useState(219.74)
  const [calcStopLoss, setCalcStopLoss] = useState(213.15)
  const [calcTakeProfit, setCalcTakeProfit] = useState(239.50)
  const [riskTolerancePct, setRiskTolerancePct] = useState(5) // 5% max risk default ($0.30 on $6)

  // Sync selected symbol from signals
  const handleSelectSignalForCalc = (sig) => {
    if (!sig) return
    const sym = sig.symbol || 'NVDA'
    const price = parseFloat(sig.current_price || sig.close_price || 150)
    setCalcSymbol(sym)
    setCalcEntry(price)
    // Default 3% stop loss and 9% take profit (1:3 R/R)
    setCalcStopLoss(parseFloat((price * 0.97).toFixed(2)))
    setCalcTakeProfit(parseFloat((price * 1.09).toFixed(2)))
  }

  // Copy exact order parameters to clipboard for typing into real brokerage app
  const handleCopyBrokerOrder = () => {
    const text = `TICKER: ${calcSymbol}
ACTION: BUY (Market or Limit @ $${calcEntry})
ALLOCATION: $${sizingAnalysis.totalAllocation} USD
SHARES: ${sizingAnalysis.shares} shares
STOP LOSS: $${calcStopLoss} (-$${sizingAnalysis.actualRiskDollars})
TAKE PROFIT: $${calcTakeProfit} (+$${sizingAnalysis.potentialProfitDollars})
R/R RATIO: 1 : ${sizingAnalysis.rrRatio}`
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

  // Filter signals for Grade A+ Confluence setups
  const gradeASignals = useMemo(() => {
    return signals
      .filter(s => {
        const isGolden = s.golden_opportunity?.is_golden_opportunity || s.is_golden
        const score = s.golden_opportunity?.conviction_score || (s.confidence_score ? s.confidence_score * 100 : 70)
        return isGolden || score >= 75
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
                          {s.symbol} (${Number(s.current_price || s.close_price).toFixed(2)})
                        </option>
                      ))}
                    </select>
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
                      onChange={(e) => setCalcStopLoss(Number(e.target.value))}
                      className="calc-input stop"
                    />
                  </div>
                  <div className="calc-group">
                    <label style={{ color: '#10b981' }}>Take-Profit Target ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={calcTakeProfit}
                      onChange={(e) => setCalcTakeProfit(Number(e.target.value))}
                      className="calc-input target"
                    />
                  </div>
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
                    <span className={`rr-badge ${parseFloat(sizingAnalysis.rrRatio) >= 2.5 ? 'great' : 'warning'}`}>
                      1 : {sizingAnalysis.rrRatio} {parseFloat(sizingAnalysis.rrRatio) >= 2.5 ? '✅ EXCELLENT' : '⚠️ LOW R/R'}
                    </span>
                  </div>
                </div>

                {/* Real Broker Order Copy & Live Tracking Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
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
                      fontSize: '0.74rem',
                      cursor: 'pointer'
                    }}
                    title="Copy exact ticker, limit price, stop-loss, and share count to paste into your real broker"
                  >
                    {copiedOrder ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedOrder ? 'Order Copied!' : '📋 Copy Broker Order'}</span>
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
                <span className="card-title">GRADE A+ HIGH-CONVICTION OPPORTUNITIES</span>
              </div>

              <div className="hub-signals-list">
                {gradeASignals.length === 0 ? (
                  <p className="no-signals-text">
                    No Grade A+ setups currently meeting strict confluence criteria. Wait patiently for market alignment.
                  </p>
                ) : (
                  gradeASignals.map(sig => {
                    const price = parseFloat(sig.current_price || sig.close_price || 0)
                    const score = sig.golden_opportunity?.conviction_score || 82
                    return (
                      <div key={sig.symbol} className="hub-signal-item">
                        <div className="sig-info">
                          <div className="sig-sym-row">
                            <span className="sig-symbol">{sig.symbol}</span>
                            <span className="sig-badge">A+ CONFLUENCE ({score}%)</span>
                          </div>
                          <span className="sig-price">${price.toFixed(2)} • {sig.asset_type || 'Stock'}</span>
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
