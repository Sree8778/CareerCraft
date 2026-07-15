"""
init_firestore.py — Run once to initialise all Firestore collections in a new project.

Usage (from web/backend/):
    python init_firestore.py

What it does:
  1. Connects to Firestore using the local service account credentials
  2. Creates every collection by writing a _schema document (visible in console)
  3. Deploys Firestore security rules and indexes (if firebase-tools is installed)
  4. Prints a status report
"""

import os
import sys
from datetime import datetime, timezone

# ── locate credentials ─────────────────────────────────────────────────────────
CREDS_PATHS = [
    os.path.join(os.path.dirname(__file__), 'credentials', 'firebase-adminsdk.json'),
    os.path.join(os.path.dirname(__file__), 'credentials.json'),
]
CREDS_FILE = next((p for p in CREDS_PATHS if os.path.exists(p)), None)

if not CREDS_FILE:
    print("ERROR: credentials file not found. Expected at:")
    for p in CREDS_PATHS:
        print(f"  {p}")
    sys.exit(1)

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = CREDS_FILE

import firebase_admin
from firebase_admin import credentials, firestore

print(f"Using credentials: {CREDS_FILE}")
cred = credentials.Certificate(CREDS_FILE)
firebase_admin.initialize_app(cred)
db = firestore.client()
print("Firestore connected.\n")

NOW = datetime.now(timezone.utc)

# ── collection definitions ─────────────────────────────────────────────────────
# Each entry: (collection_path, schema_doc_content)
COLLECTIONS = [
    ("users", {
        "_description": "User profiles for both candidates and recruiters",
        "_fields": ["uid", "fullName", "email", "role", "phone", "location",
                    "bio", "orgName", "industry", "apiKeysWallet", "createdAt"],
        "_created": NOW,
    }),
    ("resumes", {
        "_description": "Structured resume data per candidate (uid = document id)",
        "_fields": ["personal", "summary", "experience", "education",
                    "skills", "projects", "publications", "certifications"],
        "_created": NOW,
    }),
    ("jobs", {
        "_description": "Job postings created by recruiters",
        "_fields": ["recruiterId", "title", "description", "location",
                    "jobType", "department", "status", "salaryRange", "postedDate"],
        "_created": NOW,
    }),
    ("applications", {
        "_description": "Candidate applications for specific jobs",
        "_fields": ["jobId", "candidateId", "recruiterId", "status",
                    "coverLetter", "recruiterNotes", "atsScore", "appliedDate"],
        "_created": NOW,
    }),
    ("chats", {
        "_description": "Direct message threads between a candidate and a recruiter",
        "_fields": ["candidateId", "recruiterId", "createdAt"],
        "_created": NOW,
    }),
    ("connections", {
        "_description": "Professional connection requests between any two users",
        "_fields": ["senderId", "receiverId", "senderName", "receiverName",
                    "status", "createdAt"],
        "_created": NOW,
    }),
    ("notifications", {
        "_description": "In-app notifications for status changes, connections, messages",
        "_fields": ["userId", "type", "message", "read", "createdAt"],
        "_created": NOW,
    }),
    ("interviews", {
        "_description": "Scheduled live interviews with AI evaluation results",
        "_fields": ["candidateId", "recruiterId", "jobId", "status",
                    "questions", "answers", "overallScore", "scheduledAt"],
        "_created": NOW,
    }),
    ("companies", {
        "_description": "Company profiles (AI-generated on demand)",
        "_fields": ["name", "industry", "description", "size",
                    "location", "website", "reviews", "createdAt"],
        "_created": NOW,
    }),
    ("webhookSubscriptions", {
        "_description": "Recruiter-registered webhook endpoints for ATS sync",
        "_fields": ["recruiterId", "url", "description", "createdAt"],
        "_created": NOW,
    }),
]

# ── create collections ─────────────────────────────────────────────────────────
print("Creating collections...\n")
ok = []
failed = []

for col_path, schema in COLLECTIONS:
    try:
        db.collection(col_path).document("_schema").set(schema)
        print(f"  [OK]  {col_path}")
        ok.append(col_path)
    except Exception as e:
        print(f"  [FAIL]  {col_path}  ->  {e}")
        failed.append(col_path)

# messages subcollection (needs a parent chat doc to exist)
try:
    chat_ref = db.collection("chats").document("_schema")
    chat_ref.collection("messages").document("_schema").set({
        "_description": "Messages within a chat thread",
        "_fields": ["senderId", "text", "sentAt"],
        "_created": NOW,
    })
    print(f"  [OK]  chats/_schema/messages")
    ok.append("chats/messages")
except Exception as e:
    print(f"  [FAIL]  chats/messages  ->  {e}")
    failed.append("chats/messages")

# ── summary ────────────────────────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"Collections created : {len(ok)}")
if failed:
    print(f"Failed              : {len(failed)}  ->  {failed}")
else:
    print("All collections initialised successfully.")
print(f"{'='*50}\n")

print("Next steps:")
print("  1. Deploy security rules:")
print("       cd web")
print("       firebase use recruit-edge-e0d1b")
print("       firebase deploy --only firestore:rules,firestore:indexes,storage")
print("  2. Enable Authentication in Firebase Console:")
print("       Authentication -> Sign-in method -> Email/Password  (enable)")
print("       Authentication -> Sign-in method -> Google          (enable)")
print("  3. Add Cloud Run URL to Authorized Domains after deploy.")
