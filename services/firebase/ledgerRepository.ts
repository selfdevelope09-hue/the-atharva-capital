/**
 * Persist Phase 4 ledger arrays on `users/{uid}` (merge) — balances still use `userBalancesRepository`.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';

import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';
import type { EquityPoint, JournalEntry, LedgerClosedTrade, LedgerOpenPosition } from '@/types/ledger';

export type LedgerCloudPayload = {
  openPositions: LedgerOpenPosition[];
  closedTrades: LedgerClosedTrade[];
  journalByTradeId: Record<string, JournalEntry>;
  equityCurve: EquityPoint[];
};

export async function persistLedgerToCloud(payload: LedgerCloudPayload): Promise<void> {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) return;
  const uid = auth.currentUser.uid;
  await setDoc(
    doc(db, 'users', uid),
    {
      ledgerOpenPositions: payload.openPositions,
      ledgerClosedTrades: payload.closedTrades,
      ledgerJournal: payload.journalByTradeId,
      ledgerEquityCurve: payload.equityCurve,
    },
    { merge: true }
  );
}

export async function loadLedgerFromCloud(): Promise<Partial<LedgerCloudPayload> | null> {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) return null;
  const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  const openPositions = d.ledgerOpenPositions as LedgerOpenPosition[] | undefined;
  const closedTrades = d.ledgerClosedTrades as LedgerClosedTrade[] | undefined;
  const journalByTradeId = d.ledgerJournal as Record<string, JournalEntry> | undefined;
  const equityCurve = d.ledgerEquityCurve as EquityPoint[] | undefined;
  return {
    openPositions: Array.isArray(openPositions) ? openPositions : undefined,
    closedTrades: Array.isArray(closedTrades) ? closedTrades : undefined,
    journalByTradeId: journalByTradeId && typeof journalByTradeId === 'object' ? journalByTradeId : undefined,
    equityCurve: Array.isArray(equityCurve) ? equityCurve : undefined,
  };
}
