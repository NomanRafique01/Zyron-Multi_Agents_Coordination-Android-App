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
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { AgentsWorkshopIcon, TeamBuilderIcon } from '../../../components/shared/Icons';
import C from '../../../config/colors.config';
import { ICON_OPTIONS } from '../../../components/workshop/AgentBuilderPanel.component';
import { renderTeamSvgIcon } from '../../../components/workshop/TeamBuilderPanel.component';
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

export default function AgentsWorkshopPanel({ showToast, scrollRef, scrollOffsetRef, workshopPanelNodeRef }) {
  const [activeTab, setActiveTab] = useState(TAB_AGENTS);
  const [customAgents, setCustomAgents] = useState([]);
  const [customTeams, setCustomTeams] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showTeamBuilder, setShowTeamBuilder] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null); // null = create mode
  const [loading, setLoading] = useState(true);
  const builderNodeRef       = useRef(null); // ref on the AgentBuilderPanel wrapper
  const teamBuilderNodeRef   = useRef(null); // ref on the TeamBuilderPanel wrapper
  const scrollRafRef         = useRef(null); // rAF handle for scrollNodeIntoView
  const backScrollTimerRef   = useRef(null); // setTimeout handle for scrollBackToPanel
  const openScrollYRef       = useRef(0);    // scroll offset captured when builder opens

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

  // Cancel any pending scroll operations on unmount
  useEffect(() => () => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    if (backScrollTimerRef.current) clearTimeout(backScrollTimerRef.current);
  }, []);

  /**
   * Scroll a node to the top of the settings ScrollView.
   * Uses requestAnimationFrame so native layout is committed before measuring —
   * this gives the same instant, jank-free feel as other settings panel scrolls.
   */
  const scrollNodeIntoView = useCallback((nodeRef) => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const scrollNode = scrollRef?.current;
      const node = nodeRef?.current;
      if (!scrollNode || !node) return;
      scrollNode.measureInWindow((_sx, scrollY) => {
        node.measureInWindow((_nx, nodeY) => {
          const targetY = (scrollOffsetRef?.current ?? 0) + nodeY - scrollY - 10;
          scrollNode.scrollTo({ y: Math.max(0, targetY), animated: true });
        });
      });
    });
  }, [scrollRef, scrollOffsetRef]);

  const openBuilder = useCallback((agent = null) => {
    openScrollYRef.current = scrollOffsetRef?.current ?? 0;
    setEditingAgent(agent);
    setShowBuilder(true);
  }, [scrollOffsetRef]);

  const scrollBackToPanel = useCallback(() => {
    if (backScrollTimerRef.current) clearTimeout(backScrollTimerRef.current);
    backScrollTimerRef.current = setTimeout(() => {
      backScrollTimerRef.current = null;
      const scrollNode = scrollRef?.current;
      const panelNode  = workshopPanelNodeRef?.current;
      if (!scrollNode) return;
      if (panelNode && scrollNode.measureInWindow && panelNode.measureInWindow) {
        scrollNode.measureInWindow((_sx, scrollY) => {
          panelNode.measureInWindow((_nx, nodeY) => {
            const targetY = (scrollOffsetRef?.current ?? 0) + nodeY - scrollY - 10;
            scrollNode.scrollTo({ y: Math.max(0, targetY), animated: true });
          });
        });
      } else {
        scrollNode.scrollTo({ y: Math.max(0, openScrollYRef.current), animated: true });
      }
    }, 120);
  }, [scrollRef, scrollOffsetRef, workshopPanelNodeRef]);

  // Scroll the builder panel into view after it mounts — called via useEffect
  // watching showBuilder/showTeamBuilder so layout is always fully committed.
  useEffect(() => {
    if (showBuilder) scrollNodeIntoView(builderNodeRef);
  }, [showBuilder]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showTeamBuilder) scrollNodeIntoView(teamBuilderNodeRef);
  }, [showTeamBuilder]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAgentSaved = useCallback(() => {
    refresh();
    setShowBuilder(false);
    setEditingAgent(null);
    if (showToast) showToast('Workshop', 'Agent saved', 'success');
    scrollBackToPanel();
  }, [refresh, showToast, scrollBackToPanel]);

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

  const switchTab = useCallback((tab) => {
    if (tab === TAB_TEAMS) {
      setShowBuilder(false);
      setEditingAgent(null);
    }
    if (tab === TAB_AGENTS) {
      setShowTeamBuilder(false);
    }
    setActiveTab(tab);
  }, []);

  return (
    <View style={ws.panel}>
      {/* Tab bar */}
      <View style={ws.tabBar}>
        <TouchableOpacity
          style={[ws.tab, activeTab === TAB_AGENTS && ws.tabActive]}
          onPress={() => switchTab(TAB_AGENTS)}
          activeOpacity={0.75}
        >
          <Text style={[ws.tabText, activeTab === TAB_AGENTS && ws.tabTextActive]}>Agent Builder</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ws.tab, activeTab === TAB_TEAMS && ws.tabActive, activeTab === TAB_TEAMS && { borderColor: 'rgba(123, 47, 255, 0.5)' }]}
          onPress={() => switchTab(TAB_TEAMS)}
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
          {/* Your Agents library — always visible */}
          <CustomAgentsLibrary
            customAgents={customAgents}
            onEdit={(agent) => openBuilder(agent)}
            onDuplicate={handleDuplicateAgent}
            onDelete={handleDeleteAgent}
            onCreate={() => openBuilder(null)}
          />

          {/* Create/Edit form — key on editingAgent.id so form resets after save */}
          {showBuilder ? (
            <View ref={builderNodeRef} collapsable={false}>
              <AgentBuilderPanel
                key={editingAgent?.id ?? 'new'}
                editAgent={editingAgent}
                onSaved={handleAgentSaved}
                onClose={() => { setShowBuilder(false); setEditingAgent(null); scrollBackToPanel(); }}
              />
            </View>
          ) : (
            /* Dashed banner — only shown once at least one agent exists */
            customAgents.length > 0 && (
              <TouchableOpacity
                style={ws.createBtn}
                onPress={() => openBuilder(null)}
                activeOpacity={0.82}
              >
                <Text style={ws.createBtnPlus}>+</Text>
                <Text style={ws.createBtnText}>CREATE NEW AGENT</Text>
              </TouchableOpacity>
            )
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
                    {renderTeamSvgIcon(team.teamIcon, team.accent || '#A78BFA')
                      || <AgentsWorkshopIcon color="#A78BFA" size={20} />}
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
                      if (!a) return null;
                      const iconOption = ICON_OPTIONS.find((o) => o.key === a.icon);
                      return (
                        <View key={role} style={ws.rosterChip}>
                          {iconOption
                            ? <Image source={iconOption.src} style={ws.rosterChipIcon} resizeMode="cover" />
                            : <Text style={ws.rosterChipIconText}>{a.icon || '🤖'}</Text>}
                          <Text style={ws.rosterChipName}>{a.name}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Empty state — no teams yet and builder is closed */}
          {customTeams.length === 0 && !showTeamBuilder && (
            <View style={ws.teamEmptyState}>
              <View style={ws.teamEmptyIconBox}>
                <TeamBuilderIcon color="#A78BFA" size={34} />
              </View>
              <Text style={ws.teamEmptyTitle}>No custom teams yet</Text>
              <Text style={ws.teamEmptySub}>
                Assemble 4 custom agents into a team using the Team Builder below.
              </Text>
              <TouchableOpacity
                style={ws.teamCreateFirstBtn}
                onPress={() => setShowTeamBuilder(true)}
                activeOpacity={0.82}
              >
                <Text style={ws.teamCreateFirstBtnText}>+ CREATE FIRST TEAM</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Team builder form — shown when builder is open */}
          {showTeamBuilder && (
            <View ref={teamBuilderNodeRef} collapsable={false}>
              <TeamBuilderPanel
                customAgents={customAgents}
                isPremium={true}
                onRegistered={handleTeamRegistered}
                onClose={() => setShowTeamBuilder(false)}
              />
            </View>
          )}

          {/* Dashed create banner — only shown when at least one team exists and builder is closed */}
          {customTeams.length > 0 && !showTeamBuilder && (
            <TouchableOpacity
              style={ws.createBtn}
              onPress={() => setShowTeamBuilder(true)}
              activeOpacity={0.82}
            >
              <Text style={ws.createBtnPlus}>+</Text>
              <Text style={ws.createBtnText}>CREATE NEW TEAM</Text>
            </TouchableOpacity>
          )}
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
  rosterChipIcon: { width: 16, height: 16, borderRadius: 4 },
  rosterChipIconText: { fontSize: 10 },
  rosterChipName: { color: '#C8C8D8', fontSize: 9, fontWeight: '600' },

  // Team empty state
  teamEmptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  teamEmptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.28)',
    marginBottom: 12,
  },
  teamEmptyTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginBottom: 5 },
  teamEmptySub: { color: '#6A6A7D', fontSize: 10, lineHeight: 14, textAlign: 'center', marginBottom: 14 },
  teamCreateFirstBtn: {
    backgroundColor: C.purple,
    borderRadius: 9,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  teamCreateFirstBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
});
