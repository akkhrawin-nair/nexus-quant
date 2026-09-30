from email.utils import parsedate_to_datetime
from datetime import timezone


def clean_article(article):
    # Convert RSS date string into a Python datetime
    published_date = parsedate_to_datetime(
        article["published_at"]
    )

    # Standardize every source to UTC
    published_date = published_date.astimezone(timezone.utc)

    # Convert datetime into a standardized ISO format
    article["published_at"] = published_date.isoformat()

    # Remove unnecessary whitespace from titles
    article["title"] = " ".join(
        article["title"].split()
    )

    return article


def clean_articles(articles):
    cleaned_articles = []

    for article in articles:
        cleaned_article = clean_article(article)
        cleaned_articles.append(cleaned_article)

    return cleaned_articles