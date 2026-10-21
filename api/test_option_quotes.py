import os
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, Mock
from django.test import SimpleTestCase
from rest_framework.test import APIClient


class OptionQuoteTests(SimpleTestCase):
    contract = 'AAPL261030C00250000'
    now = datetime(2026, 10, 21, 15, tzinfo=timezone.utc)

    def response(self, **changes):
        quote = {'bp': .9, 'ap': 1, 'bs': 12, 'as': 7, 't': '2026-10-21T14:59:50.123456789Z'}
        quote.update(changes)
        return Mock(status_code=200, json=Mock(return_value={'quotes': {self.contract: quote}}))

    def test_missing_credentials_returns_actionable_error_without_network(self):
        with patch.dict(os.environ, {}, clear=True), patch('requests.get') as get:
            result = APIClient().get('/api/options/quote/', {'contract': self.contract})
        self.assertEqual(result.status_code, 503)
        self.assertIn('APCA_API_KEY_ID', result.json()['error'])
        get.assert_not_called()

    def test_opra_contract_quote_preserves_source_time_and_never_claims_a_fill(self):
        from api.services.option_quotes import fetch_option_quote
        with patch.dict(os.environ, {'APCA_API_KEY_ID':'private-key', 'APCA_API_SECRET_KEY':'private-secret'}), patch('requests.get', return_value=self.response()) as get:
            result = fetch_option_quote(self.contract, self.now)
        self.assertEqual(get.call_args.kwargs['params'], {'symbols':self.contract, 'feed':'opra'})
        self.assertFalse(get.call_args.kwargs['allow_redirects'])
        self.assertEqual(result['bid'], .9)
        self.assertEqual(result['ask_size'], 7)
        self.assertFalse(result['stale'])
        self.assertFalse(result['executable_price_verified'])
        self.assertEqual(result['expiration'], '2026-10-30')
        self.assertNotEqual(result['quote_time'], result['fetched_at'])
        self.assertNotIn('private-', str(result))

    def test_expiration_and_symbol_validation_before_network(self):
        from api.services.option_quotes import fetch_option_quote
        for contract in ['AAPL261120C00250000','AAPL261001C00250000','AAPL260230C00250000','../../bad','AAPL261030C00000000']:
            with patch('requests.get') as get, self.assertRaises(ValueError):
                fetch_option_quote(contract, self.now)
            get.assert_not_called()

    def test_stale_zero_bid_and_malformed_quotes(self):
        from api.services.option_quotes import fetch_option_quote, QuoteUnavailable
        env = {'APCA_API_KEY_ID':'k', 'APCA_API_SECRET_KEY':'s'}
        with patch.dict(os.environ, env), patch('requests.get', return_value=self.response(bp=0, t='2026-10-20T15:00:00Z')):
            self.assertTrue(fetch_option_quote(self.contract, self.now)['stale'])
        for changes in [{'bp':2}, {'ap':float('nan')}, {'bs':-1}, {'as':1.5}, {'t':None}, {'t':'2026-10-21T15:10:00Z'}, {'bp':True}]:
            with patch.dict(os.environ, env), patch('requests.get', return_value=self.response(**changes)), self.assertRaises(QuoteUnavailable):
                fetch_option_quote(self.contract, self.now)

    def test_denied_opra_never_falls_back_to_indicative_or_exposes_provider_body(self):
        from api.services.option_quotes import fetch_option_quote, QuoteUnavailable
        for status in [401,403,429,500]:
            response = Mock(status_code=status, text='private-secret')
            with patch.dict(os.environ, {'APCA_API_KEY_ID':'k','APCA_API_SECRET_KEY':'s'}), patch('requests.get', return_value=response) as get:
                with self.assertRaises(QuoteUnavailable) as error:
                    fetch_option_quote(self.contract, self.now)
            self.assertNotIn('private-secret', str(error.exception))
            self.assertEqual(get.call_count,1)

    def test_freshness_uses_response_receipt_time_including_network_delay(self):
        from api.services.option_quotes import fetch_option_quote
        received = self.now + timedelta(seconds=90)
        with patch.dict(os.environ, {'APCA_API_KEY_ID':'k','APCA_API_SECRET_KEY':'s'}), patch('requests.get', return_value=self.response()), patch('api.services.option_quotes.datetime', wraps=datetime) as clock:
            clock.now.side_effect = [self.now, received]
            result = fetch_option_quote(self.contract)
        self.assertTrue(result['stale'])
        self.assertEqual(result['fetched_at'], received.isoformat())
