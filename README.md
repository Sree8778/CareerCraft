# CareerCraft — AI-Powered Job Recruitment Portal

> A full-stack, production-deployed recruitment platform with end-to-end AI automation for candidates and recruiters. Bring Your Own Key (BYOK) architecture — every AI feature runs on the user's own API keys with zero shared cost.

**Live Demo:** https://careercraft-frontend-brkwttcaqq-uc.a.run.app

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [User Roles & Flows](#user-roles--flows)
  - [Candidate Flow](#candidate-flow)
  - [Recruiter Flow](#recruiter-flow)
- [Feature Modules](#feature-modules)
  - [Resume Builder](#1-ai-resume-builder)
  - [Job Search & Application](#2-job-search--application)
  - [AI Practice Interview](#3-ai-voice-practice-interview)
  - [Live Proctored Interview](#4-live-proctored-interview)
  - [Recruiter Copilot](#5-recruiter-ai-copilot)
  - [Messaging & Network](#6-messaging--ecosystem-network)
  - [BYOK API Key Vault](#7-byok-api-key-vault)
- [AI Router — Multi-Provider Fallback](#ai-router--multi-provider-fallback)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)

---

## Overview

CareerCraft automates the full hiring lifecycle — from resume parsing and job matching to AI voice interviews and offer notifications — for both candidates and recruiters.

```
Candidate                          Platform                         Recruiter
─────────                          ────────                         ─────────
Upload Resume ──► AI Parse ──► Structured Profile ──► Semantic Match ──► Recruiter View
Apply to Job  ──► Cover Letter Gen ──► ATS Score ──► Application Pipeline
Practice Interview (Voice AI) ──► Score & Coaching
Live Interview (Proctored) ──► Evaluation ──► Status Update ──► Email Notify
```

---

## System Architecture

```mermaid
graph TB
    subgraph Frontend ["Frontend — Next.js 15 (TypeScript)"]
        LP[Landing Page]
        CB[Candidate Browser]
        RB[Recruiter Board]
    end

    subgraph Backend ["Backend — Flask (Python)"]
        AR[API Router / routes.py]
        AIR[AI Router / ai_router.py]
        OU[AI Functions / ollama_utils.py]
    end

    subgraph AI ["AI Providers — BYOK"]
        GEM[Gemini 2.5 Flash]
        OAI[OpenAI GPT-4o]
        NIM[NVIDIA NIM — Llama 3.x]
        GRQ[Groq — Llama 3.1]
        CLN[Claude Sonnet]
    end

    subgraph Data ["Data Layer"]
        FS[(Firestore)]
        FAuth[Firebase Auth]
        FStorage[Firebase Storage]
    end

    Frontend --> Backend
    AR --> AIR
    AIR --> GEM
    AIR --> OAI
    AIR --> NIM
    AIR --> GRQ
    AIR --> CLN
    AR --> FS
    Frontend --> FAuth
    Frontend --> FStorage
```

---

## User Roles & Flows

### Candidate Flow

```mermaid
flowchart TD
    A([User visits site]) --> B{Has account?}
    B -- No --> C[Sign Up → Onboarding]
    B -- Yes --> D[Sign In]
    C --> E[Choose Role: Candidate]
    E --> F[Fill profile: name, phone, location]
    F --> G[Add API Keys to Vault]
    G --> H[Candidate Dashboard]

    H --> I[Resume Builder]
    H --> J[Browse Jobs]
    H --> K[Practice Interview]
    H --> L[Messages]
    H --> M[Network]

    I --> I1[Upload / paste resume]
    I1 --> I2[AI parses into sections]
    I2 --> I3[Edit, enhance with AI, export PDF/DOCX]

    J --> J1[Semantic search by query]
    J1 --> J2[View job details]
    J2 --> J3[AI grades resume vs JD]
    J3 --> J4[One-click apply + AI cover letter]
    J4 --> J5[Track in application pipeline]

    K --> K1[Set role, type, difficulty, JD]
    K1 --> K2[AI Voice Interview — Alex]
    K2 --> K3[Speak answers — STT transcription]
    K3 --> K4[AI reacts, asks next question]
    K4 --> K5{All questions done?}
    K5 -- No --> K3
    K5 -- Yes --> K6[Final score, per-Q breakdown, coaching]

    J5 --> N{Recruiter schedules interview?}
    N -- Yes --> O[Google Calendar invite + email sent]
    O --> P[Live Proctored Interview]
    P --> P1[Face verification vs state ID]
    P1 --> P2[AI voice Q&A with anti-cheat]
    P2 --> P3[Score evaluated + result emailed]
```

---

### Recruiter Flow

```mermaid
flowchart TD
    A([Recruiter signs up]) --> B[Onboarding: org name, industry]
    B --> C[Add API Keys to Vault]
    C --> D[Recruiter Dashboard]

    D --> E[Post Requisition]
    D --> F[View Applications]
    D --> G[Candidate Search Copilot]
    D --> H[Schedule Interview]
    D --> I[Webhooks / ATS Sync]

    E --> E1[Fill title, description, requirements]
    E1 --> E2[Job published to candidate feed]

    F --> F1[Kanban view: Applied → Hired]
    F1 --> F2[Click candidate → full profile]
    F2 --> F3[View AI-parsed resume]
    F3 --> F4[Add recruiter notes]
    F4 --> F5[Update status → auto email candidate]

    G --> G1[Enter natural language query]
    G1 --> G2[AI semantic search across all candidates]
    G2 --> G3[Ranked list with match explanations]

    H --> H1[Select candidate + date/time]
    H1 --> H2[Google Calendar event created]
    H2 --> H3[Email sent to candidate]
    H3 --> H4[Live proctored session begins]
    H4 --> H5[AI evaluates answers]
    H5 --> H6[Recruiter receives detailed score report]
```

---

## Feature Modules

### 1. AI Resume Builder

```mermaid
flowchart LR
    Upload[Upload PDF/DOCX] --> Parse[AI Parser\nextract structured JSON]
    Parse --> Sections[Sections: Experience\nEducation, Skills\nProjects, Publications]
    Sections --> Enhance[Enhance Section\n3 AI rewrites]
    Sections --> Summary[Generate 3\nProfessional Summaries]
    Sections --> Pitch[30-sec\nElevator Pitch]
    Sections --> Export[Export\nPDF / DOCX]
```

- Parses any resume format (PDF, DOCX, plain text) into structured sections
- AI rewrites any section in 3 style variants (concise / detailed / impactful)
- Generates professional summaries and a 30-second elevator pitch
- Exports to polished PDF or DOCX using branded template

---

### 2. Job Search & Application

```mermaid
flowchart LR
    Query[Natural language\nsearch query] --> Semantic[AI Semantic\nJob Matching]
    Semantic --> Results[Ranked job listings]
    Results --> JD[View job details]
    JD --> Grade[AI grades resume\nvs job description\nATS score 0-100]
    Grade --> Apply[One-click Apply]
    Apply --> CoverLetter[AI generates\npersonalised cover letter]
    CoverLetter --> Track[Application tracked\nin pipeline]
```

- Semantic search understands intent, not just keywords
- ATS score shows which resume keywords are missing
- Cover letter is generated from the candidate's actual resume content and the specific JD
- Application status updates trigger email notifications at every stage

---

### 3. AI Voice Practice Interview

```mermaid
sequenceDiagram
    participant C as Candidate
    participant STT as Browser STT
    participant API as Backend AI
    participant TTS as Browser TTS

    C->>API: Start session (role, type, difficulty, JD)
    API->>TTS: Opening greeting + first question
    TTS-->>C: Alex speaks (selected voice)

    loop Each question turn
        C->>STT: Speaks answer
        STT-->>C: Live transcript shown
        Note over STT: 2.5s silence → auto-submit
        C->>API: Answer submitted
        API->>API: React to answer, pick next question\n(uses JD context if provided)
        API->>TTS: Natural response + next question
        TTS-->>C: Alex speaks
    end

    C->>API: Interview ends
    API-->>C: Score report: overall, per-question,\nstrengths, improvements
```

**Key features:**
- Full voice experience — candidate speaks, AI responds in a chosen voice
- Job description field tailors every question to the actual role
- 4 interview types: Technical, Behavioral, HR, Mixed
- 3 difficulty levels: Junior, Mid, Senior
- 3, 5, or 8 questions per session
- Chrome SpeechSynthesis keepalive prevents mid-interview audio dropouts
- Ref-based state prevents stale-closure context loss across turns
- Final report: overall score /10, per-question breakdown, coaching tips

---

### 4. Live Proctored Interview

```mermaid
flowchart TD
    Schedule[Recruiter schedules] --> Calendar[Google Calendar event\ncreated for both parties]
    Calendar --> Email[Email invites sent]
    Email --> Candidate[Candidate joins session]

    Candidate --> Verify[Face Verification\nState ID photo vs selfie]
    Verify --> Pass{Match?}
    Pass -- No --> Reject[Access denied]
    Pass -- Yes --> Interview[Live AI Interview begins]

    Interview --> Q1[AI asks question]
    Q1 --> A1[Candidate speaks answer]
    A1 --> AntiCheat{Anti-cheat checks}
    AntiCheat --> AC1[Eye tracking]
    AntiCheat --> AC2[Tab switching detection]
    AntiCheat --> AC3[AI answer detection]
    AntiCheat --> AC4[Unusual pause analysis]
    A1 --> Eval[AI evaluates answer\n+ integrity score]
    Eval --> NextQ{More questions?}
    NextQ -- Yes --> Q1
    NextQ -- No --> Report[Full report sent\nto recruiter]
```

---

### 5. Recruiter AI Copilot

```mermaid
flowchart LR
    Query["Natural language query\ne.g. 'React dev with\n3yrs fintech experience'"] --> Copilot[AI Semantic\nCandidate Search]
    Copilot --> Rank[Ranked candidates\nwith match reasoning]
    Rank --> Profile[View full AI-parsed\nresume + notes]
    Profile --> Pipeline[Move through\nKanban pipeline]
    Pipeline --> Notify[Auto-email\ncandidate on\nstatus change]
```

---

### 6. Messaging & Ecosystem Network

- **Direct messaging** between candidates and recruiters after a connection is accepted
- **Connection system**: send / accept / decline connection requests
- **Network directory**: searchable list of all registered users, filterable by role
- **Real-time chat** stored in Firestore, accessible from both candidate and recruiter dashboards

---

### 7. BYOK API Key Vault

```mermaid
flowchart TD
    User[User adds API key\nin Profile → Settings] --> Validate[Backend validates key\nwith live API test call]
    Validate --> Pass{Valid?}
    Pass -- No --> Error[Show error badge\nInvalid / Exhausted]
    Pass -- Yes --> Encrypt[Encrypt with Fernet\nmaster key]
    Encrypt --> Store[Store in Firestore\nuser wallet]
    Store --> Router[AI Router reads wallet\non every request]
    Router --> Try[Try keys in order]
    Try --> Success{Success?}
    Success -- Yes --> Return[Return AI response]
    Success -- No\n429/401 --> Next[Try next key\nor provider]
    Next --> Exhausted{All failed?}
    Exhausted -- Yes --> 402[Return 402\nno_api_keys]
    Exhausted -- No --> Try
```

**Supported providers:**
| Provider | Light Model | Heavy Model |
|---|---|---|
| Gemini | gemini-2.5-flash | gemini-2.5-flash |
| OpenAI | gpt-4o-mini | gpt-4o |
| NVIDIA NIM | llama-3.1-8b-instruct | llama-3.3-70b-instruct |
| Groq | llama-3.1-8b-instant | llama-3.1-70b-versatile |
| Claude | claude-haiku-4-5 | claude-sonnet-4-6 |

Keys are **Fernet-encrypted at rest** in Firestore. The master encryption key never leaves Cloud Run environment variables.

---

## AI Router — Multi-Provider Fallback

```mermaid
flowchart TD
    Request[AI function called] --> Wallet[Load user's\nencrypted key wallet]
    Wallet --> Decrypt[Decrypt each key\nwith Fernet]
    Decrypt --> Order[Order: Gemini → OpenAI\n→ NVIDIA → Groq → Claude]
    Order --> Call[Call provider API]
    Call --> OK{200 OK?}
    OK -- Yes --> Response[Return text/JSON]
    OK -- No 401/403 --> Mark[Mark key Invalid]
    OK -- No 429 --> Mark2[Mark key Exhausted]
    Mark --> Next[Try next key]
    Mark2 --> Next
    Next --> Empty{No keys left?}
    Empty -- Yes --> Error[Raise NO_API_KEYS\nFrontend shows 402 toast]
    Empty -- No --> Call
```

Every AI feature in the app (resume parsing, cover letters, interview questions, semantic search, company profiles) runs through this router. If one key rate-limits, it falls through to the next automatically.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, TypeScript, Tailwind CSS, Framer Motion |
| **Backend** | Flask (Python), Gunicorn |
| **Database** | Firestore (NoSQL) |
| **Auth** | Firebase Authentication (email/password, Google OAuth) |
| **Storage** | Firebase Storage (resume files) |
| **AI** | Gemini 2.5 Flash, OpenAI GPT-4o, NVIDIA NIM Llama 3.x, Groq, Claude |
| **Voice STT** | Web Speech API (browser-native, Chrome/Edge) |
| **Voice TTS** | Web SpeechSynthesis API (browser-native, user-selectable voice) |
| **Face Verify** | Firebase Vision / custom face comparison |
| **Calendar** | Google Calendar API |
| **Email** | SMTP / email_utils |
| **Deployment** | Google Cloud Run (containerised, auto-scaling) |
| **CI/CD** | Google Cloud Build |
| **Image Registry** | Google Artifact Registry |

---

## Project Structure

```
Job portal project/
├── web/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                    # Landing page
│   │   │   ├── onboarding/                 # Role selection & profile setup
│   │   │   ├── candidate/
│   │   │   │   ├── dashboard/              # Candidate home
│   │   │   │   ├── resume-builder/         # AI resume editor
│   │   │   │   ├── jobs/                   # Browse & apply to jobs
│   │   │   │   ├── interview/              # Live proctored interview
│   │   │   │   ├── interview/practice/     # AI voice practice interview
│   │   │   │   ├── messages/               # Chat with recruiters
│   │   │   │   ├── network/                # Professional directory
│   │   │   │   └── profile/                # Settings & API key vault
│   │   │   ├── recruiter/
│   │   │   │   ├── dashboard/              # Recruiter home + KPIs
│   │   │   │   ├── requisitions/           # Job postings management
│   │   │   │   ├── candidates/             # Candidate directory + AI copilot
│   │   │   │   ├── applications/           # Application kanban pipeline
│   │   │   │   ├── messages/               # Chat with candidates
│   │   │   │   ├── network/                # Professional directory
│   │   │   │   ├── sourcing/               # Semantic candidate sourcing
│   │   │   │   ├── profile/                # Org settings
│   │   │   │   └── webhooks/               # ATS integration webhooks
│   │   │   └── companies/                  # Company explorer
│   │   ├── components/
│   │   │   └── layout/                     # Sidebars, nav, shared UI
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx             # Firebase auth state
│   │   └── lib/
│   │       ├── firebase.ts                 # Firebase client config
│   │       └── api.ts                      # API base URL
│   ├── backend/
│   │   ├── app.py                          # Flask app factory
│   │   ├── routes.py                       # All API endpoints (~50 routes)
│   │   ├── ai_router.py                    # BYOK multi-provider AI router
│   │   ├── ollama_utils.py                 # All AI feature functions
│   │   ├── firebase_utils.py               # Firestore helpers
│   │   ├── vault_utils.py                  # Fernet encryption/decryption
│   │   ├── email_utils.py                  # Email notifications
│   │   ├── google_calendar_utils.py        # Calendar scheduling
│   │   ├── face_verification.py            # Biometric ID check
│   │   ├── file_parser.py                  # PDF/DOCX text extraction
│   │   ├── document_generator.py           # PDF/DOCX export
│   │   └── requirements.txt
│   ├── cloudbuild.yaml                     # Cloud Build frontend config
│   └── deploy.ps1                          # One-command deploy script
├── mobile/                                 # Flutter mobile app
└── android application/                    # Android native app
```

---

## Local Development

### Prerequisites

- Node.js 18+
- Python 3.11+
- Firebase project with Firestore and Authentication enabled
- At least one AI provider API key (Gemini recommended — free tier available)

### Frontend

```bash
cd web
npm install
cp .env.local.example .env.local   # fill in Firebase config + backend URL
npm run dev
# → http://localhost:3000
```

### Backend

```bash
cd web/backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
python app.py
# → http://127.0.0.1:5000
```

### Required `.env.local` values

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5000/api
```

---

## Deployment

The project deploys to **Google Cloud Run** via a single PowerShell script.

```powershell
# Full deploy (backend + frontend) — ~15 min
.\deploy.ps1

# Frontend only — ~7 min (use when only frontend files changed)
.\deploy.ps1 -FrontendOnly
```

**What the script does:**

```mermaid
flowchart LR
    A[Load .env.cloud] --> B[Configure gcloud]
    B --> C[Enable Cloud APIs]
    C --> D[Build backend\nvia Cloud Build]
    D --> E[Deploy backend\nto Cloud Run]
    E --> F[Fetch backend URL]
    F --> G[Build frontend\nwith env vars injected]
    G --> H[Deploy frontend\nto Cloud Run]
    H --> I[Print live URLs]
```

### `.env.cloud` required values

```env
GCP_PROJECT_ID=your-gcp-project-id
GCP_REGION=us-central1
GEMINI_API_KEY=                          # server-side fallback key (optional)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
BACKEND_VAULT_MASTER_KEY=               # Fernet key for API key encryption
```

> **Security:** Never commit `.env.cloud` or `backend/credentials.json` to git. Both are in `.gitignore`.

---

## Environment Variables

| Variable | Where used | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Frontend | Backend URL (auto-set by deploy script) |
| `NEXT_PUBLIC_FIREBASE_*` | Frontend | Firebase client config |
| `BACKEND_VAULT_MASTER_KEY` | Backend Cloud Run | Fernet master key for API key encryption |
| `GEMINI_API_KEY` | Backend Cloud Run | Optional server-side Gemini key |

---

## Key Design Decisions

**BYOK (Bring Your Own Key)** — Users supply their own AI provider API keys. The platform never charges for AI usage and scales to any number of users without shared API cost. Keys are encrypted with Fernet before storage.

**Multi-provider fallback** — If one AI provider rate-limits or fails, the router automatically tries the next key/provider. Candidates and recruiters never see an error unless all their keys are exhausted.

**Browser-native voice** — The practice interview uses the Web Speech API for both STT (speech-to-text) and TTS (text-to-speech). No external voice service required, no additional cost, works offline with local voices.

**Ref-based state in React** — The interview room avoids stale closure bugs by storing mutable turn state in `useRef` and routing all silence-timer callbacks through a `submitRef` that always points to the current function.

---

*Built with Next.js, Flask, Firebase, and Google Cloud Run.*
