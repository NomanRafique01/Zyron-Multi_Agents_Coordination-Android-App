/**
 * src/agents/memory/memoryStore.js
 *
 * Local persistent memory using expo-sqlite (on-device, no network).
 * Stores user corrections, preferences, and recurring topics.
 *
 * Schema (single table: user_memory):
 *   id          INTEGER PRIMARY KEY AUTOINCREMENT
 *   key         TEXT UNIQUE   — e.g. 'pref:format', 'topic:react-hooks', 'correction:timezone'
 *   value       TEXT          — the stored preference or note
 *   category    TEXT          — 'preference' | 'correction' | 'topic'
 *   updated_at  INTEGER       — Unix ms timestamp
 *   session_id  TEXT          — which session created/updated this
 *
 * Installation requirement:
 *   npx expo install expo-sqlite
 *
 * Fallback: if expo-sqlite is unavailable, all writes are no-ops and reads
 * return empty arrays — the pipeline continues unaffected.
 */

let SQLite = null;
try {
  SQLite = require('expo-sqlite');
} catch {
  // expo-sqlite not installed — all operations degrade gracefully.
}

const DB_NAME = 'zyron_memory.db';
let _db = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
const getDb = async () => {
  if (!SQLite) return null;
  if (_db) return _db;
  try {
    _db = await SQLite.openDatabaseAsync(DB_NAME);
    await _db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_memory (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        key        TEXT UNIQUE,
        value      TEXT,
        category   TEXT DEFAULT 'preference',
        updated_at INTEGER,
        session_id TEXT
      );
    `);
    return _db;
  } catch {
    _db = null;
    return null;
  }
};

// ─── Write ────────────────────────────────────────────────────────────────────
/**
 * Upsert a memory entry.
 * @param {string} key
 * @param {string} value
 * @param {'preference'|'correction'|'topic'} category
 * @param {string} [sessionId]
 */
export const setMemory = async (key, value, category = 'preference', sessionId = '') => {
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync(
      `INSERT INTO user_memory (key, value, category, updated_at, session_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, category=excluded.category,
         updated_at=excluded.updated_at, session_id=excluded.session_id`,
      [key, value, category, Date.now(), sessionId]
    );
  } catch {
    // Write failure is silent.
  }
};

// ─── Read ─────────────────────────────────────────────────────────────────────
/**
 * Get all memories, optionally filtered by category.
 * @param {'preference'|'correction'|'topic'|null} category
 * @returns {Promise<Array<{ key, value, category, updated_at }>>}
 */
export const getMemories = async (category = null) => {
  const db = await getDb();
  if (!db) return [];
  try {
    if (category) {
      return await db.getAllAsync(
        'SELECT key, value, category, updated_at FROM user_memory WHERE category = ? ORDER BY updated_at DESC',
        [category]
      );
    }
    return await db.getAllAsync(
      'SELECT key, value, category, updated_at FROM user_memory ORDER BY updated_at DESC'
    );
  } catch {
    return [];
  }
};

// ─── Delete ───────────────────────────────────────────────────────────────────
/**
 * Delete a single memory entry.
 */
export const deleteMemory = async (key) => {
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync('DELETE FROM user_memory WHERE key = ?', [key]);
  } catch {}
};

/**
 * Clear ALL memory (user opt-out / reset).
 */
export const clearAllMemory = async () => {
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync('DELETE FROM user_memory');
  } catch {}
};
