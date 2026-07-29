"""Discovery, resolution, and formatting of installed TethysDash visualization plugins."""
import re
from dataclasses import dataclass
from difflib import SequenceMatcher

import intake

from ..models import PluginSpec


_MATCH_THRESHOLD = 0.6
_MATCH_MARGIN = 0.08
_CANDIDATE_FLOOR = 0.4
_MAX_CANDIDATES = 3


def _is_visualization_plugin(plugin_cls) -> bool:
    """Return True for TethysDash visualization plugins, False for generic intake drivers."""
    return hasattr(plugin_cls, "visualization_type")


def _plugin_attr(plugin_cls, name: str, default=None):
    """Read a plugin attribute, preferring the legacy ``visualization_<name>`` form."""
    if hasattr(plugin_cls, f"visualization_{name}"):
        return getattr(plugin_cls, f"visualization_{name}")
    if hasattr(plugin_cls, name):
        return getattr(plugin_cls, name)
    return default


def list_visualization_plugins() -> list[PluginSpec]:
    """Return a PluginSpec for every installed visualization plugin, sorted by source."""
    specs = []
    for name in sorted(intake.source.registry):
        cls = intake.source.registry[name]
        if not _is_visualization_plugin(cls):
            continue
        specs.append(
            PluginSpec(
                name=str(_plugin_attr(cls, "label", name)),
                source=name,
                viz_type=str(_plugin_attr(cls, "type", "?")),
                args=_plugin_attr(cls, "args", {}) or {},
                description=(_plugin_attr(cls, "description", "") or "").strip(),
            )
        )
    return specs


def get_plugin(source: str) -> PluginSpec | None:
    """Return the PluginSpec matching a plugin by its exact source name or label, else None."""
    for spec in list_visualization_plugins():
        if source in (spec.source, spec.name):
            return spec
    return None


def normalize_identifier(value) -> str:
    """Reduce a plugin name/source to comparable characters (lowercase, alphanumeric)."""
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def _tokens(value) -> set:
    """Split a name/source into a set of lowercase alphanumeric word tokens."""
    return set(re.findall(r"[a-z0-9]+", str(value).lower()))


def _match_score(identifier: str, spec: PluginSpec) -> float:
    """Best deterministic 0..1 similarity of an identifier to a plugin's source or name.

    Combines a character-sequence ratio (catches typos) with token-set overlap
    (catches reordered or partial word sets); the higher of the two, across both
    the plugin's source and its display name, wins.
    """
    normalized = normalize_identifier(identifier)
    id_tokens = _tokens(identifier)
    best = 0.0
    for target in (spec.source, spec.name):
        sequence = SequenceMatcher(None, normalized, normalize_identifier(target)).ratio()
        target_tokens = _tokens(target)
        union = id_tokens | target_tokens
        jaccard = len(id_tokens & target_tokens) / len(union) if union else 0.0
        best = max(best, sequence, jaccard)
    return best


@dataclass(frozen=True)
class PluginMatch:
    """Result of resolving a user/model identifier to a plugin.

    ``spec`` is the confidently-resolved plugin, or None when resolution was not
    confident - in which case ``candidates`` holds the closest plugins to offer
    as "did you mean" options (empty when nothing was even close).
    """

    spec: PluginSpec | None
    candidates: tuple[PluginSpec, ...] = ()


def resolve_plugin(identifier: str) -> PluginMatch:
    """Deterministically map an identifier (source OR name, exact or fuzzy) to a plugin.

    Resolution order: exact source/name, then normalized-exact (case/spacing/
    punctuation), then a confident fuzzy match. Anything less confident returns
    no spec and the closest candidates, so the caller can ask instead of guess.
    """
    specs = list_visualization_plugins()
    if not specs:
        return PluginMatch(None, ())

    for spec in specs:
        if identifier in (spec.source, spec.name):
            return PluginMatch(spec, ())

    normalized = normalize_identifier(identifier)
    if normalized:
        norm_hits = [
            spec
            for spec in specs
            if normalized
            in (normalize_identifier(spec.source), normalize_identifier(spec.name))
        ]
        if len(norm_hits) == 1:
            return PluginMatch(norm_hits[0], ())

    scored = sorted(
        ((_match_score(identifier, spec), spec) for spec in specs),
        key=lambda pair: (-pair[0], pair[1].source),
    )
    top_score, top_spec = scored[0]
    runner_up = scored[1][0] if len(scored) > 1 else 0.0
    if top_score >= _MATCH_THRESHOLD and (top_score - runner_up) >= _MATCH_MARGIN:
        return PluginMatch(top_spec, ())

    candidates = tuple(
        spec for score, spec in scored[:_MAX_CANDIDATES] if score >= _CANDIDATE_FLOOR
    )
    return PluginMatch(None, candidates)


def format_catalog_for_llm() -> str:
    """Render the installed plugin catalog as Markdown for inclusion in a prompt."""
    specs = list_visualization_plugins()
    if not specs:
        return "No visualization plugins are installed."
    blocks = []
    for spec in specs:
        args_line = ", ".join(spec.args) if spec.args else "(none)"
        description = spec.description or "(no description)"
        blocks.append(
            f"**{spec.name}** ({spec.viz_type})\n"
            f" `{spec.source}` - `args: {args_line}` \n\n"
            f"  {description}"
        )
    return "\n\n".join(blocks)
