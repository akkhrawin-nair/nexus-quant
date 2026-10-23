import { useEffect, useId, useRef, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { apiRequest } from '../lib/api'
import DataQualityNotice from './DataQualityNotice'
import TradingChart from './TradingChart'
import { getPortfolio, openPosition, closePosition, addFunds, calculatePortfolioStats, exportPortfolioHistoryToCSV, exportPaperPortfolioJSON, plannedDeadline } from '../utils/paperTradingStorage'
import PaperDeadlineNotice from './PaperDeadlineNotice'
import FixedHoldoutSummary from './FixedHoldoutSummary'
import './ResearchTools.css'

const number = value => value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
const language = () => localStorage.getItem('kappa_lang') || 'en'

function useResult(path, options = null) {
  const [state, setState] = useState({})
  const [revision, setRevision] = useState(0)
  const key = `${path}:${options || ''}:${revision}`
  useEffect(() => {
    const controller = new AbortController()
    apiRequest(path, { signal: controller.signal, ...(options ? {method: 'POST', body: options} : {}) })
      .then(data => { if (!controller.signal.aborted) setState({key, data}) })
      .catch(error => { if (!controller.signal.aborted) setState({key, error: error.message}) })
    return () => controller.abort()
  }, [path, options, key])
  return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : null,
    loading: state.key !== key, retry: () => setRevision(n => n + 1) }
}

export function ToolModal({ title, onClose, children, headerContent }) {
  const ref = useRef(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return <dialog ref={ref} className="research-dialog" aria-labelledby={id} onCancel={onClose}
    onClick={e => { if (e.target === ref.current) onClose() }}>
    <div className="research-shell">
      <header className={headerContent ? 'research-header-with-content' : undefined}><div><p>KAPPA · {language() === 'th' ? 'เครื่องมือวิจัย' : 'Research tools'}</p><h2 id={id}>{title}</h2></div>
        <button onClick={onClose} aria-label="Close / ปิด" autoFocus>✕</button>
        {headerContent && <div className="research-header-content">{headerContent}</div>}
      </header>
      <div className="research-body">{children}</div>
    </div>
  </dialog>
}

function ResultState({ result }) {
  if (result.loading) return <p role="status">Loading observed market history… / กำลังโหลดข้อมูลย้อนหลัง…</p>
  if (result.error) return <div role="alert" className="research-error"><p>{result.error}</p><button onClick={result.retry}>Retry / ลองอีกครั้ง</button></div>
  return null
}

function Assumptions({ data }) {
  return <><DataQualityNotice quality={data.data_quality} lang={language()} />
    {data.input_data_quality && <details><summary>Input sources &amp; freshness / แหล่งข้อมูลและวันที่</summary>
      {Object.entries(data.input_data_quality).map(([symbol, quality]) => <div key={symbol}><strong>{symbol}</strong><DataQualityNotice quality={quality} lang={language()}/></div>)}</details>}
    {data.assumptions?.length > 0 && <details><summary>Method & limitations / วิธีและข้อจำกัด</summary>
      <ul>{data.assumptions.map(item => <li key={item}>{item}</li>)}</ul></details>}</>
}

function Chart({ data, x = 'date', series = ['equity'] }) {
  return <div className="research-chart"><ResponsiveContainer width="100%" height="100%">
    <LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={x} minTickGap={60}/><YAxis domain={['auto', 'auto']} tickFormatter={number}/><Tooltip formatter={number}/>
      {series.map((key, i) => <Line key={key} dataKey={key} stroke={['#0284c7','#10b981','#eab308'][i]} dot={false} isAnimationActive={false}/>)}</LineChart>
  </ResponsiveContainer></div>
}

function Metrics({ items }) {
  return <dl className="research-metrics">{items.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
}

export function BacktestTool({ onClose, initialSymbol = 'QQQ' }) {
  const [symbol, setSymbol] = useState(initialSymbol)
  const [draft, setDraft] = useState(initialSymbol)
  const [period, setPeriod] = useState('1y')
  const [strategy, setStrategy] = useState('MACD')
  const [capital, setCapital] = useState('10000')
  const [validation, setValidation] = useState('fixed_holdout')
  const [fee, setFee] = useState('10')
  const [slippage, setSlippage] = useState('5')
  const result = useResult(`/api/strategies/backtest/?${new URLSearchParams({symbol, period, strategy, capital, validation, fee_bps:fee, slippage_bps:slippage})}`)
  const data = result.data
  return <ToolModal title="Historical backtest / ทดสอบย้อนหลัง" onClose={onClose}>
    <p>Long-only historical research. Results include fees and slippage; they do not establish a future win probability.</p>
    <form className="research-controls" onSubmit={e => {e.preventDefault(); setSymbol(draft.trim().toUpperCase())}}>
      <label style={{flexBasis:240}}>Evaluation<select aria-label="Evaluation" value={validation} onChange={e => {setValidation(e.target.value); if (['holdout','fixed_holdout'].includes(e.target.value) && ['3mo','6mo'].includes(period)) setPeriod('1y')}}><option value="fixed_holdout">Fixed-rule 70/30 historical holdout</option><option value="fixed">Fixed stock protocol v1 (exploratory)</option><option value="holdout">70/30 rule-selection holdout (legacy)</option><option value="full">Full sample (exploratory)</option></select></label>
      <label>Ticker<input value={draft} onChange={e => setDraft(e.target.value)} maxLength={20}/></label>
      <label>Period<select aria-label="Period" value={period} onChange={e => setPeriod(e.target.value)}>{(['holdout','fixed_holdout'].includes(validation) ? ['1y','5y','10y'] : ['3mo','6mo','1y','5y','10y']).map(x => <option key={x}>{x}</option>)}</select></label>
      {validation === 'full' && <label>Strategy<select aria-label="Strategy" value={strategy} onChange={e => setStrategy(e.target.value)}>{['MACD','EMA','CONFLUENCE'].map(x => <option key={x}>{x}</option>)}</select></label>}
      <label>Starting cash ($)<input type="number" min="1" max="1000000000" value={capital} onChange={e => setCapital(e.target.value)}/></label>
      <label>Fees per side (bps)<input type="number" min="0" max="100" value={fee} onChange={e => setFee(e.target.value)}/></label>
      <label>Slippage per side (bps)<input type="number" min="0" max="100" value={slippage} onChange={e => setSlippage(e.target.value)}/></label>
      <button type="submit">Load ticker</button>
    </form>
    <ResultState result={result}/>
    {validation === 'fixed' && <p>Full-sample exploration of the fixed paper protocol. Choose Fixed-rule 70/30 historical holdout to evaluate only later dates. The legacy rule-selection mode uses different sizing and does not validate this protocol.</p>}
    {validation === 'fixed_holdout' && <p>The frozen confluence-risk-v1 rules use earlier observations for indicator context and evaluate only the later 30%. No strategy is chosen by past return. This is historical research; forward validation is still required.</p>}
    {validation === 'holdout' && <p>Earlier 70% selects MACD, EMA, confluence, or cash by net return. Later 30% tests that selection with no refit. Strategy trades have a 14-calendar-day cap; buy-and-hold is an unrestricted reference. No brokerage orders are placed.</p>}
    {data && <>{data.protocol && <section aria-label="Fixed stock strategy rules" className="data-quality-notice">
        <strong>{data.protocol.name} · {data.protocol.version}</strong><p>{data.protocol.status}</p>
        {validation==='fixed_holdout'?<details><summary>Inspect frozen entry, exit and sizing rules</summary><ul>{data.protocol.rules.map(rule => <li key={rule}>{rule}</li>)}</ul></details>:<ul>{data.protocol.rules.map(rule => <li key={rule}>{rule}</li>)}</ul>}
        <p>Skipped entry sessions because one share did not fit the limits: {data.skipped_entry_sessions}. Each qualifying flat session is counted, including repeated sessions in the same signal.</p>
      </section>}
      {!data.validation && <Metrics items={[[symbol, `${data.start_date} → ${data.end_date}`],['Net return', `${number(data.return_pct)}%`],['Final equity', `$${number(data.final_equity)}`],['Max drawdown', `${number(data.max_drawdown_pct)}%`],['Closed trades', data.total_trades],['Sample win rate', `${number(data.win_rate_pct)}%`]]}/>}
      {data.validation?.mode==='fixed_rule_holdout'&&<FixedHoldoutSummary data={data}/>}
      {data.validation && data.validation.mode!=='fixed_rule_holdout' && <section aria-label="Holdout validation">
        <div className="data-quality-notice"><strong>{data.validation.verdict}</strong><span>Training: {data.validation.training_start} → {data.validation.training_end}. Holdout: {data.start_date} → {data.end_date}. Selected: {data.strategy}.</span></div>
        <Metrics items={[
          ['Holdout strategy return', `${number(data.return_pct)}%`],
          ['Buy-and-hold return', `${number(data.benchmark.return_pct)}%`],
          ['Difference (percentage points)', number(data.validation.excess_return_pct_points)],
          ['Strategy drawdown', `${number(data.max_drawdown_pct)}%`],
          ['Buy-and-hold drawdown', `${number(data.benchmark.max_drawdown_pct)}%`],
          ['Holdout closed trades', data.total_trades],
        ]}/>
        <details><summary>Training selection — earlier data only</summary><p>{data.validation.selection_rule}</p><div className="research-table-scroll"><table><thead><tr><th>Rule</th><th>Training net return</th><th>Closed trades</th></tr></thead><tbody>{data.validation.training_results.map(row => <tr key={row.strategy}><td>{row.strategy}</td><td>{number(row.return_pct)}%</td><td>{row.total_trades}</td></tr>)}</tbody></table></div></details>
        <ul>{data.validation.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
        <p>Chart: blue = selected strategy; green = buy-and-hold. Both start with ${number(data.initial_capital)} over the same holdout dates. Selected strategy ends with ${number(data.final_equity)}.</p>
      </section>}
      <Chart data={data.equity_curve} series={data.validation?.mode==='fixed_rule_holdout'?['equity','buy_and_hold','cash']:data.validation ? ['equity','buy_and_hold'] : ['equity']}/><Assumptions data={data}/>
      <div className="research-table-scroll"><table><thead><tr><th>Entry</th><th>Exit</th><th>Shares</th><th>Reason</th><th>Net P&amp;L</th></tr></thead><tbody>{data.trades.slice(-100).map((t,i) => <tr key={i}><td>{t.entry_date}</td><td>{t.exit_date}</td><td>{number(t.quantity)}</td><td>{t.exit_reason}</td><td>${number(t.pnl)}</td></tr>)}</tbody></table></div>
      {!data.total_trades && <p>No closed trades for this sample and strategy.</p>}</>}
  </ToolModal>
}

function SymbolForm({ draft, setDraft, onSubmit }) {
  return <form className="research-controls" onSubmit={e => {e.preventDefault(); onSubmit(draft)}}>
    <label>Tickers / สัญลักษณ์ (comma separated, max 12)<input value={draft} onChange={e => setDraft(e.target.value)} maxLength={252}/></label><button>Calculate / คำนวณ</button>
  </form>
}

export function OptimizerTool({ onClose }) {
  const [draft, setDraft] = useState('QQQ,SPY,NVDA,GLD')
  const [symbols, setSymbols] = useState(draft)
  const [preset, setPreset] = useState('min_volatility')
  const result = useResult(`/api/portfolio-optimizer/?symbols=${encodeURIComponent(symbols)}`)
  const data = result.data
  return <ToolModal title="Portfolio allocation research / สัดส่วนพอร์ต" onClose={onClose}>
    <SymbolForm draft={draft} setDraft={setDraft} onSubmit={setSymbols}/><ResultState result={result}/>
    {data && <><p>{data.observations} common return observations · {data.start_date} → {data.end_date}</p>
      <label>Candidate allocation<select value={preset} onChange={e => setPreset(e.target.value)}>{Object.keys(data.presets).map(x => <option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label>
      <div className="research-table-scroll"><table><thead><tr><th>Asset</th><th>Weight</th><th>Historical annualized mean</th><th>Historical volatility</th></tr></thead><tbody>{Object.entries(data.presets[preset] || {}).map(([symbol, weight]) => <tr key={symbol}><td>{symbol}</td><td>{number(weight)}%</td><td>{number(data.assets[symbol].expected_return * 100)}%</td><td>{number(data.assets[symbol].volatility * 100)}%</td></tr>)}</tbody></table></div>
      <p>Approximate nondominated frontier from sampled long-only portfolios; historical means are not forecasts.</p>
      <Chart data={data.frontier_points} x="volatility" series={['expected_return']}/><Assumptions data={data}/></>}
  </ToolModal>
}

export function CorrelationTool({ onClose }) {
  const [draft, setDraft] = useState('QQQ,SPY,NVDA,GLD')
  const [symbols, setSymbols] = useState(draft)
  const result = useResult(`/api/portfolio/correlation/?symbols=${encodeURIComponent(symbols)}`)
  const data = result.data
  return <ToolModal title="Historical correlations / สหสัมพันธ์ย้อนหลัง" onClose={onClose}>
    <SymbolForm draft={draft} setDraft={setDraft} onSubmit={setSymbols}/><ResultState result={result}/>
    {data && <><p>{data.observations} common-date returns · {data.start_date} → {data.end_date}. Correlations can change.</p>
      <div className="research-table-scroll"><table><thead><tr><th>Asset</th>{data.symbols.map(s => <th key={s}>{s}</th>)}</tr></thead><tbody>{data.symbols.map(a => <tr key={a}><th>{a}</th>{data.symbols.map(b => <td key={b}>{number(data.matrix[a][b])}</td>)}</tr>)}</tbody></table></div><Assumptions data={data}/></>}
  </ToolModal>
}

export function RiskTool({ onClose }) {
  const [draft, setDraft] = useState('QQQ,SPY')
  const [symbols, setSymbols] = useState(draft)
  const [capital, setCapital] = useState('10000')
  const [horizon, setHorizon] = useState('30')
  const [weightsText, setWeightsText] = useState('1,1')
  const [submittedWeights, setSubmittedWeights] = useState(weightsText)
  const keys = symbols.split(',').map(x => x.trim().toUpperCase())
  const values = submittedWeights.split(',').map(Number)
  const weights = Object.fromEntries(keys.map((s,i) => [s, values[i] ?? 0]))
  const body = JSON.stringify({capital, horizon, weights, seed:42})
  const result = useResult('/api/portfolio/risk-analytics/', body)
  const data = result.data
  return <ToolModal title="Historical risk & scenarios / ความเสี่ยงพอร์ต" onClose={onClose}>
    <SymbolForm draft={draft} setDraft={setDraft} onSubmit={value => {setSymbols(value); setSubmittedWeights(weightsText)}}/>
    <div className="research-controls"><label>Relative weights (same order)<input value={weightsText} onChange={e => setWeightsText(e.target.value)} placeholder="1,1"/></label>
      <label>Capital ($)<input type="number" min="0.01" value={capital} onChange={e => setCapital(e.target.value)}/></label>
      <label>Scenario observations<select value={horizon} onChange={e => setHorizon(e.target.value)}>{[10,30,90,252].map(n => <option key={n}>{n}</option>)}</select></label></div>
    <ResultState result={result}/>
    {data && <><Metrics items={[["Historical 95% VaR (one observation)", `$${number(data.var_95_1d_usd)}`],['Historical 95% CVaR', `$${number(data.cvar_95_usd)}`],['Annualized volatility', `${number(data.annual_volatility)}%`],['Sharpe (4% risk-free)', number(data.sharpe_ratio)],['Sortino', number(data.sortino_ratio)],['Historical max drawdown', `${number(data.max_drawdown_pct)}%`]]}/>
      <p>500 seeded normal log-return scenarios · p5 / median / p95. Not a price forecast. Seed {data.seed}.</p>
      <Chart data={data.monte_carlo_curves} x="day" series={['p5','p50','p95']}/><Assumptions data={data}/>
      <div className="research-table-scroll"><table><thead><tr><th>Asset</th><th>Weight</th><th>Covariance risk contribution</th></tr></thead><tbody>{data.asset_breakdown.map(a => <tr key={a.symbol}><td>{a.symbol}</td><td>{number(a.weight)}%</td><td>{number(a.risk_contribution_pct)}%</td></tr>)}</tbody></table></div></>}
  </ToolModal>
}

export function IndicatorTool({ onClose, initialSymbol = 'QQQ', onOpenPaperTrade }) {
  const [symbol, setSymbol] = useState(initialSymbol)
  const [draft, setDraft] = useState(symbol)
  const result = useResult(`/api/brain/fusion/?symbol=${encodeURIComponent(symbol)}`)
  const signal = result.data?.signal
  return <ToolModal title="Indicator research / วิเคราะห์ตัวชี้วัด" onClose={onClose}>
    <SymbolForm draft={draft} setDraft={setDraft} onSubmit={s => setSymbol(s.trim().toUpperCase())}/>
    <p>Historical EMA, MACD, RSI and relative-volume checklist. This score is not a probability of profit or an AI prediction.</p>
    <ResultState result={result}/>{signal && <><Metrics items={[[symbol, `$${number(signal.current_price)}`],['Checklist score', `${signal.golden_opportunity.confluence_score}/100`],['RSI',number(signal.radar.rsi)],['Relative volume',`${number(signal.radar.vol_spike_ratio)}x`]]}/>
      <Chart data={signal.candles} series={['close']}/>
      <ul>{signal.golden_opportunity.layers.map(x => <li key={x.id}>{x.passed ? '✓' : '○'} {x.name}</li>)}</ul>
      <p>Earnings calendar: unknown. Check the issuer’s calendar before considering a trade. Options quotes, Greeks and calibrated win probabilities are unavailable.</p>
      <DataQualityNotice quality={signal.data_quality} lang={language()}/>
      {onOpenPaperTrade && <button onClick={() => {onClose(); onOpenPaperTrade(symbol)}}>Open paper trading / เปิดพอร์ตจำลอง</button>}</>}
  </ToolModal>
}

export function NewsTool({ onClose, initialAsset = 'QQQ' }) {
  const [symbol, setSymbol] = useState(initialAsset === 'ALL' ? 'QQQ' : initialAsset)
  const [draft, setDraft] = useState(symbol)
  const result = useResult(`/api/sentiment/?symbol=${encodeURIComponent(symbol)}`)
  return <ToolModal title="Observed news / ข่าวจากแหล่งข้อมูล" onClose={onClose}>
    <SymbolForm draft={draft} setDraft={setDraft} onSubmit={setSymbol}/><ResultState result={result}/>
    {result.data && <><DataQualityNotice quality={result.data.data_quality} lang={language()}/>
      {!result.data.news.length && <p>No headlines available. No substitute headlines have been generated. / ไม่มีข่าวที่พร้อมใช้งาน</p>}
      <ul className="research-news">{result.data.news.map(n => <li key={n.id}><a href={n.url} target="_blank" rel="noreferrer">{n.title}</a><small>{n.source} · {n.time}</small></li>)}</ul></>}
  </ToolModal>
}

export function EducationTool({ onClose }) {
  return <ToolModal title="Research checklist / แนวทางศึกษาข้อมูล" onClose={onClose}>
    <p>This is a personal research and paper-trading tool. No calibrated prediction model, executable options feed, or earnings calendar is connected.</p>
    <ol><li>Verify the observation date and provider before using any price.</li><li>Review actual historical trades, fees, drawdown and sample size.</li><li>Check earnings, liquidity, spreads and position size separately.</li><li>Practice in the local paper portfolio and keep a journal. A target return is not a guaranteed outcome.</li></ol>
    <p>Score = number of satisfied indicator checks × 20. It measures agreement among indicators, not the chance of winning.</p>
    <p>ใช้ข้อมูลเพื่อศึกษาและทดลองในพอร์ตจำลอง ตรวจสอบวันที่ แหล่งข้อมูล และความเสี่ยงก่อนตัดสินใจ คะแนนไม่ใช่ความน่าจะเป็นที่จะได้กำไร</p>
  </ToolModal>
}

export function PaperTool({ onClose, initialTicker = 'QQQ' }) {
  const [portfolio, setPortfolio] = useState(getPortfolio)
  const [now,setNow] = useState(Date.now)
  const [symbol, setSymbol] = useState(initialTicker || 'QQQ')
  const [draft, setDraft] = useState(symbol)
  const [amount, setAmount] = useState('1.50')
  const [deposit, setDeposit] = useState('')
  const [message, setMessage] = useState('')
  const symbols = [...new Set([symbol, ...portfolio.positions.map(p => p.symbol)])].slice(0, 12).join(',')
  const result = useResult(`/api/market/quotes/?symbols=${encodeURIComponent(symbols)}`)
  const quotes = result.data || {}
  const prices = Object.fromEntries(Object.entries(quotes).filter(([,q]) => q.current_price > 0).map(([s,q]) => [s,q.current_price]))
  const stats = calculatePortfolioStats(portfolio, prices)
  const quote = quotes[symbol]
  useEffect(() => {
    const update = () => setPortfolio(getPortfolio())
    window.addEventListener('paperPortfolioUpdated', update)
    window.addEventListener('storage', update)
    const timer=setInterval(()=>setNow(Date.now()),30000)
    return () => {window.removeEventListener('paperPortfolioUpdated', update); window.removeEventListener('storage', update);clearInterval(timer)}
  }, [])
  const report = result => {
    setMessage(result.success ? 'Saved locally / บันทึกแล้ว' : result.message)
    setPortfolio(getPortfolio())
  }
  return <ToolModal title="Local paper portfolio / พอร์ตจำลอง" onClose={onClose}>
    <p>Simulation using the latest available daily close. No broker order is sent. Stored in this browser; export your trade history. Missing quotes use entry cost for indicative valuation and cannot fill an order.</p>
    <p>Positions opened from saved share plans include their saved fees/slippage on both sides. Indicative equity uses modeled exit costs when a quote exists. Simple paper buys retain their original zero-cost convention. Stops and targets do not fill automatically.</p>
    {portfolio.positions.some(p=>plannedDeadline(p,now)?.kind==='overdue') && <p role="alert" className="research-error">A saved-plan position is overdue. Review the deadline column; no automatic exit has occurred.</p>}
    {portfolio.storageError && <p role="alert">{portfolio.storageError}</p>}
    <Metrics items={[["Cash", `$${number(stats.balance)}`],['Indicative equity', `$${number(stats.totalEquity)}`],['Net deposits / starting capital', `$${number(stats.initialBalance)}`],['Realized P&L', `$${number(stats.totalRealizedPnl)}`]]}/>
    <SymbolForm draft={draft} setDraft={setDraft} onSubmit={s => setSymbol(s.trim().toUpperCase())}/><ResultState result={result}/>
    <DataQualityNotice quality={quote?.data_quality} lang={language()}/>
    <form className="research-controls" onSubmit={e => {e.preventDefault(); report(openPosition({symbol, entryPrice:quote?.current_price, amount, reason:'Paper fill at observed daily close'}))}}>
      <label>Buy amount ($)<input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}/></label>
      <button disabled={!quote?.current_price || !!portfolio.storageError}>Paper buy {symbol} @ ${number(quote?.current_price)}</button>
    </form>
    <form className="research-controls" onSubmit={e => {e.preventDefault(); report(addFunds(deposit)); setDeposit('')}}>
      <label>Add simulated cash ($)<input type="number" min="0.01" step="0.01" value={deposit} onChange={e => setDeposit(e.target.value)} required/></label><button disabled={!!portfolio.storageError}>Add cash</button>
    </form>
    {message && <p role="status">{message}</p>}
    <h3>Open positions / สถานะที่เปิด</h3>
    {!portfolio.positions.length && <p>No open positions.</p>}
    <div className="research-table-scroll"><table><thead><tr><th>Asset</th><th>Quantity</th><th>Entry reference</th><th>Observed daily close</th><th>Plan deadline</th><th>Action</th></tr></thead><tbody>{portfolio.positions.map(p => <tr key={p.id}><td>{p.symbol}</td><td>{p.quantity}</td><td>${number(p.entryPrice)}</td><td>${number(prices[p.symbol])}</td><td><PaperDeadlineNotice position={p} now={now}/></td><td><button disabled={!prices[p.symbol] || !!portfolio.storageError} onClick={() => report(closePosition(p.id, prices[p.symbol]))}>Paper close</button></td></tr>)}</tbody></table></div>
    <h3>Trade history / ประวัติ</h3><button onClick={() => exportPortfolioHistoryToCSV(portfolio)} disabled={!portfolio.history.length}>Export CSV</button>
    <button onClick={()=>{try {exportPaperPortfolioJSON();setMessage('Paper portfolio backup downloaded.')} catch(error){setMessage(error.message)}}}>Export portfolio backup</button>
    <div className="research-table-scroll"><table><thead><tr><th>Asset</th><th>Exit date (UTC)</th><th>Net P&amp;L</th><th>Original risk multiple</th><th>Plan exit date</th></tr></thead><tbody>{portfolio.history.map(p => <tr key={p.id}><td>{p.symbol}</td><td>{p.exitDate?.slice(0,10)}</td><td>${number(p.pnlDollar)}</td><td>{p.realizedR == null ? '—' : `${number(p.realizedR)} R`}</td><td>{p.tradePlan ? `${p.tradePlan.scenario.exitDate}${p.exitDateMissed ? ' · missed' : ' · date met'}` : 'No saved plan'}</td></tr>)}</tbody></table></div>
  </ToolModal>
}

export function ChartTool({ onClose, initialSymbol = 'QQQ' }) {
  const [timeframe, setTimeframe] = useState('1D')
  const result = useResult(`/api/candles/${encodeURIComponent(initialSymbol)}/?tf=${timeframe}`)
  return <ToolModal title={`${initialSymbol} · Historical OHLCV / กราฟย้อนหลัง`} onClose={onClose}>
    <div className="research-controls"><label>Bar interval / ช่วงเวลา<select value={timeframe} onChange={e=>setTimeframe(e.target.value)}>{['1m','5m','15m','1h','1D','1W','1M','1Y'].map(t=><option key={t}>{t}</option>)}</select></label></div>
    <p>Yahoo Finance observed bars; timestamps may be delayed. Daily/weekly/monthly intervals represent bars, not a forecast horizon. No generated substitute candles.</p>
    <ResultState result={result}/>
    {result.data && (result.data.length ? <><p>{result.data.length} bars · {result.data[0].date} → {result.data.at(-1).date}</p><TradingChart data={result.data} height={380} showAutoLevels={false}/></> : <p>No bars available for this interval.</p>)}
  </ToolModal>
}

export function AlertsTool({ onClose, alerts, saveAlerts, signals }) {
  const [ticker, setTicker] = useState(signals[0]?.symbol || 'QQQ')
  const [condition, setCondition] = useState('ABOVE')
  const [target, setTarget] = useState('')
  const [error, setError] = useState('')
  const submit = e => {
    e.preventDefault()
    if (!/^[A-Z0-9^][A-Z0-9.^=-]{0,19}$/.test(ticker) || !Number.isFinite(Number(target)) || Number(target)<=0) {
      setError('Enter a valid ticker and positive threshold.'); return
    }
    saveAlerts([...alerts,{id:crypto.randomUUID(),ticker,condition,targetValue:Number(target),enabled:true,destination:'LOCAL'}])
    setTarget(''); setError('')
  }
  return <ToolModal title="Local observation alerts / แจ้งเตือนในหน้านี้" onClose={onClose}>
    <p>Rules are checked against stored observations while the dashboard is open. They are not live-price crossings, scheduled push notifications, or automatic orders. Older webhook rules are monitored locally only.</p>
    <form className="research-controls" onSubmit={submit}><label>Ticker<input value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} maxLength={20}/></label><label>Condition<select value={condition} onChange={e=>setCondition(e.target.value)}>{['ABOVE','BELOW','RSI_HIGH','RSI_LOW'].map(x=><option key={x}>{x}</option>)}</select></label><label>Threshold<input type="number" min="0.01" step="any" value={target} onChange={e=>setTarget(e.target.value)} required/></label><button>Add local rule</button></form>
    {error && <p role="alert">{error}</p>}
    {!alerts.length && <p>No saved rules. / ยังไม่มีกฎ</p>}
    <div className="research-table-scroll"><table><thead><tr><th>Asset</th><th>Condition</th><th>Threshold</th><th>Enabled</th><th>Remove</th></tr></thead><tbody>{alerts.map(a=><tr key={a.id}><td>{a.ticker}</td><td>{a.condition}</td><td>{a.targetValue}</td><td><input type="checkbox" aria-label={`Enable ${a.ticker} ${a.condition}`} checked={a.enabled} onChange={()=>saveAlerts(alerts.map(x=>x.id===a.id?{...x,enabled:!x.enabled}:x))}/></td><td><button onClick={()=>saveAlerts(alerts.filter(x=>x.id!==a.id))}>Remove</button></td></tr>)}</tbody></table></div>
  </ToolModal>
}
