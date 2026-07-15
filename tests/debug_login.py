"""Quick debug script to test the login flow with new test credentials."""
import os
from playwright.sync_api import sync_playwright

FRONTEND_URL = os.getenv("CAREERCRAFT_FRONTEND", "https://careercraft-frontend-u7h4zjepfq-uc.a.run.app")
EMAIL = "testcandidate@careercraft.test"
PASSWORD = "TestCandidate@1"
EXPECTED_PATH = "/candidate/dashboard"

console_messages = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 800}, ignore_https_errors=True)
    ctx.set_default_timeout(30000)
    page = ctx.new_page()

    page.on("console", lambda msg: console_messages.append(f"[{msg.type}] {msg.text}"))

    print(f"\n1. Navigating to {FRONTEND_URL}/signup ...")
    page.goto(f"{FRONTEND_URL}/signup", wait_until="load")
    page.wait_for_timeout(2000)
    print(f"   URL: {page.url}")

    # Click Navbar Login button
    login_btn = page.get_by_role("button", name="Login")
    print(f"\n2. 'Login' button count: {login_btn.count()}")
    login_btn.first.click()
    page.wait_for_timeout(800)

    # Fill credentials
    print(f"\n3. Filling credentials for {EMAIL}...")
    page.get_by_placeholder("Email Address").fill(EMAIL)
    page.get_by_placeholder("Password").fill(PASSWORD)
    page.get_by_role("button", name="Log In").click()

    # Wait for Firebase auth
    print("   Waiting 5s for Firebase auth to complete...")
    page.wait_for_timeout(5000)
    print(f"   URL after submit: {page.url}")

    # Navigate directly to dashboard using 'load' not 'networkidle'
    print(f"\n4. Navigating to {EXPECTED_PATH}...")
    try:
        page.goto(f"{FRONTEND_URL}{EXPECTED_PATH}", wait_until="load", timeout=20000)
        page.wait_for_timeout(2000)
        print(f"   Final URL: {page.url}")
        print(f"   Title: {page.title()}")

        if EXPECTED_PATH in page.url:
            print("\n[OK] Login SUCCESS! Saving session...")
            ctx.storage_state(path="session/candidate.json")
            print("   Session saved to session/candidate.json")
        else:
            print(f"\n[FAIL] Not on dashboard (at {page.url})")
    except Exception as e:
        print(f"   Navigation error: {e}")
        print(f"   URL at error: {page.url}")

    # Show auth errors
    print(f"\nRelevant console messages:")
    for msg in console_messages[-20:]:
        if any(k in msg.lower() for k in ["error", "auth", "firebase", "invalid", "fail", "warn", "token"]):
            print(f"  {msg}")

    browser.close()

print("\nDone.")
