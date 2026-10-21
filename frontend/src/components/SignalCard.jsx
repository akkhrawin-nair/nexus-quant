import TradingChart from './TradingChart'
import DataQualityNotice from './DataQualityNotice'
export default function SignalCard({ signal, onOpenPaperTrade }) {
  return <article className="minimal-card"><h3>{signal.symbol}</h3><p>Historical close: ${signal.current_price}</p><TradingChart data={signal.candles} showAutoLevels={false}/><DataQualityNotice quality={signal.data_quality}/><button onClick={() => onOpenPaperTrade?.(signal.symbol)}>Paper trade</button></article>
}
