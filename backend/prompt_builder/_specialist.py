"""
_specialist.py
Per-role output-format directives + build_specialist_prompt().

Ported from src/agents/prompts/promptBuilder.js:
  - ROLE_OUTPUT_FORMAT  (the per-role, per-primaryType focus blocks)
  - buildSpecialistBase()
  - buildSpecialistPrompt()

Public API
----------
build_specialist_prompt(role, agent_meta, user_text, analysis, team, user_profile)
    -> {"messages": [...], "static_prefix": str, "dynamic_suffix": str}
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from ._style        import build_style_instruction, build_non_tech_discipline
from ._templates    import get_expert_template
from ._user_profile import build_user_profile_instruction


# ─── Contribution lenses (mirrors agentRegistry.js) ──────────────────────────

_AGENT_CONTRIBUTION_LENSES: Dict[str, str] = {
    "reasoner": (
        "first-principles reasoning, chain-of-thought decomposition, assumption auditing, "
        "failure taxonomy, and architectural decision records"
    ),
    "coder": (
        "complete production-grade implementation with typed interfaces, exhaustive error handling, "
        "complexity analysis, and zero-placeholder policy"
    ),
    "vision": (
        "adversarial stress-testing, red-team security analysis, cognitive load optimization, "
        "and output quality assurance through structured critique"
    ),
    "writer": (
        "high-fidelity synthesis that preserves every specialist angle, eliminates redundancy, "
        "and delivers one authoritative, structurally perfect final answer"
    ),
}

# ─── Per-role output-format directives ───────────────────────────────────────
# Returns a focus block tailored to the query type.
# Mirrors ROLE_OUTPUT_FORMAT in promptBuilder.js.

def _role_output_format(role: str, analysis: dict, team_id: str) -> str:
    needs_code   = analysis.get("needs_code", False)
    needs_math   = analysis.get("needs_math", False)
    is_writing   = analysis.get("is_writing", False)
    is_creative  = analysis.get("is_creative", False)
    primary_type = analysis.get("primary_type", "general")

    # ── reasoner ──────────────────────────────────────────────────────────────
    if role == "reasoner":
        if needs_code:
            return (
                "\n## Your Focus (Architecture & Logic)\n"
                "Think through the design — don't write code. Cover:\n"
                "- **Problem core**: what is the real computational or systems challenge here?\n"
                "- **Design decision**: the right architectural choice and why the alternatives lose.\n"
                "- **Interface contracts**: what data shapes, API signatures, or type contracts are needed?\n"
                "- **Edge cases**: failure modes, boundary conditions, race conditions — numbered list.\n"
                "- **Scale limit**: where does this design break, and what would trigger a redesign?\n\n"
                "Leave the actual implementation to the Coder. Leave security auditing to Vision."
            )
        if needs_math:
            return (
                "\n## Your Focus (Theory & Derivation)\n"
                "Lay out the math rigorously. Cover:\n"
                "- **Governing principle**: state the physical or mathematical law using \\[ ... \\] LaTeX.\n"
                "- **Assumptions**: what must hold for this model to apply? What breaks it?\n"
                "- **Derivation**: show every algebraic step — no skipping, no \"it can be shown\".\n"
                "- **Domain of validity**: where does this model fail (relativistic speeds, quantum scale, etc.)?\n"
                "- **Core insight**: the non-obvious truth that makes the result elegant or surprising.\n\n"
                "Leave number-crunching to the Coder. Leave intuition and analogies to Vision."
            )
        if is_writing or primary_type == "writing":
            return (
                "\n## Your Focus (Content Strategy)\n"
                "Plan the piece — don't write it. Cover:\n"
                "- **Target reader**: specific persona, their knowledge level, what success looks like for them.\n"
                "- **Core thesis**: one clear, falsifiable sentence (\"X does Y because Z\", not \"X is important\").\n"
                "- **Tone**: 3 words that define the voice, 1 to actively avoid (with a short reason why).\n"
                "- **Structure**: hook type → body shape → closing move, with a brief rationale for each.\n"
                "- **Traps to avoid**: 3–4 specific pitfalls common for this type of content.\n\n"
                "Leave the actual writing to the Coder. Leave editing and line-level critique to Vision."
            )
        if primary_type == "creative":
            return (
                "\n## Your Focus (Creative Strategy)\n"
                "Set the strategic foundation — no writing yet. Cover:\n"
                "- **Creative tension**: the central tension this piece will exploit and why it resonates.\n"
                "- **Human truth**: the specific, falsifiable human experience at the heart of this piece.\n"
                "- **Three territories**: three genuinely different creative directions — name, risk, opportunity for each.\n"
                "- **Anti-brief**: at least 3 specific traps that would make this generic, derivative, or tone-deaf.\n"
                "- **Success criteria**: how will you know if this worked? Two measurable, two qualitative markers.\n\n"
                "Leave the actual writing to the Coder. Leave editorial refinement to Vision."
            )
        if primary_type in ("analytical", "general"):
            return (
                "\n## Your Focus (Reasoning & Logic)\n"
                "Reason clearly from first principles. Cover:\n"
                "- **Real question**: what deeper question is actually being asked? Often different from the surface.\n"
                "- **Key variables**: what dimensions shape the answer? Which are fixed vs. context-dependent?\n"
                "- **Reasoning chain**: step-by-step logic, each step independently defensible.\n"
                "- **Hidden assumptions**: 2–3 assumptions in the common answer. Flag which are questionable.\n"
                "- **Strongest counter**: steel-man the opposing view, then address it specifically.\n\n"
                "Leave concrete data and evidence to the Coder. Leave analogies and mental models to Vision."
            )
        if primary_type == "financial":
            return (
                "\n## Your Focus (Strategic Financial Reasoning)\n"
                "Analyse the financial landscape clearly. Cover:\n"
                "- **Market context**: the macro or sector forces shaping this situation.\n"
                "- **Key question beneath the question**: what financial decision or risk is really at stake?\n"
                "- **Structural factors**: which economic, regulatory, or competitive forces are at play?\n"
                "- **Scenarios**: how does the answer change under bull / base / bear assumptions?\n"
                "- **Risk framing**: what are the non-obvious risks most people overlook?\n\n"
                "Leave number-crunching to the Coder. Leave plain-language translation to Vision."
            )
        if primary_type == "legal":
            return (
                "\n## Your Focus (Legal Analysis)\n"
                "Frame the legal question rigorously. Cover:\n"
                "- **Precise issue**: state the exact legal question — split into sub-issues if needed.\n"
                "- **Applicable rule**: the law, statute, or principle that governs this.\n"
                "- **Jurisdiction**: which jurisdiction applies, and where do jurisdictions diverge?\n"
                "- **Counter-analysis**: the strongest opposing legal argument and the evidence for it.\n"
                "- **Confidence level**: near-certain / probable / contested / unclear — with reasons.\n\n"
                "Leave operative details to the Coder. Leave plain-English summary to Vision."
            )
        # fallback
        return (
            "\n## Your Focus (Reasoning & Logic)\n"
            "Reason clearly from first principles. Cover:\n"
            "- **Real question**: what deeper question is actually being asked?\n"
            "- **Key variables**: what dimensions shape the answer?\n"
            "- **Reasoning chain**: step-by-step logic, each step independently defensible.\n"
            "- **Hidden assumptions**: flag the questionable ones.\n"
            "- **Strongest counter**: steel-man the opposing view, then address it.\n\n"
            "Leave concrete substance to the Coder. Leave clarity and mental models to Vision."
        )

    # ── coder ─────────────────────────────────────────────────────────────────
    if role == "coder":
        if needs_code:
            return (
                "\n## Your Focus (Implementation)\n"
                "Write the actual working code. Requirements:\n"
                "- Complete implementation — every function body filled. No placeholders, no \"TODO\", no pseudocode.\n"
                "- Every async call awaited, every null handled, every external call has a failure path.\n"
                "- Named constants over magic numbers. Self-documenting names.\n"
                "- Multi-file solutions: add `// === path/to/file.ts ===` before each block.\n"
                "- Annotate any non-trivial algorithm with its complexity: `// O(n log n)`\n\n"
                "Leave architecture and design rationale to the Reasoner. Leave security audits to Vision."
            )
        if needs_math:
            return (
                "\n## Your Focus (Calculation)\n"
                "Do the full computation, step by step. Cover:\n"
                "- **Given / Find**: table of known values with numbers, units, and significant figures. State what you're solving.\n"
                "- **Working equation**: the formula in \\[ ... \\] LaTeX with a one-line justification.\n"
                "- **Substitution**: replace one variable at a time, showing each step explicitly.\n"
                "  Example: \\[ F = ma = (5.00\\,\\text{kg})(9.81\\,\\text{m/s}^2) = 49.1\\,\\text{N} \\]\n"
                "- **Unit propagation**: cancel units through every step using fraction notation.\n"
                "- **Final answer**: box it — \\[ \\boxed{result = value\\,\\text{unit}} \\]\n"
                "- **Sanity check**: right order of magnitude? Sign correct? Quick cross-check.\n\n"
                "Leave theory and derivations to the Reasoner. Leave intuition and graphs to Vision."
            )
        if is_writing or primary_type == "writing":
            return (
                "\n## Your Focus (The Writing)\n"
                "Write the actual piece — a complete draft, not a plan or summary. Requirements:\n"
                "1. **Opening hook**: write your strongest first sentence. Then give a bolder alternative and explain which is stronger.\n"
                "2. **Full draft**: real prose (or key sections for long-form). Every sentence must do work.\n"
                "3. **Concrete over abstract**: replace vague claims with specific details, real examples, or memorable moments.\n"
                "4. **Active voice**: default to active. If you use passive, explain why it's stronger there.\n"
                "5. **Alternative version**: offer one meaningfully different take — different angle, tone, or structure.\n\n"
                "Leave strategy and planning to the Reasoner. Leave line edits and sharpening to Vision."
            )
        if primary_type == "creative":
            return (
                "\n## Your Focus (Creative Execution)\n"
                "Write the actual creative piece — complete, vivid, and fully realized. Requirements:\n"
                "1. **Three hooks**: one conventional, one subversive, one formally unusual. Label each and explain the choice.\n"
                "2. **Full draft**: real writing, not a description of writing. Complete the piece or its most important sections.\n"
                "3. **Sensory specificity**: point to 3 moments where you added sensory detail — what each one does for the reader.\n"
                "4. **The unexpected element**: one thing most writers wouldn't include.\n"
                "5. **Bold alternative**: a genuinely different version — different form, voice, or central image.\n\n"
                "Leave strategy to the Reasoner. Leave curation and refinement to Vision."
            )
        if primary_type in ("analytical", "general"):
            return (
                "\n## Your Focus (Evidence & Substance)\n"
                "Back the analysis with concrete depth. Cover:\n"
                "- **Evidence**: what kinds of evidence exist? How strong is each (research > studies > expert consensus > anecdotal)?\n"
                "- **Comparison**: at least 3 options or perspectives evaluated across the same criteria.\n"
                "- **Causal chain**: how does the cause produce the effect — A → B → C? Explain the mechanism, not just the correlation.\n"
                "- **Trade-offs**: weigh the real costs and benefits with specifics, not vague generalities.\n"
                "- **Decision framework**: who should choose what, and under which specific conditions?\n\n"
                "Leave first-principles reasoning to the Reasoner. Leave mental models and analogies to Vision."
            )
        if primary_type == "financial":
            return (
                "\n## Your Focus (The Numbers & Mechanics)\n"
                "Ground the analysis in concrete financial specifics. Cover:\n"
                "- **Key metrics**: the numbers that matter most, with benchmarks or historical ranges for comparison.\n"
                "- **Model mechanics**: how the financial calculation or structure actually works — step by step.\n"
                "- **Sensitivity**: which assumption, if wrong by 20%, most changes the outcome?\n"
                "- **Historical grounding**: what does the data from comparable situations show?\n"
                "- **Ranges not points**: where precision is uncertain, give a range and explain the bounds.\n\n"
                "Leave strategic framing to the Reasoner. Leave plain-language explanation to Vision."
            )
        if primary_type == "legal":
            return (
                "\n## Your Focus (Legal Mechanics & Specifics)\n"
                "Get into the operative details. Cover:\n"
                "- **Applicable provisions**: the exact clauses, statutes, or definitions that govern this situation.\n"
                "- **Risk allocation**: who bears each identified risk, and what mechanism allocates it?\n"
                "- **Practical consequences**: translate the legal conclusion into concrete real-world implications.\n"
                "- **Red flags**: specific gaps, ambiguities, or provisions that need immediate attention.\n"
                "- **What changes what**: how would different facts or jurisdictions alter the answer?\n\n"
                "Leave legal framework to the Reasoner. Leave plain-English summary to Vision."
            )
        # fallback
        return (
            "\n## Your Focus (Concrete Substance)\n"
            "Deliver the real depth and specifics. Cover:\n"
            "- **How it actually works**: mechanism and cause-and-effect, not just description.\n"
            "- **Concrete specifics**: real examples, specific details, named cases — no vague generalities.\n"
            "- **The common misconception**: the most important wrong belief in this area, corrected precisely.\n"
            "- **Comparison**: situate the answer against the obvious alternatives.\n"
            "Leave reasoning framework to the Reasoner. Leave clarity and mental models to Vision."
        )

    # ── vision ────────────────────────────────────────────────────────────────
    if role == "vision":
        if needs_code:
            return (
                "\n## Your Focus (Quality Audit)\n"
                "Stress-test the design and code critically. Cover:\n"
                "- **Issues**: at least 4 specific, concrete problems — null dereferences, race conditions, injection risks, type coercions. Quote or paraphrase the problematic part.\n"
                "- **Complexity**: Big-O for each key operation. Flag any O(n²) or worse. Spot N+1 query patterns.\n"
                "- **Security**: apply STRIDE thinking to at least 2 relevant threats.\n"
                "- **Test cases**: 6 cases — (a) happy path, (b) empty/null input, (c) max boundary, (d) min boundary, (e) concurrent execution, (f) adversarial input. Write them as real test code.\n"
                "- **Fixes**: for each issue found, give the exact code-level fix — not general advice.\n\n"
                "Leave new implementations to the Coder. Leave architecture decisions to the Reasoner."
            )
        if needs_math:
            return (
                "\n## Your Focus (Intuition & Meaning)\n"
                "Build understanding around the math — equations alone don't teach. Cover:\n"
                "- **Graph**: describe the key graph — x-axis, y-axis, curve shape, intercepts, asymptotes, what each region means physically.\n"
                "- **Plain-language mechanism**: WHY does the equation behave this way? (\"Physically, this happens because...\" not \"the formula shows...\")\n"
                "- **Variable sensitivity**: what happens when each key variable doubles? Use LaTeX proportionality: \\( F \\propto a \\).\n"
                "- **Everyday analogy**: one concrete, testable analogy from daily life — and state explicitly where it breaks down.\n"
                "- **Reference values**: 2–3 real-world anchors to help the reader feel the scale.\n\n"
                "Leave derivations to the Reasoner. Leave number-crunching to the Coder."
            )
        if is_writing or primary_type == "writing":
            return (
                "\n## Your Focus (Editorial Sharpening)\n"
                "Critique and improve at the word and sentence level. Cover:\n"
                "- **Weak lines**: find the 5 weakest sentences. For each: quote it, diagnose the failure (vague, passive, clichéd, redundant), then rewrite it.\n"
                "- **Rhythm**: find 2 passages where the sentence rhythm fights the meaning. Give the specific fix.\n"
                "- **Word precision**: 6 generic or overused words — quote in context, name the problem, provide the right word.\n"
                "- **Emotional arc**: trace where the piece peaks, flatlines, or deflates too early. Prescribe one structural fix.\n"
                "- **Opening and close**: grade the first and last sentence. Rewrite either that fails.\n\n"
                "Leave strategy and planning to the Reasoner. Leave drafting new content to the Coder."
            )
        if is_creative or primary_type == "creative":
            return (
                "\n## Your Focus (Creative Direction & Curation)\n"
                "Sharpen and curate the creative work. Cover:\n"
                "- **Strongest element**: the single best line or image. Quote it. Explain exactly why it works — the specific mechanism.\n"
                "- **Weakest moment**: the point where it loses the reader. Quote it, diagnose it, rewrite it.\n"
                "- **Voice consistency**: flag every register shift — intentional or accidental? Fix the lapses.\n"
                "- **Rhythm surgery**: one passage where rhythm fights content. Make a specific structural change.\n"
                "- **Word precision**: 6 generic or clichéd words — quote in context, state the failure, give the exact replacement.\n\n"
                "Leave creative strategy to the Reasoner. Leave writing new drafts to the Coder."
            )
        if primary_type in ("analytical", "general"):
            return (
                "\n## Your Focus (Clarity & Understanding)\n"
                "Make the answer easy for a real person to understand. Cover:\n"
                "- **Clarity check**: the 2 points where most readers will get lost. Add a bridge, an example, or a simpler explanation at each.\n"
                "- **Mental model**: design one concrete mental model the reader can hold onto — spatial, causal, or narrative.\n"
                "- **Analogy**: one analogy with explicit structural mapping (\"X corresponds to Y because both have Z\"). State where it breaks down.\n"
                "- **Key insight**: the single \"aha\" sentence — one insight that, once understood, makes everything else click. Keep it short.\n"
                "- **Structure recommendation**: for this content, what format works best — headers, bullets, table, or flowing prose?\n\n"
                "Leave first-principles reasoning to the Reasoner. Leave data and comparisons to the Coder."
            )
        if primary_type == "financial":
            return (
                "\n## Your Focus (Plain-Language Translation)\n"
                "Make the financial analysis understandable and actionable. Cover:\n"
                "- **Jargon translation**: define every technical financial term the first time it appears.\n"
                "- **Magnitude anchors**: replace abstract numbers with relatable comparisons people can feel.\n"
                "- **Decision clarity**: make the decision criteria explicit — what should the reader actually do with this?\n"
                "- **Risk proportionality**: communicate risks clearly — neither minimised nor sensationalised.\n"
                "- **The one thing to remember**: the single most important insight from this entire analysis.\n\n"
                "Leave strategic framing to the Reasoner. Leave number mechanics to the Coder."
            )
        if primary_type == "legal":
            return (
                "\n## Your Focus (Plain-English Summary & Action)\n"
                "Translate the legal analysis into something anyone can act on. Cover:\n"
                "- **Plain-language summary**: one clear paragraph that a non-lawyer can fully understand.\n"
                "- **What this means for you**: the concrete, practical implications for the person asking.\n"
                "- **Key dates or deadlines**: any time-sensitive obligations.\n"
                "- **Specific next steps**: ordered by priority — what should happen first, second, third?\n"
                "- **Where this ends**: flag where this analysis ends and licensed legal advice must begin.\n\n"
                "Leave legal framework to the Reasoner. Leave operative specifics to the Coder."
            )
        # fallback
        return (
            "\n## Your Focus (Clarity & Understanding)\n"
            "Make the answer easy for a real person to understand. Cover:\n"
            "- **Clarity check**: the 2 points where most readers will get lost. Add a bridge or simpler explanation.\n"
            "- **Mental model**: one concrete mental model the reader can hold onto.\n"
            "- **Analogy**: one analogy with explicit mapping — and say where it breaks down.\n"
            "- **Key insight**: the single most important idea in one short sentence.\n"
            "- **Best format**: headers, bullets, table, or prose — which works best here, and why?\n\n"
            "Leave reasoning to the Reasoner. Leave substance to the Coder."
        )

    return ""


# ─── Specialist base builder ──────────────────────────────────────────────────

def _build_specialist_base(
    role: str,
    agent_meta: dict,
    analysis: dict,
    team: Optional[dict],
    user_profile_instruction: str,
) -> tuple[str, str]:
    """
    Returns (static_prefix, dynamic_suffix) for a specialist system prompt.

    agent_meta  — dict with keys: name, specialist_directive, contribution_lens
    team        — full team dict (id, name, agents, shared_brief_suffix, etc.)
    """
    agent_name  = agent_meta.get("name", role.capitalize())
    team_id     = (team or {}).get("id", "")
    team_name   = (team or {}).get("name", "Zyron")

    # Contribution lens — agent_meta overrides global default
    lens = (
        agent_meta.get("contribution_lens")
        or _AGENT_CONTRIBUTION_LENSES.get(role, "specialist insight")
    )

    # Team-level specialist directive (overrides generic output-format block)
    team_directive: str = agent_meta.get("specialist_directive", "")

    # Expert template — e.g. CODING_TEMPLATES["reasoner"] for a coding query
    expert_template = get_expert_template(
        role,
        analysis.get("primary_type", "general"),
        analysis.get("verbosity_level", "simple"),
    )

    # Only inject ROLE_OUTPUT_FORMAT when the team does NOT supply its own directive.
    # Both cover the same ground; injecting both would bloat the prompt needlessly.
    output_format_directive = (
        "" if team_directive
        else _role_output_format(role, analysis, team_id)
    )

    non_tech_discipline = build_non_tech_discipline(analysis, team_id)

    peer_roles = {
        "reasoner": "Coder and Vision",
        "coder":    "Reasoner and Vision",
        "vision":   "Reasoner and Coder",
    }

    shared_brief_suffix: str = (team or {}).get("shared_brief_suffix") or ""

    # ── Static prefix (stable for the entire team session) ───────────────────
    static_lines = [
        f"You are **{agent_name}**, the **{role.upper()}** specialist in the **\"{team_name}\"** multi-agent team.",
        f"Your exclusive contribution lens: **{lens}**.",
        "",
        "## Your Role in This Team",
        f"You work in parallel with {peer_roles.get(role, 'other specialists')}. "
        "A Writer agent combines all outputs into one final answer for the human.",
        "**Stay in your lane**: contribute only what your role uniquely provides. "
        "Don't duplicate what the other specialists cover.",
        "Write clearly and directly — a real person will read the final answer. "
        "Make your contribution genuinely useful, not just structurally correct.",
        "",
        f"## Team Directive\n{team_directive}" if team_directive else "",
        f"\n{expert_template}" if expert_template else "",
        "",
        "## Rules",
        "- **Never mention the agent system, other agents, or the pipeline** — write as if you are answering the user directly.",
        "- **Do not write a full polished final answer** — the Writer stitches everything together.",
        "- **Depth over breadth** — one genuinely useful, specific insight beats five surface-level observations.",
        "- **Write as much as your angle genuinely requires** — do not cap your length artificially.",
        f"\nTeam focus: {shared_brief_suffix}" if shared_brief_suffix else "",
        non_tech_discipline,
    ]
    static_prefix = "\n".join(line for line in static_lines if line is not None)

    # ── Dynamic suffix (changes every query) ─────────────────────────────────
    focus       = (analysis.get("agent_focus") or {}).get(role, {})
    deliver     = focus.get("deliver", "focused expert insight from your unique angle")
    emphasis    = focus.get("emphasis", "high")

    style_instruction = build_style_instruction(analysis.get("verbosity_level", "simple"))

    # ── Response length guidance ──────────────────────────────────────────────
    _rl = analysis.get("response_length", "MEDIUM")
    if _rl == "SHORT":
        response_length_note = (
            "**Response length**: Be concise. Answer directly in 1-3 sentences. "
            "No extra context, no elaboration unless asked."
        )
    elif _rl == "LONG":
        response_length_note = (
            "**Response length**: Be as comprehensive and detailed as needed. "
            "Do not cut anything short."
        )
    else:
        response_length_note = (
            "**Response length**: Be focused and clear. Cover the topic fully but don't over-explain."
        )

    domain_note = ""
    if (
        not analysis.get("needs_code")
        and team_id in ("creative-thinkers", "historians", "mega-minds", "scientists")
    ):
        domain_labels = {
            "creative-thinkers": "creative writing and strategy",
            "historians":        "historical analysis and narrative",
            "scientists":        "science and mathematics",
        }
        domain = domain_labels.get(team_id, "knowledge, research, and analytical reasoning")
        domain_note = (
            f"**Domain note**: Respond entirely within your team's domain — {domain}. "
            "Zero code, zero software references, zero developer vocabulary unless the user explicitly asked for them."
        )

    conversational_note = ""
    if analysis.get("is_conversational") and analysis.get("word_count", 99) <= 15:
        conversational_note = (
            "**Short conversational query** — be direct and natural. "
            "Light structure is fine; match the conversational tone."
        )

    math_mandate = (
        "**All math MUST use LaTeX** — inline \\( ... \\) and display \\[ ... \\]. Never use ASCII for equations."
        if analysis.get("needs_math") else ""
    )

    code_note = ""
    if analysis.get("needs_code") and role != "coder":
        if role == "reasoner":
            code_note = "**Code note**: Only the Coder provides implementations. You provide architecture and interfaces — no code bodies."
        else:
            code_note = "**Code note**: Only the Coder provides implementations. You audit and critique — no new code."

    dynamic_lines = [
        output_format_directive,
        style_instruction,
        "",
        "## Query Context",
        f"Deliver: {deliver}.",
        f"Emphasis level: {emphasis}.",
        f"Request snapshot: {analysis.get('shared_brief', '')}",
        "",
        response_length_note,
        math_mandate,
        code_note,
        domain_note,
        conversational_note,
        user_profile_instruction,
    ]
    dynamic_suffix = "\n".join(line for line in dynamic_lines if line is not None)

    return static_prefix, dynamic_suffix


# ─── Web search context block ─────────────────────────────────────────────────

def _build_web_search_context_block(search_results: Optional[dict]) -> str:
    """
    Build the injected context block from a web search result dict.
    keyFacts (or key_facts) are the primary source of truth — summary is ignored.
    Reads both camelCase keyFacts (frontend path) and snake_case key_facts (backend path).
    Returns empty string when search_results is None.
    """
    if not search_results:
        return ""

    # Accept both camelCase (JS frontend) and snake_case (Python backend) keys.
    key_facts = (
        search_results.get("keyFacts")
        or search_results.get("key_facts")
        or []
    )
    sources = search_results.get("sources", []) or []

    # Surface all key facts (up to 5) — these are the primary agent context.
    facts_text = "\n".join(f"- {f}" for f in key_facts[:5]) if key_facts else ""
    sources_text = "\n".join(
        f"{s.get('title', '')} ({s.get('url', '')})"
        for s in sources[:3]
        if s.get("title") or s.get("url")
    )

    if not facts_text and not sources_text:
        return ""

    lines = [
        "[WEB SEARCH CONTEXT — Real-time data retrieved]",
        f"Key Facts:\n{facts_text}" if facts_text else "",
        f"Sources: {sources_text}" if sources_text else "",
        "",
        (
            "Use this information naturally in your response. "
            "Do not say \"according to web search\" or \"based on search results\" — "
            "just respond as if you know this information. "
            "Keep your response smooth, natural, and conversational."
        ),
    ]
    return "\n".join(line for line in lines if line is not None and line != "")


# ─── Document context block builder ──────────────────────────────────────────

def _build_document_context_block(document_context: Optional[dict]) -> str:
    """
    Build the injected context block from a user-uploaded document.
    document_context must have a non-empty 'text' key.
    Returns empty string when document_context is None or empty.
    """
    if not document_context:
        return ""
    text = (document_context.get("text") or "").strip()
    if not text:
        return ""
    lines = [
        "[DOCUMENT CONTEXT]",
        "The user has uploaded a document. Here is its content:",
        text,
        "Use this document as the primary reference for your response.",
    ]
    return "\n".join(lines)


# ─── Public: build_specialist_prompt ─────────────────────────────────────────

def build_specialist_prompt(
    role: str,
    agent_meta: dict,
    user_text: str,
    analysis: dict,
    team: Optional[dict] = None,
    user_profile: Optional[dict] = None,
    search_results: Optional[dict] = None,
    document_context: Optional[dict] = None,
) -> Dict[str, Any]:
    """
    Build the full messages list for a specialist agent.

    Parameters
    ----------
    role             : "reasoner" | "coder" | "vision"
    agent_meta       : dict — name, specialist_directive, contribution_lens
    user_text        : raw user query string
    analysis         : result of analyze_query()
    team             : Team dict from models.Team (optional)
    user_profile     : UserProfile dict (optional)
    search_results   : clean web search result dict (optional)
    document_context : { text, filename } from user document upload (optional)

    Returns
    -------
    {
        "messages":       [{"role": "system", "content": ...}, {"role": "user", "content": ...}],
        "static_prefix":  str,
        "dynamic_suffix": str,
    }
    """
    user_profile_instruction = build_user_profile_instruction(user_profile)

    static_prefix, dynamic_suffix = _build_specialist_base(
        role, agent_meta, analysis, team, user_profile_instruction
    )

    print(f"[PromptBuilder] Injecting search context: {search_results is not None}")
    print(f"[PromptBuilder] Injecting document context: {document_context is not None}")
    web_search_block = _build_web_search_context_block(search_results)
    doc_context_block = _build_document_context_block(document_context)

    system = (
        (doc_context_block + "\n\n" if doc_context_block else "")
        + (web_search_block + "\n\n" if web_search_block else "")
        + static_prefix
        + "\n\n"
        + dynamic_suffix
    )

    return {
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user_text},
        ],
        "static_prefix":  static_prefix,
        "dynamic_suffix": dynamic_suffix,
    }
