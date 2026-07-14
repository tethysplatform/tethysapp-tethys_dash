"""Deterministic documentation retrieval for the docs Q&A agent.
"""
from __future__ import annotations

import math
import re
from functools import lru_cache
from pathlib import Path

# __file__ = <repo>/tethysapp/tethysdash/chatbot/tools/docs.py
# parents[4] is the repo root, which holds docs/source.
DOCS_ROOT = Path(__file__).parents[4] / "docs" / "source"

# Published Sphinx build of docs/source. The build preserves relative
# paths and swaps .rst for .html (verified 2026-07-09 incl. tutorials/
# and maps/ subdirs), so URL = base + rel_path.with_suffix(".html").
DOCS_BASE_URL = "https://tethysdash.readthedocs.io/en/latest/"


def doc_url(path: Path) -> str:
    """Public readthedocs URL for a docs/source file."""
    rel = path.relative_to(DOCS_ROOT).with_suffix(".html")
    return f"{DOCS_BASE_URL}{rel.as_posix()}"

# Minimal English stopword set - enough to keep question glue-words from
# dominating the scores. Deliberately small; missing one is harmless.
_STOPWORDS = frozenset(
    """a an and are as at be by can do does for from how i in is it of on
    or that the this to use using what when where which with you your
    tethysdash dashboard""".split()
)

_TOKEN_RE = re.compile(r"[a-z0-9_]+")


def _tokenize(text: str) -> list[str]:
    """Lowercase word tokens, stopwords dropped, crude plural folding
    (inputs→input, plugins→plugin) so singular questions match plural
    headings. Only strips a trailing 's' from tokens >3 chars."""
    out = []
    for t in _TOKEN_RE.findall(text.lower()):
        if t in _STOPWORDS:
            continue
        if len(t) > 3 and t.endswith("s") and not t.endswith("ss"):
            t = t[:-1]
        out.append(t)
    return out


def _iter_doc_files() -> list[Path]:
    """All .rst files under docs/source, recursively (tutorials/, maps/)."""
    if not DOCS_ROOT.is_dir():
        return []
    return sorted(DOCS_ROOT.rglob("*.rst"))


_UNDERLINE_RE = re.compile(r"^[=\-~^\"'#*+]{3,}\s*$")


def _headings(text: str) -> list[str]:
    """RST headings: any line whose following line is an underline run."""
    lines = text.splitlines()
    found = []
    for i, line in enumerate(lines[:-1]):
        if line.strip() and _UNDERLINE_RE.match(lines[i + 1]) and len(
            lines[i + 1].strip()
        ) >= len(line.strip()) * 0.5:
            found.append(line.strip())
    return found


def _doc_title(path: Path) -> str:
    """First heading of the file, falling back to a prettified filename."""
    heads = _headings(path.read_text(errors="replace"))
    if heads:
        return heads[0]
    return path.stem.replace("_", " ").title()


def score_docs(question: str) -> list[tuple[Path, float]]:
    """Rank doc files against ``question``; zero-score files dropped.

    Per file: body term hits + 3x heading term hits (+ filename hits),
    dampened by log of file length so long files don't always win.
    """
    q_tokens = set(_tokenize(question))
    if not q_tokens:
        return []

    scored: list[tuple[Path, float]] = []
    for path in _iter_doc_files():
        text = path.read_text(errors="replace")
        body_tokens = _tokenize(text)
        if not body_tokens:
            continue
        heading_tokens = _tokenize(" ".join(_headings(text)))
        name_tokens = _tokenize(path.stem.replace("_", " "))

        body_hits = sum(1 for t in body_tokens if t in q_tokens)
        heading_hits = sum(1 for t in heading_tokens if t in q_tokens)
        name_hits = sum(1 for t in name_tokens if t in q_tokens)

        # sqrt dampens raw repetition so a huge file mentioning a term
        # 50 times doesn't drown a focused file that IS about the term;
        # heading/filename hits stay linear (they're small and precise).
        raw = math.sqrt(body_hits) + 3 * heading_hits + 3 * name_hits
        if raw <= 0:
            continue
        scored.append((path, raw / (1.0 + math.log(len(body_tokens)))))

    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored


@lru_cache(maxsize=32)
def retrieve_context(
    question: str, max_chars: int = 12_000, max_files: int = 3
) -> tuple[str, tuple[dict, ...]]:
    """Return (context_block, sources) for a question.

    Each source is {"file": rel_path, "title": ..., "url": readthedocs
    link}. Concatenates the top-scored files with source separators;
    each file gets a fair slice of the budget (max_chars // max_files)
    so one big file can't crowd the others out. Empty question / no
    matches → ('', ()) so the agent can answer 'not covered'.

    lru_cache: the dispatch handler and the agent's dynamic instruction
    both call this with the same question in one request - the second
    call must be free and identical.
    """
    blocks: list[str] = []
    sources: list[dict] = []
    remaining = max_chars
    top = score_docs(question)[:max_files]
    per_file = max_chars // max(len(top), 1)

    for path, _score in top:
        if remaining <= 200:  # not worth a sliver of another file
            break
        title = _doc_title(path)
        header = f"=== source: {path.name} ({title}) ===\n"
        body = path.read_text(errors="replace")
        take = min(per_file, remaining) - len(header)
        if len(body) > take:
            body = body[:take] + "\n[... truncated ...]"
        blocks.append(header + body)
        sources.append({
            "file": path.relative_to(DOCS_ROOT).as_posix(),
            "title": title,
            "url": doc_url(path),
        })
        remaining -= len(header) + len(body)

    return "\n\n".join(blocks), tuple(sources)
