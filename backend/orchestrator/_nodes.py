"""
_nodes.py
LangGraph node functions for the Zyron orchestrator pipeline.

Each node:
  1. Reads the fields it needs from ZyronState.
  2. Builds the prompt via prompt_builder.
  3. Calls the provider via providers.call_agent().
  4. Returns a partial-state dict that LangGraph merges into the full state.

Node graph:
  START → fan_out → [reasoner_node, coder_node, vision_node] (parallel)
        → fan_in  → writer_node → END

Empty-output guard:
  After the first call, if the output is < MIN_SPECIALIST_CHARS the node retries
  exactly once with a fresh blocking call before giving up.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from prompt_builder import build_specialist_prompt, build_writer_prompt
from providers      import call_agent, stream_agent, ProviderApiError
from query_analyzer import analyze_query

from ._utils import (
    MIN_SPECIALIST_CHARS,
    WRITER_SPECIALIST_CAP,
    trim_output,
    deduplicate_outputs,
    build_quality_report,
    build_fallback_answer,
)

log = logging.getLogger(__name__)

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _agent_meta_from_team(team: Optional[Dict], role: str) -> Dict[str, str]:
    """Extract the AgentMeta dict for a role from the team definition."""
    if team and "agents" in team:
        agents = team["agents"]
        # Support both pydantic model dicts (.model_dump()) and plain dicts
        if hasattr(agents, role):
            a = getattr(agents, role)
            return {
                "name":                 a.name,
                "specialist_directive": a.specialist_directive,
                "contribution_lens":    a.contribution_lens,
            }
        if isinstance(agents, dict) and role in agents:
            a = agents[role]
            if isinstance(a, dict):
                return {
                    "name":                 a.get("name", role.capitalize()),
                    "specialist_directive": a.get("specialist_directive", a.get("specialistDirective", "")),
                    "contribution_lens":    a.get("contribution_lens",    a.get("contributionLens", "")),
                }
    # Fallback defaults
    return {"name": role.capitalize(), "specialist_directive": "", "contribution_lens": ""}


def _config_for_role(agent_configs: Dict[str, Any], role: str) -> Optional[Dict]:
    """Return the AgentConfig dict for a role, falling back to writer config."""
    cfg = agent_configs.get(role) or agent_configs.get("writer")
    if cfg is None:
        return None
    # Support pydantic model instances
    if hasattr(cfg, "model_dump"):
        return cfg.model_dump()
    return cfg


def _team_dict(team: Any) -> Optional[Dict]:
    """Normalise a Team (pydantic model or plain dict) into a plain dict."""
    if team is None:
        return None
    if hasattr(team, "model_dump"):
        return team.model_dump()
    return team


def _profile_dict(user_profile: Any) -> Optional[Dict]:
    """Normalise a UserProfile into a plain dict."""
    if user_profile is None:
        return None
    if hasattr(user_profile, "model_dump"):
        return user_profile.model_dump()
    return user_profile


async def _call_with_retry(
    role: str,
    cfg: Dict[str, Any],
    messages: List[Dict[str, str]],
) -> Dict[str, Any]:
    """
    Call the provider; if the output is < MIN_SPECIALIST_CHARS, retry once.
    Returns {"output": str, "token_usage": dict, "status": str}.
    """
    role_labels = {"reasoner": "Agent 1", "coder": "Agent 2", "vision": "Agent 3", "writer": "Agent 4"}
    label = role_labels.get(role, role)

    async def _single_call() -> Dict[str, Any]:
        return await call_agent(
            provider   = cfg["provider"],
            model      = cfg.get("model", ""),
            key        = cfg["key"],
            messages   = messages,
            timeout_ms = cfg.get("timeout_ms") or cfg.get("timeoutMs"),
        )

    # ── First attempt ────────────────────────────────────────────────────────
    try:
        result = await _single_call()
        output = result.get("output", "")
        if len(output.strip()) >= MIN_SPECIALIST_CHARS:
            return {"output": output, "token_usage": result.get("token_usage", {}), "status": "success"}
        # Output too short — fall through to retry
        log.warning("[Agents] %s thin output (%d chars) — retrying", label, len(output.strip()))
    except ProviderApiError as exc:
        log.warning("[Agents] %s first call failed (%s) — retrying", label, exc)
        output = ""

    # ── Single retry ────────────────────────────────────────────────────────
    try:
        result = await _single_call()
        output = result.get("output", "")
        if len(output.strip()) >= MIN_SPECIALIST_CHARS:
            log.info("[Agents] %s retry ok (%d chars)", label, len(output.strip()))
            return {"output": output, "token_usage": result.get("token_usage", {}), "status": "success"}
        log.warning("[Agents] %s retry returned thin output (%d chars) — accepting", label, len(output.strip()))
        return {"output": output, "token_usage": result.get("token_usage", {}), "status": "success"}
    except Exception as exc:
        log.error("[Agents] %s retry failed: %s", label, exc)
        return {"output": output, "token_usage": {}, "status": "error"}


# ─── Specialist nodes ─────────────────────────────────────────────────────────

async def _run_specialist(role: str, state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Shared implementation for all three specialist nodes.
    Returns a partial ZyronState update.
    """
    query          = state["query"]
    analysis       = state["analysis"]
    agent_configs  = state["agent_configs"]
    team           = _team_dict(state.get("team"))
    user_profile   = _profile_dict(state.get("user_profile"))
    search_results = state.get("search_results")

    print(f"[Node] search_results received in node: {search_results is not None}")

    agent_meta = _agent_meta_from_team(team, role)
    cfg        = _config_for_role(agent_configs, role)

    if cfg is None:
        log.error("[Agents] No config for role %s — skipping", role)
        return {
            "specialist_outputs": {**state.get("specialist_outputs", {}), role: ""},
            "usage_by_role":      {**state.get("usage_by_role", {}), role: {}},
            "agent_results": state.get("agent_results", []) + [{
                "role": role, "name": agent_meta["name"],
                "output": "", "status": "error", "token_usage": None,
            }],
            "errors": state.get("errors", []) + [f"{role}: no agent config provided"],
        }

    prompt = build_specialist_prompt(
        role           = role,
        agent_meta     = agent_meta,
        user_text      = query,
        analysis       = analysis,
        team           = team,
        user_profile   = user_profile,
        search_results = search_results,
    )
    messages = prompt["messages"]

    result = await _call_with_retry(role, cfg, messages)
    output = result["output"]
    usage  = result["token_usage"]
    status = result["status"]

    log.info(
        "[Agents] %s (%s) done — %d chars, status=%s",
        role, agent_meta["name"], len(output), status,
    )

    # Merge into existing state dicts
    specialist_outputs = {**state.get("specialist_outputs", {}), role: output}
    usage_by_role      = {**state.get("usage_by_role", {}), role: usage}
    agent_result: Dict[str, Any] = {
        "role":        role,
        "name":        agent_meta["name"],
        "output":      output,
        "status":      status,
        "token_usage": usage or None,
    }

    return {
        "specialist_outputs": specialist_outputs,
        "usage_by_role":      usage_by_role,
        "agent_results":      state.get("agent_results", []) + [agent_result],
    }


async def reasoner_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node: runs the Reasoner specialist."""
    return await _run_specialist("reasoner", state)


async def coder_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node: runs the Coder specialist."""
    return await _run_specialist("coder", state)


async def vision_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node: runs the Vision specialist."""
    return await _run_specialist("vision", state)


# ─── Writer node ──────────────────────────────────────────────────────────────

async def writer_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: synthesises all specialist outputs into one final answer.
    Runs sequentially after all three specialist nodes complete.
    """
    query            = state["query"]
    analysis         = state["analysis"]
    agent_configs    = state["agent_configs"]
    team             = _team_dict(state.get("team"))
    user_profile     = _profile_dict(state.get("user_profile"))
    persona          = state.get("persona")
    search_results   = state.get("search_results")
    specialist_outputs: Dict[str, str] = state.get("specialist_outputs", {})
    usage_by_role    = dict(state.get("usage_by_role", {}))

    # Trim each specialist output to avoid context-window overflow
    trimmed = {
        role: trim_output(text)
        for role, text in specialist_outputs.items()
    }

    # Deduplicate (pass-through; retained for structural parity with JS)
    deduped = deduplicate_outputs(trimmed)

    # Build quality report for the writer prompt
    quality_report = build_quality_report(deduped, analysis)

    # Extract writer agent meta
    writer_meta = _agent_meta_from_team(team, "writer")
    cfg         = _config_for_role(agent_configs, "writer")

    # Build writer prompt — persona is passed as a string key, resolved internally
    prompt = build_writer_prompt(
        writer_meta        = writer_meta,
        user_text          = query,
        specialist_outputs = deduped,
        analysis           = analysis,
        team               = team,
        persona            = persona,
        user_profile       = user_profile,
        search_results     = search_results,
    )
    messages = prompt["messages"]

    if cfg is None:
        log.error("[Agents] No config for writer — returning fallback answer")
        fallback = build_fallback_answer(deduped, analysis)
        return {
            "writer_output": fallback,
            "writer_usage":  None,
            "errors": state.get("errors", []) + ["writer: no agent config provided"],
        }

    # ── First attempt ────────────────────────────────────────────────────────
    writer_text = ""
    writer_usage: Dict[str, int] = {}
    status = "error"

    try:
        result = await call_agent(
            provider   = cfg["provider"],
            model      = cfg.get("model", ""),
            key        = cfg["key"],
            messages   = messages,
            timeout_ms = cfg.get("timeout_ms") or cfg.get("timeoutMs"),
        )
        writer_text  = result.get("output", "")
        writer_usage = result.get("token_usage", {})
        status = "success"
        log.info("[Agents] Agent 4 (%s) done — %d chars", writer_meta["name"], len(writer_text))
    except Exception as exc:
        log.warning("[Agents] Agent 4 (%s) first call failed: %s — retrying", writer_meta["name"], exc)

    # ── Retry if first call failed or returned empty ──────────────────────────
    if status != "success" or not writer_text.strip():
        log.warning("[Agents] Agent 4 retrying...")
        try:
            result = await call_agent(
                provider   = cfg["provider"],
                model      = cfg.get("model", ""),
                key        = cfg["key"],
                messages   = messages,
                timeout_ms = cfg.get("timeout_ms") or cfg.get("timeoutMs"),
            )
            writer_text  = result.get("output", "")
            writer_usage = result.get("token_usage", {})
            status = "success"
            log.info("[Agents] Agent 4 retry ok — %d chars", len(writer_text))
        except Exception as exc:
            log.error("[Agents] Agent 4 retry failed: %s — using fallback answer", exc)
            if not writer_text.strip():
                writer_text = build_fallback_answer(deduped, analysis)
            writer_usage = {}
            status = "error"

    usage_by_role["writer"] = writer_usage

    writer_result: Dict[str, Any] = {
        "role":        "writer",
        "name":        writer_meta["name"],
        "output":      writer_text,
        "status":      status,
        "token_usage": writer_usage or None,
    }

    return {
        "writer_output":  writer_text,
        "writer_usage":   writer_usage,
        "usage_by_role":  usage_by_role,
        "agent_results":  state.get("agent_results", []) + [writer_result],
    }


# ─── Streaming writer ─────────────────────────────────────────────────────────

async def writer_node_streaming(state: Dict[str, Any]):
    """
    Async generator: streams the writer agent's tokens one chunk at a time.

    Yields dicts:
        {"type": "token",      "chunk": str}
        {"type": "done",       "writer_text": str, "writer_usage": dict,
                               "usage_by_role": dict, "agent_results": list}
        {"type": "error",      "message": str}   — on unrecoverable failure

    The caller is responsible for building the final `agent_results` list that
    includes the specialist entries (accumulated upstream) plus the writer entry
    appended here.
    """
    query            = state["query"]
    analysis         = state["analysis"]
    agent_configs    = state["agent_configs"]
    team             = _team_dict(state.get("team"))
    user_profile     = _profile_dict(state.get("user_profile"))
    persona          = state.get("persona")
    search_results   = state.get("search_results")
    specialist_outputs: Dict[str, str] = state.get("specialist_outputs", {})
    usage_by_role    = dict(state.get("usage_by_role", {}))
    agent_results    = list(state.get("agent_results", []))

    # Trim / deduplicate specialist outputs (same as blocking writer_node)
    from ._utils import trim_output, deduplicate_outputs, build_quality_report, build_fallback_answer
    trimmed        = {role: trim_output(text) for role, text in specialist_outputs.items()}
    deduped        = deduplicate_outputs(trimmed)
    quality_report = build_quality_report(deduped, analysis)  # noqa: F841 (used by prompt builder)

    writer_meta = _agent_meta_from_team(team, "writer")
    cfg         = _config_for_role(agent_configs, "writer")

    if cfg is None:
        log.error("[Agents] No config for writer (streaming) — returning fallback")
        fallback = build_fallback_answer(deduped, analysis)
        yield {"type": "token", "chunk": fallback}
        usage_by_role["writer"] = {}
        writer_result: Dict[str, Any] = {
            "role": "writer", "name": writer_meta["name"],
            "output": fallback, "status": "error", "token_usage": None,
        }
        yield {
            "type": "done",
            "writer_text":   fallback,
            "writer_usage":  {},
            "usage_by_role": usage_by_role,
            "agent_results": agent_results + [writer_result],
        }
        return

    prompt   = build_writer_prompt(
        writer_meta        = writer_meta,
        user_text          = query,
        specialist_outputs = deduped,
        analysis           = analysis,
        team               = team,
        persona            = persona,
        user_profile       = user_profile,
        search_results     = search_results,
    )
    messages = prompt["messages"]

    writer_text  = ""
    writer_usage: Dict[str, int] = {}
    status = "error"

    try:
        async for chunk in stream_agent(
            provider   = cfg["provider"],
            model      = cfg.get("model", ""),
            key        = cfg["key"],
            messages   = messages,
            timeout_ms = cfg.get("timeout_ms") or cfg.get("timeoutMs"),
        ):
            writer_text += chunk
            yield {"type": "token", "chunk": chunk}
        status = "success"
        log.info(
            "[Agents] Agent 4 (%s) streaming done — %d chars",
            writer_meta["name"], len(writer_text),
        )
    except Exception as exc:
        log.warning(
            "[Agents] Agent 4 (%s) streaming failed: %s — retrying blocking",
            writer_meta["name"], exc,
        )
        # Streaming failed mid-way; fall back to a single blocking call so we
        # still get a complete answer — yield whatever was streamed so far as a
        # continuation, then append the rest.
        writer_text_retry = ""
        try:
            result = await call_agent(
                provider   = cfg["provider"],
                model      = cfg.get("model", ""),
                key        = cfg["key"],
                messages   = messages,
                timeout_ms = cfg.get("timeout_ms") or cfg.get("timeoutMs"),
            )
            writer_text_retry = result.get("output", "")
            writer_usage      = result.get("token_usage", {})
            status = "success"
            # Yield the full retry text as one chunk so the frontend gets
            # the complete response.  If partial text was already sent the
            # frontend will concatenate it — send only the remainder.
            remainder = writer_text_retry[len(writer_text):]
            if remainder:
                yield {"type": "token", "chunk": remainder}
            writer_text = writer_text_retry
        except Exception as exc2:
            log.error("[Agents] Agent 4 retry also failed: %s", exc2)
            if not writer_text.strip():
                writer_text = build_fallback_answer(deduped, analysis)
                yield {"type": "token", "chunk": writer_text}

    usage_by_role["writer"] = writer_usage

    writer_result_final: Dict[str, Any] = {
        "role":        "writer",
        "name":        writer_meta["name"],
        "output":      writer_text,
        "status":      status,
        "token_usage": writer_usage or None,
    }

    yield {
        "type":          "done",
        "writer_text":   writer_text,
        "writer_usage":  writer_usage,
        "usage_by_role": usage_by_role,
        "agent_results": agent_results + [writer_result_final],
    }
