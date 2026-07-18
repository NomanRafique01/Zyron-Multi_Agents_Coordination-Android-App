import { StyleSheet } from 'react-native';

const authStyles = StyleSheet.create({
  // ── Root & scroll ────────────────────────────────────────────────────────────
  authRoot: {
    flex: 1,
    backgroundColor: '#050508',
  },
  authScroll: {
    flex: 1,
  },
  authScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },

  // ── Logo block ───────────────────────────────────────────────────────────────
  authLogoBlock: {
    alignItems: 'center',
    marginBottom: 32,
  },
  authLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    backgroundColor: '#0D0D1A',
  },
  authLogoImg: {
    width: 64,
    height: 64,
  },
  authAppName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#E8E8F0',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  authTagLine: {
    fontSize: 13,
    color: '#57576A',
    letterSpacing: 0.2,
  },

  // ── Card ─────────────────────────────────────────────────────────────────────
  authCard: {
    backgroundColor: '#0D0D1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 20,
    gap: 14,
    marginBottom: 16,
  },
  authCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E8E8F0',
    marginBottom: 2,
  },
  authCardSub: {
    fontSize: 13,
    color: '#57576A',
    lineHeight: 18,
  },

  // ── Error banner ─────────────────────────────────────────────────────────────
  authErrorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(248,113,113,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  authErrorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#F87171',
    lineHeight: 18,
  },

  // ── Name row ─────────────────────────────────────────────────────────────────
  authNameRow: {
    flexDirection: 'row',
    gap: 10,
  },
  authNameField: {
    flex: 1,
  },

  // ── Input ────────────────────────────────────────────────────────────────────
  authInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8A9D',
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  authInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12121F',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 12,
    height: 46,
  },
  authInputWrapFocused: {
    borderColor: 'rgba(167,139,250,0.5)',
    backgroundColor: '#14142A',
  },
  authInputWrapError: {
    borderColor: 'rgba(248,113,113,0.5)',
  },
  authInputIcon: {
    marginRight: 8,
  },
  authInput: {
    flex: 1,
    fontSize: 14,
    color: '#E8E8F0',
    paddingVertical: 0,
  },
  authInputEye: {
    paddingLeft: 8,
    paddingVertical: 4,
  },
  authFieldError: {
    fontSize: 12,
    color: '#F87171',
    marginTop: 4,
  },

  // ── Forgot password ───────────────────────────────────────────────────────────
  authForgotRow: {
    alignSelf: 'flex-end',
    marginTop: -6,
  },
  authForgotText: {
    fontSize: 12,
    color: '#A78BFA',
    fontWeight: '500',
  },

  // ── Primary button ────────────────────────────────────────────────────────────
  authPrimaryBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#6D28D9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  authPrimaryBtnDisabled: {
    opacity: 0.55,
  },
  authPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // ── Divider ───────────────────────────────────────────────────────────────────
  authDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  authDividerText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3A3A52',
    letterSpacing: 1,
  },

  // ── OAuth buttons ─────────────────────────────────────────────────────────────
  authOAuthRow: {
    flexDirection: 'row',
    gap: 10,
  },
  authOAuthBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    backgroundColor: '#12121F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  authOAuthBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C0C0D4',
  },

  // ── Terms ─────────────────────────────────────────────────────────────────────
  authTerms: {
    fontSize: 11,
    color: '#57576A',
    textAlign: 'center',
    lineHeight: 16,
  },
  authTermsLink: {
    color: '#A78BFA',
    fontWeight: '500',
  },

  // ── Switch mode row ───────────────────────────────────────────────────────────
  authSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  authSwitchText: {
    fontSize: 13,
    color: '#57576A',
  },
  authSwitchLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A78BFA',
  },
});

export default authStyles;
