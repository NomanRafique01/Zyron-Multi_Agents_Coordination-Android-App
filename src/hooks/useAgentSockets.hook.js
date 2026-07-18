/**
 * useAgentSockets.hook.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Agent socket (API configuration) management for Zyron.
 *
 * Owns all state and logic related to agent socket configuration:
 *   • Loading / saving agentConfigs from SecureStore (with AsyncStorage migration)
 *   • Handling per-agent field updates (name, provider, model, key)
 *   • Verifying and saving API keys
 *   • Toggling agent active/inactive
 *   • Key sharing / link management between agent sockets
 *   • Deleting individual or all API keys
 *   • Engine Live toggle (all agents active at once)
 *   • Deactivating all agents
 *   • Team selection (active team + apply team names to configs)
 *
 * Returns all agent socket handlers and state.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { LayoutAnimation } from 'react-native';
import {
  verifyAgentKey,
  validateApiKeyFormat,
  sanitizeErrorMessage,
  isKeyExhaustedError,
  ACTIVE_TEAM_STORAGE_KEY,
  applyTeamNamesToConfigs,
  initActiveTeam,
  setActiveTeamById,
  getActiveTeam,
  DEFAULT_TEAM_ID,
} from '../utils/agentLogic.utils';
import {
  DEFAULT_AGENT_CONFIGS,
  normalizeAgentConfigs,
  PROVIDER_DEFAULT_MODELS,
} from '../config/appConfig';

/**
 * useAgentSockets
 *
 * @param {object} params
 * @param {function} params.showToast         — from useToast
 * @param {function} params.showConfirmDialog — from parent
 * @param {boolean}  params.isEngineLive      — coordination active flag
 * @param {function} params.setIsEngineLive   — state setter
 */
export default function useAgentSockets({
  showToast,
  showConfirmDialog,
  isEngineLive,
  setIsEngineLive,
}) {
  const [agentConfigs, setAgentConfigs] = useState(DEFAULT_AGENT_CONFIGS);
  const [activeTeamId, setActiveTeamId] = useState(DEFAULT_TEAM_ID);
  const [expandedAgent, setExpandedAgent] = useState(null); // 'reasoner' | 'coder' | 'vision' | 'writer' | null
  const [verifyingRole, setVerifyingRole] = useState(null);
  const [verificationResult, setVerificationResult] = useState({ role: null, success: null, message: '' });
  const [pendingShareTargets, setPendingShareTargets] = useState({});
  const [expandedTeamId, setExpandedTeamId] = useState(null);

  // ── Utility: get role display name ──────────────────────────────────────
  const getAgentRoleNumberName = (role) => {
    switch (role) {
      case 'reasoner': return 'Agent 1';
      case 'coder': return 'Agent 2';
      case 'vision': return 'Agent 3';
      case 'writer': return 'Agent 4';
      default: return 'Agent';
    }
  };

  // ── Utility: find which role is syncing its key TO the given role ────────
  const getSyncedKeySource = (role) => {
    for (const r of ['reasoner', 'coder', 'vision', 'writer']) {
      if (agentConfigs[r] && agentConfigs[r].shareKeyWith === role) {
        return r;
      }
    }
    return null;
  };

  // ── Utility: check if a link is allowed between two roles ───────────────
  const getAgentLinkAvailability = (sourceRole, targetRole) => {
    if (!targetRole) return { available: true, reason: '' };
    if (targetRole === sourceRole) {
      return { available: false, reason: 'An agent cannot link to itself.' };
    }

    const sourceConfig = agentConfigs[sourceRole];
    if (!sourceConfig || !sourceConfig.key || !sourceConfig.key.trim() || !sourceConfig.verified) {
      return { available: false, reason: 'Verify and save an API key first.' };
    }

    const targetConfig = agentConfigs[targetRole];
    if (!targetConfig) {
      return { available: false, reason: 'Agent unavailable.' };
    }

    const currentTarget = agentConfigs[sourceRole]?.shareKeyWith;
    const isCurrentTarget = currentTarget === targetRole;
    if (isCurrentTarget) return { available: true, reason: '' };
    if (currentTarget) {
      return { available: false, reason: `${getAgentRoleNumberName(sourceRole)} already linked to ${getAgentRoleNumberName(currentTarget)}.` };
    }

    const targetSource = getSyncedKeySource(targetRole);
    if (targetSource) {
      return { available: false, reason: `${getAgentRoleNumberName(targetRole)} already linked to ${getAgentRoleNumberName(targetSource)}.` };
    }

    if (targetConfig.shareKeyWith) {
      return { available: false, reason: `${getAgentRoleNumberName(targetRole)} already sharing with ${getAgentRoleNumberName(targetConfig.shareKeyWith)}.` };
    }

    if (targetConfig.active) {
      return { available: false, reason: `${getAgentRoleNumberName(targetRole)} is active.` };
    }

    if (targetConfig.verified || (targetConfig.key && targetConfig.key.trim().length > 0)) {
      return { available: false, reason: `${getAgentRoleNumberName(targetRole)} already has a saved key.` };
    }

    return { available: true, reason: '' };
  };

  // ── Show a lock banner as a toast (re-uses showToast for simplicity) ─────
  const showSocketLockBanner = (_role, title, message) => {
    showToast(title, message, 'info');
  };

  // ── Load agent configs from SecureStore (migrating from AsyncStorage) ────
  const loadAgentConfigsFromStorage = async () => {
    try {
      let parsed = null;
      let shouldRemoveLegacyConfigs = false;
      const storedConfigs = await SecureStore.getItemAsync('zyron_AGENT_CONFIGS');
      if (storedConfigs) {
        parsed = JSON.parse(storedConfigs);
      } else {
        // Migration: check if old AsyncStorage data exists and migrate it
        const legacyConfigs = await AsyncStorage.getItem('zyron_AGENT_CONFIGS');
        if (legacyConfigs) {
          parsed = JSON.parse(legacyConfigs);
          shouldRemoveLegacyConfigs = true;
        }
      }

      if (parsed) {
        const normalized = normalizeAgentConfigs(parsed);
        const team = getActiveTeam();
        const withTeamNames = applyTeamNamesToConfigs(team, normalized);
        setAgentConfigs(withTeamNames);
        if (shouldRemoveLegacyConfigs || !storedConfigs) {
          await SecureStore.setItemAsync('zyron_AGENT_CONFIGS', JSON.stringify(withTeamNames));
        }
        if (shouldRemoveLegacyConfigs) {
          await AsyncStorage.removeItem('zyron_AGENT_CONFIGS');
        }
      } else {
        const team = getActiveTeam();
        setAgentConfigs(applyTeamNamesToConfigs(team, DEFAULT_AGENT_CONFIGS));
      }
    } catch (err) {
      console.warn('Error loading agent configs:', err);
    }
  };

  // ── Load active team from AsyncStorage ───────────────────────────────────
  const loadActiveTeamFromStorage = async () => {
    try {
      const storedTeamId = await AsyncStorage.getItem(ACTIVE_TEAM_STORAGE_KEY);
      if (storedTeamId) {
        // initActiveTeam sets _activeTeam AND calls applyTeamToRegistry,
        // so the registry (directives, lenses, icons) reflects the stored team
        // before any prompt is built. This is the authoritative bootstrap point.
        initActiveTeam(storedTeamId);
        setActiveTeamId(storedTeamId);
      } else {
        // No saved team — seed registry with Dev Core so getActiveTeam()
        // never returns a team whose directives haven't been applied yet.
        initActiveTeam(DEFAULT_TEAM_ID);
        setActiveTeamId(DEFAULT_TEAM_ID);
      }
    } catch (err) {
      console.warn('Error loading active team:', err);
      // Fallback: ensure registry is at least seeded with the default team
      initActiveTeam(DEFAULT_TEAM_ID);
      setActiveTeamId(DEFAULT_TEAM_ID);
    }
  };

  // ── Select / deactivate team ─────────────────────────────────────────────
  const handleSelectTeam = async (teamId, scrollTeamIntoView) => {
    if (teamId === activeTeamId) {
      // Deactivate — fall back to Dev Core so the registry is never left in
      // a stale state pointing at the old team's directives.
      initActiveTeam(DEFAULT_TEAM_ID);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandedTeamId(teamId);
      setActiveTeamId(DEFAULT_TEAM_ID);
      try {
        await AsyncStorage.removeItem(ACTIVE_TEAM_STORAGE_KEY);
      } catch (err) {
        console.warn('Error clearing active team:', err);
      }
      showToast('Team Deactivated', 'Team deactivated. No team is active.', 'info');
      scrollTeamIntoView(teamId, 180);
      return;
    }

    // setActiveTeamById → initActiveTeam → applyTeamToRegistry
    // This wires ALL of: _activeTeam, AGENT_UI_META, AGENT_CONTRIBUTION_LENSES,
    // _customAgents (specialistDirective, socketLabel) for the new team.
    const team = setActiveTeamById(teamId);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedTeamId(teamId);
    setActiveTeamId(teamId);

    // Apply new team's display names to the live agentConfigs state.
    // API keys, provider, model are preserved — only names update.
    const updatedConfigs = applyTeamNamesToConfigs(team, agentConfigs);
    setAgentConfigs(updatedConfigs);

    try {
      await AsyncStorage.setItem(ACTIVE_TEAM_STORAGE_KEY, teamId);
      await SecureStore.setItemAsync('zyron_AGENT_CONFIGS', JSON.stringify(updatedConfigs));
    } catch (err) {
      console.warn('Error saving active team:', err);
    }

    showToast('Team Activated', `${team.name} is now active.`, 'info');
    scrollTeamIntoView(teamId, 180);
  };

  // ── Update a single agent field ──────────────────────────────────────────
  const handleUpdateAgentField = async (role, field, value) => {
    if (isEngineLive) {
      showToast('Coordination Active', 'Pause coordination to update settings.', 'warning');
      return;
    }

    if (field === 'key' && agentConfigs[role]?.verified) {
      showSocketLockBanner(role, 'API Key Locked', 'Delete current key to edit or replace it.');
      return;
    }

    if (field === 'key' && getSyncedKeySource(role)) {
      showToast('Linked Agent', 'Key inherited from linked source.', 'info');
      return;
    }

    // Block provider or model changes while the API key is verified — the key is tied to
    // the current provider/model configuration. Prompt the user to delete the key first.
    if ((field === 'model' || field === 'provider') && agentConfigs[role]?.verified) {
      showToast(
        'Configuration Locked',
        'Delete the saved API key first, then switch provider or model and re-verify.'
      );
      return;
    }

    const providerModelUpdate = field === 'provider' ? { model: PROVIDER_DEFAULT_MODELS[value] || '' } : {};
    let updated = {
      ...agentConfigs,
      [role]: {
        ...agentConfigs[role],
        [field]: value,
        ...providerModelUpdate,
        ...((field === 'key' || field === 'model' || field === 'provider') ? { verified: false, keyStatus: agentConfigs[role].active ? 'unverified' : 'inactive', lastStatusMessage: '' } : {})
      }
    };

    // Key sharing sync - mirror key/model/provider; active state stays as-is (parent activate button controls it)
    const targetRole = updated[role].shareKeyWith;
    if (targetRole && updated[targetRole]) {
      updated[targetRole] = {
        ...updated[targetRole],
        key: updated[role].key,
        provider: updated[role].provider,
        model: updated[role].model,
        verified: updated[role].verified,
        keyStatus: updated[targetRole].active ? updated[role].keyStatus : 'inactive',
        lastStatusMessage: updated[role].lastStatusMessage
      };
    }

    setAgentConfigs(updated);
    try {
      await SecureStore.setItemAsync('zyron_AGENT_CONFIGS', JSON.stringify(updated));
    } catch (e) {
      console.warn('Error saving agent config field:', e);
    }
  };

  // ── Verify and save API key ──────────────────────────────────────────────
  const handleVerifyAndSaveAgent = async (role) => {
    if (isEngineLive) {
      showToast('Coordination Active', 'Pause coordination to verify this agent.', 'warning');
      return;
    }

    const config = agentConfigs[role];
    if (getSyncedKeySource(role)) {
      showToast('Linked Agent', 'Unlink agent to verify or save its key.', 'info');
      return;
    }

    if (config.verified) {
      showSocketLockBanner(role, 'Verify Locked', 'Delete saved key before verifying a new one.');
      return;
    }

    const quotaExceededMessage = 'This API key is saved, but the selected provider quota is currently exhausted. Add quota or billing, then retry, or switch to another key/model.';
    if (!config.key || !config.key.trim()) {
      showToast('No API Key', 'Enter an API key to verify.', 'warning');
      return;
    }

    // Pre-validate key format before making any API call
    const formatCheck = validateApiKeyFormat(config.provider, config.key);
    if (!formatCheck.valid) {
      showToast('Invalid Key', 'Enter a valid API key.', 'warning');
      setVerificationResult({ role, success: false, message: formatCheck.message });
      return;
    }

    setVerifyingRole(role);
    setVerificationResult({ role, success: null, message: '' });

    try {
      await verifyAgentKey(config.provider, config.model, config.key);

      // Verification succeeded! Save to SecureStore
      const updatedConfigs = {
        ...agentConfigs,
        [role]: {
          ...config,
          verified: true,
          keyStatus: config.active ? 'active' : 'inactive',
          lastStatusMessage: ''
        }
      };

      // Key sharing sync - mirror key/model/provider; active state is controlled by parent's activate button
      const targetRole = config.shareKeyWith;
      if (targetRole && updatedConfigs[targetRole]) {
        updatedConfigs[targetRole] = {
          ...updatedConfigs[targetRole],
          provider: config.provider,
          model: config.model,
          key: config.key,
          verified: true,
          // Keep child's active state as-is - parent activate button controls activation
          keyStatus: updatedConfigs[targetRole].active ? 'active' : 'inactive',
          lastStatusMessage: ''
        };
      }

      setAgentConfigs(updatedConfigs);
      await SecureStore.setItemAsync('zyron_AGENT_CONFIGS', JSON.stringify(updatedConfigs));
      setVerificationResult({ role, success: true, message: 'Key verified & saved' });
      showToast('Key Verified', 'API key verified, saved, and locked.', 'success');
    } catch (err) {
      const errMsg = sanitizeErrorMessage(
        err.message || 'Verification failed. Please check key or network.',
        [config.key.trim()]
      );
      if (isKeyExhaustedError(err)) {
        const updatedConfigs = {
          ...agentConfigs,
          [role]: {
            ...config,
            verified: true,
            keyStatus: 'exhausted',
            lastStatusMessage: quotaExceededMessage
          }
        };

        const targetRole = config.shareKeyWith;
        if (targetRole && updatedConfigs[targetRole]) {
          updatedConfigs[targetRole] = {
            ...updatedConfigs[targetRole],
            provider: config.provider,
            model: config.model,
            key: config.key,
            verified: true,
            keyStatus: 'exhausted',
            lastStatusMessage: quotaExceededMessage
          };
        }

        setAgentConfigs(updatedConfigs);
        await SecureStore.setItemAsync('zyron_AGENT_CONFIGS', JSON.stringify(updatedConfigs));
        setVerificationResult({
          role,
          success: false,
          title: 'Quota limit reached',
          message: quotaExceededMessage
        });
        return;
      }
      setVerificationResult({ role, success: false, message: errMsg });
      showToast('Verification Failed', errMsg, 'warning');
    } finally {
      setVerifyingRole(null);
    }
  };

  // ── Toggle agent active / inactive ───────────────────────────────────────
  const handleToggleAgentActive = async (role) => {
    if (isEngineLive) {
      showToast('Coordination Active', 'Pause coordination to change agent status.', 'warning');
      return;
    }

    const current = agentConfigs[role];
    if (getSyncedKeySource(role)) {
      showToast('Linked Agent', 'Unlink agent to toggle it independently.', 'info');
      return;
    }

    if (!current.active && (!current.key || !current.key.trim())) {
      setVerificationResult({ role, success: false, message: 'No key found.' });
      showToast('No API Key', 'Add an API key before activating.', 'warning');
      return;
    }

    if (!current.active && !current.verified) {
      setVerificationResult({ role, success: false, message: 'Please verify and save this key before activating it.' });
      showToast('Key Not Verified', 'Verify and save this key first.', 'warning');
      return;
    }

    const togglingOn = !current.active;

    const updated = {
      ...agentConfigs,
      [role]: {
        ...current,
        active: togglingOn,
        keyStatus: togglingOn ? 'active' : 'inactive',
        lastStatusMessage: ''
      }
    };

    const targetRole = current.shareKeyWith;

    if (togglingOn) {
      // Activating parent: also activate the linked child if one exists
      if (targetRole && updated[targetRole]) {
        updated[targetRole] = {
          ...updated[targetRole],
          active: true,
          keyStatus: 'active',
          lastStatusMessage: ''
        };
      }
    } else {
      // Deactivating parent: break link and fully clean child socket
      if (targetRole && updated[targetRole]) {
        const defaultRoleInfo = DEFAULT_AGENT_CONFIGS[targetRole];

        updated[targetRole] = {
          ...updated[targetRole],
          key: '',
          provider: defaultRoleInfo.provider,
          model: defaultRoleInfo.model,
          verified: false,
          active: false,
          keyStatus: 'inactive',
          lastStatusMessage: '',
          shareKeyWith: null
        };
        // Clear the shareKeyWith link on parent
        updated[role].shareKeyWith = null;
      }
    }

    setAgentConfigs(updated);
    await SecureStore.setItemAsync('zyron_AGENT_CONFIGS', JSON.stringify(updated));
    const agentName = getAgentRoleNumberName(role);
    const linkedChildName = targetRole ? getAgentRoleNumberName(targetRole) : '';
    showToast(
      targetRole && togglingOn
        ? `${agentName} and ${linkedChildName} Activated`
        : current.active && targetRole
          ? `${agentName} Deactivated`
          : current.active
            ? `${agentName} Deactivated`
            : `${agentName} Activated`,
      targetRole && togglingOn
        ? `${agentName}'s key also activated ${linkedChildName}.`
        : current.active && targetRole
          ? `${linkedChildName} deactivated — link disconnected.`
          : current.active
            ? 'Agent disconnected.'
            : 'Agent is now active.',
      current.active ? 'info' : 'success'
    );
  };

  // ── Helper: clear a socket's API credentials ─────────────────────────────
  const clearAgentSocketApi = (config) => ({
    ...config,
    key: '',
    verified: false,
    active: false,
    keyStatus: 'inactive',
    lastStatusMessage: '',
    shareKeyWith: null
  });

  // ── Request to delete an agent's API key (shows confirm dialog) ──────────
  const requestDeleteAgentApiKey = (role) => {
    if (isEngineLive) {
      showToast('Coordination Active', 'Pause coordination to delete API key.', 'warning');
      return;
    }

    if (getSyncedKeySource(role)) {
      showSocketLockBanner(role, 'Delete Locked', 'Unlink agent before deleting its key.');
      return;
    }

    if (agentConfigs[role]?.active) {
      showSocketLockBanner(role, 'Delete Locked', 'Deactivate agent before deleting its key.');
      return;
    }

    const config = agentConfigs[role];
    const hasSavedKey = !!(config?.key && config.key.trim().length > 0 && config.verified);
    if (!hasSavedKey) {
      showToast('No Saved Key', 'No saved key to delete.', 'warning');
      return;
    }

    showConfirmDialog({
      title: 'Delete saved API key?',
      message: `This removes the saved provider key from ${getAgentRoleNumberName(role)}.\n\nLinked child sockets using this key will also be cleared.`,
      confirmLabel: 'Delete key',
      destructive: true,
      onConfirm: () => handleDeleteAgentApiKey(role),
    });
  };

  // ── Delete an agent's API key ─────────────────────────────────────────────
  const handleDeleteAgentApiKey = async (role) => {
    if (isEngineLive) {
      showToast('Coordination Active', 'Pause coordination to delete API key.', 'warning');
      return;
    }

    const currentSource = getSyncedKeySource(role);
    const currentTarget = agentConfigs[role]?.shareKeyWith;
    const updated = { ...agentConfigs };

    if (currentSource && updated[currentSource]) {
      updated[currentSource] = {
        ...updated[currentSource],
        shareKeyWith: null
      };
    }

    if (currentTarget && updated[currentTarget]) {
      updated[currentTarget] = clearAgentSocketApi(updated[currentTarget]);
    }

    updated[role] = clearAgentSocketApi(updated[role]);

    setAgentConfigs(updated);
    setPendingShareTargets((prev) => ({
      ...prev,
      [role]: null,
      ...(currentSource ? { [currentSource]: null } : {}),
      ...(currentTarget ? { [currentTarget]: null } : {})
    }));
    setVerificationResult((prev) => (
      prev.role === role ? { role: null, success: null, message: '' } : prev
    ));

    try {
      await SecureStore.setItemAsync('zyron_AGENT_CONFIGS', JSON.stringify(updated));
      showToast('API Key Deleted', `${getAgentRoleNumberName(role)} is ready for a new key.`, 'success');
    } catch (e) {
      console.warn('Error deleting agent API key:', e);
      showToast('Delete Failed', 'Could not delete API key.', 'error');
    }
  };

  // ── Key sharing: update the shareKeyWith relationship ────────────────────
  const handleUpdateKeySharing = async (role, targetRole) => {
    if (isEngineLive) {
      showToast('Coordination Active', 'Pause coordination to change link settings.', 'warning');
      return;
    }

    const cleanedTargetRole = (targetRole === 'none' || !targetRole) ? null : targetRole;
    const availability = getAgentLinkAvailability(role, cleanedTargetRole);
    if (!availability.available) {
      setPendingShareTargets((prev) => ({
        ...prev,
        [role]: null
      }));
      showToast('Agent Unavailable', availability.reason, 'warning');
      return;
    }

    const previousTargetRole = agentConfigs[role].shareKeyWith;

    let updated = { ...agentConfigs };

    // Set the new sharing target
    updated[role] = {
      ...updated[role],
      shareKeyWith: cleanedTargetRole
    };

    // After updating, if a link was established, show success banner
    if (cleanedTargetRole) {
      showToast(
        'Agents Linked',
        `${getAgentRoleNumberName(role)} now shares keys with ${getAgentRoleNumberName(cleanedTargetRole)}.`,
        'success'
      );
    }

    if (previousTargetRole && previousTargetRole !== cleanedTargetRole) {
      const defaultRoleInfo = DEFAULT_AGENT_CONFIGS[previousTargetRole];

      // Previous child is losing its link — deactivate and reset it
      updated[previousTargetRole] = {
        ...updated[previousTargetRole],
        key: '',
        provider: defaultRoleInfo.provider,
        model: defaultRoleInfo.model,
        verified: false,
        active: false,
        keyStatus: 'inactive',
        lastStatusMessage: '',
        shareKeyWith: null
      };
      showToast(
        'Child Agent Deactivated',
        `${getAgentRoleNumberName(previousTargetRole)} was deactivated — link disconnected.`,
        'info'
      );
    }

    if (cleanedTargetRole) {
      // 1. Clear any sharing configuration that the targetRole had
      // 2. Sync key/provider/model - active state follows parent's current active state
      const parentIsActive = updated[role].active;
      updated[cleanedTargetRole] = {
        ...updated[cleanedTargetRole],
        shareKeyWith: null,
        key: updated[role].key,
        provider: updated[role].provider,
        model: updated[role].model,
        verified: updated[role].verified,
        active: parentIsActive,
        keyStatus: parentIsActive ? 'active' : 'inactive',
        lastStatusMessage: updated[role].lastStatusMessage
      };

      // 3. Displace any other parent that was previously sharing with cleanedTargetRole
      //    — break their link and deactivate them since their child is being re-assigned
      Object.keys(updated).forEach(r => {
        if (r !== role && updated[r].shareKeyWith === cleanedTargetRole) {
          updated[r] = {
            ...updated[r],
            shareKeyWith: null,
            active: false,
            keyStatus: 'inactive',
            lastStatusMessage: ''
          };
        }
      });
    }

    setAgentConfigs(updated);
    setPendingShareTargets((prev) => ({
      ...prev,
      [role]: cleanedTargetRole
    }));
    try {
      await SecureStore.setItemAsync('zyron_AGENT_CONFIGS', JSON.stringify(updated));
    } catch (e) {
      console.warn('Error saving key sharing config:', e);
    }
  };

  // ── Key sharing: select target (pre-confirm) ─────────────────────────────
  const handleSelectKeySharingTarget = (role, targetRole) => {
    if (isEngineLive) {
      showToast('Coordination Active', 'Pause coordination to change link settings.', 'warning');
      return;
    }

    const availability = getAgentLinkAvailability(role, targetRole);
    if (!availability.available) {
      showToast('Agent Unavailable', availability.reason, 'warning');
      return;
    }

    setPendingShareTargets((prev) => ({
      ...prev,
      [role]: targetRole || null
    }));
  };

  // ── Link / unlink agent key sharing toggle ───────────────────────────────
  const handleToggleLinkAgent = async (role) => {
    if (isEngineLive) {
      showToast('Coordination Active', 'Pause coordination to change link settings.', 'warning');
      return;
    }

    const currentSource = getSyncedKeySource(role);
    const currentTarget = agentConfigs[role]?.shareKeyWith;
    const selectedTarget = pendingShareTargets[role];
    const current = agentConfigs[role];

    if (currentTarget && current?.active) {
      showToast('Deactivate Agent', 'Deactivate agent before unlinking.', 'warning');
      return;
    }

    let updated = { ...agentConfigs };

    if (!currentTarget && !currentSource && selectedTarget && updated[selectedTarget] && updated[role]?.active) {
      showToast('Deactivate Agent', 'Deactivate agent before linking.', 'warning');
      return;
    }

    if (currentTarget && updated[currentTarget]) {
      updated[role] = {
        ...updated[role],
        shareKeyWith: null
      };

      const defaultRoleInfo = DEFAULT_AGENT_CONFIGS[currentTarget];

      updated[currentTarget] = {
        ...updated[currentTarget],
        key: '',
        provider: defaultRoleInfo.provider,
        model: defaultRoleInfo.model,
        verified: false,
        active: false,
        keyStatus: 'inactive',
        lastStatusMessage: '',
        shareKeyWith: null
      };

      setAgentConfigs(updated);
      setPendingShareTargets((prev) => ({
        ...prev,
        [role]: null,
        [currentTarget]: null
      }));
      try {
        await SecureStore.setItemAsync('zyron_AGENT_CONFIGS', JSON.stringify(updated));
      } catch (e) {
        console.warn('Error saving key sharing config:', e);
      }
      showToast('Agent Unlinked', `${getAgentRoleNumberName(currentTarget)} deactivated — link with ${getAgentRoleNumberName(role)} disconnected.`, 'info');
    } else if (currentSource) {
      // Unlink: set currentSource's shareKeyWith to null
      updated[currentSource] = {
        ...updated[currentSource],
        shareKeyWith: null
      };

      const defaultRoleInfo = DEFAULT_AGENT_CONFIGS[role];

      updated[role] = {
        ...updated[role],
        key: '',
        provider: defaultRoleInfo.provider,
        model: defaultRoleInfo.model,
        verified: false,
        active: false,
        keyStatus: 'inactive',
        lastStatusMessage: '',
        shareKeyWith: null
      };

      setAgentConfigs(updated);
      setPendingShareTargets((prev) => ({
        ...prev,
        [currentSource]: null,
        [role]: null
      }));
      try {
        await SecureStore.setItemAsync('zyron_AGENT_CONFIGS', JSON.stringify(updated));
      } catch (e) {
        console.warn('Error saving key sharing config:', e);
      }
      showToast('Agent Unlinked', `${getAgentRoleNumberName(role)} unlinked and deactivated.`, 'info');
    } else if (selectedTarget && updated[selectedTarget]) {
      const availability = getAgentLinkAvailability(role, selectedTarget);
      if (!availability.available) {
        setPendingShareTargets((prev) => ({
          ...prev,
          [role]: null
        }));
        showToast('Agent Unavailable', availability.reason, 'warning');
        return;
      }
      await handleUpdateKeySharing(role, selectedTarget);
    } else {
      showToast('No Agent Selected', 'Select an agent, then tap Link Agent Key.', 'warning');
    }
  };

  // ── Engine Live toggle ───────────────────────────────────────────────────
  const handleToggleEngineActive = async (getMissingAgentsList) => {
    if (isEngineLive) {
      setIsEngineLive(false);
      await AsyncStorage.setItem('zyron_ENGINE_LIVE', 'false');
      showToast('Coordination Paused', 'Coordination is off. Agents on standby.', 'info');
    } else {
      // Activate overall engine
      const missing = getMissingAgentsList();
      if (missing.length > 0) {
        showToast('Activation Blocked', `Add keys for: ${missing.map((item) => item.split(' (')[0]).join(', ')}`, 'warning');
        return;
      }

      setIsEngineLive(true);
      await AsyncStorage.setItem('zyron_ENGINE_LIVE', 'true');
      showToast('Coordination Active', 'All agents are live and ready.', 'success');
    }
  };

  // ── Deactivate all API keys ──────────────────────────────────────────────
  const handleDeactivateAllApiKeys = async () => {
    try {
      const updated = Object.keys(agentConfigs).reduce((acc, role) => {
        acc[role] = {
          ...agentConfigs[role],
          active: false,
          keyStatus: 'inactive',
          lastStatusMessage: ''
        };
        return acc;
      }, {});

      setAgentConfigs(updated);
      setVerificationResult({ role: null, success: null, message: '' });
      await SecureStore.setItemAsync('zyron_AGENT_CONFIGS', JSON.stringify(updated));
      showToast('Agents Deactivated', 'All agents disconnected.', 'info');
    } catch (err) {
      console.warn('Deactivate sockets failed:', err);
      showToast('Update Failed', 'Could not deactivate agents.', 'error');
    }
  };

  // ── Delete all saved API keys ────────────────────────────────────────────
  const handleDeleteSavedApiKeys = async () => {
    try {
      const updated = Object.keys(agentConfigs).reduce((acc, role) => {
        acc[role] = {
          ...agentConfigs[role],
          key: '',
          active: false,
          verified: false,
          keyStatus: 'inactive',
          lastStatusMessage: ''
        };
        return acc;
      }, {});

      setAgentConfigs(updated);
      setExpandedAgent(null);
      setVerificationResult({ role: null, success: null, message: '' });
      await SecureStore.setItemAsync('zyron_AGENT_CONFIGS', JSON.stringify(updated));
      showToast('Keys Deleted', 'All saved API keys removed.', 'success');
    } catch (err) {
      console.warn('Delete keys failed:', err);
      showToast('Delete Failed', 'Could not remove saved keys.', 'error');
    }
  };

  return {
    agentConfigs,
    setAgentConfigs,
    activeTeamId,
    setActiveTeamId,
    expandedAgent,
    setExpandedAgent,
    verifyingRole,
    verificationResult,
    setVerificationResult,
    pendingShareTargets,
    setPendingShareTargets,
    expandedTeamId,
    setExpandedTeamId,
    // Helpers
    getAgentRoleNumberName,
    getSyncedKeySource,
    getAgentLinkAvailability,
    showSocketLockBanner,
    // Async handlers
    loadAgentConfigsFromStorage,
    loadActiveTeamFromStorage,
    handleSelectTeam,
    handleUpdateAgentField,
    handleVerifyAndSaveAgent,
    handleToggleAgentActive,
    requestDeleteAgentApiKey,
    handleDeleteAgentApiKey,
    handleUpdateKeySharing,
    handleSelectKeySharingTarget,
    handleToggleLinkAgent,
    handleToggleEngineActive,
    handleDeactivateAllApiKeys,
    handleDeleteSavedApiKeys,
  };
}
