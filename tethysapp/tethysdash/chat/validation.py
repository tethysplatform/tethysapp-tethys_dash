from dataclasses import dataclass


@dataclass
class ChatDeps:
    """Session context passed via ``agent.run(prompt, deps=ChatDeps(...))``.
    Every tool receives this via ``ctx.deps.<field>``.

    ``chat_id`` is a per-request UUID from the frontend; tools use it as
    the ``requestId`` when pushing progress messages over the WebSocket.
    """
    user: object
    dashboard_id: int
    original_prompt: str = ""
    chat_id: str = ""
    profile: object = None
    # Sanitized recent conversation ([{role, text}, ...], newest last)
    # from the frontend - advisory context for reference resolution.
    history: list = None
    # True when the requester OWNS the dashboard. Gates the mutating
    # router candidates (see agents/router.candidates_for) and is
    # re-checked deterministically inside the tool itself.
    can_add_visualizations: bool = True
