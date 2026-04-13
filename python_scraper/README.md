# Python Scraper — Article Scraping & Summarisation

This Flask app is the processing engine of the Velora News Intelligence Pipeline. It receives batches of article URLs from Google Apps Script, scrapes the full article text, summarises each one using an LLM via OpenRouter, and returns the results as JSON.

---

## How it fits into the pipeline

---

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/scrape` | Accepts a batch of URLs, returns AI summaries |
| `GET` | `/health` | Health check — used by Railway to verify the app is running |

### Request format — `/scrape`
```json
{
  "urls": [
    "https://example.com/article-1",
    "https://example.com/article-2"
  ]
}
```

### Response format
```json
{
  "results": [
    { "url": "https://example.com/article-1", "summary": "100-word AI summary..." },
    { "url": "https://example.com/article-2", "summary": "SCRAPE_FAILED" }
  ]
}
```

### Status values
| Status | Meaning |
|--------|---------|
| `100-word summary` | Article successfully scraped and summarised |
| `SCRAPE_FAILED` | Article could not be downloaded or parsed |
| `SUMMARY_FAILED` | Article scraped but LLM summarisation failed |

---

## How it works

1. **Parallel scraping** — all URLs in the batch are scraped simultaneously using `ThreadPoolExecutor` with 10 workers, significantly faster than sequential scraping
2. **Sequential summarisation** — articles are summarised one at a time with a 3-second delay between each LLM call to respect OpenRouter's rate limits
3. **Graceful failure handling** — each URL is handled independently so one failure does not affect the rest of the batch

---

## Tech stack

| Tool | Purpose |
|------|---------|
| Flask | Web framework serving the `/scrape` endpoint |
| Gunicorn | Production WSGI server for Railway deployment |
| newspaper3k | Article download and text extraction |
| BeautifulSoup4 | HTML parsing support |
| OpenRouter API | LLM gateway for AI summarisation |
| python-dotenv | Environment variable management |

---

## Setup & deployment

### 1. Clone the repo and navigate to this folder
```bash
cd python_scraper
```

### 2. Create your environment file
```bash
cp .env.example .env
```
Then open `.env` and add your real OpenRouter API key.

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Run locally
```bash
python scraper.py
```
The app will start on `http://localhost:8080`

### 5. Deploy to Railway
- Connect your GitHub repo to Railway
- Set `OPENROUTER_API_KEY` in the Railway environment variables dashboard
- Railway will detect the `Dockerfile` and deploy automatically

---

## Environment variables

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `OPENROUTER_API_KEY` | API key for OpenRouter LLM gateway | openrouter.ai/keys |

---

## Files

| File | Description |
|------|-------------|
| `scraper.py` | Main Flask app — scraping and summarisation logic |
| `requirements.txt` | Python dependencies |
| `Dockerfile` | Container config for Railway deployment |
| `.env.example` | Environment variable template — copy to `.env` and fill in |

---

## License
This project is licensed under CC BY-NC 4.0 — free to view and learn from.
Commercial use requires written permission from Velora.
Contact: veloraofficialbusiness@gmail.com

