import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from unittest.mock import patch

import numpy as np
import pandas as pd
from django.test import SimpleTestCase
from rest_framework.test import APIClient
from api.services import strategy_validation as validation
from api.services.backtesting import strategy_signals


def sample():
    index = pd.bdate_range('2025-01-01', periods=250)
    close = 100 + np.arange(250) * .1
    volume = np.where(np.arange(250) % 5 == 0, 2000., 1000.)
    return pd.DataFrame({'Open':close, 'High':close+1, 'Low':close-1,
                         'Close':close, 'Volume':volume}, index=index)


class FixedHoldoutTests(SimpleTestCase):
    def run_holdout(self, frame=None, **kwargs):
        self.assertTrue(hasattr(validation, 'validate_fixed_strategy'),
                        'Fixed-rule historical holdout is not implemented')
        return validation.validate_fixed_strategy(sample() if frame is None else frame, **kwargs)

    def test_only_later_dates_generate_pnl_with_frozen_protocol(self):
        frame=sample()
        result=self.run_holdout(frame)
        self.assertEqual(result['validation']['mode'],'fixed_rule_holdout')
        self.assertEqual(result['protocol']['version'],'confluence-risk-v1')
        self.assertEqual(result['start_date'],str(frame.index[175].date()))
        self.assertEqual(result['validation']['context_end'],str(frame.index[174].date()))
        self.assertEqual(len(result['equity_curve']),75)
        self.assertNotIn('training_results',result['validation'])
        self.assertGreater(result['total_trades'],0)
        for trade in result['trades']:
            self.assertGreaterEqual(trade['entry_date'],result['start_date'])
            self.assertEqual(trade['quantity'],int(trade['quantity']))
            self.assertLessEqual((pd.Timestamp(trade['exit_date'])-pd.Timestamp(trade['entry_date'])).days,14)
        self.assertEqual(result['benchmark']['start_date'],result['start_date'])
        self.assertEqual(result['benchmark']['end_date'],result['end_date'])

    def test_fixed_engine_is_reused_and_future_prices_cannot_change_earlier_fills(self):
        frame=sample()
        first=self.run_holdout(frame)
        changed=frame.copy();changed.iloc[220:,:4]*=.5
        second=self.run_holdout(changed)
        cutoff=str(frame.index[220].date())
        self.assertEqual([t for t in first['trades'] if t['exit_date']<cutoff],
                         [t for t in second['trades'] if t['exit_date']<cutoff])
        self.assertEqual(first['protocol'],second['protocol'])
        pd.testing.assert_series_equal(strategy_signals(frame,'CONFLUENCE').iloc[:220],
                                       strategy_signals(changed,'CONFLUENCE').iloc[:220])
        self.assertNotEqual(first['validation']['data_fingerprint'],second['validation']['data_fingerprint'])

    def test_passive_reference_uses_whole_shares_leftover_cash_and_both_sides_costs(self):
        result=self.run_holdout(capital=1000,fee_bps=10,slippage_bps=5)
        test=sample().iloc[175:]
        qty=np.floor(1000/(test.Open.iloc[0]*1.0005*1.001))
        cash=1000-qty*test.Open.iloc[0]*1.0005*1.001
        expected=cash+qty*test.Close.iloc[-1]*.9995*.999
        self.assertEqual(result['benchmark']['quantity'],qty)
        self.assertAlmostEqual(result['benchmark']['final_equity'],expected)
        self.assertEqual(result['cash_benchmark']['return_pct'],0)
        self.assertTrue(all(row['cash']==1000 for row in result['equity_curve']))

    def test_small_account_stays_cash_and_stress_is_explicit_without_parameter_refit(self):
        result=self.run_holdout(capital=1,fee_bps=95,slippage_bps=100)
        self.assertEqual(result['final_equity'],1)
        self.assertEqual(result['benchmark']['final_equity'],1)
        self.assertEqual(result['total_trades'],0)
        self.assertGreater(result['skipped_entry_sessions'],0)
        self.assertEqual(result['cost_sensitivity']['stress']['fee_bps'],100)
        self.assertEqual(result['cost_sensitivity']['stress']['slippage_bps'],100)
        self.assertIn('not validated',result['validation']['verdict'].lower())

    def test_export_snapshot_replays_identical_result_and_fingerprint(self):
        result=self.run_holdout()
        json.dumps(result,allow_nan=False)
        snapshot=result['input_snapshot']
        frame=pd.DataFrame(snapshot['bars']).rename(columns={'open':'Open','high':'High','low':'Low','close':'Close','volume':'Volume'})
        frame.index=pd.to_datetime(frame.pop('date'))
        replay=self.run_holdout(frame,**result['parameters'])
        self.assertEqual(result['trades'],replay['trades'])
        self.assertEqual(result['validation']['data_fingerprint'],replay['validation']['data_fingerprint'])
        self.assertEqual(result['validation']['evaluation_id'],replay['validation']['evaluation_id'])

    def test_daily_snapshot_replays_across_daylight_saving_without_timezone_ambiguity(self):
        frame=sample();frame.index=frame.index.tz_localize('America/New_York')
        result=self.run_holdout(frame)
        self.assertTrue(all(len(bar['date'])==10 for bar in result['input_snapshot']['bars']))
        replay_frame=pd.DataFrame(result['input_snapshot']['bars']).rename(columns={'open':'Open','high':'High','low':'Low','close':'Close','volume':'Volume'})
        replay_frame.index=pd.to_datetime(replay_frame.pop('date'))
        replay=self.run_holdout(replay_frame)
        self.assertEqual(result['validation']['evaluation_id'],replay['validation']['evaluation_id'])
        self.assertEqual(result['trades'],replay['trades'])

    def test_missing_history_duplicates_nonfinite_and_inconsistent_prices_are_rejected(self):
        frame=sample();bad=frame.copy();bad.iloc[-1,bad.columns.get_loc('High')]=1
        nan=frame.copy();nan.iloc[0,0]=float('nan')
        for invalid in [frame.iloc[:100],pd.concat([frame,frame.iloc[-1:]]),bad,nan]:
            with self.assertRaises(ValueError):self.run_holdout(invalid)

    def test_incomplete_and_future_daily_bars_are_excluded_before_the_split(self):
        today=datetime.now(ZoneInfo('America/New_York')).date()
        frame=sample();frame.index=pd.date_range(today-timedelta(days=200),periods=250)
        result=self.run_holdout(frame)
        self.assertLess(result['end_date'],today.isoformat())
        self.assertEqual(len(result['input_snapshot']['bars']),200)
        self.assertEqual(result['validation']['excluded_unfinished_or_future_bars'],50)
        self.assertEqual(result['validation']['split_index'],140)

    def test_unusable_volume_skips_signals_and_exports_replayable_nulls(self):
        frame=sample();frame['Volume']=None
        result=self.run_holdout(frame)
        self.assertEqual(result['total_trades'],0)
        self.assertTrue(all(row['volume'] is None for row in result['input_snapshot']['bars']))
        json.dumps(result,allow_nan=False)

    def test_intraday_rows_cannot_masquerade_as_unique_daily_sessions(self):
        frame=sample().iloc[:150].copy()
        frame.index=pd.date_range('2025-01-02 09:00',periods=150,freq='min')
        with self.assertRaises(ValueError):self.run_holdout(frame)

    @patch('api.http_views.required_history')
    def test_api_fixed_holdout_ignores_rule_selection_and_rejects_nonshare_tickers(self,history):
        history.return_value=sample()
        response=APIClient().get('/api/strategies/backtest/',{'symbol':'EOSE','validation':'fixed_holdout','strategy':'EMA'})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['strategy'],'CONFLUENCE')
        self.assertEqual(response.json()['validation']['mode'],'fixed_rule_holdout')
        history.reset_mock()
        self.assertEqual(APIClient().get('/api/strategies/backtest/',{'symbol':'BTC-EUR','validation':'fixed_holdout'}).status_code,400)
        history.assert_not_called()
