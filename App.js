import React, { useState, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ExpoSplashScreen from 'expo-splash-screen';
import SplashScreen from './src/screens/splash/SplashScreen.screen.jsx';
import MainApp from './src/screens/chat/MainApp.screen.jsx';

// Hold the native splash until our custom one is painted.
ExpoSplashScreen.preventAutoHideAsync();

// Check if Firebase native modules are available (they are NOT in Expo Go).
let FIREBASE_AVAILABLE = false;
try {
  require('@react-native-firebase/app');
  FIREBASE_AVAILABLE = true;
} catch (_) {}

export default function App() {
  const [isLoading, setIsLoading]     = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Dismiss native splash on first render.
  useEffect(() => {
    ExpoSplashScreen.hideAsync();
  }, []);

  // Listen to Firebase auth state only if Firebase is available.
  useEffect(() => {
    if (!FIREBASE_AVAILABLE) {
      // Expo Go — skip auth entirely, go straight to main app.
      setAuthChecked(true);
      return;
    }

    // Custom dev build — real Firebase auth listener.
    const { onAuthStateChanged } = require('./src/services/auth.service');
    const unsubscribe = onAuthStateChanged((user) => {
      setCurrentUser(user);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, []);

  // Show splash while Firebase resolves auth state.
  if (!authChecked) {
    return (
      <SafeAreaProvider>
        <SplashScreen onFinish={() => {}} />
      </SafeAreaProvider>
    );
  }

  // Expo Go path — no auth, straight to app.
  if (!FIREBASE_AVAILABLE) {
    return (
      <SafeAreaProvider>
        <MainApp
          splashVisible={isLoading}
          currentUser={null}
          onSignedOut={() => {}}
        />
        {isLoading && (
          <SplashScreen onFinish={() => setIsLoading(false)} />
        )}
      </SafeAreaProvider>
    );
  }

  // Custom dev build — full auth flow.
  const AuthScreen = require('./src/screens/auth/AuthScreen.screen.jsx').default;

  return (
    <SafeAreaProvider>
      {currentUser ? (
        <>
          <MainApp
            splashVisible={isLoading}
            currentUser={currentUser}
            onSignedOut={() => setCurrentUser(null)}
          />
          {isLoading && (
            <SplashScreen onFinish={() => setIsLoading(false)} />
          )}
        </>
      ) : (
        <AuthScreen onAuthenticated={() => {
          // onAuthStateChanged fires automatically and updates currentUser
        }} />
      )}
    </SafeAreaProvider>
  );
}
