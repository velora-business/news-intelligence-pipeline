# ============================================================
# VELORA — NEWS INTELLIGENCE PIPELINE
# Railway Flask Scraper — Article Scraping & Summarisation
#
# This Flask app receives batches of URLs from Google Apps
# Script, scrapes the full article text, summarises each one
# using an LLM via OpenRouter, and returns the results as JSON.
#
# Endpoints:
#   POST /scrape  — accepts { "urls": [...] }, returns summaries
#   GET  /health  — returns { "status": "ok" } for Railway healthcheck
#
# Required environment variables (set in Railway dashboard):
#   OPENROUTER_API_KEY — your OpenRouter API key
# ============================================================

import requests
import os
import time
from dotenv import load_dotenv
from newspaper import Article
from flask import Flask, request, jsonify
from concurrent.futures import ThreadPoolExecutor, as_completed

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL   = "google/gemini-flash-1.5"  # See openrouter.ai/models for alternatives

app = Flask(__name__)


# ============================================================
# SCRAPE A SINGLE ARTICLE
# Downloads and parses article text using newspaper3k.
# Returns clean body text or None if scraping fails.
# ============================================================
def scrape_article(url):
    try:
        article = Article(url)
        article.download()
        article.parse()
        text = article.text.strip()
        return text if text else None
    except Exception as e:
        print(f"Scrape error for {url}: {e}")
        return None


# ============================================================
# SUMMARISE A SINGLE ARTICLE
# Sends article text to OpenRouter and returns a 100-word
# summary. Returns None if the API call fails.
# ============================================================
def summarise_article(article_text):
    prompt = f"""You are a news analyst. Read the following article and write a clear, \
concise summary in exactly 100 words. Strictly utilise content exclusively from the \
article. Do not include any information that is not present in the article.
Focus only on the main news story. Ignore any cookie notices, privacy policies, \
navigation menus, or unrelated content.

Article:
{article_text[:8000]}

Summary:"""

    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": OPENROUTER_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 500,
        },
    )
    data = response.json()
    if "choices" in data and data["choices"]:
        return data["choices"][0]["message"]["content"].strip()
    print(f"OpenRouter error: {data}")
    return None


# ============================================================
# POST /scrape
# Receives a batch of URLs from Google Apps Script.
# Scrapes all URLs in parallel using ThreadPoolExecutor,
# then summarises each article sequentially with a 3-second
# delay between LLM calls to respect OpenRouter rate limits.
# Returns a JSON list of { url, summary } objects.
# ============================================================
@app.route("/scrape", methods=["POST"])
def scrape_batch():
    data = request.get_json()
    urls = data.get("urls", [])

    if not urls:
        return jsonify({"error": "No URLs provided"}), 400

    results = {}

    # Scrape all URLs in parallel
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_url = {executor.submit(scrape_article, url): url for url in urls}
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            results[url] = {"text": future.result(), "summary": None}

    # Summarise sequentially with rate limit delay
    summaries = []
    for url in urls:
        text = results[url]["text"]
        if text:
            summary = summarise_article(text)
            summaries.append({
                "url": url,
                "summary": summary if summary else "SUMMARY_FAILED"
            })
        else:
            summaries.append({"url": url, "summary": "SCRAPE_FAILED"})

        time.sleep(3)  # 3-second delay = max 20 requests/min (OpenRouter free tier)

    return jsonify({"results": summaries})


# ============================================================
# GET /health
# Health check endpoint used by Railway to verify the app
# is running correctly after deployment.
# ============================================================
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
