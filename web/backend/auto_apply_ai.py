# backend/auto_apply_ai.py
import json
from firebase_utils import db, firebase_initialized

def solve_questions_with_gemini(candidate_id: str, questions: list) -> list:
    """
    Uses Gemini API to answer custom job application questions based on candidate profile and resume.
    """
    if not firebase_initialized or not db:
        raise RuntimeError("Firebase is not initialized. Cannot read candidate profile.")

    # 1. Fetch Candidate's Resume from Firestore
    try:
        resume_doc = db.collection('resumes').document(candidate_id).get()
        if not resume_doc.exists:
            raise ValueError(f"Resume not found for candidate: {candidate_id}")
        resume_data = resume_doc.to_dict().get('resumeData', {})
    except Exception as e:
        print(f"[auto_apply_ai] Firestore fetch failed: {e}")
        # Return fallback generic answers if Firestore is unavailable or document missing
        return ["Not specified" for _ in questions]

    # 2. Formulate dynamic prompt for Gemini
    prompt = f"""
    You are an AI assistant that auto-fills job applications on behalf of a candidate.
    Use the candidate's resume details to answer a list of custom application questions.

    Candidate Resume Data:
    {json.dumps(resume_data, indent=2)}

    Questions to Answer:
    {json.dumps(questions, indent=2)}

    Instructions:
    1. Respond to each question in the list.
    2. Maintain a highly professional and tailored tone.
    3. Keep answers concise (1-2 sentences unless the question explicitly asks for a detailed description/cover letter).
    4. For boolean or choice questions (e.g. "Do you have work authorization?"), answer with "Yes", "No", or pick the most logical option.
    5. Return ONLY a valid JSON object matching this exact schema:
    {{
      "answers": [
        "answer to question 1",
        "answer to question 2"
      ]
    }}
    Do not wrap the output in markdown code blocks. Output raw JSON.
    """

    try:
        from ollama_utils import _call
        result = _call(prompt, json_mode=True)
        if isinstance(result, dict):
            return result.get("answers", ["N/A" for _ in questions])
        return ["N/A" for _ in questions]
    except RuntimeError as re:
        # Fall back to server NVIDIA key if user key is missing/exhausted/invalid
        if "NO_API_KEYS" in str(re) or "exhausted or invalid" in str(re):
            try:
                from ai_router import server_fallback
                print("[auto_apply_ai] User key failed/missing. Trying server-level AI fallback...")
                raw_fallback = server_fallback(prompt, json_mode=True)
                result = json.loads(raw_fallback)
                if isinstance(result, dict):
                    return result.get("answers", ["N/A" for _ in questions])
            except Exception as fe:
                print(f"[auto_apply_ai] Server-level fallback failed: {fe}")
        return ["N/A" for _ in questions]
    except Exception as e:
        print(f"[auto_apply_ai] AI execution failed: {e}")
        return ["N/A" for _ in questions]
