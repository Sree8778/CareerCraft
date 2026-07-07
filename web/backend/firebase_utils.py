# backend/firebase_utils.py
import os
import base64
import json
import firebase_admin
from firebase_admin import credentials, auth, firestore
from functools import wraps
from flask import request, jsonify

CREDENTIALS_PATH = os.path.join(os.path.dirname(__file__), 'credentials', 'firebase-adminsdk.json')
CREDENTIALS_PATH_ALT = os.path.join(os.path.dirname(__file__), 'credentials.json')

firebase_initialized = False
db = None

try:
    cred_obj = None

    # Option 1: env var with base64-encoded service account JSON (for Cloud Run)
    creds_b64 = os.environ.get('FIREBASE_CREDENTIALS_B64', '').strip()
    if creds_b64:
        try:
            creds_dict = json.loads(base64.b64decode(creds_b64).decode('utf-8'))
            cred_obj = credentials.Certificate(creds_dict)
            print("Firebase: loaded credentials from FIREBASE_CREDENTIALS_B64 env var")
        except Exception as e:
            print(f"Firebase: failed to decode FIREBASE_CREDENTIALS_B64: {e}")

    # Option 2: credentials/firebase-adminsdk.json
    if not cred_obj and os.path.exists(CREDENTIALS_PATH):
        cred_obj = credentials.Certificate(CREDENTIALS_PATH)
        print("Firebase: loaded credentials from credentials/ directory")

    # Option 3: credentials.json (legacy path)
    if not cred_obj and os.path.exists(CREDENTIALS_PATH_ALT):
        cred_obj = credentials.Certificate(CREDENTIALS_PATH_ALT)
        print("Firebase: loaded credentials from credentials.json")

    if cred_obj:
        firebase_admin.initialize_app(cred_obj)
    else:
        # Option 4: Application Default Credentials (works in Cloud Run if SA has permissions)
        firebase_admin.initialize_app()
        print("Firebase: initialized with Application Default Credentials")

    firebase_initialized = True
    db = firestore.client()
    print("Firebase Admin SDK successfully initialized.")
except Exception as e:
    print(f"WARNING: Firebase Admin SDK could not be initialized: {e}")
    print("The backend will run in mock authentication fallback mode.")

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"error": "Authorization header is missing"}), 401

        parts = auth_header.split()
        if parts[0].lower() != 'bearer':
            return jsonify({"error": "Authorization header must start with Bearer"}), 401
        elif len(parts) == 1:
            return jsonify({"error": "Token not found"}), 401
        elif len(parts) > 2:
            return jsonify({"error": "Authorization header must be Bearer token"}), 401

        token = parts[1]

        # Mock tokens for local dev and easy testing
        from flask import current_app
        if token.startswith("mock_token") and current_app.debug:
            _mock_uid = token.replace("mock_token_for_", "") if "mock_token_for_" in token else "mock_uid"
            request.user = {
                "uid": _mock_uid,
                "email": "developer@recruitedge.mock",
                "name": "Developer"
            }
            request.uid = _mock_uid
            return f(*args, **kwargs)

        if not firebase_initialized:
            return jsonify({"error": "Firebase service is uninitialized. Live token verification is unavailable."}), 500

        try:
            decoded_token = auth.verify_id_token(token)
            request.user = decoded_token
            request.uid = decoded_token.get('uid')
        except Exception as e:
            print(f"Token verification error: {e}")
            return jsonify({"error": f"Invalid token: {str(e)}"}), 401

        return f(*args, **kwargs)
    return decorated
