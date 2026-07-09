"""Per-chat pending-proposal store for approval-gated chat tools.

Some chat tools (currently only ``add_map_with_layer``) stage their
side effects instead of committing immediately, and require an explicit
user confirmation on the following turn to commit. This module owns
that pending state.

Backing store: Django's ``django.core.cache``. In dev with the default
LocMemCache backend the state lives in-process (fine for a single
Daphne worker). Point the ``CACHES`` setting at Redis for multi-worker
production without touching this file.

TTL: 5 minutes. If the user drops the conversation and comes back
later, they'll get a fresh proposal rather than an accidental commit
of stale intent.
"""
from __future__ import annotations

from typing import Any

from django.core.cache import cache

_KEY_PREFIX = "tethysdash:chat:pending:"
_TTL_SECONDS = 300

# Bare tokens that count as an approval. Kept small on purpose - anything
# less clear-cut should fall through to the LLM router, which can either
# generate a new proposal or an out-of-scope reply.
_CONFIRMATION_TOKENS = frozenset({
    "yes", "y", "ok", "okay", "confirm", "confirmed",
    "do it", "go", "proceed", "sure", "yeah", "yep",
})


def _key(chat_id: str) -> str:
    return f"{_KEY_PREFIX}{chat_id}"


def store_pending(chat_id: str, proposal: dict[str, Any]) -> None:
    """Stash a proposal keyed by chat_id. No-op on empty chat_id."""
    if not chat_id:
        return
    cache.set(_key(chat_id), proposal, _TTL_SECONDS)


def pop_pending(chat_id: str) -> dict[str, Any] | None:
    """Fetch and delete the pending proposal for this chat_id, if any."""
    if not chat_id:
        return None
    key = _key(chat_id)
    proposal = cache.get(key)
    if proposal is not None:
        cache.delete(key)
    return proposal


def is_confirmation(prompt: str) -> bool:
    """True when ``prompt`` is a bare approval like 'yes' or 'confirm'.

    Deliberately narrow - a compound reply like 'yes but change the
    center to Cali' returns False so the router treats it as an amend
    request, not a rubber-stamp.
    """
    if not prompt:
        return False
    normalized = prompt.strip().lower().rstrip(".!?")
    if len(normalized) > 15:
        return False
    return normalized in _CONFIRMATION_TOKENS
