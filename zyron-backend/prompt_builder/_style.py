"""
_style.py
Response-style and domain-discipline helpers.

Ported from src/agents/prompts/promptBuilder.js:
  - buildStyleInstruction()
  - buildNonTechDiscipline()
"""

from __future__ import annotations


# ─── Response style instruction ───────────────────────────────────────────────

def build_style_instruction(verbosity_level: str = "simple") -> str:
    """
    Returns a clear language/format mandate based on verbosity level.

    simple   → plain everyday English, short paragraphs, bullets where useful
    detailed → advanced technical/research-level English, full depth allowed
    """
    if verbosity_level == "detailed":
        return (
            "\n## Response Language & Format (MANDATORY)\n"
            "The user wants deep, thorough detail. Write as much as the topic genuinely requires — do NOT cut short.\n"
            "- Use clear vocabulary with brief explanations for any specialist term.\n"
            "- Show full arguments, derivations, and structured reasoning where needed — never truncate.\n"
            "- Break long answers into clearly labeled sections (##, ###).\n"
            "- Use numbered lists or bullets for multi-item enumerations.\n"
            "- Bold key terms on first use.\n"
            "- No padding or filler — every sentence must carry real information.\n"
            "- Vary rhythm: mix short punchy sentences with detailed paragraphs."
        )

    # Default: simple mode
    return (
        "\n## Response Language & Format (MANDATORY)\n"
        "Write in **plain, everyday English** — like a knowledgeable friend explaining clearly, not a textbook.\n\n"
        "Rules:\n"
        "- Short sentences. Plain words. No jargon unless you immediately explain it.\n"
        "- Small focused paragraphs (2–4 sentences each).\n"
        "- Bullet points or numbered lists for 3+ items, steps, or options.\n"
        "- **Bold** the most important point in each section.\n"
        "- No walls of unbroken text.\n"
        "- No academic filler phrases (\"it is worth noting\", \"heretofore\", \"notwithstanding\").\n"
        "- Write as long as the question genuinely needs — never cut a complete answer short, never pad a short one."
    )


# ─── Non-tech domain guard ─────────────────────────────────────────────────────

def build_non_tech_discipline(analysis: dict, team_id: str) -> str:
    """
    Returns a strict "no code / no tech-language" discipline block for agents
    operating in domains where code is irrelevant.

    Only injected when the query is NOT a coding task and the team is NOT
    the Coders or Dev Core engineering teams.
    """
    needs_code   = analysis.get("needs_code", False)
    needs_math   = analysis.get("needs_math", False)
    primary_type = analysis.get("primary_type", "general")

    # Coding and Dev-Core teams always write code — no guard needed
    is_coding_team = team_id in ("coders", "dev-core")
    if is_coding_team or needs_code:
        return ""

    # Math/science: allow equations but never code
    if needs_math or primary_type == "stem":
        return (
            "\n## Domain Discipline (MANDATORY)\n"
            "This is a **science/mathematics** question.\n"
            "- Write in plain, human-readable language. Use equations where they genuinely clarify.\n"
            "- **Do NOT include code, programming syntax, or software examples** unless the user explicitly asked for them.\n"
            "- Your audience is a curious person who wants to understand, not a developer.\n"
            "- Every explanation must be accessible — build understanding step by step using real-world language."
        )

    # All other non-coding domains: creative, writing, analytical, history, financial, legal, general
    return (
        "\n## Domain Discipline (MANDATORY)\n"
        "This is **not a coding or software question**.\n"
        "- **Do NOT include code, programming syntax, technical implementations, or developer-speak** of any kind.\n"
        "- Do NOT use analogies to software, APIs, functions, or systems unless the user's own question used those words.\n"
        "- Write like an expert in **this domain** — use the vocabulary, examples, and reasoning style that belongs to the subject matter.\n"
        "- Your response must be fully understandable to someone with no technical background.\n"
        "- Be as thorough and detailed as the question deserves — length should match the depth of the answer, not be artificially limited."
    )
