/**
 * Risk Rating Utility for Retail & Beginner Investors
 * Rates assets on a 1 to 5 Capital Protection Scale:
 * Level 1: Low Risk (Index ETFs & Safe Havens)
 * Level 2: Moderate Risk (Blue-Chip Tech & Established Leaders)
 * Level 3: Medium-High Risk (High Beta Growth Equity)
 * Level 4: High Risk (Major Digital Assets / Cryptocurrencies)
 * Level 5: Very High Risk (High Volatility Altcoins & Speculative Assets)
 */

export function getRiskRatingMeta(symbol = '', assetType = '', lang = 'en') {
  const sym = (symbol || '').toUpperCase()
  const type = (assetType || '').toLowerCase()

  // Level 1: Low Risk (Index ETFs, Treasuries, Commodities/Gold)
  const isLevel1 = ['SPY', 'VOO', 'QQQ', 'DIA', 'IWM', 'TLT', 'GOLD', 'GC=F', 'SHV'].includes(sym) ||
                   type.includes('index') || type.includes('etf') || type.includes('treasury')

  // Level 2: Moderate Risk (Blue-Chip Tech, Mega-Cap Staples)
  const isLevel2 = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'BRK.B', 'JNJ', 'PG', 'XOM', 'V', 'MA'].includes(sym)

  // Level 4 & 5: Cryptocurrencies & Altcoins
  const isMajorCrypto = ['BTC', 'BTC-USD', 'ETH', 'ETH-USD'].includes(sym)
  const isCrypto = type.includes('crypto') || sym.includes('-USD') || sym.includes('USDT')

  let level = 3
  let titleEn = 'Level 3: Medium Risk'
  let titleTh = 'ระดับ 3: ความเสี่ยงปานกลาง'
  let badgeClass = 'risk-level-3'
  let icon = '📈'
  let color = '#f59e0b' // Amber
  let descEn = 'Growth equity asset. Moderate price swings expected.'
  let descTh = 'หุ้นเติบโตความเสี่ยงปานกลาง อาจมีความผันผวนของราคาในระยะสั้น'

  if (isLevel1) {
    level = 1
    titleEn = 'Level 1: Low Risk'
    titleTh = 'ระดับ 1: ความเสี่ยงต่ำ'
    badgeClass = 'risk-level-1'
    icon = '🛡️'
    color = '#10b981' // Emerald Green
    descEn = 'Diversified benchmark ETF / Safe haven asset. Ideal for long-term capital preservation.'
    descTh = 'สินทรัพย์อ้างอิงดัชนี / มีความมั่นคงสูง เหมาะสำหรับสะสมความมั่งคั่งระยะยาว'
  } else if (isLevel2) {
    level = 2
    titleEn = 'Level 2: Moderate Risk'
    titleTh = 'ระดับ 2: ความเสี่ยงปานกลาง'
    badgeClass = 'risk-level-2'
    icon = '⚖️'
    color = '#0284c7' // Sky Blue
    descEn = 'Established mega-cap leader with strong balance sheet & proven historical resilience.'
    descTh = 'หุ้นผู้นำตลาดขนาดใหญ่ มีงบการเงินแข็งแกร่ง ความเสี่ยงต่ำกว่าหุ้นทั่วไป'
  } else if (isMajorCrypto) {
    level = 4
    titleEn = 'Level 4: High Risk'
    titleTh = 'ระดับ 4: ความเสี่ยงสูง'
    badgeClass = 'risk-level-4'
    icon = '⚡'
    color = '#f97316' // Orange
    descEn = 'Major digital asset (Crypto). High upside potential accompanied by sharp short-term volatility.'
    descTh = 'สินทรัพย์ดิจิทัลหลัก มีโอกาสเติบโตสูง แต่มีความผันผวนของราคาสูง'
  } else if (isCrypto) {
    level = 5
    titleEn = 'Level 5: Very High Risk'
    titleTh = 'ระดับ 5: ความเสี่ยงสูงมาก'
    badgeClass = 'risk-level-5'
    icon = '🔥'
    color = '#ef4444' // Crimson Red
    descEn = 'Speculative altcoin asset. Expect extreme price swings — only invest risk capital.'
    descTh = 'เหรียญคริปโตความเสี่ยงสูงมาก มีความผันผวนรุนแรง เหมาะสำหรับผู้รับความเสี่ยงได้สูง'
  }

  return {
    level,
    label: lang === 'th' ? titleTh : titleEn,
    shortLabel: `Risk ${level}/5`,
    icon,
    color,
    badgeClass,
    description: lang === 'th' ? descTh : descEn
  }
}

/**
 * Calculates asset-specific, volatility-adjusted quantitative trade targets & stops:
 * - TP1: Dynamic Quick Win & De-Risk Target (+2.0% to +6.5%) -> Scale out 50% & move stop to breakeven ($0 risk)
 * - TP2: Full Technical Swing Expansion Target (+4.5% to +16.0%) -> Let remaining 50% ride
 * - Stop Loss: Tight technical invalidation stop (-1.8% to -4.5%) instead of a blind -7.5%
 * - Horizon: Estimated holding duration before stale trade cutoff (e.g. 3 - 5 days)
 */
export function calculateDynamicTradePlan(signal = {}, entryPrice = 0) {
  const ep = Number(entryPrice) || Number(signal.current_price) || Number(signal.close_price) || 100
  const sym = (signal.symbol || '').toUpperCase().trim()
  const assetType = (signal.asset_type || '').toLowerCase()
  const golden = signal.golden_opportunity || {}

  const isCrypto = assetType.includes('crypto') || sym.includes('-USD') || ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'].includes(sym)
  const isHighBeta = ['NVDA', 'TSLA', 'MSTR', 'PLTR', 'SMCI', 'AMD', 'COIN', 'ARM'].includes(sym)
  const isEtfOrCommodity = assetType.includes('etf') || assetType.includes('commodity') || ['SPY', 'QQQ', 'DIA', 'IWM', 'TLT', 'GLD', 'SLV', 'UNG', 'USO'].includes(sym)

  let tp2Pct = 8.5
  let slPct = 2.8
  let duration = golden.holding_duration || '3 - 5 Days'

  if (golden.target_pct && golden.target_pct > 0) {
    tp2Pct = Number(golden.target_pct)
  } else if (isCrypto) {
    tp2Pct = 13.5
    slPct = 4.2
    duration = '2 - 5 Days'
  } else if (isHighBeta) {
    tp2Pct = 9.8
    slPct = 3.2
    duration = '3 - 6 Days'
  } else if (isEtfOrCommodity) {
    tp2Pct = 4.8
    slPct = 1.8
    duration = '5 - 10 Days'
  } else {
    tp2Pct = 7.5
    slPct = 2.6
    duration = '3 - 5 Days'
  }

  if (golden.stop_pct && golden.stop_pct > 0) {
    slPct = Number(golden.stop_pct)
  }

  // TP1 is the scale-out target (50% position), minimum 2.0%
  const tp1Pct = Number(Math.max(2.0, (tp2Pct * 0.5)).toFixed(1))
  tp2Pct = Number(tp2Pct.toFixed(1))
  slPct = Number(slPct.toFixed(1))

  const tp1Val = ep * (1 + tp1Pct / 100)
  const tp2Val = ep * (1 + tp2Pct / 100)
  const slVal = ep * (1 - slPct / 100)

  return {
    entryPrice: ep,
    tp1Pct,
    tp2Pct,
    slPct,
    tp1Val,
    tp2Val,
    slVal,
    duration,
    riskRewardRatio: (tp2Pct / (slPct || 1)).toFixed(1)
  }
}
