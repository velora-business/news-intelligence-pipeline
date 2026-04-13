# ============================================================
# VELORA — News Intelligence Pipeline
# Dockerfile — Railway Deployment
#
# Builds a lightweight Python 3.11 container running the
# Flask scraper app via Gunicorn on port 8080.
#
# Workers: 2 (suitable for Railway hobby tier)
# Timeout: 120s (allows time for slow article scrapes)
# ============================================================

FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "120", "scraper:app"]
