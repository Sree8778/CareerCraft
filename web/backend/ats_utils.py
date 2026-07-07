"""
ats_utils.py — Fast rule-based ATS scoring and resume quality analysis.
No API calls. Used for bulk candidate ranking, resume builder feedback,
and as a fallback when no AI keys are present.
"""
import re
from typing import Any


# ---------------------------------------------------------------------------
# Resume quality / completeness analysis (no job context)
# ---------------------------------------------------------------------------

def analyze_resume_quality(resume_data: dict) -> dict:
    """
    Score a resume for completeness and quality.
    Returns: { overallScore, sections, improvements, strengths }
    """
    sections: dict[str, dict] = {}
    improvements: list[str] = []
    strengths: list[str] = []

    personal      = resume_data.get("personal", {}) or {}
    experience    = resume_data.get("experience", []) or []
    education     = resume_data.get("education", []) or []
    skills        = resume_data.get("skills", []) or []
    projects      = resume_data.get("projects", []) or []
    certifications = resume_data.get("certifications", []) or []
    summary_html  = resume_data.get("summary", "") or ""
    summary_text  = re.sub(r"<[^>]+>", "", summary_html).strip()

    # ── Contact info (15%) ──────────────────────────────────────────────────
    contact_score = 0
    contact_issues: list[str] = []
    if personal.get("name"):     contact_score += 25
    else:                        contact_issues.append("Missing full name")
    if personal.get("email"):    contact_score += 25
    else:                        contact_issues.append("Missing email address")
    if personal.get("phone"):    contact_score += 25
    else:                        contact_issues.append("Missing phone number")
    if personal.get("location"): contact_score += 25
    else:                        contact_issues.append("Missing city / location")
    sections["contact"] = {"score": contact_score, "issues": contact_issues, "label": "Contact Info"}
    if contact_score == 100:
        strengths.append("Complete contact information")
    else:
        improvements.extend(contact_issues)

    # ── Professional summary (15%) ──────────────────────────────────────────
    if summary_text and len(summary_text) >= 100:
        sum_score = 100 if len(summary_text) >= 200 else 75
        if sum_score == 100:
            strengths.append("Strong professional summary")
        else:
            improvements.append("Expand summary to 2–3 sentences (200+ characters)")
    elif summary_text:
        sum_score = 40
        improvements.append("Write a longer summary (aim for 200+ characters highlighting experience and goals)")
    else:
        sum_score = 0
        improvements.append("Add a professional summary — it is the first thing recruiters read")
    sections["summary"] = {"score": sum_score, "issues": [], "label": "Professional Summary"}

    # ── Work experience (30%) ───────────────────────────────────────────────
    active_exp = [e for e in experience if e.get("jobTitle") or e.get("company")]
    if active_exp:
        exp_score = 0
        exp_issues: list[str] = []
        with_desc  = sum(1 for e in active_exp if len(re.sub(r"<[^>]+>", "", e.get("description", "")).strip()) > 30)
        with_dates = sum(1 for e in active_exp if e.get("dates"))

        exp_score += min(40, len(active_exp) * 20)       # up to 40 pts for entries
        if with_desc == len(active_exp):
            exp_score += 40
            strengths.append("All experience entries have descriptions")
        elif with_desc > 0:
            exp_score += 20
            exp_issues.append("Add achievement descriptions to every experience entry")
        else:
            exp_issues.append("Add bullet-point descriptions under each job — quantify impact where possible")

        if with_dates == len(active_exp):
            exp_score += 20
        else:
            exp_issues.append("Add date ranges to all experience entries")

        sections["experience"] = {"score": min(100, exp_score), "issues": exp_issues, "label": "Work Experience"}
        improvements.extend(exp_issues)
    else:
        sections["experience"] = {"score": 0, "issues": ["No work experience listed"], "label": "Work Experience"}
        improvements.append("Add at least one work experience entry")

    # ── Education (15%) ─────────────────────────────────────────────────────
    active_edu = [e for e in education if e.get("degree") or e.get("institution")]
    if active_edu:
        has_year = any(e.get("graduationYear") for e in active_edu)
        edu_score = 100 if has_year else 70
        edu_issues: list[str] = [] if has_year else ["Add graduation year(s) to education entries"]
        sections["education"] = {"score": edu_score, "issues": edu_issues, "label": "Education"}
        improvements.extend(edu_issues)
        if edu_score == 100:
            strengths.append("Complete education history")
    else:
        sections["education"] = {"score": 0, "issues": ["Missing education section"], "label": "Education"}
        improvements.append("Add your educational background")

    # ── Skills (20%) ────────────────────────────────────────────────────────
    all_skills: list[str] = []
    for s in skills:
        raw = s.get("skills_list", "") if isinstance(s, dict) else str(s)
        all_skills.extend([x.strip() for x in raw.split(",") if x.strip()])

    skill_count = len(all_skills)
    if skill_count >= 12:
        skill_score = 100
        strengths.append(f"Strong skills section ({skill_count} skills listed)")
    elif skill_count >= 7:
        skill_score = 75
        improvements.append(f"Add more skills — currently {skill_count}, aim for 12+")
    elif skill_count >= 3:
        skill_score = 45
        improvements.append(f"Skills section is thin ({skill_count}) — list all relevant technical and soft skills")
    else:
        skill_score = 0
        improvements.append("Add a comprehensive skills section with your technical and soft skills")
    sections["skills"] = {"score": skill_score, "issues": [], "label": "Skills"}

    # ── Projects (bonus, 5%) ────────────────────────────────────────────────
    active_proj = [p for p in projects if p.get("title")]
    if len(active_proj) >= 2:
        sections["projects"] = {"score": 90, "issues": [], "label": "Projects"}
        strengths.append(f"{len(active_proj)} projects showcased")
    elif len(active_proj) == 1:
        sections["projects"] = {"score": 55, "issues": ["Add 1–2 more projects to strengthen your portfolio"], "label": "Projects"}
        improvements.append("Add more personal/professional projects to demonstrate initiative")
    else:
        sections["projects"] = {"score": 0, "issues": ["No projects listed"], "label": "Projects"}
        improvements.append("Add personal or open-source projects — they differentiate candidates with similar experience")

    # ── Certifications (hidden bonus) ───────────────────────────────────────
    active_certs = [c for c in certifications if c.get("name")]
    if active_certs:
        sections["certifications"] = {"score": 100, "issues": [], "label": "Certifications"}
        strengths.append(f"{len(active_certs)} certification(s) on record")
    else:
        sections["certifications"] = {"score": 50, "issues": [], "label": "Certifications"}

    # ── Overall weighted score ───────────────────────────────────────────────
    weights = {
        "contact":    0.15,
        "summary":    0.15,
        "experience": 0.30,
        "education":  0.15,
        "skills":     0.20,
        "projects":   0.05,
    }
    overall = sum(sections.get(k, {}).get("score", 0) * w for k, w in weights.items())

    return {
        "overallScore": round(overall),
        "sections":     sections,
        "improvements": improvements[:6],
        "strengths":    strengths[:4],
    }


# ---------------------------------------------------------------------------
# ATS match scoring against a specific job
# ---------------------------------------------------------------------------

def _skill_set(resume_data: dict) -> set:
    skills: set[str] = set()
    for s in (resume_data.get("skills") or []):
        raw = s.get("skills_list", "") if isinstance(s, dict) else str(s)
        for sk in raw.split(","):
            c = sk.strip().lower()
            if c:
                skills.add(c)
    return skills


_TECH_PATTERNS = [
    r'\b(python|javascript|typescript|java|c\+\+|c#|golang|rust|swift|kotlin|php|ruby|scala|sql|html|css|bash|perl|lua)\b',
    r'\b(react|next\.?js|vue\.?js|angular|svelte|redux|tailwind|sass|webpack|vite|three\.?js)\b',
    r'\b(node\.?js|express|flask|fastapi|django|spring|nestjs|graphql|grpc|websocket)\b',
    r'\b(tensorflow|pytorch|scikit[- ]?learn|pandas|numpy|keras|hugging\s*face|langchain|opencv|spark|hadoop)\b',
    r'\b(aws|azure|gcp|docker|kubernetes|terraform|jenkins|linux|nginx|ci[/\-]?cd)\b',
    r'\b(postgresql|mysql|mongodb|redis|firestore|dynamodb|elasticsearch|sqlite|cassandra|supabase)\b',
    r'\b(git|figma|postman|jira|agile|scrum|microservices|rest\s*api|system\s*design)\b',
    r'\b(machine\s*learning|deep\s*learning|nlp|computer\s*vision|data\s*science|big\s*data)\b',
]

def _extract_job_skill_terms(job_data: dict) -> list[str]:
    parts = []
    if isinstance(job_data.get("requirements"), list):
        parts.extend(job_data["requirements"])
    if isinstance(job_data.get("description"), str):
        parts.append(job_data["description"])
    if isinstance(job_data.get("title"), str):
        parts.append(job_data["title"])
    full = " ".join(parts).lower()

    found: set[str] = set()
    for pat in _TECH_PATTERNS:
        found.update(re.findall(pat, full, re.IGNORECASE))

    # Also capture explicit requirement phrases (2-word terms)
    for req in job_data.get("requirements", []):
        tokens = re.findall(r'\b[A-Za-z][A-Za-z0-9+#.]{2,}(?:\s+[A-Za-z][A-Za-z0-9+#.]{1,})?\b', req)
        for t in tokens:
            tl = t.lower().strip()
            stop = {'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'you', 'have',
                    'will', 'also', 'can', 'job', 'role', 'team', 'work', 'our', 'your', 'must',
                    'skills', 'experience', 'knowledge', 'ability', 'strong', 'using', 'include'}
            if len(tl) > 2 and tl not in stop:
                found.add(tl)

    return list(found)


def _resume_full_text(resume_data: dict) -> str:
    parts: list[str] = []
    for exp in (resume_data.get("experience") or []):
        parts.append(re.sub(r"<[^>]+>", "", exp.get("description", "")).lower())
        parts.append(exp.get("jobTitle", "").lower())
        parts.append(exp.get("company", "").lower())
    for proj in (resume_data.get("projects") or []):
        parts.append(re.sub(r"<[^>]+>", "", proj.get("description", "")).lower())
        parts.append(proj.get("title", "").lower())
    parts.append(re.sub(r"<[^>]+>", "", resume_data.get("summary", "")).lower())
    return " ".join(parts)


def compute_ats_score(resume_data: dict, job_data: dict) -> dict:
    """
    Rule-based ATS match score (0-100) with breakdown.
    Fast, no API cost. Used for candidate ranking and preview scores.
    """
    resume_skills = _skill_set(resume_data)
    resume_text   = _resume_full_text(resume_data) + " " + " ".join(resume_skills)
    job_terms     = _extract_job_skill_terms(job_data)

    # ── Skills match (40%) ──────────────────────────────────────────────────
    if job_terms:
        matched = [t for t in job_terms if t in resume_text]
        missing = [t for t in job_terms if t not in matched]
        skill_pct = len(matched) / len(job_terms)
    else:
        matched = list(resume_skills)[:5]
        missing = []
        skill_pct = 0.70

    # ── Keyword density (20%) ────────────────────────────────────────────────
    job_words_raw = " ".join([
        " ".join(job_data.get("requirements", [])),
        job_data.get("description", ""),
        job_data.get("title", ""),
    ]).lower()
    stop = {'the','and','for','with','that','this','from','are','you','have','will','also',
            'can','job','role','team','work','our','your','must','skills','experience',
            'knowledge','ability','strong','using','include','their','which','based'}
    job_kw = {w for w in re.findall(r'\b[a-zA-Z][a-zA-Z0-9+#.]{2,}\b', job_words_raw) if w not in stop}
    kw_hits = sum(1 for kw in job_kw if kw in resume_text)
    kw_pct  = min(1.0, kw_hits / max(len(job_kw), 1))

    # ── Experience relevance (20%) ───────────────────────────────────────────
    exp_list = resume_data.get("experience") or []
    active_exp = [e for e in exp_list if e.get("jobTitle") or e.get("company")]
    exp_vol_pct = min(1.0, len(active_exp) / 3)

    job_title_words = {w for w in job_data.get("title", "").lower().split() if len(w) > 3}
    title_hit = any(w in resume_text for w in job_title_words)
    exp_pct = min(1.0, exp_vol_pct + (0.2 if title_hit else 0))

    # ── Education (10%) ─────────────────────────────────────────────────────
    edu_pct = 0.85 if any((e.get("degree") or e.get("institution")) for e in (resume_data.get("education") or [])) else 0.3

    # ── Completeness (10%) ──────────────────────────────────────────────────
    p = resume_data.get("personal") or {}
    has_summary = bool(re.sub(r"<[^>]+>", "", resume_data.get("summary", "")).strip())
    comp_pct = sum([
        0.3 if p.get("name") else 0,
        0.2 if has_summary else 0,
        0.2 if active_exp else 0,
        0.15 if resume_skills else 0,
        0.15 if resume_data.get("education") else 0,
    ])

    overall = (
        skill_pct * 40 +
        kw_pct    * 20 +
        exp_pct   * 20 +
        edu_pct   * 10 +
        comp_pct  * 10
    )

    return {
        "score": round(min(100, max(5, overall))),
        "breakdown": {
            "skillsMatch":          round(skill_pct * 100),
            "keywordDensity":       round(kw_pct    * 100),
            "experienceRelevance":  round(exp_pct   * 100),
            "educationMatch":       round(edu_pct   * 100),
            "completeness":         round(comp_pct  * 100),
        },
        "matchedSkills": [t.title() for t in matched[:12]],
        "missingSkills": [t.title() for t in missing[:10]],
    }
