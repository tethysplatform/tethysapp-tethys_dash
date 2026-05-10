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
    async def go():
        async with Client(mcp) as c:
            return await c.list_tools()

    tools = _run(go())
    tool = next((t for t in tools if t.name == tool_name), None)
    assert tool is not None, (
        f"{tool_name!r} missing from tools/list — parity contract cannot be evaluated"
    )
    schema = getattr(tool, "inputSchema", None) or {}
    return set((schema.get("properties") or {}).keys())


# ---------------------------------------------------------------------------
# Per-prompt contracts
# ---------------------------------------------------------------------------

# Multi-arg prompts: name → tuple of surfaced arg names (R6: required-shaped
# routing args only, in declaration order).
MULTI_ARG_PROMPTS = {
    "render_plugin": ("source", "args"),
    "render_custom_visualization": ("source",),
}

# Hint description per arg name, drawn from the underlying tool's
# Field(description=...) with concrete-example values stripped per
# CLAUDE.md "MCP tool descriptions" rule. LOCKSTEP: when the tool's
# Field description changes, update both the @mcp.prompt arg description
# AND this dict.
PROMPT_HINTS = {
    "source": None,  # Two prompts share `source` with different hints; resolved per-prompt below
    "args": (
        "Plugin arguments as a JSON object. Use ${variable_name} "
        "to reference dashboard variable inputs (auto-refreshes "
        "when the variable changes)."
    ),
}

# Per-(prompt, arg) hint override since `source` carries different copy on
# the two render prompts (one points at list_intake_plugins, the other at
# list_available_visualizations).
PROMPT_ARG_HINTS = {
    ("render_plugin", "source"): (
        "Intake driver name from the 'source' field in "
        "list_intake_plugins results."
    ),
    ("render_plugin", "args"): PROMPT_HINTS["args"],
    ("render_custom_visualization", "source"): (
        "Client plugin source name from list_available_visualizations."
    ),
}

# Zero-arg prompts.
ZERO_ARG_PROMPTS = ("list_intake_plugins", "list_available_visualizations")

# Underlying tool per prompt — used by the parity test. Phase 3a names
# the prompts identically to the tools, so the mapping is identity.
PROMPT_TO_TOOL = {
    "list_intake_plugins": "list_intake_plugins",
    "list_available_visualizations": "list_available_visualizations",
    "render_plugin": "render_plugin",
    "render_custom_visualization": "render_custom_visualization",
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
    # Imperative declarative prose begins with the verb 'list'.
    assert "list" in text.lower(), (
        f"{prompt_name!r} prose should start with imperative 'list'; got: {text!r}"
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
    # Substitute the first arg with a real value.
    first = arg_names[0]
    real_values = {
        "source": "my_source",
        "args": '{"key": "value"}',
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
