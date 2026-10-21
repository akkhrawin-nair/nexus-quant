const DAY = 86400000
const cents = value => Math.round((value + Number.EPSILON) * 100) / 100

export function marketDate(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function optionEstimate(input, now = Date.now()) {
  const numeric = (key, minimum, maximum, integer = false) => {
    const raw = String(input[key] ?? '').trim()
    const value = Number(raw)
    if (!raw || !Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
      throw new Error(`Enter a valid ${key} between ${minimum} and ${maximum}${integer ? ' (whole number)' : ''}.`)
    }
    return value
  }
  const symbol = String(input.symbol || '').trim().toUpperCase()
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) throw new Error('Enter the underlying ticker.')
  if (!['call', 'put'].includes(input.type)) throw new Error('Select call or put.')
  const strike = numeric('strike', 0.0001, 1000000)
  const expiry = Date.parse(`${input.expiration}T00:00:00Z`)
  const today = Date.parse(`${marketDate(now)}T00:00:00Z`)
  if (!Number.isFinite(expiry) || new Date(expiry).toISOString().slice(0, 10) !== input.expiration || expiry < today || expiry > today + 14 * DAY) {
    throw new Error('Choose an expiration within 14 calendar days of today (New York market date).')
  }
  const bid = numeric('bid', 0, 1000000)
  const ask = numeric('ask', 0.0001, 1000000)
  if (bid > ask) throw new Error('Bid exceeds ask. Recheck both prices for the same contract and quote time.')
  const contracts = numeric('contracts', 1, 10000, true)
  const multiplier = numeric('multiplier', 1, 10000, true)
  const fee = numeric('fee', 0, 10000)
  const quoteTime = Date.parse(input.quoteTime)
  if (!Number.isFinite(quoteTime) || quoteTime > now + 5000) throw new Error('Enter the source quote time; it cannot be in the future.')
  const fees = fee * contracts
  const buyCost = cents(ask * contracts * multiplier + fees)
  const sellProceeds = cents(bid * contracts * multiplier - fees)
  return { symbol, type: input.type, strike, expiration: input.expiration, bid, ask, contracts, multiplier,
    quoteTime, entryDate: marketDate(now), stale: now - quoteTime > 60000, buyCost, sellProceeds,
    midpoint: (bid + ask) / 2, spread: ask - bid,
    spreadCost: cents((ask - bid) * contracts * multiplier),
    roundTripLoss: cents(buyCost - sellProceeds), fees: cents(fees), zeroBid: bid === 0 }
}

// Manual pre-trade review. Passing an arithmetic check never verifies a broker quote.
export function reviewOptionEstimate(estimate, plan, now = Date.now()) {
  const read = (key, max, optional = false, integer = false) => {
    const raw = String(plan[key] ?? '').trim()
    if (!raw && optional) return null
    const value = Number(raw)
    if (!raw || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) {
      const label = {budget:'premium budget', maxSpreadPct:'maximum spread percentage', bidSize:'bid size in whole contracts', askSize:'ask size in whole contracts'}[key]
      throw new Error(`Enter a valid ${label} from 0 to ${max}${optional ? ', or leave it blank if unknown' : ''}.`)
    }
    return value
  }
  const budget = read('budget', 1000000000)
  const maxSpreadPct = read('maxSpreadPct', 200)
  const bidSize = read('bidSize', 1000000000, true, true)
  const askSize = read('askSize', 1000000000, true, true)
  const exit = Date.parse(`${plan.plannedExit}T00:00:00Z`)
  if (!Number.isFinite(exit) || new Date(exit).toISOString().slice(0, 10) !== plan.plannedExit) throw new Error('Enter a valid planned exit date.')
  const today = Date.parse(`${marketDate(now)}T00:00:00Z`)
  const entry = Date.parse(`${estimate.entryDate}T00:00:00Z`)
  const expiry = Date.parse(`${estimate.expiration}T00:00:00Z`)
  const deadline = Math.min(entry + 14 * DAY, expiry)
  const spreadPct = estimate.spread / estimate.midpoint * 100
  const ageMs = now - estimate.quoteTime
  const ageSeconds = Math.max(0, Math.ceil(ageMs / 1000))
  const checks = [
    {id:'source', label:'Quote source', status:'unverified', detail:'Manual input. Broker price, contract terms, market session, and data entitlement are not verified.'},
    {id:'age', label:'Entered quote age', status:ageMs > 60000 ? 'attention' : 'pass', detail:`${ageSeconds}s old; local threshold is 60s. A recent entered timestamp does not prove a live quote.`},
    {id:'expiry', label:'Expiration window', status:expiry < today || expiry > entry + 14 * DAY ? 'attention' : 'pass', detail:`${estimate.expiration}; must remain unexpired and within 14 calendar days of the plan start.`},
    {id:'exit', label:'Planned exit', status:exit < today || exit < entry || exit > deadline ? 'attention' : 'pass', detail:`${plan.plannedExit}; latest allowed date is ${new Date(deadline).toISOString().slice(0,10)}. Calendar dates use New York; set an exact executable exit time in your broker before its cutoff.`},
    {id:'budget', label:'Premium budget', status:estimate.buyCost > budget ? 'attention' : 'pass', detail:`Ask-based cost $${estimate.buyCost.toFixed(2)} versus your $${budget.toFixed(2)} cap.`},
    {id:'spread', label:'Spread threshold', status:spreadPct - maxSpreadPct > 1e-9 ? 'attention' : 'pass', detail:`${spreadPct.toFixed(2)}% of midpoint versus your ${maxSpreadPct}% threshold. This is a personal filter, not a liquidity guarantee.`},
    ...[['buySize', 'Buy quote size', askSize], ['sellSize', 'Sell quote size', bidSize]].map(([id,label,size]) => ({id,label,
      status:size == null ? 'unverified' : size < estimate.contracts || (id === 'sellSize' && estimate.zeroBid) ? 'attention' : 'pass',
      detail:size == null ? 'Not supplied. Quantity at this price is unknown.' : `${size} quoted contracts for ${estimate.contracts} requested. Sizes can change before execution.`})),
  ]
  return {checks, spreadPct, ageSeconds, verifiedForTrading:false,
    plannedExit:plan.plannedExit, deadline:new Date(deadline).toISOString().slice(0,10),
    breakEvenExitBid:estimate.ask + 2 * estimate.fees / (estimate.contracts * estimate.multiplier)}
}
