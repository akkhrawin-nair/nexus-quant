import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Search, Loader2, Sparkles, TrendingUp, Layers } from 'lucide-react'

const SUGGESTED_TICKERS = [
  { symbol: 'AAPL', name: 'Apple Inc', type: 'US Equity' },
  { symbol: 'MSFT', name: 'Microsoft', type: 'US Equity' },
  { symbol: 'AMZN', name: 'Amazon.com', type: 'US Equity' },
  { symbol: 'GOOGL', name: 'Alphabet Inc', type: 'US Equity' },
  { symbol: 'NVDA', name: 'NVIDIA Corp', type: 'US Equity' },
  { symbol: 'TSLA', name: 'Tesla Inc', type: 'US Equity' },
  { symbol: 'AMD', name: 'Advanced Micro', type: 'US Equity' },
  { symbol: 'PLTR', name: 'Palantir Tech', type: 'US Equity' },
  { symbol: 'META', name: 'Meta Platforms', type: 'US Equity' },
  { symbol: 'NFLX', name: 'Netflix Inc', type: 'US Equity' },
  { symbol: 'AVGO', name: 'Broadcom Inc', type: 'US Equity' },
  { symbol: 'COIN', name: 'Coinbase Global', type: 'US Equity' },
  { symbol: 'MSTR', name: 'MicroStrategy', type: 'US Equity' },
  { symbol: 'QQQ', name: 'Invesco QQQ ETF', type: 'US Equity' },
  { symbol: 'SPY', name: 'SPDR S&P 500', type: 'US Equity' },
  { symbol: 'GLD', name: 'SPDR Gold Shares', type: 'Commodity' },
  { symbol: 'BTC-USD', name: 'Bitcoin', type: 'Crypto' },
  { symbol: 'ETH-USD', name: 'Ethereum', type: 'Crypto' },
  { symbol: 'SOL-USD', name: 'Solana', type: 'Crypto' },
  { symbol: 'XRP-USD', name: 'Ripple', type: 'Crypto' },
  { symbol: 'TSM', name: 'Taiwan Semi', type: 'US Equity' },
  { symbol: 'JPM', name: 'JPMorgan Chase', type: 'US Equity' },
  { symbol: 'LLY', name: 'Eli Lilly', type: 'US Equity' },
  { symbol: 'HOOD', name: 'Robinhood Markets', type: 'US Equity' },
  { symbol: 'TLT', name: '20+ Yr Treasury ETF', type: 'ETF' },
  { symbol: 'EOSE', name: 'Eos Energy Enterprises', type: 'US Equity' },
]

export default function AddTickerModal({ isOpen, onClose, onAddTicker, isSubmitting = false }) {
  const [tickerInput, setTickerInput] = useState('')
  const [assetClass, setAssetClass] = useState('US Equity')
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    const symbol = tickerInput.trim().toUpperCase()
    if (!symbol) {
      setErrorMsg('Please enter a ticker symbol.')
      return
    }

    setErrorMsg('')
    try {
      await onAddTicker(symbol, assetClass)
      setTickerInput('')
      onClose()
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add ticker symbol.')
    }
  }

  const handleChipClick = (item) => {
    setTickerInput(item.symbol)
    setAssetClass(item.type)
    setErrorMsg('')
  }

  return (
    <AnimatePresence>
      <div className="add-modal-overlay" onClick={onClose}>
        <motion.div
          className="add-modal-card"
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="add-modal-header">
            <div className="add-modal-title">
              <Plus size={16} className="modal-title-icon" />
              <span>INGEST NEW MARKET TICKER</span>
            </div>
            <button className="modal-close-btn" onClick={onClose}>
              <X size={15} />
            </button>
          </div>

          <p className="add-modal-desc">
            Add any stock, ETF, commodity, or crypto ticker. Yahoo Finance will be queried to ingest OHLC history and compute live indicators.
          </p>

          <form onSubmit={handleSubmit} className="add-modal-form">
            {/* Ticker Input Box */}
            <div className="modal-input-group">
              <Search size={14} className="input-search-icon" />
              <input
                type="text"
                className="modal-ticker-input"
                placeholder="Enter symbol (e.g. AMZN, GOOGL, COIN, GLD...)"
                value={tickerInput}
                onChange={(e) => {
                  setTickerInput(e.target.value.toUpperCase())
                  setErrorMsg('')
                }}
                autoFocus
                disabled={isSubmitting}
              />
              {tickerInput && (
                <button
                  type="button"
                  className="input-clear-btn"
                  onClick={() => setTickerInput('')}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Asset Class Selector Pills */}
            <div className="modal-class-row">
              <span className="class-label">ASSET CLASS:</span>
              <div className="class-pills">
                {['US Equity', 'Crypto', 'Commodity'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`class-pill ${assetClass === type ? 'active' : ''}`}
                    onClick={() => setAssetClass(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="modal-chips-container">
              <span className="chips-title">POPULAR SUGGESTIONS:</span>
              <div className="chips-flex">
                {SUGGESTED_TICKERS.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    className={`chip-btn ${tickerInput === item.symbol ? 'selected' : ''}`}
                    onClick={() => handleChipClick(item)}
                    disabled={isSubmitting}
                  >
                    <span>+ {item.symbol}</span>
                    <span className="chip-type">{item.type}</span>
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && <div className="modal-error-box">{errorMsg}</div>}

            {/* Modal Actions */}
            <div className="modal-footer-actions">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="modal-submit-btn"
                disabled={isSubmitting || !tickerInput.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Fetching yfinance Data...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Track Asset Now</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
