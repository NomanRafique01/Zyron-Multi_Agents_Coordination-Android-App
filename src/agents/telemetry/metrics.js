/**
 * src/agents/telemetry/metrics.js
 *
 * Session-local telemetry: latency, token cost, and error rate per provider+role.
 * Data lives in memory for the current session.
 * Optionally forwarded to Firebase Analytics if already integrated in the app.
 *
 * No new backend, no new SDK required. All writes are fire-and-forget.
 */

// ─── Firebase Analytics (optional) ───────────────────────────────────────────
let analytics = null;
try {
  analytics = require('@react-native-firebase/analytics').default;
} catch {
  // Firebase not installed — metrics stay in-memory only.
}

// ─── In-session store ─────────────────────────────────────────────────────────
// provider:role → { calls, totalLatencyMs, totalPromptTokens, totalCompletionTokens, errors }
const _session = {};

const _key = (provider, role) => `${provider}:${role}`;

const _get = (provider, role) => {
  const k = _key(provider, role);
  if (!_session[k]) {
    _session[k] = { calls: 0, totalLatencyMs: 0, totalPromptTokens: 0, totalCompletionTokens: 0, errors: 0 };
  }
  return _session[k];
};

// ─── Record a successful call ─────────────────────────────────────────────────
/**
 * @param {string} provider
 * @param {string} role
 * @param {number} latencyMs
 * @param {{ prompt_tokens: number, completion_tokens: number }} usage
 */
export const recordCall = (provider, role, latencyMs, usage = {}) => {
  const s = _get(provider, role);
  s.calls += 1;
  s.totalLatencyMs += latencyMs;
  s.totalPromptTokens += usage.prompt_tokens || 0;
  s.totalCompletionTokens += usage.completion_tokens || 0;

  analytics?.()?.logEvent?.('agent_call', {
    provider,
    role,
    latency_ms: Math.round(latencyMs),
    prompt_tokens: usage.prompt_tokens || 0,
    completion_tokens: usage.completion_tokens || 0,
  }).catch(() => {});
};

// ─── Record a call error ──────────────────────────────────────────────────────
/**
 * @param {string} provider
 * @param {string} role
 * @param {string} errorType  — 'exhausted' | 'timeout' | 'error' | 'abort'
 */
export const recordError = (provider, role, errorType = 'error') => {
  const s = _get(provider, role);
  s.errors += 1;

  analytics?.()?.logEvent?.('agent_error', { provider, role, error_type: errorType }).catch(() => {});
};

// ─── Session summary ──────────────────────────────────────────────────────────
/**
 * Returns a snapshot of all recorded metrics for the current session.
 * Useful for displaying in a dev/debug panel.
 *
 * @returns {Array<{ provider, role, calls, avgLatencyMs, totalTokens, errors, errorRate }>}
 */
export const getSessionSummary = () =>
  Object.entries(_session).map(([k, s]) => {
    const [provider, role] = k.split(':');
    return {
      provider,
      role,
      calls:         s.calls,
      avgLatencyMs:  s.calls > 0 ? Math.round(s.totalLatencyMs / s.calls) : 0,
      totalTokens:   s.totalPromptTokens + s.totalCompletionTokens,
      promptTokens:  s.totalPromptTokens,
      completionTokens: s.totalCompletionTokens,
      errors:        s.errors,
      errorRate:     s.calls > 0 ? (s.errors / s.calls) : 0,
    };
  });

/**
 * Clear session metrics (call between conversations if desired).
 */
export const clearSession = () => {
  Object.keys(_session).forEach((k) => delete _session[k]);
};
