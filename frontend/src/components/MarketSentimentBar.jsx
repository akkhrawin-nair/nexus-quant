import { useState, useEffect } from 'react'
import { Activity, Flame, TrendingUp, TrendingDown, Newspaper, ExternalLink } from 'lucide-react'

export default function MarketSentimentBar({ onOpenModal, API_BASE_URL = 'http://127.0.0.1:8000' }) {
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
        score: 0.88
      },
      {
        id: 2,
        symbol: 'BTC-USD',
        title: 'Bitcoin consolidates firmly with massive institutional ETF net inflows',
        source: 'CoinDesk Quantitative',
        time: '25 mins ago',
        sentiment: 'BULLISH',
        score: 0.92
      },
      {
        id: 3,
        symbol: 'QQQ',
        title: 'Fed signals potential rate cuts as core PCE inflation cools to 2.1%',
        source: 'Reuters Finance',
        time: '42 mins ago',
        sentiment: 'BULLISH',
        score: 0.75
      },
      {
        id: 4,
        symbol: 'TSLA',
        title: 'Tesla Robotaxi regulatory approval delayed in European markets',
        source: 'Financial Times',
        time: '1 hour ago',
        sentiment: 'BEARISH',
        score: -0.64
      },
      {
        id: 5,
        symbol: 'EOSE',
        title: 'Eos Energy secures multi-gigawatt utility battery storage orders and accelerates production ramp',
        source: 'Reuters Clean Energy',
        time: '35 mins ago',
        sentiment: 'BULLISH',
        score: 0.86
      }
    ]
  })

  useEffect(() => {
    async function fetchSentiment() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sentiment/`)
        if (res.ok) {
          const data = await res.json()
          setSentimentData(data)
        }
      } catch (err) {
        // Fallback to initial state if API is offline
      }
    }
    fetchSentiment()
    const interval = setInterval(fetchSentiment, 30000)
    return () => clearInterval(interval)
  }, [API_BASE_URL])

  const score = sentimentData.fear_greed_score || 74
  const label = sentimentData.fear_greed_label || 'Greed'

  const scoreColor = score >= 75 ? '#059669' : score >= 55 ? '#10b981' : score >= 45 ? '#eab308' : score >= 25 ? '#f97316' : '#ef4444'

  return (
    <div className="sentiment-bar-root" onClick={onOpenModal} title="Click to view Live Financial News & Sentiment Breakdown">
      {/* Left: Fear & Greed Dial Pill */}
      <div className="fg-dial-pill font-mono">
        <div className="fg-badge font-mono" style={{ background: scoreColor }}>
          <Flame size={12} />
          <span>{score}</span>
        </div>
        <div className="fg-info">
          <span className="fg-label">{label.toUpperCase()}</span>
          <span className="fg-sub">FEAR & GREED</span>
        </div>
      </div>

      {/* Center: Continuous Marquee Scrolling News Stream */}
      <div className="news-marquee-viewport">
        <div className="news-marquee-track">
          {[...sentimentData.news, ...sentimentData.news].map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="news-marquee-item">
              <span className="news-symbol font-mono">{item.symbol}</span>
              <span className="news-title">{item.title}</span>
              <span className={`news-tag font-mono ${item.sentiment.toLowerCase()}`}>
                {item.sentiment === 'BULLISH' ? <TrendingUp size={11} /> : item.sentiment === 'BEARISH' ? <TrendingDown size={11} /> : <Activity size={11} />}
                {item.sentiment} ({item.score > 0 ? `+${item.score}` : item.score})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Inspection CTA Button */}
      <div className="sentiment-cta font-mono">
        <Newspaper size={13} />
        <span>NLP News Feed</span>
        <ExternalLink size={11} />
      </div>
    </div>
  )
}
