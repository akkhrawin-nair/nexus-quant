import { useState } from 'react'
import { optionModel, impliedVolatility, modelScenarios } from '../lib/optionModel'
import { marketDate } from '../lib/options'

const n=value=>value===null?'Not available':Number(value).toFixed(4)
export default function OptionModelRisk({ticket,now}) {
  const [form,setForm]=useState({spot:'',days:'',iv:'',rate:'',dividend:''}),[result,setResult]=useState(null),[error,setError]=useState('')
  const field=(key,label)=><label>{label}<input required type="number" step="any" value={form[key]} onChange={e=>{setForm({...form,[key]:e.target.value});setResult(null)}}/></label>
  const calculate=e=>{
    e.preventDefault();setError('');setResult(null)
    try{
      const input={...form,strike:ticket.estimate.strike,type:ticket.estimate.type}
      if(Number(form.days)<=0)throw new Error('Enter positive remaining model days; exact broker expiry cutoff remains unverified.')
      const daysLeft=Math.min(14,(Date.parse(ticket.estimate.expiration)-Date.parse(marketDate(now)))/86400000+1)
      if(Number(form.days)>daysLeft)throw new Error('Model days extend beyond the contract expiration date. Recheck the actual broker cutoff.')
      const model=optionModel(input),mid=(ticket.estimate.bid+ticket.estimate.ask)/2
      setResult({model,iv:impliedVolatility(input,mid),rows:modelScenarios(input),inputs:{...form},calculatedAt:new Date(now).toISOString()})
    }catch(failure){setError(failure.message)}
  }
  return <details><summary>Greeks, IV and time-decay scenarios · theoretical model</summary>
    <section aria-label="Options theoretical risk model"><h3>Model risk, separate from broker quotes</h3>
      <p>European Black–Scholes approximation for {ticket.estimate.symbol} {ticket.estimate.type}, strike ${ticket.estimate.strike}. Enter your assumptions. American early exercise, discrete dividends, adjusted deliverables and changing volatility are not modeled. These values cannot replace Dime bid/ask quotes.</p>
      <form onSubmit={calculate} aria-label="Options model assumptions"><div className="research-controls">
        {field('spot','Model underlying price ($)')}{field('days','Model days to expiry (0–14)')}{field('iv','Assumed annual IV (%)')}{field('rate','Assumed annual risk-free rate (%)')}{field('dividend','Assumed annual dividend yield (%)')}
      </div><button>Calculate theoretical risk</button></form>
      {error&&<p role="alert">{error}</p>}
      {result&&<section aria-label="Theoretical risk results"><p>Calculated {new Date(result.calculatedAt).toLocaleString()} from entered assumptions. Ticket quote age: {Math.max(0,Math.floor((now-ticket.estimate.quoteTime)/1000))} seconds; source remains unverified. Model days are an assumption, not a verified expiry timestamp.</p>
        <dl className="research-metrics">{[['Theoretical price / unit',n(result.model.price)],['Delta / $1 stock move',n(result.model.delta)],['Gamma / $1 stock move',n(result.model.gamma)],['Theta / calendar day / unit',n(result.model.theta)],['Vega / 1 IV point / unit',n(result.model.vega)],['Midpoint-implied IV (%)',result.iv===null?'No solution in 0.01–500%':n(result.iv)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <p>Greeks are local sensitivities per unit; multiply by the actual deliverable and quantity only when appropriate. IV is inferred from the entered midpoint under this model; it is not independently supplied market IV. Theta does not predict tomorrow’s actual price.</p>
        <div className="research-table-scroll"><table><caption>Constant-IV scenarios · theoretical price per unit, not executable bids</caption><thead><tr><th>Elapsed days</th><th>Stock move</th><th>Model price</th></tr></thead><tbody>{result.rows.map(row=><tr key={`${row.elapsedDays}:${row.movePct}`}><td>{row.elapsedDays}</td><td>{row.movePct}%</td><td>${n(row.price)}</td></tr>)}</tbody></table></div>
      </section>}
      <p><a href="https://www.optionseducation.org/advancedconcepts/black-scholes-formula" target="_blank" rel="noreferrer">OCC: pricing model limitations</a> · No model price is saved as a paper exit or a fill.</p>
    </section></details>
}
