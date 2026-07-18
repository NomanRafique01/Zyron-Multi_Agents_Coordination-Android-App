/**
 * src/agents/tools/toolRegistry.js
 *
 * Declarative tool permission registry.
 * Each team file declares which roles get which tools.
 * Orchestrator reads this before running agents and injects tool results.
 *
 * Tool IDs:
 *   'code_executor'  — sandboxed JS/expression evaluation (codeExecutor.js)
 *
 * Registration happens at startup when a team is activated.
 * Default: all roles have no tools.
 */

// role → Set<toolId>
const _permissions = {
  reasoner: new Set(),
  coder:    new Set(),
  vision:   new Set(),
  writer:   new Set(),
};

/**
 * Grant a tool to a role.
 * @param {string} role
 * @param {string} toolId
 */
export const grantTool = (role, toolId) => {
  if (!_permissions[role]) _permissions[role] = new Set();
  _permissions[role].add(toolId);
};

/**
 * Revoke a tool from a role.
 */
export const revokeTool = (role, toolId) => {
  _permissions[role]?.delete(toolId);
};

/**
 * Apply tool grants from a team definition.
 * Expects team.toolPermissions: { [role]: string[] }
 *
 * @param {object} team
 */
export const applyTeamToolPermissions = (team) => {
  // Reset to no tools first
  Object.keys(_permissions).forEach((r) => _permissions[r].clear());

  const perms = team?.toolPermissions;
  if (!perms) return;

  Object.entries(perms).forEach(([role, tools]) => {
    (tools || []).forEach((toolId) => grantTool(role, toolId));
  });
};

/**
 * Check if a role has been granted a tool.
 */
export const hasTool = (role, toolId) =>
  !!_permissions[role]?.has(toolId);

/**
 * List all tool IDs granted to a role.
 */
export const getToolsForRole = (role) =>
  [...(_permissions[role] ?? [])];
