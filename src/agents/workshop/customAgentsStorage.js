/**
 * customAgentsStorage.js
 * ─────────────────────────────────────────────────────────────────────────────
 * AsyncStorage persistence for user-created custom agent personas.
 *
 * Exports:
 *   loadCustomAgents()              → Promise<agent[]>
 *   saveCustomAgent(agent)          → Promise<void>
 *   updateCustomAgent(id, patch)    → Promise<void>
 *   deleteCustomAgent(id)           → Promise<void>
 *   duplicateCustomAgent(id)        → Promise<agent>
 *   generateAgentId()               → string
 *   invalidateCustomAgentsCache()   → void
 * ─────────────────────────────────────────────────────────────────────────────
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'Zyron_CUSTOM_AGENTS';

let _cache = null; // null = not yet loaded

// ── Cache helpers ─────────────────────────────────────────────────────────────

export const invalidateCustomAgentsCache = () => {
  _cache = null;
};

// ── ID generation ─────────────────────────────────────────────────────────────

export const generateAgentId = () =>
  `custom-agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ── Core operations ───────────────────────────────────────────────────────────

/**
 * Load all custom agents from storage.
 * Result is cached until `invalidateCustomAgentsCache()` is called.
 */
export const loadCustomAgents = async () => {
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
 * Save a new custom agent. Appends to the existing list.
 */
export const saveCustomAgent = async (agent) => {
  const current = await loadCustomAgents();
  const updated = [...current, agent];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  _cache = updated;
};

/**
 * Merge `patch` fields into an existing agent identified by `id`.
 */
export const updateCustomAgent = async (id, patch) => {
  const current = await loadCustomAgents();
  const updated = current.map((a) => (a.id === id ? { ...a, ...patch } : a));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  _cache = updated;
};

/**
 * Remove a custom agent by id.
 */
export const deleteCustomAgent = async (id) => {
  const current = await loadCustomAgents();
  const updated = current.filter((a) => a.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  _cache = updated;
};

/**
 * Create a copy of an existing agent with a new id and a "(Copy)" name suffix.
 * Returns the new agent object.
 */
export const duplicateCustomAgent = async (id) => {
  const current = await loadCustomAgents();
  const original = current.find((a) => a.id === id);
  if (!original) throw new Error(`Agent ${id} not found`);
  const copy = { ...original, id: generateAgentId(), name: `${original.name} (Copy)` };
  const updated = [...current, copy];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  _cache = updated;
  return copy;
};
