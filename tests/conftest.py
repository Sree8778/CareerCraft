"""
Shared Playwright fixtures. Logs in via the Firebase email/password modal.
Run all tests:  pytest tests/ -v
"""
import os
import time
import pytest
from pathlib import Path
from playwright.sync_api import sync_playwright, Browser, BrowserContext, Page
from config import HEADLESS, SLOW_MO_MS, TIMEOUT_MS, FRONTEND_URL

SESSION_DIR = Path(__file__).parent / "session"
SESSION_DIR.mkdir(exist_ok=True)

CANDIDATE_SESSION = SESSION_DIR / "candidate.json"
RECRUITER_SESSION = SESSION_DIR / "recruiter.json"

CANDIDATE_EMAIL    = os.getenv("CANDIDATE_EMAIL",    "testcandidate@careercraft.test")
CANDIDATE_PASSWORD = os.getenv("CANDIDATE_PASSWORD", "TestCandidate@1")
RECRUITER_EMAIL    = os.getenv("RECRUITER_EMAIL",    "testrecruiter@careercraft.test")
RECRUITER_PASSWORD = os.getenv("RECRUITER_PASSWORD", "TestRecruiter@1")


# ── Browser ────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def browser_instance():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS, slow_mo=SLOW_MO_MS)
        yield browser
        browser.close()


def _new_context(browser: Browser, storage_file: Path) -> BrowserContext:
    kwargs = dict(viewport={"width": 1280, "height": 800}, ignore_https_errors=True)
    if storage_file.exists():
        kwargs["storage_state"] = str(storage_file)
    ctx = browser.new_context(**kwargs)
    ctx.set_default_timeout(TIMEOUT_MS)
    return ctx


# ── Login helper ───────────────────────────────────────────────────────────────

def _login_via_modal(page: Page, email: str, password: str, expected_path: str, session_file: Path):
    """Sign in via the Navbar Login button, then navigate directly to the dashboard."""
    # Navigate to /signup — Login button is always in the Navbar here
    page.goto(f"{FRONTEND_URL}/signup")
    page.wait_for_load_state("networkidle")

    # Click Navbar 'Login' button — opens LoginModal in login mode
    page.get_by_role("button", name="Login").click()
    page.wait_for_timeout(800)

    # Fill Email + Password and submit
    page.get_by_placeholder("Email Address").fill(email)
    page.get_by_placeholder("Password").fill(password)
    page.get_by_role("button", name="Log In").click()

    # Firebase auth completes in background (no redirect from /signup page).
    # Wait for Firebase to process, then navigate directly to dashboard.
    page.wait_for_timeout(5000)

    # Navigate to expected dashboard with 'load' (networkidle can time out on API-heavy pages)
    page.goto(f"{FRONTEND_URL}{expected_path}", wait_until="load", timeout=20000)
    page.wait_for_timeout(2000)

    # Verify we landed on an authenticated page (not kicked back to / or /signup)
    if expected_path.split("/")[1] not in page.url:
        raise RuntimeError(f"Login failed — ended up at {page.url} after navigating to {expected_path}")

    # Save session
    page.context.storage_state(path=str(session_file))


def _is_session_fresh(session_file: Path, max_age_hours: int = 1) -> bool:
    """Return True if the session file exists and is less than max_age_hours old."""
    if not session_file.exists():
        return False
    age = time.time() - session_file.stat().st_mtime
    return age < max_age_hours * 3600


# ── Candidate fixtures ─────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def candidate_context(browser_instance: Browser):
    # Always log in fresh — Firebase auth is in IndexedDB, which storage_state doesn't capture
    ctx = _new_context(browser_instance, Path("/nonexistent"))
    p = ctx.new_page()
    p.on("console", lambda m: None)
    try:
        _login_via_modal(p, CANDIDATE_EMAIL, CANDIDATE_PASSWORD, "/candidate/dashboard", CANDIDATE_SESSION)
    except Exception as e:
        p.close()
        ctx.close()
        pytest.skip(f"Candidate login failed: {e}")
    p.close()
    yield ctx
    ctx.close()


@pytest.fixture(scope="function")
def candidate_page(candidate_context: BrowserContext):
    p = candidate_context.new_page()
    p.on("console", lambda msg: print(f"  [browser.{msg.type}] {msg.text}") if msg.type == "error" else None)
    yield p
    p.close()


# ── Recruiter fixtures ─────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def recruiter_context(browser_instance: Browser):
    if not RECRUITER_EMAIL or not RECRUITER_PASSWORD:
        pytest.skip("Recruiter credentials not set (RECRUITER_EMAIL / RECRUITER_PASSWORD env vars)")
    # Always log in fresh — Firebase auth is in IndexedDB, which storage_state doesn't capture
    ctx = _new_context(browser_instance, Path("/nonexistent"))
    p = ctx.new_page()
    try:
        _login_via_modal(p, RECRUITER_EMAIL, RECRUITER_PASSWORD, "/recruiter/dashboard", RECRUITER_SESSION)
    except Exception as e:
        p.close()
        ctx.close()
        pytest.skip(f"Recruiter login failed: {e}")
    p.close()
    yield ctx
    ctx.close()


@pytest.fixture(scope="function")
def recruiter_page(recruiter_context: BrowserContext):
    p = recruiter_context.new_page()
    p.on("console", lambda msg: print(f"  [browser.{msg.type}] {msg.text}") if msg.type == "error" else None)
    yield p
    p.close()


# ── Generic (unauthenticated) ──────────────────────────────────────────────────

@pytest.fixture(scope="session")
def browser_ctx(browser_instance: Browser):
    ctx = _new_context(browser_instance, Path("/nonexistent"))
    yield ctx
    ctx.close()


@pytest.fixture(scope="function")
def page(browser_ctx: BrowserContext):
    p = browser_ctx.new_page()
    p.on("console", lambda msg: print(f"  [browser.{msg.type}] {msg.text}") if msg.type == "error" else None)
    yield p
    p.close()


def pytest_configure(config):
    config.addinivalue_line("markers", "asyncio: mark test as async")
