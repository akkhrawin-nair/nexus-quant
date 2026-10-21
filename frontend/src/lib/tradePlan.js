import { marketDate } from './options.js'

export function shareTradePlan(draft, now = Date.now()) {
  const read = (key, minimum, maximum) => {
    const raw = String(draft[key] ?? '').trim(), value = Number(raw)
    if (!raw || !Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`Enter a valid ${key} between ${minimum} and ${maximum}.`)
    return value
  }
  const entry=read('entry',.0001,1e6), stop=read('stop',.0001,1e6), target=read('target',.0001,1e6)
  const capital=read('capital',.01,1e9), riskBudget=read('riskBudget',.01,capital)
  const fee=read('feeBps',0,100)/10000, slip=read('slippageBps',0,100)/10000
  if (!(stop < entry && entry < target)) throw new Error('For a long-share scenario, stop must be below entry and target above entry.')
  const today=Date.parse(`${marketDate(now)}T00:00:00Z`), exit=Date.parse(`${draft.exitDate}T00:00:00Z`)
  if (!Number.isFinite(exit) || new Date(exit).toISOString().slice(0,10)!==draft.exitDate || exit < today || exit > today+14*86400000) throw new Error('Choose an exit date within 14 New York calendar days of today.')
  const entryPerShare=entry*(1+slip)*(1+fee), stopPerShare=stop*(1-slip)*(1-fee), targetPerShare=target*(1-slip)*(1-fee)
  const riskPerShare=entryPerShare-stopPerShare, rewardPerShare=targetPerShare-entryPerShare
  let quantity=Math.floor(Math.min(capital/entryPerShare,riskBudget/riskPerShare))
  // Guard floating-point boundaries without exceeding the user's entered limits.
  while(quantity>0 && (quantity*entryPerShare>capital || quantity*riskPerShare>riskBudget)) quantity--
  return {quantity,entry,stop,target,entryCost:quantity*entryPerShare,plannedLoss:quantity*riskPerShare,
    plannedGain:quantity*rewardPerShare,rewardRisk:rewardPerShare/riskPerShare,
    exitDate:draft.exitDate,deadline:new Date(today+14*86400000).toISOString().slice(0,10)}
}
