/**
 * Firestore + Firebase entrypoints — use for a single connection story across the app.
 *
 * Data layout (see repositories): `users/{uid}`, `conversations`, `leaderboard/...`,
 * per-user watchlists, alerts, ledger sync, balances, etc.
 */

export { auth, db, storage, analytics, firebaseApp, isFirebaseConfigured } from '@/config/firebaseConfig';
export { FS } from './paths';
export { ensureFirestoreConnected } from './ensureFirestore';
export { bootFirebaseAuthAndProfile } from './bootAuth';
