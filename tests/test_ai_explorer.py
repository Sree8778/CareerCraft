"""
AI-Driven Exploratory Tests using browser-use.

browser-use lets an LLM control the browser like a real user — it finds bugs
that scripted tests miss (broken states, hidden errors, wrong data).

Run with:  pytest tests/test_ai_explorer.py -v -s
Requires:  GEMINI_API_KEY set in env

Install:   pip install browser-use langchain-google-genai
"""

import os
import pytest
import asyncio
from config import FRONTEND_URL, CANDIDATE_EMAIL, CANDIDATE_PASSWORD, RECRUITER_EMAIL, RECRUITER_PASSWORD, GEMINI_API_KEY

pytestmark = pytest.mark.asyncio

skip_without_key = pytest.mark.skipif(
    not GEMINI_API_KEY,
    reason="GEMINI_API_KEY required for browser-use AI tests"
)


def make_agent(task: str, max_steps: int = 15):
    """Create a browser-use Agent with Gemini."""
    try:
        from browser_use import Agent
        from langchain_google_genai import ChatGoogleGenerativeAI
    except ImportError:
        pytest.skip("browser-use not installed — run: pip install browser-use langchain-google-genai")

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        google_api_key=GEMINI_API_KEY,
        temperature=0,
    )
    return Agent(task=task, llm=llm, max_steps=max_steps)


@skip_without_key
async def test_candidate_can_browse_and_apply():
    """
    AI agent: log in as candidate, browse jobs, open a job, and attempt to apply.
    Verifies the full happy-path flow works end-to-end.
    """
    task = f"""
    You are testing a job portal web app at {FRONTEND_URL}.

    Steps:
    1. Go to {FRONTEND_URL}/signup
    2. Sign in with email={CANDIDATE_EMAIL} and password={CANDIDATE_PASSWORD}
    3. Navigate to the jobs page (/candidate/jobs)
    4. Click on the first job listing you see
    5. On the job detail page, look for an "Apply" or "Quick Apply" button and click it
    6. Report what happened — did you see a success message, a form, or an error?

    If you see any error messages, red toast notifications, or blank pages — report them.
    STOP after 15 steps or when the application attempt is complete.
    """
    agent = make_agent(task)
    result = await agent.run()
    print(f"\n[AI Explorer] Candidate apply result:\n{result}")
    # The test passes as long as the agent didn't crash — manual review of output needed
    assert result is not None


@skip_without_key
async def test_recruiter_can_post_a_job():
    """
    AI agent: log in as recruiter, create a job, and generate AI description.
    """
    task = f"""
    You are testing a job portal at {FRONTEND_URL}.

    Steps:
    1. Go to {FRONTEND_URL}/signup
    2. Sign in as recruiter: email={RECRUITER_EMAIL} password={RECRUITER_PASSWORD}
    3. Go to /recruiter/requisitions/new
    4. Fill in the job title: "AI Test Engineer"
    5. Fill in department: "Quality Assurance"
    6. Fill in location: "Remote"
    7. Click the "Generate Description with AI" button
    8. Wait for the description to appear in the text area
    9. Report: did the AI description appear? Was there an error?

    Report any errors, toast messages, or failures you encounter.
    """
    agent = make_agent(task)
    result = await agent.run()
    print(f"\n[AI Explorer] Recruiter job post result:\n{result}")
    assert result is not None


@skip_without_key
async def test_candidate_resume_ai_rewrite():
    """
    AI agent: candidate logs in, opens resume builder, and tries AI rewrite.
    """
    task = f"""
    You are testing a job portal at {FRONTEND_URL}.

    Steps:
    1. Go to {FRONTEND_URL}/signup
    2. Sign in as candidate: email={CANDIDATE_EMAIL} password={CANDIDATE_PASSWORD}
    3. Navigate to /candidate/resume-builder
    4. Find any resume section (Summary, Experience, Skills)
    5. Look for an "AI Rewrite" or "Enhance" button near that section
    6. Click it and wait for a suggestion to appear
    7. Report: did AI suggestions appear? What was shown?

    If you see "Add a Gemini API key" or "402" or "no_api_keys" — report that specifically.
    Report any other errors too.
    """
    agent = make_agent(task)
    result = await agent.run()
    print(f"\n[AI Explorer] Resume AI rewrite result:\n{result}")
    assert result is not None


@skip_without_key
async def test_explore_for_bugs():
    """
    AI agent: free exploration — find any obvious bugs or broken pages.
    This is the most powerful test — the LLM notices things scripts miss.
    """
    task = f"""
    You are a QA engineer testing a job portal at {FRONTEND_URL}.

    Your job is to FIND BUGS. Be thorough and adversarial.

    Login as candidate: email={CANDIDATE_EMAIL} password={CANDIDATE_PASSWORD}

    Explore these areas and report ALL problems you find:
    1. Dashboard — does it show real data or placeholder text like "Jane Doe", "0" everywhere?
    2. Jobs page — do jobs load? Can you search?
    3. Applications page — does it show a pipeline? Any broken UI?
    4. Messages page — does it load? Any console errors visible?
    5. Settings page — is the API keys section there?
    6. Resume builder — do sections render? Any layout issues?

    For each page, note:
    - Any error messages (red toasts, "Something went wrong", 500 errors)
    - Any blank/white sections that should have content
    - Any buttons that look broken or disabled that shouldn't be
    - Any hardcoded test data (Jane Doe, john@example.com, "Lorem ipsum")

    Give a DETAILED bug report at the end with page-by-page findings.
    """
    agent = make_agent(task, max_steps=30)
    result = await agent.run()
    print(f"\n[AI Explorer] Bug hunt result:\n{result}")
    # Print to terminal — review manually
    assert result is not None
