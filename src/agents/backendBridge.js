/**
 * backendBridge.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single entry point for all orchestration calls.
 *
 * Strategy:
 *   1. POST to the Railway backend /orchestrate endpoint — no timeout, waits
 *      indefinitely for the server to respond.
 *   2. Only falls back to the local runAgentsOrchestrator() on a non-200
 *      response or a network error — never because of a timeout.
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
  onStreamDelta       = null,   // { text, filename } | null — user document upload
  documentContext     = null,   // { text, filename } | null — user document upload
  sessionId           = null,   // opaque session key for conversation memory
  conversationContext = null,   // pre-built plain-text context (last 3 msgs) for local writer
) => {
  // ── Dev toggle: skip backend when forceLocal is set ──────────────────────
  if (_forceLocal) {
    return runAgentsOrchestrator(
      userText, agentConfigs, onStateChange, signal,
      persona, userProfile, onSocketStatusChange, onStreamDelta,
      documentContext, sessionId, conversationContext
    );
  }

  // ── Attempt backend ───────────────────────────────────────────────────────
  if (BACKEND_URL) {
    // Progress-bar interval — declared outside try/catch so the catch block
    // can always reference it (Hermes does not expose try-block `const`s to
    // the sibling catch block).
    const _progressTimer = { id: null };

    try {
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

          onStateChange(
            _buildAgents((role, meta) => meta.activeStatus || 'working', () => 5),
            { coordinationMode: 'full' }
          );

          _progressTimer.id = setInterval(() => {
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

      console.log('[BackendBridge] documentContext being sent:', documentContext != null, 'chars:', documentContext?.text?.length ?? 0);
      const _t0 = Date.now();
      const response = await fetch(`${BACKEND_URL}/orchestrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query:           userText,
            agentConfigs,
            team:            activeTeam,
            persona,
            userProfile,
            searchResults:   _searchResults,
            documentContext,
            sessionId,       // conversation memory session key
          }),
        signal: signal ?? undefined,   // only the user's Stop signal; no timeout
      });

      _progressTimer.cleared = true;
      clearInterval(_progressTimer.id);

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
      // Network error or any other fetch failure → fall through to local
      // fallback silently.
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
    onStreamDelta,
    documentContext,
    sessionId,
    conversationContext
  );
};

