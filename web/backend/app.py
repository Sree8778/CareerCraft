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

# This allows your React app (e.g., from localhost:5173) to make requests to your Flask app (at localhost:5000)
CORS(app) 

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