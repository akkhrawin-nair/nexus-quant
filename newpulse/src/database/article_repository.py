import sqlite3
from datetime import datetime, timezone


DATABASE_PATH = "data/database/newpulse.db"


def save_articles(articles):
    connection = sqlite3.connect(DATABASE_PATH)
    cursor = connection.cursor()

    inserted_count = 0
    updated_count = 0

    for article in articles:

        ingested_at = datetime.now(timezone.utc).isoformat()

        # Try to insert the article
        cursor.execute("""
            INSERT OR IGNORE INTO articles (
                article_id,
                title,
                summary,
                url,
                source,
                published_at,
                ingested_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            article["article_id"],
            article["title"],
            article["summary"],
            article["url"],
            article["source"],
            article["published_at"],
            ingested_at
        ))

        if cursor.rowcount == 1:
            inserted_count += 1

        else:
            # Article already exists.
            # Only fill the summary if it is currently missing.
            cursor.execute("""
                UPDATE articles
                SET summary = ?
                WHERE article_id = ?
                AND summary IS NULL
            """, (
                article["summary"],
                article["article_id"]
            ))

            if cursor.rowcount == 1:
                updated_count += 1

    connection.commit()
    connection.close()

    return inserted_count, updated_count