# backend/test_servers.py
import requests
import json
import sys

def test_frontend():
    print("Testing Frontend Dev Server...")
    url = "http://localhost:3000/"
    try:
        response = requests.get(url, timeout=10)
        if response.ok:
            print(f"[OK] Frontend is UP and running! Status Code: {response.status_code}")
            return True
        else:
            print(f"[FAIL] Frontend returned unexpected status code: {response.status_code} - {response.reason}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"[FAIL] Frontend connection failed: {e}")
        return False

def test_backend_elevator_pitch():
    print("\nTesting Backend AI Elevator Pitch Endpoint...")
    url = "http://127.0.0.1:5000/api/generate-elevator-pitch"
    
    mock_resume = {
        "personal": {
            "name": "Jane Doe",
            "jobTitle": "Senior Software Engineer",
            "email": "jane@example.com",
            "phone": "123-456-7890",
            "location": "New York, NY"
        },
        "summary": "<p>Highly experienced software engineer specialized in React, Next.js, and Python backend microservices.</p>",
        "experience": [
            {
                "jobTitle": "Lead Frontend Architect",
                "company": "Tech Innovations Inc.",
                "dates": "2022 - Present",
                "description": "<ul><li>Led a team of 5 engineers to rebuild the enterprise SaaS platform using Next.js.</li><li>Improved page load speed by 40% through code splitting and tree shaking.</li></ul>"
            }
        ],
        "skills": [
            {
                "category": "Languages",
                "skills_list": "TypeScript, Python, JavaScript, HTML, CSS"
            },
            {
                "category": "Frameworks",
                "skills_list": "React, Next.js, Flask, FastAPI"
            }
        ]
    }
    
    try:
        headers = {"Authorization": "Bearer mock_token_tester"}
        response = requests.post(url, json=mock_resume, headers=headers, timeout=15)
        if response.ok:
            data = response.json()
            pitch = data.get("elevatorPitch")
            if pitch:
                print("[OK] Backend and Gemini Integration are working perfectly!")
                print(f"Generated Pitch:\n--------------------\n{pitch}\n--------------------")
                return True
            else:
                print(f"[FAIL] Backend response missing 'elevatorPitch': {data}")
                return False
        else:
            print(f"[FAIL] Backend returned error status code: {response.status_code} - {response.reason}")
            print(f"Details: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"[FAIL] Backend connection failed: {e}")
        return False

if __name__ == "__main__":
    frontend_ok = test_frontend()
    backend_ok = test_backend_elevator_pitch()
    
    if frontend_ok and backend_ok:
        print("\n=== All services are up, running, and communicating correctly! ===")
        sys.exit(0)
    else:
        print("\n=== Some services failed verification. Please check the logs. ===")
        sys.exit(1)
