import { AGENT_STATUS_COLORS, getAgentMeta, getPipelinePhases } from '../registry/agentRegistry';
import { getModelDisplayName } from '../api/providers.service';

export const createProgressTracker = (agentConfigs, onStateChange) => {
  const phases = getPipelinePhases();
  const allRoles = [...new Set(phases.flatMap((p) => p.agents))];

  let agents = allRoles.map((role) => {
    const meta = getAgentMeta(role);
    const config = agentConfigs[role] || {};
    return {
      role,
      name: config.name || role.charAt(0).toUpperCase() + role.slice(1),
      model: getModelDisplayName(config, meta.defaultDisplayName),
      progress: 0,
      status: 'queued',
      statusColor: '#555566',
    };
  });

  const intervals = {};
  const lastNotifiedProgress = {};

  const notify = () => {
    onStateChange([...agents]);
  };

  const updateAgent = (role, updates) => {
    const idx = agents.findIndex((a) => a.role === role);
    if (idx !== -1) agents[idx] = { ...agents[idx], ...updates };
    return agents;
  };

  const startProgressTimer = (role, limit = 78) => {
    if (intervals[role]) clearInterval(intervals[role]);

    const startTime = Date.now();
    // tau controls how quickly the simulated bar climbs.
    // 28 000 ms means the bar reaches ~63 % of its headroom after 28 s,
    // and ~86 % after 60 s — matching realistic large-prompt response times.
    // The hard cap (limit) is set to 78 so there is always visible headroom
    // between the simulated bar and 100 %, preventing a long "frozen at 85 %" look.
    const tau = 28_000;

    updateAgent(role, { progress: 5 });
    lastNotifiedProgress[role] = 5;
    notify();

    intervals[role] = setInterval(() => {
      const idx = agents.findIndex((a) => a.role === role);
      if (idx === -1) return;
      const agent = agents[idx];
      if (['done', 'error', 'exhausted'].includes(agent.status)) return;

      const elapsed = Date.now() - startTime;
      const currentProgress = Math.min(
        limit,
        Math.round(5 + (limit - 5) * (1 - Math.exp(-elapsed / tau)))
      );
      if (currentProgress === lastNotifiedProgress[role]) return;

      lastNotifiedProgress[role] = currentProgress;
      updateAgent(role, { progress: currentProgress });
      notify();
    }, 350);
  };

  const stopProgressTimer = (role) => {
    if (intervals[role]) {
      clearInterval(intervals[role]);
      delete intervals[role];
    }
  };

  const markActive = (role) => {
    const meta = getAgentMeta(role);
    updateAgent(role, {
      status: meta.activeStatus,
      statusColor: AGENT_STATUS_COLORS[role] || AGENT_STATUS_COLORS.reasoner,
    });
    startProgressTimer(role);
    notify();
  };

  const markDone = (role, usage) => {
    stopProgressTimer(role);
    updateAgent(role, { progress: 100, status: 'done', statusColor: AGENT_STATUS_COLORS.done });
    notify();
    return usage;
  };

  // Called from the streaming path with each new token batch.
  // Advances the bar proportionally to chars received vs. an expected ceiling,
  // but never goes past 92 % (leaves room for the final markDone jump to 100 %).
  // This keeps the bar visibly moving on large real-streamed responses and
  // prevents the "frozen at 78 %" look when the simulated timer has reached its limit.
  const streamProgress = (role, charsReceived, expectedChars = 4000) => {
    const idx = agents.findIndex((a) => a.role === role);
    if (idx === -1) return;
    const agent = agents[idx];
    if (['done', 'error', 'exhausted'].includes(agent.status)) return;

    const current = agent.progress || 0;
    // Map chars received → 10–92 % range, capped so it never overshoots
    const target = Math.min(92, Math.round(10 + 82 * Math.min(charsReceived / expectedChars, 1)));
    if (target <= current) return; // only advance, never go back

    updateAgent(role, { progress: target });
    notify();
  };

  const markFailed = (role, err, isExhausted) => {
    stopProgressTimer(role);
    updateAgent(role, {
      progress: 100,
      status: isExhausted ? 'exhausted' : 'error',
      statusColor: isExhausted ? AGENT_STATUS_COLORS.exhausted : AGENT_STATUS_COLORS.error,
    });
    notify();
    return err;
  };

  // Called when the stream failed but a blocking retry is about to start.
  // Keeps the agent visually "working" so the UI never flickers to Failed
  // and back to Complete within the same pipeline run.
  const markRetrying = (role) => {
    stopProgressTimer(role);
    const meta = getAgentMeta(role);
    const idx = agents.findIndex((a) => a.role === role);
    const currentProgress = idx !== -1 ? (agents[idx].progress || 0) : 0;

    updateAgent(role, {
      status: meta.activeStatus,
      statusColor: AGENT_STATUS_COLORS[role] || AGENT_STATUS_COLORS.reasoner,
      // keep progress exactly where it was — no jump backwards or to 100 %
    });

    // Resume a simulated timer that starts from the current position
    // and continues climbing toward 92 % for the duration of the retry call.
    if (intervals[role]) clearInterval(intervals[role]);
    const startTime = Date.now();
    const tau = 28_000;
    lastNotifiedProgress[role] = currentProgress;

    intervals[role] = setInterval(() => {
      const i = agents.findIndex((a) => a.role === role);
      if (i === -1) return;
      const agent = agents[i];
      if (['done', 'error', 'exhausted'].includes(agent.status)) return;

      const elapsed = Date.now() - startTime;
      const next = Math.min(
        92,
        Math.round(currentProgress + (92 - currentProgress) * (1 - Math.exp(-elapsed / tau)))
      );
      if (next === lastNotifiedProgress[role]) return;
      lastNotifiedProgress[role] = next;
      updateAgent(role, { progress: next });
      notify();
    }, 350);

    notify();
  };

  const cleanup = () => {
    Object.keys(intervals).forEach((key) => {
      clearInterval(intervals[key]);
      delete intervals[key];
    });
  };

  return {
    agents: () => [...agents],
    notify,
    markActive,
    markDone,
    markFailed,
    markRetrying,
    streamProgress,
    stopProgressTimer,
    cleanup,
  };
};
