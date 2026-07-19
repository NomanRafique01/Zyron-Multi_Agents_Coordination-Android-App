/**
 * AgentsWorkshopPanel.component.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Agents Workshop — Settings panel
 *
 * Contains two modules:
 *   1. Custom Agent Builder (free for all users)
 *   2. Custom Team Builder  (premium)
 *
 * This panel is purely a metadata management surface.
 * It does NOT modify orchestration, routing, streaming, or any runtime system.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AgentsWorkshopIcon } from '../../../components/shared/Icons';
import C from '../../../config/colors.config';
import {
  loadCustomAgents,
  deleteCustomAgent,
  duplicateCustomAgent,
  invalidateCustomAgentsCache,
} from '../../../agents/workshop/customAgentsStorage';
import {
  loadCustomTeams,
  deleteCustomTeam,
  invalidateCustomTeamsCache,
} from '../../../agents/workshop/customTeamsStorage';
import { invalidateCustomTeams } from '../../../agents/workshop/customTeamRegistry';
import AgentBuilderPanel from '../../../components/workshop/AgentBuilderPanel.component.jsx';
import TeamBuilderPanel from '../../../components/workshop/TeamBuilderPanel.component.jsx';
import CustomAgentsLibrary from '../../../components/workshop/CustomAgentsLibrary.component.jsx';

const TAB_AGENTS = 'agents';
const TAB_TEAMS  = 'teams';

export default function AgentsWorkshopPanel({ showToast, scrollRef, workshopPanelNode }) {
  const [activeTab, setActiveTab] = useState(TAB_AGENTS);
  const [customAgents, setCustomAgents] = useState([]);
  const [customTeams, setCustomTeams] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showTeamBuilder, setShowTeamBuilder] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null); // null = create mode
  const [loading, setLoading] = useState(true);
  const builderContainerRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      invalidateCustomAgentsCache();
      invalidateCustomTeamsCache();
      const [agents, teams] = await Promise.all([loadCustomAgents(), loadCustomTeams()]);
      setCustomAgents(agents);
      setCustomTeams(teams);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const openBuilder = useCallback((agent = null) => {
    setEditingAgent(agent);
    setShowBuilder(true);
    setTimeout(() => {
      if (!scrollRef?.current || !builderContainerRef.current) return;
      if (builderContainerRef.current.measureInWindow && scrollRef.current.measureInWindow) {
        scrollRef.current.measureInWindow((_scrollX, scrollY) => {
          builderContainerRef.current.measureInWindow((_bx, by) => {
            scrollRef.current.scrollTo({ y: Math.max(0, by - scrollY - 10), animated: true });
          });
        });
      }
    }, 100);
  }, [scrollRef]);

  const handleAgentSaved = useCallback(() => {
    setShowBuilder(false);
    setEditingAgent(null);
    refresh();
    if (showToast) showToast('Workshop', 'Agent saved', 'success');
  }, [refresh, showToast]);

  const handleDeleteAgent = useCallback(async (id) => {
    try {
      await deleteCustomAgent(id);
      invalidateCustomAgentsCache();
      setCustomAgents((prev) => prev.filter((a) => a.id !== id));
      if (showToast) showToast('Workshop', 'Agent deleted', 'success');
    } catch (err) {
      if (showToast) showToast('Workshop', 'Could not delete agent', 'error');
    }
  }, [showToast]);

  const handleDuplicateAgent = useCallback(async (id) => {
    try {
      const copy = await duplicateCustomAgent(id);
      setCustomAgents((prev) => [...prev, copy]);
      if (showToast) showToast('Workshop', 'Agent duplicated', 'success');
    } catch (err) {
      if (showToast) showToast('Workshop', 'Could not duplicate agent', 'error');
    }
  }, [showToast]);

  const handleTeamRegistered = useCallback((team) => {
    setShowTeamBuilder(false);
    invalidateCustomTeams();
    refresh();
    if (showToast) showToast('Workshop', `Team "${team.name}" registered`, 'success');
  }, [refresh, showToast]);

  const handleDeleteTeam = useCallback(async (id) => {
    try {
      await deleteCustomTeam(id);
      invalidateCustomTeamsCache();
      invalidateCustomTeams();
      setCustomTeams((prev) => prev.filter((t) => t.id !== id));
      if (showToast) showToast('Workshop', 'Team deleted', 'success');
    } catch {
      if (showToast) showToast('Workshop', 'Could not delete team', 'error');
    }
  }, [showToast]);

  return (
    <View style={ws.panel}>
      {/* Hero */}
      <View style={ws.hero}>
        <View style={ws.heroIconBox}>
          <AgentsWorkshopIcon color="#A78BFA" size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ws.heroTitle}>Agents Workshop</Text>
          <Text style={ws.heroSub}>Build custom agents and compose custom teams</Text>
        </View>
        <View style={ws.heroPill}>
          <Text style={ws.heroPillText}>{customAgents.length} AGENT{customAgents.length !== 1 ? 'S' : ''}</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={ws.tabBar}>
        <TouchableOpacity
          style={[ws.tab, activeTab === TAB_AGENTS && ws.tabActive]}
          onPress={() => setActiveTab(TAB_AGENTS)}
          activeOpacity={0.75}
        >
          <Text style={[ws.tabText, activeTab === TAB_AGENTS && ws.tabTextActive]}>Agent Builder</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ws.tab, activeTab === TAB_TEAMS && ws.tabActive, activeTab === TAB_TEAMS && { borderColor: 'rgba(123, 47, 255, 0.5)' }]}
          onPress={() => setActiveTab(TAB_TEAMS)}
          activeOpacity={0.75}
        >
          <Text style={[ws.tabText, activeTab === TAB_TEAMS && ws.tabTextActive]}>
            Team Builder
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Agent Builder tab ── */}
      {activeTab === TAB_AGENTS && (
        <View style={ws.tabContent}>
          {/* Your Agents library */}
          <CustomAgentsLibrary
            customAgents={customAgents}
            onEdit={(agent) => openBuilder(agent)}
            onDuplicate={handleDuplicateAgent}
            onDelete={handleDeleteAgent}
            onCreate={() => openBuilder(null)}
          />

          {/* Create/Edit form */}
          {showBuilder ? (
            <View ref={builderContainerRef} collapsable={false}>
              <AgentBuilderPanel
                editAgent={editingAgent}
                onSaved={handleAgentSaved}
                onClose={() => { setShowBuilder(false); setEditingAgent(null); }}
              />
            </View>
          ) : (
            <TouchableOpacity
              style={ws.createBtn}
              onPress={() => openBuilder(null)}
              activeOpacity={0.82}
            >
              <Text style={ws.createBtnPlus}>+</Text>
              <Text style={ws.createBtnText}>CREATE NEW AGENT</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Team Builder tab ── */}
      {activeTab === TAB_TEAMS && (
        <View style={ws.tabContent}>
          {/* Existing custom teams */}
          {customTeams.length > 0 && (
            <View style={ws.teamsSection}>
              <View style={ws.teamsSectionHeader}>
                <Text style={ws.teamsSectionTitle}>YOUR TEAMS</Text>
                <Text style={ws.agentCount}>{customTeams.length}</Text>
              </View>
              {customTeams.map((team) => (
                <View key={team.id} style={[ws.teamCard, { borderColor: `${team.accent}33` }]}>
                  <View style={ws.teamCardHeader}>
                    {team.teamIcon
                      ? (typeof team.teamIcon === 'string'
                          ? <Text style={ws.teamCardIcon}>{team.teamIcon}</Text>
                          : <View style={{ width: 26, alignItems: 'center' }}>{team.teamIcon}</View>)
                      : <AgentsWorkshopIcon color="#A78BFA" size={20} />}
                    <View style={{ flex: 1 }}>
                      <Text style={ws.teamCardName}>{team.name}</Text>
                      <Text style={ws.teamCardTagline} numberOfLines={1}>{team.tagline}</Text>
                    </View>
                    <View style={[ws.customBadge, { backgroundColor: `${team.accent}22`, borderColor: `${team.accent}55` }]}>
                      <Text style={[ws.customBadgeText, { color: team.accent }]}>CUSTOM</Text>
                    </View>
                    <TouchableOpacity
                      style={ws.teamDeleteBtn}
                      onPress={() => handleDeleteTeam(team.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={ws.teamDeleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={ws.teamRosterRow}>
                    {['reasoner','coder','vision','writer'].map((role) => {
                      const a = team.agents?.[role];
                      return a ? (
                        <View key={role} style={ws.rosterChip}>
                          <Text style={ws.rosterChipIcon}>{a.icon}</Text>
                          <Text style={ws.rosterChipName}>{a.name}</Text>
                        </View>
                      ) : null;
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Team builder form */}
          <TeamBuilderPanel
            customAgents={customAgents}
            isPremium={true}
            onRegistered={handleTeamRegistered}
            onClose={() => setShowTeamBuilder(false)}
          />
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const ws = StyleSheet.create({
  panel: {
    backgroundColor: '#0C0C12',
    borderWidth: 1,
    borderColor: '#20202F',
    borderRadius: 14,
    padding: 4,
    marginTop: -4,
    marginBottom: 16,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 0,
    paddingBottom: 12,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A28',
  },
  heroIconBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(123, 47, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(123, 47, 255, 0.3)',
  },
  heroIcon: { fontSize: 20 },
  heroTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  heroSub: { color: '#8A8A9D', fontSize: 10, marginTop: 2, lineHeight: 14 },
  heroPill: {
    backgroundColor: 'rgba(123, 47, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(123, 47, 255, 0.35)',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  heroPillText: { color: C.purpleSoft, fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  tabBar: {
    flexDirection: 'row',
    gap: 0,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#242436',
    backgroundColor: '#141420',
    marginHorizontal: 3,
  },
  tabActive: {
    backgroundColor: 'rgba(123, 47, 255, 0.12)',
    borderColor: 'rgba(123, 47, 255, 0.5)',
  },
  tabText: { fontSize: 10, fontWeight: '800', color: '#6A6A7D' },
  tabTextActive: { color: C.purpleSoft },
  premiumDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FBBF24',
  },
  tabContent: { padding: 10, paddingTop: 12 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(123, 47, 255, 0.35)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(123, 47, 255, 0.05)',
    marginTop: 4,
  },
  createBtnPlus: { color: C.purpleSoft, fontSize: 16, fontWeight: '900' },
  createBtnText: { color: C.purpleSoft, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  // Teams section
  teamsSection: { marginBottom: 12 },
  teamsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  teamsSectionTitle: {
    fontSize: 10, fontWeight: '900', color: C.purpleSoft,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  agentCount: {
    fontSize: 9, fontWeight: '900', color: '#FFFFFF',
    backgroundColor: 'rgba(123, 47, 255, 0.2)', borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden',
  },
  teamCard: {
    backgroundColor: '#11111A',
    borderWidth: 1,
    borderRadius: 11,
    padding: 11,
    marginBottom: 8,
  },
  teamCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  teamCardIcon: { fontSize: 20 },
  teamCardName: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  teamCardTagline: { color: '#6A6A7D', fontSize: 9, marginTop: 1 },
  customBadge: {
    borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1,
  },
  customBadgeText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  teamDeleteBtn: {
    width: 26, height: 26, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  teamDeleteBtnText: { color: '#EF4444', fontSize: 11, fontWeight: '900' },
  teamRosterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  rosterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: '#252535',
    borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4,
  },
  rosterChipIcon: { fontSize: 10 },
  rosterChipName: { color: '#C8C8D8', fontSize: 9, fontWeight: '600' },
});
