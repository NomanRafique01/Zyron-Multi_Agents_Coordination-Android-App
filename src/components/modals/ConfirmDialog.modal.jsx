/**
 * @file ConfirmDialog.modal.jsx
 * @folder components/modals
 * @project Zyron AI Assistant — Powered by Multiple Agent Coordination
 *
 * Generic confirmation dialog.
 * `confirmDialog` is either null (hidden) or an object with:
 *   { title, message, confirmLabel, cancelLabel, onConfirm, onCancel, destructive? }
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import C from '../../config/colors.config';
import { scale, verticalScale, spacing, radius, fontScale } from '../../utils/responsive.utils';

/**
 * ConfirmDialog
 *
 * @param {{ title, message, confirmLabel, cancelLabel, onConfirm, onCancel, destructive? } | null} confirmDialog
 * @param {Function} onClose  — called when the dialog should be dismissed
 */
export default function ConfirmDialog({ confirmDialog = null, onClose }) {
  if (!confirmDialog) return null;

  const {
    title = 'Are you sure?',
    message = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    destructive = false,
  } = confirmDialog;

  const handleConfirm = () => {
    onConfirm?.();
    onClose?.();
  };

  const handleCancel = () => {
    onCancel?.();
    onClose?.();
  };

  return (
    <Modal
      visible={!!confirmDialog}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <View style={s.backdrop}>
        <View style={s.card}>

          {/* Title */}
          <Text style={s.title}>{title}</Text>

          {/* Message */}
          {!!message && <Text style={s.message}>{message}</Text>}

          {/* Buttons */}
          <View style={s.btnRow}>
            <TouchableOpacity style={s.btnCancel} onPress={handleCancel} activeOpacity={0.75}>
              <Text style={s.btnCancelText}>{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.btnConfirm, destructive && s.btnDestructive]}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <Text style={s.btnConfirmText}>{confirmLabel}</Text>
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
    paddingHorizontal: spacing(24),
  },

  card: {
    width: '100%',
    maxWidth: scale(360),
    backgroundColor: '#0F0F1A',
    borderRadius: radius(18),
    borderWidth: 1,
    borderColor: 'rgba(123, 47, 255, 0.25)',
    paddingVertical: verticalScale(28),
    paddingHorizontal: spacing(22),
  },

  title: {
    fontSize: fontScale(17),
    fontWeight: '700',
    color: C.textPrimary,
    textAlign: 'center',
    marginBottom: verticalScale(10),
  },

  message: {
    fontSize: fontScale(14),
    color: C.textDim,
    textAlign: 'center',
    lineHeight: fontScale(14) * 1.55,
    marginBottom: verticalScale(22),
  },

  btnRow: {
    flexDirection: 'row',
    gap: spacing(10),
    marginTop: verticalScale(4),
  },

  btnCancel: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius(12),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingVertical: verticalScale(13),
    alignItems: 'center',
  },

  btnCancelText: {
    fontSize: fontScale(14),
    fontWeight: '500',
    color: C.textDim,
  },

  btnConfirm: {
    flex: 1,
    backgroundColor: C.purple,
    borderRadius: radius(12),
    paddingVertical: verticalScale(13),
    alignItems: 'center',
  },

  btnDestructive: {
    backgroundColor: '#DC2626',
  },

  btnConfirmText: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
