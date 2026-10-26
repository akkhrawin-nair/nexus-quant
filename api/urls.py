from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .http_views import OptionQuoteView, AnalystBriefView, RefreshAnalystBriefView, ReviewedCatalystsView, WatchCandidatesView
from .views import (
    BullishSignalList,
    BearishSignalList,
    AnalyzeSignals,
    AddAsset,
    VolatilityDataViewSet,
    CandleDataView,
    TriggerIngest,
    SentimentDataView,
    OrderbookDataView,
    PortfolioOptimizerView,
    PaperTradingView,
    PortfolioRiskAnalyticsView,
    AIBrainFusionView,
    BudgetScalpFinderView,
    Options6MoBacktestView,
    MarketPingView,
    TenYearBacktestView,
    HistoricalBacktestView,
    CorrelationView,
    MarketQuotesView,
)

router = DefaultRouter()
router.register(r'volatility', VolatilityDataViewSet, basename='volatility')

urlpatterns = [
    path('research/watch-candidates/', WatchCandidatesView.as_view(), name='watch-candidates'),
    path('research/catalysts/', ReviewedCatalystsView.as_view(), name='reviewed-catalysts'),
    path('research/brief/', AnalystBriefView.as_view(), name='analyst-brief'),
    path('research/brief/refresh/', RefreshAnalystBriefView.as_view(), name='refresh-analyst-brief'),
    path('options/quote/', OptionQuoteView.as_view(), name='option-quote'),
    path('market/quotes/', MarketQuotesView.as_view(), name='market-quotes'),
    path('strategies/backtest/', HistoricalBacktestView.as_view(), name='historical-backtest'),
    path('portfolio/correlation/', CorrelationView.as_view(), name='portfolio-correlation'),
    path('', include(router.urls)),
    path('signals/buy/', BullishSignalList.as_view(), name='buy-signals'),
    path('signals/sell/', BearishSignalList.as_view(), name='sell-signals'),
    path('signals/analyze/', AnalyzeSignals.as_view(), name='analyze-signals'),
    path('signals/add/', AddAsset.as_view(), name='add-asset'),
    path('tickers/add/', AddAsset.as_view(), name='add-ticker'),
    path('trigger-ingest/', TriggerIngest.as_view(), name='trigger-ingest'),
    path('candles/', CandleDataView.as_view(), name='candles-list'),
    path('candles/<str:symbol>/', CandleDataView.as_view(), name='candles-detail'),
    path('sentiment/', SentimentDataView.as_view(), name='sentiment-data'),
    path('orderbook/', OrderbookDataView.as_view(), name='orderbook-data'),
    path('portfolio-optimizer/', PortfolioOptimizerView.as_view(), name='portfolio-optimizer'),
    path('paper-trading/', PaperTradingView.as_view(), name='paper-trading'),
    path('portfolio/risk-analytics/', PortfolioRiskAnalyticsView.as_view(), name='portfolio-risk-analytics'),
    path('brain/fusion/', AIBrainFusionView.as_view(), name='ai-brain-fusion'),
    path('options/scalp-finder/', BudgetScalpFinderView.as_view(), name='budget-scalp-finder'),
    path('options/backtest-6mo/', Options6MoBacktestView.as_view(), name='options-backtest-6mo'),
    path('options/backtest/', Options6MoBacktestView.as_view(), name='options-backtest'),
    path('market/ping/', MarketPingView.as_view(), name='market-ping'),
    path('strategies/backtest-10year/', TenYearBacktestView.as_view(), name='strategies-backtest-10year'),
]
