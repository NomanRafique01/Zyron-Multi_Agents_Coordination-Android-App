export { runAgentsOrchestrator } from './orchestrator';
export { analyzeQuery } from './analysis/queryAnalyzer';
export { registerAgent, registerIntegration, getRegisteredAgentRoles, getAgentMeta, getPipelinePhases, applyTeamToRegistry } from './registry/agentRegistry';
export { COORDINATION_MODES } from './registry/teamMetadata';
export {
  AGENTS_TEAMS,
  getTeamById,
  getDefaultTeam,
  DEFAULT_TEAM_ID,
  ACTIVE_TEAM_STORAGE_KEY,
  applyTeamNamesToConfigs,
  getTeamRoleInfo,
  SOCKET_ROLES,
} from './teams';
export { getActiveTeam, setActiveTeamById, initActiveTeam } from './teams/teamRuntime';
export {
  callOpenAI,
  callAnthropic,
  callOpenRouterClient,
  callMistralClient,
  callGeminiClient,
  callDeepSeek,
  callGroq,
  callGLM,
  getModelDisplayName,
  verifyAgentKey,
  supportsCaching,
} from './api/providers.service';
export { callAgent } from './api/agentCaller.service';
export {
  ProviderApiError,
  isKeyExhaustedError,
  sanitizeErrorMessage,
  validateApiKeyFormat,
} from './utils/agentErrors.utils';

// ── Task 1: Security ──────────────────────────────────────────────────────────
export { saveKey, getKey, deleteKey, migrateKeys } from './security/keyGuard';

// ── Task 2: Streaming ─────────────────────────────────────────────────────────
export { streamAgent, streamSpecialists } from './streaming/streamManager';

// ── Task 4: Resilience ────────────────────────────────────────────────────────
export { setFallbackChain, setAllFallbackChains, getNextFallback } from './api/fallbackChain';
export { shouldSkip, recordFailure, recordSuccess, resetProvider, getBreakerSnapshot } from './api/circuitBreaker';

// ── Task 5: Semantic dedup + quality judge ────────────────────────────────────
export { semanticDedup } from './synthesis/semanticDedup';
export { judgeOutputQuality } from './synthesis/qualityJudge';

// ── Task 6: Dynamic routing ───────────────────────────────────────────────────
export { suggestTeamSwitch, getBestTeamForType } from './router/teamRouter';
export { applyModelTier } from './router/modelTier';
export { blendTeams, resolveBestBlend } from './teams/teamBlend';

// ── Task 7: Tools ─────────────────────────────────────────────────────────────
export { grantTool, revokeTool, applyTeamToolPermissions, hasTool, getToolsForRole } from './tools/toolRegistry';
export { executeSnippet, runFirstCodeBlock } from './tools/codeExecutor';

// ── Task 8: Memory ────────────────────────────────────────────────────────────
export { setMemory, getMemories, deleteMemory, clearAllMemory } from './memory/memoryStore';
export { buildMemoryContext, learnFromMessage, clearAllMemory as clearMemory } from './memory/userMemory';

// ── Task 9: Offline ───────────────────────────────────────────────────────────
export { tryOnDeviceFallback, checkOnDeviceAvailability } from './offline/onDeviceFallback';

// ── Task 10: Telemetry ────────────────────────────────────────────────────────
export { recordCall, recordError, getSessionSummary, clearSession } from './telemetry/metrics';
