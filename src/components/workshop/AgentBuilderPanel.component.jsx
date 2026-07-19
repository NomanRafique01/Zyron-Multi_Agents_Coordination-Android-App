/**
 * AgentBuilderPanel.component.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Custom Agent Builder — Agents Workshop
 *
 * Creates custom agent personas as metadata-only profiles.
 * No orchestration roles are created. No models. No endpoints.
 * Pure metadata persistence.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Image,
} from 'react-native';
import C from '../../config/colors.config';
import {
  saveCustomAgent,
  updateCustomAgent,
  generateAgentId,
} from '../../agents/workshop/customAgentsStorage';
import {
  generateContributionLens,
  generateSpecialistDirective,
} from '../../agents/workshop/metadataGenerator';
import { CrossIcon, AgentIcon } from '../shared/Icons';

// ── Trait options ─────────────────────────────────────────────────────────────

const TONE_OPTIONS = ['Professional', 'Technical', 'Friendly', 'Formal', 'Direct', 'Creative'];
const STYLE_OPTIONS = ['Concise', 'Detailed', 'Structured', 'Educational', 'Executive'];
const PERSONALITY_OPTIONS = [
  'Critical Thinker', 'Systems Architect', 'Researcher',
  'Innovator', 'Strategist', 'Mentor',
];

// ── Asset icon catalogue (auto-discovered) ────────────────────────────────────
export const ICON_OPTIONS = [
  // coders
  { key: 'debugger',     src: require('../../../assets/agent-icons/coders/debugger.png') },
  { key: 'designer',     src: require('../../../assets/agent-icons/coders/designer.png') },
  { key: 'executor',     src: require('../../../assets/agent-icons/coders/executor.png') },
  { key: 'programmer',   src: require('../../../assets/agent-icons/coders/programmer.png') },
  // creative
  { key: 'creator',      src: require('../../../assets/agent-icons/creative/creator.png') },
  { key: 'curator',      src: require('../../../assets/agent-icons/creative/curator.png') },
  { key: 'narrator',     src: require('../../../assets/agent-icons/creative/narrator.png') },
  { key: 'strategist',   src: require('../../../assets/agent-icons/creative/strategist.png') },
  // financers
  { key: 'accountant',   src: require('../../../assets/agent-icons/financers/accountant.png') },
  { key: 'adviser',      src: require('../../../assets/agent-icons/financers/adviser.png') },
  { key: 'auditor',      src: require('../../../assets/agent-icons/financers/auditor.png') },
  { key: 'investor',     src: require('../../../assets/agent-icons/financers/investor.png') },
  // historians
  { key: 'archivist',    src: require('../../../assets/agent-icons/historians/archivist.png') },
  { key: 'biographer',   src: require('../../../assets/agent-icons/historians/biographer.png') },
  { key: 'cartographer', src: require('../../../assets/agent-icons/historians/cartographer.png') },
  { key: 'contextualist',src: require('../../../assets/agent-icons/historians/contextualist.png') },
  // mega-minds
  { key: 'analyst',      src: require('../../../assets/agent-icons/mega-minds/analyst.png') },
  { key: 'editor',       src: require('../../../assets/agent-icons/mega-minds/editor.png') },
  { key: 'scholar',      src: require('../../../assets/agent-icons/mega-minds/scholar.png') },
  { key: 'synthesizer',  src: require('../../../assets/agent-icons/mega-minds/synthesizer.png') },
  // scientists
  { key: 'experimenter', src: require('../../../assets/agent-icons/scientists/experimenter.png') },
  { key: 'modeler',      src: require('../../../assets/agent-icons/scientists/modeler.png') },
  { key: 'reporter',     src: require('../../../assets/agent-icons/scientists/reporter.png') },
  { key: 'theorist',     src: require('../../../assets/agent-icons/scientists/theorist.png') },
];

const FIXED_ACCENT = '#A78BFA';
const ACCENT_DIM   = 'rgba(167, 139, 250, 0.12)';
const ACCENT_GLOW  = 'rgba(167, 139, 250, 0.35)';

const DEFAULT_FORM = {
  name: '',
  description: '',
  icon: '',
  tone: [],
  communicationStyle: [],
  personality: [],
  reasoningStrength: 50,
  creativityStrength: 50,
  analyticalStrength: 50,
  codingStrength: 50,
  teachingStrength: 50,
  accent: FIXED_ACCENT,
};

// ── Slider component ──────────────────────────────────────────────────────────

function StrengthRow({ label, value, onChange, accent }) {
  return (
    <View style={bs.sliderRow}>
      <View style={bs.sliderLabelRow}>
        <Text style={bs.sliderLabel}>{label}</Text>
        <Text style={[bs.sliderValue, { color: accent }]}>{value}</Text>
      </View>
      <View style={bs.sliderTrack}>
        <View style={[bs.sliderFill, { width: `${value}%`, backgroundColor: accent }]} />
      </View>
      <View style={bs.sliderBtnRow}>
        {[0, 25, 50, 75, 100].map((v) => (
          <TouchableOpacity
            key={v}
            style={[bs.sliderBtn, value === v && { borderColor: accent, backgroundColor: `${accent}22` }]}
            onPress={() => onChange(v)}
            activeOpacity={0.75}
          >
            <Text style={[bs.sliderBtnText, value === v && { color: accent }]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Chip selector ─────────────────────────────────────────────────────────────

function ChipGroup({ options, selected, onToggle, multi, accent }) {
  return (
    <View style={bs.chipGrid}>
      {options.map((opt) => {
        const isActive = multi ? (selected || []).includes(opt) : selected === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[bs.chip, isActive && { borderColor: `${accent}99`, backgroundColor: `${accent}18` }]}
            onPress={() => onToggle(opt)}
            activeOpacity={0.75}
          >
            <Text style={[bs.chipText, isActive && { color: accent }]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AgentBuilderPanel({ onSaved, onClose, editAgent = null }) {
  const [form, setForm] = useState(editAgent ? {
    name: editAgent.name,
    description: editAgent.description || '',
    // Guard against legacy saves where icon was stored as a require() number
    icon: typeof editAgent.icon === 'string' ? editAgent.icon : '',
    tone: editAgent.tone || [],
    communicationStyle: editAgent.communicationStyle || [],
    personality: editAgent.personality || [],
    reasoningStrength: editAgent.reasoningStrength ?? 50,
    creativityStrength: editAgent.creativityStrength ?? 50,
    analyticalStrength: editAgent.analyticalStrength ?? 50,
    codingStrength: editAgent.codingStrength ?? 50,
    teachingStrength: editAgent.teachingStrength ?? 50,
    accent: FIXED_ACCENT,
  } : DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const accent = FIXED_ACCENT;

  const setField = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const toggleMulti = (field, val) => {
    setForm((f) => {
      const current = f[field] || [];
      return {
        ...f,
        [field]: current.includes(val) ? current.filter((v) => v !== val) : [...current, val],
      };
    });
  };

  const handleSave = useCallback(async () => {
    setError('');
    if (!form.name.trim()) { setError('Agent name is required'); return; }
    setSaving(true);
    try {
      const contributionLens = generateContributionLens({ ...form, name: form.name });
      const specialistDirective = generateSpecialistDirective({ ...form, name: form.name });

      const agentMeta = {
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        contributionLens,
        specialistDirective,
        socketLabel: `${form.name.trim()} Agent`,
        activeStatus: 'working',
        activeLabel: 'Processing...',
        accentDim: ACCENT_DIM,
        accentGlow: ACCENT_GLOW,
        // Role-slot fields matching existing team agent schema
        features: [
          `${(form.personality || []).join(', ') || 'Specialist'} approach`,
          `Tone: ${(form.tone || []).join(', ') || 'Professional'}`,
          `Style: ${(form.communicationStyle || []).join(', ') || 'Balanced'}`,
        ],
      };

      if (editAgent) {
        await updateCustomAgent(editAgent.id, agentMeta);
      } else {
        await saveCustomAgent({ ...agentMeta, id: generateAgentId() });
      }

      setSaving(false);
      if (onSaved) onSaved();
    } catch (err) {
      setSaving(false);
      setError(err.message || 'Failed to save agent');
    }
  }, [form, editAgent, onSaved]);

  return (
    <View style={bs.panel}>
      {/* Header */}
      <View style={bs.header}>
        <View style={[bs.headerIconBox, { backgroundColor: `${accent}18`, borderColor: `${accent}44` }]}>
          {form.icon
            ? <Image source={ICON_OPTIONS.find(o => o.key === form.icon)?.src} style={bs.headerIconImage} resizeMode="cover" />
            : <AgentIcon color={accent} size={20} />
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={bs.headerTitle}>{editAgent ? 'Edit Agent' : 'Create Agent'}</Text>
          <Text style={bs.headerSub}>Metadata-only persona · no model changes</Text>
        </View>
        {onClose && (
          <TouchableOpacity style={bs.closeBtn} onPress={onClose} activeOpacity={0.75}>
            <CrossIcon color="#8A8A9D" />
          </TouchableOpacity>
        )}
      </View>

      {/* Name */}
      <Text style={bs.sectionLabel}>AGENT NAME</Text>
      <TextInput
        style={bs.textInput}
        placeholder="e.g. Deep Analyst"
        placeholderTextColor="#5A5A70"
        value={form.name}
        onChangeText={(v) => setField('name', v)}
        maxLength={40}
      />

      {/* Description */}
      <Text style={bs.sectionLabel}>DESCRIPTION</Text>
      <TextInput
        style={[bs.textInput, bs.multilineInput]}
        placeholder="What does this agent specialize in?"
        placeholderTextColor="#5A5A70"
        value={form.description}
        onChangeText={(v) => setField('description', v)}
        multiline
        textAlignVertical="top"
        maxLength={200}
      />

      {/* Icon picker */}
      <Text style={bs.sectionLabel}>ICON</Text>
      <View style={bs.iconGrid}>
        {ICON_OPTIONS.map(({ key, src }) => (
          <TouchableOpacity
            key={key}
            style={[bs.iconBtn, form.icon === key && { borderColor: `${accent}99`, backgroundColor: `${accent}18` }]}
            onPress={() => setField('icon', key)}
            activeOpacity={0.75}
          >
            <Image source={src} style={bs.iconImage} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Tone */}
      <Text style={bs.sectionLabel}>TONE <Text style={bs.multiHint}>(select any)</Text></Text>
      <ChipGroup
        options={TONE_OPTIONS}
        selected={form.tone}
        onToggle={(v) => toggleMulti('tone', v)}
        multi
        accent={accent}
      />

      {/* Communication Style */}
      <Text style={bs.sectionLabel}>COMMUNICATION STYLE <Text style={bs.multiHint}>(select any)</Text></Text>
      <ChipGroup
        options={STYLE_OPTIONS}
        selected={form.communicationStyle}
        onToggle={(v) => toggleMulti('communicationStyle', v)}
        multi
        accent={accent}
      />

      {/* Personality */}
      <Text style={bs.sectionLabel}>PERSONALITY <Text style={bs.multiHint}>(select any)</Text></Text>
      <ChipGroup
        options={PERSONALITY_OPTIONS}
        selected={form.personality}
        onToggle={(v) => toggleMulti('personality', v)}
        multi
        accent={accent}
      />

      {/* Strengths */}
      <Text style={bs.sectionLabel}>STRENGTHS (0–100)</Text>
      <View style={bs.sliderGroup}>
        <StrengthRow label="Reasoning"  value={form.reasoningStrength}  onChange={(v) => setField('reasoningStrength', v)}  accent={accent} />
        <StrengthRow label="Creativity" value={form.creativityStrength} onChange={(v) => setField('creativityStrength', v)} accent={accent} />
        <StrengthRow label="Analysis"   value={form.analyticalStrength} onChange={(v) => setField('analyticalStrength', v)} accent={accent} />
        <StrengthRow label="Coding"     value={form.codingStrength}     onChange={(v) => setField('codingStrength', v)}     accent={accent} />
        <StrengthRow label="Teaching"   value={form.teachingStrength}   onChange={(v) => setField('teachingStrength', v)}   accent={accent} />
      </View>

      {/* Directive preview */}
      <View style={[bs.previewBox, { borderColor: `${accent}30` }]}>
        <Text style={[bs.previewLabel, { color: accent }]}>DIRECTIVE PREVIEW</Text>
        <Text style={bs.previewText} numberOfLines={3}>
          {generateSpecialistDirective({ ...form, name: form.name || 'Agent' }).slice(0, 160) + '…'}
        </Text>
      </View>

      {/* Error */}
      {!!error && <Text style={bs.errorText}>{error}</Text>}

      {/* Save button */}
      <TouchableOpacity
        style={[bs.saveBtn, { backgroundColor: accent, opacity: saving ? 0.6 : 1 }]}
        onPress={handleSave}
        activeOpacity={0.82}
        disabled={saving}
      >
        <Text style={bs.saveBtnText}>{saving ? 'SAVING…' : (editAgent ? 'UPDATE AGENT' : 'SAVE AGENT')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const bs = StyleSheet.create({
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
    marginBottom: 14,
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
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
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E2E2E9',
    marginBottom: 8,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  multiHint: {
    fontSize: 9,
    fontWeight: '600',
    color: '#5A5A70',
    textTransform: 'none',
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
  multilineInput: { minHeight: 64, lineHeight: 17, textAlignVertical: 'top' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141420',
    borderWidth: 1,
    borderColor: '#242436',
  },
  iconImage: { width: 26, height: 26, borderRadius: 6 },
  headerIconImage: { width: 26, height: 26, borderRadius: 7 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 2 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#141420',
    borderWidth: 1,
    borderColor: '#242436',
  },
  chipText: { fontSize: 10, fontWeight: '700', color: '#8A8A9D' },
  sliderGroup: { gap: 12, marginBottom: 4 },
  sliderRow: { marginBottom: 2 },
  sliderLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  sliderLabel: { color: '#A8A8B8', fontSize: 10, fontWeight: '700' },
  sliderValue: { fontSize: 10, fontWeight: '900' },
  sliderTrack: {
    height: 4,
    backgroundColor: '#1E1E2C',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  sliderFill: { height: '100%', borderRadius: 2 },
  sliderBtnRow: { flexDirection: 'row', gap: 5 },
  sliderBtn: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#141420',
    borderWidth: 1,
    borderColor: '#242436',
  },
  sliderBtnText: { fontSize: 9, fontWeight: '800', color: '#6A6A7D' },
  previewBox: {
    backgroundColor: '#050508',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    marginBottom: 4,
  },
  previewLabel: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  previewText: { color: '#A8A8B8', fontSize: 10, lineHeight: 15 },
  errorText: { color: '#FCA5A5', fontSize: 10, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  saveBtn: {
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
});
