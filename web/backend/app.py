# backend/app.py
import os
from dotenv import load_dotenv
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

os.environ.setdefault('PYTHONIOENCODING', 'utf-8')
from flask import Flask
from flask_cors import CORS
try:
    from .routes import api_bp
except ImportError:
    from routes import api_bp

app = Flask(__name__)

# Restrict CORS to an explicit origin allowlist.
# In production set ALLOWED_ORIGINS to a comma-separated list of your actual
# frontend and extension origins, e.g.:
#   ALLOWED_ORIGINS=https://careercraft.example.com,chrome-extension://abcdefg
# Falls back to localhost dev origins when the var is absent.
_raw_origins = os.environ.get(
    'ALLOWED_ORIGINS',
    'http://localhost:3000,http://localhost:5173'
)
_allowed_origins = [o.strip() for o in _raw_origins.split(',') if o.strip()]
CORS(app, origins=_allowed_origins, supports_credentials=True)


# Register the blueprint
app.register_blueprint(api_bp, url_prefix='/api')

if __name__ == '__main__':
    try:
        try:
            from .job_crawler import IngestionScheduler
        except ImportError:
            from job_crawler import IngestionScheduler
        scheduler = IngestionScheduler(interval_seconds=3600)
        scheduler.start()
    except Exception as e:
        print(f"Warning: could not launch background IngestionScheduler: {e}")
    app.run(debug=True, host='0.0.0.0', port=5000)