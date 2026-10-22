from datetime import date
import numpy as np
import pandas as pd
from django.test import SimpleTestCase

from api.services.technical_outlook import technical_outlook


def history(closes):
    return pd.DataFrame({'Close': closes}, index=pd.bdate_range('2026-01-01', periods=len(closes)))


class TechnicalOutlookTests(SimpleTestCase):
    def test_flat_history_stays_flat_and_forecast_starts_after_observations(self):
        result = technical_outlook('EOSE', history(np.full(100, 50.)), date(2026, 5, 20))
        self.assertEqual(result['anchor_date'], '2026-05-20')
        self.assertEqual(result['end_date'], '2026-06-03')
        self.assertEqual(len(result['points']), 10)
        self.assertEqual(result['points'][0]['date'], '2026-05-21')
        for point in result['points']:
            for key in ['lower', 'central', 'upper']:
                self.assertAlmostEqual(point[key], 50.)
        self.assertAlmostEqual(result['evaluation']['model_mae_pct'], 0.)
        self.assertEqual(result['evaluation']['flat_mae_pct'], 0.)

    def test_falling_and_rising_trends_extend_in_the_correct_direction(self):
        for sign in [-1, 1]:
            result = technical_outlook('ONDS', history(100 * np.exp(sign * .01 * np.arange(100))), date(2026, 5, 20))
            last = result['points'][-1]
            self.assertGreater(sign * (last['central'] - result['anchor_price']), 0)
            self.assertLessEqual(last['lower'], last['central'])
            self.assertLessEqual(last['central'], last['upper'])
            self.assertGreater(last['lower'], 0)
            self.assertGreater(result['evaluation']['samples'], 0)

    def test_past_projection_is_not_reanchored_to_today(self):
        result = technical_outlook('EOSE', history(np.full(100, 50.)), date(2026, 6, 10))
        self.assertTrue(result['expired'])
        self.assertEqual(result['end_date'], '2026-06-03')

    def test_crypto_includes_weekends_and_invalid_prices_are_rejected(self):
        frame = history(np.full(100, 50.))
        result = technical_outlook('BTC-USD', frame, date(2026, 5, 20))
        self.assertEqual(len(result['points']), 14)
        for invalid in [0, -1, np.nan, np.inf]:
            bad = frame.copy(); bad.iloc[-1, 0] = invalid
            with self.assertRaises(ValueError):
                technical_outlook('EOSE', bad)

    def test_evaluation_does_not_see_prices_after_its_test_windows(self):
        frame = history(100 * np.exp(.002 * np.arange(100)))
        first = technical_outlook('EOSE', frame)['evaluation']
        # Last observation is not an evaluation endpoint: origins 59,69,79,89;
        # ten-step endpoints 69,79,89,99. Change an input beyond an earlier origin
        # and that origin's issued prediction must remain fixed.
        changed = frame.copy(); changed.iloc[70:, 0] *= 1.5
        second = technical_outlook('EOSE', changed)['evaluation']
        self.assertEqual(first['windows'][0], second['windows'][0])

    def test_unseen_jump_is_measured_against_same_window_flat_baseline(self):
        closes = np.full(70, 100.); closes[-1] = 150.
        result = technical_outlook('EOSE', history(closes))['evaluation']
        self.assertEqual(result['samples'], 1)
        self.assertAlmostEqual(result['windows'][0]['predicted'], 100.)
        self.assertEqual(result['windows'][0]['actual'], 150.)
        self.assertAlmostEqual(result['model_mae_pct'], 100/3)
        self.assertAlmostEqual(result['flat_mae_pct'], 100/3)
        self.assertFalse(result['beats_flat'])

    def test_missing_sessions_cannot_extend_evaluation_beyond_fourteen_days(self):
        frame = history(np.full(70, 100.))
        stamps = list(frame.index)
        stamps[-1] += pd.Timedelta(days=7)
        frame.index = pd.DatetimeIndex(stamps)
        result = technical_outlook('EOSE', frame)['evaluation']
        self.assertEqual(result['samples'], 0)
        self.assertIsNone(result['model_mae_pct'])
        self.assertIsNone(result['beats_flat'])
