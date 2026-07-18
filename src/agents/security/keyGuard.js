/**
 * src/agents/security/keyGuard.js
 *
 * Single gateway for reading API keys at call-time from encrypted storage.
 * Keys are NEVER held in a long-lived JS variable — they are read, used, and
 * discarded within the same call stack.
 *
 * Storage backend: expo-secure-store (maps to Android Keystore-backed
 * EncryptedSharedPreferences on Android, Keychain on iOS).
 *
 * Installation requirement:
 *   npx expo install expo-secure-store
 *
 * Fallback: if expo-secure-store is unavailable (Expo Go, unit tests), the
 * module degrades silently — getKey() returns null and the caller handles the
 * missing-key case via the existing "No API key configured" guard in callAgent.js.
 */

let SecureStore = null;
try {
  // Dynamic import so the module doesn't crash in environments without the native module.
  SecureStore = require('expo-secure-store');
} catch {
  // expo-secure-store not installed or not available — all reads will return null.
}

// ─── Key name helpers ─────────────────────────────────────────────────────────
// Keys are namespaced to avoid collisions with other app storage.
const _storageKey = (provider) => `zyron_key_${provider}`;

// ─── Write (call once during initial setup / key-entry screen) ───────────────
/**
 * Persist a provider API key to the encrypted store.
 * Call this when the user saves a key in Settings — replace the current
 * plaintext AsyncStorage write with this.
 *
 * @param {string} provider  — e.g. 'openai', 'anthropic', 'groq'
 * @param {string} key       — the raw API key string
 */
export const saveKey = async (provider, key) => {
  if (!SecureStore) return;
  if (!provider || !key) return;
  try {
    await SecureStore.setItemAsync(_storageKey(provider), key.trim(), {
      requireAuthentication: false, // set true to require biometric unlock
    });
  } catch {
    // Write failure is silent — the key will remain missing and the agent will
    // surface a "No API key configured" error at call-time.
  }
};

// ─── Read (call-time only) ────────────────────────────────────────────────────
/**
 * Retrieve a provider key at the moment it is needed.
 * Returns null if not found or if SecureStore is unavailable.
 * NEVER assign the return value to a module-level variable.
 *
 * @param {string} provider
 * @returns {Promise<string|null>}
 */
export const getKey = async (provider) => {
  if (!SecureStore) return null;
  try {
    return await SecureStore.getItemAsync(_storageKey(provider));
  } catch {
    return null;
  }
};

// ─── Delete ───────────────────────────────────────────────────────────────────
/**
 * Remove a stored key (e.g. when the user clears their settings).
 *
 * @param {string} provider
 */
export const deleteKey = async (provider) => {
  if (!SecureStore) return;
  try {
    await SecureStore.deleteItemAsync(_storageKey(provider));
  } catch {
    // Ignore — key was already absent.
  }
};

// ─── Migrate plaintext keys ───────────────────────────────────────────────────
/**
 * One-time migration helper.
 * Pass an object { provider: plaintextKey } to move existing plaintext keys
 * (e.g. from AsyncStorage / appConfig) into secure storage, then clear the
 * source. Call this once on app upgrade.
 *
 * @param {Record<string, string>} plaintextMap
 */
export const migrateKeys = async (plaintextMap) => {
  await Promise.all(
    Object.entries(plaintextMap).map(([provider, key]) =>
      key ? saveKey(provider, key) : Promise.resolve()
    )
  );
};
