import type { Firestore } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { db, isFirebaseConfigured } from '@/config/firebaseConfig';
import { ensureFirestoreConnected } from '@/services/firebase/ensureFirestore';

type FirestoreContextValue = {
  db: Firestore | null;
  /** True after first successful network enable (or immediately if Firestore unavailable). */
  ready: boolean;
};

const FirestoreContext = createContext<FirestoreContextValue>({
  db: isFirebaseConfigured ? db : null,
  ready: !isFirebaseConfigured,
});

/**
 * Mount once near the app root so Firestore is online before repositories hydrate.
 */
export function FirestoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureFirestoreConnected();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<FirestoreContextValue>(
    () => ({
      db: isFirebaseConfigured ? db : null,
      ready: !isFirebaseConfigured ? true : ready,
    }),
    [ready]
  );

  return <FirestoreContext.Provider value={value}>{children}</FirestoreContext.Provider>;
}

export function useFirestore(): FirestoreContextValue {
  return useContext(FirestoreContext);
}
