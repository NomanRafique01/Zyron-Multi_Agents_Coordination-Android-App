import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  Platform,
  PermissionsAndroid,
  Modal,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import C from '../../config/colors.config';
import { SendIcon, StopIcon, MicIcon, LiveIcon } from '../shared/Icons';
import {
  fontScale,
  spacing,
  radius,
  verticalScale,
  scale,
} from '../../utils/responsive.utils';

// ─── Document / Image pickers — safe lazy load ───────────────────────────────
let DocumentPicker = null;
let ImagePicker = null;

try {
  DocumentPicker = require('expo-document-picker');
} catch (_) {}

try {
  ImagePicker = require('expo-image-picker');
} catch (_) {}

// ─── Speech recognition — safe lazy load ─────────────────────────────────────
//
// expo-speech-recognition uses requireNativeModule() (JSI / Expo Modules API),
// NOT the old React Native bridge NativeModules.  Checking NativeModules is
// therefore ALWAYS undefined, even in a real APK.  The correct guard is a
// try/catch around the actual require() — it throws when the native module is
// absent (Expo Go), succeeds when it is linked (custom dev build / release APK).
//
let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEvent = (_eventName, _listener) => {};   // no-op fallback

try {
  const mod = require('expo-speech-recognition');
  // requireNativeModule will throw here if the native side is not linked.
  // If it succeeds we know the module is truly available.
  if (mod?.ExpoSpeechRecognitionModule?.start) {
    ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
    useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
  }
} catch (_) {
  // Native module not linked — Expo Go, web, or stripped build.
}

// ─── Vision-capable model detection ──────────────────────────────────────────
// Returns true if the given agentConfigs contain at least one vision-capable model.
// Vision support: OpenAI gpt-4o*, Anthropic claude-*, Google gemini-*, plus multimodal OpenRouter models.
const isVisionCapable = (agentConfigs = {}) => {
  const VISION_PATTERNS = [
    /gpt-4o/i,
    /claude-3/i,
    /claude-3\./i,
    /claude/i,
    /gemini/i,
    /llava/i,
    /vision/i,
    /pixtral/i,
    /qwen.*vl/i,
    /mistral.*pixtral/i,
  ];
  return Object.values(agentConfigs).some((cfg) => {
    if (!cfg?.model) return false;
    return VISION_PATTERNS.some((re) => re.test(cfg.model));
  });
};

// ─── Agent accent color map ───────────────────────────────────────────────────
const AGENT_ACCENT = {
  reasoner: C.agentReasoner,
  coder: C.agentCoder,
  vision: C.agentVision,
  writer: C.agentWriter,
  Reasoner: C.agentReasoner,
  Coder: C.agentCoder,
  Vision: C.agentVision,
  Writer: C.agentWriter,
};

// ─── MiniAgentDot ─────────────────────────────────────────────────────────────
function MiniAgentDot({ name, role, status }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isActive = status !== 'done' && status !== 'queued' && status !== 'error';
  const isDone   = status === 'done';
  const isError  = status === 'error';
  const accent   = AGENT_ACCENT[role] || AGENT_ACCENT[name] || C.cyan;

  useEffect(() => {
    if (!isActive) { pulseAnim.setValue(1); return undefined; }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.35, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isActive, pulseAnim]);

  let dotColor = '#333344';
  if (isDone)      dotColor = C.green;
  else if (isError) dotColor = C.orange;
  else if (isActive) dotColor = accent;

  return (
    <View style={s.miniAgentItem}>
      <Animated.View style={[s.miniDot, { backgroundColor: dotColor, opacity: isActive ? pulseAnim : 1 }]} />
      <Text style={[s.miniAgentName, { color: isDone ? C.green : isError ? C.orange : isActive ? accent : '#555566' }]}>
        {name.charAt(0)}
      </Text>
    </View>
  );
}

// ─── AgentStrip ───────────────────────────────────────────────────────────────
function AgentStrip({ agents, isTyping }) {
  if (!isTyping || !agents?.length) return null;
  const doneCount = agents.filter((a) => a.status === 'done' || a.status === 'error').length;
  return (
    <View style={s.agentStrip}>
      <View style={s.stripContent}>
        <View style={s.stripDots}>
          {agents.map((agent, i) => <MiniAgentDot key={i} {...agent} />)}
        </View>
        <Text style={s.stripStatus}>{doneCount}/{agents.length} complete</Text>
      </View>
    </View>
  );
}

// ─── Waveform constants ───────────────────────────────────────────────────────
const BAR_COUNT   = 5;
// Arch shape — centre bar tallest
const BAR_SHAPE   = [0.55, 0.80, 1.0, 0.80, 0.55];
const BAR_MIN     = 0.12;   // scaleY floor (always visible)
const BAR_MAX     = 1.0;    // scaleY ceiling
const BAR_H       = verticalScale(18);
const BAR_W       = scale(3);
const BAR_GAP     = scale(2);
const WAVE_W      = BAR_COUNT * BAR_W + (BAR_COUNT - 1) * BAR_GAP;

// ─── VoiceWaveform ────────────────────────────────────────────────────────────
// Reads volumeRef (a plain ref — zero re-renders) at ~30 fps via rAF.
// volumechange events from expo-speech-recognition emit values in [-2, 10].
// Anything ≤ 0 is inaudible.  Map [0, 10] → [0, 1] amplitude.
function VoiceWaveform({ volumeRef }) {
  const bars = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(BAR_MIN))
  ).current;

  const idleRef = useRef(null);

  const driveFromAmplitude = useCallback((amp) => {
    if (idleRef.current) { idleRef.current.stop(); idleRef.current = null; }
    bars.forEach((bar, i) => {
      Animated.timing(bar, {
        toValue: Math.max(BAR_MIN, BAR_MIN + (BAR_MAX - BAR_MIN) * amp * BAR_SHAPE[i]),
        duration: 80,
        useNativeDriver: true,
      }).start();
    });
  }, [bars]);

  const startIdle = useCallback(() => {
    if (idleRef.current) return;
    const seqs = bars.map((bar, i) =>
      Animated.loop(Animated.sequence([
        Animated.timing(bar, {
          toValue: BAR_MIN + 0.22 * BAR_SHAPE[i],
          duration: 430 + i * 55,
          useNativeDriver: true,
        }),
        Animated.timing(bar, {
          toValue: BAR_MIN,
          duration: 430 + i * 55,
          useNativeDriver: true,
        }),
      ]))
    );
    idleRef.current = Animated.parallel(seqs);
    idleRef.current.start();
  }, [bars]);

  useEffect(() => {
    startIdle();
    let rafId;
    let lastAt = 0;

    const tick = () => {
      const vol = volumeRef.current;
      if (vol !== null && vol !== undefined) {
        const now = Date.now();
        if (now - lastAt > 33) {          // ~30 fps
          lastAt = now;
          // vol range: -2 (silence) to 10 (loud).  Map [0, 10] → [0, 1].
          const amp = Math.min(1, Math.max(0, vol / 10));
          if (amp > 0.02) {
            driveFromAmplitude(amp);
          } else {
            startIdle();
          }
        }
      } else {
        startIdle();
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      if (idleRef.current) { idleRef.current.stop(); idleRef.current = null; }
    };
  }, [volumeRef, driveFromAmplitude, startIdle]);

  return (
    <View style={s.waveformContainer} pointerEvents="none">
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            s.waveBar,
            { transform: [{ scaleY: bar }], marginLeft: i === 0 ? 0 : BAR_GAP },
          ]}
        />
      ))}
    </View>
  );
}

// ─── PlusIcon ─────────────────────────────────────────────────────────────────
function PlusIcon({ size = 20, color = '#ECECF1' }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size * 0.7, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', width: 2, height: size * 0.7, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

// ─── AttachmentChip ───────────────────────────────────────────────────────────
// Shows a small pill above the input bar for the active document or image.
function AttachmentChip({ label, isImage, imageUri, onRemove }) {
  return (
    <View style={s.attachChip}>
      {isImage && imageUri ? (
        <Image source={{ uri: imageUri }} style={s.attachChipThumb} resizeMode="cover" />
      ) : (
        <View style={s.attachChipDocIcon}>
          <Text style={s.attachChipDocIconText}>📄</Text>
        </View>
      )}
      <Text style={s.attachChipLabel} numberOfLines={1}>{label}</Text>
      <TouchableOpacity
        onPress={onRemove}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={s.attachChipRemove}
      >
        <Text style={s.attachChipRemoveText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── AttachMenu ───────────────────────────────────────────────────────────────
// Bottom sheet modal with two options: Document and Image.
// ─── SVG icons for AttachMenu ─────────────────────────────────────────────────
const { Svg, Path, Rect, Polyline, Line, Circle: SvgCircle } = (() => {
  try { return require('react-native-svg'); } catch (_) { return {}; }
})();

function DocSvgIcon({ size = 24, color = '#A78BFA' }) {
  if (!Svg) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Polyline
        points="14 2 14 8 20 8"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1="16" y1="13" x2="8" y2="13" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      <Line x1="16" y1="17" x2="8" y2="17" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      <Polyline points="10 9 9 9 8 9" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}

function ImageSvgIcon({ size = 24, color = '#A78BFA' }) {
  if (!Svg) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3" y="3" width="18" height="18" rx="2" ry="2"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <SvgCircle cx="8.5" cy="8.5" r="1.5" stroke={color} strokeWidth="1.75" />
      <Polyline
        points="21 15 16 10 5 21"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function AttachMenu({ visible, onClose, onPickDocument, onPickImage, visionEnabled }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={s.attachMenuOverlay} activeOpacity={1} onPress={onClose}>
        <View style={s.attachMenuSheet}>
          {/* Handle bar */}
          <View style={s.attachMenuHandle} />

          <Text style={s.attachMenuTitle}>Attach</Text>

          {/* Upload Document */}
          <TouchableOpacity
            style={s.attachMenuRow}
            onPress={() => { onClose(); onPickDocument(); }}
            activeOpacity={0.75}
          >
            <View style={s.attachMenuIconBox}>
              <DocSvgIcon size={22} color="#A78BFA" />
            </View>
            <View style={s.attachMenuRowText}>
              <Text style={s.attachMenuRowTitle}>Upload Document</Text>
              <Text style={s.attachMenuRowSub}>PDF, DOCX, TXT — text extracted on device</Text>
            </View>
          </TouchableOpacity>

          {/* Upload Image */}
          <TouchableOpacity
            style={[s.attachMenuRow, !visionEnabled && s.attachMenuRowDisabled]}
            onPress={() => { if (!visionEnabled) return; onClose(); onPickImage(); }}
            activeOpacity={visionEnabled ? 0.75 : 1}
          >
            <View style={[s.attachMenuIconBox, !visionEnabled && s.attachMenuIconBoxDisabled]}>
              <ImageSvgIcon size={22} color={visionEnabled ? '#A78BFA' : '#444455'} />
            </View>
            <View style={s.attachMenuRowText}>
              <Text style={[s.attachMenuRowTitle, !visionEnabled && s.attachMenuRowTitleDisabled]}>
                Upload Image
              </Text>
              <Text style={s.attachMenuRowSub}>
                {visionEnabled
                  ? 'Gallery or camera — vision models only'
                  : 'Requires a vision-capable model (GPT-4o, Gemini, Claude…)'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── InputBar ─────────────────────────────────────────────────────────────────
export default function InputBar({
  inputText,
  setInputText,
  isTyping,
  onSend,
  onStop,
  keyboardVisible,
  simulatedAgents,
  offline,
  loading         = false,
  floating        = false,
  docked          = false,
  chatMode        = false,
  onInputPressIn,
  placeholder     = 'Message Zyron',
  inputRef,
  onLiveTalk,       // () => void — opens the Live Talk overlay
  liveTalkActive  = false,  // true while Live Talk modal is open — suppress mic events
  // ── Document / image attachment props (from parent) ──
  agentConfigs    = {},     // needed for vision detection
  documentContext = null,   // { text, filename } | null
  imageAttachment = null,   // { base64, uri, filename } | null
  onDocumentAttached,       // (ctx: { text, filename }) => void
  onImageAttached,          // (img: { base64, uri, filename }) => void
  onAttachmentRemoved,      // (type: 'document'|'image') => void
  showToast,                // (title, msg, type) => void — optional, for error feedback
}) {
  const hasText     = inputText.trim().length > 0;
  const sendBtnSize = verticalScale(36);
  const blocked     = isTyping || offline || loading;
  const visionEnabled = isVisionCapable(agentConfigs);

  const [isListening, setIsListening] = useState(false);
  const [micError,    setMicError]    = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Plain ref updated by the volumechange event — no setState, no re-renders.
  const volumeRef = useRef(null);

  // ── Android RECORD_AUDIO permission ───────────────────────────────────────
  const ensureAndroidPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const already = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (already) return true;
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Access',
          message: 'Zyron needs your microphone for voice input.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  // ── Start ─────────────────────────────────────────────────────────────────
  const startVoice = async () => {
    if (!ExpoSpeechRecognitionModule) return;   // not available (Expo Go)
    setMicError(false);
    volumeRef.current = null;
    setInputText('');  // always start fresh — no leftover transcript

    try {
      // Step 1 — Android runtime permission
      if (!(await ensureAndroidPermission())) {
        setMicError(true);
        return;
      }

      // Step 2 — expo-speech-recognition permission (also handles iOS)
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        setMicError(true);
        return;
      }

      // Step 3 — start recogniser
      setIsListening(true);
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
        volumeChangeEventOptions: {
          enabled: true,
          intervalMillis: 50,   // 20 Hz volume updates → smooth waveform
        },
      });
    } catch (err) {
      setIsListening(false);
      setMicError(true);
    }
  };

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stopVoice = useCallback(() => {
    try { ExpoSpeechRecognitionModule?.stop(); } catch (_) {}
    volumeRef.current = null;
    setIsListening(false);
  }, []);

  // ── Events ────────────────────────────────────────────────────────────────
  // Guard all handlers: when Live Talk is active, its own hook owns the
  // speech-recognition session — InputBar must not touch inputText or its state.
  useSpeechRecognitionEvent('result', (e) => {
    if (liveTalkActive) return;
    if (e?.results?.[0]?.transcript) setInputText(e.results[0].transcript);
  });

  useSpeechRecognitionEvent('end', () => {
    if (liveTalkActive) return;
    volumeRef.current = null;
    setIsListening(false);
  });

  useSpeechRecognitionEvent('error', () => {
    if (liveTalkActive) return;
    volumeRef.current = null;
    setIsListening(false);
  });

  // Volume: value is in [-2, 10].  Store in ref — VoiceWaveform reads via rAF.
  useSpeechRecognitionEvent('volumechange', (e) => {
    if (liveTalkActive) return;
    if (e?.value !== undefined) volumeRef.current = e.value;
  });

  // Cleanup on unmount
  useEffect(() => () => {
    try { if (isListening) ExpoSpeechRecognitionModule?.stop(); } catch (_) {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = () => {
    inputRef?.current?.blur();
    requestAnimationFrame(onSend);
  };

  const handleChangeText = (text) => {
    // Typing while mic is on → stop mic first
    if (isListening) stopVoice();
    setInputText(text);
  };

  // ── Document picker & text extraction ─────────────────────────────────────
  const handlePickDocument = useCallback(async () => {
    if (!DocumentPicker) {
      showToast?.('Not Available', 'Document picker is not available on this build.', 'warning');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'application/msword',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const { uri, name: filename, mimeType } = asset;

      setExtracting(true);
      try {
        let extractedText = '';

        if (mimeType === 'text/plain' || filename?.endsWith('.txt')) {
          // TXT: read directly
          const response = await fetch(uri);
          extractedText = await response.text();
        } else if (
          mimeType === 'application/pdf' ||
          filename?.endsWith('.pdf')
        ) {
          // PDF: read raw and attempt basic text extraction
          // For a full Expo build, expo-file-system + a PDF lib can be added.
          // Here we fetch and extract readable unicode text as a best-effort approach.
          const response = await fetch(uri);
          const arrayBuffer = await response.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          // Extract printable ASCII/UTF-8 strings from PDF binary (best-effort)
          let raw = '';
          for (let i = 0; i < bytes.length; i++) {
            const c = bytes[i];
            if (c >= 32 && c < 127) raw += String.fromCharCode(c);
            else if (c === 10 || c === 13) raw += '\n';
          }
          // Extract text between BT and ET PDF operators, and Tj/TJ strings
          const textBlocks = [];
          // Match PDF text strings: (text) Tj or [(text)] TJ patterns
          const pdfTextRe = /\(([^)]*)\)\s*Tj|\[([^\]]*)\]\s*TJ/g;
          let m;
          while ((m = pdfTextRe.exec(raw)) !== null) {
            const chunk = (m[1] || m[2] || '').replace(/\\n/g, '\n').replace(/\\r/g, '').trim();
            if (chunk.length > 1) textBlocks.push(chunk);
          }
          extractedText = textBlocks.length > 0
            ? textBlocks.join(' ')
            : raw.replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s{3,}/g, '\n').trim();
        } else if (
          mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          filename?.endsWith('.docx')
        ) {
          // DOCX: read as arraybuffer and extract text from XML inside the zip
          const response = await fetch(uri);
          const arrayBuffer = await response.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          // Convert to binary string for zip parsing
          let binaryStr = '';
          for (let i = 0; i < bytes.length; i++) {
            binaryStr += String.fromCharCode(bytes[i]);
          }
          // DOCX is a zip — find word/document.xml by looking for its XML content
          // Simple approach: scan for w:t XML tag content which holds all text
          const xmlMatch = binaryStr.match(/word\/document\.xml/);
          if (xmlMatch) {
            // Extract all text within <w:t> tags using a raw scan
            const wTRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
            const parts = [];
            let wm;
            while ((wm = wTRe.exec(binaryStr)) !== null) {
              if (wm[1].trim()) parts.push(wm[1]);
            }
            extractedText = parts.join(' ');
          }
          if (!extractedText) {
            // Fallback: extract any readable text
            extractedText = binaryStr
              .replace(/[^\x20-\x7E\n]/g, ' ')
              .replace(/\s{3,}/g, '\n')
              .trim()
              .slice(0, 8000);
          }
        }

        if (!extractedText || extractedText.trim().length < 10) {
          showToast?.('Extraction Failed', 'Could not extract readable text from this file.', 'warning');
          return;
        }

        // Trim to a sensible token budget (~6000 chars ≈ ~1500 tokens)
        const trimmed = extractedText.trim().slice(0, 6000);
        console.log('[DocumentContext] Extracted document text — length:', trimmed.length, 'file:', filename);
        onDocumentAttached?.({ text: trimmed, filename: filename || 'document' });
      } finally {
        setExtracting(false);
      }
    } catch (err) {
      setExtracting(false);
      console.warn('[InputBar] Document pick error:', err);
      showToast?.('Error', 'Failed to pick document.', 'error');
    }
  }, [onDocumentAttached, showToast]);

  // ── Image picker ──────────────────────────────────────────────────────────
  const handlePickImage = useCallback(async () => {
    if (!ImagePicker) {
      showToast?.('Not Available', 'Image picker is not available on this build.', 'warning');
      return;
    }
    try {
      // Request media library permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast?.('Permission Denied', 'Photo library access is required to pick images.', 'warning');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'images',
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const { uri, base64, fileName } = asset;

      if (!base64) {
        showToast?.('Error', 'Could not read image data.', 'error');
        return;
      }

      const ext = uri?.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const dataUri = `data:${mimeType};base64,${base64}`;

      onImageAttached?.({
        base64: dataUri,
        uri,
        filename: fileName || `image.${ext}`,
      });
    } catch (err) {
      console.warn('[InputBar] Image pick error:', err);
      showToast?.('Error', 'Failed to pick image.', 'error');
    }
  }, [onImageAttached, showToast]);

  // ── Render ────────────────────────────────────────────────────────────────
  const hasAttachment = documentContext || imageAttachment;

  return (
    <View style={[
      s.inputBar,
      floating  && s.inputBarFloating,
      docked    && s.inputBarDocked,
      chatMode  && s.inputBarChat,
      loading   && s.inputBarLoading,
    ]}>
      <AgentStrip agents={simulatedAgents} isTyping={isTyping} />

      {/* ── Input container row ─────────────────────────────────────────── */}
      <View style={s.inputRow}>

        {/* ── Main input pill ─────────────────────────────────────────────── */}
        <View style={[
          s.inputContainer,
          floating    && s.inputContainerFloating,
          offline     && s.inputContainerOffline,
          isListening && s.inputContainerListening,
          hasAttachment && s.inputContainerWithAttachment,
        ]}>

          {/* ── Attachment chip row — inside pill, above text field ──────── */}
          {hasAttachment && (
            <View style={s.attachChipRow}>
              {documentContext && (
                <AttachmentChip
                  label={documentContext.filename}
                  isImage={false}
                  onRemove={() => onAttachmentRemoved?.('document')}
                />
              )}
              {imageAttachment && (
                <AttachmentChip
                  label={imageAttachment.filename}
                  isImage
                  imageUri={imageAttachment.uri}
                  onRemove={() => onAttachmentRemoved?.('image')}
                />
              )}
            </View>
          )}

          {/* ── Input row inside pill: plus btn + text field + actions ──── */}
          <View style={s.inputPillRow}>

          {/* ── Plus / attach button — far left inside pill ──────────────── */}
          <TouchableOpacity
            style={[s.plusBtn, (blocked || extracting) && s.plusBtnDisabled]}
            onPress={() => setAttachMenuOpen(true)}
            disabled={blocked || extracting}
            activeOpacity={0.75}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          >
            <PlusIcon size={scale(18)} color={blocked || extracting ? '#444455' : '#ECECF1'} />
          </TouchableOpacity>

          {/* ── Waveform + label (absolutely overlays the text field) ──── */}
          {isListening && (
            <View style={s.waveformOverlay} pointerEvents="none">
              <VoiceWaveform volumeRef={volumeRef} />
              <Text style={s.listeningLabel}>Listening…</Text>
            </View>
          )}

          {/* ── Text input — hidden (opacity:0) while listening so its
               flex:1 still holds the space, keeping the bar height fixed ── */}
          <TextInput
            ref={inputRef}
            style={[s.inputField, isListening && s.inputFieldHidden]}
            placeholder={offline ? 'You are offline' : placeholder}
            placeholderTextColor="#6B6B7A"
            selectionColor={C.purpleSoft}
            value={inputText}
            onChangeText={handleChangeText}
            onPressIn={onInputPressIn}
            onSubmitEditing={blocked ? null : handleSend}
            returnKeyType="send"
            editable={!blocked && !isListening}
            multiline
            blurOnSubmit={false}
          />

          {/* ── Right-side action buttons ───────────────────────────────
               Empty input  → Mic (left of Live) + Live (rightmost)
               Text typed   → Send only (rightmost)
               AI typing    → Stop only (rightmost)                    ── */}

          {isTyping ? (
            /* ── Stop button (AI is generating) ── */
            <TouchableOpacity
              style={[s.actionBtn, s.stopBtnActive,
                { width: sendBtnSize, height: sendBtnSize, borderRadius: sendBtnSize / 2 }]}
              onPress={onStop}
              activeOpacity={0.85}
            >
              <StopIcon color="#FFFFFF" />
            </TouchableOpacity>

          ) : hasText ? (
            /* ── Send button (user has typed something) ── */
            <TouchableOpacity
              style={[
                s.actionBtn,
                { width: sendBtnSize, height: sendBtnSize, borderRadius: sendBtnSize / 2 },
                !offline && !loading ? s.sendBtnActive : s.sendBtnInactive,
              ]}
              onPress={handleSend}
              activeOpacity={0.85}
              disabled={offline || loading}
            >
              <SendIcon
                isActive={!offline && !loading}
                color={!offline && !loading ? '#0E0E18' : '#6B6B7A'}
              />
            </TouchableOpacity>

          ) : (
            /* ── Empty input: Mic (left) + Live (right, at Send position) ── */
            <>
              <TouchableOpacity
                style={[
                  s.micBtn,
                  isListening && s.micBtnActive,
                  micError    && s.micBtnError,
                ]}
                onPress={isListening ? stopVoice : startVoice}
                disabled={offline || loading}
                activeOpacity={0.75}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MicIcon active={isListening} size={20} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.actionBtn,
                  { width: sendBtnSize, height: sendBtnSize, borderRadius: sendBtnSize / 2 },
                  s.liveBtnIdle,
                ]}
                onPress={onLiveTalk}
                disabled={offline || loading}
                activeOpacity={0.75}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <LiveIcon active={false} size={19} />
              </TouchableOpacity>
            </>
          )}
          </View>{/* end inputPillRow */}
        </View>
      </View>

      {/* ── Loading scrim ─────────────────────────────────────────────── */}
      {loading && <View style={[s.inputBarScrim, { pointerEvents: 'box-only' }]} />}

      {/* ── Extracting overlay ──────────────────────────────────────────── */}
      {extracting && (
        <View style={s.extractingOverlay} pointerEvents="none">
          <Text style={s.extractingText}>Extracting document…</Text>
        </View>
      )}

      {/* ── Attach menu ─────────────────────────────────────────────────── */}
      <AttachMenu
        visible={attachMenuOpen}
        onClose={() => setAttachMenuOpen(false)}
        onPickDocument={handlePickDocument}
        onPickImage={handlePickImage}
        visionEnabled={visionEnabled}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Outer bar
  inputBar: {
    paddingHorizontal: spacing(16),
    paddingTop: spacing(8),
    paddingBottom: Platform.select({ ios: spacing(24), android: spacing(20) }),
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
  inputBarDocked: {
    paddingTop: 0,
    paddingBottom: spacing(8),
    marginBottom: spacing(8),
  },
  inputBarFloating: {
    width: '96%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 0,
    paddingTop: spacing(8),
  },
  inputBarChat: {
    width: '96%',
    alignSelf: 'center',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  inputBarLoading: { opacity: 0.38 },

  // Agent strip
  agentStrip: { marginBottom: spacing(8) },
  stripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius(10),
    paddingHorizontal: spacing(12),
    paddingVertical: spacing(5),
    minHeight: verticalScale(30),
  },
  stripDots: { flexDirection: 'row', alignItems: 'center', gap: spacing(10) },
  miniAgentItem: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  miniDot: { width: scale(6), height: scale(6), borderRadius: scale(3) },
  miniAgentName: { fontSize: fontScale(9), fontWeight: '700', letterSpacing: 0.3 },
  stripStatus: { fontSize: fontScale(9), fontWeight: '600', color: C.textMuted, letterSpacing: 0.3 },

  // ── Attachment chip row — sits inside the pill above the text input ──────
  attachChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(6),
    paddingTop: spacing(4),
    paddingBottom: spacing(6),
    paddingHorizontal: spacing(6),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(123,47,255,0.2)',
  },
  attachChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(123,47,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(123,47,255,0.4)',
    borderRadius: radius(20),
    paddingLeft: spacing(6),
    paddingRight: spacing(8),
    paddingVertical: spacing(4),
    gap: spacing(6),
    maxWidth: scale(220),
  },
  attachChipThumb: {
    width: scale(22),
    height: scale(22),
    borderRadius: radius(4),
  },
  attachChipDocIcon: {
    width: scale(22),
    height: scale(22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachChipDocIconText: { fontSize: fontScale(14) },
  attachChipLabel: {
    flex: 1,
    color: '#C4B5FD',
    fontSize: fontScale(11),
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  attachChipRemove: { paddingLeft: spacing(2) },
  attachChipRemoveText: {
    color: 'rgba(196,181,253,0.65)',
    fontSize: fontScale(11),
    fontWeight: '700',
  },

  // ── Input row (wraps the pill) ─────────────────────────────────────────
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  // ── Inner row inside pill: plus btn + text field + action buttons ────────
  inputPillRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flex: 1,
    paddingLeft: spacing(10),
    paddingRight: spacing(14),
  },

  // Plus button — bare icon, no background/border, sits inside pill at left
  plusBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: scale(28),
    height: scale(28),
    marginRight: spacing(2),
    marginBottom: spacing(2),
    flexShrink: 0,
  },
  plusBtnDisabled: {
    opacity: 0.35,
  },

  // Input container (the main pill) — column layout to host chip row + input row
  inputContainer: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#0D0D16',
    borderWidth: 1.5,
    borderColor: 'rgba(123,47,255,0.45)',
    borderRadius: radius(26),
    paddingVertical: spacing(6),
    minHeight: verticalScale(48),
    maxHeight: verticalScale(180),
    shadowColor: '#7B2FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',   // clips the waveform inside the pill
  },

  // When an attachment chip is present, allow extra height
  inputContainerWithAttachment: {
    maxHeight: verticalScale(220),
  },
  inputContainerFloating: {
    backgroundColor: '#0D0D16',
    borderColor: 'rgba(123,47,255,0.5)',
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 12,
  },
  inputContainerOffline: {
    borderColor: 'rgba(239,68,68,0.45)',
    shadowColor: '#EF4444',
    shadowOpacity: 0.3,
  },
  inputContainerListening: {
    borderColor: 'rgba(123,47,255,0.85)',
    shadowOpacity: 0.8,
  },

  // Text field
  inputField: {
    flex: 1,
    color: '#ECECF1',
    fontSize: fontScale(16),
    lineHeight: fontScale(22),
    paddingTop: Platform.OS === 'ios' ? spacing(8) : spacing(6),
    paddingBottom: Platform.OS === 'ios' ? spacing(8) : spacing(6),
    paddingRight: spacing(8),
    maxHeight: verticalScale(120),
  },
  // Keep flex:1 space but hide text while mic is live (no layout change)
  // Also lock height to a single line so interim transcripts can't grow the bar.
  inputFieldHidden: { opacity: 0, maxHeight: verticalScale(36) },

  // Waveform overlay — sits over the invisible TextInput, never adds height
  waveformOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Align after plus button; pull back before the action buttons
    left: spacing(10) + scale(28) + spacing(2),
    right: verticalScale(32) * 2 + spacing(4) + spacing(6) + spacing(6),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(8),
    zIndex: 2,
    overflow: 'hidden',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_H,
    width: WAVE_W,
  },
  waveBar: {
    width: BAR_W,
    height: BAR_H,
    borderRadius: BAR_W / 2,
    backgroundColor: '#A78BFA',
  },
  listeningLabel: {
    fontSize: fontScale(13),
    color: 'rgba(167,139,250,0.75)',
    fontWeight: '500',
    letterSpacing: 0.2,
    flexShrink: 1,
  },

  // Buttons — shared base for the rightmost circular action slot
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(2),
  },
  sendBtnActive:   { backgroundColor: '#FFFFFF' },
  sendBtnInactive: { backgroundColor: 'rgba(255,255,255,0.08)' },
  stopBtnActive:   { backgroundColor: '#EF4444' },

  // Live button idle state — purple circle border, no fill
  liveBtnIdle: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(123,47,255,0.45)',
  },

  // Mic button
  micBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: verticalScale(36),
    height: verticalScale(36),
    borderRadius: verticalScale(18),
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(123,47,255,0.45)',
    marginBottom: spacing(2),
    marginRight: spacing(10),
  },
  micBtnActive: {
    backgroundColor: 'rgba(123,47,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.65)',
  },
  micBtnError: {
    backgroundColor: 'rgba(239,68,68,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.5)',
  },

  // Loading scrim
  inputBarScrim: { ...StyleSheet.absoluteFillObject, borderRadius: radius(26) },

  // Extracting overlay
  extractingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,13,22,0.72)',
    borderRadius: radius(26),
    alignItems: 'center',
    justifyContent: 'center',
  },
  extractingText: {
    color: '#C4B5FD',
    fontSize: fontScale(13),
    fontWeight: '600',
  },

  // ── Attach menu (bottom sheet) ────────────────────────────────────────────
  attachMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  attachMenuSheet: {
    backgroundColor: '#13131F',
    borderTopLeftRadius: radius(20),
    borderTopRightRadius: radius(20),
    borderTopWidth: 1,
    borderColor: 'rgba(123,47,255,0.25)',
    paddingHorizontal: spacing(20),
    paddingTop: spacing(12),
    paddingBottom: spacing(36),
  },
  attachMenuHandle: {
    width: scale(36),
    height: scale(4),
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius(2),
    alignSelf: 'center',
    marginBottom: spacing(16),
  },
  attachMenuTitle: {
    color: '#ECECF1',
    fontSize: fontScale(16),
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: spacing(16),
  },
  attachMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(14),
    gap: spacing(14),
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  attachMenuRowDisabled: { opacity: 0.4 },
  attachMenuIconBox: {
    width: verticalScale(44),
    height: verticalScale(44),
    borderRadius: radius(12),
    backgroundColor: 'rgba(123,47,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(123,47,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachMenuIconBoxDisabled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  attachMenuRowText: { flex: 1 },
  attachMenuRowTitle: {
    color: '#ECECF1',
    fontSize: fontScale(15),
    fontWeight: '600',
    marginBottom: spacing(2),
  },
  attachMenuRowTitleDisabled: { color: '#555566' },
  attachMenuRowSub: {
    color: '#57606A',
    fontSize: fontScale(12),
    lineHeight: fontScale(17),
  },
});
