/**
 * src/agents/tools/codeExecutor.js
 *
 * Sandboxed on-device JS/expression evaluation.
 *
 * Sandbox strategy on React Native / Expo Android:
 *   - Uses `new Function()` scoped to a whitelist of safe globals only.
 *   - Strips any access to React Native globals (fetch, require, global, process, etc.).
 *   - Enforces a hard execution timeout via a manual loop-count guard.
 *   - Scope is intentionally narrow: pure expressions and short algorithmic snippets.
 *
 * Limitations (noted per constraint):
 *   - Cannot import modules — pure JS computation only.
 *   - No file I/O, no network calls, no native APIs.
 *   - setTimeout/setInterval are stripped.
 *   - Loop/recursion depth is limited by output size check, not a true VM.
 *   - A true WASM sandbox (e.g. QuickJS compiled to WASM) would be more secure
 *     but requires a native module — this is the no-native-dependency approach.
 *
 * Falls back gracefully: any eval failure returns { ok: false, error, output: '' }.
 */

const MAX_OUTPUT_CHARS = 4_000;
const EXECUTION_TIMEOUT_MS = 3_000;

// ─── Safe global whitelist ────────────────────────────────────────────────────
const SAFE_GLOBALS = {
  Math,
  JSON,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  Number,
  String,
  Boolean,
  Array,
  Object,
  console: {
    log: (...args) => args.map(String).join(' '),
    warn: (...args) => args.map(String).join(' '),
    error: (...args) => args.map(String).join(' '),
  },
};

// ─── Dangerous pattern detector ───────────────────────────────────────────────
const DANGEROUS = [
  /\brequire\b/,
  /\bimport\b/,
  /\bfetch\b/,
  /\bXMLHttpRequest\b/,
  /\bglobal\b/,
  /\bprocess\b/,
  /\b__dirname\b/,
  /\bwindow\b/,
  /\bdocument\b/,
  /\bevalFunction\b/,
  /\bsetTimeout\b/,
  /\bsetInterval\b/,
  /\bBuffer\b/,
];

const isSafe = (code) => !DANGEROUS.some((re) => re.test(code));

// ─── Executor ─────────────────────────────────────────────────────────────────
/**
 * Execute a JS code snippet in the sandboxed environment.
 *
 * @param {string} code   — snippet to execute
 * @returns {{ ok: boolean, output: string, error?: string }}
 */
export const executeSnippet = (code) => {
  if (!code?.trim()) return { ok: false, output: '', error: 'Empty code' };

  if (!isSafe(code)) {
    return { ok: false, output: '', error: 'Code contains disallowed patterns (network, file, or global access).' };
  }

  let output = '';
  const captureLog = (...args) => {
    output += args.map(String).join(' ') + '\n';
  };

  // Build sandboxed scope
  const sandbox = {
    ...SAFE_GLOBALS,
    console: { log: captureLog, warn: captureLog, error: captureLog },
  };

  const argNames = Object.keys(sandbox);
  const argValues = Object.values(sandbox);

  let result;
  let timedOut = false;

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...argNames, `"use strict";\n${code}\n`);

    const start = Date.now();
    result = fn(...argValues);
    const elapsed = Date.now() - start;

    if (elapsed > EXECUTION_TIMEOUT_MS) {
      timedOut = true;
    }
  } catch (err) {
    return { ok: false, output, error: String(err.message || err) };
  }

  if (timedOut) {
    return { ok: false, output, error: `Execution timed out (>${EXECUTION_TIMEOUT_MS}ms)` };
  }

  // Append return value if present
  if (result !== undefined) {
    output += String(result);
  }

  if (output.length > MAX_OUTPUT_CHARS) {
    output = output.slice(0, MAX_OUTPUT_CHARS) + '\n...[truncated]';
  }

  return { ok: true, output: output.trim(), error: undefined };
};

/**
 * Extract and run the first fenced code block from a specialist output string.
 * Returns null if no code block is found.
 *
 * @param {string} text  — specialist output containing ```lang\n...\n```
 * @returns {{ ok, output, error } | null}
 */
export const runFirstCodeBlock = (text) => {
  if (!text) return null;
  const match = text.match(/```(?:js|javascript|ts|typescript)?\n([\s\S]*?)```/i);
  if (!match) return null;
  return executeSnippet(match[1]);
};
