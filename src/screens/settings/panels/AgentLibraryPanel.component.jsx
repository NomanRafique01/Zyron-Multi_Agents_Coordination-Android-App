/**
 * AgentLibraryPanel.component.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Agent Team Library panel inside Settings.
 *
 * Two sub-sections:
 *   1. "Zyron's Agent Teams" — built-in teams
 *   2. "Your Custom Teams"   — teams saved in Agents Workshop
 *
 * Each card in both sections shows the same accordion UI:
 *   collapsed  → name, tagline, agent roster chips
 *   expanded   → description + full agent breakdown + activate toggle
 *
 * Custom teams behave identically to built-in teams when selected.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import s from '../../../styles/app.styles';
import C from '../../../config/colors.config';
import { AGENTS_TEAMS } from '../../../utils/agentLogic.utils';
import { BoltIcon } from '../../../components/shared/Icons';
import {
  loadCustomTeams,
  invalidateCustomTeamsCache,
} from '../../../agents/workshop/customTeamsStorage';

const ROSTER = ['reasoner', 'coder', 'vision', 'writer'];

// ── Shared team accordion card ─────────────────────────────────────────────

function TeamAccordionCard({
  team,
  isTeamActive,
  isExpanded,
  teamNodeRef,
  teamLayoutRef,
  onToggle,
  onSelect,
  isCustom = false,
}) {
  const teamIcon = team.teamIcon || team.agents?.reasoner?.icon || '🤖';
  const writerName = team.agents?.writer?.name || 'Writer';

  return (
    <View
      style={s.teamAccordionGroup}
      ref={(node) => { if (node && teamNodeRef) teamNodeRef.current[team.id] = node; }}
      onLayout={(event) => {
        if (teamLayoutRef) teamLayoutRef.current[team.id] = event.nativeEvent.layout;
      }}
    >
      <View
        style={[
          s.teamAccordionCard,
          isTeamActive && { borderColor: team.accent + '73', borderWidth: 1.5 },
          isExpanded && { borderColor: team.accent + '59' },
        ]}
      >
        <TouchableOpacity
          style={[
            s.teamAccordionHeader,
            { flexDirection: 'column', alignItems: 'stretch' },
            isTeamActive && s.teamAccordionHeaderActive,
          ]}
          onPress={() => onToggle(team.id)}
          activeOpacity={0.75}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Text style={s.teamAccordionIcon}>{teamIcon}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.teamAccordionTitle}>{team.name}</Text>
                  {isCustom && (
                    <View style={[ls.customBadge, { backgroundColor: team.accent + '22', borderColor: team.accent + '55' }]}>
                      <Text style={[ls.customBadgeText, { color: team.accent }]}>CUSTOM</Text>
                    </View>
                  )}
                </View>
                <Text style={s.teamAccordionSub} numberOfLines={1}>
                  {isTeamActive
                    ? `Active · ${writerName} synthesizes`
                    : team.tagline}
                </Text>
              </View>
            </View>
            {isExpanded && (
              <View style={s.teamPanelSwitchGlow}>
                <TouchableOpacity
                  style={[
                    s.teamPanelSwitch,
                    isTeamActive && s.teamPanelSwitchActive,
                  ]}
                  onPress={() => onSelect(team.id)}
                  activeOpacity={0.82}
                >
                  <View
                    style={[
                      s.teamPanelSwitchKnob,
                      isTeamActive && s.teamPanelSwitchKnobActive,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Collapsed: description + roster chips */}
          {!isExpanded && (
            <>
              <Text style={s.teamBriefDesc} numberOfLines={2}>
                {team.description}
              </Text>
              <View style={s.agentLibraryRoster}>
                {ROSTER.map((role) => {
                  const agent = team.agents?.[role];
                  if (!agent) return null;
                  return (
                    <View key={role} style={s.agentLibraryRosterChip}>
                      <Text style={s.agentLibraryRosterIcon}>{agent.icon}</Text>
                      <Text style={s.agentLibraryRosterName}>{agent.name}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </TouchableOpacity>

        {/* Expanded: detailed agent breakdown */}
        {isExpanded && (
          <View style={s.teamAccordionBody}>
            <Text style={s.teamBodyIntro}>{team.description}</Text>

            {ROSTER.map((role, idx) => {
              const agent = team.agents?.[role];
              if (!agent) return null;
              const isLast = idx === ROSTER.length - 1;
              const features = agent.features || [];

              return (
                <View
                  key={role}
                  style={[s.teamAgentRow, isLast && s.teamAgentRowLast]}
                >
                  <Text style={[s.teamAgentSlotLabel, { color: team.accent }]}>
                    Agent {idx + 1}{idx === 3 ? ' · Writer' : ''}
                  </Text>
                  <View style={s.teamAgentHeader}>
                    <View
                      style={[
                        s.teamAgentIconWrap,
                        {
                          backgroundColor: agent.accentDim,
                          borderColor: (agent.accent || team.accent) + '44',
                        },
                      ]}
                    >
                      <Text style={s.teamAgentIcon}>{agent.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.teamAgentName}>{agent.name}</Text>
                      <Text style={s.teamAgentRole}>{agent.socketLabel}</Text>
                    </View>
                  </View>
                  {features.length > 0 && (
                    <View style={s.teamAgentFeatures}>
                      {features.map((feature) => (
                        <View key={feature} style={s.teamAgentFeatureLine}>
                          <Text style={s.teamAgentFeatureBullet}>•</Text>
                          <Text style={s.teamAgentFeatureText}>{feature}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ label, count }) {
  return (
    <View style={ls.sectionHeader}>
      <Text style={ls.sectionLabel}>{label}</Text>
      {count != null && (
        <View style={ls.sectionCount}>
          <Text style={ls.sectionCountText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AgentLibraryPanel({
  activeTeamId,
  activeTeam,
  expandedTeamId,
  teamNodeRef,
  teamLayoutRef,
  onToggleTeam,     // (teamId) => void
  onSelectTeam,     // (teamId) => void
}) {
  const [customTeams, setCustomTeams] = useState([]);

  const loadCustom = useCallback(async () => {
    try {
      invalidateCustomTeamsCache();
      const teams = await loadCustomTeams();
      setCustomTeams(teams);
    } catch {
      setCustomTeams([]);
    }
  }, []);

  useEffect(() => { loadCustom(); }, [loadCustom]);

  return (
    <View style={s.agentLibraryPanel}>

      {/* Hero */}
      <View style={[s.agentLibraryHero, { padding: 10 }]}>
        <View style={s.agentLibraryHeroIcon}>
          <BoltIcon color={C.purpleSoft} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.agentLibraryHeroTitle}>Agent Team Library</Text>
          <Text style={s.agentLibraryHeroSub}>
            Select a team to activate it across all coordination pipelines
          </Text>
        </View>
        <View style={s.agentLibraryActivePill}>
          <Text style={s.agentLibraryActivePillText}>{activeTeam.name.toUpperCase()}</Text>
        </View>
      </View>

      {/* ── Section 1: Zyron's Agent Teams ── */}
      <View style={[s.agentLibraryGrid, { paddingHorizontal: 10, paddingBottom: 4 }]}>
        <SectionHeader label="ZYRON'S AGENT TEAMS" count={AGENTS_TEAMS.length} />

        {AGENTS_TEAMS.map((team) => (
          <TeamAccordionCard
            key={team.id}
            team={team}
            isTeamActive={team.id === activeTeamId}
            isExpanded={expandedTeamId === team.id}
            teamNodeRef={teamNodeRef}
            teamLayoutRef={teamLayoutRef}
            onToggle={onToggleTeam}
            onSelect={onSelectTeam}
            isCustom={false}
          />
        ))}
      </View>

      {/* ── Section 2: Your Custom Teams ── */}
      <View style={[s.agentLibraryGrid, { paddingHorizontal: 10, paddingBottom: 14 }]}>
        <SectionHeader label="YOUR CUSTOM TEAMS" count={customTeams.length} />

        {customTeams.length === 0 ? (
          <View style={ls.emptyCustom}>
            <Text style={ls.emptyCustomText}>
              No custom teams yet — build one in the Agents Workshop
            </Text>
          </View>
        ) : (
          customTeams.map((team) => (
            <TeamAccordionCard
              key={team.id}
              team={team}
              isTeamActive={team.id === activeTeamId}
              isExpanded={expandedTeamId === team.id}
              teamNodeRef={teamNodeRef}
              teamLayoutRef={teamLayoutRef}
              onToggle={onToggleTeam}
              onSelect={onSelectTeam}
              isCustom={true}
            />
          ))
        )}
      </View>

    </View>
  );
}

// ── Local styles (panel-scoped extras) ────────────────────────────────────

const ls = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 14,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: C.purpleSoft,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionCount: {
    backgroundColor: 'rgba(123, 47, 255, 0.2)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  sectionCountText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  customBadge: {
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
  },
  customBadgeText: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  emptyCustom: {
    backgroundColor: 'rgba(123, 47, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(123, 47, 255, 0.15)',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyCustomText: {
    color: '#5A5A70',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 15,
  },
});
