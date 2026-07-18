/**
 * src/agents/api/circuitBreaker.js
 *
 * Session-scoped circuit breaker per provider.
 * Once a provider fails N consecutive times within a session, it is skipped
 * for all subsequent calls without attempting a network round-trip.
 *
 * State resets on app restart (in-memory only — no persistence).
 *
 * Thresholds (configurable):
 *   FAILURE_THRESHOLD  — consecutive failures before the breaker opens (default: 3)
 *   HALF_OPEN_DELAY_MS — how long before a tripped provider is retried once (default: 60s)
 */

const FAILURE_THRESHOLD = 3;
const HALF_OPEN_DELAY_MS = 60_000; // 1 minute

// provider → { failures: number, openedAt: number | null }
const _state = {};

const _get = (provider) => {
  if (!_state[provider]) {
    _state[provider] = { failures: 0, openedAt: null };
  }
  return _state[provider];
};

/**
 * Returns true if the provider's circuit is open and the call should be skipped.
 */
export const shouldSkip = (provider) => {
  const s = _get(provider);
  if (s.openedAt === null) return false; // breaker closed

  // Half-open window: allow one retry after the delay
  const elapsed = Date.now() - s.openedAt;
  if (elapsed >= HALF_OPEN_DELAY_MS) {
    s.openedAt = null; // reset to half-open; next call will be attempted
    return false;
  }
  return true; // still tripped
};

/**
 * Record a successful call — resets the failure counter.
 */
export const recordSuccess = (provider) => {
  const s = _get(provider);
  s.failures = 0;
  s.openedAt = null;
};

/**
 * Record a failed call — increments counter and trips the breaker at threshold.
 */
export const recordFailure = (provider) => {
  const s = _get(provider);
  s.failures += 1;
  if (s.failures >= FAILURE_THRESHOLD && s.openedAt === null) {
    s.openedAt = Date.now();
    if (__DEV__) {
      console.warn(`[CircuitBreaker] ${provider} tripped after ${s.failures} failures.`);
    }
  }
};

/**
 * Reset a specific provider (e.g. after user re-enters a key).
 */
export const resetProvider = (provider) => {
  _state[provider] = { failures: 0, openedAt: null };
};

/**
 * Return current breaker state for all tracked providers (useful for telemetry/UI).
 */
export const getBreakerSnapshot = () =>
  Object.fromEntries(
    Object.entries(_state).map(([provider, s]) => [
      provider,
      {
        failures: s.failures,
        isOpen: s.openedAt !== null,
        openedAt: s.openedAt,
      },
    ])
  );
