/**
 * Backward-compatible facade — implementation lives in src/agents/
 */
export {
  verifyAgentKey,
  validateApiKeyFormat,
  sanitizeErrorMessage,
  getModelDisplayName,
  isKeyExhaustedError,
  registerAgent,
  registerIntegration,
  analyzeQuery,
  COORDINATION_MODES,
  AGENTS_TEAMS,
  getTeamById,
  getDefaultTeam,
  DEFAULT_TEAM_ID,
  ACTIVE_TEAM_STORAGE_KEY,
  applyTeamNamesToConfigs,
  getTeamRoleInfo,
  SOCKET_ROLES,
  getActiveTeam,
  setActiveTeamById,
  initActiveTeam,
} from '../agents';

export {
  getAllTeams,
  getTeamByIdUnified,
  getLoadedCustomTeams,
  bootstrapCustomTeams,
  invalidateCustomTeams,
} from '../agents/workshop/customTeamRegistry';

import { runOrchestration as runAgentsOrchestrator } from '../agents/backendBridge';

export const runAgentsPipeline = (
  userText,
  agentConfigs,
  onStateChange,
  signal,
  persona,
  userProfile,
  onSocketStatusChange,
  onStreamDelta       = null,  // optional real-time token callback — enables streaming path
  documentContext     = null,  // optional { text, filename } — user document upload
  sessionId           = null,  // optional session key for backend conversation memory
  conversationContext = null   // optional pre-built context string for local writer
) =>
  runAgentsOrchestrator(
    userText,
    agentConfigs,
    onStateChange,
    signal,
    persona,
    userProfile,
    onSocketStatusChange,
    onStreamDelta,
    documentContext,
    sessionId,
    conversationContext
  );
