/**
 * src/agents/utils/promptChunker.js
 *
 * Large-prompt chunking for weak/small models.
 *
 * Problem:
 *   Small models (mistral-small, gemini-flash-lite, llama-8b, etc.) have limited
 *   context windows AND degrade in quality when given very large prompts.
 *   Sending the full 500-word user prompt to every specialist causes truncated,
 *   shallow, or incoherent outputs.
 *
 * Solution:
 *   When the prompt is "large" AND the configured model is "weak":
 *     1. Split the prompt into semantic chunks — one primary chunk per specialist role.
 *     2. Each specialist receives only their assigned chunk + their role directive.
 *     3. All specialist outputs flow to the writer unchanged (same synthesis path).
 *
 * This keeps each individual API call well within the weak model's reliable range
 * while the writer still assembles a complete, coherent final answer.
 */

// ─── Weak model registry ──────────────────────────────────────────────────────
// Models listed here are treated as "weak" (small context / low capacity).
// Add any model whose name contains one of these substrings (case-insensitive).
const WEAK_MODEL_SUBSTRINGS = [
  'mistral-small',
  'mistral-7b',
  'gemma-2-9b',
  'gemma-3-4b',
  'gemma-3-12b',
  'gemini-2.0-flash-lite',
  'gemini-flash-lite',
  'llama-3.1-8b',
  'llama-3-8b',
  'llama-8b',
  'llama3-8b',
  'mixtral-8x7b',   // per-expert layers are small
  'phi-3-mini',
  'phi-3.5-mini',
  'phi-2',
  'qwen-2-1.5b',
  'qwen-1.5-7b',
  'qwen2-7b',
  'deepseek-r1-7b',
  'deepseek-r1-8b',
  'smollm',
  'tinyllama',
  'orca-mini',
  'neural-chat-7b',
];

/**
 * Returns true if the given model string matches any weak-model pattern.
 * @param {string} model
 * @returns {boolean}
 */
export const isWeakModel = (model = '') => {
  const lower = model.toLowerCase();
  return WEAK_MODEL_SUBSTRINGS.some((sub) => lower.includes(sub));
};

// ─── Chunking threshold ───────────────────────────────────────────────────────
// Prompts longer than this word count trigger chunking when a weak model is used.
export const CHUNK_THRESHOLD_WORDS = 120;

/**
 * Returns true when the prompt should be chunked:
 *   - agentConfigs contains at least one weak model, AND
 *   - the prompt exceeds CHUNK_THRESHOLD_WORDS words.
 *
 * @param {string}  userText
 * @param {object}  agentConfigs   — { reasoner, coder, vision, writer }
 * @returns {boolean}
 */
export const shouldChunkPrompt = (userText = '', agentConfigs = {}) => {
  const wordCount = userText.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < CHUNK_THRESHOLD_WORDS) return false;

  return Object.values(agentConfigs).some(
    (cfg) => cfg?.model && isWeakModel(cfg.model)
  );
};

// ─── Semantic chunking ────────────────────────────────────────────────────────
/**
 * Split a large prompt into semantically focused sub-prompts per specialist role.
 *
 * Strategy:
 *   - Split on double-newlines (paragraphs) or fallback to sentence boundaries.
 *   - Assign paragraphs round-robin so each specialist gets roughly equal text.
 *   - The reasoner  → opening framing / background context
 *   - The coder     → core request / technical or factual detail
 *   - The vision    → requirements, constraints, nuance, edge-cases
 *
 * Every specialist also receives a compact 1-sentence summary of the FULL prompt
 * as header context, so they understand the big picture even when working on a slice.
 *
 * @param {string}   userText
 * @param {string[]} roles      — specialist roles in pipeline order (e.g. ['reasoner','coder','vision'])
 * @returns {{ [role: string]: { slice: string; fullSummary: string; chunkIndex: number; totalChunks: number } }}
 */
export const chunkPromptForRoles = (userText = '', roles = ['reasoner', 'coder', 'vision']) => {
  const text = userText.trim();

  // ── Build a compact full-prompt summary (first 2 sentences or 60 words) ────
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  const summaryWords = [];
  for (const s of sentences) {
    summaryWords.push(...s.trim().split(/\s+/));
    if (summaryWords.length >= 60) break;
  }
  const fullSummary = summaryWords.join(' ').replace(/\s+/g, ' ').trim();

  // ── Split into paragraphs ─────────────────────────────────────────────────
  let segments = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  // If the text is one giant paragraph (no blank lines), split on sentence boundaries instead.
  if (segments.length < roles.length) {
    segments = (text.match(/[^.!?]+[.!?]*/g) || [text]).map((s) => s.trim()).filter(Boolean);
  }

  // Last resort: split on word count into equal slices.
  if (segments.length < roles.length) {
    const words = text.split(/\s+/);
    const sliceSize = Math.ceil(words.length / roles.length);
    segments = roles.map((_, i) =>
      words.slice(i * sliceSize, (i + 1) * sliceSize).join(' ')
    );
  }

  // ── Distribute segments across roles ─────────────────────────────────────
  // Group consecutive segments into N buckets so each role gets a contiguous slice.
  const buckets = Array.from({ length: roles.length }, () => []);
  segments.forEach((seg, i) => {
    buckets[i % roles.length].push(seg);
  });

  const result = {};
  roles.forEach((role, idx) => {
    result[role] = {
      slice: buckets[idx].join('\n\n'),
      fullSummary,
      chunkIndex: idx + 1,
      totalChunks: roles.length,
    };
  });

  return result;
};

// ─── Chunked specialist user-message builder ──────────────────────────────────
/**
 * Build the user-facing content for a specialist when chunking is active.
 *
 * The message clearly tells the agent:
 *   1. The overall request (summary) so it has full context.
 *   2. Exactly which portion of the original prompt is its responsibility.
 *   3. That other specialists are handling the remaining parts.
 *
 * The system prompt (specialist directive + role format) is built separately by
 * the existing buildSpecialistPrompt path and is NOT modified by chunking.
 *
 * @param {{ slice: string; fullSummary: string; chunkIndex: number; totalChunks: number }} chunk
 * @param {string} roleName   — human-readable role name (e.g. "Scholar", "Analyst")
 * @returns {string}          — the user message content to replace bare userText
 */
export const buildChunkedUserMessage = (chunk, roleName = 'Specialist') => {
  const { slice, fullSummary, chunkIndex, totalChunks } = chunk;

  return [
    `[FULL REQUEST CONTEXT — for background only]`,
    fullSummary,
    ``,
    `[YOUR ASSIGNED PORTION — this is what you must address]`,
    `You are ${roleName} (part ${chunkIndex} of ${totalChunks} specialists working in parallel).`,
    `Focus exclusively on the following section of the user's request and answer it thoroughly from your specialist angle:`,
    ``,
    slice,
    ``,
    `Note: Other specialists are handling the remaining parts of the full request. Your job is to cover your assigned section deeply — the Writer will assemble all outputs into one complete final answer.`,
  ].join('\n');
};
