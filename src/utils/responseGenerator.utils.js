import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OPENROUTER_KEYS = Array.from(new Set([
  Constants.expoConfig?.extra?.openRouterKey,
].filter(Boolean)));

const MISTRAL_KEY = Constants.expoConfig?.extra?.mistralKey || null;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';

const blacklist = new Map(); // key -> timestamp of failure

const getAvailableKeys = (keys) => {
  const now = Date.now();
  const validKeys = keys.filter(k => {
    const blacklistedTime = blacklist.get(k);
    return !blacklistedTime || (now - blacklistedTime > 60000);
  });
  
  if (validKeys.length === 0) {
    keys.forEach(k => blacklist.delete(k));
    return keys;
  }
  return validKeys;
};

// ─── Agent Models with High-Reliability Fallbacks ───
export const AGENT_MODELS = {
  reasoner: [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'openai/gpt-oss-120b:free',
    'openai/gpt-oss-20b:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
  ],
  coder: [
    'cohere/north-mini-code:free',
    'openai/gpt-oss-120b:free',
    'openai/gpt-oss-20b:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
  ],
  vision: [
    'google/gemma-4-26b-a4b-it:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'openai/gpt-oss-120b:free',
    'openai/gpt-oss-20b:free'
  ],
  writer: [
    'mistral-small-latest',
    'openai/gpt-oss-20b:free'
  ],
};

// ─── Keyword Classifier ──────────────────────────────
export const classifyTask = (text) => {
  const q = text.toLowerCase();
  if (q.match(/code|write|build|function|class|debug|implement|api|error|fix|script|program|bug|runtime|compile|algorithm|syntax|regex|database|sql/))
    return 'coder';
  if (q.match(/explain|analyze|compare|difference|how does|why|concept|what is|ml|ai|theory|research|neural|deep learning|logic|philosophy|math|proof|hypothesis/))
    return 'reasoner';
  if (q.match(/write|summarize|report|polish|format|email|essay|draft|blog|letter|document|paragraph|article|story|rewrite|proofread|grammar/))
    return 'writer';
  if (q.match(/design|layout|mockup|interface|responsive|color|font|ui|ux|css/))
    return 'vision';
  return 'reasoner'; // default — handles widest variety of general questions
};

// ─── Single OpenRouter Call with dynamic key fetching ─
const callOpenRouter = async (model, messages, signal) => {
  let attempts = 0;

  // Load custom keys from AsyncStorage
  let activeKeys = [];
  try {
    const stored = await AsyncStorage.getItem('Zyron_KEYS');
    if (stored) {
      const parsed = JSON.parse(stored);
      // parsed: Array<{ key: string, active: boolean }>
      activeKeys = parsed.filter(item => item.active && item.key).map(item => item.key);
    }
  } catch (err) {
    console.warn('Failed to load custom keys from storage:', err);
  }

  const keysToUse = activeKeys.length > 0 ? activeKeys : OPENROUTER_KEYS;
  const maxAttempts = keysToUse.length;
  const startIndex = Math.floor(Math.random() * keysToUse.length);

  while (attempts < maxAttempts) {
    if (signal?.aborted) throw new Error('Aborted');
    const availableKeys = getAvailableKeys(keysToUse);
    const localKeyIndex = (startIndex + attempts) % availableKeys.length;
    const key = availableKeys[localKeyIndex];
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://Zyron.app',
          'X-Title': 'Zyron',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 2048,
        }),
        signal,
      });

      const data = await res.json();

      if (!res.ok) {
        const status = res.status;
        const errMsg = data.error?.message || '';
        const isRateLimit = status === 429 || errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('limit exceeded') || status === 401 || status === 403;

        if (isRateLimit) {
          console.warn(`Key rate-limited or error (Status ${status}): ${errMsg}. Rotating key...`);
          blacklist.set(key, Date.now());
          attempts++;
          continue;
        }
        throw new Error(errMsg || `OpenRouter error ${status}`);
      }

      return {
        text: data.choices[0].message.content,
        usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      };
    } catch (err) {
      if (err.name === 'AbortError' || err.message === 'Aborted') {
        throw err;
      }
      const errLower = err.message?.toLowerCase() || '';
      if (errLower.includes('rate limit') || errLower.includes('limit exceeded') || errLower.includes('429')) {
        console.warn(`Network/API rate-limited: ${err.message}. Rotating key...`);
        blacklist.set(key, Date.now());
        attempts++;
        continue;
      }
      throw err;
    }
  }

  // Raise specific exceptions if all keys are exhausted
  if (activeKeys.length > 0) {
    throw new Error('ALL_USER_KEYS_EXHAUSTED');
  } else {
    throw new Error('ALL_BUILTIN_KEYS_EXHAUSTED');
  }
};

// ─── OpenRouter Call with Fallbacks ─────────────────
const callOpenRouterWithFallback = async (modelList, messages, signal) => {
  let lastError;
  for (const model of modelList) {
    try {
      if (signal?.aborted) throw new Error('Aborted');
      return await callOpenRouter(model, messages, signal);
    } catch (err) {
      if (err.name === 'AbortError' || err.message === 'Aborted') {
        throw err;
      }
      console.warn(`Model ${model} failed, trying fallback:`, err.message);
      lastError = err;
    }
  }
  throw lastError || new Error('All models failed');
};

// ─── Mistral Writer Call with Fallback ──────────────
const callWriter = async (messages, signal) => {
  try {
    if (signal?.aborted) throw new Error('Aborted');
    const res = await fetch(MISTRAL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MISTRAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages,
        max_tokens: 2048, // Increased to support long formatting/polishing outputs
      }),
      signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Mistral error');
    return {
      text: data.choices[0].message.content,
      usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    };
  } catch (err) {
    if (err.name === 'AbortError' || err.message === 'Aborted') {
      throw err;
    }
    console.warn("Mistral direct failed, falling back to OpenRouter writer model:", err.message);
    return await callOpenRouter('openai/gpt-oss-20b:free', messages, signal);
  }
};

// Helper to update agent lists
const updateAgent = (agents, name, updates) => {
  const index = agents.findIndex(a => a.name === name);
  if (index !== -1) {
    agents[index] = { ...agents[index], ...updates };
  }
  return [...agents];
};

// ─── AGENTS MODE — Parallel Pipelines ─────────────────
export const runAgentsPipeline = async (userText, onStateChange, signal, persona) => {
  let agents = [
    { name: 'Reasoner', model: 'Nemotron Super', progress: 0, status: 'queued', statusColor: '#555566' },
    { name: 'Coder',    model: 'Cohere Code',    progress: 0, status: 'queued', statusColor: '#555566' },
    { name: 'Vision',   model: 'Nemotron Nano',  progress: 0, status: 'queued', statusColor: '#555566' },
    { name: 'Writer',   model: 'Mistral Writer', progress: 0, status: 'queued', statusColor: '#555566' },
  ];

  const colors = {
    Reasoner: '#A78BFA',
    Coder: '#60A5FA',
    Vision: '#6EE7B7',
    Writer: '#FBBF24',
    done: '#6EE7B7',
    error: '#F97316',
  };

  const notify = () => onStateChange([...agents]);

  // Set initial working state for parallel agents
  agents = updateAgent(agents, 'Reasoner', { status: 'thinking', progress: 15, statusColor: colors.Reasoner });
  agents = updateAgent(agents, 'Coder', { status: 'coding', progress: 10, statusColor: colors.Coder });
  agents = updateAgent(agents, 'Vision', { status: 'analyzing', progress: 20, statusColor: colors.Vision });
  notify();

  const intervals = {};
  const startInterval = (name) => {
    intervals[name] = setInterval(() => {
      const idx = agents.findIndex(a => a.name === name);
      if (idx !== -1 && agents[idx].progress < 90) {
        agents[idx].progress += Math.floor(Math.random() * 6) + 3;
        if (agents[idx].progress > 90) agents[idx].progress = 90;
        notify();
      }
    }, 350);
  };

  startInterval('Reasoner');
  startInterval('Coder');
  startInterval('Vision');

  const reasonerMessages = [
    {
      role: 'system',
      content: 'You are the Reasoner agent in the Zyron multi-agent AI system. Your role is to think deeply, analyze the query, and provide structured logical reasoning. When asked about yourself or your architecture, you must explain that you are part of the Zyron Agents system, using the Nemotron Super model.'
    },
    { role: 'user', content: userText }
  ];

  const coderMessages = [
    {
      role: 'system',
      content: 'You are the Coder agent in the Zyron multi-agent AI system. Your role is to write clean, professional code, debug errors, and provide implementations. When asked about yourself or your architecture, you must explain that you are part of the Zyron Agents system, using the Cohere Code model.'
    },
    { role: 'user', content: userText }
  ];

  const visionMessages = [
    {
      role: 'system',
      content: 'You are the Vision agent in the Zyron multi-agent AI system. Your role is to analyze visual patterns, explain layouts, and provide analytical/multimodal support. When asked about yourself or your architecture, you must explain that you are part of the Zyron Agents system, using the Nemotron Nano model.'
    },
    { role: 'user', content: userText }
  ];

  const [reasonerResult, coderResult, visionResult] = await Promise.allSettled([
    callOpenRouterWithFallback(AGENT_MODELS.reasoner, reasonerMessages, signal).then(res => {
      clearInterval(intervals['Reasoner']);
      agents = updateAgent(agents, 'Reasoner', { status: 'done', progress: 100, statusColor: colors.done });
      notify();
      return res;
    }).catch(err => {
      clearInterval(intervals['Reasoner']);
      agents = updateAgent(agents, 'Reasoner', { status: 'error', progress: 100, statusColor: colors.error });
      notify();
      throw err;
    }),

    callOpenRouterWithFallback(AGENT_MODELS.coder, coderMessages, signal).then(res => {
      clearInterval(intervals['Coder']);
      agents = updateAgent(agents, 'Coder', { status: 'done', progress: 100, statusColor: colors.done });
      notify();
      return res;
    }).catch(err => {
      clearInterval(intervals['Coder']);
      agents = updateAgent(agents, 'Coder', { status: 'error', progress: 100, statusColor: colors.error });
      notify();
      throw err;
    }),

    callOpenRouterWithFallback(AGENT_MODELS.vision, visionMessages, signal).then(res => {
      clearInterval(intervals['Vision']);
      agents = updateAgent(agents, 'Vision', { status: 'done', progress: 100, statusColor: colors.done });
      notify();
      return res;
    }).catch(err => {
      clearInterval(intervals['Vision']);
      agents = updateAgent(agents, 'Vision', { status: 'error', progress: 100, statusColor: colors.error });
      notify();
      throw err;
    }),
  ]);

  if (signal?.aborted) throw new Error('Aborted');

  const reasonerText = reasonerResult.status === 'fulfilled' ? reasonerResult.value.text : '(Reasoner unavailable)';
  const coderText = coderResult.status === 'fulfilled' ? coderResult.value.text : '(Coder unavailable)';
  const visionText = visionResult.status === 'fulfilled' ? visionResult.value.text : '(Vision unavailable)';

  const reasonerTokens = reasonerResult.status === 'fulfilled' ? reasonerResult.value.usage : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const coderTokens = coderResult.status === 'fulfilled' ? coderResult.value.usage : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const visionTokens = visionResult.status === 'fulfilled' ? visionResult.value.usage : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  // Set Writer to active
  agents = updateAgent(agents, 'Writer', { status: 'formatting', progress: 15, statusColor: colors.Writer });
  notify();

  startInterval('Writer');

  let personaInstruction = '';
  if (persona === 'creative') {
    personaInstruction = '\nExplore innovative perspectives, provide multiple alternative developer angles if useful, and write with an engaging, creative technical tone.';
  } else if (persona === 'precise') {
    personaInstruction = '\nEnsure absolute correctness, follow strict type-safety, enforce rigid constraints, eliminate all fluff, and write in a highly concise, formal technical style.';
  } else if (persona === 'educator') {
    personaInstruction = '\nExplain concepts step by step using clear analogies. Aim for clarity over brevity.';
  } else if (persona === 'executive') {
    personaInstruction = '\nLead with the conclusion. Keep the entire response to three short paragraphs maximum. Use zero jargon — write for a non-technical decision maker.';
  }

  const mergePrompt = `You are the Writer agent, the final coordinator and output synthesizer of the Zyron multi-agent AI system.
You have the responses of the three specialist agents (Reasoner, Coder, Vision) who worked in parallel to address the user's query:

User Query: ${userText}

Reasoner Agent (Nemotron Super) response: ${reasonerText}

Coder Agent (Cohere Code) response: ${coderText}

Vision Agent (Nemotron Nano) response: ${visionText}

Synthesize these inputs into a final cohesive, premium, and professional response.
CRITICAL: Since you are the public face of the Zyron Agents system, if the user asks about your identity, architecture, or how you work, you MUST explicitly confirm that Zyron is a collaborative multi-agent system. Detail the roles of the agents (Reasoner: Nemotron Super, Coder: Cohere Code, Vision: Nemotron Nano, Writer: Mistral Writer) and how they worked in parallel to answer their prompt. Never say you are a single standalone model like Nemotron 3 Super.

Write a direct, professional response to the query. Use standard markdown. Highlight titles with markdown headers and format sections clearly. For math/science equations and units, use LaTeX: inline \\( ... \\) and display \\[ ... \\]. Ensure all equations, variables, and units (especially physics units like m/s, m/s^2, kg, N, J, W, Pa, Hz, V, A, etc.) are enclosed in LaTeX blocks. For units, wrap them inside \\text{...} or \\mathrm{...} (e.g. \\( \\text{m/s}^2 \\) or \\( \\text{kg}\\cdot\\text{m/s}^2 \\)) to ensure perfect mathematical formatting. Keep any code block as fenced blocks with language identifiers. Do not include any introductory remarks like "Here is the polished response" or "Final Response". Start directly with the answer, just like a standard high-quality GPT model. Remove duplicates. Keep code if present.${personaInstruction}`;

  let finalResult;
  try {
    finalResult = await callWriter([{ role: 'user', content: mergePrompt }], signal);
  } catch (err) {
    clearInterval(intervals['Writer']);
    if (err.name === 'AbortError' || err.message === 'Aborted') {
      throw err;
    }
    finalResult = {
      text: coderText !== '(Coder unavailable)' ? coderText : reasonerText,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }

  clearInterval(intervals['Writer']);
  agents = updateAgent(agents, 'Writer', { status: 'done', progress: 100, statusColor: colors.done });
  notify();

  return {
    text: finalResult.text,
    agents: agents,
    tokenUsage: {
      Reasoner: reasonerTokens,
      Coder: coderTokens,
      Vision: visionTokens,
      Writer: finalResult.usage,
    }
  };
};

// ─── FAST MODE — Single Agent ────────────────────────
export const getFastResponse = async (userText, signal) => {
  const agentKey = classifyTask(userText);
  
  const agentInfo = {
    reasoner: { name: 'Reasoner', displayName: 'Nemotron Super', models: AGENT_MODELS.reasoner },
    coder: { name: 'Coder', displayName: 'Cohere Code', models: AGENT_MODELS.coder },
    vision: { name: 'Vision', displayName: 'Nemotron Nano', models: AGENT_MODELS.vision },
    writer: { name: 'Writer', displayName: 'Mistral Writer', models: AGENT_MODELS.writer },
  }[agentKey];

  let result;
  if (agentKey === 'writer') {
    result = await callWriter([{ role: 'user', content: userText }], signal);
  } else {
    result = await callOpenRouterWithFallback(agentInfo.models, [{ role: 'user', content: userText }], signal);
  }

  const footerLine = `\n\nGenerated by ${agentInfo.name} (${agentInfo.displayName})`;
  const finalResponseText = result.text.trim() + footerLine;

  return {
    text: finalResponseText,
    agentUsed: agentInfo.name,
    modelName: agentInfo.displayName,
    tokenUsage: {
      [agentInfo.name]: result.usage
    }
  };
};

// Legacy exports
export const codeLines1 = [];
export const codeLines2 = [];
export const getCustomResponse = () => ({ text: '', codeLines: [] });
export const getAgentsResponse = async (userText) => {
  return runAgentsPipeline(userText, () => {}, null);
};
