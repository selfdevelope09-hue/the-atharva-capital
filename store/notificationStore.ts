import { create } from 'zustand';

type Toast = { id: string; message: string; at: number };

export const useNotificationStore = create<{
  toasts: Toast[];
  push: (message: string) => void;
  dismiss: (id: string) => void;
}>((set) => ({
  toasts: [],
  push: (message) =>
    set((s) => ({
      toasts: [...s.toasts, { id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, message, at: Date.now() }].slice(-12),
    })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
