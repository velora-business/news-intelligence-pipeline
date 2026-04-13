# Velora — News Intelligence Pipeline

## Overview
This Google Apps Script is the trigger layer of the news intelligence pipeline. It orchestrates the full flow from Slack to Google Sheets to AI summarisation.

## What this script does
1. Fetches article URLs posted to a Slack channel via RSS feed
2. Writes new URLs to a Google Sheet with `PENDING` status
3. Sends URLs in batches to a Railway-hosted Flask scraper
4. Receives AI-generated summaries and writes them back to the sheet

## How to run
Set a weekly time-based trigger on the `fetchAndSummariseAseanNews()` function inside Google Apps Script.

## Configuration
Before running, open `apps-script/main.gs` and replace the following placeholders at the top of the file:

| Variable | Description |
|---|---|
| `SLACK_TOKEN` | Your Slack Bot OAuth token (`xoxb-...`) — get this from api.slack.com/apps |
| `CHANNEL_ID` | The Slack channel ID where your RSS feed posts articles |
| `SHEET_NAME` | The name of the Google Sheet tab where data will be written |
| `RAILWAY_URL` | Your Railway Flask app `/scrape` endpoint URL |

## Tech stack
- Google Apps Script
- Slack API
- Google Sheets API
- Railway (Flask scraper host)
- OpenRouter / Gemini (LLM summarisation)
