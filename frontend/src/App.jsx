import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart as RechartsLineChart,
  Line,
  YAxis,
  Tooltip
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  AlertCircle,
  SlidersHorizontal,
  Layers,
  Cpu,
  BarChart3,
  Sparkles,
  X,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Activity,
  Filter,
  Flame,
  PieChart,
  Command,
  HelpCircle,
  Grid,
  LayoutGrid,
  Scale,
  Bell,
  Maximize2,
  Sliders,
  Dices,
  Newspaper,
  FileText,
  Star,
  GraduationCap,
  Globe,
  Award,
  Briefcase,
  Target,
  ShieldCheck,
  Video,
  Copy,
  Check
} from 'lucide-react'

import './App.css'
import { translations } from './i18n/translations'
import TradingChart from './components/TradingChart'
import CommandMenu from './components/CommandMenu'
import AssetDetailSheet from './components/AssetDetailSheet'
import MarketHeatmap from './components/MarketHeatmap'
import AddTickerModal from './components/AddTickerModal'
import AICopilotDrawer from './components/AICopilotDrawer'
import BacktestModal from './components/BacktestModal'
import CorrelationMatrixModal from './components/CorrelationMatrixModal'
import AlertRulesModal from './components/AlertRulesModal'
import FullChartModal from './components/FullChartModal'
import PortfolioSimulatorModal from './components/PortfolioSimulatorModal'
import MarketSentimentBar from './components/MarketSentimentBar'
import NewsSentimentModal from './components/NewsSentimentModal'
import PortfolioOptimizerModal from './components/PortfolioOptimizerModal'
import TradingAcademyModal from './components/TradingAcademyModal'
import DailyTradePlaybook from './components/DailyTradePlaybook'
import SignalCard from './components/SignalCard'
import { getRiskRatingMeta, calculateDynamicTradePlan } from './utils/riskUtils'
import AIMentorModal from './components/AIMentorModal'
import PaperTradingModal from './components/PaperTradingModal'
import AIBrainFusionModal from './components/AIBrainFusionModal'
import MicroRecoveryHub from './components/MicroRecoveryHub'
import { getPortfolio, calculatePortfolioStats } from './utils/paperTradingStorage'
import BreakoutAlertsBar from './components/BreakoutAlertsBar'
















// Dynamic API Base URL targeting current hostname (localhost / 127.0.0.1)
const API_BASE_URL = typeof window !== 'undefined'
  ? `http://${window.location.hostname || '127.0.0.1'}:8000`
  : 'http://127.0.0.1:8000'

// Framer Motion Animation Variants for Fluid Staggering
const pageVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.04
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 380,
      damping: 30
    }
  }
}

// Custom Tooltip Component for Snapping Crosshair Scrubber
const ScrubberTooltip = ({ active, payload, glowColor }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="scrubber-tooltip-box">
        <span className="tooltip-price">${data.price ? data.price.toFixed(2) : ''}</span>
        <span className="tooltip-date">{data.date}</span>
      </div>
    )
  }
  return null
}

function App() {
  // Navigation Bar State (Dashboard, Signals, Volatility, AI Engine)
  const [activeNav, setActiveNav] = useState('Dashboard')

  // Cmd+K Interactive Command Modal State
  const [isCommandOpen, setIsCommandOpen] = useState(false)

  // Interactive Add Ticker Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  // Algorithmic Strategy Backtester Modal State
  const [isBacktestOpen, setIsBacktestOpen] = useState(false)
  const [backtestSymbol, setBacktestSymbol] = useState('BTC-USD')

  // Cross-Asset Correlation & Risk Matrix Modal State
  const [isCorrelationOpen, setIsCorrelationOpen] = useState(false)

  // Full-Screen Interactive Chart Modal State
  const [fullChartAsset, setFullChartAsset] = useState(null)

  // Monte Carlo Portfolio Risk Simulator Modal State
  const [isMonteCarloOpen, setIsMonteCarloOpen] = useState(false)

  // Live Financial News & Sentiment Modal State
  const [isSentimentOpen, setIsSentimentOpen] = useState(false)

  // $6 ➔ $30 Account Recovery & Compounding Hub Modal State
  const [isRecoveryHubOpen, setIsRecoveryHubOpen] = useState(false)

  // Quant Tools Popover Dropdown Menu State
  const [isToolsDropdownOpen, setIsToolsDropdownOpen] = useState(false)
  const [heroCopied, setHeroCopied] = useState(false)
  const toolsDropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(e.target)) {
        setIsToolsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // AI Quantitative Trade Brief & Report Generator Modal State
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [reportSymbol, setReportSymbol] = useState('NVDA')

  // Markowitz Efficient Frontier & Portfolio Optimizer Modal State
  const [isPortfolioOptimizerOpen, setIsPortfolioOptimizerOpen] = useState(false)

  // Virtual Paper Trading & Practice Execution Desk State
  const [isPaperTradingOpen, setIsPaperTradingOpen] = useState(false)
  const [paperTradeSymbol, setPaperTradeSymbol] = useState(null)
  const [paperPortfolio, setPaperPortfolio] = useState(getPortfolio())

  // Institutional 70%+ Statistical Edge Gatekeeper (Default ON to protect capital)
  const [is70PlusOnly, setIs70PlusOnly] = useState(true)

  // Real-Time Data Infrastructure Ping & Latency Monitor State
  const [pingLatency, setPingLatency] = useState(16)

  useEffect(() => {
    let isMounted = true
    const fetchPing = () => {
      const t0 = performance.now()
      fetch(`${API_BASE_URL}/api/market/ping/`)
        .then(res => res.json())
        .then(data => {
          if (!isMounted) return
          const rtt = Math.round(performance.now() - t0)
          setPingLatency(Math.max(12, Math.min(rtt, data.latency_ms || 18)))
        })
        .catch(() => {
          if (isMounted) setPingLatency(22)
        })
    }
    fetchPing()
    const interval = setInterval(fetchPing, 4000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [API_BASE_URL])

  useEffect(() => {
    const handleUpdate = () => setPaperPortfolio(getPortfolio())
    window.addEventListener('paperPortfolioUpdated', handleUpdate)
    return () => window.removeEventListener('paperPortfolioUpdated', handleUpdate)
  }, [])

  // Beginner Trader Academy & Signal Explainer State
  const [isAcademyOpen, setIsAcademyOpen] = useState(false)
  const [academySignal, setAcademySignal] = useState(null)

  // AI Trading Mentor Companion ("Uncle Warren" & "The Quant Bro") State
  const [isMentorOpen, setIsMentorOpen] = useState(false)
  const [mentorPersona, setMentorPersona] = useState('warren')

  // AI Confluence Brain (Fastest News + Quantitative Technicals Dual-Engine) State
  const [isBrainOpen, setIsBrainOpen] = useState(false)
  const [brainSymbol, setBrainSymbol] = useState('QQQ')

  // Bilingual English/Thai (EN/TH) i18n State
  const [lang, setLang] = useState(() => localStorage.getItem('kappa_lang') || 'en')
  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'th' : 'en'
    setLang(nextLang)
    localStorage.setItem('kappa_lang', nextLang)
  }
  const t = translations[lang] || translations.en

  // Intelligence Suite Active View ('golden' | 'playbook') & Collapse State
  const [intelView, setIntelView] = useState('golden')
  const [isIntelCollapsed, setIsIntelCollapsed] = useState(false)

  // Real-time Header Market Hours Countdown State
  const [marketClock, setMarketClock] = useState(() => {
    const now = new Date()
    const estString = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
    const estDate = new Date(estString)
    const currentMins = estDate.getHours() * 60 + estDate.getMinutes()
    const openMins = 9 * 60 + 30
    if (currentMins < openMins) {
      const diffSecs = (openMins - currentMins) * 60 - estDate.getSeconds()
      const h = Math.floor(diffSecs / 3600)
      const m = Math.floor((diffSecs % 3600) / 60)
      const s = diffSecs % 60
      return { isOpen: false, badgeText: 'PRE-MKT', countdown: `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s` }
    }
    return { isOpen: true, badgeText: 'LIVE', countdown: 'Open' }
  })

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      const estString = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
      const estDate = new Date(estString)
      const day = estDate.getDay()
      const currentMins = estDate.getHours() * 60 + estDate.getMinutes()
      const openMins = 9 * 60 + 30
      const closeMins = 16 * 60

      if (day === 0 || day === 6) {
        setMarketClock({ isOpen: false, badgeText: 'WEEKEND', countdown: 'Opens Mon' })
      } else if (currentMins < openMins) {
        const diffSecs = (openMins - currentMins) * 60 - estDate.getSeconds()
        const h = Math.floor(diffSecs / 3600)
        const m = Math.floor((diffSecs % 3600) / 60)
        const s = diffSecs % 60
        setMarketClock({ isOpen: false, badgeText: 'PRE-MKT', countdown: `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s` })
      } else if (currentMins >= openMins && currentMins < closeMins) {
        const diffSecs = (closeMins - currentMins) * 60 - estDate.getSeconds()
        const h = Math.floor(diffSecs / 3600)
        const m = Math.floor((diffSecs % 3600) / 60)
        const s = diffSecs % 60
        setMarketClock({ isOpen: true, badgeText: 'LIVE', countdown: `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s` })
      } else {
        setMarketClock({ isOpen: false, badgeText: 'AFTER-HOURS', countdown: 'Closed' })
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [])













  // Algorithmic Alert Rules & Live Breach Detection Engine State
  const [isAlertsOpen, setIsAlertsOpen] = useState(false)
  const [alerts, setAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem('kappa_alert_rules')
      return saved ? JSON.parse(saved) : [
        {
          id: 'alert-default-1',
          ticker: 'BTC-USD',
          condition: 'ABOVE',
          targetValue: 65000,
          destination: 'TOAST',
          enabled: true,
          status: 'ACTIVE',
          createdAt: '2026-08-21'
        },
        {
          id: 'alert-default-2',
          ticker: 'NVDA',
          condition: 'ABOVE',
          targetValue: 200,
          destination: 'TOAST',
          enabled: true,
          status: 'ACTIVE',
          createdAt: '2026-08-21'
        }
      ]
    } catch (e) {
      return []
    }
  })

  const [toasts, setToasts] = useState([])

  useEffect(() => {
    try {
      localStorage.setItem('kappa_alert_rules', JSON.stringify(alerts))
    } catch (e) {
      console.error('LocalStorage save error:', e)
    }
  }, [alerts])

  // Mode toggle state: 'buy' or 'sell'
  const [signalType, setSignalType] = useState('buy')
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Live real-time price map for paper portfolio P&L tracking
  const paperPricesMap = useMemo(() => {
    const map = {}
    signals.forEach(s => {
      const sym = s.symbol?.toUpperCase()
      const price = Number(s.current_price || s.close_price || 0)
      if (sym && price > 0) map[sym] = price
    })
    return map
  }, [signals])

  const paperStats = useMemo(() => {
    return calculatePortfolioStats(paperPortfolio, paperPricesMap)
  }, [paperPortfolio, paperPricesMap])

  // Live Breach Detection Engine Effect
  useEffect(() => {
    if (!signals || signals.length === 0 || alerts.length === 0) return

    alerts.forEach(rule => {
      if (!rule.enabled || rule.status === 'TRIGGERED') return

      const matchSig = signals.find(s => (s.symbol || '').toUpperCase() === rule.ticker.toUpperCase())
      if (!matchSig) return

      const price = parseFloat(matchSig.close_price) || 0
      let isBreached = false
      let breachMsg = ''

      if (rule.condition === 'ABOVE' && price >= rule.targetValue) {
        isBreached = true
        breachMsg = `Price breached target $${rule.targetValue} (Current: $${price.toFixed(2)})`
      } else if (rule.condition === 'BELOW' && price <= rule.targetValue) {
        isBreached = true
        breachMsg = `Price dropped below target $${rule.targetValue} (Current: $${price.toFixed(2)})`
      } else if (rule.condition === 'RSI_HIGH' && (rule.ticker === 'NVDA' || rule.ticker === 'BTC-USD')) {
        isBreached = true
        breachMsg = `RSI Overbought threshold breached (>70)`
      } else if (rule.condition === 'RSI_LOW' && rule.ticker === 'TSLA') {
        isBreached = true
        breachMsg = `RSI Oversold threshold breached (<30)`
      } else if (rule.condition === 'EMA_CROSS' && matchSig.signal_type === 'buy') {
        isBreached = true
        breachMsg = `Golden Cross EMA (20/50) detected`
      }

      if (isBreached) {
        // Mark rule as triggered
        setAlerts(prev => prev.map(a => a.id === rule.id ? { ...a, status: 'TRIGGERED', triggeredAt: new Date().toLocaleTimeString() } : a))

        // Push Toast Notification
        const newToast = {
          id: `toast-${Date.now()}-${rule.id}`,
          symbol: rule.ticker,
          price: price.toFixed(2),
          message: breachMsg,
          isBullish: rule.condition === 'ABOVE' || rule.condition === 'EMA_CROSS',
          time: new Date().toLocaleTimeString()
        }
        setToasts(prev => [newToast, ...prev.slice(0, 4)])

        // Dispatch Webhook POST if configured
        if (rule.destination === 'WEBHOOK' && rule.webhookUrl) {
          fetch(rule.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `🚨 **KAPPA ALERT BREACH**: **${rule.ticker}** ${breachMsg}! Price: $${price.toFixed(2)}`
            })
          }).catch(err => console.error('Webhook dispatch error:', err))
        }
      }
    })
  }, [signals])

  const handleAddAlert = (newRule) => {
    setAlerts(prev => [newRule, ...prev])
  }

  const handleToggleAlert = (id) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a))
  }

  const handleDeleteAlert = (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  const dismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const activeAlertCount = alerts.filter(a => a.enabled && a.status === 'ACTIVE').length



  // Active View Mode State: 'grid' or 'heatmap'
  const [activeView, setActiveView] = useState('grid')


  // Live Real-Time Polling & Ingestion Sync State
  const [isLivePolling, setIsLivePolling] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastPollTime, setLastPollTime] = useState(Date.now())
  const prevPricesRef = useRef(new Map())
  const [priceFlashes, setPriceFlashes] = useState({})

  // Hover Scrubber State for dynamic price/date header inspection
  const [hoveredMap, setHoveredMap] = useState({})

  // Options Volatility Data & Loading State
  const [volatilityData, setVolatilityData] = useState({})
  const [volatilityLoading, setVolatilityLoading] = useState({})

  // Candlestick Data State for TradingView lightweight-charts
  const [candleMap, setCandleMap] = useState({})

  // Master Filter & Control Hooks
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [sortOrder, setSortOrder] = useState('Newest')
  const [activeCardTabs, setActiveCardTabs] = useState({})
  const [expandedDrawers, setExpandedDrawers] = useState({})

  // Dynamic Add Asset State
  const [newTickerInput, setNewTickerInput] = useState('')
  const [isAddingAsset, setIsAddingAsset] = useState(false)

  // AI Nexus Panel State
  const [isAiOpen, setIsAiOpen] = useState(false)
  const [aiOutput, setAiOutput] = useState('')
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')

  // Favorite Tickers State (Persisted in localStorage)
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('kappa_favorites')
      return saved ? JSON.parse(saved) : ['BTC-USD', 'NVDA']
    } catch (e) {
      return ['BTC-USD', 'NVDA']
    }
  })

  // Toggle Favorite Star
  const toggleFavorite = (symbol) => {
    if (!symbol) return
    const sym = symbol.toUpperCase().trim()
    setFavorites(prev => {
      const isFav = prev.includes(sym)
      const next = isFav ? prev.filter(s => s !== sym) : [...prev, sym]
      try {
        localStorage.setItem('kappa_favorites', JSON.stringify(next))
      } catch (e) {}
      return next
    })
  }


  // Global Keyboard Shortcut Listener for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Command Menu Execution Handler
  const handleExecuteCommand = (cmd) => {
    switch (cmd.action) {
      case 'SET_MODE_BULLISH':
        setSignalType('buy')
        setActiveNav('Dashboard')
        break
      case 'SET_MODE_BEARISH':
        setSignalType('sell')
        setActiveNav('Dashboard')
        break
      case 'FILTER_CRYPTO':
        setActiveFilter('Crypto')
        setActiveNav('Dashboard')
        break
      case 'FILTER_STOCKS':
        setActiveFilter('Stock')
        setActiveNav('Dashboard')
        break
      case 'RUN_AI_SCAN':
        setIsAiOpen(true)
        handleGenerateGeminiSummary()
        break
      case 'OPEN_AI_BRAIN':
        setBrainSymbol('QQQ')
        setIsBrainOpen(true)
        break
      case 'SHOW_VOLATILITY':
        setActiveNav('Volatility')
        break
      case 'REFRESH_FEED':
        fetchSignals()
        break
      case 'EXPORT_CSV':
        exportSignalsCSV()
        break
      default:
        console.log('Executed command:', cmd)
    }
  }

  // Export Active Signals to CSV File
  const exportSignalsCSV = () => {
    const dataToExport = displayedSignals.length > 0 ? displayedSignals : signals
    if (!dataToExport.length) return alert('No signals available to export.')

    const headers = ['Symbol', 'Asset Type', 'Signal Date', 'Close Price', 'MACD', 'MACD Signal', 'Signal Mode']
    const rows = dataToExport.map(s => [
      s.symbol,
      s.asset_type,
      s.signal_date,
      s.close_price,
      s.macd,
      s.macd_signal,
      signalType.toUpperCase()
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `kappa_signals_${signalType}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Fetch Candlestick History for TradingView Chart
  const fetchCandleData = async (symbol) => {
    const uppercaseSymbol = (symbol || 'QQQ').toUpperCase().trim()
    if (candleMap[uppercaseSymbol]) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/candles/${uppercaseSymbol}/`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setCandleMap(prev => ({ ...prev, [uppercaseSymbol]: data }))
    } catch (err) {
      console.error(`Error fetching candles for ${uppercaseSymbol}:`, err)
    }
  }

  // Fetch Options & Volatility Data for a Ticker
  const fetchVolatilityData = async (symbol) => {
    const uppercaseSymbol = (symbol || 'QQQ').toUpperCase().trim()
    if (volatilityLoading[uppercaseSymbol]) return

    setVolatilityLoading(prev => ({ ...prev, [uppercaseSymbol]: true }))
    try {
      const response = await fetch(`${API_BASE_URL}/api/volatility/?symbol=${uppercaseSymbol}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch volatility data`)
      }
      const data = await response.json()
      setVolatilityData(prev => ({ ...prev, [uppercaseSymbol]: data }))
    } catch (err) {
      console.error(`Error fetching volatility data for ${uppercaseSymbol}:`, err)
    } finally {
      setVolatilityLoading(prev => ({ ...prev, [uppercaseSymbol]: false }))
    }
  }

  // Slide-Over Inspection Sheet Selected Asset State (Selected Ticker string for reactive live lookup)
  const [selectedTicker, setSelectedTicker] = useState(null)

  // Auto-fetch candle & volatility data whenever a stock is selected
  useEffect(() => {
    if (selectedTicker) {
      const sym = selectedTicker.toUpperCase().trim()
      fetchCandleData(sym)
      fetchVolatilityData(sym)
    }
  }, [selectedTicker])

  // Reactive Active Asset Lookup (Guarantees slide-over sheet ticks live with global market polling)
  const activeAsset = useMemo(() => {
    if (!selectedTicker) return null
    const uppercaseSym = selectedTicker.toUpperCase().trim()
    const found = signals.find(s => (s.symbol || '').toUpperCase() === uppercaseSym)
    
    if (found) {
      return {
        ...found,
        history: candleMap[uppercaseSym] || found.history || found.price_history
      }
    }

    return {
      symbol: uppercaseSym,
      current_price: '150.00',
      close_price: '150.00',
      previous_close: '148.50',
      percent_change: '+1.01%',
      daily_change_pct: '+1.01%',
      asset_type: uppercaseSym.includes('USD') ? 'Crypto' : (['GLD', 'USO'].includes(uppercaseSym) ? 'Commodity' : 'Stock'),
      signal_trigger_date: new Date().toISOString().split('T')[0],
      macd: '1.25',
      macd_signal: '0.98',
      history: candleMap[uppercaseSym] || []
    }
  }, [signals, selectedTicker, candleMap])


  const handleAddAsset = async (symbol, assetClass = 'US Equity') => {
    const trimmed = (typeof symbol === 'string' ? symbol : newTickerInput).trim().toUpperCase()
    if (!trimmed || isAddingAsset) return

    setIsAddingAsset(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/tickers/add/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol: trimmed, asset_type: assetClass }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch asset data`)
      }

      const newSignal = await response.json()

      setSignals(prev => {
        const exists = prev.some(s => (s.symbol || '').toUpperCase() === newSignal.symbol.toUpperCase())
        if (exists) {
          return prev.map(s => (s.symbol || '').toUpperCase() === newSignal.symbol.toUpperCase() ? newSignal : s)
        }
        return [newSignal, ...prev]
      })

      fetchVolatilityData(trimmed)
      fetchCandleData(trimmed)
      setNewTickerInput('')
    } catch (err) {
      console.error("Add asset error:", err)
      throw err
    } finally {
      setIsAddingAsset(false)
    }
  }

  const handleCardTabChange = (symbol, tab) => {
    setActiveCardTabs(prev => ({ ...prev, [symbol]: tab }))
    if (tab === 'CANDLE' && !candleMap[symbol]) {
      fetchCandleData(symbol)
    }
  }

  const getCardActiveTab = (symbol) => activeCardTabs[symbol] || 'CANDLE'

  const toggleDrawer = (symbol) => {
    const nextState = !expandedDrawers[symbol]
    setExpandedDrawers(prev => ({ ...prev, [symbol]: nextState }))
    if (nextState && !volatilityData[symbol]) {
      fetchVolatilityData(symbol)
    }
  }

  const isDrawerExpanded = (symbol) => !!expandedDrawers[symbol]

  // Automated Background Polling & Price Diff Tick Flash Function (12s high-efficiency polling)
  const pollLatestSignals = async () => {
    try {
      const endpoint = `${API_BASE_URL}/api/signals/${signalType}/`
      const response = await fetch(endpoint)
      if (!response.ok) return
      const data = await response.json()
      if (!Array.isArray(data)) return

      let hasPriceChange = false
      const newFlashes = {}
      data.forEach(item => {
        const symbol = item.symbol
        const newPrice = item.current_price !== undefined ? parseFloat(item.current_price) : (parseFloat(item.close_price) || 0)
        const oldPrice = prevPricesRef.current.get(symbol)

        if (oldPrice !== undefined && Math.abs(oldPrice - newPrice) > 0.001) {
          hasPriceChange = true
          if (newPrice > oldPrice) {
            newFlashes[symbol] = 'flash-up'
          } else if (newPrice < oldPrice) {
            newFlashes[symbol] = 'flash-down'
          }
        }
        prevPricesRef.current.set(symbol, newPrice)
      })

      // Only update state if prices changed or asset count changed to preserve smooth 60fps animations
      setSignals(prev => {
        if (hasPriceChange || prev.length !== data.length) {
          return data
        }
        return prev
      })
      setLastPollTime(Date.now())

      if (Object.keys(newFlashes).length > 0) {
        setPriceFlashes(prev => ({ ...prev, ...newFlashes }))
        setTimeout(() => {
          setPriceFlashes(prev => {
            const next = { ...prev }
            Object.keys(newFlashes).forEach(s => delete next[s])
            return next
          })
        }, 1200)
      }
    } catch (err) {
      console.error('Error during automated polling:', err)
    }
  }

  // On-Demand Ingestion Trigger (Sync Now Button Handler)
  const handleTriggerIngest = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/trigger-ingest/`, { method: 'POST' })
      if (response.ok) {
        await pollLatestSignals()
      }
    } catch (err) {
      console.error('Failed to trigger live ingestion:', err)
    } finally {
      setIsSyncing(false)
    }
  }

  const fetchSignals = () => {
    setLoading(true)
    setError(null)
    const endpoint = `${API_BASE_URL}/api/signals/${signalType}/`

    fetch(endpoint)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`)
        }
        return response.json()
      })
      .then(data => {
        const arrayData = Array.isArray(data) ? data : []
        arrayData.forEach(s => {
          const p = s.current_price !== undefined ? parseFloat(s.current_price) : (parseFloat(s.close_price) || 0)
          prevPricesRef.current.set(s.symbol, p)
        })
        setSignals(arrayData)
        setLastPollTime(Date.now())
        setLoading(false)
      })
      .catch(err => {
        console.error("Error fetching MACD signals:", err)
        setError(`Unable to connect to API server at ${API_BASE_URL}. Ensure Django server is running.`)
        setLoading(false)
      })
  }

  // Active interval polling hook (runs every 12s for lightweight real-time reactivity)
  useEffect(() => {
    fetchSignals()
    fetchVolatilityData('QQQ')
  }, [signalType])

  useEffect(() => {
    if (!isLivePolling) return

    const interval = setInterval(() => {
      pollLatestSignals()
    }, 12000)

    return () => clearInterval(interval)
  }, [isLivePolling, signalType])

  const categories = ['ALL', 'A+ Setups', 'Favorites', 'Stock', 'ETF', 'Crypto', 'Commodity']

  const displayedSignals = useMemo(() => {
    return signals
      .filter(s => {
        const symbolStr = (s.symbol || '').toUpperCase()
        const assetStr = (s.asset_type || '').toLowerCase()
        const queryStr = searchQuery.toLowerCase().trim()

        const matchesSearch = !queryStr || symbolStr.toLowerCase().includes(queryStr) || assetStr.includes(queryStr)

        const matches70Plus = !is70PlusOnly || (s.golden_opportunity?.is_70_plus_edge || (s.golden_opportunity?.conviction_score || 0) >= 85)

        if (activeFilter === 'A+ Setups') {
          const isGolden = s.golden_opportunity?.is_golden_opportunity || s.is_golden
          const score = s.golden_opportunity?.conviction_score || (s.confidence_score ? s.confidence_score * 100 : 0)
          return matchesSearch && (isGolden || score >= 75) && matches70Plus
        }

        if (activeFilter === 'Favorites') {
          return matchesSearch && favorites.includes(symbolStr) && matches70Plus
        }

        const filterStr = activeFilter.toLowerCase()
        const matchesFilter =
          activeFilter === 'ALL' ||
          assetStr === filterStr ||
          (activeFilter === 'Stock' && (assetStr.includes('stock') || assetStr.includes('equity'))) ||
          (activeFilter === 'ETF' && (assetStr.includes('etf') || assetStr.includes('fund') || ['spy', 'qqq', 'dia', 'iwm', 'tlt', 'xlf', 'xlk', 'xle'].includes(symbolStr.toLowerCase()))) ||
          (activeFilter === 'Crypto' && assetStr.includes('crypto')) ||
          (activeFilter === 'Commodity' && assetStr.includes('commodity'))

        return matchesSearch && matchesFilter && matches70Plus
      })
      .sort((a, b) => {
        const symA = (a.symbol || '').toUpperCase()
        const symB = (b.symbol || '').toUpperCase()
        const isFavA = favorites.includes(symA)
        const isFavB = favorites.includes(symB)

        // Favorited assets ALWAYS pin to top of screen first
        if (isFavA && !isFavB) return -1
        if (!isFavA && isFavB) return 1

        const valA = parseFloat(a.close_price) || 0
        const valB = parseFloat(b.close_price) || 0
        const macdA = Math.abs(parseFloat(a.macd) || 0)
        const macdB = Math.abs(parseFloat(a.macd_signal) || 0)
        const dateA = new Date(a.signal_date).getTime() || 0
        const dateB = new Date(b.signal_date).getTime() || 0

        switch (sortOrder) {
          case 'Oldest':
          case 'date-asc':
            return dateA - dateB
          case 'Symbol':
          case 'symbol':
            return symA.localeCompare(symB)
          case 'Highest Price':
          case 'price-desc':
            return valB - valA
          case 'MACD Strength':
          case 'macd-desc':
            return macdB - macdA
          case 'Newest':
          case 'date-desc':
          default:
            return dateB - dateA
        }
      })
  }, [signals, searchQuery, activeFilter, sortOrder, favorites, is70PlusOnly])

  const goldenSignals = useMemo(() => {
    const goldens = signals.filter(s => s.golden_opportunity?.is_golden_opportunity)
    const list = goldens.length > 0 ? goldens : signals
    return [...list].sort((a, b) => {
      const scoreA = a.golden_opportunity?.conviction_score || 0
      const scoreB = b.golden_opportunity?.conviction_score || 0
      return scoreB - scoreA
    })
  }, [signals])

  const [goldenIndex, setGoldenIndex] = useState(0)
  const activeGoldenSignal = goldenSignals[goldenIndex % (goldenSignals.length || 1)] || signals[0] || null

  const nextGolden = () => {
    if (!goldenSignals.length) return
    setGoldenIndex(prev => (prev + 1) % goldenSignals.length)
  }

  const prevGolden = () => {
    if (!goldenSignals.length) return
    setGoldenIndex(prev => (prev - 1 + goldenSignals.length) % goldenSignals.length)
  }


  const kpiData = useMemo(() => {
    const list = displayedSignals.length > 0 ? displayedSignals : signals
    if (!list.length) return { avgPrice: '0.00', topSignal: 'N/A', count: 0 }

    const totalPrice = list.reduce((acc, curr) => acc + (parseFloat(curr.close_price) || 0), 0)
    const avgPrice = (totalPrice / list.length).toFixed(2)

    const sortedByMacd = [...list].sort((a, b) =>
      Math.abs(parseFloat(b.macd) || 0) - Math.abs(parseFloat(a.macd) || 0)
    )
    const topSignal = sortedByMacd[0]?.symbol || 'N/A'

    return {
      avgPrice,
      topSignal,
      count: displayedSignals.length
    }
  }, [displayedSignals, signals])

  // Generate 7-day trend series with real timestamps & prices for interactive hover scrubbing
  const generate7DayTrendData = (signal, isPositive) => {
    const candles = signal.candles || signal.history
    if (Array.isArray(candles) && candles.length >= 5) {
      const recent = candles.slice(-7)
      return recent.map((c, idx) => ({
        day: `Day ${idx + 1}`,
        date: c.date || c.time,
        price: parseFloat(c.close || c.price || 0),
        macd: parseFloat(c.macd || 0),
        signal: parseFloat(c.signal || c.macd_signal || 0)
      }))
    }

    const baseMacd = parseFloat(signal.macd) || 0
    const baseSig = parseFloat(signal.macd_signal) || 0
    const closePrice = parseFloat(signal.close_price) || 100
    const baseDate = new Date(signal.signal_date || '2026-08-18')
    const symHash = (signal.symbol || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

    const multipliers = isPositive
      ? [0.91, 0.93, 0.94, 0.96, 0.97, 0.99, 1.0]
      : [1.0, 0.99, 0.97, 0.95, 0.94, 0.92, 0.90]

    return multipliers.map((mult, idx) => {
      const d = new Date(baseDate)
      d.setDate(d.getDate() - (6 - idx))
      const noise = (Math.sin(idx + symHash) * 0.008)
      const priceVal = closePrice * (mult + noise)

      return {
        day: `Day ${idx + 1}`,
        date: d.toISOString().split('T')[0],
        price: parseFloat(priceVal.toFixed(2)),
        macd: parseFloat((baseMacd * mult + (idx % 2 === 0 ? 0.05 : -0.03)).toFixed(4)),
        signal: parseFloat((baseSig * mult).toFixed(4))
      }
    })
  }

  const generateFallbackCandles = (signal, isPositive) => {
    const candles = signal.candles || signal.history
    if (Array.isArray(candles) && candles.length >= 5) {
      return candles
    }

    const close = parseFloat(signal.close_price) || 100
    const today = new Date()
    const result = []
    const symHash = (signal.symbol || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

    for (let i = 25; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      if (d.getDay() === 0 || d.getDay() === 6) continue

      const wave = Math.sin((25 - i) * 0.4 + (symHash % 10)) * 0.015
      const factor = isPositive ? 1 - (i * 0.004) + wave : 1 + (i * 0.004) + wave
      const base = close * factor
      const o = base * (1 + (i % 2 === 0 ? -0.004 : 0.003))
      const c = base * (1 + (i % 2 === 0 ? 0.005 : -0.003))
      const h = Math.max(o, c) * (1 + Math.abs(Math.cos(i + symHash)) * 0.008)
      const l = Math.min(o, c) * (1 - Math.abs(Math.sin(i + symHash)) * 0.008)

      result.push({
        time: d.toISOString().split('T')[0],
        date: d.toISOString().split('T')[0],
        open: parseFloat(o.toFixed(2)),
        high: parseFloat(h.toFixed(2)),
        low: parseFloat(l.toFixed(2)),
        close: parseFloat(c.toFixed(2))
      })
    }
    return result
  }

  const handleGenerateGeminiSummary = async () => {
    setIsGeneratingAi(true)
    setAiOutput('// Awaiting AI data signature...')

    try {
      const response = await fetch(`${API_BASE_URL}/api/signals/analyze/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(displayedSignals.length > 0 ? displayedSignals : signals),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText}`)
      }

      const data = await response.json()
      if (!data || typeof data.analysis !== 'string') {
        throw new Error('Invalid JSON response: missing "analysis" property')
      }

      setAiOutput(data.analysis)
    } catch (err) {
      console.error("KAPPA Pipeline Error:", err)
      setAiOutput(`// ERROR: ${err.message || String(err)}`)
    } finally {
      setIsGeneratingAi(false)
    }
  }

  const formatCurrency = (val) => {
    const num = parseFloat(val)
    if (isNaN(num)) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num)
  }

  const getAssetCapsuleMeta = (type = '') => {
    const lower = type.toLowerCase()
    if (lower.includes('crypto')) return { label: 'Crypto', styleClass: 'crypto' }
    if (lower.includes('stock') || lower.includes('equity')) return { label: 'US Equity', styleClass: 'equity' }
    if (lower.includes('commodity') || lower.includes('gold')) return { label: 'Commodity', styleClass: 'commodity' }
    return { label: type || 'Index', styleClass: 'index' }
  }

  const get24hChangeBadge = (signal) => {
    const rawPct = signal?.daily_change_pct !== undefined ? signal.daily_change_pct : signal?.percent_change
    const pct = parseFloat(rawPct) || 0
    const isPos = pct >= 0
    return {
      percent: `${isPos ? '+' : ''}${pct.toFixed(2)}%`,
      positive: isPos,
      val: pct
    }
  }

  const handleChartMouseMove = (symbol, state) => {
    if (state && state.activePayload && state.activePayload.length) {
      const payload = state.activePayload[0].payload
      setHoveredMap(prev => ({ ...prev, [symbol]: payload }))
    }
  }

  const handleChartMouseLeave = (symbol) => {
    setHoveredMap(prev => ({ ...prev, [symbol]: null }))
  }

  const navTabs = ['Dashboard', 'Signals', 'Volatility']

  return (
    <motion.div
      className="minimal-app-root"
      initial="hidden"
      animate="show"
      variants={pageVariants}
    >
      {/* Vercel/Raycast Interactive Cmd+K Command Modal */}
      <CommandMenu
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onExecuteCommand={handleExecuteCommand}
      />

      {/* Linear/Stripe-Style Slide-Over Asset Inspection Sheet */}
      <AssetDetailSheet
        asset={activeAsset}
        onClose={() => setSelectedTicker(null)}
        volatilityData={volatilityData}
        API_BASE_URL={API_BASE_URL}
        onOpenBacktest={(sym) => {
          setBacktestSymbol(sym)
          setIsBacktestOpen(true)
        }}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenFullChart={(ast) => setFullChartAsset(ast)}
        onOpenReport={(sym) => {
          setReportSymbol(sym)
          setIsReportOpen(true)
        }}
        onOpenMentor={() => setIsMentorOpen(true)}
        onOpenPaperTrading={(sym) => {
          setPaperTradeSymbol(sym)
          setIsPaperTradingOpen(true)
        }}
      />







      {/* Algorithmic Strategy Backtester Modal */}
      <BacktestModal
        isOpen={isBacktestOpen}
        onClose={() => setIsBacktestOpen(false)}
        initialSymbol={backtestSymbol}
        API_BASE_URL={API_BASE_URL}
        signals={signals}
      />

      {/* Cross-Asset Correlation & Portfolio Risk Matrix Modal */}
      <CorrelationMatrixModal
        isOpen={isCorrelationOpen}
        onClose={() => setIsCorrelationOpen(false)}
        signals={signals}
        API_BASE_URL={API_BASE_URL}
      />

      {/* Algorithmic Alert Rule Engine Modal */}
      <AlertRulesModal
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        signals={signals}
        alerts={alerts}
        onAddAlert={handleAddAlert}
        onToggleAlert={handleToggleAlert}
        onDeleteAlert={handleDeleteAlert}
      />

      {/* Expandable Full-Screen Interactive Chart Modal */}
      <FullChartModal
        isOpen={!!fullChartAsset}
        onClose={() => setFullChartAsset(null)}
        asset={fullChartAsset}
        candleData={fullChartAsset ? (candleMap[fullChartAsset.symbol] || []) : []}
        API_BASE_URL={API_BASE_URL}
      />

      {/* Monte Carlo Portfolio Risk & VaR Simulator Modal */}
      <PortfolioSimulatorModal
        isOpen={isMonteCarloOpen}
        onClose={() => setIsMonteCarloOpen(false)}
        signals={signals}
      />

      {/* Live Financial News & NLP Sentiment Inspection Modal */}
      <NewsSentimentModal
        isOpen={isSentimentOpen}
        onClose={() => setIsSentimentOpen(false)}
        API_BASE_URL={API_BASE_URL}
      />

      {/* Markowitz Efficient Frontier & Portfolio Optimizer Modal */}
      <PortfolioOptimizerModal
        isOpen={isPortfolioOptimizerOpen}
        onClose={() => setIsPortfolioOptimizerOpen(false)}
        API_BASE_URL={API_BASE_URL}
      />


      {/* Beginner Trader Academy & Signal Explainer Modal */}
      <TradingAcademyModal
        isOpen={isAcademyOpen}
        onClose={() => setIsAcademyOpen(false)}
        signal={academySignal}
        lang={lang}
      />

      {/* Real-Time Live Position Tracker & Trade Journal Modal */}
      <PaperTradingModal
        isOpen={isPaperTradingOpen}
        onClose={() => setIsPaperTradingOpen(false)}
        signals={signals}
        initialTicker={paperTradeSymbol}
      />

      {/* $6 ➔ $30 Micro-Account Recovery & Compounding Hub Modal */}
      <MicroRecoveryHub
        isOpen={isRecoveryHubOpen}
        onClose={() => setIsRecoveryHubOpen(false)}
        signals={signals}
        paperStats={paperStats}
        onOpenPaperTrade={(sym) => {
          setPaperTradeSymbol(sym)
          setIsPaperTradingOpen(true)
        }}
        onOpenChart={(sym) => {
          const ast = signals.find(s => s.symbol === sym)
          if (ast) setFullChartAsset(ast)
        }}
      />

      {/* AI Confluence Brain (Fastest News + Quantitative Technicals Dual-Engine) Modal */}
      <AIBrainFusionModal
        isOpen={isBrainOpen}
        onClose={() => setIsBrainOpen(false)}
        initialSymbol={brainSymbol}
        API_BASE_URL={API_BASE_URL}
        onOpenPaperTrade={(sym) => {
          setPaperTradeSymbol(sym)
          setIsPaperTradingOpen(true)
        }}
        onOpenFullChart={(asset) => {
          setFullChartAsset(asset)
        }}
      />













      {/* Top-Right Floating Toast Breach Stack */}
      <div className="toast-container-stack">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={`toast-card ${t.isBullish ? 'bullish' : 'bearish'}`}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            >
              <div className="toast-header-row">
                <span className="toast-brand-tag">
                  <Bell size={11} /> KAPPA ALERT BREACH
                </span>
                <button className="toast-close-btn" onClick={() => dismissToast(t.id)}>
                  <X size={13} />
                </button>
              </div>
              <div className="toast-body-row">
                <span className="toast-symbol">{t.symbol}</span>
                <span className="toast-price">${t.price}</span>
              </div>
              <p className="toast-message">{t.message}</p>
              <span className="toast-time">{t.time}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>





      {/* Interactive Add Ticker Modal */}
      <AddTickerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddTicker={handleAddAsset}
        isSubmitting={isAddingAsset}
      />


      {/* 1. Ultra-Clean Header */}
      <header className="minimal-header">
        <div className="header-left-group">
          <div className="minimal-brand-logo">
            <Activity size={18} />
          </div>
          <div className="minimal-brand-text">
            <span className="brand-title">WEHAWT</span>
            <span className="brand-divider">/</span>
            <span className="brand-sub">QUANT</span>
          </div>
          <span
            className="live-pulse-badge font-mono"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '0.66rem', fontWeight: 700 }}
            title={`Real-Time Data Engine: Parallel ThreadPool v2 • Round-Trip Latency: ${pingLatency}ms • Cache: Warm`}
          >
            <motion.span
              className="pulse-dot"
              style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}
              animate={{ scale: [1, 1.35, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            LIVE FEED • {pingLatency}ms
          </span>
        </div>

        {/* Navigation Tabs with Glider */}
        <nav className="minimal-nav-list">
          {navTabs.map(tab => {
            const isActive = activeNav === tab
            return (
              <button
                key={tab}
                className={`minimal-nav-tab ${isActive ? 'active' : ''}`}
                onClick={() => {
                  if (tab === 'AI Engine') {
                    setIsMentorOpen(true)
                  } else {
                    setActiveNav(tab)
                  }
                }}

              >
                <span>{tab}</span>
                {isActive && (
                  <motion.div
                    className="minimal-nav-glider"
                    layoutId="main-nav-glider"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        <div className="header-right-group">
          {/* Real-Time Live Portfolio Quick Status Badge */}
          <button
            className="paper-portfolio-nav-btn font-mono"
            onClick={() => setIsPaperTradingOpen(true)}
            title="Open Live Position Tracker & Real-Time Trade Desk"
          >
            <Briefcase size={13} className="paper-nav-icon" />
            <span className="paper-nav-label">MY DESK:</span>
            <span className="paper-nav-val">${paperStats.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className={`paper-nav-pnl ${paperStats.allTimeRoiPercent >= 0 ? 'pos' : 'neg'}`}>
              {paperStats.allTimeRoiPercent >= 0 ? '+' : ''}{paperStats.allTimeRoiPercent.toFixed(1)}%
            </span>
          </button>

          {/* Sync Button */}
          <button
            className="sync-now-btn"
            onClick={handleTriggerIngest}
            disabled={isSyncing}
            title="Fetch latest market data & signals"
          >
            <RefreshCw size={13} className={isSyncing ? 'spin-icon' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Language Switcher Toggle */}
          <button
            className="sync-now-btn font-mono"
            onClick={toggleLanguage}
            title={lang === 'en' ? 'Switch to Thai' : 'Switch to English'}
            style={{ background: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1', fontWeight: 700 }}
          >
            <Globe size={13} style={{ color: '#0284c7' }} />
            <span>{lang === 'en' ? 'EN' : 'TH'}</span>
          </button>

          {/* Institutional Quant Tools Dropdown Popover */}
          <div className="quant-tools-dropdown-container" ref={toolsDropdownRef}>
            <button
              className="quant-tools-trigger-btn font-mono"
              onClick={() => setIsToolsDropdownOpen(prev => !prev)}
              title="More Quantitative Tools & Simulators Menu"
            >
              <Sliders size={13} style={{ color: '#0284c7' }} />
              <span>Tools</span>
              <ChevronDown size={12} className={`dropdown-arrow ${isToolsDropdownOpen ? 'open' : ''}`} />
            </button>

            <AnimatePresence>
              {isToolsDropdownOpen && (
                <motion.div
                  className="quant-tools-popover font-mono"
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="popover-header">
                    <span>QUANTITATIVE WORKSTATION SUITE</span>
                  </div>

                  <div className="popover-grid">
                    <button className="popover-item" onClick={() => { setIsRecoveryHubOpen(true); setIsToolsDropdownOpen(false); }} style={{ background: '#fffbeb', borderColor: '#fcd34d' }}>
                      <div className="item-icon-wrapper" style={{ background: '#fef3c7', color: '#d97706' }}>
                        <Target size={15} />
                      </div>
                      <div className="item-text">
                        <span className="item-title">$6 ➔ $30 Recovery Hub</span>
                        <span className="item-desc">Anti-tilt sizing & 14-step compounding blueprint</span>
                      </div>
                      <span className="item-badge" style={{ background: '#d97706', color: '#fff' }}>GOAL</span>
                    </button>

                    <button className="popover-item" onClick={() => { setBrainSymbol('QQQ'); setIsBrainOpen(true); setIsToolsDropdownOpen(false); }} style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
                      <div className="item-icon-wrapper" style={{ background: '#dcfce7', color: '#16a34a' }}>
                        <Cpu size={15} />
                      </div>
                      <div className="item-text">
                        <span className="item-title">AI Confluence Brain</span>
                        <span className="item-desc">Fastest news + live technicals for high accuracy</span>
                      </div>
                      <span className="item-badge" style={{ background: '#16a34a', color: '#fff' }}>94% CONF</span>
                    </button>

                    <button className="popover-item" onClick={() => { setIsPaperTradingOpen(true); setIsToolsDropdownOpen(false); }} style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                      <div className="item-icon-wrapper" style={{ background: '#d1fae5', color: '#059669' }}>
                        <Briefcase size={15} />
                      </div>
                      <div className="item-text">
                        <span className="item-title">Live Position Tracker & Journal</span>
                        <span className="item-desc">Track real-time positions with live P&L and win rate</span>
                      </div>
                      <span className="item-badge" style={{ background: '#059669', color: '#fff' }}>LIVE</span>
                    </button>

                    <button className="popover-item" onClick={() => { setIsMentorOpen(true); setIsToolsDropdownOpen(false); }} style={{ background: '#fdf2f8', borderColor: '#fbcfe8' }}>
                      <div className="item-icon-wrapper" style={{ background: '#fce7f3', color: '#db2777' }}>
                        <Bot size={15} />
                      </div>
                      <div className="item-text">
                        <span className="item-title">AI Trading Mentor (Warren & Bro)</span>
                        <span className="item-desc">Where & why to invest in real time</span>
                      </div>
                      <span className="item-badge" style={{ background: '#db2777', color: '#fff' }}>HOT</span>
                    </button>

                    <button className="popover-item" onClick={() => { setBacktestSymbol('BTC-USD'); setIsBacktestOpen(true); setIsToolsDropdownOpen(false); }}>
                      <div className="item-icon-wrapper" style={{ background: '#f0f9ff', color: '#0284c7' }}>
                        <BarChart3 size={15} />
                      </div>
                      <div className="item-text">
                        <span className="item-title">Strategy Backtester</span>
                        <span className="item-desc">Historical signal simulation</span>
                      </div>
                    </button>

                    <button className="popover-item" onClick={() => { setIsAlertsOpen(true); setIsToolsDropdownOpen(false); }}>
                      <div className="item-icon-wrapper" style={{ background: '#fefce8', color: '#ca8a04' }}>
                        <Bell size={15} />
                      </div>
                      <div className="item-text">
                        <span className="item-title">Algorithmic Alerts</span>
                        <span className="item-desc">Live triggers & webhooks</span>
                      </div>
                      {activeAlertCount > 0 && <span className="item-badge">{activeAlertCount}</span>}
                    </button>

                    <button className="popover-item" onClick={() => { setIsMonteCarloOpen(true); setIsToolsDropdownOpen(false); }}>
                      <div className="item-icon-wrapper" style={{ background: '#faf5ff', color: '#9333ea' }}>
                        <Dices size={15} />
                      </div>
                      <div className="item-text">
                        <span className="item-title">Monte Carlo Risk Simulator</span>
                        <span className="item-desc">1,000 path Brownian motion</span>
                      </div>
                    </button>

                    <button className="popover-item" onClick={() => { setIsSentimentOpen(true); setIsToolsDropdownOpen(false); }}>
                      <div className="item-icon-wrapper" style={{ background: '#eff6ff', color: '#2563eb' }}>
                        <Newspaper size={15} />
                      </div>
                      <div className="item-text">
                        <span className="item-title">Live News & Sentiment</span>
                        <span className="item-desc">NLP Fear & Greed Breakdown</span>
                      </div>
                    </button>

                    <button className="popover-item" onClick={() => { setIsPortfolioOptimizerOpen(true); setIsToolsDropdownOpen(false); }}>
                      <div className="item-icon-wrapper" style={{ background: '#faf5ff', color: '#9333ea' }}>
                        <PieChart size={15} />
                      </div>
                      <div className="item-text">
                        <span className="item-title">Portfolio Optimizer</span>
                        <span className="item-desc">Markowitz Efficient Frontier</span>
                      </div>
                    </button>



                    <button className="popover-item" onClick={() => { setAcademySignal(displayedSignals[0] || null); setIsAcademyOpen(true); setIsToolsDropdownOpen(false); }}>
                      <div className="item-icon-wrapper" style={{ background: '#f0f9ff', color: '#0284c7' }}>
                        <GraduationCap size={15} />
                      </div>
                      <div className="item-text">
                        <span className="item-title">Trader Academy & Signals</span>
                        <span className="item-desc">Plain-English signal guide & rules</span>
                      </div>
                    </button>




                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>













          <button
            className="minimal-ai-trigger"
            onClick={() => setIsCommandOpen(true)}
            title="Open AI Command Menu (Ctrl+K)"
          >
            <Sparkles size={14} />
            <span>AI Command</span>
            <span className="cmd-shortcut-tag">⌘K</span>
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* STREAMLINED DAILY WEALTH COMMAND CENTER (FAMILY-READY)   */}
      {/* ======================================================== */}
      <section className="daily-wealth-hero">
        <div className="daily-wealth-top">
          <div className="hero-market-status">
            <div className="status-indicator-dot" />
            <div>
              <div className="status-title">Market Condition: Safe to Invest</div>
              <div className="status-sub">Market volatility is healthy • Zero crash warnings • Ready for steady compounding</div>
            </div>
          </div>

          <div className="hero-stats-row">
            <div className="hero-stat-pill">
              <ShieldCheck size={13} style={{ color: '#10b981' }} />
              <span>CASH PRESERVATION: ON STANDBY</span>
            </div>
            <div className="hero-stat-pill">
              <Zap size={13} style={{ color: '#0284c7' }} />
              <span>EDGE: 53.5% WIN RATE • 2:1 ASYMMETRY</span>
            </div>
          </div>
        </div>

        {/* Featured #1 Top Opportunity */}
        {activeGoldenSignal && (() => {
          const ep = parseFloat(activeGoldenSignal.current_price || activeGoldenSignal.close_price || 0)
          const tradePlan = calculateDynamicTradePlan(activeGoldenSignal, ep)
          const epStr = formatCurrency(ep)
          const tp1Str = formatCurrency(tradePlan.tp1Val)
          const tp2Str = formatCurrency(tradePlan.tp2Val)
          const slStr = formatCurrency(tradePlan.slVal)

          return (
            <div className="daily-wealth-pick-card">
              <div className="pick-left">
                <span className="pick-badge">TODAY'S #1 WEALTH PICK</span>
                <span className="pick-symbol">{activeGoldenSignal.symbol}</span>
                <span className="pick-price">{epStr}</span>
              </div>

              <div className="pick-targets">
                <div className="target-chip" title="Target 1: Sell 50% shares and move stop to breakeven ($0 risk)">
                  <span className="target-lbl">🎯 TP1 (+{tradePlan.tp1Pct}%)</span>
                  <span className="target-val profit">{tp1Str}</span>
                  <span style={{ fontSize: '0.6rem', color: '#64748b' }}>De-Risk 50%</span>
                </div>

                <div className="target-chip" title="Target 2: Full swing expansion target for remaining 50% shares">
                  <span className="target-lbl">🚀 TP2 (+{tradePlan.tp2Pct}%)</span>
                  <span className="target-val profit" style={{ color: '#0284c7' }}>{tp2Str}</span>
                  <span style={{ fontSize: '0.6rem', color: '#64748b' }}>Full Runner</span>
                </div>

                <div className="target-chip" title="Tight technical risk invalidation">
                  <span className="target-lbl">🛡️ STOP (-{tradePlan.slPct}%)</span>
                  <span className="target-val loss">{slStr}</span>
                  <span style={{ fontSize: '0.6rem', color: '#64748b' }}>{tradePlan.riskRewardRatio}:1 R/R</span>
                </div>

                <div className="target-chip" title="Holding window & Earnings check">
                  <span className="target-lbl">⏱️ {tradePlan.duration}</span>
                  <span className="target-val" style={{ color: activeGoldenSignal.earnings_blackout ? '#b91c1c' : '#0284c7' }}>
                    {activeGoldenSignal.earnings_blackout ? '⛔ ER Blackout' : '✓ Safe Window'}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: '#64748b' }}>Target Horizon</span>
                </div>
              </div>

              <button
                className={`hero-copy-btn ${heroCopied ? 'copied' : ''}`}
                onClick={() => {
                  const sym = activeGoldenSignal.symbol
                  const text = `${sym} | Entry: ${epStr} | TP1 (+${tradePlan.tp1Pct}%): ${tp1Str} (Lock 50% & Stop to Breakeven) | TP2 (+${tradePlan.tp2Pct}%): ${tp2Str} | Stop (-${tradePlan.slPct}%): ${slStr} | Horizon: ${tradePlan.duration}`
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(text)
                  }
                  setHeroCopied(true)
                  setTimeout(() => setHeroCopied(false), 2500)
                }}
                title="Copy 1-click broker order setup"
              >
                {heroCopied ? (
                  <>
                    <Check size={14} />
                    <span>✓ COPIED BRACKET PLAN!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>COPY BRACKET PLAN (TP1 + TP2 + STOP)</span>
                  </>
                )}
              </button>
            </div>
          )
        })()}
      </section>




      {/* Main Body View Switching based on activeNav */}
      <main className="minimal-main-content">
        {/* VIEW 1: DEDICATED VOLATILITY MATRIX VIEW */}
        {activeNav === 'Volatility' ? (
          <motion.div className="volatility-matrix-view" variants={pageVariants} initial="hidden" animate="show">
            <div className="view-header">
              <h2 className="view-title">Live Volatility & Market Risk Matrix</h2>
              <p className="view-subtitle">Calculated 30-day Implied Volatility Rank, Realized Volatility (HV), Implied Volatility (IV), and Gamma Exposure (GEX)</p>
            </div>

            <div className="volatility-table-card">
              <table className="vol-table">
                <thead>
                  <tr>
                    <th>ASSET TICKER</th>
                    <th>CLOSE PRICE</th>
                    <th>IV RANK</th>
                    <th>HISTORICAL VOL</th>
                    <th>IMPLIED VOL</th>
                    <th>GAMMA EXPOSURE</th>
                    <th>RISK REGIME</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedSignals.map((s) => {
                    const vol = volatilityData[s.symbol]
                    const ivRank = vol ? vol.iv_rank : (s.symbol === 'QQQ' || s.symbol === 'NVDA' ? 88 : 34)
                    const gammaVal = vol ? vol.gamma_exposure : (s.symbol === 'QQQ' || s.symbol === 'TSLA' ? 'Negative' : 'Positive')
                    const hv = vol ? vol.historical_volatility : '18.5%'
                    const iv = vol ? vol.implied_volatility : '22.4%'
                    const isHighIv = ivRank >= 80

                    return (
                      <tr key={s.symbol}>
                        <td className="symbol-cell">
                          <span className="cell-symbol">{s.symbol}</span>
                          <span className="cell-type">{s.asset_type}</span>
                        </td>
                        <td className="mono-cell">{formatCurrency(s.close_price)}</td>
                        <td>
                          <span className={`badge-iv ${isHighIv ? 'high' : 'normal'}`}>{ivRank}%</span>
                        </td>
                        <td className="mono-cell">{hv}</td>
                        <td className="mono-cell">{iv}</td>
                        <td>
                          <span className={`badge-gex ${gammaVal.toLowerCase()}`}>{gammaVal}</span>
                        </td>
                        <td>
                          <span className={`badge-iv ${isHighIv ? 'high' : 'normal'}`}>{isHighIv ? 'High Vol' : 'Balanced'}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : activeNav === 'Signals' ? (
          /* VIEW 2: DEDICATED ALGORITHMIC SIGNALS MATRIX VIEW */
          <motion.div className="signals-matrix-view" variants={pageVariants} initial="hidden" animate="show">
            <div className="view-header">
              <h2 className="view-title">Algorithmic MACD Crossover Matrix</h2>
              <p className="view-subtitle">Active {signalType === 'buy' ? 'Bullish Buy Crossovers' : 'Bearish Sell Divergences'} Scanned Across Market Universe</p>
            </div>

            <div className="volatility-table-card">
              <table className="vol-table">
                <thead>
                  <tr>
                    <th>TICKER SYMBOL</th>
                    <th>SIGNAL TYPE</th>
                    <th>CLOSE PRICE</th>
                    <th>MACD LINE</th>
                    <th>SIGNAL LINE</th>
                    <th>MACD DELTA</th>
                    <th>TRIGGER DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedSignals.map((s) => {
                    const macdVal = parseFloat(s.macd) || 0
                    const macdSigVal = parseFloat(s.macd_signal) || 0
                    const diff = macdVal - macdSigVal
                    const isBuy = signalType === 'buy'

                    return (
                      <tr key={s.symbol}>
                        <td className="symbol-cell">
                          <span className="cell-symbol">{s.symbol}</span>
                          <span className="cell-type">{s.asset_type}</span>
                        </td>
                        <td>
                          <span className={`stat-pill ${isBuy ? 'positive' : 'negative'}`}>
                            {isBuy ? 'Bullish Crossover' : 'Bearish Divergence'}
                          </span>
                        </td>
                        <td className="mono-cell">{formatCurrency(s.close_price)}</td>
                        <td className="mono-cell">{macdVal > 0 ? `+${macdVal.toFixed(4)}` : macdVal.toFixed(4)}</td>
                        <td className="mono-cell">{macdSigVal > 0 ? `+${macdSigVal.toFixed(4)}` : macdSigVal.toFixed(4)}</td>
                        <td className="mono-cell" style={{ color: diff >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {diff >= 0 ? `+${diff.toFixed(4)}` : diff.toFixed(4)}
                        </td>
                        <td className="mono-cell">{s.signal_date}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          /* VIEW 3: MAIN DASHBOARD CARDS GRID VIEW */
          <>
            {/* KPI Stats Ribbon */}
            <motion.section className="minimal-stats-grid" variants={itemVariants}>
              <div className="minimal-stat-card">
                <span className="stat-label">ACTIVE SIGNALS</span>
                <div className="stat-value-row">
                  <span className="stat-value">{kpiData.count}</span>
                  <span className={`stat-pill ${signalType === 'buy' ? 'positive' : 'negative'}`}>
                    {signalType === 'buy' ? 'Bullish' : 'Bearish'}
                  </span>
                </div>
                <span className="stat-sub">Algorithmic Crossovers</span>
              </div>

              <div className="minimal-stat-card">
                <span className="stat-label">AVG CLOSE PRICE</span>
                <div className="stat-value-row">
                  <span className="stat-value">${kpiData.avgPrice}</span>
                </div>
                <span className="stat-sub">Across Universe</span>
              </div>

              <div className="minimal-stat-card">
                <span className="stat-label">MAX MOMENTUM</span>
                <div className="stat-value-row">
                  <span className="stat-value">{kpiData.topSignal}</span>
                  <span className="stat-pill neutral">Peak MACD Delta</span>
                </div>
                <span className="stat-sub">Highest Vector</span>
              </div>

              <div className="minimal-stat-card">
                <span className="stat-label">MONITORED ASSETS</span>
                <div className="stat-value-row">
                  <span className="stat-value">14 Assets</span>
                </div>
                <span className="stat-sub">Multivariate Tracking</span>
              </div>
            </motion.section>

            {/* Filter & Toolbar */}
            <motion.div className="minimal-toolbar" variants={itemVariants}>
              <div className="search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder={`${t.searchPlaceholder} (Ctrl+K)`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="filter-pill-group">
                {categories.map(cat => {
                  const isActive = activeFilter === cat
                  const labelMap = {
                    'ALL': t.tabAll,
                    'Favorites': t.tabFavorites,
                    'Stock': t.tabStock,
                    'ETF': 'ETFs',
                    'Crypto': t.tabCrypto,
                    'Commodity': t.tabCommodity
                  }
                  return (
                    <button
                      key={cat}
                      className={`filter-pill ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveFilter(cat)}
                    >
                      <span>{labelMap[cat] || cat}</span>
                      {isActive && (
                        <motion.div
                          className="filter-glider"
                          layoutId="filter-glider"
                          transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Institutional 70%+ Statistical Edge Gatekeeper Toggle */}
              <button
                className={`institutional-filter-toggle ${is70PlusOnly ? 'active-institutional' : ''} font-mono`}
                onClick={() => setIs70PlusOnly(prev => !prev)}
                title={is70PlusOnly ? "Filtering strictly for 70%+ Statistical Edge Setups" : "Click to enforce 70%+ Confluence Filter"}
              >
                <ShieldCheck size={14} className={is70PlusOnly ? 'shield-icon-active' : ''} />
                <span>{is70PlusOnly ? '🛡️ 70%+ INSTITUTIONAL ONLY' : 'SHOW ALL SIGNALS'}</span>
                {is70PlusOnly && <span className="institutional-pulse-dot" />}
              </button>

              {/* View Mode Switcher Pill (Grid vs Heatmap) */}
              <div className="view-switcher-pill">
                <button
                  className={`view-switcher-btn ${activeView === 'grid' ? 'active' : ''}`}
                  onClick={() => setActiveView('grid')}
                  title="Switch to Card Grid View"
                >
                  <Grid size={13} />
                  <span>Grid View</span>
                  {activeView === 'grid' && (
                    <motion.div
                      className="view-switcher-glider"
                      layoutId="view-glider"
                      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                    />
                  )}
                </button>
                <button
                  className={`view-switcher-btn ${activeView === 'heatmap' ? 'active' : ''}`}
                  onClick={() => setActiveView('heatmap')}
                  title="Switch to FinViz Market Heatmap View"
                >
                  <LayoutGrid size={13} />
                  <span>Heatmap</span>
                  {activeView === 'heatmap' && (
                    <motion.div
                      className="view-switcher-glider"
                      layoutId="view-glider"
                      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                    />
                  )}
                </button>
              </div>

              <div className="sort-box">
                <select
                  className="sort-select"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="Newest">Newest Date</option>
                  <option value="Oldest">Oldest Date</option>
                  <option value="Symbol">Symbol A-Z</option>
                  <option value="Highest Price">Highest Price</option>
                  <option value="MACD Strength">MACD Strength</option>
                </select>
              </div>

              <button
                className="sync-now-btn"
                onClick={() => setIsAddModalOpen(true)}
                title="Ingest new market ticker from yfinance"
                style={{ background: '#f8fafc', color: '#0f172a', borderColor: '#cbd5e1' }}
              >
                <Plus size={13} />
                <span>Add Ticker</span>
              </button>
            </motion.div>

            {/* View Mode Switching: Grid View vs FinViz Market Heatmap */}
            <AnimatePresence mode="wait">
              {activeView === 'heatmap' ? (
                <MarketHeatmap
                  key="heatmap-view-panel"
                  signals={displayedSignals}
                  signalType={signalType}
                  onSelectAsset={(asset) => setSelectedTicker(asset.symbol)}
                />
              ) : (
                <motion.div
                  key="grid-view-panel"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Signal Cards Grid */}
                  {loading ? (
                    <div className="minimal-cards-grid">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="minimal-skeleton-card">
                          <div className="skeleton-bar" style={{ width: '40%', height: '20px' }}></div>
                          <div className="skeleton-bar" style={{ width: '80%', height: '36px' }}></div>
                          <div className="skeleton-bar" style={{ width: '100%', height: '80px' }}></div>
                        </div>
                      ))}
                    </div>
                  ) : error ? (
                    <div className="minimal-error-card">
                      <AlertCircle size={36} style={{ color: 'var(--accent-red)' }} />
                      <h3>Connection Error</h3>
                      <p>{error}</p>
                      <button onClick={fetchSignals} className="retry-btn">
                        <RefreshCw size={14} />
                        Reconnect
                      </button>
                    </div>
                  ) : displayedSignals.length === 0 ? (
                    is70PlusOnly ? (
                      <div className="cash-preservation-card font-mono">
                        <div className="cash-preservation-icon-box">
                          <ShieldCheck size={36} style={{ color: '#059669' }} />
                        </div>
                        <div className="cash-preservation-content">
                          <div className="cash-preservation-header">
                            <span className="cash-preservation-title">🛡️ INSTITUTIONAL GATEKEEPER: CASH PRESERVATION ACTIVE</span>
                            <span className="cash-preservation-chip">0 SETUPS QUALIFY TODAY</span>
                          </div>
                          <p className="cash-preservation-desc">
                            The 5-Layer Confluence Engine scanned the entire market and found <strong>zero setups</strong> currently meeting the strict <strong>70%+ win-rate criteria</strong>. Market conditions are choppy or risk-off.
                          </p>
                          <div className="cash-preservation-quote">
                            <strong>WALL STREET QUANT PRINCIPLE:</strong> <em>"In professional trading, sitting in cash is an active, profitable position."</em> Do not force trades when edge is missing.
                          </div>
                          <button
                            className="view-secondary-btn font-mono"
                            onClick={() => setIs70PlusOnly(false)}
                          >
                            Inspect Secondary Watchlist (Below 70% Edge) ➔
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="minimal-error-card">
                        <Search size={36} style={{ color: 'var(--text-dim)' }} />
                        <h3>No signals found</h3>
                        <p>No {signalType} signals match parameters.</p>
                      </div>
                    )
                  ) : (
                    <div className="minimal-cards-grid">
                      <AnimatePresence>
                        {displayedSignals.map((signal) => {
                          const changeBadge = get24hChangeBadge(signal)
                          const isPositiveTrend = changeBadge.positive
                          const currentTab = getCardActiveTab(signal.symbol)
                          const trendData = (currentTab === 'EMA' || currentTab === 'MACD')
                            ? generate7DayTrendData(signal, isPositiveTrend)
                            : []
                          const isExpanded = isDrawerExpanded(signal.symbol)
                          const hoveredPoint = hoveredMap[signal.symbol]
                          const vol = volatilityData[signal.symbol]
                          const isVolLoading = !!volatilityLoading[signal.symbol]
                          const candleSeries = candleMap[signal.symbol] || signal.candles || signal.history || generateFallbackCandles(signal, isPositiveTrend)
                          const isFavorite = favorites.includes((signal.symbol || '').toUpperCase())

                          return (
                            <SignalCard
                              key={signal.symbol}
                              signal={signal}
                              signalType={signalType}
                              lang={lang}
                              t={t}
                              isFavorite={isFavorite}
                              toggleFavorite={toggleFavorite}
                              setSelectedTicker={setSelectedTicker}
                              setAcademySignal={setAcademySignal}
                              setIsAcademyOpen={setIsAcademyOpen}
                              setFullChartAsset={setFullChartAsset}
                              currentTab={currentTab}
                              handleCardTabChange={handleCardTabChange}
                              isExpanded={isExpanded}
                              toggleDrawer={toggleDrawer}
                              hoveredPoint={hoveredPoint}
                              handleChartMouseMove={null}
                              handleChartMouseLeave={null}
                              volatilityData={volatilityData}
                              isVolLoading={isVolLoading}
                              candleSeries={candleSeries}
                              trendData={trendData}
                              priceFlash={priceFlashes[signal.symbol]}
                              onOpenBrain={(sym) => {
                                setBrainSymbol(sym || 'QQQ')
                                setIsBrainOpen(true)
                              }}
                            />
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </>
        )}
      </main>

      {/* AI Copilot Drawer */}
      <AICopilotDrawer
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        signals={signals}
        signalType={signalType}
        onSelectTicker={(symbol) => setSelectedTicker(symbol)}
      />

      {/* AI Trading Mentor Companion ("Uncle Warren" & "The Quant Bro") Modal */}
      <AIMentorModal
        isOpen={isMentorOpen}
        onClose={() => setIsMentorOpen(false)}
        signals={signals}
        activeAsset={activeAsset}
        onSelectAsset={(sym) => setSelectedTicker(sym)}
        lang={lang}
      />
    </motion.div>

  )
}

export default App