# R15 Pre-Ship Validation — One-Time Local Ritual

This directory holds the canary suite the implementer runs on their local
machine before opening the ship PR for the generic update-visualization
protocol. Outputs a committed markdown report under `docs/validation/`.

**This is explicitly NOT CI-gated.** A future iteration may turn this
harness into a CI workflow (with scheduled runs, infra for server +
Ollama lifecycle, frontier-API budget management, and automated
failure-response routing). That work is deferred per the plan's "Future
Work" section.

## Files

- `prompts.yaml` — 18 curated prompts with gold-envelope expectations.
  Covers SC #1–#8 user-facing flows, the three R15-mandated adversarial
  flows, and additional per-viz/op-family coverage.
- `run_validation.py` — single-file harness. Loads prompts, invokes the
  chatbox stack per tier (frontier + Ollama), grades via gold-envelope
  comparison, writes a markdown report, exits non-zero on any gate miss.
- `README.md` — this file.

## Ship-gate thresholds (per tier)

- **Silent-semantic-wrong: zero.** Structurally-valid patch against the
  wrong target or with the wrong value. This is the trust-destroying
  failure class — zero tolerance on the canary suite.
- **Unrecoverable error: zero.** LLM emits a bad patch and cannot recover.
- **Recoverable error rate: ≤ 20%.** LLM gets a structured error and
  retries successfully within the same turn. Acceptable signal, not a
  red flag.
- **Aggregate success: ≥ 90%.** (silent-semantic-correct + recoverable-and-recovered).

At N ≈ 18, the ≤ 2% silent-semantic-wrong threshold from the origin doc
is statistically indistinguishable from zero — treat this as a zero-
tolerance canary. A larger-N statistical-power suite is Future Work.

## Prerequisites

The harness does NOT start the server stack — it assumes the pieces are
already running. Before invoking:

```bash
# Django dev server (serves the MCP endpoint wiring)
tethys manage start -p 8000 &

# Chatbox MCP server on port 9001 (spawned by the chatbox engine on first request;
# verify it's reachable at http://localhost:9001/).

# Frontier tier — set one of these:
export ANTHROPIC_API_KEY="sk-..."
# or
export OPENAI_API_KEY="sk-..."

# Ollama tier — two hosting modes:

# (A) LOCAL Ollama (first run, one-time):
ollama pull qwen2.5:7b              # ~5 GB download, ~5 minutes
ollama serve &                      # keeps the daemon up on :11434
ollama run qwen2.5:7b "hi" > /dev/null   # warm the model

# (B) OLLAMA CLOUD / Turbo (zero local GPU needed, pay-per-use):
export OLLAMA_HOST="https://ollama.com"     # or your cloud endpoint
export OLLAMA_API_KEY="..."                 # Bearer token from ollama.com/settings
# OR pass at invocation time:
#   --ollama-host https://ollama.com --ollama-api-key "$OLLAMA_API_KEY"
# Model names on cloud mirror the local names (e.g. qwen2.5:7b,
# gpt-oss:20b). Check ollama.com for the current catalog.
```

### Ollama Cloud quick reference

| Setting | Value |
|---|---|
| **Host URL** | `https://ollama.com` (or the team's deployed cloud endpoint) |
| **Auth** | `Authorization: Bearer <OLLAMA_API_KEY>` header |
| **Env vars** | `OLLAMA_HOST`, `OLLAMA_API_KEY` (the official `ollama` Python client reads both automatically) |
| **CLI args** | `--ollama-host`, `--ollama-api-key` (overrides env vars) |
| **Model naming** | Same as local (`qwen2.5:7b`, `gpt-oss:20b`, etc.) |
| **OpenAI-compat endpoint** | `<host>/v1` — use if you prefer the openai Python SDK |

Invocation with Ollama Cloud:

```bash
export OLLAMA_HOST="https://ollama.com"
export OLLAMA_API_KEY="sk-ollama-..."
python -m tethysapp.tethysdash.tests.validation.run_validation \
    --tier ollama --ollama-model qwen2.5:7b
```

## Invocation

Run one tier at a time (or both in sequence for a combined report):

```bash
# From tethysapp-tethys_dash/ repo root, venv-test env activated:
python -m tethysapp.tethysdash.tests.validation.run_validation --tier frontier
python -m tethysapp.tethysdash.tests.validation.run_validation --tier ollama
python -m tethysapp.tethysdash.tests.validation.run_validation \
    --tier frontier --tier ollama       # single combined report
```

Expected wall time:

- Frontier (~15 prompts × 5s/turn): ≈ 2 min
- Ollama 7B (~15 prompts × 30s/turn): ≈ 10 min
- API cost on frontier: $1–$3 depending on model + prompt length

Report lands at `docs/validation/R15-<YYYY-MM-DD>-<git-sha>.md`. Commit
that file in the ship PR.

## Wiring the stack

`invoke_stack_frontier` and `invoke_stack_ollama` are stubs with
`NotImplementedError`. The implementer fills these in by wiring the
team's preferred chatbox invocation path (Python port of runChatSession,
HTTP bridge to the JS engine, or direct LLM SDK call with manual MCP
proxying). The return shape is a list of tool-call dicts matching what
the JS engine emits:

```python
[
    {
        "name": "patch_visualization",
        "arguments": {"target_uuid": "...", "source": "Map", "patches": [...]},
        "_result": {"patch_update": {"uuid": "...", "ops": [...]}},
    },
    ...
]
```

If wiring the full programmatic path is too much lift for the initial
ritual, the alternative is a **manual-run** procedure: the implementer
steps through each prompt by hand in the browser against a seeded
dashboard, records the emitted tool-call JSON (visible in the chatbox
dev panel), and pastes outcomes into a local YAML file the grader
reads. The gold-envelope comparison logic stays the same.

## Failure response

If any tier fails any gate, the team returns to brainstorming — this
harness does **not** automate that choice. Options per the plan:

- (a) Prompt-engineering scaffolding in the tool descriptions (stays in
  this plan — patch `patch_visualization`'s description + re-run).
- (b) Declare the protocol frontier-only; degrade Ollama tier to the
  current create-duplicate behavior with a one-line user message.
- (c) Downscope to per-viz semantic update tools (re-enters brainstorm
  for a new requirements shape).

Option (a) is in-scope here; options (b) and (c) are product-shape
changes that require a new brainstorm round.
