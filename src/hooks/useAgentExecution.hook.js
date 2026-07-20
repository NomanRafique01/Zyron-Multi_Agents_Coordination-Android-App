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

// ── Document extraction helpers (moved from InputBar — runs on Send) ──────────
const BACKEND_URL = 'https://zyron-production-7af1.up.railway.app';

const _uriToBase64 = async (uri) => {
  const res = await fetch(uri);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

/**
 * extractDocumentText
 * Attempts backend extraction first, falls back to TXT-only frontend read.
 * @param {{ uri: string, filename: string, mimeType: string }} doc
 * @returns {Promise<{ text: string|null, thumbnail: string|null }>}
 */
const extractDocumentText = async ({ uri, filename, mimeType }) => {
  // ── Backend ────────────────────────────────────────────────────────────────
  try {
    const base64Data = await _uriToBase64(uri);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(`${BACKEND_URL}/extract-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, base64Data, mimeType }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (response.ok) {
      const data = await response.json();
      const text = data.text?.trim().length > 10 ? data.text.trim().slice(0, 6000) : null;
      const thumbnail = data.thumbnail ?? null;
      if (data.success && (text || thumbnail)) {
        console.log('[DocumentExtract] Backend success — chars:', text?.length ?? 0, 'thumbnail:', !!thumbnail);
        return { text, thumbnail };
      }
    }
  } catch (err) {
    console.log('[DocumentExtract] Backend failed — trying TXT fallback:', err.message);
  }

  // ── Frontend TXT fallback ──────────────────────────────────────────────────
  if (mimeType === 'text/plain' || filename?.endsWith('.txt')) {
    try {
      const text = await fetch(uri).then(r => r.text());
      if (text?.trim().length > 10) {
        console.log('[DocumentExtract] TXT fallback success');
        return { text: text.trim().slice(0, 6000), thumbnail: null };
      }
    } catch (err) {
      console.log('[DocumentExtract] TXT fallback failed:', err.message);
    }
  }

  return { text: null, thumbnail: null };
};

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
 * @param {object|null} params.documentContext — { text, filename } | null
 * @param {object|null} params.imageAttachment — { base64, uri, filename } | null
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
  documentContext    = null,
  setDocumentContext = null,   // (ctx) => void — update MainApp state after extraction
  imageAttachment    = null,
}) {
  const [isTyping, setIsTyping] = useState(false);
  const [simulatedAgents, setSimulatedAgents] = useState([]);
  const [coordinationMode, setCoordinationMode] = useState(COORDINATION_MODES.FULL);
  const [lastTokenUsage, setLastTokenUsage] = useState(null);
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
  const runAgentSimulation = async (userText, activeMessagesList, sessionId, docCtx = null, userMsgId = null) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Reset streaming state for this run
    streamingWriterTextRef.current = '';
    streamingInsertedRef.current = false;

    // ── Deferred extraction — if docCtx has uri but no text, extract now ──────
    // Update the user bubble: clear docExtracting spinner on success/failure.
    // Also call setDocumentContext to cache {text, thumbnail, filename} in MainApp
    // so subsequent sends re-use the extracted text without re-extracting.
    const hasPendingDoc = docCtx && docCtx.uri && !docCtx.text;
    if (hasPendingDoc) {
      const { text: extractedText, thumbnail } = await extractDocumentText(docCtx);
      if (extractedText || thumbnail) {
        // Resolved: swap pending doc for extracted doc context
        const resolved = { text: extractedText ?? '', filename: docCtx.filename, thumbnail: thumbnail ?? null };
        docCtx = resolved;
        // Persist resolved context back to MainApp — next send skips re-extraction
        if (setDocumentContext) setDocumentContext(resolved);
        // Clear spinner and store thumbnail on the user bubble
        if (userMsgId) {
          setMessages((prev) => prev.map((m) =>
            m.id === userMsgId ? { ...m, docExtracting: false, docThumbnail: thumbnail ?? null } : m
          ));
        }
      } else {
        // Failed: mark error on bubble, proceed without doc context
        docCtx = null;
        if (userMsgId) {
          setMessages((prev) => prev.map((m) =>
            m.id === userMsgId ? { ...m, docExtracting: false, docExtractError: true } : m
          ));
        }
      }
    }

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

    // Flag set by the success path to suppress the finally-block cleanup
    // that would otherwise race the deferred 100 % progress paint.
    let _successHandledCleanup = false;

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
        onStreamDelta,
        docCtx  // document context — injected into all specialist prompts
      );

      // Expose token usage to the live coordination panel
      if (agentResult.tokenUsage && Object.keys(agentResult.tokenUsage).length > 0) {
        setLastTokenUsage(agentResult.tokenUsage);
      }

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

      // ── Force all agent progress bars to 100 % before the response renders ──
      // The pipeline's onStateChange already emits progress:100 for every agent,
      // but that goes through updateSimulatedAgents() which queues a RAF.
      // The finally block's clearSimulatedAgents() used to cancel that RAF before
      // it could paint, leaving every bar frozen at whatever percentage it reached
      // (typically ~34-78 %).  Writing the completed state synchronously here —
      // in the same React batch as setMessages — guarantees the live coordination
      // footer shows 100 % on the same frame the response bubble appears.
      const completedAgents = (agentResult.agents ?? []).map((a) => ({
        ...a,
        progress: 100,
        status: a.status === 'error' || a.status === 'exhausted' ? a.status : 'done',
      }));
      if (completedAgents.length > 0) {
        // Cancel any queued RAF so stale mid-progress values don't overwrite 100 %
        if (simulatedAgentsRafRef.current) {
          cancelAnimationFrame(simulatedAgentsRafRef.current);
          simulatedAgentsRafRef.current = null;
        }
        pendingSimulatedAgentsRef.current = null;
        setSimulatedAgents(completedAgents);
      }

      const hadStreamingPlaceholder = streamingInsertedRef.current;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === STREAMING_MSG_ID);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = newAiMsg;
          return updated;
        }
        return [...prev, newAiMsg];
      });

      // Backend path: no writer streaming was ever inserted, so the live
      // AgentCoordinationTable footer is still visible.  Allow one animation
      // frame for the 100 % state to paint before tearing the panel down so
      // the footer and the in-bubble AgentPanel summary are never shown at the
      // same time.
      if (!hadStreamingPlaceholder) {
        _successHandledCleanup = true;
        requestAnimationFrame(() => {
          clearSimulatedAgents();
          setIsTyping(false);
        });
      } else {
        // Streaming path: the streaming placeholder was replaced — the
        // coordination footer collapses naturally when isTyping goes false
        // in the finally block.  Just mark cleanup handled so the finally
        // block does NOT call clearSimulatedAgents() and wipe the 100 % state
        // before the Animated.timing(progressAnim → 100) has had time to run.
        _successHandledCleanup = true;
      }

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
      // Cancel any pending writer-token RAF flush (the agents RAF was already
      // handled in the success path above to ensure 100 % paints first).
      if (streamingRafRef.current) {
        cancelAnimationFrame(streamingRafRef.current);
        streamingRafRef.current = null;
      }
      streamingWriterTextRef.current = '';
      streamingInsertedRef.current = false;
      streamingPendingFlushRef.current = false;
      setIsTyping(false);
      // Only clear agents immediately for abort/error paths.  The success path
      // sets _successHandledCleanup = true and schedules clearSimulatedAgents()
      // inside a requestAnimationFrame so the 100 % state has one frame to paint
      // before the panel fades out.  Calling clearSimulatedAgents() here on the
      // success path would race that RAF and leave bars frozen mid-way.
      if (!_successHandledCleanup) {
        clearSimulatedAgents();
      }
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
    // documentContext is { uri, filename, mimeType } when pending (not yet extracted),
    // or { text, filename } when already extracted from a prior send.
    const hasPendingDoc = documentContext && documentContext.uri && !documentContext.text;
    console.log('[Send] documentContext attached:', documentContext != null, documentContext?.filename, 'pending:', hasPendingDoc);
    Keyboard.dismiss();
    const userMsgId = String(Date.now());
    const userMsg = {
      id: userMsgId,
      sender: 'user',
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      // attachedDoc drives the document bubble in ChatBubble (UI only).
      attachedDoc: documentContext ? documentContext.filename : null,
      // docExtracting: true triggers the spinner overlay on the doc bubble while
      // extraction is in-flight. Cleared to false / docExtractError when done.
      docExtracting: hasPendingDoc ? true : false,
      docExtractError: false,
    };

    const newMessages = [...messages, userMsg];

    chatShouldStickToBottomRef.current = true;
    setMessages(newMessages);
    setInputText('');
    setIsTyping(true);
    setCoordinationMode(COORDINATION_MODES.FULL);
    setLastTokenUsage(null);
    setSimulatedAgents([
      { role: 'reasoner', name: agentConfigs.reasoner.name || teamRoleInfo.reasoner.name, model: getModelDisplayName(agentConfigs.reasoner, teamRoleInfo.reasoner.name), progress: 0, status: 'queued', statusColor: '#555566' },
      { role: 'coder', name: agentConfigs.coder.name || teamRoleInfo.coder.name, model: getModelDisplayName(agentConfigs.coder, teamRoleInfo.coder.name), progress: 0, status: 'queued', statusColor: '#555566' },
      { role: 'vision', name: agentConfigs.vision.name || teamRoleInfo.vision.name, model: getModelDisplayName(agentConfigs.vision, teamRoleInfo.vision.name), progress: 0, status: 'queued', statusColor: '#555566' },
      { role: 'writer', name: agentConfigs.writer.name || teamRoleInfo.writer.name, model: getModelDisplayName(agentConfigs.writer, teamRoleInfo.writer.name), progress: 0, status: 'queued', statusColor: '#555566' },
    ]);

    // Save prompt message immediately
    saveActiveSessionMessages(newMessages, userMsgText).then((sessionId) => {
      InteractionManager.runAfterInteractions(() => {
        runAgentSimulation(userMsgText, newMessages, sessionId, documentContext, userMsgId);
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
    setLastTokenUsage(null);
    setSimulatedAgents([
      { role: 'reasoner', name: agentConfigs.reasoner.name || teamRoleInfo.reasoner.name, model: getModelDisplayName(agentConfigs.reasoner, teamRoleInfo.reasoner.name), progress: 0, status: 'queued', statusColor: '#555566' },
      { role: 'coder',    name: agentConfigs.coder.name    || teamRoleInfo.coder.name,    model: getModelDisplayName(agentConfigs.coder,    teamRoleInfo.coder.name),    progress: 0, status: 'queued', statusColor: '#555566' },
      { role: 'vision',   name: agentConfigs.vision.name   || teamRoleInfo.vision.name,   model: getModelDisplayName(agentConfigs.vision,   teamRoleInfo.vision.name),   progress: 0, status: 'queued', statusColor: '#555566' },
      { role: 'writer',   name: agentConfigs.writer.name   || teamRoleInfo.writer.name,   model: getModelDisplayName(agentConfigs.writer,   teamRoleInfo.writer.name),   progress: 0, status: 'queued', statusColor: '#555566' },
    ]);
    saveActiveSessionMessages(listWithoutResponse, userMsg.text).then((sessionId) => {
      InteractionManager.runAfterInteractions(() => {
        runAgentSimulation(userMsg.text, listWithoutResponse, sessionId, documentContext);
      });
    });
  }, [isTyping, messages, agentConfigs, teamRoleInfo, documentContext]);

  return {
    isTyping,
    setIsTyping,
    simulatedAgents,
    setSimulatedAgents,
    coordinationMode,
    setCoordinationMode,
    lastTokenUsage,
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
