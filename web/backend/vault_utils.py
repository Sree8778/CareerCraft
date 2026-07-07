# backend/vault_utils.py
import os
import base64
from cryptography.fernet import Fernet
from dotenv import load_dotenv

# Load server environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

# Retrieve the master key from the server environment
# Fernet keys must be 32 url-safe base64-encoded bytes.
MASTER_KEY = os.getenv("BACKEND_VAULT_MASTER_KEY")

# Fallback master key for clean local development if not configured in .env
FALLBACK_KEY = "S01FUk5FVF9NQVNURVJfS0VZX1ZBVUxUXzIwMjZfQ0FSRUVSQ1JBRlQ="

if not MASTER_KEY:
    print("WARNING: BACKEND_VAULT_MASTER_KEY not found in backend environment variables.")
    print("WARNING: The vault is running in fallback development encryption mode. Do not use this fallback key in production!")
    MASTER_KEY = FALLBACK_KEY

cipher_suite = None
try:
    fernet_key = MASTER_KEY.encode('utf-8')
    cipher_suite = Fernet(fernet_key)
except Exception as e:
    print(f"ERROR: Invalid Fernet key format: {e}. Generating a temporary in-memory key.")
    cipher_suite = Fernet(Fernet.generate_key())

def encrypt_key(plaintext: str) -> str:
    """
    Encrypts a plain-text API key securely using the server's Master Encryption Key.
    Returns a base64-encoded string.
    """
    if not plaintext:
        return ""
    try:
        encrypted_bytes = cipher_suite.encrypt(plaintext.encode('utf-8'))
        return encrypted_bytes.decode('utf-8')
    except Exception as e:
        print(f"Encryption failed in backend vault: {e}")
        raise ValueError("Could not securely encrypt key.")

def decrypt_key(ciphertext: str) -> str:
    """
    Decrypts an encrypted API key base64 string using the server's Master Encryption Key.
    Returns the plain-text API key.
    """
    if not ciphertext:
        return ""
    try:
        decrypted_bytes = cipher_suite.decrypt(ciphertext.encode('utf-8'))
        return decrypted_bytes.decode('utf-8')
    except Exception as e:
        print(f"Decryption failed in backend vault: {e}")
        # Return fallback or empty if decryption fails to prevent fatal crashes
        return ""
