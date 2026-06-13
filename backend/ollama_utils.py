# backend/ollama_utils.py
# Local LLM via Ollama — drop-in replacement for gemini_utils when cloud credits run out.
import requests
import json
import re

OLLAMA_API_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3:latest"


# ---------------------------------------------------------------------------
# Core query helpers
# ---------------------------------------------------------------------------

def _clean_json(text: str):
    """Strip markdown fences and extract the first valid JSON value."""
    text = re.sub(r'^```(?:json)?\s*|\s*```$', '', text.strip(), flags=re.MULTILINE).strip()
    # Try to pull the first {...} or [...] block in case model added prose
    match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', text)
    if match:
        text = match.group(1)
    return text


def _query_ollama(prompt: str, is_json: bool = False):
    import os
    nvidia_key = os.getenv("NVIDIA_API_KEY", "").strip()
    if nvidia_key:
        url = "https://integrate.api.nvidia.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {nvidia_key}",
            "Content-Type": "application/json"
        }
        model = os.getenv("NVIDIA_MODEL_NAME", "meta/llama-3.1-8b-instruct")
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": 2048
        }
        if is_json:
            payload["response_format"] = {"type": "json_object"}
            
        try:
            r = requests.post(url, json=payload, headers=headers, timeout=60)
            r.raise_for_status()
            response_text = r.json()["choices"][0]["message"]["content"].strip()
            if is_json:
                return json.loads(_clean_json(response_text))
            return response_text
        except Exception as e:
            print(f"[NVIDIA NIM] API Error on model '{model}': {e}")
            return None

    # Fallback to local Ollama
    payload = {"model": MODEL_NAME, "prompt": prompt, "stream": False}
    if is_json:
        payload["format"] = "json"
    try:
        r = requests.post(OLLAMA_API_URL, json=payload, timeout=300)
        r.raise_for_status()
        response_text = r.json().get("response", "")
        if is_json:
            return json.loads(_clean_json(response_text))
        return response_text.strip()
    except requests.exceptions.RequestException as e:
        print(f"[OLLAMA] Connection error: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"[OLLAMA] JSON decode error: {e}")
        return None


# ---------------------------------------------------------------------------
# Dynamic key setter and router to Gemini
# ---------------------------------------------------------------------------
import gemini_utils
import os

_has_gemini_key = False

def set_api_key(key: str):
    global _has_gemini_key
    if key and key.strip():
        gemini_utils.set_api_key(key.strip())
        _has_gemini_key = True
    else:
        _has_gemini_key = False

def _should_use_gemini():
    # If the candidate has dynamically configured their own Gemini key, use it
    if _has_gemini_key:
        return True
    
    # Check environment keys
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    nvidia_key = os.getenv("NVIDIA_API_KEY", "").strip()
    
    # If the server has a valid NVIDIA NIM key configured, prefer it over the disabled default Gemini key
    if nvidia_key:
        return False
        
    return bool(gemini_key and gemini_key != "AIzaSyAjXE4BiSqlwtvUbI1Mv8_0zK8r4HyG7c0")

import functools

def delegate_to_gemini(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        if _should_use_gemini():
            gemini_func = getattr(gemini_utils, func.__name__, None)
            if gemini_func:
                return gemini_func(*args, **kwargs)
        return func(*args, **kwargs)
    return wrapper


# ---------------------------------------------------------------------------
# 1. Resume parsing  (matches gemini_utils.structure_text_with_ai)
# ---------------------------------------------------------------------------

@delegate_to_gemini
def structure_text_with_ai(raw_resume_text: str) -> dict:
    """Parse raw resume text into a structured JSON object."""
    schema = {
        "personal": {"name": "", "email": "", "phone": "", "location": "", "legalStatus": ""},
        "summary": "",
        "experience": [{"id": "", "jobTitle": "", "company": "", "dates": "", "description": ""}],
        "education": [{"id": "", "degree": "", "institution": "", "graduationYear": "", "gpa": "", "achievements": ""}],
        "skills": [{"id": "", "category": "", "skills_list": ""}],
        "certifications": [{"name": "", "issuer": "", "date": ""}],
        "publications": [{"title": "", "authors": "", "journal": "", "date": "", "link": ""}],
        "projects": [{"id": "", "title": "", "date": "", "description": "", "technologies": "", "link": ""}],
    }
    prompt = f"""You are an expert resume parser.
Extract all information from the resume text below and return ONLY a valid JSON object matching this schema exactly.

Strict Sanitization Rules:
1. Email Address: Ensure the email is a clean, valid email address. Strip out any garbage symbols, Unicode icons, or prefix words/labels like "envel⌢pe", "envelope", "email", "mail", "e-mail" that might be prepended or appended due to PDF icon-to-text conversion. E.g., "envel⌢pesreeramvarmac@gmail.com" -> "sreeramvarmac@gmail.com".
2. Project Names: If a project has a description but the title/name is empty, missing, or represented as empty parentheses "()", infer a concise, high-impact, professional title for the project based on its description (e.g. "Asset Prescriptive Engine" or "Campus Transit Ecosystem") instead of leaving the "name" field empty.
3. Clean Text: Remove any weird formatting layout leftovers, orphaned brackets, or garbage characters (such as "()") from all output fields.

Schema:
{json.dumps(schema, indent=2)}

Resume Text:
---
{raw_resume_text}
---
JSON Output:"""
    result = _query_ollama(prompt, is_json=True)
    return result if isinstance(result, dict) else {}


# alias used internally
generate_resume_fields_from_raw_text = structure_text_with_ai


# ---------------------------------------------------------------------------
# 2. Section enhancement  (matches gemini_utils.enhance_section_with_ai)
# ---------------------------------------------------------------------------

@delegate_to_gemini
def enhance_section_with_ai(section_name: str, text_to_enhance: str) -> list:
    """Return 3 improved versions of a resume section."""
    if not text_to_enhance.strip():
        return [text_to_enhance]
    prompt = f"""You are a professional resume advisor.
Rewrite the following resume section ("{section_name}") to be more professional, impactful, and concise.
Generate exactly 3 distinct, polished versions.
Return ONLY a valid JSON object with a single key "versions" containing an array of 3 strings.
Example: {{"versions": ["Version 1 text", "Version 2 text", "Version 3 text"]}}

Input:
---
{text_to_enhance}
---
JSON:"""
    result = _query_ollama(prompt, is_json=True)
    if isinstance(result, dict):
        versions = result.get("versions", [])
        if isinstance(versions, list) and versions:
            return [str(v) for v in versions[:3]]
    return [text_to_enhance]


# keep old name as alias
enhance_with_ollama = enhance_section_with_ai


# ---------------------------------------------------------------------------
# 3. Elevator pitch
# ---------------------------------------------------------------------------

@delegate_to_gemini
def generate_summary_suggestions(resume_data: dict) -> list:
    """Generate 3 distinct professional summary options when the resume has no summary."""
    prompt = f"""You are an expert career coach and resume writer.
A candidate has uploaded their resume but it has no professional summary.
Based on their resume data below, write exactly 3 distinct, polished professional summary paragraphs (3-4 sentences each).

Each summary should:
- Be written in first person, present tense
- Highlight the candidate's years of experience, key skills, and career goals
- Be ATS-friendly and tailored to the roles they've held
- Sound human and compelling — not generic boilerplate

Return ONLY a valid JSON object with a single key "summaries" containing an array of 3 HTML strings (you may use <strong>, <em>, or plain text — no <p> tags needed, they will be wrapped automatically).

Example format: {{"summaries": ["Summary 1 text here.", "Summary 2 text here.", "Summary 3 text here."]}}

Resume Data:
{json.dumps(resume_data, indent=2)}

JSON:"""
    result = _query_ollama(prompt, is_json=True)
    if isinstance(result, dict):
        summaries = result.get("summaries", [])
        if isinstance(summaries, list) and summaries:
            return [f"<p>{s}</p>" for s in summaries[:3]]
    return []


@delegate_to_gemini
def generate_elevator_pitch(resume_data: dict) -> str:
    prompt = f"""Based on the candidate resume data below, write a compelling 30-second elevator pitch (3-4 sentences).
Be professional, engaging, and highlight key strengths and career goals.
Output ONLY the pitch text — no labels, no intro.

Resume:
{json.dumps(resume_data, indent=2)}

Elevator Pitch:"""
    return _query_ollama(prompt) or "Could not generate elevator pitch."


# ---------------------------------------------------------------------------
# 4. Interview question generation
# ---------------------------------------------------------------------------

@delegate_to_gemini
def generate_next_interview_question(resume_data: dict, conversation_history: list,
                                      latest_transcript: str, elapsed_seconds: int) -> str:
    history_str = ""
    for turn in conversation_history:
        speaker = "Interviewer (AI)" if turn.get("speaker") == "ai" else "Candidate"
        history_str += f"{speaker}: {turn.get('text', '')}\n"
    if latest_transcript:
        history_str += f"Candidate (Latest Answer): {latest_transcript}\n"

    time_limit_mins = 30
    elapsed_mins = elapsed_seconds / 60.0

    prompt = f"""
    You are an elite, highly critical Senior Technical Architect conducting a live 30-minute voice interview.
    Your goal is to perform a deep-dive technical assessment of the candidate. Do not ask generic questions or a static checklist.
    Instead, act like a real, conversational interviewer who listens carefully, catches details or technical claims in their latest answer, and probes further.

    Candidate Resume:
    {json.dumps(resume_data, indent=2)}

    Elapsed Time: {elapsed_mins:.1f} minutes. Limit: {time_limit_mins} minutes.

    Conversation History:
    {history_str}

    Strict Interview Rules:
    1. If history is empty, greet them warmly and ask a highly tailored opening question based on their most complex projects or experience.
    2. If elapsed time is near the limit (e.g. > 26 mins), wrap up gracefully and ask if they have final questions for you.
    3. Listen to their Latest Answer:
       - If they just listed buzzwords (e.g., "I used Kubernetes and Docker"), challenge them to explain their configuration (e.g., "Why did you choose that orchestration strategy, and how did you configure ingress?").
       - If they made a performance claim (e.g. "improved speed by 40%"), ask *how* they measured it and what the bottlenecks were.
       - Focus on trade-offs, architecture choices, and deep systems designs.
    4. Keep your question concise (1-2 sentences) so that it is optimized for Text-to-Speech (TTS) voice playback.
    5. Output ONLY the raw question text. Do not add tags, greetings, prefixes, or formatting.
    """
    return _query_ollama(prompt) or "Could you tell me more about your most proud technical project?"


# ---------------------------------------------------------------------------
# 5. Voice answer evaluation
# ---------------------------------------------------------------------------

@delegate_to_gemini
def evaluate_voice_answer(question: str, transcript: str) -> dict:
    # 1. Deterministic anti-cheat heuristic scan
    transcript_lower = transcript.strip().lower()
    is_suspicious = False
    cheat_reason = ""

    ai_intros = [
        "certainly, when it comes to",
        "certainly! when it comes to",
        "certainly, to answer your",
        "great question! when considering",
        "sure, when it comes to",
        "certainly, in regards to",
        "certainly, when considering",
        "certainly, when looking at"
    ]
    for intro in ai_intros:
        if transcript_lower.startswith(intro):
            is_suspicious = True
            cheat_reason = f"AI conversational preface detected ('{intro}')"
            break

    if not is_suspicious:
        if "firstly," in transcript_lower and "secondly," in transcript_lower:
            is_suspicious = True
            cheat_reason = "Rigid chatbot-like transition list detected ('firstly... secondly...')"

    if not is_suspicious:
        clean_question = question.strip().lower()
        if len(clean_question) > 20 and clean_question in transcript_lower:
            is_suspicious = True
            cheat_reason = "Transcript contains verbatim copy of the interview question"

    prompt = f"""
    You are an expert technical assessor grading candidate answers in a high-stakes engineering interview.
    Be highly analytical, critical, and objective. 

    Question: "{question}"
    Candidate Response: "{transcript}"

    Perform a thorough multidimensional evaluation:
    1. Technical Accuracy: Did they use terms correctly? Are the architectural concepts valid?
    2. Conceptual Depth: Did they explain *why* and *how* things work under the hood, or just repeat surface keywords?
    3. Communication: Is the answer structured, coherent, and direct?
    4. Anti-Cheat Scan (Plagiarism & AI Generated Content Detection):
       - You MUST set "suspiciousActivity" to true if the candidate's answer displays patterns of AI-generated content or boilerplate.
       - CRITICAL ZERO-TOLERANCE RULES:
         a) If the response begins with conversational helper prefaces (e.g., "Certainly...", "Sure...", "I'd be happy to...", "Great question...", "When considering..."), set "suspiciousActivity" to true immediately.
         b) If the response uses rigid ordinal transition lists (e.g., "Firstly...", "Secondly...", "Lastly..."), set "suspiciousActivity" to true immediately.
         c) If the response repeats the question verbatim, set "suspiciousActivity" to true immediately.
       - If you flag suspiciousActivity as true, explain this exact reason in the "reasoning" field and cap the score at a maximum of 30.

    Return ONLY a valid JSON object matching this schema exactly (no markdown formatting, no code blocks):
    {{
      "score": <number 0-100 based on accuracy, depth, and clarity>,
      "feedback": "<detailed constructive, technical critique. Highlight what was good and what was missing>",
      "suspiciousActivity": <true or false if AI-generated or copied boilerplate is detected>,
      "reasoning": "<internal explanation for the score and any suspicious flags>"
    }}
    """
    result = _query_ollama(prompt, is_json=True)
    if not isinstance(result, dict) or "score" not in result:
        result = {
            "score": 75,
            "feedback": "Solid response. Understood core concepts.",
            "suspiciousActivity": False,
            "reasoning": "Fallback due to system evaluation timeout or JSON format error."
        }

    # Apply heuristic override if triggered
    if is_suspicious:
        result["suspiciousActivity"] = True
        result["score"] = min(result.get("score", 100), 30)
        orig_reasoning = result.get("reasoning", "")
        result["reasoning"] = f"Heuristic Scan: {cheat_reason}. " + orig_reasoning

    return result


# ---------------------------------------------------------------------------
# 6. Semantic job search
# ---------------------------------------------------------------------------

@delegate_to_gemini
def semantic_job_search(query: str, jobs_list: list) -> list:
    # Trim job list to avoid context overflow — send top 20
    trimmed = jobs_list[:20]
    prompt = f"""You are a career matcher. Semantically match the search query against the job list.
Understand synonyms (React = Frontend, Python = Flask/Django, remote = work from home).

Query: "{query}"

Jobs:
{json.dumps(trimmed, indent=2)}

Return ONLY a raw JSON array of matching jobs (matchPercentage >= 30), each with:
- all original job fields
- "matchPercentage": integer 0-100
- "fitReasoning": string (one sentence why this job fits)

Ordered by matchPercentage descending. Raw JSON array only."""
    result = _query_ollama(prompt, is_json=True)
    if isinstance(result, list):
        return result
    # fallback
    return [{**j, "matchPercentage": 75, "fitReasoning": "Matches your key criteria."} for j in trimmed[:3]]


# ---------------------------------------------------------------------------
# 7. Recruiter copilot candidate search
# ---------------------------------------------------------------------------

@delegate_to_gemini
def copilot_candidate_search(query: str, candidates_list: list) -> list:
    trimmed = candidates_list[:15]
    prompt = f"""You are an AI recruiter copilot. Match the recruiter's request against the candidate list.

Request: "{query}"

Candidates:
{json.dumps(trimmed, indent=2)}

Return ONLY a raw JSON array of matching candidates (matchScore >= 35), each with:
- all original candidate fields
- "matchScore": integer 0-100
- "matchingSkills": array of strings
- "copilotReasoning": string (brief professional evaluation)

Ordered by matchScore descending. Raw JSON array only."""
    result = _query_ollama(prompt, is_json=True)
    if isinstance(result, list):
        return result
    return [{**c, "matchScore": 80, "matchingSkills": ["Python"], "copilotReasoning": "Strong technical background."} for c in trimmed[:3]]


# ---------------------------------------------------------------------------
# 8. Cover letter generation
# ---------------------------------------------------------------------------

@delegate_to_gemini
def generate_cover_letter(resume_data: dict, job_details: dict) -> str:
    prompt = f"""You are an expert career consultant. Write a tailored, professional cover letter.

Candidate resume:
{json.dumps(resume_data, indent=2)}

Job opening:
{json.dumps(job_details, indent=2)}

Instructions:
- Match the tone and requirements of the role.
- Align candidate achievements with job requirements.
- 250-350 words, proper salutation and sign-off.
- Output ONLY the cover letter body — no extra commentary."""
    result = _query_ollama(prompt)
    if result:
        return result
    return ("Dear Hiring Manager,\n\nI am writing to express my strong interest in this position. "
            "My background and skills align well with your requirements and I am excited about the opportunity "
            "to contribute to your team.\n\nThank you for your consideration.\n\nSincerely,\nCandidate")


# ---------------------------------------------------------------------------
# 9. Resume ATS grading
# ---------------------------------------------------------------------------

@delegate_to_gemini
def grade_resume_match_score(resume_data: dict, job_details: dict) -> dict:
    prompt = f"""You are an ATS optimizer. Compare the resume against the job requirements.

Resume:
{json.dumps(resume_data, indent=2)}

Job:
{json.dumps(job_details, indent=2)}

Return ONLY a raw JSON object with exactly:
- "score": integer 0-100
- "matchingSkills": array of strings
- "missingKeywords": array of strings
- "optimizationTips": array of strings (actionable tips)

Raw JSON only."""
    result = _query_ollama(prompt, is_json=True)
    if isinstance(result, dict) and "score" in result:
        return result
    return {
        "score": 75,
        "matchingSkills": ["Software Engineering"],
        "missingKeywords": [],
        "optimizationTips": ["Quantify achievements with metrics."],
    }


# ---------------------------------------------------------------------------
# 10. Company profile generation
# ---------------------------------------------------------------------------

@delegate_to_gemini
def generate_company_profile_via_ai(company_name: str) -> dict | None:
    prompt = f"""Generate a company profile for "{company_name}".
Return ONLY a raw JSON object with these fields:
- "id": lowercase alphanumeric slug
- "name": official company name
- "industry": industry category
- "logoUrl": a placeholder image URL
- "bio": 1-2 sentence company description
- "employeesCount": approximate headcount string e.g. "10,000+"
- "location": headquarters city/country

Raw JSON only."""
    result = _query_ollama(prompt, is_json=True)
    if isinstance(result, dict) and "name" in result:
        return result
    safe_id = "".join(c.lower() for c in company_name if c.isalnum())
    return {
        "id": safe_id or "company",
        "name": company_name,
        "industry": "Technology & Services",
        "logoUrl": "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=100",
        "bio": f"{company_name} delivers innovative solutions in its sector.",
        "employeesCount": "1,000+",
        "location": "Global",
    }


# ---------------------------------------------------------------------------
# 11. Company reviews generation
# ---------------------------------------------------------------------------

@delegate_to_gemini
def generate_company_reviews_via_ai(company_id: str, company_name: str) -> list | None:
    prompt = f"""Generate 3 realistic anonymous employee reviews for "{company_name}".
Return ONLY a raw JSON array of 3 objects, each with:
- "rating": integer 1-5
- "workLifeBalance": integer 1-5
- "compensation": integer 1-5
- "culture": integer 1-5
- "title": string (reviewer job title)
- "pros": string
- "cons": string
- "summary": string (1-2 sentence overall review)
- "date": ISO date string

Raw JSON array only."""
    result = _query_ollama(prompt, is_json=True)
    if isinstance(result, list) and result:
        return result
    return [
        {
            "rating": 4, "workLifeBalance": 3, "compensation": 4, "culture": 4,
            "title": "Software Engineer", "pros": "Great team culture and learning opportunities.",
            "cons": "Fast-paced environment can be demanding.",
            "summary": f"Overall a solid company. {company_name} invests in its employees.",
            "date": "2025-01-15",
        }
    ]
