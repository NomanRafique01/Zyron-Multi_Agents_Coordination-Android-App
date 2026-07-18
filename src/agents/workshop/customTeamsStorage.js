/**
 * customTeamsStorage.js
 * ─────────────────────────────────────────────────────────────────────────────
 * AsyncStorage persistence for user-created custom teams.
 *
 * Exports:
 *   loadCustomTeams()           → Promise<team[]>
 *   saveCustomTeam(team)        → Promise<void>
 *   deleteCustomTeam(id)        → Promise<void>
 *   generateTeamId()            → string
 *   invalidateCustomTeamsCache()→ void
 * ─────────────────────────────────────────────────────────────────────────────
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'Zyron_CUSTOM_TEAMS';

let _cache = null; // null = not yet loaded

// ── Cache helpers ─────────────────────────────────────────────────────────────

export const invalidateCustomTeamsCache = () => {
  _cache = null;
};

// ── ID generation ─────────────────────────────────────────────────────────────

export const generateTeamId = () =>
  `custom-team-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ── Core operations ───────────────────────────────────────────────────────────

/**
 * Load all custom teams from storage.
 * Result is cached until `invalidateCustomTeamsCache()` is called.
 */
export const loadCustomTeams = async () => {
  if (_cache !== null) return _cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    _cache = raw ? JSON.parse(raw) : [];
  } catch {
    _cache = [];
  }
  return _cache;
};

/**
 * Persist a new custom team. Appends to the existing list.
 * Invalidates the cache so the next read reflects the change.
 */
export const saveCustomTeam = async (team) => {
  const current = await loadCustomTeams();
  const updated = [...current, team];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  _cache = updated;
};

/**
 * Remove a custom team by id.
 */
export const deleteCustomTeam = async (id) => {
  const current = await loadCustomTeams();
  const updated = current.filter((t) => t.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  _cache = updated;
};
