/**
 * Phase 4 — Paper leaderboard: mock rivals + your profile rank, USD / PnL% modes.
 */

import type { AppMarket } from '@/constants/appMarkets';
import { ALL_APP_MARKETS } from '@/constants/appMarkets';
import { BannerAd } from '@/src/components/ads/BannerAd';
import { RewardedAd } from '@/src/components/ads/RewardedAd';
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { MARKETS, type MarketId } from '@/src/constants/markets';
import { fmtMoney, fmtPct, T } from '@/src/constants/theme';
import { useProfileStore } from '@/store/profileStore';
import { useAdRewardsStore } from '@/store/adRewardsStore';
import { toggleRival } from '@/services/firebase/rivalsRepository';
import { auth, isFirebaseConfigured } from '@/config/firebaseConfig';

type TraderRow = {
  id: string;
  name: string;
  balanceUsd: number;
  pnlPct: number;
  winRate: number;
  trades: number;
  streak: number;
  weeklyWinner?: boolean;
};

function genMock(seed: number): TraderRow[] {
  const out: TraderRow[] = [];
  for (let i = 0; i < 48; i++) {
    const x = Math.sin(seed + i * 999) * 10000;
    const balanceUsd = 50_000 + Math.abs(x) * 10;
    const pnlPct = (Math.cos(seed + i) * 12 + 3) % 40;
    const winRate = 0.35 + (Math.abs(Math.sin(i)) % 0.5);
    const trades = 20 + ((i * 7) % 200);
    const streak = i % 9;
    out.push({
      id: `tr_${i}`,
      name: `Trader_${(1000 + i * 13).toString(36)}`,
      balanceUsd,
      pnlPct,
      winRate,
      trades,
      streak,
      weeklyWinner: i === 3,
    });
  }
  return out.sort((a, b) => b.balanceUsd - a.balanceUsd);
}

export default function Leaderboard() {
  const [tab, setTab] = useState<'global' | MarketId>('global');
  const [timeFilter, setTimeFilter] = useState<'Today' | 'Week' | 'Month' | 'All Time'>('All Time');
  const [profileOpen, setProfileOpen] = useState<TraderRow | null>(null);
  const [rankRefreshKey, setRankRefreshKey] = useState(0);

  const netWorth = useProfileStore((s) => s.totalNetWorthUsd);
  const clientId = useProfileStore((s) => s.clientId);
  const lbUnlockUntil = useAdRewardsStore((s) => s.leaderboardFullStatsUntil);
  const fullStatsUnlocked = Date.now() < lbUnlockUntil;

  const base = useMemo(() => genMock(42 + rankRefreshKey * 997), [rankRefreshKey]);

  const rows = useMemo(() => {
    if (tab === 'global') {
      return [...base].sort((a, b) => b.balanceUsd - a.balanceUsd);
    }
    const m = tab as AppMarket;
    return [...base]
      .map((r) => ({
        ...r,
        pnlPct: r.pnlPct * (ALL_APP_MARKETS.indexOf(m) % 5 === 0 ? 1.2 : 0.9),
      }))
      .sort((a, b) => b.pnlPct - a.pnlPct);
  }, [base, tab]);

  const me = useMemo(() => {
    const myRow: TraderRow = {
      id: 'me',
      name: clientId ? `You (${clientId})` : 'You',
      balanceUsd: netWorth,
      pnlPct: 6.2,
      winRate: 0.58,
      trades: 120,
      streak: 3,
    };
    const sorted = tab === 'global' ? [...rows, myRow].sort((a, b) => b.balanceUsd - a.balanceUsd) : [...rows, myRow].sort((a, b) => b.pnlPct - a.pnlPct);
    const rank = sorted.findIndex((r) => r.id === 'me') + 1;
    const ahead = sorted[rank - 2];
    const gap =
      tab === 'global' && rank > 1 && ahead
        ? Math.max(0, ahead.balanceUsd - myRow.balanceUsd)
        : tab !== 'global' && rank > 1 && ahead
          ? Math.max(0, ahead.pnlPct - myRow.pnlPct)
          : 0;
    return { myRow, rank, gap, sorted };
  }, [rows, netWorth, clientId, tab]);

  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '');

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 160 }}>
        <Text style={{ color: T.text0, fontSize: 22, fontWeight: '800' }}>Leaderboard</Text>
        <Text style={{ color: T.text3, fontSize: 12, marginTop: 4 }}>Time: {timeFilter} (paper)</Text>

        <BannerAd slot="top" />

        <View
          style={{
            marginTop: 12,
            marginBottom: 8,
            padding: 12,
            borderRadius: T.radiusMd,
            borderWidth: 1,
            borderColor: fullStatsUnlocked ? T.green : T.border,
            backgroundColor: T.bg1,
            gap: 8,
          }}
        >
          <Text style={{ color: T.text0, fontWeight: '800' }}>Full stats and depth</Text>
          <Text style={{ color: T.text3, fontSize: 12 }}>
            Advanced columns: flow toxicity, queue position, and venue-level PnL (mock).
          </Text>
          {!fullStatsUnlocked ? (
            <RewardedAd
              label="Watch ad · Unlock full stats 24h"
              onReward={() => useAdRewardsStore.getState().grantUnlocksFromReward()}
            />
          ) : (
            <Text style={{ color: T.green, fontSize: 12, fontWeight: '700' }}>Unlocked — enjoy full depth.</Text>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginVertical: 12 }}>
          <Pressable
            onPress={() => setTab('global')}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: tab === 'global' ? T.yellow : T.border,
              backgroundColor: T.bg1,
            }}
          >
            <Text style={{ color: T.text0, fontWeight: '800' }}>Global</Text>
          </Pressable>
          {ALL_APP_MARKETS.map((m) => {
            const active = tab === m;
            const cfg = MARKETS[m as MarketId];
            return (
              <Pressable
                key={m}
                onPress={() => setTab(m)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: active ? cfg.accentColor ?? T.yellow : T.border,
                  backgroundColor: T.bg1,
                }}
              >
                <Text style={{ fontSize: 18 }}>{cfg.flag}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView horizontal contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
          {(['Today', 'Week', 'Month', 'All Time'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTimeFilter(t)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: timeFilter === t ? T.bg2 : T.bg1,
                borderWidth: 1,
                borderColor: timeFilter === t ? T.yellow : T.border,
              }}
            >
              <Text style={{ color: T.text1, fontSize: 12, fontWeight: '700' }}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderColor: T.border }}>
          <Text style={{ flex: 0.6, color: T.text3, fontSize: 11, fontWeight: '800' }}>#</Text>
          <Text style={{ flex: 2, color: T.text3, fontSize: 11, fontWeight: '800' }}>Trader</Text>
          <Text style={{ flex: 1.2, color: T.text3, fontSize: 11, fontWeight: '800' }}>{tab === 'global' ? 'USD' : 'P&L%'}</Text>
          <Text style={{ flex: 1, color: T.text3, fontSize: 11, fontWeight: '800' }}>WR</Text>
          <Text style={{ flex: 0.8, color: T.text3, fontSize: 11, fontWeight: '800' }}>#T</Text>
        </View>

        {rows.slice(0, 40).map((r, i) => {
          const glow =
            i < 3
              ? { shadowColor: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : '#cd7f32', shadowOpacity: 0.9, shadowRadius: 14 }
              : {};
          return (
            <Pressable
              key={r.id}
              onPress={() => setProfileOpen(r)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderColor: T.border,
                backgroundColor: i < 3 ? T.bg1 : T.bg0,
                ...glow,
              }}
            >
              <Text style={{ flex: 0.6, color: T.text0, fontWeight: '800' }}>
                {medal(i)}
                {i + 1}
              </Text>
              <View style={{ flex: 2 }}>
                <Text style={{ color: T.text0, fontWeight: '700' }} numberOfLines={1}>
                  {r.name}
                </Text>
                {r.weeklyWinner ? <Text style={{ color: T.yellow, fontSize: 10 }}>👑 Weekly</Text> : null}
              </View>
              <Text style={{ flex: 1.2, color: T.green, fontWeight: '700', fontSize: 12 }}>
                {tab === 'global' ? fmtMoney(r.balanceUsd, '$') : fmtPct(r.pnlPct)}
              </Text>
              <Text style={{ flex: 1, color: T.text1, fontSize: 12 }}>{fmtPct(r.winRate * 100)}</Text>
              <Text style={{ flex: 0.8, color: T.text2, fontSize: 12 }}>{r.trades}</Text>
            </Pressable>
          );
        })}
        <View style={{ paddingVertical: 12 }}>
          <BannerAd slot="bottom" />
        </View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: 14,
          backgroundColor: T.bg1,
          borderTopWidth: 2,
          borderColor: T.yellow,
        }}
      >
        <Text style={{ color: T.text0, fontWeight: '800' }}>{`Your rank #${me.rank} · ${me.myRow.name}`}</Text>
        <Text style={{ color: T.text2, fontSize: 12, marginTop: 4 }}>
          {tab === 'global'
            ? `Need +${fmtMoney(me.gap, '$')} to reach rank #${Math.max(1, me.rank - 1)}`
            : `Need +${me.gap.toFixed(2)}% to reach rank #${Math.max(1, me.rank - 1)}`}
        </Text>
      </View>

      <Modal visible={!!profileOpen} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 }} onPress={() => setProfileOpen(null)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: T.bg1, borderRadius: T.radiusLg, padding: 18, borderWidth: 1, borderColor: T.border }}
          >
            <Text style={{ color: T.text0, fontSize: 18, fontWeight: '800' }}>{profileOpen?.name}</Text>
            <Text style={{ color: T.text2, marginTop: 8, fontSize: 13 }}>Public paper stats (mock rivals for demo).</Text>
            <Pressable
              onPress={async () => {
                if (!isFirebaseConfigured || !auth?.currentUser) return;
                await toggleRival(profileOpen?.id ?? '');
              }}
              style={{ marginTop: 16, padding: 12, backgroundColor: T.bg2, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: T.yellow, fontWeight: '800' }}>Follow → Rivals</Text>
            </Pressable>
            <Pressable onPress={() => setProfileOpen(null)} style={{ marginTop: 10, alignItems: 'center' }}>
              <Text style={{ color: T.text3 }}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
