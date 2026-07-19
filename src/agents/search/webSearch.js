/**
 * src/agents/search/webSearch.js
 *
 * Public entry point for frontend web search.
 *
 * Fallback chain: Tavily → Serper → null
 * - If Tavily succeeds and returns results → return immediately.
 * - If Tavily fails or returns null → try Serper.
 * - If both fail → return null (agents use own knowledge, silently).
 *
 * Result caching:
 * - Identical queries within the same session are cached to avoid repeated
 *   API calls when the user asks the same question twice.
 *
 * Performance guarantee:
 * - The 3-second hard timeout is enforced inside each provider.
 *   runWebSearch() itself will never hang longer than ~3 s per provider.
 */

import { searchTavily, searchSerper } from './searchProviders';

// ─── Session-level query cache ────────────────────────────────────────────────
// Keyed by normalised query string. Cleared on app restart automatically
// because this is a module-level Map (not persisted).
const _cache = new Map();

const _normalise = (query = '') => query.trim().toLowerCase();

// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Run web search with automatic Tavily → Serper fallback.
 *
 * @param {string} query — optimized search query (from queryAnalyzer.webSearchQuery)
 * @returns {Promise<object|null>}
 *   Resolves to a formatted search result object, or null if both providers
 *   returned nothing (agents silently use their own knowledge).
 */
export const runWebSearch = async (query) => {
  if (!query || !query.trim()) return null;

  console.log('[WebSearch] Query received:', query);

  const key = _normalise(query);

  // Return cached result for duplicate queries in the same session.
  if (_cache.has(key)) {
    console.log('[WebSearch] Cache hit for query:', query);
    return _cache.get(key);
  }

  // ── Tavily first ──────────────────────────────────────────────────────────
  console.log('[WebSearch] Trying Tavily...');
  const tavilyResult = await searchTavily(query);
  if (tavilyResult) {
    console.log('[WebSearch] Tavily success:', tavilyResult);
    _cache.set(key, tavilyResult);
    return tavilyResult;
  }

  // ── Serper fallback ───────────────────────────────────────────────────────
  console.log('[WebSearch] Tavily failed, trying Serper...');
  const serperResult = await searchSerper(query);
  if (serperResult) {
    console.log('[WebSearch] Serper success:', serperResult);
    _cache.set(key, serperResult);
    return serperResult;
  }

  // ── Both failed — agents use own knowledge ────────────────────────────────
  // Cache null so a repeated query in the same session doesn't hit the network again.
  console.log('[WebSearch] Both providers failed — using model knowledge');
  _cache.set(key, null);
  return null;
};

/**
 * Clear the search cache (useful between conversations or on memory pressure).
 */
export const clearSearchCache = () => _cache.clear();
