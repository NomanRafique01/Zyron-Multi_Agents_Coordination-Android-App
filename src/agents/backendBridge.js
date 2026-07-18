/**
 * backendBridge.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single entry point for all orchestration calls.
 *
 * Strategy:
 *   1. POST to the Railway backend /orchestrate endpoint (8-second timeout).
 *   2. On any failure — timeout, non-200, network error — fall back silently
 *      to the local runAgentsOrchestrator() without surfacing anything to the UI.
 *
 * Usage:
 *   Replace runAgentsOrchestrator() / runAgentsPipeline() call-sites with:
 *     import { runOrchestration } from './backendBridge';
 *
 * Swap BACKEND_URL below when the Railway service URL is available.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { runAgentsOrchestrator } from './orchestrator';

// ── Backend endpoint ──────────────────────────────────────────────────────────
// Set to the Railway deployment URL once available. Leave as an empty string
// or null to skip the backend attempt entirely and always use local fallback.
const BACKEND_URL = '';

// Milliseconds to wait for the backend before giving up and falling back.
const BACKEND_TIMEOUT_MS = 8000;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * runOrchestration
 *
 * Drop-in replacement for runAgentsOrchestrator(). Accepts identical arguments,
 * tries the backend first, and falls back to the local orchestrator silently.
 *
 * @param {string}      userText
 * @param {object}      agentConfigs
 * @param {function}    onStateChange        — (agents[], meta) => void
 * @param {AbortSignal} signal
 * @param {string}      persona
 * @param {object}      userProfile
 * @param {function}    onSocketStatusChange — (role, status, msg) => void
 * @param {function}    [onStreamDelta]      — (role, chunk) => void
 * @returns {Promise<object>}  Same shape as runAgentsOrchestrator result
 */
export const runOrchestration = async (
  userText,
  agentConfigs,
  onStateChange,
  signal,
  persona,
  userProfile,
  onSocketStatusChange,
  onStreamDelta = null
) => {
  // ── Attempt backend ───────────────────────────────────────────────────────
  if (BACKEND_URL) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

      // Combine the caller's abort signal with our timeout signal so either
      // one cancels the fetch cleanly.
      const combinedSignal = signal
        ? anyAbort([signal, controller.signal])
        : controller.signal;

      const response = await fetch(`${BACKEND_URL}/orchestrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userText,
          agentConfigs,
          persona,
          userProfile,
        }),
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return data;
      }
      // Non-200 → fall through to local fallback silently
    } catch (_err) {
      // Network error, timeout (AbortError), or any other fetch failure →
      // fall through to local fallback silently.
      // Re-throw only if the caller explicitly cancelled (user pressed Stop).
      if (signal?.aborted) throw new Error('Aborted');
    }
  }

  // ── Local fallback ────────────────────────────────────────────────────────
  return runAgentsOrchestrator(
    userText,
    agentConfigs,
    onStateChange,
    signal,
    persona,
    userProfile,
    onSocketStatusChange,
    onStreamDelta
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns an AbortSignal that aborts as soon as ANY of the supplied signals
 * fires. Polyfills AbortSignal.any() for environments that don't have it.
 *
 * @param {AbortSignal[]} signals
 * @returns {AbortSignal}
 */
function anyAbort(signals) {
  if (typeof AbortSignal?.any === 'function') {
    return AbortSignal.any(signals);
  }
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) { controller.abort(); break; }
    s.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}
