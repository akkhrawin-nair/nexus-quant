import { useEffect, useId, useRef, useState } from 'react'
import { ToolModal } from './ResearchTools'
import { optionEstimate, reviewOptionEstimate } from '../lib/options'
import { apiRequest } from '../lib/api'
import OptionQuoteComparison from './OptionQuoteComparison'
import OptionPaperJournal from './OptionPaperJournal'
import OptionModelRisk from './OptionModelRisk'
import { OPTION_PANELS, optionPanelForKey, fillOptionContract } from '../lib/optionWorkspace'
import { confirmOptionContract } from '../lib/optionContract'
import './OptionsWorkspace.css'

const usd = value => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', minimumFractionDigits:2, maximumFractionDigits:2}).format(value)
const quoteFields = new Set(['symbol','type','strike','expiration','bid','ask','quoteTime','bidSize','askSize'])
const localTime = value => {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,19)
}

export default function OptionsQuoteTool({ onClose, focusJournal=false }) {
  const [form, setForm] = useState({symbol:'', type:'call', strike:'', expiration:'', bid:'', ask:'', contracts:'1', multiplier:'100', fee:'0', quoteTime:'', bidSize:'', askSize:'', budget:'', maxSpreadPct:'10', plannedExit:''})
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [contract, setContract] = useState('')
  const [providerQuote, setProviderQuote] = useState(null)
  const [fetching, setFetching] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const pending = useRef(null)
  const [panel,setPanel]=useState(()=>focusJournal ? 'journal' : 'plan')
  const [contractError,setContractError]=useState(''), [contractMessage,setContractMessage]=useState('')
  const tabRefs=useRef({}), workspaceId=useId()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(timer) }, [])
  useEffect(() => () => pending.current?.abort(), [])
  const cancelFetch = () => { pending.current?.abort(); setFetching(false) }
  const activate=(next,focus=false)=>{
    setPanel(next)
    const tab=tabRefs.current[next]
    if(tab)tab.closest('dialog').scrollTop=0
    if(focus)tab?.focus()
  }
  const importContract=()=>{
    setContractError('');setContractMessage('')
    try{
      const imported=fillOptionContract(form,contract)
      cancelFetch();setForm(imported.form);setContract(imported.contractSymbol);setProviderQuote(null);setResult(null);setError('');setQuoteError('')
      setContractMessage('Contract fields filled. Previous prices and quote times were cleared; copy a fresh quote for this contract. Verify the multiplier and deliverable in Dime.')
    }catch(failure){setContractError(failure.message)}
  }
  const change = (key, value) => {
    cancelFetch()
    if (quoteFields.has(key)) setProviderQuote(null)
    setForm(previous => ({...previous, [key]:value})); setResult(null); setError('')
  }
  const loadQuote = async () => {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setFetching(true); setQuoteError(''); setResult(null); setProviderQuote(null)
    try {
      const quote = await apiRequest(`/api/options/quote/?${new URLSearchParams({contract:contract.trim().toUpperCase()})}`, {signal:controller.signal})
      if (controller.signal.aborted) return
      setForm(previous => ({...previous, symbol:quote.symbol, type:quote.type, strike:quote.strike, expiration:quote.expiration,
        bid:String(quote.bid), ask:String(quote.ask), bidSize:String(quote.bid_size), askSize:String(quote.ask_size), quoteTime:localTime(quote.quote_time)}))
      setProviderQuote(quote); setError(''); setNow(Date.now())
    } catch (failure) { if (!controller.signal.aborted) setQuoteError(failure.message) }
    finally { if (!controller.signal.aborted) setFetching(false) }
  }
  const field = (key, label, props = {}) => <label>{label}<input required {...props} value={form[key]} onChange={event => change(key, event.target.value)}/></label>
  const calculate = event => {
    event.preventDefault()
    try {
      const time = Date.now()
      const estimate = optionEstimate({...form, quoteTime:providerQuote?.quote_time || form.quoteTime}, time)
      if(contract.trim())confirmOptionContract(contract,estimate)
      reviewOptionEstimate(estimate, form, time)
      setResult({estimate, plan:{...form}, quote:providerQuote}); setNow(time); setError('')
    }
    catch (failure) { setResult(null); setError(failure.message) }
  }
  const estimate = result?.estimate
  const review = result ? reviewOptionEstimate(estimate, result.plan, now) : null
  if (review && result.quote) review.checks[0] = {id:'source', label:'Quote source', status:'unverified', detail:`Alpaca OPRA snapshot for ${result.quote.contract}. Bid/ask and timestamp retrieved from provider; Dime fills, contract multiplier, and session remain unverified.`}
  const stale = estimate && now - estimate.quoteTime > 60000
  const labels={plan:'Plan an option',compare:'Compare broker quotes',journal:'Paper journal'}
  const navigation=<nav className="options-workspace-tabs" role="tablist" aria-label="Options workspace">
    {OPTION_PANELS.map((name,index)=><button key={name} type="button" role="tab" id={`${workspaceId}-tab-${name}`} aria-controls={`${workspaceId}-panel-${name}`} aria-selected={panel===name} tabIndex={panel===name ? 0 : -1} ref={node=>{tabRefs.current[name]=node}} onClick={()=>activate(name)} onKeyDown={event=>{const next=optionPanelForKey(event.key,name);if(next){event.preventDefault();activate(next,true)}}}><span aria-hidden="true">0{index+1}</span>{labels[name]}</button>)}
  </nav>
  return <ToolModal title="Options workspace" onClose={onClose} headerContent={navigation}>
    <p className="options-workspace-hint">Inputs stay when you switch sections. Closing this workspace clears unsaved inputs; saved records stay in this browser.</p>
    <section role="tabpanel" tabIndex={0} id={`${workspaceId}-panel-plan`} aria-labelledby={`${workspaceId}-tab-plan`} hidden={panel!=='plan'}>
    <div className="options-workspace-intro"><h3>Plan an option</h3><p>Start with the exact contract, check its bid/ask and costs, then review a paper entry. Broker orders stay in Dime.</p></div>
    <div className="data-quality-notice"><strong>{providerQuote ? 'Alpaca OPRA snapshot · Not a guaranteed fill' : 'Manual mode · No provider quote loaded'}</strong>
      <span>Check your broker directly. Load an exact-contract quote with authorized data access, or copy bid and ask from the same Dime/Webull contract at the same time.</span></div>
    <section className="options-contract-import" aria-label="Fill contract identity">
    <h3>Copy your contract once</h3>
    <div className="research-controls">
      <label>Exact OCC contract symbol<input value={contract} placeholder="e.g. AAPL261030C00250000" maxLength={21} onChange={event => {cancelFetch(); setContract(event.target.value); setProviderQuote(null); setResult(null); setQuoteError('');setContractError('');setContractMessage('')}}/></label>
      <button type="button" disabled={!contract.trim()} onClick={importContract}>Fill contract fields</button>
    </div>
    <p>Fills ticker, call/put, strike and expiration from a standard option identifier. Quotes are cleared when you fill a contract. Multiplier and deliverable still need checking in your broker.</p>
    {contractError && <p className="research-error" role="alert">{contractError}</p>}
    {contractMessage && <p role="status">{contractMessage}</p>}
    </section>
    <details className="options-provider-setup"><summary>Optional provider quote connection</summary>
    <div className="research-controls">
      <button type="button" disabled={fetching || !contract.trim()} onClick={loadQuote}>{fetching ? 'Loading OPRA quote…' : 'Load OPRA quote'}</button>
    </div>
    <p>Requires Alpaca API credentials and OPRA data access. Free indicative prices are never substituted. Copy the exact contract identifier from your broker; verify its deliverable and multiplier.</p>
    {quoteError && <p className="research-error" role="alert">{quoteError}</p>}
    {providerQuote && <p role="status">{providerQuote.contract} · Source quote: {new Date(providerQuote.quote_time).toLocaleString()} · {now - Date.parse(providerQuote.quote_time) > 60000 ? 'OLD QUOTE — refresh before comparing prices.' : 'Provider snapshot loaded; refresh to request a new snapshot.'} Editing quote fields switches back to manual mode.</p>}
    </details>
    <form aria-label="Options entry calculator" onSubmit={calculate}>
      <h3>1 · Contract</h3>
      <div className="research-controls">
        {field('symbol', 'Underlying ticker', {maxLength:15, placeholder:'e.g. AAPL'})}
        <label>Option type<select value={form.type} onChange={event => change('type', event.target.value)}><option value="call">Call</option><option value="put">Put</option></select></label>
        {field('strike', 'Strike ($)', {type:'number', min:'0.0001', step:'any'})}
        {field('expiration', 'Expiration (US date)', {type:'date'})}
      </div>
      <p>Expiration must be within 14 calendar days, using the New York market date. The Paper journal section can save this ticket and show deadline notices; broker exits remain manual.</p>
      <h3>2 · Quote and costs</h3>
      <div className="research-controls">
        {field('bid', 'Bid — sell reference ($)', {type:'number', min:'0', step:'any'})}
        {field('ask', 'Ask — buy reference ($)', {type:'number', min:'0.0001', step:'any'})}
        {field('quoteTime', 'Source quote time', {type:'datetime-local', step:'1'})}
      </div>
      <p>Enter quote time in your browser timezone: <strong>{Intl.DateTimeFormat().resolvedOptions().timeZone}</strong>. Convert Webull’s timestamp if needed; do not use the page-open time.</p>
      <div className="research-controls">
        {field('bidSize', 'Bid size (contracts, optional)', {type:'number', min:'0', step:'1', required:false, placeholder:'Unknown'})}
        {field('askSize', 'Ask size (contracts, optional)', {type:'number', min:'0', step:'1', required:false, placeholder:'Unknown'})}
      </div>
      <div className="research-controls">
        {field('contracts', 'Contracts', {type:'number', min:'1', max:'10000', step:'1'})}
        {field('multiplier', 'Contract multiplier', {type:'number', min:'1', max:'10000', step:'1'})}
        {field('fee', 'Fees per contract, per side ($)', {type:'number', min:'0', max:'10000', step:'any'})}
      </div>
      <p>Standard equity options commonly use 100. Verify the actual multiplier and fees in Webull, especially for adjusted contracts. Fees default to zero; enter your charges.</p>
      <h3>3 · Budget and exit</h3>
      <div className="research-controls">
        {field('budget', 'Maximum premium budget ($)', {type:'number', min:'0', max:'1000000000', step:'any'})}
        {field('maxSpreadPct', 'Your maximum spread (% of midpoint)', {type:'number', min:'0', max:'200', step:'any'})}
        {field('plannedExit', 'Planned exit (US date)', {type:'date'})}
        <button type="submit">Calculate estimates</button>
      </div>
      <p>The 10% spread threshold is an editable starting filter, not a recommendation. Plan assumes entry today. Exit must be on or before expiration and within 14 calendar days of entry. The date check cannot close a real trade or monitor a broker position.</p>
    </form>
    {error && <p className="research-error" role="alert">{error}</p>}
    {result && <section aria-label="Option estimates" aria-live="polite">
      <h3>{estimate.symbol} {estimate.expiration} {estimate.type.toUpperCase()} {usd(estimate.strike)}</h3>
      <p>{result.quote ? 'Provider quote' : 'Manually entered quote'}: {new Date(estimate.quoteTime).toLocaleString()} · {stale ? 'OLD QUOTE — over 60 seconds; refresh or recheck your broker.' : 'Timestamp is under 60 seconds old; execution is unverified.'}</p>
      <section className="options-review" aria-label="Pre-trade checks">
        <h3>{result.quote ? 'Provider snapshot review — confirm in Dime' : 'Manual review — live verification required'}</h3>
        <p>{review.checks.filter(check => check.status === 'attention').length} checks need attention. Passing checks confirm entered arithmetic or dates only.</p>
        <ul>{review.checks.map(check => <li key={check.id} data-status={check.status}>
          <strong>{check.label}: {check.status === 'pass' ? 'Within entered limits' : check.status === 'attention' ? 'Needs attention' : 'Unverified'}</strong>
          <span>{check.detail}</span>
        </li>)}</ul>
      </section>
      {estimate.zeroBid && <p role="alert" className="research-error">Zero bid: no positive sell quote was entered. A sale may not be available.</p>}
      <dl className="research-metrics">
        {[
          ['Estimated buy cost at ask', usd(estimate.buyCost)],
          ['Estimated sell proceeds at bid', usd(estimate.sellProceeds)],
          ['Midpoint per share (reference only)', usd(estimate.midpoint)],
          ['Bid–ask spread per share', usd(estimate.spread)],
          ['Spread cost for this quantity', usd(estimate.spreadCost)],
          ['Immediate round-trip loss estimate', usd(estimate.roundTripLoss)],
          ['Break-even exit bid incl. entered fees', `$${review.breakEvenExitBid.toFixed(4)}`],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <p>Buy = ask × multiplier × contracts + fees. Sell = bid × multiplier × contracts − fees. Round trip assumes unchanged quotes and includes fees on both sides; it is not a forecast or realized P&amp;L.</p>
      <p>Break-even is the future option bid needed to cover the ask-based entry and entered fees on both sides, not the underlying stock’s expiration break-even. Round it to a broker-permitted price increment. Additional fees or slippage increase the required price.</p>
      <p>Quote sizes are manually entered; liquidity, market hours, and broker permissions are unverified. A limit price controls your acceptable price but does not guarantee execution.</p>
      <button type="button" className="options-primary-action" onClick={()=>activate('journal',true)}>Review this ticket in paper journal</button>
      <OptionModelRisk key={JSON.stringify(result.plan)} ticket={result} now={now}/>
    </section>}
    </section>
    <section role="tabpanel" tabIndex={0} id={`${workspaceId}-panel-compare`} aria-labelledby={`${workspaceId}-tab-compare`} hidden={panel!=='compare'}>
      <div className="options-workspace-intro"><h3>Compare broker quotes</h3><p>Check exact-contract quote differences and broker order totals. Your comparison inputs stay here when you switch sections.</p></div>
      <OptionQuoteComparison/>
    </section>
    <section role="tabpanel" tabIndex={0} id={`${workspaceId}-panel-journal`} aria-labelledby={`${workspaceId}-tab-journal`} hidden={panel!=='journal'}>
      <OptionPaperJournal ticket={result}/>
    </section>
  </ToolModal>
}
