/**
 * src/agents/api/fallbackChain.js
 *
 * Per-role ordered fallback list.
 * When a primary call fails, callAgent.js walks this list until a provider
 * succeeds or the list is exhausted.
 *
 * Structure: { [role]: [ { provider, model, key }, ... ] }
 *
 * HOW TO CONFIGURE:
 *   Call setFallbackChain(role, fallbacks) at startup (e.g. from MainApp.js
 *   after loading agentConfigs) to register fallback providers for each role.
 *   Fallbacks are ordered — index 0 is tried first.
 *
 * Each entry is the same shape as an agentConfig:
 *   { provider: 'groq', model: 'llama-3.3-70b-versatile', key: 'gsk_...' }
 *
 * Fallbacks without a key are silently skipped.
 */

// Session-scoped fallback registry (reset on app restart)
const _chains = {
  reasoner: [],
  coder:    [],
  vision:   [],
  writer:   [],
};

// Track which index we're at for each role's chain in this session
const _sessionPointer = {};

/**
 * Register fallbacks for a role.
 * @param {string} role
 * @param {Array<{ provider, model, key }>} fallbacks
 */
export const setFallbackChain = (role, fallbacks = []) => {
  _chains[role] = fallbacks.filter((f) => f && f.provider && f.key);
  _sessionPointer[role] = 0;
};

/**
 * Register fallback chains for all roles at once.
 * @param {Record<string, Array>} chainMap  — { reasoner: [...], coder: [...], ... }
 */
export const setAllFallbackChains = (chainMap = {}) => {
  Object.entries(chainMap).forEach(([role, chain]) => setFallbackChain(role, chain));
};

/**
 * Get the next fallback config for a role after a given primary provider fails.
 * Returns null if no fallback is available.
 *
 * @param {string} role
 * @param {string} failedProvider — the provider that just failed
 * @returns {{ provider, model, key } | null}
 */
export const getNextFallback = (role, failedProvider) => {
  const chain = _chains[role] ?? [];
  if (!chain.length) return null;

  // Find the first entry that isn't the provider that just failed
  const candidate = chain.find(
    (entry) => entry.provider !== failedProvider && entry.key?.trim()
  );
  return candidate ?? null;
};

/**
 * Reset all session pointers (call when starting a new session or resetting keys).
 */
export const resetFallbackPointers = () => {
  Object.keys(_sessionPointer).forEach((k) => { _sessionPointer[k] = 0; });
};
