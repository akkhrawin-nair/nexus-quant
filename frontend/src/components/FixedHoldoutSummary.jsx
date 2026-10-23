const n=value=>value==null?'Unavailable':Number(value).toLocaleString('en-US',{maximumFractionDigits:2})
export default function FixedHoldoutSummary({data}) {
  const validation=data.validation
  const download=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a')
    link.href=url;link.download=`kappa-fixed-holdout-${data.symbol}-${validation.evaluation_id}.json`
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  return <section aria-label="Fixed-rule historical holdout results">
    <div className="data-quality-notice"><strong>{validation.verdict}</strong>
      <span>Context only: {validation.context_start} → {validation.context_end}. Evaluated later dates: {data.start_date} → {data.end_date} ({data.observations} bars).</span>
      <span>No rule selection or refitting. Starting cash resets to ${n(data.initial_capital)}; no earlier position carries over. Excluded {validation.excluded_unfinished_or_future_bars} bar(s) dated {validation.completed_before_date} or later in New York.</span>
    </div>
    <dl className="research-metrics">{[
      ['Fixed-rule net return',`${n(data.return_pct)}%`],['Passive net return',`${n(data.benchmark.return_pct)}%`],
      ['Cash return',`${n(data.cash_benchmark.return_pct)}%`],['Fixed-rule drawdown',`${n(data.max_drawdown_pct)}%`],
      ['Closed holdout trades',data.total_trades],['Final fixed-rule equity',`$${n(data.final_equity)}`],
    ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p>Cash earns no interest. Passive buy-and-hold invests all affordable whole shares and retains leftover cash; its exposure differs from the strategy’s risk sizing and it has no 14-day cap. Both use the same dates and per-side cost assumptions.</p>
    <h3>Predetermined cost stress</h3><p>{data.cost_sensitivity.method} These are research assumptions, not Dime-verified charges.</p>
    <div className="research-table-scroll"><table><caption>Same frozen rules and holdout dates</caption><thead><tr><th>Scenario</th><th>Fee / slip (bps per side)</th><th>Strategy return</th><th>Drawdown</th><th>Closed trades</th><th>Passive return</th></tr></thead><tbody>{['base','stress'].map(key=>{const row=data.cost_sensitivity[key];return <tr key={key}><th scope="row">{key==='base'?'Entered costs':'Higher costs'}</th><td>{n(row.fee_bps)} / {n(row.slippage_bps)}</td><td>{n(row.return_pct)}%</td><td>{n(row.max_drawdown_pct)}%</td><td>{row.total_trades}</td><td>{n(row.buy_and_hold_return_pct)}%</td></tr>})}</tbody></table></div>
    <p><strong>Historical holdout does not mean pristine unseen data.</strong> Some history may already have been inspected. Changing tickers, periods or assumptions after seeing a result can overfit it. A positive result still needs forward paper evidence.</p>
    <details><summary>Evidence limits and reproducibility</summary><ul>{validation.warnings.map(warning=><li key={warning}>{warning}</li>)}</ul><p>Method {validation.method} · protocol {data.protocol.version} · evaluation {validation.evaluation_id}. Generated {new Date(validation.generated_at).toLocaleString()}.</p><p style={{overflowWrap:'anywhere'}}>Input SHA256: {validation.data_fingerprint}</p><p>The JSON report includes the exact input bars, parameters, rules, comparisons and trades. A fingerprint detects changed content; it does not authenticate a market-data source. JSON is a research report, not a broker statement or an importable journal backup.</p></details>
    <button type="button" onClick={download}>Download fixed-rule evaluation JSON</button>
    <p>Chart: blue = fixed strategy, green = passive buy-and-hold, amber = cash. Trades below belong only to the later evaluation period.</p>
  </section>
}
