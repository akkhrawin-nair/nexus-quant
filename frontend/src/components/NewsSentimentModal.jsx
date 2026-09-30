import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Newspaper,
  X,
  TrendingUp,
  TrendingDown,
  Activity,
  Flame,
  ExternalLink,
  Filter,
  Sparkles
} from 'lucide-react'

export default function NewsSentimentModal({
  isOpen = false,
  onClose,
  initialAsset = 'ALL',
  API_BASE_URL = 'http://127.0.0.1:8000'
}) {
  const [selectedAsset, setSelectedAsset] = useState(initialAsset || 'ALL')

  useEffect(() => {
    if (isOpen && initialAsset) {
      setSelectedAsset(initialAsset)
    }
  }, [isOpen, initialAsset])
  const [sentimentData, setSentimentData] = useState({
    fear_greed_score: 74,
    fear_greed_label: 'Greed',
    news: [
      {
        id: 1,
        symbol: 'NVDA',
        title: 'NVIDIA Blackwell GPU shipments surge +14% QoQ as hyperscalers expand AI clusters',
        source: 'Bloomberg Markets',
        time: '12 mins ago',
        sentiment: 'BULLISH',
        score: 0.88,
        url: 'https://www.bloomberg.com'
      },
      {
        id: 2,
        symbol: 'BTC-USD',
        title: 'Bitcoin consolidates firmly following record institutional ETF net inflows',
        source: 'CoinDesk Quantitative',
        time: '25 mins ago',
        sentiment: 'BULLISH',
        score: 0.92,
        url: 'https://www.coindesk.com'
      },
      {
        id: 3,
        symbol: 'QQQ',
        title: 'Fed signals rate path stability as core PCE inflation cools to 2.1%',
        source: 'Reuters Finance',
        time: '42 mins ago',
        sentiment: 'BULLISH',
        score: 0.75,
        url: 'https://www.reuters.com'
      },
      {
        id: 4,
        symbol: 'TSLA',
        title: 'Tesla Robotaxi commercial expansion advances in major metropolitan markets',
        source: 'Financial Times',
        time: '1 hour ago',
        sentiment: 'BULLISH',
        score: 0.72,
        url: 'https://www.ft.com'
      },
      {
        id: 5,
        symbol: 'GLD',
        title: 'Gold holds record high territory as central bank reserve diversification accelerates',
        source: 'WSJ Commodities',
        time: '2 hours ago',
        sentiment: 'BULLISH',
        score: 0.81,
        url: 'https://www.wsj.com'
      },
      {
        id: 6,
        symbol: 'USO',
        title: 'Crude trades steady as OPEC+ maintains strict global supply discipline',
        source: 'Energy Intelligence',
        time: '3 hours ago',
        sentiment: 'NEUTRAL',
        score: 0.12,
        url: 'https://www.reuters.com'
      },
      {
        id: 7,
        symbol: 'EOSE',
        title: 'Eos Energy secures multi-gigawatt utility battery storage orders and accelerates production ramp',
        source: 'Reuters Clean Energy',
        time: '35 mins ago',
        sentiment: 'BULLISH',
        score: 0.86,
        url: 'https://www.reuters.com'
      }
    ]
  })

  // ESC Key Listener
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    async function fetchSentiment() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sentiment/`)
        if (res.ok) {
          const data = await res.json()
          setSentimentData(data)
        }
      } catch (err) {
        // Fallback
      }
    }
    if (isOpen) fetchSentiment()
  }, [isOpen, API_BASE_URL])

  const filteredNews = useMemo(() => {
    if (selectedAsset === 'ALL') return sentimentData.news
    return (sentimentData.news || []).filter(n => n.symbol === selectedAsset)
  }, [selectedAsset, sentimentData])

  const sentimentStats = useMemo(() => {
    const list = filteredNews
    if (list.length === 0) return { bullishPct: 50, bearishPct: 50, avgScore: 0 }
    const bullish = list.filter(n => n.sentiment === 'BULLISH').length
    const bearish = list.filter(n => n.sentiment === 'BEARISH').length
    const total = list.length
    const avg = list.reduce((sum, n) => sum + n.score, 0) / total

    return {
      bullishPct: Math.round((bullish / total) * 100),
      bearishPct: Math.round((bearish / total) * 100),
      avgScore: parseFloat(avg.toFixed(2))
    }
  }, [filteredNews])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="news-modal-root">
          {/* Backdrop */}
          <motion.div
            className="news-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Modal Card */}
          <div className="news-modal-wrapper">
            <motion.div
              className="news-card"
              initial={{ opacity: 0, scale: 0.96, y: -15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -15 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              {/* Header Bar */}
              <div className="news-header">
                <div className="header-title-group">
                  <div className="news-icon-badge">
                    <Newspaper size={18} />
                  </div>
                  <div>
                    <h2 className="news-title">Live Financial News & NLP Sentiment Breakdown</h2>
                    <p className="news-sub">Real-time NLP sentiment analysis across equities, crypto, and commodities</p>
                  </div>
                </div>

                <button className="news-close-btn" onClick={onClose} title="Close (ESC)">
                  <X size={18} />
                </button>
              </div>

              {/* Sentiment Summary Bar & Slicer */}
              <div className="news-filter-bar">
                <div className="filter-pill-group">
                  {['ALL', 'NVDA', 'BTC-USD', 'QQQ', 'TSLA', 'GLD', 'USO', 'EOSE'].map(sym => (
                    <button
                      key={sym}
                      className={`filter-pill ${selectedAsset === sym ? 'active' : ''}`}
                      onClick={() => setSelectedAsset(sym)}
                    >
                      {sym}
                    </button>
                  ))}
                </div>

                {/* Sentiment Distribution Bar */}
                <div className="sentiment-meter-group font-mono">
                  <span className="meter-label">NLP Sentiment:</span>
                  <div className="meter-bar">
                    <div className="meter-fill bullish" style={{ width: `${sentimentStats.bullishPct}%` }} />
                    <div className="meter-fill bearish" style={{ width: `${sentimentStats.bearishPct}%` }} />
                  </div>
                  <span className="meter-val">{sentimentStats.bullishPct}% Bullish</span>
                </div>
              </div>

              {/* News Items List */}
              <div className="news-body">
                <div className="news-list">
                  {filteredNews.map(item => (
                    <div key={item.id} className="news-card-item">
                      <div className="news-item-top">
                        <div className="news-sym-badge font-mono">{item.symbol}</div>
                        <span className={`news-tag font-mono ${item.sentiment.toLowerCase()}`}>
                          {item.sentiment === 'BULLISH' ? <TrendingUp size={11} /> : item.sentiment === 'BEARISH' ? <TrendingDown size={11} /> : <Activity size={11} />}
                          {item.sentiment} ({item.score > 0 ? `+${item.score}` : item.score})
                        </span>
                      </div>

                      <h3 className="news-item-title">{item.title}</h3>

                      <div className="news-item-footer font-mono">
                        <span className="news-source">{item.source} • {item.time}</span>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="news-link"
                        >
                          Read Article <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="news-footer">
                <span className="footer-brand font-mono">KAPPA // NLP SENTIMENT INTELLIGENCE</span>
                <button className="news-done-btn" onClick={onClose}>
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
