import datetime
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import connection
import pandas as pd
import yfinance as yf

try:
    import pandas_ta as ta
    HAS_PANDAS_TA = True
except ImportError:
    HAS_PANDAS_TA = False


class Command(BaseCommand):
    help = 'Fetches live market price action from Yahoo Finance, calculates MACD/EMA indicators, and updates database signals.'

    # Expanded Multi-Asset Target Ticker Universe (50+ Assets)
    TARGET_TICKERS = {
        # Tech & Megacap US Equities
        'AAPL': 'Stock',
        'MSFT': 'Stock',
        'GOOGL': 'Stock',
        'AMZN': 'Stock',
        'NVDA': 'Stock',
        'TSLA': 'Stock',
        'META': 'Stock',
        'NFLX': 'Stock',
        'AVGO': 'Stock',
        'AMD': 'Stock',
        'PLTR': 'Stock',
        'SMCI': 'Stock',
        'ARM': 'Stock',
        'QCOM': 'Stock',

        # AI Semiconductors & Hardware
        'TSM': 'Stock',
        'ASML': 'Stock',
        'MU': 'Stock',
        'INTC': 'Stock',

        # High-Growth FinTech & Next-Gen
        'PYPL': 'Stock',
        'SQ': 'Stock',
        'HOOD': 'Stock',
        'SOFI': 'Stock',
        'UBER': 'Stock',
        'COIN': 'Stock',
        'MSTR': 'Stock',

        # Banking, Payments & Finance
        'JPM': 'Stock',
        'BAC': 'Stock',
        'GS': 'Stock',
        'V': 'Stock',
        'MA': 'Stock',

        # Healthcare, Energy & Value Giants
        'LLY': 'Stock',
        'XOM': 'Stock',
        'CVX': 'Stock',
        'JNJ': 'Stock',
        'UNH': 'Stock',
        'EOSE': 'Stock',

        # Consumer Titans
        'WMT': 'Stock',
        'COST': 'Stock',
        'DIS': 'Stock',

        # Major Broad & Sector Index ETFs
        'SPY': 'ETF',
        'QQQ': 'ETF',
        'IWM': 'ETF',
        'DIA': 'ETF',
        'TLT': 'ETF',
        'XLF': 'ETF',
        'XLK': 'ETF',
        'XLE': 'ETF',

        # Commodities & Precious Metals
        'GLD': 'Commodity',
        'SLV': 'Commodity',
        'USO': 'Commodity',
        'UNG': 'Commodity',

        # Major Liquid Digital Assets
        'BTC-USD': 'Crypto',
        'ETH-USD': 'Crypto',
        'SOL-USD': 'Crypto',
        'XRP-USD': 'Crypto',
        'DOGE-USD': 'Crypto',
        'ADA-USD': 'Crypto',
    }

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("=== STARTING NEXUS QUANT MARKET DATA PIPELINE ==="))
        today_date = datetime.date.today()

        updated_count = 0
        created_count = 0

        db_tickers = {}
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT DISTINCT Symbol, AssetType FROM MarketPrices")
                for row in cursor.fetchall():
                    if row[0]:
                        db_tickers[row[0].strip().upper()] = row[1] or 'Stock'
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"Could not query distinct db tickers: {e}"))

        active_tickers = {**self.TARGET_TICKERS, **db_tickers}

        for ticker_symbol, asset_type in active_tickers.items():
            self.stdout.write(f"\n[+] Processing Ticker: {ticker_symbol} ({asset_type})...")

            try:
                # 1. Download price action data via yfinance
                ticker = yf.Ticker(ticker_symbol)
                df = ticker.history(period="1y", interval="1d")


                if df.empty:
                    self.stdout.write(self.style.WARNING(f"  [!] Warning: No price data returned for {ticker_symbol}."))
                    continue

                # 2. Calculate MACD Line, MACD Signal Line, and EMAs (20-day & 50-day)
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

                # Format date column
                df.reset_index(inplace=True)
                df['TradeDate'] = pd.to_datetime(df['Date']).dt.date
                df.dropna(subset=['Close', 'MACD', 'MACD_Signal'], inplace=True)

                if df.empty:
                    self.stdout.write(self.style.WARNING(f"  [!] Warning: No valid indicator rows for {ticker_symbol}."))
                    continue

                # 3. Database Injection (Upsert full historical series into MarketPrices table)
                ticker_records = 0
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

                        cursor.execute("SELECT COUNT(*) FROM MarketPrices WHERE Symbol = %s AND TradeDate = %s", [ticker_symbol, row_date])
                        row_exists = cursor.fetchone()[0] > 0

                        if row_exists:
                            cursor.execute(
                                "UPDATE MarketPrices SET ClosePrice = %s, MACD = %s, MACD_Signal = %s, EMA_20 = %s WHERE Symbol = %s AND TradeDate = %s",
                                [c_close, c_macd, c_macd_sig, c_ema_20, ticker_symbol, row_date]
                            )
                            updated_count += 1
                        else:
                            cursor.execute(
                                "INSERT INTO MarketPrices (Symbol, AssetType, TradeDate, OpenPrice, HighPrice, LowPrice, ClosePrice, Volume, EMA_20, MACD, MACD_Signal) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                                [ticker_symbol, asset_type, row_date, c_open, c_high, c_low, c_close, c_vol, c_ema_20, c_macd, c_macd_sig]
                            )
                            created_count += 1
                        ticker_records += 1

                latest_row = df.iloc[-1]
                l_close = float(round(latest_row['Close'], 4))
                l_macd = float(round(latest_row['MACD'], 4))
                l_sig = float(round(latest_row['MACD_Signal'], 4))

                # 4. Console Output
                self.stdout.write(self.style.SUCCESS(
                    f"  [SUCCESS] Processed {ticker_records} historical candles for {ticker_symbol} | Latest: ${l_close} | MACD: {l_macd} | Signal: {l_sig}"
                ))

            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  [X] Error updating {ticker_symbol}: {str(e)}"))

        self.stdout.write(self.style.SUCCESS(
            f"\n=== PIPELINE EXECUTION COMPLETE: {created_count} Records Created, {updated_count} Records Updated ==="
        ))
