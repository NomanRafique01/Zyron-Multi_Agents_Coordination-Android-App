/**
 * auth.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Firebase Auth service — email/password, Google, GitHub sign-in.
 *
 * ⚠️  @react-native-firebase requires a CUSTOM DEV BUILD — it does NOT work
 *     in Expo Go. All Firebase imports are wrapped in try/catch so the app
 *     loads in Expo Go in "local mode" (no auth, no crash).
 *
 * To run with Firebase:
 *   expo run:android   (not expo start / Expo Go)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Lazy-load Firebase (not available in Expo Go) ───────────────────────────
let _auth = null;
let _firestore = null;

function getAuth() {
  if (!_auth) {
    try { _auth = require('@react-native-firebase/auth').default; } catch (_) {}
  }
  return _auth;
}

function getFirestore() {
  if (!_firestore) {
    try { _firestore = require('@react-native-firebase/firestore').default; } catch (_) {}
  }
  return _firestore;
}

export const FIREBASE_AVAILABLE = (() => {
  try { require('@react-native-firebase/app'); return true; } catch (_) { return false; }
})();

// ─── Google Sign-In config (placeholder — install package for custom build) ──
// To enable Google Sign-In:
//   1. npm install @react-native-google-signin/google-signin --legacy-peer-deps
//   2. Run expo run:android (not Expo Go)
export function configureGoogleSignIn(_webClientId = '') {}

// ─── Firestore helper ─────────────────────────────────────────────────────────
async function upsertUserDocument(user, extra = {}) {
  const fs = getFirestore();
  if (!fs) return;
  const ref = fs().collection('users').doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      uid: user.uid,
      email: user.email,
      firstName: extra.firstName || '',
      lastName: extra.lastName || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      provider: extra.provider || 'email',
      createdAt: fs.FieldValue.serverTimestamp(),
    });
  }
}

// ─── Email / Password ─────────────────────────────────────────────────────────
export async function signUpWithEmail({ firstName, lastName, email, password }) {
  const auth = getAuth();
  if (!auth) throw new Error('Firebase not available in Expo Go. Use a custom dev build.');
  const credential = await auth().createUserWithEmailAndPassword(email, password);
  const user = credential.user;
  await user.updateProfile({ displayName: `${firstName} ${lastName}`.trim() });
  await upsertUserDocument(user, { firstName, lastName, provider: 'email' });
  return user;
}

export async function signInWithEmail({ email, password }) {
  const auth = getAuth();
  if (!auth) throw new Error('Firebase not available in Expo Go. Use a custom dev build.');
  const credential = await auth().signInWithEmailAndPassword(email, password);
  return credential.user;
}

// ─── Google ───────────────────────────────────────────────────────────────────
export async function signInWithGoogle() {
  throw new Error('Google sign-in requires a custom dev build (expo run:android).');
}

// ─── GitHub ───────────────────────────────────────────────────────────────────
export async function signInWithGitHub(accessToken) {
  const auth = getAuth();
  if (!auth) throw new Error('Firebase not available in Expo Go. Use a custom dev build.');
  const githubCredential = auth.GithubAuthProvider.credential(accessToken);
  const credential = await auth().signInWithCredential(githubCredential);
  await upsertUserDocument(credential.user, { provider: 'github' });
  return credential.user;
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────
export async function signOut() {
  const auth = getAuth();
  if (!auth) return;
  await auth().signOut();
}

// ─── Auth state observer ──────────────────────────────────────────────────────
export function onAuthStateChanged(callback) {
  const auth = getAuth();
  if (!auth) {
    // In Expo Go: immediately call with null (not signed in) and return no-op
    callback(null);
    return () => {};
  }
  return auth().onAuthStateChanged(callback);
}

export function getCurrentUser() {
  const auth = getAuth();
  return auth ? auth().currentUser : null;
}

// ─── Firestore profile ────────────────────────────────────────────────────────
export async function getUserProfile(uid) {
  const fs = getFirestore();
  if (!fs) return null;
  const snap = await fs().collection('users').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

export async function updateUserProfile(uid, data) {
  const fs = getFirestore();
  if (!fs) return;
  await fs().collection('users').doc(uid).update(data);
}

// ─── Password reset ───────────────────────────────────────────────────────────
export async function sendPasswordReset(email) {
  const auth = getAuth();
  if (!auth) throw new Error('Firebase not available in Expo Go.');
  await auth().sendPasswordResetEmail(email);
}

// ─── Delete account ───────────────────────────────────────────────────────────
export async function deleteAccount() {
  const auth = getAuth();
  const fs = getFirestore();
  if (!auth) throw new Error('Firebase not available in Expo Go.');
  const user = auth().currentUser;
  if (!user) return;
  if (fs) await fs().collection('users').doc(user.uid).delete();
  await user.delete();
}
