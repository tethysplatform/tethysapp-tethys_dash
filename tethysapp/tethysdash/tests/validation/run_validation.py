#!/usr/bin/env python
"""R15 Pre-Ship Validation Harness — one-time local ritual.

Runs a curated prompt suite against the live chatbox stack (MCP server +
engine + LLM), compares each emitted tool-call envelope to a gold-standard,
and categorizes outcomes per failure class. Emits a markdown report the
implementer commits under ``docs/validation/`` before opening the ship PR.

**Scope (per plan Unit 8):**
    Canary gate, not a statistical-power benchmark. 1 run per prompt per
    model tier. CI integration + larger-N + automated failure-response
    routing are deferred Future Work.

**Ship gate:**
    zero silent-semantic-wrong observations
    zero unrecoverable structured-error observations
    recoverable structured-error rate <= 20%
    aggregate success >= 90%

Anything below → team conversation out-of-band (no automated routing).

**Prerequisites (documented; the harness does not start them):**
  - Django dev server running on :8000 (or env TETHYSDASH_BASE_URL set)
  - MCP server running on :9001 (launched by the chatbox stack)
  - Ollama running locally with a tool-use-native model pulled, e.g.:
        ollama pull qwen2.5:7b && ollama serve
  - Env var ANTHROPIC_API_KEY or OPENAI_API_KEY for the frontier tier
  - Python 3.11+ with anthropic/openai SDKs installed

**Usage:**
    python -m tethysapp.tethysdash.tests.validation.run_validation \\
        --tier frontier
    python -m tethysapp.tethysdash.tests.validation.run_validation \\
        --tier ollama --ollama-model qwen2.5:7b

    # Run both in sequence + commit a single combined report:
    python -m tethysapp.tethysdash.tests.validation.run_validation \\
        --tier frontier --tier ollama

The script exits non-zero if ANY per-class threshold is missed so the
implementer's shell won't mistake red for green. Zero silent-semantic-wrong
and zero unrecoverable errors are the hard gates; a handful of recoverable
errors and occasional correct retries are acceptable.

**Integration with CI:** none this iteration. A future iteration may add
a GitHub Actions job that runs the Ollama tier on a self-hosted runner,
but that requires infra + budget decisions out of scope here.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.stderr.write(
        "Missing dependency: PyYAML. Install via `pip install pyyaml` and retry.\n"
    )
    sys.exit(2)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class PromptFixture:
    """A preset dashboard state the harness seeds before a prompt runs."""

    name: str
    description: str
    grid_items: List[Dict[str, Any]]


@dataclass
class PromptCase:
    """A single prompt + its gold envelope."""

    id: str
    fixture: str
    user_prompt: str
    expected_tool: Optional[str]
    expected_args: Dict[str, Any]
    expected_outcome: str  # correct | recoverable_expected | disambiguation
    notes: str = ""


@dataclass
class PromptResult:
    """Outcome of running one prompt through the stack."""

    case: PromptCase
    tool_calls: List[Dict[str, Any]]
    final_text: str
    error: Optional[str]
    duration_s: float
    classification: str  # correct | recoverable | unrecoverable | silent-semantic-wrong | n/a
    rule_violation: Optional[str] = None
    notes: str = ""


@dataclass
class TierResult:
    """Aggregated outcome for one LLM tier."""

    tier: str
    model: str
    results: List[PromptResult] = field(default_factory=list)

    @property
    def silent_semantic_wrong(self) -> int:
        return sum(
            1 for r in self.results if r.classification == "silent-semantic-wrong"
        )

    @property
    def recoverable(self) -> int:
        return sum(1 for r in self.results if r.classification == "recoverable")

    @property
    def unrecoverable(self) -> int:
        return sum(1 for r in self.results if r.classification == "unrecoverable")

    @property
    def correct(self) -> int:
        return sum(1 for r in self.results if r.classification == "correct")

    @property
    def aggregate_success_pct(self) -> float:
        n = len(self.results)
        if n == 0:
            return 0.0
        return (self.correct + self.recoverable) * 100.0 / n

    @property
    def recoverable_pct(self) -> float:
        n = len(self.results)
        if n == 0:
            return 0.0
        return self.recoverable * 100.0 / n


# ---------------------------------------------------------------------------
# Prompt loader
# ---------------------------------------------------------------------------


def load_prompts(path: Path) -> tuple[List[PromptCase], Dict[str, PromptFixture]]:
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f)

    cases = []
    for p in data.get("prompts", []):
        cases.append(
            PromptCase(
                id=p["id"],
                fixture=p.get("fixture", "empty"),
                user_prompt=p["user_prompt"],
                expected_tool=p.get("expected_tool"),
                expected_args=p.get("expected_args", {}),
                expected_outcome=p.get("expected_outcome", "correct"),
                notes=p.get("notes", ""),
            ),
        )

    fixtures = {}
    for name, f in (data.get("fixtures") or {}).items():
        fixtures[name] = PromptFixture(
            name=name,
            description=f.get("description", ""),
            grid_items=f.get("gridItems", []),
        )
    return cases, fixtures


# ---------------------------------------------------------------------------
# LLM invocation shims
#
# The harness assumes a live MCP server and LLM provider. Details of the
# provider API (Anthropic vs OpenAI vs Ollama) live behind a small shim
# so the scoring logic stays provider-independent. Implementers fill in
# their team's preferred provider library here before running; the shape
# returned from each shim is just a list of tool-call dicts matching what
# chatbox-core's engine emits.
# ---------------------------------------------------------------------------


def invoke_stack_frontier(
    prompt: str, fixture: PromptFixture, model: str
) -> tuple[List[Dict[str, Any]], str]:
    """Invoke the chatbox stack with a frontier LLM (Anthropic/OpenAI).

    Implementer fills this in by wiring the team's chatbox runChatSession
    invocation (Python port or HTTP bridge) + their preferred LLM SDK.
    Returns (tool_calls, final_assistant_text).

    For the initial ritual, the implementer may run the harness manually
    per prompt via the browser UI and transcribe outcomes, rather than
    wiring a full programmatic stack. See the README alongside this file.
    """
    raise NotImplementedError(
        "Implementer: wire your Anthropic/OpenAI frontier-tier invocation here. "
        "See docstring for the expected return shape."
    )


def invoke_stack_ollama(
    prompt: str,
    fixture: PromptFixture,
    model: str,
    host: str = "http://localhost:11434",
    api_key: str = "",
) -> tuple[List[Dict[str, Any]], str]:
    """Invoke the chatbox stack with an Ollama LLM (local or Cloud).

    Works with both hosting modes via `host` + `api_key`:

      Local Ollama (default):
          host = "http://localhost:11434"
          api_key = ""   # local Ollama does not require auth

      Ollama Cloud / Turbo:
          host = "https://ollama.com"        # or the team's cloud endpoint
          api_key = "<OLLAMA_API_KEY>"       # sent as Authorization: Bearer <key>

    The implementer wires the actual invocation — options are (a) the
    `ollama` Python client (reads OLLAMA_HOST + OLLAMA_API_KEY env vars), or
    (b) direct HTTP to the OpenAI-compatible endpoint at <host>/v1 with the
    team's preferred SDK. Either way, the return shape is a list of
    tool-call dicts matching the engine's output (see invoke_stack_frontier
    docstring).
    """
    raise NotImplementedError(
        "Implementer: wire your Ollama invocation here. "
        f"host={host!r}, api_key={'<set>' if api_key else '<unset>'}. "
        "See docstring for the expected return shape and hosting modes."
    )


# ---------------------------------------------------------------------------
# Grader
# ---------------------------------------------------------------------------


def _match_args(expected: Any, actual: Any) -> tuple[bool, str]:
    """Return (ok, reason). Tilde-prefixed expected values match any value."""
    if isinstance(expected, str) and expected.startswith("~"):
        return True, ""
    if isinstance(expected, dict) and isinstance(actual, dict):
        for k, v in expected.items():
            if k not in actual:
                return False, f"missing arg {k!r}"
            ok, reason = _match_args(v, actual[k])
            if not ok:
                return False, f"arg {k!r}: {reason}"
        return True, ""
    if isinstance(expected, list) and isinstance(actual, list):
        if len(expected) > len(actual):
            return False, f"expected >={len(expected)} items, got {len(actual)}"
        for i, ev in enumerate(expected):
            ok, reason = _match_args(ev, actual[i])
            if not ok:
                return False, f"item[{i}]: {reason}"
        return True, ""
    if expected == actual:
        return True, ""
    return False, f"expected {expected!r}, got {actual!r}"


def grade(case: PromptCase, tool_calls: List[Dict[str, Any]]) -> PromptResult:
    """Compare the LLM's emitted tool calls to the gold envelope.

    Classifications:
      correct                : tool + args match (or disambiguation path passes)
      recoverable            : initial call returned a structured error AND a
                               retry succeeded within the same turn
      unrecoverable          : structured error with no successful retry
      silent-semantic-wrong  : tool + args are STRUCTURALLY valid but wrong
                               target (different UUID, wrong destructive op, etc.)
    """
    if not tool_calls:
        return PromptResult(
            case=case,
            tool_calls=[],
            final_text="",
            error="no tool calls emitted",
            duration_s=0.0,
            classification="unrecoverable",
            rule_violation="no_tool_call",
        )

    # Look at the final/settled tool call for the purposes of classification.
    # Retries within a turn are detected by counting error-tagged intermediate
    # calls; for this canary suite we scan for any `error` field in results.
    errored_calls = [tc for tc in tool_calls if tc.get("_result", {}).get("error")]
    final_call = tool_calls[-1]
    final_result = final_call.get("_result", {})
    succeeded = "error" not in final_result

    if not case.expected_tool:
        # `disambiguation` and some adversarial cases don't pin a specific tool
        if case.expected_outcome == "recoverable_expected":
            return PromptResult(
                case=case,
                tool_calls=tool_calls,
                final_text="",
                error=None,
                duration_s=0.0,
                classification="recoverable" if errored_calls else "correct",
            )
        return PromptResult(
            case=case,
            tool_calls=tool_calls,
            final_text="",
            error=None,
            duration_s=0.0,
            classification="correct" if succeeded else "unrecoverable",
        )

    if final_call.get("name") != case.expected_tool:
        return PromptResult(
            case=case,
            tool_calls=tool_calls,
            final_text="",
            error=None,
            duration_s=0.0,
            classification="silent-semantic-wrong",
            rule_violation="wrong_tool",
        )

    ok, reason = _match_args(case.expected_args, final_call.get("arguments", {}))
    if not ok:
        classification = "silent-semantic-wrong" if succeeded else "unrecoverable"
        return PromptResult(
            case=case,
            tool_calls=tool_calls,
            final_text="",
            error=reason,
            duration_s=0.0,
            classification=classification,
            rule_violation="args_mismatch",
        )

    if errored_calls and succeeded:
        return PromptResult(
            case=case,
            tool_calls=tool_calls,
            final_text="",
            error=None,
            duration_s=0.0,
            classification="recoverable",
        )
    if not succeeded:
        return PromptResult(
            case=case,
            tool_calls=tool_calls,
            final_text="",
            error=final_result.get("error"),
            duration_s=0.0,
            classification="unrecoverable",
        )
    return PromptResult(
        case=case,
        tool_calls=tool_calls,
        final_text="",
        error=None,
        duration_s=0.0,
        classification="correct",
    )


# ---------------------------------------------------------------------------
# Report writer
# ---------------------------------------------------------------------------


def write_report(
    tier_results: List[TierResult],
    git_sha: str,
    report_path: Path,
) -> None:
    lines = []
    lines.append(
        f"# R15 Pre-Ship Validation Report — "
        f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
    )
    lines.append("")
    lines.append(f"**Commit:** `{git_sha}`  ")
    lines.append(f"**Suite:** `tethysapp/tethysdash/tests/validation/prompts.yaml`")
    lines.append("")

    for tr in tier_results:
        lines.append(f"## Tier: `{tr.tier}` (model: `{tr.model}`)")
        lines.append("")
        lines.append(
            f"- Total prompts: **{len(tr.results)}**  "
            f"\n- Correct: **{tr.correct}**  "
            f"\n- Recoverable: **{tr.recoverable}** "
            f"({tr.recoverable_pct:.1f}%)  "
            f"\n- Unrecoverable: **{tr.unrecoverable}**  "
            f"\n- Silent-semantic-wrong: **{tr.silent_semantic_wrong}**  "
            f"\n- Aggregate success: **{tr.aggregate_success_pct:.1f}%**"
        )
        lines.append("")

        # Ship-gate verdict per tier
        gates_passed = (
            tr.silent_semantic_wrong == 0
            and tr.unrecoverable == 0
            and tr.recoverable_pct <= 20.0
            and tr.aggregate_success_pct >= 90.0
        )
        lines.append(f"**Gate:** {'✅ PASS' if gates_passed else '❌ FAIL'}")
        lines.append("")

        # Per-prompt outcomes
        lines.append("| ID | Outcome | Rule | Notes |")
        lines.append("|---|---|---|---|")
        for r in tr.results:
            lines.append(
                f"| `{r.case.id}` | {r.classification} "
                f"| {r.rule_violation or ''} | {r.error or ''} |"
            )
        lines.append("")

        # Per-rule attribution summary
        rule_counts: Dict[str, int] = {}
        for r in tr.results:
            if r.rule_violation:
                rule_counts[r.rule_violation] = (
                    rule_counts.get(r.rule_violation, 0) + 1
                )
        if rule_counts:
            lines.append("### Rule-violation distribution")
            lines.append("")
            for rule, count in sorted(
                rule_counts.items(), key=lambda x: -x[1]
            ):
                dominant = (
                    " — **DOMINANT (>40% of failures)**"
                    if count * 100 / max(1, len(tr.results)) > 40
                    else ""
                )
                lines.append(f"- `{rule}`: {count}{dominant}")
            lines.append("")

    # Overall decision
    all_pass = all(
        tr.silent_semantic_wrong == 0
        and tr.unrecoverable == 0
        and tr.recoverable_pct <= 20.0
        and tr.aggregate_success_pct >= 90.0
        for tr in tier_results
    )
    lines.append("---")
    lines.append("")
    lines.append(
        f"## Overall: {'✅ SHIP' if all_pass else '❌ STOP — re-enter brainstorming'}"
    )
    lines.append("")
    if not all_pass:
        lines.append(
            "If any per-class threshold missed on any tier, the team returns to "
            "brainstorming out-of-band to decide: "
            "(a) add prompt-engineering scaffolding in the tool descriptions, "
            "(b) declare the protocol frontier-only and degrade Ollama tier to "
            "the current create-duplicate behavior, or (c) downscope to per-viz "
            "semantic update tools. This harness does NOT automate that choice."
        )
        lines.append("")

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote report to {report_path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _git_sha() -> str:
    try:
        import subprocess

        out = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], text=True
        ).strip()
        return out
    except Exception:
        return "unknown"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--tier",
        action="append",
        choices=["frontier", "ollama"],
        required=True,
        help="Which tier(s) to run. Pass multiple times to run both.",
    )
    parser.add_argument(
        "--frontier-model",
        default="claude-3-5-sonnet-latest",
        help="Frontier model identifier (default: claude-3-5-sonnet-latest).",
    )
    parser.add_argument(
        "--ollama-model",
        default="qwen2.5:7b",
        help="Ollama model identifier (default: qwen2.5:7b).",
    )
    parser.add_argument(
        "--ollama-host",
        default=os.environ.get("OLLAMA_HOST", "http://localhost:11434"),
        help=(
            "Ollama host URL. Defaults to local Ollama at "
            "http://localhost:11434. For Ollama Cloud, pass "
            "--ollama-host=https://ollama.com "
            "(or set OLLAMA_HOST env var). Requires OLLAMA_API_KEY."
        ),
    )
    parser.add_argument(
        "--ollama-api-key",
        default=os.environ.get("OLLAMA_API_KEY", ""),
        help=(
            "Ollama Cloud API key (Bearer token). Only required when "
            "--ollama-host points at a hosted Ollama endpoint. Reads "
            "OLLAMA_API_KEY env var by default."
        ),
    )
    parser.add_argument(
        "--prompts",
        default=str(Path(__file__).parent / "prompts.yaml"),
        help="Path to the prompt suite YAML file.",
    )
    parser.add_argument(
        "--report-dir",
        default="docs/validation",
        help="Directory to write the report into (relative to repo root).",
    )
    args = parser.parse_args()

    cases, fixtures = load_prompts(Path(args.prompts))
    print(f"Loaded {len(cases)} prompts, {len(fixtures)} fixtures.")

    git_sha = _git_sha()
    tier_results: List[TierResult] = []

    for tier in args.tier:
        model = args.frontier_model if tier == "frontier" else args.ollama_model
        print(f"\n=== Running tier: {tier} ({model}) ===")
        tr = TierResult(tier=tier, model=model)
        for case in cases:
            fixture = fixtures.get(case.fixture) or PromptFixture(
                name=case.fixture, description="", grid_items=[]
            )
            print(f"  [{case.id}] ... ", end="", flush=True)
            t0 = time.time()
            try:
                if tier == "frontier":
                    tool_calls, final_text = invoke_stack_frontier(
                        case.user_prompt, fixture, model
                    )
                else:
                    tool_calls, final_text = invoke_stack_ollama(
                        case.user_prompt,
                        fixture,
                        model,
                        host=args.ollama_host,
                        api_key=args.ollama_api_key,
                    )
                result = grade(case, tool_calls)
                result.final_text = final_text
                result.duration_s = time.time() - t0
            except NotImplementedError as e:
                # Prerequisite missing — the implementer needs to wire
                # the stack. Record as unrecoverable so the gate fails and
                # the implementer knows the harness isn't fully running.
                result = PromptResult(
                    case=case,
                    tool_calls=[],
                    final_text="",
                    error=str(e),
                    duration_s=time.time() - t0,
                    classification="unrecoverable",
                    rule_violation="harness_not_wired",
                )
            except Exception as e:  # pragma: no cover
                result = PromptResult(
                    case=case,
                    tool_calls=[],
                    final_text="",
                    error=f"{type(e).__name__}: {e}",
                    duration_s=time.time() - t0,
                    classification="unrecoverable",
                    rule_violation="exception",
                )
            tr.results.append(result)
            print(result.classification)
        tier_results.append(tr)

    # Emit report
    repo_root = Path(__file__).resolve().parents[4]
    report_path = (
        repo_root / args.report_dir / f"R15-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}-{git_sha}.md"
    )
    write_report(tier_results, git_sha, report_path)

    # Exit non-zero if any gate missed so shells don't mistake red for green.
    all_pass = all(
        tr.silent_semantic_wrong == 0
        and tr.unrecoverable == 0
        and tr.recoverable_pct <= 20.0
        and tr.aggregate_success_pct >= 90.0
        for tr in tier_results
    )
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
