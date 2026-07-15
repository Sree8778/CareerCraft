"""
Test configuration — edit this file or set environment variables before running.

Set CAREERCRAFT_* env vars to override defaults:
  $env:CAREERCRAFT_FRONTEND = "https://careercraft-frontend-u7h4zjepfq-uc.a.run.app"
  $env:CAREERCRAFT_BACKEND  = "https://careercraft-backend-u7h4zjepfq-uc.a.run.app"
  $env:CANDIDATE_EMAIL      = "testcandidate@example.com"
  $env:CANDIDATE_PASSWORD   = "Test@1234"
  $env:RECRUITER_EMAIL      = "testrecruiter@example.com"
  $env:RECRUITER_PASSWORD   = "Test@1234"
  $env:GEMINI_API_KEY       = "your-gemini-key"        # for AI feature tests
"""

import os

# ── URLs ───────────────────────────────────────────────────────────────────────
FRONTEND_URL = os.getenv(
    "CAREERCRAFT_FRONTEND",
    "https://careercraft-frontend-u7h4zjepfq-uc.a.run.app",
)
BACKEND_URL = os.getenv(
    "CAREERCRAFT_BACKEND",
    "https://careercraft-backend-u7h4zjepfq-uc.a.run.app",
)
API_BASE = f"{BACKEND_URL}/api"

# ── Test credentials ───────────────────────────────────────────────────────────
CANDIDATE_EMAIL    = os.getenv("CANDIDATE_EMAIL",    "testcandidate@careercraft.test")
CANDIDATE_PASSWORD = os.getenv("CANDIDATE_PASSWORD", "TestCandidate@1")
RECRUITER_EMAIL    = os.getenv("RECRUITER_EMAIL",    "testrecruiter@careercraft.test")
RECRUITER_PASSWORD = os.getenv("RECRUITER_PASSWORD", "TestRecruiter@1")

# ── AI key (optional — skip AI tests if missing; already stored in test account wallet) ─
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ── Firebase Web API key — public client key, already in the deployed frontend bundle ──
FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY", "AIzaSyBhM8zrjFa_7F-m4HBy7coP9Vt1Qz_zOLQ")

# ── Playwright settings ────────────────────────────────────────────────────────
HEADLESS      = os.getenv("HEADLESS", "true").lower() != "false"
SLOW_MO_MS    = int(os.getenv("SLOW_MO", "0"))       # set to 500 to watch tests run
TIMEOUT_MS    = int(os.getenv("TIMEOUT_MS", "30000"))
