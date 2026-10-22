from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIClient
from api.models import MarketPrice
from api.services.ingestion import ingest_market_data
from api.services.research import stored_history
from api.services import market_data
from api.test_analyst_brief import sample


class ResearchRefreshTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        market_data.clear_caches()

    @patch('api.services.ingestion.get_history')
    def test_refresh_one_ticker_bypasses_cache_and_retains_provider_fetch_time(self, fetch):
        frame = sample()
        frame.attrs['data_quality'] = {'retrieved_at':'2026-10-21T15:00:00+00:00'}
        fetch.return_value = frame
        response = self.client.post('/api/research/brief/refresh/', {'symbol':'EOSE'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['symbol'], 'EOSE')
        self.assertEqual(set(MarketPrice.objects.values_list('symbol', flat=True)), {'EOSE'})
        self.assertTrue(fetch.call_args.kwargs['force_refresh'])
        quality = response.json()['data_quality']
        self.assertEqual(quality['retrieved_at'], '2026-10-21T15:00:00+00:00')
        self.assertNotEqual(quality['stored_at'], quality['retrieved_at'])
        self.assertEqual(stored_history('EOSE').attrs['data_quality']['retrieved_at'], quality['retrieved_at'])

    @patch('api.services.ingestion.get_history')
    def test_legacy_unknown_fetch_time_is_not_replaced_with_report_time(self, fetch):
        fetch.return_value = sample()
        ingest_market_data({'EOSE':'Stock'})
        first = self.client.get('/api/research/brief/?symbol=EOSE').json()['data_quality']
        second = self.client.get('/api/research/brief/?symbol=EOSE').json()['data_quality']
        self.assertIsNone(first['retrieved_at'])
        self.assertEqual(first['stored_at'], second['stored_at'])

    @patch('api.services.ingestion.get_history')
    def test_failed_refresh_preserves_saved_observations(self, fetch):
        import pandas as pd
        fetch.return_value = sample()
        ingest_market_data({'EOSE':'Stock'})
        before = list(MarketPrice.objects.values())
        fetch.return_value = pd.DataFrame()
        response = self.client.post('/api/research/brief/refresh/', {'symbol':'EOSE'}, format='json')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(list(MarketPrice.objects.values()), before)
        self.assertEqual(self.client.get('/api/research/brief/?symbol=EOSE').status_code, 200)

    @patch('api.http_views.ingest_market_data')
    def test_bad_input_origin_and_busy_refresh_do_not_start_ingestion(self, ingest):
        from api.http_views import _ingestion_lock
        self.assertEqual(self.client.post('/api/research/brief/refresh/', {'symbol':'../bad'}, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/research/brief/refresh/', {'symbol':'EOSE'}, format='json', HTTP_ORIGIN='https://untrusted.invalid').status_code, 403)
        _ingestion_lock.acquire()
        try:
            self.assertEqual(self.client.post('/api/research/brief/refresh/', {'symbol':'EOSE'}, format='json').status_code, 409)
        finally:
            _ingestion_lock.release()
        ingest.assert_not_called()

    @patch('api.services.market_data.yf.Ticker')
    def test_force_fetch_uses_new_provider_observation_instead_of_cached_history(self, ticker):
        ticker.return_value.history.return_value = sample()
        first = market_data.get_history('EOSE')
        changed = sample(); changed.iloc[-1, changed.columns.get_loc('Close')] = 201.
        ticker.return_value.history.return_value = changed
        self.assertEqual(market_data.get_history('EOSE').Close.iloc[-1], first.Close.iloc[-1])
        refreshed = market_data.get_history('EOSE', force_refresh=True)
        self.assertEqual(refreshed.Close.iloc[-1], 201.)
        self.assertEqual(ticker.return_value.history.call_count, 2)

    @patch('api.services.ingestion.get_history')
    def test_reingesting_cached_bars_does_not_promote_the_provider_timestamp(self, fetch):
        frame = sample()
        frame.attrs['data_quality'] = {'retrieved_at':'2026-10-20T15:00:00+00:00'}
        fetch.return_value = frame
        ingest_market_data({'EOSE':'Stock'})
        ingest_market_data({'EOSE':'Stock'})
        quality = stored_history('EOSE').attrs['data_quality']
        self.assertEqual(quality['retrieved_at'], '2026-10-20T15:00:00+00:00')
        self.assertNotEqual(quality['retrieved_at'], quality['stored_at'])
