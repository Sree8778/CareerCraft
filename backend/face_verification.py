# backend/face_verification.py
import json
import io
import google.generativeai as genai
from PIL import Image

def verify_face_similarity(state_id_bytes: bytes, selfie_bytes: bytes) -> dict:
    """
    Compares a candidate's State ID card/passport photo against a live webcam selfie
    using Gemini's multimodal vision capabilities to detect fraud and calculate a match score.
    
    Args:
        state_id_bytes: Binary data of the State ID image.
        selfie_bytes: Binary data of the live webcam selfie image.
        
    Returns:
        A dictionary containing:
        - "matchScore": number (0 to 100)
        - "matched": boolean
        - "confidence": string ("high" | "medium" | "low")
        - "analysis": string (detailed description of physical matching traits or discrepancy details)
        - "fraudDetected": boolean (true if holding printouts, digital screens, or signs of deepfakes/AI proxies are detected)
        - "fraudDetails": string (optional details if fraud is flagged)
    """
    try:
        # Load images into PIL
        state_id_img = Image.open(io.BytesIO(state_id_bytes))
        selfie_img = Image.open(io.BytesIO(selfie_bytes))
        
        prompt = """
        You are an expert biometric security system specializing in identity verification and anti-spoofing detection.
        Analyze these two images:
        1. Image 1 is a candidate's official government State ID or Passport.
        2. Image 2 is a live selfie webcam capture of the candidate.
        
        Perform a rigorous side-by-side biometric comparison. Compare critical facial structures:
        - Eye shape, spacing, and iris positions
        - Nose bridge, base length, and profile structure
        - Jawline contour, cheekbones, and chin shape
        - Ear alignment and mouth/lip structures
        
        Also perform Anti-Spoofing and Liveness Verification:
        - Check if Image 2 is a photo of another screen, a printed piece of paper, a mask, or shows signs of digital manipulation/deepfakes.
        
        Return a JSON object with these exact fields:
        - "matchScore": number (0 to 100, representing likeness/similarity)
        - "matched": boolean (true if score is 75 or higher, indicating a match)
        - "confidence": string ("high", "medium", or "low" depending on lighting, resolution, and features)
        - "analysis": string (a concise 2-3 sentence review of matching or contrasting biometric structures)
        - "fraudDetected": boolean (true if there are signs of proxy representation, printed photo presentation, secondary screens, or deepfakes)
        - "fraudDetails": string (empty if fraudDetected is false, otherwise explain what was detected)
        
        Only output the JSON object. Do not wrap in markdown delimiters.
        """
        
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content([prompt, state_id_img, selfie_img])
        
        text = response.text.strip().replace('```json', '').replace('```', '').strip()
        result = json.loads(text)
        return result
        
    except Exception as e:
        print(f"Biometric face verification error: {e}")
        # Fail-safe security fallback: do not verify
        return {
            "matchScore": 0,
            "matched": False,
            "confidence": "low",
            "analysis": f"Biometric face verification failed to execute due to a system error: {str(e)}",
            "fraudDetected": False,
            "fraudDetails": "Biometric face verification failed to run."
        }
