import { StyleSheet } from 'react-native';

import layoutStyles from './layout.styles';
import feedbackStyles from './feedback.styles';
import welcomeStyles from './welcome.styles';
import sidebarStyles from './sidebar.styles';
import settingsStyles from './settings.styles';
import profileStyles from './profile.styles';
import socketStyles from './socket.styles';
import authStyles from './auth.styles';

const appStyles = StyleSheet.create({
  ...layoutStyles,
  ...feedbackStyles,
  ...welcomeStyles,
  ...sidebarStyles,
  ...settingsStyles,
  ...profileStyles,
  ...socketStyles,
  ...authStyles,
});

export default appStyles;
