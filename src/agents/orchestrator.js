import { analyzeQuery } from './analysis/queryAnalyzer';
import { callAgent } from './api/agentCaller.service';
import { createProgressTracker } from './progress/progressTracker';
import { buildSpecialistPrompt, buildWriterPrompt } from './prompts/promptBuilder';
import { runSynthesisPhase } from './synthesis/synthesizer';
import { getPipelinePhases, getAgentMeta } from './registry/agentRegistry';
import { COORDINATION_MODES } from './registry/teamMetadata';
import { isKeyExhaustedError } from './utils/agentErrors.utils';
import { streamSpecialists } from './streaming/streamManager';
import { getPersonaInstruction } from './registry/teamMetadata';
import { deduplicateOutputs, trimOutput, buildQualityReport, buildFallbackAnswer } from './utils/outputFormatter.utils';
import { shouldChunkPrompt, chunkPromptForRoles, buildChunkedUserMessage } from './utils/promptChunker';
import { runWebSearch } from './search/webSearch';

// Note: deduplicateOutputs is now a pass-through (no suppression) — see outputUtils.js.
// All specialist outputs reach the writer's context unchanged.

// Minimum chars an agent must produce to be considered "contributed".
// Below this threshold the orchestrator retries with a blocking call.
// Set low (10) so that short but valid responses to short prompts (e.g. "hi" → "Hello!")
// are never discarded. The only case where a retry is truly needed is a genuinely
// empty or whitespace-only response.
const MIN_SPECIALIST_CHARS = 10;

// ─── Token usage builder ──────────────────────────────────────────────────────
const buildTokenUsage = (agents, usageByRole) => {
  const tokenUsage = {};
  agents.forEach((agent) => {
    const usage = usageByRole[agent.role] || { prompt_tokens: 0, completion_tokens: 0 };
    tokenUsage[agent.name] = {
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
    };
  });
  return tokenUsage;
};

/**
 * Main agents orchestrator — parallel specialists with real streaming,
 * sequential synthesis (also streamed).
 *
 * Flow:
 *  1. analyzeQuery()          → rich flags
 *  2. specialists (parallel)  → each agent streams real tokens via streamManager
 *  3. runSynthesisPhase()     → writer merges all angles
 *
 * @param {string}   userText
 * @param {object}   agentConfigs
 * @param {function} onStateChange        — (agents[], meta) => void
 * @param {AbortSignal} signal
 * @param {string}   persona
 * @param {object}   userProfile
 * @param {function} onSocketStatusChange — (role, status, msg) => void
 * @param {function} [onStreamDelta]      — NEW: (role, chunk) => void  (real-time token callback)
 */
export const runAgentsOrchestrator = async (
  userText,
  agentConfigs,
  onStateChange,
  signal,
  persona,
  userProfile,
  onSocketStatusChange,
  onStreamDelta       = null,   // optional — if not provided, falls back to blocking mode
  documentContext     = null,   // optional — { text, filename } user document upload
  sessionId           = null,   // optional — opaque session key (passed through; not used in local mode)
  conversationContext = null    // optional — pre-built plain-text context for the writer (local mode only)
) => {
  const _orchestratorStart = Date.now();
  console.log('[Zyron Local] 🧠 Local orchestration engine active');
  const analysis = analyzeQuery(userText);
  analysis.coordinationMode = COORDINATION_MODES.FULL;
  const phases = getPipelinePhases();

  // ── Web search (fires before specialist pipeline) ──────────────────────────
  // Runs only when analysis detects a real-time-data need.
  // Fallback chain: Tavily → Serper → null (silent).
  let _searchResults = null;
  if (analysis.needsWebSearch && analysis.webSearchQuery) {
    _searchResults = await runWebSearch(analysis.webSearchQuery).catch(() => null);
  }

  let latestMeta = { coordinationMode: analysis.coordinationMode, analysis };

  const emitState = (agents) => {
    if (typeof onStateChange === 'function') {
      onStateChange(agents, latestMeta);
    }
  };

  const progress = createProgressTracker(agentConfigs, emitState);
  emitState(progress.agents());

  const specialistOutputs = {};
  const usageByRole = {};
  const agentLabels = { writer: agentConfigs.writer?.name || 'Writer' };

  // ── Large-prompt chunking flag — hoisted so synthesis phase can read it ──
  // Determined once before the pipeline loop; specialists phase populates promptChunks.
  const useChunking = shouldChunkPrompt(userText, agentConfigs);
  let promptChunks = null;

  try {
    for (const phase of phases) {
      if (signal?.aborted) throw new Error('Aborted');

      // ── Specialists phase ────────────────────────────────────────────────────
      if (phase.id === 'specialists') {
        const roles = phase.agents.filter((r) => r !== 'writer');

        // Build display labels
        roles.forEach((role) => {
          const meta = getAgentMeta(role);
          agentLabels[role] = agentConfigs[role]?.name || meta.defaultDisplayName?.split(' ')[0] || role;
        });

        // ── Large-prompt chunking for weak models ────────────────────────────
        // When the prompt is large AND at least one specialist is on a small/weak
        // model, split the prompt into per-role slices so no single API call has
        // to handle the full context. Each specialist gets its own focused chunk.
        // The writer still receives all outputs and assembles the full answer.
        if (useChunking) {
          promptChunks = chunkPromptForRoles(userText, roles);
        }

        if (typeof onStreamDelta === 'function') {
          // ── STREAMING PATH ─────────────────────────────────────────────────
          // Accumulate partial text per role so we can hand it to synthesis.
          const partialTexts = {};
          roles.forEach((r) => { partialTexts[r] = ''; });

          // Mark all specialists active before streaming begins
          roles.forEach((role) => progress.markActive(role));

          const specs = roles.map((role) => {
            const config = agentConfigs[role];
            const agentName = config?.name || role.charAt(0).toUpperCase() + role.slice(1);
            // When chunking: replace the bare userText with this role's focused slice.
            // The system prompt (specialist directive) is built from the full analysis
            // as normal — only the user-facing message content is scoped to the chunk.
            const effectiveUserText = useChunking && promptChunks?.[role]
              ? buildChunkedUserMessage(promptChunks[role], agentName)
              : userText;
            const { messages } = buildSpecialistPrompt(
              role, agentName, effectiveUserText, analysis, userProfile, _searchResults, documentContext
            );
            return { role, agentConfig: config, messages };
          });

          await streamSpecialists(
            specs,
            // onDelta — real token chunk
            // Also drive the progress bar from actual chars received so the bar
            // never freezes: specialists are expected to produce ~6 000 chars on
            // large prompts; writer up to ~12 000.
            (role, chunk) => {
              partialTexts[role] = (partialTexts[role] || '') + chunk;
              progress.streamProgress(role, partialTexts[role].length, 6_000);
              onStreamDelta(role, chunk);
            },
            // onDone — stream finished for this role
            (role, result) => {
              specialistOutputs[role] = result.text;
              usageByRole[role] = result.usage;
              onSocketStatusChange?.(role, 'active', '');
              progress.markDone(role);
            },
            // onError — stream failed: commit whatever partial text arrived so the
            // Writer still has this agent's contribution. Keep the UI in "working"
            // state (markRetrying) because the empty-output guard will retry
            // immediately after — markFailed is reserved for when the retry also fails.
            (role, err) => {
              if (signal?.aborted || err.name === 'AbortError' || err.message === 'Aborted') {
                return; // let the abort propagate
              }
              // Preserve partial streamed text — never discard it on error/timeout
              const partial = partialTexts[role] || '';
              specialistOutputs[role] = partial;
              usageByRole[role] = { prompt_tokens: 0, completion_tokens: 0 };
              const exhausted = isKeyExhaustedError(err);
              const isTimeout = err.isStreamTimeout === true;
              // Never hard-fail on transient errors (rate-limits, 5xx) or timeouts —
              // always allow the empty-output retry pass below.
              // Only hard-fail truly exhausted keys (402 / billing quota) because
              // retrying those is pointless.
              if (exhausted) {
                onSocketStatusChange?.(role, 'exhausted', err.message);
                progress.markFailed(role, err, true);
              } else {
                // Keep the agent in "retrying" state — the empty-output guard below
                // will fire a blocking retry for any role whose output is too short.
                progress.markRetrying(role);
              }
            },
            signal
          );

          // ── Empty-output guard: blocking retry for any agent that streamed nothing ──
          // Runs AFTER allSettled so it never delays other specialists.
          if (!signal?.aborted) {
            const emptyRoles = roles.filter(
              (r) => !specialistOutputs[r] || specialistOutputs[r].trim().length < MIN_SPECIALIST_CHARS
            );
            if (emptyRoles.length > 0) {
              const roleNumberMap = { reasoner: 'Agent 1', coder: 'Agent 2', vision: 'Agent 3', writer: 'Agent 4' };
              await Promise.allSettled(
                emptyRoles.map(async (role) => {
                  if (signal?.aborted) return;
                  const config = agentConfigs[role];
                  if (!config) return;
                  const agentName = config.name || role.charAt(0).toUpperCase() + role.slice(1);
                  const effectiveUserText = useChunking && promptChunks?.[role]
                    ? buildChunkedUserMessage(promptChunks[role], agentName)
                    : userText;
                  const { messages } = buildSpecialistPrompt(role, agentName, effectiveUserText, analysis, userProfile, _searchResults, documentContext);
                  try {
                    const res = await callAgent(role, config, messages, signal, onSocketStatusChange);
                    if (res?.text?.trim().length >= MIN_SPECIALIST_CHARS) {
                      specialistOutputs[role] = res.text;
                      usageByRole[role] = res.usage;
                      // Retry succeeded — mark done so UI goes straight from working → complete
                      progress.markDone(role);
                      onSocketStatusChange?.(role, 'active', '');
                    } else {
                      // Retry returned but output is too short — treat as a real failure now
                      progress.markFailed(role, new Error('Empty response after retry'), false);
                      onSocketStatusChange?.(role, 'error', 'Empty response after retry');
                    }
                  } catch (retryErr) {
                    if (signal?.aborted || retryErr.name === 'AbortError' || retryErr.message === 'Aborted') return;
                    // Retry also failed — only NOW show the error state in the UI
                    progress.markFailed(role, retryErr, isKeyExhaustedError(retryErr));
                    onSocketStatusChange?.(role, isKeyExhaustedError(retryErr) ? 'exhausted' : 'error', retryErr.message);
                  }
                })
              );
            }
          }

          if (signal?.aborted) throw new Error('Aborted');

        } else {
          // ── BLOCKING FALLBACK (no onStreamDelta provided) ──────────────────
          const results = await Promise.allSettled(
            roles.map(async (role) => {
              const config = agentConfigs[role];
              if (!config) return { role, text: '', usage: { prompt_tokens: 0, completion_tokens: 0 } };
              const agentName = config.name || role.charAt(0).toUpperCase() + role.slice(1);
              progress.markActive(role);
              const effectiveUserText = useChunking && promptChunks?.[role]
                ? buildChunkedUserMessage(promptChunks[role], agentName)
                : userText;
              const { messages } = buildSpecialistPrompt(
                role, agentName, effectiveUserText, analysis, userProfile, _searchResults, documentContext
              );
              try {
                const res = await callAgent(role, config, messages, signal, onSocketStatusChange);
                progress.markDone(role);
                return { role, text: res.text, usage: res.usage };
              } catch (err) {
                // Only re-throw on explicit user cancel — timeouts and API errors are recoverable per-agent.
                if (signal?.aborted || err.message === 'Aborted') throw err;
                progress.markFailed(role, err, isKeyExhaustedError(err));
                return { role, text: '', usage: { prompt_tokens: 0, completion_tokens: 0 }, error: err };
              }
            })
          );

          results.forEach((settled) => {
            if (settled.status === 'fulfilled') {
              const { role, text, usage } = settled.value;
              specialistOutputs[role] = text;
              usageByRole[role] = usage;
            }
          });
        }

        // Log per-specialist char counts
        Object.entries(specialistOutputs).forEach(([role, text]) => {
          const name = agentConfigs[role]?.name || role.charAt(0).toUpperCase() + role.slice(1);
          console.log(`[Zyron Local] 👤 ${name} → ${text ? text.length : 0} chars`);
        });

      }

      // ── Synthesis phase ──────────────────────────────────────────────────────
      if (phase.id === 'synthesis') {
        if (signal?.aborted) throw new Error('Aborted');

        // Streaming writer — forward real tokens through onStreamDelta with role='writer'
        if (typeof onStreamDelta === 'function' && agentConfigs.writer) {
          const personaInstruction = getPersonaInstruction(persona);
          const deduped = deduplicateOutputs(specialistOutputs);
          const trimmed = Object.fromEntries(
            Object.entries(deduped).map(([role, text]) => [role, trimOutput(text)])
          );
          const qualityReport = buildQualityReport(trimmed, analysis);

          progress.markActive('writer');

          const { messages } = buildWriterPrompt({
            userText, analysis, personaInstruction, userProfile,
            specialistOutputs: trimmed, agentLabels, qualityReport,
            chunkingActive:      useChunking,
            searchResults:       _searchResults,
            documentContext,
            conversationContext,   // local-mode: last 3 messages as plain text (writer only)
          });

          let writerText = '';
          let writerDone = false;
          let writerErr = null;

          await new Promise((resolve) => {
            const { streamAgent } = require('./streaming/streamManager');
            streamAgent(
              'writer',
              agentConfigs.writer,
              messages,
              (role, chunk) => {
                writerText += chunk;
                progress.streamProgress('writer', writerText.length, 12_000);
                onStreamDelta(role, chunk);
              },
              (role, result) => {
                writerText = result.text;
                usageByRole.writer = result.usage;
                writerDone = true;
                onSocketStatusChange?.('writer', 'active', '');
                progress.markDone('writer');
                resolve();
              },
              (role, err) => {
                // If stall-watchdog fired mid-stream, recover the partial text
                // that was produced so the user still gets an answer.
                if (err?.isStreamTimeout && err?.partialText) {
                  writerText = err.partialText;
                }
                writerErr = err;
                resolve();
              },
              signal
              // timeoutMs intentionally omitted — uses the 10-min backstop default.
              // The 90-s stall watchdog inside streamAgent handles frozen connections.
            );
          });

          // Only stop on explicit user cancel. Provider timeouts and stream errors
          // fall through to the partial-text / fallback path below.
          if (signal?.aborted || (writerErr?.message === 'Aborted')) {
            throw new Error('Aborted');
          }

          if (!writerDone) {
            const writerExhausted = isKeyExhaustedError(writerErr);

            // ── Writer retry: keep UI in "working" then attempt a blocking call ──
            // The stream may have failed due to context overflow, a transient 5xx,
            // or a stall. Give the writer one blocking retry before giving up.
            // Only skip the retry for exhausted keys (no point retrying those).
            if (!writerExhausted && !signal?.aborted) {
              progress.markRetrying('writer');
              try {
                const retryRes = await callAgent(
                  'writer', agentConfigs.writer, messages, signal, onSocketStatusChange
                );
                if (retryRes?.text?.trim()) {
                  writerText = retryRes.text;
                  usageByRole.writer = retryRes.usage;
                  writerDone = true;
                  progress.markDone('writer');
                  onSocketStatusChange?.('writer', 'active', '');
                }
              } catch (retryErr) {
                if (signal?.aborted || retryErr.name === 'AbortError' || retryErr.message === 'Aborted') {
                  throw new Error('Aborted');
                }
              }
            }

            // If still not done after retry, mark failed and use partial/fallback
            if (!writerDone) {
              progress.markFailed('writer', writerErr, writerExhausted);
              // Prefer partial streamed text over cold fallback
              if (!writerText.trim()) {
                const fallback = buildFallbackAnswer(trimmed, analysis);
                writerText = fallback || '';
              }
              usageByRole.writer = { prompt_tokens: 0, completion_tokens: 0 };
            }
          }

          const agents = progress.agents();
          console.log(`[Zyron Local] ✅ Response ready in ${Date.now() - _orchestratorStart}ms`);
          return {
            text: writerText,
            agents,
            tokenUsage: buildTokenUsage(agents, usageByRole),
            meta: { coordinationMode: analysis.coordinationMode, analysis },
          };
        }

        // Non-streaming synthesis (existing path)
        const synthesis = await runSynthesisPhase({
          userText, analysis, persona, userProfile, agentConfigs,
          specialistOutputs, agentLabels, signal, onSocketStatusChange,
          progress, chunkingActive: useChunking,
          searchResults:       _searchResults,
          documentContext,
          conversationContext,   // local-mode: last 3 messages as plain text (writer only)
        });

        usageByRole.writer = synthesis.usage;
        const agents = progress.agents();
        console.log(`[Zyron Local] ✅ Response ready in ${Date.now() - _orchestratorStart}ms`);
        return {
          text: synthesis.text,
          agents,
          tokenUsage: buildTokenUsage(agents, usageByRole),
          meta: { coordinationMode: analysis.coordinationMode, analysis },
        };
      }
    }
  } finally {
    progress.cleanup();
  }

  return {
    text: '',
    agents: progress.agents(),
    tokenUsage: {},
    meta: { coordinationMode: analysis.coordinationMode, analysis },
  };
};
