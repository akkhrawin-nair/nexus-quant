import { useEffect, useState } from 'react'
import { marketDate } from '../lib/options'
import { getPortfolio, saveShareTradePlan, openPlannedPosition, closePosition, addFunds, exportPaperPortfolioJSON } from '../utils/paperTradingStorage'
import PaperDeadlineNotice from './PaperDeadlineNotice'

const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value)

function SavedPlanCard({saved,portfolio,now,report}) {
  const [exit,setExit]=useState('')
  const position=portfolio.positions.find(p=>p.id===saved.positionId)
  const closed=portfolio.history.find(p=>p.id===saved.positionId)
  const stale=marketDate(Date.parse(saved.savedAt))!==marketDate(now)
  const plan=saved.scenario
  return <article className="analyst-note" aria-label={`Saved ${saved.symbol} share plan`}>
    <h4>{saved.symbol} · {plan.quantity} whole shares · saved {new Date(saved.savedAt).toLocaleString()}</h4>
    <dl className="research-metrics">{[['Entry reference',money(plan.entry)],['Stop trigger',money(plan.stop)],['Target',money(plan.target)],
      ['Entry cost with assumptions',money(plan.entryCost)],['Original planned loss',money(plan.plannedLoss)],['Exit date (New York)',plan.exitDate]].map(([label,amount])=><div key={label}><dt>{label}</dt><dd>{amount}</dd></div>)}</dl>
    <p>Saved costs per side: {saved.inputs.feeBps} bps fees + {saved.inputs.slippageBps} bps slippage. Latest allowed exit date: {plan.deadline} (New York).</p>
    {closed ? <div role="status" className="analyst-plan"><strong>Paper position closed · net P&amp;L {money(closed.pnlDollar)}</strong>
      <p>{closed.realizedR.toFixed(2)} R versus the original planned loss · exit reference {money(closed.exitPrice)} · {closed.exitDate.slice(0,10)} (UTC timestamp date).</p>
      <p>{closed.exitDateMissed ? 'The recorded exit date missed the saved plan deadline.' : 'The recorded New York exit date was within the saved plan.'} Broker cutoff times are not verified.</p>
    </div> : position ? <>
      <p><strong>Open paper position</strong> · entry cost {money(position.totalCost)}</p>
      <p><PaperDeadlineNotice position={position} now={now}/></p>
      <form className="research-controls" onSubmit={event=>{event.preventDefault();report(closePosition(position.id,Number(exit),{priceSource:'User-entered simulation reference; not a broker fill'}))}}>
        <label>Simulated exit reference ($)<input required type="number" min="0.0001" step="any" value={exit} onChange={event=>setExit(event.target.value)}/></label>
        <button type="submit" disabled={!!portfolio.storageError}>Record paper exit</button>
      </form><p className="analyst-legend">This input is an assumed reference. Saved sell-side slippage and fees will be applied. No stop, target or deadline automatically closes the position.</p>
    </> : saved.positionId ? <p>Linked paper position is unavailable. This plan cannot be opened again.</p> : <>
      <p>Saved plan only — no paper position opened. {stale && 'This plan is from an earlier day; recalculate and save a new plan to open a position.'}</p>
      <button type="button" disabled={stale || !!portfolio.storageError} onClick={()=>report(openPlannedPosition(saved.id))}>Open paper position at saved entry</button>
    </>}
  </article>
}

export default function SavedSharePlans({symbol,draft,scenario}) {
  const [portfolio,setPortfolio]=useState(getPortfolio), [now,setNow]=useState(Date.now)
  const [message,setMessage]=useState(''), [error,setError]=useState(''), [deposit,setDeposit]=useState('')
  useEffect(()=>{
    const update=()=>setPortfolio(getPortfolio())
    window.addEventListener('paperPortfolioUpdated',update);window.addEventListener('storage',update)
    const timer=setInterval(()=>setNow(Date.now()),30000)
    return ()=>{window.removeEventListener('paperPortfolioUpdated',update);window.removeEventListener('storage',update);clearInterval(timer)}
  },[])
  const report=result=>{
    setPortfolio(getPortfolio());setNow(Date.now());setError('');setMessage('')
    if (!result.success) setError(result.message)
    else setMessage(result.plan ? (result.duplicate ? 'This original plan is already saved.' : 'Share plan saved in this browser.') : result.closedTrade ? 'Paper exit recorded with modeled costs.' : result.position ? 'Paper position opened at the saved entry assumption with modeled costs.' : 'Simulated cash added.')
  }
  const plans=portfolio.tradePlans.filter(p=>p.symbol===symbol)
  return <section aria-label="Saved share plans" className="analyst-journal">
    <h3>Saved share plans · {symbol}</h3>
    <p>Save the calculated scenario, then open a paper position at its assumed entry. The original plan stays attached through exit. These actions use simulated cash and place no broker order.</p>
    <div className="analyst-chart-controls">
      <button type="button" disabled={!scenario || scenario.quantity<1 || !!portfolio.storageError} onClick={()=>report(saveShareTradePlan(symbol,draft))}>Save calculated share plan</button>
      <button type="button" onClick={()=>{try {exportPaperPortfolioJSON();setError('');setMessage('Paper portfolio backup downloaded.')} catch(err){setError(err.message)}}}>Export paper portfolio backup</button>
    </div>
    {!scenario && <p className="analyst-legend">Calculate a scenario above to enable saving a new plan. Existing saved plans remain below.</p>}
    {(error || portfolio.storageError) && <p role="alert" className="research-error">{portfolio.storageError || error}</p>}
    {message && <p role="status">{message}</p>}
    <p><strong>Available paper cash: {money(portfolio.balance)}</strong> · shared with Paper portfolio.</p>
    <form className="research-controls" onSubmit={event=>{event.preventDefault();const result=addFunds(deposit);report(result);if(result.success)setDeposit('')}}>
      <label>Add simulated cash ($)<input required type="number" min="0.01" step="0.01" value={deposit} onChange={event=>setDeposit(event.target.value)}/></label><button type="submit" disabled={!!portfolio.storageError}>Add paper cash</button>
    </form>
    {!plans.length && <p>No saved share plans for {symbol} yet.</p>}
    {plans.map(saved=><SavedPlanCard key={saved.id} saved={saved} portfolio={portfolio} now={now} report={report}/>)}
    <p className="analyst-legend">Plans can open only on their saved New York date, once per plan, with sufficient paper cash. Entry/exit cash is rounded to cents. Deadline notices update while this view is open; no background notification or automatic exit runs. Stops can gap and planned loss is not a loss limit. R is net paper P&amp;L divided by original planned loss.</p>
    <p className="analyst-legend">Stored only in this browser, up to 200 saved plans. Export a backup before clearing storage. Completed results also appear in Paper portfolio; no backup import is included.</p>
  </section>
}
