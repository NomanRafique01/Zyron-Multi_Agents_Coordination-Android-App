/**
 * Central agent registry — add roles, metadata, and pipeline placement here.
 * User API keys still live in appConfig DEFAULT_AGENT_CONFIGS.
 */

export const AGENT_STATUS_COLORS = {
  reasoner: '#A78BFA',
  coder: '#60A5FA',
  vision: '#6EE7B7',
  writer: '#FBBF24',
  done: '#6EE7B7',
  error: '#F97316',
  exhausted: '#F59E0B',
};

export const AGENT_UI_META = {
  reasoner: {
    icon: '🧠',
    accent: '#A78BFA',
    accentDim: 'rgba(167, 139, 250, 0.12)',
    accentGlow: 'rgba(167, 139, 250, 0.35)',
    defaultDisplayName: 'Nemotron Super',
    activeStatus: 'thinking',
    activeLabel: 'Reasoning...',
  },
  coder: {
    icon: '⚡',
    accent: '#60A5FA',
    accentDim: 'rgba(96, 165, 250, 0.12)',
    accentGlow: 'rgba(96, 165, 250, 0.35)',
    defaultDisplayName: 'Cohere Code',
    activeStatus: 'working',
    activeLabel: 'Analyzing...',
  },
  vision: {
    icon: '👁',
    accent: '#6EE7B7',
    accentDim: 'rgba(110, 231, 183, 0.12)',
    accentGlow: 'rgba(110, 231, 183, 0.35)',
    defaultDisplayName: 'Nemotron Nano',
    activeStatus: 'structuring',
    activeLabel: 'Structuring...',
  },
  writer: {
    icon: '✍️',
    accent: '#FBBF24',
    accentDim: 'rgba(251, 191, 36, 0.12)',
    accentGlow: 'rgba(251, 191, 36, 0.35)',
    defaultDisplayName: 'Mistral Writer',
    activeStatus: 'formatting',
    activeLabel: 'Polishing...',
  },
};

/** Contribution lens — what each agent adds even when not writing code */
export const AGENT_CONTRIBUTION_LENSES = {
  reasoner: 'first-principles reasoning, chain-of-thought decomposition, assumption auditing, failure taxonomy, and architectural decision records',
  coder: 'complete production-grade implementation with typed interfaces, exhaustive error handling, complexity analysis, and zero-placeholder policy',
  vision: 'adversarial stress-testing, red-team security analysis, cognitive load optimization, and output quality assurance through structured critique',
  writer: 'high-fidelity synthesis that preserves every specialist angle, eliminates redundancy, and delivers one authoritative, structurally perfect final answer',
};

/**
 * Pipeline phases — specialists run in parallel, writer synthesizes after.
 * To add an agent: register it below and add to a phase.
 */
export const PIPELINE_PHASES = [
  {
    id: 'specialists',
    parallel: true,
    agents: ['reasoner', 'coder', 'vision'],
  },
  {
    id: 'synthesis',
    parallel: false,
    agents: ['writer'],
  },
];

const _customAgents = {};
const _integrations = {};

export const getRegisteredAgentRoles = () => {
  const base = new Set();
  PIPELINE_PHASES.forEach((phase) => phase.agents.forEach((r) => base.add(r)));
  Object.keys(_customAgents).forEach((r) => base.add(r));
  return [...base];
};

export const getAgentMeta = (role) => ({
  ...(AGENT_UI_META[role] || AGENT_UI_META.reasoner),
  contributionLens: AGENT_CONTRIBUTION_LENSES[role] || 'specialist insight',
  ..._customAgents[role],
});

/**
 * Apply active team metadata to runtime registry (icons, colors, lenses).
 */
export const applyTeamToRegistry = (team) => {
  if (!team?.agents) return;
  Object.keys(team.agents).forEach((role) => {
    const agent = team.agents[role];
    if (!agent) return;

    AGENT_UI_META[role] = {
      icon: agent.icon,
      accent: agent.accent,
      accentDim: agent.accentDim,
      accentGlow: agent.accentGlow,
      defaultDisplayName: agent.name,
      activeStatus: agent.activeStatus,
      activeLabel: agent.activeLabel,
    };
    AGENT_CONTRIBUTION_LENSES[role] = agent.contributionLens;
    _customAgents[role] = {
      specialistDirective: agent.specialistDirective,
      socketLabel: agent.socketLabel,
    };
  });
};

/**
 * Register a new agent role at runtime (for future teams / plugins).
 * @param {string} role
 * @param {object} definition — { icon, accent, contributionLens, phaseId, defaultDisplayName, activeStatus, activeLabel }
 */
export const registerAgent = (role, definition = {}) => {
  _customAgents[role] = definition;
  if (definition.contributionLens) {
    AGENT_CONTRIBUTION_LENSES[role] = definition.contributionLens;
  }
  if (definition.ui) {
    AGENT_UI_META[role] = { ...AGENT_UI_META.reasoner, ...definition.ui };
  }
  if (definition.phaseId && definition.insertInPhase !== false) {
    const phase = PIPELINE_PHASES.find((p) => p.id === definition.phaseId);
    if (phase && !phase.agents.includes(role)) {
      phase.agents.push(role);
    }
  }
};

/**
 * Register external integration metadata (webhooks, tools, etc.)
 */
export const registerIntegration = (integrationId, config = {}) => {
  _integrations[integrationId] = config;
};

export const getIntegrations = () => ({ ..._integrations });

export const getPipelinePhases = () => PIPELINE_PHASES;
