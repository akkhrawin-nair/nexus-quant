from unittest.mock import patch
import pandas as pd
from django.test import SimpleTestCase
from api.services.backtesting import backtest_ohlcv, maximum_drawdown


def bars():
    return pd.DataFrame({'Open': [100.] * 60, 'High': [101.] * 60,
                         'Low': [99.] * 60, 'Close': [100.] * 60,
                         'Volume': [1000.] * 60}, index=pd.date_range('2025-01-01', periods=60))


class BacktestTests(SimpleTestCase):
    def test_compounded_drawdown(self):
        self.assertAlmostEqual(maximum_drawdown([100, 120, 96]), 20)

    @patch('api.services.backtesting.strategy_signals')
    def test_signal_executes_next_open(self, signals):
        df = bars()
        signals.return_value = pd.Series([False] * 30 + [True] + [False] * 29, index=df.index)
        result = backtest_ohlcv(df, fee_bps=0, slippage_bps=0)
        self.assertEqual(result['trades'][0]['entry_date'], '2025-02-01')

    @patch('api.services.backtesting.strategy_signals')
    def test_final_bar_signal_cannot_execute(self, signals):
        df = bars()
        signals.return_value = pd.Series([False] * 59 + [True], index=df.index)
        self.assertEqual(backtest_ohlcv(df)['trades'], [])

    @patch('api.services.backtesting.strategy_signals')
    def test_stop_precedes_target_on_ambiguous_bar(self, signals):
        df = bars()
        df.iloc[31, df.columns.get_loc('High')] = 130
        df.iloc[31, df.columns.get_loc('Low')] = 80
        signals.return_value = pd.Series([False] * 30 + [True] + [False] * 29, index=df.index)
        result = backtest_ohlcv(df, fee_bps=0, slippage_bps=0)
        self.assertEqual(result['trades'][0]['exit_reason'], 'stop')
        self.assertAlmostEqual(result['trades'][0]['exit_price'], 92.5)

    @patch('api.services.backtesting.strategy_signals')
    def test_costs_reduce_equity(self, signals):
        df = bars()
        signals.return_value = pd.Series([False] * 30 + [True] + [False] * 29, index=df.index)
        free = backtest_ohlcv(df, fee_bps=0, slippage_bps=0)
        paid = backtest_ohlcv(df)
        self.assertLess(paid['final_equity'], free['final_equity'])

    def test_invalid_inputs(self):
        for kwargs in [{'capital': float('nan')}, {'capital': -1}, {'fee_bps': -1}, {'strategy': 'MADEUP'}]:
            with self.assertRaises(ValueError):
                backtest_ohlcv(bars(), **kwargs)
