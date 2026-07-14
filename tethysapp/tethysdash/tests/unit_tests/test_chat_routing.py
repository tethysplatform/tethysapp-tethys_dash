"""EmbeddingIntentClassifier — accept/reject/margin logic.

SentenceTransformer is mocked with a deterministic toy embedder so
these tests are fast and need neither torch nor a model download. One
live test hits the real classifier and self-skips when the model can't
be loaded (e.g. offline CI).
"""
import numpy as np
import pytest

from tethysapp.tethysdash.chatbot.agents import embedder as embedder_mod
from tethysapp.tethysdash.chatbot.agents.embedder import EmbeddingIntentClassifier


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture - no DB here."""
    yield


# Three toy intents on three axes. An example/query tagged "[i] ..."
# points fully along axis i; "[low] ..." points weakly; anything else is
# uniform (equal to every prototype -> ~zero margin).
_INTENTS = {
    "alpha": ["[0] one", "[0] two"],
    "beta": ["[1] one"],
    "gamma": ["[2] one"],
}


class _FakeST:
    def __init__(self, *_a, **_k):
        pass

    def encode(self, texts, normalize_embeddings=False, convert_to_numpy=False):
        rows = []
        for t in texts:
            v = np.zeros(3, dtype=np.float32)
            if t.startswith("[0]"):
                v[0] = 1.0
            elif t.startswith("[1]"):
                v[1] = 1.0
            elif t.startswith("[2]"):
                v[2] = 1.0
            elif t.startswith("[low]"):
                v[0] = 0.30  # aligned but small magnitude -> low score
            else:
                v[:] = 1.0 / np.sqrt(3)  # uniform -> equal to all prototypes
            rows.append(v)
        return np.vstack(rows)


@pytest.fixture
def classifier(monkeypatch):
    monkeypatch.setattr(embedder_mod, "SentenceTransformer", _FakeST)
    # Pin thresholds so this logic test is independent of production
    # tuning (the toy embedder's values are designed for 0.40 / 0.05).
    return EmbeddingIntentClassifier(
        _INTENTS, minimum_score=0.40, minimum_margin=0.05
    )


def test_requires_at_least_two_intents(monkeypatch):
    monkeypatch.setattr(embedder_mod, "SentenceTransformer", _FakeST)
    with pytest.raises(ValueError):
        EmbeddingIntentClassifier({"only": ["[0] x"]})


def test_rejects_empty_examples(monkeypatch):
    monkeypatch.setattr(embedder_mod, "SentenceTransformer", _FakeST)
    with pytest.raises(ValueError):
        EmbeddingIntentClassifier({"a": ["[0] x"], "b": []})


def test_confident_match_is_accepted(classifier):
    pred = classifier.classify("[0] please do the thing")
    assert pred.intent == "alpha"
    assert pred.accepted is True
    assert pred.score == pytest.approx(1.0)
    assert pred.margin >= classifier.minimum_margin


def test_empty_text_returns_none(classifier):
    pred = classifier.classify("   ")
    assert pred.intent is None
    assert pred.accepted is False


def test_low_margin_is_rejected(classifier):
    # uniform query is equidistant from every prototype -> margin ~0
    pred = classifier.classify("totally ambiguous")
    assert pred.intent is None
    assert pred.margin < classifier.minimum_margin


def test_low_score_is_rejected(classifier):
    # aligned with alpha but weak magnitude -> best score below the floor
    pred = classifier.classify("[low] weak signal")
    assert pred.intent is None
    assert pred.score < classifier.minimum_score


def test_live_classifier_routes_hard_cases():
    """Real model via bootstrap; skips if it can't be loaded (offline)."""
    from tethysapp.tethysdash.chatbot.agents.embedding_data import (
        INTENT_ADD,
        INTENT_DOCS,
    )

    try:
        from tethysapp.tethysdash.chatbot.bootstrap import get_classifier

        clf = get_classifier()
    except Exception as exc:  # noqa: BLE001 - model download/load may fail
        pytest.skip(f"embedding model unavailable: {exc}")

    assert clf.classify("how do I create a map with a wms layer?").intent == INTENT_DOCS
    assert clf.classify("add the rainfall plugin for gauge 55").intent == INTENT_ADD
