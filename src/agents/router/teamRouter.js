/**
 * src/agents/router/teamRouter.js
 *
 * Suggests a team switch when the active team is a poor fit for the detected query type.
 * Does NOT silently force a switch — returns a suggestion object the UI can offer as a
 * one-tap prompt.
 *
 * Also supports "borrow a role" — pulling one specialist from a better-suited team
 * for a single query without switching the session team.
 */

import { getActiveTeam } from '../teams/teamRuntime';
import { getTeamById, AGENTS_TEAMS } from '../teams';

// ─── Team × query type affinity map ──────────────────────────────────────────
// Higher score = better fit. Built from each team's category and analysisBias.
const TEAM_AFFINITY = {
  'dev-core':          { coding: 9, analytical: 7, general: 7, stem: 5, writing: 4, creative: 3 },
  'coders':            { coding: 10, analytical: 6, general: 5, stem: 6, writing: 2, creative: 2 },
  'mega-minds':        { analytical: 10, general: 9, writing: 7, coding: 5, stem: 7, creative: 6 },
  'creative-thinkers': { creative: 10, writing: 10, analytical: 5, general: 6, coding: 2, stem: 2 },
  'scientists':        { stem: 10, analytical: 8, general: 5, coding: 5, writing: 3, creative: 2 },
  'historians':        { analytical: 9, writing: 7, general: 8, coding: 2, stem: 3, creative: 5 },
};

const affinityScore = (teamId, primaryType) =>
  (TEAM_AFFINITY[teamId] ?? {})[primaryType] ?? 5;

/**
 * Suggest a team switch if the active team is a significantly worse fit.
 *
 * @param {object} analysis  — from analyzeQuery()
 * @returns {{ suggest: boolean, teamId?: string, teamName?: string, reason?: string }}
 */
export const suggestTeamSwitch = (analysis) => {
  const activeTeam = getActiveTeam();
  const { primaryType } = analysis;

  const activeScore = affinityScore(activeTeam?.id, primaryType);

  let bestTeam = null;
  let bestScore = activeScore;

  for (const team of AGENTS_TEAMS) {
    if (team.id === activeTeam?.id) continue;
    const score = affinityScore(team.id, primaryType);
    if (score > bestScore) {
      bestScore = score;
      bestTeam = team;
    }
  }

  // Only suggest if the better team is meaningfully superior (gap ≥ 3 points)
  if (!bestTeam || bestScore - activeScore < 3) {
    return { suggest: false };
  }

  return {
    suggest: true,
    teamId: bestTeam.id,
    teamName: bestTeam.name,
    currentTeamName: activeTeam?.name,
    reason: `"${bestTeam.name}" is optimised for ${primaryType} queries (current: "${activeTeam?.name}").`,
  };
};

/**
 * Get the best team for a given query type without switching the session.
 * Used by teamBlend.js to borrow individual roles.
 *
 * @param {string} primaryType
 * @returns {object} team definition
 */
export const getBestTeamForType = (primaryType) => {
  let best = null;
  let bestScore = -1;
  for (const team of AGENTS_TEAMS) {
    const score = affinityScore(team.id, primaryType);
    if (score > bestScore) {
      bestScore = score;
      best = team;
    }
  }
  return best ?? getTeamById('dev-core');
};
