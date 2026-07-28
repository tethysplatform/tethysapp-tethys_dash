from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel

from .agents.registry import IntentName


@dataclass(frozen=True)
class PluginSpec:
    name: str
    source: str
    viz_type: str
    args: dict[str, Any]
    description: str


class PluginRequest(BaseModel):
    """A single plugin to add: its catalog source name and argument object."""

    source: str
    args: dict[str, Any] = {}


class RoutedResponse(BaseModel):
    """The router's reply: the capability that handled it and the text to show."""

    intent: IntentName | Literal["fallback"]
    response: str


@dataclass
class ChatDeps:
    """Session context passed via ``agent.run(prompt, deps=ChatDeps(...))``.

    Every tool receives this via ``ctx.deps.<field>``. ``chat_id`` is the
    per-request UUID from the frontend; ``emit_progress`` and ``emit_delta`` use
    it to route streamed events onto this request's NDJSON response.
    """

    user: object
    dashboard_id: int
    original_prompt: str = ""
    chat_id: str = ""
    history: list | None = None
    can_add_visualizations: bool = True
