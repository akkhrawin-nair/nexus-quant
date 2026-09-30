import sqlite3
import os


DATABASE_PATH = "data/database/newpulse.db"


# Create database folder if it doesn't exist
os.makedirs("data/database", exist_ok=True)


# Connect to SQLite
connection = sqlite3.connect(DATABASE_PATH)
cursor = connection.cursor()


# Create table if this is a brand-new database
cursor.execute("""
    CREATE TABLE IF NOT EXISTS articles (
        article_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT,
        url TEXT NOT NULL,
        source TEXT NOT NULL,
        published_at TEXT,
        ingested_at TEXT NOT NULL
    )
""")


# Check which columns already exist
cursor.execute("PRAGMA table_info(articles)")
columns = cursor.fetchall()

column_names = [column[1] for column in columns]


# Add summary column to an existing database
if "summary" not in column_names:
    cursor.execute("""
        ALTER TABLE articles
        ADD COLUMN summary TEXT
    """)

    print("Added 'summary' column to articles table.")

else:
    print("'summary' column already exists.")


connection.commit()
connection.close()

print("Database setup completed successfully!")