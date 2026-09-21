# 🏛️ KAPPA // Quantitative Equity & Portfolio Risk Terminal

> Institutional-grade quantitative stock & ETF analytics terminal, AI Confluence Brain, Markowitz portfolio optimizer, and Monte Carlo risk engine.

---

## ⚡ Core Engines

- **🧠 AI Confluence Brain**: Dual-engine quantitative fusion calculating real-time Volume-Weighted Average Price (VWAP), 9/21 Fast EMA crossover, 14-period RSI momentum, and breaking news catalysts.
- **📈 Multi-Asset Equity & Strategy Backtest Engine**: Historical quantitative strategy audit across equities and ETFs with equity curves, profit factors, win-rates, and maximum drawdown metrics.
- **🛡️ Portfolio Optimizer & Risk Simulation**: Modern Portfolio Theory (MPT) Markowitz Efficient Frontier optimization, Monte Carlo VaR (Value-at-Risk) and CVaR tail risk modeling.
- **⚡ Institutional Volatility Radar**: Real-time Implied Volatility (IV) Rank, Historical Volatility (HV), and Gamma Exposure (GEX) tracking market maker positioning.
- **📝 Virtual Paper Trading Desk**: Complete risk-free execution simulator with portfolio tracking, live P&L, win-rate analytics, and local persistence.
- **🏠 Out-of-the-Box Home PC & Cloud Support**: Seamless automatic SQLite fallback out of the box—no SQL Server setup required.

---

## 🛠️ Quickstart (Home PC or Dev Machine)

### 1. Backend Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start Django backend server
python manage.py runserver 127.0.0.1:8000
```

### 2. Frontend Setup
```bash
# Navigate to frontend folder and install dependencies
cd frontend
npm install

# Start Vite live development server
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 📈 Quantitative Investment Principles
1. **Risk-Adjusted Return Focus**: Optimize for Sharpe & Sortino ratios rather than naked directional speculation.
2. **Capital Preservation & Drawdown Control**: Monitor Monte Carlo 95% and 99% Value-at-Risk (VaR) before allocating capital.
3. **Statistical Confluence**: Require alignment across technical indicators (RSI, Bollinger Bands, Moving Averages) and news sentiment before trade entry.
4. **Discipline & Sizing**: Position sizing determined by portfolio volatility tolerance, never exceeding maximum loss constraints.
