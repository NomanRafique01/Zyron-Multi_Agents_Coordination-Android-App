"""
_state.py
ZyronState — the single TypedDict that flows through the LangGraph pipeline.

Every node reads from and writes into this dict.  LangGraph merges partial
updates returned by each node so fields NOT returned by a node are preserved.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from typing_extensions import TypedDict


class AgentResultDict(TypedDict, total=False):
    """Serialisable representation of one agent's result (maps to models.AgentResult)."""
    role:        str
    name:        str
    output:      str
    status:      str   # "success" | "error" | "timeout"
    token_usage: Optional[Dict[str, int]]


class ZyronState(TypedDict, total=False):
    # ── Inputs ────────────────────────────────────────────────────────────────
    query:          str                          # raw user query
    analysis:       Dict[str, Any]               # result of analyze_query()
    team:           Optional[Dict[str, Any]]     # Team dict (from models.Team)
    agent_configs:  Dict[str, Any]               # role → AgentConfig dict
    user_profile:   Optional[Dict[str, Any]]     # UserProfile dict
    persona:        Optional[str]                # e.g. "creative" | "precise"
    search_results:   Optional[Dict[str, Any]]   # web search result from web_search.py
    document_context: Optional[Dict[str, Any]]   # uploaded doc { text, filename }

    # ── Conversation memory ───────────────────────────────────────────────────
    session_id:           Optional[str]          # opaque client-supplied session key
    conversation_summary: Optional[str]          # ~50-token SQLite-backed history digest

    # ── Specialist outputs ────────────────────────────────────────────────────
    specialist_outputs: Dict[str, str]           # role → raw text
    agent_results:      List[AgentResultDict]    # accumulated per-agent result dicts

    # ── Writer output ─────────────────────────────────────────────────────────
    writer_output:  str
    writer_usage:   Optional[Dict[str, int]]

    # ── Aggregate token accounting ────────────────────────────────────────────
    usage_by_role:  Dict[str, Dict[str, int]]   # role → {prompt_tokens, completion_tokens, total_tokens}

    # ── Error log ────────────────────────────────────────────────────────────
    errors:         List[str]
