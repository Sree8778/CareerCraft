"""
Hybrid autonomous job application engine.

Priority:
  1. browser-use Agent (LLM-driven, handles any ATS) — uses user's Gemini key
  2. ATS-specific Playwright handlers (Greenhouse, Lever, Ashby, Workable)
  3. Generic Playwright heuristics (label matching)
"""
import asyncio
import os
import re
import tempfile

# On Cloud Run (K_SERVICE is set), run headless; locally show the browser
_ON_CLOUD_RUN = bool(os.environ.get('K_SERVICE'))
HEADLESS = _ON_CLOUD_RUN

# ── Optional: browser-use (AI-controlled browser) ─────────────────────────────
try:
    from browser_use import Agent as BrowserAgent
    from langchain_google_genai import ChatGoogleGenerativeAI
    BROWSER_USE_AVAILABLE = True
except Exception:
    BROWSER_USE_AVAILABLE = False

# ── Optional: Playwright (heuristic fallback) ──────────────────────────────────
try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except Exception:
    PLAYWRIGHT_AVAILABLE = False


# ── ATS detection ──────────────────────────────────────────────────────────────

def detect_ats(url: str) -> str:
    u = url.lower()
    if 'greenhouse.io' in u:        return 'greenhouse'
    if 'lever.co' in u:             return 'lever'
    if 'ashbyhq.com' in u:          return 'ashby'
    if 'workable.com' in u:         return 'workable'
    if 'myworkdayjobs.com' in u:    return 'workday'
    if 'smartrecruiters.com' in u:  return 'smartrecruiters'
    if 'bamboohr.com' in u:         return 'bamboohr'
    if 'jobvite.com' in u:          return 'jobvite'
    if 'taleo.net' in u:            return 'taleo'
    if 'icims.com' in u:            return 'icims'
    if 'rippling.com' in u:         return 'rippling'
    if 'indeed.com' in u:           return 'indeed'
    return 'generic'


# ── Playwright helpers ─────────────────────────────────────────────────────────

async def _try_fill(page, selectors: list, value: str) -> bool:
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if await loc.count() > 0 and await loc.is_visible():
                await loc.click(timeout=3000)
                await loc.fill(value, timeout=3000)
                return True
        except Exception:
            pass
    return False


async def _fill_by_label(page, labels: list, value: str) -> bool:
    for label in labels:
        for method in ('exact', 'contains'):
            try:
                pat = re.compile(label, re.IGNORECASE)
                loc = page.get_by_label(pat).first
                if await loc.count() > 0 and await loc.is_visible():
                    tag = await loc.evaluate('el => el.tagName.toLowerCase()')
                    if tag in ('input', 'textarea'):
                        await loc.click(timeout=3000)
                        await loc.fill(value, timeout=3000)
                        return True
            except Exception:
                pass
        # placeholder fallback
        try:
            loc = page.locator(
                f'input[placeholder*="{label}" i], textarea[placeholder*="{label}" i]'
            ).first
            if await loc.count() > 0:
                await loc.fill(value, timeout=3000)
                return True
        except Exception:
            pass
    return False


async def _click_apply_btn(page) -> bool:
    for sel in [
        'button:has-text("Apply Now")', 'a:has-text("Apply Now")',
        'button:has-text("Apply for this job")', 'a:has-text("Apply for this job")',
        'button:has-text("Apply for this position")',
        '[data-qa="btn-apply"]', '.apply-button', '#apply-button',
        'a[href*="/apply"]', 'button:has-text("Apply")', 'a:has-text("Apply")',
    ]:
        try:
            btn = page.locator(sel).first
            if await btn.count() > 0 and await btn.is_visible():
                await btn.click(timeout=5000)
                await page.wait_for_load_state('domcontentloaded', timeout=10000)
                return True
        except Exception:
            pass
    return False


async def _upload_resume(page, pdf_path: str) -> bool:
    try:
        inputs = page.locator('input[type="file"]')
        n = await inputs.count()
        for i in range(n):
            fi = inputs.nth(i)
            try:
                accept = (await fi.get_attribute('accept') or '').lower()
                if 'image' in accept and 'pdf' not in accept:
                    continue
                await fi.set_input_files(pdf_path)
                return True
            except Exception:
                pass
    except Exception:
        pass
    return False


async def _submit_form(page) -> bool:
    for sel in [
        'button[type="submit"]', 'input[type="submit"]',
        'button:has-text("Submit Application")', 'button:has-text("Submit")',
        'button:has-text("Send Application")', 'button:has-text("Apply Now")',
        'button:has-text("Apply")',
    ]:
        try:
            btn = page.locator(sel).first
            if await btn.count() > 0 and await btn.is_visible():
                await btn.click(timeout=5000)
                await page.wait_for_timeout(3000)
                return True
        except Exception:
            pass
    return False


# ── ATS-specific Playwright handlers ──────────────────────────────────────────

async def _fill_greenhouse(page, personal: dict, cover_letter: str, pdf_path: str) -> int:
    name = personal.get('name', '')
    parts = name.split()
    first, last = (parts[0] if parts else ''), (' '.join(parts[1:]) if len(parts) > 1 else '')
    filled = 0
    if await _try_fill(page, ['#first_name', '[name="job_application[first_name]"]'], first): filled += 1
    if await _try_fill(page, ['#last_name',  '[name="job_application[last_name]"]'],  last):  filled += 1
    if await _try_fill(page, ['#email',       '[name="job_application[email]"]'],  personal.get('email', '')): filled += 1
    if await _try_fill(page, ['#phone',       '[name="job_application[phone]"]'],  personal.get('phone', '')): filled += 1
    if cover_letter:
        if await _try_fill(page, ['#cover_letter_text', 'textarea[name*="cover"]'], cover_letter): filled += 1
    if pdf_path and await _upload_resume(page, pdf_path): filled += 1
    if personal.get('linkedin'):
        await _try_fill(page, ['[name*="linkedin" i]', '[id*="linkedin" i]'], personal['linkedin'])
    return filled


async def _fill_lever(page, personal: dict, cover_letter: str, pdf_path: str) -> int:
    filled = 0
    if await _try_fill(page, ['[name="name"]', '#name', 'input[placeholder*="Name" i]'], personal.get('name', '')): filled += 1
    if await _try_fill(page, ['[name="email"]', '#email'], personal.get('email', '')): filled += 1
    if await _try_fill(page, ['[name="phone"]', '#phone'], personal.get('phone', '')): filled += 1
    if cover_letter:
        if await _try_fill(page, ['[name="comments"]', 'textarea[placeholder*="cover" i]', 'textarea'], cover_letter): filled += 1
    if pdf_path and await _upload_resume(page, pdf_path): filled += 1
    if personal.get('linkedin'):
        await _try_fill(page, ['[name="urls[LinkedIn]"]', '[placeholder*="linkedin" i]'], personal['linkedin'])
    return filled


async def _fill_generic(page, personal: dict, cover_letter: str, pdf_path: str) -> int:
    name = personal.get('name', '')
    parts = name.split()
    first = parts[0] if parts else ''
    last  = ' '.join(parts[1:]) if len(parts) > 1 else ''
    filled = 0

    if await _fill_by_label(page, ['First Name', 'First', 'Given Name'], first): filled += 1
    if await _fill_by_label(page, ['Last Name', 'Last', 'Surname', 'Family Name'], last): filled += 1
    if not (first and last):
        if await _fill_by_label(page, ['Full Name', 'Name', 'Your Name'], name): filled += 1
    if await _fill_by_label(page, ['Email', 'Email Address', 'E-mail'], personal.get('email', '')): filled += 1
    if await _fill_by_label(page, ['Phone', 'Phone Number', 'Mobile', 'Telephone', 'Cell'], personal.get('phone', '')): filled += 1
    if personal.get('location'):
        if await _fill_by_label(page, ['Location', 'City', 'Current Location', 'City, State'], personal['location']): filled += 1
    if cover_letter:
        if await _fill_by_label(page, ['Cover Letter', 'Cover letter', 'Message', 'Additional Information', 'Why do you'], cover_letter): filled += 1
    if pdf_path and await _upload_resume(page, pdf_path): filled += 1
    if personal.get('linkedin'):
        await _fill_by_label(page, ['LinkedIn', 'LinkedIn URL', 'LinkedIn Profile'], personal['linkedin'])
    return filled


# ── Playwright heuristic apply ─────────────────────────────────────────────────

async def _playwright_apply(job_url: str, resume_data: dict, cover_letter: str, pdf_path: str) -> dict:
    if not PLAYWRIGHT_AVAILABLE:
        return {'success': False, 'method': 'playwright', 'message': 'Playwright not installed'}

    personal = resume_data.get('personal', {})
    try:
        async with async_playwright() as pw:
            launch_args = ['--no-sandbox', '--disable-setuid-sandbox',
                           '--disable-dev-shm-usage', '--disable-gpu',
                           '--window-size=1280,900']
            browser = await pw.chromium.launch(
                headless=HEADLESS,
                args=launch_args if HEADLESS else [],
            )
            ctx = await browser.new_context(
                viewport={'width': 1280, 'height': 900},
                user_agent=(
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                    'AppleWebKit/537.36 (KHTML, like Gecko) '
                    'Chrome/120.0.0.0 Safari/537.36'
                ),
            )
            page = await ctx.new_page()
            try:
                await page.goto(job_url, wait_until='domcontentloaded', timeout=30000)
                await page.wait_for_timeout(1500)
                await _click_apply_btn(page)
                await page.wait_for_timeout(1500)

                ats = detect_ats(page.url)
                if ats == 'greenhouse':
                    filled = await _fill_greenhouse(page, personal, cover_letter, pdf_path)
                elif ats == 'lever':
                    filled = await _fill_lever(page, personal, cover_letter, pdf_path)
                else:
                    filled = await _fill_generic(page, personal, cover_letter, pdf_path)

                submitted = await _submit_form(page)
                return {
                    'success': submitted,
                    'method':  'playwright',
                    'ats':     ats,
                    'message': (
                        f'Playwright: submitted via {ats} ({filled} fields filled)'
                        if submitted else
                        f'Playwright: filled {filled} fields, could not auto-submit'
                    ),
                }
            finally:
                await browser.close()
    except Exception as e:
        return {'success': False, 'method': 'playwright', 'message': f'Playwright error: {str(e)[:200]}'}


# ── browser-use Agent apply (primary) ─────────────────────────────────────────

async def _browser_use_apply(job_url: str, resume_data: dict, cover_letter: str,
                              pdf_path: str, gemini_key: str) -> dict:
    if not BROWSER_USE_AVAILABLE:
        return {'success': False, 'method': 'browser-use', 'message': 'browser-use not installed'}
    if not gemini_key:
        return {'success': False, 'method': 'browser-use', 'message': 'No Gemini key available'}

    personal = resume_data.get('personal', {})
    name     = personal.get('name', '')
    email    = personal.get('email', '')
    phone    = personal.get('phone', '')
    location = personal.get('location', '')
    linkedin = personal.get('linkedin', '')

    skills_text = '; '.join(
        f"{s.get('category', '')}: {s.get('skills_list', '')}"
        for s in resume_data.get('skills', [])[:3]
    )

    task = f"""
Navigate to {job_url} and complete the job application form with these details:

Personal Info:
- Full Name: {name}
- Email: {email}
- Phone: {phone}
- Location: {location}
- LinkedIn: {linkedin}

Key Skills: {skills_text}

Cover Letter (paste into cover letter / message field if present):
{cover_letter[:800] if cover_letter else 'Please see attached resume for my qualifications.'}

Instructions:
1. If you are on a job listing page (not yet on the application form), click the Apply or Apply Now button first.
2. Fill in all visible text fields (name, email, phone, location, etc.) with the information above.
3. If there is a cover letter, message, or "additional information" textarea, paste the cover letter text.
4. If there is a file upload field for a resume, {'upload the file at: ' + pdf_path if pdf_path else 'skip the file upload'}.
5. Click Submit / Apply to submit the form.
6. Confirm the application was submitted successfully (look for a confirmation message).
7. Return a brief summary of what you did and whether the application was submitted.
"""
    try:
        llm = ChatGoogleGenerativeAI(
            model='gemini-1.5-flash',
            google_api_key=gemini_key,
            temperature=0,
        )
        # Pass headless config if the installed browser-use version supports it
        try:
            from browser_use import Browser as _BUBrowser, BrowserConfig as _BUCfg
            _bu_browser = _BUBrowser(config=_BUCfg(headless=HEADLESS))
            agent = BrowserAgent(task=task, llm=llm, browser=_bu_browser)
        except ImportError:
            try:
                from browser_use.browser.browser import Browser as _BUBrowser, BrowserConfig as _BUCfg
                _bu_browser = _BUBrowser(config=_BUCfg(headless=HEADLESS))
                agent = BrowserAgent(task=task, llm=llm, browser=_bu_browser)
            except Exception:
                agent = BrowserAgent(task=task, llm=llm)
        result = await agent.run()
        result_text = str(result)[:600]
        # Heuristic: if result mentions success/submitted/confirmation → success
        success_keywords = ['submitted', 'success', 'confirmation', 'thank you', 'applied']
        success = any(kw in result_text.lower() for kw in success_keywords)
        return {
            'success': success,
            'method':  'browser-use',
            'message': f'browser-use Agent: {result_text}',
        }
    except Exception as e:
        return {'success': False, 'method': 'browser-use', 'message': f'browser-use error: {str(e)[:300]}'}


# ── Public entry point ─────────────────────────────────────────────────────────

async def apply_to_job_async(
    job_url: str,
    resume_data: dict,
    cover_letter: str = '',
    pdf_bytes: bytes = None,
    gemini_key: str = '',
) -> dict:
    """
    Attempt to autonomously apply to a job.
    Tries browser-use first (AI-driven), falls back to Playwright heuristics.
    """
    if not job_url:
        return {'success': False, 'message': 'No job URL provided'}

    # Write PDF to temp file if provided
    pdf_tmp = None
    if pdf_bytes:
        try:
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
                f.write(pdf_bytes)
                pdf_tmp = f.name
        except Exception:
            pass

    try:
        # 1. Try browser-use (AI agent)
        if BROWSER_USE_AVAILABLE and gemini_key:
            result = await _browser_use_apply(job_url, resume_data, cover_letter, pdf_tmp, gemini_key)
            if result.get('success'):
                return result
            print(f'browser-use failed, falling back: {result.get("message", "")}')

        # 2. Playwright heuristic fallback
        if PLAYWRIGHT_AVAILABLE:
            return await _playwright_apply(job_url, resume_data, cover_letter, pdf_tmp)

        return {'success': False, 'message': 'No automation engine available (install playwright or browser-use)'}

    finally:
        if pdf_tmp:
            try:
                os.unlink(pdf_tmp)
            except Exception:
                pass


def apply_to_job(
    job_url: str,
    resume_data: dict,
    cover_letter: str = '',
    pdf_bytes: bytes = None,
    gemini_key: str = '',
) -> dict:
    """Synchronous wrapper — safe to call from background threads."""
    try:
        return asyncio.run(apply_to_job_async(job_url, resume_data, cover_letter, pdf_bytes, gemini_key))
    except Exception as e:
        return {'success': False, 'message': str(e)[:300]}
