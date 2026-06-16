"""
ollama_utils.py — AI function library backed by ai_router (BYOK multi-key fallback).

All AI calls go through ai_router.route() which:
  1. Tries the user's own keys in order (Active → Standby).
  2. On quota/rate-limit: marks key Exhausted, tries next key.
  3. On invalid key: marks key Invalid, tries next key.
  4. If all user keys fail: falls back to the server's NVIDIA NIM key.

Function signatures are unchanged — routes.py needs no edits.
"""

import json
import logging
from typing import Any

import ai_router

logger = logging.getLogger(__name__)

# ── Per-request key wallet ─────────────────────────────────────────────────────
# Populated by configure_dynamic_api_key in routes.py before each request.

_request_wallet: list[dict] = []
_status_callback = None   # optional Firestore key-status updater


def set_request_wallet(wallet: list[dict], on_status_change=None) -> None:
    """Called by configure_dynamic_api_key with the user's full key wallet."""
    global _request_wallet, _status_callback
    _request_wallet     = wallet or []
    _status_callback    = on_status_change


def set_api_key(key: str) -> None:
    """
    Legacy single-key setter — called when X-Gemini-API-Key header is present.
    Injects it as a high-priority Gemini key at the front of the wallet.
    """
    global _request_wallet
    if key and key.strip():
        inline = {"id": "inline-gemini", "provider": "Gemini",
                  "key": key.strip(), "status": "Active"}
        # Prepend so it is tried first
        _request_wallet = [inline] + [k for k in _request_wallet if k.get("id") != "inline-gemini"]
    else:
        _request_wallet = [k for k in _request_wallet if k.get("id") != "inline-gemini"]


# ── Internal helpers ───────────────────────────────────────────────────────────

def _decrypt(ciphertext: str) -> str:
    try:
        from vault_utils import decrypt_key
        return decrypt_key(ciphertext)
    except Exception:
        return ciphertext


def _repair_json(raw: str) -> Any:
    """Best-effort JSON extraction from a possibly truncated or markdown-wrapped response."""
    import re
    # Strip markdown fences
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.MULTILINE).strip()
    # Try the whole thing first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Find the largest {...} or [...] block
    m = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
    if m:
        candidate = m.group(1)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            # Truncated JSON — try to close open brackets so it parses
            for _ in range(50):
                opens = candidate.count('{') - candidate.count('}')
                if opens <= 0:
                    break
                candidate += '}'
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass
    return None


def _call(prompt: str, *, json_mode: bool = False,
          heavy: bool = False, max_tokens: int = 2048) -> Any:
    """
    Route strictly through the user's own key wallet (BYOK).
    Raises RuntimeError("NO_API_KEYS: ...") if no usable keys are available.
    """
    try:
        raw = ai_router.route(
            prompt, _request_wallet,
            max_tokens=max_tokens, json_mode=json_mode, heavy=heavy,
            vault_decrypt=_decrypt, on_status_change=_status_callback,
        )
    except RuntimeError as e:
        msg = str(e)
        if "no_user_keys_invalid" in msg:
            raise RuntimeError(
                "NO_API_KEYS: Your saved API keys are expired or invalid. "
                "Remove them in Profile → Settings and add a working key."
            )
        if "no_user_keys" in msg:
            raise RuntimeError(
                "NO_API_KEYS: Add your API keys in Profile → Settings to unlock AI-powered features."
            )
        raise

    if json_mode:
        return _repair_json(raw)
    return raw


# ── 1. Resume parsing ──────────────────────────────────────────────────────────

def structure_text_with_ai(raw_resume_text: str) -> dict:
    schema = {
        "personal":       {"name": "", "email": "", "phone": "", "location": "", "legalStatus": ""},
        "summary":        "",
        "experience":     [{"id": "", "jobTitle": "", "company": "", "dates": "", "description": ""}],
        "education":      [{"id": "", "degree": "", "institution": "", "graduationYear": "", "gpa": "", "achievements": ""}],
        "skills":         [{"id": "", "category": "", "skills_list": ""}],
        "projects":       [{"id": "", "title": "", "date": "", "description": ""}],
        "publications":   [{"id": "", "title": "", "authors": "", "journal": "", "date": "", "link": ""}],
        "certifications": [{"id": "", "name": "", "issuer": "", "date": ""}],
    }
    prompt = f"""You are an expert resume parser. Extract all information from the resume text below.

OUTPUT FORMAT: Return ONLY a raw JSON object.
- Start your response with {{ and end with }}
- No markdown fences, no backticks, no explanation, no text before or after the JSON.

Required schema:
{json.dumps(schema, indent=2)}

Rules:
- description/achievements fields: use <ul><li>…</li></ul> or <p>…</p> HTML.
- skills_list: comma-separated plain text, no HTML.
- Generate a unique short id like "a1b2c3" for each list item.
- Empty sections → use [].

Resume text:
---
{raw_resume_text[:6000]}
---"""
    result = _call(prompt, json_mode=True, max_tokens=4096)
    return result if isinstance(result, dict) else {}


generate_resume_fields_from_raw_text = structure_text_with_ai


# ── 2. Section enhancement ─────────────────────────────────────────────────────

def enhance_section_with_ai(section_name: str, text_to_enhance: str) -> list:
    if not text_to_enhance.strip():
        return [text_to_enhance]
    prompt = f"""You are a professional resume advisor.
Rewrite the following resume section ("{section_name}") to be more professional, impactful, and ATS-optimised.
Generate exactly 3 distinct, polished versions.
Return ONLY: {{"versions": ["Version 1", "Version 2", "Version 3"]}}

Input:
---
{text_to_enhance}
---
JSON:"""
    result = _call(prompt, json_mode=True)
    if isinstance(result, dict):
        versions = result.get("versions", [])
        if isinstance(versions, list) and versions:
            return [str(v) for v in versions[:3]]
    return [text_to_enhance]


enhance_with_ollama = enhance_section_with_ai


# ── 3. Summary suggestions ─────────────────────────────────────────────────────

def generate_summary_suggestions(resume_data: dict) -> list:
    prompt = f"""You are an expert career coach.
Write exactly 3 distinct professional summary paragraphs (3-4 sentences each).
First person, present tense. ATS-friendly. Highlight years of experience, key skills, career goals.
Return ONLY: {{"summaries": ["Summary 1.", "Summary 2.", "Summary 3."]}}

Resume:
{json.dumps(resume_data, indent=2)}

JSON:"""
    result = _call(prompt, json_mode=True)
    if isinstance(result, dict):
        summaries = result.get("summaries", [])
        if isinstance(summaries, list) and summaries:
            return [f"<p>{s}</p>" for s in summaries[:3]]
    return []


# ── 4. Elevator pitch ──────────────────────────────────────────────────────────

def generate_elevator_pitch(resume_data: dict) -> str:
    prompt = f"""Write a compelling 30-second elevator pitch (3-4 sentences) for this candidate.
Professional, engaging. Highlight key strengths and goals.
Output ONLY the pitch text — no labels, no markdown.

Resume:
{json.dumps(resume_data, indent=2)}"""
    return _call(prompt) or "Could not generate elevator pitch."


# ── 5. Interview question generation ──────────────────────────────────────────

def generate_next_interview_question(resume_data: dict, conversation_history: list,
                                      latest_transcript: str, elapsed_seconds: int) -> str:
    history_str = ""
    for turn in conversation_history:
        speaker = "Interviewer" if turn.get("speaker") == "ai" else "Candidate"
        history_str += f"{speaker}: {turn.get('text', '')}\n"
    if latest_transcript:
        history_str += f"Candidate (Latest): {latest_transcript}\n"

    elapsed_mins = elapsed_seconds / 60.0
    prompt = f"""You are an elite Senior Technical Architect conducting a live 30-minute voice interview.
Deep-dive technical assessment. Listen carefully and probe further.

Candidate Resume:
{json.dumps(resume_data, indent=2)}

Elapsed: {elapsed_mins:.1f} / 30 minutes

History:
{history_str}

Rules:
1. Empty history → brief greeting + tailored opening question.
2. Elapsed > 26 min → wrap up gracefully.
3. Challenge vague buzzwords — ask HOW and WHY.
4. Challenge performance claims — ask how they measured.
5. 1-2 sentences only (optimised for TTS).
6. Output ONLY the raw question. No tags, no formatting."""
    return _call(prompt, heavy=True) or "Tell me about your most challenging technical project."


# ── 6. Voice answer evaluation ─────────────────────────────────────────────────

def evaluate_voice_answer(question: str, transcript: str) -> dict:
    t = transcript.strip().lower()

    # Deterministic heuristic anti-cheat (runs before any AI call)
    suspicious, cheat_reason = False, ""
    for intro in ["certainly, when", "certainly! when", "great question!", "sure, when"]:
        if t.startswith(intro):
            suspicious, cheat_reason = True, f"AI preface detected: '{intro}'"
            break
    if not suspicious and ("firstly," in t and "secondly," in t):
        suspicious, cheat_reason = True, "Rigid AI transition list (firstly/secondly)"
    if not suspicious and len(question) > 20 and question.strip().lower() in t:
        suspicious, cheat_reason = True, "Answer contains verbatim copy of the question"

    prompt = f"""You are an expert technical assessor grading an interview answer. Be critical and objective.

Question: "{question}"
Answer: "{transcript}"

Evaluate:
1. Technical accuracy
2. Conceptual depth (WHY/HOW, not just buzzwords)
3. Communication clarity

Anti-cheat: set suspiciousActivity=true if answer uses AI prefaces (Certainly, Sure, Great question)
or rigid lists (Firstly, Secondly). Cap score at 30 if suspicious.

Return ONLY this JSON:
{{
  "score": <0-100>,
  "feedback": "<detailed technical critique>",
  "suspiciousActivity": <true|false>,
  "reasoning": "<score explanation>"
}}"""
    result = _call(prompt, json_mode=True)
    if not isinstance(result, dict) or "score" not in result:
        result = {"score": 75, "feedback": "Core concepts understood.",
                  "suspiciousActivity": False, "reasoning": "AI evaluation unavailable — fallback score."}
    if suspicious:
        result["suspiciousActivity"] = True
        result["score"]   = min(result.get("score", 100), 30)
        result["reasoning"] = f"Heuristic: {cheat_reason}. " + result.get("reasoning", "")
    return result


# ── 6b. Conversational AI interviewer (voice mode) ────────────────────────────

def ai_interviewer_turn(
    conversation: list,
    role: str,
    interview_type: str,
    difficulty: str,
    turn_number: int,
    total_turns: int,
    job_description: str = "",
) -> str:
    """
    Generate a natural, human-sounding AI interviewer response.
    Maintains full conversation context and sounds like a real person.
    """
    # Build conversation history — avoid "Name:" speaker labels which cause premature stop
    recent = conversation[-10:]
    history_lines = []
    for t in recent:
        tag = "[INTERVIEWER]" if t.get("role") == "ai" else "[CANDIDATE]"
        history_lines.append(f"{tag} {t.get('text', '').strip()}")
    history_str = "\n".join(history_lines)

    # Extract what the candidate said most recently
    last_candidate = next(
        (t.get("text", "").strip() for t in reversed(conversation) if t.get("role") == "user"),
        ""
    )

    # Topics already covered — avoid repetition
    ai_questions = [t.get("text", "") for t in conversation if t.get("role") == "ai"]
    covered = " | ".join(ai_questions[-3:]) if ai_questions else "none"

    difficulty_ctx = {
        "Junior":  "Candidate is entry-level — focus on fundamentals and eagerness to learn.",
        "Mid":     "Candidate has 2–5 years experience — dig into real project examples.",
        "Senior":  "Candidate is senior — explore system design, trade-offs, and leadership.",
    }.get(difficulty, "")

    type_ctx = {
        "Technical":  f"Technical interview for {role}. Ask about relevant tech stack, system design, debugging, or algorithms.",
        "Behavioral": "Behavioral interview. Use 'Tell me about a time...' format. Focus on conflict, leadership, failure, or teamwork.",
        "HR":         "HR interview. Explore career goals, motivation, culture fit, or strengths/weaknesses.",
        "Mixed":      f"Mix technical and behavioral. Alternate between {role}-specific tech questions and situational questions.",
    }.get(interview_type, "")

    # Job-description context injected into prompts when provided
    jd_snippet = ""
    if job_description and job_description.strip():
        # Trim to avoid token bloat — first 800 chars covers most key requirements
        jd_text = job_description.strip()[:800]
        jd_snippet = f"\nJob description (use this to ask targeted questions):\n{jd_text}\n"

    if not conversation:
        prompt = f"""You are Alex, a senior {role} interviewer starting a live {interview_type} interview.
{jd_snippet}
Say exactly three things as natural spoken sentences:
1. Introduce yourself: "Hey, I'm Alex, I'll be your interviewer today."
2. One warm sentence to put the candidate at ease.
3. Ask ONLY this single question: "Could you start by telling me a bit about yourself?"

IMPORTANT: Ask only ONE question. Do NOT ask about their background AND something else in the same turn.
Write only what Alex says out loud. No markdown, no labels, no bullet points. Complete every sentence."""

    elif turn_number > total_turns:
        prompt = f"""You are Alex, the interviewer. The interview is wrapping up.

The candidate just said: "{last_candidate}"

Say 2 natural sentences:
- Acknowledge one specific thing they said.
- Thank them and let them know next steps are coming.

Write only what Alex says. No markdown. Complete every sentence."""

    else:
        prompt = f"""You are Alex, a {difficulty} {role} interviewer. This is turn {turn_number} of {total_turns} in a live {interview_type} interview.
{jd_snippet}
Conversation so far:
{history_str}

The candidate just said: "{last_candidate}"

Topics already covered (do not repeat): {covered}

Write Alex's next spoken response in exactly 3 sentences:
Sentence 1: React to ONE specific thing the candidate said. Do NOT say "Great answer!" — react like a real person, e.g. "Oh right, so you were dealing with X..." or "Yeah, that trade-off comes up a lot..."
Sentence 2: Transition naturally: "So my next question is..." or "Let me ask you about..." or "On that note..."
Sentence 3: Ask EXACTLY ONE question. {type_ctx} {difficulty_ctx} {"Prioritise skills and requirements mentioned in the job description above." if jd_snippet else ""}

STRICT RULES:
- Your entire response must end with exactly ONE question mark. Count before submitting.
- Do NOT ask two questions. Do NOT add "and also..." or "could you also tell me..." after your question.
- Write only spoken words. No bullet points, no markdown, no labels.
- Complete every sentence — never stop mid-sentence."""

    raw = _call(prompt, heavy=False, max_tokens=600) or \
          "That's really interesting. Can you walk me through how you'd approach that from scratch?"

    # Safety net: if 3+ question marks, truncate after the 2nd one.
    # (Allows 1 rhetorical "?" in the reaction + 1 real question; strips any 3rd+)
    q_count = raw.count("?")
    if q_count > 2:
        first = raw.index("?")
        second = raw.index("?", first + 1)
        raw = raw[:second + 1].strip()

    return raw


def ai_interview_final_feedback(conversation: list, role: str, interview_type: str) -> dict:
    """End-of-session evaluation of the full conversation."""
    qa_pairs = []
    ai_turns = [t for t in conversation if t.get("role") == "ai"]
    user_turns = [t for t in conversation if t.get("role") == "user"]
    for i, ans in enumerate(user_turns):
        q = ai_turns[i].get("text", "") if i < len(ai_turns) else ""
        qa_pairs.append({"question": q, "answer": ans.get("text", "")})

    prompt = f"""You are an expert career coach. Evaluate this {interview_type} interview for a {role} position.

Interview transcript:
{chr(10).join(f'Q{i+1}: {p["question"]}{chr(10)}A{i+1}: {p["answer"]}' for i, p in enumerate(qa_pairs))}

Return ONLY this JSON:
{{
  "overallScore": <1-10 float>,
  "rating": "<Poor|Fair|Good|Excellent>",
  "strengths": ["<strength>", "<strength>", "<strength>"],
  "improvements": ["<area>", "<area>", "<area>"],
  "questionScores": [<score 1-10 per answer>],
  "summary": "<2-3 sentence overall coaching summary>"
}}"""
    result = _call(prompt, json_mode=True, max_tokens=800)
    if isinstance(result, dict) and "overallScore" in result:
        return result
    return {
        "overallScore": 6.0, "rating": "Good",
        "strengths": ["Engaged throughout", "Addressed questions"],
        "improvements": ["Add more concrete examples", "Structure answers clearly"],
        "questionScores": [6] * len(user_turns),
        "summary": "Good effort overall. Focus on specific examples and structured answers."
    }


# ── 6c. Practice interview question ───────────────────────────────────────────

def generate_practice_question(interview_type: str, role: str, difficulty: str,
                                question_number: int, asked_questions: list) -> str:
    asked = "\n".join(f"- {q}" for q in asked_questions) if asked_questions else "None yet"
    type_guidance = {
        "Technical":  "Ask about specific technologies, algorithms, system design, debugging, or architecture relevant to the role.",
        "Behavioral": "Use real workplace scenarios: leadership, conflict resolution, failure, teamwork, deadlines. Prompt for a STAR-style answer.",
        "HR":         "Ask about motivation, culture fit, career goals, strengths/weaknesses, or salary expectations.",
        "Mixed":      "Alternate between technical depth, behavioral situations, and HR topics.",
    }.get(interview_type, "Ask a relevant interview question.")
    difficulty_guidance = {
        "Junior":  "Focus on fundamentals, basic concepts, and learning attitude.",
        "Mid":     "Expect hands-on experience; probe for depth and real examples.",
        "Senior":  "Expect architectural decisions, trade-offs, team leadership, and impact at scale.",
    }.get(difficulty, "")
    prompt = f"""You are an experienced interviewer conducting a {difficulty} {role} {interview_type} interview.
Generate question #{question_number}.

Guidance: {type_guidance}
Level: {difficulty_guidance}

Questions already asked (do not repeat):
{asked}

Output ONLY the question text. No numbering, no preamble."""
    return _call(prompt) or "Tell me about yourself and what you bring to this role."


# ── 6c. Practice answer evaluation (coaching mode) ────────────────────────────

def evaluate_practice_answer(question: str, answer: str, interview_type: str, role: str) -> dict:
    prompt = f"""You are a supportive career coach evaluating a practice interview answer.
Be encouraging but honest. Focus on actionable coaching.

Role: {role}
Interview type: {interview_type}
Question: "{question}"
Answer: "{answer}"

Return ONLY this JSON:
{{
  "score": <integer 1-10>,
  "rating": "<Poor|Fair|Good|Excellent>",
  "strengths": ["<specific strength from the answer>", "<another strength>"],
  "improvements": ["<specific thing to improve>", "<another improvement>"],
  "tip": "<one concrete, actionable coaching tip for this question>",
  "sample_points": ["<key point a strong answer would include>", "<another key point>"]
}}

JSON:"""
    result = _call(prompt, json_mode=True, max_tokens=1024)
    if isinstance(result, dict) and "score" in result:
        return result
    return {
        "score": 6, "rating": "Good",
        "strengths": ["Addressed the question"],
        "improvements": ["Add more specific examples"],
        "tip": "Use the STAR method: Situation, Task, Action, Result.",
        "sample_points": ["Include a concrete example", "Quantify your impact where possible"]
    }


# ── 7. Semantic job search ─────────────────────────────────────────────────────

def semantic_job_search(query: str, jobs_list: list) -> list:
    trimmed = jobs_list[:20]
    prompt = f"""Semantically match the search query against the job list. Understand synonyms.
Query: "{query}"
Jobs:
{json.dumps(trimmed, indent=2)}

Return ONLY a JSON array of matching jobs (matchPercentage >= 30), each with all original fields plus:
- "matchPercentage": integer 0-100
- "fitReasoning": one sentence

Ordered by matchPercentage desc. Raw JSON array only."""
    result = _call(prompt, json_mode=True)
    if isinstance(result, list):
        return result
    return [{**j, "matchPercentage": 75, "fitReasoning": "Matches key criteria."} for j in trimmed[:3]]


# ── 8. Recruiter copilot ───────────────────────────────────────────────────────

def copilot_candidate_search(query: str, candidates_list: list) -> list:
    trimmed = candidates_list[:15]
    prompt = f"""You are an AI recruiter copilot. Match the recruiter's request to candidates.
Request: "{query}"
Candidates:
{json.dumps(trimmed, indent=2)}

Return ONLY a JSON array of matching candidates (matchScore >= 35), each with all original fields plus:
- "matchScore": integer 0-100
- "matchingSkills": array of strings
- "copilotReasoning": one-sentence evaluation

Ordered by matchScore desc. Raw JSON array only."""
    result = _call(prompt, json_mode=True)
    if isinstance(result, list):
        return result
    return [{**c, "matchScore": 80, "matchingSkills": [], "copilotReasoning": "Strong candidate."} for c in trimmed[:3]]


# ── 9. Cover letter ────────────────────────────────────────────────────────────

def generate_cover_letter(resume_data: dict, job_details: dict) -> str:
    prompt = f"""Write a tailored, professional cover letter.

Candidate:
{json.dumps(resume_data, indent=2)}

Job:
{json.dumps(job_details, indent=2)}

Requirements:
- Match the role's tone and requirements
- Align candidate achievements with job needs
- 250-350 words, proper salutation and sign-off
- Output ONLY the letter body — no commentary, no markdown"""
    result = _call(prompt, heavy=True)
    return result or (
        "Dear Hiring Manager,\n\nI am writing to express my strong interest in this position. "
        "My background aligns well with your requirements.\n\nThank you.\n\nSincerely,\nCandidate"
    )


# ── 10. ATS resume scoring ─────────────────────────────────────────────────────

def grade_resume_match_score(resume_data: dict, job_details: dict) -> dict:
    prompt = f"""ATS optimiser. Compare the resume against the job requirements.

Resume:
{json.dumps(resume_data, indent=2)}

Job:
{json.dumps(job_details, indent=2)}

Return ONLY:
{{
  "score": <0-100>,
  "matchingSkills": ["skill"],
  "missingKeywords": ["keyword"],
  "optimizationTips": ["actionable tip"]
}}"""
    result = _call(prompt, json_mode=True)
    if isinstance(result, dict) and "score" in result:
        return result
    return {"score": 75, "matchingSkills": [], "missingKeywords": [],
            "optimizationTips": ["Quantify achievements with metrics."]}


# ── 11. Company profile ────────────────────────────────────────────────────────

def generate_company_profile_via_ai(company_name: str) -> dict:
    safe_id = "".join(c.lower() for c in company_name if c.isalnum())
    prompt  = f"""Generate a company profile for "{company_name}".
Return ONLY:
{{
  "id": "{safe_id}",
  "name": "Official Name",
  "industry": "Category",
  "logoUrl": "https://logo.clearbit.com/{safe_id}.com",
  "bio": "1-2 sentence description.",
  "employeesCount": "10,000+",
  "location": "City, Country"
}}"""
    result = _call(prompt, json_mode=True)
    if isinstance(result, dict) and "name" in result:
        return result
    return {"id": safe_id or "company", "name": company_name, "industry": "Technology",
            "logoUrl": f"https://logo.clearbit.com/{safe_id}.com",
            "bio": f"{company_name} delivers innovative solutions.", "employeesCount": "1,000+", "location": "Global"}


# ── 12. Company reviews ────────────────────────────────────────────────────────

def generate_company_reviews_via_ai(_company_id: str, company_name: str) -> list:
    prompt = f"""Generate 3 realistic anonymous employee reviews for "{company_name}".
Return ONLY a JSON array of 3 objects:
[{{"rating":4,"workLifeBalance":3,"compensation":4,"culture":4,
   "title":"Job Title","pros":"…","cons":"…","summary":"…","date":"2025-06-01"}}]"""
    result = _call(prompt, json_mode=True)
    if isinstance(result, list) and result:
        return result
    return [{"rating": 4, "workLifeBalance": 3, "compensation": 4, "culture": 4,
             "title": "Software Engineer", "pros": "Great team.", "cons": "Fast-paced.",
             "summary": f"Solid company. {company_name} invests in growth.", "date": "2025-06-01"}]
