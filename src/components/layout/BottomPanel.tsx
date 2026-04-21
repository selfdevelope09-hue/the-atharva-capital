/**
 * BottomPanel — TradingView Pro-style bottom panel.
 * Tabs: Positions | Orders | Order History | Balance History | Trading Journal
 * Features: live P&L, draggable resize, TP/SL auto-close, CSV export, journal prompt.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { BannerAd } from '@/src/components/ads/BannerAd';
import { MARKETS, type MarketId } from '@/src/constants/markets';
import { T, fmtPct } from '@/src/constants/theme';
import { useMarketPrices, useMarketSubscribe } from '@/src/contexts/MarketPriceContext';
import { useMultiMarketBalanceStore } from '@/store/multiMarketBalanceStore';
import {
  useLedgerStore,
  type LedgerClosedTrade,
  type LedgerOpenPosition,
} from '@/store/ledgerStore';

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_H = 40;
const DEFAULT_H = 220;
const TAB_BAR_H = 36;

type PanelTab = 'positions' | 'orders' | 'history' | 'balance' | 'journal';

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'positions', label: 'Positions' },
  { id: 'orders', label: 'Orders' },
  { id: 'history', label: 'Order History' },
  { id: 'balance', label: 'Balance History' },
  { id: 'journal', label: 'Trading Journal' },
];

const ENTRY_REASONS = ['Technical', 'Breakout', 'News', 'Support', 'Momentum', 'FOMO'];
const EMOTIONS = ['Confident', 'Patient', 'Greedy', 'Fearful', 'Neutral', 'Impulsive'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimeHeld(openedAt: string): string {
  const diff = Date.now() - new Date(openedAt).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

function fmtLocal(v: number, sym: string, digits = 2): string {
  const abs = Math.abs(v);
  const d = abs >= 10_000 ? 0 : abs >= 100 ? 1 : digits;
  const s = v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  return `${sym}${s}`;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BottomPanelProps {
  marketId: MarketId;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BottomPanel({ marketId }: BottomPanelProps) {
  const cfg = MARKETS[marketId];
  const sym = cfg.currencySymbol;
  const { height: screenH } = useWindowDimensions();

  // ── Panel state ─────────────────────────────────────────────────────────────
  const [panelHeight, setPanelHeight] = useState(DEFAULT_H);
  const [minimized, setMinimized] = useState(false);
  const [tab, setTab] = useState<PanelTab>('positions');

  // ── Sort state (positions tab) ───────────────────────────────────────────────
  type SortKey = 'symbol' | 'side' | 'qty' | 'entry' | 'last' | 'pnl' | 'pct' | 'margin' | 'time';
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  // ── Modals ───────────────────────────────────────────────────────────────────
  const [confirmClose, setConfirmClose] = useState<{ pos: LedgerOpenPosition; exitPrice: number } | null>(null);
  const [editTpSl, setEditTpSl] = useState<LedgerOpenPosition | null>(null);
  const [tpDraft, setTpDraft] = useState('');
  const [slDraft, setSlDraft] = useState('');
  const [selectedPosId, setSelectedPosId] = useState<string | null>(null);

  // ── Journal prompt ───────────────────────────────────────────────────────────
  const [journalTag, setJournalTag] = useState<string | null>(null);
  const [journalEmotion, setJournalEmotion] = useState<string | null>(null);
  const [journalNotes, setJournalNotes] = useState('');

  // ── Toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null);

  const showToast = (msg: string, color: string) => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Stores ───────────────────────────────────────────────────────────────────
  useMarketSubscribe(marketId);
  const { ticks } = useMarketPrices();

  const openPositions = useLedgerStore((s) => s.openPositions);
  const closedTrades = useLedgerStore((s) => s.closedTrades);
  const journalByTradeId = useLedgerStore((s) => s.journalByTradeId);
  const pendingJournalTrade = useLedgerStore((s) => s.pendingJournalTrade);
  const closePosition = useLedgerStore((s) => s.closePosition);
  const updateTpSl = useLedgerStore((s) => s.updateTpSl);
  const saveJournal = useLedgerStore((s) => s.saveJournal);
  const dismissJournal = useLedgerStore((s) => s.dismissJournalPrompt);
  const balance = useMultiMarketBalanceStore((s) => s.balances[marketId] ?? 0);

  // ── Market-scoped data ───────────────────────────────────────────────────────
  const marketPositions = useMemo(
    () => openPositions.filter((p) => p.market === marketId),
    [openPositions, marketId],
  );
  const marketClosed = useMemo(
    () => closedTrades.filter((p) => p.market === marketId),
    [closedTrades, marketId],
  );

  // ── Live P&L helpers ─────────────────────────────────────────────────────────
  const getLivePrice = useCallback(
    (pos: LedgerOpenPosition) => ticks[pos.symbolFull]?.price ?? pos.entryPrice,
    [ticks],
  );

  const getPosPnl = useCallback(
    (pos: LedgerOpenPosition) => {
      const cur = getLivePrice(pos);
      return pos.side === 'long'
        ? (cur - pos.entryPrice) * pos.qty
        : (pos.entryPrice - cur) * pos.qty;
    },
    [getLivePrice],
  );

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const unrealized = marketPositions.reduce((s, p) => s + getPosPnl(p), 0);
    const totalMargin = marketPositions.reduce((s, p) => s + p.margin, 0);
    const today = todayUtc();
    const realized = marketClosed
      .filter((t) => t.closedAt.slice(0, 10) === today)
      .reduce((s, t) => s + t.realizedPnl, 0);
    const equity = balance + unrealized;
    const marginBuffer = totalMargin > 0 ? Math.min(999, (equity / totalMargin) * 100) : 100;
    return { balance, equity, unrealized, realized, totalMargin, availableFunds: balance, marginBuffer };
  }, [balance, marketPositions, marketClosed, getPosPnl]);

  // ── TP/SL auto-check ─────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      const positions = useLedgerStore.getState().openPositions;
      for (const pos of positions) {
        const price = ticks[pos.symbolFull]?.price;
        if (!price) continue;
        if (pos.tp != null) {
          const tpHit = pos.side === 'long' ? price >= pos.tp : price <= pos.tp;
          if (tpHit) {
            await closePosition(pos.id, price, 'tp');
            showToast(`🎯 TP Hit! ${pos.symbol} closed`, T.green);
          }
        }
        if (pos.sl != null) {
          const slHit = pos.side === 'long' ? price <= pos.sl : price >= pos.sl;
          if (slHit) {
            await closePosition(pos.id, price, 'sl');
            showToast(`🛑 SL Hit! ${pos.symbol} closed`, T.red);
          }
        }
      }
    };
    const t = setInterval(() => void check(), 15_000);
    return () => clearInterval(t);
  }, [ticks, closePosition]);

  // ── Drag resize ──────────────────────────────────────────────────────────────
  const panHRef = useRef(DEFAULT_H);
  useEffect(() => { panHRef.current = panelHeight; }, [panelHeight]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 2,
      onPanResponderGrant: () => { panHRef.current = panHRef.current; },
      onPanResponderMove: (_, gs) => {
        const newH = Math.max(MIN_H, Math.min(screenH * 0.6, panHRef.current - gs.dy));
        setPanelHeight(Math.round(newH));
        if (newH > MIN_H + 4) setMinimized(false);
      },
    }),
  ).current;

  // ── Sort for positions tab ───────────────────────────────────────────────────
  const sortedPositions = useMemo(() => {
    return [...marketPositions].sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      if (sortKey === 'symbol') { av = a.symbol; bv = b.symbol; }
      else if (sortKey === 'side') { av = a.side; bv = b.side; }
      else if (sortKey === 'qty') { av = a.qty; bv = b.qty; }
      else if (sortKey === 'entry') { av = a.entryPrice; bv = b.entryPrice; }
      else if (sortKey === 'last') { av = getLivePrice(a); bv = getLivePrice(b); }
      else if (sortKey === 'pnl') { av = getPosPnl(a); bv = getPosPnl(b); }
      else if (sortKey === 'pct') { av = a.margin > 0 ? getPosPnl(a) / a.margin : 0; bv = b.margin > 0 ? getPosPnl(b) / b.margin : 0; }
      else if (sortKey === 'margin') { av = a.margin; bv = b.margin; }
      else if (sortKey === 'time') { av = a.openedAt; bv = b.openedAt; }
      if (typeof av === 'string') return av.localeCompare(bv as string) * sortDir;
      return ((av as number) - (bv as number)) * sortDir;
    });
  }, [marketPositions, sortKey, sortDir, getLivePrice, getPosPnl]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(-1); }
  };

  // ── Close position handler ───────────────────────────────────────────────────
  const handleClosePos = (pos: LedgerOpenPosition) => {
    const exitPrice = getLivePrice(pos);
    setConfirmClose({ pos, exitPrice });
  };

  const confirmClosePos = async () => {
    if (!confirmClose) return;
    const { pos, exitPrice } = confirmClose;
    const pnl = getPosPnl(pos);
    await closePosition(pos.id, exitPrice, 'manual');
    setConfirmClose(null);
    showToast(
      `Position closed: ${pnl >= 0 ? '+' : ''}${fmtLocal(pnl, sym)}`,
      pnl >= 0 ? T.green : T.red,
    );
  };

  // ── Edit TP/SL ───────────────────────────────────────────────────────────────
  const openEditTpSl = (pos: LedgerOpenPosition) => {
    setEditTpSl(pos);
    setTpDraft(pos.tp != null ? String(pos.tp) : '');
    setSlDraft(pos.sl != null ? String(pos.sl) : '');
  };

  const saveEditTpSl = async () => {
    if (!editTpSl) return;
    const tp = tpDraft ? parseFloat(tpDraft) : null;
    const sl = slDraft ? parseFloat(slDraft) : null;
    await updateTpSl(editTpSl.id, tp != null && isFinite(tp) ? tp : null, sl != null && isFinite(sl) ? sl : null);
    setEditTpSl(null);
  };

  // ── Export CSV ───────────────────────────────────────────────────────────────
  const exportCsv = () => {
    if (Platform.OS !== 'web') return;
    const header = ['Date', 'Symbol', 'Side', 'Qty', 'Entry', 'Exit', 'P&L', 'Fee Open', 'Fee Close', 'Net P&L', 'Duration (min)', 'Market'];
    const rows = marketClosed.map((t) => [
      t.closedAt,
      t.symbol,
      t.side.toUpperCase(),
      t.qty.toFixed(4),
      t.entryPrice.toFixed(4),
      t.exitPrice.toFixed(4),
      t.realizedPnl.toFixed(2),
      t.feeOpen.toFixed(4),
      t.feeClose.toFixed(4),
      t.realizedPnl.toFixed(2),
      t.holdMinutes,
      t.market,
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade_history_${marketId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Journal save ─────────────────────────────────────────────────────────────
  const handleSaveJournal = () => {
    if (!pendingJournalTrade) return;
    saveJournal(
      pendingJournalTrade.id,
      journalTag ? [journalTag] : [],
      journalEmotion ?? '',
      journalNotes,
    );
    setJournalTag(null);
    setJournalEmotion(null);
    setJournalNotes('');
  };

  // ── Column header helper ─────────────────────────────────────────────────────
  const ColH = ({ label, sk }: { label: string; sk?: SortKey }) => (
    <Pressable
      onPress={sk ? () => toggleSort(sk) : undefined}
      style={{ paddingHorizontal: 8, paddingVertical: 6, minWidth: 80, flexDirection: 'row', alignItems: 'center', gap: 2 }}
    >
      <Text style={{ color: T.text3, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>
        {label}
      </Text>
      {sk && sortKey === sk ? (
        <Text style={{ color: T.yellow, fontSize: 8 }}>{sortDir === 1 ? '↑' : '↓'}</Text>
      ) : null}
    </Pressable>
  );

  // ── Render body height ───────────────────────────────────────────────────────
  const bodyH = minimized ? 0 : panelHeight - TAB_BAR_H - (minimized ? 0 : 52) - 4; // 52 = stats bar approx
  const totalPanelH = minimized ? MIN_H : panelHeight;

  return (
    <View style={{ height: totalPanelH, backgroundColor: T.bg1, borderTopWidth: 1, borderTopColor: T.border }}>

      {/* ── Drag handle ───────────────────────────────────────────────────────── */}
      <View
        {...panResponder.panHandlers}
        style={{
          height: 6,
          width: '100%',
          backgroundColor: T.bg3,
          borderTopWidth: 1,
          borderTopColor: T.borderBright,
          alignItems: 'center',
          justifyContent: 'center',
          // @ts-ignore
          cursor: Platform.OS === 'web' ? 'row-resize' : undefined,
        }}
      >
        <View style={{ width: 32, height: 2, backgroundColor: T.text3, borderRadius: 1 }} />
      </View>

      {/* ── Stats bar ─────────────────────────────────────────────────────────── */}
      {!minimized ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexShrink: 0, backgroundColor: T.bg0 }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6, gap: 20, alignItems: 'center' }}
        >
          {[
            { label: 'Balance', value: fmtLocal(stats.balance, sym, 2), color: T.text0 },
            { label: 'Equity', value: fmtLocal(stats.equity, sym, 2), color: T.text0 },
            { label: "Today's P&L", value: (stats.realized >= 0 ? '+' : '') + fmtLocal(stats.realized, sym), color: stats.realized >= 0 ? T.green : T.red },
            { label: 'Unrealized P&L', value: (stats.unrealized >= 0 ? '+' : '') + fmtLocal(stats.unrealized, sym), color: stats.unrealized >= 0 ? T.green : T.red },
            { label: 'Available', value: fmtLocal(stats.availableFunds, sym, 2), color: T.yellow },
            { label: 'Margin Used', value: fmtLocal(stats.totalMargin, sym, 2), color: T.text2 },
            { label: 'Margin Buffer', value: stats.marginBuffer.toFixed(1) + '%', color: stats.marginBuffer < 20 ? T.red : T.green },
          ].map((s) => (
            <View key={s.label} style={{ alignItems: 'flex-start' }}>
              <Text style={{ color: T.text3, fontSize: 9, letterSpacing: 0.6 }}>{s.label.toUpperCase()}</Text>
              <Text style={{ color: s.color, fontSize: 12, fontWeight: '700', fontFamily: T.fontMono, marginTop: 1 }}>
                {s.value}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {/* ── Tab bar ───────────────────────────────────────────────────────────── */}
      <View
        style={{
          height: TAB_BAR_H,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: T.bg2,
          borderTopWidth: 1,
          borderTopColor: T.border,
          borderBottomWidth: 1,
          borderBottomColor: T.border,
          paddingHorizontal: 4,
          gap: 0,
        }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            const count = t.id === 'positions' ? marketPositions.length : 0;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                style={{
                  paddingHorizontal: 12,
                  height: TAB_BAR_H,
                  justifyContent: 'center',
                  borderBottomWidth: active ? 2 : 0,
                  borderBottomColor: T.yellow,
                  marginRight: 2,
                }}
              >
                <Text
                  style={{
                    color: active ? T.yellow : T.text3,
                    fontSize: 11,
                    fontWeight: active ? '800' : '600',
                  }}
                >
                  {t.label}
                  {count > 0 ? ` (${count})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => {
            if (minimized) {
              setMinimized(false);
              setPanelHeight(DEFAULT_H);
            } else {
              setMinimized(true);
            }
          }}
          style={{ paddingHorizontal: 10, paddingVertical: 4 }}
        >
          <Text style={{ color: T.text3, fontSize: 14 }}>{minimized ? '▲' : '▼'}</Text>
        </Pressable>
      </View>

      {/* ── Tab content ───────────────────────────────────────────────────────── */}
      {!minimized ? (
        <View style={{ flex: 1, overflow: 'hidden' }}>

          {/* POSITIONS TAB */}
          {tab === 'positions' ? (
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              {sortedPositions.length === 0 ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ color: T.text3, fontSize: 12 }}>No open positions in {cfg.name}</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', backgroundColor: T.bg2, borderBottomWidth: 1, borderBottomColor: T.border }}>
                      {[
                        { l: 'Symbol', sk: 'symbol' as SortKey, w: 90 },
                        { l: 'Side', sk: 'side' as SortKey, w: 64 },
                        { l: 'Qty', sk: 'qty' as SortKey, w: 70 },
                        { l: 'Avg Price', sk: 'entry' as SortKey, w: 90 },
                        { l: 'TP', w: 80 },
                        { l: 'SL', w: 80 },
                        { l: 'Last', sk: 'last' as SortKey, w: 90 },
                        { l: 'P&L', sk: 'pnl' as SortKey, w: 90 },
                        { l: 'P&L%', sk: 'pct' as SortKey, w: 72 },
                        { l: 'Margin', sk: 'margin' as SortKey, w: 82 },
                        { l: 'Leverage', w: 68 },
                        { l: 'Time', sk: 'time' as SortKey, w: 80 },
                        { l: '', w: 64 },
                      ].map((h) => (
                        <View key={h.l} style={{ width: h.w ?? 80 }}>
                          <ColH label={h.l} sk={h.sk} />
                        </View>
                      ))}
                    </View>

                    {/* Rows */}
                    {sortedPositions.map((pos) => {
                      const curPrice = getLivePrice(pos);
                      const pnl = getPosPnl(pos);
                      const pct = pos.margin > 0 ? (pnl / pos.margin) * 100 : 0;
                      const up = pnl >= 0;
                      const selected = selectedPosId === pos.id;

                      return (
                        <Pressable
                          key={pos.id}
                          onPress={() => setSelectedPosId(selected ? null : pos.id)}
                          style={({ pressed }) => ({
                            flexDirection: 'row',
                            backgroundColor: selected ? T.bg3 : pressed ? T.bg2 : 'transparent',
                            borderBottomWidth: 1,
                            borderBottomColor: T.border,
                            alignItems: 'center',
                          })}
                        >
                          {/* Symbol */}
                          <View style={{ width: 90, paddingHorizontal: 8, paddingVertical: 8 }}>
                            <Text style={{ color: pos.side === 'long' ? T.green : T.red, fontSize: 12, fontWeight: '700' }}>
                              {pos.symbol.replace('.NS', '').replace('-USD', '')}
                            </Text>
                          </View>
                          {/* Side */}
                          <View style={{ width: 64, paddingHorizontal: 8 }}>
                            <View style={{
                              paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3,
                              backgroundColor: pos.side === 'long' ? T.greenDim : T.redDim,
                              alignSelf: 'flex-start',
                            }}>
                              <Text style={{ color: pos.side === 'long' ? T.green : T.red, fontSize: 9, fontWeight: '800' }}>
                                {pos.side.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                          {/* Qty */}
                          <View style={{ width: 70, paddingHorizontal: 8 }}>
                            <Text style={{ color: T.text1, fontSize: 11, fontFamily: T.fontMono }}>{pos.qty.toFixed(4)}</Text>
                          </View>
                          {/* Avg price */}
                          <View style={{ width: 90, paddingHorizontal: 8 }}>
                            <Text style={{ color: T.text0, fontSize: 11, fontFamily: T.fontMono }}>{fmtLocal(pos.entryPrice, sym)}</Text>
                          </View>
                          {/* TP */}
                          <Pressable
                            style={{ width: 80, paddingHorizontal: 8 }}
                            onPress={(e) => { e.stopPropagation?.(); openEditTpSl(pos); }}
                          >
                            <Text style={{ color: pos.tp != null ? T.green : T.text3, fontSize: 11, fontFamily: T.fontMono }}>
                              {pos.tp != null ? fmtLocal(pos.tp, sym) : '—'}
                            </Text>
                          </Pressable>
                          {/* SL */}
                          <Pressable
                            style={{ width: 80, paddingHorizontal: 8 }}
                            onPress={(e) => { e.stopPropagation?.(); openEditTpSl(pos); }}
                          >
                            <Text style={{ color: pos.sl != null ? T.red : T.text3, fontSize: 11, fontFamily: T.fontMono }}>
                              {pos.sl != null ? fmtLocal(pos.sl, sym) : '—'}
                            </Text>
                          </Pressable>
                          {/* Last price */}
                          <View style={{ width: 90, paddingHorizontal: 8 }}>
                            <Text style={{ color: T.text0, fontSize: 11, fontWeight: '600', fontFamily: T.fontMono }}>{fmtLocal(curPrice, sym)}</Text>
                          </View>
                          {/* Unrealized P&L */}
                          <View style={{ width: 90, paddingHorizontal: 8 }}>
                            <Text style={{ color: up ? T.green : T.red, fontSize: 11, fontWeight: '700', fontFamily: T.fontMono }}>
                              {up ? '+' : ''}{fmtLocal(pnl, sym)}
                            </Text>
                          </View>
                          {/* P&L% */}
                          <View style={{ width: 72, paddingHorizontal: 8 }}>
                            <Text style={{ color: up ? T.green : T.red, fontSize: 11, fontWeight: '700' }}>{fmtPct(pct)}</Text>
                          </View>
                          {/* Margin */}
                          <View style={{ width: 82, paddingHorizontal: 8 }}>
                            <Text style={{ color: T.text2, fontSize: 11, fontFamily: T.fontMono }}>{fmtLocal(pos.margin, sym)}</Text>
                          </View>
                          {/* Leverage */}
                          <View style={{ width: 68, paddingHorizontal: 8 }}>
                            <Text style={{ color: T.yellow, fontSize: 11, fontWeight: '700' }}>{pos.leverage}x</Text>
                          </View>
                          {/* Time held */}
                          <View style={{ width: 80, paddingHorizontal: 8 }}>
                            <Text style={{ color: T.text3, fontSize: 10 }}>{formatTimeHeld(pos.openedAt)}</Text>
                          </View>
                          {/* Close button */}
                          <Pressable
                            onPress={(e) => { e.stopPropagation?.(); handleClosePos(pos); }}
                            style={({ pressed }) => ({
                              width: 64,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              marginRight: 8,
                              borderRadius: 4,
                              backgroundColor: pressed ? T.redDim : T.bg3,
                              borderWidth: 1,
                              borderColor: T.border,
                              alignItems: 'center',
                            })}
                          >
                            <Text style={{ color: T.text0, fontSize: 10, fontWeight: '700' }}>Close</Text>
                          </Pressable>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </ScrollView>
          ) : null}

          {/* ORDERS TAB */}
          {tab === 'orders' ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: T.text3, fontSize: 12 }}>No pending limit orders</Text>
              <Text style={{ color: T.text3, fontSize: 10, marginTop: 4 }}>Market orders execute immediately</Text>
            </View>
          ) : null}

          {/* ORDER HISTORY TAB */}
          {tab === 'history' ? (
            <ScrollView style={{ flex: 1 }}>
              {/* Export button */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: T.text3, fontSize: 10 }}>
                  {marketClosed.length} trades · {cfg.flag} {cfg.name}
                </Text>
                {Platform.OS === 'web' && marketClosed.length > 0 ? (
                  <Pressable
                    onPress={exportCsv}
                    style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: T.bg3, borderRadius: 4, borderWidth: 1, borderColor: T.border }}
                  >
                    <Text style={{ color: T.yellow, fontSize: 10, fontWeight: '700' }}>⬇ Export CSV</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Banner ad */}
              <View style={{ paddingHorizontal: 12 }}>
                <Text style={{ color: T.text3, fontSize: 8, letterSpacing: 1, marginBottom: 2 }}>ADVERTISEMENT</Text>
                <BannerAd slot="inline" refreshInterval={30_000} />
              </View>

              {marketClosed.length === 0 ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ color: T.text3, fontSize: 12 }}>No closed trades yet</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', backgroundColor: T.bg2, borderBottomWidth: 1, borderBottomColor: T.border }}>
                      {['Date/Time', 'Symbol', 'Side', 'Qty', 'Entry', 'Exit', 'P&L', 'Fee', 'Duration'].map((h) => (
                        <View key={h} style={{ width: 110, paddingHorizontal: 8, paddingVertical: 6 }}>
                          <Text style={{ color: T.text3, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>{h}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Rows */}
                    {marketClosed.map((t) => {
                      const win = t.win;
                      const fee = t.feeOpen + t.feeClose;
                      return (
                        <View
                          key={t.id}
                          style={{
                            flexDirection: 'row',
                            borderBottomWidth: 1,
                            borderBottomColor: T.border,
                            backgroundColor: win ? 'rgba(14,203,129,0.04)' : 'rgba(246,70,93,0.04)',
                            alignItems: 'center',
                          }}
                        >
                          <View style={{ width: 110, paddingHorizontal: 8, paddingVertical: 7 }}>
                            <Text style={{ color: T.text2, fontSize: 10 }}>{fmtDate(t.closedAt)}</Text>
                          </View>
                          <View style={{ width: 110, paddingHorizontal: 8 }}>
                            <Text style={{ color: T.text0, fontSize: 11, fontWeight: '700' }}>{t.symbol}</Text>
                          </View>
                          <View style={{ width: 110, paddingHorizontal: 8 }}>
                            <View style={{
                              paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3,
                              backgroundColor: t.side === 'long' ? T.greenDim : T.redDim,
                              alignSelf: 'flex-start',
                            }}>
                              <Text style={{ color: t.side === 'long' ? T.green : T.red, fontSize: 9, fontWeight: '800' }}>{t.side.toUpperCase()}</Text>
                            </View>
                          </View>
                          <View style={{ width: 110, paddingHorizontal: 8 }}>
                            <Text style={{ color: T.text2, fontSize: 11, fontFamily: T.fontMono }}>{t.qty.toFixed(4)}</Text>
                          </View>
                          <View style={{ width: 110, paddingHorizontal: 8 }}>
                            <Text style={{ color: T.text1, fontSize: 11, fontFamily: T.fontMono }}>{fmtLocal(t.entryPrice, sym)}</Text>
                          </View>
                          <View style={{ width: 110, paddingHorizontal: 8 }}>
                            <Text style={{ color: T.text1, fontSize: 11, fontFamily: T.fontMono }}>{fmtLocal(t.exitPrice, sym)}</Text>
                          </View>
                          <View style={{ width: 110, paddingHorizontal: 8 }}>
                            <Text style={{ color: win ? T.green : T.red, fontSize: 11, fontWeight: '700', fontFamily: T.fontMono }}>
                              {t.realizedPnl >= 0 ? '+' : ''}{fmtLocal(t.realizedPnl, sym)}
                            </Text>
                          </View>
                          <View style={{ width: 110, paddingHorizontal: 8 }}>
                            <Text style={{ color: T.red, fontSize: 11, fontFamily: T.fontMono }}>-{fmtLocal(fee, sym)}</Text>
                          </View>
                          <View style={{ width: 110, paddingHorizontal: 8 }}>
                            <Text style={{ color: T.text2, fontSize: 10 }}>
                              {t.wasTpHit ? '🎯 TP' : t.wasSlHit ? '🛑 SL' : '✋ Manual'} · {t.holdMinutes}m
                            </Text>
                          </View>
                        </View>
                      );
                    })}

                    {/* Summary row */}
                    {marketClosed.length > 0 ? (
                      <View style={{ flexDirection: 'row', borderTopWidth: 2, borderTopColor: T.border, backgroundColor: T.bg2 }}>
                        <View style={{ width: 110, paddingHorizontal: 8, paddingVertical: 8 }}>
                          <Text style={{ color: T.text2, fontSize: 10, fontWeight: '800' }}>TOTAL ({marketClosed.length})</Text>
                        </View>
                        {[null, null, null, null, null].map((_, i) => <View key={i} style={{ width: 110 }} />)}
                        <View style={{ width: 110, paddingHorizontal: 8, paddingVertical: 8 }}>
                          <Text style={{
                            color: marketClosed.reduce((s, t) => s + t.realizedPnl, 0) >= 0 ? T.green : T.red,
                            fontSize: 11, fontWeight: '800', fontFamily: T.fontMono,
                          }}>
                            {marketClosed.reduce((s, t) => s + t.realizedPnl, 0) >= 0 ? '+' : ''}
                            {fmtLocal(marketClosed.reduce((s, t) => s + t.realizedPnl, 0), sym)}
                          </Text>
                        </View>
                        <View style={{ width: 110, paddingHorizontal: 8, paddingVertical: 8 }}>
                          <Text style={{ color: T.red, fontSize: 11, fontWeight: '800', fontFamily: T.fontMono }}>
                            -{fmtLocal(marketClosed.reduce((s, t) => s + t.feeOpen + t.feeClose, 0), sym)}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </ScrollView>
              )}
            </ScrollView>
          ) : null}

          {/* BALANCE HISTORY TAB */}
          {tab === 'balance' ? (
            <BalanceHistoryTab balance={balance} sym={sym} />
          ) : null}

          {/* JOURNAL TAB */}
          {tab === 'journal' ? (
            <JournalTab journalByTradeId={journalByTradeId} closedTrades={closedTrades} marketId={marketId} />
          ) : null}

        </View>
      ) : null}

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      {toast ? (
        <View
          style={{
            position: 'absolute',
            bottom: 8,
            right: 16,
            backgroundColor: T.bg3,
            borderRadius: T.radiusMd,
            borderWidth: 1,
            borderColor: toast.color,
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: toast.color, fontSize: 12, fontWeight: '700' }}>{toast.msg}</Text>
        </View>
      ) : null}

      {/* ── Confirm Close Modal ────────────────────────────────────────────────── */}
      <Modal visible={!!confirmClose} transparent animationType="fade" onRequestClose={() => setConfirmClose(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setConfirmClose(null)}
        >
          <Pressable
            style={{ width: 320, backgroundColor: T.bg2, borderRadius: T.radiusLg, borderWidth: 1, borderColor: T.border, padding: 20, gap: 12 }}
            onPress={() => {}}
          >
            {confirmClose ? (() => {
              const { pos, exitPrice } = confirmClose;
              const pnl = getPosPnl(pos);
              const feeClose = (exitPrice * pos.qty) * ((MARKETS[pos.market].fees?.taker ?? 0.0005));
              const net = pnl - feeClose;
              return (
                <>
                  <Text style={{ color: T.text0, fontSize: 15, fontWeight: '800' }}>Close Position</Text>
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: T.text2, fontSize: 12 }}>{pos.symbol} {pos.side.toUpperCase()} {pos.leverage}x</Text>
                      <Text style={{ color: T.text2, fontSize: 12 }}>Qty: {pos.qty.toFixed(4)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: T.text3, fontSize: 12 }}>Entry</Text>
                      <Text style={{ color: T.text0, fontSize: 12, fontFamily: T.fontMono }}>{fmtLocal(pos.entryPrice, sym)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: T.text3, fontSize: 12 }}>Exit (market)</Text>
                      <Text style={{ color: T.text0, fontSize: 12, fontFamily: T.fontMono }}>{fmtLocal(exitPrice, sym)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: T.text3, fontSize: 12 }}>Gross P&L</Text>
                      <Text style={{ color: pnl >= 0 ? T.green : T.red, fontSize: 12, fontWeight: '700', fontFamily: T.fontMono }}>
                        {pnl >= 0 ? '+' : ''}{fmtLocal(pnl, sym)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: T.text3, fontSize: 12 }}>Fee</Text>
                      <Text style={{ color: T.red, fontSize: 12, fontFamily: T.fontMono }}>-{fmtLocal(feeClose, sym, 4)}</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: T.border }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: T.text0, fontSize: 13, fontWeight: '800' }}>Net P&L</Text>
                      <Text style={{ color: net >= 0 ? T.green : T.red, fontSize: 14, fontWeight: '800', fontFamily: T.fontMono }}>
                        {net >= 0 ? '+' : ''}{fmtLocal(net, sym)}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <Pressable
                      onPress={() => setConfirmClose(null)}
                      style={{ flex: 1, padding: 12, borderRadius: T.radiusMd, backgroundColor: T.bg3, alignItems: 'center' }}
                    >
                      <Text style={{ color: T.text2, fontWeight: '700' }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void confirmClosePos()}
                      style={{ flex: 1, padding: 12, borderRadius: T.radiusMd, backgroundColor: T.redDim, alignItems: 'center', borderWidth: 1, borderColor: T.red }}
                    >
                      <Text style={{ color: T.red, fontWeight: '800' }}>Close Position</Text>
                    </Pressable>
                  </View>
                </>
              );
            })() : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Edit TP/SL Modal ───────────────────────────────────────────────────── */}
      <Modal visible={!!editTpSl} transparent animationType="fade" onRequestClose={() => setEditTpSl(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setEditTpSl(null)}
        >
          <Pressable
            style={{ width: 300, backgroundColor: T.bg2, borderRadius: T.radiusLg, borderWidth: 1, borderColor: T.border, padding: 20, gap: 14 }}
            onPress={() => {}}
          >
            <Text style={{ color: T.text0, fontSize: 15, fontWeight: '800' }}>Edit TP / SL — {editTpSl?.symbol}</Text>
            <View style={{ gap: 10 }}>
              <View>
                <Text style={{ color: T.text3, fontSize: 11, marginBottom: 6 }}>Take Profit ({sym})</Text>
                <TextInput
                  value={tpDraft}
                  onChangeText={setTpDraft}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 300.00"
                  placeholderTextColor={T.text3}
                  style={{ color: T.green, backgroundColor: T.bg3, borderRadius: T.radiusSm, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, borderWidth: 1, borderColor: T.green, // @ts-ignore
                    outlineStyle: 'none' }}
                />
              </View>
              <View>
                <Text style={{ color: T.text3, fontSize: 11, marginBottom: 6 }}>Stop Loss ({sym})</Text>
                <TextInput
                  value={slDraft}
                  onChangeText={setSlDraft}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 250.00"
                  placeholderTextColor={T.text3}
                  style={{ color: T.red, backgroundColor: T.bg3, borderRadius: T.radiusSm, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, borderWidth: 1, borderColor: T.red, // @ts-ignore
                    outlineStyle: 'none' }}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setEditTpSl(null)}
                style={{ flex: 1, padding: 12, borderRadius: T.radiusMd, backgroundColor: T.bg3, alignItems: 'center' }}
              >
                <Text style={{ color: T.text2, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void saveEditTpSl()}
                style={{ flex: 1, padding: 12, borderRadius: T.radiusMd, backgroundColor: T.yellow, alignItems: 'center' }}
              >
                <Text style={{ color: '#000', fontWeight: '800' }}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Journal Prompt Modal ───────────────────────────────────────────────── */}
      <Modal visible={!!pendingJournalTrade} transparent animationType="fade" onRequestClose={() => dismissJournal()}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', padding: 16 }}
          onPress={() => dismissJournal()}
        >
          <Pressable
            style={{ width: 340, backgroundColor: T.bg2, borderRadius: T.radiusLg, borderWidth: 1, borderColor: T.border, padding: 20, gap: 14 }}
            onPress={() => {}}
          >
            {pendingJournalTrade ? (
              <>
                <Text style={{ color: T.text0, fontSize: 15, fontWeight: '800' }}>📓 Trade Journal</Text>
                <Text style={{ color: T.text2, fontSize: 12 }}>
                  {pendingJournalTrade.symbol} {pendingJournalTrade.side.toUpperCase()} closed{' '}
                  <Text style={{ color: pendingJournalTrade.win ? T.green : T.red, fontWeight: '700' }}>
                    {pendingJournalTrade.realizedPnl >= 0 ? '+' : ''}{fmtLocal(pendingJournalTrade.realizedPnl, sym)}
                  </Text>
                </Text>

                <View>
                  <Text style={{ color: T.text3, fontSize: 11, marginBottom: 8 }}>Entry Reason</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {ENTRY_REASONS.map((r) => (
                      <Pressable
                        key={r}
                        onPress={() => setJournalTag(journalTag === r ? null : r)}
                        style={{
                          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
                          backgroundColor: journalTag === r ? T.yellow : T.bg3,
                          borderWidth: 1, borderColor: journalTag === r ? T.yellow : T.border,
                        }}
                      >
                        <Text style={{ color: journalTag === r ? '#000' : T.text2, fontSize: 11, fontWeight: '700' }}>{r}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View>
                  <Text style={{ color: T.text3, fontSize: 11, marginBottom: 8 }}>Emotion</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {EMOTIONS.map((e) => (
                      <Pressable
                        key={e}
                        onPress={() => setJournalEmotion(journalEmotion === e ? null : e)}
                        style={{
                          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
                          backgroundColor: journalEmotion === e ? T.blue : T.bg3,
                          borderWidth: 1, borderColor: journalEmotion === e ? T.blue : T.border,
                        }}
                      >
                        <Text style={{ color: journalEmotion === e ? '#fff' : T.text2, fontSize: 11, fontWeight: '700' }}>{e}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <TextInput
                  value={journalNotes}
                  onChangeText={setJournalNotes}
                  placeholder="Notes (optional)..."
                  placeholderTextColor={T.text3}
                  multiline
                  style={{
                    color: T.text0, backgroundColor: T.bg3, borderRadius: T.radiusSm,
                    paddingHorizontal: 12, paddingVertical: 8, fontSize: 12,
                    borderWidth: 1, borderColor: T.border, minHeight: 60,
                    // @ts-ignore
                    outlineStyle: 'none',
                  }}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={() => dismissJournal()}
                    style={{ flex: 1, padding: 12, borderRadius: T.radiusMd, backgroundColor: T.bg3, alignItems: 'center' }}
                  >
                    <Text style={{ color: T.text2, fontWeight: '700' }}>Skip</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSaveJournal}
                    style={{ flex: 1, padding: 12, borderRadius: T.radiusMd, backgroundColor: T.yellow, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#000', fontWeight: '800' }}>Save Entry</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

// ─── Balance History Tab ──────────────────────────────────────────────────────

function BalanceHistoryTab({ balance, sym }: { balance: number; sym: string }) {
  const equityCurve = useLedgerStore((s) => s.equityCurve);

  const events = useMemo(() => {
    if (equityCurve.length === 0) return [];
    return [...equityCurve].reverse().slice(0, 200);
  }, [equityCurve]);

  if (events.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: T.text3, fontSize: 12 }}>No balance history yet</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', backgroundColor: T.bg2, paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: T.border }}>
        {['Time', 'Equity (USD)', 'Change'].map((h) => (
          <Text key={h} style={{ flex: 1, color: T.text3, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }}>{h.toUpperCase()}</Text>
        ))}
      </View>
      {events.map((pt, i) => {
        const prev = events[i + 1];
        const delta = prev ? pt.equityUsd - prev.equityUsd : 0;
        return (
          <View
            key={pt.ts}
            style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.border }}
          >
            <Text style={{ flex: 1, color: T.text2, fontSize: 11 }}>{new Date(pt.ts).toLocaleTimeString()}</Text>
            <Text style={{ flex: 1, color: T.text0, fontSize: 11, fontFamily: T.fontMono }}>{sym}{pt.equityUsd.toFixed(2)}</Text>
            <Text style={{ flex: 1, color: delta >= 0 ? T.green : T.red, fontSize: 11, fontWeight: '700', fontFamily: T.fontMono }}>
              {delta !== 0 ? (delta >= 0 ? '+' : '') + delta.toFixed(2) : '—'}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Journal Tab ──────────────────────────────────────────────────────────────

function JournalTab({
  journalByTradeId,
  closedTrades,
  marketId,
}: {
  journalByTradeId: Record<string, import('@/types/ledger').JournalEntry>;
  closedTrades: LedgerClosedTrade[];
  marketId: MarketId;
}) {
  const entries = useMemo(() => {
    return Object.entries(journalByTradeId)
      .map(([tradeId, entry]) => {
        const trade = closedTrades.find((t) => t.id === tradeId);
        return { entry, trade };
      })
      .filter((e) => e.trade?.market === marketId)
      .sort((a, b) => (a.entry.savedAt > b.entry.savedAt ? -1 : 1));
  }, [journalByTradeId, closedTrades, marketId]);

  if (entries.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 }}>
        <Text style={{ color: T.text3, fontSize: 12 }}>No journal entries yet</Text>
        <Text style={{ color: T.text3, fontSize: 10 }}>After closing a trade you'll be prompted to log your thoughts</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 10 }}>
      {entries.map(({ entry, trade }) => (
        <View
          key={entry.tradeId}
          style={{
            backgroundColor: T.bg2,
            borderRadius: T.radiusMd,
            borderWidth: 1,
            borderColor: T.border,
            borderLeftWidth: 3,
            borderLeftColor: trade?.win ? T.green : T.red,
            padding: 12,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: T.text0, fontSize: 12, fontWeight: '800' }}>
              {trade?.symbol ?? '—'} {trade?.side?.toUpperCase()}
            </Text>
            <Text style={{ color: trade?.win ? T.green : T.red, fontSize: 12, fontWeight: '700' }}>
              {(trade?.realizedPnl ?? 0) >= 0 ? '+' : ''}{(trade?.realizedPnl ?? 0).toFixed(2)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {entry.entryTags.map((tag) => (
              <View key={tag} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(240,185,11,0.15)' }}>
                <Text style={{ color: T.yellow, fontSize: 10, fontWeight: '700' }}>{tag}</Text>
              </View>
            ))}
            {entry.emotion ? (
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.15)' }}>
                <Text style={{ color: T.blue, fontSize: 10, fontWeight: '700' }}>{entry.emotion}</Text>
              </View>
            ) : null}
          </View>
          {entry.notes ? <Text style={{ color: T.text2, fontSize: 11, lineHeight: 16 }}>{entry.notes}</Text> : null}
          <Text style={{ color: T.text3, fontSize: 10 }}>{new Date(entry.savedAt).toLocaleString()}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
