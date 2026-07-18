# ─── Zyron Backend — Dockerfile ───────────────────────────────────────────────
# python:3.11-slim keeps the image small while matching the language version
# used during development.  All dependencies are pinned in requirements.txt.

FROM python:3.11-slim

# Prevents Python from writing .pyc files and enables unbuffered stdout/stderr
# so container logs appear immediately without buffering.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# ── Install dependencies first (cached layer unless requirements.txt changes) ─
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# ── Copy application source ───────────────────────────────────────────────────
COPY main.py          .
COPY models.py        .
COPY providers.py     .
COPY query_analyzer.py .
COPY orchestrator.py  .
COPY orchestrator/    ./orchestrator/
COPY prompt_builder.py .
COPY prompt_builder/   ./prompt_builder/

# ── Runtime ───────────────────────────────────────────────────────────────────
EXPOSE 8000

# $PORT is injected by Render / Railway / Fly.io at runtime.
# We fall back to 8000 so `docker run` works without extra flags.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
