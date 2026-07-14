"""Local LLM configuration for the chat agents.

Agents are constructed once at import with the local Ollama model.
Endpoint and model name are overridable via environment (read once at
import; restart the server to change them).
"""
from __future__ import annotations

import os

from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

MODEL_NAME = os.getenv("TETHYSDASH_CHAT_LOCAL_MODEL", "qwen3.5:2b")
LLM_HOST = os.getenv("TETHYSDASH_CHAT_LLM_HOST", "http://localhost:11434")


model = OpenAIChatModel(
    MODEL_NAME,
    provider=OpenAIProvider(
        base_url=f"{LLM_HOST.rstrip('/')}/v1",
        api_key="ollama",
    ),
)
