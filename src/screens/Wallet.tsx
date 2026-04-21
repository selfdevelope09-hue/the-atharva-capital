/**
 * Phase 4 — Multi-market wallet: USD total, allocation, per-market actions, FX via Frankfurter.
 */

import type { AppMarket } from '@/constants/appMarkets';
import { ALL_APP_MARKETS, TOP_UP_AMOUNT } from '@/constants/appMarkets';
import { BannerAd } from '@/src/components/ads/BannerAd';
import { RewardedAdButton } from '@/src/components/ads/RewardedAd';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { useAdRewardsStore } from '@/store/adRewardsStore';
import { auth, isFirebaseConfigured } from '@/config/firebaseConfig';
import { MARKETS, type MarketId } from '@/src/constants/markets';
import { fmtMoney, fmtPct, T } from '@/src/constants/theme';
import { useLedgerStore } from '@/store/ledgerStore';
import { useMultiMarketBalanceStore } from '@/store/multiMarketBalanceStore';
import { useInterstitialUiStore } from '@/store/interstitialUiStore';

function PieSlice({
  cx,
  cy,
  r,
  startAngle,
  endAngle,
  color,
}: {
  cx: number;
  cy: number;
  r: number;
  startAngle: number;
  endAngle: number;
  color: string;
}) {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  return <Path d={d} fill={color} stroke={T.bg0} strokeWidth={1} />;
}

export default function Wallet() {
  const balances = useMultiMarketBalanceStore((s) => s.balances);
  const rates = useMultiMarketBalanceStore((s) => s.usdRates);
  const refreshFx = useMultiMarketBalanceStore((s) => s.refreshFx);
  const totalPortfolioUsd = useMultiMarketBalanceStore((s) => s.totalPortfolioUsd);
  const balanceToUsd = useMultiMarketBalanceStore((s) => s.balanceToUsd);
  const topUp = useMultiMarketBalanceStore((s) => s.topUp);
  const resetMarket = useMultiMarketBalanceStore((s) => s.resetMarket);
  const closedTrades = useLedgerStore((s) => s.closedTrades);

  const [expanded, setExpanded] = useState<AppMarket | null>(null);
  const [confirmReset, setConfirmReset] = useState<AppMarket | null>(null);

  useEffect(() => {
    void refreshFx();
  }, [refreshFx]);

  const slices = useMemo(() => {
    if (!rates) return null;
    let start = -Math.PI / 2;
    const sum = ALL_APP_MARKETS.reduce((a, m) => a + balanceToUsd(m, balances[m] ?? 0), 0);
    if (sum <= 0) return null;
    return ALL_APP_MARKETS.map((m) => {
      const u = balanceToUsd(m, balances[m] ?? 0);
      const frac = u / sum;
      const span = frac * Math.PI * 2;
      const end = start + span;
      const el = (
        <PieSlice
          key={m}
          cx={90}
          cy={90}
          r={80}
          startAngle={start}
          endAngle={end}
          color={MARKETS[m as MarketId].accentColor ?? T.yellow}
        />
      );
      start = end;
      return el;
    });
  }, [balances, rates, balanceToUsd]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Text style={{ color: T.text0, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>Wallet</Text>
        <Text style={{ color: T.text2, fontSize: 13, marginBottom: 16 }}>
          FX via Frankfurter (USD base). Signed in: {isFirebaseConfigured && auth?.currentUser ? auth.currentUser.email ?? auth.currentUser.uid : 'local'}
        </Text>

        {/* Watch Ad → Earn virtual cash */}
        <View style={{ backgroundColor: T.bg1, borderRadius: T.radiusMd, borderWidth: 1, borderColor: T.border, padding: 14, marginBottom: 16 }}>
          <Text style={{ color: T.text0, fontWeight: '800', marginBottom: 4 }}>Watch Ad → Get +$500</Text>
          <RewardedAdButton
            label="Watch Ad → Get +$500"
            rewardDescription="Watch a short ad to credit your US sleeve with $500 virtual USD."
            onReward={() => useAdRewardsStore.getState().addVirtualCash(500)}
          />
        </View>

        <View style={{ backgroundColor: T.bg1, borderRadius: T.radiusLg, borderWidth: 1, borderColor: T.border, padding: 16, marginBottom: 16 }}>
          <Text style={{ color: T.text3, fontSize: 11, fontWeight: '700' }}>TOTAL PORTFOLIO (USD)</Text>
          <Text style={{ color: T.green, fontSize: 28, fontWeight: '800', marginTop: 6 }}>{fmtMoney(totalPortfolioUsd(), '$')}</Text>
        </View>

        <Text style={{ color: T.text0, fontWeight: '800', marginBottom: 8 }}>Allocation</Text>
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          {slices ? (
            <Svg width={180} height={180}>
              <G>{slices}</G>
            </Svg>
          ) : (
            <Text style={{ color: T.text3, fontSize: 12 }}>FX rates loading…</Text>
          )}
        </View>

        {ALL_APP_MARKETS.map((m) => {
          const cfg = MARKETS[m as MarketId];
          const bal = balances[m] ?? 0;
          const usd = balanceToUsd(m, bal);
          const share = totalPortfolioUsd() > 0 ? usd / totalPortfolioUsd() : 0;
          const mTrades = closedTrades.filter((t) => t.market === m);
          const realized = mTrades.reduce((a, t) => a + t.realizedPnl, 0);
          const fees = mTrades.reduce((a, t) => a + t.feeOpen + t.feeClose, 0);
          const wins = mTrades.filter((t) => t.win).length;
          const wr = mTrades.length ? wins / mTrades.length : 0;
          const open = expanded === m;

          return (
            <View
              key={m}
              style={{
                borderWidth: 1,
                borderColor: T.border,
                borderRadius: T.radiusMd,
                backgroundColor: T.bg1,
                marginBottom: 10,
                overflow: 'hidden',
              }}
            >
              <Pressable onPress={() => setExpanded(open ? null : m)} style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ color: T.text0, fontWeight: '800' }}>
                    {cfg.flag} {cfg.name}
                  </Text>
                  <Text style={{ color: T.text3, fontSize: 12, marginTop: 4 }}>
                    {fmtMoney(bal, cfg.currencySymbol)} · {fmtPct(share * 100)} of book
                  </Text>
                </View>
                <Text style={{ color: cfg.accentColor ?? T.yellow, fontWeight: '800' }}>{fmtMoney(usd, '$')}</Text>
              </Pressable>
              {open ? (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8, borderTopWidth: 1, borderColor: T.border }}>
                  <Text style={{ color: T.text2, fontSize: 12 }}>
                    Realized {fmtMoney(realized, cfg.currencySymbol)} · Fees {fmtMoney(fees, cfg.currencySymbol)} · Win rate{' '}
                    {fmtPct(wr * 100)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable
                      onPress={async () => {
                        const ok = await topUp(m, isFirebaseConfigured && !!auth?.currentUser);
                        if (!ok) Alert.alert('Top-up', 'Already used your free daily top-up for this market.');
                        else {
                          Alert.alert('Top-up', `+${fmtMoney(TOP_UP_AMOUNT[m], cfg.currencySymbol)} credited`);
                          useInterstitialUiStore.getState().show('manual');
                        }
                      }}
                      style={{ flex: 1, padding: 12, backgroundColor: T.greenDim, borderRadius: 8, alignItems: 'center' }}
                    >
                      <Text style={{ color: T.green, fontWeight: '800' }}>Top-up (+10k/day)</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setConfirmReset(m)}
                      style={{ flex: 1, padding: 12, backgroundColor: T.redDim, borderRadius: 8, alignItems: 'center' }}
                    >
                      <Text style={{ color: T.red, fontWeight: '800' }}>Reset</Text>
                    </Pressable>
                  </View>
                  <Text style={{ color: T.text3, fontSize: 11, marginTop: 2 }}>Transactions (closed trades)</Text>
                  {mTrades.slice(0, 8).map((t) => (
                    <View key={t.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                      <Text style={{ color: T.text1, fontSize: 11 }}>{t.closedAt.slice(0, 10)} · {t.symbol}</Text>
                      <Text style={{ color: t.win ? T.green : T.red, fontSize: 11, fontWeight: '700' }}>{fmtMoney(t.realizedPnl, cfg.currencySymbol)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        {/* Bottom banner — below the market allocation list */}
        <BannerAd slot="bottom" />
      </ScrollView>

      <Modal visible={!!confirmReset} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }} onPress={() => setConfirmReset(null)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: T.bg1, borderRadius: T.radiusLg, padding: 20, borderWidth: 1, borderColor: T.border }}
          >
            <Text style={{ color: T.text0, fontWeight: '800', marginBottom: 12 }}>Reset wallet?</Text>
            <Text style={{ color: T.text2, fontSize: 13, marginBottom: 16 }}>
              Restores starting balance for this market (Firestore if signed in).
            </Text>
            <Pressable
              onPress={async () => {
                if (!confirmReset) return;
                await resetMarket(confirmReset, isFirebaseConfigured && !!auth?.currentUser);
                setConfirmReset(null);
              }}
              style={{ backgroundColor: T.red, padding: 14, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>Confirm reset</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
