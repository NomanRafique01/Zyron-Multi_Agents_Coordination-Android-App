import React, { useRef, useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, Image, Animated, TouchableOpacity, LayoutAnimation, Clipboard, ScrollView } from 'react-native';
import C from '../../config/colors.config';
import SyntaxCode from './SyntaxCode.component.jsx';
import AgentPanel from '../agent/AgentPanel.component.jsx';
import Svg, { Path, Circle } from 'react-native-svg';
import { InfoIcon, CopyIcon, ThreeDotIcon, CrossIcon, EyeIcon, RefreshIcon, SpeakIcon } from '../shared/Icons';
import * as Speech from 'expo-speech';
import MathFormula from '../math/MathFormula.component.jsx';
import { splitInlineMath, splitByDisplayMath } from '../../utils/mathParser.utils';
import { getTeamById } from '../../agents/teams';

// Helper to provide demo token data for initial messages
const getDemoTokens = (msgMode) => {
  if (msgMode === 'agents') {
    return {
      Reasoner: { prompt_tokens: 352, completion_tokens: 512, total_tokens: 864 },
      Coder: { prompt_tokens: 412, completion_tokens: 820, total_tokens: 1232 },
      Vision: { prompt_tokens: 128, completion_tokens: 256, total_tokens: 384 },
      Writer: { prompt_tokens: 2480, completion_tokens: 610, total_tokens: 3090 },
    };
  } else {
    return {
      Reasoner: { prompt_tokens: 84, completion_tokens: 180, total_tokens: 264 }
    };
  }
};

// ─── Agent attribution config (fixed colors) ────────
const AGENT_ATTRIBUTION = {
  reasoner: { color: C.agentReasoner, bg: 'rgba(167, 139, 250, 0.10)', label: 'Reasoner' },
  coder:    { color: C.agentCoder,    bg: 'rgba(96, 165, 250, 0.10)',  label: 'Coder' },
  vision:   { color: C.agentVision,   bg: 'rgba(110, 231, 183, 0.10)', label: 'Vision' },
  writer:   { color: C.agentWriter,   bg: 'rgba(251, 191, 36, 0.08)', label: 'Writer' },
  // Fallbacks
  Reasoner: { color: C.agentReasoner, bg: 'rgba(167, 139, 250, 0.10)', label: 'Reasoner' },
  Coder:    { color: C.agentCoder,    bg: 'rgba(96, 165, 250, 0.10)',  label: 'Coder' },
  Vision:   { color: C.agentVision,   bg: 'rgba(110, 231, 183, 0.10)', label: 'Vision' },
  Writer:   { color: C.agentWriter,   bg: 'rgba(251, 191, 36, 0.08)', label: 'Writer' },
};
const AGENT_KEYS = ['reasoner', 'coder', 'vision', 'writer'];

// ─── Advanced Markdown Parser ────────────────────────
// Splits text into: text blocks, code blocks, table blocks, and display-math blocks
const parseMarkdown = (text) => {
  if (!text) return [];
  const parts = [];
  const regex = /```(\w*)\n([\s\S]*?)\n?```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const textBefore = text.slice(lastIndex, match.index);
    if (textBefore.trim()) {
      const subParts = parseDisplayMathAndTables(textBefore);
      parts.push(...subParts);
    }
    parts.push({
      type: 'code',
      language: match[1] || 'code',
      content: match[2],
    });
    lastIndex = regex.lastIndex;
  }

  const textAfter = text.slice(lastIndex);
  if (textAfter.trim() || parts.length === 0) {
    const subParts = parseDisplayMathAndTables(textAfter || text);
    parts.push(...subParts);
  }

  return parts;
};

// ─── Display-math + Table extractor ─────────────────
// Splits a text segment into: display-math blocks, table blocks, and text blocks.
// Display math (\[...\] or $$...$$) is extracted first, then tables from remaining text.
const parseDisplayMathAndTables = (text) => {
  if (!text) return [];
  const result = [];

  // Split by display math delimiters first
  const mathSegments = splitByDisplayMath(text);
  for (const seg of mathSegments) {
    if (seg.type === 'math-display') {
      result.push({ type: 'math-display', content: seg.content });
    } else {
      // For plain text segments, further split into table vs text blocks
      const tableAndText = parseTablesFromText(seg.content);
      result.push(...tableAndText);
    }
  }

  return result;
};

// Count actual pipe separators in a line (ignoring escaped pipes)
const splitUnescapedPipes = (line) => {
  const cells = [];
  let current = '';
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '|' && line[i - 1] !== '\\') {
      cells.push(current);
      current = '';
    } else {
      current += line[i];
    }
  }
  cells.push(current);
  return cells;
};

// ─── Table Detector — splits text into text+table blocks ─
const parseTablesFromText = (text) => {
  const lines = text.split('\n');
  const blocks = [];
  let currentTextLines = [];
  let tableLines = [];
  let inTable = false;

  const flushText = () => {
    if (currentTextLines.length > 0) {
      const joined = currentTextLines.join('\n');
      if (joined.trim()) {
        blocks.push({ type: 'text', content: joined });
      }
      currentTextLines = [];
    }
  };

  const flushTable = () => {
    if (tableLines.length >= 2) {
      const parsed = parseTableBlock(tableLines);
      if (parsed) {
        blocks.push(parsed);
      } else {
        currentTextLines.push(...tableLines);
      }
    } else if (tableLines.length > 0) {
      currentTextLines.push(...tableLines);
    }
    tableLines = [];
  };

  const countPipes = (line) => {
    return Math.max(0, splitUnescapedPipes(line).length - 1);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const pipeCount = countPipes(trimmed);

    const isSeparator = /^\|?\s*[:|-]+\s*(\|\s*[:|-]+\s*)+\|?\s*$/.test(trimmed) && trimmed.includes('-');

    const nextLineTrimmed = lines[i + 1] ? lines[i + 1].trim() : '';
    const nextPipeCount = countPipes(nextLineTrimmed);
    const nextIsSeparator = nextLineTrimmed && /^\|?\s*[:|-]+\s*(\|\s*[:|-]+\s*)+\|?\s*$/.test(nextLineTrimmed) && nextLineTrimmed.includes('-');

    const isPipeLine = isSeparator || (
      pipeCount >= 1 && (
        inTable ||
        pipeCount >= 2 ||
        trimmed.startsWith('|') ||
        nextPipeCount >= 1 ||
        nextIsSeparator
      )
    );

    if (isPipeLine) {
      if (!inTable) {
        flushText();
        inTable = true;
      }
      tableLines.push(line);
    } else {
      if (inTable) {
        flushTable();
        inTable = false;
      }
      currentTextLines.push(line);
    }
  }

  if (inTable) {
    flushTable();
  }
  flushText();

  return blocks;
};

// ─── Parse a group of table lines into structured data ─
const parseTableBlock = (lines) => {
  let sepIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^[\s|]*[-:]+[\s]*(\|[\s]*[-:]+[\s]*)+[\s|]*$/.test(trimmed) && trimmed.includes('-')) {
      sepIdx = i;
      break;
    }
  }

  const parseCells = (line) => {
    let trimmed = line.trim();
    if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
    if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
    return splitUnescapedPipes(trimmed).map(c => c.replace(/\\\|/g, '|').trim());
  };

  let headers = [];
  let rows = [];

  if (sepIdx > 0) {
    headers = parseCells(lines[sepIdx - 1]);
    for (let i = sepIdx + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed && trimmed.includes('|')) {
        const cells = parseCells(lines[i]);
        if (cells.length > 0) rows.push(cells);
      }
    }
  } else if (sepIdx === 0 && lines.length >= 2) {
    headers = parseCells(lines[1]);
    for (let i = 2; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed && trimmed.includes('|') && !(/^[-|:\s]+$/.test(trimmed))) {
        rows.push(parseCells(lines[i]));
      }
    }
  } else if (lines.length >= 2) {
    headers = parseCells(lines[0]);
    for (let i = 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed && trimmed.includes('|') && !(/^[-|:\s]+$/.test(trimmed))) {
        rows.push(parseCells(lines[i]));
      }
    }
  }

  if (headers.length === 0 || rows.length === 0) return null;

  const colCount = headers.length;
  rows = rows.map(row => {
    while (row.length < colCount) row.push('');
    return row.slice(0, colCount);
  });

  return { type: 'table', headers, rows };
};

// ─── Inline styles renderer (bold, italic, code, inline math) ─
// Returns an array of React elements / strings — must be used inside <Text>.
const renderInlineStyles = (txt, keyPrefix = '') => {
  if (!txt) return '';

  // Split by inline math first (\(...\) and $...$)
  const mathSegments = splitInlineMath(String(txt));
  const hasMath = mathSegments.some(seg => seg.type === 'math-inline');

  if (hasMath) {
    return mathSegments.map((seg, mi) => {
      if (seg.type === 'math-inline') {
        return (
          <MathFormula
            key={`${keyPrefix}m${mi}`}
            latex={seg.content}
            display={false}
          />
        );
      }
      // Recurse on plain text segments (bold/italic/code)
      return renderTextStyles(seg.content, `${keyPrefix}t${mi}`);
    });
  }

  return renderTextStyles(txt, keyPrefix);
};

// ─── Renders bold / italic / inline-code within a plain-text segment ─
const renderTextStyles = (txt, keyPrefix = '') => {
  if (!txt) return '';
  const codeParts = txt.split(/`([^`]+)`/g);
  return codeParts.map((part, i) => {
    if (i % 2 === 1) {
      return <Text key={`${keyPrefix}c${i}`} style={s.mdInlineCode}>{part}</Text>;
    }
    const boldParts = part.split(/\*\*([\s\S]*?)\*\*/g);
    return boldParts.map((bp, j) => {
      if (j % 2 === 1) {
        return <Text key={`${keyPrefix}b${i}-${j}`} style={s.mdBold}>{bp}</Text>;
      }
      const italicParts = bp.split(/\*([\s\S]*?)\*/g);
      return italicParts.map((ip, k) => {
        if (k % 2 === 1) {
          return <Text key={`${keyPrefix}i${i}-${j}-${k}`} style={s.mdItalic}>{ip}</Text>;
        }
        return ip;
      });
    });
  });
};

// ─── Markdown Table Renderer ─────────────────────────
//
// COLUMN-COUNT path  (colCount >= LARGE_TABLE_COL_THRESHOLD):
//   Always scrollable. Each column gets MIN_COL_WIDTH px so content never
//   squeezes. Live animated scrollbar sits outside the ScrollView.
//
// OVERFLOW-DETECTION path  (colCount < LARGE_TABLE_COL_THRESHOLD, i.e. single-col):
//   Render the table normally first. The header row measures its own natural
//   content width (via onLayout on an unconstrained inner View). If that
//   content width exceeds the visible container width we promote to the same
//   scrollable treatment — with per-column widths — and re-render.
//   All multi-column tables (2+) start directly in wide/scrollable mode so
//   long-text cells (e.g. "Why it matters") are always properly constrained.
//
const LARGE_TABLE_COL_THRESHOLD = 2;   // 2+ columns → always scrollable
const COL_WIDTH_MIN   = 100;           // floor: no column is ever narrower than this
const COL_WIDTH_MAX   = 320;           // ceiling: wide enough for long-text columns
const COL_CHARS_SHORT = 10;            // content <= this → use min width
const COL_CHARS_LONG  = 80;            // content >= this → use max width
const MIN_THUMB_RATIO = 0.15;          // scrollbar thumb floor

/**
 * Compute a per-column width for wide/scrollable mode.
 * Strategy: find the longest string in each column (header + all data cells),
 * then linearly interpolate between COL_WIDTH_MIN and COL_WIDTH_MAX based on
 * how that length falls between COL_CHARS_SHORT and COL_CHARS_LONG.
 * All cells in the same column share the same width so rows stay aligned.
 */
function computeColWidths(headers, rows) {
  return headers.map((h, ci) => {
    // Gather all cell texts for this column
    let maxLen = String(h ?? '').length;
    for (const row of rows) {
      const cellLen = String(row[ci] ?? '').length;
      if (cellLen > maxLen) maxLen = cellLen;
    }
    // Clamp to [COL_CHARS_SHORT, COL_CHARS_LONG], then scale linearly
    const clamped = Math.min(Math.max(maxLen, COL_CHARS_SHORT), COL_CHARS_LONG);
    const t = (clamped - COL_CHARS_SHORT) / (COL_CHARS_LONG - COL_CHARS_SHORT);
    return Math.round(COL_WIDTH_MIN + t * (COL_WIDTH_MAX - COL_WIDTH_MIN));
  });
}

function MarkdownTable({ headers, rows, visualMode, blockIndex }) {
  const agentKey = AGENT_KEYS[blockIndex % AGENT_KEYS.length];
  const attr     = AGENT_ATTRIBUTION[agentKey];

  const colCount = headers.length;

  // Whether we are in "wide/scrollable" mode.
  // Starts true for 2+ cols; single-col tables stay in static mode.
  const [wideMode, setWideMode] = useState(colCount >= LARGE_TABLE_COL_THRESHOLD);

  // Overflow detection for small tables: measure unconstrained header row width.
  // We render a hidden off-layout row, grab its width, compare to container.
  const [containerW, setContainerW] = useState(0);    // visible table container width
  const [naturalW,   setNaturalW]   = useState(0);    // unconstrained header content width
  const detectionDone = useRef(false);

  // Once both measurements are available, decide once whether to promote.
  useEffect(() => {
    if (detectionDone.current) return;
    if (wideMode) { detectionDone.current = true; return; }   // already wide
    if (containerW > 0 && naturalW > 0) {
      detectionDone.current = true;
      if (naturalW > containerW + 2) {   // +2px tolerance for sub-pixel rounding
        setWideMode(true);
      }
    }
  }, [containerW, naturalW, wideMode]);

  // Per-column widths for wide mode — computed once from content length.
  // Memoised so the array identity is stable across re-renders.
  const colWidths = React.useMemo(
    () => computeColWidths(headers, rows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // headers/rows never change for a given message — safe to compute once
  );

  // Scroll state for the live scrollbar (used in wide mode)
  const scrollX      = useRef(new Animated.Value(0)).current;
  const [trackWidth,   setTrackWidth]   = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const outerStyle = [
    s.tableOuter,
    visualMode && { borderColor: attr.color, borderWidth: 1.5, backgroundColor: attr.bg },
  ];

  // ── Cell styles ─────────────────────────────────────────────────────────────
  // Wide mode: each cell gets the pre-computed width for its column index.
  // Narrow mode: unchanged — flex-based layout as before.
  const headerCellStyle = (ci) => wideMode
    ? [s.mdTableHeaderCell, s.mdTableHeaderCellCenter, { width: colWidths[ci], flex: undefined }]
    : [s.mdTableHeaderCell, s.mdTableHeaderCellCenter, colCount === 1 ? s.mdTableFirstCol : null];

  const dataCellStyle = (ci) => wideMode
    ? [s.mdTableCell, { width: colWidths[ci], flex: undefined }]
    : [s.mdTableCell, ci === 0 && s.mdTableFirstCol];

  // ── Table rows (shared between both render paths) ────────────────────────
  const headerRow = (
    <View style={[s.mdTableHeaderRow, wideMode && s.mdTableHeaderRowWide]}>
      {headers.map((h, i) => (
        <View key={i} style={headerCellStyle(i)}>
          <Text style={[s.mdTableHeaderText, s.mdTableHeaderTextCenter]} numberOfLines={0}>
            {renderInlineStyles(h, `th${blockIndex}-${i}`)}
          </Text>
        </View>
      ))}
    </View>
  );

  const dataRows = rows.map((row, ri) => (
    <View key={ri} style={[s.mdTableRow, wideMode && s.mdTableRowWide, ri % 2 === 0 && s.mdTableRowAlt]}>
      {row.map((cell, ci) => (
        <View key={ci} style={dataCellStyle(ci)}>
          <Text style={s.mdTableCellText} numberOfLines={0}>
            {renderInlineStyles(cell, `td${blockIndex}-${ri}-${ci}`)}
          </Text>
        </View>
      ))}
    </View>
  ));

  // ── Wide / scrollable path ───────────────────────────────────────────────
  if (wideMode) {
    const scrollable = contentWidth > trackWidth && trackWidth > 0;
    const thumbRatio = scrollable
      ? Math.min(Math.max(trackWidth / contentWidth, MIN_THUMB_RATIO), 1)
      : 1;
    const thumbW      = thumbRatio * trackWidth;
    const maxScrollX  = Math.max(contentWidth - trackWidth, 1);
    const thumbTravel = Math.max(trackWidth - thumbW, 0);

    const thumbTranslateX = scrollX.interpolate({
      inputRange:  [0, maxScrollX],
      outputRange: [0, thumbTravel],
      extrapolate: 'clamp',
    });

    return (
      <View style={outerStyle}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled={true}
          bounces={false}
          style={s.tableScrollView}
          contentContainerStyle={{ flexDirection: 'column' }}
          scrollEventThrottle={16}
          onScroll={(e) => scrollX.setValue(e.nativeEvent.contentOffset.x)}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          onContentSizeChange={(w) => setContentWidth(w)}
        >
          {headerRow}
          {dataRows}
        </ScrollView>

        {scrollable && (
          <View style={[s.tableScrollTrack, { pointerEvents: 'none' }]}>
            <Animated.View
              style={[
                s.tableScrollThumb,
                { width: thumbW, transform: [{ translateX: thumbTranslateX }] },
              ]}
            />
          </View>
        )}
      </View>
    );
  }

  // ── Static path — with overflow detection ────────────────────────────────
  // We overlay an absolutely-positioned, unconstrained duplicate of the header
  // row to measure its natural width. It is invisible (opacity 0) and
  // pointerEvents="none" so it has zero visual / interaction impact.
  return (
    <View
      style={outerStyle}
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
    >
      {headerRow}
      {dataRows}

      {/* Invisible measuring row — renders at natural (unconstrained) width */}
      {!detectionDone.current && (
        <View
          style={{ position: 'absolute', opacity: 0, flexDirection: 'row', pointerEvents: 'none' }}
          onLayout={(e) => setNaturalW(e.nativeEvent.layout.width)}
        >
          {headers.map((h, i) => (
            <View key={i} style={[s.mdTableHeaderCell, { flexShrink: 0 }]}>
              <Text style={s.mdTableHeaderText} numberOfLines={1}>
                {typeof h === 'string' ? h : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Markdown Text Component ─────────────────────────
// Renders heading / list / paragraph lines.
// Display-math blocks (\[...\] / $$...$$) within this content are already
// extracted upstream by parseDisplayMathAndTables — this component only
// receives plain text content (which may still contain inline math).
function MarkdownText({ content, visualMode, blockIndex, activeLine, themeColor }) {
  const lines = content.split('\n');

  const agentKey = AGENT_KEYS[blockIndex % AGENT_KEYS.length];
  const attr = AGENT_ATTRIBUTION[agentKey];

  return (
    <View style={[
      s.mdTextContainer,
      visualMode && {
        backgroundColor: attr.bg,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 8,
        borderLeftWidth: 2,
        borderLeftColor: attr.color,
      }
    ]}>
      {lines.map((line, idx) => {
        let isHeading = false;
        let headingLevel = 0;
        let isListItem = false;
        let isNumberedList = false;
        let numberedPrefix = '';
        let cleanLine = line;

        // Parse Headings (H1 through H5)
        if (line.startsWith('##### ')) {
          isHeading = true; headingLevel = 5; cleanLine = line.slice(6);
        } else if (line.startsWith('#### ')) {
          isHeading = true; headingLevel = 4; cleanLine = line.slice(5);
        } else if (line.startsWith('### ')) {
          isHeading = true; headingLevel = 3; cleanLine = line.slice(4);
        } else if (line.startsWith('## ')) {
          isHeading = true; headingLevel = 2; cleanLine = line.slice(3);
        } else if (line.startsWith('# ')) {
          isHeading = true; headingLevel = 1; cleanLine = line.slice(2);
        }

        // Parse Bullet Lists
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          isListItem = true;
          cleanLine = line.trim().slice(2);
        }

        // Parse Numbered Lists (1. 2. 3. etc)
        const numberedMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
        if (numberedMatch) {
          isNumberedList = true;
          numberedPrefix = numberedMatch[1] + '.';
          cleanLine = numberedMatch[2];
        }

        // ── Full-width reading highlight for the active line ──
        const isActive = !visualMode && activeLine === idx && themeColor;
        const rowHighlight = isActive
          ? {
              backgroundColor: themeColor + '1A',   // ~10% opacity fill
              borderLeftWidth: 2.5,
              borderLeftColor: themeColor,
              borderRadius: 4,
              paddingLeft: 6,
              marginHorizontal: -6,
              paddingHorizontal: 6,
            }
          : undefined;

        if (isHeading) {
          const headingStyle =
            headingLevel === 1 ? s.mdH1 :
            headingLevel === 2 ? s.mdH2 :
            headingLevel === 3 ? s.mdH3 :
            headingLevel === 4 ? s.mdH4 :
            s.mdH5;
          return (
            <Text key={idx} style={[headingStyle, s.mdLine, rowHighlight]}>
              {renderInlineStyles(cleanLine, `h${idx}`)}
            </Text>
          );
        }

        if (isListItem) {
          return (
            <View key={idx} style={[s.mdListItem, s.mdLine, rowHighlight]}>
              <Text style={s.mdBullet}>{'\u2022'}</Text>
              <Text style={s.mdListText}>
                {renderInlineStyles(cleanLine, `li${idx}`)}
              </Text>
            </View>
          );
        }

        if (isNumberedList) {
          return (
            <View key={idx} style={[s.mdListItem, s.mdLine, rowHighlight]}>
              <Text style={s.mdNumberedBullet}>{numberedPrefix}</Text>
              <Text style={s.mdListText}>
                {renderInlineStyles(cleanLine, `nl${idx}`)}
              </Text>
            </View>
          );
        }

        if (line.trim() === '') {
          return <View key={idx} style={s.mdLineSpacing} />;
        }

        return (
          <Text key={idx} style={[s.mdParagraph, s.mdLine, rowHighlight]}>
            {renderInlineStyles(line, `p${idx}`)}
          </Text>
        );
      })}
    </View>
  );
}

// ─── Agent Attribution Legend Panel ──────────────────
function VisualLegend({ onClose }) {
  return (
    <View style={s.legendCard}>
      <View style={s.legendContent}>
        <View style={s.legendHeader}>
          <Text style={s.legendTitle}>Attribution Map</Text>
          <TouchableOpacity onPress={onClose} style={s.legendCloseBtn} activeOpacity={0.7}>
            <CrossIcon color={C.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={s.legendGrid}>
          {AGENT_KEYS.map(key => (
            <View key={key} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: AGENT_ATTRIBUTION[key].color }]} />
              <Text style={s.legendText}>{AGENT_ATTRIBUTION[key].label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Token Usage Expandable Panel ────────────────────
function TokenUsagePanel({ tokenUsage, mode, expanded, setExpanded }) {
  const isAgents = mode === 'agents';
  const themeColor = isAgents ? C.purpleSoft : C.cyan;
  const metrics = tokenUsage || getDemoTokens(mode);

  const rows = Object.entries(metrics).map(([agentName, usage]) => ({
    name: agentName,
    prompt: usage.prompt_tokens || 0,
    completion: usage.completion_tokens || 0,
    total: usage.total_tokens || (usage.prompt_tokens + usage.completion_tokens) || 0,
  }));

  const totalPrompt = rows.reduce((sum, r) => sum + r.prompt, 0);
  const totalCompletion = rows.reduce((sum, r) => sum + r.completion, 0);
  const totalTokens = rows.reduce((sum, r) => sum + r.total, 0);

  if (!expanded) return null;

  return (
    <View style={[
      s.tokenTable,
      { borderColor: isAgents ? 'rgba(123, 47, 255, 0.25)' : 'rgba(0, 212, 255, 0.25)' }
    ]}>
      {/* Metrics Header */}
      <View style={s.tokenTableHeader}>
        <Text style={[s.tokenTableTitle, { color: themeColor }]}>Token Metrics</Text>
        <View style={[s.tokenBadge, { borderColor: themeColor + '40', backgroundColor: themeColor + '12' }]}>
          <Text style={[s.tokenBadgeText, { color: themeColor }]}>{totalTokens.toLocaleString()}</Text>
        </View>
      </View>

      <View style={s.tableHeaderRow}>
        <Text style={[s.tableHeaderCell, s.colAgent, { color: themeColor }]}>Agent</Text>
        <Text style={[s.tableHeaderCell, s.colVal, { color: themeColor }]}>Prompt</Text>
        <Text style={[s.tableHeaderCell, s.colVal, { color: themeColor }]}>Compl.</Text>
        <Text style={[s.tableHeaderCell, s.colVal, { color: themeColor }]}>Total</Text>
      </View>

      {rows.map((row, idx) => {
        const roleKey = AGENT_KEYS[idx % AGENT_KEYS.length];
        const agentColor = AGENT_ATTRIBUTION[roleKey]?.color || '#A7A7C0';
        return (
          <View key={idx} style={[s.tableRow, idx % 2 === 0 && s.tableRowAlt]}>
            <View style={[s.colAgent, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: agentColor }} />
              <Text style={[s.tableCell, s.cellAgentName]}>{row.name}</Text>
            </View>
            <Text style={[s.tableCell, s.colVal]}>{row.prompt}</Text>
            <Text style={[s.tableCell, s.colVal]}>{row.completion}</Text>
            <Text style={[s.tableCell, s.colVal, s.cellTotalVal]}>{row.total}</Text>
          </View>
        );
      })}

      {isAgents && rows.length > 1 && (
        <View style={s.tableTotalRow}>
          <Text style={[s.tableCell, s.colAgent, s.cellTotalLabel]}>Total Agents</Text>
          <Text style={[s.tableCell, s.colVal, s.cellTotalVal]}>{totalPrompt}</Text>
          <Text style={[s.tableCell, s.colVal, s.cellTotalVal]}>{totalCompletion}</Text>
          <Text style={[s.tableCell, s.colVal, s.cellTotalFinal]}>{totalTokens}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Custom User Avatar SVG ─────────────────────────
function UserAvatar() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="12" fill="#2E1A47" />
      <Circle cx="12" cy="8" r="4" fill={C.purple} />
      <Path
        d="M5 19C5 15.6863 8.13401 13 12 13C15.866 13 19 15.6863 19 19"
        stroke={C.purple}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ─── Custom AI Avatar ───────────────────────────────
function AiAvatar() {
  return (
    <View style={s.aiAvatarContainer}>
      <Image
        source={require('../../../assets/images/logo.png')}
        style={s.aiAvatarImage}
        resizeMode="contain"
      />
    </View>
  );
}

// ─── Pulsing Dot Indicator (for Fast mode typing) ───
function PulsingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      );
    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 200);
    const a3 = animate(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={s.pulsingDotsRow}>
      <Animated.View style={[s.pulsingDot, s.pulsingDotCyan, { opacity: dot1 }]} />
      <Animated.View style={[s.pulsingDot, s.pulsingDotCyan, { opacity: dot2 }]} />
      <Animated.View style={[s.pulsingDot, s.pulsingDotCyan, { opacity: dot3 }]} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN CHAT BUBBLE COMPONENT
// ═══════════════════════════════════════════════════════
export default function ChatBubble({ msg, isTyping, mode, simulatedAgents, onRegenerate, isSpeakingRef }) {
  const isUser = msg ? msg.sender === 'user' : false;
  const [copied, setCopied] = useState(false);
  const [userCopied, setUserCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [visualMode, setVisualMode] = useState(false);
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Active spoken-line index for the reading bar  { blockIdx, lineIdx } | null
  const [ttsActiveLine, setTtsActiveLine] = useState(null);

  const speakIntervalRef = useRef(null);
  // Flat ordered list of spoken lines: { blockIdx, lineIdx, text }
  // Built once per speak session; iterated line-by-line.
  const ttsSpokenLinesRef = useRef([]);
  // Current index into ttsSpokenLinesRef (writable in callbacks)
  const ttsLineIdxRef = useRef(0);
  // Guard: set false by stopSpeak to abort in-flight onDone callbacks
  const ttsSpeakingRef = useRef(false);

  // Write isSpeaking state AND keep the shared ref in sync so ChatMessageList
  // can suppress the scroll-to-bottom button during TTS without prop callbacks.
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
    if (speakIntervalRef.current) { clearInterval(speakIntervalRef.current); speakIntervalRef.current = null; }
  }, [setSpeaking]);

  // ─────────────────────────────────────────────────────────────────────
  // Build flat spoken-line list from parsed markdown blocks.
  // Only text-type blocks contribute lines; code/math/table are skipped
  // (their content is already stripped by sanitizeTtsText).
  //
  // Each entry: { blockIdx, lineIdx, text }
  //   blockIdx — index of the block in the blocks array
  //   lineIdx  — index of the raw line inside block.content.split('\n')
  //   text     — sanitised text for that line (spoken by TTS)
  // ─────────────────────────────────────────────────────────────────────
  const buildSpokenLines = useCallback((blocks) => {
    const lines = [];
    blocks.forEach((block, bIdx) => {
      if (block.type !== 'text') return;
      const rawLines = block.content.split('\n');
      rawLines.forEach((rawLine, lIdx) => {
        const text = rawLine
          .replace(/^#{1,6}\s*/, '')       // strip heading markers
          .replace(/^\s*[-*]\s/, '')        // strip list bullet
          .replace(/^\s*\d+\.\s/, '')       // strip numbered list prefix
          .replace(/\*{1,3}|_{1,3}/g, '')  // strip bold/italic markers
          .replace(/`[^`]*`/g, '')          // strip inline code
          .replace(/https?:\/\/\S+/g, '')   // strip URLs
          .replace(/\s+/g, ' ')
          .trim();
        if (!text) return;
        lines.push({ blockIdx: bIdx, lineIdx: lIdx, text });
      });
    });
    return lines;
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  // Speak one line at a time — the only reliable way to sync the reading
  // bar.  Each Speech.speak() call covers exactly one spoken line; when
  // onDone fires we advance lineIdx by 1, update the bar, and speak the
  // next line.  No word-counting, no estimation.
  // ─────────────────────────────────────────────────────────────────────
  const speakLine = useCallback((lineIdx) => {
    // Guard: if stopSpeak was called, abort silently
    if (!ttsSpeakingRef.current) return;

    const lines = ttsSpokenLinesRef.current;

    // ── All lines spoken → done ──
    if (lineIdx >= lines.length) {
      setSpeaking(false);
      setTtsActiveLine(null);
      return;
    }

    const { blockIdx, lineIdx: rawLineIdx, text } = lines[lineIdx];
    ttsLineIdxRef.current = lineIdx;

    // ── Update reading bar ──
    setTtsActiveLine({ blockIdx, lineIdx: rawLineIdx });

    Speech.speak(text, {
      language: 'en',
      pitch: 1.0,
      rate: 0.92,
      onDone:    () => speakLine(lineIdx + 1),
      onError:   () => { setSpeaking(false); setTtsActiveLine(null); },
      onStopped: () => { setSpeaking(false); setTtsActiveLine(null); },
    });
  }, [setSpeaking]);

  const handleSpeak = useCallback(() => {
    if (!msg?.text) return;

    if (isSpeaking) {
      stopSpeak();
      return;
    }

    // ── Build flat spoken-line list and start speaking ──────────────────
    const msgBlocks = parseMarkdown(msg.text);
    const spokenLines = buildSpokenLines(msgBlocks);
    if (!spokenLines.length) return;

    ttsSpokenLinesRef.current = spokenLines;
    ttsLineIdxRef.current     = 0;

    ttsSpeakingRef.current = true;
    setSpeaking(true);
    speakLine(0);
  }, [msg, isSpeaking, speakLine, stopSpeak, setSpeaking, buildSpokenLines]);

  const handleCopyResponse = () => {
    if (!msg || !msg.text) return;
    try {
      Clipboard.setString(msg.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Clipboard setString failed:", err);
    }
  };

  const handleCopyUser = () => {
    if (!msg || !msg.text) return;
    try {
      Clipboard.setString(msg.text);
      setUserCopied(true);
      setTimeout(() => setUserCopied(false), 2000);
    } catch (err) {
      console.warn("Clipboard setString failed:", err);
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

  // ─── TYPING INDICATOR BUBBLE ─────────────────────
  if (isTyping) {
    const isAgentsMode = mode === 'agents';
    return (
      <View style={s.containerAiFull}>
        {/* Top Metadata Row */}
        <View style={s.aiHeaderRow}>
          <AiAvatar />
          <Text style={s.senderName}>ZYNOR</Text>
          <View style={[
            s.modeBadge,
            isAgentsMode ? s.modeBadgeAgents : s.modeBadgeFast
          ]}>
            <Text style={[s.modeBadgeText, { color: isAgentsMode ? C.purpleSoft : C.cyan }]}>
              {isAgentsMode ? (getTeamById(msg?.teamId)?.name || 'AGENTS') : 'FAST'}
            </Text>
          </View>
        </View>

        {/* AI Bubble */}
        <View style={[
          s.bubble,
          s.bubbleAiFull,
          isAgentsMode ? s.bubbleBorderAgents : s.bubbleBorderFast
        ]}>
          {isAgentsMode ? (
            <>
              <Text style={s.aiText}>
                Agents coordinating response...
              </Text>
              <AgentPanel agents={simulatedAgents} />
            </>
          ) : (
            <>
              <View style={s.fastTypingRow}>
                <Text style={s.aiText}>Generating response</Text>
                <PulsingDots />
              </View>
            </>
          )}
        </View>
      </View>
    );
  }

  // ─── USER BUBBLE ─────────────────────────────────
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
          <View style={[s.bubble, s.bubbleUser]}>
            <Text style={s.userText}>{msg.text}</Text>
            <Text style={[s.timestamp, s.timestampUser]}>{msg.timestamp}</Text>
          </View>
          {/* Copy action below user bubble */}
          <View style={s.userBubbleActions}>
            <TouchableOpacity
              style={[
                s.actionPill,
                userCopied && s.actionPillCopied,
              ]}
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

  // ─── AI MESSAGE BUBBLE ───────────────────────────
  const isAgents = msg.mode === 'agents';
  const themeColor = isAgents ? C.purpleSoft : C.cyan;

  const blocks = parseMarkdown(msg.text);

  return (
    <View style={s.containerAiFull}>
      {/* Top Metadata Row: Avatar + Name + Mode Label + Three Dot Button */}
      <View style={s.aiHeaderRow}>
        <AiAvatar />
        <Text style={s.senderName}>ZYNOR</Text>
        <View style={[
          s.modeBadge,
          isAgents ? s.modeBadgeAgents : s.modeBadgeFast
        ]}>
          <Text style={[s.modeBadgeText, { color: isAgents ? C.purpleSoft : C.cyan }]}>
            {isAgents ? (getTeamById(msg.teamId)?.name || 'AGENTS') : 'FAST'}
          </Text>
        </View>

        {/* Three dot button (positioned on the right) */}
        <TouchableOpacity
          style={s.threeDotBtn}
          onPress={() => setMenuOpen(!menuOpen)}
          activeOpacity={0.7}
        >
          <ThreeDotIcon color="#8A8A9D" />
        </TouchableOpacity>

        {/* Dropdown Menu Overlay */}
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

      {/* Content Bubble with mode-specific border accent */}
      <View style={[
        s.bubble,
        s.bubbleAiFull,
        isAgents ? s.bubbleBorderAgents : s.bubbleBorderFast
      ]}>

        {/* Render markdown content: text, code, table, and display-math blocks */}
        {blocks.map((block, idx) => {
          if (block.type === 'code') {
            const agentKey = AGENT_KEYS[idx % AGENT_KEYS.length];
            const attr = AGENT_ATTRIBUTION[agentKey];
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
                <SyntaxCode
                  code={block.content}
                  language={block.language}
                />
              </View>
            );
          }

          if (block.type === 'math-display') {
            return (
              <MathFormula
                key={idx}
                latex={block.content}
                display={true}
              />
            );
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

          // Resolve which raw lineIdx inside THIS block is active
          const blockActiveLine =
            isSpeaking &&
            ttsActiveLine != null &&
            ttsActiveLine.blockIdx === idx
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

        {/* Agent coordination panel — ONLY in Agents Mode, pass teamId for correct icons */}
        {msg.agents && isAgents && (
          <View style={s.panelContainer}>
            <AgentPanel agents={msg.agents} variant="summary" teamId={msg.teamId} />
          </View>
        )}

        {/* Agent Attribution Legend Panel */}
        {visualMode && (
          <VisualLegend onClose={() => setVisualMode(false)} />
        )}

        {/* Token Metrics Table Panel — inside bubble */}
        <TokenUsagePanel
          tokenUsage={msg.tokenUsage}
          mode={msg.mode}
          expanded={metricsExpanded}
          setExpanded={setMetricsExpanded}
        />

        {/* ── Inside-bubble bottom row: token pill left, timestamp right ── */}
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

      {/* ── Outside-bubble action row ── */}
      <View style={s.outsideActionsRow}>
        <View style={s.outsideActionsLeft}>

          {/* Copy */}
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

          {/* Reload / Regenerate */}
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

          {/* Speak / Stop TTS */}
          <TouchableOpacity
            style={[
              s.actionPill,
              isSpeaking && s.actionPillSpeaking,
            ]}
            onPress={handleSpeak}
            activeOpacity={0.75}
          >
            <SpeakIcon
              color={isSpeaking ? '#A78BFA' : '#8A8AAD'}
              size={14}
              active={isSpeaking}
            />
            <Text style={[s.actionPillText, isSpeaking && s.actionPillTextSpeaking]}>
              {isSpeaking ? 'Stop' : 'Speak'}
            </Text>
          </TouchableOpacity>

        </View>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 16,
    width: '100%',
    gap: 10,
  },
  containerUser: {
    flexDirection: 'row-reverse',
    marginBottom: 12,
  },
  containerAiFull: {
    width: '100%',
    marginBottom: 20,
    position: 'relative',
    zIndex: 10,
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
    position: 'relative',
    zIndex: 15,
  },
  avatarCol: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 3,
  },
  aiAvatarContainer: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#050508',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.22)',
    overflow: 'hidden',
    shadowColor: C.cyan,
    shadowOpacity: 0.26,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  aiAvatarImage: {
    width: 22,
    height: 22,
    alignSelf: 'center',
    marginTop: 1,
  },
  bubbleCol: {
    flex: 1,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  bubbleHeaderUser: {
    justifyContent: 'flex-end',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  userSenderName: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9C8BD2',
    letterSpacing: 0.35,
  },

  // ─── Mode Badge ───────────────────────────────────
  modeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  modeBadgeAgents: {
    borderColor: 'rgba(123, 47, 255, 0.35)',
    backgroundColor: 'rgba(123, 47, 255, 0.1)',
  },
  modeBadgeFast: {
    borderColor: 'rgba(0, 212, 255, 0.35)',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
  },
  modeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // ─── Three Dot Button & Dropdown Menu ──────────────
  threeDotBtn: {
    marginLeft: 'auto',
    padding: 6,
  },
  dropdownMenu: {
    position: 'absolute',
    right: 0,
    top: 30,
    backgroundColor: '#12121E',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: 8,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 99,
    minWidth: 154,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  dropdownText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E2E2E9',
  },

  // ─── Bubble Styles ────────────────────────────────
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
  },
  bubbleUser: {
    maxWidth: '84%',
    backgroundColor: '#24143E',
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.28)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: C.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
    alignSelf: 'flex-end',
  },
  bubbleAiFull: {
    backgroundColor: C.bgBubbleAi,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 1,
    width: '100%',
    alignSelf: 'stretch',
  },

  // ─── Mode-specific bubble borders ─────────────────
  bubbleBorderAgents: {
    borderColor: 'rgba(123, 47, 255, 0.2)',
  },
  bubbleBorderFast: {
    borderColor: 'rgba(0, 212, 255, 0.2)',
  },

  // ─── Text ─────────────────────────────────────────
  userText: {
    fontSize: 14,
    color: '#F7F3FF',
    lineHeight: 20,
    fontWeight: '500',
  },
  aiText: {
    fontSize: 15.5,
    color: '#E2E2E9',
    lineHeight: 23,
  },
  codeWrapper: {
    marginTop: 6,
  },
  codeContainer: {
    marginTop: 10,
    width: '100%',
  },
  panelContainer: {
    marginTop: 10,
    width: '100%',
  },
  timestamp: {
    fontSize: 8,
    marginTop: 5,
    alignSelf: 'flex-end',
  },
  timestampUser: {
    color: '#AFA2D8',
  },
  timestampAi: {
    color: '#6A6A80',
  },

  // ─── Fast Mode Typing ─────────────────────────────
  fastTypingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pulsingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  pulsingDotCyan: {
    backgroundColor: C.cyan,
  },

  // ─── Markdown Text Component Styles ───────────────
  mdTextContainer: {
    flexDirection: 'column',
    position: 'relative',
  },
  mdLine: {
    marginBottom: 4,
  },
  mdParagraph: {
    fontSize: 14.5,
    color: '#E2E2E9',
    lineHeight: 22,
  },
  mdBold: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mdItalic: {
    fontStyle: 'italic',
    color: '#D0D0E0',
  },
  mdInlineCode: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.cyan,
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  mdH1: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 6,
  },
  mdH2: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 10,
    marginBottom: 4,
  },
  mdH3: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#E2E2E9',
    marginTop: 8,
    marginBottom: 2,
  },
  mdH4: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#D2D2E0',
    marginTop: 6,
    marginBottom: 2,
  },
  mdH5: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C0C0D0',
    marginTop: 4,
    marginBottom: 2,
  },
  mdListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 8,
    marginVertical: 2,
  },
  mdBullet: {
    fontSize: 14,
    color: '#8A8A9D',
    marginRight: 6,
    lineHeight: 20,
  },
  mdNumberedBullet: {
    fontSize: 13,
    fontWeight: '600',
    color: C.purpleSoft,
    marginRight: 6,
    lineHeight: 20,
    minWidth: 18,
  },
  mdListText: {
    fontSize: 14.5,
    color: '#E2E2E9',
    lineHeight: 20,
    flex: 1,
  },
  mdLineSpacing: {
    height: 10,
  },

  // ─── Markdown Table Styles ────────────────────────
  // Fully vertical — columns share available width, text wraps naturally.
  // No horizontal ScrollView so no info overlap and no side-scrolling.
  tableOuter: {
    marginVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222232',
    backgroundColor: '#0D0D16',
    overflow: 'hidden',
    width: '100%',
  },
  tableInner: {
    flexDirection: 'column',
    width: '100%',
  },
  // Horizontal scroll container for wide tables — height = content, no vertical scroll.
  tableScrollView: {
    flexGrow: 0,
  },
  // Live horizontal scrollbar — sits outside the ScrollView, below the table.
  tableScrollTrack: {
    height: 3,
    marginHorizontal: 10,
    marginTop: 5,
    marginBottom: 8,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  tableScrollThumb: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(123, 47, 255, 0.6)',
  },
  mdTableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#161625',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
    width: '100%',
  },
  // Wide-table rows are not width-constrained — they grow with their fixed-width cells.
  mdTableHeaderRowWide: {
    width: undefined,
  },
  mdTableHeaderCell: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    flex: 1,
  },
  // Centre header text above its column (both small and large tables).
  mdTableHeaderCellCenter: {
    alignItems: 'center',
  },
  mdTableHeaderTextCenter: {
    textAlign: 'center',
  },
  mdTableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.purpleSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  mdTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A28',
    width: '100%',
  },
  mdTableRowWide: {
    width: undefined,
  },
  mdTableRowAlt: {
    backgroundColor: 'rgba(255, 255, 255, 0.018)',
  },
  mdTableCell: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    flex: 1,
    justifyContent: 'flex-start',
  },
  mdTableCellText: {
    fontSize: 12.5,
    color: '#D0D0E0',
    lineHeight: 18,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  mdTableFirstCol: {
    flex: 1.6,
  },

  // ─── Inside-bubble bottom row ─────────────────────
  bubbleBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1F1F2E',
    paddingTop: 8,
  },
  // ─── Outside-bubble action row ──────────────────────
  outsideActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingLeft: 10,
  },
  outsideActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // ─── Professional action pill (copy / retry / speak) ─
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A8AAD',
    letterSpacing: 0.1,
  },
  actionPillCopied: {
    borderColor: 'rgba(74,222,128,0.25)',
    backgroundColor: 'rgba(74,222,128,0.07)',
  },
  actionPillSpeaking: {
    borderColor: 'rgba(167,139,250,0.35)',
    backgroundColor: 'rgba(167,139,250,0.10)',
  },
  actionPillTextSpeaking: {
    color: '#A78BFA',
  },
  // ─── User bubble copy row ─────────────────────────
  userBubbleActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 5,
    paddingRight: 4,
  },
  metricsTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  metricsTogglePillText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  copiedFeedbackText: {
    fontSize: 9,
    fontWeight: '600',
    color: C.green,
    letterSpacing: 0.2,
  },
  timestampText: {
    fontSize: 9.5,
    color: '#6A6A80',
    fontWeight: '500',
  },

  // ─── Agent Attribution Legend Styles ──────────────
  legendCard: {
    marginTop: 12,
    backgroundColor: '#0F0F16',
    borderWidth: 1,
    borderColor: '#222232',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  legendContent: {
    flexDirection: 'column',
    gap: 6,
  },
  legendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#222232',
    paddingBottom: 4,
  },
  legendTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  legendCloseBtn: {
    padding: 2,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: '#A7A7C0',
    fontWeight: '500',
  },

  // ─── Token Usage Expandable Panel Styles ──────────
  tokenTable: {
    marginTop: 10,
    borderWidth: 1.5,
    borderRadius: 10,
    backgroundColor: '#0B0B10',
    padding: 10,
    gap: 5,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tokenTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2A',
  },
  tokenTableTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tokenBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  tokenBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#222232',
    paddingBottom: 5,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: 'rgba(255, 255, 255, 0.015)',
    borderRadius: 4,
  },
  tableCell: {
    fontSize: 11,
    color: '#A7A7C0',
  },
  colAgent: {
    flex: 1.6,
  },
  colVal: {
    flex: 1,
    textAlign: 'right',
  },
  cellAgentName: {
    fontWeight: '600',
    color: '#D2D2E0',
  },
  cellTotalVal: {
    color: '#D2D2E0',
  },
  tableTotalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#222232',
    paddingTop: 5,
    marginTop: 3,
  },
  cellTotalLabel: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cellTotalFinal: {
    fontWeight: '700',
    color: '#FFFFFF',
  },

});
