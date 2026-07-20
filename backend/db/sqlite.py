"""
db/sqlite.py
SQLite persistence layer for Zyron — conversation summaries.

Schema (single table: conversation_summaries):
  session_id  TEXT PRIMARY KEY
  summary     TEXT NOT NULL        — ~50-token compressed context
  updated_at  INTEGER NOT NULL     — Unix ms timestamp

Public API
----------
  init_db()                        — create table if not exists (called on startup)
  save_summary(session_id, text)   — upsert a summary for a session
  get_summary(session_id)          — fetch the latest summary or None
"""

from __future__ import annotations

import logging
import os
import time
from typing import Optional

import aiosqlite

log = logging.getLogger(__name__)

# Place the database file in a writable directory.
# On Railway, /tmp is always writable.  Fallback to a local path in dev.
_DB_PATH = os.environ.get("ZYRON_DB_PATH", "/tmp/zyron_memory.db")


async def init_db() -> None:
    """Create the conversation_summaries table if it does not exist."""
    try:
        async with aiosqlite.connect(_DB_PATH) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS conversation_summaries (
                    session_id  TEXT    PRIMARY KEY,
                    summary     TEXT    NOT NULL DEFAULT '',
                    updated_at  INTEGER NOT NULL DEFAULT 0
                )
            """)
            await db.commit()
        log.info("[SQLite] DB initialised at %s", _DB_PATH)
    except Exception as exc:
        log.warning("[SQLite] init_db failed (non-fatal): %s", exc)


async def save_summary(session_id: str, summary: str) -> None:
    """
    Upsert the compressed conversation summary for a session.

    Parameters
    ----------
    session_id : unique session identifier forwarded from the frontend
    summary    : ~50-token compressed text produced by the summarizer
    """
    if not session_id or not summary:
        return
    try:
        async with aiosqlite.connect(_DB_PATH) as db:
            await db.execute(
                """
                INSERT INTO conversation_summaries (session_id, summary, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE
                    SET summary    = excluded.summary,
                        updated_at = excluded.updated_at
                """,
                (session_id, summary.strip(), int(time.time() * 1000)),
            )
            await db.commit()
        log.debug("[SQLite] Saved summary for session=%r (%d chars)", session_id, len(summary))
    except Exception as exc:
        log.warning("[SQLite] save_summary failed (non-fatal): %s", exc)


async def get_summary(session_id: str) -> Optional[str]:
    """
    Fetch the latest conversation summary for a session.

    Returns
    -------
    The summary string, or None if no summary exists yet.
    """
    if not session_id:
        return None
    try:
        async with aiosqlite.connect(_DB_PATH) as db:
            async with db.execute(
                "SELECT summary FROM conversation_summaries WHERE session_id = ?",
                (session_id,),
            ) as cursor:
                row = await cursor.fetchone()
        if row:
            log.debug("[SQLite] Loaded summary for session=%r (%d chars)", session_id, len(row[0]))
            return row[0] or None
        return None
    except Exception as exc:
        log.warning("[SQLite] get_summary failed (non-fatal): %s", exc)
        return None
