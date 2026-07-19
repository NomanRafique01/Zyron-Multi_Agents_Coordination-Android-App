"""
_pipeline.py
Public entry point for the Zyron LangGraph pipeline.

run_pipeline() is the Python equivalent of runAgentsOrchestrator() in JS.
It wires the query analysis, builds the initial ZyronState, invokes the
compiled graph, and returns a structured result dict.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

from query_analyzer import analyze_query
from web_search     import run_web_search

from ._graph import _compiled_graph
from ._utils import build_token_usage

log = logging.getLogger(__name__)


async def run_pipeline(
    query:          str,
    agent_configs:  Dict[str, Any],
    team:           Optional[Any] = None,
    persona:        Optional[str] = None,
    user_profile:   Optional[Any] = None,
    search_results: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Run the full Zyron multi-agent pipeline.

    Parameters
    ----------
    query         : Raw user query string.
    agent_configs : Dict mapping role → AgentConfig (pydantic model or plain dict).
                    Keys: "reasoner", "coder", "vision", "writer".
                    Roles missing from the dict fall back to the writer config.
    team          : Team pydantic model or plain dict. Drives specialist directives
                    and analysis bias. Optional.
    persona       : Persona key — "balanced" | "creative" | "precise" |
                    "educator" | "executive". Optional.
    user_profile  : UserProfile pydantic model or plain dict. Optional.

    Returns
    -------
    {
        "text":        str,                  # final writer answer
        "agents":      List[dict],           # per-agent result dicts
        "token_usage": Dict[str, dict],      # keyed by agent display name
        "meta":        dict,                 # analysis flags + timing
    }
    """
    t_start = time.monotonic()

    # ── 1. Query analysis ─────────────────────────────────────────────────────
    # Pull analysisBias from the team if present
    analysis_bias: Optional[Dict] = None
    if team is not None:
        if hasattr(team, "analysis_bias"):
            analysis_bias = team.analysis_bias
        elif isinstance(team, dict):
            analysis_bias = team.get("analysis_bias") or team.get("analysisBias")

    analysis = analyze_query(query, analysis_bias)
    log.info(
        "[Pipeline] query=%r primary_type=%s complexity=%s verbosity=%s",
        query[:80], analysis["primary_type"], analysis["complexity"], analysis["verbosity_level"],
    )

    # ── 1b. Web search (fires before the LangGraph pipeline) ─────────────────
    # If the frontend already performed a search and forwarded the result, use
    # it directly — no need for a duplicate network round-trip.
    # Otherwise, run the backend's own Tavily → Serper fallback chain when the
    # query analysis flags real-time data as needed.
    search_provider: str = "none"
    if search_results is not None:
        log.info("[Pipeline] Using frontend search results — skipping backend search")
        print("[Pipeline] Using frontend search results — skipping backend search")
        search_provider = "used"
    elif analysis.get("needs_web_search") and analysis.get("web_search_query"):
        web_query = analysis["web_search_query"]
        log.info("[Pipeline] Web search triggered — query=%r", web_query[:100])
        search_results = await run_web_search(web_query)
        if search_results:
            sources = search_results.get("sources", [])
            log.info("[Pipeline] Backend web search returned %d sources", len(sources))
            search_provider = "used"
        else:
            log.debug("[Pipeline] Web search returned no results — agents use own knowledge")
        print(f"[Pipeline] Backend ran its own search — results: {search_results is not None}")

    print(f"[Pipeline] search_results being passed to state: {search_results is not None}")

    # ── 2. Build initial ZyronState ───────────────────────────────────────────
    initial_state: Dict[str, Any] = {
        "query":               query,
        "analysis":            analysis,
        "team":                team,
        "agent_configs":       agent_configs,
        "user_profile":        user_profile,
        "persona":             persona,
        "search_results":      search_results,
        "specialist_outputs":  {},
        "agent_results":       [],
        "writer_output":       "",
        "writer_usage":        None,
        "usage_by_role":       {},
        "errors":              [],
    }

    # ── 3. Run graph ──────────────────────────────────────────────────────────
    try:
        final_state: Dict[str, Any] = await _compiled_graph.ainvoke(initial_state)
    except Exception as exc:
        log.exception("[Pipeline] Graph crashed: %s", exc)
        return {
            "text":        "",
            "agents":      [],
            "token_usage": {},
            "meta": {
                "analysis":      analysis,
                "elapsed_ms":    int((time.monotonic() - t_start) * 1000),
                "errors":        [str(exc)],
            },
        }

    # ── 4. Assemble response ──────────────────────────────────────────────────
    elapsed_ms = int((time.monotonic() - t_start) * 1000)

    agent_results: List[Dict[str, Any]] = final_state.get("agent_results", [])
    usage_by_role: Dict[str, Any]       = final_state.get("usage_by_role", {})
    errors:        List[str]            = final_state.get("errors", [])
    writer_output: str                  = final_state.get("writer_output", "")

    token_usage = build_token_usage(agent_results, usage_by_role)

    log.info(
        "[Pipeline] done — writer=%d chars, elapsed=%dms, errors=%d",
        len(writer_output), elapsed_ms, len(errors),
    )

    return {
        "text":   writer_output,
        "agents": agent_results,
        "token_usage": token_usage,
        "meta": {
            "analysis":        analysis,
            "elapsed_ms":      elapsed_ms,
            "errors":          errors,
            "web_search_used": search_provider != "none",
            "search_provider": search_provider,
        },
    }
