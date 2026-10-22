// Standard same-root equity contracts only; root-to-underlying aliases are not inferred.
export function parseOptionContract(value) {
  const raw=typeof value==='string' ? value.trim().toUpperCase() : ''
  const match=/^([A-Z]{1,6}) {0,5}(\d{6})([CP])(\d{8})$/.exec(raw)
  if(!match || raw.length>21 || (raw.includes(' ') && raw.length!==21))throw new Error('Enter the broker’s exact compact or standard six-column-padded OCC option identifier. Adjusted/digit roots and non-standard identifiers are unsupported.')
  const [,symbol,date,side,strikeDigits]=match
  const expiration=`20${date.slice(0,2)}-${date.slice(2,4)}-${date.slice(4,6)}`
  const parsed=Date.parse(`${expiration}T00:00:00Z`), strike=Number(strikeDigits)/1000
  if(!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0,10)!==expiration || strike<=0)throw new Error('The option identifier has an invalid expiration or strike.')
  return {contractSymbol:`${symbol}${date}${side}${strikeDigits}`,symbol,type:side==='C' ? 'call' : 'put',strike,expiration}
}

export function confirmOptionContract(value,terms) {
  const contract=parseOptionContract(value)
  if(contract.symbol!==String(terms.symbol).trim().toUpperCase())throw new Error('Option identifier root differs from the entered ticker. Root aliases/adjustments are not inferred; verify the contract in the broker.')
  const mismatches=['type','expiration'].filter(key=>contract[key]!==terms[key])
  if(contract.strike!==Number(terms.strike))mismatches.push('strike')
  if(mismatches.length)throw new Error(`Option identifier differs from the entered ${mismatches.join(', ')}. Copy the matching exact contract before comparing costs.`)
  return contract.contractSymbol
}
