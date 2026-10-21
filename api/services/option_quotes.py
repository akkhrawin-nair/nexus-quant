"""Read-only Alpaca OPRA snapshots. No indicative fallback or order endpoints."""
import math
import os
import re
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

import requests


class QuoteUnavailable(Exception):
    pass


def contract_details(contract, now):
    match = re.fullmatch(r'([A-Z]{1,6})(\d{6})([CP])(\d{8})', str(contract))
    if not match:
        raise ValueError('Enter the exact standard OCC contract symbol from your broker, e.g. AAPL261030C00250000. Adjusted roots require separate contract verification.')
    root, expiry, side, strike = match.groups()
    try:
        expiration = date(2000 + int(expiry[:2]), int(expiry[2:4]), int(expiry[4:]))
    except ValueError:
        raise ValueError('Invalid contract expiration date.') from None
    today = now.astimezone(ZoneInfo('America/New_York')).date()
    if not today <= expiration <= today + timedelta(days=14):
        raise ValueError('Contract expiration must be within 14 calendar days of the New York date.')
    if int(strike) <= 0:
        raise ValueError('Contract strike must be positive.')
    return {'contract':contract, 'symbol':root, 'expiration':expiration.isoformat(),
            'type':'call' if side == 'C' else 'put', 'strike':str(Decimal(strike) / 1000)}


def fetch_option_quote(contract, now=None):
    fixed_now = now
    now = now or datetime.now(timezone.utc)
    details = contract_details(contract, now)
    key = os.environ.get('APCA_API_KEY_ID', '').strip()
    secret = os.environ.get('APCA_API_SECRET_KEY', '').strip()
    if not key or not secret:
        raise QuoteUnavailable('Alpaca data access is not configured. Add APCA_API_KEY_ID and APCA_API_SECRET_KEY to the backend .env and enable OPRA options data. See docs/options-data-setup.md. Keep trading in Dime; no broker transfer is required by KAPPA.')
    try:
        response = requests.get('https://data.alpaca.markets/v1beta1/options/quotes/latest',
            params={'symbols':contract, 'feed':'opra'},
            headers={'APCA-API-KEY-ID':key, 'APCA-API-SECRET-KEY':secret},
            timeout=10, allow_redirects=False)
    except requests.RequestException:
        raise QuoteUnavailable('Options data provider could not be reached. Retry later.') from None
    if response.status_code != 200:
        message = {
            401:'Alpaca API credentials were rejected. Check your backend configuration.',
            403:'OPRA access was denied. Check the account options-data subscription and permissions. No indicative fallback was used.',
            429:'Options quote rate limit reached. Wait before refreshing.',
        }.get(response.status_code, 'Options data provider is unavailable. Retry later.')
        raise QuoteUnavailable(message)
    # Account for request latency when determining whether the source quote is old.
    now = fixed_now or datetime.now(timezone.utc)
    try:
        quote = response.json()['quotes'][contract]
        def number(field, integer=False):
            raw = quote[field]
            if isinstance(raw, bool) or raw is None:
                raise ValueError()
            value = float(raw)
            if not math.isfinite(value) or not 0 <= value <= 1e9 or (integer and not value.is_integer()):
                raise ValueError()
            return int(value) if integer else value
        bid, ask = number('bp'), number('ap')
        bid_size, ask_size = number('bs', True), number('as', True)
        if ask <= 0 or bid > ask:
            raise ValueError()
        stamp = datetime.fromisoformat(quote['t'].replace('Z', '+00:00'))
        if stamp.tzinfo is None or (stamp - now).total_seconds() > 5:
            raise ValueError()
    except (KeyError, TypeError, ValueError, AttributeError, OverflowError):
        raise QuoteUnavailable('No valid timestamped, two-sided quote was returned for this exact contract. Recheck the contract or refresh later.') from None
    age = max(0, (now - stamp).total_seconds())
    return {**details, 'provider':'Alpaca', 'feed':'opra', 'bid':bid, 'ask':ask,
        'bid_size':bid_size, 'ask_size':ask_size, 'quote_time':stamp.astimezone(timezone.utc).isoformat(),
        'fetched_at':now.isoformat(), 'age_seconds':age, 'stale':age > 60,
        'executable_price_verified':False, 'contract_multiplier_verified':False,
        'limitations':['Provider quote snapshot; actual Dime fills and fees can differ.',
                        'Verify multiplier, deliverable, market session, and broker order cutoff.']}
