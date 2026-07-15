from custom_parser import parse_resume_text

# Test 1: structured resume with ALL-CAPS headers
text1 = """
John Doe
johndoe@email.com | +1 (555) 123-4567 | New York, NY

SUMMARY
Senior software engineer with 8+ years building scalable backend systems.

EXPERIENCE
Software Engineer | Google
2019 - 2023
- Built distributed systems handling 1M+ requests/day
- Led team of 5 engineers

Junior Developer at Microsoft
Jan 2017 - Dec 2018
Developed internal tools using Python and React.

EDUCATION
B.S. Computer Science
MIT
2013 - 2017 | GPA: 3.9

SKILLS
Languages: Python, Java, Go, TypeScript
Tools: Docker, Kubernetes, Terraform
Databases: PostgreSQL, Redis, MongoDB
"""

r1 = parse_resume_text(text1)
print("[TEST 1: Structured ALL-CAPS headers]")
p = r1["personal"]
print(f"  Name:       {p['name']}")
print(f"  Email:      {p['email']}")
print(f"  Experience: {len(r1['experience'])} entries")
print(f"  Education:  {len(r1['education'])} entries")
print(f"  Skills:     {len(r1['skills'])} categories")
for e in r1["experience"]:
    print(f"    Exp: {e['jobTitle']} @ {e['company']}  dates={e['dates']}")
for ed in r1["education"]:
    print(f"    Edu: {ed['degree']} | {ed['institution']}  year={ed['graduationYear']}")
for s in r1["skills"]:
    print(f"    Skill cat: {s['category']} -> {s['skills_list'][:60]}")

# Test 2: completely unformatted (no section headers)
text2 = """
Jane Smith
jane.smith@gmail.com
555-987-6543

Experienced marketing analyst with 5 years in digital campaigns and data-driven strategy.

Digital Marketing Manager, Acme Corp, 2020-2023
Managed paid social campaigns with $500K monthly budget. Increased ROI by 40%.

Marketing Analyst, StartupXYZ, 2018 - 2020
Ran A/B tests and SEO optimisation across 3 product lines.

Boston University, B.A. Marketing, 2014-2018, GPA 3.7

Python, SQL, Google Analytics, Tableau, HubSpot, Salesforce
"""

r2 = parse_resume_text(text2)
print()
print("[TEST 2: No section headers (heuristic fallback)]")
p2 = r2["personal"]
print(f"  Name:       {p2['name']}")
print(f"  Experience: {len(r2['experience'])} entries")
print(f"  Education:  {len(r2['education'])} entries")
print(f"  Skills:     {len(r2['skills'])} categories")

# Test 3: decorated headers + month/year dates
text3 = """
=== ALEX JOHNSON ===
alex.johnson@email.com  |  +44 7700 900123  |  London, UK
linkedin.com/in/alexjohnson

--- Professional Experience ---

Full Stack Developer | TechStartup Ltd | Jan 2021 - Present
* Built React frontend serving 50K+ daily users
* Designed REST APIs in Python FastAPI
* Deployed on AWS using Docker/ECS

Software Intern @ BigCorp | 06/2019 - 08/2020
Assisted senior team with debugging and code reviews.

=== Education ===
MSc. Computer Science | University of London | 2018-2020
B.Tech Electronics | IIT Bombay | 2014 - 2018 | CGPA: 8.5/10

--- SKILLS ---
Programming: JavaScript, TypeScript, Python, Go
Frameworks: React, FastAPI, Django, Next.js
Cloud: AWS (EC2, S3, Lambda), GCP, Azure
"""

r3 = parse_resume_text(text3)
print()
print("[TEST 3: Decorated headers + month/year dates]")
p3 = r3["personal"]
print(f"  Name:       {p3['name']}")
print(f"  Phone:      {p3['phone']}")
print(f"  Experience: {len(r3['experience'])} entries")
print(f"  Education:  {len(r3['education'])} entries")
print(f"  Skills:     {len(r3['skills'])} categories")
for e in r3["experience"]:
    print(f"    Exp: {e['jobTitle']} @ {e['company']}  dates={e['dates']}")

print()
print("[OK] All smoke tests passed")
