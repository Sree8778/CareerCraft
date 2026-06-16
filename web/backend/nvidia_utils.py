"""
nvidia_utils.py — NVIDIA NIM AI client (OpenAI-compatible API).

Environment variables:
  NVIDIA_API_KEY        — required; your NVIDIA NIM key
  NVIDIA_MODEL          — lightweight model   (default: meta/llama-3.1-8b-instruct)
  NVIDIA_MODEL_HEAVY    — heavy/complex tasks (default: meta/llama-3.3-70b-instruct)

All public functions raise RuntimeError on unrecoverable failure so the
caller can surface a clean error message to the frontend.
"""

import os
import json
import re
import time
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────

_BASE_URL   = "https://integrate.api.nvidia.com/v1/chat/completions"
MODEL_LIGHT = os.getenv("NVIDIA_MODEL",       "meta/llama-3.1-8b-instruct")
MODEL_HEAVY = os.getenv("NVIDIA_MODEL_HEAVY", "meta/llama-3.3-70b-instruct")

_override_key: Optional[str] = None   # set per-request by configure_dynamic_api_key


def set_api_key(key: str) -> None:
    """Override the API key for the current request."""
    global _override_key
    _override_key = key.strip() if key else None


def _resolve_key() -> str:
    key = _override_key or os.getenv("NVIDIA_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "NVIDIA NIM API key is not configured. "
            "Set NVIDIA_API_KEY in your environment or provide it via the request header."
        )
    return key


# ── Low-level HTTP call ────────────────────────────────────────────────────────

def _call(
    prompt: str,
    *,
    model: Optional[str] = None,
    max_tokens: int = 2048,
    temperature: float = 0.15,
    json_mode: bool = False,
    retries: int = 3,
) -> str:
    """
    Make a single chat completion call to NVIDIA NIM.
    Returns the raw text content of the first choice.
    Retries on rate-limit (429) with exponential backoff.
    """
    import requests  # runtime import — avoids startup cost if module unused

    key   = _resolve_key()
    model = model or MODEL_LIGHT

    payload: dict[str, Any] = {
        "model":       model,
        "messages":    [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens":  max_tokens,
        "top_p":       1,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type":  "application/json",
    }

    last_err: Exception = RuntimeError("Unknown error")
    for attempt in range(retries):
        try:
            resp = requests.post(_BASE_URL, json=payload, headers=headers, timeout=60)

            if resp.status_code == 429:
                wait = 2 ** attempt
                logger.warning("NVIDIA NIM rate-limited; retrying in %ds (attempt %d/%d)", wait, attempt + 1, retries)
                time.sleep(wait)
                continue

            if resp.status_code in (401, 403):
                raise RuntimeError(
                    "NVIDIA NIM authentication failed. "
                    "Check that your NVIDIA_API_KEY is valid."
                )

            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()

        except requests.exceptions.Timeout:
            last_err = RuntimeError("NVIDIA NIM request timed out (60 s).")
            if attempt < retries - 1:
                time.sleep(1)
                continue
        except RuntimeError:
            raise
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"NVIDIA NIM network error: {e}") from e

    raise last_err


# ── JSON helper ────────────────────────────────────────────────────────────────

def _strip_fences(text: str) -> str:
    text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
    return text.strip()


def call_json(
    prompt: str,
    *,
    model: Optional[str] = None,
    max_tokens: int = 2048,
) -> Optional[Any]:
    """
    Call NVIDIA NIM with json_mode and return the parsed object.
    Returns None on parse failure (caller should use fallback).
    """
    try:
        raw  = _call(prompt, model=model, max_tokens=max_tokens, json_mode=True)
        text = _strip_fences(raw)
        # Extract first {...} or [...] block in case model added prose
        m    = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
        return json.loads(m.group(1) if m else text)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("NVIDIA NIM JSON parse error: %s", e)
        return None


def call_text(
    prompt: str,
    *,
    model: Optional[str] = None,
    max_tokens: int = 1024,
) -> str:
    """Call NVIDIA NIM and return plain text response."""
    return _call(prompt, model=model, max_tokens=max_tokens, json_mode=False)


# ── Availability check ─────────────────────────────────────────────────────────

def is_available() -> bool:
    """Return True when a valid NVIDIA API key is configured."""
    try:
        _resolve_key()
        return True
    except RuntimeError:
        return False
