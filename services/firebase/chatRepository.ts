/**
 * Chat / DM system — Firestore schema:
 *   conversations/{conversationId}
 *   conversations/{conversationId}/messages/{messageId}
 */

import {
  addDoc,
  arrayUnion,
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

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: Record<string, number>;
  otherUser?: { uid: string; name: string; photoURL: string };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  sentAt: string;
  read: boolean;
}

function requireDb() {
  if (!isFirebaseConfigured || !db) throw new Error('[chat] Firestore not configured');
  return db;
}

function requireUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('[chat] Not signed in');
  return uid;
}

/** Get or create a conversation between two users. Returns conversationId. */
export async function getOrCreateConversation(otherUid: string): Promise<string> {
  const myUid = requireUid();
  const db2 = requireDb();

  // Check if conversation already exists
  const q = query(
    collection(db2, 'conversations'),
    where('participants', 'array-contains', myUid)
  );
  const snap = await getDocs(q);
  const existing = snap.docs.find((d) => {
    const p = d.data()['participants'] as string[];
    return p.includes(otherUid);
  });
  if (existing) return existing.id;

  // Create new conversation
  const ref = await addDoc(collection(db2, 'conversations'), {
    participants: [myUid, otherUid],
    lastMessage: '',
    lastMessageAt: serverTimestamp(),
    unreadCount: { [myUid]: 0, [otherUid]: 0 },
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Resolve the other participant in a DM (requires sign-in). */
export async function getOtherParticipantUid(conversationId: string): Promise<string | null> {
  if (!isFirebaseConfigured || !db) return null;
  const myUid = auth?.currentUser?.uid;
  if (!myUid) return null;
  try {
    const snap = await getDoc(doc(db, 'conversations', conversationId));
    const parts = (snap.data()?.['participants'] as string[]) ?? [];
    return parts.find((p) => p !== myUid) ?? null;
  } catch (e) {
    console.warn('[chat] getOtherParticipantUid', e);
    return null;
  }
}

/** Subscribe to user's conversation list (real-time). */
export function subscribeConversations(
  uid: string,
  cb: (convs: Conversation[]) => void
): () => void {
  if (!isFirebaseConfigured || !db) { cb([]); return () => {}; }
  // No orderBy: avoids a Firestore composite index on participants + lastMessageAt.
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', uid),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => buildConversation(d.id, d.data() as Record<string, unknown>));
    list.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    cb(list.slice(0, 50));
  }, (err) => {
    console.warn('[chat] subscribeConversations', err);
    cb([]);
  });
}

/** Subscribe to messages inside a conversation. */
export function subscribeMessages(
  conversationId: string,
  cb: (msgs: ChatMessage[]) => void
): () => void {
  if (!isFirebaseConfigured || !db) { cb([]); return () => {}; }
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('sentAt', 'asc'),
    limit(200)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => buildMessage(d.id, d.data() as Record<string, unknown>)));
  }, (err) => {
    console.warn('[chat] subscribeMessages', err);
    cb([]);
  });
}

/** Send a message. */
export async function sendMessage(conversationId: string, text: string): Promise<void> {
  const myUid = requireUid();
  const db2 = requireDb();
  const trimmed = text.trim();
  if (!trimmed) return;

  // Get other participant
  const convSnap = await getDoc(doc(db2, 'conversations', conversationId));
  const participants = (convSnap.data()?.['participants'] as string[]) ?? [];
  const otherUid = participants.find((p) => p !== myUid) ?? '';

  const batch = writeBatch(db2);

  // Add message
  const msgRef = doc(collection(db2, 'conversations', conversationId, 'messages'));
  batch.set(msgRef, {
    senderId: myUid,
    text: trimmed,
    sentAt: serverTimestamp(),
    read: false,
  });

  // Update conversation
  batch.update(doc(db2, 'conversations', conversationId), {
    lastMessage: trimmed.slice(0, 100),
    lastMessageAt: serverTimestamp(),
    [`unreadCount.${otherUid}`]: increment(1),
  });

  await batch.commit();
}

/** Mark all messages in a conversation as read. */
export async function markConversationRead(conversationId: string): Promise<void> {
  const myUid = requireUid();
  const db2 = requireDb();
  try {
    // Reset unread count for this user
    await updateDoc(doc(db2, 'conversations', conversationId), {
      [`unreadCount.${myUid}`]: 0,
    });
  } catch (e) {
    console.warn('[chat] markRead error', e);
  }
}

/** Get total unread count across all conversations. */
export function subscribeTotalUnread(uid: string, cb: (count: number) => void): () => void {
  if (!isFirebaseConfigured || !db) { cb(0); return () => {}; }
  const q = query(collection(db, 'conversations'), where('participants', 'array-contains', uid));
  return onSnapshot(q, (snap) => {
    let total = 0;
    snap.docs.forEach((d) => {
      const uc = d.data()['unreadCount'] as Record<string, number> | undefined;
      total += uc?.[uid] ?? 0;
    });
    cb(total);
  }, () => cb(0));
}

// ── Helpers ────────────────────────────────────────────────────────────────

function tsStr(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (typeof v === 'string') return v;
  const ts = v as { toDate?: () => Date };
  return ts.toDate?.()?.toISOString() ?? new Date().toISOString();
}

function buildConversation(id: string, d: Record<string, unknown>): Conversation {
  return {
    id,
    participants: (d['participants'] as string[]) ?? [],
    lastMessage: (d['lastMessage'] as string) ?? '',
    lastMessageAt: tsStr(d['lastMessageAt']),
    unreadCount: (d['unreadCount'] as Record<string, number>) ?? {},
  };
}

function buildMessage(id: string, d: Record<string, unknown>): ChatMessage {
  return {
    id,
    senderId: (d['senderId'] as string) ?? '',
    text: (d['text'] as string) ?? '',
    sentAt: tsStr(d['sentAt']),
    read: Boolean(d['read']),
  };
}
