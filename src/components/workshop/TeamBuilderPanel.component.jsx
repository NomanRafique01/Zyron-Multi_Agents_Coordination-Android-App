/**
 * TeamBuilderPanel.component.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Custom Team Builder — Agents Workshop
 *
 * Builds a complete team object matching the existing team schema.
 * All four role slots must be filled before registration.
 * No new runtime paths are created — the team is inserted into the
 * unified teams collection and behaves identically to built-in teams.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import C from '../../config/colors.config';
import {
  saveCustomTeam,
  generateTeamId,
} from '../../agents/workshop/customTeamsStorage';
import { CrossIcon } from '../shared/Icons';

const ROLE_SLOTS = ['reasoner', 'coder', 'vision', 'writer'];
const ROLE_LABELS = {
  reasoner: 'Agent 1',
  coder:    'Agent 2',
  vision:   'Agent 3',
  writer:   'Agent 4',
};

const TEAM_COLOR_PALETTE = [
  { accent: '#7B2FFF', dim: 'rgba(123, 47, 255, 0.12)' },
  { accent: '#2563EB', dim: 'rgba(37, 99, 235, 0.12)' },
  { accent: '#0D9488', dim: 'rgba(13, 148, 136, 0.12)' },
  { accent: '#D97706', dim: 'rgba(217, 119, 6, 0.12)' },
  { accent: '#BE185D', dim: 'rgba(190, 24, 93, 0.12)' },
  { accent: '#7C3AED', dim: 'rgba(124, 58, 237, 0.12)' },
];

// ── Agent slot picker ─────────────────────────────────────────────────────────

function AgentSlotPicker({ role, selectedAgent, customAgents, onSelect, accent }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={ts.slotGroup}>
      <Text style={[ts.slotLabel, { color: accent }]}>{ROLE_LABELS[role].toUpperCase()}</Text>
      <TouchableOpacity
        style={[
          ts.slotBtn,
          selectedAgent && { borderColor: `${accent}66`, backgroundColor: `${accent}0D` },
          open && { borderColor: `${accent}99` },
        ]}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.75}
      >
        {selectedAgent ? (
          <View style={ts.slotBtnContent}>
            <Text style={ts.slotBtnIcon}>{selectedAgent.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={ts.slotBtnName}>{selectedAgent.name}</Text>
              <Text style={ts.slotBtnDesc} numberOfLines={1}>{selectedAgent.description}</Text>
            </View>
            <Text style={[ts.slotChevron, open && { transform: [{ rotate: '180deg' }] }]}>▾</Text>
          </View>
        ) : (
          <View style={ts.slotBtnContent}>
            <Text style={ts.slotEmptyIcon}>○</Text>
            <Text style={ts.slotEmptyText}>Select agent…</Text>
            <Text style={[ts.slotChevron, open && { transform: [{ rotate: '180deg' }] }]}>▾</Text>
          </View>
        )}
      </TouchableOpacity>

      {open && (
        <View style={ts.agentDropdown}>
          {customAgents.length === 0 ? (
            <Text style={ts.dropdownEmpty}>No agents yet — create some in the Agent Builder</Text>
          ) : (
            customAgents.map((agent) => (
              <TouchableOpacity
                key={agent.id}
                style={[
                  ts.dropdownItem,
                  selectedAgent?.id === agent.id && { backgroundColor: `${accent}14` },
                ]}
                onPress={() => { onSelect(role, agent); setOpen(false); }}
                activeOpacity={0.75}
              >
                <Text style={ts.dropdownIcon}>{agent.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={ts.dropdownName}>{agent.name}</Text>
                  <Text style={ts.dropdownDesc} numberOfLines={1}>{agent.description}</Text>
                </View>
                {selectedAgent?.id === agent.id && (
                  <Text style={[ts.dropdownCheck, { color: accent }]}>✓</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
}

// ── Build team object from form + selected agents ─────────────────────────────

const buildTeamObject = (form, slots) => {
  const accent = TEAM_COLOR_PALETTE[form.colorIndex || 0].accent;
  const accentDim = TEAM_COLOR_PALETTE[form.colorIndex || 0].dim;

  // Build role-map agents section matching existing team schema exactly
  const agents = {};
  ROLE_SLOTS.forEach((role) => {
    const a = slots[role];
    agents[role] = {
      name: a.name,
      icon: a.icon,
      accent: a.accent,
      accentDim: a.accentDim,
      accentGlow: a.accentGlow,
      activeStatus: a.activeStatus || 'working',
      activeLabel: a.activeLabel || 'Processing...',
      socketLabel: a.socketLabel || `${a.name} Agent`,
      contributionLens: a.contributionLens || 'specialist insight',
      specialistDirective: a.specialistDirective || `You are ${a.name}.`,
      features: a.features || [],
    };
  });

  const writerName = slots.writer?.name || 'Writer';

  return {
    id: generateTeamId(),
    name: form.name.trim(),
    tagline: form.tagline.trim() || `Custom team built in Agents Workshop`,
    description: form.description.trim() || `A custom team of four specialists.`,
    accent,
    accentDim,
    badge: 'CUSTOM',
    category: 'Custom',
    teamIcon: slots.reasoner?.icon || '🤖',
    agents,
    greetingReply: `Hi! I'm the ${form.name.trim()} team.\nHow can we help?`,
    writerRules: `${writerName} synthesizes all specialist insights into one clear, complete answer.`,
    sharedBriefSuffix: form.description.trim() || 'Custom team. Apply specialist expertise.',
  };
};

// ── Main component ────────────────────────────────────────────────────────────

export default function TeamBuilderPanel({ customAgents = [], onRegistered, onClose }) {
  const [form, setForm] = useState({ name: '', tagline: '', description: '', colorIndex: 0 });
  const [slots, setSlots] = useState({ reasoner: null, coder: null, vision: null, writer: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const accent = TEAM_COLOR_PALETTE[form.colorIndex || 0].accent;

  const setField = (field, val) => setForm((f) => ({ ...f, [field]: val }));
  const handleSlotSelect = (role, agent) => setSlots((s) => ({ ...s, [role]: agent }));

  const handleRegister = useCallback(async () => {
    setError('');
    if (!form.name.trim()) { setError('Team name is required'); return; }
    const missingSlots = ROLE_SLOTS.filter((r) => !slots[r]);
    if (missingSlots.length > 0) {
      setError(`All 4 role slots must be filled. Missing: ${missingSlots.join(', ')}`);
      return;
    }
    setSaving(true);
    try {
      const team = buildTeamObject(form, slots);
      await saveCustomTeam(team);
      setSaving(false);
      if (onRegistered) onRegistered(team);
    } catch (err) {
      setSaving(false);
      setError(err.message || 'Failed to register team');
    }
  }, [form, slots, onRegistered]);

  const allSlotsFilled = ROLE_SLOTS.every((r) => !!slots[r]);

  return (
    <View style={ts.panel}>
      {/* Header */}
      <View style={ts.header}>
        <View style={[ts.headerIconBox, { backgroundColor: `${accent}18`, borderColor: `${accent}44` }]}>
          <Text style={ts.headerIconEmoji}>🏗️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ts.headerTitle}>Team Builder</Text>
          <Text style={ts.headerSub}>Compose 4 custom agents into a team</Text>
        </View>
        {onClose && (
          <TouchableOpacity style={ts.closeBtn} onPress={onClose} activeOpacity={0.75}>
            <CrossIcon color="#8A8A9D" />
          </TouchableOpacity>
        )}
      </View>

      {/* Step 1: Info */}
      <View style={[ts.stepHeader, { borderLeftColor: accent }]}>
        <Text style={ts.stepTitle}>Team Identity</Text>
      </View>

      <Text style={ts.fieldLabel}>TEAM NAME *</Text>
      <TextInput
        style={ts.textInput}
        placeholder="e.g. Research Squad"
        placeholderTextColor="#5A5A70"
        value={form.name}
        onChangeText={(v) => setField('name', v)}
        maxLength={40}
      />

      <Text style={ts.fieldLabel}>TAGLINE</Text>
      <TextInput
        style={ts.textInput}
        placeholder="e.g. Deep research with precision"
        placeholderTextColor="#5A5A70"
        value={form.tagline}
        onChangeText={(v) => setField('tagline', v)}
        maxLength={80}
      />

      <Text style={ts.fieldLabel}>DESCRIPTION</Text>
      <TextInput
        style={[ts.textInput, ts.multilineInput]}
        placeholder="Describe what this team does..."
        placeholderTextColor="#5A5A70"
        value={form.description}
        onChangeText={(v) => setField('description', v)}
        multiline
        textAlignVertical="top"
        maxLength={300}
      />

      <Text style={ts.fieldLabel}>TEAM COLOR</Text>
      <View style={ts.colorRow}>
        {TEAM_COLOR_PALETTE.map(({ accent: a }, i) => (
          <TouchableOpacity
            key={a}
            style={[ts.colorDot, { backgroundColor: a }, form.colorIndex === i && ts.colorDotActive]}
            onPress={() => setField('colorIndex', i)}
            activeOpacity={0.75}
          >
            {form.colorIndex === i && <View style={ts.colorCheck} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Step 2: Slot assignment */}
      <View style={[ts.stepHeader, { borderLeftColor: accent }]}>
        <Text style={ts.stepTitle}>Assign Agents to Roles</Text>
        <Text style={ts.stepSub}>All 4 slots required</Text>
      </View>

      <View style={ts.slotsGroup}>
        {ROLE_SLOTS.map((role) => (
          <AgentSlotPicker
            key={role}
            role={role}
            selectedAgent={slots[role]}
            customAgents={customAgents}
            onSelect={handleSlotSelect}
            accent={accent}
          />
        ))}
      </View>

      {/* Slot status */}
      <View style={ts.statusRow}>
        {ROLE_SLOTS.map((role) => (
          <View
            key={role}
            style={[ts.statusDot, slots[role] ? { backgroundColor: accent } : ts.statusDotEmpty]}
          />
        ))}
        <Text style={ts.statusText}>
          {ROLE_SLOTS.filter((r) => slots[r]).length}/4 slots filled
        </Text>
      </View>

      {/* Error */}
      {!!error && <Text style={ts.errorText}>{error}</Text>}

      {/* Register button */}
      <TouchableOpacity
        style={[
          ts.registerBtn,
          { backgroundColor: allSlotsFilled ? accent : '#1A1A2A', opacity: saving ? 0.6 : 1 },
          !allSlotsFilled && { borderWidth: 1, borderColor: '#333344' },
        ]}
        onPress={handleRegister}
        activeOpacity={0.82}
        disabled={saving || !allSlotsFilled}
      >
        <Text style={[ts.registerBtnText, !allSlotsFilled && { color: '#5A5A70' }]}>
          {saving ? 'REGISTERING…' : 'REGISTER TEAM'}
        </Text>
      </TouchableOpacity>

      <Text style={ts.registerNote}>
        The team will be merged into the team ecosystem and available in Team Picker immediately.
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const ts = StyleSheet.create({
  panel: {
    backgroundColor: '#0C0C12',
    borderWidth: 1,
    borderColor: '#20202F',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(123, 47, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(123, 47, 255, 0.22)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerIconEmoji: { fontSize: 20 },
  headerTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  headerSub: { color: '#8A8A9D', fontSize: 10, marginTop: 2 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141420',
    borderWidth: 1,
    borderColor: '#262638',
  },
  stepHeader: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginBottom: 12,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  stepNumber: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  stepTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  stepSub: { color: '#6A6A7D', fontSize: 9 },
  fieldLabel: {
    fontSize: 10, fontWeight: '800', color: '#E2E2E9',
    marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  textInput: {
    backgroundColor: '#050508',
    borderWidth: 1,
    borderColor: '#1E1E2C',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 12,
    marginBottom: 2,
  },
  multilineInput: { minHeight: 64, lineHeight: 17 },
  colorRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  colorDot: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  colorDotActive: { borderColor: '#FFFFFF', borderWidth: 2.5 },
  colorCheck: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FFFFFF' },
  slotsGroup: { gap: 10 },
  slotGroup: { marginBottom: 2 },
  slotLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5, marginBottom: 3, textTransform: 'uppercase' },
  slotDesc: { color: '#5A5A70', fontSize: 9, marginBottom: 6 },
  slotBtn: {
    backgroundColor: '#11111A',
    borderWidth: 1,
    borderColor: '#242436',
    borderRadius: 10,
    padding: 11,
  },
  slotBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  slotBtnIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  slotBtnName: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  slotBtnDesc: { color: '#6A6A7D', fontSize: 9, marginTop: 1 },
  slotChevron: { color: '#6A6A7D', fontSize: 14 },
  slotEmptyIcon: { fontSize: 16, color: '#3A3A4A', width: 24, textAlign: 'center' },
  slotEmptyText: { flex: 1, color: '#5A5A70', fontSize: 11 },
  agentDropdown: {
    backgroundColor: '#0F0F18',
    borderWidth: 1,
    borderColor: '#232335',
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownEmpty: { color: '#5A5A70', fontSize: 10, padding: 12, textAlign: 'center' },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A28',
  },
  dropdownIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  dropdownName: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  dropdownDesc: { color: '#6A6A7D', fontSize: 9, marginTop: 1 },
  dropdownCheck: { fontSize: 12, fontWeight: '900' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotEmpty: { backgroundColor: '#2A2A3A' },
  statusText: { color: '#6A6A7D', fontSize: 9, marginLeft: 2 },
  errorText: { color: '#FCA5A5', fontSize: 10, fontWeight: '700', marginTop: 8 },
  registerBtn: {
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  registerBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  registerNote: { color: '#5A5A70', fontSize: 9, textAlign: 'center', marginTop: 8, lineHeight: 13 },
});
