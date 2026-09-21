// frontend/src/utils/paperTradingStorage.js

const STORAGE_KEY = 'nexus_quant_paper_portfolio';
const DEFAULT_INITIAL_BALANCE = 6.00;

export const DEFAULT_PORTFOLIO = {
  balance: DEFAULT_INITIAL_BALANCE,
  initialBalance: DEFAULT_INITIAL_BALANCE,
  positions: [],
  history: []
};

/**
 * Retrieves portfolio from localStorage or initializes default.
 */
export function getPortfolio() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      savePortfolio(DEFAULT_PORTFOLIO);
      return { ...DEFAULT_PORTFOLIO };
    }
    const data = JSON.parse(raw);
    // If user has the legacy fake $10,000 balance, migrate to real $6.00 capital
    if (data.initialBalance === 10000 || data.balance === 10000) {
      const migrated = {
        balance: DEFAULT_INITIAL_BALANCE,
        initialBalance: DEFAULT_INITIAL_BALANCE,
        positions: [],
        history: []
      };
      savePortfolio(migrated);
      return migrated;
    }
    return {
      balance: typeof data.balance === 'number' ? data.balance : DEFAULT_INITIAL_BALANCE,
      initialBalance: typeof data.initialBalance === 'number' ? data.initialBalance : DEFAULT_INITIAL_BALANCE,
      positions: Array.isArray(data.positions) ? data.positions : [],
      history: Array.isArray(data.history) ? data.history : []
    };
  } catch (err) {
    console.error('Error loading paper portfolio:', err);
    return { ...DEFAULT_PORTFOLIO };
  }
}

/**
 * Saves portfolio to localStorage and dispatches an event for reactive UI updates.
 */
export function savePortfolio(portfolio) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
    window.dispatchEvent(new CustomEvent('paperPortfolioUpdated', { detail: portfolio }));
  } catch (err) {
    console.error('Error saving paper portfolio:', err);
  }
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
  const price = Number(entryPrice);
  const totalAmount = Number(amount);

  if (!price || price <= 0) {
    return { success: false, message: 'Invalid entry price' };
  }
  if (!totalAmount || totalAmount <= 0) {
    return { success: false, message: 'Please enter a valid investment amount' };
  }
  if (totalAmount > portfolio.balance) {
    return { 
      success: false, 
      message: `Insufficient cash. Available: $${portfolio.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}` 
    };
  }

  // Calculate fractional quantity (supports micro accounts with up to 5 decimals)
  const rawQty = totalAmount / price;
  // Allow high fractional precision (5 decimals) so small accounts ($1.50 - $6.00) can buy fractional shares accurately
  const quantity = Number(rawQty.toFixed(5));
  const actualCost = Number(totalAmount.toFixed(2));

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

  savePortfolio(portfolio);
  return { success: true, position: newPosition, remainingBalance: portfolio.balance };
}

/**
 * Closes an open position at the current market price.
 */
export function closePosition(positionId, exitPrice) {
  const portfolio = getPortfolio();
  const index = portfolio.positions.findIndex(p => p.id === positionId);

  if (index === -1) {
    return { success: false, message: 'Position not found' };
  }

  const pos = portfolio.positions[index];
  const closePrice = Number(exitPrice) || pos.entryPrice;
  const exitValue = Number((pos.quantity * closePrice).toFixed(2));
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
    exitDate: new Date().toISOString(),
    outcome: pnlDollar >= 0 ? 'WIN' : 'LOSS',
    reason: pos.reason
  };

  portfolio.balance = Number((portfolio.balance + exitValue).toFixed(2));
  portfolio.positions.splice(index, 1);
  portfolio.history.unshift(closedTrade);

  savePortfolio(portfolio);
  return { success: true, closedTrade, newBalance: portfolio.balance };
}

/**
 * Resets the paper portfolio back to a clean starting cash balance.
 */
export function resetPortfolio(startingCash = DEFAULT_INITIAL_BALANCE) {
  const fresh = {
    balance: Number(startingCash) || DEFAULT_INITIAL_BALANCE,
    initialBalance: Number(startingCash) || DEFAULT_INITIAL_BALANCE,
    positions: [],
    history: []
  };
  savePortfolio(fresh);
  return fresh;
}

/**
 * Computes live portfolio performance metrics based on current prices.
 */
export function calculatePortfolioStats(portfolio, livePricesMap = {}) {
  const balance = portfolio?.balance || 0;
  const initialBalance = portfolio?.initialBalance || DEFAULT_INITIAL_BALANCE;
  const positions = portfolio?.positions || [];
  const history = portfolio?.history || [];

  let totalOpenCost = 0;
  let totalOpenValue = 0;

  positions.forEach(pos => {
    const livePrice = livePricesMap[pos.symbol] || pos.entryPrice;
    const currentVal = pos.quantity * livePrice;
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
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? 99.9 : 0.0;

  // Streak Tracking (Current consecutive wins/losses and all-time best)
  let currentStreak = 0;
  let streakType = 'NONE'; // 'WIN' | 'LOSS' | 'NONE'
  let bestWinStreak = 0;
  let runningWinStreak = 0;

  // Chronological order (oldest to newest) to calculate best all-time streak
  const chronological = [...history].sort((a, b) => new Date(a.exitDate || 0) - new Date(b.exitDate || 0));
  chronological.forEach(h => {
    const isWin = (h.pnlDollar || 0) >= 0;
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
    const firstOutcome = (history[0].pnlDollar || 0) >= 0 ? 'WIN' : 'LOSS';
    streakType = firstOutcome;
    for (let i = 0; i < history.length; i++) {
      const outcome = (history[i].pnlDollar || 0) >= 0 ? 'WIN' : 'LOSS';
      if (outcome === firstOutcome) {
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
    profitFactor: Number(profitFactor.toFixed(2)),
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
    'Strategy / Notes'
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
    `"${(t.reason || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const todayStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `wehawt_trade_ledger_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
