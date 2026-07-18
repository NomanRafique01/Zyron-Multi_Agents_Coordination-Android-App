import React, { useRef, useEffect } from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import C from '../../config/colors.config';
import { getTeamById } from '../../agents/teams';
import { getActiveTeam } from '../../agents/teams/teamRuntime';

const AGENT_CONFIGS = {
  reasoner: { icon: '🧠', color: C.agentReasoner, bg: 'rgba(167, 139, 250, 0.12)' },
  coder:    { icon: '⚡', color: C.agentCoder,    bg: 'rgba(96, 165, 250, 0.12)' },
  vision:   { icon: '👁', color: C.agentVision,   bg: 'rgba(110, 231, 183, 0.12)' },
  writer:   { icon: '✍️', color: C.agentWriter,   bg: 'rgba(251, 191, 36, 0.12)' },
};

const SUMMARY_STATUS_LABELS = {
  done: 'DONE',
  error: 'FAILED',
  exhausted: 'EXHAUSTED',
  queued: 'QUEUED',
};

function getAgentVisual(role, team, variant) {
  if (variant === 'summary' && team?.agents?.[role]) {
    const teamAgent = team.agents[role];
    return {
      icon: teamAgent.icon,
      color: teamAgent.accent || C.purpleSoft,
      bg: teamAgent.accentDim || 'rgba(123, 47, 255, 0.12)',
    };
  }
  return AGENT_CONFIGS[role] || AGENT_CONFIGS.reasoner;
}

function getSummaryCompletionText(agents) {
  const responded = agents.filter((agent) => agent.status === 'done');
  const total = agents.length;

  if (responded.length === total) {
    return 'All agents Responded';
  }

  if (responded.length === 0) {
    return 'No agents responded';
  }

  const names = responded.map((agent) => agent.name).join(', ');
  return `${names} responded`;
}

function AnimatedProgressBar({ progress, statusColor }) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const animatedWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={s.progressBar}>
      <Animated.View
        style={[
          s.progressFill,
          {
            width: animatedWidth,
            backgroundColor: statusColor,
          },
        ]}
      />
    </View>
  );
}

function AgentRow({ role, name, model, progress, status, statusColor, variant = 'live', team }) {
  const config = getAgentVisual(role, team, variant);
  const isDone = status === 'done';
  const isFailed = status === 'error' || status === 'exhausted';
  const isActive = !isDone && !isFailed && status !== 'queued';
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Icon spring pop on completion — mirrors AgentCoordinationTab
  const iconScaleAnim = useRef(new Animated.Value(1)).current;
  const displayStatus = variant === 'summary'
    ? (SUMMARY_STATUS_LABELS[status] || String(status || '').toUpperCase())
    : status;

  useEffect(() => {
    if (isActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isActive]);

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

  return (
    <View style={s.agentRow}>
      <Animated.View
        style={[
          s.agentIconWrap,
          {
            backgroundColor: isDone
              ? 'rgba(110, 231, 183, 0.12)'
              : isFailed
              ? status === 'exhausted'
                ? 'rgba(251, 191, 36, 0.12)'
                : 'rgba(249, 115, 22, 0.12)'
              : isActive
              ? config.bg
              : 'rgba(255, 255, 255, 0.03)',
            opacity: isActive ? pulseAnim : 1,
            borderWidth: isDone || isActive || isFailed ? 1 : 0,
            borderColor: isDone
              ? C.green
              : isFailed
              ? status === 'exhausted'
                ? C.amber
                : C.orange
              : isActive
              ? config.color
              : 'transparent',
            transform: [{ scale: iconScaleAnim }],
          },
        ]}
      >
        <Text style={s.agentIcon}>{config.icon}</Text>
      </Animated.View>

      <View style={s.agentMeta}>
        <Text style={s.agentName}>{name}</Text>
        <Text style={s.agentModel}>{model}</Text>
      </View>

      <AnimatedProgressBar progress={progress} statusColor={statusColor} />

      <Text style={[s.agentStatus, { color: statusColor }]}>{displayStatus}</Text>
    </View>
  );
}

export default function AgentPanel({ agents, variant = 'live', teamId }) {
  if (!agents || agents.length === 0) return null;

  const team = variant === 'summary'
    ? (teamId ? getTeamById(teamId) : getActiveTeam())
    : null;

  const respondedCount = agents.filter((agent) => agent.status === 'done').length;
  const totalCount = agents.length;
  const allResponded = respondedCount === totalCount;
  const allFinished = agents.every((agent) => ['done', 'error', 'exhausted'].includes(agent.status));
  const panelTitle = variant === 'summary' ? 'AGENT COORDINATION' : 'AGENT COORDINATION';
  const completionText = variant === 'summary' ? getSummaryCompletionText(agents) : 'All agents synchronized';

  return (
    <View style={s.agentPanel}>
      <View style={s.panelHeader}>
        <View style={s.panelTitleRow}>
          <View style={[s.panelTitleDot, { backgroundColor: allResponded ? C.green : C.amber }]} />
          <Text style={s.agentPanelTitle}>{panelTitle}</Text>
        </View>
        <Text style={[s.agentCountBadge, { color: allResponded ? C.green : C.amber }]}>
          {respondedCount}/{totalCount}
        </Text>
      </View>

      {agents.map((agent, i) => (
        <AgentRow
          key={agent.role || i}
          {...agent}
          variant={variant}
          team={team}
        />
      ))}

      {variant === 'summary' ? (
        allFinished && (
          <View style={s.completionRow}>
            <Text style={[s.completionText, { color: allResponded ? C.green : C.amber }]}>
              {completionText}
            </Text>
          </View>
        )
      ) : (
        allResponded && (
          <View style={s.completionRow}>
            <Text style={s.completionText}>{completionText}</Text>
          </View>
        )
      )}
    </View>
  );
}

const s = StyleSheet.create({
  agentPanel: {
    backgroundColor: C.bgAgentPanel,
    borderWidth: 1,
    borderColor: C.borderPanel,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    gap: 8,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2C',
    paddingBottom: 7,
    marginBottom: 2,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  panelTitleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  agentPanelTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 1.2,
  },
  agentCountBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  agentRow: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agentIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentIcon: {
    fontSize: 10,
  },
  agentMeta: {
    width: 88,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  agentName: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textPrimary,
  },
  agentModel: {
    fontSize: 8,
    color: C.textDim,
    letterSpacing: 0.2,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: C.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  agentStatus: {
    fontSize: 9,
    fontWeight: '600',
    minWidth: 62,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  completionRow: {
    borderTopWidth: 1,
    borderTopColor: '#1A1A2C',
    paddingTop: 6,
    marginTop: 2,
    alignItems: 'center',
  },
  completionText: {
    fontSize: 9,
    fontWeight: '600',
    color: C.green,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
