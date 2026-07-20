/**
 * backendBridge.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single entry point for all orchestration calls.
 *
 * Strategy:
 *   1. POST to the Railway backend /orchestrate endpoint (8-second timeout).
 *   2. On any failure — timeout, non-200, network error — fall back silently
 *      to the local runAgentsOrchestrator() without surfacing anything to the UI.
 *
 * Usage:
 *   Replace runAgentsOrchestrator() / runAgentsPipeline() call-sites with:
 *     import { runOrchestration } from './backendBridge';
 *
 * Swap BACKEND_URL below when the Railway service URL is available.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { runAgentsOrchestrator } from './orchestrator';
import { getActiveTeam } from './teams/teamRuntime';
import { getTeamRoleInfo } from './teams';
import { getAgentMeta, AGENT_STATUS_COLORS } from './registry/agentRegistry';
import { getModelDisplayName } from './api/providers.service';
import { runWebSearch } from './search/webSearch';
import { analyzeQuery } from './analysis/queryAnalyzer';

// ── Backend endpoint ──────────────────────────────────────────────────────────
// Set to the Railway deployment URL once available. Leave as an empty string
// or null to skip the backend attempt entirely and always use local fallback.
const BACKEND_URL = 'https://zyron-production-7af1.up.railway.app';

// Milliseconds to wait for the backend before giving up and falling back.
const BACKEND_TIMEOUT_MS = 30000;

// ── DEV TEST TOGGLE — remove when no longer needed ───────────────────────────
// When true, skip the backend entirely and run local orchestration directly.
// Flipped by the header toggle in Header.component.jsx.
let _forceLocal = false;
export const getForceLocal = () => _forceLocal;
export const setForceLocal = (v) => { _forceLocal = v; };

// ─────────────────────────────────────────────────────────────────────────────

/**
 * runOrchestration
 *
 * Drop-in replacement for runAgentsOrchestrator(). Accepts identical arguments,
 * tries the backend first, and falls back to the local orchestrator silently.
 *
 * @param {string}      userText
 * @param {object}      agentConfigs
 * @param {function}    onStateChange        — (agents[], meta) => void
 * @param {AbortSignal} signal
 * @param {string}      persona
 * @param {object}      userProfile
 * @param {function}    onSocketStatusChange — (role, status, msg) => void
 * @param {function}    [onStreamDelta]      — (role, chunk) => void
 * @returns {Promise<object>}  Same shape as runAgentsOrchestrator result
 */

/**
 * Remaps the `agents` array returned by the backend so every entry carries
 * the display metadata (name, icon, accent colours) of the *active* team
 * rather than whatever team the backend resolved internally.
 *
 * The backend drives the prompt/logic side; the frontend owns the visual identity.
 *
 * @param {object[]} backendAgents  — agents[] from the backend response
 * @param {object}   team           — result of getActiveTeam()
 * @returns {object[]}
 */
function remapAgentsToActiveTeam(backendAgents, team, agentConfigs = {}) {
  if (!backendAgents?.length || !team?.agents) return backendAgents ?? [];
  const roleInfo = getTeamRoleInfo(team);
  return backendAgents.map((agent) => {
    const meta = roleInfo[agent.role];
    const agentMeta = getAgentMeta(agent.role);
    const config = agentConfigs[agent.role] || {};
    if (!meta) return {
      ...agent,
      model: getModelDisplayName(config, agentMeta?.defaultDisplayName || agent.role),
      progress: 100,
      status: 'done',
      statusColor: AGENT_STATUS_COLORS.done,
    };
    const teamAgent = team.agents[agent.role];
    return {
      ...agent,
      name: meta.name,
      icon: meta.icon,
      accent: teamAgent?.accent ?? agent.accent,
      accentDim: teamAgent?.accentDim ?? agent.accentDim,
      accentGlow: teamAgent?.accentGlow ?? agent.accentGlow,
      model: getModelDisplayName(config, agentMeta?.defaultDisplayName || agent.role),
      // Always mark agents as fully complete so the coordination panel in the
      // stored message shows filled progress bars and "DONE" badges — matching
      // the local-orchestrator behaviour.
      progress: 100,
      status: 'done',
      statusColor: AGENT_STATUS_COLORS.done,
    };
  });
}

export const runOrchestration = async (
  userText,
  agentConfigs,
  onStateChange,
  signal,
  persona,
  userProfile,
  onSocketStatusChange,
  onStreamDelta = null
) => {
  // ── Dev toggle: skip backend when forceLocal is set ──────────────────────
  if (_forceLocal) {
    return runAgentsOrchestrator(
      userText, agentConfigs, onStateChange, signal,
      persona, userProfile, onSocketStatusChange, onStreamDelta
    );
  }

  // ── Attempt backend ───────────────────────────────────────────────────────
  if (BACKEND_URL) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[Zyron Backend] ⏱️ Request timed out — switching to local engine');
        controller.abort();
      }, BACKEND_TIMEOUT_MS);

      // Combine the caller's abort signal with our timeout signal so either
      // one cancels the fetch cleanly.
      const combinedSignal = signal
        ? anyAbort([signal, controller.signal])
        : controller.signal;

      console.log('[Zyron Backend] ⚡ Routing to Railway orchestration engine...');
      const activeTeam = getActiveTeam();

      // ── Drive coordination panel while backend is in-flight ────────────────
      // Step 1: emit all 4 active-team agents in PENDING/queued state so the
      //         panel appears immediately with the correct names and no progress.
      // Step 2: one tick later, transition all to their animated "working" status
      //         and start the exponential-approach progress timer (same curve as
      //         the local progressTracker: tau=28 000 ms, hard cap at 78 %).
      // Step 3: on response, instantly complete all bars to 100 % + mark DONE.
      const ROLES = ['reasoner', 'coder', 'vision', 'writer'];
      const hasStateCallback = typeof onStateChange === 'function';

      // Build agent lists from the active team so names/models are correct.
      const _buildAgents = (statusFn, progressFn) =>
        ROLES.map((role) => {
          const meta   = getAgentMeta(role);
          const config = agentConfigs[role] || {};
          const status = statusFn(role, meta);
          return {
            role,
            name:        config.name || meta.defaultDisplayName || role,
            model:       getModelDisplayName(config, meta.defaultDisplayName || role),
            progress:    progressFn(role),
            status,
            statusColor: status === 'queued'
              ? '#555566'
              : AGENT_STATUS_COLORS[role] || AGENT_STATUS_COLORS.reasoner,
          };
        });

      // Progress-bar interval — stored on an object so the catch block and the
      // success path can always clear it, even when it was assigned asynchronously
      // inside the setTimeout below.
      const _progressTimer = { id: null };
      // Shared progress percentage — written by the interval, read by the
      // agent_done SSE handler to know what value to show for still-working agents.
      let _lastProgressPct = 5;

      if (hasStateCallback) {
        // ── Phase 1: PENDING — show all agents queued at 0 % ─────────────────
        onStateChange(
          _buildAgents(() => 'queued', () => 0),
          { coordinationMode: 'full' }
        );

        // ── Phase 2: WORKING — transition to animated bars after one frame ───
        // The setTimeout gives React one tick to render the queued state before
        // we start the exponential-approach animation.
        setTimeout(() => {
          // Guard: if the response already arrived before this timeout fired,
          // the interval would be cleared immediately after being set.  Skip
          // starting it entirely to avoid a stale "working" tick overwriting
          // the "done" state the success path already emitted.
          if (_progressTimer.cleared) return;

          const _startMs = Date.now();
          const _tau     = 28_000;
          const _limit   = 78;
          let   _lastPct = 5;
          _lastProgressPct = 5;

          onStateChange(
            _buildAgents((role, meta) => meta.activeStatus || 'working', () => 5),
            { coordinationMode: 'full' }
          );

          _progressTimer.id = setInterval(() => {
            const elapsed = Date.now() - _startMs;
            const next    = Math.min(_limit, Math.round(5 + (_limit - 5) * (1 - Math.exp(-elapsed / _tau))));
            if (next === _lastPct) return;
            _lastPct = next;
            _lastProgressPct = next;
            onStateChange(
              _buildAgents((role, meta) => meta.activeStatus || 'working', () => next),
              { coordinationMode: 'full' }
            );
          }, 350);
        }, 0);
      }

      // ── Web search before backend call ────────────────────────────────────
      // Run analysis to detect if this query needs real-time data, then
      // kick off the search so results are ready to send to the backend.
      // The backend also runs search independently; sending the result here
      // lets it skip a redundant round-trip if it already has data.
      const _analysis = analyzeQuery(userText);
      let _searchResults = null;
      if (_analysis.needsWebSearch && _analysis.webSearchQuery) {
        _searchResults = await runWebSearch(_analysis.webSearchQuery).catch(() => null);
      }

      const _t0 = Date.now();
      const response = await fetch(`${BACKEND_URL}/orchestrate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userText,
          agentConfigs,
          team: activeTeam,
          persona,
          userProfile,
          searchResults: _searchResults,
        }),
        signal: combinedSignal,
      });

      _progressTimer.cleared = true;
      clearInterval(_progressTimer.id);
      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`[Zyron Backend] ✅ SSE stream opened (${Date.now() - _t0}ms to first byte)`);

        // ── SSE stream reader ──────────────────────────────────────────────
        // Read the response body as a UTF-8 text stream, splitting on the
        // SSE line-framing (`data: {...}\n\n`) and dispatching each event.
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        // Accumulated state built up as SSE events arrive.
        let _streamedText = '';
        const _specialistResults = [];  // agent_done events accumulate here

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done: readerDone } = await reader.read();
          if (readerDone) break;

          buffer += decoder.decode(value, { stream: true });

          // Split on SSE message boundaries (\n\n).
          const parts = buffer.split('\n\n');
          // The last element may be an incomplete chunk — keep it in the buffer.
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            // Each SSE message may span multiple lines; find the data: line.
            const dataLine = part.split('\n').find((l) => l.startsWith('data:'));
            if (!dataLine) continue;

            let event;
            try {
              event = JSON.parse(dataLine.slice(5).trim());
            } catch {
              continue;
            }

            if (event.type === 'token' && event.role === 'writer') {
              // ── Writer token: forward to the streaming UI ──────────────
              _streamedText += event.chunk;
              onStreamDelta?.('writer', event.chunk);

            } else if (event.type === 'agent_done') {
              // ── Specialist finished: update its progress bar to 100 % ──
              _specialistResults.push({
                role:   event.role,
                name:   event.name,
                output: event.text,
                status: 'done',
                progress: 100,
                statusColor: AGENT_STATUS_COLORS.done,
              });

              if (hasStateCallback) {
                // Build a fresh agent list: done specialists at 100 %,
                // writer still working.
                const doneRoles = new Set(_specialistResults.map((r) => r.role));
                onStateChange(
                  _buildAgents(
                    (role, meta) => doneRoles.has(role)
                      ? 'done'
                      : role === 'writer'
                        ? (meta.activeStatus || 'working')
                        : (meta.activeStatus || 'working'),
                    (role) => doneRoles.has(role) ? 100 : _lastProgressPct,
                  ).map((a) => ({
                    ...a,
                    statusColor: a.status === 'done'
                      ? AGENT_STATUS_COLORS.done
                      : a.statusColor,
                  })),
                  { coordinationMode: 'full' }
                );
              }

            } else if (event.type === 'done') {
              // ── Terminal event: assemble the final result ──────────────
              const _elapsed = Date.now() - _t0;
              console.log(`[Zyron Backend] ✅ Stream complete in ${_elapsed}ms`);

              if (hasStateCallback) {
                onStateChange(
                  _buildAgents(() => 'done', () => 100).map((a) => ({
                    ...a,
                    statusColor: AGENT_STATUS_COLORS.done,
                  })),
                  { coordinationMode: 'full' }
                );
              }

              if (Array.isArray(event.agents)) {
                event.agents.forEach((a) => {
                  console.log(`[Zyron Backend] 👤 ${a.name} → ${(a.output ?? '').length} chars`);
                });
              }

              return {
                text:       _streamedText || '',
                agents:     remapAgentsToActiveTeam(event.agents ?? [], activeTeam, agentConfigs),
                tokenUsage: event.tokenUsage ?? {},
                meta:       { web_search_used: event.webSearchUsed ?? false },
              };

            } else if (event.type === 'error') {
              console.error(`[Zyron Backend] ❌ Stream error: ${event.message}`);
              // Fall through to local fallback below by throwing out of the read loop.
              throw new Error(`Backend stream error: ${event.message}`);
            }
          }
        }

        // Stream ended without a 'done' event — treat as a backend failure
        // and fall through to the local fallback.
        console.warn('[Zyron Backend] Stream ended without done event — falling back');
      }
      // Non-200 or no done event → fall through to local fallback silently

    } catch (e) {
      // Network error, timeout (AbortError), or any other fetch failure →
      // fall through to local fallback silently.
      // Re-throw only if the caller explicitly cancelled (user pressed Stop).
      _progressTimer.cleared = true;
      clearInterval(_progressTimer.id);
      if (signal?.aborted) throw new Error('Aborted');
      console.log('[Zyron Backend] ❌ Backend unavailable — switching to local engine');
    }
  }

  // ── Local fallback ────────────────────────────────────────────────────────
  return runAgentsOrchestrator(
    userText,
    agentConfigs,
    onStateChange,
    signal,
    persona,
    userProfile,
    onSocketStatusChange,
    onStreamDelta
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns an AbortSignal that aborts as soon as ANY of the supplied signals
 * fires. Polyfills AbortSignal.any() for environments that don't have it.
 *
 * @param {AbortSignal[]} signals
 * @returns {AbortSignal}
 */
function anyAbort(signals) {
  if (typeof AbortSignal?.any === 'function') {
    return AbortSignal.any(signals);
  }
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) { controller.abort(); break; }
    s.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}
