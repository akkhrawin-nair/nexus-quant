import feedparser


url = "https://feeds.bbci.co.uk/news/rss.xml"

feed = feedparser.parse(url)


print("Feed status:")
print(feed.get("status"))


print("\nBozo:")
print(feed.bozo)


print("\nBozo exception:")
if feed.bozo:
    print(feed.bozo_exception)
else:
    print("No parsing error")


print("\nNumber of entries:")
print(len(feed.entries))


print("\nFeed information:")
print(feed.feed)