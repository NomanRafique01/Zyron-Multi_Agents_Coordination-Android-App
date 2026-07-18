/**
 * src/agents/teams/teamBlend.js
 *
 * Per-query team blending — pull specialists from two teams for a single query
 * without changing the session team.
 *
 * Example: "explain and implement X" → Mega Minds' Scholar (reasoner) +
 *          Coders' Engineer (coder) + active team's vision/writer.
 *
 * Usage:
 *   const blendedConfigs = blendTeams(activeTeam, donorTeam, ['reasoner'], agentConfigs);
 *   // pass blendedConfigs into runAgentsOrchestrator as agentConfigs
 *
 * The blend only affects display names, icons, and directives (metadata).
 * API keys always come from agentConfigs — blending never injects keys.
 */

import { applyTeamToRegistry } from '../registry/agentRegistry';
import { getActiveTeam } from './teamRuntime';

/**
 * Build a blended metadata object: donor roles override the active team for
 * the listed role slots, leaving other slots from the active team intact.
 *
 * @param {object} activeTeam       — current session team
 * @param {object} donorTeam        — team to borrow roles from
 * @param {string[]} borrowRoles    — e.g. ['reasoner', 'coder']
 * @param {object} agentConfigs     — live config with keys/models (unmodified)
 * @returns {object}  merged agentConfigs with donor display metadata applied
 */
export const blendTeams = (activeTeam, donorTeam, borrowRoles, agentConfigs) => {
  if (!donorTeam || !borrowRoles?.length) return agentConfigs;

  const merged = { ...agentConfigs };

  borrowRoles.forEach((role) => {
    const donorAgent = donorTeam.agents?.[role];
    if (!donorAgent || !merged[role]) return;

    // Overlay donor display metadata — preserve keys and model from live config
    merged[role] = {
      ...merged[role],
      name:             donorAgent.name,
      // Store donor directive so buildPrompts.js can pick it up via agentMeta
      _blendDirective:  donorAgent.specialistDirective,
      _blendLens:       donorAgent.contributionLens,
    };
  });

  return merged;
};

/**
 * Resolve the best two-team blend for a given analysis.
 * Returns donor team and which roles to borrow, or null if no blend is needed.
 *
 * @param {object} analysis       — from analyzeQuery()
 * @param {object} agentConfigs
 * @returns {{ donorTeam, borrowRoles } | null}
 */
export const resolveBestBlend = (analysis, agentConfigs) => {
  const { primaryType, needsCode, isAnalytical } = analysis;
  const activeTeam = getActiveTeam();

  // Example blend rules — extend as needed
  if (needsCode && isAnalytical && activeTeam?.id !== 'coders') {
    const { getTeamById } = require('./index');
    const coders = getTeamById('coders');
    return { donorTeam: coders, borrowRoles: ['coder'] };
  }

  if (primaryType === 'stem' && activeTeam?.id !== 'scientists') {
    const { getTeamById } = require('./index');
    const scientists = getTeamById('scientists');
    return { donorTeam: scientists, borrowRoles: ['reasoner'] };
  }

  return null; // no blend needed
};
