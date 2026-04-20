import type { ReactNode } from 'react';
import { memo } from 'react';
import { Text, View } from 'react-native';

import { NativeAdSlot } from '@/components/NativeAdCard';
import type { ThemePalette } from '@/store/themeStore';
import { useThemeStore } from '@/store/themeStore';

export type LeaderboardUser = {
  id: string;
  handle: string;
  pnlPct: number;
  flag: string;
};

const MOCK_LEADERS: LeaderboardUser[] = [
  { id: '1', handle: 'PaperTiger_99', pnlPct: 42.1, flag: '🇮🇳' },
  { id: '2', handle: 'GammaGlider', pnlPct: 31.8, flag: '🇺🇸' },
  { id: '3', handle: 'LSE_Latte', pnlPct: 28.4, flag: '🇬🇧' },
  { id: '4', handle: 'TOPIX_Turtle', pnlPct: 24.9, flag: '🇯🇵' },
  { id: '5', handle: 'RedRise_CN', pnlPct: 22.3, flag: '🇨🇳' },
  { id: '6', handle: 'SatoshiSim', pnlPct: 19.7, flag: '🪙' },
  { id: '7', handle: 'NiftyKnight', pnlPct: 17.2, flag: '🇮🇳' },
  { id: '8', handle: 'FTSE_Fox', pnlPct: 14.0, flag: '🇬🇧' },
  { id: '9', handle: 'VolVault', pnlPct: 11.5, flag: '🇺🇸' },
];

type UserRowProps = { user: LeaderboardUser; rank: number; palette: ThemePalette };

const UserRow = memo(function UserRow({ user, rank, palette }: UserRowProps) {
  return (
    <View
      className="flex-row items-center justify-between border-b px-1 py-1.5"
      style={{ borderBottomColor: palette.border }}>
      <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
        <Text
          className="w-5 text-center font-mono text-[10px] font-black tabular-nums"
          style={{ color: palette.textMuted }}>
          {rank}
        </Text>
        <Text className="text-sm">{user.flag}</Text>
        <Text className="min-w-0 flex-1 font-sans text-xs font-bold" style={{ color: palette.text }} numberOfLines={1}>
          {user.handle}
        </Text>
      </View>
      <Text className="font-mono text-xs font-black tabular-nums" style={{ color: palette.accent }}>
        +{user.pnlPct.toFixed(1)}%
      </Text>
    </View>
  );
});

/** Global mock leaderboard with a native ad injected after every 3rd user. */
export function Leaderboard() {
  const palette = useThemeStore((s) => s.palette);
  const rows: ReactNode[] = [];
  MOCK_LEADERS.forEach((user, index) => {
    const rank = index + 1;
    rows.push(<UserRow key={user.id} user={user} rank={rank} palette={palette} />);
    if ((index + 1) % 3 === 0) {
      rows.push(
        <View key={`ad-slot-${user.id}`} className="py-1">
          <NativeAdSlot compact />
        </View>
      );
    }
  });

  return (
    <View
      className="border-t px-2 pb-4 pt-2"
      style={{ borderTopColor: palette.border, backgroundColor: palette.surface2 }}>
      <Text className="mb-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: palette.textMuted }}>
        Global leaderboard
      </Text>
      <Text className="mb-2 font-sans text-base font-black" style={{ color: palette.text }}>
        Paper traders · 7d (mock)
      </Text>
      <View className="rounded-lg border px-1.5" style={{ borderColor: palette.border, backgroundColor: palette.bg }}>
        {rows}
      </View>

      <View className="mt-3">
        <NativeAdSlot />
      </View>
    </View>
  );
}
