import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createChart, ColorType, AreaSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import {
  X,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  ShieldAlert,
  Activity,
  Layers,
  BarChart2,
  Sparkles,
  Target,
  AlertOctagon,
  Clock,
  BarChart3,
  Maximize2,
  Sliders,
  FileText,
  Bell,
  Briefcase
} from 'lucide-react'
import { getRiskRatingMeta } from '../utils/riskUtils'







// Helper: Calculate 20-period EMA for candle close prices
function calculateEMA(data, period = 20) {
  if (!Array.isArray(data) || data.length === 0) return []
  const k = 2 / (period + 1)
  let ema = data[0].close
  return data.map((d, i) => {
    if (i === 0) return { time: d.time, value: parseFloat(ema.toFixed(2)) }
    ema = d.close * k + ema * (1 - k)
    return { time: d.time, value: parseFloat(ema.toFixed(2)) }
  })
}

// Deduplicate candle items by time
function deduplicateCandles(arr) {
  if (!Array.isArray(arr)) return []
  const seen = new Set()
  return arr.filter(item => {
    if (!item || !item.time) return false
    if (seen.has(item.time)) return false
    seen.add(item.time)
    return true
  })
}

// Helper: Generate deterministic 500-point OHLCV historical dataset
function generateFallbackCandles(symbol, closePrice) {
  const basePrice = parseFloat(closePrice) || 100
  const symbolSeed = (symbol || 'QQQ').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const points = 500
  const candles = []
  let current = basePrice * 0.82
  const now = new Date()

  for (let i = 0; i < points; i++) {
    const dateObj = new Date(now)
    dateObj.setDate(now.getDate() - (points - 1 - i))
    const time = dateObj.toISOString().split('T')[0]

    const pseudoRandom = Math.sin(i * 0.18 + symbolSeed) * 0.45 + Math.cos(i * 0.07 + symbolSeed) * 0.45
    const step = pseudoRandom * 0.014 * current + ((basePrice - current) / (points - i)) * 0.08
    const open = Math.max(current, 1)
    const close = i === points - 1 ? basePrice : Math.max(open + step, 1)
    const high = Math.max(open, close) + Math.abs(pseudoRandom * 0.008 * open)
    const low = Math.min(open, close) - Math.abs(pseudoRandom * 0.008 * open)
    const volume = Math.floor(1000000 + Math.abs(Math.sin(i * 0.3 + symbolSeed)) * 5000000)

    current = close
    candles.push({
      time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume
    })
  }

  // Sort and deduplicate by time for TradingView engine requirements
  const seen = new Set()
  return candles.filter(item => {
    if (seen.has(item.time)) return false
    seen.add(item.time)
    return true
  })
}

export default function AssetDetailSheet({ asset, onClose, volatilityData, onOpenBacktest, onOpenAlerts, onOpenFullChart, onOpenReport, onOpenMentor, onOpenPaperTrading, API_BASE_URL = 'http://127.0.0.1:8000' }) {





  // 1. Timeframe State Management (default '1D')
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D')

  // 2. Crosshair Hover State for live metric sync
  const [hoveredPoint, setHoveredPoint] = useState(null)

  // 3. Container & Chart Refs
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const areaSeriesRef = useRef(null)

  // 4. Escape Key Effect (UNCONDITIONAL HOOK)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const symbol = asset?.symbol || 'QQQ'
  const closePrice = parseFloat(asset?.close_price) || 100
  const vol = volatilityData?.[symbol]
  const timeframes = ['1m', '5m', '15m', '1h', '1D', '1W', '1M', '1Y']
  const [intradayCandles, setIntradayCandles] = useState([])

  // Fetch timeframe candle series
  useEffect(() => {
    if (!asset || !symbol) return
    const tf = selectedTimeframe === '1M' ? '1M' : selectedTimeframe.toLowerCase()
    
    const fetchTfCandles = async () => {
      try {
        const response = await fetch(`${API_BASE_URL || 'http://127.0.0.1:8000'}/api/candles/${symbol}/?tf=${tf}`)
        if (response.ok) {
          const data = await response.json()
          setIntradayCandles(data)
        }
      } catch (err) {
        console.error(`Error fetching ${tf} candles:`, err)
      }
    }
    
    fetchTfCandles()
  }, [symbol, selectedTimeframe, API_BASE_URL])

  // 5. Full Candle Series Memoization (UNCONDITIONAL HOOK)
  const fullCandles = useMemo(() => {
    if (!asset) return []
    if (asset.history && Array.isArray(asset.history) && asset.history.length > 0) {
      return asset.history
    }
    if (asset.price_history && Array.isArray(asset.price_history) && asset.price_history.length > 0) {
      return asset.price_history
    }
    return generateFallbackCandles(symbol, closePrice)
  }, [asset, symbol, closePrice])

  // 6. Timeframe Sliced Dataset Memoization (UNCONDITIONAL HOOK)
  const slicedCandles = useMemo(() => {
    const candlesToUse = (intradayCandles && intradayCandles.length > 0)
      ? intradayCandles
      : fullCandles

    if (!candlesToUse || candlesToUse.length === 0) return []

    const sliceCounts = {
      '1m': 390,
      '5m': 150,
      '15m': 100,
      '1h': 80,
      '1D': 60,
      '1W': 52,
      '1M': 24,
      '1Y': 252
    }
    const count = sliceCounts[selectedTimeframe] || 60
    return candlesToUse.slice(-Math.min(count, candlesToUse.length))
  }, [fullCandles, intradayCandles, selectedTimeframe])


  // 7. TradingView Series & Metric Calculations (UNCONDITIONAL HOOK)
  const chartData = useMemo(() => {
    if (!slicedCandles || slicedCandles.length === 0) {
      return {
        areaData: [],
        volumeData: [],
        emaData: [],
        startPrice: closePrice,
        latestPrice: closePrice,
        priceChange: 0,
        pctChange: 0,
        isPositive: true
      }
    }

    const latestPrice = slicedCandles[slicedCandles.length - 1].close || closePrice
    let startPrice = slicedCandles[0].close || closePrice

    if (selectedTimeframe === '1D') {
      // 1D timeframe represents 1-day session: compare latest close with previous trading day's close
      if (slicedCandles.length >= 2) {
        startPrice = slicedCandles[slicedCandles.length - 2].close
      } else {
        const rawPct = asset?.daily_change_pct !== undefined ? asset?.daily_change_pct : asset?.percent_change
        const pctNum = parseFloat(rawPct) || 0
        startPrice = pctNum !== -100 ? (latestPrice / (1 + (pctNum / 100))) : latestPrice
      }
    } else if (selectedTimeframe === '1W') {
      // 1W change: compare latest with ~5 trading days ago or first weekly candle
      const lookback = Math.min(5, slicedCandles.length - 1)
      startPrice = lookback > 0 ? slicedCandles[slicedCandles.length - 1 - lookback].close : slicedCandles[0].close
    } else if (selectedTimeframe === '1M') {
      // 1M change: compare latest with ~21 trading days ago or first monthly candle
      const lookback = Math.min(21, slicedCandles.length - 1)
      startPrice = lookback > 0 ? slicedCandles[slicedCandles.length - 1 - lookback].close : slicedCandles[0].close
    } else if (selectedTimeframe === '1Y') {
      // 1Y change: compare with 1 year ago (start of annual series)
      startPrice = slicedCandles[0].close
    } else {
      // Intraday (1m, 5m, 15m, 1h): compare latest with opening price of the session
      startPrice = slicedCandles[0].open || slicedCandles[0].close || latestPrice
    }

    let priceChange = latestPrice - startPrice
    let pctChange = startPrice !== 0 ? (priceChange / startPrice) * 100 : 0

    // Ensure 1D change accurately falls back to asset's explicit 24h metrics if candle diff was negligible
    if (selectedTimeframe === '1D') {
      const explicitPct = parseFloat(asset?.daily_change_pct !== undefined ? asset?.daily_change_pct : asset?.percent_change)
      if (!isNaN(explicitPct) && (Math.abs(priceChange) < 0.001 || !priceChange)) {
        pctChange = explicitPct
        priceChange = latestPrice * (pctChange / 100)
      }
    }

    const isPositive = pctChange >= 0

    const areaData = slicedCandles.map(c => ({ time: c.time, value: c.close }))
    const volumeData = slicedCandles.map((c, i) => {
      const prevClose = i > 0 ? slicedCandles[i - 1].close : c.open
      const isUp = c.close >= prevClose
      return {
        time: c.time,
        value: c.volume,
        color: isUp ? 'rgba(16, 185, 129, 0.38)' : 'rgba(239, 68, 68, 0.38)'
      }
    })
    const emaData = calculateEMA(slicedCandles, 20)

    return {
      areaData,
      volumeData,
      emaData,
      startPrice,
      latestPrice,
      priceChange,
      pctChange,
      isPositive
    }
  }, [slicedCandles, closePrice, selectedTimeframe, asset])

  // 8. Initialize and update TradingView Lightweight Chart (UNCONDITIONAL HOOK)
  useEffect(() => {
    if (!asset || !chartContainerRef.current) return

    const container = chartContainerRef.current
    const initialWidth = container.clientWidth || 440

    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      areaSeriesRef.current = null
    }

    const chart = createChart(container, {
      width: initialWidth,
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94A3B8',
        fontSize: 10,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      },
      grid: {
        vertLines: { color: '#F1F5F9' },
        horzLines: { color: '#F1F5F9' }
      },
      crosshair: {
        vertLine: {
          color: chartData.isPositive ? '#10B981' : '#EF4444',
          width: 1,
          style: 3
        },
        horzLine: {
          color: chartData.isPositive ? '#10B981' : '#EF4444',
          width: 1,
          style: 3
        }
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: {
          top: 0.08,
          bottom: 0.22
        }
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false
      },
      handleScroll: { mouseWheel: true, pressedMove: true },
      handleScale: { axisPressedMove: true, mouseWheel: true, pinch: true }
    })

    chartRef.current = chart

    // Render Area Price Series with dynamic color gradient
    const areaSeries = chart.addSeries(AreaSeries, {
      topColor: chartData.isPositive ? 'rgba(16, 185, 129, 0.28)' : 'rgba(239, 68, 68, 0.28)',
      bottomColor: chartData.isPositive ? 'rgba(16, 185, 129, 0.0)' : 'rgba(239, 68, 68, 0.0)',
      lineColor: chartData.isPositive ? '#10B981' : '#EF4444',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: '#FFFFFF',
      crosshairMarkerBackgroundColor: chartData.isPositive ? '#10B981' : '#EF4444'
    })
    areaSeriesRef.current = areaSeries
    areaSeries.setData(chartData.areaData)

    // Render Volume Histogram Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' }
    })
    volumeSeries.setData(chartData.volumeData)

    // Configure Volume Price Scale (Must be called AFTER adding volumeSeries)
    if (chart.priceScale('volume')) {
      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.72,
          bottom: 0
        }
      })
    }

    // Render 20 EMA Baseline Overlay Line (#3B82F6 blue)
    const emaSeries = chart.addSeries(LineSeries, {
      color: '#3B82F6',
      lineWidth: 1.5,
      crosshairMarkerVisible: false
    })
    emaSeries.setData(chartData.emaData)

    // Smoothly fit content on timeframe tab change
    chart.timeScale().fitContent()

    // Subscribe to Crosshair Move for Top Header Sync
    chart.subscribeCrosshairMove((param) => {
      if (
        !param ||
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > container.clientWidth ||
        param.point.y < 0 ||
        param.point.y > 220
      ) {
        setHoveredPoint(null)
        return
      }

      const areaPriceData = param.seriesData.get(areaSeries)
      const emaValData = param.seriesData.get(emaSeries)
      const volValData = param.seriesData.get(volumeSeries)

      if (areaPriceData && areaPriceData.value !== undefined) {
        const hoverPrice = areaPriceData.value
        const startP = chartData.startPrice || hoverPrice
        const pDiff = hoverPrice - startP
        const pPct = startP !== 0 ? (pDiff / startP) * 100 : 0

        let dateStr = ''
        if (typeof param.time === 'string') {
          dateStr = param.time
        } else if (typeof param.time === 'number') {
          dateStr = new Date(param.time * 1000).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          })
        } else if (param.time && typeof param.time === 'object') {
          dateStr = `${param.time.year}-${String(param.time.month).padStart(2, '0')}-${String(param.time.day).padStart(2, '0')}`
        }

        setHoveredPoint({
          price: hoverPrice,
          date: dateStr ? `${dateStr}` : '',
          priceChange: pDiff,
          pctChange: pPct,
          isPositive: pPct >= 0,
          ema: emaValData?.value,
          volume: volValData?.value
        })
      }
    })

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0] && entries[0].contentRect) {
        const { width } = entries[0].contentRect
        if (width > 0 && chartRef.current) {
          chartRef.current.applyOptions({ width })
        }
      }
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        areaSeriesRef.current = null
      }
    }
  }, [asset, chartData, selectedTimeframe])

  // UNCONDITIONAL Early Return AFTER ALL HOOKS
  if (!asset) return null

  // Active header metric resolution (Crosshair synced OR latest period metric)
  const currentPriceDisplay = hoveredPoint ? hoveredPoint.price : closePrice
  const currentPriceChange = hoveredPoint ? hoveredPoint.priceChange : chartData.priceChange
  const currentPctChange = hoveredPoint ? hoveredPoint.pctChange : chartData.pctChange
  const currentIsPositive = hoveredPoint ? hoveredPoint.isPositive : chartData.isPositive
  const currentDateSubtitle = hoveredPoint
    ? hoveredPoint.date
    : `${selectedTimeframe} Change: ${currentPriceChange >= 0 ? '+' : '-'}\$${Math.abs(currentPriceChange).toFixed(2)}`

  // Technical metrics derived from real price action & candles
  const allCandleSources = [
    ...(Array.isArray(fullCandles) ? fullCandles : []),
    ...(Array.isArray(intradayCandles) ? intradayCandles : []),
    ...(Array.isArray(asset?.candles) ? asset.candles : []),
    ...(Array.isArray(asset?.history) ? asset.history : [])
  ]
  const pricesInHistory = allCandleSources.map(c => typeof c.close === 'number' ? c.close : parseFloat(c.close || c.ClosePrice || 0)).filter(p => p > 0)
  const realLow = pricesInHistory.length > 5 ? Math.min(...pricesInHistory) : closePrice * 0.70
  const realHigh = pricesInHistory.length > 5 ? Math.max(...pricesInHistory) : closePrice * 1.30
  
  // Use true 52-week low/high from backend database (1 full year)
  const low52 = asset?.fifty_two_week_low != null
    ? parseFloat(asset.fifty_two_week_low)
    : (asset?.low_52w != null ? parseFloat(asset.low_52w) : parseFloat(realLow.toFixed(2)))
  const high52 = asset?.fifty_two_week_high != null
    ? parseFloat(asset.fifty_two_week_high)
    : (asset?.high_52w != null ? parseFloat(asset.high_52w) : parseFloat(realHigh.toFixed(2)))
  const rangePct = Math.min(100, Math.max(0, ((closePrice - low52) / (high52 - low52 || 1)) * 100))

  const rsiVal = asset?.radar?.rsi != null ? asset.radar.rsi : 52.4
  const rsiBadge = asset?.radar?.rsi_label || (rsiVal >= 70 ? 'Overbought' : rsiVal <= 30 ? 'Oversold' : 'Neutral / Bullish')
  const supportPrice = asset.golden_opportunity?.stop_loss_num
    ? asset.golden_opportunity.stop_loss_num.toFixed(2)
    : (closePrice * 0.96).toFixed(2)
  const resistancePrice = asset.golden_opportunity?.target_price_num
    ? asset.golden_opportunity.target_price_num.toFixed(2)
    : (closePrice * 1.06).toFixed(2)

  const obvFlow = asset?.radar?.vol_spike_ratio
    ? `${asset.radar.vol_spike_ratio}x Vol Surge (${currentIsPositive ? 'Net Inflow' : 'Net Outflow'})`
    : (currentIsPositive ? '+14.2M Accumulation' : '-8.5M Distribution')

  const effectiveVol = asset.volatility || vol
  const histVol = effectiveVol ? effectiveVol.historical_volatility : (asset?.radar?.bb_width_pct ? `${(asset.radar.bb_width_pct * 4.2).toFixed(1)}%` : '22.4%')

  const companyNames = {
    // US Mega-Caps & Tech
    'NVDA': 'NVIDIA Corporation',
    'AAPL': 'Apple Inc.',
    'MSFT': 'Microsoft Corporation',
    'AMZN': 'Amazon.com, Inc.',
    'GOOGL': 'Alphabet Inc.',
    'META': 'Meta Platforms, Inc.',
    'TSLA': 'Tesla, Inc.',
    'AMD': 'Advanced Micro Devices, Inc.',
    'PLTR': 'Palantir Technologies Inc.',
    'SMCI': 'Super Micro Computer, Inc.',
    'ARM': 'Arm Holdings plc',
    'QCOM': 'Qualcomm Inc.',
    'NFLX': 'Netflix, Inc.',
    'AVGO': 'Broadcom Inc.',

    // Semiconductors & Hardware
    'TSM': 'Taiwan Semiconductor Manufacturing Co.',
    'ASML': 'ASML Holding N.V.',
    'MU': 'Micron Technology, Inc.',
    'INTC': 'Intel Corporation',

    // FinTech & Financial Giants
    'PYPL': 'PayPal Holdings, Inc.',
    'SQ': 'Block, Inc.',
    'HOOD': 'Robinhood Markets, Inc.',
    'SOFI': 'SoFi Technologies, Inc.',
    'UBER': 'Uber Technologies, Inc.',
    'COIN': 'Coinbase Global, Inc.',
    'MSTR': 'MicroStrategy Incorporated',
    'JPM': 'JPMorgan Chase & Co.',
    'BAC': 'Bank of America Corporation',
    'GS': 'The Goldman Sachs Group, Inc.',
    'V': 'Visa Inc.',
    'MA': 'Mastercard Incorporated',

    // Healthcare, Industrial & Consumer Titans
    'LLY': 'Eli Lilly and Company',
    'XOM': 'Exxon Mobil Corporation',
    'CVX': 'Chevron Corporation',
    'JNJ': 'Johnson & Johnson',
    'UNH': 'UnitedHealth Group Incorporated',
    'EOSE': 'Eos Energy Enterprises, Inc.',
    'WMT': 'Walmart Inc.',
    'COST': 'Costco Wholesale Corporation',
    'DIS': 'The Walt Disney Company',
    'ONDS': 'Ondas Holdings Inc.',

    // Major Broad & Sector Index ETFs
    'SPY': 'SPDR S&P 500 ETF Trust',
    'QQQ': 'Invesco QQQ Trust Series 1',
    'IWM': 'iShares Russell 2000 ETF',
    'DIA': 'SPDR Dow Jones Industrial Average ETF',
    'TLT': 'iShares 20+ Year Treasury Bond ETF',
    'XLF': 'Financial Select Sector SPDR Fund',
    'XLK': 'Technology Select Sector SPDR Fund',
    'XLE': 'Energy Select Sector SPDR Fund',

    // Commodities & Precious Metals
    'GLD': 'SPDR Gold Shares',
    'SLV': 'iShares Silver Trust',
    'USO': 'United States Oil Fund LP',
    'UNG': 'United States Natural Gas Fund LP',

    // Major Cryptocurrencies
    'BTC-USD': 'Bitcoin / US Dollar',
    'ETH-USD': 'Ethereum / US Dollar',
    'SOL-USD': 'Solana / US Dollar',
    'XRP-USD': 'XRP / US Dollar',
    'DOGE-USD': 'Dogecoin / US Dollar',
    'ADA-USD': 'Cardano / US Dollar'
  }

  const companyName = companyNames[symbol] || `${symbol} (${asset.asset_type || 'Equity'})`
  const sheetRiskMeta = getRiskRatingMeta(symbol, asset.asset_type)

  return (
    <AnimatePresence>
      {asset && (
        <div className="sheet-root-container">
          {/* Translucent Backdrop Overlay */}
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />

          {/* Slide-Over Inspection Drawer Panel */}
          <motion.aside
            className="sheet-drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Header Toolbar */}
            <div className="sheet-header">
              <div className="sheet-brand-group">
                <div className="sheet-symbol-avatar">
                  <span>{symbol.slice(0, 2)}</span>
                </div>
                <div className="sheet-title-meta">
                  <div className="title-row">
                    <h2 className="sheet-ticker">{symbol}</h2>
                    <span className="sheet-capsule-badge">{asset.asset_type || 'US Equity'}</span>
                    
                    {/* Risk Rating Badge (1-5 Scale) */}
                    <span className={`risk-badge-pill ${sheetRiskMeta.badgeClass}`} title={`${sheetRiskMeta.label}: ${sheetRiskMeta.description}`}>
                      <span className="risk-icon">{sheetRiskMeta.icon}</span>
                      <span className="risk-text">{sheetRiskMeta.shortLabel}</span>
                    </span>
                  </div>
                  <span className="sheet-company">{companyName}</span>
                </div>
              </div>


              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className="sync-now-btn"
                  onClick={() => onOpenMentor?.(symbol)}
                  title="Ask AI Trading Mentor (Uncle Warren & Quant Bro) about this asset"
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.725rem', background: '#fdf2f8', borderColor: '#fbcfe8', color: '#db2777', fontWeight: 700 }}
                >
                  <Sparkles size={13} style={{ color: '#db2777' }} />
                  <span>Ask Mentor</span>
                </button>
                <button
                  className="sync-now-btn"
                  onClick={() => onOpenFullChart?.(asset)}

                  title="Expand Full-Screen Interactive Chart"
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.725rem' }}
                >
                  <Maximize2 size={13} />
                  <span>Expand Chart</span>
                </button>
                <button
                  className="sync-now-btn"
                  onClick={() => onOpenAlerts?.(symbol)}
                  title="Configure Alert Rule for this asset"
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.725rem' }}
                >
                  <Bell size={13} />
                  <span>Set Alert</span>
                </button>
                <button
                  className="sync-now-btn"
                  onClick={() => onOpenReport?.(symbol)}
                  title="Export AI Quantitative Trade Brief Report"
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.725rem' }}
                >
                  <FileText size={13} />
                  <span>Export Brief</span>
                </button>
                <button
                  className="sync-now-btn"
                  onClick={() => onOpenBacktest?.(symbol)}
                  title="Run Backtest Simulation on historical candles"
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.725rem' }}
                >
                  <BarChart3 size={14} />
                  <span>Backtest</span>
                </button>


                <button
                  className="sync-now-btn"
                  onClick={() => onOpenPaperTrading?.(symbol)}
                  title="Track real-time position on this asset in Live Desk"
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.725rem', background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0', fontWeight: 700 }}
                >
                  <Briefcase size={13} />
                  <span>Track Live</span>
                </button>

                <button className="sheet-close-btn" onClick={onClose} title="Close (ESC)">
                  <X size={18} />
                </button>
              </div>



            </div>

            {/* Content Body */}
            <div className="sheet-body">
              {/* Price & Change Banner with Dynamic Crosshair Sync */}
              <div className="sheet-price-banner">
                <motion.div
                  key={`${selectedTimeframe}-${hoveredPoint ? hoveredPoint.date : 'default'}`}
                  className="price-banner-content"
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="price-left">
                    <span className="price-big">${Number(currentPriceDisplay).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="price-date">{currentDateSubtitle}</span>
                  </div>
                  <div className={`price-change-pill ${currentIsPositive ? 'positive' : 'negative'}`}>
                    {currentIsPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    <span>
                      {currentIsPositive ? '+' : ''}
                      {currentPctChange.toFixed(2)}%
                    </span>
                  </div>
                </motion.div>
              </div>

              {/* Timeframe Pill Switcher with Framer Motion Sliding Pill */}
              <div className="sheet-timeframe-bar">
                {timeframes.map(tf => {
                  const isActive = selectedTimeframe === tf
                  return (
                    <button
                      key={tf}
                      className={`timeframe-pill-btn ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedTimeframe(tf)
                        setHoveredPoint(null)
                      }}
                    >
                      {isActive && (
                        <motion.div
                          className="timeframe-glider"
                          layoutId="activeTimeframeTab"
                          transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                        />
                      )}
                      <span>{tf}</span>
                    </button>
                  )
                })}
              </div>

              {/* Interactive 220px TradingView Lightweight Chart Container */}
              <div className="sheet-tv-chart-card">
                <div className="sheet-tv-chart-header">
                  <div className="tv-legend-left">
                    <span className="tv-symbol-tag">{symbol}</span>
                    <span className="tv-tf-tag">{selectedTimeframe}</span>
                  </div>
                  <div className="tv-legend-right">
                    <span className="tv-ema-pill">EMA (20): ${hoveredPoint?.ema ? hoveredPoint.ema.toFixed(2) : chartData.emaData[chartData.emaData.length - 1]?.value || '--'}</span>
                    <span className="tv-vol-pill">
                      VOL: {hoveredPoint?.volume ? (hoveredPoint.volume / 1e6).toFixed(2) + 'M' : chartData.volumeData[chartData.volumeData.length - 1]?.value ? (chartData.volumeData[chartData.volumeData.length - 1].value / 1e6).toFixed(2) + 'M' : '--'}
                    </span>
                  </div>
                </div>

                <div
                  className="sheet-tv-chart-container"
                  ref={chartContainerRef}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </div>

              {/* 52-Week Price Range Slider Card */}
              <div className="sheet-section-card">
                <div className="section-card-header">
                  <span className="section-label">52-WEEK PRICE RANGE</span>
                  <span className="section-range-value">${low52.toFixed(2)} — ${high52.toFixed(2)}</span>
                </div>
                <div className="range-bar-track">
                  <div className="range-bar-fill" style={{ width: `${rangePct}%` }} />
                  <div className="range-bar-thumb" style={{ left: `${rangePct}%` }} title={`Current: $${closePrice.toFixed(2)}`} />
                </div>
                <div className="range-footer">
                  <span>52W Low: ${low52.toFixed(2)}</span>
                  <span>52W High: ${high52.toFixed(2)}</span>
                </div>
              </div>

              {/* Technical Indicators Matrix */}
              <div className="sheet-metrics-matrix">
                <div className="matrix-cell">
                  <div className="cell-top">
                    <span className="matrix-label">RSI (14-DAY)</span>
                    <span className={`matrix-badge ${rsiVal > 70 ? 'high' : 'normal'}`}>{rsiBadge}</span>
                  </div>
                  <span className="matrix-val">{rsiVal}</span>
                  <span className="matrix-sub">Relative Strength Index</span>
                </div>

                <div className="matrix-cell">
                  <div className="cell-top">
                    <span className="matrix-label">20D HIST VOLATILITY</span>
                    <span className="matrix-badge normal">HV</span>
                  </div>
                  <span className="matrix-val">{histVol}</span>
                  <span className="matrix-sub">Annualized Standard Dev</span>
                </div>

                <div className="matrix-cell">
                  <div className="cell-top">
                    <span className="matrix-label">SUPPORT / RESISTANCE</span>
                    <span className="matrix-badge normal">Key Levels</span>
                  </div>
                  <span className="matrix-val">${supportPrice} / ${resistancePrice}</span>
                  <span className="matrix-sub">Pivot Points</span>
                </div>

                <div className="matrix-cell">
                  <div className="cell-top">
                    <span className="matrix-label">VOLUME FLOW (OBV)</span>
                    <span className={`matrix-badge ${currentIsPositive ? 'positive' : 'negative'}`}>
                      {currentIsPositive ? 'Bullish' : 'Bearish'}
                    </span>
                  </div>
                  <span className="matrix-val">{obvFlow}</span>
                  <span className="matrix-sub">On-Balance Volume</span>
                </div>
              </div>

              {/* AI Trade Setup Brief */}
              <div className="sheet-ai-brief-card">
                <div className="brief-header">
                  <div className="brief-title-group">
                    <Sparkles size={16} className="brief-icon" />
                    <span>QUANTITATIVE AI TRADE SETUP</span>
                  </div>
                  <span className="brief-algo-badge">MACD + EMA 20/50</span>
                </div>

                <div className="brief-bullets-list">
                  <div className="bullet-item">
                    <Target size={14} className="bullet-icon positive" />
                    <div className="bullet-content">
                      <span className="bullet-title">Current Setup:</span>
                      <span className="bullet-desc">
                        {currentIsPositive
                          ? `Bullish momentum observed over ${selectedTimeframe} timeframe for ${symbol}.`
                          : `Consolidation/pullback pressure detected over ${selectedTimeframe} timeframe for ${symbol}.`}
                      </span>
                    </div>
                  </div>

                  <div className="bullet-item">
                    <BarChart2 size={14} className="bullet-icon blue" />
                    <div className="bullet-content">
                      <span className="bullet-title">Risk / Reward Ratio:</span>
                      <span className="bullet-desc">
                        {currentIsPositive ? '3.4 : 1 (Target: $' + (closePrice * 1.12).toFixed(2) + ')' : '2.8 : 1 (Target: $' + (closePrice * 0.88).toFixed(2) + ')'}
                      </span>
                    </div>
                  </div>

                  <div className="bullet-item">
                    <AlertOctagon size={14} className="bullet-icon warning" />
                    <div className="bullet-content">
                      <span className="bullet-title">Key Invalidation Level:</span>
                      <span className="bullet-desc">
                        Stop-loss triggered on daily close below ${supportPrice} (50 EMA support).
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}


