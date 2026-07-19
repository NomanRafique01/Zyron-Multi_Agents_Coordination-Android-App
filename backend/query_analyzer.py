"""
query_analyzer.py
Python port of src/agents/analysis/queryAnalyzer.js

Identical regex banks, flag rules, derived fields, and priority cascade.
"""

import re
from typing import Optional

# ─── Pattern bank ──────────────────────────────────────────────────────────────
# All compiled case-insensitive except AGENTS_META and VERBOSITY which test
# against the original-cased text (matching the JS behaviour: `.test(text)`).

_AGENTS_META = re.compile(
    r"how (does|do) (zyron|you|the swarm|this) work"
    r"|what (did )?(each )?agent (do|say|contribute)"
    r"|show .*(collaboration|contribution|process)"
    r"|your architecture"
    r"|multi.?agent"
    r"|swarm (system|pipeline|mode)"
    r"|explain.*agents",
    re.IGNORECASE,
)

_VERBOSITY = re.compile(
    r"\b(in depth|in-depth|in detail|detailed|detail|deep dive|deep-dive"
    r"|researcher|research level|advanced|elaborate|thoroughly|comprehensive"
    r"|exhaustive|technical depth|full breakdown|extended|step by step"
    r"|step-by-step|explain everything|go deep|more detail|maximum detail"
    r"|verbose|scholarly|academic|scientific explanation|rigorous)\b",
    re.IGNORECASE,
)

_CODE = re.compile(
    r"\b(code|function|class|debug|implement|api|fix|script|program|bug"
    r"|runtime|compile|algorithm|syntax|regex|sql|typescript|javascript|python"
    r"|react|component|refactor|optimize|performance|deploy|docker|kubernetes"
    r"|ci\/cd|git|npm|package|library|framework|module|interface|endpoint"
    r"|request|response|fetch|async|promise|callback|error handling|try.catch"
    r"|unit test|integration|build|lint|type(script)?|jsx|tsx|node\.?js|express"
    r"|next\.?js|vue|angular|svelte|tailwind|css|html|dom|redux|state|hook"
    r"|context|render|effect|memo|ref|prop|event|handler|middleware|interceptor"
    r"|authentication|authorization|jwt|oauth|rest|graphql|websocket|socket\.?io"
    r"|postgres|mysql|mongodb|redis|orm|migration|schema)\b",
    re.IGNORECASE,
)

_MATH = re.compile(
    r"\b(math|equation|formula|integral|derivative|matrix|determinant|eigenvalue"
    r"|vector|tensor|calculus|differential|physics|chemistry|thermodynamics"
    r"|quantum|relativity|mechanics|optics|electromagnetism|statistics"
    r"|probability|distribution|regression|hypothesis|proof|theorem|lemma"
    r"|calculate|compute|solve|evaluate|LaTeX|algebra|geometry|trigonometry"
    r"|logarithm|exponential|series|limit|convergence|numerical|simulation"
    r"|optimization|linear programming)\b",
    re.IGNORECASE,
)

_CREATIVE = re.compile(
    r"\b(creative|brainstorm|ideas|inspiration|imagine|invent|generate"
    r"|come up with|unique|original|innovative|unconventional|story|fiction"
    r"|narrative|scenario|concept|thought experiment|what if|speculative"
    r"|lateral thinking|out.of.the.box|alternative)\b",
    re.IGNORECASE,
)

_WRITING = re.compile(
    r"\b(write|essay|email|letter|blog|story|poem|draft|rewrite|proofread"
    r"|summarize|report|proposal|resume|cv|cover letter|pitch|presentation"
    r"|announcement|press release|documentation|README|changelog|release notes"
    r"|technical writing|content|copy|tagline|headline|hook|narrative|article"
    r"|review|critique|feedback|edit|improve|paraphrase|translate|tone|voice"
    r"|style)\b",
    re.IGNORECASE,
)

_ANALYTICAL = re.compile(
    r"\b(explain|analyze|compare|why|how does|concept|theory|research"
    r"|difference between|trade.?off|pros and cons|evaluate|assess|implications"
    r"|impact|effect|cause|reason|mechanism|principle|overview|breakdown"
    r"|deep.?dive|clarify|elaborate|understand|insight|perspective|opinion"
    r"|recommendation|strategy|approach|framework|methodology|best practice"
    r"|lesson|pattern|anti.?pattern)\b",
    re.IGNORECASE,
)

# Conversational: pattern matches AND word_count <= 20  (enforced in main logic)
_CONVERSATIONAL = re.compile(
    r"^(hi|hello|hey|what('?s| is) up|how are you"
    r"|good (morning|afternoon|evening|night)|thanks|thank you|ok|okay|sure"
    r"|yes|no|got it|makes sense|interesting|cool|awesome|great|perfect"
    r"|sounds good|appreciate|help me|can you|could you|please|i need|i want"
    r"|tell me|show me)\b",
    re.IGNORECASE,
)

_TABULAR = re.compile(
    r"\b(table|compare|vs\.?|versus|list of|ranking|pros and cons|columns|rows"
    r"|spreadsheet|matrix|side.by.side|comparison chart|breakdown|features of"
    r"|differences between|similarities|options)\b",
    re.IGNORECASE,
)

_WEB_SEARCH = re.compile(
    r"\b(latest|current|today|tonight|this week|this month|right now"
    r"|just released|just launched|recently|new release|breaking|live|now"
    r"|2024|2025|2026|price|prices|cost|stock|crypto|bitcoin|ethereum|btc|eth"
    r"|exchange rate|weather|forecast|score|scores|result|results|standings"
    r"|match|game|news|update|updates|trending|viral|who won|who is winning"
    r"|released|available now|out now|just dropped"
    # Current-events and position/title queries
    r"|who is|who are|who's"
    r"|president|prime minister|ceo|leader|governor|chancellor|secretary of state"
    r"|elected|in office|ruling|in power|won the election|latest news"
    r"|as of|nowadays|currently|right now|at the moment"
    r"|current (president|prime minister|ceo|leader|governor|chancellor|secretary)"
    r"|new (president|prime minister|ceo|leader|governor|chancellor|secretary)"
    r")\b",
    re.IGNORECASE,
)

# NOTE: _FILLER_WORDS must NEVER include meaningful search terms such as
# "current", "president", "who is", "new", "now", or any positional title.
# Only remove true conversational filler/slang that carries zero search signal.
_FILLER_WORDS = re.compile(
    r"\b(bro|man|dude|yo|hey|like|um|uh|just|rn|lol|omg|wtf|tbh|ngl)\b",
    re.IGNORECASE,
)


# ─── Complexity classifier ─────────────────────────────────────────────────────

def _classify_complexity(word_count: int, flags: dict) -> str:
    if (
        word_count > 60
        or flags["needs_code"]
        or flags["needs_math"]
        or flags["is_agents_meta"]
        or (flags["is_analytical"] and word_count > 30)
    ):
        return "high"
    if word_count > 20 or flags["is_writing"]:
        return "medium"
    return "low"


# ─── Agent focus builders ──────────────────────────────────────────────────────

def _build_agent_focus(flags: dict) -> dict:
    needs_code       = flags["needs_code"]
    needs_math       = flags["needs_math"]
    is_writing       = flags["is_writing"]
    is_analytical    = flags["is_analytical"]
    is_creative      = flags["is_creative"]
    is_conversational = flags["is_conversational"]
    word_count       = flags["word_count"]

    # ── Reasoner ──
    if needs_code:
        reasoner_deliver = (
            "architectural decisions ONLY — problem decomposition, interface contracts, "
            "edge-case inventory, and scale horizon. Zero code."
        )
    elif needs_math:
        reasoner_deliver = (
            "theoretical derivation ONLY — governing law in LaTeX, axioms, derivation chain, "
            "domain of validity. Zero numerical substitution."
        )
    elif is_writing:
        reasoner_deliver = (
            "content strategy ONLY — reader persona, core thesis, tone spec, structural blueprint, "
            "anti-patterns. Zero actual writing."
        )
    elif is_analytical:
        reasoner_deliver = (
            "first-principles reasoning ONLY — real question beneath the surface, key variables, "
            "reasoning chain, assumption audit, counterargument. Zero data or evidence."
        )
    else:
        reasoner_deliver = (
            "logical framework ONLY — question reframe, reasoning chain, assumption audit, "
            "confidence verdict. Zero implementation or visualization."
        )

    # ── Coder ──
    if needs_code:
        coder_deliver = (
            "complete runnable implementation ONLY — every function body filled, typed signatures, "
            "error handling. Zero architecture prose or audits."
        )
    elif needs_math:
        coder_deliver = (
            "numerical computation ONLY — given/find table, step-by-step substitution with LaTeX, "
            "unit propagation, boxed final answer, sanity check. Zero theory or graphs."
        )
    elif is_writing:
        coder_deliver = (
            "actual written piece ONLY — full draft with opening hook, concrete specificity, "
            "active voice, bold alternative. Zero strategy or editing."
        )
    elif is_analytical:
        coder_deliver = (
            "evidence-based analysis ONLY — evidence hierarchy, comparative matrix, causal mechanism "
            "chain, quantified trade-offs, decision framework. Zero first-principles reasoning."
        )
    else:
        coder_deliver = (
            "concrete technical depth ONLY — mechanism explanation, exact specifications, "
            "misconception correction, comparative grounding, quantified claims. Zero theory or mental models."
        )

    # ── Vision ──
    if needs_code:
        vision_deliver = (
            "adversarial audit ONLY — vulnerability catalog, Big-O audit, STRIDE threat model, "
            "test matrix, hardening prescriptions. Zero implementations."
        )
    elif needs_math:
        vision_deliver = (
            "physical intuition ONLY — graph description, plain-language mechanism, variable sensitivity "
            "in LaTeX proportionality, everyday analogy, magnitude anchors. Zero equations or numbers."
        )
    elif is_writing:
        vision_deliver = (
            "line-level editorial surgery ONLY — 5 weakest lines with rewrites, rhythm audit, precision "
            "vocabulary swaps, emotional arc mapping, opening/closing verdict. Zero new content."
        )
    elif is_creative:
        vision_deliver = (
            "creative direction ONLY — strongest/weakest element, tonal audit, rhythm surgery, "
            "six precision word swaps. Zero new drafts."
        )
    else:
        vision_deliver = (
            "comprehension architecture ONLY — cognitive load audit, mental model design, analogy with "
            "explicit mapping, insight crystallization, structure recommendation. Zero content delivery."
        )

    # ── Writer ──
    if is_conversational and word_count <= 15:
        writer_deliver = "brief, natural, conversational answer that directly addresses the query"
    else:
        writer_deliver = (
            "integrate all specialist angles into one authoritative, well-structured final answer "
            "with no preamble"
        )

    return {
        "reasoner": {
            "emphasis": "high" if (needs_code or needs_math or is_analytical) else "medium",
            "deliver": reasoner_deliver,
        },
        "coder": {
            "emphasis": "high" if (needs_code or needs_math) else ("medium-high" if is_analytical else "medium"),
            "deliver": coder_deliver,
        },
        "vision": {
            "emphasis": "high" if (is_writing or is_creative or needs_code) else "medium",
            "deliver": vision_deliver,
        },
        "writer": {
            "emphasis": "high",
            "deliver": writer_deliver,
        },
    }


# ─── Shared brief builder ──────────────────────────────────────────────────────

def _build_shared_brief(text: str, flags: dict) -> str:
    primary_type      = flags["primary_type"]
    needs_code        = flags["needs_code"]
    needs_math        = flags["needs_math"]
    is_writing        = flags["is_writing"]
    is_conversational = flags["is_conversational"]
    complexity        = flags["complexity"]
    word_count        = flags["word_count"]

    lines = [
        f'Request type: {primary_type} | Complexity: {complexity} | Words: {word_count}.',
        'Each specialist contributes their unique angle in parallel.',
    ]

    if needs_code:
        lines.append(
            "Code task confirmed — include working implementations, not pseudocode. "
            "Language tags required on all code blocks."
        )
    else:
        lines.append(
            "NOT a primary coding task — contribute deep insight. "
            "Code only when a short snippet makes the explanation unambiguous."
        )

    if needs_math:
        lines.append(
            "Math/science task — all equations and variables MUST use LaTeX notation. "
            "Show full derivation chain."
        )
    if is_writing:
        lines.append(
            "Writing task — voice, tone, structure, and audience alignment matter as much as content."
        )
    if is_conversational and word_count <= 15:
        lines.append(
            "Short conversational query — keep responses concise and human. Skip heavy formatting."
        )

    lines.append(f'Original query: "{text}"')
    return " ".join(lines)


# ─── Main analyzer ─────────────────────────────────────────────────────────────

def analyze_query(text: str, analysis_bias: Optional[dict] = None) -> dict:
    """
    Fast local query analysis — no API call.

    Args:
        text:          The user's raw input string.
        analysis_bias: Optional dict of override flags, e.g.
                       {"needsCode": True, "needsMath": True,
                        "preferWriting": True, "preferAnalytical": True}

    Returns:
        A dict with all detection flags, derived fields, agent_focus, and shared_brief.
    """
    bias = analysis_bias or {}

    text = text.strip()
    lower = text.lower()
    word_count = len(lower.split())

    # ── Detection flags ──────────────────────────────────────────────────────
    is_agents_meta    = bool(_AGENTS_META.search(text))       # original case
    needs_code        = bool(_CODE.search(lower))       or bool(bias.get("needsCode"))
    needs_math        = bool(_MATH.search(lower))       or bool(bias.get("needsMath"))
    is_writing        = bool(_WRITING.search(lower))    or bool(bias.get("preferWriting"))
    is_analytical     = bool(_ANALYTICAL.search(lower)) or bool(bias.get("preferAnalytical"))
    is_conversational = bool(_CONVERSATIONAL.match(lower)) and word_count <= 20
    is_creative       = bool(_CREATIVE.search(lower))
    needs_table       = bool(_TABULAR.search(lower))
    verbosity_level   = "detailed" if _VERBOSITY.search(text) else "simple"  # original case

    # ── Web search detection ──────────────────────────────────────────────────
    needs_web_search = bool(_WEB_SEARCH.search(lower))
    # Clean and optimise the query for the search engine.
    web_search_query = (
        _FILLER_WORDS.sub("", text).strip()
        if needs_web_search else ""
    )
    # Collapse double spaces left by filler removal.
    web_search_query = re.sub(r"\s{2,}", " ", web_search_query).strip()

    print(f"[QueryAnalyzer] needs_web_search: {needs_web_search} | web_search_query: {web_search_query}")

    # ── Primary type (priority cascade) ──────────────────────────────────────
    if is_agents_meta:
        primary_type = "swarm_meta"
    elif needs_code:
        primary_type = "coding"
    elif needs_math:
        primary_type = "stem"
    elif is_analytical:
        primary_type = "analytical"
    elif is_writing:
        primary_type = "writing"
    elif is_creative:
        primary_type = "creative"
    elif is_conversational:
        primary_type = "conversational"
    else:
        primary_type = "general"

    # ── Simple flag ───────────────────────────────────────────────────────────
    is_simple = (
        word_count <= 10
        and is_conversational
        and not needs_code
        and not needs_math
        and not is_agents_meta
    )

    # ── Coordination mode — always 'full' (orchestrator overrides) ────────────
    coordination_mode = "full"

    # ── Assemble flags dict (needed by helpers) ───────────────────────────────
    flags = {
        "primary_type":      primary_type,
        "needs_code":        needs_code,
        "needs_math":        needs_math,
        "is_writing":        is_writing,
        "is_analytical":     is_analytical,
        "is_conversational": is_conversational,
        "is_creative":       is_creative,
        "needs_table":       needs_table,
        "is_agents_meta":    is_agents_meta,
        "is_simple":         is_simple,
        "word_count":        word_count,
        "coordination_mode": coordination_mode,
        "verbosity_level":   verbosity_level,
        "needs_web_search":  needs_web_search,
        "web_search_query":  web_search_query,
        "complexity":        "",   # filled below
    }

    flags["complexity"] = _classify_complexity(word_count, flags)

    # ── Derived composites ────────────────────────────────────────────────────
    agent_focus   = _build_agent_focus(flags)
    shared_brief  = _build_shared_brief(text, flags)

    return {
        **flags,
        "agent_focus":  agent_focus,
        "shared_brief": shared_brief,
    }
