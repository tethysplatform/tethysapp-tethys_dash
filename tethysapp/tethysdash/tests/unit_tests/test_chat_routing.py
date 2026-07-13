"""Deterministic embedding-based intent routing.

Cosine similarity is computed in pure Python; the only external call is
the embedding request, which is mocked so these tests are fast and
network-free. One integration-style test (marked, opt-in) can hit a
real Ollama if present.
"""
from unittest.mock import patch

import pytest

from tethysapp.tethysdash.chatbot import routing
from tethysapp.tethysdash.chatbot.routing import (
    CONFIDENCE_FLOOR,
    INTENT_ADD,
    INTENT_DOCS,
    INTENT_EXAMPLES,
    INTENT_LIST,
    INTENT_OOS,
    RoutingUnavailable,
    classify,
)


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture - no DB here."""
    yield


@pytest.fixture(autouse=True)
def _reset_cache():
    """Each test controls its own embedding stubs."""
    routing._example_vectors = None
    yield
    routing._example_vectors = None


def _fake_embedder():
    """Deterministic toy embedder: one dimension per intent, so an
    example/prompt tagged with an intent points fully along that axis.
    Lets us assert routing logic without a real model."""
    intents = list(INTENT_EXAMPLES)

    def embed(texts):
        out = []
        for t in texts:
            vec = [0.0] * len(intents)
            for i, intent in enumerate(intents):
                if t.startswith(f"[{intent}]"):
                    vec[i] = 1.0
            # unlabeled text -> uniform across axes so cosine vs any
            # one-hot example is 1/sqrt(n) (~0.5 for 4 intents), which
            # sits below CONFIDENCE_FLOOR. (A single-axis fallback would
            # score 1.0 - cosine ignores magnitude.)
            if sum(vec) == 0:
                vec = [1.0] * len(intents)
            out.append(vec)
        return out

    return embed


def test_classify_picks_the_matching_intent():
    labeled = {intent: [f"[{intent}] example"] for intent in INTENT_EXAMPLES}
    with patch.object(routing, "INTENT_EXAMPLES", labeled), \
         patch.object(routing, "_embed", _fake_embedder()):
        for intent in (INTENT_ADD, INTENT_DOCS, INTENT_LIST, INTENT_OOS):
            got, score = classify(f"[{intent}] please")
            assert got == intent
            assert score == pytest.approx(1.0)


def test_low_confidence_falls_back_to_out_of_scope():
    labeled = {intent: [f"[{intent}] example"] for intent in INTENT_EXAMPLES}
    with patch.object(routing, "INTENT_EXAMPLES", labeled), \
         patch.object(routing, "_embed", _fake_embedder()):
        # unlabeled prompt -> ~0.01 similarity, below the floor
        got, score = classify("completely unrelated gibberish")
    assert got == INTENT_OOS
    assert score < CONFIDENCE_FLOOR


def test_embedding_failure_raises_routing_unavailable():
    def boom(_texts):
        raise routing.RoutingUnavailable("no model")

    with patch.object(routing, "_embed", boom):
        with pytest.raises(RoutingUnavailable):
            classify("anything")


def test_example_vectors_computed_once():
    calls = {"n": 0}
    real = _fake_embedder()

    def counting(texts):
        calls["n"] += 1
        return real(texts)

    labeled = {intent: [f"[{intent}] ex"] for intent in INTENT_EXAMPLES}
    with patch.object(routing, "INTENT_EXAMPLES", labeled), \
         patch.object(routing, "_embed", counting):
        classify("[add_visualization] a")
        classify("[answer_docs_question] b")
    # 1 batch call for examples + 1 per prompt = 3, not 4 (examples cached)
    assert calls["n"] == 3


def _embeddings_available() -> bool:
    try:
        routing._embed(["ping"])
        return True
    except routing.RoutingUnavailable:
        return False


def test_real_embeddings_route_the_known_hard_cases():
    """Requires a running Ollama with the embed model pulled; skips
    automatically otherwise (e.g. in CI). Pins the prompts the SLM
    router historically mis-routed."""
    if not _embeddings_available():
        pytest.skip("embedding model not available")
    cases = {
        "how do I create a map with a wms layer?": INTENT_DOCS,
        "add the forecast plugin for river 610217883": INTENT_ADD,
        "what plugins are available?": INTENT_LIST,
        "how are you today?": INTENT_OOS,
    }
    for prompt, expected in cases.items():
        got, _ = classify(prompt)
        assert got == expected, f"{prompt!r} -> {got}, expected {expected}"
