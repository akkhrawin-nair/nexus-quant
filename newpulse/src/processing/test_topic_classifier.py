import sqlite3

from src.processing.topic_classifier import classify_topic


DATABASE_PATH = "data/database/newpulse.db"


# Connect to database
connection = sqlite3.connect(DATABASE_PATH)
cursor = connection.cursor()


# Get articles that have summaries
cursor.execute("""
    SELECT title, summary
    FROM articles
    WHERE summary IS NOT NULL
""")


articles = cursor.fetchall()


# Keep track of topic counts
topic_counts = {}


print("ARTICLE CLASSIFICATION")
print("=" * 70)


for title, summary in articles:

    topic = classify_topic(title, summary)

    print(f"\nTitle: {title}")
    print(f"Topic: {topic}")

    # Count how many articles belong to each topic
    if topic not in topic_counts:
        topic_counts[topic] = 0

    topic_counts[topic] += 1


print("\n")
print("=" * 70)
print("TOPIC SUMMARY")
print("=" * 70)


for topic, count in topic_counts.items():
    print(f"{topic}: {count}")


connection.close()