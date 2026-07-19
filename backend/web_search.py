"""
backend/web_search.py
─────────────────────────────────────────────────────────────────────────────
Web search with automatic Tavily → Serper fallback chain.

Called by main.py (via run_pipeline) before the LangGraph pipeline executes.

Output shape (same as frontend):
{
  "summary":     str,              -- 2-3 sentence overview
  "key_facts":   list[str],        -- up to 5 distilled facts
  "sources":     list[{title, url, snippet}],
  "searched_at": str,              -- ISO 8601 timestamp
}

Returns None if both providers fail or return no results — completely silent.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

log = logging.getLogger("zyron.web_search")

SEARCH_TIMEOUT_S = 3.0          # hard timeout per provider call
MAX_SOURCES      = 5             # max results to surface


# ─── Result formatters ────────────────────────────────────────────────────────

def _format_tavily(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Convert raw Tavily response → clean structured result."""
    if not raw or not isinstance(raw, dict):
        return None

    results: List[Dict] = raw.get("results", [])[:MAX_SOURCES]

    tavily_answer: str = raw.get("answer", "")

    sources = [
        {
            "title":   r.get("title", ""),
            "url":     r.get("url", ""),
            "snippet": r.get("content", r.get("snippet", "")),
        }
        for r in results
        if r.get("title") or r.get("url")
    ]

    key_facts = [
        r.get("content", "").strip()
        for r in results
        if r.get("content", "").strip()
    ][:5]

    summary = (
        tavily_answer.strip()
        or " ".join(key_facts[:2])[:400]
        or ""
    )

    if not summary and not sources:
        return None

    return {
        "summary":     summary,
        "key_facts":   key_facts,
        "sources":     sources,
        "searched_at": datetime.now(timezone.utc).isoformat(),
    }


def _format_serper(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Convert raw Serper response → clean structured result."""
    if not raw or not isinstance(raw, dict):
        return None

    organic: List[Dict]   = raw.get("organic", [])[:MAX_SOURCES]
    answer_box: Dict      = raw.get("answerBox", {}) or {}
    kg: Dict              = raw.get("knowledgeGraph", {}) or {}

    sources = [
        {
            "title":   r.get("title", ""),
            "url":     r.get("link", ""),
            "snippet": r.get("snippet", ""),
        }
        for r in organic
        if r.get("title") or r.get("link")
    ]

    key_facts = [
        r.get("snippet", "").strip()
        for r in organic
        if r.get("snippet", "").strip()
    ][:5]

    summary = (
        answer_box.get("answer")
        or answer_box.get("snippet")
        or kg.get("description")
        or " ".join(key_facts[:2])[:400]
        or ""
    )
    summary = (summary or "").strip()

    if not summary and not sources:
        return None

    return {
        "summary":     summary,
        "key_facts":   key_facts,
        "sources":     sources,
        "searched_at": datetime.now(timezone.utc).isoformat(),
    }


# ─── Provider calls ───────────────────────────────────────────────────────────

async def _search_tavily(query: str) -> Optional[Dict[str, Any]]:
    api_key = os.environ.get("TAVILY_API_KEY", "")
    if not api_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=SEARCH_TIMEOUT_S) as client:
            res = await client.post(
                "https://api.tavily.com/search",
                headers={
                    "Content-Type":  "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                json={
                    "query":          query,
                    "search_depth":   "basic",
                    "max_results":    MAX_SOURCES,
                    "include_answer": True,
                },
            )
        if not res.is_success:
            return None
        return _format_tavily(res.json())
    except Exception:
        return None


async def _search_serper(query: str) -> Optional[Dict[str, Any]]:
    api_key = os.environ.get("SERPER_API_KEY", "")
    if not api_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=SEARCH_TIMEOUT_S) as client:
            res = await client.post(
                "https://google.serper.dev/search",
                headers={
                    "Content-Type": "application/json",
                    "X-API-KEY":    api_key,
                },
                json={"q": query, "num": MAX_SOURCES},
            )
        if not res.is_success:
            return None
        return _format_serper(res.json())
    except Exception:
        return None


# ─── Public entry point ───────────────────────────────────────────────────────

async def run_web_search(query: str) -> Optional[Dict[str, Any]]:
    """
    Run web search with Tavily → Serper fallback.

    Returns a clean structured result dict, or None if both providers fail or
    return no results.  Never raises.
    """
    if not query or not query.strip():
        return None

    print(f"[WebSearch] Query received: {query}")

    # ── Tavily first ──────────────────────────────────────────────────────────
    print(f"[WebSearch] Trying Tavily...")
    try:
        result = await asyncio.wait_for(_search_tavily(query), timeout=SEARCH_TIMEOUT_S)
        if result:
            print(f"[WebSearch] Tavily success: {result}")
            log.info("[WebSearch] Tavily returned %d sources", len(result.get("sources", [])))
            return result
    except Exception:
        pass

    # ── Serper fallback ───────────────────────────────────────────────────────
    print(f"[WebSearch] Tavily failed, trying Serper...")
    try:
        result = await asyncio.wait_for(_search_serper(query), timeout=SEARCH_TIMEOUT_S)
        if result:
            print(f"[WebSearch] Serper success: {result}")
            log.info("[WebSearch] Serper returned %d sources", len(result.get("sources", [])))
            return result
    except Exception:
        pass

    # ── Both failed ───────────────────────────────────────────────────────────
    print(f"[WebSearch] Both providers failed — using model knowledge")
    log.debug("[WebSearch] Both providers returned nothing — agents use own knowledge")
    return None
