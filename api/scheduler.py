import datetime
import time
import logging
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from django.db import connection, close_old_connections
import pandas as pd
import yfinance as yf

try:
    import pandas_ta as ta
    HAS_PANDAS_TA = True
except ImportError:
    HAS_PANDAS_TA = False

# Configure structured logger for KAPPA ANALYTICS Scheduler
logger = logging.getLogger('kappa_analytics.scheduler')
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('[%(asctime)s] [%(levelname)s] [KAPPA-SCHEDULER] %(message)s', '%Y-%m-%d %H:%M:%S')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


# Default Target Ticker Universe
DEFAULT_TARGET_TICKERS = {
    # Major Crypto
    'BTC-USD': 'Crypto',
    'ETH-USD': 'Crypto',
    'SOL-USD': 'Crypto',

    # High-Volatility Tech & Mega-Caps (US Equities)
    'NVDA': 'Stock',
    'AAPL': 'Stock',
    'MSFT': 'Stock',
    'AMZN': 'Stock',
    'GOOGL': 'Stock',
    'META': 'Stock',
    'TSLA': 'Stock',
    'AMD': 'Stock',
    'PLTR': 'Stock',
    'COIN': 'Stock',
    'EOSE': 'Stock',

    # Indices & Commodities
    'SPY': 'Stock',
    'QQQ': 'Stock',
    'GLD': 'Commodity',
    'USO': 'Commodity',
}

MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 2  # seconds


def fetch_live_quote_and_daily_change(symbol: str):
    """
    Fetches real-time market price, previous close, and 1-day percentage change (daily_change_pct) for a ticker symbol.
    """
    try:
        ticker = yf.Ticker(symbol)
        try:
            current_price = float(ticker.fast_info['last_price'])
            prev_close = float(ticker.fast_info['previous_close'])
        except Exception:
            hist = ticker.history(period="5d")
            if not hist.empty and len(hist) >= 2:
                current_price = float(hist['Close'].iloc[-1])
                prev_close = float(hist['Close'].iloc[-2])
            elif not hist.empty:
                current_price = float(hist['Close'].iloc[-1])
                prev_close = current_price
            else:
                return None, None, 0.0

        if prev_close > 0:
            daily_change_pct = round(((current_price - prev_close) / prev_close) * 100.0, 2)
        else:
            daily_change_pct = 0.0

        return round(current_price, 4), round(prev_close, 4), daily_change_pct
    except Exception as e:
        logger.warning(f"Live quote fetch failed for '{symbol}': {e}")
        return None, None, 0.0


def fetch_ticker_data_with_retry(ticker_symbol: str, retries: int = MAX_RETRIES):
    """
    Downloads historical price data from Yahoo Finance with exponential backoff retry
    and updates the latest row with real-time last_price quote and 1-day change calculations.
    """
    delay = INITIAL_RETRY_DELAY
    for attempt in range(1, retries + 1):
        try:
            ticker = yf.Ticker(ticker_symbol)
            df = ticker.history(period="1y", interval="1d")

            if not df.empty:
                # 1. Fetch current price and previous close
                try:
                    current_price = float(ticker.fast_info['last_price'])
                    prev_close = float(ticker.fast_info['previous_close'])
                except Exception:
                    hist = ticker.history(period="5d")
                    if not hist.empty and len(hist) >= 2:
                        current_price = float(hist['Close'].iloc[-1])
                        prev_close = float(hist['Close'].iloc[-2])
                    else:
                        current_price = float(df['Close'].iloc[-1])
                        prev_close = float(df['Close'].iloc[-2]) if len(df) >= 2 else current_price

                # 2. Compute 1-day percentage change
                if prev_close > 0:
                    daily_change_pct = round(((current_price - prev_close) / prev_close) * 100.0, 2)
                else:
                    daily_change_pct = 0.0

                if current_price and current_price > 0:
                    df.iloc[-1, df.columns.get_loc('Close')] = current_price

                return df
            logger.warning(f"Empty dataset received for '{ticker_symbol}' (Attempt {attempt}/{retries})")
        except Exception as e:
            logger.warning(f"Fetch error for '{ticker_symbol}' on attempt {attempt}/{retries}: {e}")

        if attempt < retries:
            time.sleep(delay)
            delay *= 2

    return pd.DataFrame()


def process_ticker_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculates technical indicators (20-day & 50-day EMA, 12-26-9 MACD) on daily price action.
    """
    df = df.copy()
    if HAS_PANDAS_TA:
        df.ta.ema(length=20, append=True)
        df.ta.ema(length=50, append=True)
        df.ta.macd(fast=12, slow=26, signal=9, append=True)

        df['EMA_20'] = df.get('EMA_20', df['Close'].ewm(span=20, adjust=False).mean())
        df['EMA_50'] = df.get('EMA_50', df['Close'].ewm(span=50, adjust=False).mean())
        df['MACD'] = df.get('MACD_12_26_9', df['Close'].ewm(span=12, adjust=False).mean() - df['Close'].ewm(span=26, adjust=False).mean())
        df['MACD_Signal'] = df.get('MACDs_12_26_9', df['MACD'].ewm(span=9, adjust=False).mean())
    else:
        df['EMA_20'] = df['Close'].ewm(span=20, adjust=False).mean()
        df['EMA_50'] = df['Close'].ewm(span=50, adjust=False).mean()
        ema_12 = df['Close'].ewm(span=12, adjust=False).mean()
        ema_26 = df['Close'].ewm(span=26, adjust=False).mean()
        df['MACD'] = ema_12 - ema_26
        df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()

    df.reset_index(inplace=True)
    df['TradeDate'] = pd.to_datetime(df['Date']).dt.date
    df.dropna(subset=['Close', 'MACD', 'MACD_Signal'], inplace=True)
    return df


def process_single_ticker(ticker_tuple):
    ticker_symbol, asset_type = ticker_tuple
    close_old_connections()
    created, updated, failed = 0, 0, 0

    try:
        logger.info(f"Processing asset: {ticker_symbol} ({asset_type})")
        df = fetch_ticker_data_with_retry(ticker_symbol)

        if df.empty:
            logger.error(f"Failed to fetch market data for {ticker_symbol} after max retries.")
            return 0, 0, 1

        df = process_ticker_indicators(df)
        if df.empty:
            logger.warning(f"No valid indicator rows for {ticker_symbol}.")
            return 0, 0, 1

        records_synced = 0
        with connection.cursor() as cursor:
            for _, row in df.iterrows():
                row_date = row['TradeDate']
                c_close = float(round(row['Close'], 4))
                c_macd = float(round(row['MACD'], 4))
                c_macd_sig = float(round(row['MACD_Signal'], 4))
                c_ema_20 = float(round(row['EMA_20'], 4))
                c_open = float(round(row['Open'], 4))
                c_high = float(round(row['High'], 4))
                c_low = float(round(row['Low'], 4))
                c_vol = int(row.get('Volume', 0))

                cursor.execute(
                    "SELECT COUNT(*) FROM MarketPrices WHERE Symbol = %s AND TradeDate = %s",
                    [ticker_symbol, row_date]
                )
                row_exists = cursor.fetchone()[0] > 0

                if row_exists:
                    cursor.execute(
                        "UPDATE MarketPrices SET ClosePrice = %s, MACD = %s, MACD_Signal = %s, EMA_20 = %s, OpenPrice = %s, HighPrice = %s, LowPrice = %s, Volume = %s WHERE Symbol = %s AND TradeDate = %s",
                        [c_close, c_macd, c_macd_sig, c_ema_20, c_open, c_high, c_low, c_vol, ticker_symbol, row_date]
                    )
                    updated += 1
                else:
                    cursor.execute(
                        "INSERT INTO MarketPrices (Symbol, AssetType, TradeDate, OpenPrice, HighPrice, LowPrice, ClosePrice, Volume, EMA_20, MACD, MACD_Signal) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                        [ticker_symbol, asset_type, row_date, c_open, c_high, c_low, c_close, c_vol, c_ema_20, c_macd, c_macd_sig]
                    )
                    created += 1
                records_synced += 1

        latest_row = df.iloc[-1]
        logger.info(
            f"SUCCESS: {ticker_symbol} | Synced: {records_synced} candles | "
            f"Close: ${latest_row['Close']:.2f} | MACD: {latest_row['MACD']:.4f} | Signal: {latest_row['MACD_Signal']:.4f}"
        )
        return created, updated, 0
    except Exception as e:
        logger.error(f"Database/Indicator processing error for {ticker_symbol}: {e}")
        return 0, 0, 1
    finally:
        close_old_connections()


def run_scheduled_ingestion(target_tickers=None):
    """
    Autonomous background worker job that executes parallel market data ingestion
    using ThreadPoolExecutor across all target assets.
    """
    close_old_connections()

    db_tickers = {}
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT DISTINCT Symbol, AssetType FROM MarketPrices")
            for row in cursor.fetchall():
                if row[0]:
                    db_tickers[row[0].strip().upper()] = row[1] or 'Stock'
    except Exception as e:
        logger.warning(f"Could not query distinct db tickers: {e}")

    active_target_tickers = {**DEFAULT_TARGET_TICKERS, **db_tickers}
    if target_tickers is None:
        target_tickers = active_target_tickers

    start_time = time.time()
    logger.info(f"=== PARALLEL INGESTION CYCLE STARTED ({len(target_tickers)} Tickers) ===")

    total_created = 0
    total_updated = 0
    total_failed = 0

    ticker_tuples = list(target_tickers.items())

    # Execute parallel yfinance fetches and database updates concurrently across 8 worker threads
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(process_single_ticker, ticker_tuples))

    for c, u, f in results:
        total_created += c
        total_updated += u
        total_failed += f

    duration = time.time() - start_time
    logger.info(
        f"=== INGESTION CYCLE COMPLETE in {duration:.2f}s | "
        f"Created: {total_created} | Updated: {total_updated} | Failures: {total_failed} ==="
    )
    return {
        'created': total_created,
        'updated': total_updated,
        'failed': total_failed,
        'duration_seconds': duration,
    }
