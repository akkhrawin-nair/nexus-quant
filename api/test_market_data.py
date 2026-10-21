from io import StringIO
from unittest.mock import patch

import pandas as pd
from django.core.management import call_command
from django.test import TestCase
from django.test import override_settings

from api.models import MarketPrice
from api.services import market_data
from api.services.ingestion import ingest_market_data


def history():
    return pd.DataFrame({"Open": [99, 100], "High": [102, 103], "Low": [98, 99],
                         "Close": [100, 102], "Volume": [1000, 1200]},
                        index=pd.date_range("2026-01-01", periods=2))


class MarketDataTests(TestCase):
    def setUp(self):
        market_data.clear_caches()

    @patch("api.services.market_data.yf.Ticker")
    def test_unavailable_quote_never_fabricates_price(self, ticker):
        ticker.return_value.history.side_effect = RuntimeError("offline")
        quote = market_data.get_quote("QQQ")
        self.assertIsNone(quote["current_price"])
        self.assertEqual(quote["data_quality"]["status"], "unavailable")

    @patch("api.services.market_data.get_history", return_value=history())
    def test_observation_timestamp_survives_stale_fallback(self, get_history):
        quote = market_data.get_quote("QQQ")
        market_data.QUOTE_CACHE["QQQ"] = (0, quote)
        get_history.return_value = pd.DataFrame()
        stale = market_data.get_quote("QQQ")
        self.assertEqual(stale["current_price"], 102)
        self.assertEqual(stale["data_quality"]["observed_at"], quote["data_quality"]["observed_at"])
        self.assertEqual(stale["data_quality"]["status"], "stale")

    @patch("api.services.ingestion.get_history", return_value=history())
    def test_ingestion_is_idempotent(self, _fetch):
        first = ingest_market_data({"QQQ": "ETF"})
        second = ingest_market_data({"QQQ": "ETF"})
        self.assertEqual(first["created"], 2)
        self.assertEqual(second["updated"], 2)
        self.assertEqual(MarketPrice.objects.count(), 2)

    def test_invalid_symbol_is_rejected_before_provider(self):
        with self.assertRaises(ValueError):
            market_data.get_history("../../bad")

    @patch("api.services.ingestion.get_history", return_value=pd.DataFrame())
    def test_ingestion_reports_failure(self, _fetch):
        result = ingest_market_data({"QQQ": "ETF"})
        self.assertEqual(result["failed"], 1)
        self.assertEqual(result["created"], 0)
        self.assertIn("QQQ", result["errors"])

    def test_scheduler_command_loads(self):
        from api.management.commands.run_scheduler import Command
        self.assertIsNotNone(Command())

    @patch("requests.get", side_effect=RuntimeError("offline"))
    def test_news_failure_has_no_fabricated_publishers(self, _get):
        result = market_data.get_news("QQQ")
        self.assertEqual(result["news"], [])
        self.assertEqual(result["data_quality"]["status"], "unavailable")

    @patch("api.services.ingestion.get_history", return_value=history())
    def test_management_command_uses_shared_service(self, _fetch):
        call_command("fetch_market_data", symbols=["QQQ"], stdout=StringIO())
        self.assertEqual(MarketPrice.objects.count(), 2)

    @patch('api.services.market_data.yf.set_tz_cache_location')
    @patch('api.services.market_data.yf.Ticker')
    def test_provider_cache_uses_configured_writable_location(self, ticker, set_location):
        import tempfile
        ticker.return_value.history.return_value = pd.DataFrame()
        with tempfile.TemporaryDirectory() as path, override_settings(MARKET_CACHE_PATH=path):
            market_data.get_history('QQQ')
            set_location.assert_called_with(path)

    @patch('api.services.ingestion.get_history', return_value=history())
    @patch('api.services.market_data.get_history', return_value=pd.DataFrame())
    def test_persisted_observations_remain_available_offline(self, _provider, _ingest):
        ingest_market_data({'QQQ':'ETF'})
        quote = market_data.get_quote('QQQ')
        self.assertEqual(quote['current_price'], 102)
        self.assertEqual(quote['data_quality']['status'], 'stale')

    @patch('api.services.ingestion.get_history', return_value=history())
    @patch('api.services.market_data.get_history', return_value=pd.DataFrame())
    def test_stored_quote_preserves_actual_retrieval_time(self, _provider, _ingest):
        from datetime import datetime, timezone
        ingest_market_data({'QQQ':'ETF'})
        stamp=datetime(2026,1,3,tzinfo=timezone.utc)
        MarketPrice.objects.update(retrieved_at=stamp)
        self.assertEqual(market_data.get_quote('QQQ')['data_quality']['retrieved_at'], stamp.isoformat())

    @patch('api.services.ingestion.get_history')
    def test_watchlist_limit_applies_to_individual_additions(self, get_history):
        from datetime import date
        MarketPrice.objects.bulk_create([MarketPrice(symbol=f'CUSTOM{i}',asset_type='Stock',trade_date=date(2026,1,1),
            open_price=100,high_price=101,low_price=99,close_price=100,volume=1,ema_20=100,macd=0,macd_signal=0) for i in range(52)])
        with self.assertRaisesRegex(ValueError, '60'):
            ingest_market_data({'NEW':'Stock'})
        get_history.assert_not_called()
