# CareerCraft — AI-Powered Recruitment Platform

<div align="center">

**A production-grade, full-stack recruitment platform that automates every stage of the hiring lifecycle using conversational AI, biometric verification, and semantic search — powered entirely by the user's own API keys.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-CareerCraft-6366f1?style=for-the-badge)](https://careercraft-frontend-brkwttcaqq-uc.a.run.app)
[![Backend](https://img.shields.io/badge/Backend-Cloud%20Run-4285F4?style=for-the-badge&logo=google-cloud)](https://careercraft-backend-brkwttcaqq-uc.a.run.app)
[![GitHub](https://img.shields.io/badge/GitHub-CareerCraft-181717?style=for-the-badge&logo=github)](https://github.com/Sree8778/CareerCraft)

</div>

---

## Table of Contents

1. [What is CareerCraft?](#1-what-is-careercraft)
2. [High-Level Architecture](#2-high-level-architecture)
3. [BYOK — Bring Your Own Key System](#3-byok--bring-your-own-key-system)
4. [AI Router — Multi-Provider Fallback Engine](#4-ai-router--multi-provider-fallback-engine)
5. [User Onboarding Flow](#5-user-onboarding-flow)
6. [Candidate Features & Workflows](#6-candidate-features--workflows)
   - [Resume Builder](#61-ai-resume-builder)
   - [Job Search & Application](#62-job-search--application)
   - [AI Voice Practice Interview](#63-ai-voice-practice-interview)
   - [Live Proctored Interview](#64-live-proctored-interview)
   - [Messaging & Network](#65-messaging--ecosystem-network)
7. [Recruiter Features & Workflows](#7-recruiter-features--workflows)
   - [Job Requisitions](#71-job-requisitions--pipeline)
   - [Candidate Management](#72-candidate-management)
   - [AI Copilot Search](#73-ai-copilot-candidate-search)
   - [Interview Scheduling](#74-interview-scheduling)
   - [Webhooks & ATS Integration](#75-webhooks--ats-integration)
8. [Backend API Reference](#8-backend-api-reference)
9. [Database Schema](#9-database-schema)
10. [Tech Stack](#10-tech-stack)
11. [Project Structure](#11-project-structure)
12. [Local Development Setup](#12-local-development-setup)
13. [Production Deployment](#13-production-deployment)
14. [Environment Variables](#14-environment-variables)
15. [Security Architecture](#15-security-architecture)

---

## 1. What is CareerCraft?

CareerCraft is a complete hiring platform that replaces traditional job boards and manual recruiting processes with AI-driven automation at every step. It serves two types of users simultaneously:

| Role | What they get |
|---|---|
| **Candidate** | AI resume builder, semantic job search, cover letter generation, ATS scoring, voice AI practice interviews, live proctored interviews, professional networking |
| **Recruiter** | Job posting management, AI-parsed candidate resumes, semantic copilot search, application kanban pipeline, automated interview scheduling, email notifications, webhook ATS sync |

**What makes CareerCraft different:**

- **Zero shared AI cost** — Every AI feature runs on the user's own API key. CareerCraft never pays for AI usage; it scales to unlimited users without infrastructure AI costs.
- **Multi-provider resilience** — If one AI provider rate-limits, the system silently falls through to the next key or provider with no user-visible error.
- **End-to-end automation** — From resume upload → AI parse → job match → apply → AI interview → offer email, the entire pipeline can run with minimal manual intervention.
- **Voice-first interview experience** — The practice interview is a real-time conversational voice session with a human-sounding AI interviewer that reacts to what the candidate actually said, maintains full conversation context, and asks targeted questions based on the specific job description.

---

## 2. High-Level Architecture

```mermaid
graph TB
    subgraph Client ["Client Layer"]
        Browser["Browser\nNext.js 15 App\n(TypeScript + Tailwind)"]
    end

    subgraph Auth ["Authentication"]
        FireAuth["Firebase Auth\n(Email / Google OAuth)"]
    end

    subgraph FE ["Frontend — Vercel / Cloud Run"]
        NextJS["Next.js App Router\nSSR + Client Components"]
        subgraph Pages ["Pages"]
            LP["Landing Page"]
            CandPages["Candidate Pages\n(dashboard, resume, jobs,\ninterview, messages, network)"]
            RecPages["Recruiter Pages\n(dashboard, requisitions,\ncandidates, applications,\ncopilot, webhooks)"]
        end
    end

    subgraph BE ["Backend — Flask / Cloud Run"]
        Routes["routes.py\n~50 REST endpoints"]
        AIRouter["ai_router.py\nBYOK Multi-Provider Router"]
        AIFns["ollama_utils.py\nAI Feature Functions"]
        Vault["vault_utils.py\nFernet Encryption"]
        FileParser["file_parser.py\nPDF/DOCX Extractor"]
        DocGen["document_generator.py\nPDF/DOCX Export"]
        FaceVerify["face_verification.py\nBiometric ID Check"]
        Email["email_utils.py\nSMTP Notifications"]
        Calendar["google_calendar_utils.py\nCalendar Scheduling"]
    end

    subgraph AI ["AI Providers — User's Own Keys"]
        Gemini["Google Gemini 2.5 Flash"]
        OpenAI["OpenAI GPT-4o"]
        NVIDIA["NVIDIA NIM\nLlama 3.1 / 3.3"]
        Groq["Groq\nLlama 3.1"]
        Claude["Anthropic Claude\nSonnet / Haiku"]
    end

    subgraph DB ["Data Layer"]
        Firestore["Firestore\n(users, jobs, applications,\nchats, connections, notifications)"]
        Storage["Firebase Storage\n(resume files)"]
    end

    Browser --> FireAuth
    Browser --> NextJS
    NextJS --> Routes
    Routes --> AIRouter
    AIRouter --> Gemini
    AIRouter --> OpenAI
    AIRouter --> NVIDIA
    AIRouter --> Groq
    AIRouter --> Claude
    Routes --> Firestore
    Routes --> Storage
    Routes --> Vault
    Routes --> Email
    Routes --> Calendar
    Routes --> FaceVerify
    AIFns --> AIRouter
```

---

## 3. BYOK — Bring Your Own Key System

Every user stores their own AI provider API keys, encrypted in their profile. No shared server key is used for user-facing AI features.

### How it works end-to-end

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant FE as Frontend
    participant BE as Backend
    participant V as Vault (Fernet)
    participant FS as Firestore
    participant AI as AI Provider

    U->>FE: Opens Profile → Settings → Add API Key
    FE->>BE: POST /vault/verify-key {provider, key}
    BE->>AI: Live test call to provider API
    AI-->>BE: 200 OK (valid) or 401/403 (invalid)
    BE-->>FE: {valid: true} or {valid: false, reason}

    alt Key is valid
        FE->>BE: POST /vault/wallet/stack {provider, key}
        BE->>V: Fernet.encrypt(key, MASTER_KEY)
        V-->>BE: gAAAAA...encrypted_ciphertext...
        BE->>FS: Store encrypted key in user.apiKeysWallet[]
        FS-->>BE: OK
        BE-->>FE: {success: true}
        FE-->>U: Green badge "Active"
    else Key is invalid
        BE-->>FE: 400 {error: "invalid key"}
        FE-->>U: Red badge "Invalid"
    end

    Note over U,AI: Later — when user triggers an AI feature...

    U->>FE: Clicks "Enhance Section" / starts interview / etc.
    FE->>BE: POST /enhance-section {uid, text}
    BE->>FS: Fetch user.apiKeysWallet[]
    FS-->>BE: [encrypted_key_1, encrypted_key_2, ...]
    BE->>V: Fernet.decrypt(each key)
    V-->>BE: [plaintext_key_1, plaintext_key_2, ...]
    BE->>AI: API call with key_1
    alt Success
        AI-->>BE: AI response
        BE-->>FE: {result: "..."}
    else Rate limited (429) or Invalid (401)
        BE->>AI: Retry with key_2
        AI-->>BE: AI response
        BE-->>FE: {result: "..."}
    end
```

### Supported Providers

| Provider | Verify Method | Light Model | Heavy Model | Notes |
|---|---|---|---|---|
| **Google Gemini** | Live `generateContent` call | `gemini-2.5-flash` | `gemini-2.5-flash` | Free tier available |
| **OpenAI** | Live `chat/completions` call | `gpt-4o-mini` | `gpt-4o` | Best quality |
| **NVIDIA NIM** | Live inference call | `llama-3.1-8b-instruct` | `llama-3.3-70b-instruct` | OpenAI-compatible endpoint |
| **Groq** | Live `chat/completions` call | `llama-3.1-8b-instant` | `llama-3.1-70b-versatile` | Fastest inference |
| **Anthropic Claude** | Live `messages` call | `claude-haiku-4-5` | `claude-sonnet-4-6` | Most nuanced |

### Key status badges

```
● Active     → Key passed live API test, stored encrypted
● Invalid    → Key failed test (expired / wrong key)  → "remove & re-add"
● Exhausted  → Key hit rate limit (429)               → add another key
```

---

## 4. AI Router — Multi-Provider Fallback Engine

`web/backend/ai_router.py` is the core engine that makes all AI features resilient.

```mermaid
flowchart TD
    Start([AI function called\ne.g. enhance_section_with_ai]) --> LoadWallet
    LoadWallet[Load user's encrypted\nkey wallet from Firestore] --> Decrypt
    Decrypt[Decrypt all keys\nwith Fernet master key] --> BuildOrder

    BuildOrder[Order keys by provider priority:\nGemini → OpenAI → NVIDIA → Groq → Claude] --> HasKeys

    HasKeys{Any usable\nkeys?} -- No --> NoKeys[Raise RuntimeError\nNO_API_KEYS:\nAdd your API keys...]
    HasKeys -- Yes --> TryNext

    TryNext[Pick next key\nfrom ordered list] --> CallAPI

    CallAPI[Send prompt to\nAI provider API] --> Response

    Response{HTTP response?} -- 200 OK --> ReturnText[Return response text\nor parsed JSON]

    Response -- 401 / 403 --> MarkInvalid[Mark key as Invalid\nlog to Firestore wallet]
    Response -- 429 --> MarkExhausted[Mark key as Exhausted\nlog to Firestore wallet]
    Response -- 5xx / timeout --> LogError[Log error]

    MarkInvalid --> MoreKeys{More keys\nto try?}
    MarkExhausted --> MoreKeys
    LogError --> MoreKeys

    MoreKeys -- Yes --> TryNext
    MoreKeys -- No --> AllFailed[Raise RuntimeError\nNO_API_KEYS:\nAll your keys are exhausted...]

    NoKeys --> Route402
    AllFailed --> Route402
    Route402[Backend returns\nHTTP 402 with message] --> Toast[Frontend shows\nwarning toast with\nlink to Profile Settings]
```

### JSON mode vs text mode

The router handles two response types:

- **Text mode** (`json_mode=False`) — used for interview responses, cover letters, elevator pitches. Returns raw string.
- **JSON mode** (`json_mode=True`) — used for resume parsing, ATS grading, evaluation scores. Includes `_repair_json()` that handles truncated JSON, unclosed braces, and markdown code fences from different models.

### Provider-specific handling

```python
# NVIDIA NIM doesn't support response_format or top_p on all models
is_nvidia = "nvidia" in endpoint
if not is_nvidia:
    payload["top_p"] = 1
if json_mode and not is_nvidia:
    payload["response_format"] = {"type": "json_object"}
```

---

## 5. User Onboarding Flow

```mermaid
flowchart TD
    Visit([Visit careercraft app]) --> Auth{Authenticated?}
    Auth -- No --> Landing[Landing Page\nHero, features, testimonials\nemployer logos]
    Auth -- Yes --> Role{User role?}

    Landing --> SignUp[Sign Up / Sign In\nFirebase Auth]
    SignUp --> NewUser{New user?}
    NewUser -- Yes --> Onboard[Onboarding Wizard]
    NewUser -- No --> Role

    Onboard --> ChooseRole[Step 1: Choose Role\nCandidate or Recruiter]
    ChooseRole --> FillCred[Step 2: Credentials\nFull name, phone, location, bio]
    FillCred --> AddKeys[Step 3: API Key Wallet\nAdd at least one AI provider key]
    AddKeys --> Verify[Backend verifies key\nlive API test call]
    Verify --> SaveProfile[Save profile to Firestore\nredirect to dashboard]

    Role -- candidate --> CandDash[Candidate Dashboard]
    Role -- recruiter --> RecDash[Recruiter Dashboard]
    SaveProfile --> Role
```

---

## 6. Candidate Features & Workflows

### Candidate Dashboard Overview

```mermaid
graph LR
    Dashboard[Candidate Dashboard] --> RB[Resume Builder]
    Dashboard --> BJ[Browse Jobs]
    Dashboard --> PI[Practice Interview]
    Dashboard --> MSG[Messages]
    Dashboard --> NET[Network]
    Dashboard --> PROF[Profile & API Keys]

    RB --> RBF[Parse · Edit · Enhance · Export]
    BJ --> BJF[Search · Grade · Apply · Track]
    PI --> PIF[Setup · Voice Session · Score Report]
    MSG --> MSGF[Chat with recruiters]
    NET --> NETF[Connect with professionals]
    PROF --> PROFF[Edit profile · Manage API keys]
```

---

### 6.1 AI Resume Builder

The resume builder is a full structured resume editor backed by AI parsing, AI enhancement, and professional document export.

```mermaid
flowchart TD
    A([Open Resume Builder]) --> B{Resume exists\nin Firestore?}
    B -- Yes --> C[Load saved resume\ninto editor]
    B -- No --> D[Show empty editor\nwith upload option]

    D --> E[Upload PDF or DOCX\nor paste plain text]
    E --> F[POST /parse-resume\nFile sent to backend]
    F --> G[file_parser.py extracts\nraw text from PDF/DOCX]
    G --> H[structure_text_with_ai\nAI maps text to JSON schema]
    H --> I{JSON valid?}
    I -- No --> J[_repair_json\nfix truncated / malformed JSON]
    J --> I
    I -- Yes --> K[Structured resume\nloaded into editor]

    C --> K

    K --> L[Candidate reviews\nand edits sections]

    L --> M[Enhance Section\nPOST /enhance-section]
    M --> N[AI generates\n3 rewritten variants]
    N --> O[Candidate picks\nbest variant]

    L --> P[Generate Summary\nPOST /generate-summary-suggestions]
    P --> Q[3 professional summaries\nto choose from]

    L --> R[Generate Elevator Pitch\nPOST /generate-elevator-pitch]
    R --> S[30-second spoken pitch\nbased on full resume]

    L --> T[Export Resume]
    T --> T1[PDF — branded template\nPOST /generate-pdf]
    T --> T2[DOCX — editable Word file\nPOST /generate-docx]

    K --> U[Auto-save to Firestore\non every change]
```

**Resume sections supported:**
- Personal Info (name, email, phone, location, legal status)
- Professional Summary
- Work Experience (with AI-enhanced bullet points in HTML)
- Education (degree, institution, GPA, achievements)
- Skills (grouped by category)
- Projects
- Publications
- Certifications

---

### 6.2 Job Search & Application

```mermaid
flowchart TD
    A([Browse Jobs page]) --> B[Loads all active jobs\nGET /jobs]
    B --> C[Candidate sees\njob listing cards]

    C --> D[Enter search query\ne.g. 'React engineer fintech remote']
    D --> E[POST /jobs/search-semantic\nAI semantic matching]
    E --> F[semantic_job_search\nembeds query + matches against JDs]
    F --> G[Ranked results\nby semantic similarity]

    C --> H[Click job card]
    H --> I[Job detail page\nGET /jobs/job_id]

    I --> J[POST /grade-resume\nAI scores resume vs this JD]
    J --> K[ATS Match Score 0-100\nmissing keywords\noptimisation tips]

    I --> L[Apply to Job\nPOST /jobs/job_id/apply]
    L --> M{Generate\ncover letter?}
    M -- Yes --> N[POST /generate-cover-letter\nAI tailors letter to\nresume + job description]
    N --> O[Cover letter shown\nfor review/edit]
    O --> P[Submit application\nstored in Firestore]
    M -- No --> P

    P --> Q[Application status: Applied]
    Q --> R[Recruiter updates status]
    R --> S[Email notification\nsent to candidate]
    S --> T{Status?}
    T -- Shortlisted --> U[Schedule interview\nGoogle Calendar + email]
    T -- Rejected --> V[Rejection email sent]
    T -- Hired --> W[Offer notification sent]
```

**Application pipeline stages:**
```
Applied → In Review → Interviewed → Shortlisted → Hired
                                  ↘ Rejected
```

---

### 6.3 AI Voice Practice Interview

The most sophisticated feature — a real-time voice conversation with an AI interviewer that sounds and behaves like a human.

#### Setup Flow

```mermaid
flowchart TD
    A([Open Practice Interview]) --> B[Setup Screen]
    B --> C[Choose Interview Type\nTechnical / Behavioral / HR / Mixed]
    C --> D[Enter Target Role\ne.g. Senior Backend Engineer]
    D --> E[Paste Job Description\noptional — enables targeted questions]
    E --> F[Choose Experience Level\nJunior / Mid / Senior]
    F --> G[Choose Number of Questions\n3 / 5 / 8]
    G --> H[Choose AI Voice\nDropdown of browser TTS voices\nMicrosoft Jenny / Google US English etc.]
    H --> I[Toggle TTS On/Off]
    I --> J[Click Start Voice Interview]
    J --> K[Wait for browser voices to load]
    K --> L[Enter Interview Room]
```

#### Interview Session Flow

```mermaid
sequenceDiagram
    participant C as Candidate
    participant STT as Web Speech API (STT)
    participant FE as Frontend
    participant BE as Backend / AI Router
    participant TTS as Web SpeechSynthesis (TTS)

    FE->>BE: POST /practice-interview/ai-turn\n{conversation:[], turn:1, role, type, difficulty, jobDescription}
    BE->>BE: ai_interviewer_turn()\nOpening prompt — warm greeting + first question
    BE-->>FE: {text: "Hey I'm Alex, your interviewer today.\nCould you start by telling me about yourself?"}
    FE->>TTS: speak(text, onEnd=startListening)
    TTS-->>C: Alex speaks in chosen voice

    loop Each question turn (1 to N)
        TTS->>FE: onEnd fires — TTS complete
        FE->>STT: startListening()
        STT-->>C: 👂 "Your turn — speak now"
        C->>STT: Candidate speaks answer

        loop While speaking
            STT-->>FE: onresult — live transcript shown
            Note over FE: Reset 2.5s silence timer on every word
        end

        Note over FE: 2.5s of silence detected
        FE->>FE: submitRef.current() — submit via ref\n(avoids stale closure)
        FE->>STT: Stop listening
        FE->>BE: POST /practice-interview/ai-turn\n{conversation:[...history...], turnNumber:N+1, jobDescription}
        BE->>BE: ai_interviewer_turn()\nReact to specific thing candidate said\nTransition naturally\nAsk ONE new question from JD context
        BE-->>FE: {text: "Oh right, so you dealt with X...\nOn that note, let me ask you about..."}
        FE->>TTS: speak(text, onEnd=startListening)
        TTS-->>C: Alex speaks response + next question
    end

    Note over FE,BE: All turns complete
    FE->>BE: POST /practice-interview/final-feedback\n{conversation: full history, role, interviewType}
    BE->>BE: ai_interview_final_feedback()\nEvaluate all answers holistically
    BE-->>FE: {overallScore, rating, strengths[], improvements[], questionScores[], summary}
    FE-->>C: Results screen with full breakdown
```

#### Technical challenges solved

| Problem | Root Cause | Solution |
|---|---|---|
| AI losing context after turn 1 | Stale closure — `startListening` captured `submitUserAnswer` at creation, always saw `currentTurn = 0` | Replace `currentTurn` state with `turnRef` (useRef); route all silence-timer callbacks through `submitRef.current` |
| No audio after first TTS | Chrome SpeechSynthesis pauses silently after ~14s | `setInterval` keepalive calls `speechSynthesis.resume()` every 5s; 120ms delay after `cancel()` before new utterance |
| AI asking two questions | Model follows numbered-list prompt structure as parallel tasks | Restructured prompt to "3 sentences" format; added "exactly ONE question mark" strict rule; backend safety net truncates after 2nd `?` |
| Response truncated mid-sentence | `Alex:` / `Candidate:` speaker labels triggered model's conversational stop tokens | Changed history format to `[INTERVIEWER]` / `[CANDIDATE]` tags; increased `max_tokens` to 600 |

#### Results Screen

```mermaid
graph LR
    Results[Results Screen] --> Score[Overall Score\n8.2 / 10 — Excellent]
    Results --> Bar[Visual score bar\n10 segments]
    Results --> Summary[AI coaching summary\n2-3 sentences]
    Results --> PerQ[Per-question breakdown\nscore + question text]
    Results --> Strengths[Top 3 strengths\ngreen panel]
    Results --> Improve[Top 3 improvements\norange panel]
    Results --> Transcript[Full transcript\ncollapsible]
    Results --> Actions[Practice Again\nor Go to Dashboard]
```

---

### 6.4 Live Proctored Interview

A recruiter-scheduled, biometric-verified, AI-evaluated voice interview with anti-cheat monitoring.

```mermaid
flowchart TD
    Schedule[Recruiter schedules\nvia dashboard] --> CalEvent[Google Calendar event\ncreated for both parties]
    CalEvent --> Emails[Invite emails sent\nwith join link]

    Emails --> CandJoins[Candidate opens\ninterview page]
    CandJoins --> FaceCapture[Camera captures\nlive selfie]
    FaceCapture --> IDUpload[Candidate uploads\nGovernment ID photo]
    IDUpload --> Verify[face_verification.py\nCompare faces\nbiometric match check]

    Verify --> Pass{Match\nscore > threshold?}
    Pass -- No --> Denied[Access Denied\nIdentity mismatch logged]
    Pass -- Yes --> Begin[Interview session begins]

    Begin --> AIQ[AI generates\nrole-specific question]
    AIQ --> Speak[AI speaks question\nvia TTS]
    Speak --> CandAnswer[Candidate speaks answer\nSTT transcription]

    CandAnswer --> AntiCheat{Anti-cheat\nanalysis}
    AntiCheat --> AC1[Eye gaze\nmonitoring]
    AntiCheat --> AC2[Tab switch\ndetection]
    AntiCheat --> AC3[AI-generated answer\ndetection heuristics]
    AntiCheat --> AC4[Unusual pause\npattern analysis]

    CandAnswer --> Evaluate[POST /interviews/evaluate-response\nAI scores answer 1-10\nflags integrity issues]

    Evaluate --> NextQ{More\nquestions?}
    NextQ -- Yes --> AIQ
    NextQ -- No --> Report[Full evaluation report\nsent to recruiter\ncandidate notified]
```

---

### 6.5 Messaging & Ecosystem Network

```mermaid
flowchart LR
    subgraph Network ["Ecosystem Network"]
        Dir[User Directory\nAll registered users\ncandidate + recruiter]
        Search[Search by name\nor filter by role]
        Connect[Send Connection\nRequest]
        Pending[Pending Invites\nAccept / Decline]
        Connected[My Connections\nlist]
    end

    subgraph Messaging ["Direct Messaging"]
        Chat[Chat Window\nreal-time messages]
        History[Message history\nfrom Firestore]
        Notify[Notification badge\nfor unread messages]
    end

    Dir --> Search
    Search --> Connect
    Connect --> Pending
    Pending -- Accepted --> Connected
    Connected --> Chat
    Chat --> History
    Chat --> Notify
```

**Connection flow:**
1. Candidate finds recruiter (or another candidate) in the directory
2. Sends a connection request → stored in Firestore as `{status: "pending"}`
3. Recipient sees badge on "Pending Invites" tab
4. Accepts → status becomes `"accepted"` → "Chat" button unlocked
5. Either party can now send direct messages
6. Messages stored in `chats/{chatId}/messages` in Firestore

---

## 7. Recruiter Features & Workflows

### Recruiter Dashboard Overview

```mermaid
graph LR
    RecDash[Recruiter Dashboard] --> KPI[KPI Cards\nOpen Jobs · Active Candidates\nInterviews This Week]
    RecDash --> Req[Requisitions\nJob postings]
    RecDash --> Apps[Applications\nKanban pipeline]
    RecDash --> Cands[Candidates\nDirectory + AI search]
    RecDash --> Src[Sourcing\nSemantic search]
    RecDash --> Msgs[Messages\nCandidate chats]
    RecDash --> Net[Network\nConnections]
    RecDash --> WH[Webhooks\nATS integrations]
```

---

### 7.1 Job Requisitions & Pipeline

```mermaid
flowchart TD
    A([Recruiter opens Requisitions]) --> B[View all posted jobs\nGET /jobs?recruiterId=uid]
    B --> C[Filter by status:\nAll / Open / In Review / Closed / Archived]

    C --> D[Post New Requisition]
    D --> E[Fill: title, description,\nlocation, type, department,\nrequirements, salary range]
    E --> F[POST /jobs/v1/post\nSaved to Firestore]
    F --> G[Job visible to candidates\nin browse feed]

    B --> H[Click job → View Applications]
    H --> I[GET /jobs/job_id/applications\nAll candidates who applied]

    I --> J[Kanban Board View\ncolumns by status]
    I --> K[List View\nwith search + filter]

    J --> L[Drag or update candidate status]
    L --> M[PATCH /applications/app_id/status]
    M --> N[Status updated in Firestore]
    N --> O[email_utils.py sends\nstatus change email to candidate]
```

**Status flow:**
```
Applied ──► In Review ──► Interviewed ──► Shortlisted ──► Hired
                                       ↘
                                        Rejected (email sent at any stage)
```

---

### 7.2 Candidate Management

```mermaid
flowchart TD
    A([Recruiter opens Candidates]) --> B[GET /candidates\nAll registered candidates]
    B --> C[Search by name / email\nFilter by status]
    C --> D[Click candidate profile]

    D --> E[View full profile]
    E --> F[AI-parsed resume\nGET /candidates/uid/resume]
    F --> G[All sections displayed:\nExperience · Education\nSkills · Projects · Certs]

    E --> H[Application history\nAll jobs applied to]
    E --> I[Recruiter notes\neditable text field]
    I --> J[PATCH /users/uid/profile\nNotes saved]

    E --> K[Update application status\nfor any of their applications]
    K --> L[Auto email sent to candidate]

    D --> M[Schedule Interview button]
    M --> N[See Interview Scheduling flow]
```

---

### 7.3 AI Copilot Candidate Search

Natural language candidate sourcing — describe the person you're looking for in plain English.

```mermaid
sequenceDiagram
    participant R as Recruiter
    participant FE as Frontend
    participant BE as Backend
    participant AI as AI Router

    R->>FE: Types: "React developer with 3+ years fintech experience,\nknows TypeScript and AWS, open to remote"
    FE->>BE: POST /candidates/search-copilot {query, recruiterId}
    BE->>AI: copilot_candidate_search(query, all_candidates)
    Note over AI: AI reads every candidate's resume summary\nand ranks by semantic match to query
    AI-->>BE: Ranked list with match explanations
    BE-->>FE: [{candidate, matchScore, reasoning}, ...]
    FE-->>R: Ranked cards with "Why this match:" explanation
    R->>FE: Clicks candidate → full profile
```

**How it works internally:**
1. All candidate profiles are loaded from Firestore (name, summary, skills, experience)
2. The query and candidate summaries are sent to the AI in a single prompt
3. AI returns a ranked list with a one-sentence match explanation for each candidate
4. Results shown as profile cards with match reasoning visible

---

### 7.4 Interview Scheduling

```mermaid
flowchart TD
    A([Recruiter clicks Schedule Interview]) --> B[Select candidate\nfrom application]
    B --> C[Choose date and time\nfrom calendar picker]
    C --> D[POST /interviews/schedule]

    D --> E[google_calendar_utils.py]
    E --> F[Create Google Calendar event\nwith video link]
    F --> G[Add both parties as attendees]
    G --> H[Send calendar invite emails]

    H --> I[Candidate receives\nCalendar invite + email]
    H --> J[Recruiter receives\ncalendar confirmation]

    I --> K[Candidate joins\nat scheduled time]
    K --> L[Live Proctored Interview\nsee section 6.4]
```

---

### 7.5 Webhooks & ATS Integration

Recruiters can register external endpoints to receive real-time events when application statuses change — enabling sync with external ATS systems (Greenhouse, Lever, Workday, etc.).

```mermaid
flowchart TD
    A([Recruiter registers webhook URL]) --> B[POST /webhooks/subscribe\n{url, description}]
    B --> C[URL stored in Firestore\nwebhook subscriptions]

    D([Application status changes]) --> E[POST /applications/app_id/status]
    E --> F[Update Firestore]
    F --> G[Trigger webhook event]
    G --> H[POST to registered URL\n{event: status_change, application, candidate, job}]

    I([Recruiter tests webhook]) --> J[POST /webhooks/test-ping\n{url}]
    J --> K[Backend pings the URL\nwith sample payload]
    K --> L{Response?}
    L -- 200 → M[Show ✓ Success badge]
    L -- Error → N[Show ✗ Failed badge]
```

---

## 8. Backend API Reference

All endpoints are prefixed with `/api`. Authentication uses `Bearer mock_token_for_{uid}` header.

### Resume Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/parse-resume` | Upload PDF/DOCX → AI-parsed JSON resume |
| `POST` | `/enhance-section` | Rewrite a resume section in 3 AI variants |
| `POST` | `/generate-summary-suggestions` | Generate 3 professional summary options |
| `POST` | `/generate-elevator-pitch` | Create 30-second spoken pitch from resume |
| `POST` | `/generate-pdf` | Export resume as styled PDF |
| `POST` | `/generate-docx` | Export resume as DOCX Word file |

### Job Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/jobs` | List all jobs (filter: `?recruiterId=`, `?status=`) |
| `GET` | `/jobs/<job_id>` | Get single job details |
| `POST` | `/jobs/v1/post` | Create new job posting |
| `PATCH` | `/jobs/<job_id>` | Update job (title, description, status) |
| `POST` | `/jobs/search-semantic` | Semantic job search by natural language query |
| `POST` | `/jobs/<job_id>/apply` | Submit application for a job |
| `GET` | `/jobs/<job_id>/applications` | Get all applications for a specific job |

### Application Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/applications` | List applications (filter: `?recruiterId=` or `?candidateId=`) |
| `GET` | `/applications/<app_id>` | Get single application detail |
| `PATCH` | `/applications/<app_id>/status` | Update status → triggers email notification |
| `POST` | `/grade-resume` | AI ATS score: resume vs job description |
| `POST` | `/generate-cover-letter` | Generate tailored cover letter |

### Interview Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/interviews/verify-identity` | Biometric face comparison (selfie vs ID) |
| `POST` | `/interviews/get-next-question` | Generate next interview question with context |
| `POST` | `/interviews/evaluate-response` | Score answer + integrity check |
| `POST` | `/interviews/schedule` | Book Google Calendar event + send emails |
| `POST` | `/practice-interview/ai-turn` | AI interviewer conversational turn (voice mode) |
| `POST` | `/practice-interview/final-feedback` | End-of-session holistic evaluation |
| `POST` | `/practice-interview/question` | Generate single practice question (typed mode) |
| `POST` | `/practice-interview/evaluate` | Score single practice answer (typed mode) |

### Candidate & Recruiter Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/candidates` | List all candidates (recruiter only) |
| `GET` | `/candidates/<uid>/resume` | Fetch candidate's structured resume |
| `POST` | `/candidates/search-copilot` | AI semantic candidate search |
| `GET` | `/stats/candidate/<uid>` | Candidate stats (apps sent, interviews, scores) |
| `GET` | `/stats/recruiter/<uid>` | Recruiter stats (jobs posted, pipeline counts) |

### User & Auth Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/users/register` | Create user profile in Firestore after Firebase signup |
| `GET` | `/users` | Search users directory |
| `PATCH` | `/users/<uid>/profile` | Update profile fields |
| `POST` | `/vault/verify-key` | Live-test an API key against the real provider |
| `POST` | `/vault/wallet/stack` | Encrypt and store a new API key |
| `POST` | `/vault/wallet/remove` | Remove a key from the wallet |

### Messaging & Notifications

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/chats` | Get all chats for current user |
| `POST` | `/chats` | Create or get existing chat between two users |
| `GET` | `/chats/<chat_id>/messages` | Fetch message history |
| `POST` | `/chats/<chat_id>/messages` | Send a message |
| `GET` | `/notifications` | Get notifications for current user |
| `POST` | `/notifications/read-all` | Mark all notifications as read |

### Connections (Network)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/connections` | Get all connections for current user |
| `POST` | `/connections/request` | Send a connection request |
| `POST` | `/connections/<id>/respond` | Accept or decline a request |

### Company Explorer

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/companies` | List companies (AI-generates missing profiles on demand) |
| `GET` | `/companies/<id>` | Company detail with AI-generated reviews |

### Webhooks

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/webhooks/subscriptions` | List registered webhook URLs |
| `POST` | `/webhooks/subscribe` | Register a new webhook endpoint |
| `POST` | `/webhooks/test-ping` | Send a test payload to a webhook URL |

---

## 9. Database Schema

All data is stored in **Cloud Firestore** (NoSQL document database).

```mermaid
erDiagram
    USERS {
        string uid PK
        string fullName
        string email
        string role
        string phone
        string location
        string bio
        array apiKeysWallet
        string orgName
        string industry
        timestamp createdAt
    }

    JOBS {
        string id PK
        string recruiterId FK
        string title
        string description
        string location
        string jobType
        string department
        string status
        string salaryRange
        timestamp postedDate
    }

    APPLICATIONS {
        string id PK
        string jobId FK
        string candidateId FK
        string recruiterId FK
        string status
        string coverLetter
        string recruiterNotes
        number atsScore
        timestamp appliedDate
    }

    RESUMES {
        string uid PK
        object personal
        string summary
        array experience
        array education
        array skills
        array projects
        array publications
        array certifications
    }

    CHATS {
        string id PK
        string candidateId FK
        string recruiterId FK
        timestamp createdAt
    }

    MESSAGES {
        string id PK
        string chatId FK
        string senderId FK
        string text
        timestamp sentAt
    }

    CONNECTIONS {
        string id PK
        string senderId FK
        string receiverId FK
        string status
        string senderName
        string receiverName
        timestamp createdAt
    }

    NOTIFICATIONS {
        string id PK
        string userId FK
        string type
        string message
        boolean read
        timestamp createdAt
    }

    INTERVIEWS {
        string id PK
        string candidateId FK
        string recruiterId FK
        string jobId FK
        string status
        array questions
        array answers
        number overallScore
        timestamp scheduledAt
    }

    USERS ||--o{ JOBS : "recruiter posts"
    USERS ||--o{ APPLICATIONS : "candidate applies"
    JOBS ||--o{ APPLICATIONS : "receives"
    USERS ||--o{ RESUMES : "has one"
    USERS ||--o{ CHATS : "participates in"
    CHATS ||--o{ MESSAGES : "contains"
    USERS ||--o{ CONNECTIONS : "sends/receives"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ INTERVIEWS : "scheduled for"
```

---

## 10. Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 15 | Full-stack React framework, App Router, SSR |
| **TypeScript** | 5 | Type safety across all components |
| **Tailwind CSS** | 3 | Utility-first styling |
| **Framer Motion** | 11 | Animations, transitions, waveform effects |
| **Sonner** | — | Toast notifications |
| **Lucide React** | — | Icon library |
| **Web Speech API** | Browser | Speech-to-text (candidate mic input) |
| **SpeechSynthesis API** | Browser | Text-to-speech (AI voice output) |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| **Flask** | 3.x | Python web framework |
| **Gunicorn** | — | WSGI server for production |
| **cryptography** | — | Fernet symmetric encryption for API keys |
| **requests** | — | HTTP client for AI provider APIs |
| **PyMuPDF / pdfminer** | — | PDF text extraction |
| **python-docx** | — | DOCX generation and parsing |
| **google-auth** | — | Firebase Admin SDK auth |
| **google-cloud-firestore** | — | Firestore database client |

### Infrastructure

| Service | Purpose |
|---|---|
| **Google Cloud Run** | Serverless container hosting (auto-scales to zero) |
| **Google Cloud Build** | CI/CD — builds Docker images on push |
| **Google Artifact Registry** | Docker image storage |
| **Firebase Authentication** | User signup, login, Google OAuth |
| **Cloud Firestore** | Primary database |
| **Firebase Storage** | Resume file uploads |
| **Google Calendar API** | Interview scheduling |
| **SMTP** | Email notifications |

---

## 11. Project Structure

```
CareerCraft/
├── README.md                           ← You are here
├── deploy.ps1                          ← One-command Cloud Run deploy script
│
├── web/                                ← Main web application
│   ├── cloudbuild.yaml                 ← Cloud Build config for frontend
│   │
│   ├── src/
│   │   ├── app/                        ← Next.js App Router pages
│   │   │   ├── page.tsx                ← Landing page (hero, features, testimonials)
│   │   │   ├── layout.tsx              ← Root layout (fonts, providers)
│   │   │   ├── globals.css             ← Global styles + Tailwind directives
│   │   │   │
│   │   │   ├── onboarding/
│   │   │   │   └── page.tsx            ← Role selection + profile setup wizard
│   │   │   │
│   │   │   ├── signup/
│   │   │   │   └── page.tsx            ← Sign up / sign in page
│   │   │   │
│   │   │   ├── candidate/
│   │   │   │   ├── dashboard/          ← Candidate home: pipeline, quick actions
│   │   │   │   ├── resume-builder/     ← AI resume editor with sections
│   │   │   │   ├── jobs/
│   │   │   │   │   ├── page.tsx        ← Job browse + semantic search
│   │   │   │   │   └── [id]/page.tsx   ← Job detail: ATS grade + apply
│   │   │   │   ├── interview/
│   │   │   │   │   ├── page.tsx        ← Live proctored interview room
│   │   │   │   │   └── practice/
│   │   │   │   │       └── page.tsx    ← AI voice practice interview
│   │   │   │   ├── messages/           ← Direct messaging with recruiters
│   │   │   │   ├── network/            ← User directory + connections
│   │   │   │   └── profile/            ← Settings + API key vault UI
│   │   │   │
│   │   │   ├── recruiter/
│   │   │   │   ├── dashboard/          ← Recruiter home: KPIs + quick links
│   │   │   │   ├── requisitions/
│   │   │   │   │   ├── page.tsx        ← Job postings list
│   │   │   │   │   ├── new/page.tsx    ← Create new job posting
│   │   │   │   │   ├── [id]/page.tsx   ← Edit job details
│   │   │   │   │   └── [id]/applications/page.tsx ← Kanban applicant board
│   │   │   │   ├── candidates/
│   │   │   │   │   ├── page.tsx        ← Candidate directory
│   │   │   │   │   └── [id]/page.tsx   ← Full candidate profile + notes
│   │   │   │   ├── applications/
│   │   │   │   │   ├── page.tsx        ← All applications across jobs
│   │   │   │   │   └── [id]/page.tsx   ← Single application detail
│   │   │   │   ├── sourcing/           ← AI Copilot semantic candidate search
│   │   │   │   ├── messages/           ← Direct messaging with candidates
│   │   │   │   ├── network/            ← Professional network connections
│   │   │   │   ├── profile/            ← Org settings + API key vault
│   │   │   │   └── webhooks/           ← ATS webhook management
│   │   │   │
│   │   │   └── companies/
│   │   │       ├── page.tsx            ← Company explorer with search
│   │   │       └── [id]/page.tsx       ← Company detail, reviews, salary data
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── CandidateSidebar.tsx ← Candidate nav (all pages)
│   │   │   │   ├── CandidateLayout.tsx
│   │   │   │   ├── RecruiterLayout.tsx
│   │   │   │   └── Topbar.tsx
│   │   │   ├── recruiter/
│   │   │   │   ├── RequisitionCard.tsx
│   │   │   │   └── CandidateCard.tsx
│   │   │   ├── LoginModal.tsx
│   │   │   ├── Navbar.tsx
│   │   │   └── Hero.tsx
│   │   │
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx          ← Firebase auth state + user profile
│   │   │   └── LoginModalContext.tsx
│   │   │
│   │   └── lib/
│   │       ├── firebase.ts             ← Firebase client initialisation
│   │       └── api.ts                  ← API_BASE URL (env-aware)
│   │
│   └── backend/
│       ├── Dockerfile                  ← Container image definition
│       ├── app.py                      ← Flask app factory + blueprint registration
│       ├── routes.py                   ← All ~50 API endpoint handlers
│       ├── ai_router.py                ← BYOK multi-provider AI router
│       ├── ollama_utils.py             ← All AI feature functions
│       ├── firebase_utils.py           ← Firestore CRUD helpers
│       ├── vault_utils.py              ← Fernet encrypt/decrypt for API keys
│       ├── file_parser.py              ← PDF / DOCX text extraction
│       ├── document_generator.py       ← PDF / DOCX resume export
│       ├── face_verification.py        ← Biometric face comparison
│       ├── email_utils.py              ← Email notification sender
│       ├── google_calendar_utils.py    ← Calendar event creation
│       └── requirements.txt
│
├── mobile/                             ← Flutter mobile app
└── android application/                ← Android native app
```

---

## 12. Local Development Setup

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 18+ | `node --version` |
| Python | 3.11+ | `python --version` |
| Firebase project | — | Firestore + Auth + Storage enabled |
| API key | Any provider | Gemini free tier works |
| Chrome or Edge | Latest | Required for Web Speech API |

### Step 1 — Clone and install frontend

```bash
git clone https://github.com/Sree8778/CareerCraft.git
cd "CareerCraft/web"
npm install
```

### Step 2 — Configure frontend environment

Create `web/.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXX
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5000/api
```

### Step 3 — Configure backend

```bash
cd web/backend

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate
# Activate (Mac/Linux)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Place your Firebase service account JSON at `web/backend/credentials.json` (download from Firebase Console → Project Settings → Service Accounts).

### Step 4 — Run both services

**Terminal 1 — Backend:**
```bash
cd web/backend
.venv\Scripts\activate
python app.py
# Running on http://127.0.0.1:5000
```

**Terminal 2 — Frontend:**
```bash
cd web
npm run dev
# Running on http://localhost:3000
```

### Step 5 — Add an API key

1. Sign up at `http://localhost:3000`
2. Complete onboarding (choose Candidate or Recruiter)
3. Go to Profile → Settings → API Key Vault
4. Add a Gemini API key (free at [aistudio.google.com](https://aistudio.google.com))
5. All AI features unlock immediately

---

## 13. Production Deployment

CareerCraft deploys to **Google Cloud Run** — two separate services (frontend container and backend container) both auto-scaling to zero when idle.

### Prerequisites

```bash
# Install Google Cloud CLI
# https://cloud.google.com/sdk/docs/install

gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### Deploy (one command)

```bash
# Full deploy — backend + frontend (~15 minutes)
.\deploy.ps1

# Frontend only — when only frontend files changed (~7 minutes)
.\deploy.ps1 -FrontendOnly
```

### Deployment pipeline

```mermaid
flowchart TD
    A[Run deploy.ps1] --> B[Load .env.cloud\nread all config values]
    B --> C[Configure gcloud\nset account + project]
    C --> D[Enable Cloud APIs\nCloud Run, Artifact Registry\nCloud Build]
    D --> E[Create Artifact Registry\nskip if exists]
    E --> F[Grant Cloud Build SA\nArtifact Registry write access]

    F --> G{FrontendOnly\nflag?}
    G -- No --> H[gcloud builds submit\nweb/backend/\nbuilds Docker image]
    H --> I[gcloud run deploy\ncareercraft-backend\n512Mi RAM · 1 CPU · 3 max instances]
    I --> J[Fetch backend URL\nfrom Cloud Run]

    G -- Yes --> J

    J --> K[gcloud builds submit\nweb/ with cloudbuild.yaml\nNext.js build with env vars baked in]
    K --> L[gcloud run deploy\ncareercraft-frontend\n512Mi RAM · 1 CPU · 3 max instances]
    L --> M[Print live URLs\nFrontend + Backend]
    M --> N[Add frontend URL to\nFirebase Authorized Domains]
```

### What gets deployed

| Service | Image | Memory | CPU | Max instances |
|---|---|---|---|---|
| `careercraft-frontend` | Next.js SSR container | 512 Mi | 1 | 3 |
| `careercraft-backend` | Flask + Gunicorn container | 512 Mi | 1 | 3 |

---

## 14. Environment Variables

### Frontend (`.env.local` for dev / Cloud Build substitutions for prod)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Backend URL — `http://127.0.0.1:5000/api` locally, Cloud Run URL in prod |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firestore project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Firebase Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | FCM sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Firebase app ID |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | No | Google Analytics ID |

### Backend (Cloud Run environment variables)

| Variable | Required | Description |
|---|---|---|
| `BACKEND_VAULT_MASTER_KEY` | Yes | Fernet master key for encrypting user API keys. Generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `GEMINI_API_KEY` | No | Optional server-side Gemini key (not used for BYOK features) |

---

## 15. Security Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Security"]
        FireAuth[Firebase Auth\nJWT tokens]
        HTTPS[HTTPS only\nTLS 1.3]
    end

    subgraph Transport ["Transport Security"]
        CloudRun[Cloud Run\nManaged TLS termination]
    end

    subgraph AppSec ["Application Security"]
        AuthHeader[Authorization header\nBearer mock_token_for_uid]
        UID[UID extracted from token\nall queries scoped to user]
    end

    subgraph DataSec ["Data Security"]
        Fernet[API keys encrypted\nFernet symmetric encryption]
        MasterKey[Master key stored only\nin Cloud Run env vars\nnever in code or git]
        Firestore[Firestore security rules\nuser can only read own data]
        GitIgnore[.env.cloud gitignored\ncredentials.json gitignored]
    end

    Client --> Transport
    Transport --> AppSec
    AppSec --> DataSec
```

**Key security decisions:**

1. **API keys never stored in plaintext** — All user API keys are Fernet-encrypted before writing to Firestore. The master key exists only as a Cloud Run environment variable.

2. **BYOK means zero shared secrets** — No single API key serves all users. A breach of one user's key does not affect others.

3. **Firestore security rules** — Each collection is scoped so users can only read and write their own documents.

4. **Git hygiene** — `.env.cloud`, `credentials.json`, and `.env.local` are all in `.gitignore`. No secrets have ever been committed.

5. **Short-lived Cloud Run containers** — Containers scale to zero when idle. No persistent server processes that could be compromised while idle.

---

## Contributing

```bash
# 1. Fork the repository
# 2. Create a feature branch
git checkout -b feat/my-new-feature

# 3. Make changes, test locally
npm run dev  # frontend
python app.py  # backend

# 4. Commit
git commit -m "feat: add my new feature"

# 5. Push and open a PR
git push origin feat/my-new-feature
```

---

*Built with Next.js 15, Flask, Firebase, and Google Cloud Run.*
*AI powered by Gemini, OpenAI, NVIDIA NIM, Groq, and Claude — using your own keys.*
