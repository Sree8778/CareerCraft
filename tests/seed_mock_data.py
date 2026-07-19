"""
seed_mock_data.py — Populate Firestore with mock jobs and candidate profiles.

Usage:
    python tests/seed_mock_data.py           # insert all data
    python tests/seed_mock_data.py --clear   # delete seed data then re-insert

All seeded documents carry  _seeded: True  so they can be bulk-deleted later.
"""

import sys
import os
import datetime
import argparse

BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..", "web", "backend")
sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

import firebase_admin
from firebase_admin import credentials, firestore

CREDS_PATH = os.path.join(BACKEND_DIR, "credentials", "firebase-adminsdk.json")

if not firebase_admin._apps:
    cred = credentials.Certificate(CREDS_PATH)
    firebase_admin.initialize_app(cred)

db = firestore.client()

TODAY = datetime.datetime.utcnow().strftime("%Y-%m-%d")

# ── Mock recruiter IDs (fictional — just for reference on jobs) ───────────────
RECRUITER_TECHCORP   = "recruiter_techcorp_001"
RECRUITER_DATAFLOW   = "recruiter_dataflow_002"
RECRUITER_DESIGNCO   = "recruiter_designco_003"
RECRUITER_FINTECH    = "recruiter_fintech_004"
RECRUITER_STARTUP    = "recruiter_startup_005"

# ─────────────────────────────────────────────────────────────────────────────
#  MOCK JOBS
# ─────────────────────────────────────────────────────────────────────────────

MOCK_JOBS = [
    # ── Software Engineering ──────────────────────────────────────────────────
    {
        "title": "Senior Frontend Engineer",
        "company": "TechCorp",
        "department": "Engineering",
        "location": "San Francisco, CA",
        "workMode": "Hybrid",
        "jobType": "Full-time",
        "experienceLevel": "Senior",
        "salaryMin": "140000",
        "salaryMax": "180000",
        "salaryVisible": True,
        "skills": "React, TypeScript, Next.js, GraphQL, Tailwind CSS",
        "requirements": [
            "5+ years of frontend development experience",
            "Expert-level React and TypeScript",
            "Experience with Next.js App Router",
            "Strong eye for UI/UX detail",
        ],
        "benefits": ["Health insurance", "401k matching", "Remote Fridays", "Learning budget $2k/yr"],
        "description": (
            "We are looking for a Senior Frontend Engineer to lead the development of our customer-facing "
            "web application. You will work closely with our design and product teams to build beautiful, "
            "performant experiences used by millions of users. Our stack is React 19, Next.js 15, TypeScript, "
            "and GraphQL. You will own entire feature areas from design review through production deployment."
        ),
        "screeningQuestions": [
            {"question": "Do you have 5+ years of React experience?", "type": "boolean", "knockout": True, "knockoutAnswer": "No"},
        ],
        "status": "Open",
        "visaSponsorship": False,
        "recruiterId": RECRUITER_TECHCORP,
        "postedDate": TODAY,
    },
    {
        "title": "Backend Engineer (Python)",
        "company": "TechCorp",
        "department": "Engineering",
        "location": "Remote",
        "workMode": "Remote",
        "jobType": "Full-time",
        "experienceLevel": "Mid",
        "salaryMin": "110000",
        "salaryMax": "145000",
        "salaryVisible": True,
        "skills": "Python, Flask, FastAPI, PostgreSQL, Redis, Docker, AWS",
        "requirements": [
            "3+ years Python backend development",
            "Experience with Flask or FastAPI",
            "Strong SQL and database design skills",
            "Familiarity with Docker and cloud deployment",
        ],
        "benefits": ["Fully remote", "Health insurance", "Home office stipend $1500"],
        "description": (
            "Join TechCorp's backend team to build scalable APIs powering our core platform. "
            "You will design and implement RESTful services, optimize database queries, and integrate "
            "third-party services. We value clean code, thorough testing, and clear documentation."
        ),
        "screeningQuestions": [],
        "status": "Open",
        "visaSponsorship": True,
        "recruiterId": RECRUITER_TECHCORP,
        "postedDate": TODAY,
    },
    {
        "title": "Full-Stack Engineer",
        "company": "Startup Labs",
        "department": "Product Engineering",
        "location": "Austin, TX",
        "workMode": "Hybrid",
        "jobType": "Full-time",
        "experienceLevel": "Mid",
        "salaryMin": "100000",
        "salaryMax": "130000",
        "salaryVisible": True,
        "skills": "React, Node.js, Express, MongoDB, TypeScript, AWS",
        "requirements": [
            "2+ years full-stack experience",
            "Comfortable with React and Node.js",
            "Experience shipping production features end-to-end",
            "Startup mentality — move fast, iterate",
        ],
        "benefits": ["Equity package", "Unlimited PTO", "Health insurance"],
        "description": (
            "Startup Labs is an early-stage fintech startup building the next generation of personal finance tools. "
            "As a Full-Stack Engineer you will be one of the first 10 engineers and will have enormous impact on "
            "architecture decisions. You will work on both frontend and backend, shipping features weekly."
        ),
        "screeningQuestions": [],
        "status": "Open",
        "visaSponsorship": False,
        "recruiterId": RECRUITER_STARTUP,
        "postedDate": TODAY,
    },
    {
        "title": "Junior Software Engineer",
        "company": "TechCorp",
        "department": "Engineering",
        "location": "New York, NY",
        "workMode": "In-office",
        "jobType": "Full-time",
        "experienceLevel": "Entry",
        "salaryMin": "75000",
        "salaryMax": "95000",
        "salaryVisible": True,
        "skills": "Python, JavaScript, Git, REST APIs, SQL",
        "requirements": [
            "0-2 years of professional experience or strong internship",
            "Degree in Computer Science or equivalent",
            "Knowledge of at least one programming language",
            "Eagerness to learn and grow",
        ],
        "benefits": ["Mentorship program", "Health insurance", "Student loan assistance"],
        "description": (
            "Great opportunity for a new or recent graduate to join a collaborative engineering team. "
            "You will be paired with a senior engineer mentor, work on real production features, and "
            "rotate across frontend, backend, and infrastructure to find your specialty."
        ),
        "screeningQuestions": [
            {"question": "Are you authorised to work in the US?", "type": "boolean", "knockout": True, "knockoutAnswer": "No"},
        ],
        "status": "Open",
        "visaSponsorship": False,
        "recruiterId": RECRUITER_TECHCORP,
        "postedDate": TODAY,
    },
    {
        "title": "iOS / Android Mobile Engineer",
        "company": "Startup Labs",
        "department": "Mobile",
        "location": "Remote",
        "workMode": "Remote",
        "jobType": "Full-time",
        "experienceLevel": "Mid",
        "salaryMin": "120000",
        "salaryMax": "155000",
        "salaryVisible": True,
        "skills": "Flutter, Dart, Swift, Kotlin, Firebase, REST APIs",
        "requirements": [
            "3+ years mobile development (iOS, Android, or Flutter)",
            "Published at least one app on App Store or Play Store",
            "Strong understanding of mobile UX patterns",
        ],
        "benefits": ["Remote first", "Device allowance", "Equity"],
        "description": (
            "We're building our mobile-first product and need an experienced mobile engineer. "
            "You'll work in Flutter to ship a cross-platform app to both iOS and Android simultaneously. "
            "Strong candidates will have shipped consumer-facing apps with high ratings."
        ),
        "screeningQuestions": [],
        "status": "Open",
        "visaSponsorship": True,
        "recruiterId": RECRUITER_STARTUP,
        "postedDate": TODAY,
    },
    {
        "title": "DevOps / Platform Engineer",
        "company": "TechCorp",
        "department": "Infrastructure",
        "location": "Remote",
        "workMode": "Remote",
        "jobType": "Full-time",
        "experienceLevel": "Senior",
        "salaryMin": "130000",
        "salaryMax": "165000",
        "salaryVisible": True,
        "skills": "Kubernetes, Terraform, AWS, GCP, Docker, CI/CD, Python, Helm",
        "requirements": [
            "4+ years in DevOps or platform engineering",
            "Hands-on Kubernetes in production",
            "Infrastructure-as-code with Terraform",
            "Experience with multi-cloud environments",
        ],
        "benefits": ["Remote", "Health, dental, vision", "Annual bonus", "Conference budget"],
        "description": (
            "Own and evolve our cloud infrastructure serving 50 million users. "
            "You will design CI/CD pipelines, manage Kubernetes clusters, and implement "
            "GitOps workflows. We're primarily on AWS with some GCP workloads."
        ),
        "screeningQuestions": [],
        "status": "Open",
        "visaSponsorship": True,
        "recruiterId": RECRUITER_TECHCORP,
        "postedDate": TODAY,
    },
    # ── Data / ML ─────────────────────────────────────────────────────────────
    {
        "title": "Data Scientist",
        "company": "DataFlow Analytics",
        "department": "Data Science",
        "location": "Seattle, WA",
        "workMode": "Hybrid",
        "jobType": "Full-time",
        "experienceLevel": "Mid",
        "salaryMin": "115000",
        "salaryMax": "150000",
        "salaryVisible": True,
        "skills": "Python, scikit-learn, TensorFlow, SQL, Spark, Tableau, Statistics",
        "requirements": [
            "3+ years data science or ML engineering",
            "Strong Python and statistical modelling",
            "Experience with large datasets and distributed compute",
            "Master's or PhD in quantitative field preferred",
        ],
        "benefits": ["Relocation assistance", "Health insurance", "Research budget"],
        "description": (
            "DataFlow Analytics is a leader in real-time business intelligence. "
            "As a Data Scientist you will build predictive models that drive product recommendations "
            "and pricing optimisation. You'll collaborate with data engineers and product managers "
            "to take models from experiment to production."
        ),
        "screeningQuestions": [],
        "status": "Open",
        "visaSponsorship": True,
        "recruiterId": RECRUITER_DATAFLOW,
        "postedDate": TODAY,
    },
    {
        "title": "Machine Learning Engineer",
        "company": "DataFlow Analytics",
        "department": "AI / ML",
        "location": "Remote",
        "workMode": "Remote",
        "jobType": "Full-time",
        "experienceLevel": "Senior",
        "salaryMin": "150000",
        "salaryMax": "200000",
        "salaryVisible": True,
        "skills": "Python, PyTorch, TensorFlow, MLflow, Kubernetes, LLMs, RAG, Vector DBs",
        "requirements": [
            "5+ years ML engineering experience",
            "Production experience with LLMs or NLP pipelines",
            "Experience deploying models at scale",
            "Strong software engineering fundamentals",
        ],
        "benefits": ["Fully remote", "Top-tier health plan", "RSUs", "GPU compute budget"],
        "description": (
            "Join our AI team to build the next generation of intelligent products. "
            "You will design and ship LLM-powered features including semantic search, "
            "document understanding, and conversational AI. We use PyTorch, MLflow for experiment "
            "tracking, and Kubernetes for serving."
        ),
        "screeningQuestions": [],
        "status": "Open",
        "visaSponsorship": True,
        "recruiterId": RECRUITER_DATAFLOW,
        "postedDate": TODAY,
    },
    {
        "title": "Data Analyst",
        "company": "DataFlow Analytics",
        "department": "Analytics",
        "location": "Chicago, IL",
        "workMode": "Hybrid",
        "jobType": "Full-time",
        "experienceLevel": "Entry",
        "salaryMin": "65000",
        "salaryMax": "85000",
        "salaryVisible": True,
        "skills": "SQL, Excel, Tableau, Power BI, Python basics, Statistics",
        "requirements": [
            "1+ years in data analysis or business intelligence",
            "Strong SQL skills",
            "Experience with Tableau or Power BI",
            "Ability to communicate insights to non-technical stakeholders",
        ],
        "benefits": ["Health insurance", "401k", "Professional development budget"],
        "description": (
            "We are looking for a Data Analyst to support our marketing and operations teams "
            "with data-driven insights. You will build dashboards, run ad-hoc analyses, and "
            "help teams understand their key metrics. Great role for someone early in their "
            "analytics career who wants to grow quickly."
        ),
        "screeningQuestions": [],
        "status": "Open",
        "visaSponsorship": False,
        "recruiterId": RECRUITER_DATAFLOW,
        "postedDate": TODAY,
    },
    # ── Product & Design ──────────────────────────────────────────────────────
    {
        "title": "Product Manager",
        "company": "TechCorp",
        "department": "Product",
        "location": "San Francisco, CA",
        "workMode": "Hybrid",
        "jobType": "Full-time",
        "experienceLevel": "Senior",
        "salaryMin": "150000",
        "salaryMax": "190000",
        "salaryVisible": True,
        "skills": "Product strategy, Roadmapping, A/B testing, SQL, Figma, Stakeholder management",
        "requirements": [
            "5+ years product management at a consumer tech company",
            "Track record of shipping 0-to-1 products",
            "Data-driven approach to prioritisation",
            "Strong cross-functional communication",
        ],
        "benefits": ["Equity", "Health insurance", "Flexible hours", "Quarterly offsites"],
        "description": (
            "Lead the product strategy for our core consumer platform, used by over 5 million people. "
            "You will define the roadmap, work with design and engineering to build features, and use "
            "data to measure impact. You will report directly to the VP of Product."
        ),
        "screeningQuestions": [],
        "status": "Open",
        "visaSponsorship": False,
        "recruiterId": RECRUITER_TECHCORP,
        "postedDate": TODAY,
    },
    {
        "title": "UI/UX Designer",
        "company": "DesignCo",
        "department": "Design",
        "location": "Remote",
        "workMode": "Remote",
        "jobType": "Full-time",
        "experienceLevel": "Mid",
        "salaryMin": "95000",
        "salaryMax": "125000",
        "salaryVisible": True,
        "skills": "Figma, User research, Prototyping, Design systems, Accessibility, CSS basics",
        "requirements": [
            "3+ years UX/UI design for digital products",
            "Strong Figma portfolio",
            "Experience conducting user research",
            "Understanding of design systems and accessibility",
        ],
        "benefits": ["Remote", "Design tool subscriptions", "Health insurance", "Flexible hours"],
        "description": (
            "DesignCo is a product design studio working with top-tier SaaS clients. "
            "As a UI/UX Designer you'll own end-to-end design: from user research and wireframes "
            "through polished high-fidelity prototypes and developer handoff. "
            "Portfolio showing shipped web or mobile products required."
        ),
        "screeningQuestions": [
            {"question": "Do you have a portfolio of shipped digital products?", "type": "boolean", "knockout": True, "knockoutAnswer": "No"},
        ],
        "status": "Open",
        "visaSponsorship": False,
        "recruiterId": RECRUITER_DESIGNCO,
        "postedDate": TODAY,
    },
    {
        "title": "Product Designer (Senior)",
        "company": "DesignCo",
        "department": "Design",
        "location": "New York, NY",
        "workMode": "Hybrid",
        "jobType": "Full-time",
        "experienceLevel": "Senior",
        "salaryMin": "130000",
        "salaryMax": "165000",
        "salaryVisible": True,
        "skills": "Figma, Motion design, Design strategy, User testing, HTML/CSS",
        "requirements": [
            "6+ years product design experience",
            "Led design for a 0-to-1 product",
            "Strong motion and interaction design sensibility",
            "Experience managing junior designers",
        ],
        "benefits": ["Health + dental + vision", "Annual design conference budget", "Equity"],
        "description": (
            "We need a Senior Product Designer to set the design bar for a new B2B SaaS product. "
            "You'll work directly with founders, lead a small design team, and create the design "
            "system from scratch. This is a high-impact role for someone who loves craft and strategy equally."
        ),
        "screeningQuestions": [],
        "status": "Open",
        "visaSponsorship": False,
        "recruiterId": RECRUITER_DESIGNCO,
        "postedDate": TODAY,
    },
    # ── Finance / Operations ──────────────────────────────────────────────────
    {
        "title": "Software Engineer – Fintech (Python)",
        "company": "FinPay",
        "department": "Payments Engineering",
        "location": "New York, NY",
        "workMode": "Hybrid",
        "jobType": "Full-time",
        "experienceLevel": "Mid",
        "salaryMin": "130000",
        "salaryMax": "160000",
        "salaryVisible": True,
        "skills": "Python, Django, PostgreSQL, Kafka, Stripe, PCI-DSS, REST APIs",
        "requirements": [
            "3+ years Python backend engineering",
            "Experience in payments or financial systems preferred",
            "Understanding of PCI-DSS compliance",
            "Strong SQL and system design skills",
        ],
        "benefits": ["Health insurance", "401k 6% match", "Annual bonus", "Commuter benefits"],
        "description": (
            "FinPay processes over $2 billion in transactions annually. "
            "As a Payments Engineer you will build and maintain our core payment processing pipeline, "
            "integrate new payment methods, and ensure PCI-DSS compliance. "
            "This role requires careful engineering and high reliability standards."
        ),
        "screeningQuestions": [],
        "status": "Open",
        "visaSponsorship": True,
        "recruiterId": RECRUITER_FINTECH,
        "postedDate": TODAY,
    },
    {
        "title": "Financial Analyst",
        "company": "FinPay",
        "department": "Finance",
        "location": "New York, NY",
        "workMode": "In-office",
        "jobType": "Full-time",
        "experienceLevel": "Entry",
        "salaryMin": "70000",
        "salaryMax": "90000",
        "salaryVisible": True,
        "skills": "Excel, Financial modelling, SQL, Python basics, PowerPoint",
        "requirements": [
            "Degree in Finance, Economics, or Accounting",
            "Advanced Excel and financial modelling",
            "Strong attention to detail",
            "CFA Level 1 a plus",
        ],
        "benefits": ["Health insurance", "401k", "CFA exam sponsorship", "Annual bonus"],
        "description": (
            "Support the FP&A team with financial modelling, variance analysis, and board reporting. "
            "You'll build models to forecast revenue and costs, prepare monthly management reports, "
            "and support the CFO with ad-hoc analysis."
        ),
        "screeningQuestions": [],
        "status": "Open",
        "visaSponsorship": False,
        "recruiterId": RECRUITER_FINTECH,
        "postedDate": TODAY,
    },
    # ── Marketing / Growth ────────────────────────────────────────────────────
    {
        "title": "Growth Marketing Manager",
        "company": "Startup Labs",
        "department": "Marketing",
        "location": "Remote",
        "workMode": "Remote",
        "jobType": "Full-time",
        "experienceLevel": "Mid",
        "salaryMin": "90000",
        "salaryMax": "115000",
        "salaryVisible": True,
        "skills": "SEO, SEM, Google Ads, Meta Ads, A/B testing, Analytics, SQL basics, HubSpot",
        "requirements": [
            "3+ years growth or performance marketing",
            "Proven track record of reducing CAC and scaling paid channels",
            "Strong analytical skills",
            "Experience with marketing automation tools",
        ],
        "benefits": ["Remote", "Marketing experiment budget", "Health insurance", "Equity"],
        "description": (
            "Lead growth initiatives across paid, organic, and viral channels. "
            "You will own CAC targets, run multivariate experiments, and work with "
            "product to build referral and retention loops. We're pre-Series A and growing 30% MoM."
        ),
        "screeningQuestions": [],
        "status": "Open",
        "visaSponsorship": False,
        "recruiterId": RECRUITER_STARTUP,
        "postedDate": TODAY,
    },
    {
        "title": "Content & SEO Specialist",
        "company": "DesignCo",
        "department": "Marketing",
        "location": "Remote",
        "workMode": "Remote",
        "jobType": "Part-time",
        "experienceLevel": "Entry",
        "salaryMin": "45000",
        "salaryMax": "60000",
        "salaryVisible": True,
        "skills": "SEO, Content writing, Ahrefs, WordPress, Social media, Copywriting",
        "requirements": [
            "1+ years content marketing or SEO",
            "Strong writing and editing skills",
            "Familiarity with on-page and technical SEO",
        ],
        "benefits": ["Flexible hours", "Remote", "Health stipend"],
        "description": (
            "Create high-quality blog content, optimise existing pages, and build backlinks "
            "to grow our organic traffic. You will work closely with the founder and report "
            "directly on keyword rankings and organic leads."
        ),
        "screeningQuestions": [],
        "status": "Open",
        "visaSponsorship": False,
        "recruiterId": RECRUITER_DESIGNCO,
        "postedDate": TODAY,
    },
    # ── Contract / Internship ─────────────────────────────────────────────────
    {
        "title": "Software Engineering Intern",
        "company": "TechCorp",
        "department": "Engineering",
        "location": "San Francisco, CA",
        "workMode": "Hybrid",
        "jobType": "Internship",
        "experienceLevel": "Entry",
        "salaryMin": "40",
        "salaryMax": "55",
        "salaryVisible": True,
        "skills": "Python or JavaScript, Data structures, Git, Curiosity",
        "requirements": [
            "Currently enrolled in CS or related degree",
            "Completed at least 2 years of undergraduate study",
            "Familiarity with at least one programming language",
        ],
        "benefits": ["Housing stipend", "Mentorship", "Return offer consideration"],
        "description": (
            "12-week summer internship on one of our product engineering teams. "
            "You will work on a real project that ships to production, be paired with a senior mentor, "
            "and participate in intern events and tech talks."
        ),
        "screeningQuestions": [],
        "status": "Open",
        "visaSponsorship": False,
        "recruiterId": RECRUITER_TECHCORP,
        "postedDate": TODAY,
    },
    {
        "title": "Contract – React Developer (3 months)",
        "company": "DesignCo",
        "department": "Engineering",
        "location": "Remote",
        "workMode": "Remote",
        "jobType": "Contract",
        "experienceLevel": "Mid",
        "salaryMin": "80",
        "salaryMax": "110",
        "salaryVisible": True,
        "skills": "React, TypeScript, Tailwind CSS, REST APIs",
        "requirements": [
            "3+ years React development",
            "Available to start immediately",
            "Strong portfolio of React projects",
        ],
        "benefits": ["Flexible hours", "Remote", "Potential to convert to full-time"],
        "description": (
            "3-month contract to help us launch a new client project on a tight deadline. "
            "You'll build React components from Figma designs and integrate with our REST API. "
            "Immediate start preferred. Strong chance of extension or conversion."
        ),
        "screeningQuestions": [],
        "status": "Open",
        "visaSponsorship": False,
        "recruiterId": RECRUITER_DESIGNCO,
        "postedDate": TODAY,
    },
    {
        "title": "Cloud Solutions Architect",
        "company": "DataFlow Analytics",
        "department": "Solutions Engineering",
        "location": "Boston, MA",
        "workMode": "Hybrid",
        "jobType": "Full-time",
        "experienceLevel": "Senior",
        "salaryMin": "160000",
        "salaryMax": "210000",
        "salaryVisible": True,
        "skills": "AWS, Azure, GCP, Terraform, Kubernetes, Architecture design, Python, Solution selling",
        "requirements": [
            "7+ years cloud architecture experience",
            "AWS / GCP / Azure professional certification",
            "Experience designing enterprise-scale systems",
            "Comfortable presenting to C-level stakeholders",
        ],
        "benefits": ["Top salary", "RSUs", "Premium health plan", "Annual AWS certification renewal"],
        "description": (
            "Design and deliver cloud architecture solutions for Fortune 500 clients. "
            "You will lead discovery workshops, produce architecture diagrams, and work with "
            "our delivery team to implement solutions. Travel up to 20% to client sites."
        ),
        "screeningQuestions": [],
        "status": "Open",
        "visaSponsorship": True,
        "recruiterId": RECRUITER_DATAFLOW,
        "postedDate": TODAY,
    },
]

# ─────────────────────────────────────────────────────────────────────────────
#  MOCK CANDIDATES
# ─────────────────────────────────────────────────────────────────────────────

MOCK_CANDIDATES = [
    {
        "uid": "mock_candidate_001",
        "fullName": "Aisha Patel",
        "email": "aisha.patel@mockmail.com",
        "role": "candidate",
        "professionalTitle": "Senior Frontend Engineer",
        "location": "San Francisco, CA",
        "phone": "+1-415-555-0101",
        "linkedIn": "linkedin.com/in/aishapatel",
        "github": "github.com/aishapatel",
        "onboardingCompleted": True,
        "skills": ["React", "TypeScript", "Next.js", "GraphQL", "Tailwind CSS", "Figma"],
        "experienceYears": 6,
        "resume": {
            "summary": "Senior frontend engineer with 6 years building consumer web products at scale. Led UI platform at a Series B startup from 0 to 2M users.",
            "experience": [
                {"company": "ScaleApp Inc", "title": "Senior Frontend Engineer", "years": "2021-2024", "bullets": ["Led migration from CRA to Next.js, reducing LCP by 40%", "Built design system used across 5 product teams", "Mentored 3 junior engineers"]},
                {"company": "WebAgency", "title": "Frontend Developer", "years": "2018-2021", "bullets": ["Built 20+ client websites in React", "Introduced TypeScript to the team"]},
            ],
            "education": [{"degree": "B.Sc. Computer Science", "school": "UC Berkeley", "year": "2018"}],
            "skills": ["React", "TypeScript", "Next.js", "GraphQL", "Node.js", "Tailwind", "Jest"],
            "certifications": [],
        },
    },
    {
        "uid": "mock_candidate_002",
        "fullName": "Marcus Johnson",
        "email": "marcus.j@mockmail.com",
        "role": "candidate",
        "professionalTitle": "Data Scientist",
        "location": "Seattle, WA",
        "phone": "+1-206-555-0202",
        "linkedIn": "linkedin.com/in/marcusjohnson",
        "github": "github.com/marcusjds",
        "onboardingCompleted": True,
        "skills": ["Python", "scikit-learn", "TensorFlow", "SQL", "Spark", "Tableau"],
        "experienceYears": 4,
        "resume": {
            "summary": "Data scientist with 4 years in e-commerce and retail analytics. Built recommendation systems serving 10M+ users. Master's in Statistics.",
            "experience": [
                {"company": "RetailAI", "title": "Data Scientist", "years": "2020-2024", "bullets": ["Built collaborative filtering model that increased click-through by 18%", "Productionised 5 ML models using MLflow and Kubernetes", "Ran A/B tests across 3M users weekly"]},
                {"company": "Nielsen", "title": "Analytics Intern", "years": "2019-2020", "bullets": ["Analysed TV ratings data for top-10 broadcast clients"]},
            ],
            "education": [{"degree": "M.Sc. Statistics", "school": "University of Washington", "year": "2020"}],
            "skills": ["Python", "scikit-learn", "TensorFlow", "SQL", "Spark", "Tableau", "R"],
            "certifications": ["AWS Certified ML Specialty"],
        },
    },
    {
        "uid": "mock_candidate_003",
        "fullName": "Priya Sharma",
        "email": "priya.sharma@mockmail.com",
        "role": "candidate",
        "professionalTitle": "Product Manager",
        "location": "New York, NY",
        "phone": "+1-212-555-0303",
        "linkedIn": "linkedin.com/in/priyasharma",
        "github": "",
        "onboardingCompleted": True,
        "skills": ["Product strategy", "Roadmapping", "A/B testing", "SQL", "Figma", "Jira"],
        "experienceYears": 7,
        "resume": {
            "summary": "Product Manager with 7 years at consumer tech companies. Shipped 0-to-1 mobile app with 500K DAU. Strong data-driven decision-making.",
            "experience": [
                {"company": "StreamApp", "title": "Senior Product Manager", "years": "2019-2024", "bullets": ["Launched social features that drove 35% increase in DAU", "Defined and shipped 4 major product bets", "Built and managed a team of 3 junior PMs"]},
                {"company": "Google", "title": "Associate Product Manager", "years": "2017-2019", "bullets": ["APM Program graduate", "Shipped Search features to 200M+ users"]},
            ],
            "education": [{"degree": "MBA", "school": "Wharton School", "year": "2017"}, {"degree": "B.Tech Computer Science", "school": "IIT Bombay", "year": "2015"}],
            "skills": ["Product strategy", "SQL", "Figma", "A/B testing", "OKRs", "Stakeholder management"],
            "certifications": [],
        },
    },
    {
        "uid": "mock_candidate_004",
        "fullName": "Daniel Kim",
        "email": "daniel.kim@mockmail.com",
        "role": "candidate",
        "professionalTitle": "DevOps Engineer",
        "location": "Remote",
        "phone": "+1-737-555-0404",
        "linkedIn": "linkedin.com/in/danielkim",
        "github": "github.com/danielkim-devops",
        "onboardingCompleted": True,
        "skills": ["Kubernetes", "Terraform", "AWS", "Docker", "CI/CD", "Python", "Helm", "GitOps"],
        "experienceYears": 5,
        "resume": {
            "summary": "Platform engineer specialising in Kubernetes and AWS. Built and maintained infrastructure for a SaaS platform with 99.99% uptime. CKA certified.",
            "experience": [
                {"company": "CloudScale", "title": "Senior DevOps Engineer", "years": "2020-2024", "bullets": ["Migrated monolith to microservices on EKS, cutting deployment time from 45 min to 4 min", "Implemented GitOps with ArgoCD across 8 teams", "Reduced infra cost by $200K/yr through right-sizing"]},
                {"company": "Rackspace", "title": "Systems Engineer", "years": "2019-2020", "bullets": ["Managed Linux servers and AWS environments for 50+ clients"]},
            ],
            "education": [{"degree": "B.Sc. Information Systems", "school": "UT Austin", "year": "2019"}],
            "skills": ["Kubernetes", "Terraform", "AWS", "GCP", "Docker", "Python", "Prometheus", "Grafana"],
            "certifications": ["CKA – Certified Kubernetes Administrator", "AWS Solutions Architect Pro"],
        },
    },
    {
        "uid": "mock_candidate_005",
        "fullName": "Sofia Reyes",
        "email": "sofia.reyes@mockmail.com",
        "role": "candidate",
        "professionalTitle": "UI/UX Designer",
        "location": "Austin, TX",
        "phone": "+1-512-555-0505",
        "linkedIn": "linkedin.com/in/sofiareyes",
        "github": "",
        "onboardingCompleted": True,
        "skills": ["Figma", "User research", "Prototyping", "Design systems", "Accessibility", "Framer"],
        "experienceYears": 4,
        "resume": {
            "summary": "Product designer with 4 years designing B2B SaaS tools. Strong in user research, accessibility, and design systems. Shipped 6 major product redesigns.",
            "experience": [
                {"company": "B2BTools Inc", "title": "Product Designer", "years": "2021-2024", "bullets": ["Led end-to-end redesign of dashboard, increasing NPS from 32 to 61", "Built design system with 120+ components in Figma", "Ran 30+ usability studies"]},
                {"company": "Agency X", "title": "UI Designer", "years": "2020-2021", "bullets": ["Designed mobile apps for 4 clients in healthcare and retail"]},
            ],
            "education": [{"degree": "B.F.A. Interaction Design", "school": "RISD", "year": "2020"}],
            "skills": ["Figma", "Framer", "Prototyping", "User research", "WCAG accessibility", "CSS"],
            "certifications": ["Google UX Design Certificate"],
        },
    },
    {
        "uid": "mock_candidate_006",
        "fullName": "James O'Brien",
        "email": "james.obrien@mockmail.com",
        "role": "candidate",
        "professionalTitle": "Junior Software Engineer",
        "location": "Chicago, IL",
        "phone": "+1-312-555-0606",
        "linkedIn": "linkedin.com/in/jamesobrien",
        "github": "github.com/jamesobrien",
        "onboardingCompleted": True,
        "skills": ["Python", "JavaScript", "React", "SQL", "Git", "REST APIs"],
        "experienceYears": 1,
        "resume": {
            "summary": "Recent CS graduate with one year of experience building internal tools in Python and React. Eager learner, fast to ramp on new technologies.",
            "experience": [
                {"company": "InsureTech Co", "title": "Junior Software Engineer", "years": "2023-2024", "bullets": ["Built internal admin dashboard in React that replaced 3 legacy spreadsheets", "Wrote Python scripts to automate daily data pipeline, saving 2 hours/day"]},
                {"company": "Deloitte", "title": "Technology Intern", "years": "2022", "bullets": ["Developed Power Automate workflows for client onboarding processes"]},
            ],
            "education": [{"degree": "B.Sc. Computer Science", "school": "University of Illinois Chicago", "year": "2023"}],
            "skills": ["Python", "JavaScript", "React", "SQL", "Git", "Django basics"],
            "certifications": [],
        },
    },
    {
        "uid": "mock_candidate_007",
        "fullName": "Yuki Tanaka",
        "email": "yuki.tanaka@mockmail.com",
        "role": "candidate",
        "professionalTitle": "Machine Learning Engineer",
        "location": "Remote",
        "phone": "+1-650-555-0707",
        "linkedIn": "linkedin.com/in/yukitanaka",
        "github": "github.com/yukitanaka",
        "onboardingCompleted": True,
        "skills": ["Python", "PyTorch", "TensorFlow", "MLflow", "Kubernetes", "LLMs", "RAG", "Vector DBs"],
        "experienceYears": 6,
        "resume": {
            "summary": "ML Engineer with 6 years building and productionising NLP and recommendation systems. Deep experience with LLMs, RAG architectures, and ML infrastructure. PhD in Computer Science.",
            "experience": [
                {"company": "OpenSearch AI", "title": "Staff ML Engineer", "years": "2021-2024", "bullets": ["Built RAG-based document Q&A system used by 200K enterprise users", "Reduced inference latency by 65% using quantisation and batching", "Led team of 4 ML engineers"]},
                {"company": "Uber", "title": "ML Engineer", "years": "2018-2021", "bullets": ["Built real-time demand forecasting model for driver routing", "Shipped ETA improvement that reduced cancellations by 8%"]},
            ],
            "education": [{"degree": "Ph.D. Computer Science (NLP)", "school": "Stanford University", "year": "2018"}],
            "skills": ["Python", "PyTorch", "LLMs", "RAG", "Pinecone", "Weaviate", "MLflow", "Kubernetes"],
            "certifications": [],
        },
    },
    {
        "uid": "mock_candidate_008",
        "fullName": "Carlos Mendez",
        "email": "carlos.mendez@mockmail.com",
        "role": "candidate",
        "professionalTitle": "Full-Stack Engineer",
        "location": "Miami, FL",
        "phone": "+1-305-555-0808",
        "linkedIn": "linkedin.com/in/carlosmendez",
        "github": "github.com/cmendezengineer",
        "onboardingCompleted": True,
        "skills": ["React", "Node.js", "TypeScript", "MongoDB", "AWS", "Docker", "GraphQL"],
        "experienceYears": 3,
        "resume": {
            "summary": "Full-stack engineer with 3 years building SaaS products end-to-end. Comfortable across the entire stack from React UI to Node APIs to AWS infrastructure.",
            "experience": [
                {"company": "SaaSCo", "title": "Full-Stack Engineer", "years": "2021-2024", "bullets": ["Built subscription billing system handling $3M ARR", "Shipped real-time collaboration feature using WebSockets", "Migrated from REST to GraphQL, reducing over-fetching by 60%"]},
                {"company": "Freelance", "title": "Web Developer", "years": "2020-2021", "bullets": ["Built 8 client websites and e-commerce stores"]},
            ],
            "education": [{"degree": "B.Sc. Software Engineering", "school": "Florida International University", "year": "2020"}],
            "skills": ["React", "Node.js", "TypeScript", "MongoDB", "PostgreSQL", "AWS", "Docker"],
            "certifications": ["AWS Developer Associate"],
        },
    },
    {
        "uid": "mock_candidate_009",
        "fullName": "Emma Wilson",
        "email": "emma.wilson@mockmail.com",
        "role": "candidate",
        "professionalTitle": "Data Analyst",
        "location": "Boston, MA",
        "phone": "+1-617-555-0909",
        "linkedIn": "linkedin.com/in/emmawilson",
        "github": "",
        "onboardingCompleted": True,
        "skills": ["SQL", "Tableau", "Power BI", "Excel", "Python basics", "Statistics"],
        "experienceYears": 2,
        "resume": {
            "summary": "Data analyst with 2 years turning business questions into actionable insights. Strong SQL, Tableau, and stakeholder communication. Background in Economics.",
            "experience": [
                {"company": "RetailChain", "title": "Data Analyst", "years": "2022-2024", "bullets": ["Built executive dashboard tracking $500M revenue KPIs", "Ran weekly inventory analyses reducing stockouts by 22%", "Created self-serve SQL templates used by 15 non-technical stakeholders"]},
                {"company": "Deloitte", "title": "Business Analyst Intern", "years": "2022", "bullets": ["Analysed client cost structure and identified $1.2M savings opportunity"]},
            ],
            "education": [{"degree": "B.A. Economics", "school": "Boston University", "year": "2022"}],
            "skills": ["SQL", "Tableau", "Power BI", "Python (pandas)", "Excel", "Statistics"],
            "certifications": ["Tableau Desktop Specialist"],
        },
    },
    {
        "uid": "mock_candidate_010",
        "fullName": "Raj Patel",
        "email": "raj.patel@mockmail.com",
        "role": "candidate",
        "professionalTitle": "Flutter Mobile Developer",
        "location": "Remote",
        "phone": "+1-408-555-1010",
        "linkedIn": "linkedin.com/in/rajpatel",
        "github": "github.com/rajpatelflutter",
        "onboardingCompleted": True,
        "skills": ["Flutter", "Dart", "Firebase", "REST APIs", "Android", "iOS", "BLoC"],
        "experienceYears": 4,
        "resume": {
            "summary": "Flutter developer with 4 years building cross-platform mobile apps. Published 3 apps on Play Store and App Store with combined 200K+ downloads.",
            "experience": [
                {"company": "MobileFirst", "title": "Senior Flutter Developer", "years": "2021-2024", "bullets": ["Built Flutter app from scratch, shipped to 80K users in 6 months", "Implemented offline-first architecture with Hive + sync", "Reduced app size by 40% through asset optimisation and tree shaking"]},
                {"company": "AppStudio", "title": "Mobile Developer", "years": "2020-2021", "bullets": ["Maintained React Native apps for 3 clients", "Migrated one client app from React Native to Flutter"]},
            ],
            "education": [{"degree": "B.Sc. Computer Engineering", "school": "San Jose State University", "year": "2020"}],
            "skills": ["Flutter", "Dart", "Firebase", "BLoC / Riverpod", "Android native", "REST APIs"],
            "certifications": [],
        },
    },
    {
        "uid": "mock_candidate_011",
        "fullName": "Fatima Al-Hassan",
        "email": "fatima.alhassan@mockmail.com",
        "role": "candidate",
        "professionalTitle": "Growth Marketing Manager",
        "location": "Remote",
        "phone": "+1-929-555-1111",
        "linkedIn": "linkedin.com/in/fatimaalhassan",
        "github": "",
        "onboardingCompleted": True,
        "skills": ["SEO", "SEM", "Google Ads", "Meta Ads", "A/B testing", "Analytics", "HubSpot", "SQL"],
        "experienceYears": 5,
        "resume": {
            "summary": "Growth marketer with 5 years scaling B2C and B2B SaaS acquisition. Reduced CAC by 40% at last role while scaling MoM spend 3x. Data-driven and experiment-obsessed.",
            "experience": [
                {"company": "SaaSGrowth", "title": "Head of Growth", "years": "2021-2024", "bullets": ["Scaled paid spend from $50K to $500K/mo while cutting CAC by 40%", "Built SEO content engine that grew organic to 40% of pipeline", "Led team of 3 marketers and 1 analyst"]},
                {"company": "E-Commerce Brand", "title": "Digital Marketing Manager", "years": "2019-2021", "bullets": ["Managed $2M/yr Google and Meta ad budget", "Launched influencer programme that drove 25% of new revenue"]},
            ],
            "education": [{"degree": "B.A. Marketing", "school": "NYU Stern", "year": "2019"}],
            "skills": ["Google Ads", "Meta Ads", "SEO", "HubSpot", "Analytics", "SQL", "A/B testing"],
            "certifications": ["Google Ads Certified", "HubSpot Marketing Certified"],
        },
    },
    {
        "uid": "mock_candidate_012",
        "fullName": "Noah Chen",
        "email": "noah.chen@mockmail.com",
        "role": "candidate",
        "professionalTitle": "Cloud Solutions Architect",
        "location": "Boston, MA",
        "phone": "+1-617-555-1212",
        "linkedIn": "linkedin.com/in/noahchen",
        "github": "github.com/noahchenarc",
        "onboardingCompleted": True,
        "skills": ["AWS", "Azure", "GCP", "Terraform", "Kubernetes", "Architecture design", "Python"],
        "experienceYears": 9,
        "resume": {
            "summary": "Cloud architect with 9 years designing enterprise solutions on AWS and GCP. AWS Professional SA and GCP Professional Cloud Architect certified. Presented to C-suite at 20+ Fortune 500 engagements.",
            "experience": [
                {"company": "IBM Consulting", "title": "Principal Cloud Architect", "years": "2018-2024", "bullets": ["Led architecture for $15M cloud migration of financial services firm", "Designed multi-region DR architecture achieving RPO < 1 min", "Managed team of 5 architects across 3 time zones"]},
                {"company": "Amazon Web Services", "title": "Solutions Architect", "years": "2015-2018", "bullets": ["Supported 50+ enterprise customers on AWS adoption", "Built reference architectures for healthcare and financial sectors"]},
            ],
            "education": [{"degree": "M.Sc. Computer Science", "school": "MIT", "year": "2015"}],
            "skills": ["AWS", "GCP", "Azure", "Terraform", "Kubernetes", "Python", "Architecture design"],
            "certifications": ["AWS Solutions Architect Professional", "GCP Professional Cloud Architect", "Azure Solutions Architect Expert"],
        },
    },
]


# ─────────────────────────────────────────────────────────────────────────────
#  SEED / CLEAR FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def clear_seeded_data():
    print("\n[CLEAR] Removing previously seeded documents...")
    # Jobs
    jobs = db.collection("jobs").where("_seeded", "==", True).stream()
    count = 0
    for doc in jobs:
        doc.reference.delete()
        count += 1
    print(f"  Deleted {count} seeded jobs")

    # Candidates
    for c in MOCK_CANDIDATES:
        ref = db.collection("users").document(c["uid"])
        if ref.get().exists:
            ref.delete()
    print(f"  Deleted {len(MOCK_CANDIDATES)} seeded candidate profiles")


def seed_jobs():
    print("\n[JOBS] Seeding mock jobs...")
    inserted = 0
    for job in MOCK_JOBS:
        doc = dict(job)
        doc["_seeded"] = True
        ref = db.collection("jobs").add(doc)
        print(f"  + {job['title']} @ {job['company']}  [{job['experienceLevel']} | {job['workMode']}]  → {ref[1].id}")
        inserted += 1
    print(f"  Total jobs inserted: {inserted}")


def seed_candidates():
    print("\n[CANDIDATES] Seeding mock candidate profiles...")
    for c in MOCK_CANDIDATES:
        doc = dict(c)
        doc["_seeded"] = True
        doc["createdAt"] = datetime.datetime.utcnow().isoformat() + "Z"
        doc["avatar"] = ""
        doc["suspended"] = False
        db.collection("users").document(c["uid"]).set(doc)
        print(f"  + {c['fullName']}  ({c['professionalTitle']})  [{c['experienceYears']} yrs | {c['location']}]")
    print(f"  Total candidates inserted: {len(MOCK_CANDIDATES)}")


def print_summary():
    print("\n" + "="*60)
    print(" SEED COMPLETE — what to test")
    print("="*60)
    print("\nFILTERING (Jobs page):")
    print("  Remote jobs        → 9 jobs")
    print("  Hybrid jobs        → 7 jobs")
    print("  In-office jobs     → 3 jobs")
    print("  Entry level        → 4 jobs")
    print("  Mid level          → 7 jobs")
    print("  Senior level       → 6 jobs")
    print("  Full-time          → 14 jobs")
    print("  Contract/Internship→ 3 jobs")
    print("  San Francisco      → 3 jobs")
    print("  New York           → 4 jobs")
    print("  Salary > $130K     → 8 jobs")

    print("\nAI SEMANTIC SEARCH (try these queries):")
    print('  "remote machine learning job with LLMs"')
    print('  "entry level developer role in New York"')
    print('  "senior devops kubernetes aws"')
    print('  "product designer figma startup"')
    print('  "data analyst sql tableau chicago"')

    print("\nRECRUITER AI COPILOT (candidate search):")
    print('  "experienced flutter developer who shipped apps"')
    print('  "data scientist with recommendation systems experience"')
    print('  "cloud architect with AWS and enterprise experience"')
    print('  "junior engineer eager to learn python"')
    print('  "growth marketer who reduced CAC"')
    print("="*60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--clear", action="store_true", help="Delete seeded data before inserting")
    args = parser.parse_args()

    if args.clear:
        clear_seeded_data()

    seed_jobs()
    seed_candidates()
    print_summary()
