import { StyleSheet } from 'react-native';
import C from '../../config/colors.config';

// ─── Bubble, layout, text, action and typing styles ──
export const bubbleStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 16,
    width: '100%',
    gap: 10,
  },
  containerUser: {
    flexDirection: 'row-reverse',
    marginBottom: 12,
  },
  containerAiFull: {
    width: '100%',
    marginBottom: 20,
    position: 'relative',
    zIndex: 10,
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
    position: 'relative',
    zIndex: 15,
  },
  avatarCol: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 3,
  },
  aiAvatarContainer: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#050508',
    borderWidth: 1,
    borderColor: 'rgba(123, 47, 255, 0.28)',
    overflow: 'hidden',
    shadowColor: C.purple,
    shadowOpacity: 0.26,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  aiAvatarImage: {
    width: 22,
    height: 22,
    alignSelf: 'center',
    marginTop: 1,
  },
  bubbleCol: {
    flex: 1,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  bubbleHeaderUser: {
    justifyContent: 'flex-end',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  userSenderName: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9C8BD2',
    letterSpacing: 0.35,
  },

  // ─── Mode Badge ───────────────────────────────────
  modeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  modeBadgeAgents: {
    borderColor: 'rgba(123, 47, 255, 0.35)',
    backgroundColor: 'rgba(123, 47, 255, 0.1)',
  },
  modeBadgeFast: {
    borderColor: 'rgba(123, 47, 255, 0.35)',
    backgroundColor: 'rgba(123, 47, 255, 0.1)',
  },
  modeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // ─── Three Dot Button & Dropdown Menu ─────────────
  threeDotBtn: {
    marginLeft: 'auto',
    padding: 6,
  },
  dropdownMenu: {
    position: 'absolute',
    right: 0,
    top: 30,
    backgroundColor: '#12121E',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: 8,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 99,
    minWidth: 154,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  dropdownText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E2E2E9',
  },

  // ─── Bubble Styles ────────────────────────────────
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
  },
  bubbleUser: {
    maxWidth: '84%',
    backgroundColor: '#24143E',
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.28)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: C.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
    alignSelf: 'flex-end',
  },
  // ─── Document attachment bubble (above user text bubble) ──────────────────
  docBubble: {
    width: 120,
    height: 80,
    alignSelf: 'flex-end',
    marginBottom: 6,
    backgroundColor: '#1C1032',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  docBubbleSpinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,10,36,0.55)',
    borderRadius: 14,
  },
  docBubbleSpinner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: 'transparent',
    borderTopColor: '#A78BFA',
    borderRightColor: 'rgba(167,139,250,0.35)',
  },
  docBubbleErrorDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#EF4444',
  },
  bubbleAiFull: {
    backgroundColor: C.bgBubbleAi,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
  bubbleBorderAgents: {
    borderColor: 'rgba(123, 47, 255, 0.2)',
  },
  bubbleBorderFast: {
    borderColor: 'rgba(123, 47, 255, 0.22)',
  },

  // ─── Text ─────────────────────────────────────────
  userText: {
    fontSize: 14,
    color: '#F7F3FF',
    lineHeight: 20,
    fontWeight: '500',
  },
  aiText: {
    fontSize: 15.5,
    color: '#E2E2E9',
    lineHeight: 23,
  },
  codeWrapper: {
    marginTop: 6,
  },
  panelContainer: {
    marginTop: 10,
    width: '100%',
  },
  timestamp: {
    fontSize: 8,
    marginTop: 5,
    alignSelf: 'flex-end',
  },
  timestampUser: {
    color: '#AFA2D8',
  },

  // ─── Fast Mode Typing ─────────────────────────────
  fastTypingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pulsingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  pulsingDotCyan: {
    backgroundColor: C.purpleSoft,
  },

  // ─── Markdown Text Styles ─────────────────────────
  mdTextContainer: {
    flexDirection: 'column',
    position: 'relative',
  },
  mdLine: {
    marginBottom: 4,
  },
  mdParagraph: {
    fontSize: 14.5,
    color: '#E2E2E9',
    lineHeight: 22,
  },
  mdBold: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mdItalic: {
    fontStyle: 'italic',
    color: '#D0D0E0',
  },
  mdInlineCode: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.purpleSoft,
    backgroundColor: 'rgba(167, 139, 250, 0.09)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  mdH1: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 6,
  },
  mdH2: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 10,
    marginBottom: 4,
  },
  mdH3: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#E2E2E9',
    marginTop: 8,
    marginBottom: 2,
  },
  mdH4: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#D2D2E0',
    marginTop: 6,
    marginBottom: 2,
  },
  mdH5: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C0C0D0',
    marginTop: 4,
    marginBottom: 2,
  },
  mdListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 8,
    marginVertical: 2,
  },
  mdBullet: {
    fontSize: 14,
    color: '#8A8A9D',
    marginRight: 6,
    lineHeight: 20,
  },
  mdNumberedBullet: {
    fontSize: 13,
    fontWeight: '600',
    color: C.purpleSoft,
    marginRight: 6,
    lineHeight: 20,
    minWidth: 18,
  },
  mdListText: {
    fontSize: 14.5,
    color: '#E2E2E9',
    lineHeight: 20,
    flex: 1,
  },
  mdLineSpacing: {
    height: 10,
  },

  // ─── Inside-bubble bottom row ─────────────────────
  bubbleBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1F1F2E',
    paddingTop: 8,
  },

  // ─── Outside-bubble action row ────────────────────
  outsideActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingLeft: 10,
  },
  outsideActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  // ─── Action pills ─────────────────────────────────
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A8AAD',
    letterSpacing: 0.1,
  },
  actionPillCopied: {
    borderColor: 'rgba(74,222,128,0.25)',
    backgroundColor: 'rgba(74,222,128,0.07)',
  },
  actionPillSpeaking: {
    borderColor: 'rgba(167,139,250,0.35)',
    backgroundColor: 'rgba(167,139,250,0.10)',
  },
  actionPillTextSpeaking: {
    color: '#A78BFA',
  },

  // ─── User bubble actions row ──────────────────────
  userBubbleActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 5,
    paddingRight: 4,
  },
  metricsTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  metricsTogglePillText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  timestampText: {
    fontSize: 9.5,
    color: '#6A6A80',
    fontWeight: '500',
  },
});
