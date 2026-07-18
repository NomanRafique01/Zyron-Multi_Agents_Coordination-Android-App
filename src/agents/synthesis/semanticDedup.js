/**
 * src/agents/synthesis/semanticDedup.js
 *
 * Embedding-based semantic deduplication.
 * Replaces / supplements the lexical word-overlap check in outputUtils.js.
 *
 * Strategy:
 *   - Use a lightweight embedding call (small/cheap model) to get vectors.
 *   - Compute pairwise cosine similarity.
 *   - Suppress the shorter output when similarity > SEMANTIC_THRESHOLD.
 *
 * Fallback:
 *   - If embedding fails for any reason (key missing, network error, timeout),
 *     the function returns the original outputs unchanged — the existing
 *     lexical dedup in outputUtils.js remains the backstop.
 *
 * Provider: we use Mistral's cheap embedding endpoint by default.
 * Override by passing embedProvider / embedKey / embedModel in options.
 */

const SEMANTIC_THRESHOLD = 0.82; // cosine similarity above which one output is suppressed
const EMBED_TIMEOUT_MS  = 5_000;

// ─── Cosine similarity ────────────────────────────────────────────────────────
const cosine = (a, b) => {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

// ─── Embedding fetch (Mistral, OpenAI-compatible) ─────────────────────────────
const fetchEmbeddings = async (texts, provider, model, key) => {
  const endpoints = {
    mistral:    'https://api.mistral.ai/v1/embeddings',
    openai:     'https://api.openai.com/v1/embeddings',
    openrouter: 'https://openrouter.ai/api/v1/embeddings',
  };
  const models = {
    mistral:    'mistral-embed',
    openai:     'text-embedding-3-small',
    openrouter: 'openai/text-embedding-3-small',
  };

  const endpoint = endpoints[provider] || endpoints.mistral;
  const embedModel = model || models[provider] || models.mistral;

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: embedModel, input: texts }),
    signal: controller.signal,
  });
  clearTimeout(tid);

  if (!res.ok) throw new Error(`Embed API error ${res.status}`);
  const data = await res.json();
  return data.data.map((d) => d.embedding);
};

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * Semantically deduplicate specialist outputs.
 * Returns a new object with the same keys — suppressed outputs set to ''.
 *
 * @param {Record<string,string>} outputsByRole
 * @param {object} embedConfig  — { provider, model, key } for the embedding call
 * @returns {Promise<Record<string,string>>}
 */
export const semanticDedup = async (outputsByRole, embedConfig = {}) => {
  const { provider = 'mistral', model = null, key = '' } = embedConfig;

  if (!key) return outputsByRole; // no embed key — skip silently

  const roles = Object.keys(outputsByRole).filter((r) => outputsByRole[r]?.trim());
  if (roles.length < 2) return outputsByRole;

  let embeddings;
  try {
    embeddings = await fetchEmbeddings(
      roles.map((r) => outputsByRole[r]),
      provider,
      model,
      key
    );
  } catch {
    // Network failure, timeout, or key error — fall back to no dedup
    return outputsByRole;
  }

  const result = { ...outputsByRole };

  // Pairwise comparison
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      if (!result[roles[i]] || !result[roles[j]]) continue; // already suppressed
      const sim = cosine(embeddings[i], embeddings[j]);
      if (sim > SEMANTIC_THRESHOLD) {
        // Keep the longer/richer output
        if ((result[roles[i]]?.length ?? 0) >= (result[roles[j]]?.length ?? 0)) {
          result[roles[j]] = '';
        } else {
          result[roles[i]] = '';
        }
      }
    }
  }

  return result;
};
