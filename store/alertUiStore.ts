import { create } from 'zustand';

/** Active price alerts count (for navbar bell badge). */
export const useAlertUiStore = create<{ activeCount: number; setActiveCount: (n: number) => void }>((set) => ({
  activeCount: 0,
  setActiveCount: (n) => set({ activeCount: Math.max(0, n) }),
}));
