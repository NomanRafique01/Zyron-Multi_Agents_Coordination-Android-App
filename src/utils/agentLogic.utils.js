/**
 * Backward-compatible facade — implementation lives in src/agents/
 */
export {
  runAgentsOrchestrator,
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

import { runAgentsOrchestrator } from '../agents';

export const runAgentsPipeline = (
  userText,
  agentConfigs,
  onStateChange,
  signal,
  persona,
  userProfile,
  onSocketStatusChange,
  onStreamDelta = null    // optional real-time token callback — enables streaming path
) =>
  runAgentsOrchestrator(
    userText,
    agentConfigs,
    onStateChange,
    signal,
    persona,
    userProfile,
    onSocketStatusChange,
    onStreamDelta
  );
