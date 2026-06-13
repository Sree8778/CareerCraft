# ── Stage 1: build deps ───────────────────────────────────────────────────────
FROM python:3.11-slim AS base

# System libs needed by weasyprint, Pillow, PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libgdk-pixbuf2.0-0 \
        libcairo2 \
        libffi-dev \
        shared-mime-info \
        fonts-liberation \
        libjpeg-dev \
        libpng-dev \
        zlib1g-dev \
        poppler-utils \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy application code (credentials/ excluded via .dockerignore)
COPY . .

# Cloud Run injects PORT; default to 8080
ENV PORT=8080

EXPOSE 8080

# Use exec form so SIGTERM reaches gunicorn (graceful shutdown)
CMD exec gunicorn \
        --bind "0.0.0.0:${PORT}" \
        --workers 2 \
        --timeout 120 \
        --access-logfile - \
        app:app
