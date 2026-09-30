def classify_topic(title, summary):
    text = f"{title} {summary}".lower()

    topic_keywords = {
        "Technology": [
            "ai",
            "artificial intelligence",
            "software",
            "technology",
            "computer",
            "chip",
            "robot",
            "openai"
        ],

        "Business": [
            "business",
            "company",
            "market",
            "economy",
            "investment",
            "bank",
            "stock"
        ],

        "Politics": [
            "government",
            "president",
            "prime minister",
            "election",
            "congress",
            "parliament"
        ],

        "Sports": [
            "football",
            "soccer",
            "basketball",
            "tennis",
            "game",
            "match"
        ]
    }

    for topic, keywords in topic_keywords.items():

        for keyword in keywords:

            if keyword in text:
                return topic

    return "Other"