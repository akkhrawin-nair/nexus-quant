// frontend/src/utils/paperTradingStorage.js
import { shareTradePlan } from '../lib/tradePlan.js';
import { marketDate } from '../lib/options.js';

const STORAGE_KEY = 'nexus_quant_paper_portfolio';
const DEFAULT_INITIAL_BALANCE = 6.00;
const MAX_CASH = 1e12;
const validCash = value => Number.isFinite(value) && value >= 0 && value <= MAX_CASH;
const invalidNumbers = value => typeof value === 'number' ? !Number.isFinite(value) :
  value !== null && typeof value === 'object' && Object.values(value).some(invalidNumbers);

export const DEFAULT_PORTFOLIO = {
  version: 2,
  balance: DEFAULT_INITIAL_BALANCE,
  initialBalance: DEFAULT_INITIAL_BALANCE,
  positions: [],
  history: [],
  tradePlans: []
};

/**
 * Retrieves portfolio from localStorage or initializes default.
 */
export function getPortfolio(storage = localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return structuredClone(DEFAULT_PORTFOLIO);
    }
    const data = JSON.parse(raw);
    if (!data || !validCash(data.balance) || !validCash(data.initialBalance) || invalidNumbers(data) ||
        !Array.isArray(data.positions) || !Array.isArray(data.history) ||
        (data.version && data.version !== 2)) {
      throw new Error('Stored portfolio format is invalid or unsupported. Export or restore your saved data before trading.');
    }
    if (data.positions.some(p => !p || !p.id || !p.symbol || !positive(p.quantity) || !positive(p.entryPrice) || !positive(p.totalCost))) {
      throw new Error('Stored positions require repair; the saved data has been preserved.');
    }
    if (data.history.some(h => !h || typeof h !== 'object' || !Number.isFinite(h.pnlDollar))) {
      throw new Error('Stored trade history requires repair; the saved data has been preserved.');
    }
    if ((data.tradePlans !== undefined && (!Array.isArray(data.tradePlans) || data.tradePlans.length > 200 ||
        !data.tradePlans.every(validSavedPlan) || new Set(data.tradePlans.map(p => p.id)).size !== data.tradePlans.length)) ||
        [...data.positions, ...data.history].some(p => p.tradePlan && !validSavedPlan(p.tradePlan))) {
      throw new Error('Stored share plans require repair; the saved portfolio has been preserved.');
    }
    return {
      version: 2,
      balance: typeof data.balance === 'number' ? data.balance : DEFAULT_INITIAL_BALANCE,
      initialBalance: typeof data.initialBalance === 'number' ? data.initialBalance : DEFAULT_INITIAL_BALANCE,
      positions: Array.isArray(data.positions) ? data.positions : [],
      history: Array.isArray(data.history) ? data.history : [],
      tradePlans: data.tradePlans || []
    };
  } catch (err) {
    return { ...structuredClone(DEFAULT_PORTFOLIO), storageError: err.message };
  }
}

/**
 * Saves portfolio to localStorage and dispatches an event for reactive UI updates.
 */
export function savePortfolio(portfolio) {
  try {
    if (portfolio.storageError) throw new Error(portfolio.storageError);
    if (!validCash(portfolio.balance) || !validCash(portfolio.initialBalance) || invalidNumbers(portfolio)) {
      throw new Error('Cash or computed values exceed the supported finite range ($0 to $1 trillion).');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...portfolio, version: 2 }));
    window.dispatchEvent(new CustomEvent('paperPortfolioUpdated', { detail: portfolio }));
    return true;
  } catch (err) {
    throw new Error(`Portfolio could not be saved: ${err.message}`, { cause: err });
  }
}

const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const cents = value => Math.round((value + Number.EPSILON) * 100) / 100;
function persist(portfolio) {
  try {
    savePortfolio(portfolio);
    return null;
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function validSavedPlan(plan) {
  try {
    if (!plan || plan.version !== 1 || typeof plan.id !== 'string' || !plan.id ||
        !/^[A-Z0-9^][A-Z0-9.^=-]{0,19}$/.test(plan.symbol) ||
        typeof plan.savedAt !== 'string' || !Number.isFinite(Date.parse(plan.savedAt)) ||
        !(plan.positionId === null || (typeof plan.positionId === 'string' && plan.positionId)) ||
        !plan.inputs || !plan.scenario) return false;
    const calculated = shareTradePlan(plan.inputs, Date.parse(plan.savedAt));
    return calculated.quantity > 0 && Object.entries(calculated).every(([key, value]) => plan.scenario[key] === value);
  } catch { return false; }
}

export function saveShareTradePlan(symbol, draft, now = Date.now()) {
  const portfolio = getPortfolio();
  if (portfolio.storageError) return {success:false, message:portfolio.storageError};
  try {
    if (typeof symbol !== 'string' || !/^[A-Z0-9^][A-Z0-9.^=-]{0,19}$/i.test(symbol)) throw new Error('Invalid ticker symbol.');
    const scenario = shareTradePlan(draft, now);
    if (scenario.quantity < 1) throw new Error('The entered budget cannot support one whole share.');
    const inputs = Object.fromEntries(['entry','stop','target','capital','riskBudget','feeBps','slippageBps'].map(key => [key, Number(draft[key])]));
    inputs.exitDate = draft.exitDate;
    const duplicate = portfolio.tradePlans.find(p => p.symbol === symbol.toUpperCase() &&
      marketDate(Date.parse(p.savedAt)) === marketDate(now) && JSON.stringify(p.inputs) === JSON.stringify(inputs));
    if (duplicate) return {success:true, plan:duplicate, duplicate:true};
    if (portfolio.tradePlans.length >= 200) throw new Error('The 200 saved-plan limit has been reached. Export a portfolio backup.');
    const plan = {version:1, id:`plan-${crypto.randomUUID()}`, symbol:symbol.toUpperCase(),
      savedAt:new Date(now).toISOString(), inputs, scenario, positionId:null};
    portfolio.tradePlans.unshift(plan);
    const failure = persist(portfolio);
    return failure || {success:true, plan};
  } catch (error) { return {success:false, message:error.message}; }
}

export function openPlannedPosition(planId, now = Date.now()) {
  const portfolio = getPortfolio();
  if (portfolio.storageError) return {success:false, message:portfolio.storageError};
  const plan = portfolio.tradePlans.find(p => p.id === planId);
  if (!plan) return {success:false, message:'Saved plan not found.'};
  if (plan.positionId) return {success:false, message:'This saved plan has already opened a paper position.'};
  if (!Number.isFinite(now)) return {success:false, message:'A valid simulated entry time is required.'};
  if (marketDate(Date.parse(plan.savedAt)) !== marketDate(now)) return {success:false, message:'This plan was saved on an earlier day. Recalculate and save a new plan before opening it.'};
  const cost = cents(plan.scenario.entryCost);
  const stopValue = cents(plan.scenario.quantity * plan.scenario.stop * (1-plan.inputs.slippageBps/10000) * (1-plan.inputs.feeBps/10000));
  if (cost > plan.inputs.capital || cents(cost-stopValue) > plan.inputs.riskBudget) return {success:false, message:'Cent rounding exceeds a saved planning limit. Adjust and save a new plan.'};
  if (cost < .01 || cost > portfolio.balance) return {success:false, message:`Insufficient simulated cash. Required $${cost.toFixed(2)}; available $${portfolio.balance.toFixed(2)}.`};
  const id = `pos-${crypto.randomUUID()}`;
  plan.positionId = id;
  const position = {id, symbol:plan.symbol, assetType:'Stock', entryPrice:plan.scenario.entry,
    quantity:plan.scenario.quantity, totalCost:cost, stopLoss:plan.scenario.stop,
    takeProfit:plan.scenario.target, entryDate:new Date(now).toISOString(),
    reason:'Saved share plan; simulated entry at user-entered reference with modeled costs',
    tradePlan:structuredClone(plan)};
  portfolio.balance = cents(portfolio.balance-cost);
  portfolio.positions.unshift(position);
  const failure = persist(portfolio);
  return failure || {success:true, position, remainingBalance:portfolio.balance};
}

export function plannedDeadline(position, now = Date.now()) {
  const plan = position?.tradePlan;
  if (!plan) return null;
  const date = plan.scenario.exitDate;
  const remaining = (Date.parse(date)-Date.parse(marketDate(now)))/86400000;
  return {date, daysRemaining:remaining, kind:remaining < 0 ? 'overdue' : remaining === 0 ? 'due_today' : remaining <= 2 ? 'due_soon' : 'scheduled'};
}

/**
 * Executes a simulated BUY order.
 */
export function openPosition({
  symbol,
  assetType = 'Stock',
  entryPrice,
  amount,
  stopLoss = null,
  takeProfit = null,
  reason = 'Quantitative Signal Follow'
}) {
  const portfolio = getPortfolio();
  if (portfolio.storageError) return { success: false, message: portfolio.storageError };
  const price = Number(entryPrice);
  const totalAmount = Number(amount);

  if (!positive(price) || price > MAX_CASH) {
    return { success: false, message: 'Invalid entry price' };
  }
  if (!positive(totalAmount) || totalAmount > MAX_CASH || cents(totalAmount) < .01) {
    return { success: false, message: 'Please enter a valid investment amount' };
  }
  if (cents(totalAmount) > portfolio.balance) {
    return { 
      success: false, 
      message: `Insufficient cash. Available: $${portfolio.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}` 
    };
  }

  // Calculate fractional quantity (supports micro accounts with up to 5 decimals)
  if (typeof symbol !== 'string' || !/^[A-Z0-9^][A-Z0-9.^=-]{0,19}$/i.test(symbol)) {
    return { success: false, message: 'Invalid ticker symbol' };
  }
  for (const level of [stopLoss, takeProfit]) {
    if (level !== null && !positive(Number(level))) return { success: false, message: 'Trade levels must be positive finite prices' };
  }
  const rawQty = cents(totalAmount) / price;
  // Allow high fractional precision (5 decimals) so small accounts ($1.50 - $6.00) can buy fractional shares accurately
  const quantity = Math.floor(rawQty * 1e12) / 1e12;
  if (!positive(quantity)) return { success: false, message: 'Amount is too small for supported quantity precision' };
  const actualCost = cents(quantity * price);
  if (actualCost < .01) return { success: false, message: 'Minimum purchase is $0.01' };

  const newPosition = {
    id: `pos-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    symbol: symbol.toUpperCase(),
    assetType,
    entryPrice: price,
    quantity,
    totalCost: actualCost,
    stopLoss: stopLoss ? Number(stopLoss) : null,
    takeProfit: takeProfit ? Number(takeProfit) : null,
    entryDate: new Date().toISOString(),
    reason
  };

  portfolio.balance = Number((portfolio.balance - actualCost).toFixed(2));
  portfolio.positions.unshift(newPosition);

  const failure = persist(portfolio);
  if (failure) return failure;
  return { success: true, position: newPosition, remainingBalance: portfolio.balance };
}

/**
 * Closes an open position at the current market price.
 */
export function closePosition(positionId, exitPrice, {now = Date.now(), priceSource = 'Observed daily close; freshness not verified'} = {}) {
  const portfolio = getPortfolio();
  if (portfolio.storageError) return { success: false, message: portfolio.storageError };
  const index = portfolio.positions.findIndex(p => p.id === positionId);

  if (index === -1) {
    return { success: false, message: 'Position not found' };
  }

  const pos = portfolio.positions[index];
  const closePrice = Number(exitPrice);
  if (!positive(closePrice) || closePrice > MAX_CASH) return { success: false, message: 'A positive observed exit price within the supported finite range is required' };
  if (!Number.isFinite(now) || now < Date.parse(pos.entryDate)) return {success:false, message:'The simulated exit time cannot precede entry.'};
  const fee = pos.tradePlan ? pos.tradePlan.inputs.feeBps/10000 : 0;
  const slip = pos.tradePlan ? pos.tradePlan.inputs.slippageBps/10000 : 0;
  const exitValue = Number((pos.quantity * closePrice * (1-slip) * (1-fee)).toFixed(2));
  const pnlDollar = Number((exitValue - pos.totalCost).toFixed(2));
  const pnlPercent = pos.totalCost > 0 ? Number(((pnlDollar / pos.totalCost) * 100).toFixed(2)) : 0.0;

  const closedTrade = {
    id: pos.id,
    symbol: pos.symbol,
    assetType: pos.assetType,
    entryPrice: pos.entryPrice,
    exitPrice: closePrice,
    quantity: pos.quantity,
    totalCost: pos.totalCost,
    exitValue,
    pnlDollar,
    pnlPercent,
    entryDate: pos.entryDate,
    exitDate: new Date(now).toISOString(),
    outcome: pnlDollar > 0 ? 'WIN' : pnlDollar < 0 ? 'LOSS' : 'BREAKEVEN',
    reason: pos.reason,
    exitPriceSource: priceSource,
    ...(pos.tradePlan ? {tradePlan:structuredClone(pos.tradePlan),
      realizedR:pnlDollar/pos.tradePlan.scenario.plannedLoss,
      exitDateMissed:marketDate(now) > pos.tradePlan.scenario.exitDate,
      holdingDeadlineMissed:marketDate(now) > pos.tradePlan.scenario.deadline} : {})
  };

  portfolio.balance = Number((portfolio.balance + exitValue).toFixed(2));
  portfolio.positions.splice(index, 1);
  portfolio.history.unshift(closedTrade);

  const failure = persist(portfolio);
  if (failure) return failure;
  return { success: true, closedTrade, newBalance: portfolio.balance };
}

/**
 * Adds funds / cash to the paper trading portfolio.
 */
export function addFunds(amountToAdd) {
  const portfolio = getPortfolio();
  if (portfolio.storageError) return { success: false, message: portfolio.storageError };
  const amt = Number(amountToAdd);
  if (!positive(amt) || amt > MAX_CASH || cents(amt) < .01 || !validCash(portfolio.balance + amt) || !validCash(portfolio.initialBalance + amt)) return { success: false, message: 'Invalid deposit amount or account limit exceeded' };
  portfolio.balance = Number((portfolio.balance + amt).toFixed(2));
  portfolio.initialBalance = Number((portfolio.initialBalance + amt).toFixed(2));
  const failure = persist(portfolio);
  if (failure) return failure;
  return { success: true, newBalance: portfolio.balance };
}

/**
 * Resets the paper portfolio back to a clean starting cash balance.
 */
export function resetPortfolio(startingCash = DEFAULT_INITIAL_BALANCE) {
  if (!positive(Number(startingCash)) || Number(startingCash) > MAX_CASH) throw new Error('Starting cash must be finite and within the supported range.');
  const cash = cents(Number(startingCash));
  const fresh = {
    version: 2,
    balance: Number(cash.toFixed(2)),
    initialBalance: Number(cash.toFixed(2)),
    positions: [],
    history: [],
    tradePlans: []
  };
  savePortfolio(fresh);
  return fresh;
}

/**
 * Computes live portfolio performance metrics based on current prices.
 */
export function calculatePortfolioStats(portfolio, livePricesMap = {}) {
  const balance = portfolio?.balance || 0;
  const initialBalance = portfolio?.initialBalance ?? DEFAULT_INITIAL_BALANCE;
  const positions = portfolio?.positions || [];
  const history = portfolio?.history || [];

  let totalOpenCost = 0;
  let totalOpenValue = 0;

  positions.forEach(pos => {
    const livePrice = livePricesMap[pos.symbol];
    const fee = pos.tradePlan ? pos.tradePlan.inputs.feeBps/10000 : 0;
    const slip = pos.tradePlan ? pos.tradePlan.inputs.slippageBps/10000 : 0;
    const currentVal = positive(livePrice) ? pos.quantity * livePrice * (1-slip) * (1-fee) : pos.totalCost;
    totalOpenCost += pos.totalCost;
    totalOpenValue += currentVal;
  });

  const totalEquity = balance + totalOpenValue;
  const unrealizedPnlDollar = totalOpenValue - totalOpenCost;
  const unrealizedPnlPercent = totalOpenCost > 0 ? (unrealizedPnlDollar / totalOpenCost) * 100 : 0.0;

  const totalRealizedPnl = history.reduce((sum, h) => sum + (h.pnlDollar || 0), 0);
  const allTimeRoiDollar = totalEquity - initialBalance;
  const allTimeRoiPercent = initialBalance > 0 ? (allTimeRoiDollar / initialBalance) * 100 : 0.0;

  const totalClosed = history.length;
  const wins = history.filter(h => (h.pnlDollar || 0) > 0).length;
  const losses = history.filter(h => (h.pnlDollar || 0) < 0).length;
  const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0.0;

  const grossWins = history.filter(h => h.pnlDollar > 0).reduce((sum, h) => sum + h.pnlDollar, 0);
  const grossLosses = Math.abs(history.filter(h => h.pnlDollar < 0).reduce((sum, h) => sum + h.pnlDollar, 0));
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : null;

  // Streak Tracking (Current consecutive wins/losses and all-time best)
  let currentStreak = 0;
  let streakType = 'NONE'; // 'WIN' | 'LOSS' | 'NONE'
  let bestWinStreak = 0;
  let runningWinStreak = 0;

  // Chronological order (oldest to newest) to calculate best all-time streak
  const chronological = [...history].sort((a, b) => new Date(a.exitDate || 0) - new Date(b.exitDate || 0));
  chronological.forEach(h => {
    const isWin = (h.pnlDollar || 0) > 0;
    if (isWin) {
      runningWinStreak += 1;
      if (runningWinStreak > bestWinStreak) {
        bestWinStreak = runningWinStreak;
      }
    } else {
      runningWinStreak = 0;
    }
  });

  // Current streak from newest trade backwards (history[0] is latest)
  if (history.length > 0) {
    const outcomeOf = h => h.pnlDollar > 0 ? 'WIN' : h.pnlDollar < 0 ? 'LOSS' : 'NONE';
    const firstOutcome = outcomeOf(history[0]);
    streakType = firstOutcome;
    for (let i = 0; i < history.length; i++) {
      const outcome = outcomeOf(history[i]);
      if (outcome === firstOutcome && outcome !== 'NONE') {
        currentStreak += 1;
      } else {
        break;
      }
    }
  }

  const currentStreakBadge = streakType === 'WIN'
    ? `🔥 ${currentStreak} Win Streak`
    : streakType === 'LOSS'
    ? `🛑 ${currentStreak} Loss Streak`
    : '⚡ No Closed Trades';

  const avgTradePnl = totalClosed > 0 ? Number((totalRealizedPnl / totalClosed).toFixed(2)) : 0.0;

  return {
    balance: Number(balance.toFixed(2)),
    initialBalance,
    totalEquity: Number(totalEquity.toFixed(2)),
    openPositionsCount: positions.length,
    totalOpenCost: Number(totalOpenCost.toFixed(2)),
    totalOpenValue: Number(totalOpenValue.toFixed(2)),
    unrealizedPnlDollar: Number(unrealizedPnlDollar.toFixed(2)),
    unrealizedPnlPercent: Number(unrealizedPnlPercent.toFixed(2)),
    totalRealizedPnl: Number(totalRealizedPnl.toFixed(2)),
    allTimeRoiDollar: Number(allTimeRoiDollar.toFixed(2)),
    allTimeRoiPercent: Number(allTimeRoiPercent.toFixed(2)),
    totalClosed,
    wins,
    losses,
    winRate: Number(winRate.toFixed(1)),
    profitFactor: profitFactor === null ? null : Number(profitFactor.toFixed(2)),
    currentStreak,
    streakType,
    currentStreakBadge,
    bestWinStreak,
    avgTradePnl
  };
}

/**
 * Exports closed trade history to a downloadable CSV file.
 */
export function exportPortfolioHistoryToCSV(portfolio) {
  const history = portfolio?.history || [];
  if (history.length === 0) {
    alert('No closed trades in history to export yet.');
    return false;
  }

  const headers = [
    'Trade ID',
    'Symbol',
    'Asset Type',
    'Entry Date',
    'Exit Date',
    'Entry Price ($)',
    'Exit Price ($)',
    'Quantity',
    'Total Cost ($)',
    'Exit Value ($)',
    'Net PnL ($)',
    'Return (%)',
    'Outcome',
    'Strategy / Notes',
    'Planned Stop ($)', 'Planned Target ($)', 'Planned Exit Date', '14-Day Deadline',
    'Fees Per Side (bps)', 'Slippage Per Side (bps)', 'Original Planned Loss ($)',
    'Realized R', 'Exit Date Missed', 'Exit Price Source'
  ];

  const rows = history.map(t => [
    `"${t.id}"`,
    `"${t.symbol}"`,
    `"${t.assetType || 'Stock'}"`,
    `"${t.entryDate || ''}"`,
    `"${t.exitDate || ''}"`,
    t.entryPrice !== undefined ? Number(t.entryPrice).toFixed(2) : '0.00',
    t.exitPrice !== undefined ? Number(t.exitPrice).toFixed(2) : '0.00',
    t.quantity !== undefined ? t.quantity : 0,
    t.totalCost !== undefined ? Number(t.totalCost).toFixed(2) : '0.00',
    t.exitValue !== undefined ? Number(t.exitValue).toFixed(2) : '0.00',
    t.pnlDollar !== undefined ? Number(t.pnlDollar).toFixed(2) : '0.00',
    t.pnlPercent !== undefined ? Number(t.pnlPercent).toFixed(2) : '0.00',
    `"${t.outcome || (t.pnlDollar >= 0 ? 'WIN' : 'LOSS')}"`,
    `"${(t.reason || '').replace(/"/g, '""')}"`,
    t.tradePlan?.scenario.stop ?? '', t.tradePlan?.scenario.target ?? '',
    t.tradePlan?.scenario.exitDate ?? '', t.tradePlan?.scenario.deadline ?? '',
    t.tradePlan?.inputs.feeBps ?? '', t.tradePlan?.inputs.slippageBps ?? '',
    t.tradePlan?.scenario.plannedLoss ?? '', t.realizedR ?? '', t.exitDateMissed ?? '',
    `"${(t.exitPriceSource || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const todayStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `kappa_trade_ledger_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

export function exportPaperPortfolioJSON() {
  const raw = localStorage.getItem(STORAGE_KEY) ?? JSON.stringify(DEFAULT_PORTFOLIO);
  const url = URL.createObjectURL(new Blob([raw], {type:'application/json'}));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `kappa-paper-portfolio-${new Date().toISOString().slice(0,10)}.json`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}
