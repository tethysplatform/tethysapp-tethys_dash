"""Recent-conversation context for the chat agents.

The frontend owns the conversation history (localStorage, per
dashboard) and sends the last few turns with each request. We inject
them as an ADVISORY dynamic instruction so follow-up prompts like
"add the forecast viewer for the same id" can resolve references
against earlier turns - without any server-side conversation state
and without replaying structured message objects across providers.
"""
from __future__ import annotations

MAX_TURNS = 6
MAX_CHARS_PER_TURN = 500


def sanitize_history(raw) -> list[dict]:
    """Validate the request-body history into [{role, text}, ...].

    Drops malformed entries, clamps roles to user/assistant, truncates
    long texts, keeps only the last MAX_TURNS. Never raises - history
    is a nice-to-have, not worth failing a request over.
    """
    if not isinstance(raw, list):
        return []
    clean = []
    for m in raw:
        if not isinstance(m, dict):
            continue
        role = m.get("role")
        text = m.get("text")
        if role not in ("user", "assistant") or not isinstance(text, str):
            continue
        text = text.strip()
        if not text:
            continue
        clean.append({"role": role, "text": text[:MAX_CHARS_PER_TURN]})
    return clean[-MAX_TURNS:]


def format_history_instruction(history: list[dict] | None) -> str:
    """Render the advisory instruction block, or '' when no history."""
    if not history:
        return ""
    lines = [
        ("User" if m["role"] == "user" else "Assistant") + ": " + m["text"]
        for m in history
    ]
    transcript = "\n".join(lines)
    return (
        "Recent conversation, for resolving references in the current "
        "message (like 'the same id', 'that river', 'it'). This is "
        "context only - the CURRENT message is the request to fulfill:\n"
        f"{transcript}"
    )
