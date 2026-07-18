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
  const color = '#7B2FFF';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill={color} />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M12 19v4M8 23h8" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function LiveIcon({ active = false, size = 18 }) {
  const color = '#7B2FFF';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Centre mic dot */}
      <Circle cx="12" cy="12" r="2.5" fill={color} />
      {/* Inner arc */}
      <Path
        d="M8.5 15.5a5 5 0 0 1 0-7M15.5 15.5a5 5 0 0 0 0-7"
        stroke={color}
        strokeWidth={active ? 2 : 1.8}
        strokeLinecap="round"
      />
      {/* Outer arc */}
      <Path
        d="M5.5 18.5a9 9 0 0 1 0-13M18.5 18.5a9 9 0 0 0 0-13"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeOpacity={active ? 0.65 : 0.45}
      />
    </Svg>
  );
}


export function GoogleIcon({ size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 01-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.5z" fill="#4285F4" />
      <Path d="M12 22c2.7 0 5-0.9 6.7-2.4l-3.3-2.6c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.7A10 10 0 0012 22z" fill="#34A853" />
      <Path d="M6.4 13.9A6 6 0 016.1 12c0-.7.1-1.3.3-1.9V7.4H3A10 10 0 002 12c0 1.6.4 3.1 1 4.6l3.4-2.7z" fill="#FBBC05" />
      <Path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 003 7.4l3.4 2.7C7.2 7.7 9.4 5.9 12 5.9z" fill="#EA4335" />
    </Svg>
  );
}

export function GitHubIcon({ size = 18, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"
        fill={color}
      />
    </Svg>
  );
}

export function LogOutIcon({ color = '#8A8A9D', size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 17l5-5-5-5M21 12H9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function MailIcon({ color = '#8A8A9D', size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 6l-10 7L2 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PersonIcon({ color = '#8A8A9D', size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function EditIcon({ color = '#8A8A9D', size = 16 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function AlertIcon({ color = '#EF4444', size = 16 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 9v4M12 17h.01" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function AgentIcon({ color = '#A78BFA', size = 32 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Head */}
      <Rect x="5" y="7" width="14" height="10" rx="3" stroke={color} strokeWidth={1.8} />
      {/* Eyes */}
      <Circle cx="9" cy="12" r="1.4" fill={color} />
      <Circle cx="15" cy="12" r="1.4" fill={color} />
      {/* Antenna */}
      <Path d="M12 7V4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx="12" cy="3.2" r="0.9" fill={color} />
      {/* Neck */}
      <Path d="M10 17v2M14 17v2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
