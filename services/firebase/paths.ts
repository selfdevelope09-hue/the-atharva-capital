/**
 * Firestore top-level collections / subcollection keys — keep in sync with Security Rules.
 * Used by: alerts, notifications, chat, leaderboard, watchlists, ledger, balances, profile.
 */
export const FS = {
  users: 'users',
  trades: 'trades',
  alerts: 'alerts',
  journal: 'journal',
  notifications: 'notifications',
  conversations: 'conversations',
  leaderboard: 'leaderboard',
} as const;
