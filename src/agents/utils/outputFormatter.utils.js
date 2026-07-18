// ─── Quality scoring ──────────────────────────────────────────────────────────
// Score specialist output on depth and relevance (0–10 scale, heuristic)
const scoreOutput = (text, role, analysis) => {
  if (!text || !text.trim()) return { score: 0, emphasis: 'none' };

  const words = text.trim().split(/\s+/).length;
  const hasMath = /\\\(|\\\[|\\frac|\\sum|\\int|\\sqrt/.test(text);
  const hasCode = /```[\w]*\n/.test(text);
  const hasBullets = /^\s*[-*•]\s/m.test(text);
  const hasHeaders = /^#{1,3}\s/m.test(text);
  const hasNumberedList = /^\s*\d+\.\s/m.test(text);

  let score = 5; // baseline

  // Penalize very short outputs
  if (words < 40)  score -= 2;
  if (words < 20)  score -= 2;
  if (words > 150) score += 1;
  if (words > 300) score += 1;

  // Domain bonuses
  if (analysis.needsMath && hasMath) score += 2;
  if (analysis.needsMath && !hasMath) score -= 2;
  if (analysis.needsCode && hasCode) score += 2;
  if (hasBullets || hasHeaders || hasNumberedList) score += 1;

  // Role-specific bonuses
  if (role === 'coder' && hasCode && analysis.needsCode) score += 1;
  if (role === 'reasoner' && (hasBullets || hasNumberedList)) score += 1;

  const clamped = Math.max(0, Math.min(10, score));
  const emphasis = analysis.agentFocus?.[role]?.emphasis || 'medium';
  return { score: clamped, emphasis };
};

// ─── Deduplication ────────────────────────────────────────────────────────────
export const AGENT_OUTPUT_LIMIT = 999999;

// Hard character cap per specialist fed to the writer.
// 3 specialists × 4 000 chars ≈ 12 000 chars input (~3 000 tokens) —
// comfortably within every free-tier context window even after adding the
// ~2 000-token system prompt. Without this cap, 3 × 8 000-char outputs
// (≈6 000 tokens input) overflow cheap models and produce 400/context errors.
export const WRITER_SPECIALIST_CAP = 4_000;

export const trimOutput = (text, maxChars = WRITER_SPECIALIST_CAP) => {
  if (!text) return '';
  const t = text.trim();
  if (t.length <= maxChars) return t;
  // Cut at a sentence boundary near the cap so the writer gets a coherent excerpt.
  const cutzone = t.slice(0, maxChars + 200);
  const lastSentence = cutzone.search(/[.!?]\s[A-Z\n](?!.*[.!?]\s[A-Z\n])/);
  const cut = lastSentence > maxChars / 2 ? lastSentence + 1 : maxChars;
  return t.slice(0, cut).trimEnd() + '\n\n*(output truncated for context window — full analysis available)*';
};

const wordSet = (text) => new Set(text.toLowerCase().split(/\s+/));

const similarity = (a, b) => {
  const setA = wordSet(a);
  const setB = wordSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  return intersection / Math.max(setA.size, setB.size);
};

/**
 * Deduplication is intentionally disabled.
 *
 * Reason: specialists cover the SAME topic from DIFFERENT angles — they naturally
 * share high vocabulary overlap (same nouns, same verbs, same domain terms).
 * Word-overlap similarity cannot distinguish "same angle" from "same words about
 * a different angle." Suppressing any specialist output causes that agent's
 * contribution to silently vanish from the writer's context, producing responses
 * where one agent appears to not have participated.
 *
 * The writer's synthesis rules enforce redundancy elimination at the semantic
 * level — that is the correct place to handle overlap, not here.
 */
export const deduplicateOutputs = (outputsByRole = {}) => ({ ...outputsByRole });

/**
 * Score all specialist outputs and return a quality report.
 * Used by synthesizer to give writer context about each input's depth.
 */
export const buildQualityReport = (outputsByRole = {}, analysis = {}) => {
  const report = {};
  for (const [role, text] of Object.entries(outputsByRole)) {
    if (text && text.trim()) {
      report[role] = scoreOutput(text, role, analysis);
    }
  }
  return report;
};

/**
 * Build a fallback answer from specialist outputs when the writer/synthesizer fails.
 * Returns the highest-scoring non-empty output.
 */
export const buildFallbackAnswer = (outputsByRole = {}, analysis = {}) => {
  const scored = Object.entries(outputsByRole)
    .filter(([, text]) => text && text.trim())
    .map(([role, text]) => ({ role, text, score: scoreOutput(text, role, analysis).score }))
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return '';

  // If multiple outputs survived, concatenate the top 2 with a separator
  if (scored.length >= 2) {
    return `${scored[0].text}\n\n---\n\n${scored[1].text}`;
  }
  return scored[0].text;
};
