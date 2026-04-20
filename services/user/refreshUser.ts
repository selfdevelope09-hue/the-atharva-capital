import { useProfileStore } from '@/store/profileStore';

/**
 * Reload Firestore profile + global earnings after trades, balance changes, etc.
 * Safe to fire-and-forget: `void refreshUser()`.
 */
export async function refreshUser(): Promise<void> {
  await useProfileStore.getState().refreshUser();
}
