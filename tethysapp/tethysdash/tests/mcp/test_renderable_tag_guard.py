"""Renderable-tag CI guard for the host MCP module.

Plan reference: docs/plans/2026-05-04-003-feat-mcp-rendering-contract-and-dispatch-feedback-plan.md
(Unit C1, decisions K10 + K16).

Any @mcp.tool-decorated function whose body returns a dict containing one of
the engine's renderable envelope keys (`visualization`, `layer_update`,
`patch_update`) MUST declare at least one tag from the renderable trigger set
{"visualization", "map", "layer"}. The chatbox-core engine and the host UI
banner depend on this tag-presence to decide what to dispatch and when to
warn the user that a renderable call landed nothing.

Implemented as static AST introspection (no FastMCP import, no server boot).
Runs in well under a second; sits in the existing fast pytest contract suite.
"""

import ast
import textwrap
from pathlib import Path

import pytest

RENDERABLE_ENVELOPE_KEYS = {"visualization", "layer_update", "patch_update"}
RENDERABLE_TRIGGER_TAGS = {"visualization", "map", "layer"}

MCP_MODULE_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "mcp"
    / "tethysdash_mcp_server.py"
)


# ---------------------------------------------------------------------------
# AST helpers — public so the tests can drive them with synthetic fixtures
# ---------------------------------------------------------------------------


def is_mcp_tool_decorator(decorator: ast.expr) -> bool:
    """True if a decorator is `@mcp.tool(...)`."""
    if not isinstance(decorator, ast.Call):
        return False
    func = decorator.func
    if isinstance(func, ast.Attribute):
        return (
            isinstance(func.value, ast.Name)
            and func.value.id == "mcp"
            and func.attr == "tool"
        )
    return False


def extract_tags_kwarg(decorator: ast.Call) -> list[str] | None:
    """Return the list of string tags from `tags=[...]`, or None if absent.

    Returns an empty list when `tags=[]` is explicit, since that is a
    materially different case from "no tags kwarg at all" — both fail the
    guard, but the assertion message differs.
    """
    for kw in decorator.keywords:
        if kw.arg == "tags":
            if isinstance(kw.value, ast.List):
                tags: list[str] = []
                for elt in kw.value.elts:
                    if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                        tags.append(elt.value)
                return tags
            return []
    return None


def returns_renderable_envelope(func: ast.FunctionDef) -> set[str]:
    """Return the set of renderable envelope keys this function returns at top level.

    Walks every `return` statement in the function body looking for a Dict
    literal whose top-level keys include one of the renderable envelope keys.
    Detection is intentionally conservative — it catches the convention used
    by tethysdash's renderable tools (return a dict literal whose first key
    is the envelope name) and ignores dynamically-built dicts. False
    negatives are acceptable; false positives would force unrelated tools
    to carry renderable tags.
    """
    found: set[str] = set()
    for node in ast.walk(func):
        if not isinstance(node, ast.Return) or node.value is None:
            continue
        if not isinstance(node.value, ast.Dict):
            continue
        for key in node.value.keys:
            if isinstance(key, ast.Constant) and isinstance(key.value, str):
                if key.value in RENDERABLE_ENVELOPE_KEYS:
                    found.add(key.value)
    return found


def collect_mcp_tool_functions(source: str) -> list[tuple[ast.FunctionDef, ast.Call]]:
    """Return [(function_def, mcp_tool_decorator), ...] from a Python source string."""
    tree = ast.parse(source)
    out: list[tuple[ast.FunctionDef, ast.Call]] = []
    for node in tree.body:
        if not isinstance(node, ast.FunctionDef):
            continue
        for dec in node.decorator_list:
            if is_mcp_tool_decorator(dec):
                out.append((node, dec))
                break
    return out


# ---------------------------------------------------------------------------
# Real-module guard — every renderable tool must carry a renderable tag
# ---------------------------------------------------------------------------


def _module_source() -> str:
    return MCP_MODULE_PATH.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def real_mcp_tools() -> list[tuple[ast.FunctionDef, ast.Call]]:
    return collect_mcp_tool_functions(_module_source())


def test_module_path_resolves():
    """Sanity check: the AST guard knows where the host MCP module lives."""
    assert MCP_MODULE_PATH.exists(), (
        f"Host MCP module not found at {MCP_MODULE_PATH}. "
        "Update MCP_MODULE_PATH if the file moved."
    )


def test_every_renderable_tool_declares_renderable_tag(real_mcp_tools):
    """For every @mcp.tool function returning a renderable envelope, assert
    its decorator's `tags` overlaps {"visualization", "map", "layer"}.

    This is the load-bearing CI guard. If a contributor adds a new render
    tool without the matching tag, this test fails with a message naming
    the function, the renderable keys it returns, and the missing tag set.
    """
    failures: list[str] = []

    for func, dec in real_mcp_tools:
        renderable_keys = returns_renderable_envelope(func)
        if not renderable_keys:
            continue

        tags = extract_tags_kwarg(dec)
        if tags is None:
            failures.append(
                f"  {func.name} (line {func.lineno}): returns "
                f"{sorted(renderable_keys)} but @mcp.tool has no `tags` kwarg. "
                f"Add at least one of {sorted(RENDERABLE_TRIGGER_TAGS)}."
            )
            continue

        if not (set(tags) & RENDERABLE_TRIGGER_TAGS):
            failures.append(
                f"  {func.name} (line {func.lineno}): returns "
                f"{sorted(renderable_keys)} but tags={tags!r} contains none of "
                f"{sorted(RENDERABLE_TRIGGER_TAGS)}."
            )

    assert not failures, (
        "Renderable-tag guard failed — the chatbox-core engine + host UI "
        "banner depend on at least one of {'visualization', 'map', 'layer'} "
        "appearing in the @mcp.tool tags of any tool that dispatches an "
        "envelope. Offending tools:\n" + "\n".join(failures)
    )


def test_known_renderable_tools_are_covered(real_mcp_tools):
    """Belt-and-suspenders: assert specific tools we expect the guard to find."""
    by_name = {func.name: dec for func, dec in real_mcp_tools}

    expected = {
        "create_plotly_chart": "visualization",
        "create_data_table": "visualization",
        "create_card": "visualization",
        "create_text": "visualization",
        "create_custom_image": "visualization",
        "create_map_visualization": "visualization",
        # Plan 2026-05-07-007 (T3): umbrella add_map_service_layer was
        # replaced with 11 per-source-type tools. Verify a representative
        # one carries the expected map/layer tags; all 11 follow the same
        # tag convention (["map", "layer", "<source-type-slug>"]).
        "add_wms_layer": "map",
        "add_geotiff_layer": "map",
        "add_geojson_layer": "map",
        "patch_visualization": "visualization",
        "render_custom_visualization": "visualization",
    }

    for tool_name, required_tag in expected.items():
        assert tool_name in by_name, f"Expected MCP tool {tool_name} is not registered"
        tags = extract_tags_kwarg(by_name[tool_name]) or []
        assert required_tag in tags, (
            f"{tool_name} must declare the {required_tag!r} tag; got {tags!r}"
        )


# ---------------------------------------------------------------------------
# Synthetic fixtures — confirm the guard catches the failure cases
# ---------------------------------------------------------------------------


def _run_guard(source: str) -> list[str]:
    """Re-implements the guard's failure logic against a synthetic source."""
    failures: list[str] = []
    for func, dec in collect_mcp_tool_functions(source):
        renderable_keys = returns_renderable_envelope(func)
        if not renderable_keys:
            continue
        tags = extract_tags_kwarg(dec)
        if tags is None:
            failures.append(f"{func.name}:no-tags-kwarg")
            continue
        if not (set(tags) & RENDERABLE_TRIGGER_TAGS):
            failures.append(f"{func.name}:tags={tags}")
    return failures


def test_synthetic_renderable_with_empty_tags_fails():
    """A @mcp.tool that returns {visualization: ...} with tags=[] must fail."""
    source = textwrap.dedent(
        """
        @mcp.tool(name="bad_tool", description="x", tags=[])
        def bad_tool():
            return {"visualization": {"source": "X", "uuid": "abc"}}
        """
    )
    failures = _run_guard(source)
    assert len(failures) == 1
    assert failures[0].startswith("bad_tool:tags=")


def test_synthetic_renderable_with_no_tags_kwarg_fails():
    """A @mcp.tool that returns {layer_update: ...} with no tags kwarg must fail."""
    source = textwrap.dedent(
        """
        @mcp.tool(name="bad_layer_tool", description="x")
        def bad_layer_tool():
            return {"layer_update": {"uuid": "abc", "layer": {}}}
        """
    )
    failures = _run_guard(source)
    assert failures == ["bad_layer_tool:no-tags-kwarg"]


def test_synthetic_renderable_with_off_topic_tags_fails():
    """`tags=["dashboard", "plugin"]` on a renderable tool must fail."""
    source = textwrap.dedent(
        """
        @mcp.tool(name="render_plugin_like", description="x", tags=["dashboard", "plugin"])
        def render_plugin_like():
            return {"visualization": {"source": "X", "uuid": "abc"}}
        """
    )
    failures = _run_guard(source)
    assert len(failures) == 1
    assert "tags=['dashboard', 'plugin']" in failures[0]


def test_synthetic_data_only_tool_passes():
    """A tool returning data shape (not a renderable envelope) is exempt."""
    source = textwrap.dedent(
        """
        @mcp.tool(name="list_things", description="x", tags=["discovery"])
        def list_things():
            return {"items": [], "count": 0}
        """
    )
    failures = _run_guard(source)
    assert failures == []


def test_synthetic_renderable_with_visualization_tag_passes():
    """`tags=["visualization"]` on a renderable tool satisfies the guard."""
    source = textwrap.dedent(
        """
        @mcp.tool(name="ok_tool", description="x", tags=["visualization", "chart"])
        def ok_tool():
            return {"visualization": {"source": "X", "uuid": "abc"}}
        """
    )
    failures = _run_guard(source)
    assert failures == []


def test_synthetic_layer_update_with_layer_tag_passes():
    """`tags=["map", "layer"]` on a layer_update tool satisfies the guard."""
    source = textwrap.dedent(
        """
        @mcp.tool(name="layer_tool", description="x", tags=["map", "layer"])
        def layer_tool():
            return {"layer_update": {"uuid": "abc"}}
        """
    )
    failures = _run_guard(source)
    assert failures == []
