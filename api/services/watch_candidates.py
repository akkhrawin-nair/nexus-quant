"""Dated directional research candidates; not calibrated forecasts or orders."""
from collections import Counter
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import numpy as np
import pandas as pd
from .research import indicator_snapshot


def rank_watch_candidates(histories, now=None):
    now=now or datetime.now(timezone.utc)
    ny=now.astimezone(ZoneInfo('America/New_York'))
    cutoff=ny.date()
    if ny.weekday()>=5 or (ny.hour,ny.minute)<(16,15):
        cutoff-=timedelta(days=1)
    while cutoff.weekday()>=5:
        cutoff-=timedelta(days=1)
    groups={'bullish':[],'bearish':[]}
    excluded=Counter()
    stocks=0
    for symbol,(kind,frame) in histories.items():
        if kind!='Stock':
            excluded['non_stock']+=1
            continue
        stocks+=1
        try:
            quality=frame.attrs.get('data_quality',{})
            fetched=pd.Timestamp(quality.get('retrieved_at'))
            if pd.isna(fetched) or fetched.tzinfo is None or not -5<=(now-fetched.to_pydatetime()).total_seconds()<=6*3600:
                excluded['provider_old_or_unknown']+=1
                continue
            frame=frame.loc[frame.index.date<=cutoff].sort_index()
            if len(frame)<60:
                excluded['insufficient_history']+=1
                continue
            if (cutoff-frame.index[-1].date()).days>4:
                excluded['old_session']+=1
                continue
            values=frame[['Open','High','Low','Close','Volume']].to_numpy(dtype=float)
            if frame.index.has_duplicates or pd.Index(frame.index.date).has_duplicates or not np.isfinite(values).all() or (values[:,:4]<=0).any() or (values[:,4]<0).any():
                excluded['invalid_data']+=1
                continue
            stats=indicator_snapshot(frame)
            price,ema20,ema50=stats['price'],stats['ema20'],stats['ema50']
            for direction,sign in [('bullish',1),('bearish',-1)]:
                checks=[
                    {'id':'price','label':f'Close {"above" if sign==1 else "below"} EMA20','passed':sign*(price-ema20)>0,'detail':f'${price:.4f} vs ${ema20:.4f}'},
                    {'id':'alignment','label':f'EMA20 {"above" if sign==1 else "below"} EMA50','passed':sign*(ema20-ema50)>0,'detail':f'${ema20:.4f} vs ${ema50:.4f}'},
                    {'id':'momentum','label':f'MACD {"above" if sign==1 else "below"} signal','passed':sign*(stats['macd']-stats['macd_signal'])>0,'detail':f'{stats["macd"]:.4f} vs {stats["macd_signal"]:.4f}'},
                    {'id':'rsi','label':'RSI in directional band','passed':50<=stats['rsi']<=70 if sign==1 else 30<=stats['rsi']<=50,'detail':f'RSI {stats["rsi"]:.1f}; band {"50–70" if sign==1 else "30–50"}'},
                    {'id':'volume','label':'Relative volume at least 1.25x','passed':stats['vol_spike_ratio']>=1.25,'detail':f'{stats["vol_spike_ratio"]:.2f}x prior-20-session baseline'},
                ]
                if not all(check['passed'] for check in checks[:3]):
                    continue
                groups[direction].append({'symbol':symbol,'direction':direction,'price':price,
                    'session':str(frame.index[-1].date()),'provider_retrieved_at':fetched.isoformat(),
                    'source':quality.get('source','Stored adjusted daily bars'),'checks':checks,
                    'aligned_checks':sum(bool(check['passed']) for check in checks),
                    'normalized_macd_gap_pct':abs(stats['macd']-stats['macd_signal'])/price*100,
                    'rsi':stats['rsi'],'relative_volume':stats['vol_spike_ratio'],
                    'caution':('Overbought RSI: reversal risk remains.' if stats['rsi']>70 else
                               'Oversold RSI: rebound risk remains.' if stats['rsi']<30 else
                               'News, gaps and changing momentum can invalidate this alignment.'),
                    'reassessment':f'Reassess if a completed daily close moves {"below" if sign==1 else "above"} EMA20 (${ema20:.4f}) or MACD loses this direction. This is not an executable stop.'})
            if not all((price>ema20,ema20>ema50,stats['macd']>stats['macd_signal'])) and not all((price<ema20,ema20<ema50,stats['macd']<stats['macd_signal'])):
                excluded['mixed_alignment']+=1
        except (ValueError,TypeError,AttributeError,KeyError):
            excluded['invalid_data']+=1
    counts={key:len(rows) for key,rows in groups.items()}
    for key,rows in groups.items():
        groups[key]=sorted(rows,key=lambda r:(-r['aligned_checks'],-r['normalized_macd_gap_pct'],r['symbol']))[:3]
    return {'method_version':'directional-watch-v1','generated_at':now.isoformat(),
        'session_cutoff':cutoff.isoformat(),**groups,
        'coverage':{'stock_count':stocks,'qualified_by_direction':counts,'excluded':dict(excluded)},
        'method':'Stock-only trend/MACD alignment, ranked by aligned checks, price-normalized MACD separation, then symbol. Up to three each direction; never padded.',
        'limitations':[
            'Heuristic watch candidates for up to 14-day research, not a probability of price rising/falling or a buy/short recommendation.',
            'Uses completed daily session labels, not live prices. Weekday close cutoff is 16:15 New York; holidays and early closes are not independently modeled.',
            'Provider snapshots must be no older than six hours; session labels must be within four calendar days of the approximate last completed weekday.',
            'RSI is a simple rolling 14-bar calculation. News, earnings, borrow availability, liquidity and options suitability are unverified.']}
