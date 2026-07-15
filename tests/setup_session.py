"""
One-time session capture — run this once, log in manually in the browser window,
then all Playwright tests will reuse your saved session automatically.

Usage:
  python tests/setup_session.py
  # A browser window opens → log in → close the window
  # Session saved to tests/session/candidate.json and recruiter.json
"""

import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

FRONTEND = os.getenv(
    "CAREERCRAFT_FRONTEND",
    "https://careercraft-frontend-u7h4zjepfq-uc.a.run.app",
)

SESSION_DIR = Path(__file__).parent / "session"
SESSION_DIR.mkdir(exist_ok=True)


def capture_session(role: str, instructions: str) -> str:
    out_file = str(SESSION_DIR / f"{role}.json")
    print(f"\n{'='*60}")
    print(f"  Capturing {role.upper()} session")
    print(f"{'='*60}")
    print(instructions)
    print("\nA browser window will open. Log in, then navigate to your dashboard.")
    print("Once you see the dashboard, CLOSE THE BROWSER WINDOW to save the session.")
    input("\nPress ENTER to open the browser...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=100)
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        page.goto(FRONTEND)

        print(f"\n[Browser open] Log in as {role} and navigate to your dashboard.")
        print("Then CLOSE the browser tab/window (NOT this terminal).")

        # Wait until the browser context closes (user closes window)
        try:
            page.wait_for_event("close", timeout=300_000)  # 5 min timeout
        except Exception:
            pass

        # Save storage state (localStorage + cookies = Firebase auth token)
        ctx.storage_state(path=out_file)
        browser.close()

    print(f"\n✓ Session saved: {out_file}")
    return out_file


def main():
    print("\nCareerCraft — Session Setup")
    print("This captures your logged-in browser state for automated tests.")

    # Candidate session
    capture_session(
        "candidate",
        "  → Log in as a CANDIDATE account\n"
        "  → Navigate to: /candidate/dashboard\n"
        "  → Wait until the dashboard fully loads"
    )

    # Ask if they want to capture recruiter session too
    ans = input("\nCapture a RECRUITER session too? (y/n): ").strip().lower()
    if ans == "y":
        capture_session(
            "recruiter",
            "  → Log in as a RECRUITER account\n"
            "  → Navigate to: /recruiter/dashboard\n"
            "  → Wait until the dashboard fully loads"
        )
    else:
        print("Skipping recruiter session — recruiter tests will be skipped.")

    print("\n✓ Setup complete! Now run the full test suite:")
    print("   .\\tests\\run_tests.ps1")


if __name__ == "__main__":
    main()
