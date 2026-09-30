import sqlite3


DATABASE_PATH = "data/database/newpulse.db"

connection = sqlite3.connect(DATABASE_PATH)
cursor = connection.cursor()


# Count all articles
cursor.execute("""
    SELECT COUNT(*)
    FROM articles
""")

total_articles = cursor.fetchone()[0]


# Count articles with a summary
cursor.execute("""
    SELECT COUNT(*)
    FROM articles
    WHERE summary IS NOT NULL
""")

articles_with_summary = cursor.fetchone()[0]


# Count articles without a summary
cursor.execute("""
    SELECT COUNT(*)
    FROM articles
    WHERE summary IS NULL
""")

articles_without_summary = cursor.fetchone()[0]


print(f"Total articles: {total_articles}")
print(f"Articles with summary: {articles_with_summary}")
print(f"Articles without summary: {articles_without_summary}")


connection.close()