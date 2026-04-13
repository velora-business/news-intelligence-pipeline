# Velora — News Intelligence Pipeline

An automated pipeline that monitors industry news via Slack RSS feeds, scrapes full article content, summarises each article using AI, and delivers structured output to Google Sheets — running entirely on a weekly trigger with no manual intervention.

---

## How it works

1. Industry news is pushed into a Slack channel via RSS feed
2. Google Apps Script reads the Slack channel weekly and extracts article URLs
3. New URLs are written to Google Sheets with `PENDING` status
4. The script sends URLs in batches to a Railway-hosted Flask scraper
5. The scraper downloads each article and generates a 100-word AI summary
6. Summaries are written back to Google Sheets — each row marked `DONE`

---

## Demo output

| Timestamp | URL | Snippet | AI Summary | Status |
|-----------|-----|---------|------------|--------|
| 13th April 2026 09:00:00 | https://example.com/article | Brief headline snippet... | AI-generated 100-word summary of the article... | DONE |
| 13th April 2026 09:00:00 | https://example.com/article-2 | Brief headline snippet... | AI-generated 100-word summary of the article... | DONE |

---

## Repository structure

---

## Tech stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Trigger | Google Apps Script | Weekly scheduler and Slack/Sheets orchestrator |
| News source | Slack RSS App | Pipes industry news into a Slack channel |
| Storage | Google Sheets | Stores URLs, snippets, summaries and status |
| Scraper | Python + newspaper3k | Downloads and extracts full article text |
| Server | Flask + Gunicorn | Serves the scraping endpoint on Railway |
| Hosting | Railway | Cloud host for the Flask scraper |
| LLM | OpenRouter + Gemini | Generates 100-word article summaries |

---

## Key features

- **Fully automated** — runs on a weekly trigger with no manual steps
- **Deduplication** — the same article URL is never processed twice across runs
- **Parallel scraping** — all URLs in a batch are scraped simultaneously using `ThreadPoolExecutor`
- **Rate limiting** — 3-second delay between LLM calls respects OpenRouter's request limits
- **Time-safe execution** — stops before Google's 6-minute Apps Script limit and schedules a continuation run automatically
- **Graceful failure handling** — each article fails independently with a clear status (`SCRAPE_FAILED`, `SUMMARY_FAILED`, `ERROR`)

---

## Setup

### Prerequisites
- A Google account with access to Google Sheets and Google Apps Script
- A Slack workspace with the RSS app installed
- A Railway account (free tier works)
- An OpenRouter API key

### Step 1 — Set up the Slack RSS feed
Install the RSS app in your Slack workspace and point it at your chosen news sources. All articles will be posted automatically to your chosen channel.

### Step 2 — Set up Google Sheets
Create a new Google Sheet and note the tab name. This is where all URLs and summaries will be written.

### Step 3 — Deploy the Python scraper to Railway
- Fork or clone this repo
- Connect it to Railway
- Set `OPENROUTER_API_KEY` in the Railway environment variables dashboard
- Railway will detect the `Dockerfile` and deploy automatically
- Copy the deployed Railway URL — you will need it in the next step

### Step 4 — Configure and deploy the Apps Script
- Open Google Apps Script (script.google.com)
- Create a new project and paste the contents of `apps-script/main.gs`
- Fill in the four configuration values at the top of the file:

| Variable | Description |
|----------|-------------|
| `SLACK_TOKEN` | Your Slack Bot OAuth token from api.slack.com/apps |
| `CHANNEL_ID` | The Slack channel ID where your RSS feed posts |
| `SHEET_NAME` | The name of your Google Sheet tab |
| `RAILWAY_URL` | Your Railway deployment URL + `/scrape` |

### Step 5 — Set the weekly trigger
Inside Apps Script go to **Triggers → Add Trigger** and set `fetchAndSummariseAseanNews` to run on a weekly time-based trigger.

---

## Environment variables

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `OPENROUTER_API_KEY` | API key for OpenRouter LLM gateway | openrouter.ai/keys |

---

## License

Licensed under CC BY-NC 4.0 — free to view and learn from.
Commercial use requires written permission from Velora.
Contact: veloraofficialbusiness@gmail.com
