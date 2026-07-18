/**
 * src/agents/synthesis/qualityJudge.js
 *
 * Tiered quality scoring:
 *
 *  - LOW / MEDIUM complexity  → fast heuristic scorer (existing outputUtils logic),
 *                               zero extra API calls.
 *  - HIGH complexity          → one cheap LLM call that scores each specialist
 *                               output 0–10 on correctness + relevance.
 *                               Falls back to heuristic if the judge call fails.
 *
 * The judge call uses the smallest/cheapest available model the user has configured.
 * Preference order: groq (fastest) → openai → openrouter → mistral → any available.
 */

import { invokeProvider } from '../api/providers.service';
import { buildQualityReport as heuristicReport } from '../utils/outputFormatter.utils';

const JUDGE_TIMEOUT_MS = 8_000;
const JUDGE_PREFERRED_PROVIDERS = ['groq', 'openai', 'openrouter', 'mistral'];

// ─── Pick cheapest available judge config ─────────────────────────────────────
const pickJudgeConfig = (agentConfigs) => {
  for (const prov of JUDGE_PREFERRED_PROVIDERS) {
    const found = Object.values(agentConfigs).find(
      (cfg) => cfg?.provider === prov && cfg?.key?.trim()
    );
    if (found) return found;
  }
  // fallback: any config with a key
  return Object.values(agentConfigs).find((cfg) => cfg?.key?.trim()) ?? null;
};

// ─── Judge prompt ─────────────────────────────────────────────────────────────
const buildJudgePrompt = (userQuery, outputsByRole, analysis) => {
  const outputsText = Object.entries(outputsByRole)
    .filter(([, t]) => t?.trim())
    .map(([role, text]) => `### ${role}\n${text.slice(0, 1200)}`)
    .join('\n\n');

  return `You are an impartial judge evaluating specialist AI outputs.

User query: "${userQuery}"
Query type: ${analysis.primaryType} | Complexity: ${analysis.complexity}

Specialist outputs:
${outputsText}

For each specialist, output ONLY a JSON object — no prose, no explanation:
{
  "reasoner": <score 0-10>,
  "coder": <score 0-10>,
  "vision": <score 0-10>
}

Scoring criteria:
- 9-10: Directly answers the query with correct, relevant, and deep content.
- 7-8: Mostly correct with minor gaps.
- 5-6: Partial answer, some relevant content.
- 3-4: Off-topic or superficial.
- 0-2: Wrong, empty, or incoherent.

Output only the JSON object.`;
};

// ─── Parse judge response ─────────────────────────────────────────────────────
const parseJudgeResponse = (text) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * Score specialist outputs — uses LLM judge for HIGH complexity, heuristic for rest.
 *
 * @param {Record<string,string>} outputsByRole
 * @param {object} analysis
 * @param {string} userText
 * @param {object} agentConfigs   — to find a cheap judge model
 * @returns {Promise<Record<string, { score: number, emphasis: string }>>}
 */
export const judgeOutputQuality = async (
  outputsByRole,
  analysis,
  userText,
  agentConfigs = {}
) => {
  // Always use the heuristic scorer — the LLM judge made an extra API call on every
  // high-complexity prompt (which is most real prompts), burning a rate-limit slot
  // before the writer even started and adding 1–3 s of latency. The heuristic is
  // sufficient to order contributions and drive the quality note in the writer prompt.
  return heuristicReport(outputsByRole, analysis);

  // (LLM judge path preserved below for potential future opt-in feature)
  // HIGH complexity — try LLM judge
  const judgeConfig = pickJudgeConfig(agentConfigs);
  if (!judgeConfig) {
    return heuristicReport(outputsByRole, analysis);
  }

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);

  try {
    const prompt = buildJudgePrompt(userText, outputsByRole, analysis);
    const result = await invokeProvider(
      judgeConfig.provider,
      judgeConfig.model,
      judgeConfig.key.trim(),
      [{ role: 'user', content: prompt }],
      controller.signal
    );
    clearTimeout(tid);

    const scores = parseJudgeResponse(result.text);
    if (!scores) throw new Error('Unparseable judge response');

    // Merge LLM scores with heuristic emphasis values
    const heuristic = heuristicReport(outputsByRole, analysis);
    const merged = {};
    for (const role of Object.keys(heuristic)) {
      merged[role] = {
        score: scores[role] ?? heuristic[role].score,
        emphasis: heuristic[role].emphasis,
        judged: true,
      };
    }
    return merged;

  } catch {
    clearTimeout(tid);
    // Any failure — fall back to heuristic silently
    return heuristicReport(outputsByRole, analysis);
  }
};
