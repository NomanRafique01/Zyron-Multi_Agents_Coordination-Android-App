/**
 * SettingsModal.screen.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Settings drawer modal — thin orchestrator that assembles all sub-panels.
 *
 * Sub-panels (each in src/screens/settings/):
 *   ProfilePanel            — workspace identity & personalization
 *   AgentLibraryPanel       — team accordion (browse/activate teams)
 *   ApiConfigPanel          — per-agent socket rows with key management
 *     └─ AgentSocketRow     — individual expanded socket body
 *   PasswordManagerPanel    — API lock create / update / remove
 *   PrivacyPanel            — static privacy & security info
 *   AboutPanel              — static about & architecture info
 *   ResetPanel              — four destructive reset actions
 *
 * Overlays (rendered on top of the ScrollView):
 *   ApiLockGate             — password prompt when opening API panel
 *   RemoveLockBanner        — confirmation for removing the lock
 *   ResetAuthOverlay        — password confirmation for reset actions
 *
 * This file stays ~280 lines by delegating all rendering to sub-panels.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import s from '../../styles/app.styles';
import C from '../../config/colors.config';
import { GearIcon, CrossIcon, KeyIcon, ShieldIcon, InfoIcon, UserIcon, BoltIcon, TrashIcon, LockIcon } from '../../components/shared/Icons';

// ── Sub-panel components ─────────────────────────────────────────────────────
import AccountPanel from './panels/ProfilePanel.component.jsx';
import AgentLibraryPanel from './panels/AgentLibraryPanel.component.jsx';
import ApiConfigPanel from './panels/ApiConfigPanel.component.jsx';
import PasswordManagerPanel from './auth/PasswordManager.component.jsx';
import PrivacyPanel from './panels/PrivacyPanel.component.jsx';
import AboutPanel from './panels/AboutPanel.component.jsx';
import ResetPanel from './panels/ResetPanel.component.jsx';
import AgentsWorkshopPanel from './panels/AgentsWorkshopPanel.component.jsx';
import ApiLockGate from './auth/ApiLockGate.component.jsx';
import RemoveLockBanner from './auth/RemoveLockBanner.component.jsx';
import ResetAuthOverlay from './auth/ResetAuthOverlay.component.jsx';

/**
 * SettingsModal
 *
 * Receives two opaque hook result bags (`settings` and `sockets`) plus a few
 * top-level handlers that require cross-hook state and are therefore defined
 * in MainApp.js.
 */
export default function SettingsModal({
  // Hook bags
  settings,
  sockets,
  // Top-level state
  isEngineLive,
  activeTeam,
  teamRoleInfo,
  // Passed explicitly from MainApp (not in hook bags)
  showToast,
  showConfirmDialog,
  // Cross-hook handlers (defined in MainApp)
  handleClearAllData,
  handleDeleteAllChats,
  handleDeactivateAllApiKeys,
  handleDeleteSavedApiKeys,
  getMissingAgentsList,
  // Auth
  currentUser,
  onSignedOut,
  // Utilities
  renderToast,
}) {
  const insets = useSafeAreaInsets();

  // Convenience aliases to keep JSX readable
  const {
    settingsVisible,
    settingsScrollRef, settingsScrollOffsetRef, settingsViewportHeightRef,
    settingsViewportHeight, setSettingsViewportHeight,
    socketLayoutRef, socketNodeRef, socketHeaderLayoutRef,
    socketBodyLayoutRef, socketBannerNodeRef,
    teamNodeRef, teamLayoutRef,
    settingsPanelLayoutRef, settingsPanelNodeRef,
    apiPanelOpen, setApiPanelOpen,
    passwordPanelOpen,
    profilePanelOpen,
    agentLibraryPanelOpen,
    privacyPanelOpen,
    aboutPanelOpen,
    resetPanelOpen,
    workshopPanelOpen,
    passwordForm, passwordVisibility, passwordManagerFeedback, pwFeedbackOpacity,
    apiLockPasswordSet, apiLockHint,
    apiLockGateVisible, apiLockGatePassword, apiLockGateAttempts, apiLockGateError,
    removeLockBannerVisible, removeLockBannerPassword, removeLockBannerError,
    resetAuthVisible, resetAuthPassword, resetAuthError,
    closeSettings, handleToggleSettingsPanel,
    handleOpenApiPanel, handleUnlockApiPanel,
    resetPasswordManagerDraft, resetApiLockGate,
    updatePasswordForm, togglePasswordVisibility, toggleApiKeyVisibility,
    handleSetApiLockPassword, handleUpdateApiLockPassword,
    handleRemoveApiLockPassword, handleConfirmRemoveLock,
    setApiLockGatePassword, setApiLockGateError,
    setRemoveLockBannerPassword, setRemoveLockBannerError, setRemoveLockBannerVisible,
    setResetAuthPassword, setResetAuthError,
    handleConfirmResetAuth, handleDismissResetAuth,
    requestResetConfirmation,
    userProfile,
    handleUpdateUserProfile, handleSaveUserProfileNow, handleResetUserProfile,
    apiKeyVisibility,
    scrollTeamIntoView, scrollSocketIntoView,
  } = settings;

  const {
    agentConfigs, activeTeamId, expandedAgent, setExpandedAgent,
    expandedTeamId, setExpandedTeamId,
    verifyingRole, verificationResult, setVerificationResult,
    pendingShareTargets,
    getSyncedKeySource, getAgentLinkAvailability, getAgentRoleNumberName, showSocketLockBanner,
    handleUpdateAgentField, handleVerifyAndSaveAgent, handleToggleAgentActive,
    requestDeleteAgentApiKey, handleSelectKeySharingTarget, handleToggleLinkAgent,
    handleToggleEngineActive,
  } = sockets;

  const profileHasUnsavedChangesComputed =
    JSON.stringify(settings.userProfile) !== JSON.stringify(settings.savedUserProfile);

  // ── Panel accordion toggle with agent reset ──────────────────────────────
  const handleTogglePanel = (panel) => {
    if (panel !== 'api') {
      setExpandedAgent(null);
      setVerificationResult({ role: null, success: null, message: '' });
      if (panel !== 'agentLibrary') setExpandedTeamId(null);
    }
    handleToggleSettingsPanel(panel);
  };

  const handleToggleSocketPanel = (role) => {
    const nextRole = expandedAgent === role ? null : role;
    sockets.socketBodyLayoutRef && (sockets.socketBodyLayoutRef.current = {});
    sockets.socketBannerNodeRef && (sockets.socketBannerNodeRef.current = {});
    sockets.socketNodeRef && (sockets.socketNodeRef.current = {});
    setExpandedAgent(nextRole);
    setVerificationResult({ role: null, success: null, message: '' });
    if (nextRole) scrollSocketIntoView(nextRole, 180, 'panel');
  };

  const handleToggleTeamPanel = (teamId) => {
    const next = expandedTeamId === teamId ? null : teamId;
    const { LayoutAnimation } = require('react-native');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedTeamId(next);
    if (next) scrollTeamIntoView(next, 160);
  };

  const panelToggleStyle = (open, openStyle) => [s.apiPanelToggle, open && openStyle];

  return (
    <Modal
      visible={settingsVisible}
      animationType="slide"
      transparent={true}
      hardwareAccelerated={true}
      onRequestClose={() => closeSettings(() => { setExpandedAgent(null); setVerificationResult({ role: null, success: null, message: '' }); setExpandedTeamId(null); })}
    >
      <View style={s.modalHost}>
        <LinearGradient
          colors={['#12121A', '#10101A', '#0E0E18', '#0A0A0F']}
          locations={[0, 0.24, 0.62, 1]}
          style={[s.modalBackdrop, { pointerEvents: 'none' }]}
        />
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          enabled={Platform.OS === 'ios'}
          keyboardVerticalOffset={0}
        >
          <View style={[s.modalContent, { marginTop: insets.top + 20, marginBottom: insets.bottom + 20 }]}>

            {/* Modal Header */}
            <View style={s.modalHeader}>
              <View style={s.modalHeaderLeft}>
                <View style={s.modalHeaderIconBox}>
                  <GearIcon color={C.purpleSoft || C.purple} />
                </View>
                <View style={s.modalTitleBlock}>
                  <Text style={s.modalTitle}>Settings</Text>
                  <Text style={s.modalSubtitle}>Control center</Text>
                </View>
              </View>
              <TouchableOpacity
                style={s.modalCloseBtn}
                onPress={() => closeSettings(() => { setExpandedAgent(null); setVerificationResult({ role: null, success: null, message: '' }); setExpandedTeamId(null); })}
                activeOpacity={0.7}
              >
                <CrossIcon color="#8A8A9D" />
              </TouchableOpacity>
            </View>

            {/* ── Scrollable body ── */}
            <ScrollView
              ref={settingsScrollRef}
              style={s.modalBody}
              contentContainerStyle={s.modalBodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={(e) => { settingsScrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
              onLayout={(e) => {
                const nextH = e.nativeEvent.layout.height;
                settingsViewportHeightRef.current = nextH;
                setSettingsViewportHeight(nextH);
              }}
            >
              {/* Security compliance notice */}
              <View style={s.complianceBanner}>
                <View style={s.complianceIconBox}><ShieldIcon color={C.purpleSoft} /></View>
                <Text style={s.complianceIcon}>🔒</Text>
                <Text style={s.complianceText}>
                  Provider keys stay on this device in encrypted storage and are used only when a configured agents contacts its selected model provider.
                </Text>
              </View>

              {/* ── Account ── */}
              <TouchableOpacity
                style={panelToggleStyle(profilePanelOpen, s.profilePanelToggleOpen)}
                onPress={() => handleTogglePanel('profile')}
                activeOpacity={0.82}
                ref={(node) => { if (node) settingsPanelNodeRef.current.profile = node; }}
                onLayout={(e) => { settingsPanelLayoutRef.current.profile = e.nativeEvent.layout; }}
              >
                <View style={s.apiPanelToggleLeft}>
                  <View style={[s.apiPanelIconBox, s.profileIconBox]}><UserIcon color={C.purpleSoft || C.purple} /></View>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={s.apiPanelTitle}>Account</Text>
                    <Text style={s.apiPanelSub} numberOfLines={1}>Identity, preferences, sign out and account management</Text>
                  </View>
                </View>
              </TouchableOpacity>
              {profilePanelOpen && (
                <AccountPanel
                  currentUser={currentUser}
                  userProfile={userProfile}
                  profileHasUnsavedChanges={profileHasUnsavedChangesComputed}
                  onUpdateField={handleUpdateUserProfile}
                  onSaveNow={handleSaveUserProfileNow}
                  showToast={showToast}
                  showConfirmDialog={showConfirmDialog}
                  onSignedOut={onSignedOut}
                />
              )}

              {/* ── Agent Library ── */}
              <TouchableOpacity
                style={panelToggleStyle(agentLibraryPanelOpen, s.agentLibraryPanelToggleOpen)}
                onPress={() => handleTogglePanel('agentLibrary')}
                activeOpacity={0.82}
                ref={(node) => { if (node) settingsPanelNodeRef.current.agentLibrary = node; }}
                onLayout={(e) => { settingsPanelLayoutRef.current.agentLibrary = e.nativeEvent.layout; }}
              >
                <View style={s.apiPanelToggleLeft}>
                  <View style={[s.apiPanelIconBox, s.agentLibraryIconBox]}><BoltIcon color={C.purpleSoft || C.purple} /></View>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={s.apiPanelTitle}>Agent Library</Text>
                    <Text style={s.apiPanelSub} numberOfLines={1}>Agent team and provider configuration</Text>
                  </View>
                </View>
              </TouchableOpacity>
              {agentLibraryPanelOpen && (
                <AgentLibraryPanel
                  activeTeamId={activeTeamId}
                  activeTeam={activeTeam}
                  expandedTeamId={expandedTeamId}
                  teamNodeRef={teamNodeRef}
                  teamLayoutRef={teamLayoutRef}
                  onToggleTeam={handleToggleTeamPanel}
                  onSelectTeam={(teamId) => sockets.handleSelectTeam(teamId, scrollTeamIntoView)}
                />
              )}

              {/* ── API Configuration ── */}
              <TouchableOpacity
                style={panelToggleStyle(apiPanelOpen, s.apiPanelToggleOpen)}
                onPress={() => handleOpenApiPanel(handleTogglePanel)}
                activeOpacity={0.82}
                ref={(node) => { if (node) settingsPanelNodeRef.current.api = node; }}
                onLayout={(e) => { settingsPanelLayoutRef.current.api = e.nativeEvent.layout; }}
              >
                <View style={s.apiPanelToggleLeft}>
                  <View style={s.apiPanelIconBox}><KeyIcon color={C.purpleSoft || C.purple} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.apiPanelTitle}>API Configuration Panel</Text>
                    <Text style={s.apiPanelSub} numberOfLines={1}>Manage provider agents, models, keys, and activation state</Text>
                  </View>
                </View>
              </TouchableOpacity>
              {apiPanelOpen && (
                <ApiConfigPanel
                  agentConfigs={agentConfigs}
                  isEngineLive={isEngineLive}
                  activeTeamId={activeTeamId}
                  activeTeam={activeTeam}
                  teamRoleInfo={teamRoleInfo}
                  expandedAgent={expandedAgent}
                  verifyingRole={verifyingRole}
                  verificationResult={verificationResult}
                  pendingShareTargets={pendingShareTargets}
                  apiKeyVisibility={apiKeyVisibility}
                  getSyncedKeySource={getSyncedKeySource}
                  getAgentLinkAvailability={getAgentLinkAvailability}
                  getAgentRoleNumberName={getAgentRoleNumberName}
                  showSocketLockBanner={showSocketLockBanner}
                  showToast={showToast}
                  onToggleEngineActive={() => handleToggleEngineActive(getMissingAgentsList)}
                  onToggleSocketPanel={handleToggleSocketPanel}
                  onUpdateAgentField={handleUpdateAgentField}
                  onVerifyAndSave={handleVerifyAndSaveAgent}
                  onToggleAgentActive={handleToggleAgentActive}
                  onRequestDeleteKey={requestDeleteAgentApiKey}
                  onSelectKeySharingTarget={handleSelectKeySharingTarget}
                  onToggleLinkAgent={handleToggleLinkAgent}
                  onToggleApiKeyVisibility={toggleApiKeyVisibility}
                  socketLayoutRef={socketLayoutRef}
                  socketNodeRef={socketNodeRef}
                  socketHeaderLayoutRef={socketHeaderLayoutRef}
                  socketBodyLayoutRef={socketBodyLayoutRef}
                  socketBannerNodeRef={socketBannerNodeRef}
                />
              )}

              {/* ── Password Manager ── */}
              <TouchableOpacity
                style={panelToggleStyle(passwordPanelOpen, s.passwordManagerToggleOpen)}
                onPress={() => handleTogglePanel('password')}
                activeOpacity={0.82}
                ref={(node) => { if (node) settingsPanelNodeRef.current.password = node; }}
                onLayout={(e) => { settingsPanelLayoutRef.current.password = e.nativeEvent.layout; }}
              >
                <View style={s.apiPanelToggleLeft}>
                  <View style={[s.apiPanelIconBox, s.passwordManagerIconBox]}><LockIcon color={C.purpleSoft} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.apiPanelTitle}>Password Manager</Text>
                    <Text style={s.apiPanelSub} numberOfLines={1}>Optional lock for API configuration access</Text>
                  </View>
                </View>
              </TouchableOpacity>
              {passwordPanelOpen && (
                <PasswordManagerPanel
                  apiLockPasswordSet={apiLockPasswordSet}
                  passwordForm={passwordForm}
                  passwordVisibility={passwordVisibility}
                  passwordManagerFeedback={passwordManagerFeedback}
                  pwFeedbackOpacity={pwFeedbackOpacity}
                  onUpdateForm={updatePasswordForm}
                  onToggleVisibility={togglePasswordVisibility}
                  onSetPassword={handleSetApiLockPassword}
                  onUpdatePassword={handleUpdateApiLockPassword}
                  onRemovePassword={handleRemoveApiLockPassword}
                />
              )}

              {/* ── Privacy & Security ── */}
              <TouchableOpacity
                style={panelToggleStyle(privacyPanelOpen, s.privacyPanelToggleOpen)}
                onPress={() => handleTogglePanel('privacy')}
                activeOpacity={0.82}
                ref={(node) => { if (node) settingsPanelNodeRef.current.privacy = node; }}
                onLayout={(e) => { settingsPanelLayoutRef.current.privacy = e.nativeEvent.layout; }}
              >
                <View style={s.apiPanelToggleLeft}>
                  <View style={[s.apiPanelIconBox, s.securityIconBox]}><ShieldIcon color={C.purpleSoft} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.apiPanelTitle}>Privacy & Security</Text>
                    <Text style={s.apiPanelSub} numberOfLines={1}>Credential protection, encryption, and responsible data handling</Text>
                  </View>
                </View>
              </TouchableOpacity>
              {privacyPanelOpen && <PrivacyPanel />}

              {/* ── About ── */}
              <TouchableOpacity
                style={panelToggleStyle(aboutPanelOpen, s.aboutPanelToggleOpen)}
                onPress={() => handleTogglePanel('about')}
                activeOpacity={0.82}
                ref={(node) => { if (node) settingsPanelNodeRef.current.about = node; }}
                onLayout={(e) => { settingsPanelLayoutRef.current.about = e.nativeEvent.layout; }}
              >
                <View style={s.apiPanelToggleLeft}>
                  <View style={[s.apiPanelIconBox, s.aboutIconBox]}><InfoIcon color={C.purpleSoft} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.apiPanelTitle}>About Zyron</Text>
                    <Text style={s.apiPanelSub} numberOfLines={1}>Multi-agent intelligence, orchestration, and local control</Text>
                  </View>
                </View>
              </TouchableOpacity>
              {aboutPanelOpen && <AboutPanel />}

              {/* ── Agents Workshop ── */}
              <TouchableOpacity
                style={panelToggleStyle(workshopPanelOpen, s.agentLibraryPanelToggleOpen)}
                onPress={() => handleTogglePanel('workshop')}
                activeOpacity={0.82}
                ref={(node) => { if (node) settingsPanelNodeRef.current.workshop = node; }}
                onLayout={(e) => { settingsPanelLayoutRef.current.workshop = e.nativeEvent.layout; }}
              >
                <View style={s.apiPanelToggleLeft}>
                  <View style={[s.apiPanelIconBox, s.agentLibraryIconBox]}>
                    <BoltIcon color={C.purpleSoft || C.purple} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.apiPanelTitle}>Agents Workshop</Text>
                    <Text style={s.apiPanelSub} numberOfLines={1}>Build custom agents and assemble your own teams</Text>
                  </View>
                </View>
              </TouchableOpacity>
              {workshopPanelOpen && (
                <AgentsWorkshopPanel showToast={showToast} />
              )}

              {/* ── Reset Data ── */}
              <TouchableOpacity
                style={panelToggleStyle(resetPanelOpen, s.resetPanelToggleOpen)}
                onPress={() => handleTogglePanel('reset')}
                activeOpacity={0.82}
                ref={(node) => { if (node) settingsPanelNodeRef.current.reset = node; }}
                onLayout={(e) => { settingsPanelLayoutRef.current.reset = e.nativeEvent.layout; }}
              >
                <View style={s.apiPanelToggleLeft}>
                  <View style={[s.apiPanelIconBox, s.resetIconBox]}><TrashIcon color="#EF4444" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.apiPanelTitle}>Reset Data</Text>
                    <Text style={s.apiPanelSub} numberOfLines={1}>Deactivate sockets, clear chats, remove keys, or reset Zyron</Text>
                  </View>
                </View>
              </TouchableOpacity>
              {resetPanelOpen && (
                <ResetPanel
                  onDeactivateAllApiKeys={handleDeactivateAllApiKeys}
                  onDeleteAllChats={handleDeleteAllChats}
                  onDeleteSavedApiKeys={handleDeleteSavedApiKeys}
                  onClearAllData={handleClearAllData}
                  onRequestReset={(opts) => requestResetConfirmation(opts, showConfirmDialog)}
                />
              )}
            </ScrollView>

            {/* ── Absolute overlays inside the modal card ── */}
            <ApiLockGate
              visible={apiLockGateVisible}
              apiLockGatePassword={apiLockGatePassword}
              apiLockGateAttempts={apiLockGateAttempts}
              apiLockGateError={apiLockGateError}
              apiLockHint={apiLockHint}
              passwordVisibility={passwordVisibility}
              onChangePassword={(val) => { setApiLockGatePassword(val); setApiLockGateError(''); }}
              onToggleVisible={() => togglePasswordVisibility('gate')}
              onUnlock={() => handleUnlockApiPanel(handleTogglePanel)}
              onClose={resetApiLockGate}
            />

            <RemoveLockBanner
              visible={removeLockBannerVisible}
              removeLockBannerPassword={removeLockBannerPassword}
              removeLockBannerError={removeLockBannerError}
              passwordVisibility={passwordVisibility}
              onChangePassword={(val) => { setRemoveLockBannerPassword(val); setRemoveLockBannerError(''); }}
              onToggleVisible={() => togglePasswordVisibility('removeLock')}
              onConfirm={handleConfirmRemoveLock}
              onCancel={() => { setRemoveLockBannerVisible(false); setRemoveLockBannerPassword(''); setRemoveLockBannerError(''); }}
            />

            <ResetAuthOverlay
              visible={resetAuthVisible}
              resetAuthPassword={resetAuthPassword}
              resetAuthError={resetAuthError}
              passwordVisibility={passwordVisibility}
              onChangePassword={(val) => { setResetAuthPassword(val); setResetAuthError(''); }}
              onToggleVisible={() => togglePasswordVisibility('gate')}
              onConfirm={handleConfirmResetAuth}
              onDismiss={handleDismissResetAuth}
            />

          </View>

          {renderToast()}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
