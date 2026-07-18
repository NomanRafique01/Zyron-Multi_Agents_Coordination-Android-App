/**
 * src/agents/router/modelTier.js
 *
 * Dynamic model tiering — routes COMPACT / low-complexity queries to
 * cheaper/faster models, reserves top-tier models for HIGH complexity.
 *
 * Tier mapping is declared in teamMetadata.js (MODEL_TIERS) and falls back
 * to sensible defaults per provider if not declared there.
 *
 * Usage:
 *   const tieredConfigs = applyModelTier(agentConfigs, analysis);
 *   // pass tieredConfigs into runAgentsOrchestrator
 */

import { COORDINATION_MODES } from '../registry/teamMetadata';

// ─── Default tier models per provider ────────────────────────────────────────
// 'fast' = cheap/low-latency tier; 'full' = the user's configured model (unchanged)
const FAST_MODELS = {
  openai:     'gpt-4o-mini',
  anthropic:  'claude-3-5-haiku-latest',
  openrouter: 'google/gemma-3-27b-it:free',
  mistral:    'mistral-small-latest',
  gemini:     'gemini-2.0-flash-lite',
  deepseek:   'deepseek-chat',
  groq:       'llama-3.1-8b-instant',
  glm:        'glm-4-flash',
};

/**
 * Return agentConfigs with models downgraded to fast tier when appropriate.
 * Only downgrades — never upgrades a model the user hasn't configured.
 *
 * @param {object} agentConfigs   — live config with provider/model/key
 * @param {object} analysis       — from analyzeQuery()
 * @returns {object}  potentially modified agentConfigs (new object, no mutation)
 */
export const applyModelTier = (agentConfigs, analysis) => {
  const { coordinationMode, complexity } = analysis;

  // Only tier down on COMPACT mode or low complexity
  const shouldTier =
    coordinationMode === COORDINATION_MODES.COMPACT ||
    coordinationMode === COORDINATION_MODES.NONE ||
    complexity === 'low';

  if (!shouldTier) return agentConfigs;

  const result = {};
  for (const [role, config] of Object.entries(agentConfigs)) {
    if (!config) { result[role] = config; continue; }

    const fastModel = FAST_MODELS[config.provider];
    if (fastModel && fastModel !== config.model) {
      result[role] = { ...config, model: fastModel, _tiered: true };
    } else {
      result[role] = config;
    }
  }
  return result;
};
