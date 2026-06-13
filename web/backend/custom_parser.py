# backend/custom_parser.py
import re
import uuid # For generating unique IDs similar to crypto.randomUUID on frontend

def _html_paragraph(text):
    """Converts a plain text block into HTML paragraphs, handling newlines."""
    if not text:
        return ""
    paragraphs = []
    current_paragraph = []
    
    # Split by lines and process
    for line in text.split('\n'):
        stripped_line = line.strip()
        if stripped_line:
            current_paragraph.append(stripped_line)
        else: # Empty line, marks end of a paragraph
            if current_paragraph:
                paragraphs.append("<p>" + " ".join(current_paragraph) + "</p>")
                current_paragraph = []
    if current_paragraph: # Add last paragraph if any
        paragraphs.append("<p>" + " ".join(current_paragraph) + "</p>")

    return "\n".join(paragraphs)

def _html_list(text):
    """Converts text with bullet-like prefixes into an HTML unordered list."""
    if not text:
        return ""
    lines = text.split('\n')
    list_items = []
    for line in lines:
        stripped_line = line.strip()
        if stripped_line:
            # Remove common bullet prefixes and trim
            cleaned_line = re.sub(r'^[*-•]\s*', '', stripped_line).strip()
            if cleaned_line:
                list_items.append(f"<li>{cleaned_line}</li>")
    if list_items:
        return "<ul>\n" + "\n".join(list_items) + "\n</ul>"
    return _html_paragraph(text) # Fallback to paragraph if no list items found

def parse_resume_data_custom(raw_resume_text: str) -> dict:
    """
    Parses raw resume text into a structured JSON object using rule-based extraction.
    This is a deterministic parser and its accuracy depends heavily on resume formatting.
    """
    
    resume_data = {
        "personal": {"name": "", "email": "", "phone": "", "location": "", "legalStatus": ""},
        "summary": "",
        "experience": [],
        "education": [],
        "skills": [],
        "projects": [],
        "publications": [],
        "certifications": []
    }

    # Normalize whitespace for easier parsing
    text = raw_resume_text.strip()
    # Replace multiple newlines with at most two to preserve some paragraph breaks
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Replace multiple spaces with a single space
    text = re.sub(r'[ \t]+', ' ', text)

    lines = text.split('\n')
    current_section = None
    section_content_buffer = []

    # --- Section Headers ---
    # Common headers to look for. Order matters for some overlap (e.g., "Skills" before "Education").
    section_keywords = {
        "SUMMARY": "summary",
        "ABOUT": "summary",
        "PROFILE": "summary",
        "EXPERIENCE": "experience",
        "WORK EXPERIENCE": "experience",
        "PROFESSIONAL EXPERIENCE": "experience",
        "EDUCATION": "education",
        "SKILLS": "skills",
        "TECHNICAL SKILLS": "skills",
        "KEY SKILLS": "skills",
        "PROFESSIONAL SKILLS": "skills",
        "PROJECTS": "projects",
        "PERSONAL PROJECTS": "projects",
        "PUBLICATIONS": "publications",
        "RESEARCH": "publications",
        "CERTIFICATIONS": "certifications",
        "LICENSES & CERTIFICATIONS": "certifications",
    }

    # --- Helper to process a completed section buffer ---
    def process_buffer(section_name, content_lines):
        content_text = "\n".join(content_lines).strip()

        if section_name == "summary":
            resume_data["summary"] = _html_paragraph(content_text)
        elif section_name == "experience":
            # Very basic experience parsing: look for lines that might be job titles/companies
            # This is highly pattern-dependent
            exp_entries = []
            current_exp = {}
            temp_desc_lines = []

            for line in content_lines:
                # Heuristic: A line starting with an uppercase word might be a new entry or job title
                # Or a line containing "at" or "from"
                is_new_entry_candidate = (
                    re.match(r'^[A-Z][A-Za-z0-9\s,&./-]*$', line.strip()) and len(line.strip().split()) <= 5
                ) or " at " in line.lower() or " from " in line.lower()

                if is_new_entry_candidate and temp_desc_lines: # If we have a description for previous entry
                    current_exp["description"] = _html_list("\n".join(temp_desc_lines)) if any(re.match(r'^[*-•]\s*', l.strip()) for l in temp_desc_lines) else _html_paragraph("\n".join(temp_desc_lines))
                    exp_entries.append(current_exp)
                    current_exp = {}
                    temp_desc_lines = []
                
                # Attempt to parse as title/company/dates
                if not current_exp.get("jobTitle"):
                    title_match = re.match(r'(.+?)(?: at (.+?))?\s*\(?([\w\s,-]*?(?:present)?)?\)?$', line.strip())
                    if title_match:
                        current_exp["jobTitle"] = title_match.group(1).strip()
                        current_exp["company"] = title_match.group(2).strip() if title_match.group(2) else ""
                        current_exp["dates"] = title_match.group(3).strip() if title_match.group(3) else ""
                        current_exp["id"] = str(uuid.uuid4())
                    else: # If it doesn't match typical title, it might be a description line.
                        temp_desc_lines.append(line)
                else:
                    temp_desc_lines.append(line)
            
            if current_exp and temp_desc_lines: # Add last entry's description
                current_exp["description"] = _html_list("\n".join(temp_desc_lines)) if any(re.match(r'^[*-•]\s*', l.strip()) for l in temp_desc_lines) else _html_paragraph("\n".join(temp_desc_lines))
                exp_entries.append(current_exp)
            
            resume_data["experience"] = exp_entries

        elif section_name == "education":
            edu_entries = []
            current_edu = {}
            temp_achievements_lines = []

            for line in content_lines:
                # Heuristic: A line containing "Degree" or "University" might be a new entry
                is_new_entry_candidate = "degree" in line.lower() or "university" in line.lower() or "college" in line.lower()

                if is_new_entry_candidate and temp_achievements_lines:
                    current_edu["achievements"] = _html_list("\n".join(temp_achievements_lines)) if any(re.match(r'^[*-•]\s*', l.strip()) for l in temp_achievements_lines) else _html_paragraph("\n".join(temp_achievements_lines))
                    edu_entries.append(current_edu)
                    current_edu = {}
                    temp_achievements_lines = []

                # Attempt to parse: Degree, Institution (Year)
                degree_inst_match = re.match(r'(.+?),\s*(.+?)\s*\(?(\d{4})?\)?(?:\s*GPA:\s*([\d.]+))?', line.strip(), re.IGNORECASE)
                if degree_inst_match:
                    current_edu["degree"] = degree_inst_match.group(1).strip()
                    current_edu["institution"] = degree_inst_match.group(2).strip()
                    current_edu["graduationYear"] = degree_inst_match.group(3) if degree_inst_match.group(3) else ""
                    current_edu["gpa"] = degree_inst_match.group(4) if degree_inst_match.group(4) else ""
                    current_edu["id"] = str(uuid.uuid4())
                else:
                    temp_achievements_lines.append(line)
            
            if current_edu and temp_achievements_lines:
                current_edu["achievements"] = _html_list("\n".join(temp_achievements_lines)) if any(re.match(r'^[*-•]\s*', l.strip()) for l in temp_achievements_lines) else _html_paragraph("\n".join(temp_achievements_lines))
                edu_entries.append(current_edu)

            resume_data["education"] = edu_entries

        elif section_name == "skills":
            skill_categories = []
            current_category = ""
            current_skills_list = []

            for line in content_lines:
                category_match = re.match(r'([A-Za-z0-9\s-]+):\s*(.*)', line.strip())
                if category_match:
                    if current_category: # Save previous category
                        skill_categories.append({
                            "id": str(uuid.uuid4()),
                            "category": current_category,
                            "skills_list": "\n".join(current_skills_list).strip()
                        })
                    current_category = category_match.group(1).strip()
                    current_skills_list = [category_match.group(2).strip()]
                elif current_category: # Continue adding to current category's skills
                    current_skills_list.append(line.strip())
                else: # Skills without a category, put under general
                    if not skill_categories or skill_categories[-1]["category"] != "Technical Skills":
                        skill_categories.append({
                            "id": str(uuid.uuid4()),
                            "category": "Technical Skills",
                            "skills_list": ""
                        })
                        current_category = "Technical Skills"
                    skill_categories[-1]["skills_list"] += "\n" + line.strip()


            if current_category: # Add the last category
                skill_categories.append({
                    "id": str(uuid.uuid4()),
                    "category": current_category,
                    "skills_list": "\n".join(current_skills_list).strip()
                })
            
            resume_data["skills"] = skill_categories

        elif section_name == "projects":
            proj_entries = []
            current_proj = {}
            temp_desc_lines = []

            for line in content_lines:
                # Heuristic: a line containing "Project:" or "Title:" or a date pattern (e.g., "(202X)")
                is_new_entry_candidate = "project:" in line.lower() or "title:" in line.lower() or re.search(r'\(\d{4}\)', line)

                if is_new_entry_candidate and temp_desc_lines:
                    current_proj["description"] = _html_list("\n".join(temp_desc_lines)) if any(re.match(r'^[*-•]\s*', l.strip()) for l in temp_desc_lines) else _html_paragraph("\n".join(temp_desc_lines))
                    proj_entries.append(current_proj)
                    current_proj = {}
                    temp_desc_lines = []
                
                # Attempt to parse: Title (Date)
                title_date_match = re.match(r'(.+?)\s*\(?([\w\s,-]*?\d{4})?\)?$', line.strip())
                if title_date_match:
                    current_proj["title"] = title_date_match.group(1).strip()
                    current_proj["date"] = title_date_match.group(2).strip() if title_date_match.group(2) else ""
                    current_proj["id"] = str(uuid.uuid4())
                else:
                    temp_desc_lines.append(line)
            
            if current_proj and temp_desc_lines:
                current_proj["description"] = _html_list("\n".join(temp_desc_lines)) if any(re.match(r'^[*-•]\s*', l.strip()) for l in temp_desc_lines) else _html_paragraph("\n".join(temp_desc_lines))
                proj_entries.append(current_proj)
            
            resume_data["projects"] = proj_entries
        
        # Add similar logic for publications and certifications as needed

    # --- Initial Scan for Personal Info (usually at the very top) ---
    personal_info_lines = []
    contact_info_patterns = {
        "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        "phone": r'(\+?\d{1,3}[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b',
        "location": r'\b[A-Za-z\s,]+(?:,\s*[A-Z]{2})?\s*(?:-\s*[A-Za-z\s,]+(?:,\s*[A-Z]{2})?)?\b' # Basic city, state, country
    }
    
    parsed_contact = {
        "email": "",
        "phone": "",
        "location": ""
    }
    
    name_found = False
    for i, line in enumerate(lines):
        stripped_line = line.strip()
        if not stripped_line:
            continue
        
        # Simple Name Heuristic: First non-empty, non-contact line, usually all caps or bold
        if not name_found and not re.search(r'|'.join(contact_info_patterns.values()), stripped_line, re.IGNORECASE):
             if len(stripped_line.split()) <= 4 and stripped_line.isupper() or (stripped_line[0].isupper() and len(stripped_line.split()) <= 3):
                resume_data["personal"]["name"] = stripped_line
                name_found = True
                continue

        # Extract contact info
        for key, pattern in contact_info_patterns.items():
            if not parsed_contact[key]:
                match = re.search(pattern, stripped_line)
                if match:
                    parsed_contact[key] = match.group(0).strip()
        
        # If we've found name and all contact info, break personal info scan
        if name_found and all(parsed_contact.values()):
            break

    resume_data["personal"].update(parsed_contact)

    # --- Main Section Parsing Loop ---
    for i, line in enumerate(lines):
        stripped_line = line.strip()
        if not stripped_line:
            continue

        is_section_header = False
        for keyword_upper, section_tag in section_keywords.items():
            if stripped_line.upper().startswith(keyword_upper): # Check for section header
                if current_section and section_content_buffer:
                    process_buffer(current_section, section_content_buffer)
                current_section = section_tag
                section_content_buffer = [] # Reset buffer for new section
                is_section_header = True
                break
        
        if not is_section_header:
            if current_section:
                section_content_buffer.append(line)
            # else: pre-section content can be handled as part of summary or discarded

    # Process the last buffered section
    if current_section and section_content_buffer:
        process_buffer(current_section, section_content_buffer)
        
    return resume_data