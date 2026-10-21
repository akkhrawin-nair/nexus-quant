from datetime import date
from unittest.mock import patch
import numpy as np
import pandas as pd
from django.test import SimpleTestCase
from rest_framework.test import APIClient


def sample():
    close = np.arange(100., 200.)
    return pd.DataFrame({'Open':close, 'High':close+1, 'Low':close-1, 'Close':close, 'Volume':1000.}, index=pd.bdate_range('2026-05-01', periods=100))


class AnalystBriefTests(SimpleTestCase):
    def test_chart_levels_exclude_last_bar_and_lines_align_with_candles(self):
        from api.services.analyst_brief import technical_brief
        frame = sample()
        frame.iloc[-1, frame.columns.get_loc('High')] = 250
        report = technical_brief('EOSE', frame, date(2026,10,21))
        self.assertEqual(report['levels']['resistance'], 199.)
        self.assertEqual(report['levels']['support'], 178.)
        self.assertEqual(report['trend'], 'Uptrend')
        self.assertEqual(len(report['candles']), 90)
        self.assertEqual(report['overlays'][0]['data'][-1]['time'], report['candles'][-1]['time'])
        self.assertIn('not', report['method'].lower())

    def test_reviewed_news_is_dated_sourced_and_catalyst_window_is_not_invented(self):
        from api.services.analyst_brief import reviewed_context
        report = reviewed_context('EOSE', date(2026,10,21))
        self.assertEqual(report['reviewed_at'], '2026-10-21')
        self.assertTrue(report['notes'][0]['url'].startswith('https://investors.eose.com/'))
        self.assertEqual(report['events'][0]['window'], 'outside_14_days')
        self.assertEqual(reviewed_context('EOSE',date(2026,10,23))['events'][0]['window'], 'within_14_days')
        self.assertTrue(reviewed_context('EOSE',date(2026,11,6))['needs_review'])
        self.assertEqual(reviewed_context('EOSE',date(2026,11,6))['events'][0]['window'], 'past')
        self.assertEqual(reviewed_context('XYZ',date(2026,10,21))['notes'], [])

    def test_bad_history_is_rejected(self):
        from api.services.analyst_brief import technical_brief
        bad = sample(); bad.iloc[-1,0] = float('nan')
        for frame in [sample().iloc[:20], bad, pd.concat([sample(),sample().iloc[-1:]])]:
            with self.assertRaises(ValueError):
                technical_brief('EOSE',frame)

    def test_breakdown_is_reported_as_current_evidence_not_a_future_warning(self):
        from api.services.analyst_brief import technical_brief
        frame=sample()
        frame.iloc[-1, frame.columns.get_loc('Close')]=170
        frame.iloc[-1, frame.columns.get_loc('Low')]=169
        report=technical_brief('EOSE',frame,date(2026,10,21))
        self.assertIn('breakdown',report['assessment']['headline'].lower())
        self.assertIn('not',report['assessment']['interpretation'].lower())

    @patch('api.http_views.stored_history', return_value=sample())
    def test_saved_brief_endpoint_and_missing_news_are_explicit(self, history):
        response = APIClient().get('/api/research/brief/?symbol=ONDS')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['symbol'],'ONDS')
        self.assertIn('bear_case',response.json()['context'])
        invalid = APIClient().get('/api/research/brief/?symbol=../bad')
        self.assertEqual(invalid.status_code,400)
