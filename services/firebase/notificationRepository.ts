/**
 * Notifications — Firestore: notifications/{uid}/{notifId}
 */

import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';

export type NotifType = 'follow' | 'message' | 'trade_closed';

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  fromUid?: string;
  fromName?: string;
  fromPhotoURL?: string;
  meta?: Record<string, unknown>;
}

function requireDb() {
  if (!isFirebaseConfigured || !db) throw new Error('[notif] Firestore not configured');
  return db;
}

export function subscribeNotifications(
  uid: string,
  cb: (notifs: AppNotification[]) => void
): () => void {
  if (!isFirebaseConfigured || !db) { cb([]); return () => {}; }
  const q = query(
    collection(db, 'notifications', uid, 'items'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => buildNotif(d.id, d.data() as Record<string, unknown>)));
  }, () => cb([]));
}

export async function markAllRead(uid: string): Promise<void> {
  try {
    const db2 = requireDb();
    const q = query(collection(db2, 'notifications', uid, 'items'), where('read', '==', false));
    const snap = await getDocs(q);
    const batch = writeBatch(db2);
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  } catch (e) {
    console.warn('[notif] markAllRead error', e);
  }
}

export async function pushNotification(
  toUid: string,
  notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'>
): Promise<void> {
  try {
    await addDoc(collection(requireDb(), 'notifications', toUid, 'items'), {
      ...notif,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[notif] push error', e);
  }
}

function buildNotif(id: string, d: Record<string, unknown>): AppNotification {
  return {
    id,
    type: (d['type'] as NotifType) || 'trade_closed',
    title: (d['title'] as string) || '',
    body: (d['body'] as string) || '',
    read: Boolean(d['read']),
    createdAt: (d['createdAt'] as { toDate?: () => Date } | string)?.['toDate']?.()?.toISOString?.() ?? new Date().toISOString(),
    fromUid: d['fromUid'] as string | undefined,
    fromName: d['fromName'] as string | undefined,
    fromPhotoURL: d['fromPhotoURL'] as string | undefined,
    meta: d['meta'] as Record<string, unknown> | undefined,
  };
}
