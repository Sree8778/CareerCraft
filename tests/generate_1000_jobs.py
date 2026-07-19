"""
generate_1000_jobs.py — Seed Firestore with 1000 realistic, diverse mock jobs.

Usage:
    python tests/generate_1000_jobs.py           # generate & insert
    python tests/generate_1000_jobs.py --clear   # delete generated jobs first, then re-insert

All documents carry  _generated: True  for easy cleanup.
Uses Firestore batch writes (500/batch) for speed.
"""

import sys, os, random, argparse, datetime, itertools

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
rng = random.Random(42)  # fixed seed -> reproducible

TODAY = datetime.date.today().isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# DATA POOLS
# ─────────────────────────────────────────────────────────────────────────────

COMPANIES = [
    "TechCorp", "DataFlow Analytics", "DesignCo", "FinPay", "Startup Labs",
    "Acme Software", "CloudNine", "InnovateTech", "PeakSystems", "VelocityIO",
    "NexGen Solutions", "BlueSky Technologies", "RocketShip", "PixelPerfect",
    "DataDriven Inc", "QuantumLeap", "SwiftScale", "Apex Digital", "BrightMind AI",
    "ClearPath Systems", "DeltaForce Tech", "EdgeCloud", "FutureTech", "GlobeTech",
    "HighGround AI", "Infinite Loop", "JetStream Inc", "KineticData", "LightBridge",
    "MetaVision", "NovaSpark", "Orbit Systems", "Pinnacle Labs", "QuickScale",
    "RapidGrowth", "Synapse AI", "TitanTech", "UltraScale", "VantagePoint",
    "Warp Speed Tech", "XcelCloud", "YieldMax", "ZeroGravity", "CoreLogic",
    "DeepPath", "EchoSystems", "FlowState", "GridIron Tech", "HorizonAI",
    "ImpactLabs", "JumpStart", "Keystone Systems", "Luminary Tech", "MeshWorks",
    "Narrative AI", "OpenBridge", "Procept", "Quantum Dynamics", "RedShift Labs",
    "Silverline", "ThinkForward", "Unify Platform", "Vector Analytics", "Wingspan",
    "Axiom Cloud", "Benchmark Digital", "Catalyst Tech", "Drivepoint", "Elevate AI",
    "Frontier Systems", "GridMind", "Headspace Tech", "Influx Data", "Journify",
    "Kestrel Systems", "Loopback Labs", "Manifest AI", "Northstar", "Overture",
    "Pathrise", "Quorum Tech", "Resonance Labs", "Skybridge", "Tangent",
    "Unison AI", "Vault Systems", "Wavelength", "Xenith", "Yonder",
    "Zeal Tech", "Armada Systems", "Beacon AI", "Convergent Labs", "Datalake Co",
]

LOCATIONS = [
    "Remote",
    "San Francisco, CA", "San Francisco, CA", "San Francisco, CA",
    "New York, NY", "New York, NY", "New York, NY",
    "Austin, TX", "Austin, TX",
    "Seattle, WA", "Seattle, WA",
    "Boston, MA", "Boston, MA",
    "Chicago, IL",
    "Los Angeles, CA",
    "Denver, CO",
    "Atlanta, GA",
    "Dallas, TX",
    "Miami, FL",
    "Portland, OR",
    "San Diego, CA",
    "Washington, DC",
    "Raleigh, NC",
    "Nashville, TN",
    "Phoenix, AZ",
    "Minneapolis, MN",
    "Salt Lake City, UT",
    "Pittsburgh, PA",
    "Detroit, MI",
    "Charlotte, NC",
    "London, UK",
    "Toronto, Canada",
    "Berlin, Germany",
    "Amsterdam, Netherlands",
    "Singapore",
]

WORK_MODES  = ["Remote", "Remote", "Hybrid", "Hybrid", "In-office"]
JOB_TYPES   = ["Full-time", "Full-time", "Full-time", "Full-time", "Part-time", "Contract", "Internship"]
EXP_LEVELS  = ["Entry", "Entry", "Mid", "Mid", "Mid", "Senior", "Senior", "Lead", "Director"]

RECRUITER_IDS = [f"recruiter_gen_{i:03d}" for i in range(1, 21)]

BENEFITS_POOL = [
    "Health insurance", "Dental and vision", "401k with 6% match", "Fully remote",
    "Flexible hours", "Unlimited PTO", "Home office stipend $1,500", "Learning budget $2k/yr",
    "Stock options / RSUs", "Equity package", "Annual bonus", "Performance bonus",
    "Commuter benefits", "Paid parental leave 16 weeks", "Life insurance",
    "Mental health benefits", "Gym membership stipend", "Conference budget $3k/yr",
    "Relocation assistance", "Student loan assistance", "HSA/FSA", "Childcare benefits",
    "Team retreats", "Company events", "Device allowance", "Internet stipend",
    "Annual salary review", "Promotion track", "Mentorship programme",
]

VISA_WEIGHTS = [True, True, False, False, False]  # ~40% sponsor


# ─────────────────────────────────────────────────────────────────────────────
# JOB DEFINITIONS PER CATEGORY
# ─────────────────────────────────────────────────────────────────────────────

CATEGORIES = [
    # ── Software Engineering ──────────────────────────────────────────────────
    {
        "category": "Software Engineering – Frontend",
        "titles": ["Frontend Engineer", "Senior Frontend Engineer", "Lead Frontend Developer",
                   "React Developer", "UI Engineer", "JavaScript Engineer", "Web Developer",
                   "Frontend Architect", "Principal Frontend Engineer"],
        "departments": ["Engineering", "Product Engineering", "Web Platform"],
        "skills_pools": [
            ["React", "TypeScript", "Next.js", "GraphQL", "Tailwind CSS", "CSS", "HTML", "Vite"],
            ["Vue.js", "TypeScript", "Nuxt.js", "Pinia", "Tailwind CSS", "CSS", "REST APIs"],
            ["Angular", "TypeScript", "RxJS", "NgRx", "SCSS", "Jest", "Cypress"],
            ["React", "JavaScript", "Redux", "REST APIs", "CSS Modules", "Webpack"],
            ["Svelte", "TypeScript", "SvelteKit", "Tailwind CSS", "REST APIs"],
        ],
        "salary_ranges": {
            "Entry":    (65000,  90000),
            "Mid":      (100000, 140000),
            "Senior":   (140000, 180000),
            "Lead":     (170000, 210000),
            "Director": (190000, 240000),
        },
        "description_templates": [
            "We are looking for a {title} to lead the development of our customer-facing web application. "
            "You will work closely with design and product teams to build beautiful, performant experiences. "
            "Our stack is {skills}. You will own feature areas from design review through production deployment.",

            "Join our frontend team to craft pixel-perfect, high-performance interfaces used by hundreds of thousands of users daily. "
            "You'll collaborate with designers in Figma, partner with backend engineers on API contracts, and champion "
            "web performance and accessibility. We value clean code and thorough code review.",

            "As a {title} at {company}, you will define frontend architecture standards, build reusable component libraries, "
            "and mentor junior engineers. You'll drive initiatives that directly improve user retention and engagement metrics.",
        ],
        "requirements_pool": [
            "Strong proficiency in React and TypeScript",
            "Experience with state management (Redux, Zustand, or React Query)",
            "Deep understanding of browser performance and Core Web Vitals",
            "Familiarity with accessibility standards (WCAG 2.1)",
            "Experience with CSS-in-JS or utility-first CSS frameworks",
            "Knowledge of CI/CD pipelines and deployment workflows",
            "Experience with GraphQL or REST API integration",
            "Proficiency in testing with Jest and React Testing Library",
            "Experience building and maintaining design systems",
            "Strong eye for UI detail and UX intuition",
        ],
    },
    {
        "category": "Software Engineering – Backend",
        "titles": ["Backend Engineer", "Senior Backend Engineer", "Software Engineer (Backend)",
                   "API Engineer", "Platform Engineer", "Server-Side Engineer",
                   "Python Engineer", "Go Engineer", "Java Engineer", "Node.js Engineer",
                   "Principal Backend Engineer", "Staff Engineer"],
        "departments": ["Engineering", "Core Platform", "API Platform", "Infrastructure"],
        "skills_pools": [
            ["Python", "Flask", "FastAPI", "PostgreSQL", "Redis", "Docker", "AWS", "Celery"],
            ["Go", "gRPC", "PostgreSQL", "Kubernetes", "Docker", "AWS", "Kafka"],
            ["Node.js", "TypeScript", "Express", "MongoDB", "Redis", "Docker", "AWS"],
            ["Java", "Spring Boot", "PostgreSQL", "Kafka", "Docker", "AWS", "Hibernate"],
            ["Python", "Django", "PostgreSQL", "Celery", "Redis", "AWS", "REST APIs"],
            ["Ruby on Rails", "PostgreSQL", "Redis", "Sidekiq", "AWS", "Docker"],
            ["Kotlin", "Spring Boot", "PostgreSQL", "Kafka", "Docker", "GCP"],
        ],
        "salary_ranges": {
            "Entry":    (70000,  95000),
            "Mid":      (110000, 150000),
            "Senior":   (145000, 185000),
            "Lead":     (175000, 215000),
            "Director": (200000, 260000),
        },
        "description_templates": [
            "Build and scale the APIs that power {company}'s core platform. "
            "You will design RESTful and event-driven services, optimise database queries, "
            "and ensure high availability at scale. Our stack includes {skills}.",

            "As a {title} you will architect and implement backend services that handle millions of requests per day. "
            "You'll collaborate with frontend engineers, data teams, and DevOps to deliver reliable, maintainable systems. "
            "We value clean architecture, comprehensive testing, and thoughtful API design.",

            "Own the design and implementation of critical backend systems from database schema through API contracts. "
            "You will participate in on-call rotation, drive performance improvements, and raise the bar for engineering quality "
            "through code review and technical documentation.",
        ],
        "requirements_pool": [
            "3+ years of backend engineering experience",
            "Strong proficiency in at least one backend language (Python, Go, Java, or Node.js)",
            "Experience designing and implementing RESTful or GraphQL APIs",
            "Strong SQL and database design fundamentals",
            "Familiarity with message queues (Kafka, RabbitMQ, or SQS)",
            "Experience with containerisation (Docker) and orchestration (Kubernetes)",
            "Understanding of microservices architecture patterns",
            "Experience with cloud platforms (AWS, GCP, or Azure)",
            "Strong understanding of caching strategies (Redis, Memcached)",
            "Track record of improving API performance and reliability",
        ],
    },
    {
        "category": "Software Engineering – Full-Stack",
        "titles": ["Full-Stack Engineer", "Senior Full-Stack Engineer", "Full-Stack Developer",
                   "Software Engineer (Full-Stack)", "Generalist Engineer"],
        "departments": ["Product Engineering", "Engineering", "Growth Engineering"],
        "skills_pools": [
            ["React", "Node.js", "TypeScript", "PostgreSQL", "AWS", "Docker"],
            ["React", "Python", "Django", "PostgreSQL", "Redis", "AWS"],
            ["Vue.js", "Node.js", "TypeScript", "MongoDB", "Docker", "GCP"],
            ["Next.js", "TypeScript", "Prisma", "PostgreSQL", "Vercel", "Stripe"],
            ["React", "Go", "PostgreSQL", "Redis", "Docker", "Kubernetes"],
        ],
        "salary_ranges": {
            "Entry":    (70000,  95000),
            "Mid":      (105000, 145000),
            "Senior":   (140000, 180000),
            "Lead":     (170000, 210000),
            "Director": (195000, 250000),
        },
        "description_templates": [
            "As a {title} you will own features end-to-end: from designing the database schema and building the API "
            "to crafting the React UI. You will ship independently and collaborate closely with product and design. "
            "We're a small, fast-moving team where engineers have high ownership and impact.",

            "Build and iterate on the full product stack at {company}. "
            "You will work across frontend (React/TypeScript) and backend ({skills}) "
            "to ship features that delight users. We value pragmatic engineering and fast iteration.",
        ],
        "requirements_pool": [
            "Comfortable across frontend (React/TypeScript) and backend",
            "Experience shipping production features end-to-end",
            "Strong understanding of relational databases and query optimisation",
            "Familiarity with cloud deployment (AWS, GCP, Vercel, or Heroku)",
            "Good instincts for UX and product design",
            "Experience with version control and code review workflows",
            "Ability to work independently with minimal supervision",
        ],
    },
    {
        "category": "Software Engineering – Mobile",
        "titles": ["iOS Engineer", "Android Engineer", "Mobile Engineer", "Flutter Developer",
                   "Senior iOS Engineer", "Senior Android Engineer", "Senior Flutter Developer",
                   "React Native Engineer", "Mobile Platform Engineer"],
        "departments": ["Mobile", "Mobile Engineering", "Product Engineering"],
        "skills_pools": [
            ["Flutter", "Dart", "Firebase", "REST APIs", "BLoC", "Riverpod", "Android", "iOS"],
            ["Swift", "UIKit", "SwiftUI", "Combine", "CoreData", "Firebase", "Xcode"],
            ["Kotlin", "Android SDK", "Jetpack Compose", "Coroutines", "Firebase", "MVVM"],
            ["React Native", "TypeScript", "Redux", "Firebase", "Expo", "iOS", "Android"],
        ],
        "salary_ranges": {
            "Entry":    (70000,  95000),
            "Mid":      (115000, 155000),
            "Senior":   (150000, 195000),
            "Lead":     (180000, 225000),
            "Director": (200000, 255000),
        },
        "description_templates": [
            "Join our mobile team to build a world-class app used by millions of users on iOS and Android. "
            "You will work in {skills}, ship features weekly, and maintain high ratings in both app stores. "
            "Strong candidates have published consumer-facing apps with measurable impact.",

            "As a {title} you will own the mobile product end-to-end: design review, implementation, testing, and release. "
            "You'll collaborate with backend engineers on API design and work directly with designers on motion and interaction. "
            "We care deeply about app performance, accessibility, and offline resilience.",
        ],
        "requirements_pool": [
            "3+ years mobile development experience",
            "Published at least one app on the App Store or Google Play",
            "Deep understanding of mobile UX patterns and platform guidelines",
            "Experience with REST APIs and offline-first data patterns",
            "Familiarity with mobile CI/CD (Fastlane, Bitrise, or similar)",
            "Understanding of app performance profiling and optimisation",
            "Experience with push notifications and deep linking",
            "Strong unit testing and UI testing discipline",
        ],
    },
    {
        "category": "DevOps / Platform / SRE",
        "titles": ["DevOps Engineer", "Senior DevOps Engineer", "Platform Engineer",
                   "Site Reliability Engineer", "Infrastructure Engineer", "Cloud Engineer",
                   "Staff SRE", "Principal DevOps Engineer"],
        "departments": ["Infrastructure", "Platform", "DevOps", "SRE"],
        "skills_pools": [
            ["Kubernetes", "Terraform", "AWS", "Docker", "CI/CD", "Python", "Helm", "ArgoCD"],
            ["Kubernetes", "Terraform", "GCP", "Docker", "Prometheus", "Grafana", "GitOps"],
            ["AWS", "Terraform", "Ansible", "Docker", "Jenkins", "Python", "Bash"],
            ["Azure", "Terraform", "Kubernetes", "Helm", "Azure DevOps", "Python"],
            ["AWS", "Kubernetes", "Kafka", "Terraform", "Python", "Datadog", "PagerDuty"],
        ],
        "salary_ranges": {
            "Entry":    (75000,  100000),
            "Mid":      (115000, 155000),
            "Senior":   (145000, 190000),
            "Lead":     (180000, 225000),
            "Director": (210000, 265000),
        },
        "description_templates": [
            "Own and evolve the cloud infrastructure serving millions of users. "
            "You will design CI/CD pipelines, manage Kubernetes clusters, implement GitOps workflows, "
            "and ensure 99.9%+ uptime SLAs. Our stack: {skills}.",

            "As a {title} at {company} you will build the internal platforms that empower our engineering teams to "
            "ship faster and safer. You'll implement infrastructure-as-code, set up observability, "
            "and drive the culture of 'you build it, you run it.'",
        ],
        "requirements_pool": [
            "Experience managing Kubernetes clusters in production",
            "Infrastructure-as-code with Terraform or Pulumi",
            "Strong scripting skills (Python, Bash, or Go)",
            "Experience with multi-cloud or hybrid cloud environments",
            "Understanding of networking (VPCs, load balancers, DNS, TLS)",
            "Experience with observability tools (Prometheus, Grafana, Datadog)",
            "CI/CD pipeline design and implementation experience",
            "On-call experience and incident management",
            "Security hardening and compliance experience (SOC2, PCI)",
        ],
    },
    {
        "category": "Security Engineering",
        "titles": ["Security Engineer", "Senior Security Engineer", "Application Security Engineer",
                   "Cloud Security Engineer", "Information Security Engineer", "Staff Security Engineer"],
        "departments": ["Security", "InfoSec", "Trust & Safety"],
        "skills_pools": [
            ["Python", "AWS Security", "SIEM", "Penetration Testing", "OWASP", "Terraform", "SOC2"],
            ["Cloud Security", "Kubernetes Security", "IAM", "CSPM", "Threat Modelling", "Python"],
            ["Application Security", "SAST", "DAST", "Burp Suite", "OWASP", "Python", "Go"],
        ],
        "salary_ranges": {
            "Entry":    (80000,  105000),
            "Mid":      (120000, 165000),
            "Senior":   (155000, 200000),
            "Lead":     (185000, 230000),
            "Director": (210000, 270000),
        },
        "description_templates": [
            "Protect {company}'s systems and customer data by building security programmes, "
            "conducting threat modelling, and working with engineering teams to remediate vulnerabilities. "
            "You will own our security roadmap and partner with DevOps on secure-by-default infrastructure.",

            "As a {title} you will conduct penetration tests, review code for security issues, "
            "build SAST/DAST tooling into CI/CD, and respond to security incidents. "
            "You'll be a security champion across the engineering organisation.",
        ],
        "requirements_pool": [
            "Strong understanding of OWASP Top 10 and common web vulnerabilities",
            "Experience with penetration testing tools (Burp Suite, Nessus)",
            "Cloud security expertise (AWS/GCP IAM, VPC, security groups)",
            "Experience implementing SAST/DAST in CI pipelines",
            "Familiarity with compliance frameworks (SOC2, ISO27001, PCI-DSS)",
            "Incident response and forensics experience",
            "Security certifications (CISSP, CEH, OSCP) a plus",
        ],
    },
    # ── Data / ML ─────────────────────────────────────────────────────────────
    {
        "category": "Data Science & Machine Learning",
        "titles": ["Data Scientist", "Senior Data Scientist", "Principal Data Scientist",
                   "Machine Learning Engineer", "Senior ML Engineer", "Staff ML Engineer",
                   "Research Scientist", "Applied Scientist", "AI Engineer",
                   "NLP Engineer", "Computer Vision Engineer"],
        "departments": ["Data Science", "AI/ML", "Research", "Applied AI"],
        "skills_pools": [
            ["Python", "scikit-learn", "TensorFlow", "SQL", "Spark", "MLflow", "AWS SageMaker"],
            ["Python", "PyTorch", "LLMs", "RAG", "Vector DBs", "MLflow", "Kubernetes"],
            ["Python", "PyTorch", "TensorFlow", "NLP", "Transformers", "HuggingFace", "Kubernetes"],
            ["Python", "PyTorch", "Computer Vision", "OpenCV", "YOLO", "CUDA", "Docker"],
            ["Python", "scikit-learn", "XGBoost", "SQL", "A/B testing", "Causal Inference"],
        ],
        "salary_ranges": {
            "Entry":    (85000,  115000),
            "Mid":      (120000, 160000),
            "Senior":   (155000, 210000),
            "Lead":     (190000, 250000),
            "Director": (220000, 290000),
        },
        "description_templates": [
            "Build and ship ML models that directly improve {company}'s core product. "
            "You will work across the full ML lifecycle: problem framing, data analysis, model development, "
            "and production deployment. Our stack: {skills}.",

            "As a {title} you will conduct original research, translate findings into production systems, "
            "and collaborate with engineering teams to deploy models at scale. "
            "We value rigorous experimentation and clear communication of uncertainty.",

            "Drive the data science roadmap at {company}. You will build predictive models, "
            "run A/B experiments, and work with data engineers to curate high-quality training datasets. "
            "You'll present findings to leadership and influence product decisions.",
        ],
        "requirements_pool": [
            "Strong Python and ML fundamentals (feature engineering, model selection, evaluation)",
            "Experience with PyTorch or TensorFlow",
            "Production ML experience (MLflow, Seldon, or similar)",
            "Strong SQL and data manipulation skills",
            "Experience with distributed computing (Spark or Dask)",
            "Ability to communicate complex results to non-technical stakeholders",
            "Experience designing and analysing A/B experiments",
            "Familiarity with LLMs and prompt engineering",
            "PhD or Master's in a quantitative field preferred",
            "Experience with vector databases (Pinecone, Weaviate, Qdrant)",
        ],
    },
    {
        "category": "Data Engineering",
        "titles": ["Data Engineer", "Senior Data Engineer", "Analytics Engineer",
                   "Staff Data Engineer", "Principal Data Engineer", "DataOps Engineer"],
        "departments": ["Data Engineering", "Data Platform", "Analytics"],
        "skills_pools": [
            ["Python", "Spark", "dbt", "Airflow", "BigQuery", "AWS", "SQL", "Kafka"],
            ["Python", "dbt", "Snowflake", "Airflow", "Fivetran", "SQL", "AWS"],
            ["Python", "Flink", "Kafka", "Spark", "Delta Lake", "AWS", "SQL"],
            ["Python", "dbt", "Databricks", "Delta Lake", "Airflow", "SQL", "Azure"],
        ],
        "salary_ranges": {
            "Entry":    (80000,  105000),
            "Mid":      (115000, 155000),
            "Senior":   (145000, 190000),
            "Lead":     (180000, 225000),
            "Director": (205000, 260000),
        },
        "description_templates": [
            "Build the data infrastructure that powers {company}'s analytics, ML, and product teams. "
            "You will design and maintain ELT pipelines, build the data warehouse, "
            "and ensure data quality and observability. Our stack: {skills}.",

            "As a {title} you will own the data platform end-to-end: ingestion, transformation, "
            "orchestration, and delivery. You'll partner with data scientists and analysts "
            "to build the foundational data products the business depends on.",
        ],
        "requirements_pool": [
            "Strong Python and SQL skills",
            "Experience building and maintaining ELT/ETL pipelines",
            "Hands-on experience with dbt or similar transformation tools",
            "Experience with a cloud data warehouse (Snowflake, BigQuery, or Redshift)",
            "Familiarity with orchestration tools (Airflow, Prefect, or Dagster)",
            "Experience with streaming data (Kafka or Kinesis)",
            "Strong understanding of data modelling (star schema, data vault)",
            "Experience with data quality monitoring and observability",
        ],
    },
    {
        "category": "Data Analytics & Business Intelligence",
        "titles": ["Data Analyst", "Senior Data Analyst", "Business Intelligence Analyst",
                   "Analytics Manager", "BI Developer", "Insights Analyst",
                   "Product Analyst", "Marketing Analyst", "Financial Data Analyst"],
        "departments": ["Analytics", "Business Intelligence", "Data & Insights", "Finance & Analytics"],
        "skills_pools": [
            ["SQL", "Tableau", "Python basics", "Excel", "Statistics", "Looker"],
            ["SQL", "Power BI", "Excel", "Python", "DAX", "Statistics"],
            ["SQL", "Looker", "Python", "dbt", "BigQuery", "A/B testing"],
            ["SQL", "Mode", "Python", "Mixpanel", "Amplitude", "A/B testing"],
        ],
        "salary_ranges": {
            "Entry":    (55000,  80000),
            "Mid":      (80000,  115000),
            "Senior":   (110000, 150000),
            "Lead":     (140000, 180000),
            "Director": (165000, 215000),
        },
        "description_templates": [
            "Turn data into decisions at {company}. "
            "You will build dashboards, run ad-hoc analyses, and help cross-functional teams "
            "understand their key metrics. Our stack: {skills}.",

            "As a {title} you will be the analytical partner for product, marketing, and operations teams. "
            "You'll design metrics frameworks, build self-serve reporting tools, and present insights to leadership. "
            "Strong candidates combine technical rigour with clear business communication.",
        ],
        "requirements_pool": [
            "Strong SQL (window functions, CTEs, subqueries)",
            "Experience with at least one BI tool (Tableau, Power BI, Looker, or Mode)",
            "Ability to communicate insights clearly to non-technical stakeholders",
            "Experience running and analysing A/B experiments",
            "Python or R for statistical analysis",
            "Experience with product analytics tools (Mixpanel, Amplitude)",
            "Strong attention to data quality and accuracy",
        ],
    },
    # ── Product ───────────────────────────────────────────────────────────────
    {
        "category": "Product Management",
        "titles": ["Product Manager", "Senior Product Manager", "Group Product Manager",
                   "Director of Product", "Associate Product Manager", "Technical Product Manager",
                   "Principal Product Manager", "Staff Product Manager"],
        "departments": ["Product", "Product Management"],
        "skills_pools": [
            ["Product strategy", "Roadmapping", "A/B testing", "SQL", "Figma", "Jira", "Stakeholder management"],
            ["Product strategy", "User research", "OKRs", "Data analysis", "Figma", "PRDs"],
            ["Technical PM", "APIs", "SQL", "Agile", "Jira", "Stakeholder management", "System design"],
        ],
        "salary_ranges": {
            "Entry":    (80000,  110000),
            "Mid":      (115000, 155000),
            "Senior":   (150000, 200000),
            "Lead":     (185000, 240000),
            "Director": (210000, 280000),
        },
        "description_templates": [
            "Lead the product strategy for a key area of {company}'s platform. "
            "You will define the roadmap, work with design and engineering to build features, "
            "and use data to measure impact. You'll report to the VP of Product.",

            "As a {title} at {company} you will identify user problems, prioritise solutions, "
            "and ship products that users love. You'll combine qualitative user research with "
            "quantitative data analysis to drive product decisions. Strong candidates have shipped "
            "0-to-1 products with measurable business impact.",
        ],
        "requirements_pool": [
            "Track record of shipping products with measurable user and business impact",
            "Data-driven approach to prioritisation and decision-making",
            "Strong cross-functional communication with engineering, design, and leadership",
            "Experience with product discovery methods (user interviews, usability testing)",
            "Ability to write clear, detailed PRDs and user stories",
            "Experience with agile development processes",
            "SQL proficiency for self-serve data analysis",
            "Experience conducting and analysing A/B experiments",
        ],
    },
    # ── Design ────────────────────────────────────────────────────────────────
    {
        "category": "Product & UX Design",
        "titles": ["UI/UX Designer", "Product Designer", "Senior Product Designer",
                   "UX Researcher", "UX Designer", "Interaction Designer",
                   "Staff Product Designer", "Principal Designer", "Design Lead",
                   "Visual Designer", "Brand Designer"],
        "departments": ["Design", "Product Design", "UX"],
        "skills_pools": [
            ["Figma", "User research", "Prototyping", "Design systems", "Accessibility", "Framer"],
            ["Figma", "Sketch", "InVision", "User testing", "Information architecture", "CSS basics"],
            ["Figma", "Motion design", "After Effects", "Design strategy", "User research"],
            ["Figma", "Framer", "Design tokens", "Storybook", "WCAG accessibility"],
        ],
        "salary_ranges": {
            "Entry":    (65000,  90000),
            "Mid":      (95000,  130000),
            "Senior":   (130000, 170000),
            "Lead":     (160000, 210000),
            "Director": (185000, 245000),
        },
        "description_templates": [
            "Craft exceptional user experiences at {company}. "
            "You will lead design from research and wireframes through polished prototypes and developer handoff. "
            "We use Figma as our design tool and care deeply about accessibility and usability.",

            "As a {title} you will own the end-to-end design process for key product areas. "
            "You'll conduct user research, facilitate design sprints, build components in our design system, "
            "and collaborate with engineers to ensure high-fidelity implementation.",
        ],
        "requirements_pool": [
            "Portfolio demonstrating shipped digital products",
            "Expert proficiency in Figma",
            "Experience conducting user research and usability testing",
            "Strong understanding of design systems and component libraries",
            "Knowledge of web and mobile accessibility standards (WCAG)",
            "Ability to rapidly prototype ideas and iterate based on feedback",
            "Experience collaborating closely with engineers on implementation",
            "Strong communication and storytelling skills",
        ],
    },
    # ── Marketing ─────────────────────────────────────────────────────────────
    {
        "category": "Marketing",
        "titles": ["Growth Marketing Manager", "Content Marketing Manager", "SEO Specialist",
                   "Performance Marketing Manager", "Email Marketing Manager", "Marketing Manager",
                   "Head of Marketing", "VP of Marketing", "Demand Generation Manager",
                   "Product Marketing Manager", "Brand Marketer", "Social Media Manager",
                   "Content & SEO Specialist", "Affiliate Marketing Manager"],
        "departments": ["Marketing", "Growth", "Demand Generation"],
        "skills_pools": [
            ["SEO", "SEM", "Google Ads", "Meta Ads", "A/B testing", "Analytics", "HubSpot"],
            ["Content writing", "SEO", "Ahrefs", "WordPress", "Email marketing", "Copywriting"],
            ["Demand generation", "HubSpot", "Salesforce", "ABM", "Paid media", "Analytics"],
            ["Product marketing", "GTM strategy", "Competitive analysis", "Messaging", "Sales enablement"],
        ],
        "salary_ranges": {
            "Entry":    (50000,  75000),
            "Mid":      (80000,  115000),
            "Senior":   (110000, 150000),
            "Lead":     (140000, 180000),
            "Director": (160000, 220000),
        },
        "description_templates": [
            "Drive growth at {company} across paid, organic, and viral channels. "
            "You will own acquisition targets, run multivariate experiments, and work with product "
            "to build referral and retention loops.",

            "As a {title} you will develop and execute the marketing strategy that fuels {company}'s growth. "
            "You'll own the content calendar, manage paid campaigns, analyse performance, "
            "and collaborate with sales to maximise pipeline.",
        ],
        "requirements_pool": [
            "3+ years in digital marketing or growth",
            "Experience managing paid media budgets (Google, Meta, LinkedIn)",
            "Strong analytical skills and comfort with marketing analytics tools",
            "Experience with SEO strategy and content marketing",
            "Familiarity with marketing automation tools (HubSpot, Marketo)",
            "Ability to design and run A/B experiments",
            "Strong copywriting and communication skills",
            "Experience with CRM and email marketing platforms",
        ],
    },
    # ── Sales & Business Development ─────────────────────────────────────────
    {
        "category": "Sales & Business Development",
        "titles": ["Account Executive", "Senior Account Executive", "Sales Development Representative",
                   "Business Development Manager", "Solutions Engineer", "Enterprise Account Executive",
                   "VP of Sales", "Director of Sales", "Sales Manager", "Inside Sales Rep",
                   "Channel Sales Manager", "Partner Manager"],
        "departments": ["Sales", "Revenue", "Business Development"],
        "skills_pools": [
            ["Salesforce", "Outreach", "Prospecting", "SaaS sales", "Negotiation", "Pipeline management"],
            ["Salesforce", "HubSpot", "Cold outreach", "Discovery calls", "Demo skills", "CRM"],
            ["Technical sales", "Solution selling", "APIs", "SaaS", "Salesforce", "Negotiation"],
        ],
        "salary_ranges": {
            "Entry":    (50000,  70000),
            "Mid":      (80000,  120000),
            "Senior":   (120000, 180000),
            "Lead":     (160000, 220000),
            "Director": (190000, 280000),
        },
        "description_templates": [
            "Drive new business at {company} by managing the full sales cycle from prospecting to close. "
            "You will build relationships with decision-makers, run compelling demos, and exceed quota consistently. "
            "We use Salesforce and Outreach.",

            "As a {title} at {company} you will identify new market opportunities, develop partner relationships, "
            "and build a strong pipeline. You'll collaborate closely with marketing on lead generation "
            "and work with customer success to ensure smooth handoffs.",
        ],
        "requirements_pool": [
            "Track record of meeting or exceeding sales quota",
            "Experience with full-cycle B2B SaaS sales",
            "Strong discovery and qualification skills (MEDDIC or SPIN)",
            "Excellent communication and presentation skills",
            "Proficiency with Salesforce or similar CRM",
            "Ability to manage a high-volume pipeline",
            "Experience selling to technical buyers or C-suite",
        ],
    },
    # ── Finance & Accounting ──────────────────────────────────────────────────
    {
        "category": "Finance & Accounting",
        "titles": ["Financial Analyst", "Senior Financial Analyst", "FP&A Analyst",
                   "Accountant", "Senior Accountant", "Controller", "VP of Finance",
                   "CFO", "Investment Analyst", "Treasury Analyst", "Tax Manager"],
        "departments": ["Finance", "Accounting", "FP&A"],
        "skills_pools": [
            ["Excel", "Financial modelling", "SQL", "PowerPoint", "FP&A", "Budgeting"],
            ["QuickBooks", "NetSuite", "Excel", "GAAP", "Reconciliation", "Financial reporting"],
            ["Excel", "Python basics", "SQL", "Tableau", "Financial modelling", "Variance analysis"],
        ],
        "salary_ranges": {
            "Entry":    (55000,  80000),
            "Mid":      (85000,  120000),
            "Senior":   (115000, 155000),
            "Lead":     (145000, 200000),
            "Director": (180000, 260000),
        },
        "description_templates": [
            "Support the finance team at {company} with financial modelling, forecasting, and reporting. "
            "You will build models that help leadership make data-driven decisions on investment and resourcing.",

            "As a {title} you will own monthly close, prepare board reporting, and partner with department heads "
            "on budget management. You'll drive process improvements to scale the finance function "
            "as the company grows.",
        ],
        "requirements_pool": [
            "Strong financial modelling skills in Excel",
            "Understanding of GAAP accounting principles",
            "Experience with ERP systems (NetSuite, Workday, or SAP)",
            "Ability to present complex financial data clearly to leadership",
            "CPA or CFA certification a plus",
            "Experience supporting a fast-growing startup or technology company",
            "SQL proficiency for data analysis",
        ],
    },
    # ── Operations & Project Management ──────────────────────────────────────
    {
        "category": "Operations & Programme Management",
        "titles": ["Operations Manager", "Senior Operations Manager", "Business Analyst",
                   "Project Manager", "Programme Manager", "Chief of Staff", "Strategy Manager",
                   "Operations Analyst", "VP of Operations"],
        "departments": ["Operations", "Strategy & Operations", "Business Operations"],
        "skills_pools": [
            ["Excel", "SQL", "Tableau", "Project management", "Process improvement", "Stakeholder management"],
            ["Jira", "Confluence", "Agile", "Project management", "Stakeholder communication", "Risk management"],
            ["SQL", "Data analysis", "Strategy", "Excel", "Stakeholder management", "Presentation skills"],
        ],
        "salary_ranges": {
            "Entry":    (55000,  80000),
            "Mid":      (85000,  120000),
            "Senior":   (115000, 155000),
            "Lead":     (145000, 195000),
            "Director": (175000, 240000),
        },
        "description_templates": [
            "Drive operational excellence at {company}. "
            "You will identify inefficiencies, design scalable processes, and ensure cross-functional alignment "
            "across engineering, product, and go-to-market teams.",

            "As a {title} you will own high-priority strategic initiatives from scoping through execution. "
            "You'll partner with senior leadership to define the operating model, manage complex dependencies, "
            "and ensure the organisation delivers on its commitments.",
        ],
        "requirements_pool": [
            "Strong analytical and problem-solving skills",
            "Experience managing cross-functional projects",
            "Excellent written and verbal communication",
            "Proficiency in project management tools (Jira, Asana, or Notion)",
            "Experience driving process improvement initiatives",
            "SQL proficiency for operational analysis",
            "Comfort with ambiguity in a fast-moving environment",
        ],
    },
    # ── Customer Success & Support ────────────────────────────────────────────
    {
        "category": "Customer Success & Support",
        "titles": ["Customer Success Manager", "Senior Customer Success Manager",
                   "Technical Account Manager", "Implementation Manager", "Support Engineer",
                   "Head of Customer Success", "VP of Customer Success",
                   "Customer Success Specialist"],
        "departments": ["Customer Success", "Account Management", "Support"],
        "skills_pools": [
            ["Salesforce", "Gainsight", "Customer success", "Relationship management", "SaaS", "SQL basics"],
            ["Technical support", "Zendesk", "SQL", "APIs", "Troubleshooting", "Customer communication"],
            ["Onboarding", "Training", "Renewals", "Upsell", "Gainsight", "Executive communication"],
        ],
        "salary_ranges": {
            "Entry":    (50000,  70000),
            "Mid":      (75000,  105000),
            "Senior":   (100000, 140000),
            "Lead":     (130000, 175000),
            "Director": (155000, 215000),
        },
        "description_templates": [
            "Be the trusted advisor for {company}'s customers. "
            "You will own the post-sale relationship, drive adoption, manage renewals, "
            "and identify expansion opportunities. Success means customers renew and expand.",

            "As a {title} you will onboard new customers, deliver training, "
            "and conduct regular business reviews. You'll be the voice of the customer internally "
            "and work with product to prioritise roadmap items.",
        ],
        "requirements_pool": [
            "Experience in customer success or account management at a SaaS company",
            "Strong relationship management and executive communication skills",
            "Experience managing a portfolio of accounts ($1M+ ARR)",
            "Comfortable with Salesforce or Gainsight",
            "Track record of high renewal rates and NPS scores",
            "Ability to understand technical products and communicate their value",
        ],
    },
    # ── HR / People ──────────────────────────────────────────────────────────
    {
        "category": "Human Resources & Recruiting",
        "titles": ["Recruiter", "Senior Recruiter", "Technical Recruiter", "HR Business Partner",
                   "People Operations Manager", "Talent Acquisition Manager",
                   "HR Manager", "VP of People", "Chief People Officer",
                   "Compensation Analyst", "L&D Manager"],
        "departments": ["People", "Human Resources", "Talent Acquisition"],
        "skills_pools": [
            ["Recruiting", "LinkedIn Recruiter", "ATS", "Offer negotiation", "Sourcing", "Interviewing"],
            ["HR Business Partner", "Employee relations", "Performance management", "Workday", "HRBP"],
            ["People operations", "Compensation", "Benefits", "HRIS", "Compliance"],
        ],
        "salary_ranges": {
            "Entry":    (50000,  70000),
            "Mid":      (75000,  110000),
            "Senior":   (110000, 150000),
            "Lead":     (140000, 185000),
            "Director": (170000, 230000),
        },
        "description_templates": [
            "Build and grow {company}'s team by sourcing, evaluating, and closing top-tier candidates. "
            "You will partner with hiring managers to define roles, build talent pipelines, "
            "and deliver an exceptional candidate experience.",

            "As a {title} you will be the strategic people partner for assigned business units. "
            "You'll support leaders on organisational design, performance management, and employee engagement, "
            "and help {company} scale its culture as the team grows.",
        ],
        "requirements_pool": [
            "Experience in recruiting or HR at a fast-growing technology company",
            "Track record of closing hard-to-fill technical roles",
            "Excellent candidate and stakeholder communication",
            "Proficiency with ATS platforms (Greenhouse, Lever, or Workday)",
            "Experience with compensation benchmarking and offer construction",
            "Strong data skills — tracking pipelines and reporting to leadership",
        ],
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# GENERATION LOGIC
# ─────────────────────────────────────────────────────────────────────────────

def random_benefits():
    n = rng.randint(3, 6)
    return rng.sample(BENEFITS_POOL, n)


def random_requirements(pool, n=4):
    return rng.sample(pool, min(n, len(pool)))


def salary_for_level(ranges, level):
    lo, hi = ranges.get(level, (70000, 120000))
    # randomise within band
    lo = int(lo * rng.uniform(0.92, 1.0))
    hi = int(hi * rng.uniform(1.0, 1.08))
    return str(lo), str(hi)


def pick_exp_level(category_obj, job_type):
    if job_type == "Internship":
        return "Entry"
    if job_type == "Part-time" and rng.random() < 0.6:
        return rng.choice(["Entry", "Mid"])
    return rng.choice(EXP_LEVELS)


def generate_job(category_obj, job_number):
    title     = rng.choice(category_obj["titles"])
    company   = rng.choice(COMPANIES)
    location  = rng.choice(LOCATIONS)
    work_mode = rng.choice(WORK_MODES)
    job_type  = rng.choice(JOB_TYPES)
    exp_level = pick_exp_level(category_obj, job_type)
    department = rng.choice(category_obj["departments"])
    skills_list = rng.choice(category_obj["skills_pools"])
    skills_str  = ", ".join(skills_list)
    salary_lo, salary_hi = salary_for_level(category_obj["salary_ranges"], exp_level)
    recruiter_id = rng.choice(RECRUITER_IDS)
    visa = rng.choice(VISA_WEIGHTS)

    # Salary visible ~80% of the time
    salary_visible = rng.random() < 0.80

    # Description
    desc_template = rng.choice(category_obj["description_templates"])
    description = desc_template.format(
        title=title, company=company, skills=skills_str
    )

    requirements = random_requirements(category_obj["requirements_pool"], rng.randint(3, 6))
    benefits     = random_benefits()

    # Offset posted dates across last 90 days for realism
    days_ago = rng.randint(0, 90)
    posted_dt = datetime.date.today() - datetime.timedelta(days=days_ago)
    posted_date = posted_dt.isoformat()

    # Status: 90% Open, 8% In Review, 2% Closed
    status = rng.choices(["Open", "In Review", "Closed"], weights=[90, 8, 2])[0]

    return {
        "title": title,
        "company": company,
        "department": department,
        "location": location,
        "workMode": work_mode,
        "jobType": job_type,
        "experienceLevel": exp_level,
        "salaryMin": salary_lo,
        "salaryMax": salary_hi,
        "salaryVisible": salary_visible,
        "skills": skills_str,
        "requirements": requirements,
        "benefits": benefits,
        "description": description,
        "screeningQuestions": [],
        "status": status,
        "visaSponsorship": visa,
        "recruiterId": recruiter_id,
        "postedDate": posted_date,
        "_generated": True,
        "_jobNumber": job_number,
    }


def generate_all_jobs(n=1000):
    """Generate n jobs distributed across categories."""
    # Build a weighted cycle so every category gets proportional representation
    category_cycle = list(itertools.islice(
        itertools.cycle(CATEGORIES),
        n
    ))
    rng.shuffle(category_cycle)
    return [generate_job(cat, i + 1) for i, cat in enumerate(category_cycle)]


def batch_insert(jobs):
    """Insert jobs using Firestore batch writes (max 500 per batch)."""
    total = len(jobs)
    inserted = 0
    BATCH_SIZE = 499  # stay under 500 limit

    for start in range(0, total, BATCH_SIZE):
        chunk = jobs[start:start + BATCH_SIZE]
        batch = db.batch()
        for job in chunk:
            ref = db.collection("jobs").document()
            batch.set(ref, job)
        batch.commit()
        inserted += len(chunk)
        print(f"  Committed batch: {inserted}/{total} jobs", flush=True)

    return inserted


def clear_generated():
    print("[CLEAR] Removing previously generated jobs (_generated=True)...")
    # Firestore cannot stream-delete > 500 docs without pagination
    deleted = 0
    while True:
        docs = list(db.collection("jobs").where("_generated", "==", True).limit(499).stream())
        if not docs:
            break
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
        batch.commit()
        deleted += len(docs)
        print(f"  Deleted {deleted} jobs so far...")
    print(f"  Total deleted: {deleted}")


def print_summary(jobs):
    from collections import Counter
    wm  = Counter(j["workMode"] for j in jobs)
    jt  = Counter(j["jobType"] for j in jobs)
    el  = Counter(j["experienceLevel"] for j in jobs)
    st  = Counter(j["status"] for j in jobs)
    cat = Counter(j["department"] for j in jobs)

    print("\n" + "="*60)
    print(f" GENERATED {len(jobs)} JOBS — BREAKDOWN")
    print("="*60)
    print("\nWork Mode:")
    for k, v in sorted(wm.items()): print(f"  {k:<20} {v}")
    print("\nJob Type:")
    for k, v in sorted(jt.items()): print(f"  {k:<20} {v}")
    print("\nExperience Level:")
    for k, v in sorted(el.items()): print(f"  {k:<20} {v}")
    print("\nStatus:")
    for k, v in sorted(st.items()): print(f"  {k:<20} {v}")
    print("\nTop Departments:")
    for k, v in cat.most_common(10): print(f"  {k:<35} {v}")
    print("\nAI SEMANTIC SEARCH — try these:")
    print('  "remote machine learning engineer with LLM experience"')
    print('  "entry level frontend react developer new york"')
    print('  "senior devops kubernetes aws remote"')
    print('  "product designer figma startup"')
    print('  "B2B SaaS account executive enterprise sales"')
    print('  "data engineer dbt snowflake pipeline"')
    print('  "financial analyst startup series B"')
    print('  "flutter mobile developer cross-platform"')
    print("="*60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--clear", action="store_true", help="Delete generated jobs before inserting")
    parser.add_argument("--count", type=int, default=1000, help="Number of jobs to generate (default 1000)")
    args = parser.parse_args()

    if args.clear:
        clear_generated()

    print(f"\n[GENERATE] Building {args.count} mock jobs...")
    jobs = generate_all_jobs(args.count)

    print(f"[INSERT] Writing to Firestore in batches of 499...")
    inserted = batch_insert(jobs)

    print(f"\n[DONE] {inserted} jobs inserted successfully.")
    print_summary(jobs)
