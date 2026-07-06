from pydantic import BaseModel, Field
from typing import Literal
from dataclasses import dataclass


class GridItemAgentInput(BaseModel):
    """What an LLM must specify to create a grid item."""
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    width: int = Field(ge=1, le=12)
    height: int = Field(ge=1, le=12)
    visualization_type: Literal["chart", "map", "text", "table"]


class GridItemAgentView(BaseModel):
    """What an LLM sees when reading a grid item."""
    row: int
    col: int
    width: int
    height: int
    visualization_type: str
    summary: str


@dataclass
class ChatDeps:
    """Session context passed via ``agent.run(prompt, deps=ChatDeps(...))``.
    Every tool receives this via ``ctx.deps.<field>``.
    """
    user: object 
    dashboard_id: int 

class GridItemPlacement(BaseModel):
    """LLM-produced placement + type for a new grid item.

    Used as the arg-schema for ``add_visualization_from_plugin`` - pydantic-ai
    validates the LLM's tool-call arguments against this shape at the boundary.
    """
    source: str = Field(description="Registered intake plugin name from list_available_plugins.")
    args_json: str = Field(description="JSON-encoded dict of args the plugin expects.")
    # placement - optional; defaults chosen by the tool if omitted
    x: int = Field(default=0, ge=0)
    y: int = Field(default=0, ge=0)
    width: int = Field(default=50, ge=1, le=100)
    height: int = Field(default=40, ge=1, le=100)
