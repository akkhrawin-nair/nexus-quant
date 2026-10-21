import { numericValue } from './api.js'

export function matchingAlerts(rules, signals) {
  return rules.filter(rule => {
    if (!rule.enabled) return false
    const signal = signals.find(s => s.symbol === rule.ticker)
    if (!signal) return false
    const value = numericValue(rule.condition.startsWith('RSI') ? signal.radar?.rsi : signal.current_price)
    const target = numericValue(rule.targetValue)
    if (value == null || target == null) return false
    if (rule.condition === 'ABOVE' || rule.condition === 'RSI_HIGH') return value > target
    if (rule.condition === 'BELOW' || rule.condition === 'RSI_LOW') return value < target
    return false
  })
}
