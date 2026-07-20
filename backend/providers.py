"""
providers.py
Async HTTP calls to every AI provider supported by Zyron.

Ported from src/agents/api/providers.service.js — identical token budgets,
writer-detection markers, request shapes, and error extraction logic.
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx


# ─── Token budget tables ───────────────────────────────────────────────────────
# OUTPUT token limits only — not context-window sizes.
# Groq free: 4 096 hard cap. OpenRouter free: 4 096. Mistral/GLM: safe at 4 096.
# OpenAI / Anthropic / DeepSeek / Gemini: 8 192 specialist, 32 768 writer.

_SPECIALIST_TOKENS: Dict[str, int] = {
    "openai":      8_192,
    "anthropic":   8_192,
    "openrouter":  4_096,
    "mistral":     4_096,
    "gemini":      8_192,
    "deepseek":    8_192,
    "groq":        4_096,
    "glm":         4_096,
}

_WRITER_TOKENS: Dict[str, int] = {
    "openai":      32_768,
    "anthropic":   32_768,
    "openrouter":  16_384,
    "mistral":     16_384,
    "gemini":      32_768,
    "deepseek":    32_768,
    "groq":        16_384,
    "glm":         16_384,
}


def _get_max_tokens(provider: str, is_writer: bool) -> int:
    table = _WRITER_TOKENS if is_writer else _SPECIALIST_TOKENS
    return table.get(provider, 8_192 if is_writer else 4_096)


# ─── Writer-role detection ─────────────────────────────────────────────────────
# Multiple markers so a prompt change can't silently break token budgeting.
_WRITER_MARKERS = (
    "final synthesizer",
    "MANDATORY Coverage Checklist",
    "Specialist Inputs",
    "Specialist Research",
    "## What to cover",
)


def _is_writer_role(messages: List[Dict[str, str]]) -> bool:
    return any(
        m.get("role") == "user"
        and any(marker in m.get("content", "") for marker in _WRITER_MARKERS)
        for m in messages
    )


# ─── Error helpers ─────────────────────────────────────────────────────────────

class ProviderApiError(Exception):
    """Raised when a provider returns a non-2xx response."""

    def __init__(self, message: str, status: int, provider: str, raw: Any = None) -> None:
        super().__init__(message)
        self.status = status
        self.provider = provider
        self.raw = raw


def _extract_error_message(data: Any, fallback: str) -> str:
    if not data:
        return fallback
    if isinstance(data, str):
        return data
    if isinstance(data, dict):
        err = data.get("error")
        if isinstance(err, dict):
            return err.get("message") or fallback
        return err or data.get("message") or fallback
    return fallback


def _raise_for_status(response: httpx.Response, provider: str) -> None:
    if response.is_error:
        try:
            data = response.json()
        except Exception:
            data = response.text
        msg = _extract_error_message(data, f"{provider} API error: {response.status_code}")
        raise ProviderApiError(msg, response.status_code, provider, data)


# ─── OpenAI ────────────────────────────────────────────────────────────────────

async def _call_openai(
    model: str,
    key: str,
    messages: List[Dict[str, str]],
    timeout: float,
) -> Dict[str, Any]:
    max_tokens = _get_max_tokens("openai", _is_writer_role(messages))
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model or "gpt-4o-mini",
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": 0.7,
            },
        )
    _raise_for_status(response, "openai")
    data = response.json()
    usage = data.get("usage") or {}
    return {
        "output": data["choices"][0]["message"]["content"],
        "token_usage": {
            "prompt_tokens":     usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
            "total_tokens":      usage.get("total_tokens", 0),
        },
    }


# ─── Anthropic ─────────────────────────────────────────────────────────────────

async def _call_anthropic(
    model: str,
    key: str,
    messages: List[Dict[str, str]],
    timeout: float,
) -> Dict[str, Any]:
    max_tokens = _get_max_tokens("anthropic", _is_writer_role(messages))
    system_message = next((m for m in messages if m.get("role") == "system"), None)
    user_messages = [m for m in messages if m.get("role") != "system"]

    body: Dict[str, Any] = {
        "model": model or "claude-3-5-haiku-latest",
        "messages": [{"role": m["role"], "content": m["content"]} for m in user_messages],
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }
    if system_message:
        body["system"] = system_message["content"]

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=body,
        )
    _raise_for_status(response, "anthropic")
    data = response.json()
    usage = data.get("usage") or {}
    prompt_tokens     = usage.get("input_tokens", 0)
    completion_tokens = usage.get("output_tokens", 0)
    return {
        "output": (data.get("content") or [{}])[0].get("text", ""),
        "token_usage": {
            "prompt_tokens":     prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens":      prompt_tokens + completion_tokens,
        },
    }


# ─── Gemini ────────────────────────────────────────────────────────────────────

async def _call_gemini(
    model: str,
    key: str,
    messages: List[Dict[str, str]],
    timeout: float,
) -> Dict[str, Any]:
    max_tokens = _get_max_tokens("gemini", _is_writer_role(messages))
    system_message = next((m for m in messages if m.get("role") == "system"), None)
    prompt_text = "\n\n".join(
        m["content"] for m in messages if m.get("role") != "system"
    ) or "Ping"

    body: Dict[str, Any] = {
        "contents": [{"role": "user", "parts": [{"text": prompt_text}]}],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": 0.7,
        },
    }
    if system_message:
        body["systemInstruction"] = {"parts": [{"text": system_message["content"]}]}

    model_name = model or "gemini-2.5-flash"
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent",
            headers={
                "x-goog-api-key": key,
                "Content-Type": "application/json",
            },
            json=body,
        )
    _raise_for_status(response, "gemini")
    data = response.json()
    parts = (
        (data.get("candidates") or [{}])[0]
        .get("content", {})
        .get("parts", [])
    )
    text = "".join(p.get("text", "") for p in parts)
    meta = data.get("usageMetadata") or {}
    prompt_tokens     = meta.get("promptTokenCount", 0)
    completion_tokens = meta.get("candidatesTokenCount", 0)
    return {
        "output": text,
        "token_usage": {
            "prompt_tokens":     prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens":      prompt_tokens + completion_tokens,
        },
    }


# ─── OpenAI-compatible providers ──────────────────────────────────────────────
# OpenRouter, Mistral, DeepSeek, Groq, and GLM all use the standard
# chat-completions contract with a Bearer token and choices[0].message.content.

_OPENAI_COMPAT: Dict[str, Dict[str, str]] = {
    "openrouter": {
        "url":           "https://openrouter.ai/api/v1/chat/completions",
        "default_model": "nvidia/nemotron-3-super-120b-a12b:free",
    },
    "mistral": {
        "url":           "https://api.mistral.ai/v1/chat/completions",
        "default_model": "mistral-small-latest",
    },
    "deepseek": {
        "url":           "https://api.deepseek.com/v1/chat/completions",
        "default_model": "deepseek-chat",
    },
    "groq": {
        "url":           "https://api.groq.com/openai/v1/chat/completions",
        "default_model": "llama-3.3-70b-versatile",
    },
    "glm": {
        "url":           "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        "default_model": "glm-4-flash",
    },
}


async def _call_openai_compat(
    provider: str,
    model: str,
    key: str,
    messages: List[Dict[str, str]],
    timeout: float,
) -> Dict[str, Any]:
    cfg = _OPENAI_COMPAT[provider]
    max_tokens = _get_max_tokens(provider, _is_writer_role(messages))

    headers: Dict[str, str] = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    # OpenRouter recommends these for routing and analytics
    if provider == "openrouter":
        headers["HTTP-Referer"] = "https://Zyron.app"
        headers["X-Title"]      = "ZyronAgents"

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            cfg["url"],
            headers=headers,
            json={
                "model": model or cfg["default_model"],
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": 0.7,
            },
        )
    _raise_for_status(response, provider)
    data = response.json()
    usage = data.get("usage") or {}
    return {
        "output": data["choices"][0]["message"]["content"],
        "token_usage": {
            "prompt_tokens":     usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
            "total_tokens":      usage.get("total_tokens", 0),
        },
    }


# ─── Public dispatcher ─────────────────────────────────────────────────────────

async def call_agent(
    provider: str,
    model: str,
    key: str,
    messages: List[Dict[str, str]],
    timeout_ms: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Route a chat-completion request to the correct provider.

    Args:
        provider:   One of openai | anthropic | gemini | openrouter |
                    mistral | deepseek | groq | glm.
        model:      Model identifier string. Falls back to provider default when empty.
        key:        Raw API key (not validated here — call validate_api_key_format first).
        messages:   OpenAI-style message list, e.g.
                    [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]
        timeout_ms: Per-request timeout in milliseconds. Defaults to 120 000 (2 min).

    Returns:
        {
            "output": str,
            "token_usage": {
                "prompt_tokens": int,
                "completion_tokens": int,
                "total_tokens": int,
            }
        }

    Raises:
        ProviderApiError: Non-2xx response from the upstream provider.
        ValueError:       Unknown provider string.
    """
    timeout_sec = (timeout_ms / 1_000) if timeout_ms else 120.0

    if provider == "openai":
        return await _call_openai(model, key, messages, timeout_sec)
    if provider == "anthropic":
        return await _call_anthropic(model, key, messages, timeout_sec)
    if provider == "gemini":
        return await _call_gemini(model, key, messages, timeout_sec)
    if provider in _OPENAI_COMPAT:
        return await _call_openai_compat(provider, model, key, messages, timeout_sec)

    raise ValueError(f"Unknown provider: {provider!r}")


# ─── Streaming dispatcher ──────────────────────────────────────────────────────

async def stream_agent(
    provider: str,
    model: str,
    key: str,
    messages: List[Dict[str, str]],
    timeout_ms: Optional[int] = None,
) -> AsyncIterator[str]:
    """
    Stream text chunks from the provider as they are generated.

    Yields raw text chunks (strings).  After the generator is exhausted,
    call stream_agent_usage() on the same provider/model to get token counts,
    or use the `token_usage` attribute attached to the generator if supported.

    Falls back to a single non-streaming call for Gemini (its REST endpoint
    doesn't support true token streaming without the SDK).

    Yields:
        str — one or more characters of the response text.

    Raises:
        ProviderApiError: Non-2xx response.
        ValueError:       Unknown provider.
    """
    timeout_sec = (timeout_ms / 1_000) if timeout_ms else 120.0

    if provider == "anthropic":
        async for chunk in _stream_anthropic(model, key, messages, timeout_sec):
            yield chunk
    elif provider == "gemini":
        # Gemini REST streaming requires chunked transfer — fall back to blocking
        # call and yield the full text as one chunk so the interface is uniform.
        result = await _call_gemini(model, key, messages, timeout_sec)
        yield result["output"]
    elif provider == "openai" or provider in _OPENAI_COMPAT:
        async for chunk in _stream_openai_compat(provider, model, key, messages, timeout_sec):
            yield chunk
    else:
        raise ValueError(f"Unknown provider: {provider!r}")


async def _stream_openai_compat(
    provider: str,
    model: str,
    key: str,
    messages: List[Dict[str, str]],
    timeout: float,
) -> AsyncIterator[str]:
    """Stream via OpenAI-compatible SSE (openai, openrouter, mistral, deepseek, groq, glm)."""
    if provider == "openai":
        url = "https://api.openai.com/v1/chat/completions"
        default_model = "gpt-4o-mini"
    else:
        cfg = _OPENAI_COMPAT[provider]
        url = cfg["url"]
        default_model = cfg["default_model"]

    max_tokens = _get_max_tokens(provider, _is_writer_role(messages))
    headers: Dict[str, str] = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }
    if provider == "openrouter":
        headers["HTTP-Referer"] = "https://Zyron.app"
        headers["X-Title"] = "ZyronAgents"

    body = {
        "model": model or default_model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.7,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, headers=headers, json=body) as response:
            _raise_for_status(response, provider)
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    data = json.loads(data_str)
                except json.JSONDecodeError:
                    continue
                delta = (data.get("choices") or [{}])[0].get("delta", {})
                chunk = delta.get("content") or ""
                if chunk:
                    yield chunk


async def _stream_anthropic(
    model: str,
    key: str,
    messages: List[Dict[str, str]],
    timeout: float,
) -> AsyncIterator[str]:
    """Stream via Anthropic SSE."""
    max_tokens = _get_max_tokens("anthropic", _is_writer_role(messages))
    system_message = next((m for m in messages if m.get("role") == "system"), None)
    user_messages = [m for m in messages if m.get("role") != "system"]

    body: Dict[str, Any] = {
        "model": model or "claude-3-5-haiku-latest",
        "messages": [{"role": m["role"], "content": m["content"]} for m in user_messages],
        "max_tokens": max_tokens,
        "temperature": 0.7,
        "stream": True,
    }
    if system_message:
        body["system"] = system_message["content"]

    headers = {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "accept": "text/event-stream",
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST",
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json=body,
        ) as response:
            _raise_for_status(response, "anthropic")
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                try:
                    data = json.loads(data_str)
                except json.JSONDecodeError:
                    continue
                if data.get("type") == "content_block_delta":
                    chunk = data.get("delta", {}).get("text", "")
                    if chunk:
                        yield chunk
