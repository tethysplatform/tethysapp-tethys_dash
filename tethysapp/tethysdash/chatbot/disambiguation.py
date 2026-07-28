"""Server-side pending-disambiguation record plus a deterministic follow-up resolver.

When patch finds several same-source tiles it stores a short-lived pending record
(Django cache, keyed by dashboard+user). The next user turn is resolved here - a
numbered pick, 'all', or 'cancel' - deterministically, before the router/LLM, so
the weak model never has to handle a number. A selection is only honored when the
disambiguation ask was the immediately-preceding turn, so a stray number sent
long after an abandoned ask cannot hijack a stale pending change.
"""
import re
from dataclasses import asdict, dataclass, field

from django.core.cache import cache

from .tools.dashboard import list_tiles, load_dashboard_tabs, save_dashboard_tabs
from .tools.tile_ops import (
    DISAMBIGUATION_MARKER,
    _apply_arg_changes,
    _disambiguation_reply,
    _filter_by_where,
    _is_noop,
    _matching_tiles,
    _pairs,
    candidate_signature,
    check_args,
)

_TTL_SECONDS = 600
_ALL_WORDS = {"all", "all of them", "both", "every", "everything"}
_CANCEL_WORDS = {"cancel", "never mind", "nevermind", "nvm", "stop", "forget it"}
_NUMBER_RE = re.compile(r"(?:#|number|option|no\.?|num)?\s*(\d{1,3})")


@dataclass
class PendingDisambiguation:
    """A patch that is waiting for the user to pick which same-source tile."""

    source: str
    args: dict
    candidates: list
    version: str
    where: dict = field(default_factory=dict)


def _key(dashboard_id, user) -> str:
    """Cache key scoping a pending record to one dashboard and user."""
    return f"chat:pending:{dashboard_id}:{getattr(user, 'id', user)}"


def set_pending(dashboard_id, user, record: PendingDisambiguation) -> None:
    """Store (or supersede) the pending record for this dashboard+user."""
    if not dashboard_id:
        return
    cache.set(_key(dashboard_id, user), asdict(record), _TTL_SECONDS)


def get_pending(dashboard_id, user) -> PendingDisambiguation | None:
    """Return the pending record for this dashboard+user, or None."""
    data = cache.get(_key(dashboard_id, user))
    if not data:
        return None
    try:
        return PendingDisambiguation(**data)
    except TypeError:
        clear_pending(dashboard_id, user)  # stale shape from a prior deploy
        return None


def clear_pending(dashboard_id, user) -> None:
    """Drop the pending record (safe when none exists)."""
    cache.delete(_key(dashboard_id, user))


def _classify(message: str):
    """Classify a whole-message selection reply.

    Returns ('number', n), ('all', None), ('cancel', None), or (None, None) when
    the message is not purely a selection - in which case the caller falls
    through to normal routing, so a real request ('change all the rivers to X',
    'add 3 tiles') is never hijacked.
    """
    text = (message or "").strip().lower().rstrip(".!?")
    if not text:
        return None, None
    match = _NUMBER_RE.fullmatch(text)
    if match:
        return "number", int(match.group(1))
    if text in _ALL_WORDS:
        return "all", None
    if text in _CANCEL_WORDS:
        return "cancel", None
    return None, None


def _ask_was_last_turn(history) -> bool:
    """True when the most recent assistant turn was a disambiguation prompt.

    Bounds a selection reply to the turn right after the ask so a stray number
    sent later (answering something else) cannot resolve a stale pending record.
    """
    for turn in reversed(history or []):
        if turn.get("role") == "assistant":
            return DISAMBIGUATION_MARKER in (turn.get("text") or "")
    return False


def resolve_pending(deps, message: str) -> str | None:
    """Resolve a follow-up to a pending disambiguation, or None to fall through.

    Runs before the router; returns a reply string when it handled the turn.
    Reuses patch's ownership + arg-validation + no-op guards and fails closed.
    """
    record = get_pending(deps.dashboard_id, deps.user)
    if record is None:
        return None
    kind, number = _classify(message)
    if kind is None:
        return None
    if not _ask_was_last_turn(deps.history):
        return None  # a stray selection long after the ask; don't hijack it

    if kind == "cancel":
        clear_pending(deps.dashboard_id, deps.user)
        return "Okay, I didn't change anything."

    if not deps.can_add_visualizations:
        clear_pending(deps.dashboard_id, deps.user)
        return "Only the dashboard owner can change visualizations on this dashboard."

    tabs = load_dashboard_tabs(deps.user, deps.dashboard_id)
    matches = _matching_tiles(list_tiles(tabs), record.source)
    if record.where:
        matches = _filter_by_where(matches, record.where)
    if not matches:
        clear_pending(deps.dashboard_id, deps.user)
        return "Those visualizations no longer exist, so nothing changed."

    candidates, version = candidate_signature(matches)
    if candidates != record.candidates or version != record.version:
        record.candidates, record.version = candidates, version
        set_pending(deps.dashboard_id, deps.user, record)
        return "The dashboard changed. " + _disambiguation_reply(record.source, matches)

    if kind == "number":
        if not 1 <= number <= len(matches):
            return (
                f"That's not 1-{len(matches)}. "
                + _disambiguation_reply(record.source, matches)
            )
        _tab, _item, tile = matches[number - 1]
        err = check_args(tile.get("source"), record.args)
        if err:
            clear_pending(deps.dashboard_id, deps.user)
            return err
        if _is_noop(tile, record.args):
            clear_pending(deps.dashboard_id, deps.user)
            return f"#{number} ({tile.get('source')}) already has {_pairs(record.args)}; nothing changed."
        _apply_arg_changes(tile, record.args)
        save_dashboard_tabs(deps.user, deps.dashboard_id, tabs)
        clear_pending(deps.dashboard_id, deps.user)
        return f"Updated #{number} ({tile.get('source')}): {_pairs(record.args)}."

    source = matches[0][2].get("source")
    applied = 0
    for _tab, _item, tile in matches:
        err = check_args(tile.get("source"), record.args)
        if err:
            clear_pending(deps.dashboard_id, deps.user)
            return err
        if not _is_noop(tile, record.args):
            _apply_arg_changes(tile, record.args)
            applied += 1
    if applied:
        save_dashboard_tabs(deps.user, deps.dashboard_id, tabs)
    clear_pending(deps.dashboard_id, deps.user)
    if not applied:
        return f"All {len(matches)} {source} tiles already have {_pairs(record.args)}; nothing changed."
    return f"Updated all {applied} {source} tiles: {_pairs(record.args)}."
