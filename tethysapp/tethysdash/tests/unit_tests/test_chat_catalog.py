"""Tests for deterministic plugin resolution (chatbot/tools/catalog.py).

Covers the case the chatbot hits constantly: the user (or the model) names a
plugin by its display NAME or its SOURCE, exactly or with a typo/rewording, and
must resolve to the right plugin in code - or, when uncertain, offer candidates
rather than guess.
"""
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from tethysapp.tethysdash.chatbot.tools.catalog import (
    format_catalog_brief,
    format_catalog_for_llm,
    resolve_plugin,
)

_REGISTRY = "intake.source.registry"


def _viz(viz_type="plotly", label=None, args=("id",)):
    """A stub visualization plugin whose display label may differ from its source."""
    ns = SimpleNamespace(
        visualization_type=viz_type,
        visualization_args={a: "text" for a in args},
        visualization_description="d",
    )
    if label is not None:
        ns.visualization_label = label
    return ns


# The two NWMP plugins from the motivating example: display name carries "Time",
# the source does not.
_NWMP = {
    "nwmp_reaches_series": _viz(label="NWMP Reaches Time Series", args=("reach_id",)),
    "nwmp_gauges_series": _viz(label="NWMP Gauges Time Series", args=("gauge_id",)),
}


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture - the registry is mocked here."""
    yield


@pytest.mark.parametrize(
    "identifier,expected_source",
    [
        ("nwmp_reaches_series", "nwmp_reaches_series"),          # exact source
        ("NWMP Reaches Time Series", "nwmp_reaches_series"),     # exact name
        ("nwmp gauges series", "nwmp_gauges_series"),            # normalized (spaces)
        ("NWMP_Reaches_Series", "nwmp_reaches_series"),          # normalized (case/underscore)
        ("NWMP Gauges Time Serie", "nwmp_gauges_series"),        # typo in the name
        ("nwmp reaches time series", "nwmp_reaches_series"),     # normalized full name
    ],
)
def test_resolves_name_or_source_exact_or_fuzzy(identifier, expected_source):
    with patch(_REGISTRY, _NWMP):
        match = resolve_plugin(identifier)
    assert match.spec is not None, f"{identifier!r} should resolve"
    assert match.spec.source == expected_source


def test_ambiguous_query_returns_candidates_not_a_guess():
    registry = {
        "nwmp_reaches_v1": _viz(label="NWMP Reaches One"),
        "nwmp_reaches_v2": _viz(label="NWMP Reaches Two"),
    }
    with patch(_REGISTRY, registry):
        match = resolve_plugin("NWMP Reaches")
    assert match.spec is None
    sources = {c.source for c in match.candidates}
    assert sources == {"nwmp_reaches_v1", "nwmp_reaches_v2"}


def test_unrelated_query_returns_no_candidates():
    with patch(_REGISTRY, _NWMP):
        match = resolve_plugin("completely unrelated widget")
    assert match.spec is None
    assert match.candidates == ()


def test_empty_registry_resolves_nothing():
    with patch(_REGISTRY, {}):
        match = resolve_plugin("anything")
    assert match.spec is None and match.candidates == ()


def _viz_desc(label, args, description):
    """A stub plugin with an explicit description, for catalog-format tests."""
    return SimpleNamespace(
        visualization_type="plotly",
        visualization_args={a: "text" for a in args},
        visualization_description=description,
        visualization_label=label,
    )


def test_brief_catalog_omits_descriptions_but_full_keeps_them():
    registry = {
        "nwmp_reaches_series": _viz_desc(
            "NWMP Reaches Time Series", ("reach_id",), "SENTINEL_DESCRIPTION"
        )
    }
    with patch(_REGISTRY, registry):
        brief = format_catalog_brief()
        full = format_catalog_for_llm()
    # Brief carries name, source, and arg keys...
    assert "NWMP Reaches Time Series" in brief
    assert "nwmp_reaches_series" in brief
    assert "reach_id" in brief
    # ...but not the (potentially long) description.
    assert "SENTINEL_DESCRIPTION" not in brief
    assert brief.count("\n") == 0  # one plugin -> one line
    # The full catalog (used for the user-facing list) keeps descriptions.
    assert "SENTINEL_DESCRIPTION" in full


def test_brief_catalog_shows_none_for_argless_plugin():
    with patch(_REGISTRY, {"map_x": _viz_desc("Map X", (), "d")}):
        assert "args: none" in format_catalog_brief()


def test_brief_catalog_handles_empty_registry():
    with patch(_REGISTRY, {}):
        assert "No visualization plugins" in format_catalog_brief()
