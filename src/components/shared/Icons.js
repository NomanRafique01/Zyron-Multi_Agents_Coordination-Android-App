import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import C from '../../config/colors.config';

export function SendIcon({ isActive, color }) {
  const strokeColor = color ? color : (isActive ? '#FFFFFF' : '#4E4E61');
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 11L12 6L17 11M12 6V18"
        stroke={strokeColor}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function AttachIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
        stroke="#8A8A9D"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function StopIcon({ color = '#FFFFFF' }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6H18V18H6V6Z"
        fill={color}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BoltIcon({ color = C.cyan }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
        fill={color}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LayersIcon({ color = C.purpleSoft }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L2 7L12 12L22 7L12 2Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2 17L12 22L22 17"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2 12L12 17L22 12"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function InfoIcon({ color = '#8A8A9D' }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={2} />
      <Path d="M12 16v-4M12 8h.01" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function KeyIcon({ color = '#8A8A9D' }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="7.5" cy="14.5" r="3.5" stroke={color} strokeWidth={2} />
      <Path
        d="M10 12l8-8M15 7l2 2M13 9l2 2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ShieldIcon({ color = '#8A8A9D' }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l7 3v5c0 4.6-2.9 8.5-7 10-4.1-1.5-7-5.4-7-10V6l7-3z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 12l2 2 4-5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function UserIcon({ color = '#8A8A9D' }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={2} />
      <Path
        d="M4 21a8 8 0 0116 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function CopyIcon({ color = '#8A8A9D', size = 14 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 4v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2h-8a2 2 0 00-2 2z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4 8H2v12a2 2 0 002 2h12v-2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ThreeDotIcon({ color = '#8A8A9D' }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="5" r="2.2" fill={color} />
      <Circle cx="12" cy="12" r="2.2" fill={color} />
      <Circle cx="12" cy="19" r="2.2" fill={color} />
    </Svg>
  );
}

export function CrossIcon({ color = '#8A8A9D' }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6l12 12"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function EyeIcon({ color = '#8A8A9D' }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function EyeOffIcon({ color = '#8A8A9D' }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 3l18 18"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.6 10.6A3 3 0 0012 15a3 3 0 002.4-1.2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.9 4.2A10.8 10.8 0 0112 4c7 0 11 8 11 8a18.6 18.6 0 01-3.1 4.2M6.6 6.6C3 8.8 1 12 1 12s4 8 11 8a10.9 10.9 0 005.4-1.4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LockIcon({ color = '#8A8A9D' }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect
        x="5"
        y="10"
        width="14"
        height="11"
        rx="2"
        stroke={color}
        strokeWidth={2}
      />
      <Path
        d="M8 10V7a4 4 0 018 0v3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 15v2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SidebarIcon({ color = '#8A8A9D' }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 7h18"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M3 12h12"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M3 17h8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function PlusIcon({ color = '#8A8A9D' }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TrashIcon({ color = '#8A8A9D' }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function GearIcon({ color = '#8A8A9D' }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={2} />
      <Path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function RefreshIcon({ color = '#8A8A9D', size = 15 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 4v6h6M23 20v-6h-6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SpeakIcon({ color = '#6A6A82', size = 18, active = false }) {
  const iconColor = active ? '#A78BFA' : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 5L6 9H3a1 1 0 00-1 1v4a1 1 0 001 1h3l5 4V5z"
        fill={iconColor}
      />
      {active ? (
        <>
          <Path d="M14.5 9a4 4 0 010 6" stroke="#A78BFA" strokeWidth={2} strokeLinecap="round" />
          <Path d="M17.5 6.5a8 8 0 010 11" stroke="#A78BFA" strokeWidth={1.6} strokeLinecap="round" strokeOpacity={0.6} />
        </>
      ) : (
        <Path d="M14.5 9a4 4 0 010 6" stroke={iconColor} strokeWidth={1.8} strokeLinecap="round" strokeOpacity={0.5} />
      )}
    </Svg>
  );
}

export function MicIcon({ active = false, size = 18 }) {
  const color = active ? '#7B2FFF' : '#6B6B7A';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill={color} />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M12 19v4M8 23h8" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

