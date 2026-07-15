"""
Creates Firebase email/password test accounts for automated testing.
Run once from the tests/ directory:
    python tests/create_test_accounts.py

Accounts created:
  Candidate:  testcandidate@careercraft.test  / TestCandidate@1
  Recruiter:  testrecruiter@careercraft.test  / TestRecruiter@1
"""

import sys
import os
import json
import datetime

BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..", "web", "backend")
sys.path.insert(0, BACKEND_DIR)

# Load .env from backend
from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

import firebase_admin
from firebase_admin import credentials, auth as fb_auth, firestore

CREDS_PATH = os.path.join(BACKEND_DIR, "credentials", "firebase-adminsdk.json")

# Initialize Firebase Admin SDK
if not firebase_admin._apps:
    cred = credentials.Certificate(CREDS_PATH)
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Import vault after Firebase is set up (it reads BACKEND_VAULT_MASTER_KEY)
from vault_utils import encrypt_key

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")  # set GEMINI_API_KEY env var before running

TEST_ACCOUNTS = [
    {
        "email": "testcandidate@careercraft.test",
        "password": "TestCandidate@1",
        "role": "candidate",
        "name": "Test Candidate",
    },
    {
        "email": "testrecruiter@careercraft.test",
        "password": "TestRecruiter@1",
        "role": "recruiter",
        "name": "Test Recruiter",
    },
]


def upsert_account(email: str, password: str, role: str, name: str) -> str:
    """Create or reset a Firebase Auth user and its Firestore doc. Returns UID."""
    # Try to get existing user
    try:
        user = fb_auth.get_user_by_email(email)
        # Reset password in case it changed
        fb_auth.update_user(user.uid, password=password, display_name=name)
        uid = user.uid
        print(f"  [OK] Updated existing user: {email} (uid={uid})")
    except fb_auth.UserNotFoundError:
        user = fb_auth.create_user(email=email, password=password, display_name=name)
        uid = user.uid
        print(f"  [OK] Created new user: {email} (uid={uid})")

    # Encrypt and store the Gemini API key
    encrypted = encrypt_key(GEMINI_API_KEY)
    wallet = [
        {
            "id": f"gemini-test-{uid[:8]}",
            "provider": "Gemini",
            "encryptedKey": encrypted,
            "status": "Active",
        }
    ]

    # Upsert Firestore user doc
    db.collection("users").document(uid).set(
        {
            "uid": uid,
            "email": email,
            "name": name,
            "fullName": name,
            "role": role,
            "onboardingCompleted": True,
            "biometricConsent": True,
            "apiKeysWallet": wallet,
            "createdAt": datetime.datetime.utcnow().isoformat() + "Z",
        },
        merge=True,
    )
    print(f"    Firestore doc set with role={role}, wallet with Gemini key")
    return uid


def main():
    print("\nCreating test accounts...")
    created = {}
    for acc in TEST_ACCOUNTS:
        print(f"\n[{acc['role'].upper()}]")
        uid = upsert_account(**acc)
        created[acc["role"]] = {"uid": uid, "email": acc["email"], "password": acc["password"]}

    # Save to tests/test_credentials.json for reference
    out_path = os.path.join(os.path.dirname(__file__), "test_credentials.json")
    with open(out_path, "w") as f:
        json.dump(created, f, indent=2)
    print(f"\n[OK] Credentials saved to {out_path}")

    print("\n=== TEST CREDENTIALS ===")
    for role, info in created.items():
        print(f"  {role.capitalize()}: {info['email']} / {info['password']}")
    print("\nAPI Key (Gemini) stored in Firestore wallet for both accounts.")
    print("\nNow update conftest.py with:")
    print(f"  CANDIDATE_EMAIL    = '{created['candidate']['email']}'")
    print(f"  CANDIDATE_PASSWORD = '{created['candidate']['password']}'")
    print(f"  RECRUITER_EMAIL    = '{created['recruiter']['email']}'")
    print(f"  RECRUITER_PASSWORD = '{created['recruiter']['password']}'")


if __name__ == "__main__":
    main()
