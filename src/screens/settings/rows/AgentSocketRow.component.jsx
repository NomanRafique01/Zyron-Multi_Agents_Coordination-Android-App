/**
 * AgentSocketRow.component.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * A single agent socket row inside the API Configuration panel.
 * Renders the collapsed header (icon, name, status pill) and the expanded
 * body (provider tabs, model presets, API key input, key-sharing controls,
 * verify/activate/delete action row, and the verification feedback alert).
 *
 * ~290 lines — kept under 300 per the file-size budget.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator
} from 'react-native';
import AgentIcon from '../../../components/agent/AgentIcon.component';
import s from '../../../styles/app.styles';
import C from '../../../config/colors.config';
import {
  CrossIcon, LockIcon, EyeIcon, EyeOffIcon, TrashIcon,
} from '../../../components/shared/Icons';
import {
  OPENROUTER_MODEL_PRESETS,
  DEEPSEEK_MODEL_PRESETS,
  GROQ_MODEL_PRESETS,
  GLM_MODEL_PRESETS,
  DEFAULT_AGENT_CONFIGS,
} from '../../../config/appConfig';

export default function AgentSocketRow({
  role, index, config, agentConfigs,
  isEngineLive, activeTeam, teamRoleInfo,
  isExpanded, verifyingRole, verificationResult,
  pendingShareTargets, apiKeyVisibility,
  getSyncedKeySource, getAgentLinkAvailability,
  getAgentRoleNumberName, showSocketLockBanner, showToast,
  onToggleSocket, onUpdateField, onVerifyAndSave,
  onToggleActive, onRequestDelete, onSelectSharingTarget,
  onToggleLink, onToggleKeyVisibility,
  socketLayoutRef, socketNodeRef, socketHeaderLayoutRef,
  socketBodyLayoutRef, socketBannerNodeRef,
}) {
  const accentColor = isEngineLive ? activeTeam.accent || '#7B2FFF' : '#3E3E52';
  const syncedKeySource = getSyncedKeySource(role);
  const isApiKeyLocked = config.verified || !!syncedKeySource;
  const lockedApiKeyValue = config.verified ? 'Saved API key locked' : 'Linked API key locked';
  const hasKeyAndVerified = config.key && config.key.trim().length > 0 && config.verified;
  const isSocketEngineActive = isEngineLive && config.key && config.key.trim().length > 0;
  const isSocketActive = config.active || isSocketEngineActive;
  const effectiveKeyStatus = isSocketEngineActive && !config.active && config.keyStatus === 'inactive' ? 'active' : config.keyStatus;
  const socketStatus = !isSocketActive ? 'inactive' : (effectiveKeyStatus || (config.verified ? 'active' : 'unverified'));
  const socketStatusLabel = { active: 'ACTIVE', exhausted: 'EXHAUSTED', unverified: 'UNVERIFIED', inactive: 'INACTIVE' }[socketStatus] || 'UNVERIFIED';
  const activeStatusColor = (!isEngineLive && config.active) ? '#10B981' : accentColor;
  const socketStatusStyle = { active: [s.statusVerified, { borderColor: activeStatusColor, backgroundColor: activeStatusColor + '1F' }], exhausted: s.statusExhausted, unverified: s.statusUnverified, inactive: s.statusInactive }[socketStatus] || s.statusUnverified;
  const socketStatusTextColor = { active: activeStatusColor, exhausted: '#EF4444', unverified: '#F59E0B', inactive: '#8A8A9D' }[socketStatus] || '#F59E0B';
  const roleInfo = { label: teamRoleInfo[role].socketLabel, icon: teamRoleInfo[role].icon, defaultModel: DEFAULT_AGENT_CONFIGS[role].model };
  const verification = verificationResult.role === role ? verificationResult : { success: config.keyStatus !== 'exhausted' && config.verified, title: config.keyStatus === 'exhausted' ? 'Quota limit reached' : '', message: config.keyStatus === 'exhausted' ? (config.lastStatusMessage || 'This API key is saved, but the selected provider quota is currently exhausted.') : (config.verified ? 'Key verified & saved' : '') };

  const providerTabs = ['openrouter', 'openai', 'anthropic', 'mistral', 'gemini', 'deepseek', 'groq', 'glm'];
  const providerLabel = (p) => ({ openrouter: 'OpenRouter', openai: 'OpenAI', anthropic: 'Anthropic', mistral: 'Mistral', gemini: 'Gemini', deepseek: 'DeepSeek', groq: 'Groq', glm: 'GLM' }[p] || p);

  const modelPresets = {
    openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-3-opus-latest'],
    mistral: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
    gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    deepseek: DEEPSEEK_MODEL_PRESETS,
    groq: GROQ_MODEL_PRESETS,
    glm: GLM_MODEL_PRESETS,
  };

  const shareOptions = [
    { label: 'None', value: null },
    { label: 'Agent 1', value: 'reasoner' },
    { label: 'Agent 2', value: 'coder' },
    { label: 'Agent 3', value: 'vision' },
    { label: 'Agent 4', value: 'writer' },
  ];

  return (
    <View
      ref={(node) => { if (node) socketNodeRef.current[role] = node; }}
      style={s.agentSocketGroup}
      onLayout={(e) => { socketLayoutRef.current[role] = e.nativeEvent.layout; }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={s.agentSocketLabel}>Agent {index + 1}</Text>
        {index === 0 && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderRadius: 6,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
            paddingHorizontal: 8,
            paddingVertical: 3,
            marginBottom: 2,
          }}>
            <Text style={{ fontSize: 9, fontWeight: '700', color: '#CFCFE6', letterSpacing: 0.6 }}>
              LIVE TALK
            </Text>
          </View>
        )}
      </View>
      {index === 0 && (
        <Text style={{ fontSize: 10, color: '#A78BFA', marginBottom: 8, lineHeight: 15 }}>
          The Agent 1 API configuration is also used for Live Talk Mode.
        </Text>
      )}

      {/* ── Collapsed header ── */}
      <TouchableOpacity
        style={[
          s.apiPanelToggle,
          isExpanded && s.apiPanelToggleOpen,
          isEngineLive && { borderColor: accentColor + '90', borderWidth: 1.5, shadowColor: accentColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 8, elevation: 6 },
          { marginBottom: isExpanded ? 6 : 14 }
        ]}
        onPress={onToggleSocket}
        activeOpacity={0.7}
        onLayout={(e) => { socketHeaderLayoutRef.current[role] = e.nativeEvent.layout; }}
      >
        <View style={s.apiPanelToggleLeft}>
          <View style={[s.apiPanelIconBox, { backgroundColor: isSocketActive ? (isEngineLive ? accentColor + '28' : accentColor + '15') : 'rgba(255,255,255,0.03)', borderColor: isSocketActive ? (isEngineLive ? accentColor + 'AA' : accentColor + '55') : '#242436', shadowColor: isSocketActive && isEngineLive ? accentColor : 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: isSocketActive && isEngineLive ? 0.7 : 0, shadowRadius: isSocketActive && isEngineLive ? 6 : 0, elevation: isSocketActive && isEngineLive ? 4 : 0 }]}>
            <AgentIcon icon={roleInfo.icon} size={28} />
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={s.apiPanelTitle}>{config.name || roleInfo.label}</Text>
              {(config.shareKeyWith || getSyncedKeySource(role)) ? (
                <View style={[s.linkedBadgeHeader, { marginLeft: 8, borderColor: accentColor, backgroundColor: accentColor + '1F' }]}>
                  <Text style={[s.linkedBadgeHeaderText, { color: accentColor }]}>🔗 LINKED</Text>
                </View>
              ) : null}
            </View>
            <Text style={s.apiPanelSub} numberOfLines={1}>
              {isSocketActive ? `${socketStatusLabel} · ${config.provider.toUpperCase()} (${config.model ? config.model.split('/').pop() : 'Default'})` : (!config.key || !config.key.trim() ? 'Not Connected' : 'Inactive')}
            </Text>
          </View>
        </View>
        <View style={[s.statusPill, socketStatusStyle]}>
          <Text style={[s.statusPillText, { color: socketStatusTextColor }]}>{socketStatusLabel}</Text>
        </View>
      </TouchableOpacity>

      {/* ── Expanded body ── */}
      {isExpanded && (
        <View
          style={[s.passwordPanel, { marginTop: -2, marginBottom: 16 }]}
          onLayout={(e) => { socketBodyLayoutRef.current[role] = e.nativeEvent.layout; }}
        >
          {/* Body header */}
          <View style={s.socketBodyHeader}>
            <View>
              <Text style={s.socketBodyTitle}>Socket configuration</Text>
              <Text style={s.socketBodySub}>Provider, model, and key controls</Text>
            </View>
            <TouchableOpacity style={s.socketPanelCloseBtn} onPress={onToggleSocket} activeOpacity={0.75}>
              <CrossIcon color="#A8A8B8" />
            </TouchableOpacity>
          </View>

          {/* Agent name alias */}
          <Text style={s.inputLabel}>Agent Name (Alias)</Text>
          <TouchableOpacity activeOpacity={1} onPress={isEngineLive ? () => showToast('Agents Coordination Active', 'Stop coordination to update settings.', 'warning') : undefined}>
            <View style={{ pointerEvents: isEngineLive ? 'none' : 'auto' }}>
              <TextInput style={s.keyTextInput} placeholder={roleInfo.label} placeholderTextColor="#5A5A70" value={config.name} onChangeText={(val) => onUpdateField('name', val)} editable={!isEngineLive} />
            </View>
          </TouchableOpacity>

          {/* Provider selector */}
          <Text style={s.inputLabel}>Provider</Text>
          <View style={s.providerTabs}>
            {providerTabs.map((prov) => (
              <TouchableOpacity
                key={prov}
                style={[s.providerTabBtn, config.provider === prov && [s.providerTabBtnActive, { backgroundColor: accentColor, borderColor: accentColor }], isEngineLive && { opacity: 0.6 }]}
                onPress={isEngineLive ? () => showToast('Agents Coordination Active', 'Stop coordination to update settings.', 'warning') : syncedKeySource ? () => showToast('Linked Agent', 'Provider inherited from key source.', 'info') : () => onUpdateField('provider', prov)}
                activeOpacity={0.8}
              >
                <Text style={[s.providerTabBtnText, config.provider === prov && s.providerTabBtnTextActive]}>{providerLabel(prov)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Model selection */}
          <Text style={s.inputLabel}>Model Selection</Text>
          {config.provider === 'openrouter' ? (
            <View>
              <Text style={s.subInputLabel}>OpenRouter Model ID</Text>
              <TouchableOpacity activeOpacity={1} onPress={isEngineLive ? () => showToast('Agents Coordination Active', 'Stop coordination to update settings.', 'warning') : syncedKeySource ? () => showToast('Linked Agent', 'Model inherited from key source.', 'info') : undefined}>
                <View style={{ pointerEvents: (isEngineLive || getSyncedKeySource(role)) ? 'none' : 'auto' }}>
                  <TextInput style={s.keyTextInput} placeholder="e.g. nvidia/nemotron-3-ultra-550b-a55b:free" placeholderTextColor="#5A5A70" value={config.model} onChangeText={(val) => onUpdateField('model', val)} editable={!isEngineLive && !getSyncedKeySource(role)} />
                </View>
              </TouchableOpacity>
              <View style={s.presetGrid}>
                {OPENROUTER_MODEL_PRESETS.map(preset => (
                  <TouchableOpacity key={preset} style={[s.presetBadge, config.model === preset && [s.presetBadgeActive, { borderColor: accentColor, backgroundColor: accentColor + '33' }]]} onPress={isEngineLive ? () => showToast('Agents Coordination Active', 'Stop coordination to update settings.', 'warning') : getSyncedKeySource(role) ? () => showToast('Linked Agent', 'Model inherited from key source.', 'info') : () => onUpdateField('model', preset)}>
                    <Text style={[s.presetBadgeText, config.model === preset && s.presetBadgeTextActive, config.model === preset && { color: '#FFFFFF', fontWeight: '700' }]} numberOfLines={1}>{preset.split('/').pop()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={s.providerPresetsRow}>
              {modelPresets[config.provider] && (
                <View style={s.presetGrid}>
                  {modelPresets[config.provider].map(m => (
                    <TouchableOpacity key={m} style={[s.presetBadge, config.model === m && [s.presetBadgeActive, { borderColor: accentColor, backgroundColor: accentColor + '33' }]]} onPress={isEngineLive ? () => showToast('Agents Coordination Active', 'Stop coordination to update settings.', 'warning') : getSyncedKeySource(role) ? () => showToast('Linked Agent', 'Model inherited from key source.', 'info') : () => onUpdateField('model', m)}>
                      <Text style={[s.presetBadgeText, config.model === m && s.presetBadgeTextActive, config.model === m && { color: '#FFFFFF', fontWeight: '700' }]} numberOfLines={1}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* API Key */}
          <Text style={s.inputLabel}>API Key</Text>
          {getSyncedKeySource(role) ? (
            <View style={[s.linkedBadge, { borderColor: accentColor + '40', backgroundColor: accentColor + '14' }]}>
              <Text style={[s.linkedBadgeText, { color: accentColor }]}>🔗 Linked (Key synced from {getAgentRoleNumberName(getSyncedKeySource(role))})</Text>
            </View>
          ) : config.shareKeyWith ? (
            <View style={[s.linkedBadge, { borderColor: accentColor + '40', backgroundColor: accentColor + '14' }]}>
              <Text style={[s.linkedBadgeText, { color: accentColor }]}>🔗 Sharing Key with {getAgentRoleNumberName(config.shareKeyWith)}</Text>
            </View>
          ) : null}
          <TouchableOpacity activeOpacity={1} onPress={isEngineLive ? () => showToast('Agents Coordination Active', 'Stop coordination to update settings.', 'warning') : config.verified ? () => showSocketLockBanner(role, 'API Locked', 'Delete saved key to edit or replace it.') : syncedKeySource ? () => showToast('Linked Agent', 'API key inherited from key source.', 'info') : undefined}>
            <View style={[s.passwordInputShell, { pointerEvents: (isEngineLive || isApiKeyLocked) ? 'none' : 'auto' }]}>
              <TextInput style={[s.passwordTextInput, isApiKeyLocked && { color: '#8A8A9D', backgroundColor: '#141420' }]} placeholder={syncedKeySource ? `Key synced from ${agentConfigs[syncedKeySource].name || syncedKeySource}` : `Enter ${config.provider} API Key`} placeholderTextColor="#5A5A70" secureTextEntry={!isApiKeyLocked && !apiKeyVisibility[role]} value={isApiKeyLocked ? lockedApiKeyValue : config.key} onChangeText={(val) => onUpdateField('key', val)} autoFocus={false} showSoftInputOnFocus={true} blurOnSubmit={true} autoCapitalize="none" autoCorrect={false} editable={!isEngineLive && !isApiKeyLocked} />
              <TouchableOpacity style={s.passwordEyeBtn} onPress={isApiKeyLocked ? () => showSocketLockBanner(role, 'API Key Hidden', 'Delete saved key to replace it.') : onToggleKeyVisibility} activeOpacity={isApiKeyLocked ? 1 : 0.72}>
                {isApiKeyLocked ? <LockIcon color="#8A8A9D" /> : apiKeyVisibility[role] ? <EyeOffIcon color="#8A8A9D" /> : <EyeIcon color="#8A8A9D" />}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {/* Key sharing */}
          <View style={{ marginTop: 12, minHeight: 88 }}>
            <Text style={s.inputLabel}>Share API Key with...</Text>
            <View style={s.presetGrid}>
              {shareOptions.map((opt) => {
                const targetRole = opt.value;
                if (targetRole === role) return null;
                const selectedShareTarget = config.shareKeyWith || pendingShareTargets[role] || null;
                const isSelected = selectedShareTarget === targetRole;
                const availability = getAgentLinkAvailability(role, targetRole);
                const isSynced = !!getSyncedKeySource(role);
                const isUnavailable = (!availability.available && !isSelected) || isSynced;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[s.presetBadge, isSelected && [s.presetBadgeActive, { borderColor: accentColor, backgroundColor: accentColor + '33' }], isUnavailable && !isSelected && { opacity: 0.36, borderColor: '#242436', backgroundColor: 'rgba(255,255,255,0.015)' }]}
                    onPress={isEngineLive ? () => showToast('Agents Coordination Active', 'Stop coordination to change links.', 'warning') : isSynced ? () => showToast('Linked Agent', 'Share key options inherited while linked.', 'info') : isUnavailable ? () => showToast('Agent unavailable', availability.reason, 'warning') : () => onSelectSharingTarget(targetRole)}
                  >
                    <Text style={[s.presetBadgeText, isSelected && s.presetBadgeTextActive, isSelected && { color: '#FFFFFF', fontWeight: '700' }, isUnavailable && !isSelected && { color: '#5E5E72' }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={{ height: 10 }} />

          {/* Link toggle */}
          {(() => {
            const keySource = getSyncedKeySource(role);
            const keyTarget = config.shareKeyWith;
            const isLinked = !!(keySource || keyTarget);
            const linkedName = keySource ? getAgentRoleNumberName(keySource) : keyTarget ? getAgentRoleNumberName(keyTarget) : '';
            return (
              <TouchableOpacity
                style={[s.verifyAddBtn, isLinked ? [s.toggleSocketActive, { borderColor: 'rgba(123,47,255,0.3)', backgroundColor: 'rgba(123,47,255,0.1)', marginBottom: 10 }] : { marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderColor: '#222235', borderWidth: 1 }, { opacity: isEngineLive ? 0.5 : 1 }]}
                onPress={isEngineLive ? () => showToast('Agents Coordination Active', 'Stop coordination to change links.', 'warning') : onToggleLink}
                activeOpacity={isEngineLive ? 1 : 0.75}
              >
                <Text style={[s.verifyAddBtnText, { color: isLinked ? C.purpleSoft : '#8A8A9D', fontSize: 10, letterSpacing: 0.5 }]}>{isLinked ? `🔗 LINKED TO ${linkedName.toUpperCase()} (UNLINK)` : '🔗 LINK SOCKET KEY'}</Text>
              </TouchableOpacity>
            );
          })()}

          {/* Action row: Verify / Activate / Delete */}
          <View style={s.actionRow}>
            <TouchableOpacity
              style={[s.verifyAddBtn, { flex: 1, marginBottom: 0, backgroundColor: accentColor }, (isEngineLive || getSyncedKeySource(role) || config.verified) && { opacity: 0.5 }]}
              onPress={isEngineLive ? () => showToast('Agents Coordination Active', 'Stop coordination to verify keys.', 'warning') : getSyncedKeySource(role) ? () => showSocketLockBanner(role, 'Verify Locked', 'Unlink agent to verify its own key.') : config.verified ? () => showSocketLockBanner(role, 'Verify Locked', 'Delete saved key before verifying a new one.') : onVerifyAndSave}
              activeOpacity={isEngineLive ? 1 : 0.8}
              disabled={verifyingRole === role}
            >
              {verifyingRole === role ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.verifyAddBtnText}>{getSyncedKeySource(role) || config.verified ? 'LOCKED' : 'Verify & Save API'}</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.toggleSocketBtnInline, config.active ? { borderColor: '#EF44444D', backgroundColor: 'rgba(239,68,68,0.1)' } : { borderColor: '#222235', backgroundColor: 'rgba(255,255,255,0.03)' }, (isEngineLive || !!getSyncedKeySource(role)) && { opacity: 0.5 }]}
              onPress={isEngineLive ? () => showToast('Agents Coordination Active', 'Stop coordination to toggle agents.', 'warning') : getSyncedKeySource(role) ? () => showToast('Linked Agent', `Unlink agent to ${config.active ? 'deactivate' : 'activate'} it.`, 'info') : onToggleActive}
              activeOpacity={isEngineLive ? 1 : 0.7}
            >
              <Text style={[s.toggleSocketBtnText, getSyncedKeySource(role) ? { color: '#5E5E72' } : config.active ? { color: '#EF4444' } : { color: '#8A8A9D' }]}>{isEngineLive ? 'LOCKED' : getSyncedKeySource(role) ? 'LOCKED' : (config.active ? 'DEACTIVATE' : 'ACTIVATE')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.toggleSocketBtnInline, { minWidth: 44, paddingHorizontal: 10, borderColor: '#EF44444D', backgroundColor: 'rgba(239,68,68,0.08)' }, (isEngineLive || !!getSyncedKeySource(role) || config.active) && { opacity: 0.5 }]}
              onPress={isEngineLive ? () => showToast('Agents Coordination Active', 'Stop coordination to delete keys.', 'warning') : getSyncedKeySource(role) ? () => showSocketLockBanner(role, 'Delete Locked', 'Unlink agent before deleting its key.') : config.active ? () => showSocketLockBanner(role, 'Delete Locked', 'Deactivate agent before deleting its key.') : onRequestDelete}
              activeOpacity={isEngineLive ? 1 : 0.7}
            >
              {getSyncedKeySource(role) || config.active ? <LockIcon color="#8A8A9D" /> : <TrashIcon color="#EF4444" />}
            </TouchableOpacity>
          </View>

          {/* Verification alert */}
          {verification.message ? (
            <View style={[s.testAlert, verification.success ? s.testSuccess : s.testFailure, { marginTop: 10 }]}>
              {verification.title ? <Text style={s.testAlertTitle}>{verification.title}</Text> : null}
              <Text style={s.testAlertText}>{verification.message}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
