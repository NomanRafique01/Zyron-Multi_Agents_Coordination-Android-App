/**
 * useAgentExecution.hook.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Agent pipeline execution and message submission logic for Zyron.
 *
 * Owns:
 *   • handleSend      — validates state, builds user message, fires agent execution
 *   • runAgentSimulation — async pipeline runner (calls runAgentsPipeline)
 *   • handleStop      — aborts the in-flight AbortController
 *   • handleRegenerate — removes last AI reply and re-runs the agent pipeline
 *   • handleSocketStatusChange — per-agent key status update callback
 *   • updateSimulatedAgents / clearSimulatedAgents — RAF-batched agent state
 *   • isTyping state, simulatedAgents state, coordinationMode state
 *   • abortControllerRef
 *
 * Returns everything MainApp needs to drive the chat interface.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback } from 'react';
import { Keyboard, InteractionManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { runAgentsPipeline, sanitizeErrorMessage, getModelDisplayName, COORDINATION_MODES, getActiveTeam } from '../utils/agentLogic.utils';

// ── Streaming message ID sentinel ────────────────────────────────────────────
// The streaming writer message is inserted under this ID so it can be found
// and replaced/updated without a full list scan on every token.
const STREAMING_MSG_ID = '__streaming_writer__';

/**
 * useAgentExecution
 *
 * @param {object} params
 * @param {object}   params.agentConfigs      — live agent config state
 * @param {function} params.setAgentConfigs   — state setter
 * @param {object}   params.teamRoleInfo      — active team role display info
 * @param {string}   params.activeTeamId      — active team ID
 * @param {string}   params.agentPersona      — active synthesis persona
 * @param {object}   params.userProfile       — user profile for prompts
 * @param {boolean}  params.isEngineLive      — whether coordination is active
 * @param {boolean}  params.isOffline         — whether device is offline
 * @param {array}    params.messages          — current messages list
 * @param {function} params.setMessages       — messages state setter
 * @param {function} params.saveActiveSessionMessages — persist messages
 * @param {function} params.showToast         — toast helper
 * @param {function} params.setShowSetupGuideModal — show first-run guide
 * @param {function} params.getMissingAgentsList — validation helper
 * @param {React.MutableRefObject} params.chatShouldStickToBottomRef
 * @param {React.MutableRefObject} params.latestAnswerFocusPendingRef
 */
export default function useAgentExecution({
  agentConfigs,
  setAgentConfigs,
  teamRoleInfo,
  activeTeamId,
  agentPersona,
  userProfile,
  isEngineLive,
  isOffline,
  messages,
  setMessages,
  saveActiveSessionMessages,
  showToast,
  setShowSetupGuideModal,
  getMissingAgentsList,
  chatShouldStickToBottomRef,
  latestAnswerFocusPendingRef,
}) {
  const [isTyping, setIsTyping] = useState(false);
  const [simulatedAgents, setSimulatedAgents] = useState([]);
  const [coordinationMode, setCoordinationMode] = useState(COORDINATION_MODES.FULL);
  const [inputText, setInputText] = useState('');
  const abortControllerRef = useRef(null);
  const simulatedAgentsRafRef = useRef(null);
  const pendingSimulatedAgentsRef = useRef(null);

  // ── Agent state update helpers ────────────────────────────────────────────
  const updateSimulatedAgents = useCallback((agents) => {
    pendingSimulatedAgentsRef.current = agents;
    if (simulatedAgentsRafRef.current) return;
    simulatedAgentsRafRef.current = requestAnimationFrame(() => {
      simulatedAgentsRafRef.current = null;
      if (pendingSimulatedAgentsRef.current) {
        setSimulatedAgents(pendingSimulatedAgentsRef.current);
        pendingSimulatedAgentsRef.current = null;
      }
    });
  }, []);

  const clearSimulatedAgents = useCallback(() => {
    pendingSimulatedAgentsRef.current = null;
    if (simulatedAgentsRafRef.current) {
      cancelAnimationFrame(simulatedAgentsRafRef.current);
      simulatedAgentsRafRef.current = null;
    }
    setSimulatedAgents([]);
    setCoordinationMode(COORDINATION_MODES.FULL);
  }, []);

  // ── Socket status change callback (per-agent key status) ─────────────────
  const handleSocketStatusChange = async (role, keyStatus, statusMessage = '') => {
    setAgentConfigs((prev) => {
      const updated = {
        ...prev,
        [role]: {
          ...prev[role],
          keyStatus,
          lastStatusMessage: statusMessage
        }
      };
      SecureStore.setItemAsync('zyron_AGENT_CONFIGS', JSON.stringify(updated)).catch((err) => {
        console.warn('Error saving socket status:', err);
      });
      return updated;
    });
  };

  // ── Streaming state refs ──────────────────────────────────────────────────
  // Using refs (not state) because they are updated on every token — state
  // updates would cause re-renders for every token which is too expensive.
  const streamingWriterTextRef = useRef('');
  const streamingInsertedRef = useRef(false);
  const streamingRafRef = useRef(null);          // RAF handle for batching token renders
  const streamingPendingFlushRef = useRef(false); // whether a flush is pending

  // ── Agent simulation runner ───────────────────────────────────────────────
  const runAgentSimulation = async (userText, activeMessagesList, sessionId) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Reset streaming state for this run
    streamingWriterTextRef.current = '';
    streamingInsertedRef.current = false;

    const getFormattedTime = () => {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    // ── onStreamDelta: called for every token from every agent role ──────────
    // We only surface the writer's tokens to the UI — specialist tokens drive
    // the progress bar only (via the orchestrator's streamProgress calls).
    const flushStreamToUI = () => {
      streamingRafRef.current = null;
      streamingPendingFlushRef.current = false;
      const currentText = streamingWriterTextRef.current;

      setMessages((prev) => {
        // First flush: insert the streaming placeholder message
        if (!streamingInsertedRef.current) {
          streamingInsertedRef.current = true;
          return [
            ...prev,
            {
              id: STREAMING_MSG_ID,
              sender: 'ai',
              text: currentText,
              codeLines: [],
              agents: [],
              tokenUsage: {},
              mode: 'agents',
              teamId: activeTeamId,
              teamName: getActiveTeam()?.name || 'Team',
              timestamp: getFormattedTime(),
              streaming: true,   // flag for ChatBubble to show live cursor
            },
          ];
        }

        // Subsequent flushes: update the existing streaming message in-place
        const realIdx = prev.findIndex((m) => m.id === STREAMING_MSG_ID);
        if (realIdx < 0) return prev;

        const updated = [...prev];
        updated[realIdx] = { ...updated[realIdx], text: currentText };
        return updated;
      });
    };

    const onStreamDelta = (role, chunk) => {
      if (role !== 'writer') return;  // only writer tokens go into the chat bubble

      streamingWriterTextRef.current += chunk;

      // Batch renders via RAF — at most one re-render per animation frame (~16 ms).
      // This prevents the UI from choking on fast providers (Groq: ~80 tokens/s).
      if (!streamingPendingFlushRef.current) {
        streamingPendingFlushRef.current = true;
        streamingRafRef.current = requestAnimationFrame(flushStreamToUI);
      }
    };

    try {
      const agentResult = await runAgentsPipeline(
        userText,
        agentConfigs,
        (updatedAgents, meta) => {
          updateSimulatedAgents(updatedAgents);
          if (meta?.coordinationMode) {
            setCoordinationMode(meta.coordinationMode);
          }
        },
        controller.signal,
        agentPersona,
        userProfile,
        handleSocketStatusChange,
        onStreamDelta
      );

      const finalText = agentResult.text || streamingWriterTextRef.current;
      const finalMsgId = String(Date.now() + 1);
      const newAiMsg = {
        id: finalMsgId,
        sender: 'ai',
        text: finalText,
        codeLines: [],
        agents: agentResult.agents,
        tokenUsage: agentResult.tokenUsage,
        mode: 'agents',
        teamId: activeTeamId,
        teamName: getActiveTeam()?.name || 'Team',
        timestamp: getFormattedTime(),
        streaming: false,
      };

      // Replace streaming placeholder (if any) with finalized message, or append
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === STREAMING_MSG_ID);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = newAiMsg;
          return updated;
        }
        return [...prev, newAiMsg];
      });

      latestAnswerFocusPendingRef.current = true;
      // Read current messages for persistence — use a ref snapshot
      const finalList = [...activeMessagesList, newAiMsg];
      saveActiveSessionMessages(finalList, '', sessionId);

    } catch (err) {
      if (err.name === 'AbortError' || err.message === 'Aborted') {
        console.log('Generation stopped by user.');
      } else {
        console.error('Generation failed:', err);

        // Collect all active keys for sanitization
        const allActiveKeys = Object.values(agentConfigs)
          .filter(c => c.key && c.key.trim())
          .map(c => c.key.trim());

        let errorText = 'The request could not be completed. Please try again.';
        if (err.message === 'ALL_USER_KEYS_EXHAUSTED') {
          errorText = 'All your custom API keys are exhausted. Please add active OpenRouter keys in Settings.';
        } else if (err.message === 'ALL_BUILTIN_KEYS_EXHAUSTED') {
          errorText = 'All built-in free API keys are rate-limited. Please configure your own OpenRouter keys in Settings.';
        } else if (err.message?.includes('exhausted') || err.message?.includes('rate-limited')) {
          errorText = sanitizeErrorMessage(err.message, allActiveKeys);
        } else {
          errorText = sanitizeErrorMessage(err.message || errorText, allActiveKeys);
        }

        const newErrorMsg = {
          id: String(Date.now() + 1),
          sender: 'ai',
          text: errorText,
          codeLines: [],
          agents: [],
          mode: 'agents',
          timestamp: getFormattedTime(),
        };

        // Remove any partial streaming message before showing the error
        setMessages((prev) => {
          const withoutStreaming = prev.filter((m) => m.id !== STREAMING_MSG_ID);
          return [...withoutStreaming, newErrorMsg];
        });

        latestAnswerFocusPendingRef.current = true;
        const errorList = [...activeMessagesList, newErrorMsg];
        saveActiveSessionMessages(errorList, '', sessionId);
      }
    } finally {
      // Cancel any pending RAF flush
      if (streamingRafRef.current) {
        cancelAnimationFrame(streamingRafRef.current);
        streamingRafRef.current = null;
      }
      streamingWriterTextRef.current = '';
      streamingInsertedRef.current = false;
      streamingPendingFlushRef.current = false;
      setIsTyping(false);
      clearSimulatedAgents();
      abortControllerRef.current = null;
    }
  };

  // ── Send message processing pipeline ─────────────────────────────────────
  const handleSend = () => {
    if (!inputText.trim() || isTyping) return;

    if (isOffline) {
      showToast('You\'re Offline', 'Reconnect to send messages.', 'warning');
      return;
    }

    if (!isEngineLive) {
      const hasAnyKeys = Object.values(agentConfigs).some(c => c.key && c.key.trim().length > 0);
      if (!hasAnyKeys) {
        setShowSetupGuideModal(true);
      } else {
        showToast('Coordination Inactive', 'Activate coordination in Settings first.', 'warning');
      }
      return;
    }

    const missing = getMissingAgentsList();
    if (missing.length > 0) {
      showToast('Missing API Keys', `Add keys for: ${missing.map((item) => item.split(' (')[0]).join(', ')}`, 'warning');
      return;
    }

    const userMsgText = inputText.trim();
    Keyboard.dismiss();
    const userMsg = {
      id: String(Date.now()),
      sender: 'user',
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
    };

    const newMessages = [...messages, userMsg];

    chatShouldStickToBottomRef.current = true;
    setMessages(newMessages);
    setInputText('');
    setIsTyping(true);
    setCoordinationMode(COORDINATION_MODES.FULL);
    setSimulatedAgents([
      { role: 'reasoner', name: agentConfigs.reasoner.name || teamRoleInfo.reasoner.name, model: getModelDisplayName(agentConfigs.reasoner, teamRoleInfo.reasoner.name), progress: 0, status: 'queued', statusColor: '#555566' },
      { role: 'coder', name: agentConfigs.coder.name || teamRoleInfo.coder.name, model: getModelDisplayName(agentConfigs.coder, teamRoleInfo.coder.name), progress: 0, status: 'queued', statusColor: '#555566' },
      { role: 'vision', name: agentConfigs.vision.name || teamRoleInfo.vision.name, model: getModelDisplayName(agentConfigs.vision, teamRoleInfo.vision.name), progress: 0, status: 'queued', statusColor: '#555566' },
      { role: 'writer', name: agentConfigs.writer.name || teamRoleInfo.writer.name, model: getModelDisplayName(agentConfigs.writer, teamRoleInfo.writer.name), progress: 0, status: 'queued', statusColor: '#555566' },
    ]);

    // Save prompt message immediately
    saveActiveSessionMessages(newMessages, userMsgText).then((sessionId) => {
      InteractionManager.runAfterInteractions(() => {
        runAgentSimulation(userMsgText, newMessages, sessionId);
      });
    });
  };

  // ── Stop in-flight generation ─────────────────────────────────────────────
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsTyping(false);
    clearSimulatedAgents();
  };

  // ── Regenerate: remove the AI message and re-run agents with same user text ─
  // Removes the AI message with the given id and its preceding user
  // message, then re-runs the agent pipeline with that user text.
  const handleRegenerate = useCallback((aiMsgId) => {
    if (isTyping) return;
    const idx = messages.findIndex((m) => m.id === aiMsgId);
    if (idx < 0) return;
    // Find the preceding user message
    let userMsg = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].sender === 'user') { userMsg = messages[i]; break; }
    }
    if (!userMsg) return;
    // Strip the AI response (and keep everything up to and including the user prompt)
    const listWithoutResponse = messages.slice(0, idx);
    chatShouldStickToBottomRef.current = true;
    setMessages(listWithoutResponse);
    setIsTyping(true);
    setCoordinationMode(COORDINATION_MODES.FULL);
    setSimulatedAgents([
      { role: 'reasoner', name: agentConfigs.reasoner.name || teamRoleInfo.reasoner.name, model: getModelDisplayName(agentConfigs.reasoner, teamRoleInfo.reasoner.name), progress: 0, status: 'queued', statusColor: '#555566' },
      { role: 'coder',    name: agentConfigs.coder.name    || teamRoleInfo.coder.name,    model: getModelDisplayName(agentConfigs.coder,    teamRoleInfo.coder.name),    progress: 0, status: 'queued', statusColor: '#555566' },
      { role: 'vision',   name: agentConfigs.vision.name   || teamRoleInfo.vision.name,   model: getModelDisplayName(agentConfigs.vision,   teamRoleInfo.vision.name),   progress: 0, status: 'queued', statusColor: '#555566' },
      { role: 'writer',   name: agentConfigs.writer.name   || teamRoleInfo.writer.name,   model: getModelDisplayName(agentConfigs.writer,   teamRoleInfo.writer.name),   progress: 0, status: 'queued', statusColor: '#555566' },
    ]);
    saveActiveSessionMessages(listWithoutResponse, userMsg.text).then((sessionId) => {
      InteractionManager.runAfterInteractions(() => {
        runAgentSimulation(userMsg.text, listWithoutResponse, sessionId);
      });
    });
  }, [isTyping, messages, agentConfigs, teamRoleInfo]);

  return {
    isTyping,
    setIsTyping,
    simulatedAgents,
    setSimulatedAgents,
    coordinationMode,
    setCoordinationMode,
    inputText,
    setInputText,
    abortControllerRef,
    updateSimulatedAgents,
    clearSimulatedAgents,
    handleSocketStatusChange,
    runAgentSimulation,
    handleSend,
    handleStop,
    handleRegenerate,
  };
}
