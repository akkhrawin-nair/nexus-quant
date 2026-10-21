from unittest.mock import patch
import pandas as pd
from django.test import TestCase
from rest_framework.test import APIClient
from api.test_market_data import history


class TruthfulAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_empty_database_has_no_fabricated_signals(self):
        result = self.client.get('/api/signals/buy/')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json(), [])

    def test_orderbook_unavailable_without_real_feed(self):
        result = self.client.get('/api/orderbook/?symbol=QQQ')
        self.assertEqual(result.status_code, 503)
        self.assertEqual(result.json()['data_quality']['status'], 'unavailable')

    @patch('api.services.market_data.get_history', return_value=pd.DataFrame())
    def test_backtest_empty_history_is_explicit(self, _get):
        result = self.client.get('/api/strategies/backtest/?symbol=QQQ')
        self.assertEqual(result.status_code, 503)
        self.assertIn('error', result.json())

    def test_paper_trading_has_no_shared_global_account(self):
        self.assertEqual(self.client.get('/api/paper-trading/').status_code, 410)

    def test_ticker_invalid_before_network(self):
        self.assertEqual(self.client.post('/api/tickers/add/', {'symbol': '../../bad'}, format='json').status_code, 400)

    @patch('api.services.market_data.get_history')
    def test_backtest_rejects_bad_parameters_before_network(self, get):
        for query in ['capital=nan','capital=-1','strategy=INVALID','fee_bps=-1']:
            self.assertEqual(self.client.get('/api/strategies/backtest/?'+query).status_code,400)
        get.assert_not_called()

    def test_post_requires_an_object(self):
        self.assertEqual(self.client.post('/api/tickers/add/', ['QQQ'], format='json').status_code,400)

    @patch('api.services.market_data.get_history')
    def test_risk_rejects_invalid_input_before_network(self, get):
        for body in [{'capital':float('inf')}, {'horizon':253}, {'weights':{'QQQ':-1}}]:
            # Send raw JSON for nonfinite values to exercise parser/validation behavior.
            import json
            self.assertEqual(self.client.post('/api/portfolio/risk-analytics/', json.dumps(body), content_type='application/json').status_code,400)
        get.assert_not_called()

    @patch('api.services.ingestion.get_history')
    @patch('api.services.market_data.get_history')
    def test_successful_end_to_end_observed_data_contracts(self, provider, ingest):
        import numpy as np
        index = pd.date_range('2025-01-01', periods=100)
        close = 100 + np.arange(100)*.2 + np.sin(np.arange(100))
        frame = pd.DataFrame({'Open':close-.1, 'High':close+1, 'Low':close-1,'Close':close,'Volume':1000},index=index)
        provider.return_value = ingest.return_value = frame
        result = self.client.post('/api/tickers/add/', {'symbol':'QQQ'}, format='json')
        self.assertEqual(result.status_code,200)
        buy = self.client.get('/api/signals/buy/').json()
        sell = self.client.get('/api/signals/sell/').json()
        self.assertEqual(len(buy)+len(sell),1)
        self.assertIsNone((buy+sell)[0]['volatility']['iv_rank'])
        for endpoint in ['/api/candles/QQQ/', '/api/strategies/backtest/?symbol=QQQ',
                         '/api/brain/fusion/?symbol=QQQ', '/api/portfolio-optimizer/?symbols=QQQ,SPY',
                         '/api/portfolio/correlation/?symbols=QQQ,SPY']:
            response = self.client.get(endpoint)
            self.assertEqual(response.status_code,200,endpoint)
        risk = self.client.post('/api/portfolio/risk-analytics/', {'weights':{'QQQ':1},'horizon':10,'capital':100},format='json')
        self.assertEqual(risk.status_code,200)
        self.assertEqual(len(risk.json()['monte_carlo_curves']),11)
