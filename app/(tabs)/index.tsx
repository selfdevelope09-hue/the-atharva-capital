/**
 * Markets Hub — entry point to all 9 live market screens.
 *
 * IMPORTANT: We do NOT subscribe to all 9 markets at once here.
 * That would fire 90+ simultaneous CORS-proxy requests and rate-limit them.
 * Instead we do a SEQUENTIAL single-symbol fetch per Yahoo market (500ms apart).
 * Crypto prices come from the Binance WebSocket already running in context.
 */
import { useRouter, type Href } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { MARKETS, MARKET_IDS, yahooSymbolFor, type MarketId } from '@/src/constants/markets';
import { T, fmtMoney, fmtPct } from '@/src/constants/theme';
import { useMarketSubscribe, useTick } from '@/src/contexts/MarketPriceContext';
import { fetchYahooQuote } from '@/src/services/yahooFinance';
import { BannerAd } from '@/src/components/ads/BannerAd';
import { useLedgerStore } from '@/store/ledgerStore';
import { useMultiMarketBalanceStore } from '@/store/multiMarketBalanceStore';

// ── Crypto subscriber (Binance WebSocket — no CORS issues) ───────────────────
function CryptoSubscriber() {
  useMarketSubscribe('crypto');
  return null;
}

// ── Hub price map: {marketId → {price, pct}} populated sequentially ──────────
type HubPrice = { price: number; pct: number };

function useHubPrices(): Record<string, HubPrice> {
  const [prices, setPrices] = useState<Record<string, HubPrice>>({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const yahooMarkets = MARKET_IDS.filter(
      (id) => MARKETS[id].dataSource === 'yahoo_finance'
    );

    const run = async () => {
      for (const id of yahooMarkets) {
        if (!mounted.current) break;
        const m = MARKETS[id];
        const full = yahooSymbolFor(m, m.pairs[0]);
        try {
          const q = await fetchYahooQuote(full);
          if (q?.price != null && mounted.current) {
            const pct =
              q.prevClose && q.prevClose !== 0
                ? ((q.price - q.prevClose) / Math.abs(q.prevClose)) * 100
                : 0;
            setPrices((prev) => ({ ...prev, [id]: { price: q.price!, pct } }));
          }
        } catch {
          // silently skip — no crash
        }
        // 500ms between markets to avoid overwhelming the CORS proxy
        await new Promise((r) => setTimeout(r, 500));
      }
    };

    void run();
    return () => { mounted.current = false; };
  }, []);

  return prices;
}

// ── Individual market card ────────────────────────────────────────────────────
function MarketCard({
  id,
  hubPrices,
}: {
  id: MarketId;
  hubPrices: Record<string, HubPrice>;
}) {
  const router = useRouter();
  const m = MARKETS[id];

  // Crypto: live from Binance WebSocket tick
  const cryptoTick = useTick(id === 'crypto' ? m.pairs[0] : undefined);

  const openPositions = useLedgerStore((s) => s.openPositions);
  const balances = useMultiMarketBalanceStore((s) => s.balances);

  const posCount = openPositions.filter((p) => p.market === id).length;
  const balance = balances[id] ?? 0;

  // Pick price: crypto from WS tick, Yahoo markets from hub fetcher
  const livePrice =
    id === 'crypto' ? (cryptoTick?.price ?? null) : (hubPrices[id]?.price ?? null);
  const livePct =
    id === 'crypto' ? (cryptoTick?.changePct ?? null) : (hubPrices[id]?.pct ?? null);
  const priceUp = (livePct ?? 0) >= 0;

  return (
    <Pressable
      onPress={() => router.push(`/v2/${id}` as Href)}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: 200,
        maxWidth: 340,
        padding: 16,
        backgroundColor: pressed ? T.bg2 : T.bg1,
        borderWidth: 1.5,
        borderColor: pressed ? (m.accentColor ?? T.yellow) : T.border,
        borderRadius: T.radiusLg,
      })}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Text style={{ fontSize: 26 }}>{m.flag}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.text0, fontSize: 15, fontWeight: '800' }}>{m.name}</Text>
          <Text style={{ color: T.text2, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
            {m.currency} · {m.pairs.length} pairs · {m.maxLeverage}x
          </Text>
        </View>
        {posCount > 0 && (
          <View style={{ backgroundColor: T.greenDim, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: T.green, fontSize: 10, fontWeight: '800' }}>{posCount} open</Text>
          </View>
        )}
      </View>

      {/* Live price */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        {livePrice != null ? (
          <>
            <Text style={{ color: T.text0, fontSize: 16, fontWeight: '700' }}>
              {fmtMoney(livePrice, m.currencySymbol)}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: priceUp ? T.green : T.red }}>
              {fmtPct(livePct)}
            </Text>
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{
              width: 6, height: 6, borderRadius: 3,
              backgroundColor: T.yellow,
              // @ts-ignore
              ...(Platform.OS === 'web' ? {
                animation: 'pulse 1.2s ease-in-out infinite',
              } : {}),
            }} />
            <Text style={{ color: T.text3, fontSize: 12 }}>Loading…</Text>
          </View>
        )}
      </View>

      {/* Pair chips */}
      <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        {m.pairs.slice(0, 5).map((p) => (
          <View key={p} style={{ paddingHorizontal: 7, paddingVertical: 2, backgroundColor: T.bg2, borderRadius: T.radiusSm }}>
            <Text style={{ color: T.text1, fontSize: 10, fontWeight: '700' }}>{p}</Text>
          </View>
        ))}
        {m.pairs.length > 5 && (
          <Text style={{ color: T.text3, fontSize: 10, alignSelf: 'center' }}>+{m.pairs.length - 5}</Text>
        )}
      </View>

      {/* Balance + CTA */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: T.text2, fontSize: 11 }}>
          Balance:{' '}
          <Text style={{ color: T.yellow, fontWeight: '700' }}>{fmtMoney(balance, m.currencySymbol)}</Text>
        </Text>
        <Text style={{ color: m.accentColor ?? T.yellow, fontSize: 11, fontWeight: '800' }}>Open →</Text>
      </View>
    </Pressable>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MarketsHub() {
  const { width } = useWindowDimensions();
  const hubPrices = useHubPrices();

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      {/* Only subscribe to crypto WebSocket — Yahoo markets fetched separately */}
      <CryptoSubscriber />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingTop: 8, paddingBottom: 4 }}>
          <Text style={{ color: T.text0, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
            ⚡ Atharva Capital
          </Text>
          <Text style={{ color: T.text2, fontSize: 13, marginTop: 4 }}>
            9 Global Markets · Live Yahoo Finance + Binance · TradingView Charts
          </Text>
        </View>

        {/* Feature badges */}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[
            ['📊', 'Live Prices'],
            ['📋', 'Watchlists'],
            ['💼', 'Positions'],
            ['📍', 'Chart Drag'],
          ].map(([icon, label]) => (
            <View
              key={label}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingHorizontal: 10, paddingVertical: 5,
                backgroundColor: T.bg1, borderRadius: 20,
                borderWidth: 1, borderColor: T.border,
              }}
            >
              <Text style={{ fontSize: 12 }}>{icon}</Text>
              <Text style={{ color: T.text1, fontSize: 11, fontWeight: '600' }}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Market grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {MARKET_IDS.map((id) => (
            <MarketCard key={id} id={id} hubPrices={hubPrices} />
          ))}
        </View>

        {/* ── Ad banner below market cards ─────────────────────────────────── */}
        <View style={{ marginTop: 8 }}>
          <BannerAd slot="bottom" refreshInterval={30_000} />
        </View>

        <Text style={{ color: T.text3, fontSize: 11, textAlign: 'center', paddingTop: 4 }}>
          Tap any market to open the full terminal with live prices, sidebar watchlists,
          positions panel, and chart order entry.
        </Text>
      </ScrollView>
    </View>
  );
}
