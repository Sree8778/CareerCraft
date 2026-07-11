# backend/test_auto_apply_smoke.py
import sys
import os

# Ensure the backend directory is in the import path
sys.path.insert(0, os.path.dirname(__file__))

import firebase_utils
firebase_utils.firebase_initialized = True

class MockDocument:
    def __init__(self, data):
        self._data = data
        self.exists = True if data else False
    def get(self):
        return self
    def to_dict(self):
        return self._data

class MockCollection:
    def __init__(self, data):
        self._data = data
    def document(self, doc_id):
        return MockDocument(self._data.get(doc_id))

class MockDb:
    def __init__(self):
        self.collections = {
            'resumes': {
                'mock_uid_123': {
                    'resumeData': {
                        'personal': {
                            'name': 'Jane Doe',
                            'email': 'developer@recruitedge.mock',
                            'phone': '555-0199',
                            'location': 'San Francisco, CA'
                        },
                        'summary': 'Senior Full Stack Developer with 4 years of experience building Next.js, React and Flask applications.',
                        'skills': [
                            {'category': 'Languages', 'skills_list': 'Python, JavaScript, SQL, TypeScript'},
                            {'category': 'Frameworks', 'skills_list': 'React, Next.js, Flask, TailwindCSS'}
                        ],
                        'experience': [
                            {
                                'jobTitle': 'Software Engineer',
                                'company': 'Tech Corp',
                                'dates': '2022 - Present',
                                'description': 'Developed dynamic web forms, APIs, and custom scraper automation scripts.'
                            }
                        ]
                    }
                }
            }
        }
    def collection(self, name):
        return MockCollection(self.collections.get(name, {}))

firebase_utils.db = MockDb()

# Now import the solver utility
from dotenv import load_dotenv
import ollama_utils

# Load the local .env file explicitly
backend_dir = os.path.dirname(__file__)
load_dotenv(os.path.join(backend_dir, '.env'))

api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    ollama_utils.set_api_key(api_key)

from auto_apply_ai import solve_questions_with_gemini

def run_test():
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass  # Python < 3.7 doesn't have reconfigure

    print("[SMOKE TEST] Initializing AI application question solver test...")
    questions = [
        "What is your full name?",
        "What is your expected salary?",
        "Please summarize your experience with Python."
    ]

    try:
        answers = solve_questions_with_gemini("mock_uid_123", questions)
        print("\nQuestions & AI Generated Answers:")
        for q, a in zip(questions, answers):
            print(f"  Q: '{q}'\n  A: '{a}'\n")

        assert len(answers) == len(questions), "Answer array length mismatch"
        print("[OK] Smoke test passed successfully!")
    except Exception as e:
        print(f"[FAIL] Smoke test failed with exception: {e}")
        sys.exit(1)

if __name__ == '__main__':
    run_test()
