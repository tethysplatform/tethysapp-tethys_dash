"""Shared LLM configuration for every agent in this package.

Agents are constructed once at import with the LOCAL default model.
Per-request provider selection happens in ``resolve_profile(user)`` —
the controller passes the resolved profile's ``model`` /
``model_settings`` / wrapped ``output_type`` as run-time overrides
(``agent.run(..., model=..., model_settings=..., output_type=...)``),
so switching providers needs no server reload.

Key safety: user API keys are Fernet-encrypted at rest (key derived
from Django SECRET_KEY), decrypted only inside ``resolve_profile`` for
the scope of one request, passed explicitly to the provider instance,
and never exported to env, logged, or returned by any endpoint.
"""
from __future__ import annotations

import base64
import hashlib
from dataclasses import dataclass
from typing import Any

import httpx
from cryptography.fernet import Fernet, InvalidToken
from pydantic_ai import ModelSettings, NativeOutput
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

MODEL_NAME = "qwen3:1.7b"
LLM_HOST = "http://localhost:11434"
DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6"
DEFAULT_OPENAI_MODEL = "gpt-5.2"


class ChatProviderError(Exception):
    """User-facing provider problem. Its message is shown in the chat."""


def _local_model(model_name: str = MODEL_NAME) -> OpenAIChatModel:
    return OpenAIChatModel(
        model_name,
        provider=OpenAIProvider(
            base_url=f"{LLM_HOST.rstrip('/')}/v1",
            api_key="ollama",
        ),
    )


# Import-time default so agent construction keeps working; every run
# gets an explicit override from the resolved profile.
model = _local_model()


@dataclass(frozen=True)
class LLMProfile:
    """Everything a chat request needs to know about its LLM."""

    provider: str  # "local" | "anthropic" | "openai"
    model: Any
    model_settings: ModelSettings
    native_output: bool

    def wrap_output(self, candidates: list) -> Any:
        """NativeOutput for local models (they emit tool-call JSON as
        text otherwise); plain tool-based output for capable paid
        providers (Anthropic has no native JSON-schema output mode)."""
        return NativeOutput(candidates) if self.native_output else candidates


_LOCAL_SETTINGS = ModelSettings(
    max_tokens=400,
    extra_body={"chat_template_kwargs": {"enable_thinking": False}},  # Ollama-only
)
_PAID_SETTINGS = ModelSettings(max_tokens=800)


def _fernet() -> Fernet:
    from django.conf import settings

    digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_key(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def _decrypt_key(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        raise ChatProviderError(
            "Your stored API key could not be read (the server secret may "
            "have changed). Re-enter your key in the chat settings."
        )


def _ollama_reachable() -> bool:
    try:
        httpx.get(f"{LLM_HOST.rstrip('/')}/api/version", timeout=1.0)
        return True
    except Exception:
        return False


def resolve_profile(username: str) -> LLMProfile:
    """Resolve the LLM profile for one chat request.

    Raises ChatProviderError with a user-facing message when the
    configured provider can't be used — the controller returns that
    message as a normal chat reply, not a 5xx.
    """
    from tethysapp.tethysdash.model import get_chat_provider_setting

    row = get_chat_provider_setting(username) or {"provider": "local"}
    provider = row.get("provider") or "local"

    if provider == "local":
        if not _ollama_reachable():
            raise ChatProviderError(
                "No local model available (Ollama is not reachable). "
                "Start Ollama, or configure a provider in the chat settings."
            )
        return LLMProfile(
            "local",
            _local_model(row.get("model_name") or MODEL_NAME),
            _LOCAL_SETTINGS,
            native_output=True,
        )

    key_enc = row.get("api_key_enc")
    if not key_enc:
        raise ChatProviderError(
            f"The {provider} provider is selected but no API key is saved. "
            "Add your key in the chat settings."
        )
    api_key = _decrypt_key(key_enc)

    if provider == "anthropic":
        from pydantic_ai.models.anthropic import AnthropicModel
        from pydantic_ai.providers.anthropic import AnthropicProvider

        return LLMProfile(
            "anthropic",
            AnthropicModel(
                row.get("model_name") or DEFAULT_ANTHROPIC_MODEL,
                provider=AnthropicProvider(api_key=api_key),
            ),
            _PAID_SETTINGS,
            native_output=False,
        )

    if provider == "openai":
        return LLMProfile(
            "openai",
            OpenAIChatModel(
                row.get("model_name") or DEFAULT_OPENAI_MODEL,
                provider=OpenAIProvider(api_key=api_key),
            ),
            _PAID_SETTINGS,
            native_output=False,
        )

    raise ChatProviderError(f"Unknown provider {provider!r} in your chat settings.")
