import time
from datetime import datetime

from src.ingestion.news_fetcher import run_pipeline


# How often we want the pipeline to run
INTERVAL_SECONDS = 60


def start_scheduler():
    print("NewsPulse scheduler started!")
    print(f"Pipeline will run every {INTERVAL_SECONDS} seconds.\n")

    while True:
        print("=" * 50)
        print(f"Pipeline started at: {datetime.now()}")
        print("=" * 50)

        try:
            run_pipeline()

        except Exception as error:
            print(f"Pipeline failed: {error}")

        print(f"\nWaiting {INTERVAL_SECONDS} seconds...\n")

        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    start_scheduler()