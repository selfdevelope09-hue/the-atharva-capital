import type { AuthCredential, ConfirmationResult, User } from 'firebase/auth';
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPhoneNumber,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPhoneNumber,
  type ApplicationVerifier,
} from 'firebase/auth';

import { auth, isFirebaseConfigured } from '@/config/firebaseConfig';

function requireAuth() {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('[auth] Firebase Auth is not configured.');
  }
  return auth;
}

/** Finalize Google OAuth `id_token` with Firebase (links if currently anonymous). */
export async function finalizeGoogleSignIn(idToken: string): Promise<User> {
  const cred = GoogleAuthProvider.credential(idToken);
  return finalizeCredential(cred);
}

/** Finalize Facebook Login `access_token` with Firebase. */
export async function finalizeFacebookSignIn(accessToken: string): Promise<User> {
  const cred = FacebookAuthProvider.credential(accessToken);
  return finalizeCredential(cred);
}

export async function finalizeCredential(credential: AuthCredential): Promise<User> {
  const a = requireAuth();
  const current = a.currentUser;
  if (current?.isAnonymous) {
    const linked = await linkWithCredential(current, credential);
    return linked.user;
  }
  const result = await signInWithCredential(a, credential);
  return result.user;
}

export function subscribeAuth(callback: (user: User | null) => void): () => void {
  if (!isFirebaseConfigured || !auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

let pendingPhone: ConfirmationResult | null = null;

/**
 * Sends SMS OTP. When the user is anonymous, uses `linkWithPhoneNumber` so the Firebase UID stays stable.
 * Caller must supply a valid `ApplicationVerifier` (e.g. web `RecaptchaVerifier`).
 */
export async function sendPhoneOtp(e164Phone: string, verifier: ApplicationVerifier): Promise<void> {
  const a = requireAuth();
  const cur = a.currentUser;
  if (cur?.isAnonymous) {
    pendingPhone = await linkWithPhoneNumber(cur, e164Phone, verifier);
  } else {
    pendingPhone = await signInWithPhoneNumber(a, e164Phone, verifier);
  }
}

export async function confirmPhoneOtp(smsCode: string): Promise<User> {
  if (!pendingPhone) {
    throw new Error('[auth] No pending phone confirmation — send OTP first.');
  }
  const cred = await pendingPhone.confirm(smsCode);
  pendingPhone = null;
  return cred.user;
}

export function clearPendingPhone() {
  pendingPhone = null;
}
