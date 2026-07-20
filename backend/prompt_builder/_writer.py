"""
_writer.py
Writer / synthesizer prompt builder.

Ported from src/agents/prompts/promptBuilder.js:
  - buildWriterPrompt()

Public API
----------
build_writer_prompt(writer_meta, user_text, specialist_outputs, analysis, team,
                    persona, user_profile)
    -> {"messages": [...]}
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from ._style        import build_style_instruction
from ._user_profile import build_user_profile_instruction
from ._specialist   import _build_web_search_context_block, _build_document_context_block


# ─── Persona instructions (mirrors teamMetadata.js PERSONA_INSTRUCTIONS) ─────

_PERSONA_INSTRUCTIONS: Dict[str, str] = {
    "balanced": "",

    "creative": """

## Persona: Creative Explorer
Explore unconventional angles, challenge the obvious interpretation, and write with intellectual energy. Offer alternative framings when they illuminate. Favor vivid language over safe generalities. Make the response memorable — not just correct.""",

    "precise": """

## Persona: Precision Enforcer
Every claim must be exact. Enforce strict correctness — if something is nuanced, say so explicitly. Eliminate filler, hedge words, and imprecise language. Use concrete numbers, names, and specifications wherever possible. Structure is paramount: prefer numbered steps and defined terms over flowing prose when precision demands it.""",

    "educator": """

## Persona: Expert Educator
Build understanding progressively — never assume the reader already knows. Start from a clear foundation, layer complexity one level at a time, use at least one concrete analogy or example per major concept. Prioritize insight transfer over impression.""",

    "executive": """

## Persona: Executive Briefing
Lead with the single most important conclusion or recommendation in the first sentence. Maximum three focused paragraphs. No jargon — write for a senior decision-maker who has 90 seconds. End with a one-line **Action:** or **Decision:** the reader must make. Cut everything that doesn't serve that outcome.""",
}


def _get_persona_instruction(persona: Optional[str]) -> str:
    if not persona:
        return ""
    return _PERSONA_INSTRUCTIONS.get(persona, "")


# ─── Pure-greeting regex (mirrors the JS isPureGreeting check) ───────────────

_GREETING_RE = re.compile(
    r"^\s*(hi|hello|hey|yo|sup|hiya|howdy|greetings|salut|hola|oi|hai)\s*[!.]*\s*$",
    re.IGNORECASE,
)


# ─── Public: build_writer_prompt ─────────────────────────────────────────────

def build_writer_prompt(
    writer_meta: dict,
    user_text: str,
    specialist_outputs: Dict[str, str],
    analysis: dict,
    team: Optional[dict] = None,
    persona: Optional[str] = None,
    user_profile: Optional[dict] = None,
    search_results: Optional[dict] = None,
    document_context: Optional[dict] = None,
) -> Dict[str, Any]:
    """
    Build the writer / synthesizer prompt.

    Parameters
    ----------
    writer_meta         : dict — name (writer agent display name)
    user_text           : raw user query string
    specialist_outputs  : {"reasoner": str, "coder": str, "vision": str}
    analysis            : result of analyze_query()
    team                : Team dict from models.Team (optional)
    persona             : persona key — balanced | creative | precise | educator | executive
    user_profile        : UserProfile dict (optional)
    search_results      : clean web search result dict (optional)
    document_context    : { text, filename } from user document upload (optional)

    Returns
    -------
    {"messages": [{"role": "user", "content": ...}]}
    """
    team            = team or {}
    team_id: str    = team.get("id", "")
    team_name: str  = team.get("name", "Zyron")

    writer_name: str = writer_meta.get("name", "Writer")

    # ── Pure greeting short-circuit ───────────────────────────────────────────
    greeting_reply: Optional[str] = team.get("greeting_reply")
    if _GREETING_RE.match(user_text) and greeting_reply:
        return {
            "messages": [{
                "role": "user",
                "content": (
                    f"You are **{writer_name}** for the **\"{team_name}\"** team.\n\n"
                    f"The user said: \"{user_text}\"\n\n"
                    "Reply with EXACTLY the following greeting — do not add anything, "
                    "do not change the wording, do not add headers or bullets:\n\n"
                    f"{greeting_reply}"
                ),
            }]
        }

    # ── Build per-agent section blocks ────────────────────────────────────────
    # Agent display labels: use agent name from team agents if available
    team_agents: dict = team.get("agents", {})

    def _label(role: str) -> str:
        agent = team_agents.get(role)
        if isinstance(agent, dict):
            return agent.get("name", role)
        return role

    non_empty: List[tuple[str, str]] = [
        (role, text)
        for role, text in specialist_outputs.items()
        if text and text.strip()
    ]

    output_lines = "\n\n".join(
        f"### ⬛ {_label(role).upper()} CONTRIBUTION\n{text}"
        for role, text in non_empty
    )

    # Mandatory coverage checklist
    agent_checklist = "\n".join(
        f"- [ ] **{_label(role)}** — weave their specific substance into the answer"
        for role, _ in non_empty
    )

    # Missing-agent warning
    missing_agents = [
        r for r in ("reasoner", "coder", "vision")
        if not specialist_outputs.get(r, "").strip()
    ]
    missing_note = (
        f"\n⚠️ WARNING: The following agents produced no output and cannot contribute: "
        f"{', '.join(_label(r) for r in missing_agents)}. Cover their angle yourself from the query."
        if missing_agents else ""
    )

    # ── Style / format rules ──────────────────────────────────────────────────
    style_instruction = build_style_instruction(analysis.get("verbosity_level", "simple"))

    is_coding_team = team_id in ("coders", "financers")
    needs_code  = analysis.get("needs_code", False)
    needs_math  = analysis.get("needs_math", False)
    needs_table = analysis.get("needs_table", False)

    table_rule = (
        "Where tabular comparison genuinely helps, use a markdown table with | pipes and --- separators. Label all columns."
        if needs_table
        else "Do NOT add markdown tables unless the user explicitly requested tabular comparison."
    )

    if needs_code:
        code_rule = (
            "All code MUST appear in properly labeled fenced blocks (```language). "
            "Preserve ALL code from the Coder — never paraphrase it."
        )
    elif is_coding_team:
        code_rule = "Code blocks only if the Coder specialist provided essential code. Do not introduce new code."
    else:
        code_rule = (
            "Do NOT include code blocks or programming syntax. "
            "This is not a coding question — respond in clear, human-readable prose appropriate to the domain."
        )

    math_rule = (
        "Preserve ALL LaTeX notation from specialist outputs. "
        "Use \\( ... \\) for inline and \\[ ... \\] for display math. "
        "Never convert equations to plain text."
        if needs_math else ""
    )

    # ── Length guidance ───────────────────────────────────────────────────────
    is_conversational = analysis.get("is_conversational", False)
    word_count        = analysis.get("word_count", 99)
    complexity        = analysis.get("complexity", "medium")
    response_length   = analysis.get("response_length", "MEDIUM")

    if response_length == "SHORT":
        length_guidance = "Short answer — reply in 1-3 sentences. Be direct and natural. No headers, no lists unless they genuinely help."
    elif response_length == "LONG":
        length_guidance = "Full comprehensive answer — be as thorough and detailed as the topic demands. Never cut anything short. Use headers to separate genuinely distinct sections."
    elif is_conversational and word_count <= 15:
        length_guidance = "Short conversational query — keep it natural and direct. Skip heavy headers and lists unless they genuinely help."
    elif complexity == "high":
        length_guidance = "Complex request — write as thoroughly as the topic demands. Use headers to separate genuinely distinct sections. Never truncate a complete answer."
    elif complexity == "medium":
        length_guidance = "Balanced depth — cover what matters fully. Add headers only when 3+ distinct sections exist."
    else:
        length_guidance = "Be as long or short as the answer genuinely needs. No padding, no artificial truncation."

    # ── Agent-meta override ───────────────────────────────────────────────────
    is_agents_meta: bool = analysis.get("is_agents_meta", False)
    if is_agents_meta:
        agent_override = (
            f"The user is asking about Zyron's agent system. Briefly explain how the "
            f"\"{team_name}\" works: name each specialist and their role, explain how they "
            "collaborate in parallel, then how the synthesizer unifies their outputs. "
            "Then answer the original question substantively."
        )
    else:
        agent_override = (
            "Do NOT mention agents, roles, the agent pipeline, or \"my team\" — "
            "write as one unified expert voice."
        )

    # ── Optional team writer rules and persona ────────────────────────────────
    writer_rules: str    = team.get("writer_rules") or ""
    team_writer_block    = f"\n\n## Team Synthesis Style\n{writer_rules}" if writer_rules else ""

    persona_instruction  = _get_persona_instruction(persona)
    profile_instruction  = build_user_profile_instruction(user_profile)

    # ── Assemble system prompt ────────────────────────────────────────────────
    web_search_block = _build_web_search_context_block(search_results)
    doc_context_block = _build_document_context_block(document_context)
    prefix = (
        (doc_context_block + "\n\n") if doc_context_block else ""
    ) + (
        (web_search_block + "\n\n") if web_search_block else ""
    )

    system = (
        prefix +
        f"You are **{writer_name}**, the final synthesizer for the **\"{team_name}\"** team. "
        "Your job is to write one clear, complete answer that a real human can read and immediately understand.\n\n"

        "## User's Question\n"
        f"\"{user_text}\"\n\n"

        "## Specialist Research\n"
        "Your three specialists approached this from different angles. "
        "Weave their findings into ONE unified answer — not three sections pasted together.\n"
        f"{output_lines or '*(No specialist inputs — answer directly from the question with full expert depth.)*'}\n"
        f"{missing_note}\n\n"

        "## What to cover\n"
        f"{agent_checklist or '*(Cover the full question from first principles.)*'}\n\n"
        "Blend these angles naturally. The logic from the Reasoner should connect with the Coder's "
        "concrete detail, and the Vision agent's perspective should frame or close the answer. "
        "The reader should feel they got one expert, not a committee.\n\n"

        "## How to write it\n"
        "1. **Jump straight in** — no preamble. Never open with \"Here is...\", \"Based on...\", "
        "\"Sure!\", \"Great question!\", \"Of course\", or any filler.\n"
        "2. **Keep every specialist's real substance** — if Coder gave code, include it. "
        "If Reasoner derived a formula, include it. If Vision gave a useful analogy or critique, include it. "
        "Don't replace actual content with summaries.\n"
        "3. **Merge overlapping points** into one section — but preserve every unique insight. "
        "The reader should never notice the seams.\n"
        f"4. **{code_rule}**\n"
        f"5. **{table_rule}**\n"
        "6. **Math formatting** — inline \\( ... \\), display \\[ ... \\]. "
        "Units inside \\(\\text{unit}\\). Example: \\(9.8\\,\\text{m/s}^2\\)."
        + (f" {math_rule}" if math_rule else "") + "\n"
        "7. **Structure** — use ## or ### headers only when sections are genuinely distinct. "
        "Use bullets for lists. Bold the key point in each section.\n"
        f"8. **Length** — {length_guidance}\n"
        f"9. **Voice** — {agent_override}\n"
        "10. Always close clearly — an action, a conclusion, or a useful insight. Never trail off.\n"
        f"{style_instruction}{team_writer_block}{persona_instruction}{profile_instruction}"
    )

    return {
        "messages": [{"role": "user", "content": system}],
    }
