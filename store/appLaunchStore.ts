import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type LaunchState = {
  launchCount: number;
  incrementLaunch: () => number;
};

export const useAppLaunchStore = create<LaunchState>()(
  persist(
    (set, get) => ({
      launchCount: 0,
      incrementLaunch: () => {
        const n = get().launchCount + 1;
        set({ launchCount: n });
        return n;
      },
    }),
    { name: 'atc-app-launches-v1', storage: createJSONStorage(() => AsyncStorage) }
  )
);
