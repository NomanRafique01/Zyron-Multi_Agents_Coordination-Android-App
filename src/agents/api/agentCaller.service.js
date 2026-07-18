import { invokeProvider, supportsCaching } from './providers.service';
import { isKeyExhaustedError } from '../utils/agentErrors.utils';
import { getNextFallback } from './fallbackChain';
import { shouldSkip, recordFailure, recordSuccess } from './circuitBreaker';

// ─── Rate-limit backoff helper ────────────────────────────────────────────────
// Free-tier providers (Groq, OpenRouter, Mistral) return 429 when the token/minute
// or request/minute budget is exceeded. Rather than failing immediately, we wait
// and retry up to MAX_RETRIES times with exponential backoff + jitter.
//
// This is the single most important fix for "all specialists fail on big prompts":
// 3 agents firing simultaneously always exhausts Groq's 6 000 tokens/min free quota.
// A short wait lets the window reset and the retry succeeds.
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 3_000;   // 3 s base — Groq window resets every 60 s

const isRateLimitError = (err) =>
  err?.status === 429 ||
  String(err?.message || '').toLowerCase().includes('rate limit') ||
  String(err?.message || '').toLowerCase().includes('rate-limit') ||
  String(err?.message || '').toLowerCase().includes('too many requests') ||
  String(err?.message || '').toLowerCase().includes('tokens per minute') ||
  String(err?.message || '').toLowerCase().includes('requests per minute');

// Transient errors: safe to retry with backoff (429 + 5xx overloaded)
const isTransientError = (err) =>
  isRateLimitError(err) ||
  err?.status === 502 ||
  err?.status === 503 ||
  err?.status === 529 ||
  String(err?.message || '').toLowerCase().includes('overloaded') ||
  String(err?.message || '').toLowerCase().includes('service unavailable') ||
  String(err?.message || '').toLowerCase().includes('model is currently') ||
  String(err?.message || '').toLowerCase().includes('temporarily unavailable') ||
  String(err?.message || '').toLowerCase().includes('no endpoints');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Invoke provider with automatic exponential-backoff retry on 429.
 * Other errors are passed through immediately (no retry).
 */
const invokeWithRetry = async (provider, model, key, messages, signal, cache) => {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error('Aborted');
    try {
      return await invokeProvider(provider, model, key, messages, signal, cache);
    } catch (err) {
      lastErr = err;

      // Don't retry on user cancel or non-429 errors
      if (signal?.aborted || err.name === 'AbortError' || err.message === 'Aborted') {
        throw new Error('Aborted');
      }
      if (!isTransientError(err) || attempt === MAX_RETRIES) throw err;

      // Exponential backoff: 3s, 6s, 12s — with ±500 ms jitter to avoid thundering herd
      const delay = BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 500;
      console.warn(`[callAgent] transient error on ${provider} (attempt ${attempt + 1}/${MAX_RETRIES}) — retrying in ${Math.round(delay / 1000)}s:`, err.message);
      await sleep(delay);
    }
  }
  throw lastErr;
};

/**
 * callAgent — single agent call with:
 *  - exponential backoff retry on 429 rate-limit errors
 *  - prompt-cache forwarding for supporting providers
 *  - per-agent timeout via AbortController
 *  - fallback chain on key-exhausted / rate-limit / timeout
 *  - circuit-breaker skip for repeatedly-failing providers
 */
export const callAgent = async (
  role,
  agentConfig,
  messages,
  signal,
  onSocketStatusChange,
  promptCache = null    // { staticPrefix, dynamicSuffix } — optional, from buildSpecialistPrompt
) => {
  const key = agentConfig.key ? agentConfig.key.trim() : '';
  const { provider, model } = agentConfig;

  if (!key) {
    const errorMsg = `No API key configured for ${role} agent.`;
    onSocketStatusChange?.(role, 'inactive', errorMsg);
    throw new Error(errorMsg);
  }

  if (signal?.aborted) throw new Error('Aborted');

  // ── Per-agent timeout ─────────────────────────────────────────────────────
  // 90 s to accommodate up to 3 backoff retries (3+6+12 = 21 s of sleep) plus
  // actual API response time. Override via agentConfig.timeoutMs if needed.
  const timeoutMs = agentConfig.timeoutMs ?? 90_000;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  // Combine user signal + timeout signal.
  // IMPORTANT: we track timeoutController separately so we can distinguish
  // a per-agent timeout (recoverable) from a user-initiated cancel (fatal).
  const combinedSignal = signal
    ? _combineSignals(signal, timeoutController.signal)
    : timeoutController.signal;

  const cache = supportsCaching(provider) ? promptCache : null;

  // ── Primary call (with 429 retry) ─────────────────────────────────────────
  try {
    if (shouldSkip(provider)) {
      throw new Error(`Circuit breaker open for provider: ${provider}`);
    }
    const result = await invokeWithRetry(provider, model, key, messages, combinedSignal, cache);
    clearTimeout(timeoutId);
    recordSuccess(provider);
    onSocketStatusChange?.(role, 'active', '');
    return result;
  } catch (err) {
    clearTimeout(timeoutId);

    // User explicitly cancelled — propagate immediately, no fallback.
    if (signal?.aborted) throw new Error('Aborted');

    // Per-agent timeout: the fetch threw AbortError because timeoutController fired.
    // This must NOT propagate as a user-cancel — treat it as a recoverable failure
    // so the orchestrator can use partial text or fall back gracefully.
    const isTimeout = timeoutController.signal.aborted;
    if (isTimeout) {
      const timeoutErr = new Error(`Agent ${role} timed out after ${timeoutMs / 1000}s`);
      timeoutErr.isAgentTimeout = true;
      recordFailure(provider);
      onSocketStatusChange?.(role, 'error', timeoutErr.message);
      throw timeoutErr;
    }

    // Any other AbortError that isn't ours — treat as user cancel to be safe.
    if (err.name === 'AbortError' || err.message === 'Aborted') throw new Error('Aborted');

    const isExhausted = isKeyExhaustedError(err);
    // Only record as circuit-breaker failure if it's NOT a transient error.
    // 429s and 5xx overloads are transient — penalizing the circuit breaker
    // would cause the provider to be skipped on the very next message.
    if (!isTransientError(err)) {
      recordFailure(provider);
    }

    // ── Fallback chain ────────────────────────────────────────────────────
    const fallbackConfig = getNextFallback(role, provider);
    if (fallbackConfig) {
      const fbKey = fallbackConfig.key?.trim() ?? '';
      if (fbKey && !shouldSkip(fallbackConfig.provider)) {
        try {
          const fbResult = await invokeWithRetry(
            fallbackConfig.provider,
            fallbackConfig.model,
            fbKey,
            messages,
            signal,
            null
          );
          recordSuccess(fallbackConfig.provider);
          onSocketStatusChange?.(role, 'active', '');
          return fbResult;
        } catch (fbErr) {
          if (signal?.aborted || fbErr.name === 'AbortError' || fbErr.message === 'Aborted') throw new Error('Aborted');
          if (!isTransientError(fbErr)) recordFailure(fallbackConfig.provider);
        }
      }
    }

    // No fallback succeeded — surface status and rethrow
    if (isExhausted) {
      onSocketStatusChange?.(role, 'exhausted', err.message);
    } else {
      onSocketStatusChange?.(role, 'error', err.message);
    }
    throw err;
  }
};

// ─── Signal combiner (both AbortSignals in parallel) ─────────────────────────
function _combineSignals(sig1, sig2) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (sig1.aborted || sig2.aborted) {
    controller.abort();
    return controller.signal;
  }
  sig1.addEventListener('abort', abort, { once: true });
  sig2.addEventListener('abort', abort, { once: true });
  return controller.signal;
}
