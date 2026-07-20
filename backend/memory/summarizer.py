"""
memory/summarizer.py
Token-efficient conversation memory for Zyron.

Every 3 messages (user + AI turns counted together) the conversation is
compressed into a ~50-token summary using the writer agent's provider and
stored in SQLite against the session ID.

The summary is later injected as context into the synthesizer / writer agent
only — the three parallel specialist agents receive NO conversation history.

Public API
----------
  maybe_summarize(session_id, messages, agent_configs)
      Checks whether a new summary is due (every 3 messages).
      If so, calls the LLM to compress and persists the result.
      Always returns silently — never raises.

  build_summary_prompt(messages) -> list[dict]
      Builds the minimal messages list sent to the LLM for compression.
      Exposed for testing.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from db.sqlite import save_summary
from providers   import call_agent, ProviderApiError

log = logging.getLogger(__name__)

# Compress every N *total* messages (user + AI turns count together).
# At 3 we get a summary after the user's first full exchange (1 user + 1 AI + 1 user = 3).
_SUMMARIZE_EVERY = 3

# Hard character cap on the message history fed into the compression prompt.
# Keeps the summarization call itself cheap (~200–400 tokens in, ~50 tokens out).
_MAX_HISTORY_CHARS = 1_500


def build_summary_prompt(messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    Build the minimal message list sent to the LLM for conversation compression.

    Parameters
    ----------
    messages : list of {"role": "user"|"ai", "text": str} dicts
               (the raw message objects stored in the SQLite message table)

    Returns
    -------
    A single-turn messages list ready for call_agent().
    """
    # Convert raw message objects to a compact transcript
    lines: List[str] = []
    char_budget = _MAX_HISTORY_CHARS
    for msg in messages:
        role   = "User" if msg.get("sender", msg.get("role", "")) in ("user", "User") else "AI"
        text   = (msg.get("text") or "").strip()
        if not text:
            continue
        # Trim very long individual turns so we stay within the budget
        if len(text) > 400:
            text = text[:400] + "…"
        line = f"{role}: {text}"
        if char_budget - len(line) < 0:
            break
        lines.append(line)
        char_budget -= len(line)

    transcript = "\n".join(lines)

    prompt = (
        "Compress the following conversation into a single, dense summary of at most 50 words. "
        "Capture the key topics, any decisions made, and relevant context so a future AI response "
        "can be consistent with this history. Do NOT start with 'The conversation' or 'Summary:'. "
        "Just output the compressed text directly.\n\n"
        f"--- Conversation ---\n{transcript}\n--- End ---"
    )
    return [{"role": "user", "content": prompt}]


async def maybe_summarize(
    session_id: str,
    messages: List[Dict[str, Any]],
    agent_configs: Dict[str, Any],
) -> None:
    """
    Conditionally compress conversation history and persist the summary.

    Triggers when len(messages) % _SUMMARIZE_EVERY == 0 (i.e. every 3 messages).
    Uses the writer agent's provider/model/key so no separate config is needed.
    All errors are caught and logged — the pipeline is never blocked.

    Parameters
    ----------
    session_id    : session identifier — used as the SQLite key
    messages      : full message list for this session
                    Each item must have at minimum: {"sender": "user"|"ai", "text": str}
    agent_configs : role → AgentConfig dict (must contain at least "writer")
    """
    if not session_id:
        return

    total = len(messages)
    if total == 0 or total % _SUMMARIZE_EVERY != 0:
        return  # Not time to summarize yet

    cfg = agent_configs.get("writer") or next(iter(agent_configs.values()), None)
    if not cfg:
        log.warning("[Summarizer] No agent config available — skipping summary")
        return

    # Support both pydantic model instances and plain dicts
    if hasattr(cfg, "model_dump"):
        cfg = cfg.model_dump()

    try:
        summary_messages = build_summary_prompt(messages)
        result = await call_agent(
            provider   = cfg["provider"],
            model      = cfg.get("model", ""),
            key        = cfg["key"],
            messages   = summary_messages,
            timeout_ms = cfg.get("timeout_ms") or cfg.get("timeoutMs") or 10_000,
        )
        summary_text = result.get("output", "").strip()
        if summary_text:
            await save_summary(session_id, summary_text)
            log.info(
                "[Summarizer] Session=%r — %d msgs → summary=%d chars",
                session_id, total, len(summary_text),
            )
        else:
            log.warning("[Summarizer] LLM returned empty summary for session=%r", session_id)
    except ProviderApiError as exc:
        log.warning("[Summarizer] Provider error for session=%r: %s", session_id, exc)
    except Exception as exc:
        log.warning("[Summarizer] Unexpected error for session=%r: %s", session_id, exc)
