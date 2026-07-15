# CareerCraft — Complete Project Documentation

> **Who is this for?**
> This guide is written so that anyone — including someone with no coding background — can understand what CareerCraft is, how it works, and how to use every single feature. If you can read a recipe, you can follow this guide.

---

## Table of Contents

1. [What is CareerCraft?](#1-what-is-careercraft)
2. [The Big Picture — How Everything Fits Together](#2-the-big-picture)
3. [Who Uses It? The Three Roles](#3-who-uses-it)
4. [Features for Job Seekers (Candidates)](#4-features-for-job-seekers)
5. [Features for Recruiters (Employers)](#5-features-for-recruiters)
6. [Features for Admins](#6-features-for-admins)
7. [The Chrome Browser Extension](#7-the-chrome-browser-extension)
8. [The Mobile App](#8-the-mobile-app)
9. [How the AI Works (and why it's free)](#9-how-the-ai-works)
10. [The Database — Where Everything is Stored](#10-the-database)
11. [Security — Keeping Your Data Safe](#11-security)
12. [Setting Up the Project (for developers)](#12-setting-up-the-project)
13. [Deploying to the Internet](#13-deploying-to-the-internet)
14. [Full API Reference (every backend endpoint)](#14-full-api-reference)
15. [Folder Structure — What Every File Does](#15-folder-structure)
16. [Glossary — Words You Might Not Know](#16-glossary)

---

## 1. What is CareerCraft?

CareerCraft is a **job portal** — a website and mobile app that connects people looking for jobs with companies that want to hire them.

Think of it like a **Swiss Army knife for job hunting**:
- It reads your resume and understands it
- It finds matching jobs from many job websites at once
- It applies to those jobs automatically on your behalf
- It helps you practice for interviews by talking to an AI
- It lets recruiters post jobs and manage applicants

The most important thing that makes CareerCraft special: **all AI features run on your own free AI key** — you never pay a subscription fee. Just grab a free API key from Google (takes 2 minutes) and every AI feature unlocks.

### Real-world analogy

Imagine you hired three separate helpers:
1. A **career coach** who rewrites your resume and teaches you to interview
2. A **job agent** who searches hundreds of job websites and sends your application for you
3. A **recruiter's assistant** who reads every application and tells the boss which candidates are best

CareerCraft is all three of those helpers, in one app, free.

---

## 2. The Big Picture

CareerCraft is actually **three products in one**:

```
┌─────────────────────────────────────────────────────────────────┐
│                       CAREERCRAFT PLATFORM                       │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │   Website (Web)  │  │   Mobile App     │  │   Browser    │  │
│  │   Next.js 15     │  │   Flutter        │  │   Extension  │  │
│  │   (careercraft-  │  │   (Android)      │  │   (Chrome)   │  │
│  │   frontend-...)  │  │                  │  │              │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘  │
│           │                     │                   │           │
│           └─────────────────────┴───────────────────┘           │
│                                 │                               │
│                    ┌────────────▼────────────┐                  │
│                    │   Backend API (Flask)    │                  │
│                    │   Python server          │                  │
│                    │   ~50 endpoints          │                  │
│                    └────────────┬────────────┘                  │
│                                 │                               │
│           ┌─────────────────────┼─────────────────────┐        │
│           │                     │                     │        │
│  ┌────────▼──────┐   ┌──────────▼──────┐   ┌────────▼──────┐ │
│  │   Firestore   │   │   Firebase Auth  │   │  AI Providers │ │
│  │   (Database)  │   │   (Login/Signup) │   │  Gemini,      │ │
│  │               │   │                 │   │  OpenAI, etc. │ │
│  └───────────────┘   └─────────────────┘   └───────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### What each piece does

| Piece | Technology | What It Does |
|-------|-----------|--------------|
| **Website** | Next.js 15 (React) | The main web app you open in a browser |
| **Mobile App** | Flutter (Dart) | The Android phone app |
| **Browser Extension** | JavaScript (Chrome MV3) | Autofills job applications on other websites |
| **Backend API** | Flask (Python) | The "brain" — processes requests, calls AI, talks to database |
| **Database** | Google Firestore | Stores all user data, jobs, messages, applications |
| **Auth** | Firebase Authentication | Handles sign-in/sign-out securely |
| **AI** | Gemini / OpenAI / Claude | Powers all smart features |

### How a request flows

Here's what happens when you click "Enhance this resume bullet point":

```
You click button
      ↓
Browser sends request to Flask backend
      ↓
Backend checks: are you logged in? (verifies your Firebase token)
      ↓
Backend finds your AI key in the database (decrypts it)
      ↓
Backend sends your resume text + instructions to Google Gemini
      ↓
Gemini responds with improved text
      ↓
Backend sends improved text back to your browser
      ↓
Browser shows you the improved text
```

This entire round trip takes about 1–3 seconds.

---

## 3. Who Uses It?

CareerCraft has three types of users. When you sign up, you choose which one you are.

### Candidate (Job Seeker)
Someone looking for a job. You upload your resume, CareerCraft reads it, and you get access to all the job-hunting tools. Example: a college graduate looking for their first engineering job.

### Recruiter (Employer / Hiring Manager)
Someone posting jobs and reviewing applications. You post jobs, review candidates, and manage your hiring pipeline. Example: an HR manager at a tech company.

### Admin (Super Admin)
The platform operator — you. Admins can turn features on/off for all users, suspend accounts, and see platform-wide statistics. Only specific email addresses get admin access.

---

## 4. Features for Job Seekers

### 4.1 Dashboard

The dashboard is the first thing you see after logging in. It's like your job-search command center.

**What you see on the dashboard:**
- **Application count** — total jobs you've applied to
- **Response rate** — what percentage of employers replied
- **Interview rate** — how many interviews you got from your applications
- **Application funnel chart** — a visual showing your applications → responses → interviews → offers
- **Weekly activity** — a sparkline graph showing your job-search effort over time
- **AI Insights** — personalized tips like "Your resume is missing keywords for Software Engineer roles"
- **Pipeline stepper** — shows where each active application is (Applied → Reviewed → Interview → Offer)
- **Profile strength meter** — tells you what percentage of your profile is complete
- **ATS score** — how well your resume would pass automated screening systems (out of 100)
- **Recent applications** — the last few jobs you applied to

### 4.2 Resume Builder

This is the most powerful feature. It turns your existing resume into a beautiful, AI-optimized version.

**Step 1: Upload your resume**
- Upload a PDF or DOCX file
- The AI reads and extracts all the information (name, work history, education, skills)
- All the fields fill in automatically

**Step 2: Edit each section**
The resume is divided into sections you can edit:

| Section | What goes here |
|---------|---------------|
| **Personal Info** | Name, email, phone, location, LinkedIn, GitHub |
| **Professional Summary** | 2–4 sentences about who you are professionally |
| **Work Experience** | Every job you've had: company, title, dates, bullet points |
| **Education** | Degrees, schools, graduation years |
| **Skills** | Technical and soft skills |
| **Certifications** | Licenses and certificates you've earned |

**Step 3: Use AI tools**
Every section has an "Enhance with AI" button. Click it and the AI rewrites that section to be more impressive while staying truthful.

Other AI tools on this page:
- **Generate Summary** — creates 3 versions of your professional summary to pick from
- **Elevator Pitch** — writes a 30-second "tell me about yourself" speech based on your resume
- **Generate Cover Letter** — paste a job description and get a custom cover letter in seconds
- **Tailor to Job Description** — paste a job posting and the AI rewrites your resume to include the right keywords
- **ATS Score** — checks if your resume would pass automated screening (anything above 70 is good)

**Step 4: Export**
- Download as **PDF** (best for applying)
- Download as **DOCX** (best for editing in Word)

**Step 5: Save versions**
You can save multiple versions of your resume (e.g., "Resume for Software Engineer", "Resume for Product Manager") and switch between them when applying.

### 4.3 Job Search

The job search page lets you find jobs using natural language — like talking to a search engine that actually understands you.

**How it works:**
1. Type what you're looking for in plain English
   - Example: *"remote React developer job with good work-life balance"*
   - Example: *"entry level data science role in New York under $80k"*
2. The AI reads all available jobs and ranks them by how well they match your description
3. Each result shows an **AI FIT %** score and an explanation of why it matches

**What the results show:**
- Job title and company
- Location and job type (Full-time, Part-time, Remote, Contract)
- Salary range (if listed)
- An "AI Fit Reasoning" box explaining why this job matches your search
- Apply button

### 4.4 Smart Apply (Automated Job Applications)

This is the most time-saving feature. Instead of applying to one job at a time, Smart Apply searches multiple job boards simultaneously and applies on your behalf.

**Job boards it searches:**
- Indeed
- LinkedIn
- RemoteOK
- Jobicy
- Arbeitnow

**How to use it:**
1. Type a job title and location (e.g., "Software Engineer, San Francisco")
2. The system searches all job boards and shows you matching jobs
3. Click "Add to Queue" on jobs you want to apply to
4. Choose your mode:
   - **Supervised Mode** — you review each application before it's sent
   - **Autonomous Mode** — set a daily cap (e.g., 10 per day) and it applies automatically while you sleep
5. Track progress: see which applications were sent, which are pending, and the results

**Daily Cap:** You can set a maximum number of applications per day to avoid looking spammy.

### 4.5 Interview Preparation

Two ways to practice: AI practice sessions and real scheduled interviews.

#### AI Voice Practice Interview
This is like having a real interviewer to talk to, 24/7, for free.

**How it works:**
1. Choose your settings:
   - **Role**: Software Engineer, Product Manager, Marketing, Sales, etc.
   - **Interview type**: Behavioral, Technical, Case Study, Mixed
   - **Difficulty**: Junior, Mid-level, Senior
2. The AI asks you a question (you can hear it as audio or read it)
3. You respond (by typing or using your microphone)
4. The AI responds like a real interviewer — it asks follow-up questions, presses for more detail, or moves to the next topic
5. After the session ends, you get a report with:
   - Score (0–100)
   - Feedback on each answer
   - What you did well
   - What to improve

**Identity Verification (for proctored interviews):** If a company requires a proctored (monitored) interview, you upload a photo of your ID and take a selfie. The AI checks that they match, so the company knows you're really you.

#### Scheduled Interviews
When a recruiter books an interview with you, it appears in this section. You can:
- See the date, time, and interviewer's name
- Get a calendar invite
- Join the video call link
- View the job description again beforehand

### 4.6 Applications Tracker

A Kanban board (like sticky notes on a wall) showing all your applications organized by status.

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   APPLIED    │  │   REVIEWED   │  │  INTERVIEW   │  │    OFFER     │
│              │  │              │  │              │  │              │
│  Google SWE  │  │  Meta PM     │  │  Apple iOS   │  │  Stripe Eng  │
│  Amazon SDE  │  │  Stripe DS   │  │              │  │              │
│  Netflix Eng │  │              │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

Click any card to see the full job description and your application materials.

### 4.7 Networking

Connect with recruiters and other professionals, just like LinkedIn.

**What you can do:**
- Browse the directory of all users (candidates and recruiters)
- Send connection requests
- Accept or decline connection requests from others
- Message your connections directly

**The three tabs:**
1. **Directory** — everyone on the platform; send them a connection request
2. **Pending** — connection requests waiting for your response (accept/decline)
3. **Connected** — people you're already connected with

### 4.8 Messages

Real-time chat with recruiters. When a recruiter reviews your application and wants to talk, they'll start a chat here. You can message back and forth just like a text conversation.

### 4.9 Social Feed

A social media-style feed where candidates and recruiters share updates, job tips, company reviews, and announcements.

**What you can do:**
- Write posts (text)
- Like posts
- Comment on posts
- Delete your own posts

### 4.10 Profile

Your public profile that recruiters can view.

**What to fill in:**
- Full name and professional title (e.g., "Frontend Engineer")
- Email and phone number
- City and state
- LinkedIn, GitHub, and portfolio website links
- Profile photo
- Elevator pitch (auto-generated from your resume)

### 4.11 Settings

**API Keys (BYOK — Bring Your Own Key)**
This is how the AI features work for free. You add one of these free keys:

| Provider | How to get a free key | Best for |
|----------|-----------------------|---------|
| Google Gemini | aistudio.google.com | Everything (recommended) |
| OpenAI GPT-4o | platform.openai.com | Resume writing |
| Anthropic Claude | console.anthropic.com | Analysis & reasoning |
| Groq (Llama 3) | console.groq.com | Fast responses |
| NVIDIA NIM | build.nvidia.com | High-performance tasks |

You can add multiple keys. If one runs out of credits, CareerCraft automatically switches to the next one.

**Other settings:**
- Dark/Light theme toggle
- Email notification preferences
- Two-factor authentication (extra security for your account)

---

## 5. Features for Recruiters

### 5.1 Dashboard

The recruiter dashboard shows hiring performance at a glance:
- **Open Jobs** — how many active job postings you have
- **Total Applications** — number of applications received across all jobs
- **Interview Rate** — what % of applicants made it to interview stage
- **Recent Applications** — the latest applications that came in

### 5.2 Post a Job (Requisitions)

A 4-step wizard that makes posting a job easy:

**Step 1: Role Details**
- Job title (e.g., "Senior React Developer")
- Department
- Location (city, remote, hybrid)
- Employment type (Full-time, Part-time, Contract, Internship)
- Salary range

**Step 2: AI-Generated Job Description**
Click "Generate with AI" and get a complete, professional job description in seconds. You can edit it or rewrite sections.

**Step 3: Screening Questions**
Add custom questions candidates must answer:
- Multiple choice (e.g., "Are you authorized to work in the US?")
- Open text (e.g., "Describe a challenging technical problem you solved")
- Knockout questions — if a candidate answers wrong, they're automatically rejected
  - Example: "Do you have 3+ years of Python experience? (Required)" — if they say No, they're instantly rejected

**Step 4: Preview & Publish**
Review how the job posting looks, then click Publish. It goes live immediately.

### 5.3 Application Pipeline

A Kanban board showing all applications for all your jobs, organized by status:

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   APPLIED   │  │  REVIEWED   │  │  INTERVIEW  │  │    OFFER    │
│             │  │             │  │             │  │             │
│  John D.    │  │  Sarah M.   │  │  Ahmed K.   │  │  Priya S.   │
│  Mike R.    │  │  Chen L.    │  │             │  │             │
│  (15 more)  │  │  (8 more)   │  │  (3 more)   │  │  (1 more)   │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

**What you can do with each application:**
- View the candidate's full resume
- Read their cover letter and screening question answers
- See the **AI Fit Score** — how well the candidate matches your job description (0–100%)
- See the **ATS Score** — how well their resume is formatted
- Move them to the next stage
- Schedule an interview
- Send a rejection email (with a professional template)
- Make an offer

### 5.4 AI Fit Analysis

Click "Analyze Fit" on any application to get:
- An overall match percentage
- A breakdown: which requirements they meet, which they're missing
- Keyword gaps (important skills from your job description that aren't in their resume)
- A recommendation: "Strong Match", "Possible Match", or "Not a Match"

### 5.5 Candidate Directory

A searchable database of all candidates on the platform.

**How to search:**
- Type a skill (e.g., "Python") or job title (e.g., "Data Scientist")
- Use the **AI Copilot Search**: type in plain English, like *"experienced backend developer who has worked at startups and knows Kubernetes"*

Click any candidate to see their full profile, resume, and skills.

### 5.6 Passive Sourcing

Tools for finding talent who haven't applied yet:
- Search external job boards for candidates (import from LinkedIn, Indeed, etc.)
- Export filtered candidate lists
- Save interesting candidates for later

### 5.7 Interview Scheduling

- Calendar view of all scheduled interviews
- Book an interview with a candidate (sends them an email automatically)
- Track interview status (Scheduled, Completed, Cancelled)
- View interview notes and AI feedback

### 5.8 Messaging

Same as candidates — real-time chat with applicants. Recruiters typically start conversations when they want to discuss an application informally before scheduling a formal interview.

### 5.9 Networking

Same as candidates — connect with other recruiters, share industry knowledge, and build professional relationships.

### 5.10 Webhooks (ATS Integration)

If your company uses an existing Applicant Tracking System (like Greenhouse, Workday, or Lever), you can connect it to CareerCraft using webhooks.

**What webhooks do:** Every time something happens (new application, status change, interview booked), CareerCraft sends the data to your ATS automatically, keeping everything in sync.

**How to set it up:**
1. Go to Settings → Webhooks
2. Enter your ATS webhook URL
3. Click "Test Ping" to verify it's working
4. Save — CareerCraft will now notify your ATS automatically

---

## 6. Features for Admins

Admins access the admin panel at `/admin`. This is only visible to email addresses pre-approved in the backend configuration.

### 6.1 Feature Flags

Turn platform features on or off with a single toggle. Useful for rolling out new features gradually or disabling features during maintenance.

| Feature Flag | What it controls |
|-------------|-----------------|
| `feed` | The social feed page |
| `smartApply` | Automated job applications |
| `aiInterview` | AI voice interview practice |
| `practiceMode` | Interview practice sessions |
| `resumeBuilder` | Resume builder tool |
| `network` | Connections and networking |
| `messages` | Direct messaging |
| `sourcing` | Passive talent sourcing |
| `webhooks` | ATS integrations |
| `companies` | Company directory and reviews |
| `signups` | New user registrations |

If you turn off `signups`, no new users can create accounts (useful during testing or private beta).

### 6.2 User Management

- View all users: name, email, role, join date, suspension status
- **Suspend account**: the user is immediately signed out and can't log in
- **Reinstate account**: restore access

### 6.3 Job Moderation

- View all job postings on the platform
- Remove inappropriate or spammy jobs

### 6.4 Platform Statistics

- Total users (candidates vs recruiters)
- Total jobs posted
- Total applications submitted
- Platform growth over time

---

## 7. The Chrome Browser Extension

The browser extension is a small tool you install in Chrome. It lives in your toolbar and autofills job applications on other websites — so you don't have to type your name, email, and resume information 100 times.

### How to install it

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer Mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Navigate to the `web/browser-extension/` folder in this project and select it
5. The CareerCraft icon appears in your Chrome toolbar

### How to use it

1. Go to any job application page (Indeed, Greenhouse, Lever, Workday, etc.)
2. Click the CareerCraft icon in your toolbar
3. The popup shows:
   - Your profile (name, email — pulled from CareerCraft)
   - Which resume you want to use (if you have multiple saved versions)
   - Whether the page has been detected as a job application form
4. Click **"Autofill Application"**
5. Watch as every field fills in automatically:
   - First name, Last name
   - Email, Phone
   - LinkedIn URL, GitHub URL, Portfolio URL
   - Address, City, State, ZIP
   - Work authorization questions

### How the autofill works (the technical part, simplified)

The extension is smart about how it reads forms. It doesn't just look at field names — it reads the **labels** near each field to understand what that field is asking for. This means it works even on custom company forms.

For example, if a form has a label that says "Legal First Name" followed by a text box, the extension knows to put your first name in that box — even though the field isn't labeled `firstName`.

### Custom screening questions

For open-text questions like "Tell us about a challenge you overcame", the extension sends the question to your AI and fills in a relevant answer from your profile/resume. You should always review these before submitting.

### Resume selection

If you've saved multiple resume versions in the CareerCraft resume builder, you can pick which one to use for this application using the dropdown in the extension popup.

---

## 8. The Mobile App

The mobile app (Android) gives you access to CareerCraft from your phone. It has nearly all the same features as the website.

### How to install

**Option A: Direct APK (current method)**
1. Make sure your phone has "Install from unknown sources" enabled (Settings → Security)
2. Transfer the APK file to your phone (it's in `mobile/build/app/outputs/flutter-apk/`)
3. Open the APK file on your phone and install it

**Option B: Build from source**
1. Install Flutter on your computer
2. Open a terminal in the `mobile/` folder
3. Run: `flutter build apk --release`
4. Install with: `flutter install --device-id [your-device-id]`

### How to log in

- **Email & Password**: same account you use on the website
- **Google Sign-In**: tap "Continue with Google" — it uses the same Google account

All your data (jobs, messages, applications) is shared between the web and mobile app in real-time.

### Mobile pages

| Section | What it does |
|---------|-------------|
| **Home** | Choose role (Candidate or Recruiter) |
| **Dashboard** | Stats, quick actions, notifications |
| **Jobs** | Browse and search jobs, view details, apply |
| **Smart Apply** | Automated applications on mobile |
| **Resume Builder** | Edit resume, use AI tools |
| **Applications** | Track your application status |
| **Interview** | Practice interviews and schedule real ones |
| **Messages** | Chat with recruiters |
| **Network** | Connections directory |
| **Feed** | Social feed |
| **Companies** | Company directory and reviews |
| **Profile** | Edit your profile |
| **More** | Settings, logout, webhooks |

---

## 9. How the AI Works

### The "Bring Your Own Key" system

Here's the most important thing to understand: **CareerCraft doesn't pay for AI on your behalf**. Instead, you add your own free API key from one of these AI providers, and CareerCraft uses it to power all the smart features.

**Why this is better for you:**
- Google Gemini gives you a generous free tier (enough for hundreds of uses per month)
- You're not paying a monthly subscription to CareerCraft
- Your data goes directly to AI providers — CareerCraft doesn't store or sell it

**How to get a free Gemini key (takes 2 minutes):**
1. Go to `aistudio.google.com`
2. Click "Get API key"
3. Click "Create API key"
4. Copy the key
5. In CareerCraft, go to Settings → API Keys → Add Key → paste it → Save

### The key router (multi-provider fallback)

If you add multiple API keys (e.g., both Gemini and OpenAI), CareerCraft's **AI Router** uses them smartly:
- Tries keys in order
- If one key hits its rate limit or errors, it silently switches to the next key
- You never see an error because of an exhausted key

### Key encryption

Your API keys are stored in the database **encrypted** — turned into scrambled text that can only be decoded by the backend server. Even if someone got access to the database, they couldn't read your keys.

The encryption method used is called **Fernet** (a standard symmetric encryption algorithm) with a master key that only exists as an environment variable on the server.

### What each AI feature does

| Feature | What the AI actually does |
|---------|--------------------------|
| **Parse Resume** | Reads your PDF and extracts structured data (name, jobs, education) |
| **Enhance Section** | Rewrites a resume bullet point to be more impact-focused |
| **Generate Summary** | Writes 3 professional summary options from your career history |
| **Elevator Pitch** | Writes a conversational 30-second intro from your resume |
| **Cover Letter** | Matches your skills to a job description and writes a letter |
| **Tailor to JD** | Rewrites your resume using keywords from a specific job posting |
| **ATS Score** | Evaluates formatting, keywords, and length (0-100 score) |
| **Practice Interview** | Generates questions, evaluates your answers, gives feedback |
| **Semantic Job Search** | Understands what kind of job you want from a plain-English description |
| **Fit Analysis** | Compares a candidate's resume to a job description for recruiters |
| **AI Copilot Search** | Finds matching candidates using a plain-English description |
| **Generate Job Description** | Writes a full job posting from just a title and requirements |
| **Solve Custom Questions** | Answers application screening questions using your profile |

---

## 10. The Database

CareerCraft uses **Google Firestore** — a cloud database that stores data as collections of documents (like folders of files). Here's what's stored:

### Collections (think: database tables)

| Collection | What's stored | Who can access |
|------------|--------------|---------------|
| `users` | Name, email, role, profile info | Only you (owner) |
| `resumes` | Your resume data and saved versions | Only you (owner) |
| `resumeDrafts` | Auto-saves of your work in progress | Only you (owner) |
| `apiKeysWallet` | Your encrypted API keys | Only you (read), backend only (write) |
| `jobs` | All job postings | All logged-in users (read) |
| `applications` | Job applications | Backend only |
| `interviews` | Interview sessions and feedback | Logged-in users |
| `chats` | Messages between users | Backend only |
| `connections` | Who's connected to whom | Backend only |
| `notifications` | Alert messages (new application, etc.) | Recipient only |
| `apply_sessions` | Autonomous apply progress | Backend only |

### Real-time updates

Firestore updates in real-time. When a recruiter sends you a message, it appears in your chat window within 1-2 seconds without you needing to refresh the page. This is because the app "listens" to the database for changes.

---

## 11. Security

### How login works

1. You enter your email and password
2. Firebase Authentication checks if they're correct
3. Firebase gives you an **ID token** — a long string of characters that acts like a temporary badge
4. Every request to the backend includes this token
5. The backend verifies the token with Firebase before doing anything

Tokens expire after 1 hour, but are silently refreshed so you don't get logged out during normal use.

### Two-Factor Authentication (2FA)

An optional extra layer of security:
1. Go to Settings → Security → Enable 2FA
2. Enter your phone number or email
3. Every login will require both your password and a 6-digit code sent to you

### What CareerCraft can never see

- Your plain-text API keys (they're encrypted before storage)
- Your actual Firebase password (Firebase handles this — CareerCraft never sees it)

### Account suspension

If an admin suspects an account is being misused, they can suspend it. Suspended users are immediately signed out and get an error message when they try to log in again.

---

## 12. Setting Up the Project

*This section is for developers who want to run CareerCraft locally on their computer.*

### What you need to install first

| Tool | What it does | How to install |
|------|-------------|----------------|
| **Node.js** (v18+) | Runs the website frontend | nodejs.org |
| **Python** (3.11+) | Runs the backend API | python.org |
| **Flutter** (3.24+) | Builds the mobile app | flutter.dev |
| **Git** | Version control | git-scm.com |
| **gcloud CLI** | Deploys to Google Cloud | cloud.google.com/sdk |

### Step 1: Clone the repository

```bash
git clone https://github.com/Sree8778/CareerCraft.git
cd CareerCraft
```

### Step 2: Set up Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project (or use `recruit-edge-e0d1b`)
3. Enable **Authentication** → sign-in methods: Email/Password and Google
4. Enable **Firestore Database** → start in test mode
5. Go to Project Settings → Service Accounts → Generate new private key
6. Save the downloaded JSON file as `web/backend/credentials/firebase-adminsdk.json`
7. Go to Project Settings → General and copy your web app config
8. Create `web/.env.local` with these values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### Step 3: Set up the backend

```bash
cd web/backend

# Create a virtual environment (isolated Python environment)
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create backend .env file
```

Create `web/backend/.env`:
```env
GEMINI_API_KEY=your_gemini_key        # optional, for server-side fallback
BACKEND_VAULT_MASTER_KEY=your_32_char_key  # generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Run the backend:
```bash
python app.py
# Server starts at http://localhost:5000
```

### Step 4: Set up the frontend

```bash
cd web

# Install Node packages
npm install

# Run the development server
npm run dev
# Website opens at http://localhost:3000
```

### Step 5: Set up the mobile app (optional)

```bash
cd mobile

# Install Flutter packages
flutter pub get

# Run on a connected device or emulator
flutter run
```

### Step 6: Set up the browser extension (optional)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `web/browser-extension/` folder
5. Extension is installed and ready

---

## 13. Deploying to the Internet

CareerCraft runs on **Google Cloud Run** — a service that automatically scales up when more people use it and scales down when they don't, so you only pay for what you use.

### What you need

1. A Google Cloud account with billing enabled
2. A project (currently `recruit-edge-e0d1b`)
3. The `.env.cloud` file with your production secrets

### The `.env.cloud` file

Create this file at the project root (it's gitignored — never commit it):

```env
GCP_PROJECT_ID=recruit-edge-e0d1b
GCP_REGION=us-central1
GEMINI_API_KEY=your_gemini_key
BACKEND_VAULT_MASTER_KEY=your_fernet_key
RESEND_API_KEY=your_resend_key
EMAIL_FROM=noreply@careercraft.app
PLATFORM_URL=https://careercraft-frontend-u7h4zjepfq-uc.a.run.app
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=recruit-edge-e0d1b.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=recruit-edge-e0d1b
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=recruit-edge-e0d1b.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=414523842687
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Deploy everything

```powershell
.\deploy.ps1
```

This script does the following automatically:
1. Reads all secrets from `.env.cloud`
2. Enables required Google Cloud APIs
3. Builds the backend Docker image and deploys it to Cloud Run
4. Builds the frontend Docker image with the backend URL baked in
5. Deploys the frontend to Cloud Run
6. Prints the live URLs when done

### Deploy frontend only (faster)

```powershell
.\deploy.ps1 -FrontendOnly
```

### After deploying

1. Add the new frontend URL to Firebase Console → Authentication → Authorized domains
2. Deploy Firestore security rules: `firebase deploy --only firestore:rules`
3. Test that everything works by visiting the frontend URL

### Current live URLs

| Service | URL |
|---------|-----|
| **Frontend** | `https://careercraft-frontend-u7h4zjepfq-uc.a.run.app` |
| **Backend API** | `https://careercraft-backend-u7h4zjepfq-uc.a.run.app/api` |

---

## 14. Full API Reference

*Every endpoint the backend exposes. All authenticated endpoints require an `Authorization: Bearer {firebase_id_token}` header.*

### Authentication

| Method | Path | Who | What it does |
|--------|------|-----|-------------|
| POST | `/auth/send-email-otp` | Anyone | Send a one-time password to an email address |
| POST | `/auth/verify-email-otp` | Anyone | Verify the OTP code entered by user |
| POST | `/auth/2fa/setup` | Logged-in user | Set up two-factor authentication |
| POST | `/auth/2fa/verify` | Anyone | Verify 2FA code during login |
| POST | `/auth/2fa/disable` | Logged-in user | Turn off 2FA |

### Users

| Method | Path | Who | What it does |
|--------|------|-----|-------------|
| POST | `/users/register` | Anyone | Create a new user account |
| GET | `/users` | Admin | Get all users on the platform |
| PATCH | `/users/{uid}/profile` | Owner | Update name, email, phone, location |
| GET | `/users/{uid}/completion` | Owner | Get profile completion % and missing fields |
| GET | `/stats/candidate/{uid}` | Owner | Get candidate's dashboard stats |
| GET | `/stats/recruiter/{uid}` | Owner | Get recruiter's dashboard stats |

### Jobs

| Method | Path | Who | What it does |
|--------|------|-----|-------------|
| GET | `/jobs` | Anyone logged in | List all job postings |
| POST | `/jobs/v1/post` | Recruiter | Create a new job posting |
| GET | `/jobs/{job_id}` | Anyone logged in | Get one job's full details |
| PATCH | `/jobs/{job_id}` | Job owner | Edit a job posting |
| POST | `/jobs/{job_id}/apply` | Candidate | Submit an application |
| GET | `/jobs/{job_id}/applications` | Recruiter (job owner) | List all applications for this job |
| POST | `/jobs/search-semantic` | Anyone logged in | Search jobs using natural language |
| POST | `/jobs/generate-description` | Recruiter | AI-generate a job description |
| POST | `/jobs/crawl` | Recruiter | Scrape external job boards |

### Applications

| Method | Path | Who | What it does |
|--------|------|-----|-------------|
| GET | `/applications` | Candidate or Recruiter | List applications (filtered by your role) |
| GET | `/applications/{app_id}` | Participant | Get one application's full details |
| POST | `/applications/{app_id}/status` | Recruiter | Update application status |
| POST | `/applications/{app_id}/ai-screen` | Recruiter | Run AI screening analysis |
| POST | `/applications/{app_id}/ats-score` | Recruiter | Calculate ATS score for this application |

### Resume Tools

| Method | Path | Who | What it does |
|--------|------|-----|-------------|
| POST | `/parse-resume` | Candidate | Upload PDF/DOCX and get structured JSON back |
| POST | `/generate-pdf` | Candidate | Turn resume JSON into a PDF file |
| POST | `/generate-docx` | Candidate | Turn resume JSON into a Word file |
| POST | `/resume/analyze` | Candidate | Detailed ATS and format analysis |
| POST | `/generate-elevator-pitch` | Candidate | Write a 30-second professional pitch |
| POST | `/enhance-section` | Candidate | AI-rewrite a specific resume section |
| POST | `/generate-summary-suggestions` | Candidate | Get 3 professional summary options |
| POST | `/generate-cover-letter` | Candidate | Write a custom cover letter |
| POST | `/grade-resume` | Candidate | Score resume vs a job description |
| POST | `/resume/tailor-to-jd` | Candidate | Rewrite resume using a job's keywords |

### Interviews

| Method | Path | Who | What it does |
|--------|------|-----|-------------|
| GET | `/interviews` | Both | List all interviews |
| POST | `/interviews/schedule` | Recruiter | Book an interview |
| POST | `/interviews/verify-identity` | Candidate | Submit ID + selfie for identity check |
| POST | `/interviews/get-next-question` | Candidate | Get next dynamic interview question |
| POST | `/interviews/evaluate-response` | Candidate | Grade a spoken response |
| POST | `/practice-interview/question` | Candidate | Get a practice question |
| POST | `/practice-interview/ai-turn` | Candidate | Get AI interviewer's next message |
| POST | `/practice-interview/evaluate` | Candidate | Score your answer |
| POST | `/practice-interview/final-feedback` | Candidate | Get end-of-session full report |

### Candidates (for Recruiters)

| Method | Path | Who | What it does |
|--------|------|-----|-------------|
| GET | `/candidates` | Recruiter | List all candidates |
| GET | `/candidates/{uid}/resume` | Recruiter | Fetch a candidate's resume |
| POST | `/candidates/search-copilot` | Recruiter | Natural-language candidate search |
| POST | `/analyze-fit` | Recruiter | Score candidate vs job description |

### Smart Apply

| Method | Path | Who | What it does |
|--------|------|-----|-------------|
| POST | `/smart-apply/search` | Candidate | Search multiple job boards at once |
| POST | `/smart-apply/queue/add` | Candidate | Add a job to your apply queue |
| POST | `/smart-apply/queue/remove` | Candidate | Remove a job from queue |
| GET | `/smart-apply/queue` | Candidate | View your current queue |
| POST | `/smart-apply/apply-supervised` | Candidate | Apply to one job (with your review) |
| POST | `/smart-apply/autonomous/start` | Candidate | Start bulk auto-apply |
| POST | `/smart-apply/autonomous/stop` | Candidate | Stop auto-apply session |
| GET | `/smart-apply/status` | Candidate | Check current apply progress |

### Messaging & Social

| Method | Path | Who | What it does |
|--------|------|-----|-------------|
| GET | `/chats` | Both | List all your conversations |
| POST | `/chats` | Both | Start a new conversation |
| GET | `/chats/{chat_id}/messages` | Participant | Get messages in a conversation |
| POST | `/chats/{chat_id}/messages` | Participant | Send a message |
| GET | `/connections` | Both | List your connections |
| POST | `/connections/request` | Both | Send a connection request |
| POST | `/connections/{id}/respond` | Recipient | Accept or decline a request |
| GET | `/feed` | Both | Get social feed posts |
| POST | `/posts` | Both | Create a post |
| POST | `/posts/{post_id}/like` | Both | Like a post |
| POST | `/posts/{post_id}/comments` | Both | Comment on a post |
| DELETE | `/posts/{post_id}` | Author | Delete a post |

### API Keys & Vault

| Method | Path | Who | What it does |
|--------|------|-----|-------------|
| POST | `/vault/verify-key` | Owner | Test if an API key is valid |
| POST | `/vault/wallet/stack` | Owner | Add a key to your wallet |
| GET | `/vault/wallet/status` | Owner | Check key status and quota |
| POST | `/vault/wallet/remove` | Owner | Remove a key |

### Browser Extension

| Method | Path | Auth type | What it does |
|--------|------|-----------|-------------|
| POST | `/plugin/token` | Firebase token | Get a long-lived plugin token |
| GET | `/plugin/profile` | Plugin token | Get profile for autofill |
| GET | `/plugin/resumes` | Plugin token | List saved resume versions |
| POST | `/plugin/applied` | Plugin token | Log a completed application |

### Notifications

| Method | Path | Who | What it does |
|--------|------|-----|-------------|
| GET | `/notifications` | Both | Get your notifications |
| POST | `/notifications/read-all` | Both | Mark all as read |

### Webhooks

| Method | Path | Who | What it does |
|--------|------|-----|-------------|
| GET | `/webhooks/subscriptions` | Recruiter | List webhook subscriptions |
| POST | `/webhooks/subscribe` | Recruiter | Add a new webhook |
| POST | `/webhooks/test-ping` | Recruiter | Send a test payload |

### Companies

| Method | Path | Who | What it does |
|--------|------|-----|-------------|
| GET | `/companies` | Anyone | List companies (with optional search) |
| GET | `/companies/{id}` | Anyone | Get one company's details |
| GET | `/companies/{id}/reviews` | Anyone | Get employee reviews |
| POST | `/companies/{id}/reviews` | Candidate | Submit a review |
| GET | `/companies/{id}/qna` | Anyone | Get company Q&A |
| POST | `/companies/{id}/qna` | Both | Post a question or answer |

### Admin

| Method | Path | Who | What it does |
|--------|------|-----|-------------|
| GET | `/admin/me` | Admin | Confirm you have admin access |
| GET | `/admin/stats` | Admin | Platform-wide statistics |
| GET | `/admin/users` | Admin | All users with stats |
| POST | `/admin/users/{uid}/suspend` | Admin | Suspend a user account |
| GET | `/admin/jobs` | Admin | All jobs (for moderation) |
| PUT | `/admin/features` | Admin | Toggle feature flags |

### Platform

| Method | Path | Who | What it does |
|--------|------|-----|-------------|
| GET | `/platform/config` | Anyone | Get feature flags and public config |
| GET | `/benefits` | Anyone | Public benefits directory |
| GET | `/testimonials` | Anyone | Success stories |
| GET | `/employers/featured` | Anyone | Featured employer showcase |
| GET | `/stats/salaries` | Anyone | Crowdsourced salary data |

---

## 15. Folder Structure

```
CareerCraft/
│
├── web/                              ← The website
│   ├── src/
│   │   ├── app/                      ← Every page of the website
│   │   │   ├── page.tsx              ← Home/landing page
│   │   │   ├── feed/page.tsx         ← Social feed
│   │   │   ├── signup/page.tsx       ← Sign up page
│   │   │   ├── onboarding/page.tsx   ← New user setup wizard
│   │   │   ├── profile/[uid]/        ← Public profile pages
│   │   │   ├── companies/            ← Company directory
│   │   │   ├── admin/page.tsx        ← Super admin panel
│   │   │   ├── candidate/            ← All candidate pages
│   │   │   │   ├── dashboard/        ← Candidate home
│   │   │   │   ├── jobs/             ← Job search & details
│   │   │   │   ├── smart-apply/      ← Automated applications
│   │   │   │   ├── resume-builder/   ← AI resume editor
│   │   │   │   ├── applications/     ← Application tracker
│   │   │   │   ├── interview/        ← Interview tools
│   │   │   │   ├── messages/         ← Chat
│   │   │   │   ├── network/          ← Connections
│   │   │   │   ├── profile/          ← Edit profile
│   │   │   │   └── settings/         ← API keys, 2FA, theme
│   │   │   └── recruiter/            ← All recruiter pages
│   │   │       ├── dashboard/        ← Recruiter home
│   │   │       ├── requisitions/     ← Job postings
│   │   │       ├── applications/     ← Application pipeline
│   │   │       ├── candidates/       ← Candidate directory
│   │   │       ├── sourcing/         ← Passive sourcing
│   │   │       ├── messages/         ← Chat
│   │   │       ├── network/          ← Connections
│   │   │       ├── profile/          ← Edit profile
│   │   │       ├── settings/         ← Account settings
│   │   │       └── webhooks/         ← ATS integration
│   │   ├── components/               ← Reusable UI pieces
│   │   │   ├── LoginModal.tsx        ← Login/signup popup
│   │   │   ├── Navbar.tsx            ← Top navigation bar
│   │   │   └── layout/               ← Sidebar & layout wrappers
│   │   ├── contexts/                 ← Global app state
│   │   │   ├── AuthContext.tsx       ← Who is logged in?
│   │   │   ├── FeatureFlagsContext.tsx ← Which features are on?
│   │   │   ├── LoginModalContext.tsx ← Is the login popup open?
│   │   │   └── ThemeContext.tsx      ← Dark or light mode?
│   │   └── lib/
│   │       ├── api.ts                ← Frontend API helper functions
│   │       └── firebase.ts           ← Firebase setup
│   │
│   ├── backend/                      ← The Python server
│   │   ├── app.py                    ← Server entry point (starts Flask)
│   │   ├── routes.py                 ← ALL endpoints (~4000 lines)
│   │   ├── gemini_utils.py           ← AI/Gemini helper functions
│   │   ├── firebase_utils.py         ← Firebase Admin helper functions
│   │   ├── vault_utils.py            ← API key encryption/decryption
│   │   ├── file_parser.py            ← PDF/DOCX text extraction
│   │   ├── document_generator.py     ← PDF/DOCX generation
│   │   ├── job_crawler.py            ← External job board scraping
│   │   ├── email_utils.py            ← Email sending (via Resend)
│   │   ├── requirements.txt          ← Python packages needed
│   │   └── credentials/              ← 🔒 Firebase service account (gitignored)
│   │
│   ├── browser-extension/            ← The Chrome plugin
│   │   ├── manifest.json             ← Extension configuration
│   │   ├── popup.html                ← Extension UI
│   │   ├── popup.js                  ← Extension UI logic
│   │   ├── popup.css                 ← Extension styles
│   │   ├── content.js                ← Form-filling logic (injected into pages)
│   │   ├── background.js             ← Background worker (API calls)
│   │   └── mock_apply_page.html      ← Test page for development
│   │
│   └── package.json                  ← Node.js dependencies
│
├── mobile/                           ← The Android/iOS app
│   ├── lib/
│   │   ├── main.dart                 ← App entry point
│   │   ├── api/
│   │   │   └── api_service.dart      ← All API calls (mirrors backend)
│   │   ├── services/
│   │   │   └── auth_service.dart     ← Login, logout, Google Sign-In
│   │   ├── auth/
│   │   │   ├── login_page.dart       ← Login screen
│   │   │   └── signup_page.dart      ← Sign-up screen
│   │   ├── pages/                    ← Every screen in the app
│   │   │   ├── home_page.dart
│   │   │   ├── candidate_dashboard_page.dart
│   │   │   ├── candidate_applications_page.dart
│   │   │   ├── candidate_resume_builder_page.dart
│   │   │   ├── candidate_smart_apply_page.dart
│   │   │   ├── candidate_interview_page.dart
│   │   │   ├── candidate_messages_page.dart
│   │   │   ├── candidate_profile_page.dart
│   │   │   ├── job_search_page.dart
│   │   │   ├── job_details_page.dart
│   │   │   ├── recruiter_dashboard_page.dart
│   │   │   ├── recruiter_job_post_page.dart
│   │   │   ├── recruiter_requisitions_page.dart
│   │   │   ├── recruiter_candidates_page.dart
│   │   │   ├── recruiter_candidate_details_page.dart
│   │   │   ├── recruiter_messages_page.dart
│   │   │   ├── recruiter_sourcing_page.dart
│   │   │   ├── recruiter_webhooks_page.dart
│   │   │   ├── network_page.dart
│   │   │   ├── feed_page.dart
│   │   │   ├── companies_page.dart
│   │   │   ├── company_details_page.dart
│   │   │   └── more_page.dart
│   │   └── widgets/                  ← Reusable Flutter components
│   │       ├── glass_card.dart       ← Frosted-glass card style
│   │       └── animated_background.dart
│   ├── android/                      ← Android-specific config
│   │   └── app/
│   │       └── google-services.json  ← Firebase Android config
│   └── pubspec.yaml                  ← Flutter/Dart dependencies
│
├── tests/                            ← Automated tests
│   ├── test_api_health.py            ← Checks backend endpoints respond
│   ├── test_ui_candidate.py          ← Simulates a candidate using the site
│   ├── test_ui_recruiter.py          ← Simulates a recruiter using the site
│   ├── test_ui_public.py             ← Tests public pages
│   ├── test_ai_explorer.py           ← Tests AI features
│   ├── config.py                     ← Test settings (URLs, credentials from env)
│   ├── conftest.py                   ← Shared test setup
│   ├── create_test_accounts.py       ← Creates test users in Firebase
│   └── requirements.txt             ← Python packages for testing
│
├── docs/
│   ├── DOCUMENTATION.md              ← This file
│   └── TECHNICAL.md                  ← Deep technical architecture guide
│
├── firestore.rules                   ← Database security rules
├── storage.rules                     ← File storage security rules
├── deploy.ps1                        ← One-command deployment script
├── .gitignore                        ← Files NOT to upload to GitHub
└── README.md                         ← Quick start guide
```

---

## 16. Glossary

Here are definitions of every technical term used in this project:

| Term | Plain English explanation |
|------|--------------------------|
| **API** | A way for two programs to talk to each other. Like a waiter who takes your order (request) to the kitchen (server) and brings back your food (response). |
| **API Key** | A secret password that lets you use an AI service. Like a membership card for a gym. |
| **ATS** | Applicant Tracking System — software companies use to automatically filter job applications. Think of it as a robot that reads your resume first before a human ever sees it. |
| **ATS Score** | A number (0–100) measuring how likely your resume is to get past the robot filter. Higher is better. |
| **Authentication** | Proving you are who you say you are. Logging in is authentication. |
| **Authorization** | Checking if you're *allowed* to do something. "You can read this file, but not delete it." |
| **Backend** | The server — the part of the app that stores data, runs AI, and enforces rules. You can't see it directly, but every action you take talks to it. |
| **BYOK** | Bring Your Own Key — you provide your own AI API key rather than paying a subscription. |
| **Cloud Run** | Google's service for running programs on the internet. It automatically gives more computing power when many people use the app at once. |
| **Context (React)** | A way to share data between different parts of a website without passing it through every component manually. |
| **Docker** | Technology that packages a program and everything it needs into a single portable "container" that runs the same way on any computer. |
| **Endpoint** | A specific URL the backend listens to. Like a specific phone number for a specific department. `/api/jobs` is an endpoint. |
| **Encryption** | Scrambling data so only the intended recipient can unscramble it. Like a secret code. |
| **Fernet** | A specific encryption method used to scramble API keys in the database. |
| **Firebase** | Google's platform for building apps — provides database, authentication, and file storage. |
| **Firestore** | Google's cloud database. Stores data as collections of documents (like folders of JSON files). |
| **Flutter** | Google's framework for building phone apps using one codebase (works on both Android and iOS). |
| **Frontend** | The part of the app you see and interact with — the website or phone app UI. |
| **Git** | Software that tracks every change to code and lets multiple people work on the same project without overwriting each other. |
| **Google Cloud** | Google's cloud computing platform — where this app is hosted and runs. |
| **ID Token** | A short-lived digital pass Firebase gives you after login. Your browser sends it with every request to prove you're logged in. Expires after 1 hour. |
| **Kanban Board** | A way to organize tasks into columns (like "To Do" → "In Progress" → "Done"). Used in the Applications Tracker. |
| **LLM** | Large Language Model — the AI technology behind ChatGPT, Gemini, etc. It's trained on billions of words and can write, explain, and reason. |
| **Manifest.json** | A configuration file for Chrome extensions that tells Chrome what permissions the extension needs. |
| **Next.js** | A framework for building websites with React. Handles routing, server-side rendering, and performance automatically. |
| **Node.js** | A program that lets you run JavaScript on a server (not just in a browser). |
| **OAuth** | A standard way to log in with another service (like "Log in with Google") without giving the app your Google password. |
| **Python** | A programming language known for being easy to read. The backend of CareerCraft is written in Python. |
| **React** | A JavaScript library for building user interfaces. The web frontend uses React (via Next.js). |
| **REST API** | A standard style for building APIs where different URLs correspond to different actions (GET=read, POST=create, PATCH=update, DELETE=remove). |
| **Semantic Search** | Search that understands meaning, not just keywords. Searching "I want a chill remote role" finds "Work-from-home positions with flexible hours". |
| **Token (auth)** | A string of characters that proves you're logged in. Like a wristband at a concert — you show it to get in. |
| **Webhook** | A way for one app to automatically notify another app when something happens. Like a notification — "Hey, new application came in!" |
| **BYOK vault** | The encrypted storage in Firestore where your API keys are kept safe. |
| **Fernet key / Vault master key** | The server-side secret that locks and unlocks your encrypted API keys. Never stored in code — only in environment variables. |
| **Environment variable** | A value set on the server that programs can read but isn't written in the code. Used for secrets like API keys. |
| **Gitignore** | A file that lists paths Git should never upload to GitHub (used to keep credentials out of the code). |
| **Cloud Build** | Google's service for building Docker images in the cloud automatically. |
| **Artifact Registry** | Google's private storage for Docker images before they're deployed. |
| **Gunicorn** | A Python program that runs Flask in production — handles multiple requests at the same time. |
| **MV3 (Manifest V3)** | The current version of the Chrome extension API. Has stricter rules than V2 for better security. |
| **Shadow DOM** | A hidden version of the page structure some websites use. The browser extension handles these specially. |
| **Firestore Rules** | Security rules written in a special language that control who can read or write each piece of data. |
| **Service Account** | A special type of Google account for programs (not people). The backend uses one to access Firebase. |

---

*Built with Next.js · Flutter · Flask · Firebase · Google Cloud Run*

*Documentation last updated: July 2026*
