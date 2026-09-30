import pyodbc
import pandas as pd
import yfinance as yf

# 1. Define the Assets to Track
ASSETS = {
    'NVDA': {'type': 'Stock'},
    'SPY': {'type': 'Stock'},
    'BTC-USD': {'type': 'Crypto'},
    'GLD': {'type': 'Commodity'},
    'EOSE': {'type': 'Stock'}
}

# 2. Database Connection
conn_str = (
    r'DRIVER={ODBC Driver 17 for SQL Server};'
    r'SERVER=.\SQLEXPRESS;'
    r'DATABASE=InventoryDB;'
    r'Trusted_Connection=yes;'
    r'Encrypt=yes;'
    r'TrustServerCertificate=yes;'
)

def run_market_pipeline():
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()
    print("Database connected. Starting market data extraction...\n")

    for symbol, metadata in ASSETS.items():
        print(f"--- Fetching: {symbol} ({metadata['type']}) ---")
        
        # EXTRACT: Download recent historical data (fetching 6 months to ensure accurate MACD warmup)
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="6mo", interval="1d")
        
        if df.empty:
            print(f"No data returned for {symbol}.")
            continue

        # TRANSFORM: Calculate Indicators BEFORE formatting
        # 20-Day EMA
        df['EMA_20'] = df['Close'].ewm(span=20, adjust=False).mean()
        
        # MACD (12-day EMA minus 26-day EMA)
        ema_12 = df['Close'].ewm(span=12, adjust=False).mean()
        ema_26 = df['Close'].ewm(span=26, adjust=False).mean()
        df['MACD'] = ema_12 - ema_26
        
        # MACD Signal Line (9-day EMA of the MACD)
        df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()

        # Format columns and drop NaN values from the warmup period
        df.reset_index(inplace=True)
        df['Date'] = pd.to_datetime(df['Date']).dt.date
        df['Symbol'] = symbol
        df['AssetType'] = metadata['type']
        df.dropna(inplace=True) 

        # Select and round target columns
        df = df[['Symbol', 'AssetType', 'Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'EMA_20', 'MACD', 'MACD_Signal']]
        df = df.round(4)

        # LOAD: Insert records into MS SQL Server
        # We use an UPDATE if the record exists so we can safely backfill the new indicator columns
        upsert_query = """
        IF EXISTS (SELECT 1 FROM MarketPrices WHERE Symbol = ? AND TradeDate = ?)
        BEGIN
            UPDATE MarketPrices 
            SET EMA_20 = ?, MACD = ?, MACD_Signal = ?
            WHERE Symbol = ? AND TradeDate = ?
        END
        ELSE
        BEGIN
            INSERT INTO MarketPrices (Symbol, AssetType, TradeDate, OpenPrice, HighPrice, LowPrice, ClosePrice, Volume, EMA_20, MACD, MACD_Signal)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        END
        """

        records_processed = 0
        for _, row in df.iterrows():
            cursor.execute(upsert_query, (
                # Update parameters
                row['Symbol'], row['Date'], 
                row['EMA_20'], row['MACD'], row['MACD_Signal'],
                row['Symbol'], row['Date'],
                # Insert parameters
                row['Symbol'], row['AssetType'], row['Date'],
                row['Open'], row['High'], row['Low'], row['Close'],
                row['Volume'], row['EMA_20'], row['MACD'], row['MACD_Signal']
            ))
            records_processed += 1
            
        conn.commit()
        print(f"Successfully processed and calculated indicators for {records_processed} days of {symbol} data.\n")

    conn.close()
    print("Pipeline execution complete.")

if __name__ == '__main__':
    run_market_pipeline()