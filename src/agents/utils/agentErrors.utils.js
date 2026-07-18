export class ProviderApiError extends Error {
  constructor(message, status, provider, raw) {
    super(message);
    this.name = 'ProviderApiError';
    this.status = status;
    this.provider = provider;
    this.raw = raw;
  }
}

export const extractApiErrorMessage = (data, fallback) => {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  return data.error?.message || data.message || data.error || fallback;
};

export const isKeyExhaustedError = (err) => {
  const message = String(err?.message || '').toLowerCase();
  // 429 = rate-limited (transient, always retried) — NOT the same as an exhausted key.
  // Only 402 (payment required / hard quota exceeded) is a true key exhaustion.
  return (
    err?.status === 402 ||
    message.includes('quota exceeded') ||
    message.includes('insufficient_quota') ||
    message.includes('billing') ||
    message.includes('exhausted') ||
    message.includes('over limit')
  );
};

export const sanitizeErrorMessage = (message, keysToStrip = []) => {
  if (!message || typeof message !== 'string') return 'An unknown error occurred.';

  let sanitized = message;

  for (const key of keysToStrip) {
    if (key && key.trim()) {
      sanitized = sanitized.replace(
        new RegExp(key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'),
        '***REDACTED***'
      );
    }
  }

  sanitized = sanitized.replace(/sk-or-v1-[a-zA-Z0-9_-]+/g, '***REDACTED***');
  sanitized = sanitized.replace(/sk-ant-[a-zA-Z0-9_-]+/g, '***REDACTED***');
  sanitized = sanitized.replace(/sk-[a-zA-Z0-9_-]{20,}/g, '***REDACTED***');
  // DeepSeek keys: sk-... (same Bearer prefix as OpenAI — covered above)
  // Groq keys: gsk_...
  sanitized = sanitized.replace(/gsk_[a-zA-Z0-9_-]+/g, '***REDACTED***');
  // GLM / Zhipu AI keys: alphanumeric, may contain dots
  sanitized = sanitized.replace(/[a-zA-Z0-9]{40,}/g, '***REDACTED***');
  sanitized = sanitized.replace(/[a-zA-Z0-9]{32,}/g, (match) => {
    if (/[A-Z]/.test(match) && /[a-z]/.test(match) && /[0-9]/.test(match)) {
      return '***REDACTED***';
    }
    return match;
  });

  return sanitized;
};

export const validateApiKeyFormat = (provider, key) => {
  const patterns = {
    openrouter: /^sk-or-v1-[a-zA-Z0-9_-]+$/,
    openai: /^sk-(?!or-v1-)(?!ant-)[a-zA-Z0-9_-]+$/,
    anthropic: /^sk-ant-[a-zA-Z0-9_-]+$/,
    mistral: /^[a-zA-Z0-9]{32}$/,
    gemini: /^(AIza|AQ)[a-zA-Z0-9._-]+$/,
    // DeepSeek: Bearer sk-... (same prefix family as OpenAI)
    deepseek: /^sk-[a-zA-Z0-9_-]{20,}$/,
    // Groq: gsk_... prefix
    groq: /^gsk_[a-zA-Z0-9_-]+$/,
    // GLM / Zhipu AI: alphanumeric JWT-style token (no fixed prefix; accept any 32+ char alphanumeric)
    glm: /^[a-zA-Z0-9._-]{32,}$/,
  };

  const pattern = patterns[provider];
  if (!pattern) return { valid: false, message: `Unknown provider: ${provider}` };
  if (!key || !key.trim()) return { valid: false, message: 'API Key cannot be empty.' };

  const trimmed = key.trim();
  if (!pattern.test(trimmed)) {
    return { valid: false, message: 'Invalid API Key. Please put a valid API key for the selected model.' };
  }

  return { valid: true, message: '' };
};
