# backend/firebase_utils.py
import os
import firebase_admin
from firebase_admin import credentials, auth, firestore
from functools import wraps
from flask import request, jsonify

# Get absolute path for credentials file
CREDENTIALS_PATH = os.path.join(os.path.dirname(__file__), 'credentials', 'firebase-adminsdk.json')

firebase_initialized = False
db = None

try:
    if os.path.exists(CREDENTIALS_PATH):
        cred = credentials.Certificate(CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)
        firebase_initialized = True
        db = firestore.client()
        print("Firebase Admin SDK successfully initialized using service account key.")
    else:
        # Try initializing with default credentials
        try:
            firebase_admin.initialize_app()
            firebase_initialized = True
            db = firestore.client()
            print("Firebase Admin SDK initialized with default options.")
        except Exception:
            print("WARNING: firebase-adminsdk.json not found and default credentials unavailable.")
            print("The backend will run in mock authentication fallback mode.")
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
        
        # Support mock tokens for easy testing/developer setups
        if token.startswith("mock_token"):
            request.user = {
                "uid": token.replace("mock_token_for_", "") if "mock_token_for_" in token else "mock_uid",
                "email": "developer@careercraft.mock",
                "name": "Developer"
            }
            return f(*args, **kwargs)
            
        if not firebase_initialized:
            return jsonify({"error": "Firebase service is uninitialized. Live token verification is unavailable."}), 500
            
        try:
            decoded_token = auth.verify_id_token(token)
            request.user = decoded_token
        except Exception as e:
            print(f"Token verification error: {e}")
            return jsonify({"error": f"Invalid token: {str(e)}"}), 401
            
        return f(*args, **kwargs)
    return decorated
