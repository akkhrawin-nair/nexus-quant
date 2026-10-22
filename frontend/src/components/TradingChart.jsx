import { useEffect, useRef } from 'react'
import { createChart, ColorType, CandlestickSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts'
import { detectSupportResistance, calculateTradeSetupLevels } from '../utils/autoChartingUtils'
const EMPTY = []

/**
 * Formats market price objects into the required lightweight-charts candlestick data structure.
 * Expected input: array of { time/Date, open, high, low, close } or MarketPrices dicts.
 */
function formatCandleData(rawData = []) {
  if (!Array.isArray(rawData)) return []

  const formatted = rawData.map(item => {
    let dateVal = item.time || item.TradeDate || item.trade_date || item.Date || item.date
    if (typeof dateVal === 'string' && dateVal.includes('T')) {
      dateVal = dateVal.split('T')[0]
    }
    if (!dateVal) {
      dateVal = new Date().toISOString().split('T')[0]
    }

    const parseNum = (val) => parseFloat(String(val ?? 0).replace(/[^0-9.-]/g, '')) || 0
    const open = parseNum(item.open ?? item.OpenPrice ?? item.Open ?? item.close_price)
    const high = parseNum(item.high ?? item.HighPrice ?? item.High ?? item.close_price)
    const low = parseNum(item.low ?? item.LowPrice ?? item.Low ?? item.close_price)
    const close = parseNum(item.close ?? item.ClosePrice ?? item.Close ?? item.close_price)

    return {
      time: dateVal,
      open,
      high: Math.max(open, high, close),
      low: Math.min(open, low, close),
      close
    }
  })

  // Sort chronologically ascending and deduplicate by date for TradingView engine safety
  const seenDates = new Set()
  return formatted
    .sort((a, b) => {
      if (typeof a.time === 'number' && typeof b.time === 'number') {
        return a.time - b.time
      }
      return String(a.time).localeCompare(String(b.time))
    })
    .filter(item => {
      if (seenDates.has(item.time)) return false
      seenDates.add(item.time)
      return true
    })
}

export default function TradingChart({ 
  data = [], 
  isBuy = true, 
  height = 160,
  showAutoLevels = true,
  asset = null,
  overlays = EMPTY,
  priceLevels = EMPTY,
  events = EMPTY,
  forecast = null
}) {
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const forecastAreaRef = useRef(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    const container = chartContainerRef.current
    const initialWidth = container.clientWidth || 300

    // Initialize TradingView Lightweight Chart with Fintech Minimalist Light Mode styling
    const chart = createChart(container, {
      width: initialWidth,
      height: height,
      watermark: {
        visible: false,
      },
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748B',
        fontSize: 11,
        fontFamily: "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      },
      grid: {
        vertLines: { color: '#F1F5F9' },
        horzLines: { color: '#F1F5F9' }
      },
      crosshair: {
        vertLine: {
          color: isBuy ? '#10B981' : '#EF4444',
          width: 1,
          style: 3, // Dashed
        },
        horzLine: {
          color: isBuy ? '#10B981' : '#EF4444',
          width: 1,
          style: 3,
        }
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        fixLeftEdge: true,
        fixRightEdge: true,
        borderVisible: false,
        timeVisible: false,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMove: true,
      },
      handleScale: {
        axisPressedMove: true,
        mouseWheel: true,
        pinch: true,
      }
    })

    chartRef.current = chart

    // Create Candlestick Series using v5 addSeries API
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderUpColor: '#10B981',
      borderDownColor: '#EF4444',
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
      wickVisible: true,
      borderVisible: true,
    })

    const candleData = formatCandleData(data)
    if (candleData.length > 0) {
      candleSeries.setData(candleData)

      if (forecast?.points?.length) {
        for (const [key, title, color, style] of [
          ['upper', 'Upper scenario', '#b45309', 3],
          ['central', 'Trend estimate', '#2563eb', 2],
          ['lower', 'Lower scenario', '#be123c', 3],
        ]) {
          const line = chart.addSeries(LineSeries, {color, lineStyle:style, lineWidth:2,
            title, priceLineVisible:false, lastValueVisible:false})
          line.setData([{time:forecast.anchor_date, value:forecast.anchor_price},
            ...forecast.points.map(point=>({time:point.date,value:point[key]}))])
        }
      }

      for (const overlay of overlays) {
        const line = chart.addSeries(LineSeries, {color:overlay.color, lineWidth:2, title:overlay.name,
          priceLineVisible:false, lastValueVisible:false})
        line.setData(overlay.data)
      }
      for (const level of priceLevels) {
        if (Number.isFinite(level.price) && level.price > 0) candleSeries.createPriceLine({price:level.price,
          color:level.color, lineWidth:1, lineStyle:2, axisLabelVisible:true, title:level.title})
      }
      const dates = new Set(candleData.map(candle => candle.time))
      const markers = [...new Map(events.filter(event => dates.has(event.date)).map(event => [event.date,
        {time:event.date, position:'aboveBar', color:'#7c3aed', shape:'circle', text:'News'}])).values()]
        .sort((a,b) => a.time.localeCompare(b.time))
      if (markers.length) createSeriesMarkers(candleSeries,markers)

      // Auto-Technical S/R & Trade Setup Overlays
      if (showAutoLevels && candleData.length >= 8) {
        const lastClose = candleData[candleData.length - 1].close
        const sr = detectSupportResistance(candleData, lastClose)
        const setup = calculateTradeSetupLevels(asset, candleData, lastClose)

        // Draw nearest Resistance floor & Support ceiling
        if (sr.nearestResistance) {
          candleSeries.createPriceLine({
            price: sr.nearestResistance.price,
            color: '#f59e0b',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `RES: $${sr.nearestResistance.price.toFixed(2)}`
          })
        }
        if (sr.nearestSupport) {
          candleSeries.createPriceLine({
            price: sr.nearestSupport.price,
            color: '#059669',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `SUP: $${sr.nearestSupport.price.toFixed(2)}`
          })
        }

        // Draw target and stop loss if valid
        if (setup.targetPrice > 0 && setup.stopLossPrice > 0) {
          candleSeries.createPriceLine({
            price: setup.targetPrice,
            color: '#10b981',
            lineWidth: 1,
            lineStyle: 1,
            axisLabelVisible: false,
            title: `TARGET`
          })
          candleSeries.createPriceLine({
            price: setup.stopLossPrice,
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: 1,
            axisLabelVisible: false,
            title: `STOP`
          })
        }
      }

      chart.timeScale().fitContent()
    }

    const positionForecast = () => {
      const area = forecastAreaRef.current
      if (!area) return
      const x = forecast ? chart.timeScale().timeToCoordinate(forecast.anchor_date) : null
      area.style.display = x === null ? 'none' : 'block'
      if (x !== null) area.style.left = `${Math.max(0,x)}px`
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(positionForecast)
    positionForecast()

    // Responsive ResizeObserver to adapt chart size dynamically when parent card container resizes
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0] && entries[0].contentRect) {
        const { width } = entries[0].contentRect
        if (width > 0) {
          chart.applyOptions({ width })
          chart.timeScale().fitContent()
          positionForecast()
        }
      }
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(positionForecast)
      chart.remove()
      chartRef.current = null
    }
  }, [data, isBuy, height, showAutoLevels, asset, overlays, priceLevels, events, forecast])

  return (
    <div
      ref={chartContainerRef}
      role="img"
      aria-label={forecast ? 'Historical candles followed by dashed future trend estimate and upper and lower scenarios. Numeric forecast table follows.' : 'Historical candlestick chart with optional technical overlays and scenario levels'}
      style={{
        width: '100%',
        height: `${height}px`,
        position: 'relative',
        borderRadius: '6px',
        overflow: 'hidden'
      }}
    ><div ref={forecastAreaRef} style={{display:'none',position:'absolute',top:0,bottom:28,right:58,
      background:'rgba(37,99,235,.045)',borderLeft:'1px dashed #64748b',pointerEvents:'none',zIndex:1}}>
      <span style={{position:'absolute',top:6,left:6,fontSize:10,color:'#334155',background:'#eff6ff',padding:'3px 5px',whiteSpace:'nowrap'}}>PROJECTED →</span>
    </div></div>
  )
}
