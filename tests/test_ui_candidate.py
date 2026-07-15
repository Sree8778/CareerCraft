"""
Candidate UI flows — Playwright end-to-end tests.
Requires: python tests/setup_session.py  (one-time manual login to capture session)
Run with: pytest tests/test_ui_candidate.py -v
"""

import re
import pytest
from playwright.sync_api import Page
from config import FRONTEND_URL, GEMINI_API_KEY

URL = FRONTEND_URL


# ── Helpers ────────────────────────────────────────────────────────────────────

def login_as_candidate(page: Page):
    """Navigate to candidate dashboard using pre-loaded session."""
    page.goto(f"{URL}/candidate/dashboard", wait_until="load")
    page.wait_for_timeout(1500)
    if "/candidate/" not in page.url and "/onboarding" not in page.url:
        pytest.skip(f"Not on candidate area after session load (at {page.url})")


def go(page: Page, path: str):
    page.goto(f"{URL}{path}", wait_until="load")
    page.wait_for_timeout(1000)


def assert_no_crash(page: Page, path: str):
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    go(page, path)
    assert page.title() != "", f"{path} — blank page"
    real_errors = [e for e in errors if "QUIC" not in e and "ERR_" not in e and "chunk" not in e.lower()]
    assert len(real_errors) == 0, f"JS errors on {path}: {real_errors}"


# ── Tests ──────────────────────────────────────────────────────────────────────

class TestCandidatePageLoads:
    """All candidate pages render without crashing."""

    PAGES = [
        "/candidate/dashboard",
        "/candidate/jobs",
        "/candidate/applications",
        "/candidate/resume-builder",
        "/candidate/messages",
        "/candidate/network",
        "/candidate/settings",
        "/candidate/interview",
        "/candidate/interview/practice",
    ]

    @pytest.mark.parametrize("path", PAGES)
    def test_page_loads(self, candidate_page: Page, path: str):
        login_as_candidate(candidate_page)
        assert_no_crash(candidate_page, path)
        print(f"  ✓ {path} loaded OK")


class TestCandidateDashboard:

    def test_dashboard_shows_stats(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        go(candidate_page, "/candidate/dashboard")
        cards = candidate_page.locator("text=/applications|interviews|profile|views/i")
        assert cards.count() >= 1, "No stat cards found on dashboard"

    def test_dashboard_no_hardcoded_mock_data(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        go(candidate_page, "/candidate/dashboard")
        content = candidate_page.content()
        BAD_STRINGS = ["Jane Doe", "john.doe@example", "mock_uid", "YOUR_NAME_HERE"]
        for bad in BAD_STRINGS:
            assert bad not in content, f"Hardcoded mock string '{bad}' found on dashboard"


class TestJobSearch:

    def test_jobs_page_loads_listings(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        go(candidate_page, "/candidate/jobs")
        # Wait extra for the jobs API fetch to complete
        candidate_page.wait_for_timeout(3000)
        # Jobs render as divs in a grid; empty state says "No jobs matched your query."
        has_jobs = candidate_page.locator("div.grid div[class*='rounded'], div.grid > div").count() > 0
        has_empty = candidate_page.locator("text=/no jobs|no results|nothing found|matched your query/i").count() > 0
        has_loading = candidate_page.locator("text=/loading|fetching/i").count() > 0
        assert has_jobs or has_empty or has_loading, "Jobs page rendered neither jobs, empty state, nor loading indicator"

    def test_job_search_input_works(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        go(candidate_page, "/candidate/jobs")
        search = candidate_page.get_by_placeholder(re.compile(r"search|find jobs|job title", re.I))
        if search.count() == 0:
            pytest.skip("No search input found")
        search.fill("Software Engineer")
        candidate_page.keyboard.press("Enter")
        candidate_page.wait_for_timeout(2000)
        assert "candidate/jobs" in candidate_page.url

    def test_job_detail_opens(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        go(candidate_page, "/candidate/jobs")
        first_job = candidate_page.locator("a[href*='/candidate/jobs/']").first
        if first_job.count() == 0:
            pytest.skip("No job links on jobs page")
        first_job.click()
        candidate_page.wait_for_load_state("networkidle")
        assert re.search(r"/candidate/jobs/\w+", candidate_page.url), f"Didn't navigate to job detail: {candidate_page.url}"

    def test_job_detail_shows_apply_button(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        go(candidate_page, "/candidate/jobs")
        first_job = candidate_page.locator("a[href*='/candidate/jobs/']").first
        if first_job.count() == 0:
            pytest.skip("No jobs available")
        first_job.click()
        candidate_page.wait_for_load_state("networkidle")
        apply_btn = candidate_page.get_by_role("button", name=re.compile(r"apply|quick apply", re.I))
        assert apply_btn.count() > 0, "No Apply button on job detail page"

    def test_tailor_resume_drawer_opens(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        go(candidate_page, "/candidate/jobs")
        first_job = candidate_page.locator("a[href*='/candidate/jobs/']").first
        if first_job.count() == 0:
            pytest.skip("No jobs available")
        first_job.click()
        candidate_page.wait_for_load_state("networkidle")
        tailor_btn = candidate_page.get_by_role("button", name=re.compile(r"tailor", re.I))
        if tailor_btn.count() == 0:
            pytest.skip("No Tailor Resume button (resume may not be set up)")
        tailor_btn.click()
        candidate_page.wait_for_timeout(1000)
        drawer = candidate_page.locator("[role='dialog'], .drawer, [data-testid='tailor-drawer']")
        panel = candidate_page.locator("text=/tailor|focused edit|full resume/i")
        assert drawer.count() > 0 or panel.count() > 0, "Tailor drawer did not open"


class TestResumeBuilder:

    def test_resume_builder_loads(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        assert_no_crash(candidate_page, "/candidate/resume-builder")

    def test_resume_sections_visible(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        go(candidate_page, "/candidate/resume-builder")
        sections = candidate_page.locator("text=/experience|education|skills|summary/i")
        assert sections.count() >= 3, "Resume builder missing expected sections"

    @pytest.mark.skipif(not GEMINI_API_KEY, reason="GEMINI_API_KEY not set")
    def test_ai_enhance_section(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        go(candidate_page, "/candidate/resume-builder")
        ai_btn = candidate_page.get_by_role("button", name=re.compile(r"ai rewrite|enhance|improve", re.I)).first
        if ai_btn.count() == 0:
            pytest.skip("No AI Rewrite button visible")
        ai_btn.click()
        candidate_page.wait_for_selector("text=/suggestion|enhanced|version|rewritten/i", timeout=20000)


class TestApplicationTracker:

    def test_applications_page_loads(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        assert_no_crash(candidate_page, "/candidate/applications")

    def test_applications_shows_status_pipeline(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        go(candidate_page, "/candidate/applications")
        pipeline = candidate_page.locator("text=/applied|screening|interview|offer/i")
        assert pipeline.count() >= 1, "No pipeline stages visible"


class TestCandidateSettings:

    def test_settings_page_loads(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        assert_no_crash(candidate_page, "/candidate/settings")

    def test_api_key_section_visible(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        # Navigate via sidebar link (client-side) so auth context persists — avoids the
        # full-page-reload race where settings redirects before Firebase IndexedDB loads
        settings_link = candidate_page.locator("a[href='/candidate/settings']")
        if settings_link.count() > 0:
            settings_link.first.click()
            candidate_page.wait_for_timeout(2000)
        else:
            go(candidate_page, "/candidate/settings")
            candidate_page.wait_for_timeout(2000)
        key_section = candidate_page.locator("text=/api key|gemini|openai|add key/i")
        assert key_section.count() >= 1, "API Key section not found in settings"

    @pytest.mark.skipif(not GEMINI_API_KEY, reason="GEMINI_API_KEY not set")
    def test_add_and_verify_gemini_key(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        go(candidate_page, "/candidate/settings")
        key_input = candidate_page.get_by_placeholder(re.compile(r"gemini.*key|api.*key|enter.*key", re.I)).first
        if key_input.count() == 0:
            pytest.skip("Could not find API key input")
        key_input.fill(GEMINI_API_KEY)
        verify_btn = candidate_page.get_by_role("button", name=re.compile(r"verify|add|save key", re.I)).first
        verify_btn.click()
        candidate_page.wait_for_selector("text=/valid|added|verified|success/i", timeout=15000)


class TestCandidateMessages:

    def test_messages_page_loads(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        assert_no_crash(candidate_page, "/candidate/messages")

    def test_messages_shows_chats_or_empty(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        go(candidate_page, "/candidate/messages")
        # "No active chats yet." OR "Select a Conversation" OR actual chat items
        has_chats = candidate_page.locator("button, a").filter(has_text=re.compile(r"recruiter|chat|message", re.I)).count() > 0
        has_empty = candidate_page.locator("text=/no active chats|select a conversation|no messages|chats yet/i").count() > 0
        assert has_chats or has_empty, "Messages page rendered neither chats nor empty state"


class TestInterviewFeature:

    def test_interview_page_loads(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        assert_no_crash(candidate_page, "/candidate/interview")

    def test_practice_interview_loads(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        assert_no_crash(candidate_page, "/candidate/interview/practice")

    def test_practice_interview_has_start_button(self, candidate_page: Page):
        login_as_candidate(candidate_page)
        go(candidate_page, "/candidate/interview/practice")
        start = candidate_page.get_by_role("button", name=re.compile(r"start|begin|practice", re.I))
        assert start.count() > 0, "No Start button on practice interview page"
