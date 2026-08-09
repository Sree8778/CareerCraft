"""Server-side helper for the interview identity-verification step.

This is an AI-assisted visual comparison, not a replacement for a certified
identity-verification provider. It deliberately fails closed: callers never
receive a successful verification when an image, API key, or provider request
cannot be validated.
"""

import io
import json
import os
import re
from typing import Any

from PIL import Image, UnidentifiedImageError


MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_CONFIDENCE = {"high", "medium", "low"}


def _load_image(image_bytes: bytes, label: str) -> Image.Image:
    """Validate and decode a supplied JPEG or PNG without retaining its source."""
    if not image_bytes:
        raise ValueError(f"{label} image is empty")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError(f"{label} image must be 10 MB or smaller")

    try:
        with Image.open(io.BytesIO(image_bytes)) as probe:
            if probe.format not in {"JPEG", "PNG"}:
                raise ValueError(f"{label} must be a JPEG or PNG image")
            probe.verify()

        with Image.open(io.BytesIO(image_bytes)) as image:
            image.load()
            return image.convert("RGB")
    except (UnidentifiedImageError, OSError) as error:
        raise ValueError(f"{label} is not a valid image") from error


def _get_gemini_key() -> str:
    """Return the user's active Gemini key without exposing it in a response."""
    from ollama_utils import get_request_wallet
    from vault_utils import decrypt_key

    for entry in get_request_wallet():
        provider = str(entry.get("provider", "")).strip().lower()
        status = str(entry.get("status", "Active")).strip().lower()
        if provider != "gemini" or status not in {"active", "standby"}:
            continue

        key = str(entry.get("key") or entry.get("encryptedKey") or "").strip()
        if key.startswith("gAAAAA"):
            key = decrypt_key(key) or ""
        if key:
            return key

    return os.getenv("GEMINI_API_KEY", "").strip()


def _parse_model_json(text: str) -> dict[str, Any]:
    """Extract one JSON object from a model response and normalise its shape."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE)
    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError as error:
        raise RuntimeError("The identity-verification provider returned an invalid response") from error

    if not isinstance(result, dict):
        raise RuntimeError("The identity-verification provider returned an invalid response")

    try:
        score = max(0, min(100, round(float(result.get("matchScore", 0)))))
    except (TypeError, ValueError):
        score = 0

    confidence = str(result.get("confidence", "low")).lower()
    if confidence not in ALLOWED_CONFIDENCE:
        confidence = "low"

    fraud_detected = result.get("fraudDetected") is True
    return {
        "matchScore": score,
        "matched": result.get("matched") is True and score >= 75 and not fraud_detected,
        "confidence": confidence,
        "analysis": str(result.get("analysis", "Visual comparison completed.")).strip()[:1000],
        "fraudDetected": fraud_detected,
        "fraudDetails": str(result.get("fraudDetails", "")).strip()[:500],
    }


def verify_face_similarity(state_id_bytes: bytes, selfie_bytes: bytes) -> dict[str, Any]:
    """Perform an AI-assisted visual comparison of an ID photo and live selfie.

    Raises ``ValueError`` for invalid uploads and ``RuntimeError`` when a
    configured provider cannot complete the request. The route converts those
    into explicit client errors, keeping the verification step fail-closed.
    """
    state_id_img = _load_image(state_id_bytes, "ID")
    selfie_img = _load_image(selfie_bytes, "Selfie")
    api_key = _get_gemini_key()
    if not api_key:
        raise RuntimeError("NO_API_KEYS: Add an active Gemini API key in Profile → Settings to verify your identity.")

    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        prompt = """
You compare a government-issued ID portrait (image 1) with a live selfie
(image 2). Assess only whether the visible faces appear to be the same person
and whether the selfie appears to be a photo of a screen, printed photo, mask,
or otherwise manipulated image. Do not infer any protected trait.

Return a JSON object only with exactly these fields:
matchScore (number 0-100), matched (boolean, true only when score is at least
75), confidence (high, medium, or low), analysis (concise explanation),
fraudDetected (boolean), and fraudDetails (empty string when false).
"""
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL_HEAVY", "gemini-flash-latest"),
            contents=[prompt, state_id_img, selfie_img],
            config={"response_mime_type": "application/json", "temperature": 0},
        )
        return _parse_model_json(response.text or "")
    except RuntimeError:
        raise
    except Exception as error:
        print(f"Identity verification provider error: {type(error).__name__}")
        raise RuntimeError("Identity verification is temporarily unavailable. Please try again later.") from error
