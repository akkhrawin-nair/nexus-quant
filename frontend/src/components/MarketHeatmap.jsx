import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpRight, ArrowDownRight, Activity, Zap, TrendingUp, TrendingDown, Eye } from 'lucide-react'

// Relative weighting map for FinViz/Coin360 treemap proportions
const TICKER_WEIGHTS = {
  'BTC-USD': 3.5,
  'ETH-USD': 2.8,
  'SOL-USD': 2.0,
  'NVDA': 3.5,
  'QQQ': 3.0,
  'SPY': 3.0,
  'AAPL': 2.8,
  'MSFT': 2.8,
  'TSLA': 2.5,
  'META': 2.2,
  'AMD': 2.0,
  'PLTR': 1.8,
  'GLD': 2.0,
  'USO': 1.8,
  'EOSE': 1.6,
}

const getAssetCategory = (type = '', symbol = '') => {
  const lower = (type || '').toLowerCase()
  const sym = (symbol || '').toUpperCase()

  if (lower.includes('crypto') || sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL')) {
    return 'Crypto Universe'
  }
  if (lower.includes('commodity') || sym === 'GLD' || sym === 'USO') {
    return 'Commodities & Metals'
  }
  return 'US Equities & Tech'
}

const getHeatmapColor = (pct = 0) => {
  const num = parseFloat(pct)
  if (isNaN(num)) return { bg: 'linear-gradient(135deg, #64748b, #94a3b8)', text: '#ffffff', border: '#475569' }

  if (num >= 3.0) {
    return {
      bg: 'linear-gradient(135deg, #047857 0%, #10b981 100%)',
      text: '#ffffff',
      border: '#059669',
      badgeBg: 'rgba(255, 255, 255, 0.25)',
      glow: 'rgba(16, 185, 129, 0.4)'
    }
  }
  if (num > 0) {
    return {
      bg: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
      text: '#ffffff',
      border: '#10b981',
      badgeBg: 'rgba(255, 255, 255, 0.22)',
      glow: 'rgba(52, 211, 153, 0.35)'
    }
  }
  if (num === 0) {
    return {
      bg: 'linear-gradient(135deg, #475569 0%, #64748b 100%)',
      text: '#ffffff',
      border: '#64748b',
      badgeBg: 'rgba(255, 255, 255, 0.18)',
      glow: 'rgba(100, 116, 139, 0.3)'
    }
  }
  if (num > -3.0) {
    return {
      bg: 'linear-gradient(135deg, #dc2626 0%, #f87171 100%)',
      text: '#ffffff',
      border: '#ef4444',
      badgeBg: 'rgba(255, 255, 255, 0.22)',
      glow: 'rgba(248, 113, 113, 0.35)'
    }
  }
  return {
    bg: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)',
    text: '#ffffff',
    border: '#b91c1c',
    badgeBg: 'rgba(255, 255, 255, 0.25)',
    glow: 'rgba(220, 38, 38, 0.4)'
  }
}

export default function MarketHeatmap({ signals = [], signalType = 'buy', onSelectAsset }) {
  const [hoveredSymbol, setHoveredSymbol] = useState(null)

  // Group signals by asset category
  const categoriesMap = {}
  signals.forEach(item => {
    const cat = getAssetCategory(item.asset_type, item.symbol)
    if (!categoriesMap[cat]) categoriesMap[cat] = []
    categoriesMap[cat].push(item)
  })

  const categoryKeys = Object.keys(categoriesMap)

  return (
    <motion.div
      className="heatmap-container"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Heatmap Legend Bar */}
      <div className="heatmap-legend-bar">
        <div className="legend-left">
          <Activity size={14} className="legend-icon" />
          <span className="legend-title">FINVIZ // MARKET INTENSITY TREEMAP</span>
          <span className="legend-sub">Sized by market weight • Colored by 24h Return</span>
        </div>
        <div className="legend-gradient-scale">
          <span className="scale-label neg">-3.0%+</span>
          <div className="scale-bar"></div>
          <span className="scale-label pos">+3.0%+</span>
        </div>
      </div>

      {/* Heatmap Categories Layout Grid */}
      <div className="heatmap-categories-grid">
        {categoryKeys.map(categoryName => {
          const categoryAssets = categoriesMap[categoryName]

          return (
            <div key={categoryName} className="heatmap-category-group">
              <div className="category-header">
                <span className="category-title">{categoryName}</span>
                <span className="category-count">{categoryAssets.length} Assets</span>
              </div>

              <div className="heatmap-tiles-flex">
                {categoryAssets.map(asset => {
                  const symbol = asset.symbol || 'N/A'
                  const rawPct = asset.daily_change_pct !== undefined ? asset.daily_change_pct : asset.percent_change
                  const pctVal = parseFloat(rawPct) || 0
                  const isPositive = pctVal >= 0
                  const colorScheme = getHeatmapColor(pctVal)
                  const weight = TICKER_WEIGHTS[symbol] || 2.0
                  const rawPriceStr = String(asset.current_price !== undefined ? asset.current_price : (asset.close_price || 0)).replace(/[^0-9.-]/g, '')
                  const price = parseFloat(rawPriceStr) || 0

                  const isHovered = hoveredSymbol === symbol

                  return (
                    <motion.div
                      key={symbol}
                      className="heatmap-tile"
                      style={{
                        flexGrow: weight,
                        flexBasis: `${weight * 70}px`,
                        background: colorScheme.bg,
                        color: colorScheme.text,
                        borderColor: colorScheme.border,
                      }}
                      whileHover={{
                        scale: 1.025,
                        zIndex: 20,
                        boxShadow: `0 12px 28px -4px ${colorScheme.glow}`,
                      }}
                      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                      onMouseEnter={() => setHoveredSymbol(symbol)}
                      onMouseLeave={() => setHoveredSymbol(null)}
                      onClick={() => onSelectAsset && onSelectAsset(asset)}
                    >
                      <div className="tile-content">
                        <div className="tile-top-row">
                          <span className="tile-symbol">{symbol}</span>
                          <span className="tile-type-pill" style={{ background: colorScheme.badgeBg }}>
                            {asset.asset_type || 'Asset'}
                          </span>
                        </div>

                        <div className="tile-center-price">
                          ${price > 1000 ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : price.toFixed(2)}
                        </div>

                        <div className="tile-bottom-pct">
                          <span className="pct-pill" style={{ background: colorScheme.badgeBg }}>
                            {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                            <span>{isPositive ? '+' : ''}{pctVal.toFixed(2)}%</span>
                          </span>
                        </div>
                      </div>

                      {/* Interactive Hover Micro Tooltip */}
                      <AnimatePresence>
                        {isHovered && (
                          <motion.div
                            className="heatmap-tile-tooltip"
                            initial={{ opacity: 0, y: 6, scale: 0.94 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.94 }}
                            transition={{ duration: 0.15 }}
                          >
                            <div className="tooltip-header">
                              <span className="tt-symbol">{symbol}</span>
                              <span className="tt-mode">{signalType.toUpperCase()} SIGNAL</span>
                            </div>
                            <div className="tooltip-row">
                              <span>MACD:</span>
                              <span className="tt-mono">{(parseFloat(asset.macd) || 0).toFixed(4)}</span>
                            </div>
                            <div className="tooltip-row">
                              <span>Signal Date:</span>
                              <span className="tt-mono">{asset.signal_trigger_date || asset.signal_date || 'Live'}</span>
                            </div>
                            <div className="tooltip-footer">
                              <Eye size={11} />
                              <span>Click to inspect sheet</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
