/**
 * Phase 3 — Per-market terminal: selector, session + clock, ticker, tabs, stock cards, watchlists.
 * Inline styles only; accent from market config; equities + optional India F&O tab.
 */

import { BannerAd } from '@/src/components/ads/BannerAd';
import { runRewardedForCashAndUnlocks } from '@/services/ads/RewardedAds';
import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { NAV_BREAKPOINT } from '@/constants/theme';
import { LeftSidebar } from '@/src/components/layout/LeftSidebar';
import { BottomPanel } from '@/src/components/layout/BottomPanel';

import type { AppMarket } from '@/constants/appMarkets';
import { auth, isFirebaseConfigured } from '@/config/firebaseConfig';
import {
  createMarketWatchlist,
  ensureDefaultMarketWatchlist,
  loadMarketWatchlists,
  MAX_LISTS_PER_MARKET,
  saveMarketWatchlist,
  type MarketWatchlistDoc,
} from '@/services/firebase/marketWatchlistRepository';

import { MarketSelector, type MarketSelectorValue } from '@/src/components/shared/MarketSelector';
import { TickerBar } from '@/src/components/shared/TickerBar';
import {
  MARKETS,
  type MarketConfig,
  type MarketId,
  toYahooFullSymbol,
  yahooSymbolFor,
} from '@/src/constants/markets';
import { fmtCompact, fmtMoney, fmtPct, T } from '@/src/constants/theme';
import { useMarketPrices, useMarketSubscribe } from '@/src/contexts/MarketPriceContext';
import type { UnifiedMarketTick } from '@/contexts/UnifiedMarketsPriceContext';
import { getStockMeta } from '@/src/data/stockMeta';
import {
  describeMarketHours,
  formatMarketClock,
  sessionBadgeColor,
  sessionForMarket,
  type VenueSessionLabel,
} from '@/src/screens/markets/shared/marketSession';
import { PREMIUM_MARKET_IDS } from '@/store/adRewardsStore';
import { useAdRewardsStore } from '@/store/adRewardsStore';

export type MarketScreenTab =
  | 'all'
  | 'watchlists'
  | 'gainers'
  | 'losers'
  | 'highs'
  | 'lows'
  | 'fo';

export interface MarketScreenTemplateProps {
  marketId: MarketId;
  /** India — adds “F&O” tab (indices / liquid ETFs). */
  showFoTab?: boolean;
}

type EquityRow = {
  kind: 'equity';
  ticker: string;
  full: string;
  company: string;
  sector: string;
  tick: UnifiedMarketTick | undefined;
};

type FoRow = {
  kind: 'fo';
  ticker: string;
  full: string;
  company: string;
  sector: string;
  tick: UnifiedMarketTick | undefined;
};

const PRESET_COLORS = ['#f0b90b', '#FF6B35', '#00C805', '#7B68EE', '#00B4D8', '#C8A951'];

function rowFull(market: MarketConfig, ticker: string): string {
  if (market.dataSource === 'binance_websocket') return ticker;
  return yahooSymbolFor(market, ticker);
}

function isNewHigh(t: UnifiedMarketTick | undefined): boolean {
  if (!t?.price || t.fiftyTwoWeekHigh == null || t.fiftyTwoWeekHigh <= 0) return false;
  return t.price >= t.fiftyTwoWeekHigh * 0.998;
}

function isNewLow(t: UnifiedMarketTick | undefined): boolean {
  if (!t?.price || t.fiftyTwoWeekLow == null || t.fiftyTwoWeekLow <= 0) return false;
  return t.price <= t.fiftyTwoWeekLow * 1.002;
}

function avgPctForSymbols(
  cfg: MarketConfig,
  symbols: string[],
  ticks: Record<string, UnifiedMarketTick>
): number | null {
  const pcts: number[] = [];
  for (const s of symbols) {
    const sym = s.trim().toUpperCase();
    const full = toYahooFullSymbol(cfg, sym);
    const p = ticks[full]?.changePct;
    if (p != null && isFinite(p)) pcts.push(p);
  }
  if (pcts.length === 0) return null;
  return pcts.reduce((a, b) => a + b, 0) / pcts.length;
}

export default function MarketScreenTemplate({ marketId, showFoTab }: MarketScreenTemplateProps) {
  const cfg = MARKETS[marketId];
  const premiumUntil = useAdRewardsStore((s) => s.premiumUnlockUntil);
  const isPremiumMarket = (PREMIUM_MARKET_IDS as readonly string[]).includes(marketId);
  const premiumLocked = isPremiumMarket && Date.now() >= premiumUntil;
  useMarketSubscribe(marketId);
  const { ticks } = useMarketPrices();
  const router = useRouter();
  const accent = cfg.accentColor ?? T.yellow;
  const { width } = useWindowDimensions();
  const isWide = width >= NAV_BREAKPOINT;

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [tab, setTab] = useState<MarketScreenTab>('all');
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [wlDocs, setWlDocs] = useState<MarketWatchlistDoc[]>([]);
  const [wlLoading, setWlLoading] = useState(false);
  const [expandedWlId, setExpandedWlId] = useState<string | null>(null);

  const [starOpen, setStarOpen] = useState(false);
  const [starTarget, setStarTarget] = useState<{ displayTicker: string; routeTicker: string } | null>(
    null
  );

  const [createWlOpen, setCreateWlOpen] = useState(false);
  const [newWlName, setNewWlName] = useState('');
  const [newWlColor, setNewWlColor] = useState(accent);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth?.currentUser) return;
    void ensureDefaultMarketWatchlist(marketId as AppMarket);
  }, [marketId]);

  useEffect(() => {
    if (tab !== 'watchlists') return;
    let cancelled = false;
    setWlLoading(true);
    void (async () => {
      try {
        if (isFirebaseConfigured && auth?.currentUser) {
          await ensureDefaultMarketWatchlist(marketId as AppMarket);
          const d = await loadMarketWatchlists(marketId as AppMarket);
          if (!cancelled) setWlDocs(d);
        } else if (!cancelled) setWlDocs([]);
      } finally {
        if (!cancelled) setWlLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, marketId]);

  const equityRows: EquityRow[] = useMemo(() => {
    return cfg.pairs.map((ticker) => {
      const full = rowFull(cfg, ticker);
      const tick = ticks[full];
      const meta = getStockMeta(marketId, ticker);
      return {
        kind: 'equity',
        ticker,
        full,
        company: meta.company,
        sector: meta.sector,
        tick,
      };
    });
  }, [cfg, ticks, marketId]);

  const foRows: FoRow[] = useMemo(() => {
    const extras = cfg.yahooPollExtras ?? [];
    if (!showFoTab || extras.length === 0) return [];
    return extras.map((full) => {
      const meta = getStockMeta(marketId, full);
      return {
        kind: 'fo',
        ticker: full,
        full,
        company: meta.company,
        sector: meta.sector,
        tick: ticks[full],
      };
    });
  }, [cfg, showFoTab, ticks, marketId]);

  const meanEquityVol = useMemo(() => {
    const vs = equityRows.map((r) => r.tick?.volume).filter((v): v is number => v != null && v > 0 && isFinite(v));
    if (vs.length === 0) return 1;
    return vs.reduce((a, b) => a + b, 0) / vs.length;
  }, [equityRows]);

  const meanFoVol = useMemo(() => {
    const vs = foRows.map((r) => r.tick?.volume).filter((v): v is number => v != null && v > 0 && isFinite(v));
    if (vs.length === 0) return 1;
    return vs.reduce((a, b) => a + b, 0) / vs.length;
  }, [foRows]);

  const sessionState =
    equityRows.map((r) => r.tick?.marketState).find((s) => s != null && s !== '') ?? null;
  const sessionLabel: VenueSessionLabel = sessionForMarket(marketId, sessionState);
  const clockStr = formatMarketClock(now, cfg.timezone);

  const tabList: MarketScreenTab[] = useMemo(() => {
    const base: MarketScreenTab[] = ['all', 'watchlists', 'gainers', 'losers', 'highs', 'lows'];
    if (showFoTab && marketId === 'india') base.push('fo');
    return base;
  }, [showFoTab, marketId]);

  useEffect(() => {
    if (!tabList.includes(tab)) setTab('all');
  }, [tabList, tab]);

  const navigateMarket = useCallback(
    (id: MarketSelectorValue) => {
      if (id === 'all') router.replace('/v2' as Href);
      else router.replace(`/v2/${id}` as Href);
    },
    [router]
  );

  const openStar = useCallback((displayTicker: string, routeTicker: string) => {
    setStarTarget({ displayTicker, routeTicker });
    setStarOpen(true);
    if (isFirebaseConfigured && auth?.currentUser) {
      void (async () => {
        await ensureDefaultMarketWatchlist(marketId as AppMarket);
        try {
          const d = await loadMarketWatchlists(marketId as AppMarket);
          setWlDocs(d);
        } catch {
          /* ignore */
        }
      })();
    }
  }, [marketId]);

  const onCreateWatchlist = async () => {
    const name = newWlName.trim() || `My ${cfg.name} Picks`;
    try {
      await createMarketWatchlist(marketId as AppMarket, { name, color: newWlColor, symbols: [] });
      setNewWlName('');
      setCreateWlOpen(false);
      const d = await loadMarketWatchlists(marketId as AppMarket);
      setWlDocs(d);
    } catch {
      /* toast elsewhere */
    }
  };

  const toggleSymbolInList = async (wl: MarketWatchlistDoc, sym: string) => {
    const u = sym.toUpperCase();
    const has = wl.symbols.map((x) => x.toUpperCase()).includes(u);
    const next = has ? wl.symbols.filter((s) => s.toUpperCase() !== u) : [...wl.symbols, u];
    try {
      await saveMarketWatchlist(marketId as AppMarket, wl.id, {
        name: wl.name,
        symbols: next,
        color: wl.color,
        createdAt: wl.createdAt,
        order: wl.order,
      });
      const d = await loadMarketWatchlists(marketId as AppMarket);
      setWlDocs(d);
    } catch {
      /* ignore */
    }
  };

  const pushTrade = (routeTicker: string) => {
    router.push(`/v2/${marketId}/trade?symbol=${encodeURIComponent(routeTicker)}` as Href);
  };

  const q = query.trim().toLowerCase();

  const filteredEquity = useMemo(() => {
    if (!q) return equityRows;
    return equityRows.filter(
      (r) =>
        r.ticker.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        r.sector.toLowerCase().includes(q)
    );
  }, [equityRows, q]);

  const filteredFo = useMemo(() => {
    if (!q) return foRows;
    return foRows.filter(
      (r) =>
        r.full.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        r.sector.toLowerCase().includes(q)
    );
  }, [foRows, q]);

  const sortedGainers = useMemo(() => {
    return [...filteredEquity].sort((a, b) => (b.tick?.changePct ?? -1e9) - (a.tick?.changePct ?? -1e9));
  }, [filteredEquity]);

  const sortedLosers = useMemo(() => {
    return [...filteredEquity].sort((a, b) => (a.tick?.changePct ?? 1e9) - (b.tick?.changePct ?? 1e9));
  }, [filteredEquity]);

  const highs = useMemo(() => filteredEquity.filter((r) => isNewHigh(r.tick)), [filteredEquity]);
  const lows = useMemo(() => filteredEquity.filter((r) => isNewLow(r.tick)), [filteredEquity]);

  const displayRows: (EquityRow | FoRow)[] = useMemo(() => {
    if (tab === 'all') return filteredEquity;
    if (tab === 'gainers') return sortedGainers;
    if (tab === 'losers') return sortedLosers;
    if (tab === 'highs') return highs;
    if (tab === 'lows') return lows;
    if (tab === 'fo') return filteredFo;
    return [];
  }, [tab, filteredEquity, sortedGainers, sortedLosers, highs, lows, filteredFo]);

  const tabTitle = (t: MarketScreenTab): string => {
    switch (t) {
      case 'all':
        return 'All Stocks';
      case 'watchlists':
        return 'Watchlists';
      case 'gainers':
        return 'Gainers';
      case 'losers':
        return 'Losers';
      case 'highs':
        return 'New Highs';
      case 'lows':
        return 'New Lows';
      case 'fo':
        return 'F&O';
      default:
        return '';
    }
  };

  function StockCard({
    row,
    routeTicker,
    displaySymbol,
  }: {
    row: EquityRow | FoRow;
    routeTicker: string;
    displaySymbol: string;
  }) {
    const t = row.tick;
    const price = t?.price ?? null;
    const pct = t?.changePct ?? null;
    const vol = t?.volume ?? null;
    const up = (pct ?? 0) >= 0;
    const volMean = row.kind === 'fo' ? meanFoVol : meanEquityVol;
    const volRatio = volMean > 0 && vol != null && isFinite(vol) ? Math.min(2.2, vol / volMean) : 0;
    const barW = `${Math.min(100, (volRatio / 2.2) * 100)}%`;

    return (
      <View
        style={{
          backgroundColor: T.bg1,
          borderWidth: 1,
          borderColor: T.border,
          borderRadius: T.radiusLg,
          padding: 14,
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ color: T.text0, fontSize: 15, fontWeight: '800' }} numberOfLines={2}>
              {row.company}
            </Text>
            <Text style={{ color: T.text2, fontSize: 12, marginTop: 4, fontWeight: '700' }}>{displaySymbol}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Text style={{ color: T.text0, fontSize: 18, fontWeight: '700' }}>{fmtMoney(price, cfg.currencySymbol)}</Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: up ? T.greenDim : T.redDim,
              }}
            >
              <Text style={{ color: up ? T.green : T.red, fontSize: 12, fontWeight: '700' }}>{fmtPct(pct)}</Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <Text style={{ color: T.text3, fontSize: 11 }}>Volume vs avg</Text>
          <Text style={{ color: T.text2, fontSize: 11, fontWeight: '600' }}>{fmtCompact(vol)}</Text>
        </View>
        <View style={{ marginTop: 6, height: 6, backgroundColor: T.bg2, borderRadius: 4, overflow: 'hidden' }}>
          <View style={{ width: barW as `${number}%`, height: '100%', backgroundColor: accent }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: T.radiusSm, backgroundColor: T.bg2 }}>
            <Text style={{ color: T.text1, fontSize: 11, fontWeight: '700' }}>{row.sector}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => openStar(displaySymbol, routeTicker)} hitSlop={8}>
              <Text style={{ color: T.yellow, fontSize: 20 }}>☆</Text>
            </Pressable>
            <Pressable
              onPress={() => pushTrade(routeTicker)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: T.radiusSm,
                backgroundColor: T.greenDim,
              }}
            >
              <Text style={{ color: T.green, fontSize: 12, fontWeight: '800' }}>Trade →</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const wlSymRoute = (sym: string) => toYahooFullSymbol(cfg, sym);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      {premiumLocked ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.94)',
            zIndex: 100,
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Text style={{ color: T.text0, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>Premium market</Text>
          <Text style={{ color: T.text2, fontSize: 13, marginTop: 12, textAlign: 'center' }}>
            Switzerland & Germany venues require a quick rewarded unlock (24h).
          </Text>
          <Pressable
            onPress={() => void runRewardedForCashAndUnlocks()}
            style={{
              marginTop: 20,
              backgroundColor: T.yellow,
              paddingVertical: 14,
              borderRadius: T.radiusMd,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#000', fontWeight: '800' }}>Watch ad to unlock 24h</Text>
          </Pressable>
          <Pressable onPress={() => router.replace('/v2' as Href)} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ color: T.text3, fontSize: 13 }}>Back to markets</Text>
          </Pressable>
        </View>
      ) : null}

      <MarketSelector active={marketId} onChange={navigateMarket} />

      <TickerBar market={cfg} />

      <View style={{ flex: 1, minHeight: 0 }}>
        <View style={{ flex: 1, minHeight: 0, flexDirection: isWide ? 'row' : 'column' }}>
          {isWide ? (
            <LeftSidebar
              marketId={marketId}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
            />
          ) : null}

          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{ paddingBottom: 48 }}
            stickyHeaderIndices={[1]}
            keyboardShouldPersistTaps="handled"
          >
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Text style={{ fontSize: 28 }}>{cfg.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.text0, fontSize: 20, fontWeight: '800' }}>{cfg.name}</Text>
                <Text style={{ color: T.text2, fontSize: 11, marginTop: 4 }}>{describeMarketHours(cfg)}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: T.bg2,
                  borderWidth: 1,
                  borderColor: sessionBadgeColor(sessionLabel, accent),
                }}
              >
                <Text
                  style={{
                    color: sessionBadgeColor(sessionLabel, accent),
                    fontSize: 11,
                    fontWeight: '900',
                    letterSpacing: 0.6,
                  }}
                >
                  {sessionLabel}
                </Text>
              </View>
              <Text style={{ color: T.text2, fontSize: 11, fontWeight: '600' }}>{clockStr}</Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <BannerAd slot="top" />
        </View>

        <View style={{ backgroundColor: T.bg0, paddingBottom: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, alignItems: 'center' }}
          >
            {tabList.map((tid) => {
              const on = tab === tid;
              return (
                <Pressable
                  key={tid}
                  onPress={() => setTab(tid)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: on ? T.bg2 : T.bg1,
                    borderWidth: 2,
                    borderColor: on ? accent : T.border,
                  }}
                >
                  <Text style={{ color: on ? T.text0 : T.text2, fontSize: 12, fontWeight: '800' }}>{tabTitle(tid)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>


        {tab !== 'watchlists' ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={
                tab === 'fo'
                  ? `Search ${filteredFo.length} F&O symbols…`
                  : `Search ${cfg.pairs.length} symbols in ${cfg.name}…`
              }
              placeholderTextColor={T.text3}
              style={{
                backgroundColor: T.bg1,
                borderWidth: 1,
                borderColor: T.border,
                borderRadius: T.radiusMd,
                color: T.text0,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 14,
                marginBottom: 14,
              }}
            />

            {displayRows.length === 0 ? (
              <Text style={{ color: T.text3, fontSize: 13, paddingVertical: 24 }}>No symbols match.</Text>
            ) : (
              displayRows.map((row, i) => {
                const routeTicker = row.kind === 'equity' ? row.ticker : row.full;
                const displaySymbol = row.kind === 'equity' ? row.ticker : row.full;
                return (
                  <React.Fragment key={row.full}>
                    <StockCard row={row} routeTicker={routeTicker} displaySymbol={displaySymbol} />
                    {(i + 1) % 8 === 0 && <BannerAd slot="inline" />}
                  </React.Fragment>
                );
              })
            )}
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: T.text0, fontSize: 16, fontWeight: '800' }}>
                {cfg.flag} Watchlists ({wlDocs.length}/{MAX_LISTS_PER_MARKET})
              </Text>
              <Pressable
                onPress={() => setCreateWlOpen(true)}
                disabled={wlDocs.length >= MAX_LISTS_PER_MARKET}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: wlDocs.length >= MAX_LISTS_PER_MARKET ? T.bg3 : T.bg2,
                }}
              >
                <Text style={{ color: T.text0, fontSize: 12, fontWeight: '800' }}>+ Create</Text>
              </Pressable>
            </View>

            {wlLoading ? (
              <Text style={{ color: T.text3, fontSize: 13 }}>Loading watchlists…</Text>
            ) : !isFirebaseConfigured || !auth?.currentUser ? (
              <Text style={{ color: T.text2, fontSize: 13 }}>Sign in to sync watchlists for {cfg.name}.</Text>
            ) : (
              <View style={{ gap: 12 }}>
                {wlDocs.map((wl) => {
                  const avg = avgPctForSymbols(cfg, wl.symbols, ticks);
                  const expanded = expandedWlId === wl.id;
                  return (
                    <View
                      key={wl.id}
                      style={{
                        borderWidth: 1,
                        borderColor: expanded ? wl.color : T.border,
                        borderRadius: T.radiusLg,
                        backgroundColor: T.bg1,
                        overflow: 'hidden',
                      }}
                    >
                      <Pressable
                        onPress={() => setExpandedWlId(expanded ? null : wl.id)}
                        style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={{ color: T.text0, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
                            {wl.name}
                          </Text>
                          <Text style={{ color: T.text3, fontSize: 12, marginTop: 4 }}>
                            {wl.symbols.length} stocks · avg{' '}
                            <Text style={{ color: avg != null && avg >= 0 ? T.green : T.red, fontWeight: '700' }}>
                              {avg == null ? '—' : fmtPct(avg)}
                            </Text>
                          </Text>
                        </View>
                        <Text style={{ color: T.text2, fontSize: 18 }}>{expanded ? '▾' : '▸'}</Text>
                      </Pressable>
                      {expanded ? (
                        <View style={{ borderTopWidth: 1, borderColor: T.border, paddingHorizontal: 10, paddingVertical: 8 }}>
                          {wl.symbols.length === 0 ? (
                            <Text style={{ color: T.text3, fontSize: 12, padding: 8 }}>Empty list — tap ☆ on a stock to add.</Text>
                          ) : (
                            wl.symbols.map((sym) => {
                              const full = wlSymRoute(sym);
                              const tk = ticks[full];
                              const meta = getStockMeta(marketId, sym);
                              const extras = cfg.yahooPollExtras ?? [];
                              const isFoSym = extras.includes(sym);
                              const rowCard: EquityRow | FoRow = isFoSym
                                ? { kind: 'fo', ticker: sym, full, company: meta.company, sector: meta.sector, tick: tk }
                                : {
                                    kind: 'equity',
                                    ticker: sym,
                                    full,
                                    company: meta.company,
                                    sector: meta.sector,
                                    tick: tk,
                                  };
                              return (
                                <StockCard
                                  key={sym}
                                  row={rowCard}
                                  routeTicker={sym}
                                  displaySymbol={sym}
                                />
                              );
                            })
                          )}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
          </ScrollView>
        </View>
        <BottomPanel marketId={marketId} />
      </View>

      <Modal visible={starOpen} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }} onPress={() => setStarOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: T.bg1,
              borderRadius: T.radiusLg,
              padding: 20,
              borderWidth: 1,
              borderColor: T.border,
              maxHeight: 420,
            }}
          >
            <Text style={{ color: T.text0, fontWeight: '800', marginBottom: 8 }}>Add to watchlist</Text>
            <Text style={{ color: T.text2, fontSize: 12, marginBottom: 14 }}>{starTarget?.displayTicker}</Text>
            {!isFirebaseConfigured || !auth?.currentUser ? (
              <Text style={{ color: T.text3, fontSize: 13 }}>Sign in to manage lists.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 280 }}>
                {wlDocs.map((wl) => {
                  const u = (starTarget?.routeTicker ?? '').toUpperCase();
                  const has = wl.symbols.map((x) => x.toUpperCase()).includes(u);
                  return (
                    <Pressable
                      key={wl.id}
                      onPress={() => starTarget && toggleSymbolInList(wl, starTarget.routeTicker)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderColor: T.border,
                      }}
                    >
                      <Text style={{ color: T.text0, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                        {has ? '★' : '☆'} {wl.name}
                      </Text>
                      <Text style={{ color: T.text3, fontSize: 12 }}>{wl.symbols.length}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            <Pressable
              onPress={() => setStarOpen(false)}
              style={{ marginTop: 16, alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 12 }}
            >
              <Text style={{ color: accent, fontWeight: '800' }}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={createWlOpen} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }} onPress={() => setCreateWlOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: T.bg1, borderRadius: T.radiusLg, padding: 20, borderWidth: 1, borderColor: T.border }}
          >
            <Text style={{ color: T.text0, fontWeight: '800', marginBottom: 12 }}>New watchlist</Text>
            <TextInput
              value={newWlName}
              onChangeText={setNewWlName}
              placeholder={`My ${cfg.name} Picks`}
              placeholderTextColor={T.text3}
              style={{
                borderWidth: 1,
                borderColor: T.border,
                borderRadius: T.radiusMd,
                padding: 12,
                color: T.text0,
                marginBottom: 12,
              }}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {PRESET_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setNewWlColor(c)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: c,
                    borderWidth: newWlColor === c ? 3 : 0,
                    borderColor: T.text0,
                  }}
                />
              ))}
            </View>
            <Pressable
              onPress={onCreateWatchlist}
              style={{ backgroundColor: newWlColor, padding: 14, borderRadius: T.radiusMd, alignItems: 'center' }}
            >
              <Text style={{ color: '#000', fontWeight: '800' }}>Create</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
