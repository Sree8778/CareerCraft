# backend/test_ollama.py
import requests
import json

# List of possible API endpoints to try
endpoints_to_test = [
    "http://localhost:11434/api/chat",
    "http://localhost:11434/api/generate",
    "http://localhost:11434/v1/chat/completions",
    "http://localhost:11434/v1/api/chat" # Another less common variation
]

# A simple payload that should work with most endpoints
payload = {
    "model": "llama3:latest",
    "messages": [{"role": "user", "content": "Hi"}],
    "stream": False
}

def find_working_endpoint():
    print("--- Starting Ollama Endpoint Test ---")
    for url in endpoints_to_test:
        print(f"\n[*] Testing endpoint: {url}")
        try:
            response = requests.post(url, json=payload, timeout=10)
            
            # Check for a successful status code (like 200 OK)
            if response.ok:
                print(f"✅ SUCCESS! Found working endpoint: {url}")
                print(f"Status Code: {response.status_code}")
                print(f"Response: {response.text[:200]}...") # Print first 200 chars
                return url
            else:
                print(f"❌ FAILED with Status Code: {response.status_code} - {response.reason}")

        except requests.exceptions.RequestException as e:
            print(f"❌ FAILED with connection error: {e}")

    print("\n--- Test Complete ---")
    print("\nCould not find a working endpoint from the list.")
    return None

if __name__ == "__main__":
    find_working_endpoint()