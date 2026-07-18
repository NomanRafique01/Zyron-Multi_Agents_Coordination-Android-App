import { ProviderApiError, extractApiErrorMessage } from '../utils/agentErrors.utils';

// ─── Token budget per provider ────────────────────────────────────────────────
// Each provider has hard limits on how many tokens it will generate per request.
// Exceeding these causes 400 errors, silent truncation, or extreme slowness on
// free-tier / small models. We cap to safe realistic limits per provider.
//
// IMPORTANT: these are OUTPUT token limits, not context window sizes.
// Groq free: 4 096 hard limit on most models (llama-8b: 8 192 but often rate-limited)
// OpenRouter free: 4 096 most models, 8 192 for paid tiers
// Mistral API: 16 384 for most models but small models are slow above 4 096
// OpenAI / Anthropic / DeepSeek / GLM: 8 192 is safe for specialists, 16 384 for writer
// Gemini: 8 192 safe limit for flash models
const PROVIDER_SPECIALIST_TOKENS = {
  openai:     8_192,
  anthropic:  8_192,
  openrouter: 4_096,   // free tier hard cap; paid tier gets more but we can't know
  mistral:    4_096,   // safe for small/free models; large models handle more
  gemini:     8_192,
  deepseek:   8_192,
  groq:       4_096,   // hard free-tier limit; exceeding causes 400 errors
  glm:        4_096,
};

const PROVIDER_WRITER_TOKENS = {
  openai:     32_768,
  anthropic:  32_768,
  openrouter: 16_384,
  mistral:    16_384,
  gemini:     32_768,
  deepseek:   32_768,
  groq:       16_384,
  glm:        16_384,
};

const getMaxTokens = (provider, isWriter) => {
  const table = isWriter ? PROVIDER_WRITER_TOKENS : PROVIDER_SPECIALIST_TOKENS;
  return table[provider] ?? (isWriter ? 8_192 : 4_096);
};

// Detect writer role by checking for phrases present in the writer prompt.
// Uses multiple markers so a prompt change can't silently break token budgeting.
const isWriterRole = (messages) =>
  messages.some(
    (m) => m.role === 'user' && (
      m.content.includes('final synthesizer') ||
      m.content.includes('MANDATORY Coverage Checklist') ||
      m.content.includes('Specialist Inputs') ||
      m.content.includes('Specialist Research') ||
      m.content.includes('## What to cover')
    )
  );

// ─── OpenAI ───────────────────────────────────────────────────────────────────
export const callOpenAI = async (model, key, messages, signal) => {
  const maxTokens = getMaxTokens('openai', isWriterRole(messages));
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
    signal,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ProviderApiError(
      extractApiErrorMessage(data, `OpenAI API error: ${res.status}`),
      res.status,
      'openai',
      data
    );
  }
  return {
    text: data.choices[0].message.content,
    usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 },
  };
};

// ─── Anthropic ────────────────────────────────────────────────────────────────
/**
 * supportsCaching — marks providers that accept prompt cache-control markers.
 * Currently only Anthropic has a well-specified client-side cache mechanism.
 */
export const supportsCaching = (provider) => provider === 'anthropic';

/**
 * Build Anthropic system blocks with prompt-caching applied to the static prefix.
 * If staticPrefix is not provided, falls back to a single uncached block.
 */
const buildAnthropicSystemBlocks = (systemMessage, staticPrefix) => {
  if (!staticPrefix || !systemMessage) {
    return systemMessage ? systemMessage.content : undefined;
  }
  const dynamic = systemMessage.content.slice(staticPrefix.length).trimStart();
  // Anthropic extended system format: array of content blocks
  const blocks = [
    { type: 'text', text: staticPrefix, cache_control: { type: 'ephemeral' } },
  ];
  if (dynamic) blocks.push({ type: 'text', text: dynamic });
  return blocks;
};

export const callAnthropic = async (model, key, messages, signal, promptCache = null) => {
  const maxTokens = getMaxTokens('anthropic', isWriterRole(messages));
  const systemMessage = messages.find((m) => m.role === 'system');
  const userMessages = messages.filter((m) => m.role !== 'system');

  const body = {
    model: model || 'claude-3-5-haiku-latest',
    messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: maxTokens,
    temperature: 0.7,
  };

  const systemContent = buildAnthropicSystemBlocks(systemMessage, promptCache?.staticPrefix);
  if (systemContent) body.system = systemContent;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
    signal,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new ProviderApiError(
      extractApiErrorMessage(data, `Anthropic API error: ${res.status}`),
      res.status,
      'anthropic',
      data
    );
  }

  return {
    text: data.content[0]?.text || '',
    usage: {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
    },
  };
};

// ─── OpenRouter ───────────────────────────────────────────────────────────────
export const callOpenRouterClient = async (model, key, messages, signal) => {
  const maxTokens = getMaxTokens('openrouter', isWriterRole(messages));
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://Zyron.app',
      'X-Title': 'ZyronAgents',
    },
    body: JSON.stringify({
      model: model || 'nvidia/nemotron-3-super-120b-a12b:free',
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
    signal,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ProviderApiError(
      extractApiErrorMessage(data, `OpenRouter API error: ${res.status}`),
      res.status,
      'openrouter',
      data
    );
  }
  return {
    text: data.choices[0].message.content,
    usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 },
  };
};

// ─── Mistral ──────────────────────────────────────────────────────────────────
export const callMistralClient = async (model, key, messages, signal) => {
  const maxTokens = getMaxTokens('mistral', isWriterRole(messages));
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'mistral-small-latest',
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
    signal,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ProviderApiError(
      extractApiErrorMessage(data, `Mistral API error: ${res.status}`),
      res.status,
      'mistral',
      data
    );
  }
  return {
    text: data.choices[0].message.content,
    usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 },
  };
};

// ─── Gemini ───────────────────────────────────────────────────────────────────
export const callGeminiClient = async (model, key, messages, signal) => {
  const maxTokens = getMaxTokens('gemini', isWriterRole(messages));
  const systemMessage = messages.find((m) => m.role === 'system');
  const promptText = messages
    .filter((m) => m.role !== 'system')
    .map((m) => m.content)
    .join('\n\n');

  const body = {
    contents: [{ role: 'user', parts: [{ text: promptText || 'Ping' }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    },
  };

  if (systemMessage) {
    body.systemInstruction = { parts: [{ text: systemMessage.content }] };
  }

  const modelName = model || 'gemini-2.5-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new ProviderApiError(
      extractApiErrorMessage(data, `Gemini API error: ${res.status}`),
      res.status,
      'gemini',
      data
    );
  }
  return {
    text: data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '',
    usage: {
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
    },
  };
};

// ─── DeepSeek ─────────────────────────────────────────────────────────────────
export const callDeepSeek = async (model, key, messages, signal) => {
  const maxTokens = getMaxTokens('deepseek', isWriterRole(messages));
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'deepseek-chat',
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
    signal,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ProviderApiError(
      extractApiErrorMessage(data, `DeepSeek API error: ${res.status}`),
      res.status,
      'deepseek',
      data
    );
  }
  return {
    text: data.choices[0].message.content,
    usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 },
  };
};

// ─── Groq ─────────────────────────────────────────────────────────────────────
export const callGroq = async (model, key, messages, signal) => {
  const maxTokens = getMaxTokens('groq', isWriterRole(messages));
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'llama-3.3-70b-versatile',
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
    signal,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ProviderApiError(
      extractApiErrorMessage(data, `Groq API error: ${res.status}`),
      res.status,
      'groq',
      data
    );
  }
  return {
    text: data.choices[0].message.content,
    usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 },
  };
};

// ─── GLM / Zhipu AI ───────────────────────────────────────────────────────────
export const callGLM = async (model, key, messages, signal) => {
  const maxTokens = getMaxTokens('glm', isWriterRole(messages));
  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'glm-4-flash',
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
    signal,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ProviderApiError(
      extractApiErrorMessage(data, `GLM API error: ${res.status}`),
      res.status,
      'glm',
      data
    );
  }
  return {
    text: data.choices[0].message.content,
    usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 },
  };
};

// ─── Provider dispatcher ──────────────────────────────────────────────────────
export const invokeProvider = async (provider, model, key, messages, signal, promptCache = null) => {
  switch (provider) {
    case 'openai':      return callOpenAI(model, key, messages, signal);
    case 'anthropic':   return callAnthropic(model, key, messages, signal, promptCache);
    case 'openrouter':  return callOpenRouterClient(model, key, messages, signal);
    case 'mistral':     return callMistralClient(model, key, messages, signal);
    case 'gemini':      return callGeminiClient(model, key, messages, signal);
    case 'deepseek':    return callDeepSeek(model, key, messages, signal);
    case 'groq':        return callGroq(model, key, messages, signal);
    case 'glm':         return callGLM(model, key, messages, signal);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
};

export const getModelDisplayName = (config, defaultName) => {
  if (config.active && config.key && config.key.trim()) {
    if (config.provider === 'openrouter') {
      return config.model ? config.model.split('/').pop() : 'OpenRouter';
    }
    return (
      {
        openai:     'GPT Engine',
        anthropic:  'Claude Engine',
        mistral:    'Mistral Engine',
        gemini:     'Gemini Engine',
        deepseek:   'DeepSeek Engine',
        groq:       'Groq Engine',
        glm:        'GLM Engine',
      }[config.provider] || config.provider
    );
  }
  return defaultName;
};

export const verifyAgentKey = async (provider, model, key) => {
  if (!key || !key.trim()) throw new Error('API Key cannot be empty.');
  const cleanKey = key.trim();
  const testMessages = [{ role: 'user', content: 'Ping' }];

  const testModel =
    model ||
    {
      openrouter: 'nvidia/nemotron-3-super-120b-a12b:free',
      openai:     'gpt-4o-mini',
      anthropic:  'claude-3-5-haiku-latest',
      mistral:    'mistral-small-latest',
      gemini:     'gemini-2.5-flash',
      deepseek:   'deepseek-chat',
      groq:       'llama-3.3-70b-versatile',
      glm:        'glm-4-flash',
    }[provider] ||
    'gpt-4o-mini';

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': cleanKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: testModel,
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || `Anthropic API error: ${res.status}`);
    }
    return true;
  }

  return invokeProvider(provider, testModel, cleanKey, testMessages, null);
};
