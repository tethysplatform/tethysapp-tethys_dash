"""Deterministic intent routing via text embeddings.

Small local models are unreliable at *selecting* which capability a
request needs (the "decision authority" problem): they conflate
"how do I create a map?" (a docs question) with "add a map" (a command).
This module takes routing away from the LLM entirely.

``classify(prompt)`` embeds the prompt and compares it, by cosine
similarity, to a curated set of example phrases per intent. The nearest
intent wins. Routing is then deterministic, provider-independent (it
never touches the answer-generating model), observable (scores are
returned), and unit-testable without an LLM in the loop.

The LLM still runs downstream in the *specialist* agents, where it does
what it's good at: interpretation and execution within the chosen
capability (extracting a river_id, answering from doc excerpts).

Requires an embedding model on the Ollama host (default
``nomic-embed-text``; ``ollama pull nomic-embed-text``). If embeddings
are unavailable, ``classify`` raises ``RoutingUnavailable`` and the
controller surfaces an actionable message.
"""
from __future__ import annotations

import math
import os
import threading

import httpx

from .config import LLM_HOST

EMBED_MODEL = os.getenv("TETHYSDASH_CHAT_EMBED_MODEL", "nomic-embed-text")
# Floor below which even the best match is treated as out-of-scope.
CONFIDENCE_FLOOR = float(os.getenv("TETHYSDASH_CHAT_ROUTE_FLOOR", "0.55"))

INTENT_ADD = "add_visualization"
INTENT_DOCS = "answer_docs_question"
INTENT_LIST = "list_available_plugins"
INTENT_OOS = "out_of_scope"

# Curated example phrases per intent. Add examples here to fix a
# misroute - it's the explicit, greppable "training set". Keep the
# add/docs boundary sharp: commands with concrete targets vs HOW/WHAT
# questions.
INTENT_EXAMPLES: dict[str, list[str]] = {
    INTENT_ADD: [
        "add the geoglows_forecast_viewer plugin for river_id 610217883",
        "add a forecast chart for river 12345",
        "create a bias corrected visualization for river 999 station 002",
        "place the retrospective plugin on the dashboard",
        "put an observed discharge tile for station 0026247020",
        "add the same plugin for the other river",
        "add a table showing the forecast",
    ],
    INTENT_DOCS: [
        "how do I create a variable input?",
        "how do I create a map with a wms layer?",
        "what is a variable input?",
        "how does bias correction work?",
        "can I share a dashboard with other users?",
        "how do I add a map layer?",
        "explain how plugins work",
        "where do I set the dashboard permissions?",
        "how do I install and set up the app?",
        "how do I get started?",
    ],
    INTENT_LIST: [
        "what plugins are available?",
        "list the available visualizations",
        "what can I add to my dashboard?",
        "show me the plugin catalog",
        "which plugins are installed?",
        "what visualizations do you support?",
    ],
    INTENT_OOS: [
        "how are you?",
        "what's the weather today?",
        "tell me a joke",
        "who won the game last night?",
        "thanks, that's all",
        "what time is it?",
    ],
}


class RoutingUnavailable(Exception):
    """The embedding model needed for routing could not be reached."""


# Example vectors are static; compute once, guard with a lock so
# concurrent first-requests don't each rebuild the cache.
_example_vectors: dict[str, list[list[float]]] | None = None
_lock = threading.Lock()


def _embed(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts via the Ollama OpenAI-compatible endpoint."""
    try:
        resp = httpx.post(
            f"{LLM_HOST.rstrip('/')}/v1/embeddings",
            json={"model": EMBED_MODEL, "input": texts},
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()["data"]
    except Exception as exc:  # noqa: BLE001 - surfaced as actionable message
        raise RoutingUnavailable(
            f"The routing embedding model ({EMBED_MODEL!r}) is unavailable: "
            f"{exc}. On the Ollama host run: ollama pull {EMBED_MODEL}"
        ) from exc
    return [row["embedding"] for row in data]


def _ensure_examples() -> dict[str, list[list[float]]]:
    global _example_vectors
    if _example_vectors is None:
        with _lock:
            if _example_vectors is None:
                flat = [ex for exs in INTENT_EXAMPLES.values() for ex in exs]
                vecs = _embed(flat)
                out: dict[str, list[list[float]]] = {}
                i = 0
                for intent, exs in INTENT_EXAMPLES.items():
                    out[intent] = vecs[i : i + len(exs)]
                    i += len(exs)
                _example_vectors = out
    return _example_vectors


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def classify(prompt: str) -> tuple[str, float]:
    """Return (intent, score) for a prompt.

    ``intent`` is one of the INTENT_* constants. ``score`` is the best
    per-intent max cosine similarity. Below CONFIDENCE_FLOOR the result
    is coerced to out-of-scope.
    """
    examples = _ensure_examples()
    (query,) = _embed([prompt.strip()])

    best_intent, best_score = INTENT_OOS, -1.0
    for intent, vecs in examples.items():
        score = max(_cosine(query, v) for v in vecs)
        if score > best_score:
            best_intent, best_score = intent, score

    if best_score < CONFIDENCE_FLOOR:
        return INTENT_OOS, best_score
    return best_intent, best_score
