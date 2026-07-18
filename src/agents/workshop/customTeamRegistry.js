/**
 * customTeamRegistry.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Unified team discovery — merges built-in teams with custom teams.
 *
 * This module is the single source-of-truth for the full team collection.
 * It exposes the same interface as the built-in teams index so all existing
 * consumers (AgentLibraryPanel, teamRuntime, team router, etc.) continue to
 * work without any conditional logic.
 *
 * Custom teams are loaded asynchronously on first call, then cached.
 * If no custom teams exist, behavior is identical to the current system.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AGENTS_TEAMS as BUILTIN_TEAMS, getTeamById as getBuiltinTeamById } from '../teams/index';
import { loadCustomTeams } from './customTeamsStorage';

let _customTeamsCache = null; // null = not yet loaded, [] = loaded (may be empty)
let _mergedTeamsCache = null;

// ── Cache management ──────────────────────────────────────────────────────────

/**
 * Invalidate caches — call after saving or deleting a custom team.
 */
export const invalidateCustomTeams = () => {
  _customTeamsCache = null;
  _mergedTeamsCache = null;
};

// ── Async bootstrap (call once at app start) ─────────────────────────────────

/**
 * Pre-load custom teams into cache.
 * Called during app bootstrap — resolves quickly if nothing is stored.
 */
export const bootstrapCustomTeams = async () => {
  try {
    _customTeamsCache = await loadCustomTeams();
    _mergedTeamsCache = [...BUILTIN_TEAMS, ..._customTeamsCache];
  } catch {
    _customTeamsCache = [];
    _mergedTeamsCache = [...BUILTIN_TEAMS];
  }
};

// ── Synchronous accessors (safe after bootstrap) ──────────────────────────────

/**
 * Returns the full unified team list (built-in + custom).
 * Falls back to built-in only if custom teams haven't loaded yet.
 */
export const getAllTeams = () => {
  if (_mergedTeamsCache) return _mergedTeamsCache;
  return BUILTIN_TEAMS; // safe fallback before bootstrap
};

/**
 * Equivalent to getTeamById — searches unified collection.
 * Falls back to built-in teams if not found in custom.
 */
export const getTeamByIdUnified = (teamId) => {
  const all = getAllTeams();
  return all.find((t) => t.id === teamId) || getBuiltinTeamById(teamId);
};

/**
 * Returns only custom teams (already loaded) — used by UI panels.
 */
export const getLoadedCustomTeams = () => _customTeamsCache || [];
