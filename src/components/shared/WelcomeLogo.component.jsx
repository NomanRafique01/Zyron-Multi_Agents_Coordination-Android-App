/**
 * WelcomeLogo.component.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Zyron logo on the welcome / empty-chat screen.
 * Border/glow is fully static — no animation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { View, Image } from 'react-native';
import { scale, spacing, radius } from '../../utils/responsive.utils';

/**
 * WelcomeLogo
 *
 * @param {boolean} [isOffline=false] — When true, renders the offline (red)
 *                                      border/glow instead of the default purple.
 */
export default function WelcomeLogo({ isOffline = false }) {
  const logoSize = scale(80);

  const borderColor = isOffline ? 'rgba(239, 68, 68, 0.55)' : 'rgba(123, 47, 255, 0.55)';
  const bgColor = isOffline ? 'rgba(239, 68, 68, 0.07)' : 'rgba(123, 47, 255, 0.07)';

  return (
    <View style={{ alignItems: 'center', marginBottom: spacing(18) }}>
      <View
        style={{
          borderRadius: radius(20),
          padding: 3,
          borderWidth: 1.5,
          borderColor,
          backgroundColor: bgColor,
        }}
      >
        <Image
          source={require('../../../assets/images/logo.png')}
          style={{
            width: logoSize,
            height: logoSize,
            borderRadius: radius(18),
            backgroundColor: '#050508',
          }}
          resizeMode="cover"
        />
      </View>
    </View>
  );
}
