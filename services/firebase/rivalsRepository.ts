import { doc, getDoc, setDoc } from 'firebase/firestore';

import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';

export async function loadRivals(): Promise<string[]> {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) return [];
  const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
  if (!snap.exists()) return [];
  const r = snap.data()?.rivals;
  return Array.isArray(r) ? (r as string[]).filter((x) => typeof x === 'string') : [];
}

export async function setRivals(rivals: string[]): Promise<void> {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) return;
  await setDoc(doc(db, 'users', auth.currentUser.uid), { rivals }, { merge: true });
}

export async function toggleRival(targetUid: string): Promise<boolean> {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) return false;
  const cur = await loadRivals();
  const has = cur.includes(targetUid);
  const next = has ? cur.filter((x) => x !== targetUid) : [...cur, targetUid];
  await setRivals(next);
  return !has;
}
