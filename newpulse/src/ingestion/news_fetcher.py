import feedparser
import hashlib

from src.database.article_repository import save_articles
from src.processing.article_cleaner import clean_articles


def fetch_news(url, source_name):
    print(f"Fetching {source_name}...")

    feed = feedparser.parse(url)

    # Check HTTP response
    status = feed.get("status")

    if status != 200:
        print(
            f"WARNING: {source_name} returned HTTP status {status}"
        )
        return []

    # Check whether feedparser found a parsing problem
    if feed.bozo:
        print(
            f"WARNING: {source_name} parsing error: "
            f"{feed.bozo_exception}"
        )
        return []

    # Check for suspicious empty feed
    if len(feed.entries) == 0:
        print(
            f"WARNING: {source_name} returned 0 articles"
        )
        return []

    articles = []

    for i in feed.entries:

        url = i.get("link")

        # Skip articles without a URL
        if not url:
            print(
                f"WARNING: Skipping {source_name} article "
                f"because URL is missing"
            )
            continue

        article_id = hashlib.sha256(
            url.encode()
        ).hexdigest()

        article = {
            "article_id": article_id,
            "title": i.get("title"),
            "summary": i.get("summary"),
            "url": url,
            "source": source_name,
            "published_at": i.get("published")
        }

        articles.append(article)

    print(
        f"{source_name} fetched successfully: "
        f"{len(articles)} articles"
    )

    return articles


def remove_duplicates(articles):
    unique_articles = []
    seen_ids = set()

    for article in articles:

        if article["article_id"] not in seen_ids:
            unique_articles.append(article)
            seen_ids.add(article["article_id"])

    return unique_articles


def run_pipeline():

    # 1. Fetch
    bbc_articles = fetch_news(
        "https://feeds.bbci.co.uk/news/rss.xml",
        "BBC"
    )

    npr_articles = fetch_news(
        "https://feeds.npr.org/1001/rss.xml",
        "NPR"
    )

    # 2. Combine
    all_articles = bbc_articles + npr_articles

    # 3. Clean
    cleaned_articles = clean_articles(all_articles)

    # 4. Deduplicate
    unique_articles = remove_duplicates(cleaned_articles)

    # 5. Save
    inserted_count, updated_count = save_articles(unique_articles)

    # 6. Results
    # 6. Results
    print(f"Fetched {len(bbc_articles)} BBC articles")
    print(f"Fetched {len(npr_articles)} NPR articles")
    print(f"Total articles: {len(all_articles)}")
    print(f"Total after cleaning: {len(cleaned_articles)}")
    print(f"Total after deduplication: {len(unique_articles)}")
    print(f"New articles inserted into database: {inserted_count}")
    print(f"Existing articles updated: {updated_count}")
    
    if unique_articles:
        print("\nExample cleaned article:")
        print(unique_articles[0])


if __name__ == "__main__":
    run_pipeline()