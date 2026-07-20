import React from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native';
import C from '../../config/colors.config';
import { SidebarIcon, GearIcon } from '../shared/Icons';

export default function Header({
  onToggleSidebar,
  onOpenSettings,
  isOffline = false,
  forceLocal = false,
  onToggleForceLocal,
}) {
  // Static glow line colour — purple normally, red when offline
  const glowLineColor = isOffline ? 'rgba(239, 68, 68, 0.75)' : 'rgba(123, 47, 255, 0.65)';
  const glowLineShadowColor = isOffline ? '#EF4444' : C.purple;

  return (
    <View style={s.headerShell}>
      <View style={s.headerBar}>
        <View style={s.headerLeft}>
          {/* Logo border — static purple, no animation */}
          <View style={s.appLogoContainer}>
            <Image
              source={require('../../../assets/images/logo.png')}
              style={s.appLogoImage}
              resizeMode="contain"
            />
          </View>
          <View style={s.headerTextBlock}>
            <Text style={s.appTitle}>Zyron</Text>
          </View>
        </View>

        {/* ── DEV: BE / LC toggle — remove when no longer needed ── */}
        <TouchableOpacity
          style={[s.devToggle, forceLocal ? s.devToggleLocal : s.devToggleBackend]}
          onPress={onToggleForceLocal}
          activeOpacity={0.75}
        >
          <Text style={[s.devToggleText, { color: forceLocal ? '#888899' : C.purpleSoft }]}>
            {forceLocal ? 'LC' : 'BE'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.gearBtn}
          onPress={onOpenSettings}
          activeOpacity={0.7}
        >
          <GearIcon color="#7B2FFF" />
        </TouchableOpacity>
      </View>

      {/* Static glow line beneath the header */}
      <View
        style={[
          s.glowLine,
          {
            backgroundColor: glowLineColor,
            shadowColor: glowLineShadowColor,
            pointerEvents: 'none',
          },
        ]}
      />

      <TouchableOpacity
        style={s.sidebarToggleBtn}
        onPress={onToggleSidebar}
        activeOpacity={0.7}
      >
        <SidebarIcon color="#E2E2E9" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  devToggle: {
    width: 34,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 6,
  },
  devToggleBackend: {
    backgroundColor: 'rgba(123, 47, 255, 0.12)',
    borderColor: 'rgba(123, 47, 255, 0.45)',
  },
  devToggleLocal: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  devToggleText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerShell: {
    backgroundColor: C.bgHeader,
    zIndex: 20,
    overflow: 'visible',
  },
  headerBar: {
    height: 68,
    backgroundColor: 'rgba(18, 18, 26, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(123, 47, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 8,
    paddingTop: 8,
    zIndex: 100,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appLogoContainer: {
    width: 44,
    height: 44,
    borderRadius: 13,
    overflow: 'visible',
    backgroundColor: '#050508',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(123, 47, 255, 1)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(123, 47, 255, 0.55)',
  },
  appLogoImage: {
    width: 38,
    height: 38,
    borderRadius: 11,
  },
  headerTextBlock: {
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  gearBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(123,47,255,0.45)',
  },
  sidebarToggleBtn: {
    position: 'absolute',
    left: 12,
    bottom: -42,
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(123,47,255,0.45)',
    borderRadius: 8,
    shadowColor: C.purple,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  glowLine: {
    height: 1.5,
    left: 0,
    right: 0,
    // backgroundColor and shadowColor are animated — set statically as fallback only
    backgroundColor: 'rgba(123, 47, 255, 0.65)',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    shadowOpacity: 1,
    elevation: 6,
    zIndex: 99,
  },
});
