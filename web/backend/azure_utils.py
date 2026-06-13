# backend/azure_utils.py
import os
import json
from azure.ai.inference import ChatCompletionsClient
from azure.core.credentials import AzureKeyCredential

# IMPORTANT: Replace these with your actual Azure endpoint and key
# You can get these from your model's deployment page in the Azure AI Studio
AZURE_AI_ENDPOINT = os.getenv("AZURE_AI_ENDPOINT", "YOUR_AZURE_ENDPOINT")
AZURE_AI_KEY = os.getenv("AZURE_AI_KEY", "YOUR_AZURE_KEY")

def get_azure_ai_client():
    """Initializes and returns the Azure AI Chat Completions Client."""
    if not AZURE_AI_ENDPOINT or AZURE_AI_ENDPOINT == "YOUR_AZURE_ENDPOINT" or \
       not AZURE_AI_KEY or AZURE_AI_KEY == "YOUR_AZURE_KEY":
        print("🚨 AZURE_AI_ENDPOINT or AZURE_AI_KEY are not set. Azure AI features will be disabled.")
        return None
    
    try:
        client = ChatCompletionsClient(
            endpoint=AZURE_AI_ENDPOINT,
            credential=AzureKeyCredential(AZURE_AI_KEY),
        )
        print("✅ Azure AI client initialized.")
        return client
    except Exception as e:
        print(f"🚨 Failed to initialize Azure AI client: {e}")
        return None

def enhance_with_azure(client, section_name: str, text_to_enhance: str) -> list[str]:
    """Sends text to Azure AI for enhancement and returns multiple versions."""
    if not client or not text_to_enhance.strip():
        return [text_to_enhance]

    if section_name.lower() == 'summary':
        prompt = f"""
        Rewrite and enhance the following resume summary. Make it more professional, impactful, and concise.
        Generate exactly 3 distinct versions.
        Your final output must be a valid JSON object with a single key "versions" that contains an array of the 3 strings.
        
        Example format: {{"versions": ["First version...", "Second version...", "Third version..."]}}
        
        Input Text:
        ---
        {text_to_enhance}
        ---
        """
        messages = [{"role": "user", "content": prompt}]
        try:
            response = client.complete(messages=messages, response_format={"type": "json_object"})
            response_json = json.loads(response.choices[0].message.content)
            versions = response_json.get("versions", [])
            return versions if versions else [text_to_enhance]
        except Exception as e:
            print(f"Error enhancing '{section_name}' with Azure AI: {e}")
            return [text_to_enhance]
    else:
        # Simplified prompt for other sections
        prompt = f"""
        Rewrite and enhance the following resume section: '{section_name}'.
        Use professional language and action verbs. For 'Experience' descriptions, use bullet points.
        
        Input Text:
        ---
        {text_to_enhance}
        ---
        Improved Text:
        """
        messages = [{"role": "user", "content": prompt}]
        try:
            response = client.complete(messages=messages)
            return [response.choices[0].message.content.strip()]
        except Exception as e:
            print(f"Error enhancing '{section_name}' with Azure AI: {e}")
            return [text_to_enhance]

def generate_resume_fields_from_raw_text_azure(client, resume_text: str) -> dict:
    """Extracts structured resume data from raw text using Azure AI."""
    if not client or not resume_text.strip():
        return {}
        
    schema = {
        "personal": {"name": "string", "email": "string", "phone": "string", "location": "string"},
        "summary": "string",
        "experience": [{"jobTitle": "string", "company": "string", "dates": "string", "description": "string"}],
        "education": [{"degree": "string", "institution": "string", "graduationYear": "string", "gpa": "string", "achievements": "string"}],
        "skills": [{"category": "string", "skills_list": "string"}],
        "certifications": [{"name": "string", "issuer": "string", "date": "string"}]
    }
    
    prompt = f"""
    You are an expert resume parser. Extract the information from the following resume text and provide the output in a valid JSON format that adheres to the schema provided below.
    Ensure all fields are filled, even if with an empty string or empty list if no information is found.
    
    Schema:
    {json.dumps(schema, indent=2)}
    
    Resume Text:
    ---
    {resume_text}
    ---
    
    JSON Output:
    """
    messages = [{"role": "user", "content": prompt}]
    
    try:
        response = client.complete(messages=messages, response_format={"type": "json_object"})
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Error parsing with Azure AI: {e}")
        return {}
