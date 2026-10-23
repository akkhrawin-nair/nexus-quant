from unittest.mock import patch

import pandas as pd
from django.test import SimpleTestCase
from rest_framework.test import APIClient

from api.services import backtesting


def bars():
    return pd.DataFrame({'Open': 100., 'High': 101., 'Low': 99.,
                         'Close': 100., 'Volume': 1000.},
                        index=pd.bdate_range('2025-01-01', periods=80))


class FixedStrategyTests(SimpleTestCase):
    def run_fixed(self, frame=None, **kwargs):
        frame = bars() if frame is None else frame
        with patch.object(backtesting, 'strategy_signals', return_value=pd.Series(
                [False] * 50 + [True] + [False] * (len(frame) - 51), index=frame.index)):
            self.assertTrue(hasattr(backtesting, 'fixed_strategy_backtest'),
                            'Fixed research protocol has not been implemented')
            return backtesting.fixed_strategy_backtest(frame, **kwargs)

    def test_whole_shares_risk_limit_and_unused_cash(self):
        result = self.run_fixed(fee_bps=0, slippage_bps=0)
        trade = result['trades'][0]
        self.assertEqual(trade['quantity'], 13)
        self.assertLessEqual(trade['quantity'] * (100 - 92.5), 100)
        self.assertEqual(result['final_equity'], 10000)
        self.assertEqual(result['protocol']['version'], 'confluence-risk-v1')

    def test_costs_reduce_quantity_and_position_limit_includes_fees(self):
        result = self.run_fixed(fee_bps=100, slippage_bps=100)
        trade = result['trades'][0]
        entry_total = trade['quantity'] * trade['entry_price'] * 1.01
        stop_proceeds = trade['quantity'] * trade['entry_price'] * .925 * .99 * .99
        self.assertLessEqual(entry_total - stop_proceeds, 100)
        self.assertLessEqual(entry_total, 2000)
        self.assertEqual(trade['quantity'], 9)

    def test_small_account_skips_without_fractional_or_negative_cash(self):
        result = self.run_fixed(capital=400, fee_bps=0, slippage_bps=0)
        self.assertEqual(result['trades'], [])
        self.assertEqual(result['skipped_entry_sessions'], 1)
        self.assertEqual(result['final_equity'], 400)

    def test_gap_loss_can_exceed_planned_risk(self):
        frame = bars()
        frame.iloc[52, :4] = [50, 51, 49, 50]
        result = self.run_fixed(frame, fee_bps=0, slippage_bps=0)
        self.assertLess(result['trades'][0]['pnl'], -100)

    def test_deadline_applies_to_fixed_mode(self):
        frame = bars()
        with patch.object(backtesting, 'strategy_signals', return_value=pd.Series(
                [False] * 50 + [True] * 30, index=frame.index)):
            self.assertTrue(hasattr(backtesting, 'fixed_strategy_backtest'))
            result = backtesting.fixed_strategy_backtest(frame)
        for trade in result['trades']:
            self.assertLessEqual((pd.Timestamp(trade['exit_date']) - pd.Timestamp(trade['entry_date'])).days, 14)
        self.assertIn('holding_deadline', [trade['exit_reason'] for trade in result['trades']])

    def test_real_signals_use_previous_volume_and_ignore_future_prices(self):
        frame = bars()
        for column in ['Open', 'High', 'Low', 'Close']:
            frame[column] += pd.Series(range(len(frame)), index=frame.index) * .1
        frame.iloc[60, frame.columns.get_loc('Volume')] = 1250
        signals = backtesting.strategy_signals(frame, 'CONFLUENCE')
        self.assertTrue(signals.iloc[60])
        self.assertFalse(signals.iloc[59])
        changed = frame.copy()
        changed.iloc[61:, :4] *= 3
        pd.testing.assert_series_equal(signals.iloc[:61], backtesting.strategy_signals(changed, 'CONFLUENCE').iloc[:61])
        result = backtesting.fixed_strategy_backtest(frame, fee_bps=0, slippage_bps=0)
        self.assertEqual(result['trades'][0]['entry_date'], str(frame.index[61].date()))
        for bad_volume in [0, -100, float('nan'), float('inf')]:
            invalid = frame.copy()
            invalid.iloc[60, invalid.columns.get_loc('Volume')] = bad_volume
            self.assertEqual(backtesting.fixed_strategy_backtest(invalid)['trades'], [])

    @patch('api.http_views.required_history')
    def test_fixed_stock_mode_rejects_crypto_before_loading_history(self, history):
        history.return_value = bars()
        for symbol in ['BTC-USD', 'BTC-EUR', '^GSPC', 'ES=F']:
            response = APIClient().get('/api/strategies/backtest/',
                                       {'symbol': symbol, 'validation': 'fixed'})
            self.assertEqual(response.status_code, 400, symbol)
        history.assert_not_called()

    @patch('api.http_views.required_history')
    def test_share_class_tickers_remain_accepted(self, history):
        history.return_value = bars()
        response = APIClient().get('/api/strategies/backtest/',
                                   {'symbol': 'BRK-B', 'validation': 'fixed'})
        self.assertEqual(response.status_code, 200)

    @patch('api.http_views.required_history')
    def test_api_fixed_mode_returns_rules_and_ignores_strategy_selection(self, history):
        history.return_value = bars()
        response = APIClient().get('/api/strategies/backtest/',
                                   {'symbol': 'EOSE', 'validation': 'fixed', 'strategy': 'EMA'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['strategy'], 'CONFLUENCE')
        self.assertEqual(data['protocol']['version'], 'confluence-risk-v1')
        self.assertTrue(data['protocol']['rules'])
        self.assertNotIn('validation', data)
