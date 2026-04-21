/**
 * LeftSidebar — persistent watchlist + search panel for all 9 market screens.
 * Width: 280px (desktop); hidden on mobile (controlled by TradingLayout / MarketScreenTemplate).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { AppMarket } from '@/constants/appMarkets';
import { auth } from '@/config/firebaseConfig';
import {
  createMarketWatchlist,
  ensureDefaultMarketWatchlist,
  loadMarketWatchlists,
  MAX_LISTS_PER_MARKET,
  removeMarketWatchlist,
  saveMarketWatchlist,
  type MarketWatchlistDoc,
} from '@/services/firebase/marketWatchlistRepository';
import { useMarketPrices, useMarketSubscribe } from '@/src/contexts/MarketPriceContext';
import { MARKETS, type MarketId, yahooSymbolFor } from '@/src/constants/markets';
import { fmtPct, T } from '@/src/constants/theme';
import { getStockMeta } from '@/src/data/stockMeta';
import { fetchYahooQuote } from '@/src/services/yahooFinance';

// ─── Static configs ─────────────────────────────────────────────────────────

const INDEX_SYMBOL: Partial<Record<MarketId, string>> = {
  india: '^NSEI',
  usa: '^GSPC',
  uk: '^FTSE',
  china: '000001.SS',
  japan: '^N225',
  australia: '^AXJO',
  germany: '^GDAXI',
  canada: '^GSPTSE',
  switzerland: '^SSMI',
};

const INDEX_LABEL: Partial<Record<MarketId, string>> = {
  india: 'NIFTY 50',
  usa: 'S&P 500',
  uk: 'FTSE 100',
  china: 'SSE Composite',
  japan: 'Nikkei 225',
  australia: 'ASX 200',
  germany: 'DAX',
  canada: 'TSX Composite',
  switzerland: 'SMI',
};

const EXCHANGE_LABEL: Record<MarketId, string> = {
  india: 'NSE / BSE Markets',
  usa: 'NYSE / NASDAQ',
  uk: 'London Stock Exchange',
  china: 'SSE / SZSE Markets',
  japan: 'Tokyo Stock Exchange',
  australia: 'ASX Markets',
  germany: 'XETRA Markets',
  canada: 'TSX Markets',
  switzerland: 'SIX Swiss Exchange',
  crypto: 'Binance Pairs',
};

const MARKET_NOTE: Partial<Record<MarketId, string>> = {
  china: '🇨🇳 Red = Bullish (T+1)',
  uk: '⚠️ 0.5% Stamp Duty applies',
  japan: 'Lot size: 100 shares',
};

const PRESET_COLORS = ['#f0b90b', '#FF6B35', '#0ecb81', '#7B68EE', '#00B4D8', '#E8212A'];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LeftSidebarProps {
  marketId: MarketId;
  selectedSymbol?: string | null;
  onSelectSymbol?: (fullSymbol: string) => void;
  style?: StyleProp<ViewStyle>;
}

type IndexState = { price: number; pct: number } | null;

// ─── Component ───────────────────────────────────────────────────────────────

export function LeftSidebar({
  marketId,
  selectedSymbol,
  onSelectSymbol,
  style,
}: LeftSidebarProps) {
  const cfg = MARKETS[marketId];
  const accent = cfg.accentColor ?? T.yellow;

  useMarketSubscribe(marketId);
  const ticks = useMarketPrices(marketId);

  // Index
  const [indexState, setIndexState] = useState<IndexState>(null);

  // Search
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Watchlists
  const [watchlists, setWatchlists] = useState<MarketWatchlistDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [deleteTarget, setDeleteTarget] = useState<MarketWatchlistDoc | null>(null);
  const [addPickerSymbol, setAddPickerSymbol] = useState<string | null>(null);

  // Inline rename
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Options dropdown
  const [optionMenuId, setOptionMenuId] = useState<string | null>(null);

  // ── Index polling ──────────────────────────────────────────────────────────

  useEffect(() => {
    const sym = INDEX_SYMBOL[marketId];
    if (!sym) return;
    let cancelled = false;

    const poll = async () => {
      const q = await fetchYahooQuote(sym);
      if (cancelled || !q?.price) return;
      const pct = q.prevClose ? ((q.price - q.prevClose) / Math.abs(q.prevClose)) * 100 : 0;
      setIndexState({ price: q.price, pct });
    };

    void poll();
    const t = setInterval(() => void poll(), 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [marketId]);

  // ── Watchlist loading ──────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    if (!auth?.currentUser) { setLoading(false); return; }
    try {
      await ensureDefaultMarketWatchlist(marketId as AppMarket);
      const lists = await loadMarketWatchlists(marketId as AppMarket);
      setWatchlists(lists);
      if (lists.length > 0) setExpanded(new Set([lists[0].id]));
    } catch (e) {
      console.warn('[LeftSidebar] load error', e);
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => { setLoading(true); void reload(); }, [reload]);

  // ── Search results ─────────────────────────────────────────────────────────

  const allSymbols = useMemo(() => {
    if (cfg.dataSource === 'binance_websocket') {
      return cfg.pairs.map((p) => ({
        ticker: p,
        full: p,
        company: getStockMeta(marketId, p).company,
      }));
    }
    const pairs = cfg.pairs.map((ticker) => ({
      ticker,
      full: yahooSymbolFor(cfg, ticker),
      company: getStockMeta(marketId, ticker).company,
    }));
    const extras = (cfg.yahooPollExtras ?? []).map((full) => ({
      ticker: full,
      full,
      company: getStockMeta(marketId, full).company,
    }));
    return [...pairs, ...extras];
  }, [cfg, marketId]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allSymbols
      .filter((s) => s.ticker.toLowerCase().includes(q) || s.company.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, allSymbols]);

  // ── Watchlist ops ──────────────────────────────────────────────────────────

  const saveSymbols = async (wl: MarketWatchlistDoc, symbols: string[]) => {
    await saveMarketWatchlist(marketId as AppMarket, wl.id, {
      name: wl.name,
      symbols,
      color: wl.color,
      createdAt: wl.createdAt,
      order: wl.order,
    });
    await reload();
  };

  const addToWatchlist = async (watchlistId: string, ticker: string) => {
    const wl = watchlists.find((w) => w.id === watchlistId);
    if (!wl || wl.symbols.includes(ticker)) return;
    await saveSymbols(wl, [...wl.symbols, ticker]);
  };

  const removeFromWatchlist = async (watchlistId: string, ticker: string) => {
    const wl = watchlists.find((w) => w.id === watchlistId);
    if (!wl) return;
    await saveSymbols(wl, wl.symbols.filter((s) => s !== ticker));
  };

  const handleCreate = async () => {
    if (!newName.trim() || !auth?.currentUser) return;
    try {
      await createMarketWatchlist(marketId as AppMarket, {
        name: newName.trim(),
        color: newColor,
      });
      setShowCreate(false);
      setNewName('');
      setNewColor(PRESET_COLORS[0]);
      await reload();
    } catch (e) {
      console.warn('[LeftSidebar] create error', e);
    }
  };

  const handleDelete = async (wl: MarketWatchlistDoc) => {
    try {
      await removeMarketWatchlist(marketId as AppMarket, wl.id);
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      console.warn('[LeftSidebar] delete error', e);
    }
  };

  const handleRename = async (wl: MarketWatchlistDoc) => {
    if (!renameDraft.trim()) { setRenameId(null); return; }
    try {
      await saveMarketWatchlist(marketId as AppMarket, wl.id, {
        name: renameDraft.trim(),
        symbols: wl.symbols,
        color: wl.color,
        createdAt: wl.createdAt,
        order: wl.order,
      });
      setRenameId(null);
      await reload();
    } catch (e) {
      console.warn('[LeftSidebar] rename error', e);
    }
  };

  const handleAddFromSearch = (ticker: string) => {
    if (watchlists.length === 0) return;
    if (watchlists.length === 1) {
      void addToWatchlist(watchlists[0].id, ticker);
      setShowDropdown(false);
      setQuery('');
    } else {
      setAddPickerSymbol(ticker);
    }
  };

  // ── Price helpers ──────────────────────────────────────────────────────────

  const getPricePct = (ticker: string) => {
    const full = cfg.dataSource === 'binance_websocket' ? ticker : yahooSymbolFor(cfg, ticker);
    const tick = ticks[full];
    const price = tick?.price ?? null;
    const pct =
      tick?.price != null && tick?.prevClose != null && tick.prevClose !== 0
        ? ((tick.price - tick.prevClose) / Math.abs(tick.prevClose)) * 100
        : null;
    return { price, pct, full };
  };

  const fmtPrice = (price: number | null) => {
    if (price == null) return '—';
    const abs = Math.abs(price);
    const digits = abs >= 10_000 ? 0 : abs >= 100 ? 1 : 2;
    return `${cfg.currencySymbol}${price.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View
      style={[
        {
          width: 280,
          backgroundColor: T.bg1,
          borderRightWidth: 1,
          borderRightColor: T.border,
          flexDirection: 'column',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {/* Exchange header */}
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: T.border,
          backgroundColor: T.bg0,
        }}
      >
        <Text style={{ color: accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }}>
          {EXCHANGE_LABEL[marketId]}
        </Text>
        {MARKET_NOTE[marketId] ? (
          <Text style={{ color: T.text3, fontSize: 10, marginTop: 2 }}>{MARKET_NOTE[marketId]}</Text>
        ) : null}
      </View>

      {/* Index bar */}
      {INDEX_SYMBOL[marketId] ? (
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: T.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: T.bg0,
          }}
        >
          <Text style={{ color: T.text3, fontSize: 11, fontWeight: '700' }}>
            {INDEX_LABEL[marketId]}
          </Text>
          {indexState ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: T.text0, fontSize: 13, fontWeight: '700', fontFamily: T.fontMono }}>
                {fmtPrice(indexState.price)}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: indexState.pct >= 0 ? T.green : T.red,
                }}
              >
                {fmtPct(indexState.pct)}
              </Text>
            </View>
          ) : (
            <ActivityIndicator size="small" color={T.text3} />
          )}
        </View>
      ) : null}

      {/* Search bar */}
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderBottomWidth: showDropdown && searchResults.length > 0 ? 0 : 1,
          borderBottomColor: T.border,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: T.bg2,
            borderRadius: T.radiusSm,
            borderWidth: 1,
            borderColor: showDropdown ? accent : T.border,
            paddingHorizontal: 10,
            paddingVertical: 7,
            gap: 6,
          }}
        >
          <Text style={{ color: T.text3, fontSize: 13 }}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={(t) => { setQuery(t); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder={`Search ${cfg.name.split(' ')[0]}…`}
            placeholderTextColor={T.text3}
            style={{
              flex: 1,
              color: T.text0,
              fontSize: 12,
              fontFamily: T.fontSans,
              // @ts-ignore — web only
              outlineStyle: 'none',
            }}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => { setQuery(''); setShowDropdown(false); }} hitSlop={6}>
              <Text style={{ color: T.text3, fontSize: 12 }}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Search dropdown */}
      {showDropdown && searchResults.length > 0 ? (
        <View
          style={{
            backgroundColor: T.bg2,
            borderBottomWidth: 1,
            borderBottomColor: T.border,
            maxHeight: 240,
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            {searchResults.map((s) => {
              const tick = ticks[s.full];
              return (
                <Pressable
                  key={s.full}
                  onPress={() => {
                    onSelectSymbol?.(s.full);
                    setShowDropdown(false);
                    setQuery('');
                  }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: T.border,
                    backgroundColor: pressed ? T.bg3 : 'transparent',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.text0, fontSize: 12, fontWeight: '700' }}>{s.ticker}</Text>
                    <Text style={{ color: T.text3, fontSize: 10, marginTop: 1 }} numberOfLines={1}>
                      {s.company}
                    </Text>
                  </View>
                  {tick?.price != null ? (
                    <Text style={{ color: T.text2, fontSize: 11, fontFamily: T.fontMono }}>
                      {fmtPrice(tick.price)}
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={(e) => {
                      // @ts-ignore
                      e.stopPropagation?.();
                      handleAddFromSearch(s.ticker);
                    }}
                    style={{
                      backgroundColor: T.bg3,
                      borderRadius: 4,
                      paddingHorizontal: 7,
                      paddingVertical: 3,
                      borderWidth: 1,
                      borderColor: accent,
                    }}
                    hitSlop={6}
                  >
                    <Text style={{ color: accent, fontSize: 12, fontWeight: '800' }}>+</Text>
                  </Pressable>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Watchlists section */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Section header */}
        <View
          style={{
            paddingHorizontal: 14,
            paddingTop: 12,
            paddingBottom: 6,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ color: T.text3, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>
            WATCHLISTS
          </Text>
          {auth?.currentUser && watchlists.length < MAX_LISTS_PER_MARKET ? (
            <Pressable
              onPress={() => { setNewName(''); setNewColor(PRESET_COLORS[0]); setShowCreate(true); }}
              style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: T.bg3, borderRadius: 4 }}
            >
              <Text style={{ color: accent, fontSize: 13, fontWeight: '800' }}>+</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Loading / empty states */}
        {loading ? (
          <ActivityIndicator color={T.text3} style={{ marginTop: 24 }} />
        ) : !auth?.currentUser ? (
          <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
            <Text style={{ color: T.text3, fontSize: 11 }}>Sign in to use watchlists</Text>
          </View>
        ) : watchlists.length === 0 ? (
          <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
            <Text style={{ color: T.text3, fontSize: 11 }}>
              No watchlists yet. Tap [+] to create one.
            </Text>
          </View>
        ) : (
          watchlists.map((wl) => {
            const isExpanded = expanded.has(wl.id);
            const isRenaming = renameId === wl.id;
            const showOptions = optionMenuId === wl.id;

            return (
              <View key={wl.id} style={{ borderBottomWidth: 1, borderBottomColor: T.border }}>
                {/* Watchlist header row */}
                <Pressable
                  onPress={() => {
                    setOptionMenuId(null);
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      next.has(wl.id) ? next.delete(wl.id) : next.add(wl.id);
                      return next;
                    });
                  }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: pressed ? T.bg2 : 'transparent',
                  })}
                >
                  <View
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: wl.color, flexShrink: 0 }}
                  />

                  {isRenaming ? (
                    <TextInput
                      value={renameDraft}
                      onChangeText={setRenameDraft}
                      autoFocus
                      onSubmitEditing={() => void handleRename(wl)}
                      onBlur={() => void handleRename(wl)}
                      style={{
                        flex: 1,
                        color: T.text0,
                        fontSize: 13,
                        fontWeight: '600',
                        backgroundColor: T.bg3,
                        borderRadius: 4,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        // @ts-ignore
                        outlineStyle: 'none',
                      }}
                    />
                  ) : (
                    <Text
                      style={{ flex: 1, color: T.text0, fontSize: 13, fontWeight: '600' }}
                      numberOfLines={1}
                    >
                      {wl.name}
                    </Text>
                  )}

                  <View
                    style={{
                      backgroundColor: T.bg3,
                      borderRadius: 10,
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                    }}
                  >
                    <Text style={{ color: T.text2, fontSize: 10, fontWeight: '700' }}>
                      {wl.symbols.length}
                    </Text>
                  </View>

                  <Pressable
                    onPress={(e) => {
                      // @ts-ignore
                      e.stopPropagation?.();
                      setOptionMenuId((prev) => (prev === wl.id ? null : wl.id));
                    }}
                    hitSlop={8}
                    style={{ paddingHorizontal: 2 }}
                  >
                    <Text style={{ color: T.text3, fontSize: 16, lineHeight: 16 }}>⋯</Text>
                  </Pressable>

                  <Text
                    style={{
                      color: T.text3,
                      fontSize: 12,
                      // @ts-ignore
                      transform: [{ rotate: isExpanded ? '90deg' : '0deg' }],
                    }}
                  >
                    ›
                  </Text>
                </Pressable>

                {/* Options dropdown */}
                {showOptions ? (
                  <View
                    style={{
                      marginHorizontal: 14,
                      marginBottom: 4,
                      backgroundColor: T.bg3,
                      borderRadius: T.radiusSm,
                      borderWidth: 1,
                      borderColor: T.border,
                      overflow: 'hidden',
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        setOptionMenuId(null);
                        setRenameId(wl.id);
                        setRenameDraft(wl.name);
                      }}
                      style={({ pressed }) => ({
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        backgroundColor: pressed ? T.bg2 : 'transparent',
                      })}
                    >
                      <Text style={{ color: T.text1, fontSize: 12 }}>✏️  Rename</Text>
                    </Pressable>
                    <View style={{ height: 1, backgroundColor: T.border }} />
                    <Pressable
                      onPress={() => { setOptionMenuId(null); setDeleteTarget(wl); }}
                      style={({ pressed }) => ({
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        backgroundColor: pressed ? T.redDim : 'transparent',
                      })}
                    >
                      <Text style={{ color: T.red, fontSize: 12 }}>🗑️  Delete</Text>
                    </Pressable>
                  </View>
                ) : null}

                {/* Empty state */}
                {isExpanded && wl.symbols.length === 0 ? (
                  <View style={{ paddingHorizontal: 24, paddingVertical: 10 }}>
                    <Text style={{ color: T.text3, fontSize: 11 }}>
                      Search and add stocks with [+]
                    </Text>
                  </View>
                ) : null}

                {/* Stock rows */}
                {isExpanded
                  ? wl.symbols.map((ticker) => {
                      const { price, pct, full } = getPricePct(ticker);
                      const meta = getStockMeta(marketId, ticker);
                      const isSelected = selectedSymbol === full;
                      const up = pct != null ? pct >= 0 : true;

                      return (
                        <Pressable
                          key={ticker}
                          onPress={() => onSelectSymbol?.(full)}
                          style={({ pressed }) => ({
                            paddingLeft: 22,
                            paddingRight: 10,
                            paddingVertical: 9,
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: pressed ? T.bg2 : 'transparent',
                            borderLeftWidth: 2,
                            borderLeftColor: isSelected ? T.yellow : 'transparent',
                          })}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: T.text0, fontSize: 12, fontWeight: '700' }}>
                              {ticker}
                            </Text>
                            <Text
                              style={{ color: T.text3, fontSize: 10, marginTop: 1 }}
                              numberOfLines={1}
                            >
                              {meta.company}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', marginRight: 6 }}>
                            <Text
                              style={{
                                color: T.text0,
                                fontSize: 12,
                                fontWeight: '700',
                                fontFamily: T.fontMono,
                              }}
                            >
                              {fmtPrice(price)}
                            </Text>
                            {pct != null ? (
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: '700',
                                  color: up ? T.green : T.red,
                                }}
                              >
                                {fmtPct(pct)} {up ? '▲' : '▼'}
                              </Text>
                            ) : null}
                          </View>
                          <Pressable
                            onPress={(e) => {
                              // @ts-ignore
                              e.stopPropagation?.();
                              void removeFromWatchlist(wl.id, ticker);
                            }}
                            hitSlop={8}
                          >
                            <Text style={{ color: T.text3, fontSize: 12 }}>✕</Text>
                          </Pressable>
                        </Pressable>
                      );
                    })
                  : null}
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Create Watchlist Modal ────────────────────────────────────────────── */}
      <Modal
        visible={showCreate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreate(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.72)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setShowCreate(false)}
        >
          <Pressable
            style={{
              width: 300,
              backgroundColor: T.bg2,
              borderRadius: T.radiusLg,
              borderWidth: 1,
              borderColor: T.border,
              padding: 20,
              gap: 14,
            }}
            onPress={() => {}}
          >
            <Text style={{ color: T.text0, fontSize: 15, fontWeight: '800' }}>
              Create New Watchlist
            </Text>

            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Watchlist name"
              placeholderTextColor={T.text3}
              autoFocus
              style={{
                color: T.text0,
                backgroundColor: T.bg3,
                borderRadius: T.radiusSm,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 13,
                borderWidth: 1,
                borderColor: T.border,
                // @ts-ignore
                outlineStyle: 'none',
              }}
            />

            <View>
              <Text style={{ color: T.text3, fontSize: 11, marginBottom: 8 }}>Color</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {PRESET_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setNewColor(c)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: c,
                      borderWidth: newColor === c ? 2 : 0,
                      borderColor: '#fff',
                    }}
                  />
                ))}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setShowCreate(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: T.radiusMd,
                  backgroundColor: T.bg3,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: T.text2, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleCreate()}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: T.radiusMd,
                  backgroundColor: newColor,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#000', fontWeight: '800' }}>Create</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Delete Confirm Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.72)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setDeleteTarget(null)}
        >
          <Pressable
            style={{
              width: 300,
              backgroundColor: T.bg2,
              borderRadius: T.radiusLg,
              borderWidth: 1,
              borderColor: T.border,
              padding: 20,
              gap: 14,
            }}
            onPress={() => {}}
          >
            <Text style={{ color: T.text0, fontSize: 15, fontWeight: '800' }}>
              Delete "{deleteTarget?.name}"?
            </Text>
            <Text style={{ color: T.text2, fontSize: 12, lineHeight: 18 }}>
              This will remove all {deleteTarget?.symbols.length ?? 0} stocks from this list.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setDeleteTarget(null)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: T.radiusMd,
                  backgroundColor: T.bg3,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: T.text2, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => deleteTarget && void handleDelete(deleteTarget)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: T.radiusMd,
                  backgroundColor: T.redDim,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: T.red, fontWeight: '800' }}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Add to Watchlist Picker ───────────────────────────────────────────── */}
      <Modal
        visible={!!addPickerSymbol}
        transparent
        animationType="fade"
        onRequestClose={() => setAddPickerSymbol(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.72)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setAddPickerSymbol(null)}
        >
          <Pressable
            style={{
              width: 300,
              backgroundColor: T.bg2,
              borderRadius: T.radiusLg,
              borderWidth: 1,
              borderColor: T.border,
              padding: 20,
              gap: 4,
            }}
            onPress={() => {}}
          >
            <Text style={{ color: T.text0, fontSize: 13, fontWeight: '800', marginBottom: 8 }}>
              Add {addPickerSymbol} to:
            </Text>
            {watchlists.map((wl) => {
              const inList = addPickerSymbol ? wl.symbols.includes(addPickerSymbol) : false;
              return (
                <Pressable
                  key={wl.id}
                  onPress={() => {
                    if (!addPickerSymbol) return;
                    if (inList) {
                      void removeFromWatchlist(wl.id, addPickerSymbol);
                    } else {
                      void addToWatchlist(wl.id, addPickerSymbol);
                    }
                    setAddPickerSymbol(null);
                    setQuery('');
                    setShowDropdown(false);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                    borderRadius: T.radiusSm,
                    backgroundColor: pressed ? T.bg3 : 'transparent',
                  })}
                >
                  <View
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: wl.color }}
                  />
                  <Text style={{ flex: 1, color: T.text0, fontSize: 13 }}>{wl.name}</Text>
                  <Text style={{ color: inList ? T.green : T.text3, fontSize: 14, fontWeight: '700' }}>
                    {inList ? '✓' : '○'}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setAddPickerSymbol(null)}
              style={{ marginTop: 8, padding: 10, alignItems: 'center' }}
            >
              <Text style={{ color: T.text3, fontSize: 12 }}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
