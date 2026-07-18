/**
 * MainApp.js  (composition root)
 * ─────────────────────────────────────────────────────────────────────────────
 * Orchestrates all Zyron features by composing extracted hooks and components.
 * This file owns only:
 *   • Mounting / boot sequence (initDb, network, engine live state)
 *   • Refs shared across multiple subsystems (scrollRef, inputRef, sidebarAnim)
 *   • Header glow / offline / socket-live animations
 *   • Auto-focus welcome-screen input (Android)
 *   • Chat scroll helpers (pinned-to-bottom, coordination table scroll)
 *   • The JSX tree that wires everything together
 *   • renderToast() using values from useToast
 *
 * All domain logic lives in the hooks below — see their individual files
 * for full API docs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { StatusBar } from 'expo-status-bar';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Text,
  View,
  ScrollView,
  Platform,
  Keyboard,
  LayoutAnimation,
  UIManager,
  InteractionManager,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { initDb, deleteAllMessages, loadMessages } from '../../database/db.init';
import * as SecureStore from 'expo-secure-store';

import C from '../../config/colors.config';
import s from '../../styles/app.styles';
import Header from '../../components/layout/Header.component.jsx';
import InputBar from '../../components/input/InputBar.component.jsx';
import ChatMessageList from '../../components/chat/ChatMessageList.component.jsx';

import {
  AGENTS_TEAMS,
  getTeamById,
  getTeamByIdUnified,
  getTeamRoleInfo,
  COORDINATION_MODES,
  DEFAULT_TEAM_ID,
} from '../../utils/agentLogic.utils';
import {
  GearIcon, CrossIcon, KeyIcon, ShieldIcon, InfoIcon,
  UserIcon, LockIcon, BoltIcon, TrashIcon, EyeIcon, EyeOffIcon,
} from '../../components/shared/Icons';
import {
  DEFAULT_AGENT_CONFIGS,
  DEFAULT_USER_PROFILE,
  OPENROUTER_MODEL_PRESETS,
  DEEPSEEK_MODEL_PRESETS,
  GROQ_MODEL_PRESETS,
  GLM_MODEL_PRESETS,
  getLocalWelcomeGreeting,
} from '../../config/appConfig';
import { AGENT_PERSONA_OPTIONS } from '../../config/agentPersona.config.js';
import { scale, verticalScale, spacing } from '../../utils/responsive.utils';

// ── Extracted hooks ──────────────────────────────────────────────────────────
import useKeyboardLayout from '../../modules/keyboard/useKeyboardLayout.hook.js';
import useToast from '../../hooks/useToast.hook.js';
import useConversations from '../../hooks/useConversations.hook.js';
import useAgentExecution from '../../hooks/useAgentExecution.hook.js';
import useAgentSockets from '../../hooks/useAgentSockets.hook.js';
import useSettings from '../../hooks/useSettings.hook.js';
import { bootstrapCustomTeams } from '../../agents/workshop/customTeamRegistry';

// ── Extracted components ─────────────────────────────────────────────────────
import WelcomeLogo from '../../components/shared/WelcomeLogo.component.jsx';
import SidebarDrawer from '../../components/layout/SidebarDrawer.component.jsx';
import SetupGuideModal from '../../components/modals/SetupGuideModal.modal.jsx';
import ConfirmDialog from '../../components/modals/ConfirmDialog.modal.jsx';
import SettingsModal from '../settings/SettingsModal.screen.jsx';
import LiveTalkModal from '../../components/modals/NeuralNetLiveTalk.component.jsx';
import useLiveTalk from '../../hooks/useLiveTalk.hook.js';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function MainApp({ splashVisible = true, currentUser = null, onSignedOut }) {
  const insets = useSafeAreaInsets();
  const safeBottom = Platform.OS === 'android' ? Math.max(insets.bottom, navBarHeightRef?.current ?? 0) : insets.bottom;

  // ── Shared cross-subsystem refs ──────────────────────────────────────────
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const chatShouldStickToBottomRef = useRef(true);
  const chatScrollRafRef = useRef(null);
  const chatAutoScrollTimersRef = useRef([]);
  const chatViewportHeightRef = useRef(0);
  const chatContentHeightRef = useRef(0);
  const coordinationFooterLayoutRef = useRef({ y: 0, height: 0 });
  const coordinationScrollRafRef = useRef(null);
  const coordinationScrollLockedRef = useRef(false);
  const latestAnswerFocusPendingRef = useRef(false);
  const restoringConversationRef = useRef(false);
  const autoFocusedRef = useRef(false);
  const sidebarAnim = useRef(new Animated.Value(-280)).current;

  // ── App-level state ──────────────────────────────────────────────────────
  const [isOffline, setIsOffline] = useState(false);
  const [isEngineLive, setIsEngineLive] = useState(false);
  const [showSetupGuideModal, setShowSetupGuideModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(false);
  const [visualMode, setVisualMode] = useState(false);
  const [liveTalkVisible, setLiveTalkVisible] = useState(false);

  // Sidebar search query (string)
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');

  const contentBottomClearance = spacing(12);

  // ── Socket-live border animation value ───────────────────────────────────
  const socketLiveBorderAnim = useRef(new Animated.Value(0)).current;

  // ── Keyboard layout hook (isolated keyboard module) ──────────────────────
  const {
    // v1 fields
    keyboardVisible,
    keyboardVisibleRef,
    lastKeyboardHeightRef,
    lastKeyboardEventRef,
    baselineWindowHeightRef,
    navBarHeightRef,
    COMPOSER_SAFETY_BUFFER,
    // v2 fields
    keyboardHeight,
    keyboardProgress,
    keyboardState,
    isFloatingKeyboard,
    isHardwareKeyboard,
    // v3 fields — Huawei / adjustResize fallback
    adjustResizeFailed,
    keyboardAvoidingPadding,
  } = useKeyboardLayout(insets.bottom, inputRef);

  // ── Toast hook ───────────────────────────────────────────────────────────
  const {
    toast,
    toastOpacity,
    toastPan,
    panResponder,
    showToast,
    dismissToast,
    toastTimerRef,
  } = useToast();

  // ── Settings hook ────────────────────────────────────────────────────────
  const settings = useSettings({ showToast });

  // ── Agent sockets hook ───────────────────────────────────────────────────
  const sockets = useAgentSockets({
    showToast,
    showConfirmDialog: (opts) => setConfirmDialog(opts),
    isEngineLive,
    setIsEngineLive,
  });

  // Derived engine active flag — true only when all four agents are active
  const isEngineActive = useMemo(() =>
    sockets.agentConfigs.reasoner?.active &&
    sockets.agentConfigs.coder?.active &&
    sockets.agentConfigs.vision?.active &&
    sockets.agentConfigs.writer?.active,
    [sockets.agentConfigs]
  );

  const activeTeam = useMemo(() =>
    sockets.activeTeamId
      ? getTeamByIdUnified(sockets.activeTeamId)
      : { name: 'No Team', agents: { reasoner: { name: '', icon: '🔌' }, coder: { name: '', icon: '🔌' }, vision: { name: '', icon: '🔌' }, writer: { name: '', icon: '🔌' } } },
    [sockets.activeTeamId]
  );

  const teamRoleInfo = useMemo(() =>
    sockets.activeTeamId
      ? getTeamRoleInfo(activeTeam)
      : { reasoner: { name: 'Agent 1', socketLabel: 'Agent 1', icon: '🔌' }, coder: { name: 'Agent 2', socketLabel: 'Agent 2', icon: '🔌' }, vision: { name: 'Agent 3', socketLabel: 'Agent 3', icon: '🔌' }, writer: { name: 'Agent 4', socketLabel: 'Agent 4', icon: '🔌' } },
    [activeTeam, sockets.activeTeamId]
  );

  const getMissingAgentsList = () => {
    const missing = [];
    const roleInfo = {
      reasoner: { name: teamRoleInfo.reasoner.name, socket: 'Agent 1' },
      coder: { name: teamRoleInfo.coder.name, socket: 'Agent 2' },
      vision: { name: teamRoleInfo.vision.name, socket: 'Agent 3' },
      writer: { name: teamRoleInfo.writer.name, socket: 'Agent 4' },
    };
    ['reasoner', 'coder', 'vision', 'writer'].forEach(role => {
      const config = sockets.agentConfigs[role];
      if (!config || !config.key || !config.key.trim()) {
        missing.push(`${roleInfo[role].name} (${roleInfo[role].socket})`);
      }
    });
    return missing;
  };

  // ── Scroll helpers (shared by conversations + agents) ─────────────────────
  const scrollConversationToEnd = useCallback(() => {
    chatShouldStickToBottomRef.current = true;
    scrollRef.current?.scrollToEnd({ animated: false });
  }, []);

  // ── Conversations hook ───────────────────────────────────────────────────
  const conversations = useConversations({
    showConfirmDialog: (opts) => setConfirmDialog(opts),
    showToast,
    restoringConversationRef,
    chatShouldStickToBottomRef,
    scrollConversationToEnd,
    autoFocusedRef,
  });

  // ── Agent execution hook ─────────────────────────────────────────────────
  const agentExec = useAgentExecution({
    agentConfigs: sockets.agentConfigs,
    setAgentConfigs: sockets.setAgentConfigs,
    teamRoleInfo,
    activeTeamId: sockets.activeTeamId,
    agentPersona: settings.agentPersona,
    userProfile: settings.userProfile,
    isEngineLive,
    isOffline,
    messages: conversations.messages,
    setMessages: conversations.setMessages,
    saveActiveSessionMessages: conversations.saveActiveSessionMessages,
    showToast,
    setShowSetupGuideModal,
    getMissingAgentsList,
    chatShouldStickToBottomRef,
    latestAnswerFocusPendingRef,
  });

  // ── Live Talk hook ───────────────────────────────────────────────────────
  const liveTalk = useLiveTalk({
    agentConfigs: sockets.agentConfigs,
    onClose: useCallback(() => {
      // Auto-close (wait-timeout): close the modal AND clear the input bar
      // so voice text never bleeds into the composer.
      setLiveTalkVisible(false);
      agentExec.setInputText('');
    }, [agentExec]),
  });

  const handleOpenLiveTalk = useCallback(() => {
    setLiveTalkVisible(true);
  }, []);

  // Auto-start listening when the modal opens
  const prevLiveTalkVisible = useRef(false);
  useEffect(() => {
    if (liveTalkVisible && !prevLiveTalkVisible.current) {
      liveTalk.start();
    }
    prevLiveTalkVisible.current = liveTalkVisible;
  }, [liveTalkVisible, liveTalk]);

  // ── Close live talk: clear input bar ────────────────────────────────────
  const handleCloseLiveTalkWithSession = useCallback(() => {
    liveTalk.stop();
    setLiveTalkVisible(false);
    // Clear any text sitting in the main input bar — voice input is
    // independent and should not bleed into the composer.
    agentExec.setInputText('');
  }, [liveTalk, agentExec]);

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    // Defer all heavy boot I/O until after the first frame is painted.
    // On low-RAM devices (Huawei Y7, budget Android) this prevents the JS
    // thread from being blocked during the critical initial render, which
    // shows up as a black or frozen screen before the splash even appears.
    const task = InteractionManager.runAfterInteractions(() => {
      const bootstrap = async () => {
        // Await DB init first — every subsequent storage call depends on it.
        // Do NOT fire-and-forget: a race here causes blank conversations on cold launch.
        try {
          await initDb();
        } catch (err) {
          console.warn('[db] initDb error:', err);
        }
        // DB is ready — load everything else in parallel
        conversations.loadConversationsIndex();
        // Bootstrap custom teams FIRST so any saved custom team id is resolvable
        // before loadActiveTeamFromStorage calls initActiveTeam.
        try { await bootstrapCustomTeams(); } catch {}
        sockets.loadActiveTeamFromStorage()
          .then(() => sockets.loadAgentConfigsFromStorage())
          .catch((err) => console.warn('[bootstrap] settings error:', err));
        settings.loadUserProfileFromStorage();
        settings.loadAgentPersonaFromStorage();
        settings.loadApiLockFromStorage();
      };
      bootstrap();
    });

    // Load engine live state eagerly (fast, single AsyncStorage read — does not block render)
    AsyncStorage.getItem('zyron_ENGINE_LIVE')
      .then((val) => setIsEngineLive(val === 'true'))
      .catch((err) => console.warn('Error loading engine live state:', err));

    // Listen to network status
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });

    return () => {
      task.cancel();
      unsubscribeNet();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (settings.settingsCenterTimerRef.current) clearTimeout(settings.settingsCenterTimerRef.current);
      if (settings.pwFeedbackTimerRef.current) clearTimeout(settings.pwFeedbackTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insets.bottom]);

  // ── Auto-activate coordination when all agents become active ─────────────
  useEffect(() => {
    if (isEngineActive && !isEngineLive) {
      setIsEngineLive(true);
      AsyncStorage.setItem('zyron_ENGINE_LIVE', 'true').catch((err) =>
        console.warn('[auto-coordination] persist failed:', err)
      );
      showToast('Coordination Active', 'All agents are live — coordination started automatically.', 'success');
    }
  }, [isEngineActive, isEngineLive]);

  // ── Socket-live border animation ─────────────────────────────────────────
  useEffect(() => {
    Animated.timing(socketLiveBorderAnim, {
      toValue: isEngineLive ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [isEngineLive, socketLiveBorderAnim]);

  // ── Handle network drops during coordination ──────────────────────────────
  useEffect(() => {
    if (isOffline && agentExec.isTyping) {
      if (agentExec.abortControllerRef.current) {
        agentExec.abortControllerRef.current.abort();
      }
      agentExec.setIsTyping(false);
      agentExec.clearSimulatedAgents();
      showToast('Connection Lost', 'Internet lost. Coordination paused.', 'warning');
    }
  }, [isOffline, agentExec.isTyping]);

  // ── Auto-focus input on welcome screen (Android) ─────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (splashVisible) return;
    if (autoFocusedRef.current) return;
    if (conversations.messages.length > 0 || conversations.currentSessionId) return;
    autoFocusedRef.current = true;
    const t = setTimeout(() => {
      inputRef.current?.focus();
    }, 420);
    return () => clearTimeout(t);
  }, [splashVisible, conversations.messages.length, conversations.currentSessionId]);

  // ── Sidebar slide animation ───────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: sidebarOpen ? 0 : -280,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [sidebarOpen]);

  // ── Chat scroll helpers ───────────────────────────────────────────────────
  const handleChatScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    chatShouldStickToBottomRef.current = distanceFromBottom < 120;
  }, []);

  const scrollChatToBottomIfPinned = useCallback((animated = true) => {
    if (!chatShouldStickToBottomRef.current) return;
    if (chatScrollRafRef.current) return;
    chatScrollRafRef.current = requestAnimationFrame(() => {
      chatScrollRafRef.current = null;
      if (chatShouldStickToBottomRef.current) {
        scrollRef.current?.scrollToEnd({ animated });
      }
    });
  }, []);

  const scrollCoordinationTableIntoView = useCallback((animated = true) => {
    if (!agentExec.isTyping || coordinationScrollLockedRef.current) return;
    const tableHeight = coordinationFooterLayoutRef.current.height || 0;
    if (!tableHeight) return;
    if (coordinationScrollRafRef.current) cancelAnimationFrame(coordinationScrollRafRef.current);
    coordinationScrollRafRef.current = requestAnimationFrame(() => {
      coordinationScrollRafRef.current = null;
      const viewportHeight = chatViewportHeightRef.current;
      const contentHeight = chatContentHeightRef.current;
      const bottomPadding = contentBottomClearance + verticalScale(76);
      if (!viewportHeight || !contentHeight) return;
      const tableTopY = contentHeight - bottomPadding - tableHeight;
      const topMargin = spacing(16);
      const maxOffset = Math.max(0, contentHeight - viewportHeight);
      const targetOffset = Math.min(maxOffset, Math.max(0, tableTopY - topMargin));
      coordinationScrollLockedRef.current = true;
      scrollRef.current?.scrollToOffset({ offset: targetOffset, animated });
    });
  }, [agentExec.isTyping, contentBottomClearance]);

  const focusLatestAnswer = useCallback((animated = true) => {
    const viewportHeight = chatViewportHeightRef.current;
    const contentHeight = chatContentHeightRef.current;
    if (!viewportHeight || !contentHeight) return;
    const visibleReadingRoom = Math.max(0, viewportHeight - contentBottomClearance);
    const targetOffset = Math.max(
      0,
      contentHeight - contentBottomClearance - Math.max(verticalScale(220), visibleReadingRoom * 0.72)
    );
    chatShouldStickToBottomRef.current = true;
    scrollRef.current?.scrollToOffset({ offset: targetOffset, animated });
  }, [contentBottomClearance]);

  const handleChatLayout = useCallback((event) => {
    chatViewportHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  const handleCoordinationLayout = useCallback((event) => {
    coordinationFooterLayoutRef.current = event.nativeEvent.layout;
    if (agentExec.isTyping) scrollCoordinationTableIntoView(true);
  }, [agentExec.isTyping, scrollCoordinationTableIntoView]);

  const handleChatContentSizeChange = useCallback((_width, height) => {
    chatContentHeightRef.current = height;
    if (agentExec.isTyping) { scrollCoordinationTableIntoView(true); return; }
    if (latestAnswerFocusPendingRef.current) {
      latestAnswerFocusPendingRef.current = false;
      focusLatestAnswer(true);
      return;
    }
    if (restoringConversationRef.current) {
      scrollRef.current?.scrollToEnd({ animated: false });
      restoringConversationRef.current = false;
      return;
    }
    scrollChatToBottomIfPinned(false);
  }, [agentExec.isTyping, scrollCoordinationTableIntoView, scrollChatToBottomIfPinned, focusLatestAnswer]);

  // Scroll to bottom when keyboard fully opens (OPEN state avoids a spurious
  // scroll on the OPENING → OPEN transition when the keyboard is floating).
  useEffect(() => {
    if (isFloatingKeyboard || isHardwareKeyboard) return;
    if (!keyboardVisible || conversations.messages.length === 0) return;
    scrollChatToBottomIfPinned(false);
  }, [keyboardVisible, keyboardState, isFloatingKeyboard, isHardwareKeyboard, conversations.messages.length, scrollChatToBottomIfPinned]);

  // Scroll management during coordination
  useEffect(() => {
    if (!agentExec.isTyping) { coordinationScrollLockedRef.current = false; return; }
    chatShouldStickToBottomRef.current = true;
    coordinationScrollLockedRef.current = false;
  }, [agentExec.isTyping]);

  useEffect(() => {
    if (!agentExec.isTyping && latestAnswerFocusPendingRef.current) {
      latestAnswerFocusPendingRef.current = false;
      requestAnimationFrame(() => focusLatestAnswer(true));
      return;
    }
    if (restoringConversationRef.current || agentExec.isTyping) return;
    scrollChatToBottomIfPinned(false);
  }, [conversations.messages, agentExec.isTyping, scrollChatToBottomIfPinned, focusLatestAnswer]);

  // On welcome screen (Android), handle input press
  const handleWelcomeInputPressIn = useCallback(() => {
    // No-op — composer stays visible
  }, [conversations.messages.length, conversations.currentSessionId]);

  // ── Reset data handler (lives here because it touches multiple hooks) ─────
  const handleClearAllData = async () => {
    try {
      await deleteAllMessages();
      const allKeys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(allKeys);
      await SecureStore.deleteItemAsync('zyron_AGENT_CONFIGS');

      conversations.setMessages([]);
      conversations.setConversations([]);
      sockets.setAgentConfigs(DEFAULT_AGENT_CONFIGS);
      settings.setUserProfile(DEFAULT_USER_PROFILE);
      settings.setSavedUserProfile(DEFAULT_USER_PROFILE);
      conversations.setCurrentSessionId(null);
      conversations.setMessageOffset(0);
      conversations.setHasMoreMessages(false);
      settings.setSettingsVisible(false);
      settings.closeAllSettingsPanels(() => {
        sockets.setExpandedAgent(null);
        sockets.setVerificationResult({ role: null, success: null, message: '' });
      });
      setSidebarOpen(false);
      showToast('Reset Complete', 'Zyron reset to default.', 'success');
    } catch (err) {
      console.warn('Wipe failed:', err);
      showToast('Reset Failed', 'Could not clear local data.', 'error');
    }
  };

  const handleDeleteAllChats = async () => {
    try {
      await deleteAllMessages();
      await AsyncStorage.removeItem('zyron_CONVERSATIONS');
      const allKeys = await AsyncStorage.getAllKeys();
      const legacyKeys = allKeys.filter((k) => k.startsWith('zyron_MESSAGES_'));
      if (legacyKeys.length > 0) await AsyncStorage.multiRemove(legacyKeys);
      conversations.setMessages([]);
      conversations.setConversations([]);
      conversations.setCurrentSessionId(null);
      conversations.setMessageOffset(0);
      conversations.setHasMoreMessages(false);
      setSidebarOpen(false);
      showToast('Chats Deleted', 'Chat history cleared.', 'success');
    } catch (err) {
      console.warn('Delete chats failed:', err);
      showToast('Delete Failed', 'Could not clear chat history.', 'error');
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const welcomeGreeting = getLocalWelcomeGreeting(settings.userProfile.displayName);
  const profileHasUnsavedChanges = JSON.stringify(settings.userProfile) !== JSON.stringify(settings.savedUserProfile);
  const activeAgentPersona = AGENT_PERSONA_OPTIONS.find((o) => o.key === settings.agentPersona) || AGENT_PERSONA_OPTIONS[0];

  // ── renderToast ───────────────────────────────────────────────────────────
  const renderToast = () => {
    if (!toast) return null;
    // opacity uses useNativeDriver:true; translateX/Y use useNativeDriver:false.
    // React Native forbids mixing both drivers on the same Animated.View node —
    // Fix: nest two Animated.Views so each node only ever sees values from a single driver.
    return (
      // Outer — opacity only (native driver)
      <Animated.View
        style={{
          position: 'absolute',
          top: insets.top + 14,
          left: 0,
          right: 0,
          zIndex: 99999,
          elevation: 99999,
          opacity: toastOpacity,
        }}
      >
        {/* Inner — transform only (JS driver) + pan gesture */}
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            paddingHorizontal: 16,
            alignItems: 'center',
            transform: [
              { translateX: toastPan.x },
              { translateY: toastPan.y },
            ],
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={dismissToast}
            style={{ width: '100%', maxWidth: 520 }}
          >
            <View style={s.toastCard}>
              <View style={s.toastMarker}>
                <Image source={require('../../../assets/images/logo.png')} style={s.toastLogoImage} resizeMode="cover" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.toastTitle} numberOfLines={1}>{toast?.title}</Text>
                {toast?.message ? <Text style={s.toastMessage} numberOfLines={2}>{toast.message}</Text> : null}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <View style={s.rootContainer}>
      <StatusBar style="light" translucent={false} backgroundColor={C.bgHeader} />

      {/* Top dynamic safe area spacer */}
      <View style={[s.statusBarSpacer, { height: insets.top, backgroundColor: C.bgHeader }]} />

      {/* Main UI layout */}
      <View style={s.mainWrapper}>
        <LinearGradient
          colors={['#12121A', '#10101A', '#0E0E18', '#0E0E18']}
          locations={[0, 0.24, 0.58, 1]}
          style={[s.screenBackdrop, { pointerEvents: 'none' }]}
        />

        {/* HEADER SECTION */}
        <Header
          onToggleSidebar={() => { Keyboard.dismiss(); setSidebarOpen(!sidebarOpen); }}
          isOffline={isOffline}
          onOpenSettings={() => {
            settings.settingsScrollOffsetRef.current = 0;
            settings.setApiPanelOpen(false);
            settings.setPasswordPanelOpen(false);
            settings.setProfilePanelOpen(false);
            settings.setPrivacyPanelOpen(false);
            settings.setAboutPanelOpen(false);
            settings.setResetPanelOpen(false);
            sockets.setExpandedAgent(null);
            sockets.setVerificationResult({ role: null, success: null, message: '' });
            settings.resetPasswordManagerDraft();
            settings.setSettingsVisible(true);
          }}
        />

        {/* CHAT INTERFACE AREA
            Android: plain View — softwareKeyboardLayoutMode="resize" (app.json) shrinks
            the OS window height when the keyboard opens, exactly like ChatGPT / Claude.
            KeyboardAvoidingView with behavior="height" on Android fights that OS resize
            and produces a double-offset gap. iOS keeps standard padding behavior.

            Huawei / OEM adjustResize fallback:
            On devices that ignore adjustResize (Huawei EMUI, some Xiaomi/Oppo/Vivo ROMs)
            the window never shrinks. `adjustResizeFailed` is set true by the hook and
            `keyboardAvoidingPadding` is applied as explicit paddingBottom on the chatShell
            so the flex layout manually pushes the composer above the keyboard.
            This is a no-op on well-behaved devices (keyboardAvoidingPadding === 0). */}
        {Platform.OS === 'android' ? (
          /* ── ANDROID PATH ────────────────────────────────────────────────────────── */
          <>
            {/* Welcome hero — pinned absolutely inside mainWrapper so it is
                completely outside the chatShell flex flow. It never moves when
                keyboard opens — whether via OS resize or manual JS padding. */}
            {conversations.messages.length === 0 && !conversations.currentSessionId && !conversations.chatLoading && (
              <View style={[s.welcomeHeroAnchor, { pointerEvents: 'none' }]}>
                <View style={s.welcomeContent}>
                  <WelcomeLogo isOffline={isOffline} />
                  <Text style={s.welcomeHeading}>{welcomeGreeting.title}</Text>
                  <Text style={s.welcomeSubHeading}>{welcomeGreeting.subtitle}</Text>
                </View>
              </View>
            )}

            <View style={[
              s.chatShell,
              adjustResizeFailed && keyboardAvoidingPadding > 0
                ? { paddingBottom: keyboardAvoidingPadding }
                : null,
            ]}>
              {/* On welcome screen: empty flex placeholder keeps composer at bottom.
                  On chat screen: normal message list. */}
              <View style={{ flex: 1 }}>
                {conversations.messages.length > 0 || conversations.currentSessionId ? (
                  <View style={s.chatConversation}>
                    <ChatMessageList
                      listRef={scrollRef}
                      messages={conversations.messages}
                      isTyping={agentExec.isTyping}
                      simulatedAgents={agentExec.simulatedAgents}
                      coordinationMode={agentExec.coordinationMode}
                      lastTokenUsage={agentExec.lastTokenUsage}
                      onScroll={handleChatScroll}
                      onLayout={handleChatLayout}
                      onCoordinationLayout={handleCoordinationLayout}
                      onContentSizeChange={handleChatContentSizeChange}
                      contentBottomPadding={contentBottomClearance + (agentExec.isTyping ? verticalScale(76) : 0)}
                      onRegenerate={agentExec.handleRegenerate}
                    />
                  </View>
                ) : null}
              </View>

              {/* Composer — extra safe clearance when hardware keyboard active */}
              <View style={[
                s.composerDock,
                { paddingBottom: isHardwareKeyboard ? spacing(8) : Math.max(spacing(4), safeBottom) },
              ]}>
                <InputBar
                  inputRef={inputRef}
                  inputText={agentExec.inputText}
                  setInputText={agentExec.setInputText}
                  isTyping={agentExec.isTyping}
                  onSend={agentExec.handleSend}
                  onStop={agentExec.handleStop}
                  keyboardVisible={keyboardVisible}
                  simulatedAgents={agentExec.simulatedAgents}
                  offline={isOffline}
                  loading={conversations.chatLoading}
                  floating={conversations.messages.length === 0}
                  chatMode={conversations.messages.length > 0}
                  docked
                  onInputPressIn={handleWelcomeInputPressIn}
                  placeholder={conversations.messages.length === 0 ? 'Ask anything' : 'Ask Zyron'}
                  onLiveTalk={handleOpenLiveTalk}
                />
              </View>

              {/* Full-area loading overlay */}
              {conversations.chatLoading && (
                <View style={[s.chatLoadingOverlay, { pointerEvents: 'box-none' }]}>
                  <View style={[s.chatLoadingCard, { pointerEvents: 'none' }]}>
                    <ActivityIndicator size="large" color="#7B2FFF" />
                    <Text style={s.chatLoadingText}>Loading conversation…</Text>
                  </View>
                </View>
              )}
            </View>
          </>
        ) : (
          /* ── iOS PATH ────────────────────────────────────────────────────────────── */
          <KeyboardAvoidingView
            style={s.chatShell}
            behavior="padding"
            keyboardVerticalOffset={insets.top + 68 + 5}
          >
            <View style={{ flex: 1 }}>
              {conversations.messages.length === 0 && !conversations.currentSessionId ? (
                <View style={[s.welcomeContainer, { paddingBottom: contentBottomClearance }]}>
                  <View style={s.welcomeHeroStatic}>
                    <View style={s.welcomeContent}>
                      <WelcomeLogo isOffline={isOffline} />
                      <Text style={s.welcomeHeading}>{welcomeGreeting.title}</Text>
                      <Text style={s.welcomeSubHeading}>{welcomeGreeting.subtitle}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={s.chatConversation}>
                  <ChatMessageList
                    listRef={scrollRef}
                    messages={conversations.messages}
                    isTyping={agentExec.isTyping}
                    simulatedAgents={agentExec.simulatedAgents}
                    coordinationMode={agentExec.coordinationMode}
                    lastTokenUsage={agentExec.lastTokenUsage}
                    onScroll={handleChatScroll}
                    onLayout={handleChatLayout}
                    onCoordinationLayout={handleCoordinationLayout}
                    onContentSizeChange={handleChatContentSizeChange}
                    contentBottomPadding={contentBottomClearance + (agentExec.isTyping ? verticalScale(76) : 0)}
                    onRegenerate={agentExec.handleRegenerate}
                  />
                </View>
              )}
            </View>

            <View style={[s.composerDock, { paddingBottom: spacing(8) }]}>
              <InputBar
                inputRef={inputRef}
                inputText={agentExec.inputText}
                setInputText={agentExec.setInputText}
                isTyping={agentExec.isTyping}
                onSend={agentExec.handleSend}
                onStop={agentExec.handleStop}
                keyboardVisible={keyboardVisible}
                simulatedAgents={agentExec.simulatedAgents}
                offline={isOffline}
                loading={conversations.chatLoading}
                floating={conversations.messages.length === 0}
                chatMode={conversations.messages.length > 0}
                docked
                placeholder={conversations.messages.length === 0 ? 'Ask anything' : 'Ask Zyron'}
                onLiveTalk={handleOpenLiveTalk}
                liveTalkActive={liveTalkVisible}
              />
            </View>

            {conversations.chatLoading && (
              <View style={[s.chatLoadingOverlay, { pointerEvents: 'box-none' }]}>
                <View style={[s.chatLoadingCard, { pointerEvents: 'none' }]}>
                  <ActivityIndicator size="large" color="#7B2FFF" />
                  <Text style={s.chatLoadingText}>Loading conversation…</Text>
                </View>
              </View>
            )}
          </KeyboardAvoidingView>
        )}
      </View>

      {/* LEFT DRAWER: PREMIUM CHAT HISTORY SIDEBAR */}
      <SidebarDrawer
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sidebarAnim={sidebarAnim}
        conversations={conversations.conversations}
        currentSessionId={conversations.currentSessionId}
        searchQuery={sidebarSearchQuery}
        setSearchQuery={setSidebarSearchQuery}
        onSelectConversation={(id) => { conversations.selectConversation(id); setSidebarOpen(false); }}
        onDeleteSession={conversations.handleDeleteSession}
        onNewChat={() => { conversations.handleNewChat(); setSidebarOpen(false); }}
      />

      {/* SETTINGS DRAWER MODAL SCREEN */}
      <SettingsModal
        settings={settings}
        sockets={sockets}
        isEngineLive={isEngineLive}
        activeTeam={activeTeam}
        teamRoleInfo={teamRoleInfo}
        showToast={showToast}
        showConfirmDialog={(opts) => setConfirmDialog(opts)}
        handleClearAllData={handleClearAllData}
        handleDeleteAllChats={handleDeleteAllChats}
        handleDeactivateAllApiKeys={sockets.handleDeactivateAllApiKeys}
        handleDeleteSavedApiKeys={sockets.handleDeleteSavedApiKeys}
        getMissingAgentsList={getMissingAgentsList}
        currentUser={currentUser}
        onSignedOut={onSignedOut}
        renderToast={renderToast}
      />

      {/* SETUP GUIDE BLUR MODAL */}
      <SetupGuideModal
        visible={showSetupGuideModal}
        onClose={() => setShowSetupGuideModal(false)}
        onOpenSettings={() => {
          settings.settingsScrollOffsetRef.current = 0;
          setShowSetupGuideModal(false);
          settings.setSettingsVisible(true);
          setTimeout(() => {
            settings.handleToggleSettingsPanel('agentLibrary');
          }, 300);
        }}
      />

      {/* Global toast (outside settings modal) */}
      {!settings.settingsVisible && renderToast()}

      {/* Confirm dialog */}
      <ConfirmDialog
        confirmDialog={confirmDialog}
        onClose={() => setConfirmDialog(null)}
      />

      {/* LIVE TALK OVERLAY */}
      <LiveTalkModal
        visible={liveTalkVisible}
        phase={liveTalk.phase}
        volumeRef={liveTalk.volumeRef}
        transcript={liveTalk.transcript}
        errorMsg={liveTalk.errorMsg}
        waitCountdown={liveTalk.waitCountdown}
        onStop={handleCloseLiveTalkWithSession}
        onInterrupt={liveTalk.interruptAI}
      />
    </View>
  );
}
