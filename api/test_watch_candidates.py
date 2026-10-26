from datetime import datetime, timezone
from unittest.mock import patch
import numpy as np
import pandas as pd
from django.test import SimpleTestCase
from rest_framework.test import APIClient
from api.services import watch_candidates as candidates

NOW=datetime(2026,10,26,9,tzinfo=timezone.utc)

def frame(direction=1):
    close=100+np.arange(100)*direction*.2
    data=pd.DataFrame({'Open':close,'High':close+1,'Low':close-1,'Close':close,
        'Volume':[1000.]*99+[2000.]},index=pd.bdate_range(end='2026-10-23',periods=100))
    data.attrs['data_quality']={'source':'Test saved daily bars','retrieved_at':NOW.isoformat()}
    return data

class WatchCandidateTests(SimpleTestCase):
    def test_top_three_each_direction_are_stocks_with_reasons_and_stable_ties(self):
        histories={**{f'UP{x}':('Stock',frame()) for x in range(4)},**{f'DOWN{x}':('Stock',frame(-1)) for x in range(4)},'QQQ':('ETF',frame()),'BTC-USD':('Crypto',frame())}
        result=candidates.rank_watch_candidates(histories,NOW)
        self.assertEqual([r['symbol'] for r in result['bullish']],['UP0','UP1','UP2'])
        self.assertEqual(len(result['bearish']),3)
        self.assertEqual(result['method_version'],'directional-watch-v1')
        self.assertEqual(result['session_cutoff'],'2026-10-23')
        for row in result['bullish']+result['bearish']:
            self.assertTrue(all(check['passed'] for check in row['checks'][:3]))
            self.assertEqual(len(row['checks']),5)
            self.assertEqual(row['session'],'2026-10-23')
            self.assertNotIn('probability',row)

    def test_no_padding_unknown_old_provider_and_missing_prices_are_excluded(self):
        missing=frame();missing.attrs['data_quality']['retrieved_at']=None
        old=frame();old.attrs['data_quality']['retrieved_at']='2026-10-23T09:00:00Z'
        invalid=frame();invalid.iloc[-1,invalid.columns.get_loc('Close')]=float('nan')
        result=candidates.rank_watch_candidates({'YES':('Stock',frame()),'MISS':('Stock',missing),'OLD':('Stock',old),'BAD':('Stock',invalid)},NOW)
        self.assertEqual(len(result['bullish']),1);self.assertEqual(result['bearish'],[])
        self.assertEqual(result['coverage']['excluded']['provider_old_or_unknown'],2)

    def test_intraday_bar_cannot_reverse_last_completed_signal(self):
        data=frame();latest=pd.DataFrame({'Open':[50.],'High':[51.],'Low':[1.],'Close':[2.],'Volume':[1e9]},index=pd.to_datetime(['2026-10-26']))
        changed=pd.concat([data,latest]);changed.attrs=data.attrs
        result=candidates.rank_watch_candidates({'UP':('Stock',changed)},NOW)
        self.assertEqual(result['bullish'][0]['session'],'2026-10-23')
        self.assertEqual(result['bullish'][0]['price'],data.Close.iloc[-1])

    def test_old_sessions_future_retrieval_and_short_history_do_not_rank(self):
        old=frame();old.index=old.index-pd.Timedelta(days=10)
        future=frame();future.attrs['data_quality']['retrieved_at']='2026-10-27T09:00:00Z'
        result=candidates.rank_watch_candidates({'OLD':('Stock',old),'FUT':('Stock',future),'SHORT':('Stock',frame().iloc[:20])},NOW)
        self.assertEqual(result['bullish'],[]);self.assertEqual(result['bearish'],[])

    @patch('api.http_views.ingest_market_data',return_value={'created':0,'updated':1,'failed':0,'errors':{}})
    def test_manual_sync_bypasses_provider_cache(self,ingest):
        response=APIClient().post('/api/trigger-ingest/',{},format='json')
        self.assertEqual(response.status_code,200)
        ingest.assert_called_once_with(force_refresh=True)

    @patch('api.http_views.stored_history')
    @patch('api.http_views.MarketPrice.objects')
    def test_watch_endpoint_reads_saved_stocks_without_provider_requests(self,objects,history):
        objects.order_by.return_value.values_list.return_value.distinct.return_value=[('UP','Stock'),('QQQ','ETF')]
        data=frame();data.attrs['data_quality']['retrieved_at']=datetime.now(timezone.utc).isoformat()
        history.return_value=data
        response=APIClient().get('/api/research/watch-candidates/')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['method_version'],'directional-watch-v1')
        history.assert_called_once_with('UP')
