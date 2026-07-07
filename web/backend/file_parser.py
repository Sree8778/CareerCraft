"""
file_parser.py — Resume ingestion pipeline.

Priority:
  1. Rule-based parser (custom_parser.py) — always runs, zero API dependency.
  2. AI enhancement via ai_router (BYOK) — optional, only runs when the user
     has added their own API keys. No shared server key is used.
     If no user keys are available or the AI call fails, rule-based result is returned.
"""

from custom_parser import parse_resume_text, extract_text


def _try_ai_enhance(raw_text: str) -> dict | None:
    """
    Run AI enhancement using the user's own keys (BYOK).
    Prefers the direct Gemini SDK path (gemini_utils) — the original proven method.
    Falls back to the multi-provider router (ollama_utils) for non-Gemini keys.
    Returns None if the user has no active keys.
    """
    try:
        import ollama_utils
        import gemini_utils

        from ai_router import KeyEntry
        from vault_utils import decrypt_key as _vault_decrypt

        wallet = ollama_utils.get_request_wallet()
        if not wallet:
            return None  # No user keys — skip AI, rule-based result stands

        # Prefer Gemini key via direct SDK (old method)
        for entry_dict in wallet:
            if entry_dict.get('provider') == 'Gemini':
                entry = KeyEntry(entry_dict, vault_decrypt=_vault_decrypt)
                if entry.is_usable():
                    gemini_utils.set_api_key(entry.key)
                    result = gemini_utils.structure_text_with_ai(raw_text)
                    return result if isinstance(result, dict) and result else None

        # No Gemini key — fall back to multi-provider router
        result = ollama_utils.structure_text_with_ai(raw_text)
        return result if isinstance(result, dict) and result else None

    except Exception as e:
        print(f"[file_parser] AI enhancement skipped: {e}")
        return None


def parse_resume_file(file_storage) -> dict:
    """
    Main entry point called by routes.py.
    Returns {"parsedData": {...}} on success, {"error": "..."} on failure.
    """
    filename = file_storage.filename or "resume"

    try:
        raw_bytes = file_storage.read()
        if not raw_bytes:
            return {"error": "Uploaded file is empty."}

        # Step 1: extract text
        try:
            raw_text = extract_text(raw_bytes, filename)
        except Exception as e:
            return {"error": f"Could not extract text from file: {e}"}

        if not raw_text.strip():
            return {"error": "No readable text found in the document."}

        # Step 2: rule-based parse — always succeeds
        structured = parse_resume_text(raw_text)

        # Step 3: optional AI enhancement (fills fields the rules missed)
        ai_result = _try_ai_enhance(raw_text)
        ai_enhanced = False
        if ai_result:
            structured = _merge(structured, ai_result)
            ai_enhanced = True

        return {
            "parsedData": structured,
            "aiEnhanced": ai_enhanced,
            "aiSkippedReason": None if ai_enhanced else "no_api_keys",
        }

    except Exception as e:
        print(f"[file_parser] Unexpected error: {e}")
        return {"error": f"Resume parsing failed: {e}"}


def _merge(base: dict, ai: dict) -> dict:
    """
    Merge rule-based and AI results.
    Rule-based wins when it found something; AI fills only blank fields.
    """
    result = dict(base)

    # Personal: fill any blank field from AI
    base_p = base.get("personal", {})
    ai_p   = ai.get("personal", {})
    result["personal"] = {
        k: (base_p.get(k) or ai_p.get(k) or "")
        for k in set(base_p) | set(ai_p)
    }

    # Summary: AI is better at capturing implicit summaries (no section header).
    # Prefer AI when it found something; fall back to rule-based if AI is blank.
    result["summary"] = ai.get("summary") or base.get("summary") or ""

    # Lists: prefer base if populated, fall back to AI
    for key in ("experience", "education", "skills", "projects", "certifications", "publications"):
        base_list = base.get(key, [])
        ai_list   = ai.get(key, [])
        result[key] = base_list if base_list else ai_list

    return result
