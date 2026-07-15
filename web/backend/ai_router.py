"""
ai_router.py — Multi-provider, multi-key AI router with automatic fallback.

BYOK (Bring Your Own Key) architecture:
  - Each user stores an ordered wallet of API keys across providers.
  - When an AI call is made, the router tries keys in order (Active first).
  - On quota / rate-limit error  → key is marked 'Exhausted', next key tried.
  - On auth / invalid-key error  → key is marked 'Invalid', next key tried.
  - Exhausted keys self-heal: they are retried after EXHAUSTED_RETRY_HOURS.
  - If ALL user keys fail, the server's own NVIDIA_API_KEY is used as backstop.

Supported providers: Gemini, Groq, OpenAI, Anthropic, NVIDIA NIM
"""

import json
import logging
import os
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

logger = logging.getLogger(__name__)

# How long before we retry an exhausted key (daily limits reset)
EXHAUSTED_RETRY_HOURS = 24

# ── Provider endpoints & default models ───────────────────────────────────────

_ENDPOINTS: dict[str, str] = {
    "Groq":       "https://api.groq.com/openai/v1/chat/completions",
    "OpenAI":     "https://api.openai.com/v1/chat/completions",
    "NVIDIA NIM": "https://integrate.api.nvidia.com/v1/chat/completions",
    # Gemini and Anthropic use their own SDKs — handled separately
}

# Lightweight models (JSON extraction, scoring, search)
_MODELS_LIGHT: dict[str, str] = {
    "Gemini":     os.getenv("GEMINI_MODEL",  "gemini-2.0-flash"),
    "Groq":       os.getenv("GROQ_MODEL",    "llama3-8b-8192"),
    "OpenAI":     os.getenv("OPENAI_MODEL",  "gpt-4o-mini"),
    "Anthropic":  os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest"),
    "NVIDIA NIM": os.getenv("NVIDIA_MODEL",  "meta/llama-3.1-8b-instruct"),
}

# Heavy models (cover letters, interview questions, complex reasoning)
_MODELS_HEAVY: dict[str, str] = {
    "Gemini":     os.getenv("GEMINI_MODEL_HEAVY",     "gemini-2.0-flash"),
    "Groq":       os.getenv("GROQ_MODEL_HEAVY",       "llama-3.3-70b-versatile"),
    "OpenAI":     os.getenv("OPENAI_MODEL_HEAVY",     "gpt-4o"),
    "Anthropic":  os.getenv("ANTHROPIC_MODEL_HEAVY",  "claude-3-5-sonnet-latest"),
    "NVIDIA NIM": os.getenv("NVIDIA_MODEL_HEAVY",     "meta/llama-3.3-70b-instruct"),
}

# Errors that indicate quota / rate-limit (key is exhausted, not invalid)
_QUOTA_SIGNALS = [
    "429", "rate_limit", "quota", "resource_exhausted", "prepayment",
    "insufficient_quota", "daily limit", "tokens per day", "requests per day",
    "tpm", "rpd", "exceeded", "too many requests",
]

# Errors that indicate the key itself is bad (invalid, revoked, wrong provider)
_INVALID_SIGNALS = [
    "401", "403", "api_key_invalid", "invalid_api_key", "api key not valid",
    "authentication", "unauthenticated", "unauthorized", "permission",
    "api_key_service_blocked", "access denied",
]

# ── Key wallet type ────────────────────────────────────────────────────────────

class KeyEntry:
    """Represents one API key in a user's wallet."""
    def __init__(self, data: dict, vault_decrypt=None):
        self.id       = data.get("id", "")
        self.provider = data.get("provider", "")
        self.status   = data.get("status", "Active")      # Active | Standby | Exhausted | Invalid
        self.exhausted_at: Optional[str] = data.get("exhaustedAt")

        raw_key = data.get("key", "") or data.get("encryptedKey", "")
        # Fernet ciphertexts always start with "gAAAAA" — decrypt them
        if vault_decrypt and raw_key and raw_key.startswith("gAAAAA"):
            try:
                raw_key = vault_decrypt(raw_key) or raw_key
            except Exception:
                pass
        self.key = raw_key.strip()

    def is_usable(self) -> bool:
        if self.status == "Invalid":
            return False
        if self.status == "Exhausted":
            if not self.exhausted_at:
                return False
            try:
                exhausted = datetime.fromisoformat(self.exhausted_at)
                if datetime.now(timezone.utc) - exhausted < timedelta(hours=EXHAUSTED_RETRY_HOURS):
                    return False
                # Daily limit likely reset — allow retry
                logger.info("Key %s (%s) exhaustion window passed — retrying.", self.id, self.provider)
                self.status = "Standby"
                return True
            except ValueError:
                return False
        return bool(self.key)


# ── Per-provider call implementations ─────────────────────────────────────────

def _call_openai_compat(key: str, endpoint: str, model: str, prompt: str,
                         max_tokens: int, json_mode: bool) -> str:
    """Generic OpenAI-compatible call (Groq, OpenAI, NVIDIA NIM)."""
    import requests
    is_nvidia = "nvidia" in endpoint
    payload: dict[str, Any] = {
        "model":       model,
        "messages":    [{"role": "user", "content": prompt}],
        "temperature": 0.15,
        "max_tokens":  max_tokens,
    }
    if not is_nvidia:
        payload["top_p"] = 1
    # NVIDIA NIM doesn't support response_format on all models
    if json_mode and not is_nvidia:
        payload["response_format"] = {"type": "json_object"}
    resp = requests.post(
        endpoint,
        json=payload,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


def _call_gemini(key: str, model: str, prompt: str, max_tokens: int) -> str:
    from google import genai
    client = genai.Client(api_key=key)
    resp   = client.models.generate_content(
        model=model,
        contents=prompt,
        config={"max_output_tokens": max_tokens},
    )
    return resp.text.strip()


def _call_anthropic(key: str, model: str, prompt: str, max_tokens: int) -> str:
    import requests
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        json={
            "model":      model,
            "max_tokens": max_tokens,
            "messages":   [{"role": "user", "content": prompt}],
        },
        headers={
            "x-api-key":         key,
            "anthropic-version": "2023-06-01",
            "Content-Type":      "application/json",
        },
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["content"][0]["text"].strip()


def _dispatch(entry: KeyEntry, prompt: str, max_tokens: int, json_mode: bool, heavy: bool) -> str:
    """Call the correct provider API for one KeyEntry."""
    p = entry.provider
    # Frontend sends "Claude" but our model tables use "Anthropic"
    if p == "Claude":
        p = "Anthropic"
    model = (_MODELS_HEAVY if heavy else _MODELS_LIGHT).get(p, "")

    if p == "Gemini":
        return _call_gemini(entry.key, model, prompt, max_tokens)

    if p == "Anthropic":
        return _call_anthropic(entry.key, model, prompt, max_tokens)

    endpoint = _ENDPOINTS.get(p)
    if not endpoint:
        raise ValueError(f"Unknown provider: {p}")
    return _call_openai_compat(entry.key, endpoint, model, prompt, max_tokens, json_mode)


# ── Error classification ───────────────────────────────────────────────────────

def _classify_error(err: Exception) -> str:
    """Return 'quota', 'invalid', or 'error'."""
    msg = str(err).lower()
    if any(s in msg for s in _QUOTA_SIGNALS):
        return "quota"
    if any(s in msg for s in _INVALID_SIGNALS):
        return "invalid"
    return "error"


# ── Status update callback ─────────────────────────────────────────────────────

def _mark_key(entry: KeyEntry, new_status: str, on_status_change=None) -> None:
    entry.status = new_status
    if new_status == "Exhausted":
        entry.exhausted_at = datetime.now(timezone.utc).isoformat()
    logger.warning("Key %s (%s) marked %s.", entry.id, entry.provider, new_status)
    if on_status_change:
        try:
            on_status_change(entry)
        except Exception as e:
            logger.error("Status callback failed: %s", e)


# ── Public router ──────────────────────────────────────────────────────────────

def route(
    prompt: str,
    wallet: list[dict],
    *,
    max_tokens: int = 2048,
    json_mode: bool = False,
    heavy: bool = False,
    vault_decrypt=None,
    on_status_change=None,
) -> str:
    """
    Try each usable key in the wallet in order until one succeeds.

    Args:
        prompt:           The prompt to send.
        wallet:           List of raw key dicts from the user's Firestore wallet.
        max_tokens:       Max tokens in response.
        json_mode:        Request JSON-formatted response where supported.
        heavy:            Use the heavier/smarter model for complex tasks.
        vault_decrypt:    Optional function(ciphertext) → plaintext for encrypted keys.
        on_status_change: Optional callback(KeyEntry) called when a key status changes.

    Returns:
        The text content of the AI response.

    Raises:
        RuntimeError: If all keys are exhausted / invalid / failed.
    """
    entries = [KeyEntry(d, vault_decrypt) for d in wallet]

    if not entries:
        raise RuntimeError("no_user_keys")

    # Priority: Active → Standby (exhausted/invalid filtered by is_usable)
    ordered = sorted(
        [e for e in entries if e.is_usable()],
        key=lambda e: (0 if e.status == "Active" else 1),
    )

    if not ordered:
        # Keys exist but all are Invalid or Exhausted
        raise RuntimeError(
            "no_user_keys_invalid: Your saved API keys are expired or invalid. "
            "Please remove them in Profile → Settings and add a valid key."
        )

    last_err: Exception = RuntimeError("No keys available.")
    for entry in ordered:
        try:
            logger.info("Trying key %s (%s)…", entry.id, entry.provider)
            result = _dispatch(entry, prompt, max_tokens, json_mode, heavy)
            # Success — ensure key is marked Active if it was Standby
            if entry.status == "Standby":
                _mark_key(entry, "Active", on_status_change)
            return result

        except Exception as e:
            kind = _classify_error(e)
            if kind == "quota":
                _mark_key(entry, "Exhausted", on_status_change)
                logger.warning("Key %s quota exhausted, trying next.", entry.id)
            elif kind == "invalid":
                _mark_key(entry, "Invalid", on_status_change)
                logger.warning("Key %s is invalid, skipping.", entry.id)
            else:
                logger.warning("Key %s call failed (%s): %s", entry.id, entry.provider, e)
            last_err = e
            continue

    raise RuntimeError(
        f"All API keys exhausted or invalid. Last error: {last_err}. "
        "Please add a new key in Settings → API Keys Wallet."
    )


def route_json(
    prompt: str,
    wallet: list[dict],
    *,
    max_tokens: int = 2048,
    heavy: bool = False,
    vault_decrypt=None,
    on_status_change=None,
) -> Optional[Any]:
    """Like route() but parses the response as JSON. Returns None on parse failure."""
    try:
        text = route(
            prompt, wallet,
            max_tokens=max_tokens, json_mode=True, heavy=heavy,
            vault_decrypt=vault_decrypt, on_status_change=on_status_change,
        )
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE).strip()
        m    = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
        return json.loads(m.group(1) if m else text)
    except RuntimeError:
        raise
    except (json.JSONDecodeError, Exception) as e:
        logger.error("JSON parse error from AI response: %s", e)
        return None


# ── Server-level fallback (NVIDIA NIM) ────────────────────────────────────────

def server_fallback(prompt: str, *, max_tokens: int = 2048,
                    json_mode: bool = False, heavy: bool = False) -> str:
    """Use the server's own NVIDIA API key when the user has no usable keys."""
    import nvidia_utils
    if not nvidia_utils.is_available():
        raise RuntimeError(
            "No API keys available. Please add at least one API key in "
            "Settings → API Keys Wallet to use AI features."
        )
    model = nvidia_utils.MODEL_HEAVY if heavy else nvidia_utils.MODEL_LIGHT
    if json_mode:
        result = nvidia_utils.call_json(prompt, model=model, max_tokens=max_tokens)
        if result is None:
            raise RuntimeError("Server AI returned unparseable response.")
        return json.dumps(result)
    return nvidia_utils.call_text(prompt, model=model, max_tokens=max_tokens)
