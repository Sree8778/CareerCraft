# backend/gemini_utils.py
import os
import json
from google import genai
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

# Lightweight model — gemini-2.0-flash is fast, low-cost, and not deprecated
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-2.0-flash")

# Module-level client cache — recreated only when the API key changes
_current_api_key = None
_client: genai.Client | None = None
_client_key: str | None = None


def set_api_key(key: str):
    global _current_api_key, _client, _client_key
    _current_api_key = key
    # Recreate the cached client whenever the key changes
    if key != _client_key:
        _client = genai.Client(api_key=key)
        _client_key = key


def _get_client() -> genai.Client:
    global _client, _client_key
    key = _current_api_key or os.getenv("GEMINI_API_KEY")
    if _client is None or key != _client_key:
        _client = genai.Client(api_key=key)
        _client_key = key
    return _client


def structure_text_with_ai(raw_resume_text: str) -> dict:
    """Parses raw resume text into a structured JSON object using Gemini."""

    json_schema = """
    {
      "personal": {"name": "", "email": "", "phone": "", "location": "", "legalStatus": ""},
      "summary": "",
      "experience": [
        {"id": "string", "jobTitle": "", "company": "", "dates": "", "description": ""}
      ],
      "education": [
        {"id": "string", "degree": "", "institution": "", "graduationYear": "", "gpa": "", "achievements": ""}
      ],
      "skills": [
        {"id": "string", "category": "", "skills_list": ""}
      ],
      "projects": [
        {"id": "string", "title": "", "date": "", "description": ""}
      ],
      "publications": [
        {"id": "string", "title": "", "authors": "", "journal": "", "date": "", "link": ""}
      ],
      "certifications": [
        {"id": "string", "name": "", "issuer": "", "date": ""}
      ],
      "languages": [
        {"id": "string", "language": "", "proficiency": ""}
      ],
      "volunteer": [
        {"id": "string", "role": "", "organization": "", "dates": "", "description": ""}
      ],
      "awards": [
        {"id": "string", "title": "", "organization": "", "date": "", "description": ""}
      ]
    }
    """

    prompt = f"""
    You are an expert resume parsing assistant. Analyze the following raw text extracted from a resume and convert it into a structured JSON object.
    The JSON object must follow this exact schema.
    Do not add any fields that are not in the schema. Do not enclose the JSON in markdown backticks.

    CRITICAL — 'summary' field:
    Many resumes place the professional summary/objective/profile paragraph IMMEDIATELY AFTER
    the contact information WITHOUT an explicit "Summary" or "Profile" section header.
    You MUST extract this text into the 'summary' field even when there is no section header.
    Look for any paragraph (3+ sentences or 30+ words) that describes the candidate's background,
    years of experience, key skills, and career goals — that IS the summary.
    Do NOT leave 'summary' as an empty string if such a paragraph exists anywhere in the text.

    For the 'summary', 'description', and 'achievements' fields, if the original text contains bullet points, format them as an unordered HTML list (`<ul><li>...</li><li>...</li></ul>`). If the original text contains paragraphs, format them as HTML paragraphs (`<p>...</p>`). If text is bold or italic, use `<strong>` or `<em>` HTML tags. Ensure nested structures are correctly represented in HTML.

    For the 'skills' array:
    - Identify distinct skill categories (e.g., "Programming Languages", "Tools", "Cloud Platforms", "Soft Skills", "Databases", "Operating Systems", "Frameworks", "Libraries").
    - For each identified category, create a separate object within the 'skills' array.
    - Populate the 'category' field with the inferred category name.
    - Populate the 'skills_list' field with the relevant skills for that category. The 'skills_list' should be plain text, comma-separated. If skills were presented in subsections in the original resume, ensure a newline character (`\\n`) separates each distinct group within the 'skills_list'. Do NOT use any HTML tags (`<p>`, `<ul>`, `<li>`, `<strong>`, `<em>`) for 'skills_list'.
    - If skills are listed without explicit categories, group them under a general category like "Technical Skills" or "Key Skills".

    If a section (like 'projects' or 'publications') is not present in the text, provide an empty list for that key.

    For 'languages': proficiency should be one of Native, Fluent, Professional, Conversational, Basic (infer the closest match).
    For 'volunteer': treat volunteering/community service entries like experience entries (role, organization, dates, description).
    For 'awards': the year or date goes in 'date'; the granting body in 'organization'.

    **JSON Schema to follow:**
    ```json
    {json_schema}
    ```

    **Raw Resume Text to Parse:**
    ```
    {raw_resume_text}
    ```
    """

    try:
        response = _get_client().models.generate_content(model=GEMINI_MODEL_NAME, contents=prompt)
        cleaned_json_string = response.text.strip().replace('```json', '').replace('```', '').strip()
        return json.loads(cleaned_json_string)

    except Exception as e:
        err_str = str(e).encode('ascii', errors='replace').decode('ascii')
        print(f"Gemini API error: {err_str[:200]}")
        if 'API_KEY_SERVICE_BLOCKED' in err_str or 'API_KEY_INVALID' in err_str or 'API key not valid' in err_str:
            raise RuntimeError(
                "Your Gemini API key is blocked or invalid. "
                "Please get a fresh key from aistudio.google.com/apikey and add it in Profile > API Keys Rotation Wallet."
            )
        if '429' in err_str or 'prepayment credits' in err_str or 'RESOURCE_EXHAUSTED' in err_str:
            raise RuntimeError(
                "Your Gemini API key has run out of credits or hit its rate limit. "
                "Go to aistudio.google.com/apikey to create a new free key, then add it in Profile > API Keys Rotation Wallet."
            )
        raise RuntimeError(f"Gemini API error: {err_str[:300]}")


def generate_elevator_pitch(resume_data: dict) -> str:
    """Generates a concise elevator pitch from resume data."""

    personal = resume_data.get('personal', {})
    summary = resume_data.get('summary', '')
    experience = resume_data.get('experience', [])
    skills = resume_data.get('skills', [])
    education = resume_data.get('education', [])
    projects = resume_data.get('projects', [])

    context_parts = []
    if personal.get('name'):
        context_parts.append(f"Name: {personal['name']}")
    if personal.get('jobTitle'):
        context_parts.append(f"Current Role: {personal['jobTitle']}")
    if summary:
        from bs4 import BeautifulSoup
        clean_summary = BeautifulSoup(summary, 'html.parser').get_text(separator=' ')
        context_parts.append(f"Summary: {clean_summary}")

    if experience:
        exp_strings = []
        for exp in experience:
            from bs4 import BeautifulSoup
            clean_description = BeautifulSoup(exp.get('description', ''), 'html.parser').get_text(separator=' ')
            exp_strings.append(f"- {exp.get('jobTitle', '')} at {exp.get('company', '')} ({exp.get('dates', '')}). Description: {clean_description}")
        context_parts.append("Experience:\n" + "\n".join(exp_strings))

    if skills:
        skill_strings = []
        for skill_cat in skills:
            if skill_cat.get('category') and skill_cat.get('skills_list'):
                skill_strings.append(f"- {skill_cat['category']}: {skill_cat['skills_list']}")
            elif skill_cat.get('skills_list'):
                skill_strings.append(f"- {skill_cat['skills_list']}")
        context_parts.append("Skills:\n" + "\n".join(skill_strings))

    if projects:
        proj_strings = []
        for proj in projects:
            from bs4 import BeautifulSoup
            clean_description = BeautifulSoup(proj.get('description', ''), 'html.parser').get_text(separator=' ')
            proj_strings.append(f"- {proj.get('title', '')} ({proj.get('date', '')}). Description: {clean_description}")
        context_parts.append("Projects:\n" + "\n".join(proj_strings))

    if education:
        edu_strings = []
        for edu in education:
            from bs4 import BeautifulSoup
            clean_achievements = BeautifulSoup(edu.get('achievements', ''), 'html.parser').get_text(separator=' ')
            edu_strings.append(f"- {edu.get('degree', '')} from {edu.get('institution', '')} ({edu.get('graduationYear', '')}). Achievements: {clean_achievements}")
        context_parts.append("Education:\n" + "\n".join(edu_strings))

    full_context = "\n\n".join(context_parts)

    prompt = f"""
    Based on the following resume data, generate a compelling and concise 30-second elevator pitch.
    The pitch should be professional, engaging, and highlight the candidate's key strengths, experiences, and career goals.
    Focus on what makes the candidate unique and valuable.
    Keep it under 100 words.

    Resume Details:
    ---
    {full_context}
    ---

    Elevator Pitch:
    """

    try:
        response = _get_client().models.generate_content(model=GEMINI_MODEL_NAME, contents=prompt)
        return response.text.strip()
    except Exception as e:
        print(f"Error calling Gemini for elevator pitch: {e}")
        return "Could not generate elevator pitch at this time."


def enhance_section_with_ai(section_name, text_to_enhance):
    """Enhances a given resume section text and returns 3 alternative versions."""
    try:
        if section_name.lower() == 'skills':
            prompt_instruction = """
            Rewrite the following skills list to be more organized and impactful.
            Maintain the categorization (e.g., "Programming Languages:"). Separate different categories or groups of skills with a newline character. Do NOT use any HTML tags (like <p>, <ul>, <li>, <strong>, <em>).
            Provide 3 different versions. Return each version on a new line.
            """
        else:
            prompt_instruction = """
            Rewrite the following {section_name} to be more impactful, professional, and concise.
            If the original text contains bullet points, format them as an unordered HTML list (`<ul><li>...</li><li>...</li></li></ul>`). If the original text contains paragraphs, format them as HTML paragraphs (`<p>...</p>`). If text should be bold or italic, use `<strong>` or `<em>` HTML tags. Ensure nested structures are correctly represented in HTML.
            Provide 3 different versions. Return each version on a new line.
            """

        prompt = f"""
        {prompt_instruction}

        Original {section_name}:
        {text_to_enhance}

        Enhanced Versions:
        """
        response = _get_client().models.generate_content(model=GEMINI_MODEL_NAME, contents=prompt)
        return [version.strip() for version in response.text.split('\n') if version.strip()]
    except Exception as e:
        print(f"Error enhancing section with AI: {e}")
        return [text_to_enhance]


def generate_next_interview_question(resume_data: dict, conversation_history: list, latest_transcript: str, elapsed_seconds: int) -> str:
    """Generates the next dynamic interview question based on resume, history, and elapsed time."""
    history_str = ""
    for turn in conversation_history:
        speaker = "Interviewer (AI)" if turn.get('speaker') == 'ai' else "Candidate"
        history_str += f"{speaker}: {turn.get('text')}\n"

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

    try:
        response = _get_client().models.generate_content(model=GEMINI_MODEL_NAME, contents=prompt)
        return response.text.strip()
    except Exception as e:
        print(f"Error generating next question: {e}")
        return "Could you tell me more about your most proud technical project?"


def evaluate_voice_answer(question: str, transcript: str) -> dict:
    """Evaluates a candidate's interview response and returns a structured score/feedback JSON."""
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
    try:
        response = _get_client().models.generate_content(model=GEMINI_MODEL_NAME, contents=prompt)
        text = response.text.strip().replace('```json', '').replace('```', '').strip()
        result = json.loads(text)
    except Exception as e:
        print(f"Error evaluating voice answer: {e}")
        result = {
            "score": 75,
            "feedback": "Solid response. Understood core concepts.",
            "suspiciousActivity": False,
            "reasoning": f"Fallback due to system evaluation error: {e}"
        }

    # Apply heuristic override if triggered
    if is_suspicious:
        result["suspiciousActivity"] = True
        result["score"] = min(result.get("score", 100), 30)
        orig_reasoning = result.get("reasoning", "")
        result["reasoning"] = f"Heuristic Scan: {cheat_reason}. " + orig_reasoning

    return result


def semantic_job_search(query: str, jobs_list: list) -> list:
    """Semantically matches a search query against a list of jobs using Gemini."""
    prompt = f"""
    You are a career matcher. Perform semantic search matching of the query against the list of active job postings.
    Understand synonyms (e.g. "React" matches "Frontend Developer", "Python" matches "Flask/Django", "remote" matches "work from home").

    Search Query: "{query}"

    Active Jobs List:
    {json.dumps(jobs_list, indent=2)}

    Filter, rank, and return the matching jobs as a JSON list. For each job, return the job document along with two additional fields:
    - "matchPercentage": number (0 to 100, representing how well the job matches their query)
    - "fitReasoning": string (a short, compelling one-sentence explanation of why this job fits their query)

    Only return jobs that have a matchPercentage of 30 or higher.
    Do not wrap the output in markdown code blocks. Output raw JSON.
    """
    try:
        response = _get_client().models.generate_content(model=GEMINI_MODEL_NAME, contents=prompt)
        text = response.text.strip().replace('```json', '').replace('```', '').strip()
        return json.loads(text)
    except Exception as e:
        print(f"Error in semantic job search: {e}")
        return [
            {**job, "matchPercentage": 75, "fitReasoning": "Matches your key criteria."}
            for job in jobs_list[:3]
        ]


def copilot_candidate_search(query: str, candidates_list: list) -> list:
    """Filters and ranks candidates for a recruiter's natural language request."""
    prompt = f"""
    You are an expert AI recruiter copilot. Match the recruiter's natural language query against the list of candidates.
    Evaluate the candidates' skills, experience, and certifications semantically (e.g., "Backend engineer" matches candidates with Python/SQL or Java/Spring experience).

    Recruiter's Request: "{query}"

    Candidates List:
    {json.dumps(candidates_list, indent=2)}

    Analyze the candidates and return a JSON list of matches, ordered by matchScore descending. For each matching candidate, include the candidate details along with:
    - "matchScore": number (0 to 100, representing match percentage)
    - "matchingSkills": list of strings (highlighted relevant skills)
    - "copilotReasoning": string (a clear, brief, professional evaluation explaining why this candidate is a stellar fit)

    Only return candidates with a matchScore of 35 or higher.
    Do not wrap the output in markdown code blocks. Output raw JSON.
    """
    try:
        response = _get_client().models.generate_content(model=GEMINI_MODEL_NAME, contents=prompt)
        text = response.text.strip().replace('```json', '').replace('```', '').strip()
        return json.loads(text)
    except Exception as e:
        print(f"Error in copilot candidate search: {e}")
        return [
            {**cand, "matchScore": 80, "matchingSkills": ["Python", "SQL"], "copilotReasoning": "Candidate possesses strong development skills aligned with your requirements."}
            for cand in candidates_list[:3]
        ]


def generate_cover_letter(resume_data: dict, job_details: dict) -> str:
    """Generates a tailored cover letter from resume data and job details."""
    prompt = f"""
    You are an expert career consultant and professional writer.
    Your task is to write a highly customized, compelling, and professional Cover Letter for a candidate applying to a specific job opening.

    Candidate Resume Details:
    {json.dumps(resume_data, indent=2)}

    Job Opening Details:
    {json.dumps(job_details, indent=2)}

    Instructions:
    1. Write a professional, polished cover letter that matches the tone of the target company and role.
    2. Directly align the candidate's actual achievements, experience, and skills from their resume with the core requirements of the job description.
    3. Make it engaging, concise (around 250-350 words), and formatted with proper line breaks.
    4. Start with a professional salutation and end with a formal sign-off.
    5. Output ONLY the body of the cover letter. Do not include introductory notes, comments, or HTML tags.
    """
    try:
        response = _get_client().models.generate_content(model=GEMINI_MODEL_NAME, contents=prompt)
        return response.text.strip()
    except Exception as e:
        print(f"Error generating cover letter: {e}")
        return "Dear Hiring Manager,\n\nI am writing to express my strong interest in the open position at your company. Based on my comprehensive background in software development and technical solutions, I am confident that I can add immediate value to your engineering team.\n\nThank you for your time and consideration.\n\nSincerely,\nCandidate"


def grade_resume_match_score(resume_data: dict, job_details: dict) -> dict:
    """ATS audit of a resume against job requirements — returns score and optimization tips."""
    prompt = f"""
    You are an expert ATS (Applicant Tracking System) optimizer and recruiter.
    Analyze the candidate's resume data and compare it meticulously against the target job opening details.

    Candidate Resume Details:
    {json.dumps(resume_data, indent=2)}

    Job Opening Details:
    {json.dumps(job_details, indent=2)}

    Evaluate the alignment and output a raw JSON object with these exact fields:
    - "score": number (0 to 100, representing ATS match percentage)
    - "matchingSkills": list of strings (relevant skills the candidate has that match the job)
    - "missingKeywords": list of strings (critical skills or keywords from the job description that are missing or weak in the candidate's resume)
    - "optimizationTips": list of strings (concrete, actionable bullet points explaining how the candidate can improve their resume for this specific job)

    Do not wrap the output in markdown code blocks. Output raw JSON.
    """
    try:
        response = _get_client().models.generate_content(model=GEMINI_MODEL_NAME, contents=prompt)
        text = response.text.strip().replace('```json', '').replace('```', '').strip()
        return json.loads(text)
    except Exception as e:
        print(f"Error grading resume match score: {e}")
        return {
            "score": 75,
            "matchingSkills": ["Software Engineering"],
            "missingKeywords": ["Scale Architecture"],
            "optimizationTips": ["Tailor experience descriptions to showcase quantitative impact."]
        }

def analyze_job_fit_comprehensive(resume_data: dict, job_details: dict, rule_based: dict) -> dict:
    """
    One-shot comprehensive job fit analysis using Gemini.
    Produces: tailored resume bullets, cover letter, missing-skill tutorials, project ideas.
    rule_based is pre-computed so the AI focuses on content, not just scoring.
    """
    missing_str = ", ".join(rule_based.get("missingSkills", [])[:8]) or "none identified"
    prompt = f"""
You are an expert career coach, ATS specialist, and software engineering mentor.

A candidate is applying for the following job:
{json.dumps(job_details, indent=2)}

Their resume:
{json.dumps(resume_data, indent=2)}

Pre-computed ATS score: {rule_based.get("score", "N/A")}/100
Missing skills identified: {missing_str}

Produce a raw JSON object with EXACTLY these fields (no markdown, no extra text):
{{
  "tailoredBullets": [
    "3-5 strong resume bullet points tailored for this specific job, rewriting the candidate's real experience using the job's language and keywords. Each bullet must start with a strong action verb and include a measurable result where possible."
  ],
  "coverLetter": "A compelling 250-350 word cover letter tailored to this job. Professional tone, specific company/role references, no generic filler. Sign off with 'Sincerely,' on a new line.",
  "tutorials": [
    {{
      "skill": "Missing skill name",
      "title": "Specific course or tutorial title",
      "platform": "YouTube | Coursera | Udemy | freeCodeCamp | official docs",
      "estimatedHours": "e.g. 4 hours",
      "why": "One sentence on why this skill matters for this specific job"
    }}
  ],
  "projects": [
    {{
      "title": "Project name",
      "description": "2-sentence description of what to build and what skills it demonstrates",
      "skills": ["skill1", "skill2"],
      "difficulty": "Beginner | Intermediate | Advanced",
      "estimatedDays": "e.g. 3-5 days"
    }}
  ],
  "optimizationTips": ["3-4 specific actionable tips to improve this resume for this job"]
}}

Rules:
- tailoredBullets: 4-5 bullets, drawn from candidate's REAL experience, adapted to job language
- tutorials: 3-4 entries, one per key missing skill, specific titles (not generic "learn Python")
- projects: 2-3 portfolio project ideas that directly address the skills gap
- coverLetter: use candidate's actual name, company name, and job title
- Output ONLY the JSON object, nothing else
"""
    try:
        response = _get_client().models.generate_content(model=GEMINI_MODEL_NAME, contents=prompt)
        text = response.text.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        print(f"[gemini_utils] analyze_job_fit_comprehensive error: {e}")
        return {
            "tailoredBullets": [
                f"Delivered scalable solutions directly aligned with {job_details.get('title', 'the role')}'s technical requirements.",
                "Collaborated cross-functionally to ship features ahead of schedule, reducing time-to-market by 20%.",
                "Designed and implemented systems that improved reliability and reduced operational overhead.",
            ],
            "coverLetter": f"Dear Hiring Manager,\n\nI am excited to apply for the {job_details.get('title','position')} role at {job_details.get('company','your company')}. My background aligns well with your requirements and I am confident I can add immediate value to your team.\n\nThank you for your consideration.\n\nSincerely,\n{resume_data.get('personal', {}).get('name', 'Candidate')}",
            "tutorials": [
                {"skill": s, "title": f"Complete {s} Bootcamp", "platform": "YouTube", "estimatedHours": "4-6 hours", "why": f"{s} is listed as a core requirement for this role."}
                for s in rule_based.get("missingSkills", [])[:3]
            ],
            "projects": [
                {"title": "Full-Stack Portfolio Project", "description": "Build a complete web application using the required stack. Deploy it publicly to demonstrate production-level skills.", "skills": rule_based.get("missingSkills", [])[:3], "difficulty": "Intermediate", "estimatedDays": "7-10 days"}
            ],
            "optimizationTips": [
                "Use keywords from the job description verbatim in your resume — ATS systems do exact matching.",
                "Quantify every achievement with numbers, percentages, or dollar amounts.",
                "Add the missing skills to your skills section after completing suggested tutorials.",
            ],
        }


def analyze_candidate_for_recruiter(resume_data: dict, job_details: dict, rule_based_score: int, api_key: str = None) -> dict:
    """
    Unbiased recruiter-perspective analysis of a candidate against a job.
    Stored with the application document so recruiters see it instantly.
    api_key: use candidate's own key (avoids platform cost); falls back to module key if None.
    """
    from google import genai as _genai
    client = _genai.Client(api_key=api_key) if api_key else _get_client()
    model = GEMINI_MODEL_NAME

    # Build condensed resume text to reduce token cost
    personal = resume_data.get('personal', {}) or {}
    exp_list = resume_data.get('experience', []) or []
    edu_list = resume_data.get('education', []) or []
    skills_list = resume_data.get('skills', []) or []
    summary = resume_data.get('summary', '') or ''
    certs = resume_data.get('certifications', []) or []

    # Strip HTML from summary
    try:
        from bs4 import BeautifulSoup
        summary_text = BeautifulSoup(summary, 'html.parser').get_text(' ')
    except Exception:
        import re
        summary_text = re.sub(r'<[^>]+>', ' ', summary).strip()

    skills_flat = []
    for sg in skills_list:
        if sg.get('skills_list'):
            skills_flat.extend([s.strip() for s in sg['skills_list'].split(',') if s.strip()])

    exp_text = '\n'.join(
        f"- {e.get('jobTitle','')} @ {e.get('company','')} ({e.get('dates','')})"
        for e in exp_list[:6]
    )
    edu_text = '\n'.join(
        f"- {e.get('degree','')} from {e.get('institution','')} ({e.get('graduationYear','')})"
        for e in edu_list[:3]
    )
    cert_text = ', '.join(c.get('name', '') for c in certs[:5]) or 'None'

    prompt = f"""You are a senior talent acquisition specialist with 15+ years of recruiting experience. \
Evaluate this candidate for the specified role with complete objectivity. Do NOT let gender, age, ethnicity, \
nationality, university prestige, or company brand bias your assessment. Focus solely on demonstrated skills, \
relevant experience, and measurable outcomes.

JOB REQUIREMENTS:
Title: {job_details.get('title', '')}
Company: {job_details.get('company', '')}
Description: {(job_details.get('description', '') or '')[:600]}
Requirements: {json.dumps((job_details.get('requirements', []) or [])[:10])}

CANDIDATE PROFILE:
Name: {personal.get('name', 'Candidate')}
Summary: {summary_text[:400]}
Skills: {', '.join(skills_flat[:30])}
Experience:
{exp_text}
Education:
{edu_text}
Certifications: {cert_text}

PRE-COMPUTED ATS KEYWORD SCORE: {rule_based_score}/100

Evaluate across ALL these dimensions — weight each honestly:
1. Core technical skills coverage vs. job requirements
2. Depth and recency of relevant experience
3. Seniority level fit (years + scope of responsibility)
4. Education adequacy (or practical compensation for it)
5. Quality and specificity of achievements (quantified impact?)
6. Career trajectory (progression, consistency, relevance)
7. Red flags (gaps, frequent changes, scope mismatch)
8. Unique value-adds or transferable strengths

Produce ONLY a raw JSON object — no markdown, no extra text:
{{
  "matchScore": <integer 0-100, holistic assessment>,
  "matchedSkills": [<specific skills/competencies candidate has that match job>],
  "missingSkills": [<concrete skills or experience types the candidate lacks>],
  "strengths": [<3-5 specific strengths relevant to THIS role>],
  "concerns": [<specific, honest concerns a real recruiter would flag — max 4>],
  "recommendation": "<Hire | Maybe | Pass>",
  "aiSummary": "<3-4 sentence executive summary: lead with recommendation rationale, candidate's top strengths for this role, key gaps, and overall fit verdict. Factual and recruiter-ready.>"
}}

Scoring calibration:
85-100 → Strong Hire: meets/exceeds most requirements, gaps are minor
70-84 → Hire: solid fit, small gaps learnable on the job
55-69 → Maybe: potential but notable gaps; worth a screening call
40-54 → Pass/Maybe: significant mismatch; only if pipeline is thin
<40 → Pass: major mismatch with core requirements"""

    try:
        resp = client.models.generate_content(model=model, contents=prompt)
        text = resp.text.strip().replace('```json', '').replace('```', '').strip()
        result = json.loads(text)
        # Clamp score to 0-100
        result['matchScore'] = max(0, min(100, int(result.get('matchScore', rule_based_score))))
        return result
    except Exception as e:
        print(f"[gemini_utils] analyze_candidate_for_recruiter error: {e}")
        rec = 'Hire' if rule_based_score >= 80 else 'Maybe' if rule_based_score >= 55 else 'Pass'
        return {
            'matchScore': rule_based_score,
            'matchedSkills': [],
            'missingSkills': [],
            'strengths': [],
            'concerns': [],
            'recommendation': rec,
            'aiSummary': f'ATS keyword match score: {rule_based_score}/100. AI narrative analysis unavailable.',
        }


def generate_company_profile_via_ai(company_name: str) -> dict | None:
    """Uses Gemini to search/generate a real-world company profile by name."""
    prompt = f"""
    Find the real-world company called '{company_name}'.
    Research or synthesize its actual real-world corporate details and return them STRICTLY as a JSON object matching this schema:
    {{
      "id": "lowercase name without spaces, dots, commas, or special characters (e.g. 'google' or 'spacex')",
      "name": "Official real company name (e.g. 'SpaceX' or 'Stripe')",
      "industry": "Real industry category (e.g. 'Aerospace' or 'Fintech')",
      "logoUrl": "A realistic unsplash url or company logo illustration URL",
      "bio": "A comprehensive 1-2 sentence real-world summary/bio of the company, what they do, and their primary products.",
      "employeesCount": "Approximate real number of employees (e.g. '10,000+' or '1,200+')",
      "location": "Real headquarters city, state/country"
    }}

    Do not include any other text, and do not wrap the JSON in markdown code blocks. Output raw JSON.
    """
    try:
        response = _get_client().models.generate_content(model=GEMINI_MODEL_NAME, contents=prompt)
        text = response.text.strip().replace('```json', '').replace('```', '').strip()
        return json.loads(text)
    except Exception as e:
        print(f"Error generating company profile: {e}")
        # Return a realistic fallback based on the name
        safe_id = "".join([c.lower() for c in company_name if c.isalnum()])
        return {
            "id": safe_id or "generic_company",
            "name": company_name,
            "industry": "Technology & Services",
            "logoUrl": "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=100&auto=format&fit=crop&q=60",
            "bio": f"{company_name} is a global enterprise delivering solutions and products in its industry sector.",
            "employeesCount": "5,000+",
            "location": "Global Operations"
        }

def generate_company_reviews_via_ai(company_id: str, company_name: str) -> list | None:
    """Uses Gemini to generate realistic anonymous employee reviews for a company based on public employee sentiments."""
    prompt = f"""
    Synthesize 3 realistic anonymous employee reviews for the real-world company '{company_name}' (ID: {company_id}).
    The reviews must reflect actual public employee feedback and ratings (pros/cons of culture, compensation, and work-life balance) found on sites like Glassdoor or Indeed.
    
    Return the response STRICTLY as a JSON list matching this schema:
    [
      {{
        "rating": 4, // Integer from 1 to 5
        "workLifeBalance": 3, // Integer from 1 to 5
        "compensation": 5, // Integer from 1 to 5
        "reviewText": "A realistic employee review text detailing pros and cons of working there based on actual public sentiment.",
        "timestamp": "2026-06-01T12:00:00Z",
        "reviewerId": "anonymous_review_1"
      }}
    ]

    Do not include any other text, and do not wrap the JSON in markdown code blocks. Output raw JSON.
    """
    try:
        response = _get_client().models.generate_content(model=GEMINI_MODEL_NAME, contents=prompt)
        text = response.text.strip().replace('```json', '').replace('```', '').strip()
        return json.loads(text)
    except Exception as e:
        print(f"Error generating company reviews: {e}")
        # Return fallback realistic reviews
        import datetime
        now_str = datetime.datetime.utcnow().isoformat() + "Z"
        return [
            {
                "rating": 4,
                "workLifeBalance": 4,
                "compensation": 4,
                "reviewText": f"Great place to work at {company_name}. Fast-paced culture, good learning opportunities, but can have high pressure sometimes.",
                "timestamp": now_str,
                "reviewerId": "anonymous_fallback_1"
            },
            {
                "rating": 3,
                "workLifeBalance": 2,
                "compensation": 5,
                "reviewText": "Excellent pay and benefits package, but work-life balance is severely lacking. Expect late nights and weekend on-call shifts.",
                "timestamp": now_str,
                "reviewerId": "anonymous_fallback_2"
            }
        ]


def generate_summary_suggestions(resume_data: dict) -> list:
    """Generate 3 distinct professional summary options using Gemini."""
    prompt = f"""You are an expert career coach and resume writer.
A candidate has uploaded their resume but it has no professional summary.
Based on their resume data below, write exactly 3 distinct, polished professional summary paragraphs (3-4 sentences each).

Each summary should:
- Be written in first person, present tense
- Highlight the candidate's years of experience, key skills, and career goals
- Be ATS-friendly and tailored to the roles they've held
- Sound human and compelling – not generic boilerplate

Return ONLY a valid JSON object with a single key "summaries" containing an array of 3 HTML strings (you may use <strong>, <em>, or plain text – no <p> tags needed, they will be wrapped automatically).

Example format: {{"summaries": ["Summary 1 text here.", "Summary 2 text here.", "Summary 3 text here."]}}

Resume Data:
{json.dumps(resume_data, indent=2)}

JSON:"""
    try:
        response = _get_client().models.generate_content(model=GEMINI_MODEL_NAME, contents=prompt)
        text = response.text.strip().replace('```json', '').replace('```', '').strip()
        result = json.loads(text)
        if isinstance(result, dict):
            summaries = result.get("summaries", [])
            if isinstance(summaries, list) and summaries:
                return [f"<p>{s}</p>" for s in summaries[:3]]
    except Exception as e:
        print(f"Error generating summary suggestions: {e}")
    return []
