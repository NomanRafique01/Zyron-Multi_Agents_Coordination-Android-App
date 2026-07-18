/**
 * src/agents/offline/onDeviceFallback.js
 *
 * On-device model fallback using Gemini Nano via ML Kit GenAI APIs (Android).
 *
 * Rules:
 *  - Only used for COORDINATION_MODE = NONE (short conversational replies)
 *    or summarization on supported devices.
 *  - Requires hardware check: Gemini Nano needs ~12GB+ RAM + AICore support.
 *  - Degrades silently to a clean "offline" message on unsupported hardware.
 *  - No per-token cost, fully on-device, no network call.
 *
 * Android integration requirement:
 *   This module wraps the React Native bridge for the official
 *   `@google-ai-edge/reactnative-genai` package (or equivalent ML Kit GenAI
 *   binding). Install when available:
 *     npm install @google-ai-edge/reactnative-genai
 *
 *   Until the package is installed, all paths fall back to OFFLINE_MESSAGE.
 *
 * Fallback ladder:
 *   1. Device supports Gemini Nano and is offline → on-device response
 *   2. Device supports Gemini Nano but online → prefer cloud (return null, use normal pipeline)
 *   3. Device does not support Gemini Nano → OFFLINE_MESSAGE
 *   4. Any init error → OFFLINE_MESSAGE
 */

import { COORDINATION_MODES } from '../registry/teamMetadata';

const OFFLINE_MESSAGE =
  "You're currently offline. Please reconnect to the internet to use Zyron's AI features.";

// ─── ML Kit GenAI bridge (conditional import) ─────────────────────────────────
let GenAI = null;
try {
  GenAI = require('@google-ai-edge/reactnative-genai');
} catch {
  // Package not installed — on-device path unavailable.
}

// ─── Feature check ────────────────────────────────────────────────────────────
/**
 * Check if Gemini Nano is available on this device.
 * Returns 'available', 'unavailable', or 'unknown'.
 */
export const checkOnDeviceAvailability = async () => {
  if (!GenAI) return 'unavailable';
  try {
    // Official ML Kit GenAI API surface (adjust method name to match actual SDK)
    const status = await GenAI.checkFeatureStatus?.();
    if (status === 'AVAILABLE' || status === 1) return 'available';
    return 'unavailable';
  } catch {
    return 'unknown';
  }
};

// ─── On-device inference ──────────────────────────────────────────────────────
/**
 * Run a short query against on-device Gemini Nano.
 * Returns the response text or null on any failure.
 *
 * @param {string} userText
 * @returns {Promise<string|null>}
 */
const runOnDevice = async (userText) => {
  if (!GenAI) return null;
  try {
    const session = await GenAI.createTextSession?.();
    if (!session) return null;
    const response = await session.prompt(userText);
    await session.destroy?.();
    return typeof response === 'string' ? response : (response?.text ?? null);
  } catch {
    return null;
  }
};

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * Attempt an on-device response when the normal pipeline is unavailable (offline).
 * Returns a result object compatible with runAgentsOrchestrator's return shape,
 * or null if the on-device path is not viable.
 *
 * @param {string} userText
 * @param {object} analysis     — from analyzeQuery()
 * @param {boolean} isOffline   — caller's connectivity assessment
 * @returns {Promise<{ text, agents, tokenUsage, meta, onDevice: true } | null>}
 */
export const tryOnDeviceFallback = async (userText, analysis, isOffline) => {
  // Only engage for simple/conversational queries
  if (analysis.coordinationMode !== COORDINATION_MODES.NONE) return null;

  const availability = await checkOnDeviceAvailability();

  if (!isOffline) {
    // Online — don't use on-device path; let normal pipeline run
    return null;
  }

  if (availability !== 'available') {
    // Device doesn't support Gemini Nano — return clean offline message
    return {
      text: OFFLINE_MESSAGE,
      agents: [],
      tokenUsage: {},
      meta: { coordinationMode: analysis.coordinationMode, analysis },
      onDevice: false,
      offline: true,
    };
  }

  const responseText = await runOnDevice(userText);

  if (!responseText) {
    return {
      text: OFFLINE_MESSAGE,
      agents: [],
      tokenUsage: {},
      meta: { coordinationMode: analysis.coordinationMode, analysis },
      onDevice: false,
      offline: true,
    };
  }

  return {
    text: responseText,
    agents: [{ role: 'writer', name: 'Gemini Nano', model: 'On-device', status: 'done', progress: 100 }],
    tokenUsage: {},
    meta: { coordinationMode: analysis.coordinationMode, analysis },
    onDevice: true,
    offline: true,
  };
};
