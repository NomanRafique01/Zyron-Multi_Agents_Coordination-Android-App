"""
main.py
FastAPI entry point for the Zyron backend.

Endpoints
---------
GET  /health       — liveness probe (Render, Railway, Fly.io)
POST /orchestrate  — run the full multi-agent LangGraph pipeline
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, List

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from models import (
    AgentResult,
    DocumentExtractRequest,
    DocumentExtractResponse,
    OrchestrateRequest,
    OrchestrateResponse,
)
from document_extractor import extract_text
from orchestrator import run_pipeline
from db.sqlite import init_db
from memory.summarizer import maybe_summarize

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("zyron.main")

# ─── Startup ──────────────────────────────────────────────────────────────────
async def _startup() -> None:
    """Initialise the SQLite conversation-memory database."""
    await init_db()

app = FastAPI(
    title="Zyron Backend",
    description=(
        "Multi-agent AI pipeline backend for Zyron. "
        "Accepts a user query and agent configurations, "
        "runs three specialist agents in parallel, "
        "then synthesises a final answer via the writer agent."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    on_startup=[_startup],
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# Allow all origins — the client is a mobile app (Expo / React Native) so
# there is no fixed origin to whitelist.  Tighten this if a web client is added.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,   # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global exception handler ─────────────────────────────────────────────────
@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {exc}"},
    )


# ─── Health ───────────────────────────────────────────────────────────────────
@app.get(
    "/health",
    summary="Liveness probe",
    tags=["infra"],
    response_description="Returns {status: ok} when the server is ready.",
)
async def health() -> Dict[str, str]:
    """
    Lightweight liveness probe used by Render / Railway / Fly.io to confirm
    the container is alive.  No database or provider calls are made.
    """
    return {"status": "ok"}


# ─── Extract document ─────────────────────────────────────────────────────────
@app.post(
    "/extract-document",
    response_model=DocumentExtractResponse,
    summary="Extract plain text from an uploaded document",
    tags=["documents"],
    response_description="Extracted text, success flag, and optional error message.",
)
async def extract_document(body: DocumentExtractRequest) -> DocumentExtractResponse:
    """
    Accept a base64-encoded file and return its plain-text content.

    Supports PDF (via pdfminer.six), DOCX (via python-docx), and TXT.
    """
    log.info("POST /extract-document  filename=%r  mime=%r", body.filename, body.mimeType)
    result = extract_text(body.filename, body.base64Data, body.mimeType)
    return DocumentExtractResponse(
        text=result["text"],
        success=result["success"],
        error=result["error"],
    )


# ─── Orchestrate ──────────────────────────────────────────────────────────────
@app.post(
    "/orchestrate",
    response_model=OrchestrateResponse,
    summary="Run the multi-agent pipeline",
    tags=["agents"],
    response_description="Final synthesised answer plus per-agent results and token usage.",
)
async def orchestrate(body: OrchestrateRequest) -> OrchestrateResponse:
    """
    Run the full Zyron pipeline for a single user query.

    **Flow**
    1. `analyze_query()` — classify intent, verbosity, and complexity.
    2. Three specialist agents run **in parallel** (reasoner, coder, vision).
       Each builds a focused prompt via `build_specialist_prompt()` and calls
       the configured AI provider.  If an agent returns < 10 characters it is
       automatically retried once.
    3. The writer agent synthesises all specialist outputs into one final answer
       via `build_writer_prompt()`.  It also retries once on failure and falls
       back to the best specialist output when both attempts fail.

    **Request body**
    - `query` — the user's raw input text (required).
    - `agentConfigs` — map of role → provider/model/key (required).
      Missing roles fall back to the writer config.
    - `team` — active team definition; drives specialist directives and
      analysis bias (optional).
    - `persona` — synthesis style: balanced | creative | precise |
      educator | executive (optional, default balanced).
    - `userProfile` — personalisation hints injected into prompts (optional).

    **Response**
    - `text` — final writer answer (markdown).
    - `agents` — per-agent results: role, name, output, status, tokenUsage.
    - `tokenUsage` — aggregate counts keyed by agent display name.
    - `meta` — query analysis flags, elapsed time in ms, any error messages.
    """
    log.info("POST /orchestrate  query=%r", body.query[:120])

    # Convert pydantic AgentConfig models → plain dicts for the pipeline.
    # The pipeline and prompt_builder work with plain dicts throughout so we
    # never import pydantic models deeper than this file.
    agent_configs_dict: Dict[str, Any] = {
        role: cfg.model_dump()
        for role, cfg in body.agent_configs.items()
    }

    try:
        result = await run_pipeline(
            query             = body.query,
            agent_configs     = agent_configs_dict,
            team              = body.team,             # pass pydantic model; _nodes.py normalises it
            persona           = body.persona,
            user_profile      = body.user_profile,     # same
            search_results    = body.search_results,   # forwarded from frontend; skips backend search
            document_context  = body.document_context, # user-uploaded doc text; injected into all prompts
            session_id        = body.session_id,       # conversation memory session key
        )
    except Exception as exc:
        log.exception("Pipeline failed for query=%r", body.query[:80])
        return JSONResponse(                     # type: ignore[return-value]
            status_code=500,
            content={"detail": f"Pipeline error: {exc}"},
        )

    # ── Async post-processing: summarize conversation if threshold reached ────
    # Fired after the response is assembled so it never slows down the reply.
    # We reconstruct a minimal messages list from the request + the writer answer
    # so the summarizer can count and compress turns without a separate DB read.
    if body.session_id:
        _messages_for_summary = []
        _messages_for_summary.append({"sender": "user", "text": body.query})
        _writer_text = result.get("text", "")
        if _writer_text:
            _messages_for_summary.append({"sender": "ai", "text": _writer_text})
        # maybe_summarize is a fire-and-forget task — errors are caught inside
        asyncio.create_task(
            maybe_summarize(body.session_id, _messages_for_summary, agent_configs_dict)
        )

    # ── Map raw agent_results dicts → AgentResult pydantic models ────────────
    agents: List[AgentResult] = []
    for raw in result.get("agents", []):
        agents.append(
            AgentResult(
                role        = raw.get("role", ""),
                name        = raw.get("name", ""),
                output      = raw.get("output", ""),
                status      = raw.get("status", "success"),
                token_usage = raw.get("token_usage"),
            )
        )

    return OrchestrateResponse(
        text        = result.get("text", ""),
        agents      = agents,
        token_usage = result.get("token_usage"),
        meta        = result.get("meta"),
    )


# ─── Uvicorn entry point ──────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    log.info("Starting Zyron backend on 0.0.0.0:%d", port)
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info",
        # Keep HTTP connections alive long enough for complex multi-agent
        # queries (target ≤ 120 s client-side).  Default is 5 s which would
        # cause Railway / nginx to close the socket mid-response.
        timeout_keep_alive=130,
    )
