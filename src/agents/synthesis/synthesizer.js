import { callAgent } from '../api/agentCaller.service';
import { buildWriterPrompt } from '../prompts/promptBuilder';
import { deduplicateOutputs, trimOutput, buildFallbackAnswer } from '../utils/outputFormatter.utils';
import { semanticDedup } from './semanticDedup';
import { judgeOutputQuality } from './qualityJudge';
import { getPersonaInstruction } from '../registry/teamMetadata';
import { isKeyExhaustedError } from '../utils/agentErrors.utils';

export const runSynthesisPhase = async ({
  userText,
  analysis,
  persona,
  userProfile,
  agentConfigs,
  specialistOutputs,
  agentLabels,
  signal,
  onSocketStatusChange,
  progress,
  // optional: embed config for semantic dedup (Task 5)
  embedConfig = null,
  // true when specialists each handled a different slice of the prompt
  chunkingActive = false,
  // optional web search result to inject into writer prompt
  searchResults = null,
  // optional user document context { text, filename }
  documentContext = null,
  // optional local-mode conversation context (last 3 messages as plain text)
  // Specialist agents receive NO history — this is injected into the writer only.
  conversationContext = null,
}) => {
  const personaInstruction = getPersonaInstruction(persona);

  // ── Step 1: lexical dedup (fast, always runs) ─────────────────────────────
  const lexDeduped = deduplicateOutputs(specialistOutputs);

  // ── Step 2: semantic dedup (async, only if embedConfig provided) ──────────
  let deduped = lexDeduped;
  if (embedConfig?.key) {
    try {
      deduped = await semanticDedup(lexDeduped, embedConfig);
    } catch {
      deduped = lexDeduped; // fall through on any error
    }
  }

  const trimmed = Object.fromEntries(
    Object.entries(deduped).map(([role, text]) => [role, trimOutput(text)])  // caps each specialist at WRITER_SPECIALIST_CAP
  );

  // ── Step 3: quality scoring (tiered: heuristic or LLM judge) ─────────────
  let qualityReport;
  try {
    qualityReport = await judgeOutputQuality(trimmed, analysis, userText, agentConfigs);
  } catch {
    // Defensive: heuristicReport is the fallback inside judgeOutputQuality itself,
    // but if the import itself somehow threw we need a stub.
    qualityReport = {};
  }

  progress.markActive('writer');

  const { messages } = buildWriterPrompt({
    userText,
    analysis,
    personaInstruction,
    userProfile,
    specialistOutputs: trimmed,
    agentLabels,
    qualityReport,
    chunkingActive,
    searchResults,
    documentContext,
    conversationContext,   // local-mode memory — writer only
  });

  try {
    const res = await callAgent(
      'writer',
      agentConfigs.writer,
      messages,
      signal,
      onSocketStatusChange
    );
    progress.markDone('writer');
    return { text: res.text, usage: res.usage };
  } catch (err) {
    // Only re-throw on explicit user cancel — timeouts are recoverable.
    if (signal?.aborted || err.message === 'Aborted') {
      throw err;
    }
    progress.markFailed('writer', err, isKeyExhaustedError(err));

    const fallback = buildFallbackAnswer(trimmed, analysis);
    return {
      text: fallback || '',
      usage: { prompt_tokens: 0, completion_tokens: 0 },
      error: err,
    };
  }
};
