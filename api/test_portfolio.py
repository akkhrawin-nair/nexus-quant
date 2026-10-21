import numpy as np
import pandas as pd
from django.test import SimpleTestCase
from api.services.portfolio import aligned_returns, portfolio_metrics, allocation_candidates


def histories():
    dates = pd.date_range('2025-01-01', periods=100)
    return {'A': pd.DataFrame({'Close': 100 * np.exp(np.sin(np.arange(100)) * .02 + np.arange(100) * .001)}, index=dates),
            'B': pd.DataFrame({'Close': 100 * np.exp(np.cos(np.arange(100)) * .01)}, index=dates)}


class PortfolioTests(SimpleTestCase):
    def test_alignment_uses_dates(self):
        h = histories()
        h['B'] = h['B'].iloc[::2]
        returns = aligned_returns(h)
        self.assertTrue(returns.index.isin(h['B'].index).all())
        # Both assets use the same pair of common observation dates.
        self.assertAlmostEqual(returns['A'].iloc[0], histories()['A'].Close.reindex(h['B'].index).pct_change().loc[returns.index[0]])

    def test_no_overlap_rejected(self):
        h = histories()
        h['B'].index += pd.Timedelta(days=200)
        with self.assertRaises(ValueError):
            aligned_returns(h)

    def test_invalid_weights_and_horizons(self):
        r = aligned_returns(histories())
        for weights, horizon in [({'A': -1}, 30), ({'A': float('nan')}, 30), ({'A': 1}, 0), ({'A': 1}, 253)]:
            with self.assertRaises(ValueError):
                portfolio_metrics(r, weights, 100, horizon)

    def test_simulations_reproducible_and_contributions_sum(self):
        r = aligned_returns(histories())
        first = portfolio_metrics(r, {'A': .4, 'B': .6}, 100)
        second = portfolio_metrics(r, {'A': .4, 'B': .6}, 100)
        self.assertEqual(first['monte_carlo_curves'], second['monte_carlo_curves'])
        self.assertAlmostEqual(sum(x['risk_contribution_pct'] for x in first['asset_breakdown']), 100)

    def test_candidates_are_normalized(self):
        result = allocation_candidates(aligned_returns(histories()))
        for weights in result['presets'].values():
            self.assertAlmostEqual(sum(weights.values()), 100)
            self.assertTrue(all(x >= 0 for x in weights.values()))

    def test_constant_prices_produce_no_invented_sharpe(self):
        h = histories()
        h['A']['Close'] = 100
        result = portfolio_metrics(aligned_returns({'A': h['A']}), {'A': 1}, 100)
        self.assertIsNone(result['sharpe_ratio'])
        self.assertEqual(result['max_drawdown_pct'], 0)

    def test_allocation_preserves_stale_input_quality(self):
        h=histories()
        h['A'].attrs['data_quality']={'source':'Stored observations','status':'stale','observed_at':'2025-04-10','retrieved_at':'2025-04-11'}
        result=allocation_candidates(aligned_returns(h))
        self.assertEqual(result['data_quality']['status'],'stale')
        self.assertEqual(result['input_data_quality']['A']['retrieved_at'],'2025-04-11')
