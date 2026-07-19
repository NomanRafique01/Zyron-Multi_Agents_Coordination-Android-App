import teamFinancers from './teamFinancers';
import teamCoders from './teamCoders';
import teamKnowledgeNexus from './teamMegaMinds';
import teamCreativeStudio from './teamCreativeThinkers';
import teamScienceLab from './teamScientists.js';
import teamHistorians from './teamHistorians';

export const DEFAULT_TEAM_ID = 'financers';
export const ACTIVE_TEAM_STORAGE_KEY = 'zyron_ACTIVE_TEAM';

/** All registered teams — add new team files here */
export const AGENTS_TEAMS = [
  teamKnowledgeNexus,
  teamCoders,
  teamCreativeStudio,
  teamScienceLab,
  teamHistorians,
  teamFinancers,
];

export const getTeamById = (teamId) =>
  AGENTS_TEAMS.find((team) => team.id === teamId) || teamFinancers;

export const getDefaultTeam = () => teamFinancers;

export const SOCKET_ROLES = ['reasoner', 'coder', 'vision', 'writer'];

/**
 * Apply team display names to agent configs — preserves keys, models, activation.
 */
export const applyTeamNamesToConfigs = (team, configs = {}) => {
  const next = { ...configs };
  SOCKET_ROLES.forEach((role) => {
    const agentDef = team?.agents?.[role];
    if (!agentDef || !next[role]) return;
    next[role] = { ...next[role], name: agentDef.name };
  });
  return next;
};

export const getTeamAgentDisplay = (team, role) => {
  const agent = team?.agents?.[role];
  if (!agent) return { name: role, icon: '⚡', socketLabel: `${role} Agent` };
  return {
    name: agent.name,
    icon: agent.icon,
    socketLabel: agent.socketLabel || `${agent.name} Agent`,
    accent: agent.accent,
    defaultModel: null,
  };
};

export const getTeamRoleInfo = (team) =>
  SOCKET_ROLES.reduce((acc, role) => {
    acc[role] = getTeamAgentDisplay(team, role);
    return acc;
  }, {});
