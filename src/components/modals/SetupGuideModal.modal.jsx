/**
 * @file SetupGuideModal.modal.jsx
 * @folder components/modals
 * @project Zyron AI Assistant — Powered by Multiple Agent Coordination
 *
 * First-launch poster shown when the user tries to chat without an active team.
 * Guides them through the three setup steps, then lets them dismiss or open Settings.
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import WelcomeLogo from '../shared/WelcomeLogo.component.jsx';
import C from '../../config/colors.config';
import { scale, verticalScale, spacing, radius, fontScale } from '../../utils/responsive.utils';

const { width: SW } = Dimensions.get('window');

const STEPS = [
  { n: '1', label: 'Open Settings' },
  { n: '2', label: 'Select a team from Agent Library' },
  { n: '3', label: 'Open API Config — add keys to 4 agents or share among 2' },
  { n: '4', label: 'Activate agents, then Start Chat' },
];

/**
 * SetupGuideModal
 *
 * @param {boolean}  visible         — controls Modal visibility
 * @param {Function} onClose         — called when user taps "Cancel"
 * @param {Function} onOpenSettings  — called when user taps "Start Chat" / "Set Up Agents"
 */
export default function SetupGuideModal({ visible = false, onClose, onOpenSettings }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Blur-like dim backdrop */}
      <View style={s.backdrop}>
        <View style={s.card}>

          {/* ── Logo ── */}
          <WelcomeLogo size={scale(52)} />

          {/* ── Title ── */}
          <Text style={s.title}>Zyron Setup Guide</Text>

          {/* ── Subtitle ── */}
          <Text style={s.subtitle}>
            Follow the steps below to configure your agents and begin chatting.
          </Text>

          {/* ── Steps ── */}
          <View style={s.stepsWrap}>
            {STEPS.map((step) => (
              <View key={step.n} style={s.stepRow}>
                <View style={s.stepBadge}>
                  <Text style={s.stepNum}>{step.n}</Text>
                </View>
                <Text style={s.stepLabel}>{step.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Buttons row ── */}
          <View style={s.btnRow}>
            <TouchableOpacity style={s.btnSecondary} onPress={onClose} activeOpacity={0.7}>
              <Text style={s.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnPrimary} onPress={onOpenSettings} activeOpacity={0.85}>
              <Text style={s.btnPrimaryText}>Select Team</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 10, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing(20),
  },

  card: {
    width: '100%',
    maxWidth: scale(360),
    backgroundColor: '#0F0F1A',
    borderRadius: radius(18),
    borderWidth: 1,
    borderColor: 'rgba(123, 47, 255, 0.28)',
    paddingVertical: verticalScale(22),
    paddingHorizontal: spacing(20),
    alignItems: 'center',
  },

  // ── Typography ──────────────────────────────────────────────────────────────
  title: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: C.textPrimary,
    textAlign: 'center',
    marginBottom: verticalScale(6),
  },

  subtitle: {
    fontSize: fontScale(12),
    color: C.textDim,
    textAlign: 'center',
    lineHeight: fontScale(12) * 1.55,
    marginBottom: verticalScale(14),
  },

  // ── Steps ───────────────────────────────────────────────────────────────────
  stepsWrap: {
    width: '100%',
    gap: verticalScale(7),
    marginBottom: verticalScale(16),
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(10),
  },

  stepBadge: {
    width: scale(24),
    height: scale(24),
    borderRadius: radius(7),
    backgroundColor: 'rgba(123, 47, 255, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(123, 47, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  stepNum: {
    fontSize: fontScale(11),
    fontWeight: '700',
    color: C.purpleSoft,
  },

  stepLabel: {
    fontSize: fontScale(13),
    fontWeight: '500',
    color: C.textPrimary,
    flexShrink: 1,
  },

  // ── Buttons ─────────────────────────────────────────────────────────────────
  btnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: spacing(8),
  },

  btnPrimary: {
    flex: 1,
    backgroundColor: C.purple,
    borderRadius: radius(10),
    paddingVertical: verticalScale(9),
    alignItems: 'center',
  },

  btnPrimaryText: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.15,
  },

  btnSecondary: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius(10),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingVertical: verticalScale(9),
    alignItems: 'center',
  },

  btnSecondaryText: {
    fontSize: fontScale(13),
    fontWeight: '500',
    color: C.textDim,
  },
});
