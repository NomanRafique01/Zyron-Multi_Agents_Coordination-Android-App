/**
 * src/agents/streaming/streamManager.js
 *
 * Real SSE/streaming for all providers that support it.
 * Falls back to the existing blocking call (with simulated progress) for
 * providers that do not support streaming — the fallback is transparent to
 * the caller.
 *
 * Public API:
 *   streamAgent(role, agentConfig, messages, onDelta, onDone, onError, signal)
 *
 * onDelta(role, chunk)  — called for each token/chunk as it arrives
 * onDone(role, result)  — called once with { text, usage } when the stream ends
 * onError(role, err)    — called on any unrecoverable error
 */

import { invokeProvider } from '../api/providers.service';
import { isKeyExhaustedError } from '../utils/agentErrors.utils';

// ─── Provider-aware token budgets (mirrors providers.service.js) ──────────────
// Streaming path must use the same safe caps as the blocking path or requests
// will fail / stall on free-tier providers that have hard output limits.
const _SPECIALIST_TOKENS = {
  openai: 8_192, anthropic: 8_192, openrouter: 4_096,
  mistral: 4_096, gemini: 8_192, deepseek: 8_192, groq: 4_096, glm: 4_096,
};
const _WRITER_TOKENS = {
  openai: 32_768, anthropic: 32_768, openrouter: 16_384,
  mistral: 16_384, gemini: 32_768, deepseek: 32_768, groq: 16_384, glm: 16_384,
};
const _getStreamMaxTokens = (provider, isWriter) =>
  (isWriter ? _WRITER_TOKENS : _SPECIALIST_TOKENS)[provider] ?? (isWriter ? 8_192 : 4_096);

// ─── Transient error detection (streaming path) ──────────────────────────────
// Covers both 429 rate-limits AND 5xx transient errors (model overloaded /
// provider temporarily unavailable). Both are safe to retry with backoff.
const _isRateLimitError = (err) =>
  err?.status === 429 ||
  String(err?.message || '').toLowerCase().includes('rate limit') ||
  String(err?.message || '').toLowerCase().includes('rate-limit') ||
  String(err?.message || '').toLowerCase().includes('too many requests') ||
  String(err?.message || '').toLowerCase().includes('tokens per minute') ||
  String(err?.message || '').toLowerCase().includes('requests per minute');

const _isTransientError = (err) =>
  _isRateLimitError(err) ||
  err?.status === 502 ||
  err?.status === 503 ||
  err?.status === 529 ||
  String(err?.message || '').toLowerCase().includes('overloaded') ||
  String(err?.message || '').toLowerCase().includes('service unavailable') ||
  String(err?.message || '').toLowerCase().includes('model is currently') ||
  String(err?.message || '').toLowerCase().includes('temporarily unavailable') ||
  String(err?.message || '').toLowerCase().includes('no endpoints');

const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Providers with streaming support ────────────────────────────────────────
const STREAMING_PROVIDERS = new Set([
  'openai',
  'anthropic',
  'openrouter',
  'mistral',
  'deepseek',
  'groq',
  'glm',
  // gemini uses a different streaming endpoint — handled separately below
]);

// ─── SSE line parser helper ───────────────────────────────────────────────────
const parseSSELine = (line) => {
  if (!line.startsWith('data:')) return null;
  const payload = line.slice(5).trim();
  if (payload === '[DONE]') return { done: true };
  try {
    return { data: JSON.parse(payload) };
  } catch {
    return null;
  }
};

// ─── Extract delta text from chunk (OpenAI-compatible format) ─────────────────
const extractDeltaText = (data) =>
  data?.choices?.[0]?.delta?.content || '';

// ─── Detect an error embedded inside an SSE event ────────────────────────────
// OpenRouter and some other providers stream an error JSON instead of a normal
// delta when a model is unavailable, context is exceeded, or a 5xx occurs.
// The HTTP status is 200 but the body is:  data: {"error":{"message":"...","code":503}}
// Without this check the streaming loop drains silently, returns empty text,
// and the empty-output guard wastes a full blocking retry on the same dead model.
const extractStreamError = (data) => {
  if (!data) return null;
  if (data.error) {
    const msg = data.error.message || JSON.stringify(data.error);
    const err = new Error(msg);
    err.status = data.error.code || data.error.status || 0;
    return err;
  }
  return null;
};

// ─── Extract usage from final chunk ───────────────────────────────────────────
const extractUsage = (data) => ({
  prompt_tokens: data?.usage?.prompt_tokens || 0,
  completion_tokens: data?.usage?.completion_tokens || 0,
});

// ─── Stall watchdog: aborts if no new bytes arrive within `stallMs` ──────────
// This replaces a flat wall-clock timeout. A large but actively-streaming
// response resets the timer on every chunk, so it never fires on healthy
// traffic. Only a truly frozen/stalled connection triggers the abort.
const withStallWatchdog = (signal, stallMs, onStall) => {
  const ctrl = new AbortController();
  let stallTimer = null;

  const reset = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      ctrl.abort();
      onStall?.();
    }, stallMs);
  };

  // Inherit upstream abort immediately
  if (signal?.aborted) {
    ctrl.abort();
  } else {
    signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
  }

  reset(); // start the initial stall timer

  return { signal: ctrl.signal, reset, cancel: () => clearTimeout(stallTimer) };
};

// ─── OpenAI-compatible streaming (openai, openrouter, mistral, deepseek, groq, glm) ──
const streamOpenAICompatible = async (
  endpoint,
  headers,
  body,
  onDelta,
  signal,
  stallMs = 90_000   // abort if no new bytes arrive for 90 s — large prompts on free-tier models
                     // can take 30-60 s to produce the first token; 30 s was too aggressive
) => {
  // Build stall-watchdog signal so large-but-active responses never time out.
  let stallAborted = false;
  const watchdog = withStallWatchdog(signal, stallMs, () => { stallAborted = true; });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: true }),
    signal: watchdog.signal,
  });

  if (!res.ok) {
    watchdog.cancel();
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let usage = { prompt_tokens: 0, completion_tokens: 0 };
  let buffer = '';
  let streamDone = false;

  try {
    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;

      // Reset stall timer — we got live bytes
      watchdog.reset();

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // keep incomplete last line

      for (const line of lines) {
        const parsed = parseSSELine(line.trim());
        if (!parsed) continue;
        if (parsed.done) {
          // Drain any remaining lines in this chunk for usage data, then stop.
          streamDone = true;
          continue;
        }

        // Check for an error event embedded inside the SSE stream.
        // OpenRouter / some providers return 200 OK but stream an error object
        // when the model is overloaded, context is exceeded, or a 5xx occurs.
        const streamErr = extractStreamError(parsed.data);
        if (streamErr) {
          streamErr.partialText = fullText;
          throw streamErr;
        }

        const delta = extractDeltaText(parsed.data);
        if (delta) {
          fullText += delta;
          onDelta(delta);
        }
        // Some providers include usage on the last chunk
        if (parsed.data?.usage) {
          usage = extractUsage(parsed.data);
        }
      }
    }
  } finally {
    watchdog.cancel();
    reader.releaseLock?.();
  }

  // Flush any remaining buffered data after [DONE] (e.g. trailing usage chunk)
  if (buffer.trim()) {
    const parsed = parseSSELine(buffer.trim());
    if (parsed?.data?.usage) {
      usage = extractUsage(parsed.data);
    }
  }

  // If the stall watchdog fired, attach a marker so the caller can distinguish
  // a stall (recoverable — partial text available) from a user cancel.
  if (stallAborted && !signal?.aborted) {
    const stallErr = new Error(`Stream stalled — no data received for ${Math.round(stallMs / 1000)} s`);
    stallErr.isStreamTimeout = true;
    stallErr.partialText = fullText;
    throw stallErr;
  }

  return { text: fullText, usage };
};

// ─── Anthropic streaming ──────────────────────────────────────────────────────
const streamAnthropic = async (model, key, messages, onDelta, signal, stallMs = 90_000) => {
  const isWriter = messages.some(
    (m) => m.role === 'user' && (
      m.content.includes('final synthesizer') ||
      m.content.includes('MANDATORY Coverage Checklist') ||
      m.content.includes('Specialist Inputs') ||
      m.content.includes('Specialist Research') ||
      m.content.includes('## What to cover')
    )
  );
  const maxTokens = _getStreamMaxTokens('anthropic', isWriter);
  const systemMessage = messages.find((m) => m.role === 'system');
  const userMessages = messages.filter((m) => m.role !== 'system');

  const body = {
    model: model || 'claude-3-5-haiku-latest',
    messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: maxTokens,
    temperature: 0.7,
    stream: true,
  };
  if (systemMessage) body.system = systemMessage.content;

  // Stall-watchdog: resets on every incoming chunk
  let stallAborted = false;
  const watchdog = withStallWatchdog(signal, stallMs, () => { stallAborted = true; });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
    signal: watchdog.signal,
  });

  if (!res.ok) {
    watchdog.cancel();
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || `Anthropic HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let usage = { prompt_tokens: 0, completion_tokens: 0 };
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Reset stall timer — we got live bytes
      watchdog.reset();

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        try {
          const ev = JSON.parse(payload);
          if (ev.type === 'content_block_delta' && ev.delta?.text) {
            fullText += ev.delta.text;
            onDelta(ev.delta.text);
          }
          if (ev.type === 'message_delta' && ev.usage) {
            usage = {
              prompt_tokens: ev.usage.input_tokens || 0,
              completion_tokens: ev.usage.output_tokens || 0,
            };
          }
        } catch {
          // Skip malformed event lines.
        }
      }
    }
  } finally {
    watchdog.cancel();
    reader.releaseLock?.();
  }

  if (stallAborted && !signal?.aborted) {
    const stallErr = new Error(`Stream stalled — no data received for ${Math.round(stallMs / 1000)} s`);
    stallErr.isStreamTimeout = true;
    stallErr.partialText = fullText;
    throw stallErr;
  }

  return { text: fullText, usage };
};

// ─── Provider → streaming implementation map ──────────────────────────────────
const ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  glm: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
};

const HEADERS = (provider, key) => {
  const base = { Authorization: `Bearer ${key}` };
  if (provider === 'openrouter') {
    return { ...base, 'HTTP-Referer': 'https://Zyron.app', 'X-Title': 'ZyronAgents' };
  }
  return base;
};

// ─── Main streamAgent ─────────────────────────────────────────────────────────
/**
 * Stream a single agent call.
 * Writes real token chunks to onDelta, resolves via onDone, errors to onError.
 * Falls back to blocking invokeProvider for unsupported providers.
 *
 * @returns {Promise<void>}
 */
// Detect writer role from messages (same markers used across the codebase).
const _isWriterMessages = (messages) =>
  messages.some(
    (m) => m.role === 'user' && (
      m.content.includes('final synthesizer') ||
      m.content.includes('MANDATORY Coverage Checklist') ||
      m.content.includes('Specialist Inputs')
    )
  );

export const streamAgent = async (
  role,
  agentConfig,
  messages,
  onDelta,
  onDone,
  onError,
  signal,
  // Flat backstop timeout — only fires if the *entire* stream takes longer than this.
  // The stall watchdog (90 s of silence) handles frozen connections much earlier.
  // 3 min gives specialist 3 (staggered by 1.5 s) enough headroom on big prompts
  // where a free-tier provider needs 30–60 s to produce its first token.
  timeoutMs = 180_000   // 3 min absolute backstop
) => {
  const { provider, model, key } = agentConfig;
  const cleanKey = key?.trim() ?? '';

  if (!cleanKey) {
    const err = new Error(`No API key configured for ${role} agent.`);
    onError(role, err);
    return;
  }

  if (signal?.aborted) {
    onError(role, new Error('Aborted'));
    return;
  }

  // Flat backstop: fires only if the whole stream takes longer than timeoutMs.
  // Normal large outputs are protected by the per-function stall watchdog instead.
  const backstopController = new AbortController();
  const backstopId = setTimeout(() => backstopController.abort(), timeoutMs);

  // Combine user cancel signal + backstop
  const combinedSignal = (() => {
    const c = new AbortController();
    const abort = () => c.abort();
    if (signal?.aborted || backstopController.signal.aborted) { c.abort(); return c.signal; }
    signal?.addEventListener('abort', abort, { once: true });
    backstopController.signal.addEventListener('abort', abort, { once: true });
    return c.signal;
  })();

  const wrappedDelta = (chunk) => onDelta(role, chunk);

  const isWriter = _isWriterMessages(messages);

  try {
    let result;
    const maxTokens = _getStreamMaxTokens(provider, isWriter);

    // ── Streaming with transient-error backoff retry ──────────────────────
    // Retries on both 429 rate-limits AND transient 5xx errors (model
    // overloaded / no endpoints available) — the two most common failures on
    // free-tier OpenRouter when 3 specialists share the same key.
    const MAX_STREAM_RETRIES = 3;
    const BASE_STREAM_BACKOFF = 3_000;

    const attemptStream = async () => {
      if (provider === 'anthropic') {
        return streamAnthropic(model, cleanKey, messages, wrappedDelta, combinedSignal);
      } else if (ENDPOINTS[provider]) {
        return streamOpenAICompatible(
          ENDPOINTS[provider],
          HEADERS(provider, cleanKey),
          { model: model || undefined, messages, max_tokens: maxTokens, temperature: 0.7 },
          wrappedDelta,
          combinedSignal
        );
      } else {
        return invokeProvider(provider, model, cleanKey, messages, combinedSignal);
      }
    };

    let lastStreamErr;
    for (let attempt = 0; attempt <= MAX_STREAM_RETRIES; attempt++) {
      if (signal?.aborted) throw new Error('Aborted');
      try {
        result = await attemptStream();
        break; // success
      } catch (streamErr) {
        lastStreamErr = streamErr;
        if (signal?.aborted || streamErr.name === 'AbortError' || streamErr.message === 'Aborted') {
          throw new Error('Aborted');
        }
        // Don't retry stall timeouts or backstop — propagate them immediately
        if (streamErr.isStreamTimeout || backstopController.signal.aborted) throw streamErr;
        // Retry transient errors (429 + 5xx overloaded); hard errors throw now
        if (!_isTransientError(streamErr) || attempt === MAX_STREAM_RETRIES) throw streamErr;
        const delay = BASE_STREAM_BACKOFF * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(`[streamAgent] transient error on ${provider} (attempt ${attempt + 1}) — retrying in ${Math.round(delay / 1000)}s:`, streamErr.message);
        await _sleep(delay);
      }
    }

    clearTimeout(backstopId);
    onDone(role, result);
  } catch (err) {
    clearTimeout(backstopId);

    // User explicitly cancelled — propagate as abort.
    if (signal?.aborted) {
      onError(role, new Error('Aborted'));
      return;
    }

    // Stall watchdog inside streaming functions throws with isStreamTimeout=true
    // and attaches whatever partial text was produced. Surface it as a recoverable
    // timeout so the orchestrator can commit the partial text.
    if (err.isStreamTimeout) {
      onError(role, err);
      return;
    }

    // Flat backstop fired — treat same as stream timeout so orchestrator can recover.
    if (backstopController.signal.aborted) {
      const backstopErr = new Error(`Stream backstop after ${timeoutMs / 1000}s`);
      backstopErr.isStreamTimeout = true;
      onError(role, backstopErr);
      return;
    }

    // Any other AbortError that slipped through — treat as user cancel to be safe.
    if (err.name === 'AbortError' || err.message === 'Aborted') {
      onError(role, new Error('Aborted'));
      return;
    }

    onError(role, err);
  }
};

// ─── Stagger delay per provider ───────────────────────────────────────────────
// When all 3 specialists share the same provider (e.g. all on Groq or OpenRouter
// free tier), firing them simultaneously exhausts the tokens/min quota in the
// first second and causes 2 of the 3 to fail with 429.
// Staggering by STAGGER_MS between each call spreads the load across ~2–4 seconds
// so the first specialist is already streaming before the second fires.
//
// If specialists are on different providers, staggering still costs negligible time
// (1.5 s total delay) but prevents any thundering-herd race.
const STAGGER_MS = 750;   // 750 ms between each specialist launch

/**
 * Run up to 3 specialist streams with a small stagger between each launch.
 * Each stream independently fires onDelta, onDone, onError.
 * Returns a Promise that resolves when ALL streams have settled.
 *
 * @param {Array<{ role, agentConfig, messages }>} specs
 * @param {function} onDelta  (role, chunk) => void
 * @param {function} onDone   (role, result) => void
 * @param {function} onError  (role, err) => void
 * @param {AbortSignal} signal
 */
export const streamSpecialists = (specs, onDelta, onDone, onError, signal) => {
  // Check if all specs share the same provider key — if so, stagger is critical
  const keys = new Set(specs.map((s) => s.agentConfig?.key?.trim()).filter(Boolean));
  const provs = new Set(specs.map((s) => s.agentConfig?.provider).filter(Boolean));
  // Stagger if any provider appears more than once (shared key/rate-limit pool)
  const needsStagger = keys.size < specs.length || provs.size < specs.length;

  if (!needsStagger) {
    // Different providers — fire all simultaneously
    return Promise.allSettled(
      specs.map(({ role, agentConfig, messages }) =>
        streamAgent(role, agentConfig, messages, onDelta, onDone, onError, signal)
      )
    );
  }

  // Same provider shared — launch with STAGGER_MS delay between each
  return Promise.allSettled(
    specs.map(({ role, agentConfig, messages }, idx) =>
      new Promise((resolve) => setTimeout(resolve, idx * STAGGER_MS))
        .then(() => {
          if (signal?.aborted) {
            onError(role, new Error('Aborted'));
            return;
          }
          return streamAgent(role, agentConfig, messages, onDelta, onDone, onError, signal);
        })
    )
  );
};
