"""Regression guard for the create-vs-patch mutual-exclusion clause in
tool descriptions.

Debug session 2026-05-09: the LLM was emitting BOTH `create_plotly_chart`
AND `patch_visualization` for a single "add a line to viz X" request,
producing a duplicate ghost tile alongside the correctly-patched target.
The fix added an explicit exclusion clause to every `create_*` /
`render_*` tool's description telling the LLM to use
`patch_visualization` instead when the user names an existing
visualization UUID.

This test pins the wording so future edits to the descriptions can't
silently drop the rule. It does NOT prove the LLM actually obeys the
rule — that requires an LLM eval harness (deferred per memory). It
DOES catch the case where a developer rewords the description and
forgets to keep the exclusion language.

Tools that need the clause: every tool that creates a NEW dashboard
tile (a fresh visualization spec). Tools that scope to an EXISTING
parent (e.g., `add_wms_layer` taking a `map_uuid`) are inherently
patch-like and don't need the clause.
"""

import asyncio

import pytest
from fastmcp import Client

from tethysapp.tethysdash.mcp.tethysdash_mcp_server import mcp


# Every tool in this set creates a new tile from scratch. The exclusion
# clause is mandatory for each so the LLM can pick the right path
# (create vs patch_visualization) when both could plausibly apply.
TOOLS_REQUIRING_EXCLUSION_CLAUSE = (
    "create_plotly_chart",
    "create_data_table",
    "create_card",
    "create_text",
    "create_custom_image",
    "create_map_visualization",
    "create_variable_input",
    "render_plugin",
    "render_custom_visualization",
)


def _run(coro):
    return asyncio.get_event_loop_policy().new_event_loop().run_until_complete(coro)


def _tool_descriptions() -> dict[str, str]:
    """Fetch all registered tools (bypassing both middleware AND
    transforms) and return {name: description}.

    The server's `BM25SearchTransform` is registered as a *transform*
    (not middleware), so `mcp.list_tools(run_middleware=False)` still
    only returns the BM25 always-visible subset. To test the exclusion
    clause on every create_* / render_* tool — including the
    BM25-searchable ones the LLM reaches via `search_tools` — go
    directly to the underlying local provider.
    """
    async def go():
        return await mcp._local_provider.list_tools()

    tools = _run(go())
    return {t.name: (t.description or "") for t in tools}


@pytest.fixture(scope="module")
def descriptions() -> dict[str, str]:
    return _tool_descriptions()


@pytest.mark.parametrize("tool_name", TOOLS_REQUIRING_EXCLUSION_CLAUSE)
def test_create_render_tool_has_patch_exclusion_clause(
    descriptions: dict[str, str], tool_name: str
):
    """Every create_* / render_* tool description must point the LLM
    at `patch_visualization` for the modify-existing case.

    The exclusion clause must:
      1. Mention `patch_visualization` by name (the alternative tool).
      2. Use a NOT/NEVER/AVOID directive so the LLM weights it as a
         hard rule (vs. "consider patch instead" which reads as a soft
         suggestion).
      3. Reference either an existing UUID, dashboard_state, or
         "existing visualization/chart/tile" so the LLM knows when
         the rule applies.
    """
    desc = descriptions.get(tool_name)
    assert desc, f"tool {tool_name!r} not registered or has no description"
    lower = desc.lower()

    assert "patch_visualization" in desc, (
        f"{tool_name} description must name `patch_visualization` as the "
        f"alternative tool for modify-existing requests; got:\n{desc}"
    )
    has_directive = any(token in lower for token in ("do not", "never", "avoid"))
    assert has_directive, (
        f"{tool_name} description must contain a NOT/NEVER/AVOID directive "
        f"for the existing-UUID case so the LLM treats it as a hard rule; "
        f"got:\n{desc}"
    )
    has_when = any(
        token in lower for token in ("existing", "already", "dashboard_state", "uuid")
    )
    assert has_when, (
        f"{tool_name} description must reference WHEN the exclusion "
        f"applies (existing/already/dashboard_state/uuid); got:\n{desc}"
    )


def test_add_layer_tools_do_not_need_the_clause(descriptions: dict[str, str]):
    """Sanity: tools like `add_wms_layer` are inherently patch-scoped
    (they take a `map_uuid`). The exclusion clause does not apply to
    them — confirming the test surface above is correctly scoped.

    This test is just a comment-as-code: if a future change adds the
    exclusion clause to one of these tools by accident, that's a
    wording redundancy but not a correctness issue. We don't fail on
    it; we just document the design intent here.
    """
    add_layer_names = [n for n in descriptions if n.startswith("add_")]
    assert add_layer_names, "expected at least one add_* tool registered"
    # No assertion on description content — these tools have their own
    # contracts and we don't want to pin them to the same phrasing.
