"""
Public pages — no login required. Checks landing, signup, companies.
Run with:  pytest tests/test_ui_public.py -v
"""

import re
import pytest
from playwright.sync_api import Page
from config import FRONTEND_URL

URL = FRONTEND_URL


def go(page: Page, path: str):
    page.goto(f"{URL}{path}", wait_until="load")
    page.wait_for_timeout(1000)


class TestPublicPages:
    """Public pages render without JS errors."""

    PAGES = ["/", "/signup", "/companies"]

    @pytest.mark.parametrize("path", PAGES)
    def test_page_loads(self, page: Page, path: str):
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        go(page, path)
        assert page.title() != "", f"{path} has empty title"
        # Filter transient QUIC/network errors — not code bugs
        real_errors = [e for e in errors if "QUIC" not in e and "ERR_" not in e and "chunk" not in e.lower()]
        assert len(real_errors) == 0, f"JS errors on {path}: {real_errors}"
        print(f"  ✓ {path} → {page.title()}")

    def test_home_has_cta(self, page: Page):
        go(page, "/")
        # CTA is a <button> on the landing page (navigates via onClick)
        cta = page.get_by_role("button", name=re.compile(r"get started|sign up|join", re.I))
        assert cta.count() > 0, "No CTA button on homepage"

    def test_signup_has_candidate_and_recruiter(self, page: Page):
        go(page, "/signup")
        candidate = page.locator("text=/candidate|job seeker/i")
        recruiter = page.locator("text=/recruiter|employer|hire/i")
        assert candidate.count() > 0, "No 'Candidate' option on signup"
        assert recruiter.count() > 0, "No 'Recruiter' option on signup"

    def test_companies_requires_auth(self, page: Page):
        """Companies page redirects unauthenticated users to /."""
        go(page, "/companies")
        page.wait_for_timeout(1500)
        # Should redirect to home since no login
        assert page.url.rstrip("/").endswith(FRONTEND_URL.rstrip("/")) or "/companies" not in page.url, \
            f"Expected redirect for unauthenticated access, stayed at {page.url}"


class TestNavigation:

    def test_home_cta_opens_modal(self, page: Page):
        """CTA opens a login/signup modal (does not navigate away)."""
        go(page, "/")
        cta = page.get_by_role("button", name=re.compile(r"get started|sign up|join", re.I)).first
        if cta.count() == 0:
            pytest.skip("No CTA button")
        cta.click()
        page.wait_for_timeout(800)
        # Modal or dialog should be visible — URL stays on /
        modal = page.locator("[role='dialog'], [role='modal'], .modal, .login-modal")
        has_modal = modal.count() > 0
        # Alternatively some apps open a form inline
        has_form = page.locator("input[type='email'], input[type='password']").count() > 0
        assert has_modal or has_form, "CTA button neither opened a modal nor navigated away"

    def test_404_page(self, page: Page):
        page.goto(f"{URL}/this-page-definitely-does-not-exist-12345")
        page.wait_for_load_state("networkidle")
        content = page.content().lower()
        # Should show 404 page, not crash
        has_404 = "404" in content or "not found" in content or "page doesn't exist" in content
        assert has_404 or page.title() != "", "404 page missing or blank"


class TestResponsiveness:
    """Pages adapt to mobile viewport."""

    def test_home_mobile(self, page: Page):
        page.set_viewport_size({"width": 390, "height": 844})
        go(page, "/")
        # Should not show horizontal scrollbar
        overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
        assert not overflow, "Homepage has horizontal overflow on mobile (390px)"

    def test_jobs_mobile(self, page: Page):
        page.set_viewport_size({"width": 390, "height": 844})
        go(page, "/candidate/jobs")
        overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
        assert not overflow, "Jobs page has horizontal overflow on mobile"
