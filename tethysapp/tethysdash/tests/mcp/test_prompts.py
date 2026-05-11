"""Contract tests for TethysDash @mcp.prompt slash-command templates (Phase 3a).

Uses the in-process ``Client(mcp)`` pattern from FastMCP. The shipped
server module ``tethysapp.tethysdash.mcp.tethysdash_mcp_server`` exposes
the FastMCP instance as ``mcp``; tests construct a Client against it
without standing up a real HTTP transport.

Phase 3a ships 4 prompts:
  - ``list_intake_plugins`` (zero-arg) — discovery
  - ``list_available_visualizations`` (zero-arg) — discovery
  - ``render_plugin`` (source, args) — render via intake driver
  - ``render_custom_visualization`` (source) — render via client plugin

Each multi-arg prompt carries the same five-test pattern as
nrds_mcps's ``plot_timeseries``; each zero-arg prompt carries the
three-test pattern (no ``no_args_raises_McpError`` since there are no
required args, and no ``synthesized_brackets`` since there are no
brackets).

A parametrized parity test asserts every prompt arg name exists on the
underlying tool's input schema. A single lockstep test asserts
``"list_intake_plugins"`` appears in ``render_plugin.source``'s
description so gross drift between prompt and tool surfaces fails CI.

Verified on FastMCP 3.2.x. The silently-ignore-extras and
``McpError(-32602)`` wire-shape behaviors are pinned by these tests;
re-check on FastMCP upgrade.
"""

import asyncio

import pytest
from fastmcp import Client
from mcp.shared.exceptions import McpError

from tethysapp.tethysdash.mcp.tethysdash_mcp_server import mcp


# ---------------------------------------------------------------------------
# Helpers (ported verbatim from mcp/nrds_mcps/test_mcp/test_prompts.py)
# ---------------------------------------------------------------------------


def _run(coro):
    """Run a coroutine to completion in a fresh event loop."""
    return asyncio.get_event_loop_policy().new_event_loop().run_until_complete(coro)


def _concat_text(messages) -> str:
    """Concatenate ``.text`` from text-typed message contents.

    Mirrors the chatbox-core insert handler's R7a behavior — only
    ``content.type == "text"`` participates; non-text content is
    silently dropped.
    """
    parts = []
    for m in messages:
        content = m.content
        ctype = getattr(content, "type", None)
        if ctype == "text":
            parts.append(getattr(content, "text", ""))
    return "".join(parts)


def _strip_fastmcp_schema_note(desc: str) -> str:
    """Strip FastMCP's auto-appended JSON-schema note from an arg description.

    FastMCP 3.2.x appends ``"\\n\\nProvide as a JSON string matching the
    following schema: {...}"`` to every ``Annotated[..., Field(...)]``
    prompt-arg description, regardless of arg type. The chatbox-core
    client strips this client-side; tests do the same so assertions can
    compare against the pristine hint string supplied via
    ``Field(description=...)``.
    """
    if not desc:
        return ""
    return desc.split("\n\nProvide as a JSON string")[0].strip()


def _list_prompts():
    async def go():
        async with Client(mcp) as c:
            return await c.list_prompts()

    return _run(go())


def _get_prompt(name, args):
    async def go():
        async with Client(mcp) as c:
            return await c.get_prompt(name, args)

    return _run(go())


def _tool_schema_properties(tool_name):
    """Read the underlying tool function's parameter names directly.

    Originally this routed through ``Client(mcp).list_tools()``, but the
    server's ``BM25SearchTransform`` filters tools/list to the
    always_visible set plus BM25-matched results. Several Phase 3b
    target tools (``create_card``, ``create_text``,
    ``create_custom_image``, ``register_runtime_plugin``) are
    intentionally NOT in always_visible — they're BM25-searchable, not
    pinned — so they don't appear in an unqueried list_tools call.

    For the parity contract, we want the canonical underlying-tool
    parameter set regardless of search visibility. The cleanest source
    is the Python function signature itself: ``@mcp.tool`` preserves
    the wrapped function as a module-level symbol with its original
    parameters.
    """
    import inspect
    from tethysapp.tethysdash.mcp import tethysdash_mcp_server as srv

    fn = getattr(srv, tool_name, None)
    assert fn is not None, (
        f"{tool_name!r} not found as a module-level symbol in "
        f"tethysdash_mcp_server.py — parity contract cannot be evaluated"
    )
    sig = inspect.signature(fn)
    return set(sig.parameters.keys())


# ---------------------------------------------------------------------------
# Per-prompt contracts
# ---------------------------------------------------------------------------

# Multi-arg prompts: name → tuple of surfaced arg names (R6: required-shaped
# routing args only, in declaration order).
MULTI_ARG_PROMPTS = {
    # Phase 3a
    "render_plugin": ("source", "args"),
    "render_custom_visualization": ("source",),
    # Phase 3b
    "create_plotly_chart": ("data",),
    "create_data_table": ("data",),
    "create_card": ("title",),
    "create_text": ("text",),
    "create_custom_image": ("image_url",),
    "create_variable_input": ("variable_name",),
    "register_runtime_plugin": ("url", "scope", "module", "label"),
    "patch_visualization": ("uuid", "source", "ops"),
}

# Per-(prompt, arg) hint copy. Drawn from each tool's
# Field(description=...) with concrete-example values stripped per
# CLAUDE.md "MCP tool descriptions" rule. LOCKSTEP: when the tool's
# Field description changes, update both the @mcp.prompt arg
# description AND this dict.
PROMPT_ARG_HINTS = {
    # Phase 3a
    ("render_plugin", "source"): (
        "Intake driver name from the 'source' field in "
        "list_intake_plugins results."
    ),
    ("render_plugin", "args"): (
        "Plugin arguments as a JSON object. Use ${variable_name} "
        "to reference dashboard variable inputs (auto-refreshes "
        "when the variable changes)."
    ),
    ("render_custom_visualization", "source"): (
        "Client plugin source name from list_available_visualizations."
    ),
    # Phase 3b
    ("create_plotly_chart", "data"): (
        "Array of Plotly trace objects (each with non-empty x and y "
        "arrays). At least one trace required."
    ),
    ("create_data_table", "data"): (
        "Array of row objects sharing the same keys. At least one row "
        "required."
    ),
    ("create_card", "title"): "Title shown at the top of the card.",
    ("create_text", "text"): (
        "Text content to display in the tile (non-empty)."
    ),
    ("create_custom_image", "image_url"): (
        "URL of the image to display (http/https URL, data URI, or "
        "S3 path)."
    ),
    ("create_variable_input", "variable_name"): (
        "Snake_case identifier other visualizations will reference "
        "via ${variable_name}. Preserve the user's exact name."
    ),
    ("register_runtime_plugin", "url"): (
        "Full URL to the plugin's remoteEntry.js manifest."
    ),
    ("register_runtime_plugin", "scope"): (
        "Module Federation scope name registered by the build."
    ),
    ("register_runtime_plugin", "module"): (
        "Exposed module path within the federation, "
        "starting with a relative-path prefix."
    ),
    ("register_runtime_plugin", "label"): (
        "Human-readable display name for the plugin in the "
        "visualization picker."
    ),
    ("patch_visualization", "uuid"): (
        "UUID of the target visualization tile (from dashboard_state)."
    ),
    ("patch_visualization", "source"): (
        "Registry source name of the target visualization "
        "(e.g., the source returned alongside the uuid)."
    ),
    ("patch_visualization", "ops"): (
        "Operations to apply to the visualization identified by "
        "uuid. RFC 6902-style array as JSON: each op is "
        "{op, path, value} with op in "
        "{add, replace, remove, move, test}. Tool accepts both "
        "array and JSON-string shapes."
    ),
}

# Zero-arg prompts.
ZERO_ARG_PROMPTS = (
    # Phase 3a
    "list_intake_plugins",
    "list_available_visualizations",
    # Phase 3b
    "create_map_visualization",
)

# Underlying tool per prompt — used by the parity test. All prompt
# names equal their tool names (slash command name matches the tool's
# @mcp.tool name=...); the mapping is identity.
PROMPT_TO_TOOL = {
    # Phase 3a
    "list_intake_plugins": "list_intake_plugins",
    "list_available_visualizations": "list_available_visualizations",
    "render_plugin": "render_plugin",
    "render_custom_visualization": "render_custom_visualization",
    # Phase 3b
    "create_plotly_chart": "create_plotly_chart",
    "create_data_table": "create_data_table",
    "create_card": "create_card",
    "create_text": "create_text",
    "create_custom_image": "create_custom_image",
    "create_map_visualization": "create_map_visualization",
    "create_variable_input": "create_variable_input",
    "register_runtime_plugin": "register_runtime_plugin",
    "patch_visualization": "patch_visualization",
}


def _synth_brackets(prompt_name, arg_names):
    """Synthesize chatbox-core-style ``{name: '[hint]'}`` for the prompt's args."""
    return {
        name: f"[{PROMPT_ARG_HINTS[(prompt_name, name)]}]"
        for name in arg_names
    }


# ---------------------------------------------------------------------------
# Zero-arg prompts (three-test pattern × 2)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("prompt_name", ZERO_ARG_PROMPTS)
def test_zero_arg_prompt_listed_with_no_arguments(prompt_name):
    """prompts/list includes the zero-arg prompt with an empty arguments list."""
    prompts = _list_prompts()
    by_name = {p.name: p for p in prompts}
    assert prompt_name in by_name, (
        f"{prompt_name!r} missing from prompts/list; got {sorted(by_name)}"
    )
    arg_names = {a.name for a in (by_name[prompt_name].arguments or [])}
    assert arg_names == set(), (
        f"{prompt_name!r} should have zero arguments; got {arg_names}"
    )


@pytest.mark.parametrize("prompt_name", ZERO_ARG_PROMPTS)
def test_zero_arg_prompt_get_with_no_args_succeeds(prompt_name):
    """Zero-arg prompts: ``prompts/get(name, {})`` returns rendered prose."""
    result = _get_prompt(prompt_name, {})
    text = _concat_text(result.messages)
    assert text, f"{prompt_name!r} rendered prose was empty"
    # Imperative declarative prose begins with a capital-letter verb
    # ("List", "Create", "Render", "Patch", "Register", "Lookup", etc.).
    # Don't pin a specific verb — different zero-arg prompts use
    # different verbs depending on their tool family.
    assert text.lstrip()[0].isupper(), (
        f"{prompt_name!r} prose should start with a capital letter "
        f"(imperative declarative shape); got: {text!r}"
    )


@pytest.mark.parametrize("prompt_name", ZERO_ARG_PROMPTS)
def test_zero_arg_prompt_get_with_spurious_args_silently_ignored(prompt_name):
    """FastMCP 3.2.x silently ignores extra kwargs on no-arg prompts.

    Pin that observed behavior so a future FastMCP upgrade tightening
    the contract surfaces as a test failure rather than a silent
    regression.
    """
    result = _get_prompt(prompt_name, {"unrelated_key": "leak-value"})
    text = _concat_text(result.messages)
    assert text, f"{prompt_name!r} rendered prose was empty with spurious args"
    # Spurious key value must NOT leak into the prose.
    assert "leak-value" not in text, (
        f"{prompt_name!r}: spurious arg value leaked into rendered prose; got: {text!r}"
    )


# ---------------------------------------------------------------------------
# Multi-arg prompts (five-test pattern × 2)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("prompt_name", list(MULTI_ARG_PROMPTS.keys()))
def test_multi_arg_prompt_listed_with_expected_args(prompt_name):
    """prompts/list includes the prompt with the expected argument names."""
    prompts = _list_prompts()
    by_name = {p.name: p for p in prompts}
    assert prompt_name in by_name, (
        f"{prompt_name!r} missing from prompts/list; got {sorted(by_name)}"
    )
    arg_names = {a.name for a in (by_name[prompt_name].arguments or [])}
    expected = set(MULTI_ARG_PROMPTS[prompt_name])
    assert arg_names == expected, (
        f"{prompt_name!r} args mismatch — expected {expected}, got {arg_names}"
    )


@pytest.mark.parametrize("prompt_name", list(MULTI_ARG_PROMPTS.keys()))
def test_multi_arg_prompt_all_required_with_hint_descriptions(prompt_name):
    """Every surfaced argument is required:true with a non-empty description
    that matches the canonical hint after stripping the FastMCP schema note.
    """
    prompts = _list_prompts()
    by_name = {p.name: p for p in prompts}
    prompt = by_name[prompt_name]
    by_arg = {a.name: a for a in (prompt.arguments or [])}
    for name in MULTI_ARG_PROMPTS[prompt_name]:
        arg = by_arg[name]
        assert arg.required is True, (
            f"{prompt_name}.{name!r} should be required=True; got {arg.required!r}"
        )
        cleaned = _strip_fastmcp_schema_note(arg.description or "")
        expected = PROMPT_ARG_HINTS[(prompt_name, name)]
        assert cleaned == expected, (
            f"{prompt_name}.{name!r} description mismatch — expected "
            f"{expected!r}, got {cleaned!r}"
        )


@pytest.mark.parametrize("prompt_name", list(MULTI_ARG_PROMPTS.keys()))
def test_multi_arg_prompt_get_with_no_args_raises(prompt_name):
    """``prompts/get(name, {})`` raises ``McpError(-32602)`` when args are required."""
    with pytest.raises(McpError) as exc_info:
        _get_prompt(prompt_name, {})
    msg = str(exc_info.value)
    assert "Missing required arguments" in msg or "required" in msg.lower(), (
        f"{prompt_name}: expected missing-required-arguments error; got: {msg!r}"
    )


@pytest.mark.parametrize("prompt_name", list(MULTI_ARG_PROMPTS.keys()))
def test_multi_arg_prompt_synthesized_brackets_render_all_hints(prompt_name):
    """chatbox-core-style ``{name: '[hint]'}`` substitution renders every bracket inline.

    Defense against the R9 / Phase 3a feasibility-review blocker: if any
    surfaced arg were typed non-``str`` (Dict / int), FastMCP would
    raise ``PromptError`` here instead of rendering. This test fires
    that path against the live prompt definitions.
    """
    arg_names = MULTI_ARG_PROMPTS[prompt_name]
    result = _get_prompt(prompt_name, _synth_brackets(prompt_name, arg_names))
    text = _concat_text(result.messages)
    for name in arg_names:
        bracketed = f"[{PROMPT_ARG_HINTS[(prompt_name, name)]}]"
        assert bracketed in text, (
            f"{prompt_name}: expected synthesized bracket {bracketed!r} for "
            f"arg {name!r} in rendered prompt; got: {text!r}"
        )


@pytest.mark.parametrize("prompt_name", list(MULTI_ARG_PROMPTS.keys()))
def test_multi_arg_prompt_substitutes_supplied_args_only(prompt_name):
    """Supplying a real value for one arg substitutes it while unsupplied
    brackets remain intact.
    """
    arg_names = MULTI_ARG_PROMPTS[prompt_name]
    args = _synth_brackets(prompt_name, arg_names)
    # Substitute the first arg with a real value. One entry per
    # distinct `first` arg across MULTI_ARG_PROMPTS; values are
    # plausible-looking strings (substring-presence assertion only —
    # shape correctness is not asserted here).
    first = arg_names[0]
    real_values = {
        # Phase 3a
        "source": "my_source",
        "args": '{"key": "value"}',
        # Phase 3b — covers create_plotly_chart + create_data_table
        # (both have `data` as first arg), create_card, create_text,
        # create_custom_image, create_variable_input,
        # register_runtime_plugin, patch_visualization.
        "data": '[{"x": [1, 2, 3], "y": [4, 5, 6]}]',
        "title": "Daily Active Users",
        "text": "Welcome to the dashboard.",
        "image_url": "https://example.com/image.png",
        "variable_name": "selected_gauge_id",
        "url": "https://plugins.example.com/remoteEntry.js",
        "uuid": "12345678-1234-5678-1234-567812345678",
    }
    args[first] = real_values[first]

    result = _get_prompt(prompt_name, args)
    text = _concat_text(result.messages)

    # Substituted value present.
    assert real_values[first] in text, (
        f"{prompt_name}: expected substituted value {real_values[first]!r} for "
        f"arg {first!r} in rendered prompt; got: {text!r}"
    )
    # The substituted hint is gone.
    substituted_hint = f"[{PROMPT_ARG_HINTS[(prompt_name, first)]}]"
    assert substituted_hint not in text, (
        f"{prompt_name}: hint {substituted_hint!r} for {first!r} should have "
        f"been substituted; got: {text!r}"
    )
    # Remaining hints survive.
    for name in arg_names[1:]:
        bracketed = f"[{PROMPT_ARG_HINTS[(prompt_name, name)]}]"
        assert bracketed in text, (
            f"{prompt_name}: expected unsubstituted hint {bracketed!r} for "
            f"{name!r} to remain; got: {text!r}"
        )


# ---------------------------------------------------------------------------
# Parametrized arg-name parity (prompts vs underlying tool schemas)
# ---------------------------------------------------------------------------


def _parametrize_per_prompt_arg_pairs():
    """Yield (prompt_name, arg_name) tuples for the multi-arg prompts so each
    pair gets its own test case — failures point at a precise drift, not a
    bulk mismatch.
    """
    for prompt_name, arg_names in MULTI_ARG_PROMPTS.items():
        for arg_name in arg_names:
            yield (prompt_name, arg_name)


@pytest.mark.parametrize(
    "prompt_name,arg_name", list(_parametrize_per_prompt_arg_pairs())
)
def test_multi_arg_prompt_arg_name_parity_with_underlying_tool(
    prompt_name, arg_name
):
    """Each prompt argument name exists on the underlying tool's input schema.

    Catches arg-name drift between prompt and tool — the #1 risk
    (per memory ``feedback_input_output_name_alignment``).
    """
    tool_name = PROMPT_TO_TOOL[prompt_name]
    tool_args = _tool_schema_properties(tool_name)
    assert arg_name in tool_args, (
        f"{prompt_name}.{arg_name!r} not found on tool {tool_name!r} "
        f"input schema; tool args: {tool_args}"
    )


# ---------------------------------------------------------------------------
# Lockstep test (R5) — single canonical assertion to catch gross drift
# ---------------------------------------------------------------------------


def test_render_plugin_source_arg_references_list_intake_plugins():
    """``render_plugin``'s ``source`` arg description names ``list_intake_plugins``.

    Pins the prompt-to-discovery-tool reference so any refactor that
    decouples the two surfaces fails CI here. Mirrors the lockstep
    contract documented in the Phase 3a plan R5.
    """
    prompts = _list_prompts()
    by_name = {p.name: p for p in prompts}
    prompt = by_name["render_plugin"]
    source_arg = next(a for a in prompt.arguments if a.name == "source")
    cleaned = _strip_fastmcp_schema_note(source_arg.description or "")
    assert "list_intake_plugins" in cleaned, (
        f"render_plugin.source description must reference 'list_intake_plugins' "
        f"so the prompt-to-discovery contract is visible; got: {cleaned!r}"
    )


@pytest.mark.parametrize("prompt_name", list(PROMPT_TO_TOOL.keys()))
def test_prompt_target_tool_is_visible_in_default_list_tools(prompt_name):
    """Every prompt's target tool must appear in the default list_tools() output.

    Caught 2026-05-10 after Phase 3b smoke: 4 prompts (`create_card`,
    `create_text`, `create_custom_image`, `register_runtime_plugin`)
    routed the LLM to tools that were NOT in the BM25 always_visible
    set, so the chatbox-core engine — which calls `list_tools()` at
    mount with no query — never received them. The LLM either silently
    mis-routed to the nearest visible tool (e.g., create_card →
    create_data_table) or refused outright ("function doesn't exist").

    Contract: for any prompt P that targets tool T, an unqueried
    `Client(mcp).list_tools()` MUST include T. Either pin T in
    `always_visible`, or accept that BM25 search is required (which
    chatbox-core does not do for the initial tool-discovery call).

    This is the gap that allowed the Phase 3b shipping bug; pinning
    this test prevents the regression class for any future prompt
    family (Phase 3c, etc.).
    """
    target_tool = PROMPT_TO_TOOL[prompt_name]

    async def go():
        async with Client(mcp) as c:
            return await c.list_tools()

    tools = _run(go())
    visible = {t.name for t in tools}
    assert target_tool in visible, (
        f"{prompt_name!r} routes the LLM to {target_tool!r}, but that "
        f"tool is not in the default list_tools() output. Add it to "
        f"`always_visible` in tethysdash_mcp_server.py's "
        f"BM25SearchTransform config, or this prompt will silently "
        f"misroute. Currently visible tools: {sorted(visible)}"
    )


def test_patch_visualization_ops_arg_references_uuid_arg():
    """``patch_visualization``'s ``ops`` arg description names ``uuid``.

    Pins the cross-arg reference: the operations apply to a SPECIFIC
    visualization identified by ``uuid``. Without this textual link, a
    future refactor could decouple the args (e.g., make ``ops`` look
    self-contained) and the LLM would lose the routing signal that
    operations are targeted at one tile. Phase 3b's R5 lockstep case.
    """
    prompts = _list_prompts()
    by_name = {p.name: p for p in prompts}
    prompt = by_name["patch_visualization"]
    ops_arg = next(a for a in prompt.arguments if a.name == "ops")
    cleaned = _strip_fastmcp_schema_note(ops_arg.description or "")
    assert "uuid" in cleaned, (
        f"patch_visualization.ops description must reference 'uuid' "
        f"so the prompt-to-target-arg contract is visible; got: {cleaned!r}"
    )
