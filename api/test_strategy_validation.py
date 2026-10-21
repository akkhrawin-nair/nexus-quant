import numpy as np
import pandas as pd
from django.test import SimpleTestCase
from unittest.mock import patch
from rest_framework.test import APIClient
from api.services.backtesting import backtest_ohlcv


def sample():
    index = pd.bdate_range('2025-01-01', periods=250)
    close = 100 + np.arange(250) * .15 + np.sin(np.arange(250) / 4) * 2
    return pd.DataFrame({'Open':close, 'High':close+1, 'Low':close-1, 'Close':close, 'Volume':1000}, index=index)


class StrategyValidationTests(SimpleTestCase):
    def test_holdout_dates_match_benchmark_and_only_test_period_has_equity(self):
        from api.services.strategy_validation import validate_strategy
        frame = sample()
        result = validate_strategy(frame)
        self.assertEqual(result['validation']['split_date'], str(frame.index[175].date()))
        self.assertEqual(result['start_date'], result['benchmark']['start_date'])
        self.assertEqual(result['end_date'], result['benchmark']['end_date'])
        self.assertEqual(len(result['equity_curve']), 75)
        self.assertTrue(all(t['entry_date'] >= result['start_date'] for t in result['trades']))

    def test_future_prices_cannot_change_training_selection_or_training_results(self):
        from api.services.strategy_validation import validate_strategy
        frame = sample()
        original = validate_strategy(frame)
        changed = frame.copy()
        changed.iloc[175:, :4] *= .4
        other = validate_strategy(changed)
        self.assertEqual(original['validation']['training_results'], other['validation']['training_results'])
        self.assertEqual(original['strategy'], other['strategy'])

    def test_cash_is_available_when_all_training_rules_lose(self):
        from api.services.strategy_validation import validate_strategy
        frame = sample()
        frame[['Open','High','Low','Close']] = frame[['Open','High','Low','Close']].iloc[::-1].to_numpy()
        result = validate_strategy(frame)
        self.assertEqual(result['strategy'], 'CASH')
        self.assertEqual(result['total_trades'], 0)
        self.assertEqual(result['return_pct'], 0)
        self.assertIn('not validated', result['validation']['verdict'].lower())

    def test_minimum_history_and_duplicate_dates_are_rejected(self):
        from api.services.strategy_validation import validate_strategy
        for frame in [sample().iloc[:100], pd.concat([sample(),sample().iloc[-1:]])]:
            with self.assertRaises(ValueError):
                validate_strategy(frame)
        bad = sample()
        bad.iloc[-1, bad.columns.get_loc('Close')] = float('nan')
        with self.assertRaises(ValueError):
            validate_strategy(bad)

    def test_benchmark_costs_reduce_returns(self):
        from api.services.strategy_validation import validate_strategy
        free = validate_strategy(sample(), fee_bps=0, slippage_bps=0)
        paid = validate_strategy(sample(), fee_bps=20, slippage_bps=20)
        self.assertLess(paid['benchmark']['return_pct'], free['benchmark']['return_pct'])

    @patch('api.services.backtesting.strategy_signals')
    def test_warmup_does_not_open_positions_before_evaluation_start(self, signals):
        frame = sample()
        signals.return_value = pd.Series(True, index=frame.index)
        result = backtest_ohlcv(frame, evaluation_start=175, max_holding_days=14)
        self.assertEqual(result['trades'][0]['entry_date'], str(frame.index[175].date()))
        self.assertEqual(result['observations'], 75)
        self.assertTrue(all((pd.Timestamp(t['exit_date'])-pd.Timestamp(t['entry_date'])).days <=14 for t in result['trades']))

    @patch('api.services.backtesting.strategy_signals')
    def test_missing_deadline_session_exits_before_calendar_limit(self, signals):
        frame = sample().drop(pd.Timestamp('2025-01-15'))
        signals.return_value = pd.Series(True, index=frame.index)
        result = backtest_ohlcv(frame, evaluation_start=0, max_holding_days=14)
        first = result['trades'][0]
        # Entry Jan 2 -> deadline Jan 16; exclude that session too in second run.
        frame = frame.drop(pd.Timestamp('2025-01-16'))
        signals.return_value = pd.Series(True, index=frame.index)
        result = backtest_ohlcv(frame, max_holding_days=14)
        self.assertLessEqual((pd.Timestamp(result['trades'][0]['exit_date'])-pd.Timestamp(first['entry_date'])).days,14)
        self.assertEqual(result['trades'][0]['exit_date'], '2025-01-14')
        self.assertEqual(result['trades'][0]['exit_reason'], 'holding_deadline_prior_session')

    @patch('api.http_views.required_history')
    def test_holdout_api_returns_serializable_comparison_and_validates_mode(self, history):
        history.return_value = sample()
        response = APIClient().get('/api/strategies/backtest/', {'symbol':'QQQ','validation':'holdout'})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['validation']['mode'], 'chronological_holdout')
        self.assertEqual(response.json()['symbol'],'QQQ')
        history.reset_mock()
        bad = APIClient().get('/api/strategies/backtest/', {'validation':'madeup'})
        self.assertEqual(bad.status_code,400)
        history.assert_not_called()
