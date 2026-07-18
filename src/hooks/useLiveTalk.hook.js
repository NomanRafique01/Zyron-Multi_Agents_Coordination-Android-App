/**
 * useLiveTalk.hook.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Core engine for Zyron Live Talk Mode.
 *
 * Pipeline:
 *   1. Request microphone permission (reuses Voice-Input flow)
 *   2. Listen via expo-speech-recognition (STT)
 *   3. On final transcript → call Agent 1 (reasoner) config for streaming LLM
 *   4. Stream LLM tokens → chunk into sentences → speak via expo-speech (TTS)
 *   5. While speaking: monitor new voice activity → interrupt immediately
 *
 * Exposed surface:
 *   { phase, volumeRef, transcript, errorMsg, start, stop, interruptAI }
 *   (aiText is NOT exposed — it is saved directly to background chat history via onSaveTurn)
 *
 * phase: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import * as Speech from 'expo-speech';

// ─── Speech recognition — same lazy-load guard as InputBar ───────────────────
let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEvent = (_eventName, _listener) => {};
try {
  const mod = require('expo-speech-recognition');
  if (mod?.ExpoSpeechRecognitionModule?.start) {
    ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
    useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
  }
} catch (_) {}

// ─── Provider call helpers ────────────────────────────────────────────────────
// Direct non-streaming calls — React Native's fetch does not expose a Streams
// API (res.body is undefined), so we use res.json() for all providers.
// Responses are capped at 200 tokens to keep voice replies short and snappy.

const OPENAI_COMPAT_URLS = {
  openai:     'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  mistral:    'https://api.mistral.ai/v1/chat/completions',
  groq:       'https://api.groq.com/openai/v1/chat/completions',
  deepseek:   'https://api.deepseek.com/v1/chat/completions',
  glm:        'https://open.bigmodel.cn/api/paas/v4/chat/completions',
};

/**
 * fetchLLMResponse — single async call that returns the full reply text.
 * Uses the same API key + model the user configured for Agent 1.
 * No SSE streaming — avoids the res.body.getReader() crash on React Native.
 */
async function fetchLLMResponse(agentConfig, messages, signal) {
  const { provider, model, key } = agentConfig;
  const cleanKey = key?.trim() ?? '';
  if (!cleanKey) throw new Error('No API key configured for Agent 1 (Live Talk).');

  // ── OpenAI-compatible (JSON response) ────────────────────────────────────
  const chatUrl = OPENAI_COMPAT_URLS[provider];
  if (chatUrl) {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cleanKey}` };
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://Zyron.app';
      headers['X-Title'] = 'ZyronLiveTalk';
    }
    const res = await fetch(chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages,
        stream: false,
        max_tokens: 200,
        temperature: 0.75,
      }),
      signal,
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || data?.error || `API error ${res.status}`;
      throw new Error(`Live Talk: ${String(msg).slice(0, 120)}`);
    }
    return data.choices?.[0]?.message?.content || '';
  }

  // ── Anthropic ─────────────────────────────────────────────────────────────
  if (provider === 'anthropic') {
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsgs  = messages.filter(m => m.role !== 'system');
    const body = {
      model: model || 'claude-3-5-haiku-latest',
      messages: userMsgs,
      max_tokens: 200,
      temperature: 0.75,
    };
    if (systemMsg) body.system = systemMsg.content;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': cleanKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
    return data.content?.[0]?.text || '';
  }

  // ── Gemini ────────────────────────────────────────────────────────────────
  if (provider === 'gemini') {
    const promptText = messages.filter(m => m.role !== 'system').map(m => m.content).join('\n\n');
    const systemMsg  = messages.find(m => m.role === 'system');
    const body = {
      contents: [{ role: 'user', parts: [{ text: promptText || 'Hi' }] }],
      generationConfig: { maxOutputTokens: 200, temperature: 0.75 },
    };
    if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    const modelName = model || 'gemini-2.5-flash';
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': cleanKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(`Gemini error ${res.status}`);
    return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  }

  throw new Error(`Provider "${provider}" not supported for Live Talk.`);
}

// ─── Sentence splitter ────────────────────────────────────────────────────────
// Splits accumulated text at natural sentence boundaries so TTS starts as soon
// as the first sentence arrives — minimising perceived latency.
const SENTENCE_RE = /[^.!?\n]+[.!?\n]+/g;

function extractSentences(text) {
  const sentences = [];
  let match;
  let lastIndex = 0;
  // Reset lastIndex in case the regex was used before
  SENTENCE_RE.lastIndex = 0;
  while ((match = SENTENCE_RE.exec(text)) !== null) {
    sentences.push(match[0].trim());
    lastIndex = match.index + match[0].length;
  }
  const remainder = text.slice(lastIndex).trim();
  // Return lastIndex so callers can track position in the original string
  return { sentences, remainder, lastIndex };
}

// ─── useLiveTalk ─────────────────────────────────────────────────────────────
export default function useLiveTalk({ agentConfigs, onClose }) {
  // phase: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
  // NOTE: 'waiting' is intentionally removed — the mic stays open in 'listening'
  // continuously after Zyron finishes speaking. The auto-close timer runs silently
  // in the background without changing the visible phase.
  const [phase, setPhase]         = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg]   = useState('');
  const [waitCountdown, setWaitCountdown] = useState(20);

  // Ref-based values — zero re-renders for hot paths
  const volumeRef          = useRef(null);    // read by animation loop
  const abortRef           = useRef(null);    // AbortController for LLM stream
  const isSpeakingRef      = useRef(false);   // true while TTS is running
  const voiceDetectedRef   = useRef(false);   // true when volume spike detected during TTS
  const interruptPendingRef = useRef(false);  // avoid double-interrupt
  const phaseRef           = useRef('idle');  // shadow of phase — readable in callbacks
  const pendingAiTextRef   = useRef('');
  // Guards against the spurious STT 'end' event that fires right after we call
  // ExpoSpeechRecognitionModule.start() to restart listening.
  const isRestartingSTTRef = useRef(false);
  // Set to true when stop() is called so that async STT 'end'/'error' events
  // that arrive after shutdown cannot restart the microphone.
  const isShuttingDownRef  = useRef(false);
  // Silent auto-close timer — fires if no speech detected for 20 s while listening.
  // Runs entirely in the background; does NOT change the phase to 'waiting'.
  const waitTimerRef       = useRef(null);    // auto-close timeout (20 s)
  const onCloseRef         = useRef(onClose); // stable ref so callbacks don't go stale
  // Silence timer — fires 1.5 s after the last partial result to treat the
  // accumulated transcript as final and run the LLM pipeline.
  // Using a timer instead of the 'end' event lets us keep continuous: true so
  // the mic hardware never closes/reopens between turns (no click sounds).
  const silenceTimerRef    = useRef(null);

  // Keep onClose ref fresh
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const setPhaseSync = useCallback((p) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  // ── Clear idle-wait timer ─────────────────────────────────────────────────
  const clearWaitTimer = useCallback(() => {
    if (waitTimerRef.current) { clearTimeout(waitTimerRef.current); waitTimerRef.current = null; }
  }, []);

  // Legacy alias so existing call-sites don't need to change
  const clearWaitTimers = clearWaitTimer;

  // ── Start the silent 20-second auto-close countdown ──────────────────────
  // After Zyron finishes speaking the mic stays open (phase stays 'listening').
  // This timer closes the session automatically if the user says nothing for 20 s.
  // It is cancelled immediately when speech input is detected.
  const startWaitCountdown = useCallback(() => {
    clearWaitTimer();
    setWaitCountdown(20);
    // Phase stays 'listening' — we do NOT flip to 'waiting' anymore.
    // The timer just runs silently in the background.
    waitTimerRef.current = setTimeout(() => {
      clearWaitTimer();
      // Stop STT + TTS
      try { Speech.stop(); } catch (_) {}
      try { ExpoSpeechRecognitionModule?.stop(); } catch (_) {}
      volumeRef.current = null;
      voiceDetectedRef.current = false;
      pendingAiTextRef.current = '';
      setTranscript('');
      setErrorMsg('');
      setPhaseSync('idle');
      // Signal the parent to close the modal
      onCloseRef.current?.();
    }, 20000);
  }, [clearWaitTimer, setPhaseSync]);

  // ── Clear the silence timer ───────────────────────────────────────────────
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
  }, []);

  // ── Restart STT for the next user turn ───────────────────────────────────
  // Stops the old session and immediately starts a fresh one with continuous: true
  // so the mic hardware stays engaged — clears stale transcript, resets phase.
  const restartListening = useCallback(() => {
    if (!ExpoSpeechRecognitionModule) return;
    // Wipe stale transcript so the next turn starts clean
    transcriptRef.current = '';
    setTranscript('');
    clearSilenceTimer();
    isRestartingSTTRef.current = true;
    setPhaseSync('listening');
    volumeRef.current = null;
    // Stop the previous session first; the 'end' guard (isRestartingSTTRef)
    // prevents it from triggering the pipeline.
    try { ExpoSpeechRecognitionModule.stop(); } catch (_) {}
    // Small gap to let the engine settle before starting a new session.
    setTimeout(() => {
      if (phaseRef.current !== 'listening') return;
      try {
        ExpoSpeechRecognitionModule.start({
          lang: 'en-US',
          interimResults: true,
          continuous: true,
          volumeChangeEventOptions: { enabled: true, intervalMillis: 50 },
        });
      } catch (_) {}
      setTimeout(() => { isRestartingSTTRef.current = false; }, 600);
    }, 250);
  }, [setPhaseSync, clearSilenceTimer]);

  // ── Android RECORD_AUDIO permission (same as InputBar) ───────────────────
  const ensurePermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      if (!ExpoSpeechRecognitionModule) return false;
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return granted;
    }
    try {
      const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (already) {
        // Still run expo permission for iOS parity
        if (ExpoSpeechRecognitionModule) {
          const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
          return granted;
        }
        return true;
      }
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Access',
          message: 'Zyron needs your microphone for Live Talk.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      if (result !== PermissionsAndroid.RESULTS.GRANTED) return false;
      if (ExpoSpeechRecognitionModule) {
        const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        return granted;
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Stop TTS ─────────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    try { Speech.stop(); } catch (_) {}
    isSpeakingRef.current = false;
  }, []);

  // ── Interrupt AI playback and return to listening ────────────────────────
  const interruptAI = useCallback(() => {
    if (interruptPendingRef.current) return;
    interruptPendingRef.current = true;
    clearWaitTimers();
    stopSpeaking();
    abortRef.current?.abort();
    pendingAiTextRef.current = '';
    voiceDetectedRef.current = false;
    interruptPendingRef.current = false;
    // Return to listening immediately (uses restartListening to clear stale transcript)
    if (ExpoSpeechRecognitionModule && phaseRef.current !== 'idle') {
      restartListening();
    }
  }, [clearWaitTimers, stopSpeaking, restartListening]);

  // ── Speak AI response (sentence-by-sentence) ─────────────────────────────
  const speakText = useCallback(async (text) => {
    if (!text.trim()) return;
    isSpeakingRef.current  = true;
    voiceDetectedRef.current = false;
    setPhaseSync('speaking');

    return new Promise((resolve) => {
      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 1.05,   // Slightly faster for a more natural assistant feel
        onDone: () => {
          isSpeakingRef.current = false;
          resolve();
        },
        onStopped: () => {
          isSpeakingRef.current = false;
          resolve();
        },
        onError: () => {
          isSpeakingRef.current = false;
          resolve();
        },
      });
    });
  }, [setPhaseSync]);

  // ── Run LLM → TTS pipeline ───────────────────────────────────────────────
  const runAIPipeline = useCallback(async (userText) => {
    const reasonerConfig = agentConfigs?.reasoner;
    if (!reasonerConfig?.key?.trim()) {
      setErrorMsg('Agent 1 API key not configured. Please set it in API Configuration.');
      setPhaseSync('error');
      return;
    }

    abortRef.current = new AbortController();
    setPhaseSync('thinking');
    // Clear any stale pending AI text from a previous turn
    pendingAiTextRef.current = '';

    const messages = [
      {
        role: 'system',
        content:
          'You are Zyron, a concise AI voice assistant. Reply in 1-3 short spoken sentences. ' +
          'No markdown, no lists, no code. Speak naturally and directly.',
      },
      { role: 'user', content: userText },
    ];

    try {
      // Single non-streaming call — works on React Native (no res.body.getReader)
      const fullText = await fetchLLMResponse(reasonerConfig, messages, abortRef.current.signal);

      if (abortRef.current.signal.aborted || voiceDetectedRef.current) return;

      const responseText = fullText.trim();
      if (!responseText) {
        setPhaseSync('listening');
        return;
      }

      // Store in ref so interrupt handler can also save it
      pendingAiTextRef.current = responseText;

      // Speak sentence-by-sentence for natural TTS pacing
      const { sentences } = extractSentences(responseText);
      const toSpeak = sentences.length > 0 ? sentences : [responseText];

      for (const sentence of toSpeak) {
        if (abortRef.current.signal.aborted || voiceDetectedRef.current) break;
        await speakText(sentence);
        if (voiceDetectedRef.current) { interruptAI(); return; }
      }

      if (!abortRef.current.signal.aborted && !voiceDetectedRef.current) {
        pendingAiTextRef.current = '';
        // Restart the mic immediately so it stays open (phase stays 'listening').
        // The auto-close timer runs silently in the background — no phase flip.
        restartListening();
        startWaitCountdown();
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.message === 'Aborted') return;
      setErrorMsg(err.message || 'Live Talk error. Please try again.');
      setPhaseSync('error');
    }
  }, [agentConfigs, speakText, interruptAI, setPhaseSync, restartListening, startWaitCountdown]);

  // ── Speech recognition events ─────────────────────────────────────────────
  useSpeechRecognitionEvent('result', (e) => {
    const text = e?.results?.[0]?.transcript;
    if (!text) return;
    // Any detected speech cancels the silent auto-close timer immediately.
    clearWaitTimer();
    transcriptRef.current = text;
    setTranscript(text);

    // ── Silence-based pipeline trigger ──────────────────────────────────────
    // Reset the silence timer on every partial result. When 1.5 s passes with
    // no new speech the transcript is treated as final — no mic click because
    // we never close/reopen the session; continuous: true keeps it streaming.
    if (phaseRef.current !== 'listening') return;
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      silenceTimerRef.current = null;
      if (phaseRef.current !== 'listening') return;
      runAIPipelineRef.current?.();
    }, 1500);
  });

  useSpeechRecognitionEvent('end', () => {
    volumeRef.current = null;
    // Skip if the session is being shut down or we are mid-restart — both cases
    // must NOT re-open the mic.
    if (isShuttingDownRef.current) return;
    if (isRestartingSTTRef.current) return;
    // With continuous: true the 'end' event only fires when we deliberately call
    // .stop() (e.g. before AI speaks). If still in 'listening' phase at this point,
    // restart silently — the mic dropped unexpectedly.
    if (phaseRef.current !== 'listening') return;
    clearSilenceTimer();
    setTimeout(() => {
      if (phaseRef.current !== 'listening') return;
      try {
        isRestartingSTTRef.current = true;
        ExpoSpeechRecognitionModule?.start({
          lang: 'en-US',
          interimResults: true,
          continuous: true,
          volumeChangeEventOptions: { enabled: true, intervalMillis: 50 },
        });
        setTimeout(() => { isRestartingSTTRef.current = false; }, 600);
      } catch (_) {}
    }, 200);
  });

  useSpeechRecognitionEvent('error', (e) => {
    volumeRef.current = null;
    // If the session is being torn down, swallow every error — do not restart.
    if (isShuttingDownRef.current) return;
    const code = e?.error ?? e?.code ?? '';
    // Treat any of these as routine "nothing heard / timeout" — just restart.
    // error 7 = no-match, 6 = speech-timeout, 'aborted' can fire on restart.
    const isRoutine = (
      code === 7 || code === 6 || code === 5 ||
      code === 'no-speech' || code === 'speech-timeout' ||
      code === 'aborted' || code === 'audio-capture'
    );
    // In 'listening' phase: silently restart the mic to keep it continuously open.
    if (phaseRef.current === 'listening') {
      clearSilenceTimer();
      if (isRoutine) {
        setTimeout(() => {
          if (phaseRef.current !== 'listening') return;
          try {
            isRestartingSTTRef.current = true;
            ExpoSpeechRecognitionModule?.start({
              lang: 'en-US',
              interimResults: true,
              continuous: true,
              volumeChangeEventOptions: { enabled: true, intervalMillis: 50 },
            });
            setTimeout(() => { isRestartingSTTRef.current = false; }, 600);
          } catch (_) {}
        }, 300);
      } else {
        // Genuinely fatal error (e.g. permission revoked mid-session)
        setErrorMsg('Microphone error. Please try again.');
        setPhaseSync('error');
      }
    }
  });

  useSpeechRecognitionEvent('volumechange', (e) => {
    if (e?.value !== undefined) {
      volumeRef.current = e.value;
      // Interrupt detection: volume spike while AI is speaking
      if (isSpeakingRef.current && e.value > 1.5) {
        voiceDetectedRef.current = true;
      }
    }
  });

  // Keep runAIPipeline reachable from the silence-timer callback without stale closure
  const runAIPipelineRef = useRef(null);
  const transcriptRef    = useRef('');
  useEffect(() => {
    // Only sync the ref when there is actual content — do NOT overwrite with the
    // empty string set by restartListening() before the React render cycle catches up.
    if (transcript) transcriptRef.current = transcript;
  }, [transcript]);
  useEffect(() => {
    runAIPipelineRef.current = () => {
      const text = transcriptRef.current.trim();
      if (text) {
        // We have a transcript — cancel any pending auto-close timer and run the pipeline.
        clearWaitTimer();
        // Stop the continuous STT session before speaking so Zyron's voice is
        // not picked up by the mic. restartListening() will reopen it after TTS.
        isRestartingSTTRef.current = true;
        try { ExpoSpeechRecognitionModule?.stop(); } catch (_) {}
        setTimeout(() => { isRestartingSTTRef.current = false; }, 600);
        runAIPipeline(text);
      }
      // If text is empty the silence timer fired but the user said nothing —
      // the mic session is already open (continuous: true), so do nothing.
    };
  }, [runAIPipeline, clearWaitTimer]);

  // ── Start Live Talk session ───────────────────────────────────────────────
  const start = useCallback(async () => {
    // Clear the shutdown flag so event handlers can restart the mic normally.
    isShuttingDownRef.current = false;
    if (!ExpoSpeechRecognitionModule) {
      setErrorMsg('Speech recognition is not available in this build.');
      setPhaseSync('error');
      return;
    }

    setErrorMsg('');
    setTranscript('');
    pendingAiTextRef.current = '';
    voiceDetectedRef.current = false;
    transcriptRef.current = '';
    clearSilenceTimer();

    const granted = await ensurePermission();
    if (!granted) {
      setErrorMsg('Microphone permission denied.');
      setPhaseSync('error');
      return;
    }

    setPhaseSync('listening');
    volumeRef.current = null;
    try {
      // continuous: true keeps the mic hardware open the whole session —
      // no hardware open/close clicks between turns.
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 50 },
      });
    } catch (err) {
      setErrorMsg('Could not start microphone. Please try again.');
      setPhaseSync('error');
    }
  }, [ensurePermission, setPhaseSync, clearSilenceTimer]);

  // ── Stop / close Live Talk session ───────────────────────────────────────
  const stop = useCallback(() => {
    // Raise the shutdown flag FIRST so any async STT 'end'/'error' events that
    // arrive after .stop() cannot restart the microphone.
    isShuttingDownRef.current = true;
    isRestartingSTTRef.current = true;
    clearWaitTimer();
    clearSilenceTimer();
    stopSpeaking();
    abortRef.current?.abort();
    try { ExpoSpeechRecognitionModule?.stop(); } catch (_) {}
    volumeRef.current = null;
    voiceDetectedRef.current = false;
    pendingAiTextRef.current = '';
    transcriptRef.current = '';
    setTranscript('');
    setErrorMsg('');
    setWaitCountdown(20);
    setPhaseSync('idle');
  }, [clearWaitTimer, clearSilenceTimer, stopSpeaking, setPhaseSync]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    phase,
    volumeRef,
    transcript,
    waitCountdown,
    // aiText is intentionally omitted — responses are saved to background chat
    // history via onSaveTurn and must NOT be displayed in the live talk modal.
    errorMsg,
    start,
    stop,
    interruptAI,
  };
}
