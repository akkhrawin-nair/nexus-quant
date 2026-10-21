"""Shared scheduler entry points."""
import logging
from api.services.ingestion import ingest_market_data
logger = logging.getLogger('kappa.scheduler')

def run_market_data_ingestion_job():
    result = ingest_market_data()
    logger.info('Market ingestion: %s', result)
    return result

def run_scheduled_ingestion(target_tickers=None):
    return ingest_market_data(target_tickers)
