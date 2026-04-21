/**
 * User profile CRUD — Firestore collection: users/{uid}
 * Extended schema beyond the minimal auth document.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';

export interface UserProfile {
  uid: string;
  displayName: string;
  gmailName: string;
  photoURL: string;
  bio: string;
  joinedAt: string;
  followers: number;
  following: number;
  totalTrades: number;
  winRate: number;
  pnl: {
    crypto: number;
    forex: number;
    stocks: number;
    commodities: number;
  };
}

function requireDb() {
  if (!isFirebaseConfigured || !db) throw new Error('[userProfile] Firestore not configured');
  return db;
}

function requireUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('[userProfile] Not signed in');
  return uid;
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(requireDb(), 'users', uid));
    if (!snap.exists()) return null;
    const d = snap.data() as Record<string, unknown>;
    return buildProfile(uid, d);
  } catch (e) {
    console.warn('[userProfile] getProfile error', e);
    return null;
  }
}

export function subscribeProfile(uid: string, cb: (p: UserProfile | null) => void): () => void {
  if (!isFirebaseConfigured || !db) { cb(null); return () => {}; }
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    if (!snap.exists()) { cb(null); return; }
    cb(buildProfile(uid, snap.data() as Record<string, unknown>));
  }, () => cb(null));
}

export async function updateProfile(fields: Partial<Pick<UserProfile, 'displayName' | 'bio' | 'photoURL'>>): Promise<void> {
  const uid = requireUid();
  await setDoc(doc(requireDb(), 'users', uid), {
    ...fields,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function ensureExtendedProfile(uid: string, gmailName: string, photoURL: string): Promise<void> {
  try {
    const ref = doc(requireDb(), 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists() || !snap.data()?.gmailName) {
      await setDoc(ref, {
        gmailName,
        displayName: snap.data()?.displayName ?? gmailName,
        photoURL: snap.data()?.photoURL ?? photoURL,
        bio: snap.data()?.bio ?? '',
        followers: snap.data()?.followers ?? 0,
        following: snap.data()?.following ?? 0,
        totalTrades: snap.data()?.totalTrades ?? 0,
        winRate: snap.data()?.winRate ?? 0,
        pnl: snap.data()?.pnl ?? { crypto: 0, forex: 0, stocks: 0, commodities: 0 },
      }, { merge: true });
    }
  } catch (e) {
    console.warn('[userProfile] ensureExtendedProfile error', e);
  }
}

// ── Follow system ─────────────────────────────────────────────────────────────

export async function followUser(targetUid: string): Promise<void> {
  const myUid = requireUid();
  const db2 = requireDb();
  const batch = writeBatch(db2);
  batch.set(doc(db2, 'users', myUid, 'following', targetUid), { followedAt: serverTimestamp() });
  batch.set(doc(db2, 'users', targetUid, 'followers', myUid), { followedAt: serverTimestamp() });
  batch.update(doc(db2, 'users', myUid), { following: increment(1) });
  batch.update(doc(db2, 'users', targetUid), { followers: increment(1) });
  await batch.commit();
}

export async function unfollowUser(targetUid: string): Promise<void> {
  const myUid = requireUid();
  const db2 = requireDb();
  const batch = writeBatch(db2);
  batch.delete(doc(db2, 'users', myUid, 'following', targetUid));
  batch.delete(doc(db2, 'users', targetUid, 'followers', myUid));
  batch.update(doc(db2, 'users', myUid), { following: increment(-1) });
  batch.update(doc(db2, 'users', targetUid), { followers: increment(-1) });
  await batch.commit();
}

export async function isFollowing(targetUid: string): Promise<boolean> {
  try {
    const myUid = requireUid();
    const snap = await getDoc(doc(requireDb(), 'users', myUid, 'following', targetUid));
    return snap.exists();
  } catch { return false; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildProfile(uid: string, d: Record<string, unknown>): UserProfile {
  const pnl = (d['pnl'] as Record<string, number>) ?? {};
  return {
    uid,
    displayName: (d['displayName'] as string) || (d['name'] as string) || (d['gmailName'] as string) || 'Trader',
    gmailName: (d['gmailName'] as string) || (d['name'] as string) || '',
    photoURL: (d['photoURL'] as string) || '',
    bio: (d['bio'] as string) || '',
    joinedAt: (d['createdAt'] as { toDate?: () => Date } | string)?.['toDate']?.()?.toISOString?.() ?? (d['createdAt'] as string) ?? new Date().toISOString(),
    followers: (d['followers'] as number) || 0,
    following: (d['following'] as number) || 0,
    totalTrades: (d['totalTrades'] as number) || 0,
    winRate: (d['winRate'] as number) || 0,
    pnl: {
      crypto: pnl['crypto'] ?? 0,
      forex: pnl['forex'] ?? 0,
      stocks: pnl['stocks'] ?? 0,
      commodities: pnl['commodities'] ?? 0,
    },
  };
}
