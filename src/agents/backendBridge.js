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

// ── Backend endpoint ──────────────────────────────────────────────────────────
// Set to the Railway deployment URL once available. Leave as an empty string
// or null to skip the backend attempt entirely and always use local fallback.
const BACKEND_URL = 'https://zyron-production-7af1.up.railway.app';

// Milliseconds to wait for the backend before giving up and falling back.
const BACKEND_TIMEOUT_MS = 30000;

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

      // Progress-bar interval — hoisted so the catch block can always clear it.
      let _progressIntervalId = null;

      if (hasStateCallback) {
        // ── Phase 1: PENDING — show all agents queued at 0 % ─────────────────
        onStateChange(
          _buildAgents(() => 'queued', () => 0),
          { coordinationMode: 'full' }
        );

        // ── Phase 2: WORKING — transition to animated bars after one frame ───
        setTimeout(() => {
          const _startMs = Date.now();
          const _tau     = 28_000;
          const _limit   = 78;
          let   _lastPct = 5;

          onStateChange(
            _buildAgents((role, meta) => meta.activeStatus || 'working', () => 5),
            { coordinationMode: 'full' }
          );

          _progressIntervalId = setInterval(() => {
            const elapsed = Date.now() - _startMs;
            const next    = Math.min(_limit, Math.round(5 + (_limit - 5) * (1 - Math.exp(-elapsed / _tau))));
            if (next === _lastPct) return;
            _lastPct = next;
            onStateChange(
              _buildAgents((role, meta) => meta.activeStatus || 'working', () => next),
              { coordinationMode: 'full' }
            );
          }, 350);
        }, 0);
      }

      const _t0 = Date.now();
      const response = await fetch(`${BACKEND_URL}/orchestrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userText,
          agentConfigs,
          team: activeTeam,
          persona,
          userProfile,
        }),
        signal: combinedSignal,
      });

      clearInterval(_progressIntervalId);
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const _elapsed = Date.now() - _t0;
        console.log(`[Zyron Backend] ✅ Backend response received in ${_elapsed}ms`);

        if (hasStateCallback) {
          // Mark all agents done simultaneously so every progress bar jumps to
          // 100 % and the status badge flips to "Complete".
          onStateChange(
            _buildAgents(() => 'done', () => 100).map((a) => ({
              ...a,
              statusColor: AGENT_STATUS_COLORS.done,
            })),
            { coordinationMode: 'full' }
          );
        }

        if (Array.isArray(data.agents)) {
          data.agents.forEach((a) => {
            console.log(`[Zyron Backend] 👤 ${a.name} → ${(a.output ?? '').length} chars`);
          });
        }
        // Remap agents to the active team's UI metadata (name, icon, colours)
        // so the coordination panel reflects the correct team — not the backend default.
        return {
          ...data,
          agents: remapAgentsToActiveTeam(data.agents, activeTeam, agentConfigs),
        };
      }
      // Non-200 → fall through to local fallback silently

    } catch (e) {
      // Network error, timeout (AbortError), or any other fetch failure →
      // fall through to local fallback silently.
      // Re-throw only if the caller explicitly cancelled (user pressed Stop).
      clearInterval(_progressIntervalId);
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
