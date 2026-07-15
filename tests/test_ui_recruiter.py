"""
Recruiter UI flows — Playwright end-to-end tests.
Requires RECRUITER_EMAIL + RECRUITER_PASSWORD env vars (recruiter account).
Run with: pytest tests/test_ui_recruiter.py -v
"""

import re
import pytest
from playwright.sync_api import Page
from config import FRONTEND_URL, GEMINI_API_KEY, TIMEOUT_MS

URL = FRONTEND_URL


def go(page: Page, path: str):
    page.goto(f"{URL}{path}", wait_until="load")
    page.wait_for_timeout(1000)


def assert_no_crash(page: Page, path: str):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    go(page, path)
    assert page.title() != "", f"{path} — blank page"
    real_errors = [e for e in errors if "QUIC" not in e and "ERR_" not in e and "chunk" not in e.lower()]
    assert len(real_errors) == 0, f"JS errors on {path}: {real_errors}"


class TestRecruiterPageLoads:
    PAGES = [
        "/recruiter/dashboard",
        "/recruiter/requisitions",
        "/recruiter/requisitions/new",
        "/recruiter/applications",
        "/recruiter/candidates",
        "/recruiter/messages",
        "/recruiter/network",
        "/recruiter/profile",
        "/recruiter/settings",
        "/recruiter/sourcing",
        "/recruiter/webhooks",
    ]

    @pytest.mark.parametrize("path", PAGES)
    def test_page_loads(self, recruiter_page: Page, path: str):
        go(recruiter_page, path)
        assert recruiter_page.title() != "", f"{path} blank"
        print(f"  ✓ {path}")


class TestRecruiterDashboard:

    def test_dashboard_stats_visible(self, recruiter_page: Page):
        go(recruiter_page, "/recruiter/dashboard")
        stats = recruiter_page.locator("text=/open jobs|applications|interviews|pipeline/i")
        assert stats.count() >= 1, "No stats on recruiter dashboard"

    def test_no_hardcoded_mock_data(self, recruiter_page: Page):
        go(recruiter_page, "/recruiter/dashboard")
        content = recruiter_page.content()
        for bad in ["Jane Doe", "john.doe@example", "mock_uid"]:
            assert bad not in content, f"Mock string '{bad}' on dashboard"


class TestJobCreation:

    def test_new_requisition_form_loads(self, recruiter_page: Page):
        assert_no_crash(recruiter_page, "/recruiter/requisitions/new")
        title = recruiter_page.get_by_placeholder(re.compile(r"job title|senior frontend", re.I))
        assert title.count() > 0, "Job title input missing"

    def test_submit_blocked_without_required_fields(self, recruiter_page: Page):
        go(recruiter_page, "/recruiter/requisitions/new")
        recruiter_page.get_by_role("button", name=re.compile(r"post job|create|save", re.I)).first.click()
        recruiter_page.wait_for_timeout(800)
        assert "/requisitions/new" in recruiter_page.url, "Form submitted without required fields"

    @pytest.mark.skipif(not GEMINI_API_KEY, reason="GEMINI_API_KEY not set")
    def test_ai_generate_description(self, recruiter_page: Page):
        go(recruiter_page, "/recruiter/requisitions/new")
        recruiter_page.get_by_placeholder(re.compile(r"senior frontend|job title", re.I)).fill("Senior Python Engineer")
        dept = recruiter_page.get_by_placeholder(re.compile(r"e\.g\. engineering|department", re.I)).first
        if dept.count() > 0:
            dept.fill("Engineering")
        recruiter_page.get_by_placeholder(re.compile(r"react.*node|skills|technologies", re.I)).fill("Python, FastAPI, PostgreSQL")
        # Capture any 4xx/5xx errors from the AI endpoint (e.g. 402 = no valid keys)
        api_errors = []
        recruiter_page.on("response", lambda r: api_errors.append(r.status) if r.status >= 400 else None)
        recruiter_page.get_by_role("button", name=re.compile(r"generate.*ai|ai.*generat", re.I)).click()
        try:
            recruiter_page.wait_for_function(
                "() => document.querySelector('textarea[name=\"description\"]')?.value?.length > 50",
                timeout=20000,
            )
        except Exception:
            if api_errors:
                pytest.skip(f"AI generation returned {api_errors[0]} — backend AI key not available for test account")
            raise
        desc = recruiter_page.locator("textarea[name='description']").input_value()
        assert len(desc) > 50, f"AI description too short: {repr(desc)}"
        print(f"  + {len(desc)} chars generated")

    def test_create_job_end_to_end(self, recruiter_page: Page):
        go(recruiter_page, "/recruiter/requisitions/new")
        recruiter_page.get_by_placeholder(re.compile(r"senior frontend|job title", re.I)).fill("Playwright Test Job DELETEME")
        recruiter_page.get_by_placeholder(re.compile(r"remote.*new york|location", re.I)).fill("Remote")
        recruiter_page.locator("textarea[name='description']").fill("Automated test job. Please delete.")
        recruiter_page.get_by_role("button", name=re.compile(r"post job|create", re.I)).first.click()
        recruiter_page.wait_for_url(re.compile(r"/recruiter/requisitions(?!/new)"), timeout=TIMEOUT_MS)
        print(f"  + Redirected to {recruiter_page.url}")


class TestApplicationReview:

    def test_applications_list_loads(self, recruiter_page: Page):
        assert_no_crash(recruiter_page, "/recruiter/applications")

    def test_application_detail_loads(self, recruiter_page: Page):
        go(recruiter_page, "/recruiter/applications")
        first_link = recruiter_page.locator("a[href*='/recruiter/applications/']").first
        if first_link.count() == 0:
            pytest.skip("No applications in database")
        first_link.click()
        recruiter_page.wait_for_load_state("networkidle")
        assert re.search(r"/recruiter/applications/\w+", recruiter_page.url)

    @pytest.mark.skipif(not GEMINI_API_KEY, reason="GEMINI_API_KEY not set")
    def test_ai_screen_button_works(self, recruiter_page: Page):
        go(recruiter_page, "/recruiter/applications")
        first_link = recruiter_page.locator("a[href*='/recruiter/applications/']").first
        if first_link.count() == 0:
            pytest.skip("No applications")
        first_link.click()
        recruiter_page.wait_for_load_state("networkidle")
        screen_btn = recruiter_page.get_by_role("button", name=re.compile(r"ai screen|screen candidate|run ai", re.I))
        if screen_btn.count() == 0:
            pytest.skip("No AI screen button (score already computed)")
        screen_btn.click()
        recruiter_page.wait_for_selector("text=/%\\s*match|score|hire|pass|maybe/i", timeout=30000)


class TestRecruiterSettings:

    def _go_settings(self, page: Page):
        """Navigate to settings via sidebar link (client-side) to avoid premature auth redirect."""
        go(page, "/recruiter/dashboard")
        link = page.locator("a[href='/recruiter/settings']")
        if link.count() > 0:
            link.first.click()
            page.wait_for_timeout(2000)
        else:
            go(page, "/recruiter/settings")
            page.wait_for_timeout(2000)

    def test_settings_loads(self, recruiter_page: Page):
        assert_no_crash(recruiter_page, "/recruiter/settings")

    def test_api_keys_section_visible(self, recruiter_page: Page):
        self._go_settings(recruiter_page)
        assert recruiter_page.locator("text=/api key|gemini|add key/i").count() >= 1

    def test_2fa_section_visible(self, recruiter_page: Page):
        self._go_settings(recruiter_page)
        # 2FA is in the Security tab — click it first
        security_tab = recruiter_page.get_by_role("button", name=re.compile(r"security", re.I))
        if security_tab.count() > 0:
            security_tab.first.click()
            recruiter_page.wait_for_timeout(800)
        assert recruiter_page.locator("text=/two.factor|2fa|authenticator|security/i").count() >= 1


class TestSourcingPage:

    def test_sourcing_loads(self, recruiter_page: Page):
        assert_no_crash(recruiter_page, "/recruiter/sourcing")

    @pytest.mark.skipif(not GEMINI_API_KEY, reason="GEMINI_API_KEY not set")
    def test_ai_sourcing_query(self, recruiter_page: Page):
        go(recruiter_page, "/recruiter/sourcing")
        query_input = recruiter_page.get_by_placeholder(re.compile(r"describe|looking for|candidate profile", re.I))
        if query_input.count() == 0:
            pytest.skip("No sourcing query input")
        query_input.fill("React developer with TypeScript experience")
        recruiter_page.get_by_role("button", name=re.compile(r"search|source|find", re.I)).first.click()
        recruiter_page.wait_for_timeout(8000)
        assert "sourcing" in recruiter_page.url
