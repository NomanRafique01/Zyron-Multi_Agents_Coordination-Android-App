/**
 * CustomAgentsLibrary.component.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays all user-created custom agents in a scrollable list.
 * Actions: view details, edit, duplicate, delete.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import C from '../../config/colors.config';
import { TrashIcon, AgentIcon } from '../shared/Icons';
import { ICON_OPTIONS } from '../workshop/AgentBuilderPanel.component.jsx';

const STRENGTH_KEYS = [
  ['reasoningStrength',  '🧠', 'Reasoning'],
  ['creativityStrength', '💡', 'Creativity'],
  ['analyticalStrength', '📊', 'Analysis'],
  ['codingStrength',     '⚡', 'Coding'],
  ['teachingStrength',   '📝', 'Teaching'],
];

function StrengthBadge({ value, label, accent }) {
  if (!value || value < 50) return null;
  return (
    <View style={[lib.strengthBadge, { backgroundColor: `${accent}18`, borderColor: `${accent}40` }]}>
      <Text style={[lib.strengthBadgeText, { color: accent }]}>{label} {value}</Text>
    </View>
  );
}

function TraitChip({ label, color = '#6A6A7D' }) {
  return (
    <View style={[lib.traitChip, { borderColor: `${color}44` }]}>
      <Text style={[lib.traitChipText, { color }]}>{label}</Text>
    </View>
  );
}

export default function CustomAgentsLibrary({
  customAgents = [],
  onEdit,
  onDuplicate,
  onDelete,
  onCreate,
}) {
  if (customAgents.length === 0) {
    return (
      <View style={lib.emptyState}>
        <View style={lib.emptyIconBox}>
          <AgentIcon color="#A78BFA" size={34} />
        </View>
        <Text style={lib.emptyTitle}>No custom agents yet</Text>
        <Text style={lib.emptySub}>
          Create your first agent using the Agent Builder below.
        </Text>
        {onCreate && (
          <TouchableOpacity style={lib.createFirstBtn} onPress={onCreate} activeOpacity={0.82}>
            <Text style={lib.createFirstBtnText}>+ CREATE FIRST AGENT</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={lib.container}>
      <View style={lib.titleRow}>
        <Text style={lib.sectionTitle}>YOUR AGENTS</Text>
        <Text style={lib.agentCount}>{customAgents.length}</Text>
      </View>
      {customAgents.map((agent) => {
        const accent = agent.accent || '#A78BFA';
        const traits = [
          ...(agent.tone || []),
          ...(agent.communicationStyle || []),
          ...(agent.personality || []),
        ].slice(0, 4);

        return (
          <View key={agent.id} style={[lib.agentCard, { borderColor: `${accent}33` }]}>
            {/* Card header */}
            <View style={lib.cardHeader}>
              <View style={[lib.agentIconBox, { backgroundColor: `${accent}18`, borderColor: `${accent}44` }]}>
                {agent.icon
                  ? <Image
                      source={ICON_OPTIONS.find(o => o.key === agent.icon)?.src}
                      style={lib.agentIconImage}
                      resizeMode="cover"
                    />
                  : <AgentIcon color={accent} size={20} />
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={lib.agentName}>{agent.name}</Text>
                <Text style={lib.agentDesc} numberOfLines={2}>{agent.description || 'No description'}</Text>
              </View>
              <TouchableOpacity
                style={lib.deleteBtn}
                onPress={() => onDelete && onDelete(agent.id)}
                activeOpacity={0.75}
              >
                <TrashIcon color="#EF4444" />
              </TouchableOpacity>
            </View>

            {/* Trait chips */}
            {traits.length > 0 && (
              <View style={lib.traitsRow}>
                {traits.map((t) => (
                  <TraitChip key={t} label={t} color={accent} />
                ))}
              </View>
            )}

            {/* Strength badges (only show ≥50) */}
            <View style={lib.strengthsRow}>
              {STRENGTH_KEYS.map(([key, , label]) => (
                <StrengthBadge key={key} value={agent[key]} label={label} accent={accent} />
              ))}
            </View>

            {/* Actions */}
            <View style={lib.actionsRow}>
              <TouchableOpacity
                style={lib.actionBtn}
                onPress={() => onEdit && onEdit(agent)}
                activeOpacity={0.75}
              >
                <Text style={lib.actionBtnText}>EDIT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={lib.actionBtn}
                onPress={() => onDuplicate && onDuplicate(agent.id)}
                activeOpacity={0.75}
              >
                <Text style={lib.actionBtnText}>DUPLICATE</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const lib = StyleSheet.create({
  container: { marginBottom: 8 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: C.purpleSoft,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  agentCount: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    backgroundColor: 'rgba(123, 47, 255, 0.2)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  agentCard: {
    backgroundColor: '#11111A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  agentIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  agentIconImage: { width: 26, height: 26, borderRadius: 6 },
  agentName: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  agentDesc: { color: '#7A7A8D', fontSize: 10, lineHeight: 14, marginTop: 2 },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  traitsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 7 },
  traitChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  traitChipText: { fontSize: 9, fontWeight: '700' },
  strengthsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  strengthBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  strengthBadgeText: { fontSize: 8, fontWeight: '900' },
  actionsRow: { flexDirection: 'row', gap: 7 },
  actionBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 7,
    alignItems: 'center',
    backgroundColor: '#1A1A28',
    borderWidth: 1,
    borderColor: '#282838',
  },
  actionBtnText: { color: '#8A8A9D', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  emptyIconBox: {
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
  emptyTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginBottom: 5 },
  emptySub: { color: '#6A6A7D', fontSize: 10, lineHeight: 14, textAlign: 'center', marginBottom: 14 },
  createFirstBtn: {
    backgroundColor: C.purple,
    borderRadius: 9,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  createFirstBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
});
