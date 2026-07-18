/**
 * src/agents/memory/userMemory.js
 *
 * Summarizes stored user memory into a compact addition to the shared analysis brief.
 * The output is intentionally small (a few lines) — never a full history dump.
 *
 * Called just before runAgentsOrchestrator() to enrich the analysis object.
 *
 * The user sees a "Clear Memory" option in Settings — wired to clearAllMemory().
 */

import { getMemories } from './memoryStore';

const MAX_MEMORY_LINES = 6; // hard cap on injected memory to avoid context bloat

/**
 * Build a compact memory context string for injection into the shared brief.
 * Returns empty string if no relevant memory exists.
 *
 * @returns {Promise<string>}
 */
export const buildMemoryContext = async () => {
  try {
    const memories = await getMemories();
    if (!memories.length) return '';

    const lines = memories
      .slice(0, MAX_MEMORY_LINES)
      .map(({ key, value, category }) => {
        const tag =
          category === 'correction' ? '⚠ Correction' :
          category === 'topic'      ? '📌 Topic'     :
                                      '💡 Preference';
        return `- ${tag}: ${key.replace(/^[a-z]+:/, '')} → ${value}`;
      });

    return `\n\n**Remembered user context** (apply when relevant, never over-ride the explicit request):\n${lines.join('\n')}`;
  } catch {
    return ''; // never block the pipeline
  }
};

/**
 * Detect and persist implicit preferences from a user's message.
 * E.g. "always answer in bullet points" → saves pref:format = bullet points.
 *
 * Lightweight heuristic — not ML-based. Call after each successful response.
 *
 * @param {string} userText
 * @param {string} sessionId
 */
export const learnFromMessage = async (userText, sessionId = '') => {
  if (!userText?.trim()) return;

  const text = userText.toLowerCase();

  // Format preferences
  if (/\balways\b.*\bbullet\b|\bbullet points?\b.*\balways\b/.test(text)) {
    await setMemory('pref:format', 'bullet points', 'preference', sessionId);
  } else if (/\balways\b.*\bshort\b|\bbrief\b.*\balways\b/.test(text)) {
    await setMemory('pref:format', 'concise answers', 'preference', sessionId);
  } else if (/\balways\b.*\bdetail\b|\bdetailed\b.*\balways\b/.test(text)) {
    await setMemory('pref:format', 'detailed answers', 'preference', sessionId);
  }

  // Language preference
  const langMatch = text.match(/\balways\b.*\banswer in\s+([a-z]+)\b/);
  if (langMatch) {
    await setMemory(`pref:language`, langMatch[1], 'preference', sessionId);
  }
};

// Re-export clearAllMemory for the Settings screen opt-out path
export { clearAllMemory } from './memoryStore';

// Lazy import inside learnFromMessage to avoid circular dep
async function setMemory(...args) {
  const { setMemory: sm } = await import('./memoryStore');
  return sm(...args);
}
