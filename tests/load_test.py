"""
load_test.py â€” CareerCraft load test with Locust.

Simulates realistic user traffic across three user types:
  - Anonymous visitor  (browses landing, companies, job list)
  - Candidate          (searches jobs, views details, checks applications)
  - Recruiter          (views dashboard stats, candidates, applications)

Usage (headless, 100 users, 2 min):
    locust -f tests/load_test.py --headless \
           -u 100 -r 10 --run-time 2m \
           --host https://careercraft-backend-u7h4zjepfq-uc.a.run.app \
           --html tests/load_report.html

Usage (live dashboard at http://localhost:8089):
    locust -f tests/load_test.py \
           --host https://careercraft-backend-u7h4zjepfq-uc.a.run.app
"""

import os
import random
import requests as _req
from locust import HttpUser, task, between, events
from locust.runners import MasterRunner

# â”€â”€ Firebase REST config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Public web API key (safe to use client-side â€” same key in google-services.json)
FIREBASE_API_KEY = "AIzaSyC5hcrN050v6n8qogKw6hiKLqLx8gKbvLM"
FIREBASE_SIGN_IN = (
    f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
    f"?key={FIREBASE_API_KEY}"
)

CANDIDATE_EMAIL    = "testcandidate@careercraft.test"
CANDIDATE_PASSWORD = "TestCandidate@1"
RECRUITER_EMAIL    = "testrecruiter@careercraft.test"
RECRUITER_PASSWORD = "TestRecruiter@1"

# Cache tokens so we don't spam Firebase Auth every request
_token_cache: dict[str, str] = {}

def _get_firebase_token(email: str, password: str) -> str:
    if email in _token_cache:
        return _token_cache[email]
    resp = _req.post(FIREBASE_SIGN_IN, json={
        "email": email, "password": password, "returnSecureToken": True
    }, timeout=15)
    if resp.status_code != 200:
        print(f"[WARN] Firebase auth failed for {email}: {resp.text[:200]}")
        return ""
    token = resp.json().get("idToken", "")
    _token_cache[email] = token
    return token


# â”€â”€ Sample data for realistic queries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
SEARCH_QUERIES = [
    "remote software engineer python",
    "senior frontend react typescript",
    "machine learning engineer llm",
    "product manager saas b2b",
    "devops kubernetes aws",
    "data scientist sql python",
    "flutter mobile developer",
    "full stack node react",
    "ux designer figma",
    "entry level junior developer",
    "cloud architect aws gcp",
    "growth marketing manager",
    "financial analyst startup",
    "customer success saas",
]

LOCATIONS = ["Remote", "San Francisco, CA", "New York, NY", "Austin, TX", "Seattle, WA", ""]
EXP_LEVELS = ["Entry", "Mid", "Senior", ""]
WORK_MODES = ["Remote", "Hybrid", "In-office", ""]


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#  ANONYMOUS VISITOR â€” no auth, hits public read-only endpoints
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class AnonymousUser(HttpUser):
    weight = 3          # 3Ã— more anonymous visitors than logged-in users
    wait_time = between(1.5, 4.0)

    @task(5)
    def browse_jobs(self):
        params = {}
        if random.random() > 0.5:
            params["location"] = random.choice(LOCATIONS)
        if random.random() > 0.5:
            params["experienceLevel"] = random.choice(EXP_LEVELS)
        if random.random() > 0.5:
            params["workMode"] = random.choice(WORK_MODES)
        self.client.get("/api/jobs", params=params, name="/api/jobs")

    @task(3)
    def browse_companies(self):
        self.client.get("/api/companies", name="/api/companies")

    @task(2)
    def platform_config(self):
        self.client.get("/api/platform/config", name="/api/platform/config")

    @task(1)
    def benefits(self):
        self.client.get("/api/benefits", name="/api/benefits")

    @task(1)
    def testimonials(self):
        self.client.get("/api/testimonials", name="/api/testimonials")

    @task(1)
    def featured_employers(self):
        self.client.get("/api/employers/featured", name="/api/employers/featured")

    @task(2)
    def view_job_detail(self):
        # First get a job ID
        resp = self.client.get("/api/jobs?limit=20", name="/api/jobs (for detail)")
        if resp.status_code == 200:
            jobs = resp.json().get("jobs", [])
            if jobs:
                job = random.choice(jobs)
                jid = job.get("id") or job.get("jobId") or ""
                if jid:
                    self.client.get(f"/api/jobs/{jid}", name="/api/jobs/[id]")

    @task(1)
    def view_company_detail(self):
        resp = self.client.get("/api/companies?limit=10", name="/api/companies (for detail)")
        if resp.status_code == 200:
            companies = resp.json().get("companies", []) if isinstance(resp.json(), dict) else resp.json()
            if isinstance(companies, list) and companies:
                cid = random.choice(companies).get("id", "")
                if cid:
                    self.client.get(f"/api/companies/{cid}", name="/api/companies/[id]")


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#  CANDIDATE â€” authenticated, searches jobs, applies, checks applications
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class CandidateUser(HttpUser):
    weight = 2
    wait_time = between(2.0, 5.0)

    def on_start(self):
        token = _get_firebase_token(CANDIDATE_EMAIL, CANDIDATE_PASSWORD)
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}
        if not token:
            print("[WARN] Candidate token unavailable â€” requests will be unauthenticated")

    @task(4)
    def semantic_job_search(self):
        query = random.choice(SEARCH_QUERIES)
        self.client.post(
            "/api/jobs/search-semantic",
            json={"query": query, "limit": 10},
            headers=self.headers,
            name="/api/jobs/search-semantic",
        )

    @task(3)
    def browse_jobs_filtered(self):
        params = {
            "location": random.choice(LOCATIONS),
            "experienceLevel": random.choice(EXP_LEVELS),
            "workMode": random.choice(WORK_MODES),
        }
        self.client.get("/api/jobs", params={k: v for k, v in params.items() if v},
                        headers=self.headers, name="/api/jobs (filtered)")

    @task(2)
    def my_applications(self):
        self.client.get("/api/applications",
                        headers=self.headers, name="/api/applications")

    @task(2)
    def candidate_stats(self):
        # Use a placeholder UID since we'd need to decode the token for the real one
        self.client.get("/api/stats/candidate/testcandidate",
                        headers=self.headers, name="/api/stats/candidate")

    @task(1)
    def salary_insights(self):
        self.client.get("/api/stats/salaries",
                        headers=self.headers, name="/api/stats/salaries")

    @task(1)
    def notifications(self):
        self.client.get("/api/notifications",
                        headers=self.headers, name="/api/notifications")

    @task(1)
    def my_chats(self):
        self.client.get("/api/chats",
                        headers=self.headers, name="/api/chats")

    @task(1)
    def connections(self):
        self.client.get("/api/connections",
                        headers=self.headers, name="/api/connections")

    @task(1)
    def job_alerts(self):
        self.client.get("/api/job-alerts",
                        headers=self.headers, name="/api/job-alerts")

    @task(2)
    def view_job_and_analyze(self):
        resp = self.client.get("/api/jobs?limit=20", headers=self.headers,
                               name="/api/jobs (candidate browse)")
        if resp.status_code == 200:
            jobs = resp.json().get("jobs", [])
            if jobs:
                job = random.choice(jobs)
                jid = job.get("id") or job.get("jobId") or ""
                if jid:
                    self.client.get(f"/api/jobs/{jid}", headers=self.headers,
                                    name="/api/jobs/[id] (candidate)")


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#  RECRUITER â€” authenticated, views candidates, applications, stats
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class RecruiterUser(HttpUser):
    weight = 1
    wait_time = between(3.0, 7.0)

    def on_start(self):
        token = _get_firebase_token(RECRUITER_EMAIL, RECRUITER_PASSWORD)
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}
        if not token:
            print("[WARN] Recruiter token unavailable â€” requests will be unauthenticated")

    @task(3)
    def view_candidates(self):
        self.client.get("/api/candidates",
                        headers=self.headers, name="/api/candidates")

    @task(3)
    def view_applications(self):
        self.client.get("/api/applications",
                        headers=self.headers, name="/api/applications (recruiter)")

    @task(2)
    def recruiter_stats(self):
        self.client.get("/api/stats/recruiter/testrecruiter",
                        headers=self.headers, name="/api/stats/recruiter")

    @task(2)
    def search_candidates_copilot(self):
        queries = [
            "experienced flutter developer who shipped apps",
            "senior python backend engineer aws",
            "data scientist with recommendation systems",
            "cloud architect enterprise AWS certified",
            "junior engineer python eager to learn",
        ]
        self.client.post(
            "/api/candidates/search-copilot",
            json={"query": random.choice(queries), "limit": 10},
            headers=self.headers,
            name="/api/candidates/search-copilot",
        )

    @task(1)
    def view_jobs(self):
        self.client.get("/api/jobs",
                        headers=self.headers, name="/api/jobs (recruiter)")

    @task(1)
    def my_chats(self):
        self.client.get("/api/chats",
                        headers=self.headers, name="/api/chats (recruiter)")

    @task(1)
    def connections(self):
        self.client.get("/api/connections",
                        headers=self.headers, name="/api/connections (recruiter)")

    @task(1)
    def salary_insights(self):
        self.client.get("/api/stats/salaries",
                        headers=self.headers, name="/api/stats/salaries (recruiter)")
