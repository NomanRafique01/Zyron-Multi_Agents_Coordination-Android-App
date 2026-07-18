import { COORDINATION_MODES } from '../registry/teamMetadata';
import { getActiveTeam } from '../teams/teamRuntime';

// ─── Pattern bank ─────────────────────────────────────────────────────────────
const PATTERNS = {
  agentsMeta:
    /how (does|do) (zyron|you|the swarm|this) work|what (did )?(each )?agent (do|say|contribute)|show .*(collaboration|contribution|process)|your architecture|multi.?agent|swarm (system|pipeline|mode)|explain.*agents/i,

  // Signals user wants a detailed, research-level, advanced response
  detailedMode:
    /\b(in depth|in-depth|in detail|detailed|detail|deep dive|deep-dive|researcher|research level|advanced|elaborate|thoroughly|comprehensive|exhaustive|technical depth|full breakdown|extended|step by step|step-by-step|explain everything|go deep|more detail|maximum detail|verbose|scholarly|academic|scientific explanation|rigorous)\b/i,

  code:
    /\b(code|function|class|debug|implement|api|fix|script|program|bug|runtime|compile|algorithm|syntax|regex|sql|typescript|javascript|python|react|component|refactor|optimize|performance|deploy|docker|kubernetes|ci\/cd|git|npm|package|library|framework|module|interface|endpoint|request|response|fetch|async|promise|callback|error handling|try.catch|unit test|integration|build|lint|type(script)?|jsx|tsx|node\.?js|express|next\.?js|vue|angular|svelte|tailwind|css|html|dom|redux|state|hook|context|render|effect|memo|ref|prop|event|handler|middleware|interceptor|authentication|authorization|jwt|oauth|rest|graphql|websocket|socket\.?io|postgres|mysql|mongodb|redis|orm|migration|schema)\b/i,

  design:
    /\b(design|layout|mockup|interface|responsive|color|palette|font|typography|ui|ux|css|styling|wireframe|prototype|figma|sketch|component library|design system|spacing|grid|flex(box)?|animation|transition|accessibility|a11y|contrast|icon|logo|brand|visual hierarchy|whitespace|breakpoint|mobile.first|dark mode)\b/i,

  math:
    /\b(math|equation|formula|integral|derivative|matrix|determinant|eigenvalue|vector|tensor|calculus|differential|physics|chemistry|thermodynamics|quantum|relativity|mechanics|optics|electromagnetism|statistics|probability|distribution|regression|hypothesis|proof|theorem|lemma|calculate|compute|solve|evaluate|LaTeX|algebra|geometry|trigonometry|logarithm|exponential|series|limit|convergence|numerical|simulation|optimization|linear programming)\b/i,

  writing:
    /\b(write|essay|email|letter|blog|story|poem|draft|rewrite|proofread|summarize|report|proposal|resume|cv|cover letter|pitch|presentation|announcement|press release|documentation|README|changelog|release notes|technical writing|content|copy|tagline|headline|hook|narrative|article|review|critique|feedback|edit|improve|paraphrase|translate|tone|voice|style)\b/i,

  analytical:
    /\b(explain|analyze|compare|why|how does|concept|theory|research|difference between|trade.?off|pros and cons|evaluate|assess|implications|impact|effect|cause|reason|mechanism|principle|overview|breakdown|deep.?dive|clarify|elaborate|understand|insight|perspective|opinion|recommendation|strategy|approach|framework|methodology|best practice|lesson|pattern|anti.?pattern)\b/i,

  conversational:
    /^(hi|hello|hey|what('?s| is) up|how are you|good (morning|afternoon|evening|night)|thanks|thank you|ok|okay|sure|yes|no|got it|makes sense|interesting|cool|awesome|great|perfect|sounds good|appreciate|help me|can you|could you|please|i need|i want|tell me|show me)\b/i,

  tabular:
    /\b(table|compare|vs\.?|versus|list of|ranking|pros and cons|columns|rows|spreadsheet|matrix|side.by.side|comparison chart|breakdown|features of|differences between|similarities|options)\b/i,

  creative:
    /\b(creative|brainstorm|ideas|inspiration|imagine|invent|generate|come up with|unique|original|innovative|unconventional|story|fiction|narrative|scenario|concept|thought experiment|what if|speculative|lateral thinking|out.of.the.box|alternative)\b/i,

  financial:
    /\b(invest|stock|crypto|portfolio|budget|finance|revenue|profit|loss|ROI|valuation|market cap|equity|debt|dividend|interest rate|inflation|GDP|economic|monetary|fiscal|balance sheet|income statement|cash flow|P&L|cost analysis|pricing|subscription|SaaS|MRR|ARR|churn|LTV|CAC)\b/i,

  legal:
    /\b(legal|law|regulation|compliance|GDPR|CCPA|contract|terms|privacy|intellectual property|patent|copyright|trademark|liability|jurisdiction|policy|consent|agreement|clause|dispute|court|attorney|legislation|statute|due diligence)\b/i,
};

// ─── Complexity classifier ────────────────────────────────────────────────────
const classifyComplexity = (text, wordCount, flags) => {
  if (
    wordCount > 60 ||
    flags.needsCode ||
    flags.needsMath ||
    flags.isAgentsMeta ||
    (flags.isAnalytical && wordCount > 30)
  ) return 'high';
  if (wordCount > 20 || flags.needsDesign || flags.isWriting) return 'medium';
  return 'low';
};

// ─── Agent focus builders ─────────────────────────────────────────────────────
const buildAgentFocus = (flags, team) => {
  const { needsCode, needsDesign, needsMath, isWriting, isAnalytical, isCreative, isConversational, primaryType, wordCount } = flags;
  const bias = team?.analysisBias || {};

  // ── Reasoner: THEORY / ARCHITECTURE / LOGIC only ─────────────────────────
  // Never delivers implementations, numbers, or analogies — those belong to Coder and Vision.
  let reasonerDeliver;
  if (needsCode)     reasonerDeliver = 'architectural decisions ONLY — problem decomposition, interface contracts, edge-case inventory, and scale horizon. Zero code.';
  else if (needsMath)     reasonerDeliver = 'theoretical derivation ONLY — governing law in LaTeX, axioms, derivation chain, domain of validity. Zero numerical substitution.';
  else if (isWriting)     reasonerDeliver = 'content strategy ONLY — reader persona, core thesis, tone spec, structural blueprint, anti-patterns. Zero actual writing.';
  else if (isAnalytical)  reasonerDeliver = 'first-principles reasoning ONLY — real question beneath the surface, key variables, reasoning chain, assumption audit, counterargument. Zero data or evidence.';
  else                    reasonerDeliver = 'logical framework ONLY — question reframe, reasoning chain, assumption audit, confidence verdict. Zero implementation or visualization.';

  // ── Coder: IMPLEMENTATION / COMPUTATION / EVIDENCE only ─────────────────
  // Never delivers theory, analogies, or structure recommendations.
  let coderDeliver;
  if (needsCode)     coderDeliver = 'complete runnable implementation ONLY — every function body filled, typed signatures, error handling. Zero architecture prose or audits.';
  else if (needsMath)     coderDeliver = 'numerical computation ONLY — given/find table, step-by-step substitution with LaTeX, unit propagation, boxed final answer, sanity check. Zero theory or graphs.';
  else if (isWriting)     coderDeliver = 'actual written piece ONLY — full draft with opening hook, concrete specificity, active voice, bold alternative. Zero strategy or editing.';
  else if (isAnalytical)  coderDeliver = 'evidence-based analysis ONLY — evidence hierarchy, comparative matrix, causal mechanism chain, quantified trade-offs, decision framework. Zero first-principles reasoning.';
  else                    coderDeliver = 'concrete technical depth ONLY — mechanism explanation, exact specifications, misconception correction, comparative grounding, quantified claims. Zero theory or mental models.';

  // ── Vision: CRITIQUE / INTUITION / COMPREHENSION only ───────────────────
  // Never delivers theory, code, or data — only meta-level structure and experience.
  let visionDeliver;
  if (needsCode)     visionDeliver = 'adversarial audit ONLY — vulnerability catalog, Big-O audit, STRIDE threat model, test matrix, hardening prescriptions. Zero implementations.';
  else if (needsMath)     visionDeliver = 'physical intuition ONLY — graph description, plain-language mechanism, variable sensitivity in LaTeX proportionality, everyday analogy, magnitude anchors. Zero equations or numbers.';
  else if (isWriting)     visionDeliver = 'line-level editorial surgery ONLY — 5 weakest lines with rewrites, rhythm audit, precision vocabulary swaps, emotional arc mapping, opening/closing verdict. Zero new content.';
  else if (isCreative)    visionDeliver = 'creative direction ONLY — strongest/weakest element, tonal audit, rhythm surgery, six precision word swaps. Zero new drafts.';
  else if (needsDesign)   visionDeliver = 'UI/UX patterns ONLY — visual hierarchy, component layout, spacing, color semantics, accessibility. Zero code or strategy.';
  else                    visionDeliver = 'comprehension architecture ONLY — cognitive load audit, mental model design, analogy with explicit mapping, insight crystallization, structure recommendation. Zero content delivery.';

  // ── Writer: synthesis only ─────────────────────────────────────────────
  let writerDeliver = 'integrate all specialist angles into one authoritative, well-structured final answer with no preamble';
  if (isConversational && wordCount <= 15) writerDeliver = 'brief, natural, conversational answer that directly addresses the query';

  return {
    reasoner: { emphasis: needsCode || needsMath || isAnalytical ? 'high' : 'medium', deliver: reasonerDeliver },
    coder:    { emphasis: needsCode || needsMath ? 'high' : isAnalytical ? 'medium-high' : 'medium', deliver: coderDeliver },
    vision:   { emphasis: needsDesign || isWriting || isCreative || needsCode ? 'high' : 'medium', deliver: visionDeliver },
    writer:   { emphasis: 'high', deliver: writerDeliver },
  };
};

// ─── Shared brief builder ─────────────────────────────────────────────────────
const buildSharedBrief = (text, flags, team) => {
  const { primaryType, needsCode, needsDesign, needsMath, isWriting, isConversational, complexity, wordCount } = flags;

  const lines = [
    `Request type: ${primaryType} | Complexity: ${complexity} | Words: ${wordCount}.`,
    `Team: "${team?.name || 'Unknown'}" — each specialist contributes their unique angle in parallel.`,
  ];

  if (needsCode) {
    lines.push('Code task confirmed — include working implementations, not pseudocode. Language tags required on all code blocks.');
  } else {
    lines.push('NOT a primary coding task — contribute deep insight. Code only when a short snippet makes the explanation unambiguous.');
  }

  if (needsMath) lines.push('Math/science task — all equations and variables MUST use LaTeX notation. Show full derivation chain.');
  if (needsDesign) lines.push('Design/UX task — address visual hierarchy, component layout, accessibility, and interaction patterns.');
  if (isWriting) lines.push('Writing task — voice, tone, structure, and audience alignment matter as much as content.');
  if (isConversational && wordCount <= 15) lines.push('Short conversational query — keep responses concise and human. Skip heavy formatting.');

  lines.push(`Original query: "${text}"`);
  return lines.join(' ');
};

// ─── Main analyzer ────────────────────────────────────────────────────────────
/**
 * Fast local query analysis — no API call.
 * Returns rich flags that drive specialist prompts, coordination UI, and writer synthesis.
 */
export const analyzeQuery = (userText = '') => {
  const text = userText.trim();
  const lower = text.toLowerCase();
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  const team = getActiveTeam();
  const bias = team?.analysisBias || {};

  // ── Detection flags ──
  const isAgentsMeta    = PATTERNS.agentsMeta.test(text);
  const needsCode      = PATTERNS.code.test(lower)         || !!bias.needsCode;
  const needsDesign    = PATTERNS.design.test(lower);
  const needsMath      = PATTERNS.math.test(lower)          || !!bias.needsMath;
  const isWriting      = PATTERNS.writing.test(lower)       || !!bias.preferWriting;
  const isAnalytical   = PATTERNS.analytical.test(lower)    || !!bias.preferAnalytical;
  const isConversational = PATTERNS.conversational.test(lower) && wordCount <= 20;
  const isCreative     = PATTERNS.creative.test(lower);
  const needsTable     = PATTERNS.tabular.test(lower);
  const isFinancial    = PATTERNS.financial.test(lower);
  const isLegal        = PATTERNS.legal.test(lower);

  // ── Verbosity level: 'detailed' when user explicitly asks for depth/research language ──
  // Everything else defaults to 'simple' — plain language, short paragraphs, bullets where useful.
  const verbosityLevel = PATTERNS.detailedMode.test(text) ? 'detailed' : 'simple';

  // ── Primary type (ordered by specificity) ──
  let primaryType = 'general';
  if (isAgentsMeta)    primaryType = 'swarm_meta';
  else if (needsCode) primaryType = 'coding';
  else if (needsDesign) primaryType = 'design';
  else if (needsMath) primaryType = 'stem';
  else if (isCreative) primaryType = 'creative';
  else if (isWriting) primaryType = 'writing';
  else if (isAnalytical) primaryType = 'analytical';
  else if (isFinancial) primaryType = 'financial';
  else if (isLegal)   primaryType = 'legal';
  else if (isConversational) primaryType = 'conversational';

  // ── Coordination mode ──
  const isSimple = wordCount <= 10 && isConversational && !needsCode && !needsMath && !isAgentsMeta;
  let coordinationMode = COORDINATION_MODES.FULL;
  if (isSimple) {
    coordinationMode = COORDINATION_MODES.NONE;
  } else if (wordCount <= 18 && !needsCode && !needsMath && !isAgentsMeta && !isAnalytical) {
    coordinationMode = COORDINATION_MODES.COMPACT;
  }

  const flags = {
    primaryType, needsCode, needsDesign, needsMath, isWriting, isAnalytical,
    isConversational, isCreative, needsTable, isFinancial, isLegal, isAgentsMeta,
    isSimple, wordCount, coordinationMode, verbosityLevel,
    complexity: classifyComplexity(text, wordCount, { needsCode, needsMath, isAgentsMeta, isAnalytical, isWriting, needsDesign }),
  };

  const agentFocus = buildAgentFocus(flags, team);
  const sharedBrief = buildSharedBrief(text, flags, team);

  return {
    ...flags,
    agentFocus,
    sharedBrief,
  };
};
