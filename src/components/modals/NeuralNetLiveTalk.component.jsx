/**
 * NeuralNetLiveTalk.component.jsx  — Web-of-Nodes Edition
 * ─────────────────────────────────────────────────────────────────────────────
 * Continuous cluster-highlight animation — fully independent of input/output.
 *
 * Every ~600 ms a random connected subgraph cluster is chosen from the node
 * web. All edges inside that cluster glow bright purple, their endpoint nodes
 * light up, then everything decays. A new cluster is picked immediately after,
 * producing an endless stream of varied glowing patterns across the screen.
 *
 * Performance contract:
 *   • Single rAF loop, ≤60fps, 16ms delta guard
 *   • No blur / no per-frame gradients
 *   • Reduced-motion fallback: static dim web
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useRef, useEffect, useState, useCallback, useMemo,
} from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  StyleSheet,
  StatusBar,
  AppState,
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line } from 'react-native-svg';
import { CrossIcon } from '../shared/Icons';
import {
  scale, verticalScale, fontScale, spacing, radius,
  screenWidth, screenHeight,
} from '../../utils/responsive.utils';

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG             = '#0A0A0F';
const NODE_BASE      = '#7B2FFF';
const NODE_ACCENT    = '#A78BFA';
const NODE_DIM       = '#2A1A55';
const EDGE_COLOR     = '#3D2080';
const STATUS_DOT_COL = '#A78BFA';
const MUTED_TEXT     = '#555566';

// ─── Web geometry ─────────────────────────────────────────────────────────────

const NODE_COUNT      = 55;    // total nodes in the web
const EDGE_THRESHOLD  = 0.22;  // fraction of canvas diagonal → connect if closer
const NODE_R          = 2.8;   // base node radius (dp)
const NODE_R_LIT      = 5.2;   // node radius when fully lit
const EDGE_BASE_OP    = 0.18;  // dim idle edge opacity
const EDGE_IDLE_COL   = '#3D2080'; // very dim purple for idle web

// ─── Blink constants (idle / listening / thinking) ────────────────────────────
// Random individual nodes blink on and off — no edge cluster patterns.
const BLINK_INTERVAL_MIN = 180;  // ms — fastest a node can blink
const BLINK_INTERVAL_MAX = 700;  // ms — slowest a node can blink
const BLINK_NODES        = 10;   // how many nodes blink simultaneously
const BLINK_DECAY_RATE   = 350;  // ms to fully dim a blinking node

// ─── Cluster-highlight constants (speaking only) ──────────────────────────────
// A "cluster" = a BFS-grown connected subgraph picked from a random seed.
// All its edges glow bright; their endpoint nodes light up; then decay.
const GLOW_COL         = '#9B5FFF';  // bright edge colour when cluster is lit
const GLOW_OP          = 0.95;       // peak edge opacity when lit
const CLUSTER_INTERVAL = 420;        // ms between starting a new cluster highlight
const CLUSTER_MIN_EDGES = 6;         // min edges in a cluster
const CLUSTER_MAX_EDGES = 18;        // max edges — caps complexity on small phones
const EDGE_DECAY       = 0.91;       // per-frame glow decay
const NODE_DECAY_RATE  = 480;        // ms to fully dim a lit node

// ─── Helpers ──────────────────────────────────────────────────────────────────

const rng    = (min, max) => min + Math.random() * (max - min);
const lerp   = (a, b, t)  => a + (b - a) * t;

const toState = (phase) => {
  if (phase === 'listening')  return 'listening';
  if (phase === 'thinking')   return 'processing';
  if (phase === 'speaking')   return 'speaking';
  return 'idle';
};

const PHASE_LABEL = {
  idle:      '',
  listening: 'LISTENING',
  thinking:  'PROCESSING',
  speaking:  'SPEAKING',
  error:     'ERROR',
};

// ─── useReducedMotion ─────────────────────────────────────────────────────────

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub?.remove?.();
  }, []);
  return reduced;
}

// ─── buildWeb ─────────────────────────────────────────────────────────────────
// Generates a stable random node + edge layout for given canvas dimensions.
// Nodes are spread edge-to-edge with no padding — guaranteed corner/edge seeding
// ensures every region of every screen size is covered.

function buildWeb(w, h) {
  const diag = Math.sqrt(w * w + h * h);
  const thr  = diag * EDGE_THRESHOLD;

  // ── Grid-jitter interior nodes ──────────────────────────────────────────────
  // Use a tiny inset (4px) so nodes aren't clipped at the very border.
  const inset  = 4;
  const innerW = w - inset * 2;
  const innerH = h - inset * 2;

  // Reserve 12 slots for guaranteed edge/corner seeds; fill the rest with grid
  const SEEDED   = 12;
  const INTERIOR = NODE_COUNT - SEEDED;
  const cols     = Math.ceil(Math.sqrt(INTERIOR * (innerW / innerH)));
  const rows     = Math.ceil(INTERIOR / cols);
  const cellW    = innerW / cols;
  const cellH    = innerH / rows;

  const nodes = [];

  // Interior nodes — grid with wide jitter so they fill the cell
  for (let i = 0; i < INTERIOR; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    nodes.push({
      id:  i,
      x:   inset + col * cellW + rng(cellW * 0.05, cellW * 0.95),
      y:   inset + row * cellH + rng(cellH * 0.05, cellH * 0.95),
      lit: 0,
      r:   NODE_R,
    });
  }

  // ── Edge/corner seeds — guarantee full-screen coverage ──────────────────────
  // 4 corners + midpoints on each side (top, right, bottom, left) with a small
  // random jitter so they never look mechanical.
  const edgeJit = () => rng(-8, 8);
  const seeds = [
    // corners
    { x: inset + edgeJit(),     y: inset + edgeJit()     },
    { x: w - inset + edgeJit(), y: inset + edgeJit()     },
    { x: inset + edgeJit(),     y: h - inset + edgeJit() },
    { x: w - inset + edgeJit(), y: h - inset + edgeJit() },
    // top & bottom midpoints
    { x: w * 0.33 + edgeJit(),  y: inset + edgeJit()     },
    { x: w * 0.66 + edgeJit(),  y: inset + edgeJit()     },
    { x: w * 0.33 + edgeJit(),  y: h - inset + edgeJit() },
    { x: w * 0.66 + edgeJit(),  y: h - inset + edgeJit() },
    // left & right midpoints
    { x: inset + edgeJit(),     y: h * 0.33 + edgeJit()  },
    { x: inset + edgeJit(),     y: h * 0.66 + edgeJit()  },
    { x: w - inset + edgeJit(), y: h * 0.33 + edgeJit()  },
    { x: w - inset + edgeJit(), y: h * 0.66 + edgeJit()  },
  ];
  seeds.forEach((s, i) => nodes.push({ id: INTERIOR + i, x: s.x, y: s.y, lit: 0, r: NODE_R }));

  // ── Pre-warm node brightness so the web looks alive on frame 0 ──────────────
  // Scatter ~30% of nodes with a random initial lit value so there is no
  // "all dark then suddenly animating" gap when the modal opens.
  const preWarmCount = Math.ceil(nodes.length * 0.30);
  const shuffled = [...nodes].sort(() => Math.random() - 0.5);
  shuffled.slice(0, preWarmCount).forEach(n => {
    n.lit = rng(0.15, 0.75);
  });

  const edges = [];
  for (let a = 0; a < nodes.length; a++) {
    for (let b = a + 1; b < nodes.length; b++) {
      const dx = nodes[a].x - nodes[b].x;
      const dy = nodes[a].y - nodes[b].y;
      if (Math.sqrt(dx * dx + dy * dy) <= thr) {
        edges.push({ a, b, op: EDGE_BASE_OP });
      }
    }
  }

  return { nodes, edges };
}

// ─── pickCluster ──────────────────────────────────────────────────────────────
// BFS from a random seed node, collecting connected edges until we have between
// CLUSTER_MIN_EDGES and CLUSTER_MAX_EDGES edges. Returns the edge indices and
// the set of endpoint node indices. Each call produces a distinct sub-region of
// the graph because the seed is random and BFS explores in random neighbour order.

function pickCluster(edges, adj, nodeCount) {
  if (!edges.length || !adj) return { edgeIdxs: [], nodeIdxs: [] };

  const seedNode = Math.floor(Math.random() * nodeCount);
  const visited  = new Set();
  const edgeIdxs = [];
  const nodeIdxs = new Set();
  const queue    = [seedNode];
  visited.add(seedNode);

  // Build an edge-lookup map: "a-b" → edgeIdx (done once, could be cached but
  // edges array is small ~200 entries, this is fast enough)
  const edgeMap = {};
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    edgeMap[`${e.a}-${e.b}`] = i;
    edgeMap[`${e.b}-${e.a}`] = i;
  }

  while (queue.length && edgeIdxs.length < CLUSTER_MAX_EDGES) {
    // Pop from a random position for variety (not strict BFS order)
    const pos  = Math.floor(Math.random() * queue.length);
    const node = queue.splice(pos, 1)[0];
    const neighbours = adj[node] || [];

    // Shuffle neighbours so BFS explores in a different direction each call
    const shuffled = [...neighbours].sort(() => Math.random() - 0.5);
    for (const nb of shuffled) {
      if (edgeIdxs.length >= CLUSTER_MAX_EDGES) break;
      const idx = edgeMap[`${node}-${nb}`];
      if (idx === undefined) continue;
      edgeIdxs.push(idx);
      nodeIdxs.add(node);
      nodeIdxs.add(nb);
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }

  return { edgeIdxs, nodeIdxs: [...nodeIdxs] };
}

// ─── NodeWeb (SVG canvas with rAF loop) ───────────────────────────────────────
// Two animation modes driven by `phase`:
//
//   idle / listening / thinking  →  BLINK mode
//     Random individual nodes pulse on and off at scattered positions.
//     No edge cluster patterns, no connected subgraph highlighting.
//     Looks like faint, scattered neural activity on standby.
//
//   speaking  →  CLUSTER mode
//     Connected subgraph clusters light up and decay in sequence.
//     Starts exactly when Zyron begins speaking (phase flips to 'speaking').
//     Edges glow bright; endpoint nodes light up large.
//
// The switch between modes is instantaneous and in sync with the phase prop.

function NodeWeb({ canvasW, canvasH, reducedMotion, phase }) {

  // ── Layout (stable per canvas size) ──────────────────────────────────────
  const layoutRef = useRef(null);
  const getLayout = useCallback(() => {
    if (
      !layoutRef.current ||
      layoutRef.current.w !== canvasW ||
      layoutRef.current.h !== canvasH
    ) {
      layoutRef.current = { w: canvasW, h: canvasH, ...buildWeb(canvasW, canvasH) };
      layoutRef.current._adj = null;
    }
    return layoutRef.current;
  }, [canvasW, canvasH]);

  // ── Adjacency list (built once per layout) ────────────────────────────────
  const getAdj = useCallback(() => {
    const layout = getLayout();
    if (layout._adj) return layout._adj;
    const adj = Array.from({ length: layout.nodes.length }, () => []);
    layout.edges.forEach(e => {
      adj[e.a].push(e.b);
      adj[e.b].push(e.a);
    });
    layout._adj = adj;
    return adj;
  }, [getLayout]);

  // ── Render state ──────────────────────────────────────────────────────────
  const [renderData, setRenderData] = useState(() => {
    const layout = getLayout();
    return {
      nodes: layout.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, r: NODE_R, col: NODE_DIM })),
      edges: layout.edges.map(e => ({ ...e, glow: 0 })),
    };
  });

  // ── Mutable animation state (written by rAF, never triggers re-render directly)
  const rafRef         = useRef(null);
  const lastRef        = useRef(0);
  const pausedRef      = useRef(false);
  const phaseRef       = useRef(phase);   // always current, readable inside rAF
  const edgeGlowRef    = useRef({});      // edgeGlow[i]  = 0..1
  const nodeGlowRef    = useRef({});      // nodeGlow[i]  = 0..1
  const clusterTimerRef = useRef(null);
  const blinkTimerRef  = useRef(null);

  // Keep phaseRef in sync without re-creating the rAF loop
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── App-pause guard ───────────────────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      pausedRef.current = s !== 'active';
    });
    return () => sub?.remove?.();
  }, []);

  // ── BLINK scheduler — random individual node pulses ───────────────────────
  // Fires only when phase !== 'speaking'. Schedules itself for the next blink
  // at a random interval, picks a random node, and sets its glow to 1.
  const scheduleBlink = useCallback(() => {
    clearTimeout(blinkTimerRef.current);
    blinkTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== 'speaking') {
        const layout = getLayout();
        // Pick BLINK_NODES random distinct node indices and light them up
        const count = layout.nodes.length;
        const picks = new Set();
        while (picks.size < Math.min(BLINK_NODES, count)) {
          picks.add(Math.floor(Math.random() * count));
        }
        picks.forEach(i => { nodeGlowRef.current[i] = rng(0.55, 1.0); });
      }
      scheduleBlink();
    }, rng(BLINK_INTERVAL_MIN, BLINK_INTERVAL_MAX));
  }, [getLayout]);

  // ── CLUSTER scheduler — connected subgraph patterns ───────────────────────
  // Fires only when phase === 'speaking'. Starts the very first cluster
  // immediately when speaking begins (called externally via scheduleCluster()).
  const scheduleCluster = useCallback(() => {
    clearTimeout(clusterTimerRef.current);
    clusterTimerRef.current = setTimeout(() => {
      if (phaseRef.current === 'speaking') {
        const layout = getLayout();
        const adj    = getAdj();
        const { edgeIdxs, nodeIdxs } = pickCluster(
          layout.edges, adj, layout.nodes.length
        );
        if (edgeIdxs.length >= CLUSTER_MIN_EDGES) {
          edgeIdxs.forEach(i => { edgeGlowRef.current[i] = 1.0; });
          nodeIdxs.forEach(i => { nodeGlowRef.current[i] = 1.0; });
        }
      }
      scheduleCluster();
    }, CLUSTER_INTERVAL);
  }, [getLayout, getAdj]);

  // ── Phase-change effect — switch animation mode immediately ───────────────
  useEffect(() => {
    if (phase === 'speaking') {
      // Entering speaking: clear any stale blink state, fire first cluster NOW
      clearTimeout(blinkTimerRef.current);
      clearTimeout(clusterTimerRef.current);
      // Immediately pick and light the first cluster (no delay) so the animation
      // starts in sync with the very first spoken word.
      const layout = getLayout();
      const adj    = getAdj();
      const { edgeIdxs, nodeIdxs } = pickCluster(layout.edges, adj, layout.nodes.length);
      if (edgeIdxs.length >= CLUSTER_MIN_EDGES) {
        edgeIdxs.forEach(i => { edgeGlowRef.current[i] = 1.0; });
        nodeIdxs.forEach(i => { nodeGlowRef.current[i] = 1.0; });
      }
      scheduleCluster();
    } else {
      // Not speaking: stop cluster scheduler, let edge glows decay naturally,
      // ensure blink scheduler is running.
      clearTimeout(clusterTimerRef.current);
      scheduleBlink();
    }
  }, [phase, getLayout, getAdj, scheduleCluster, scheduleBlink]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(blinkTimerRef.current);
      clearTimeout(clusterTimerRef.current);
    };
  }, []);

  // ── rAF decay + render loop ───────────────────────────────────────────────
  useEffect(() => {
    if (reducedMotion) { cancelAnimationFrame(rafRef.current); return; }

    const tick = (now) => {
      rafRef.current = requestAnimationFrame(tick);
      if (pausedRef.current) { lastRef.current = now; return; }
      const dt = Math.min(now - lastRef.current, 32);
      if (dt < 16) return;
      lastRef.current = now;

      const isSpeaking = phaseRef.current === 'speaking';
      const layout = getLayout();
      const { nodes, edges } = layout;
      const eg = edgeGlowRef.current;
      const ng = nodeGlowRef.current;

      // Decay edge glows (only used in speaking mode, but safe to run always)
      for (const k of Object.keys(eg)) {
        eg[k] *= EDGE_DECAY;
        if (eg[k] < 0.015) delete eg[k];
      }
      // Decay node glows — faster rate in blink mode so nodes flicker briefly
      const decayRate = isSpeaking ? NODE_DECAY_RATE : BLINK_DECAY_RATE;
      for (const k of Object.keys(ng)) {
        ng[k] = Math.max(0, ng[k] - dt / decayRate);
        if (ng[k] < 0.015) delete ng[k];
      }

      const nodesSnap = nodes.map((n, i) => {
        const t   = ng[i] || 0;
        const col = t > 0.01
          ? `rgba(${lerp(42, 155, t) | 0},${lerp(26, 47, t) | 0},${lerp(85, 255, t) | 0},${lerp(0.3, 1.0, t).toFixed(2)})`
          : NODE_DIM;
        return { id: n.id, x: n.x, y: n.y, r: lerp(NODE_R, NODE_R_LIT, t), col };
      });

      const edgesSnap = edges.map((e, i) => ({
        ...e,
        glow: eg[i] || 0,
      }));

      setRenderData({ nodes: nodesSnap, edges: edgesSnap });
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [canvasW, canvasH, reducedMotion, getLayout]);

  // ── Reduced-motion: static dim web ───────────────────────────────────────
  if (reducedMotion) {
    const layout = getLayout();
    return (
      <View style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]} pointerEvents="none">
        <Svg width={canvasW} height={canvasH} style={StyleSheet.absoluteFillObject}>
          {layout.edges.map((e, i) => (
            <Line
              key={`re-${i}`}
              x1={layout.nodes[e.a].x} y1={layout.nodes[e.a].y}
              x2={layout.nodes[e.b].x} y2={layout.nodes[e.b].y}
              stroke={EDGE_COLOR} strokeWidth={0.8} strokeOpacity={0.08}
            />
          ))}
          {layout.nodes.map(n => (
            <Circle key={`rn-${n.id}`} cx={n.x} cy={n.y} r={NODE_R} fill={NODE_DIM} fillOpacity={0.5} />
          ))}
        </Svg>
      </View>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]} pointerEvents="none">
      <Svg width={canvasW} height={canvasH} style={StyleSheet.absoluteFillObject}>

        {/* Dim idle web — always visible */}
        {renderData.edges.map((e, i) => (
          e.glow < 0.06 ? (
            <Line
              key={`ei-${i}`}
              x1={renderData.nodes[e.a]?.x} y1={renderData.nodes[e.a]?.y}
              x2={renderData.nodes[e.b]?.x} y2={renderData.nodes[e.b]?.y}
              stroke={EDGE_IDLE_COL}
              strokeWidth={0.8}
              strokeOpacity={EDGE_BASE_OP}
            />
          ) : null
        ))}

        {/* Glowing cluster edges — rendered on top of idle web */}
        {renderData.edges.map((e, i) => (
          e.glow >= 0.06 ? (
            <Line
              key={`eg-${i}`}
              x1={renderData.nodes[e.a]?.x} y1={renderData.nodes[e.a]?.y}
              x2={renderData.nodes[e.b]?.x} y2={renderData.nodes[e.b]?.y}
              stroke={GLOW_COL}
              strokeWidth={1.8}
              strokeOpacity={EDGE_BASE_OP + e.glow * (GLOW_OP - EDGE_BASE_OP)}
            />
          ) : null
        ))}

        {/* Nodes */}
        {renderData.nodes.map(n => (
          <Circle
            key={`n-${n.id}`}
            cx={n.x} cy={n.y}
            r={n.r}
            fill={n.col}
          />
        ))}

      </Svg>
    </View>
  );
}

// ─── HintText ─────────────────────────────────────────────────────────────────

function HintText({ phase }) {
  const label = useMemo(() => {
    if (phase === 'listening') return "Speak now — I'm listening…";
    if (phase === 'thinking')  return 'Processing your message…';
    if (phase === 'error')     return 'Something went wrong';
    return '';
  }, [phase]);

  const fade    = useRef(new Animated.Value(1)).current;
  const prevRef = useRef(label);

  useEffect(() => {
    if (prevRef.current === label) return;
    prevRef.current = label;
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 110, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [label, fade]);

  if (!label) return null;
  return (
    <Animated.Text style={[styles.hintText, { opacity: fade }]}>
      {label}
    </Animated.Text>
  );
}

// ─── StatusPill ───────────────────────────────────────────────────────────────

function StatusPill({ phase }) {
  const label    = PHASE_LABEL[phase] || '';
  const fade     = useRef(new Animated.Value(1)).current;  // start visible
  const dotOp    = useRef(new Animated.Value(1)).current;
  const prevPhase = useRef(phase);

  useEffect(() => {
    // Skip the fade-out/in on the very first render so the pill appears immediately.
    if (prevPhase.current === phase) return;
    prevPhase.current = phase;
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [phase, fade]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOp, { toValue: 0.2, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(dotOp, { toValue: 1,   duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [dotOp]);

  if (!label) return <View style={styles.pillPlaceholder} />;

  return (
    <Animated.View style={[styles.statusPill, { opacity: fade }]}>
      <Animated.View style={[styles.statusDot, { opacity: dotOp }]} />
      <Text style={styles.statusLabel}>{label}</Text>
    </Animated.View>
  );
}

// ─── SpeakingInterrupt ────────────────────────────────────────────────────────

function SpeakingInterrupt({ onPress }) {
  const dotOp = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOp, { toValue: 0.2, duration: 550, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(dotOp, { toValue: 1,   duration: 550, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [dotOp]);

  return (
    <TouchableOpacity
      style={styles.interruptBtn}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}
    >
      <Animated.View style={[styles.interruptDot, { opacity: dotOp }]} />
      <Text style={styles.interruptText}>Speaking</Text>
      <Text style={styles.interruptSub}>  ·  tap to interrupt</Text>
    </TouchableOpacity>
  );
}

// ─── NeuralNetLiveTalkModal ───────────────────────────────────────────────────

export default function NeuralNetLiveTalkModal({
  visible,
  phase,
  volumeRef,
  transcript,
  errorMsg,
  waitCountdown,
  onStop,
  onInterrupt,
}) {
  const insets        = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const vState        = toState(phase);

  // Slide-up entrance
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0, damping: 22, stiffness: 180, mass: 1, useNativeDriver: true,
        }),
        Animated.timing(bgOpacity, {
          toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(screenHeight);
      bgOpacity.setValue(0);
    }
  }, [visible, slideAnim, bgOpacity]);

  // Canvas fills the whole sheet
  const canvasW  = screenWidth;
  const canvasH  = screenHeight;

  const isAISpeaking = phase === 'speaking';
  const isError      = phase === 'error';

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onStop}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Dim backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: bgOpacity }]} />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingTop:    insets.top + spacing(14),
            paddingBottom: insets.bottom + spacing(20),
            transform:     [{ translateY: slideAnim }],
          },
        ]}
      >

        {/* ── Node web canvas — behind everything ──────── */}
        {visible && (
          <NodeWeb
            canvasW={canvasW}
            canvasH={canvasH}
            reducedMotion={reducedMotion}
            phase={phase}
          />
        )}

        {/* ── Top bar ──────────────────────────────────── */}
        <View style={styles.topBar}>
          <View style={styles.liveBadge}>
            <View style={styles.liveBadgeDot} />
            <Text style={styles.liveBadgeText}>LIVE TALK</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onStop}
            activeOpacity={0.7}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <CrossIcon color="#7A7A94" />
          </TouchableOpacity>
        </View>

        {/* ── Spacer to push content to bottom half ─────── */}
        <View style={styles.orbArea} />

        {/* ── Status pill ──────────────────────────────── */}
        <View style={styles.pillRow}>
          <StatusPill phase={phase} />
        </View>

        {/* ── State label ───────────────────────────────── */}
        <View style={styles.networkLabelRow}>
          <Text style={styles.networkLabel}>
            {vState === 'idle'       && 'Neural network on standby'}
              {vState === 'listening'  && 'Signal active · listening'}
              {vState === 'processing' && 'Network processing · thinking…'}
              {vState === 'speaking'   && 'Composing response · speaking'}
          </Text>
        </View>

        {/* ── User transcript (listening only) ─────────── */}
        {phase === 'listening' && !!transcript && (
          <View style={styles.transcriptCard}>
            <Text style={styles.cardLabel}>YOU</Text>
            <Text style={styles.transcriptText} numberOfLines={3}>{transcript}</Text>
          </View>
        )}

        {/* ── Error card ────────────────────────────────── */}
        {isError && !!errorMsg && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorMsg}>{errorMsg}</Text>
          </View>
        )}

        {/* ── Bottom action ─────────────────────────────── */}
        <View style={styles.bottomBar}>
          {isAISpeaking ? (
            <SpeakingInterrupt onPress={onInterrupt} />
          ) : isError ? (
            <TouchableOpacity
              onPress={onStop}
              activeOpacity={0.75}
              hitSlop={{ top: 16, bottom: 16, left: 32, right: 32 }}
            >
              <Text style={styles.hintClose}>Tap × to close</Text>
            </TouchableOpacity>
          ) : (
            <HintText phase={phase} />
          )}
        </View>

      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,4,12,0.92)',
  },

  sheet: {
    flex:                 1,
    backgroundColor:      BG,
    borderTopLeftRadius:  radius(24),
    borderTopRightRadius: radius(24),
    overflow:             'hidden',
    borderTopWidth:       1,
    borderTopColor:       'rgba(123,47,255,0.20)',
  },

  // ── Top bar ──
  topBar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing(22),
    marginBottom:      spacing(4),
    zIndex:            10,
  },
  liveBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing(7),
    backgroundColor:   'rgba(123,47,255,0.10)',
    borderRadius:      radius(20),
    borderWidth:       1,
    borderColor:       'rgba(123,47,255,0.22)',
    paddingHorizontal: spacing(12),
    paddingVertical:   spacing(5),
  },
  liveBadgeDot: {
    width:           scale(6),
    height:          scale(6),
    borderRadius:    scale(3),
    backgroundColor: STATUS_DOT_COL,
  },
  liveBadgeText: {
    fontSize:      fontScale(10),
    fontWeight:    '800',
    letterSpacing: 1.6,
    color:         STATUS_DOT_COL,
  },
  closeBtn: {
    width:           scale(34),
    height:          scale(34),
    borderRadius:    scale(17),
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.08)',
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Spacer (takes up the upper canvas area) ──
  orbArea: {
    flex:       1,
    zIndex:     2,
    minHeight:  verticalScale(180),
  },

  // ── Status pill ──
  pillRow: {
    alignItems:      'center',
    paddingVertical: spacing(6),
    zIndex:          3,
  },
  statusPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing(6),
    backgroundColor:   'rgba(123,47,255,0.12)',
    borderRadius:      radius(20),
    borderWidth:       1,
    borderColor:       'rgba(123,47,255,0.22)',
    paddingHorizontal: spacing(14),
    paddingVertical:   spacing(5),
  },
  pillPlaceholder: {
    height: scale(26),
  },
  statusDot: {
    width:           scale(6),
    height:          scale(6),
    borderRadius:    scale(3),
    backgroundColor: STATUS_DOT_COL,
  },
  statusLabel: {
    fontSize:      fontScale(10),
    fontWeight:    '700',
    letterSpacing: 1.4,
    color:         STATUS_DOT_COL,
  },

  // ── State label ──
  networkLabelRow: {
    alignItems:        'center',
    paddingHorizontal: spacing(32),
    paddingBottom:     spacing(4),
  },
  networkLabel: {
    fontSize:      fontScale(11),
    color:         MUTED_TEXT,
    letterSpacing: 0.5,
    textAlign:     'center',
  },

  // ── Bottom bar ──
  bottomBar: {
    alignItems:        'center',
    paddingHorizontal: spacing(24),
    zIndex:            3,
  },
  hintText: {
    fontSize:  fontScale(13),
    color:     MUTED_TEXT,
    textAlign: 'center',
  },
  hintClose: {
    fontSize: fontScale(13),
    color:    MUTED_TEXT,
  },

  // ── Interrupt button ──
  interruptBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing(4),
  },
  interruptDot: {
    width:           scale(8),
    height:          scale(8),
    borderRadius:    scale(4),
    backgroundColor: '#FF5370',
  },
  interruptText: {
    fontSize:   fontScale(14),
    fontWeight: '600',
    color:      '#E8E8F0',
  },
  interruptSub: {
    fontSize: fontScale(13),
    color:    MUTED_TEXT,
  },

  // ── Transcript card ──
  transcriptCard: {
    marginHorizontal:  spacing(24),
    marginBottom:      spacing(8),
    backgroundColor:   'rgba(255,255,255,0.04)',
    borderRadius:      radius(14),
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.07)',
    paddingHorizontal: spacing(16),
    paddingVertical:   spacing(12),
  },
  cardLabel: {
    fontSize:      fontScale(9),
    fontWeight:    '800',
    letterSpacing: 1.4,
    color:         MUTED_TEXT,
    marginBottom:  spacing(4),
  },
  transcriptText: {
    fontSize:   fontScale(13),
    color:      '#C8C8DC',
    lineHeight: fontScale(20),
  },

  // ── Error card ──
  errorCard: {
    marginHorizontal:  spacing(24),
    marginBottom:      spacing(8),
    backgroundColor:   'rgba(255,83,112,0.08)',
    borderRadius:      radius(14),
    borderWidth:       1,
    borderColor:       'rgba(255,83,112,0.18)',
    paddingHorizontal: spacing(16),
    paddingVertical:   spacing(12),
  },
  errorTitle: {
    fontSize:     fontScale(13),
    fontWeight:   '700',
    color:        '#FF5370',
    marginBottom: spacing(4),
  },
  errorMsg: {
    fontSize: fontScale(12),
    color:    '#C8C8DC',
  },
});
