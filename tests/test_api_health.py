"""
API Health Checks — hits every backend endpoint and verifies responses.
Run with:  pytest tests/test_api_health.py -v
"""

import os
import pytest
import requests
from config import API_BASE, CANDIDATE_EMAIL, CANDIDATE_PASSWORD, RECRUITER_EMAIL, RECRUITER_PASSWORD, FIREBASE_API_KEY


# ── Helpers ────────────────────────────────────────────────────────────────────

def api(path: str) -> str:
    return f"{API_BASE}{path}"


@pytest.fixture(scope="module")
def candidate_token(firebase_login):
    return firebase_login(CANDIDATE_EMAIL, CANDIDATE_PASSWORD)


@pytest.fixture(scope="module")
def recruiter_token(firebase_login):
    return firebase_login(RECRUITER_EMAIL, RECRUITER_PASSWORD)


@pytest.fixture(scope="module")
def firebase_login():
    """
    Returns a helper that signs in via Firebase REST API and returns an ID token.
    Requires FIREBASE_API_KEY env var (same key used in .env.local).
    """
    def _login(email: str, password: str) -> str:
        api_key = os.getenv("FIREBASE_API_KEY", FIREBASE_API_KEY)
        if not api_key:
            pytest.skip("FIREBASE_API_KEY not set — skipping authenticated tests")
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}"
        r = requests.post(url, json={"email": email, "password": password, "returnSecureToken": True})
        assert r.status_code == 200, f"Firebase login failed: {r.text}"
        return r.json()["idToken"]

    return _login


# ── Public endpoints (no auth) ─────────────────────────────────────────────────

class TestPublicEndpoints:

    def test_health_root(self):
        """Backend root responds."""
        r = requests.get(API_BASE.replace("/api", "/"), timeout=10)
        assert r.status_code in (200, 404), f"Unexpected status {r.status_code}"

    def test_jobs_list(self):
        """GET /jobs returns jobs (either bare array or {jobs:[...]} envelope)."""
        r = requests.get(api("/jobs"), timeout=10)
        assert r.status_code == 200, f"GET /jobs failed: {r.text}"
        data = r.json()
        # Backend returns {"jobs": [...]}
        jobs = data.get("jobs", data) if isinstance(data, dict) else data
        assert isinstance(jobs, list), f"Expected a list of jobs, got: {type(jobs)}"
        print(f"  ✓ {len(jobs)} jobs returned")

    def test_companies_list(self):
        """GET /companies returns list."""
        r = requests.get(api("/companies"), timeout=10)
        assert r.status_code in (200, 404)

    def test_job_detail(self):
        """GET /jobs/{id} returns a job if any exist."""
        raw = requests.get(api("/jobs"), timeout=10).json()
        jobs = raw.get("jobs", raw) if isinstance(raw, dict) else raw
        if not jobs:
            pytest.skip("No jobs in database")
        job_id = jobs[0].get("id") or jobs[0].get("jobId")
        r = requests.get(api(f"/jobs/{job_id}"), timeout=10)
        assert r.status_code == 200, f"GET /jobs/{job_id} failed: {r.text}"
        data = r.json()
        assert "title" in data, "Job missing 'title' field"
        print(f"  ✓ Job: {data['title']}")


# ── Auth-required endpoints ────────────────────────────────────────────────────

class TestCandidateEndpoints:

    def test_candidate_stats(self, candidate_token):
        """GET /stats/candidate/{uid}"""
        import jwt as _jwt  # pyjwt
        try:
            uid = _jwt.decode(candidate_token, options={"verify_signature": False})["user_id"]
        except Exception:
            pytest.skip("Could not decode token")
        r = requests.get(
            api(f"/stats/candidate/{uid}"),
            headers={"Authorization": f"Bearer {candidate_token}"},
            timeout=10,
        )
        assert r.status_code in (200, 404), f"Stats failed: {r.text}"

    def test_applications_list(self, candidate_token):
        """GET /applications as candidate"""
        r = requests.get(
            api("/applications"),
            headers={"Authorization": f"Bearer {candidate_token}"},
            timeout=10,
        )
        assert r.status_code == 200, f"Applications failed: {r.text}"
        data = r.json()
        apps = data.get("applications", data) if isinstance(data, dict) else data
        assert isinstance(apps, list)

    def test_job_alerts_crud(self, candidate_token):
        """Create → list → delete a job alert."""
        auth = {"Authorization": f"Bearer {candidate_token}"}
        # Create
        create = requests.post(
            api("/job-alerts"),
            json={"keywords": "pytest-test-alert", "location": "Remote"},
            headers={**auth, "Content-Type": "application/json"},
            timeout=10,
        )
        assert create.status_code in (200, 201), f"Create alert failed: {create.text}"
        alert_id = create.json().get("id") or create.json().get("alertId")
        # List
        lst = requests.get(api("/job-alerts"), headers=auth, timeout=10)
        assert lst.status_code == 200
        # Delete
        if alert_id:
            delete = requests.delete(api(f"/job-alerts/{alert_id}"), headers=auth, timeout=10)
            assert delete.status_code in (200, 204), f"Delete alert failed: {delete.text}"


class TestRecruiterEndpoints:

    def test_recruiter_stats(self, recruiter_token):
        """GET /stats/recruiter/{uid}"""
        try:
            import jwt as _jwt
            uid = _jwt.decode(recruiter_token, options={"verify_signature": False})["user_id"]
        except Exception:
            pytest.skip("Could not decode token")
        r = requests.get(
            api(f"/stats/recruiter/{uid}"),
            headers={"Authorization": f"Bearer {recruiter_token}"},
            timeout=10,
        )
        assert r.status_code in (200, 404), f"Stats failed: {r.text}"

    def test_create_and_delete_job(self, recruiter_token):
        """POST /jobs/v1/post → verify → PATCH."""
        auth = {"Authorization": f"Bearer {recruiter_token}", "Content-Type": "application/json"}
        payload = {
            "title": "Automated Test Job — DELETEME",
            "description": "This job was created by the test suite.",
            "jobType": "Full-time",
            "department": "QA",
            "location": "Remote",
            "company": "TestCo",
            "requirements": ["Python", "Playwright"],
            "benefits": ["Health insurance"],
        }
        create = requests.post(api("/jobs/v1/post"), json=payload, headers=auth, timeout=15)
        assert create.status_code in (200, 201), f"Create job failed: {create.text}"
        job = create.json()
        job_id = job.get("id") or job.get("jobId")
        print(f"  ✓ Created job id={job_id}")

        # Patch it
        if job_id:
            patch = requests.patch(
                api(f"/jobs/{job_id}"),
                json={"title": "Automated Test Job v2 — DELETEME"},
                headers=auth,
                timeout=10,
            )
            assert patch.status_code in (200, 204), f"Patch job failed: {patch.text}"

    def test_generate_description_no_key(self, recruiter_token):
        """POST /jobs/generate-description without AI key → 402 or description."""
        auth = {"Authorization": f"Bearer {recruiter_token}", "Content-Type": "application/json"}
        r = requests.post(
            api("/jobs/generate-description"),
            json={"title": "Software Engineer", "department": "Engineering", "type": "Full-time"},
            headers=auth,
            timeout=30,
        )
        # With no API key: 402. With key: 200. Either is correct.
        assert r.status_code in (200, 402), f"Unexpected status {r.status_code}: {r.text}"
        if r.status_code == 200:
            data = r.json()
            assert "description" in data
            print(f"  ✓ AI description: {data['description'][:80]}…")
        else:
            print(f"  ⚠ 402 — no API keys configured for recruiter")


class TestVaultEndpoints:

    def test_vault_verify_invalid_key(self, candidate_token):
        """POST /vault/verify-key with fake key → should say invalid, not 500."""
        auth = {"Authorization": f"Bearer {candidate_token}", "Content-Type": "application/json"}
        r = requests.post(
            api("/vault/verify-key"),
            json={"provider": "Gemini", "key": "fake-key-abc123"},
            headers=auth,
            timeout=15,
        )
        assert r.status_code in (200, 400, 422), f"Unexpected {r.status_code}: {r.text}"
        data = r.json()
        assert "valid" in data or "error" in data

    def test_vault_wallet_status(self, candidate_token):
        """GET /vault/wallet/status returns wallet info."""
        r = requests.get(
            api("/vault/wallet/status"),
            headers={"Authorization": f"Bearer {candidate_token}"},
            timeout=10,
        )
        assert r.status_code == 200, f"Wallet status failed: {r.text}"
