import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, View, Text, Animated, Easing, Image } from 'react-native';
import C from '../../config/colors.config';
import { getAgentMeta } from '../../agents/registry/agentRegistry';
import { COORDINATION_MODES } from '../../agents/registry/teamMetadata';
import { getActiveTeam } from '../../agents/teams/teamRuntime';

const getAgentUiConfig = (role, team = getActiveTeam()) => {
  const meta = getAgentMeta(role);
  const teamAgent = team?.agents?.[role];
  return {
    accent: teamAgent?.accent || meta.accent,
    accentDim: teamAgent?.accentDim || meta.accentDim,
    accentGlow: teamAgent?.accentGlow || meta.accentGlow,
    icon: teamAgent?.icon || meta.icon,
    activeLabel: teamAgent?.activeLabel || meta.activeLabel,
  };
};

const STATUS_LABELS = {
  queued: 'Queued',
  thinking: 'Reasoning...',
  working: 'Analyzing...',
  structuring: 'Structuring...',
  coding: 'Generating...',
  analyzing: 'Analyzing...',
  formatting: 'Polishing...',
  done: 'Complete',
  error: 'Failed',
  exhausted: 'Exhausted',
};

// ─── Single Agent Row ──────────────────────────────
function AgentRow({ agent, index, activeTeam }) {
  const config = getAgentUiConfig(agent.role, activeTeam);
  const isDone = agent.status === 'done';
  const isError = agent.status === 'error';
  const isExhausted = agent.status === 'exhausted';
  const isActive = !isDone && agent.status !== 'queued' && !isError && !isExhausted;
  const isQueued = agent.status === 'queued';

  // Smooth progress animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  // Entry slide animation
  const slideAnim = useRef(new Animated.Value(30)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  // Pulse animation for active state
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  // Shimmer for progress bar
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  // Icon pop/spring on completion — starts at 1, springs to 1.18 then settles back
  const iconScaleAnim = useRef(new Animated.Value(1)).current;

  // Entry animation with staggered delay
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 350,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Smooth progress bar transition
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: agent.progress || 0,
      duration: 500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [agent.progress]);

  // Pulse glow for active agents
  useEffect(() => {
    if (isActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(isDone ? 1 : 0.4);
    }
  }, [isActive, isDone]);

  // Icon pop spring when agent transitions to done
  useEffect(() => {
    if (isDone) {
      Animated.sequence([
        Animated.spring(iconScaleAnim, {
          toValue: 1.28,
          speed: 40,
          bounciness: 18,
          useNativeDriver: true,
        }),
        Animated.spring(iconScaleAnim, {
          toValue: 1,
          speed: 22,
          bounciness: 6,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      iconScaleAnim.setValue(1);
    }
  }, [isDone]);

  // Shimmer effect for active progress bars
  useEffect(() => {
    if (isActive) {
      const shimmer = Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      );
      shimmer.start();
      return () => shimmer.stop();
    }
  }, [isActive]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const shimmerLeft = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-40%', '140%'],
  });

  const statusLabel = STATUS_LABELS[agent.status] || config.activeLabel || agent.status;
  const statusColor = isDone ? C.green : isExhausted ? C.amber : isError ? C.orange : isActive ? config.accent : '#444455';
  const progressBgColor = isDone ? C.green : isExhausted ? C.amber : isError ? C.orange : config.accent;

  return (
    <Animated.View
      style={[
        s.agentRow,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
          borderColor: isDone
            ? 'rgba(110, 231, 183, 0.12)'
            : isExhausted
            ? 'rgba(251, 191, 36, 0.12)'
            : isError
            ? 'rgba(249, 115, 22, 0.12)'
            : isActive
            ? config.accentDim
            : '#18182A',
        },
      ]}
    >
      {/* Left: Agent Icon + Name + Model */}
      <View style={s.agentInfo}>
        <Animated.View
          style={[
            s.agentIconWrap,
            {
              backgroundColor: isDone
                ? config.accentGlow
                : isExhausted
                ? 'rgba(251, 191, 36, 0.15)'
                : isError
                ? 'rgba(249, 115, 22, 0.15)'
                : isActive
                ? config.accentDim
                : 'rgba(255,255,255,0.03)',
              borderWidth: isDone ? 1 : 0,
              borderColor: isDone ? config.accent : 'transparent',
              shadowColor: isDone ? config.accent : 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: isDone ? 0.8 : 0,
              shadowRadius: isDone ? 8 : 0,
              elevation: isDone ? 6 : 0,
              transform: [{ scale: iconScaleAnim }],
            },
          ]}
        >
          <Animated.Text
            style={[
              s.agentIcon,
              {
                opacity: isActive ? pulseAnim : 1,
              },
            ]}
          >
            {config.icon}
          </Animated.Text>
        </Animated.View>
        <View style={s.agentMeta}>
          <Text
            style={[
              s.agentName,
              {
                color: isDone
                  ? C.green
                  : isExhausted
                  ? C.amber
                  : isError
                  ? C.orange
                  : isActive
                  ? '#FFFFFF'
                  : '#9A9AAD',
              },
            ]}
          >
            {agent.name}
          </Text>
          <Text
            style={[
              s.agentModel,
              {
                color: isDone
                  ? 'rgba(255,255,255,0.7)'
                  : isActive
                  ? 'rgba(255,255,255,0.5)'
                  : 'rgba(255,255,255,0.3)',
              },
            ]}
          >
            {agent.model}
          </Text>
        </View>
      </View>

      {/* Center: Progress Bar */}
      <View style={s.progressSection}>
        <View style={s.progressTrack}>
          <Animated.View
            style={[
              s.progressFill,
              {
                width: progressWidth,
                backgroundColor: progressBgColor,
              },
            ]}
          >
            {/* Shimmer overlay for active bars */}
            {isActive && (
              <Animated.View
                style={[
                  s.shimmerOverlay,
                  { left: shimmerLeft },
                ]}
              />
            )}
          </Animated.View>
        </View>
        <Text style={[s.progressPercent, { color: statusColor }]}>
          {Math.min(Math.round(agent.progress || 0), 100)}%
        </Text>
      </View>

      {/* Right: Status Badge */}
      <View
        style={[
          s.statusBadge,
          {
            backgroundColor: isDone
              ? 'rgba(110, 231, 183, 0.08)'
              : isExhausted
              ? 'rgba(251, 191, 36, 0.08)'
              : isError
              ? 'rgba(249, 115, 22, 0.08)'
              : isActive
              ? config.accentDim
              : 'rgba(255,255,255,0.02)',
            borderColor: isDone
              ? 'rgba(110, 231, 183, 0.2)'
              : isExhausted
              ? 'rgba(251, 191, 36, 0.2)'
              : isError
              ? 'rgba(249, 115, 22, 0.2)'
              : isActive
              ? `${config.accent}33`
              : '#1E1E2C',
          },
        ]}
      >
        {isDone && <Text style={s.checkmark}>✓</Text>}
        {isExhausted && <Text style={s.exhaustedMark}>⚠</Text>}
        {isError && <Text style={s.errorMark}>✕</Text>}
        {isActive && (
          <Animated.View
            style={[s.activePulse, { backgroundColor: config.accent, opacity: pulseAnim }]}
          />
        )}
        {isQueued && <View style={[s.queuedDot, { backgroundColor: '#333344' }]} />}
        <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Compact coordination strip (simple queries) ─────
function CompactCoordinationBar({ agents, totalProgress, activeTeam }) {
  return (
    <View style={s.compactBar}>
      <View style={s.compactDots}>
        {agents.map((agent) => {
          const config = getAgentUiConfig(agent.role, activeTeam);
          const isDone = agent.status === 'done';
          const isError = agent.status === 'error' || agent.status === 'exhausted';
          const isActive = !isDone && agent.status !== 'queued' && !isError;
          return (
            <View
              key={agent.role || agent.name}
              style={[
                s.compactDot,
                {
                  backgroundColor: isDone ? C.green : isError ? C.orange : isActive ? config.accent : '#333344',
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={s.compactText}>Agents · {totalProgress}%</Text>
    </View>
  );
}

// ─── Main Agent Coordination Table ─────────────────
export default function AgentCoordinationTable({ agents, isTyping, coordinationMode = COORDINATION_MODES.FULL }) {
  const containerAnim = useRef(new Animated.Value(0)).current;

  const [prevShow, setPrevShow] = useState(false);

  const showFull = coordinationMode === COORDINATION_MODES.FULL;
  const showCompact = coordinationMode === COORDINATION_MODES.COMPACT;
  const showAny = !!(isTyping && agents && agents.length > 0 && coordinationMode !== COORDINATION_MODES.NONE);

  useEffect(() => {
    if (showAny !== prevShow) {
      setPrevShow(showAny);
      Animated.timing(containerAnim, {
        toValue: showAny ? 1 : 0,
        duration: 350,
        easing: showAny ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [showAny, prevShow]);

  if (!showAny || !agents || agents.length === 0) return null;

  const doneCount = agents.filter((a) => a.status === 'done').length;
  const errorCount = agents.filter((a) => a.status === 'error').length;
  const exhaustedCount = agents.filter((a) => a.status === 'exhausted').length;
  const total = agents.length;
  const allDone = doneCount + errorCount + exhaustedCount === total;
  const activeTeam = getActiveTeam();

  // Overall pipeline progress
  const totalProgress = Math.round(
    agents.reduce((sum, a) => sum + (a.progress || 0), 0) / total
  );

  const containerOpacity = containerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  if (showCompact && !showFull) {
    return (
      <Animated.View style={[s.compactContainer, { opacity: containerOpacity }]}>
        <CompactCoordinationBar agents={agents} totalProgress={totalProgress} activeTeam={activeTeam} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[s.container, { opacity: containerOpacity }]}>
      <View style={s.tableHeader}>
        <View style={s.headerLeft}>
          <View style={s.headerIconWrap}>
            <Image
              source={require('../../../assets/images/logo.png')}
              style={s.headerAppIcon}
              resizeMode="contain"
            />
          </View>
          <View>
            <Text style={s.headerTitle}>{activeTeam?.name || 'Agents'} Coordination</Text>
            <Text style={s.headerSub}>
              {allDone
                ? `${activeTeam?.agents?.writer?.name || 'Writer'} synthesis complete`
                : `${activeTeam?.name || 'Team'} · ${doneCount}/${total} agents`}
            </Text>
          </View>
        </View>
        <View style={s.overallBadge}>
          <Text
            style={[
              s.overallText,
              { color: allDone ? C.green : C.purpleSoft },
            ]}
          >
            {totalProgress}%
          </Text>
        </View>
      </View>

      {/* Overall Progress Bar */}
      <View style={s.overallTrack}>
        <View
          style={[
            s.overallFill,
            {
              width: `${totalProgress}%`,
              backgroundColor: allDone ? C.green : C.purple,
            },
          ]}
        />
      </View>

      {/* Agent Rows */}
      <View style={s.agentsContainer}>
        {agents.map((agent, index) => (
          <AgentRow key={agent.role || agent.name} agent={agent} index={index} activeTeam={activeTeam} />
        ))}
      </View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const s = StyleSheet.create({
  compactContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  compactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D0D15',
    borderWidth: 1,
    borderColor: '#1E1E2E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  compactDots: {
    flexDirection: 'row',
    gap: 6,
  },
  compactDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compactText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.purpleSoft,
    letterSpacing: 0.3,
  },
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#0D0D15',
    borderWidth: 1,
    borderColor: '#1E1E2E',
    borderRadius: 16,
    overflow: 'hidden',
  },

  // ─── Table Header ───────────────────────────────
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#050508',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    shadowColor: C.cyan,
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  headerAppIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 9.5,
    color: '#6A6A7D',
    marginTop: 1,
    fontWeight: '500',
  },
  overallBadge: {
    backgroundColor: 'rgba(123, 47, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(123, 47, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  overallText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // ─── Overall Progress ───────────────────────────
  overallTrack: {
    height: 3,
    backgroundColor: '#1A1A2A',
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  overallFill: {
    height: '100%',
    borderRadius: 2,
  },

  // ─── Agent Rows ─────────────────────────────────
  agentsContainer: {
    paddingHorizontal: 10,
    paddingBottom: 12,
    gap: 6,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.015)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  // Agent Info (left)
  agentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
    gap: 8,
  },
  agentIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentIcon: {
    fontSize: 12,
  },
  agentMeta: {
    flex: 1,
  },
  agentName: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  agentModel: {
    fontSize: 8,
    color: '#4A4A5A',
    marginTop: 1,
    fontWeight: '500',
  },

  // Progress (center)
  progressSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 8,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    backgroundColor: '#1A1A2A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '30%',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 3,
  },
  progressPercent: {
    fontSize: 9,
    fontWeight: '700',
    width: 28,
    textAlign: 'right',
    letterSpacing: 0.3,
  },

  // Status (right)
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 72,
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  checkmark: {
    fontSize: 9,
    color: C.green,
    fontWeight: '900',
  },
  errorMark: {
    fontSize: 9,
    color: C.orange,
    fontWeight: '900',
  },
  exhaustedMark: {
    fontSize: 9,
    color: C.amber,
    fontWeight: '900',
  },
  activePulse: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  queuedDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
