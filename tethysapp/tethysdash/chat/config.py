"""Shared LLM configuration for every agent in this plugin.
"""
from __future__ import annotations

from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

MODEL_NAME = "qwen3:1.7b"
LLM_HOST =  "http://localhost:11434"


model = OpenAIChatModel(
    MODEL_NAME,
    provider=OpenAIProvider(
        base_url=f"{LLM_HOST.rstrip('/')}/v1",
        api_key="ollama",
    ),
)
