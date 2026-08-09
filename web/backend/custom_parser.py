"""
Rule-based resume parser — zero AI dependency.

Handles structured AND unformatted resumes:
  • ALL-CAPS / decorated section headers  (--- EXPERIENCE ---, ===SKILLS===)
  • Month/year date formats  (01/2019, Jan '19, 2019-2021)
  • Continuous-paragraph descriptions (no bullet points)
  • Skills without categories
  • Multi-line contact blocks
  • Fallback heuristic parse when no section headers found

Output schema matches gemini_utils so it's a drop-in replacement.
"""

import re
import io
import uuid
import unicodedata
from typing import Optional


# ── Text extraction ────────────────────────────────────────────────────────────

def _text_from_pdf(data: bytes) -> str:
    try:
        import fitz  # PyMuPDF — best layout preservation
        doc = fitz.open(stream=data, filetype="pdf")
        pages = []
        for page in doc:
            # Use "blocks" mode for better multi-column handling
            blocks = page.get_text("blocks")
            blocks.sort(key=lambda b: (round(b[1] / 20), b[0]))  # sort top→bottom, left→right
            pages.append("\n".join(b[4].strip() for b in blocks if b[4].strip()))
        return "\n\n".join(pages)
    except ImportError:
        pass
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(data))
        return "\n".join(p.extract_text() or "" for p in reader.pages)
    except Exception:
        pass
    raise RuntimeError("No PDF library available (need fitz or pypdf).")


def _text_from_docx(data: bytes) -> str:
    import docx
    doc = docx.Document(io.BytesIO(data))
    parts = []
    for para in doc.paragraphs:
        if para.text.strip():
            parts.append(para.text)
        else:
            parts.append("")
    return "\n".join(parts)


def extract_text(file_bytes: bytes, filename: str) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        return _text_from_pdf(file_bytes)
    if name.endswith(".docx"):
        return _text_from_docx(file_bytes)
    if name.endswith(".doc"):
        raise ValueError("Legacy .doc files are not supported. Please save the file as PDF or DOCX and try again.")
    raise ValueError(f"Unsupported file type: {filename}")


# ── Text normalisation ─────────────────────────────────────────────────────────

def _normalise(text: str) -> str:
    """Clean up common PDF/encoding artifacts before parsing."""
    # Unicode normalise (handles accented chars, ligatures like ﬁ→fi)
    text = unicodedata.normalize("NFKC", text)
    # Smart quotes / dashes → ASCII equivalents
    text = text.replace("’", "'").replace("‘", "'")
    text = text.replace("“", '"').replace("”", '"')
    text = text.replace("–", "–").replace("—", "—")
    text = text.replace(" ", " ")   # non-breaking space
    text = text.replace("•", "•")   # bullet
    text = text.replace("", "•")   # Word bullet glyph
    # Collapse runs of spaces; keep newlines meaningful
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\r\n|\r", "\n", text)
    text = re.sub(r"\n{4,}", "\n\n\n", text)

    # ── Rejoin PDF line wraps ────────────────────────────────────────────
    # PDF extraction breaks sentences mid-line. Without rejoining, wrapped
    # continuations get misread as new entry headers (e.g. one project
    # becoming several). Two cases:
    # 1. Hyphenated wrap:  "distri-\nbutions"  → "distributions"
    text = re.sub(r"(\w)-\n(?=[a-z])", r"\1", text)
    # 2. Sentence wrap: a line ending mid-sentence followed by a line that
    #    starts lowercase (and isn't a bullet) is a continuation.
    text = re.sub(
        r"(?<=[a-zA-Z,;])\n(?=[a-z](?![ \t]*[•\-\*▸▪‣◦]))",
        " ",
        text,
    )
    # Do not let line-wrap repair merge a name with a lowercase email address.
    # A common header is "Jane Doe" followed by "jane@example.com".
    text = re.sub(
        r"(?m)^([A-Z][A-Za-z .'-]{1,59}?)\s+([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b)",
        r"\1\n\2",
        text,
    )
    return text


# ── Compiled regex patterns ────────────────────────────────────────────────────

_RE_EMAIL    = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
_RE_LINKEDIN = re.compile(r"linkedin\.com/in/[\w\-]+", re.I)
_RE_GITHUB   = re.compile(r"github\.com/[\w\-]+", re.I)
_RE_URL      = re.compile(r"https?://[^\s<>\"']+")

_RE_PHONE = re.compile(
    r"(?<!\d)"
    r"(\+?(?:\d{1,3}[\s.\-]?))?"        # optional country code
    r"(\(?\d{2,4}\)?[\s.\-]?)"           # area code (2–4 digits)
    r"(\d{3,4}[\s.\-]?)"                 # exchange
    r"(\d{3,4})"                         # subscriber
    r"(?!\d)"
)

_MONTH_PAT = (
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?"
    r"|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
)
_DATE_END = r"(?:Present|Current|Now|Ongoing|Today|Till\s+Date|Till\s+Now|Cont(?:inued)?\.?)"

# Full date-range patterns (most specific first)
_RE_DATE_RANGE = re.compile(
    rf"(?:"
    # "Month Year – Month Year/Present"  OR  "Month 'YY – ..."
    rf"(?:{_MONTH_PAT}\s+'?\d{{2,4}})\s*[-–—/to]+\s*(?:(?:{_MONTH_PAT}\s+'?\d{{2,4}})|{_DATE_END})"
    rf"|"
    # "MM/YYYY – MM/YYYY or Present"
    rf"(?:\d{{1,2}}/\d{{4}})\s*[-–—/to]+\s*(?:\d{{1,2}}/\d{{4}}|{_DATE_END})"
    rf"|"
    # "YYYY – YYYY or Present"  (year-only range)
    rf"(?:(?:19|20)\d{{2}})\s*[-–—/to]+\s*(?:(?:19|20)\d{{2}}|{_DATE_END})"
    rf")",
    re.I,
)

# Single year
_RE_YEAR = re.compile(r"\b((?:19|20)\d{2})\b")

# Month+year (for date strings)
_RE_MONTH_YEAR = re.compile(rf"({_MONTH_PAT})\s+'?(\d{{2,4}})", re.I)

_RE_GPA = re.compile(
    r"(?:C?GPA|G\.P\.A\.|Grade\s+Point)\s*[:\-]?\s*(\d+\.?\d*)\s*(?:/\s*(\d+\.?\d*))?",
    re.I,
)

_RE_DEGREE = re.compile(
    r"\b(?:"
    r"B\.?S\.?|B\.?A\.?|B\.?E\.?|B\.?Tech\.?|B\.?Sc\.?|BCA|BBA|B\.?Com\.?"
    r"|M\.?S\.?|M\.?A\.?|M\.?E\.?|M\.?Tech\.?|M\.?Sc\.?|MBA|MCA|M\.?Com\.?"
    r"|Ph\.?D\.?|Doctor(?:ate)?|Associate(?:\s+of\s+\w+)?"
    r"|Bachelor(?:\'?s)?(?:\s+of\s+\w+)?|Master(?:\'?s)?(?:\s+of\s+\w+)?"
    r"|Diploma|Certificate|A\.?A\.?|A\.?S\.?"
    r")\b",
    re.I,
)

_RE_JOB_TITLE_WORDS = re.compile(
    r"\b(?:engineer|developer|manager|analyst|designer|consultant|director|specialist"
    r"|coordinator|associate|intern|executive|officer|lead|architect|scientist|researcher"
    r"|administrator|assistant|supervisor|president|vice\s*president|vp|ceo|cto|cfo|coo"
    r"|head|principal|product|project|program|data|software|hardware"
    r"|front.?end|back.?end|full.?stack|devops|cloud|security|qa|tester|sre|sde|swe"
    r"|marketing|sales|hr|recruiter|finance|accountant|writer|editor|strategist|technician"
    r"|developer|programmer|contractor|freelancer|founder|co.founder|owner)\b",
    re.I,
)

_RE_BULLET = re.compile(r"^[\s]*[•\-\*▸▪‣◦✓→✦◆▶»·]\s*")

_RE_DECORATION = re.compile(r"^[\s=\-_*|~#+]+$")  # lines that are just decorators


# ── Section header map ─────────────────────────────────────────────────────────
#
# Each key maps to a compiled regex that matches (case-insensitively) every
# real-world heading variant seen for that section.  The regex uses a full-line
# anchor (^...$) applied to the *cleaned* candidate (decoration and trailing
# colons already stripped by _clean_header_candidate).

_SECTION_MAP: dict[str, re.Pattern] = {

    # ── Summary / Objective ──────────────────────────────────────────────────
    "summary": re.compile(
        r"^(?:"
        r"summary|summaries"
        r"|objective|career objective|professional objective|job objective|work objective"
        r"|profile|professional profile|personal profile|candidate profile"
        r"|about(?: me)?|about the candidate|about myself"
        r"|professional summary|executive summary|career summary|brief summary"
        r"|overview|professional overview|career overview|work overview"
        r"|introduction|professional introduction"
        r"|personal statement|statement of purpose"
        r"|bio|biography|professional bio"
        r"|career profile|career goal|goals?"
        r"|professional goal|at a glance|snapshot"
        r"|highlights|key highlights|career highlights"
        r"|value proposition"
        r")$",
        re.I,
    ),

    # ── Work Experience ──────────────────────────────────────────────────────
    "experience": re.compile(
        r"^(?:"
        r"(?:work\s+)?experience|experiences"
        r"|work history|employment(?: history)?|employment record"
        r"|professional experience|career(?: history)?"
        r"|positions? held|positions? of responsibility"
        r"|relevant experience|related experience|core experience"
        r"|work background|job history|career experience|job experience"
        r"|professional background|professional history"
        r"|working experience|work experience history"
        r"|career background|career record"
        r"|industry experience|field experience"
        r"|internship(?:s)?|internship experience|internships?\ &?\ training"
        r"|practical experience|hands.on experience"
        r"|consulting experience|freelance experience|contract experience"
        r"|prior experience|previous experience"
        r"|employment details|work details"
        r")$",
        re.I,
    ),

    # ── Education ────────────────────────────────────────────────────────────
    "education": re.compile(
        r"^(?:"
        r"education|educational background|educational history|educational details"
        r"|educational qualifications|educational record"
        r"|academic(?: background)?|academic qualifications|academic credentials"
        r"|academic history|academic details|academic profile|academic record"
        r"|academic achievements|academic training"
        r"|qualifications?|formal qualifications"
        r"|schooling|school|college|university|universities"
        r"|degrees?|degree details"
        r"|formal education|training \& education"
        r"|coursework|relevant coursework"
        r")$",
        re.I,
    ),

    # ── Skills ───────────────────────────────────────────────────────────────
    "skills": re.compile(
        r"^(?:"
        r"(?:technical\s+)?skills?"
        r"|competencies|core competencies|key competencies"
        r"|expertise|areas? of expertise|domain expertise"
        r"|technologies|tools?"
        r"|tools?(?:\s*[&/]\s*technologies)?"
        r"|technologies\s*[&/]\s*tools?"
        r"|key skills|professional skills|functional skills"
        r"|technical expertise|technical proficiencies|technical knowledge"
        r"|skill set|skillset|skills summary"
        r"|tech stack|technology stack|stack"
        r"|core skills|additional skills|other skills"
        r"|programming skills|software skills|computer skills|digital skills"
        r"|it skills|it competencies"
        r"|hard skills|soft skills"
        r"|languages?\s*[&/]\s*technologies"
        r"|capabilities|core capabilities"
        r"|proficiencies"
        r"|strengths|key strengths|core strengths"
        r"|knowledge"
        r")$",
        re.I,
    ),

    # ── Projects ─────────────────────────────────────────────────────────────
    "projects": re.compile(
        r"^(?:"
        r"projects?|project details"
        r"|personal projects?|side projects?"
        r"|portfolio|portfolio projects?"
        r"|notable projects?|key projects?|major projects?"
        r"|academic projects?|course projects?|university projects?"
        r"|technical projects?|engineering projects?"
        r"|project work|project experience|project highlights"
        r"|open source|open.source contributions?"
        r"|featured projects?|selected projects?"
        r"|capstone projects?|thesis projects?"
        r"|independent projects?"
        r")$",
        re.I,
    ),

    # ── Certifications / Training ─────────────────────────────────────────────
    "certifications": re.compile(
        r"^(?:"
        r"certifications?|professional certifications?"
        r"|certificates?|certificate programs?"
        r"|licenses?|licenses?\s*[&/]\s*certifications?"
        r"|credentials?|professional credentials?"
        r"|professional development"
        r"|it certifications?|technical certifications?"
        r"|training|training\s*[&/]\s*certifications?"
        r"|training\s*[&/]\s*development"
        r"|courses?|online courses?|relevant courses?"
        r"|workshops?|seminars?"
        r"|moocs?|e.learning"
        r"|continuing education"
        r")$",
        re.I,
    ),

    # ── Publications ─────────────────────────────────────────────────────────
    "publications": re.compile(
        r"^(?:"
        r"publications?|published work|published articles?"
        r"|research(?: papers?)?|research articles?"
        r"|papers?|journal papers?|conference papers?"
        r"|articles?|journal articles?"
        r"|research work|scholarly work"
        r"|books?|book chapters?"
        r"|technical reports?"
        r")$",
        re.I,
    ),

    # ── Awards / Honours ──────────────────────────────────────────────────────
    "awards": re.compile(
        r"^(?:"
        r"awards?|awards?\s*[&/]\s*honors?"
        r"|honors?|honours?|honors?\s*[&/]\s*awards?"
        r"|achievements?|academic achievements?"
        r"|accomplishments?"
        r"|recognition|recognitions"
        r"|accolades?|distinctions?"
        r"|prizes?|scholarships?"
        r"|fellowships?"
        r"|awards?\s*[&/]\s*scholarships?"
        r"|honors?\s*[&/]\s*scholarships?"
        r")$",
        re.I,
    ),

    # ── Languages ────────────────────────────────────────────────────────────
    "languages": re.compile(
        r"^(?:"
        r"languages?|language skills?"
        r"|spoken languages?|written languages?"
        r"|language proficiency|language abilities"
        r"|foreign languages?|second languages?"
        r"|linguistic skills?"
        r")$",
        re.I,
    ),

    # ── Volunteer / Community ─────────────────────────────────────────────────
    "volunteer": re.compile(
        r"^(?:"
        r"volunteer(?:ing)?|volunteer work|volunteer experience"
        r"|volunteering experience|voluntary work|voluntary experience"
        r"|community service|community involvement|community engagement"
        r"|civic engagement|civic activities"
        r"|social work|social impact"
        r"|non.?profit(?: work)?"
        r"|outreach"
        r")$",
        re.I,
    ),

    # ── Interests / Hobbies ───────────────────────────────────────────────────
    "interests": re.compile(
        r"^(?:"
        r"interests?|personal interests?|professional interests?"
        r"|hobbies|hobby"
        r"|hobbies\s*[&/]\s*interests?|interests?\s*[&/]\s*hobbies"
        r"|extracurricular|extracurricular activities"
        r"|outside interests?|other interests?"
        r"|passions?"
        r")$",
        re.I,
    ),

    # ── References ────────────────────────────────────────────────────────────
    "references": re.compile(
        r"^(?:"
        r"references?|referees?"
        r"|references?\s+available|references?\s+on\s+request"
        r"|professional references?"
        r")$",
        re.I,
    ),

    # ── Leadership ────────────────────────────────────────────────────────────
    "leadership": re.compile(
        r"^(?:"
        r"leadership|leadership experience|leadership roles?"
        r"|leadership\s*[&/]\s*management"
        r"|management experience|managerial experience"
        r"|positions? of leadership"
        r"|student leadership"
        r")$",
        re.I,
    ),

    # ── Activities / Clubs ────────────────────────────────────────────────────
    "activities": re.compile(
        r"^(?:"
        r"activities|activity"
        r"|extracurricular activities|co.?curricular activities"
        r"|campus activities|student activities"
        r"|clubs?\s*[&/]\s*activities"
        r"|clubs?\s*[&/]\s*organizations?"
        r"|organizations?|memberships?"
        r"|professional memberships?|professional affiliations?"
        r"|affiliations?"
        r"|associations?"
        r")$",
        re.I,
    ),

    # ── Research ──────────────────────────────────────────────────────────────
    "research": re.compile(
        r"^(?:"
        r"research|research experience"
        r"|research projects?|research work"
        r"|research interests?|research areas?"
        r"|academic research"
        r"|thesis|dissertation"
        r"|research\s*[&/]\s*publications?"
        r")$",
        re.I,
    ),

    # ── Patents ───────────────────────────────────────────────────────────────
    "patents": re.compile(
        r"^(?:"
        r"patents?|patent applications?"
        r"|inventions?|intellectual property"
        r")$",
        re.I,
    ),
}


# ── Section detection ──────────────────────────────────────────────────────────

def _clean_header_candidate(line: str) -> str:
    """Strip decorative chars and trailing colons from a potential header line."""
    # Remove leading/trailing decoration: --- TITLE ---, === TITLE ===, ** TITLE **, etc.
    stripped = re.sub(r"^[\s=\-_*|~#+•▪▸]+|[\s=\-_*|~#+•▪▸]+$", "", line).strip()
    stripped = stripped.rstrip(":").strip()
    return stripped


def _detect_section(line: str) -> Optional[str]:
    """Return section key if line is a section header, else None."""
    raw = line.strip()
    if not raw:
        return None

    # Skip lines that are pure decoration (no letters)
    if not re.search(r"[A-Za-z]", raw):
        return None

    candidate = _clean_header_candidate(raw)
    if not candidate or len(candidate) > 60:
        return None

    # Skip if looks like a sentence (mid-word period/comma suggesting prose)
    if re.search(r"[.]\s+[a-z]", candidate):
        return None

    for key, pat in _SECTION_MAP.items():
        if pat.match(candidate):
            return key

    return None


def _split_into_sections(lines: list) -> dict:
    """Partition resume lines into named sections."""
    sections: dict = {"header": []}
    current = "header"

    for i, line in enumerate(lines):
        stripped = line.strip()

        # Pure decoration lines (===, ---) — skip
        if stripped and _RE_DECORATION.match(stripped):
            continue

        key = _detect_section(line)
        if key:
            current = key
            sections.setdefault(current, [])
        else:
            sections.setdefault(current, []).append(line)

    return sections


# ── Block grouper ──────────────────────────────────────────────────────────────

def _to_blocks(lines: list) -> list:
    """Split a list of lines into sub-lists separated by blank lines."""
    blocks, cur = [], []
    for line in lines:
        if line.strip():
            cur.append(line.strip())
        elif cur:
            blocks.append(cur)
            cur = []
    if cur:
        blocks.append(cur)
    return blocks


# ── Personal info ──────────────────────────────────────────────────────────────

def _extract_personal(raw_text: str, header_lines: list) -> dict:
    email   = m.group() if (m := _RE_EMAIL.search(raw_text)) else ""
    phone_m = _RE_PHONE.search(raw_text)
    phone   = "".join(filter(None, phone_m.groups())).strip() if phone_m else ""
    linkedin = m.group() if (m := _RE_LINKEDIN.search(raw_text)) else ""
    github   = m.group() if (m := _RE_GITHUB.search(raw_text)) else ""

    # In heuristic mode callers provide the first several resume lines. Only
    # the initial non-empty block is the contact header; later blocks can be
    # job headings such as "Marketing Manager, Acme Corp".
    header_block: list[str] = []
    started_header = False
    for raw_line in header_lines[:25]:
        if raw_line.strip():
            header_block.append(raw_line)
            started_header = True
        elif started_header:
            break

    # Name: first non-contact non-sentence line near the top
    name = ""
    for line in header_block[:15]:
        line = line.strip()
        if not line or len(line) > 80:
            continue
        if _RE_EMAIL.search(line) or _RE_PHONE.search(line) or _RE_URL.search(line):
            continue
        if re.match(r"(?:address|location|phone|tel|email|linkedin|github|website|portfolio|www\.|http)", line, re.I):
            continue
        # Strip decoration (=== NAME ===, --- Name ---, ** Name **) before checking
        clean_line = _clean_header_candidate(line)
        if not clean_line:
            continue
        # Must start with uppercase letter (handles ALL-CAPS names too)
        if not re.match(r"[A-Z]", clean_line):
            continue
        words = clean_line.split()
        # Names are 1–5 words, no special characters except hyphen/apostrophe
        if 1 <= len(words) <= 6:
            # Strip trailing credentials: ", MBA" / "| PhD" / "(B.Tech)"
            clean = re.sub(r"[\|,\(].*$", "", clean_line).strip()
            if clean and 1 <= len(clean.split()) <= 5:
                name = clean
                break

    # Location: "City, ST" / "City, Country"
    location = ""
    loc_re = re.compile(
        r"\b([A-Z][a-zA-Z]+(?:[\s\-][A-Z][a-zA-Z]+)*),\s*([A-Z]{2,3}|[A-Z][a-zA-Z]+(?:[\s\-][A-Z][a-zA-Z]+)*)\b"
    )
    for line in header_block:
        # Contact details and location commonly share a single header line.
        # Remove the contact values instead of dropping the whole line.
        location_line = _RE_EMAIL.sub(" ", line)
        location_line = _RE_PHONE.sub(" ", location_line)
        m = loc_re.search(location_line)
        if m:
            location = m.group()
            break

    return {
        "name": name,
        "email": email,
        "phone": phone,
        "location": location,
        "linkedin": linkedin,
        "github": github,
        "legalStatus": "",
    }


# ── Summary ────────────────────────────────────────────────────────────────────

def _extract_summary(sections: dict, personal: dict | None = None) -> str:
    # 1. Explicit summary section
    lines = sections.get("summary", [])
    text = " ".join(l.strip() for l in lines if l.strip())
    if text:
        return text

    # 2. Fallback: paragraph-like text in the header block
    name  = (personal or {}).get("name", "").lower()
    email = (personal or {}).get("email", "").lower()
    candidate: list[str] = []

    for line in sections.get("header", []):
        line = line.strip()
        if not line or len(line) < 30:
            continue
        ll = line.lower()
        if _RE_EMAIL.search(line) or _RE_PHONE.search(line) or _RE_URL.search(line):
            continue
        if name and ll.startswith(name[:8]):
            continue
        if email and email[:8] in ll:
            continue
        if re.match(
            r"(?:address|location|linkedin|github|website|portfolio|www\.|tel:|ph:|fax:|dob:|date\s+of\s+birth)",
            line, re.I,
        ):
            continue
        # At least 8 words → paragraph-like
        if len(line.split()) >= 8:
            candidate.append(line)

    return " ".join(candidate)


# ── Date utilities ─────────────────────────────────────────────────────────────

def _extract_date_range(line: str) -> tuple[str, str]:
    """Return (date_string, line_without_date). date_string is '' if none found."""
    m = _RE_DATE_RANGE.search(line)
    if m:
        date_str = m.group().strip()
        rest = (line[:m.start()] + line[m.end():]).strip().strip("|,–—/").strip()
        return date_str, rest
    return "", line


def _normalise_date_str(s: str) -> str:
    """Standardise date range separators to ' – ', without touching / inside MM/YYYY."""
    # Only replace spaced dashes or the word 'to' as a separator; never bare /
    return re.sub(r"\s+[-–—]\s+|\s+to\s+", " – ", s.strip(), flags=re.I)


# ── Education ─────────────────────────────────────────────────────────────────

def _parse_edu_block(block: list) -> Optional[dict]:
    entry = {
        "id": str(uuid.uuid4()),
        "degree": "",
        "institution": "",
        "graduationYear": "",
        "gpa": "",
        "achievements": "",
    }
    extra = []

    for line in block:
        # Strip GPA first
        gpa_m = _RE_GPA.search(line)
        if gpa_m:
            if not entry["gpa"]:
                entry["gpa"] = gpa_m.group(1)
            line = _RE_GPA.sub("", line).strip().strip("|, ").strip()
            if not line:
                continue

        date_str, rest = _extract_date_range(line)

        if date_str and not entry["graduationYear"]:
            # Pull the end year from the range
            parts = re.split(r"[-–—/to]+", date_str, maxsplit=1)
            end = parts[-1].strip()
            yr = _RE_YEAR.search(end)
            entry["graduationYear"] = yr.group(1) if yr else end
            line = rest
        elif not date_str and not entry["graduationYear"]:
            # Fallback 1: standalone year on a short line  ("2022", "| 2022", "Class of 2022")
            clean_for_yr = re.sub(r"[|,;:]+", " ", line).strip()
            if len(clean_for_yr.split()) <= 4:
                yr_m = _RE_YEAR.search(clean_for_yr)
                if yr_m:
                    entry["graduationYear"] = yr_m.group(1)
                    line = _RE_YEAR.sub("", line, count=1).strip().strip("|, ").strip()
                    if not line:
                        continue
            # Fallback 2: "Month Year" without a range  ("May 2025", "Expected: May 2025")
            if not entry["graduationYear"]:
                myr_m = _RE_MONTH_YEAR.search(line)
                if myr_m:
                    entry["graduationYear"] = f"{myr_m.group(1)} {myr_m.group(2)}"
                    line = (line[:myr_m.start()] + line[myr_m.end():]).strip().strip("|, ").strip()
                    if not line:
                        continue

        if not line:
            continue

        deg_m = _RE_DEGREE.search(line)
        if deg_m:
            if "|" in line:
                # "Degree | Institution" on same line
                parts = [p.strip() for p in line.split("|", 1)]
                clean_deg = _RE_YEAR.sub("", parts[0]).strip().strip("|– ,").strip()
                if not entry["degree"] and clean_deg:
                    entry["degree"] = clean_deg
                if len(parts) > 1 and not entry["institution"]:
                    inst = _RE_YEAR.sub("", parts[1]).strip().strip("|, ").strip()
                    if inst:
                        entry["institution"] = inst
            else:
                clean = _RE_YEAR.sub("", line).strip().strip("|– ,").strip()
                if not entry["degree"] and clean:
                    entry["degree"] = clean
        elif not entry["institution"] and line.strip():
            entry["institution"] = line.strip()
        elif line.strip():
            extra.append(line.strip())

    if not entry["institution"] and extra:
        entry["institution"] = extra.pop(0)

    entry["achievements"] = " | ".join(extra)
    if entry["degree"] or entry["institution"]:
        return entry
    return None


def _extract_education(sections: dict) -> list:
    all_lines = [l.strip() for l in sections.get("education", []) if l.strip()]
    if not all_lines:
        return []

    # If blank-line blocks give multiple entries, use them directly
    blocks = _to_blocks(sections.get("education", []))
    if len(blocks) > 1:
        return [e for b in blocks for e in [_parse_edu_block(b)] if e]

    # Single block (no blank separators) — anchor on date-range lines OR degree keywords
    anchor_indices: list[int] = []
    for i, line in enumerate(all_lines):
        if _RE_BULLET.match(line):
            continue
        if _extract_date_range(line)[0] or _RE_DEGREE.search(line):
            anchor_indices.append(i)

    if not anchor_indices:
        e = _parse_edu_block(all_lines)
        return [e] if e else []

    def _edu_start(anchor_idx: int) -> int:
        """Walk backward from an anchor to find the education entry start."""
        start = anchor_idx
        for back in range(1, 3):   # institution name is 1–2 lines before
            look = anchor_idx - back
            if look < 0:
                break
            prev = all_lines[look]
            if (
                _RE_BULLET.match(prev)
                or _extract_date_range(prev)[0]
                or _RE_DEGREE.search(prev)
                or len(prev) > 80
            ):
                break
            start = look
        return start

    raw_starts = sorted(set(_edu_start(i) for i in anchor_indices))
    # Two adjacent degree lines are separate education entries. A date line
    # immediately after a degree belongs to that same entry instead.
    degree_starts = {
        _edu_start(i) for i in anchor_indices
        if _RE_DEGREE.search(all_lines[i])
    }

    # Merge starts that are within 2 lines of each other (belong to same entry)
    merged: list[int] = [raw_starts[0]]
    for s in raw_starts[1:]:
        if s in degree_starts or s - merged[-1] >= 2:
            merged.append(s)

    if merged[0] > 0:
        merged = [0] + merged

    results = []
    for i, start in enumerate(merged):
        end = merged[i + 1] if i + 1 < len(merged) else len(all_lines)
        block = all_lines[start:end]
        if not block:
            continue
        e = _parse_edu_block(block)
        if e:
            results.append(e)
    return results


# ── Experience ────────────────────────────────────────────────────────────────

def _split_exp_lines_into_entries(lines: list) -> list[list]:
    """
    For unformatted blocks where entries aren't blank-line separated,
    detect entry boundaries: a non-bullet date line that appears AFTER
    description bullets signals the start of a new job entry.

    When a boundary is found we roll back any trailing non-bullet lines
    (job title / company of the incoming entry) so they stay with the new
    entry instead of being appended to the previous one's description.
    """
    entries: list[list] = []
    current: list = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                entries.append(current)
                current = []
            continue

        date_str, _ = _extract_date_range(stripped)
        is_bullet = bool(_RE_BULLET.match(stripped))
        # Have we accumulated any description bullets in the current entry?
        has_bullets = any(_RE_BULLET.match(l) for l in current)

        # A non-bullet date after we've seen description bullets → new entry
        if date_str and not is_bullet and has_bullets:
            # Roll back trailing non-bullet lines — they belong to the new
            # entry's header (job title, company name), not the old description.
            carry: list = []
            while current and not _RE_BULLET.match(current[-1]):
                carry.insert(0, current.pop())

            if current:
                entries.append(current)
            # Start the new entry with the rolled-back header lines
            current = carry

        current.append(stripped)

    if current:
        entries.append(current)
    return entries


def _parse_exp_block(block: list) -> Optional[dict]:
    entry = {
        "id": str(uuid.uuid4()),
        "jobTitle": "",
        "company": "",
        "dates": "",
        "location": "",
        "description": "",
    }
    desc_lines: list[str] = []
    header_lines: list[str] = []  # first few non-bullet non-desc lines

    # Separate header lines from description
    header_done = False
    for i, line in enumerate(block):
        stripped = line.strip()
        is_bullet = bool(_RE_BULLET.match(stripped))

        if is_bullet:
            header_done = True

        if header_done:
            desc_lines.append(re.sub(r"^[\s]*[•\-\*▸▪‣◦✓→✦◆▶»·]\s*", "", stripped))
        else:
            header_lines.append(stripped)
            # A date closes the job heading. Following lines are the job
            # description, including plain paragraphs without bullet points.
            date_str, _ = _extract_date_range(stripped)
            if date_str:
                entry["dates"] = _normalise_date_str(date_str)
                header_done = True

    # Parse the header lines for title, company, location
    for line in header_lines:
        if not line:
            continue

        date_str, rest = _extract_date_range(line)
        if date_str:
            if not entry["dates"]:
                entry["dates"] = _normalise_date_str(date_str)
            line = rest  # always strip the date portion from the line

        if not line:
            continue

        # Location heuristic
        loc_m = re.match(r"^([A-Z][a-zA-Z]+(?:[\s\-][A-Z][a-zA-Z]+)*),\s*([A-Z]{2}|[A-Z][a-zA-Z]+)$", line)
        if loc_m and not entry["location"] and not _RE_JOB_TITLE_WORDS.search(line):
            entry["location"] = line
            continue

        # Title | Company  or  Title, Company
        if "|" in line:
            parts = [p.strip().strip("|, ").strip() for p in line.split("|", 1)]
            if not entry["jobTitle"] and parts[0]:
                entry["jobTitle"] = parts[0]
            if not entry["company"] and len(parts) > 1 and parts[1]:
                entry["company"] = parts[1]
            continue

        # Title at Company / Title @ Company
        at_m = re.search(r"\s+(?:at|@|with|for)\s+", line, re.I)
        if at_m:
            title_part   = line[:at_m.start()].strip()
            company_part = line[at_m.end():].strip()
            if not entry["jobTitle"] and title_part:
                entry["jobTitle"] = title_part
            if not entry["company"] and company_part:
                entry["company"] = company_part
            continue

        # Title/Company detection
        has_title_word = bool(_RE_JOB_TITLE_WORDS.search(line))
        if not entry["jobTitle"] and has_title_word:
            entry["jobTitle"] = line
        elif not entry["jobTitle"] and not entry["company"]:
            # First unclassified non-blank line is probably the title
            entry["jobTitle"] = line
        elif not entry["company"]:
            entry["company"] = line

    # If only company found, swap (company is usually listed second)
    if entry["company"] and not entry["jobTitle"]:
        entry["jobTitle"], entry["company"] = entry["company"], entry["jobTitle"]

    # Build description — handle both bullets and paragraphs
    cleaned = []
    for l in desc_lines[:15]:
        l = re.sub(r"^[\s]*[•\-\*▸▪‣◦✓→✦◆▶»·]\s*", "", l).strip()
        if l:
            cleaned.append(l)

    if cleaned:
        entry["description"] = (
            "<ul>" + "".join(f"<li>{l}</li>" for l in cleaned) + "</ul>"
        )

    if entry["jobTitle"] or entry["company"]:
        return entry
    return None


def _extract_experience(sections: dict) -> list:
    """
    Split the experience section into individual job entries.

    Blank lines in PDFs are unreliable — they often appear *within* a job's
    description (between bullet groups) or are absent between jobs entirely.
    Instead of splitting on blank lines we:
      1. Flatten all lines (strip blanks).
      2. Find every non-bullet line that contains a date range — these are
         "date header" lines that anchor the start of a job entry.
      3. Walk backward from each date to find the real start of that entry
         (job title and company name come before the date, not after it).
      4. Slice and parse the resulting per-entry blocks.
    """
    all_lines = [l.strip() for l in sections.get("experience", []) if l.strip()]
    if not all_lines:
        return []

    # Locate every non-bullet date line (these anchor job-entry headers)
    date_line_indices: list[int] = []
    for i, line in enumerate(all_lines):
        date_str, _ = _extract_date_range(line)
        if date_str and not _RE_BULLET.match(line):
            date_line_indices.append(i)

    # Fallback: no dates found — parse whole section as one entry
    if not date_line_indices:
        e = _parse_exp_block(all_lines)
        return [e] if e else []

    def _entry_start(date_idx: int) -> int:
        """Walk backward from a date line to find the job-entry start."""
        start = date_idx
        for back in range(1, 4):   # title + company + optional location = 3 max
            look = date_idx - back
            if look < 0:
                break
            prev = all_lines[look]
            prev_date, _ = _extract_date_range(prev)
            if (
                _RE_BULLET.match(prev)            # hit a description bullet → stop
                or prev_date                       # hit another date → stop
                or len(prev) > 80                 # long sentence = description → stop
                or re.search(r"[.!?]\s*$", prev) # sentence-ending punct → stop
            ):
                break
            start = look
        return start

    # Compute entry start for each date line and deduplicate
    entry_starts = sorted(set(_entry_start(i) for i in date_line_indices))

    # Any content before the first detected start belongs to the first entry
    if entry_starts[0] > 0:
        entry_starts = [0] + entry_starts

    results = []
    for i, start in enumerate(entry_starts):
        end = entry_starts[i + 1] if i + 1 < len(entry_starts) else len(all_lines)
        block = all_lines[start:end]
        if not block:
            continue
        e = _parse_exp_block(block)
        if e:
            results.append(e)
    return results


# ── Skills ────────────────────────────────────────────────────────────────────

def _tokenize_skills(text: str) -> list[str]:
    # Remove proficiency annotations like "(Expert)" or "– 5 years"
    text = re.sub(r"\s*[\(\[–\-]+\s*(?:expert|advanced|intermediate|beginner|proficient|basic|\d+\s*(?:yrs?|years?))[^\)\]]*[\)\]]?", "", text, flags=re.I)
    tokens = re.split(r"[,;|•·\t/\n]+", text)
    return [t.strip().strip("•–-·* ") for t in tokens if 2 <= len(t.strip()) < 60]


def _extract_skills(sections: dict) -> list:
    lines = sections.get("skills", [])
    if not lines:
        return []

    grouped: dict[str, list] = {}
    current_cat = "Technical Skills"

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Remove bullet
        line = re.sub(r"^[•\-\*▸▪‣◦✓→]\s*", "", line).strip()
        if not line:
            continue

        # "Category: skill1, skill2, ..."
        colon_m = re.match(r"^([A-Za-z][A-Za-z\s&/()]{2,40}):\s*(.+)$", line)
        if colon_m:
            cat  = colon_m.group(1).strip()
            rest = colon_m.group(2).strip()
            current_cat = cat
            grouped.setdefault(cat, []).extend(_tokenize_skills(rest))
            continue

        # Short line that looks like a category heading (≤4 words, starts uppercase, no commas/bullets)
        if (
            len(line.split()) <= 4
            and re.match(r"^[A-Z]", line)
            and not re.search(r"[,;|]", line)
            and not _RE_DATE_RANGE.search(line)
        ):
            current_cat = line
            continue

        grouped.setdefault(current_cat, []).extend(_tokenize_skills(line))
    result = []
    for cat, skill_list in grouped.items():
        seen: set = set()
        unique = []
        for s in skill_list:
            if s and s.lower() not in seen:
                seen.add(s.lower())
                unique.append(s)
        if unique:
            result.append({
                "id": str(uuid.uuid4()),
                "category": cat,
                "skills_list": ", ".join(unique),
            })
    return result


# ── Projects ──────────────────────────────────────────────────────────────────

def _parse_project_block(block: list) -> Optional[dict]:
    """Parse a single project entry block into a structured dict."""
    if not block:
        return None

    title    = ""
    date_str = ""
    desc_lines: list[str] = []

    # ── First line: title (may include date or tech via "|") ─────────────────
    first = re.sub(r"^[•\-\*▸▪‣◦✓→✦◆▶»·]\s*", "", block[0]).strip()

    if "|" in first:
        parts = [p.strip() for p in first.split("|")]
        title = parts[0].strip()
        for part in parts[1:]:
            d, _ = _extract_date_range(part)
            if d and not date_str:
                date_str = d
            elif not date_str:
                # Standalone year in a pipe segment ("Title | React | 2023")
                yr_m = _RE_YEAR.search(part)
                if yr_m and len(part.split()) <= 3:
                    date_str = yr_m.group(1)
    else:
        d, rest = _extract_date_range(first)
        if d:
            date_str = d
            title = rest.strip("|, ").strip() or first
        else:
            # Standalone year at end of title line ("Title 2023" or "Title – 2023")
            yr_m = re.search(r"\s[-–—]?\s*\b((?:19|20)\d{2})\b\s*$", first)
            if yr_m:
                date_str = yr_m.group(1)
                title = first[:yr_m.start()].strip()
            else:
                title = first

    if not title:
        return None

    # ── Remaining lines ───────────────────────────────────────────────────────
    header_done = False
    for line in block[1:]:
        ls   = line.strip()
        clean = re.sub(r"^[•\-\*▸▪‣◦✓→✦◆▶»·]\s*", "", ls).strip()
        is_bullet = bool(_RE_BULLET.match(ls))

        if is_bullet:
            header_done = True
            if clean:
                desc_lines.append(clean)
            continue

        if not header_done:
            # Non-bullet line before first bullet → could be date or tech stack
            d, rest = _extract_date_range(ls)
            if d and not date_str:
                date_str = d
                if rest.strip():
                    desc_lines.append(rest.strip())
            elif not date_str:
                yr_m = _RE_YEAR.search(ls)
                if yr_m and len(ls.split()) <= 3:
                    date_str = yr_m.group(1)
                elif clean:
                    desc_lines.append(clean)   # tech stack / subtitle line
            elif clean:
                desc_lines.append(clean)
        else:
            if clean:
                desc_lines.append(clean)

    description = (
        "<ul>" + "".join(f"<li>{l}</li>" for l in desc_lines[:12]) + "</ul>"
        if desc_lines else ""
    )
    return {
        "id":          str(uuid.uuid4()),
        "title":       title,
        "date":        date_str,
        "description": description,
    }


def _extract_projects(sections: dict) -> list:
    all_lines = [l.strip() for l in sections.get("projects", []) if l.strip()]
    if not all_lines:
        return []

    # Blank-line separation is reliable when present
    blocks = _to_blocks(sections.get("projects", []))
    if len(blocks) > 1:
        return [p for b in blocks for p in [_parse_project_block(b)] if p]

    # Single block (no blank lines) — use date lines as primary anchors
    date_line_indices = [
        i for i, line in enumerate(all_lines)
        if not _RE_BULLET.match(line) and _extract_date_range(line)[0]
    ]

    if date_line_indices:
        def _proj_start(date_idx: int) -> int:
            start = date_idx
            for back in range(1, 4):
                look = date_idx - back
                if look < 0:
                    break
                prev = all_lines[look]
                if (_RE_BULLET.match(prev) or _extract_date_range(prev)[0] or len(prev) > 80):
                    break
                start = look
            return start

        entry_starts = sorted(set(_proj_start(i) for i in date_line_indices))
        if entry_starts[0] > 0:
            entry_starts = [0] + entry_starts
    else:
        # No dates → split where a non-bullet line appears after one or more bullets
        entry_starts = [0]
        saw_bullets  = False
        for i, line in enumerate(all_lines[1:], start=1):
            is_bullet = bool(_RE_BULLET.match(line))
            if is_bullet:
                saw_bullets = True
            elif saw_bullets:
                entry_starts.append(i)
                saw_bullets = False

    if len(entry_starts) <= 1:
        p = _parse_project_block(all_lines)
        return [p] if p else []

    results = []
    for i, start in enumerate(entry_starts):
        end = entry_starts[i + 1] if i + 1 < len(entry_starts) else len(all_lines)
        block = all_lines[start:end]
        if not block:
            continue
        p = _parse_project_block(block)
        if p:
            results.append(p)
    return results


# ── Certifications ────────────────────────────────────────────────────────────

def _extract_certifications(sections: dict) -> list:
    results = []
    for line in sections.get("certifications", []):
        line = line.strip()
        if not line:
            continue
        line = re.sub(r"^[•\-\*▸▪‣◦✓→]\s*", "", line).strip()
        if not line:
            continue

        date_str, name = _extract_date_range(line)
        name = name.strip("|, ").strip()

        # Try to separate "Name – Issuer" or "Name | Issuer"
        issuer = ""
        sep_m = re.search(r"\s*[|–—]\s*", name)
        if sep_m:
            parts = [name[:sep_m.start()].strip(), name[sep_m.end():].strip()]
            # Heuristic: issuer is shorter and looks like an org name
            if parts[1] and len(parts[1]) < len(parts[0]):
                name, issuer = parts[0], parts[1]

        if name:
            results.append({
                "id": str(uuid.uuid4()),
                "name": name,
                "issuer": issuer,
                "date": date_str,
            })
    return results


# ── Publications ──────────────────────────────────────────────────────────────

def _extract_publications(sections: dict) -> list:
    blocks = _to_blocks(sections.get("publications", []))
    results = []
    for block in blocks:
        if block:
            results.append({
                "id": str(uuid.uuid4()),
                "title": block[0],
                "authors": block[1] if len(block) > 1 else "",
                "journal": block[2] if len(block) > 2 else "",
                "date": "",
                "link": "",
            })
    return results


# ── Fallback: heuristic parse when no sections found ──────────────────────────

def _heuristic_parse(text: str, lines: list) -> dict:
    """
    Last-resort parse for completely unformatted resumes.
    Uses date-range anchors to identify experience blocks
    and degree keywords to identify education blocks.
    """
    personal: dict = _extract_personal(text, lines[:30])

    experience = []
    education  = []
    skills: list = []

    blocks = _to_blocks(lines)

    for block in blocks:
        full = " ".join(block)

        # Education block: contains a degree keyword
        if _RE_DEGREE.search(full):
            e = _parse_edu_block(block)
            if e:
                education.append(e)
            continue

        # Experience block: contains a date range and something job-like
        if _RE_DATE_RANGE.search(full) and (
            _RE_JOB_TITLE_WORDS.search(full) or len(block) >= 3
        ):
            e = _parse_exp_block(block)
            if e:
                experience.append(e)
            continue

        # Skills block: no sentences, lots of comma/bullet separation
        comma_density = full.count(",") + full.count(";") + full.count("•")
        word_count = len(full.split())
        if word_count > 3 and comma_density / max(word_count, 1) > 0.1:
            toks = _tokenize_skills(full)
            if toks:
                skills.append({
                    "id": str(uuid.uuid4()),
                    "category": "Technical Skills",
                    "skills_list": ", ".join(toks),
                })

    return {
        "personal":       personal,
        "summary":        "",
        "experience":     experience,
        "education":      education,
        "skills":         skills,
        "projects":       [],
        "certifications": [],
        "publications":   [],
    }


# ── Public API ─────────────────────────────────────────────────────────────────



# ── Languages / Volunteer / Awards extractors ────────────────────────────────
# These sections were detected by _split_into_sections but previously had no
# extractors — their content was silently discarded.

_RE_LANG_PROF = re.compile(
    r"^(?P<lang>[A-Za-z][A-Za-z\s]{1,30}?)\s*(?:[-–—:(]|\s{2,})\s*"
    r"(?P<prof>native|fluent|professional(?:\s+working)?(?:\s+proficiency)?|"
    r"conversational|intermediate|basic|beginner|advanced|bilingual|elementary)"
    r"\)?\s*$", re.IGNORECASE)

_PROF_MAP = {
    'native': 'Native', 'bilingual': 'Native', 'fluent': 'Fluent',
    'advanced': 'Fluent', 'professional': 'Professional',
    'professional working': 'Professional', 'professional working proficiency': 'Professional',
    'intermediate': 'Conversational', 'conversational': 'Conversational',
    'basic': 'Basic', 'beginner': 'Basic', 'elementary': 'Basic',
}

def _extract_languages(sections: dict) -> list:
    lines = sections.get("languages", [])
    out = []
    for line in lines:
        line = re.sub(r"^[•\-\*▸▪‣◦✓→]\s*", "", line.strip())
        if not line:
            continue
        m = _RE_LANG_PROF.match(line)
        if m:
            prof_raw = m.group('prof').lower().strip()
            out.append({"language": m.group('lang').strip().title(),
                        "proficiency": _PROF_MAP.get(prof_raw, prof_raw.title())})
            continue
        # Comma/pipe separated list without proficiencies: "English, Hindi, Telugu"
        for tok in re.split(r"[,|;/]", line):
            tok = tok.strip()
            if tok and len(tok) <= 30 and re.match(r"^[A-Za-z][A-Za-z\s]+$", tok):
                out.append({"language": tok.title(), "proficiency": "Conversational"})
    return out


def _extract_awards(sections: dict) -> list:
    lines = sections.get("awards", [])
    out = []
    for line in lines:
        line = re.sub(r"^[•\-\*▸▪‣◦✓→]\s*", "", line.strip())
        if not line:
            continue
        # Trailing year/date → date field
        date = ""
        dm = re.search(r"[\(,\s–—-]\s*((?:19|20)\d{2})\s*\)?\s*$", line)
        if dm:
            date = dm.group(1)
            line = line[:dm.start()].strip().rstrip(',–—-(').strip()
        # "Title — Organization" or "Title, Organization"
        title, org = line, ""
        sm = re.split(r"\s+[–—-]\s+|,\s+(?=[A-Z])", line, maxsplit=1)
        if len(sm) == 2:
            title, org = sm[0].strip(), sm[1].strip()
        out.append({"title": title, "organization": org, "date": date, "description": ""})
    return out


def _extract_volunteer(sections: dict) -> list:
    lines = [l for l in sections.get("volunteer", []) if l.strip()]
    if not lines:
        return []
    entries = []
    current = None
    for line in lines:
        stripped = line.strip()
        is_bullet = bool(re.match(r"^[•\-\*▸▪‣◦✓→]", stripped))
        clean = re.sub(r"^[•\-\*▸▪‣◦✓→]\s*", "", stripped)
        has_date = bool(_RE_DATE_RANGE.search(clean))
        if not is_bullet and (current is None or has_date or
                              (current and current["_desc"])):
            # Header line → start a new entry
            role, org, dates = clean, "", ""
            dmatch = _RE_DATE_RANGE.search(clean)
            if dmatch:
                dates = dmatch.group(0)
                role = clean[:dmatch.start()].strip().rstrip(',|–—-').strip()
            parts = re.split(r"\s+[–—-]\s+|,\s+|\s+at\s+|\s+@\s+", role, maxsplit=1)
            if len(parts) == 2:
                role, org = parts[0].strip(), parts[1].strip()
            current = {"role": role, "organization": org, "dates": dates, "_desc": []}
            entries.append(current)
        elif current is not None:
            current["_desc"].append(clean)
        else:
            current = {"role": clean, "organization": "", "dates": "", "_desc": []}
            entries.append(current)
    out = []
    for e in entries:
        desc = ""
        if e["_desc"]:
            desc = "<ul>" + "".join(f"<li>{d}</li>" for d in e["_desc"]) + "</ul>"
        out.append({"role": e["role"], "organization": e["organization"],
                    "dates": e["dates"], "description": desc})
    return out


# ── Leadership ────────────────────────────────────────────────────────────────
# Reuses the same entry-parsing logic as volunteer (role / org / dates / desc)

def _extract_leadership(sections: dict) -> list:
    """Parse Leadership / Management Experience section into role-style entries."""
    lines = [l for l in sections.get("leadership", []) if l.strip()]
    if not lines:
        return []
    entries = []
    current: dict | None = None
    for line in lines:
        stripped = line.strip()
        is_bullet = bool(re.match(r"^[•\-\*▸▪‣◦✓→]", stripped))
        clean = re.sub(r"^[•\-\*▸▪‣◦✓→]\s*", "", stripped)
        has_date = bool(_RE_DATE_RANGE.search(clean))
        if not is_bullet and (current is None or has_date or (current and current["_desc"])):
            role, org, dates = clean, "", ""
            dm = _RE_DATE_RANGE.search(clean)
            if dm:
                dates = dm.group(0)
                role = clean[:dm.start()].strip().rstrip(',|–—-').strip()
            parts = re.split(r"\s+[–—-]\s+|,\s+|\s+at\s+|\s+@\s+", role, maxsplit=1)
            if len(parts) == 2:
                role, org = parts[0].strip(), parts[1].strip()
            current = {"role": role, "organization": org, "dates": dates, "_desc": []}
            entries.append(current)
        elif current is not None:
            current["_desc"].append(clean)
        else:
            current = {"role": clean, "organization": "", "dates": "", "_desc": []}
            entries.append(current)
    out = []
    for e in entries:
        desc = "<ul>" + "".join(f"<li>{d}</li>" for d in e["_desc"]) + "</ul>" if e["_desc"] else ""
        out.append({"role": e["role"], "organization": e["organization"],
                    "dates": e["dates"], "description": desc})
    return out


# ── Activities / Memberships ───────────────────────────────────────────────────

def _extract_activities(sections: dict) -> list:
    """Parse Activities / Clubs / Memberships section."""
    out = []
    for line in sections.get("activities", []):
        line = re.sub(r"^[•\-\*▸▪‣◦✓→]\s*", "", line.strip())
        if not line:
            continue
        date_str, rest = _extract_date_range(line)
        name = rest.strip("|, ").strip() if date_str else line
        # "Role — Organization" split
        org = ""
        sm = re.split(r"\s+[–—-]\s+|,\s+(?=[A-Z])|\s+at\s+|\s+@\s+", name, maxsplit=1)
        if len(sm) == 2:
            name, org = sm[0].strip(), sm[1].strip()
        if name:
            out.append({"activity": name, "organization": org, "dates": date_str})
    return out


# ── Research ──────────────────────────────────────────────────────────────────

def _extract_research(sections: dict) -> list:
    """Parse Research section into project-style entries."""
    all_lines = [l.strip() for l in sections.get("research", []) if l.strip()]
    if not all_lines:
        return []
    # Reuse the project block parser — research entries look identical
    blocks = _to_blocks(sections.get("research", []))
    if len(blocks) > 1:
        return [p for b in blocks for p in [_parse_project_block(b)] if p]
    p = _parse_project_block(all_lines)
    return [p] if p else []


# ── Patents ───────────────────────────────────────────────────────────────────

def _extract_patents(sections: dict) -> list:
    """Parse Patents section — one line per patent."""
    out = []
    for line in sections.get("patents", []):
        line = re.sub(r"^[•\-\*▸▪‣◦✓→]\s*", "", line.strip())
        if not line:
            continue
        date_str, rest = _extract_date_range(line)
        title = rest.strip("|, ").strip() if date_str else line
        # Patent number heuristic: "US1234567" or "#1234567"
        number = ""
        nm = re.search(r"\b(?:US|EP|WO|CN|IN|JP)?\s*#?\d{6,12}\b", title)
        if nm:
            number = nm.group().strip()
            title = (title[:nm.start()] + title[nm.end():]).strip().strip(',|–').strip()
        if title:
            out.append({"title": title, "number": number, "date": date_str})
    return out


def parse_resume_text(text: str) -> dict:
    """
    Parse structured data from extracted resume text.
    Returns a dict matching the schema used by gemini_utils / ollama_utils.
    """
    text = _normalise(text)

    lines = [l.rstrip() for l in text.splitlines()]
    sections = _split_into_sections(lines)
    header_lines = sections.get("header", [])

    # Detect if we found NO sections at all (entirely unformatted)
    content_sections = {k: v for k, v in sections.items() if k != "header" and any(l.strip() for l in v)}
    if not content_sections:
        return _heuristic_parse(text, lines)

    personal = _extract_personal(text, header_lines)
    return {
        "personal":        personal,
        "summary":         _extract_summary(sections, personal),
        "experience":      _extract_experience(sections),
        "education":       _extract_education(sections),
        "skills":          _extract_skills(sections),
        "projects":        _extract_projects(sections),
        "certifications":  _extract_certifications(sections),
        "publications":    _extract_publications(sections),
        "languages":       _extract_languages(sections),
        "volunteer":       _extract_volunteer(sections),
        "awards":          _extract_awards(sections),
        # ── New sections ──────────────────────────────────────────────────────
        "leadership":      _extract_leadership(sections),
        "activities":      _extract_activities(sections),
        "research":        _extract_research(sections),
        "patents":         _extract_patents(sections),
    }


def parse_resume_data_custom(raw_resume_text: str) -> dict:
    """Alias kept for backward compatibility."""
    return parse_resume_text(raw_resume_text)


def parse_resume(file_bytes: bytes, filename: str) -> dict:
    """Full pipeline: file bytes → structured resume dict."""
    text = extract_text(file_bytes, filename)
    return parse_resume_text(text)
