"""Regression tests for the deterministic docs-QA retrieval layer.

Pure-Python scoring over docs/source — no LLM, no DB (the conftest DB
fixture is overridden with a no-op below).
"""
import pytest

from tethysapp.tethysdash.chatbot.tools.docs import (
    DOCS_BASE_URL,
    DOCS_ROOT,
    doc_url,
    retrieve_context,
    score_docs,
)


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture — these tests need no database."""
    yield


def test_docs_root_exists_and_has_rst():
    assert DOCS_ROOT.is_dir(), f"docs dir moved? {DOCS_ROOT}"
    assert list(DOCS_ROOT.rglob("*.rst")), "no .rst files under docs/source"


def test_scorer_ranks_relevant_files():
    """Pin the scorer's behavior on questions with obvious homes.
    Top-3 (not top-1) — several docs legitimately discuss each topic;
    retrieve_context includes the top 3, so top-3 membership is what
    actually matters for answer quality."""
    cases = {
        "how do I install tethysdash?": "installation.rst",
        "how do I create a variable input?": "variable_inputs.rst",
        "how do I write a custom plugin?": "plugins.rst",
    }
    for question, expected in cases.items():
        top3 = [p.name for p, _ in score_docs(question)[:3]]
        assert expected in top3, f"{question!r}: {expected} not in {top3}"


def test_retrieve_context_caps_size_and_shares_budget():
    context, sources = retrieve_context(
        "how do I create a variable input?", max_chars=12_000
    )
    assert len(context) <= 12_500  # cap + separators/truncation marker slack
    assert len(sources) >= 2, "fair-slice budget should fit multiple files"
    assert context.count("=== source:") == len(sources)


def test_sources_carry_readthedocs_urls():
    _, sources = retrieve_context("how do I create a variable input?")
    for s in sources:
        assert s["url"].startswith(DOCS_BASE_URL)
        assert s["url"].endswith(".html")
        assert s["title"]
    # nested paths keep their subdirectory in the URL
    nested = next(DOCS_ROOT.glob("tutorials/*.rst"))
    assert f"/tutorials/{nested.stem}.html" in doc_url(nested)


def test_retrieve_context_empty_on_gibberish():
    context, sources = retrieve_context("zzqx flurble wombat")
    assert context == ""
    assert sources == ()


def test_plural_folding_matches_singular_question():
    # 'input' (question) must match 'inputs' (filename/headings)
    top3 = [p.name for p, _ in score_docs("variable input")[:3]]
    assert "variable_inputs.rst" in top3
