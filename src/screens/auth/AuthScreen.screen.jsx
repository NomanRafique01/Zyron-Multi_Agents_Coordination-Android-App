/**
 * AuthScreen.screen.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Premium Sign In / Sign Up screen for Zyron.
 * • Email + password auth (Firebase)
 * • Google Sign-In
 * • GitHub Sign-In (OAuth via WebBrowser)
 * • Form validation with inline field errors
 * • Matches the Zyron dark UI language exactly
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';

// Required so the OAuth browser can close itself and return the auth code
// back to the app after the redirect. Must be called at module level.
WebBrowser.maybeCompleteAuthSession();

import s from '../../styles/auth.styles';
import {
  EyeIcon,
  EyeOffIcon,
  MailIcon,
  LockIcon,
  PersonIcon,
  AlertIcon,
  GoogleIcon,
  GitHubIcon,
} from '../../components/shared/Icons';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signInWithGitHub,
  sendPasswordReset,
} from '../../services/auth.service';

// ─── Validation ──────────────────────────────────────────────────────────────

function validateEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function validateSignUp({ firstName, lastName, email, password, confirm }) {
  const errors = {};
  if (!firstName.trim()) errors.firstName = 'First name is required';
  if (!lastName.trim()) errors.lastName = 'Last name is required';
  if (!email.trim()) errors.email = 'Email is required';
  else if (!validateEmail(email)) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Password is required';
  else if (password.length < 6) errors.password = 'At least 6 characters required';
  if (!confirm) errors.confirm = 'Please confirm your password';
  else if (password !== confirm) errors.confirm = 'Passwords do not match';
  return errors;
}

function validateSignIn({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = 'Email is required';
  else if (!validateEmail(email)) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Password is required';
  return errors;
}

function mapFirebaseError(code) {
  switch (code) {
    case 'auth/email-already-in-use':    return 'This email is already registered. Sign in instead.';
    case 'auth/invalid-email':           return 'Invalid email address.';
    case 'auth/user-not-found':          return 'No account found with this email.';
    case 'auth/wrong-password':          return 'Incorrect password. Please try again.';
    case 'auth/too-many-requests':       return 'Too many attempts. Please wait and try again.';
    case 'auth/network-request-failed':  return 'Network error. Check your connection.';
    case 'auth/invalid-credential':      return 'Incorrect email or password.';
    case 'auth/weak-password':           return 'Password must be at least 6 characters.';
    default:                             return 'Something went wrong. Please try again.';
  }
}

// ─── Shared input component ───────────────────────────────────────────────────

function AuthInput({ label, icon, value, onChangeText, placeholder, secureEntry, onToggleSecure, keyboardType, autoComplete, error, onFocus, onBlur, focused }) {
  return (
    <View>
      {label && <Text style={s.authInputLabel}>{label}</Text>}
      <View style={[s.authInputWrap, focused && s.authInputWrapFocused, error && s.authInputWrapError]}>
        {icon && <View style={s.authInputIcon}>{icon}</View>}
        <TextInput
          style={s.authInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#3A3A52"
          secureTextEntry={secureEntry}
          keyboardType={keyboardType || 'default'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {onToggleSecure && (
          <TouchableOpacity style={s.authInputEye} onPress={onToggleSecure} activeOpacity={0.7}>
            {secureEntry ? <EyeOffIcon color="#4A4A62" size={15} /> : <EyeIcon color="#4A4A62" size={15} />}
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={s.authFieldError}>{error}</Text>}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuthScreen({ onAuthenticated }) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');

  // UI state
  const [showPw, setShowPw]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null); // 'google' | 'github' | null
  const [errors, setErrors]         = useState({});
  const [globalError, setGlobalError] = useState('');
  const [focused, setFocused]       = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [verifyEmailSent, setVerifyEmailSent] = useState(false);

  const scrollRef = useRef(null);

  const clearAll = () => {
    setErrors({});
    setGlobalError('');
  };

  const switchMode = (next) => {
    clearAll();
    setMode(next);
    setPassword('');
    setConfirm('');
    setShowPw(false);
    setShowConfirm(false);
    setForgotSent(false);
    setVerifyEmailSent(false);
  };

  // ── Email submit ──────────────────────────────────────────────────────────
  const handleEmailSubmit = useCallback(async () => {
    clearAll();
    const errs = mode === 'signup'
      ? validateSignUp({ firstName, lastName, email, password, confirm })
      : validateSignIn({ email, password });

    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password });
        // Account created — verification email sent. Show confirmation instead of entering app.
        setVerifyEmailSent(true);
      } else {
        await signInWithEmail({ email: email.trim(), password });
        onAuthenticated?.();
      }
    } catch (err) {
      setGlobalError(mapFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  }, [mode, firstName, lastName, email, password, confirm, onAuthenticated]);

  // ── Google ────────────────────────────────────────────────────────────────
  const handleGoogle = useCallback(async () => {
    clearAll();
    setOauthLoading('google');
    try {
      await signInWithGoogle();
      onAuthenticated?.();
    } catch (err) {
      if (err.code !== 'SIGN_IN_CANCELLED') {
        setGlobalError(err.message || mapFirebaseError(err.code) || 'Google sign-in failed.');
      }
    } finally {
      setOauthLoading(null);
    }
  }, [onAuthenticated]);

  // ── GitHub ────────────────────────────────────────────────────────────────
  const handleGitHub = useCallback(async () => {
    clearAll();
    setOauthLoading('github');
    try {
      await signInWithGitHub();
      onAuthenticated?.();
    } catch (err) {
      if (err.code !== 'SIGN_IN_CANCELLED') {
        setGlobalError(mapFirebaseError(err.code) || err.message || 'GitHub sign-in failed.');
      }
    } finally {
      setOauthLoading(null);
    }
  }, [onAuthenticated]);

  // ── Forgot password ───────────────────────────────────────────────────────
  const handleForgot = useCallback(async () => {
    if (!validateEmail(email)) {
      setErrors({ email: 'Enter your email above first' });
      return;
    }
    try {
      await sendPasswordReset(email.trim());
      setForgotSent(true);
      setGlobalError('');
    } catch (err) {
      setGlobalError(mapFirebaseError(err.code));
    }
  }, [email]);

  const isSignUp = mode === 'signup';
  const busy = loading || !!oauthLoading;

  return (
    <View style={[s.authRoot, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#050508" />

      {/* Background gradient */}
      <LinearGradient
        colors={['#07070E', '#050508', '#050508']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={s.authScroll}
          contentContainerStyle={[s.authScrollContent, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo + App name */}
          <View style={s.authLogoBlock}>
            <View style={s.authLogoWrap}>
              <Image
                source={require('../../../assets/images/logo.png')}
                style={s.authLogoImg}
                resizeMode="cover"
              />
            </View>
            <Text style={s.authAppName}>Zyron</Text>
            <Text style={s.authTagLine}>Multi-agent AI intelligence</Text>
          </View>

          {/* Card */}
          <View style={s.authCard}>
            <Text style={s.authCardTitle}>{isSignUp ? 'Create your account' : 'Welcome back'}</Text>
            <Text style={s.authCardSub}>
              {isSignUp
                ? 'Sign up to save your chats and personalise your experience.'
                : 'Sign in to access your conversations and settings.'}
            </Text>

            {/* Global error */}
            {!!globalError && (
              <View style={s.authErrorBanner}>
                <AlertIcon size={14} color="#F87171" />
                <Text style={s.authErrorBannerText}>{globalError}</Text>
              </View>
            )}

            {/* Forgot password sent */}
            {forgotSent && (
              <View style={[s.authErrorBanner, { borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.07)' }]}>
                <Text style={[s.authErrorBannerText, { color: '#6EE7B7' }]}>
                  Reset link sent! Check your email inbox.
                </Text>
              </View>
            )}

            {/* Verification email sent after sign-up */}
            {verifyEmailSent && (
              <View style={[s.authErrorBanner, { borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.07)' }]}>
                <Text style={[s.authErrorBannerText, { color: '#6EE7B7' }]}>
                  Account created! A verification link has been sent to {email}. Please verify your email then sign in.
                </Text>
              </View>
            )}

            {/* Name row — sign up only */}
            {isSignUp && (
              <View style={s.authNameRow}>
                <View style={s.authNameField}>
                  <AuthInput
                    label="First Name"
                    icon={<PersonIcon color={focused === 'first' ? '#A78BFA' : '#3A3A52'} size={15} />}
                    value={firstName}
                    onChangeText={(v) => { setFirstName(v); setErrors(e => ({ ...e, firstName: '' })); }}
                    placeholder="First name"
                    autoComplete="given-name"
                    error={errors.firstName}
                    focused={focused === 'first'}
                    onFocus={() => setFocused('first')}
                    onBlur={() => setFocused('')}
                  />
                </View>
                <View style={s.authNameField}>
                  <AuthInput
                    label="Last Name"
                    icon={<PersonIcon color={focused === 'last' ? '#A78BFA' : '#3A3A52'} size={15} />}
                    value={lastName}
                    onChangeText={(v) => { setLastName(v); setErrors(e => ({ ...e, lastName: '' })); }}
                    placeholder="Last name"
                    autoComplete="family-name"
                    error={errors.lastName}
                    focused={focused === 'last'}
                    onFocus={() => setFocused('last')}
                    onBlur={() => setFocused('')}
                  />
                </View>
              </View>
            )}

            {/* Email */}
            <AuthInput
              label="Email"
              icon={<MailIcon color={focused === 'email' ? '#A78BFA' : '#3A3A52'} size={15} />}
              value={email}
              onChangeText={(v) => { setEmail(v); setErrors(e => ({ ...e, email: '' })); setForgotSent(false); }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              error={errors.email}
              focused={focused === 'email'}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused('')}
            />

            {/* Password */}
            <AuthInput
              label="Password"
              icon={<LockIcon color={focused === 'pw' ? '#A78BFA' : '#3A3A52'} size={15} />}
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors(e => ({ ...e, password: '' })); }}
              placeholder={isSignUp ? 'Min. 6 characters' : 'Your password'}
              secureEntry={!showPw}
              onToggleSecure={() => setShowPw(p => !p)}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              error={errors.password}
              focused={focused === 'pw'}
              onFocus={() => setFocused('pw')}
              onBlur={() => setFocused('')}
            />

            {/* Forgot password — sign in only */}
            {!isSignUp && (
              <TouchableOpacity style={s.authForgotRow} onPress={handleForgot} activeOpacity={0.7}>
                <Text style={s.authForgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {/* Confirm password — sign up only */}
            {isSignUp && (
              <AuthInput
                label="Confirm Password"
                icon={<LockIcon color={focused === 'confirm' ? '#A78BFA' : '#3A3A52'} size={15} />}
                value={confirm}
                onChangeText={(v) => { setConfirm(v); setErrors(e => ({ ...e, confirm: '' })); }}
                placeholder="Re-enter password"
                secureEntry={!showConfirm}
                onToggleSecure={() => setShowConfirm(p => !p)}
                autoComplete="new-password"
                error={errors.confirm}
                focused={focused === 'confirm'}
                onFocus={() => setFocused('confirm')}
                onBlur={() => setFocused('')}
              />
            )}

            {/* Primary CTA */}
            <TouchableOpacity
              style={[s.authPrimaryBtn, busy && s.authPrimaryBtnDisabled]}
              onPress={handleEmailSubmit}
              activeOpacity={0.85}
              disabled={busy}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={s.authPrimaryBtnText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
              }
            </TouchableOpacity>

            {/* Divider */}
            <View style={s.authDividerRow}>
              <View style={s.authDividerLine} />
              <Text style={s.authDividerText}>OR CONTINUE WITH</Text>
              <View style={s.authDividerLine} />
            </View>

            {/* OAuth buttons */}
            <View style={s.authOAuthRow}>
              <TouchableOpacity
                style={[s.authOAuthBtn, oauthLoading === 'google' && { opacity: 0.6 }]}
                onPress={handleGoogle}
                activeOpacity={0.8}
                disabled={busy}
              >
                {oauthLoading === 'google'
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : (
                    <>
                      <GoogleIcon size={17} />
                      <Text style={s.authOAuthBtnText}>Google</Text>
                    </>
                  )
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.authOAuthBtn, oauthLoading === 'github' && { opacity: 0.6 }]}
                onPress={handleGitHub}
                activeOpacity={0.8}
                disabled={busy}
              >
                {oauthLoading === 'github'
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : (
                    <>
                      <GitHubIcon size={17} color="#C0C0D4" />
                      <Text style={s.authOAuthBtnText}>GitHub</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>

            {/* Terms */}
            {isSignUp && (
              <Text style={s.authTerms}>
                By creating an account you agree to our{' '}
                <Text style={s.authTermsLink}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={s.authTermsLink}>Privacy Policy</Text>.
              </Text>
            )}
          </View>

          {/* Switch mode */}
          <View style={s.authSwitchRow}>
            <Text style={s.authSwitchText}>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            </Text>
            <TouchableOpacity onPress={() => switchMode(isSignUp ? 'signin' : 'signup')} activeOpacity={0.7}>
              <Text style={s.authSwitchLink}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
