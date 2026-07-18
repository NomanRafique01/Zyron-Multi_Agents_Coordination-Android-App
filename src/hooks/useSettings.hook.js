/**
 * useSettings.hook.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Settings modal state management for Zyron.
 *
 * Owns:
 *   • Settings modal visibility
 *   • All settings panel open/close state (api, password, profile, persona,
 *     agentLibrary, privacy, about, reset)
 *   • Settings scroll position save / restore
 *   • Settings panel and socket scroll-into-view helpers (refs)
 *   • Password Manager state and handlers
 *   • API Lock gate state and handlers
 *   • Reset auth overlay state and handlers
 *   • User profile state and persistence
 * • Agent persona state and persistence
 *
 * Returns all settings-related state and handlers.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef } from 'react';
import { Animated, LayoutAnimation } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  DEFAULT_USER_PROFILE,
  normalizeUserProfile,
} from '../config/appConfig';
import { AGENT_PERSONA_KEY, AGENT_PERSONA_OPTIONS } from '../config/agentPersona.config.js';
import {
  API_LOCK_PASSWORD_KEY,
  API_LOCK_HINT_KEY,
  EMPTY_PASSWORD_FORM,
} from '../config/apiLock.config.js';

/**
 * useSettings
 *
 * @param {function} showToast — from useToast
 */
export default function useSettings({ showToast }) {
  // ── Modal / panel visibility ─────────────────────────────────────────────
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [apiPanelOpen, setApiPanelOpen] = useState(false);
  const [passwordPanelOpen, setPasswordPanelOpen] = useState(false);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [personaPanelOpen, setPersonaPanelOpen] = useState(false);
  const [agentLibraryPanelOpen, setAgentLibraryPanelOpen] = useState(false);
  const [privacyPanelOpen, setPrivacyPanelOpen] = useState(false);
  const [aboutPanelOpen, setAboutPanelOpen] = useState(false);
  const [resetPanelOpen, setResetPanelOpen] = useState(false);
  const [workshopPanelOpen, setWorkshopPanelOpen] = useState(false);

  // ── Settings scroll ──────────────────────────────────────────────────────
  const settingsScrollRef = useRef(null);
  const settingsScrollOffsetRef = useRef(0);
  const settingsScrollRestoreRef = useRef(null);
  const settingsViewportHeightRef = useRef(0);
  const [settingsViewportHeight, setSettingsViewportHeight] = useState(520);
  const settingsCenterTimerRef = useRef(null);

  // ── Layout ref maps for scroll-into-view ────────────────────────────────
  const socketLayoutRef = useRef({});
  const socketNodeRef = useRef({});
  const socketHeaderLayoutRef = useRef({});
  const socketBodyLayoutRef = useRef({});
  const socketBannerNodeRef = useRef({});
  const teamNodeRef = useRef({});
  const teamLayoutRef = useRef({});
  const settingsPanelLayoutRef = useRef({});
  const settingsPanelNodeRef = useRef({});

  // ── Password Manager ─────────────────────────────────────────────────────
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [passwordVisibility, setPasswordVisibility] = useState({
    password: false,
    confirmPassword: false,
    oldPassword: false,
    newPassword: false,
    confirmNewPassword: false,
    gate: false,
    removeLock: false,
  });
  const [passwordManagerFeedback, setPasswordManagerFeedback] = useState({ type: null, message: '' });
  const pwFeedbackOpacity = useRef(new Animated.Value(0)).current;
  const pwFeedbackTimerRef = useRef(null);

  // ── API Lock gate ────────────────────────────────────────────────────────
  const [apiLockPasswordSet, setApiLockPasswordSet] = useState(false);
  const [apiLockPassword, setApiLockPassword] = useState('');
  const [apiLockHint, setApiLockHint] = useState('');
  const [apiLockGateVisible, setApiLockGateVisible] = useState(false);
  const [apiLockGatePassword, setApiLockGatePassword] = useState('');
  const [apiLockGateAttempts, setApiLockGateAttempts] = useState(0);
  const [apiLockGateError, setApiLockGateError] = useState('');
  const [removeLockBannerVisible, setRemoveLockBannerVisible] = useState(false);
  const [removeLockBannerPassword, setRemoveLockBannerPassword] = useState('');
  const [removeLockBannerError, setRemoveLockBannerError] = useState('');
  const [apiKeyVisibility, setApiKeyVisibility] = useState({
    reasoner: false,
    coder: false,
    vision: false,
    writer: false,
  });

  // ── Reset auth overlay ───────────────────────────────────────────────────
  const [resetAuthVisible, setResetAuthVisible] = useState(false);
  const [resetAuthPassword, setResetAuthPassword] = useState('');
  const [resetAuthError, setResetAuthError] = useState('');
  const [resetAuthPendingAction, setResetAuthPendingAction] = useState(null);

  // ── User profile ─────────────────────────────────────────────────────────
  const [userProfile, setUserProfile] = useState(DEFAULT_USER_PROFILE);
  const [savedUserProfile, setSavedUserProfile] = useState(DEFAULT_USER_PROFILE);

  // ── Agent persona ────────────────────────────────────────────────────────
  const [agentPersona, setAgentPersona] = useState('balanced');

  // ════════════════════════════════════════════════════════════════════════
  // SCROLL HELPERS
  // ════════════════════════════════════════════════════════════════════════

  const rememberSettingsScrollPosition = () => {
    if (settingsScrollRestoreRef.current === null) {
      settingsScrollRestoreRef.current = settingsScrollOffsetRef.current;
    }
  };

  const restoreSettingsScrollPosition = (delay = 45) => {
    const restoreY = settingsScrollRestoreRef.current;
    settingsScrollRestoreRef.current = null;
    if (restoreY === null || restoreY === undefined) return;
    setTimeout(() => {
      settingsScrollRef.current?.scrollTo({
        y: Math.max(0, restoreY),
        animated: true
      });
    }, delay);
  };

  const scrollSettingsPanelIntoView = (panel, delay = 45) => {
    if (settingsCenterTimerRef.current) {
      clearTimeout(settingsCenterTimerRef.current);
    }
    settingsCenterTimerRef.current = setTimeout(() => {
      const panelNode = settingsPanelNodeRef.current[panel];
      const viewportHeight = settingsViewportHeightRef.current || settingsViewportHeight || 520;
      const alignPanelTop = ['api', 'profile', 'persona', 'agentLibrary', 'password', 'privacy', 'reset', 'about', 'workshop'].includes(panel);
      const panelTopPadding = panel === 'reset' ? 104 : 10;

      if (panelNode?.measureInWindow && settingsScrollRef.current?.measureInWindow) {
        settingsScrollRef.current.measureInWindow((scrollX, scrollY, scrollWidth, scrollHeight) => {
          panelNode.measureInWindow((panelX, panelY, panelWidth, panelHeight) => {
            const targetY = alignPanelTop
              ? settingsScrollOffsetRef.current + panelY - scrollY - panelTopPadding
              : settingsScrollOffsetRef.current + panelY + (panelHeight / 2) - (scrollY + ((scrollHeight || viewportHeight) / 2));
            settingsScrollRef.current?.scrollTo({
              y: Math.max(0, targetY),
              animated: true
            });
            settingsCenterTimerRef.current = null;
          });
        });
        return;
      }

      const panelLayout = settingsPanelLayoutRef.current[panel];
      if (!panelLayout) return;
      const fallbackTargetY = alignPanelTop
        ? panelLayout.y - panelTopPadding
        : panelLayout.y + ((panelLayout.height || 0) / 2);
      settingsScrollRef.current?.scrollTo({
        y: Math.max(0, alignPanelTop ? fallbackTargetY : fallbackTargetY - (viewportHeight / 2)),
        animated: true
      });
      settingsCenterTimerRef.current = null;
    }, delay);
  };

  const scrollSocketIntoView = (role, delay = 45, target = 'panel') => {
    if (settingsCenterTimerRef.current) {
      clearTimeout(settingsCenterTimerRef.current);
    }
    settingsCenterTimerRef.current = setTimeout(() => {
      const bannerNode = socketBannerNodeRef.current[role];
      const viewportHeight = settingsViewportHeightRef.current || settingsViewportHeight || 520;

      if (target === 'feedback' && bannerNode?.measureInWindow && settingsScrollRef.current?.measureInWindow) {
        settingsScrollRef.current.measureInWindow((scrollX, scrollY, scrollWidth, scrollHeight) => {
          bannerNode.measureInWindow((bannerX, bannerY, bannerWidth, bannerHeight) => {
            const viewportCenterY = scrollY + ((scrollHeight || viewportHeight) / 2);
            const bannerCenterY = bannerY + (bannerHeight / 2);
            const targetY = settingsScrollOffsetRef.current + bannerCenterY - viewportCenterY;
            settingsScrollRef.current?.scrollTo({
              y: Math.max(0, targetY),
              animated: true
            });
            settingsCenterTimerRef.current = null;
          });
        });
        return;
      }

      const socketNode = socketNodeRef.current[role];
      if (target === 'panel' && socketNode?.measureInWindow && settingsScrollRef.current?.measureInWindow) {
        settingsScrollRef.current.measureInWindow((scrollX, scrollY) => {
          socketNode.measureInWindow((socketX, socketY) => {
            const targetY = settingsScrollOffsetRef.current + socketY - scrollY - 10;
            settingsScrollRef.current?.scrollTo({
              y: Math.max(0, targetY),
              animated: true
            });
            settingsCenterTimerRef.current = null;
          });
        });
        return;
      }

      const socketLayout = socketLayoutRef.current[role];
      if (!socketLayout) return;
      const targetY = target === 'feedback'
        ? socketLayout.y + ((socketLayout.height || 0) / 2) - (viewportHeight / 2)
        : socketLayout.y - 10;
      settingsScrollRef.current?.scrollTo({
        y: Math.max(0, targetY),
        animated: true
      });
      settingsCenterTimerRef.current = null;
    }, delay);
  };

  const scrollTeamIntoView = (teamId, delay = 180) => {
    if (settingsCenterTimerRef.current) {
      clearTimeout(settingsCenterTimerRef.current);
    }
    settingsCenterTimerRef.current = setTimeout(() => {
      const teamNode = teamNodeRef.current[teamId];

      if (teamNode?.measureInWindow && settingsScrollRef.current?.measureInWindow) {
        settingsScrollRef.current.measureInWindow((scrollX, scrollY, scrollWidth, scrollHeight) => {
          teamNode.measureInWindow((teamX, teamY, teamWidth, teamHeight) => {
            const targetY = settingsScrollOffsetRef.current + teamY - scrollY - 10;
            settingsScrollRef.current?.scrollTo({
              y: Math.max(0, targetY),
              animated: true,
            });
            settingsCenterTimerRef.current = null;
          });
        });
        return;
      }

      const teamLayout = teamLayoutRef.current[teamId];
      if (!teamLayout) return;
      const targetY = teamLayout.y - 10;
      settingsScrollRef.current?.scrollTo({
        y: Math.max(0, targetY),
        animated: true,
      });
      settingsCenterTimerRef.current = null;
    }, delay);
  };

  // ════════════════════════════════════════════════════════════════════════
  // PANEL TOGGLE HANDLERS
  // ════════════════════════════════════════════════════════════════════════

  const handleToggleSettingsPanel = (panel) => {
    const nextApiOpen = panel === 'api' ? !apiPanelOpen : false;
    const nextPasswordOpen = panel === 'password' ? !passwordPanelOpen : false;
    const nextProfileOpen = panel === 'profile' ? !profilePanelOpen : false;
    const nextPersonaOpen = panel === 'persona' ? !personaPanelOpen : false;
    const nextAgentLibraryOpen = panel === 'agentLibrary' ? !agentLibraryPanelOpen : false;
    const nextPrivacyOpen = panel === 'privacy' ? !privacyPanelOpen : false;
    const nextAboutOpen = panel === 'about' ? !aboutPanelOpen : false;
    const nextResetOpen = panel === 'reset' ? !resetPanelOpen : false;
    const nextWorkshopOpen = panel === 'workshop' ? !workshopPanelOpen : false;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setApiPanelOpen(nextApiOpen);
    setPasswordPanelOpen(nextPasswordOpen);
    setProfilePanelOpen(nextProfileOpen);
    setPersonaPanelOpen(nextPersonaOpen);
    setAgentLibraryPanelOpen(nextAgentLibraryOpen);
    setPrivacyPanelOpen(nextPrivacyOpen);
    setAboutPanelOpen(nextAboutOpen);
    setResetPanelOpen(nextResetOpen);
    setWorkshopPanelOpen(nextWorkshopOpen);
    if (!nextAgentLibraryOpen) {
      // expandedTeamId is managed in useAgentSockets — caller must handle
    }
    setVerificationResultFromSettings({ role: null, success: null, message: '' });
    if (!nextPasswordOpen) {
      resetPasswordManagerDraft();
    } else {
      setPasswordManagerFeedback({ type: null, message: '' });
    }
    if (
      (panel === 'api' && nextApiOpen) ||
      (panel === 'password' && nextPasswordOpen) ||
      (panel === 'profile' && nextProfileOpen) ||
      (panel === 'persona' && nextPersonaOpen) ||
      (panel === 'agentLibrary' && nextAgentLibraryOpen) ||
      (panel === 'privacy' && nextPrivacyOpen) ||
      (panel === 'about' && nextAboutOpen) ||
      (panel === 'reset' && nextResetOpen) ||
      (panel === 'workshop' && nextWorkshopOpen)
    ) {
      scrollSettingsPanelIntoView(panel, 105);
    }
  };

  // Placeholder — actual verificationResult lives in useAgentSockets;
  // this is only for the password panel feedback clear on panel close.
  const setVerificationResultFromSettings = (_v) => {
    // No-op — verificationResult is owned by useAgentSockets
  };

  const closeSettings = (extraCleanup) => {
    //
    settingsScrollOffsetRef.current = 0;
    setSettingsVisible(false);
    setApiPanelOpen(false);
    setPasswordPanelOpen(false);
    setProfilePanelOpen(false);
    setPersonaPanelOpen(false);
    setAgentLibraryPanelOpen(false);
    setPrivacyPanelOpen(false);
    setAboutPanelOpen(false);
    setResetPanelOpen(false);
    setWorkshopPanelOpen(false);
    setResetAuthVisible(false);
    setResetAuthPassword('');
    setResetAuthError('');
    setResetAuthPendingAction(null);
    setRemoveLockBannerVisible(false);
    setRemoveLockBannerPassword('');
    setRemoveLockBannerError('');
    resetPasswordManagerDraft();
    resetApiLockGate();
    if (typeof extraCleanup === 'function') extraCleanup();
  };

  const closeAllSettingsPanels = (extraCleanup) => {
    setApiPanelOpen(false);
    setPasswordPanelOpen(false);
    setProfilePanelOpen(false);
    setPrivacyPanelOpen(false);
    setAboutPanelOpen(false);
    setResetPanelOpen(false);
    setWorkshopPanelOpen(false);
    resetPasswordManagerDraft();
    resetApiLockGate();
    if (typeof extraCleanup === 'function') extraCleanup();
  };

  // ════════════════════════════════════════════════════════════════════════
  // PASSWORD MANAGER HELPERS
  // ════════════════════════════════════════════════════════════════════════

  const resetPasswordManagerDraft = () => {
    if (pwFeedbackTimerRef.current) {
      clearTimeout(pwFeedbackTimerRef.current);
      pwFeedbackTimerRef.current = null;
    }
    pwFeedbackOpacity.setValue(0);
    setPasswordForm(EMPTY_PASSWORD_FORM);
    setPasswordManagerFeedback({ type: null, message: '' });
    setRemoveLockBannerVisible(false);
    setRemoveLockBannerPassword('');
    setRemoveLockBannerError('');
    setPasswordVisibility((prev) => ({
      ...prev,
      password: false,
      confirmPassword: false,
      oldPassword: false,
      newPassword: false,
      confirmNewPassword: false,
      removeLock: false,
    }));
  };

  const updatePasswordForm = (field, value) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    setPasswordManagerFeedback({ type: null, message: '' });
    pwFeedbackOpacity.setValue(0);
    if (pwFeedbackTimerRef.current) clearTimeout(pwFeedbackTimerRef.current);
  };

  const showPasswordFeedback = (type, message) => {
    if (pwFeedbackTimerRef.current) clearTimeout(pwFeedbackTimerRef.current);
    pwFeedbackOpacity.setValue(0);
    setPasswordManagerFeedback({ type, message });
    // Fade in
    Animated.timing(pwFeedbackOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      // Hold for 4 s then fade out
      pwFeedbackTimerRef.current = setTimeout(() => {
        Animated.timing(pwFeedbackOpacity, {
          toValue: 0,
          duration: 380,
          useNativeDriver: true,
        }).start(() => {
          setPasswordManagerFeedback({ type: null, message: '' });
        });
      }, 4000);
    });
  };

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const toggleApiKeyVisibility = (role) => {
    setApiKeyVisibility((prev) => ({ ...prev, [role]: !prev[role] }));
  };

  // ── API Lock SecureStore handlers ────────────────────────────────────────
  const loadApiLockFromStorage = async () => {
    try {
      const storedPassword = await SecureStore.getItemAsync(API_LOCK_PASSWORD_KEY);
      const storedHint = await SecureStore.getItemAsync(API_LOCK_HINT_KEY);
      setApiLockPassword(storedPassword || '');
      setApiLockHint(storedHint || '');
      setApiLockPasswordSet(!!storedPassword);
    } catch (err) {
      console.warn('Error loading API lock:', err);
    }
  };

  const handleSetApiLockPassword = async () => {
    const password = passwordForm.password.trim();
    const confirmPassword = passwordForm.confirmPassword.trim();
    if (!password) {
      showPasswordFeedback('error', 'Password cannot be empty');
      return;
    }
    if (password !== confirmPassword) {
      showPasswordFeedback('error', 'Passwords do not match');
      return;
    }

    try {
      const hint = passwordForm.hint.trim();
      await SecureStore.setItemAsync(API_LOCK_PASSWORD_KEY, password);
      await SecureStore.setItemAsync(API_LOCK_HINT_KEY, hint);
      setApiLockPassword(password);
      setApiLockHint(hint);
      setApiLockPasswordSet(true);
      setPasswordForm(EMPTY_PASSWORD_FORM);
      showPasswordFeedback('success', 'API Configuration lock is enabled.');
    } catch (err) {
      console.warn('Set API lock failed:', err);
      showPasswordFeedback('error', 'Password could not be saved securely.');
    }
  };

  const handleUpdateApiLockPassword = async () => {
    const oldPassword = passwordForm.oldPassword.trim();
    const newPassword = passwordForm.newPassword.trim();
    const confirmNewPassword = passwordForm.confirmNewPassword.trim();
    if (oldPassword !== apiLockPassword) {
      showPasswordFeedback('error', 'Current password is incorrect');
      return;
    }
    if (!newPassword) {
      showPasswordFeedback('error', 'New password cannot be empty');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showPasswordFeedback('error', 'Passwords do not match');
      return;
    }

    try {
      const hint = passwordForm.newHint.trim();
      await SecureStore.setItemAsync(API_LOCK_PASSWORD_KEY, newPassword);
      await SecureStore.setItemAsync(API_LOCK_HINT_KEY, hint);
      setApiLockPassword(newPassword);
      setApiLockHint(hint);
      setPasswordForm(EMPTY_PASSWORD_FORM);
      showPasswordFeedback('success', 'API Configuration lock was updated.');
    } catch (err) {
      console.warn('Update API lock failed:', err);
      showPasswordFeedback('error', 'Password could not be updated securely.');
    }
  };

  const handleRemoveApiLockPassword = () => {
    setRemoveLockBannerPassword('');
    setRemoveLockBannerError('');
    setPasswordVisibility((prev) => ({ ...prev, removeLock: false }));
    setRemoveLockBannerVisible(true);
  };

  const handleConfirmRemoveLock = async () => {
    if (removeLockBannerPassword.trim() !== apiLockPassword) {
      setRemoveLockBannerError('Incorrect password. Try again.');
      return;
    }
    try {
      await SecureStore.deleteItemAsync(API_LOCK_PASSWORD_KEY);
      await SecureStore.deleteItemAsync(API_LOCK_HINT_KEY);
      setApiLockPassword('');
      setApiLockHint('');
      setApiLockPasswordSet(false);
      resetApiLockGate();
      setPasswordForm(EMPTY_PASSWORD_FORM);
      setRemoveLockBannerVisible(false);
      setRemoveLockBannerPassword('');
      setRemoveLockBannerError('');
      showPasswordFeedback('success', 'API Configuration lock was removed.');
    } catch (err) {
      console.warn('Remove API lock failed:', err);
      setRemoveLockBannerError('Could not remove the lock. Please try again.');
    }
  };

  // ── API Lock gate ─────────────────────────────────────────────────────────
  const resetApiLockGate = () => {
    setApiLockGateVisible(false);
    setApiLockGatePassword('');
    setApiLockGateAttempts(0);
    setApiLockGateError('');
    setPasswordVisibility((prev) => ({ ...prev, gate: false }));
  };

  const handleOpenApiPanel = (handleToggleSettingsPanelFn) => {
    if (apiLockPasswordSet && !apiPanelOpen) {
      setApiPanelOpen(false);
      setPasswordPanelOpen(false);
      setProfilePanelOpen(false);
      setPrivacyPanelOpen(false);
      setAboutPanelOpen(false);
      setResetPanelOpen(false);
      resetPasswordManagerDraft();
      setApiLockGateVisible(true);
      setApiLockGatePassword('');
      setApiLockGateError('');
      setApiLockGateAttempts(0);
      return;
    }
    handleToggleSettingsPanelFn('api');
  };

  const handleUnlockApiPanel = (handleToggleSettingsPanelFn) => {
    if (apiLockGatePassword.trim() === apiLockPassword) {
      resetApiLockGate();
      handleToggleSettingsPanelFn('api');
      return;
    }
    const nextAttempts = apiLockGateAttempts + 1;
    setApiLockGateAttempts(nextAttempts);
    setApiLockGateError('Incorrect password');
  };

  // ── Reset auth gate ────────────────────────────────────────────────────────
  // Order: Zyron password (if set) → plain confirm dialog
  const authenticateBeforeReset = (onSuccess) => {
    if (apiLockPasswordSet) {
      // Show the Zyron password prompt overlay; store the action to run after success
      setResetAuthPendingAction(() => onSuccess);
      setResetAuthPassword('');
      setResetAuthError('');
      setResetAuthVisible(true);
      return;
    }

    // No Zyron password set — proceed directly with confirm dialog
    onSuccess();
  };

  const handleConfirmResetAuth = () => {
    if (resetAuthPassword.trim() === apiLockPassword) {
      setResetAuthVisible(false);
      setResetAuthPassword('');
      setResetAuthError('');
      const action = resetAuthPendingAction;
      setResetAuthPendingAction(null);
      if (action) action();
    } else {
      setResetAuthError('Incorrect password.');
    }
  };

  const handleDismissResetAuth = () => {
    setResetAuthVisible(false);
    setResetAuthPassword('');
    setResetAuthError('');
    setResetAuthPendingAction(null);
    showToast('Authentication Failed', 'Reset cancelled.', 'warning');
  };

  const requestResetConfirmation = ({ key: _key, title, message, impact, confirmLabel, onConfirm }, showConfirmDialog) => {
    authenticateBeforeReset(() => {
      showConfirmDialog({
        title,
        message: impact ? `${message}\n\n${impact}` : message,
        confirmLabel,
        destructive: true,
        onConfirm,
      });
    });
  };

  // ── User profile handlers ─────────────────────────────────────────────────
  const loadUserProfileFromStorage = async () => {
    try {
      const storedProfile = await AsyncStorage.getItem('zyron_USER_PROFILE');
      if (storedProfile) {
        const parsedProfile = normalizeUserProfile(JSON.parse(storedProfile), true);
        setUserProfile(parsedProfile);
        setSavedUserProfile(parsedProfile);
      }
    } catch (err) {
      console.warn('Error loading user profile:', err);
    }
  };

  const saveUserProfile = async (nextProfile) => {
    try {
      await AsyncStorage.setItem('zyron_USER_PROFILE', JSON.stringify(nextProfile));
    } catch (err) {
      console.warn('Error saving user profile:', err);
    }
  };

  const handleUpdateUserProfile = (field, value) => {
    const updatedProfile = normalizeUserProfile({
      ...userProfile,
      [field]: value
    }, userProfile.hasCompletedWelcome);
    setUserProfile(updatedProfile);
  };

  const handleSaveUserProfileNow = async () => {
    await saveUserProfile(userProfile);
    setSavedUserProfile(userProfile);
    showToast('Profile Saved', 'Profile saved.', 'success');
  };

  const handleResetUserProfile = () => {
    setUserProfile(DEFAULT_USER_PROFILE);
    setSavedUserProfile(DEFAULT_USER_PROFILE);
    saveUserProfile(DEFAULT_USER_PROFILE);
    showToast('Profile Reset', 'Profile restored to default.', 'info');
  };

  // ── Agent persona handlers ─────────────────────────────────────────────────
  const loadAgentPersonaFromStorage = async () => {
    try {
      const storedPersona = await AsyncStorage.getItem(AGENT_PERSONA_KEY);
      const hasStoredPersona = AGENT_PERSONA_OPTIONS.some((option) => option.key === storedPersona);
      if (hasStoredPersona) {
        setAgentPersona(storedPersona);
      }
    } catch (err) {
      console.warn('Error loading agent persona:', err);
    }
  };

  const handleUpdateAgentPersona = async (personaKey) => {
    setAgentPersona(personaKey);
    try {
      await AsyncStorage.setItem(AGENT_PERSONA_KEY, personaKey);
    } catch (err) {
      console.warn('Error saving agent persona:', err);
    }
  };

  return {
    // Visibility state
    settingsVisible, setSettingsVisible,
    apiPanelOpen, setApiPanelOpen,
    passwordPanelOpen, setPasswordPanelOpen,
    profilePanelOpen, setProfilePanelOpen,
    personaPanelOpen, setPersonaPanelOpen,
    agentLibraryPanelOpen, setAgentLibraryPanelOpen,
    privacyPanelOpen, setPrivacyPanelOpen,
    aboutPanelOpen, setAboutPanelOpen,
    resetPanelOpen, setResetPanelOpen,
    workshopPanelOpen, setWorkshopPanelOpen,

    // Scroll refs
    settingsScrollRef,
    settingsScrollOffsetRef,
    settingsViewportHeightRef,
    settingsViewportHeight, setSettingsViewportHeight,
    settingsCenterTimerRef,

    // Layout ref maps
    socketLayoutRef, socketNodeRef, socketHeaderLayoutRef,
    socketBodyLayoutRef, socketBannerNodeRef,
    teamNodeRef, teamLayoutRef,
    settingsPanelLayoutRef, settingsPanelNodeRef,

    // Password Manager state
    passwordForm, setPasswordForm,
    passwordVisibility, setPasswordVisibility,
    passwordManagerFeedback, setPasswordManagerFeedback,
    pwFeedbackOpacity,
    pwFeedbackTimerRef,

    // API Lock gate state
    apiLockPasswordSet, setApiLockPasswordSet,
    apiLockPassword, setApiLockPassword,
    apiLockHint, setApiLockHint,
    apiLockGateVisible, setApiLockGateVisible,
    apiLockGatePassword, setApiLockGatePassword,
    apiLockGateAttempts, setApiLockGateAttempts,
    apiLockGateError, setApiLockGateError,
    removeLockBannerVisible, setRemoveLockBannerVisible,
    removeLockBannerPassword, setRemoveLockBannerPassword,
    removeLockBannerError, setRemoveLockBannerError,
    apiKeyVisibility, setApiKeyVisibility,

    // Reset auth state
    resetAuthVisible, setResetAuthVisible,
    resetAuthPassword, setResetAuthPassword,
    resetAuthError, setResetAuthError,
    resetAuthPendingAction, setResetAuthPendingAction,

    // User profile
    userProfile, setUserProfile,
    savedUserProfile, setSavedUserProfile,

    // Agent persona
    agentPersona, setAgentPersona,

    // Scroll helpers
    rememberSettingsScrollPosition,
    restoreSettingsScrollPosition,
    scrollSettingsPanelIntoView,
    scrollSocketIntoView,
    scrollTeamIntoView,

    // Panel handlers
    handleToggleSettingsPanel,
    closeSettings,
    closeAllSettingsPanels,

    // Password Manager handlers
    resetPasswordManagerDraft,
    updatePasswordForm,
    showPasswordFeedback,
    togglePasswordVisibility,
    toggleApiKeyVisibility,

    // API Lock handlers
    loadApiLockFromStorage,
    handleSetApiLockPassword,
    handleUpdateApiLockPassword,
    handleRemoveApiLockPassword,
    handleConfirmRemoveLock,
    resetApiLockGate,
    handleOpenApiPanel,
    handleUnlockApiPanel,

    // Reset auth handlers
    authenticateBeforeReset,
    handleConfirmResetAuth,
    handleDismissResetAuth,
    requestResetConfirmation,

    // User profile handlers
    loadUserProfileFromStorage,
    handleUpdateUserProfile,
    handleSaveUserProfileNow,
    handleResetUserProfile,

    // Agent persona handlers
    loadAgentPersonaFromStorage,
    handleUpdateAgentPersona,
  };
}
