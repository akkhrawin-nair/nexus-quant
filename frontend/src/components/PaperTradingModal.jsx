import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase,
  X,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Target,
  Zap,
  Info,
  Sliders,
  Scale,
  Flame,
  Download
} from 'lucide-react'
import {
  getPortfolio,
  openPosition,
  closePosition,
  resetPortfolio,
  addFunds,
  calculatePortfolioStats,
  exportPortfolioHistoryToCSV
} from '../utils/paperTradingStorage'

export default function PaperTradingModal({
  isOpen = false,
  onClose,
  signals = [],
  initialTicker = null
}) {
  const [portfolio, setPortfolio] = useState(getPortfolio())
  const [activeTab, setActiveTab] = useState('POSITIONS') // 'POSITIONS' | 'HISTORY' | 'NEW_TRADE'
  const [statusMessage, setStatusMessage] = useState(null)

  // New Trade Form State
  const [tradeSymbol, setTradeSymbol] = useState(initialTicker || 'NVDA')
  const [tradeAmount, setTradeAmount] = useState(() => {
    const p = getPortfolio()
    return p.balance <= 50 ? String(Number((p.balance * 0.25).toFixed(2)) || '1.50') : '1000'
  })
  const [customStopLoss, setCustomStopLoss] = useState('')
  const [customTakeProfit, setCustomTakeProfit] = useState('')

  // Automatically switch to NEW_TRADE tab when opened via a specific asset Trade Setup
  useEffect(() => {
    if (isOpen && initialTicker) {
      setTradeSymbol(initialTicker)
      setActiveTab('NEW_TRADE')
    } else if (isOpen && !initialTicker) {
      // Default to NEW_TRADE if user has no open positions
      const current = getPortfolio()
      if (!current.positions || current.positions.length === 0) {
        setActiveTab('NEW_TRADE')
      } else {
        setActiveTab('POSITIONS')
      }
    }
  }, [initialTicker, isOpen])

  // Build a live prices lookup map from signals
  const livePricesMap = useMemo(() => {
    const map = {}
    signals.forEach(s => {
      const sym = s.symbol?.toUpperCase()
      const price = Number(s.current_price || s.close_price || 0)
      if (sym && price > 0) {
        map[sym] = price
      }
    })
    return map
  }, [signals])

  // Reload portfolio on custom event or when modal opens
  const refreshPortfolio = () => {
    setPortfolio(getPortfolio())
  }

  useEffect(() => {
    if (!isOpen) return
    refreshPortfolio()

    const handleUpdate = () => refreshPortfolio()
    window.addEventListener('paperPortfolioUpdated', handleUpdate)
    return () => window.removeEventListener('paperPortfolioUpdated', handleUpdate)
  }, [isOpen])

  // ESC key dismiss
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Compute portfolio stats
  const stats = useMemo(() => {
    return calculatePortfolioStats(portfolio, livePricesMap)
  }, [portfolio, livePricesMap])

  // Selected signal data for new trade form
  const selectedSignal = useMemo(() => {
    return signals.find(s => s.symbol?.toUpperCase() === tradeSymbol?.toUpperCase()) || null
  }, [signals, tradeSymbol])

  const currentPriceForSelected = useMemo(() => {
    if (selectedSignal) {
      return Number(selectedSignal.current_price || selectedSignal.close_price || 100)
    }
    return livePricesMap[tradeSymbol?.toUpperCase()] || 100
  }, [selectedSignal, livePricesMap, tradeSymbol])

  // Auto-fill suggested TP / SL when selected signal changes
  useEffect(() => {
    if (selectedSignal && selectedSignal.golden_opportunity) {
      const g = selectedSignal.golden_opportunity
      if (g.target_price_num) setCustomTakeProfit(g.target_price_num.toString())
      if (g.stop_loss_num) setCustomStopLoss(g.stop_loss_num.toString())
    } else {
      const target = Number((currentPriceForSelected * 1.08).toFixed(2))
      const stop = Number((currentPriceForSelected * 0.96).toFixed(2))
      setCustomTakeProfit(target.toString())
      setCustomStopLoss(stop.toString())
    }
  }, [selectedSignal, currentPriceForSelected])

  // Calculate live dynamic Risk-to-Reward ratio
  const calculatedRR = useMemo(() => {
    const tp = Number(customTakeProfit)
    const sl = Number(customStopLoss)
    const entry = currentPriceForSelected
    if (tp > entry && sl > 0 && entry > sl) {
      const reward = tp - entry
      const risk = entry - sl
      if (risk > 0) {
        return (reward / risk).toFixed(2)
      }
    }
    return '2.00'
  }, [customTakeProfit, customStopLoss, currentPriceForSelected])

  // Execute a new simulated buy
  const handleExecuteBuy = (e) => {
    e?.preventDefault()
    setStatusMessage(null)

    const numAmount = parseFloat(tradeAmount)
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      setStatusMessage({
        type: 'ERROR',
        text: 'Please enter a valid investment amount.'
      })
      return
    }

    if (numAmount > portfolio.balance) {
      setStatusMessage({
        type: 'ERROR',
        text: `Insufficient cash. Available: $${portfolio.balance.toFixed(2)}`
      })
      return
    }

    const assetType = selectedSignal?.asset_type || (tradeSymbol.includes('-USD') ? 'Crypto' : 'Stock')
    const reason = selectedSignal?.golden_opportunity?.trade_setup_reason || 'Algorithmic Breakout Setup Execution'

    const res = openPosition({
      symbol: tradeSymbol,
      assetType,
      entryPrice: currentPriceForSelected,
      amount: numAmount,
      stopLoss: customStopLoss ? Number(customStopLoss) : null,
      takeProfit: customTakeProfit ? Number(customTakeProfit) : null,
      reason
    })

    if (res.success) {
      setStatusMessage({
        type: 'SUCCESS',
        text: `✅ Order Executed: Bought ${res.position.quantity} shares of ${res.position.symbol} at $${res.position.entryPrice.toFixed(2)}`
      })
      setActiveTab('POSITIONS')
      refreshPortfolio()
    } else {
      setStatusMessage({
        type: 'ERROR',
        text: res.message || 'Execution failed'
      })
    }
  }

  // Close an open position
  const handleClosePosition = (posId, sym) => {
    const liveP = livePricesMap[sym] || currentPriceForSelected
    const res = closePosition(posId, liveP)
    if (res.success) {
      const pnl = res.closedTrade.pnlDollar
      const pnlSign = pnl >= 0 ? '+' : ''
      setStatusMessage({
        type: 'SUCCESS',
        text: `🔔 Closed ${res.closedTrade.symbol} at $${res.closedTrade.exitPrice.toFixed(2)} | Realized P&L: ${pnlSign}$${pnl.toFixed(2)} (${res.closedTrade.pnlPercent}%)`
      })
      refreshPortfolio()
    }
  }

  // Reset portfolio to clean $6.00 starting capital
  const handleResetPortfolio = () => {
    if (window.confirm('Reset Live Tracker back to clean $6.00 capital? All open positions and history will be cleared.')) {
      resetPortfolio(6.00)
      setStatusMessage({ type: 'INFO', text: '🔄 Portfolio reset back to $6.00 cash' })
      setTradeAmount(1.50)
      refreshPortfolio()
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="pt-modal-root font-mono">
        {/* Backdrop */}
        <motion.div
          className="pt-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Modal Window Wrapper */}
        <div className="pt-modal-wrapper">
          <motion.div
            className="pt-card"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            {/* Header */}
            <div className="pt-header">
              <div className="pt-header-left">
                <div className="pt-icon-badge">
                  <Briefcase size={20} />
                </div>
                <div className="pt-title-wrap">
                  <div className="pt-title-row">
                    <h2 className="pt-title">Live Position Tracker & Trade Journal</h2>
                    <span 
                      className="pt-sim-tag"
                      style={{
                        background: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #10b981'
                      }}
                    >
                      🎯 REAL-TIME $6 ➔ $30 DESK
                    </span>
                  </div>
                  <p className="pt-sub">
                    Track your live real-time positions, unrealized P&L, stop-loss triggers, and compounding metrics.
                  </p>
                </div>
              </div>

              <div className="header-actions">
                <button
                  onClick={handleResetPortfolio}
                  className="pt-reset-btn"
                  title="Reset portfolio to $6.00 cash"
                >
                  <RefreshCw size={12} />
                  <span>Reset ($6.00)</span>
                </button>
                <button
                  onClick={onClose}
                  className="pt-close-btn"
                  title="Close Live Desk"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* KPI Stats HUD Bar */}
            <div className="pt-hud-grid">
              <div className="pt-metric-card">
                <span className="pt-metric-label">Total Net Equity</span>
                <span className="pt-metric-val">
                  ${stats.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className={`pt-metric-sub ${stats.allTimeRoiPercent >= 0 ? 'positive' : 'negative'}`}>
                  {stats.allTimeRoiPercent >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                  {stats.allTimeRoiPercent >= 0 ? '+' : ''}{stats.allTimeRoiPercent}% all-time
                </span>
              </div>

              <div className="pt-metric-card">
                <span className="pt-metric-label">Unrealized P&L</span>
                <span className={`pt-metric-val ${stats.unrealizedPnlDollar >= 0 ? 'positive' : 'negative'}`} style={{ color: stats.unrealizedPnlDollar >= 0 ? '#16a34a' : '#dc2626' }}>
                  {stats.unrealizedPnlDollar >= 0 ? '+' : ''}${stats.unrealizedPnlDollar.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="pt-metric-sub">
                  {stats.unrealizedPnlPercent >= 0 ? '+' : ''}{stats.unrealizedPnlPercent.toFixed(2)}% on open
                </span>
              </div>

              <div className="pt-metric-card">
                <span className="pt-metric-label">Cash Available</span>
                <span className="pt-metric-val">
                  ${stats.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="pt-metric-sub">
                  {((stats.balance / (stats.totalEquity || 1)) * 100).toFixed(0)}% liquid
                </span>
              </div>

              <div className="pt-metric-card">
                <span className="pt-metric-label">Win Rate</span>
                <span className="pt-metric-val">
                  {stats.winRate}%
                </span>
                <span className="pt-metric-sub">
                  {stats.wins}W - {stats.losses}L ({stats.totalClosed} closed)
                </span>
              </div>

              <div className="pt-metric-card">
                <span className="pt-metric-label">Trade Streak</span>
                <span className="pt-metric-val" style={{ color: stats.streakType === 'WIN' ? '#10b981' : stats.streakType === 'LOSS' ? '#ef4444' : '#94a3b8', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Flame size={15} />
                  <span>{stats.currentStreakBadge}</span>
                </span>
                <span className="pt-metric-sub">
                  Best: {stats.bestWinStreak} in a row • Avg: {stats.avgTradePnl >= 0 ? '+' : ''}${stats.avgTradePnl}
                </span>
              </div>
            </div>

            {/* Subtabs Bar */}
            <div className="pt-tabs-bar">
              <button
                onClick={() => setActiveTab('POSITIONS')}
                className={`pt-tab ${activeTab === 'POSITIONS' ? 'active' : ''}`}
              >
                <Zap size={13} />
                <span>Active Positions</span>
                <span className="pt-tab-badge">{portfolio.positions.length}</span>
              </button>

              <button
                onClick={() => setActiveTab('NEW_TRADE')}
                className={`pt-tab ${activeTab === 'NEW_TRADE' ? 'active' : ''}`}
              >
                <Plus size={13} />
                <span>Log Live Trade</span>
              </button>

              <button
                onClick={() => setActiveTab('HISTORY')}
                className={`pt-tab ${activeTab === 'HISTORY' ? 'active' : ''}`}
              >
                <Clock size={13} />
                <span>Trade History</span>
                <span className="pt-tab-badge">{portfolio.history.length}</span>
              </button>
            </div>

            {/* Notification Banner */}
            {statusMessage && (
              <div className={`pt-notice ${statusMessage.type.toLowerCase()}`}>
                <span>{statusMessage.text}</span>
                <button
                  onClick={() => setStatusMessage(null)}
                  className="pt-notice-close"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Modal Body Content */}
            <div className="pt-body">
              {/* TAB 1: ACTIVE POSITIONS */}
              {activeTab === 'POSITIONS' && (
                <div className="pt-pos-list">
                  {portfolio.positions.length === 0 ? (
                    <div className="empty-state">
                      <Briefcase className="empty-state-icon" />
                      <h3 className="empty-state-title">No Active Live Positions</h3>
                      <p className="empty-state-desc">
                        Log your active trades or copy trade orders to your broker to track real-time P&L against live market ticks.
                      </p>
                      <button
                        onClick={() => setActiveTab('NEW_TRADE')}
                        className="empty-state-btn"
                      >
                        + Log First Live Position
                      </button>
                    </div>
                  ) : (
                    portfolio.positions.map(pos => {
                      const liveP = livePricesMap[pos.symbol] || pos.entryPrice
                      const currentVal = pos.quantity * liveP
                      const pnlDol = currentVal - pos.totalCost
                      const pnlPct = pos.totalCost > 0 ? (pnlDol / pos.totalCost) * 100 : 0
                      const isProfit = pnlDol >= 0

                      // Progress towards Target vs Stop
                      let progressPct = 50
                      if (pos.stopLoss && pos.takeProfit && pos.takeProfit > pos.stopLoss) {
                        const range = pos.takeProfit - pos.stopLoss
                        progressPct = Math.min(100, Math.max(0, ((liveP - pos.stopLoss) / range) * 100))
                      }

                      return (
                        <div key={pos.id} className="pt-pos-card">
                          <div className="pt-pos-header">
                            <div className="pt-pos-identity">
                              <span className="pt-pos-symbol">{pos.symbol}</span>
                              <span className="pt-pos-asset-type">{pos.assetType}</span>
                              <span className="pt-pos-qty-info">
                                {pos.quantity < 1 ? Number(pos.quantity).toFixed(4) : pos.quantity} shares @ ${pos.entryPrice.toFixed(2)}
                              </span>
                            </div>
                            <button
                              onClick={() => handleClosePosition(pos.id, pos.symbol)}
                              className="pt-close-pos-btn"
                            >
                              Close Position
                            </button>
                          </div>

                          <div className="pt-pos-reason">
                            {pos.reason}
                          </div>

                          {pos.takeProfit && pos.stopLoss && (
                            <div className="pt-pos-tp-sl-bar">
                              <span className="pt-sl-lbl">
                                <ShieldCheck size={12} /> Stop: ${pos.stopLoss.toFixed(2)}
                              </span>
                              <div className="pt-bar-track">
                                <div
                                  className={`pt-bar-fill ${isProfit ? 'profit' : 'loss'}`}
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                              <span className="pt-tp-lbl">
                                <Target size={12} /> Target: ${pos.takeProfit.toFixed(2)}
                              </span>
                            </div>
                          )}

                          <div className="pt-pos-bottom">
                            <div className="pt-pos-val-group">
                              <div className="pt-pos-live-p">
                                Market Price: <strong style={{ color: '#0f172a' }}>${liveP.toFixed(2)}</strong>
                              </div>
                              <div className="pt-pos-live-p">
                                Position Value: <strong style={{ color: '#0f172a' }}>${currentVal.toFixed(2)}</strong>
                              </div>
                            </div>

                            <div className={`pt-pos-pnl-val ${isProfit ? 'profit' : 'loss'}`}>
                              {isProfit ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                              {isProfit ? '+' : ''}${pnlDol.toFixed(2)} ({isProfit ? '+' : ''}{pnlPct.toFixed(2)}%)
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* TAB 2: TRADE HISTORY */}
              {activeTab === 'HISTORY' && (
                <div>
                  {portfolio.history.length === 0 ? (
                    <div className="empty-state">
                      <Clock className="empty-state-icon" />
                      <h3 className="empty-state-title">No Closed Trades Yet</h3>
                      <p className="empty-state-desc">
                        When you close an active position, its realized P&L, timestamps, and return track record will show here.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Streak & Export Action Bar */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px',
                        padding: '10px 14px',
                        marginBottom: '12px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 10px',
                            borderRadius: '4px',
                            background: stats.streakType === 'WIN' ? 'rgba(16, 185, 129, 0.18)' : stats.streakType === 'LOSS' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(255,255,255,0.06)',
                            border: `1px solid ${stats.streakType === 'WIN' ? '#10b981' : stats.streakType === 'LOSS' ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
                            color: stats.streakType === 'WIN' ? '#10b981' : stats.streakType === 'LOSS' ? '#ef4444' : '#94a3b8',
                            fontWeight: 800,
                            fontSize: '0.80rem'
                          }}>
                            <Flame size={14} />
                            <span>{stats.currentStreakBadge}</span>
                          </div>

                          <div style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span>🏆 Best Streak: <strong style={{ color: '#10b981' }}>{stats.bestWinStreak} in a row</strong></span>
                            <span>•</span>
                            <span>Win Rate: <strong style={{ color: '#f8fafc' }}>{stats.winRate}%</strong></span>
                            <span>•</span>
                            <span>Avg Trade: <strong style={{ color: stats.avgTradePnl >= 0 ? '#10b981' : '#ef4444' }}>{stats.avgTradePnl >= 0 ? '+' : ''}${stats.avgTradePnl}</strong></span>
                          </div>
                        </div>

                        <button
                          onClick={() => exportPortfolioHistoryToCSV(portfolio)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            borderRadius: '5px',
                            background: 'rgba(2, 132, 199, 0.18)',
                            border: '1px solid rgba(2, 132, 199, 0.4)',
                            color: '#38bdf8',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          title="Export complete closed trade ledger to CSV spreadsheet"
                        >
                          <Download size={13} />
                          <span>Export CSV Ledger ({portfolio.history.length} Trades)</span>
                        </button>
                      </div>

                      <div className="pt-table-wrap">
                      <table className="pt-table">
                        <thead>
                          <tr>
                            <th>Asset</th>
                            <th>Entry Date</th>
                            <th>Exit Date</th>
                            <th>Entry → Exit</th>
                            <th>Quantity</th>
                            <th style={{ textAlign: 'right' }}>Realized P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {portfolio.history.map(trade => {
                            const isWin = trade.pnlDollar >= 0
                            return (
                              <tr key={trade.id}>
                                <td>
                                  <div className="sym-cell">
                                    <span style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      background: isWin ? '#10b981' : '#ef4444'
                                    }} />
                                    <span>{trade.symbol}</span>
                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>({trade.assetType})</span>
                                  </div>
                                </td>
                                <td style={{ color: '#64748b' }}>
                                  {new Date(trade.entryDate).toLocaleDateString()}
                                </td>
                                <td style={{ color: '#64748b' }}>
                                  {new Date(trade.exitDate).toLocaleDateString()}
                                </td>
                                <td style={{ fontWeight: 700 }}>
                                  ${trade.entryPrice.toFixed(2)} → ${trade.exitPrice.toFixed(2)}
                                </td>
                                <td style={{ color: '#64748b' }}>
                                  {trade.quantity < 1 ? Number(trade.quantity).toFixed(4) : trade.quantity}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <span className={`pt-pnl-pill ${isWin ? 'profit' : 'loss'}`}>
                                    {isWin ? '+' : ''}${trade.pnlDollar.toFixed(2)} ({isWin ? '+' : ''}{trade.pnlPercent}%)
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: SIMULATE NEW TRADE */}
              {activeTab === 'NEW_TRADE' && (
                <form onSubmit={handleExecuteBuy} className="pt-trade-form">
                  <div className="pt-form-card">
                    <span className="pt-form-card-title">Setup Parameters</span>

                    {/* Target Asset Selector */}
                    <div className="form-group">
                      <label className="form-label">Target Asset</label>
                      <select
                        value={tradeSymbol}
                        onChange={(e) => setTradeSymbol(e.target.value)}
                        className="pt-select"
                      >
                        {signals.map(s => (
                          <option key={s.symbol} value={s.symbol}>
                            {s.symbol} — ${Number(s.current_price || s.close_price).toFixed(2)} ({s.asset_type || 'Stock'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Live Quote Preview */}
                    <div className="pt-quote-preview-box">
                      <div className="pt-quote-price-col">
                        <span className="pt-quote-lbl">Current Market Price</span>
                        <span className="pt-quote-val">${currentPriceForSelected.toFixed(2)}</span>
                      </div>
                      {selectedSignal?.golden_opportunity ? (
                        <div style={{ textAlign: 'right' }}>
                          <span className="pt-quote-lbl">Conviction Score</span>
                          <div style={{ color: '#059669', fontWeight: 800, fontSize: '0.875rem' }}>
                            {selectedSignal.golden_opportunity.conviction_score}% (Golden Opportunity)
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'right' }}>
                          <span className="pt-quote-lbl">Asset Type</span>
                          <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.875rem' }}>
                            {selectedSignal?.asset_type || 'Stock / Equity'}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Capital Allocation */}
                    <div className="form-group">
                      <label className="form-label">Capital Allocation ($ USD)</label>
                      <div className="pt-quick-amounts">
                        {portfolio.balance <= 50 ? (
                          [
                            { label: '25%', val: Number((portfolio.balance * 0.25).toFixed(2)) },
                            { label: '50%', val: Number((portfolio.balance * 0.50).toFixed(2)) },
                            { label: '75%', val: Number((portfolio.balance * 0.75).toFixed(2)) },
                            { label: 'Max', val: Number(portfolio.balance.toFixed(2)) }
                          ].map(item => (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => setTradeAmount(String(item.val))}
                              className={`pt-quick-btn ${tradeAmount === String(item.val) ? 'active' : ''}`}
                            >
                              {item.label} (${item.val})
                            </button>
                          ))
                        ) : (
                          <>
                            {[500, 1000, 2500, 5000].map(amt => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => setTradeAmount(String(amt))}
                                className={`pt-quick-btn ${tradeAmount === String(amt) ? 'active' : ''}`}
                              >
                                ${amt.toLocaleString()}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setTradeAmount(String(Number(portfolio.balance.toFixed(2))))}
                              className={`pt-quick-btn ${tradeAmount === String(Number(portfolio.balance.toFixed(2))) ? 'active' : ''}`}
                            >
                              Max (${Math.floor(portfolio.balance).toLocaleString()})
                            </button>
                          </>
                        )}
                      </div>

                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={tradeAmount}
                          onChange={(e) => {
                            let val = e.target.value
                            if (val === '') {
                              setTradeAmount('')
                              return
                            }
                            if (!/^\d*\.?\d*$/.test(val)) return
                            if (/^0[0-9]+/.test(val)) {
                              val = val.replace(/^0+/, '')
                            }
                            setTradeAmount(val)
                          }}
                          className={`pt-input ${parseFloat(tradeAmount) > portfolio.balance ? 'border-red-500' : ''}`}
                          placeholder={portfolio.balance <= 50 ? "e.g. 1.50" : "e.g. 1000"}
                          style={{
                            borderColor: parseFloat(tradeAmount) > portfolio.balance ? '#ef4444' : undefined,
                            boxShadow: parseFloat(tradeAmount) > portfolio.balance ? '0 0 0 1px #ef4444' : undefined
                          }}
                        />
                      </div>

                      {/* Exceeds cash warning */}
                      {parseFloat(tradeAmount) > portfolio.balance && (
                        <div style={{ color: '#dc2626', fontSize: '0.72rem', marginTop: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span>⚠️ Amount (${parseFloat(tradeAmount).toFixed(2)}) exceeds available cash.</span>
                          <button
                            type="button"
                            onClick={() => setTradeAmount(String(Number(portfolio.balance.toFixed(2))))}
                            style={{ textDecoration: 'underline', background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontWeight: 700 }}
                          >
                            Set to Max (${portfolio.balance.toFixed(2)})
                          </button>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: '#64748b', marginTop: '0.35rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span>Available Cash: ${portfolio.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const deposit = window.prompt('Deposit virtual cash into your desk ($ USD):', '100')
                              if (deposit && !isNaN(deposit) && Number(deposit) > 0) {
                                addFunds(Number(deposit))
                                refreshPortfolio()
                                setStatusMessage({ type: 'SUCCESS', text: `💵 Added +$${Number(deposit).toFixed(2)} to your virtual desk!` })
                              }
                            }}
                            style={{
                              background: '#ecfdf5',
                              color: '#047857',
                              border: '1px solid #10b981',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.675rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                            title="Add funds to practice trading"
                          >
                            + Add Cash
                          </button>
                        </div>
                        <span>
                          Estimated Shares: {currentPriceForSelected > 0 && parseFloat(tradeAmount) > 0 ? (
                            parseFloat(tradeAmount) / currentPriceForSelected < 1
                              ? (parseFloat(tradeAmount) / currentPriceForSelected).toFixed(4)
                              : (parseFloat(tradeAmount) / currentPriceForSelected).toFixed(2)
                          ) : '0'}
                        </span>
                      </div>
                    </div>

                    {/* Take-Profit & Stop-Loss */}
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#16a34a' }}>
                          Take-Profit Target ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={customTakeProfit}
                          onChange={(e) => setCustomTakeProfit(e.target.value)}
                          className="pt-input"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ color: '#dc2626' }}>
                          Stop-Loss Level ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={customStopLoss}
                          onChange={(e) => setCustomStopLoss(e.target.value)}
                          className="pt-input"
                        />
                      </div>
                    </div>

                    {/* Calculated Risk-to-Reward Ratio Strip */}
                    <div className="pt-rr-preview-strip">
                      <span style={{ color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Scale size={14} style={{ color: '#059669' }} />
                        Calculated Risk-to-Reward
                      </span>
                      <span className="pt-rr-val">1 : {calculatedRR}</span>
                    </div>
                  </div>

                  {/* Execution CTA Button */}
                  <button
                    type="submit"
                    disabled={tradeAmount > portfolio.balance || tradeAmount <= 0}
                    className="pt-submit-btn"
                  >
                    <Zap size={16} />
                    <span>Log & Track Live Position (${tradeAmount.toLocaleString()})</span>
                  </button>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-footer">
              <span>Real-time trade ledger & position tracking against live market ticks.</span>
              <button onClick={onClose} className="pt-done-btn">
                Close Desk
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  )
}
