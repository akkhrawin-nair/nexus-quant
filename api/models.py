from django.db import models


class MarketPrice(models.Model):
    symbol = models.CharField(max_length=20, db_column='Symbol')
    asset_type = models.CharField(max_length=20, db_column='AssetType')
    trade_date = models.DateField(db_column='TradeDate')
    open_price = models.FloatField(db_column='OpenPrice')
    high_price = models.FloatField(db_column='HighPrice')
    low_price = models.FloatField(db_column='LowPrice')
    close_price = models.FloatField(db_column='ClosePrice')
    volume = models.BigIntegerField(db_column='Volume', default=0)
    ema_20 = models.FloatField(db_column='EMA_20')
    macd = models.FloatField(db_column='MACD')
    macd_signal = models.FloatField(db_column='MACD_Signal')
    retrieved_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'MarketPrices'
        constraints = [models.UniqueConstraint(fields=['symbol', 'trade_date'], name='unique_market_symbol_date')]
        ordering = ['trade_date']

class BullishSignal(models.Model):
    symbol = models.CharField(max_length=20, db_column='Symbol', primary_key=True)
    asset_type = models.CharField(max_length=20, db_column='AssetType')
    signal_date = models.DateField(db_column='SignalDate')
    close_price = models.DecimalField(max_digits=18, decimal_places=4, db_column='ClosePrice')
    macd = models.DecimalField(max_digits=18, decimal_places=4, db_column='MACD')
    macd_signal = models.DecimalField(max_digits=18, decimal_places=4, db_column='MACD_Signal')

    class Meta:
        managed = False
        db_table = 'vw_Bullish_MACD_Signals'

class BearishSignal(models.Model):
    symbol = models.CharField(max_length=20, db_column='Symbol', primary_key=True)
    asset_type = models.CharField(max_length=20, db_column='AssetType')
    signal_date = models.DateField(db_column='SignalDate')
    close_price = models.DecimalField(max_digits=18, decimal_places=4, db_column='ClosePrice')
    macd = models.DecimalField(max_digits=18, decimal_places=4, db_column='MACD')
    macd_signal = models.DecimalField(max_digits=18, decimal_places=4, db_column='MACD_Signal')

    class Meta:
        managed = False
        db_table = 'vw_Bearish_MACD_Signals'
