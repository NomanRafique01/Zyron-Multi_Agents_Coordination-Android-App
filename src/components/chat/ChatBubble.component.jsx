import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation, Clipboard, Animated, Image } from 'react-native';
import * as Speech from 'expo-speech';
import C from '../../config/colors.config';
import SyntaxCode from './SyntaxCode.component.jsx';
import AgentPanel from '../agent/AgentPanel.component.jsx';
import MathFormula from '../math/MathFormula.component.jsx';
import { getTeamById } from '../../agents/teams';

import { parseMarkdown } from './chatBubble.parsers.js';
import { AGENT_KEYS, AGENT_ATTRIBUTION } from './chatBubble.constants.js';
import { s } from './chatBubble.styles.js';
import MarkdownTable from './MarkdownTable.component.jsx';
import MarkdownText from './MarkdownText.component.jsx';
import { VisualLegend, TokenUsagePanel, UserAvatar, AiAvatar, PulsingDots } from './ChatBubbleUI.component.jsx';
import { InfoIcon, CopyIcon, RefreshIcon, SpeakIcon, EyeIcon, ThreeDotIcon } from '../shared/Icons';

// ═══════════════════════════════════════════════════════
// DOC ATTACHMENT BUBBLE — 120×80, centered SVG icon, optional spinner
// ═══════════════════════════════════════════════════════
function DocAttachmentBubble({ extracting = false, error = false, thumbnail = null }) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!extracting) {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [extracting, spinAnim]);

  const rotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={s.docBubble}>
      {/* PDF thumbnail or fallback SVG icon */}
      {thumbnail ? (
        <Image
          source={{ uri: `data:image/png;base64,${thumbnail}` }}
          style={s.docBubbleThumbnail}
          resizeMode="cover"
        />
      ) : (
        <DocFileIcon size={38} error={error} />
      )}

      {/* Spinner overlay while extracting */}
      {extracting && (
        <View style={s.docBubbleSpinnerOverlay}>
          <Animated.View style={[s.docBubbleSpinner, { transform: [{ rotate }] }]} />
        </View>
      )}

      {/* Error dot */}
      {error && !extracting && (
        <View style={s.docBubbleErrorDot} />
      )}
    </View>
  );
}

// Simple inline SVG-style doc icon using View geometry
function DocFileIcon({ size = 38, error = false }) {
  const color = error ? '#EF4444' : '#A78BFA';
  const w = size * 0.72;
  const h = size;
  const fold = size * 0.22;
  return (
    <View style={{ width: w, height: h, justifyContent: 'center', alignItems: 'center' }}>
      {/* Page body */}
      <View style={{
        width: w,
        height: h,
        backgroundColor: 'rgba(167,139,250,0.08)',
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: `${color}55`,
        overflow: 'hidden',
        justifyContent: 'flex-end',
        paddingBottom: 7,
        paddingHorizontal: 7,
      }}>
        {/* Fold corner — top-right */}
        <View style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: fold,
          height: fold,
          backgroundColor: error ? 'rgba(239,68,68,0.15)' : 'rgba(167,139,250,0.18)',
          borderBottomLeftRadius: 4,
          borderTopRightRadius: 5,
        }} />
        {/* Lines representing text */}
        {[1, 0.75, 0.55].map((opacity, i) => (
          <View key={i} style={{
            height: 2,
            borderRadius: 1,
            backgroundColor: color,
            opacity,
            marginTop: i === 0 ? 0 : 4,
            width: i === 2 ? '55%' : '85%',
          }} />
        ))}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN CHAT BUBBLE COMPONENT
// ═══════════════════════════════════════════════════════
export default function ChatBubble({ msg, isTyping, mode, simulatedAgents, onRegenerate, isSpeakingRef, onSpeakStart }) {
  const isUser = msg ? msg.sender === 'user' : false;
  const [copied, setCopied] = useState(false);
  const [userCopied, setUserCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [visualMode, setVisualMode] = useState(false);
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Active spoken-line index for the reading bar  { blockIdx, lineIdx } | null
  const [ttsActiveLine, setTtsActiveLine] = useState(null);

  const speakIntervalRef    = useRef(null);
  const ttsSpokenLinesRef   = useRef([]);
  const ttsLineIdxRef       = useRef(0);
  const ttsSpeakingRef      = useRef(false);

  // Keep local state and the shared ref in sync
  const setSpeaking = useCallback((val) => {
    setIsSpeaking(val);
    if (isSpeakingRef) isSpeakingRef.current = val;
  }, [isSpeakingRef]);

  const stopSpeak = useCallback(() => {
    ttsSpeakingRef.current = false;
    Speech.stop();
    setSpeaking(false);
    setTtsActiveLine(null);
    ttsSpokenLinesRef.current = [];
    ttsLineIdxRef.current = 0;
    if (speakIntervalRef.current) {
      clearInterval(speakIntervalRef.current);
      speakIntervalRef.current = null;
    }
  }, [setSpeaking]);

  // Build flat spoken-line list from parsed markdown blocks.
  // Only text-type blocks contribute lines; code/math/table are skipped.
  const buildSpokenLines = useCallback((blocks) => {
    const lines = [];
    blocks.forEach((block, bIdx) => {
      if (block.type !== 'text') return;
      const rawLines = block.content.split('\n');
      rawLines.forEach((rawLine, lIdx) => {
        const text = rawLine
          .replace(/^#{1,6}\s*/, '')
          .replace(/^\s*[-*]\s/, '')
          .replace(/^\s*\d+\.\s/, '')
          .replace(/\*{1,3}|_{1,3}/g, '')
          .replace(/`[^`]*`/g, '')
          .replace(/https?:\/\/\S+/g, '')
          .replace(/^[-\s]+$/, '')
          .replace(/--+/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!text) return;
        lines.push({ blockIdx: bIdx, lineIdx: lIdx, text });
      });
    });
    return lines;
  }, []);

  // Speak one line at a time — advances via onDone callbacks.
  const speakLine = useCallback((lineIdx) => {
    if (!ttsSpeakingRef.current) return;
    const lines = ttsSpokenLinesRef.current;

    if (lineIdx >= lines.length) {
      setSpeaking(false);
      setTtsActiveLine(null);
      return;
    }

    const { blockIdx, lineIdx: rawLineIdx, text } = lines[lineIdx];
    ttsLineIdxRef.current = lineIdx;
    setTtsActiveLine({ blockIdx, lineIdx: rawLineIdx });

    Speech.speak(text, {
      language: 'en-GB',
      pitch: 1.15,
      rate: 0.82,
      onDone:    () => speakLine(lineIdx + 1),
      onError:   () => { setSpeaking(false); setTtsActiveLine(null); },
      onStopped: () => { setSpeaking(false); setTtsActiveLine(null); },
    });
  }, [setSpeaking]);

  const handleSpeak = useCallback(() => {
    if (!msg?.text) return;
    if (isSpeaking) { stopSpeak(); return; }

    const msgBlocks    = parseMarkdown(msg.text);
    const spokenLines  = buildSpokenLines(msgBlocks);
    if (!spokenLines.length) return;

    ttsSpokenLinesRef.current = spokenLines;
    ttsLineIdxRef.current     = 0;
    ttsSpeakingRef.current    = true;
    setSpeaking(true);
    if (onSpeakStart) onSpeakStart(msg);
    speakLine(0);
  }, [msg, isSpeaking, speakLine, stopSpeak, setSpeaking, buildSpokenLines, onSpeakStart]);

  const handleCopyResponse = () => {
    if (!msg?.text) return;
    try {
      Clipboard.setString(msg.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard setString failed:', err);
    }
  };

  const handleCopyUser = () => {
    if (!msg?.text) return;
    try {
      Clipboard.setString(msg.text);
      setUserCopied(true);
      setTimeout(() => setUserCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard setString failed:', err);
    }
  };

  const toggleMetrics = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMetricsExpanded(!metricsExpanded);
  };

  const toggleVisualMode = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setVisualMode(!visualMode);
    setMenuOpen(false);
  };

  // ─── TYPING INDICATOR BUBBLE ────────────────────────
  if (isTyping) {
    const isAgentsMode = mode === 'agents';
    return (
      <View style={s.containerAiFull}>
        <View style={s.aiHeaderRow}>
          <AiAvatar />
          <Text style={s.senderName}>ZYNOR</Text>
          <View style={[s.modeBadge, isAgentsMode ? s.modeBadgeAgents : s.modeBadgeFast]}>
            <Text style={[s.modeBadgeText, { color: isAgentsMode ? C.purpleSoft : C.purple }]}>
              {isAgentsMode ? (getTeamById(msg?.teamId)?.name || 'AGENTS') : 'FAST'}
            </Text>
          </View>
        </View>

        <View style={[s.bubble, s.bubbleAiFull, isAgentsMode ? s.bubbleBorderAgents : s.bubbleBorderFast]}>
          {isAgentsMode ? (
            <>
              <Text style={s.aiText}>Agents coordinating response...</Text>
              <AgentPanel agents={simulatedAgents} />
            </>
          ) : (
            <View style={s.fastTypingRow}>
              <Text style={s.aiText}>Generating response</Text>
              <PulsingDots />
            </View>
          )}
        </View>
      </View>
    );
  }

  // ─── USER BUBBLE ─────────────────────────────────────
  if (isUser) {
    return (
      <View style={[s.container, s.containerUser]}>
        <View style={s.avatarCol}>
          <UserAvatar />
        </View>
        <View style={s.bubbleCol}>
          <View style={[s.bubbleHeader, s.bubbleHeaderUser]}>
            <Text style={s.userSenderName}>You</Text>
          </View>
          {msg.attachedDoc && (
            <DocAttachmentBubble
              extracting={msg.docExtracting}
              error={msg.docExtractError}
              thumbnail={msg.docThumbnail ?? null}
            />
          )}
          <View style={[s.bubble, s.bubbleUser]}>
            <Text style={s.userText}>{msg.text}</Text>
            <Text style={[s.timestamp, s.timestampUser]}>{msg.timestamp}</Text>
          </View>
          <View style={s.userBubbleActions}>
            <TouchableOpacity
              style={[s.actionPill, userCopied && s.actionPillCopied]}
              onPress={handleCopyUser}
              activeOpacity={0.75}
            >
              <CopyIcon color={userCopied ? C.green : '#8A8AAD'} size={14} />
              <Text style={[s.actionPillText, userCopied && { color: C.green }]}>
                {userCopied ? 'Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ─── LIVE TALK: skip AI bubble entirely (voice-only output) ──────────────
  if (msg.mode === 'live' && msg.sender === 'ai') return null;

  // ─── AI MESSAGE BUBBLE ────────────────────────────────
  const isAgents   = msg.mode === 'agents';
  // Fast mode now uses purple shades to match the existing purple palette
  const themeColor = isAgents ? C.purpleSoft : C.purple;
  const blocks     = parseMarkdown(msg.text);

  return (
    <View style={s.containerAiFull}>
      {/* Header: Avatar + Name + Mode badge + Three-dot menu */}
      <View style={s.aiHeaderRow}>
        <AiAvatar />
        <Text style={s.senderName}>ZYNOR</Text>
        <View style={[s.modeBadge, isAgents ? s.modeBadgeAgents : s.modeBadgeFast]}>
          <Text style={[s.modeBadgeText, { color: isAgents ? C.purpleSoft : C.purple }]}>
            {isAgents ? (getTeamById(msg.teamId)?.name || 'AGENTS') : 'FAST'}
          </Text>
        </View>

        <TouchableOpacity
          style={s.threeDotBtn}
          onPress={() => setMenuOpen(!menuOpen)}
          activeOpacity={0.7}
        >
          <ThreeDotIcon color="#8A8A9D" />
        </TouchableOpacity>

        {menuOpen && (
          <View style={s.dropdownMenu}>
            <TouchableOpacity style={s.dropdownItem} onPress={toggleVisualMode}>
              <EyeIcon color={visualMode ? C.green : '#A7A7C0'} />
              <Text style={[s.dropdownText, visualMode && { color: C.green }]}>
                {visualMode ? 'Normal View' : 'Visual Attribution'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Content Bubble */}
      <View style={[s.bubble, s.bubbleAiFull, isAgents ? s.bubbleBorderAgents : s.bubbleBorderFast]}>

        {blocks.map((block, idx) => {
          if (block.type === 'code') {
            const agentKey = AGENT_KEYS[idx % AGENT_KEYS.length];
            const attr     = AGENT_ATTRIBUTION[agentKey];
            return (
              <View
                key={idx}
                style={[
                  s.codeWrapper,
                  visualMode && {
                    borderColor: attr.color,
                    borderWidth: 2,
                    borderRadius: 14,
                    padding: 2,
                    backgroundColor: attr.bg,
                    marginBottom: 8,
                  }
                ]}
              >
                <SyntaxCode code={block.content} language={block.language} />
              </View>
            );
          }

          if (block.type === 'math-display') {
            return <MathFormula key={idx} latex={block.content} display={true} />;
          }

          if (block.type === 'table') {
            return (
              <MarkdownTable
                key={idx}
                headers={block.headers}
                rows={block.rows}
                visualMode={visualMode}
                blockIndex={idx}
              />
            );
          }

          const blockActiveLine =
            isSpeaking && ttsActiveLine != null && ttsActiveLine.blockIdx === idx
              ? ttsActiveLine.lineIdx
              : -1;

          return (
            <MarkdownText
              key={idx}
              content={block.content}
              visualMode={visualMode}
              blockIndex={idx}
              activeLine={blockActiveLine}
              themeColor={themeColor}
            />
          );
        })}

        {/* Agent coordination panel — Agents mode only */}
        {msg.agents && isAgents && (
          <View style={s.panelContainer}>
            <AgentPanel agents={msg.agents} variant="summary" teamId={msg.teamId} />
          </View>
        )}

        {/* Visual attribution legend */}
        {visualMode && <VisualLegend onClose={() => setVisualMode(false)} />}

        {/* Token metrics panel */}
        <TokenUsagePanel
          tokenUsage={msg.tokenUsage}
          mode={msg.mode}
          expanded={metricsExpanded}
          setExpanded={setMetricsExpanded}
        />

        {/* Bottom row: token pill + timestamp */}
        <View style={s.bubbleBottomRow}>
          <TouchableOpacity
            style={[
              s.metricsTogglePill,
              {
                borderColor: metricsExpanded ? themeColor + '60' : 'rgba(255, 255, 255, 0.07)',
                backgroundColor: metricsExpanded ? `${themeColor}12` : 'transparent',
              }
            ]}
            onPress={toggleMetrics}
            activeOpacity={0.7}
          >
            <InfoIcon color={metricsExpanded ? themeColor : '#5A5A72'} />
            <Text style={[s.metricsTogglePillText, { color: metricsExpanded ? themeColor : '#5A5A72' }]}>
              {metricsExpanded ? 'Hide Tokens' : 'Token Usage'}
            </Text>
          </TouchableOpacity>
          <Text style={s.timestampText}>{msg.timestamp}</Text>
        </View>
      </View>

      {/* Outside-bubble action row */}
      <View style={s.outsideActionsRow}>
        <View style={s.outsideActionsLeft}>

          <TouchableOpacity
            style={[s.actionPill, copied && s.actionPillCopied]}
            onPress={handleCopyResponse}
            activeOpacity={0.75}
          >
            <CopyIcon color={copied ? C.green : '#8A8AAD'} size={14} />
            <Text style={[s.actionPillText, copied && { color: C.green }]}>
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </TouchableOpacity>

          {onRegenerate && (
            <TouchableOpacity
              style={s.actionPill}
              onPress={() => onRegenerate(msg.id)}
              activeOpacity={0.75}
            >
              <RefreshIcon color="#8A8AAD" size={14} />
              <Text style={s.actionPillText}>Retry</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[s.actionPill, isSpeaking && s.actionPillSpeaking]}
            onPress={handleSpeak}
            activeOpacity={0.75}
          >
            <SpeakIcon color={isSpeaking ? '#A78BFA' : '#8A8AAD'} size={14} active={isSpeaking} />
            <Text style={[s.actionPillText, isSpeaking && s.actionPillTextSpeaking]}>
              {isSpeaking ? 'Stop' : 'Speak'}
            </Text>
          </TouchableOpacity>

        </View>
      </View>
    </View>
  );
}
