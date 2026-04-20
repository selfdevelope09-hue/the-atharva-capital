/**
 * Multi-watchlist UI for one market — wired to `marketWatchlistRepository`.
 * Uses inline styles only; star / bottom-sheet flows can wrap this list manager.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { AppMarket } from '@/constants/appMarkets';
import {
  createMarketWatchlist,
  ensureDefaultMarketWatchlist,
  loadMarketWatchlists,
  MAX_LISTS_PER_MARKET,
  removeMarketWatchlist,
  saveMarketWatchlist,
  type MarketWatchlistDoc,
} from '@/services/firebase/marketWatchlistRepository';
import { auth, isFirebaseConfigured } from '@/config/firebaseConfig';

import { MARKETS, type MarketId } from '../../constants/markets';
import { T } from '../../constants/theme';

const PRESET_COLORS = ['#f0b90b', '#FF6B35', '#00C805', '#7B68EE', '#00B4D8', '#C8A951'];

export interface WatchlistSystemProps {
  market: AppMarket;
  /** Called when user taps a symbol row (e.g. navigate to trade). */
  onTradeSymbol?: (symbol: string) => void;
}

export function WatchlistSystem({ market, onTradeSymbol }: WatchlistSystemProps) {
  const cfg = MARKETS[market as MarketId];
  const [lists, setLists] = useState<MarketWatchlistDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const refresh = useCallback(async () => {
    if (!isFirebaseConfigured || !auth?.currentUser) {
      setLists([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await ensureDefaultMarketWatchlist(market);
      const data = await loadMarketWatchlists(market);
      setLists(data);
      setSelectedId((prev) => {
        if (prev && data.some((d) => d.id === prev)) return prev;
        return data[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [market]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = lists.find((l) => l.id === selectedId) ?? lists[0];

  const onCreate = async () => {
    const name = newName.trim() || `My ${cfg?.name ?? market} Picks`;
    try {
      const id = await createMarketWatchlist(market, { name, color: newColor });
      setNewName('');
      setCreateOpen(false);
      await refresh();
      setSelectedId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    }
  };

  const onDelete = async (id: string) => {
    try {
      await removeMarketWatchlist(market, id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const onToggleSymbol = async (symbol: string) => {
    if (!selected) return;
    const symU = symbol.toUpperCase();
    const has = selected.symbols.includes(symU);
    const next = has ? selected.symbols.filter((s) => s !== symU) : [...selected.symbols, symU];
    try {
      await saveMarketWatchlist(market, selected.id, {
        name: selected.name,
        symbols: next,
        color: selected.color,
        createdAt: selected.createdAt,
        order: selected.order,
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  };

  if (loading && lists.length === 0) {
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <ActivityIndicator color={T.yellow} />
      </View>
    );
  }

  if (!isFirebaseConfigured || !auth?.currentUser) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: T.text2, fontSize: 13 }}>Sign in to sync watchlists for {cfg?.name ?? market}.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Text style={{ color: T.text0, fontSize: 16, fontWeight: '800' }}>
          {cfg?.flag} Watchlists ({lists.length}/{MAX_LISTS_PER_MARKET})
        </Text>
        <Pressable
          onPress={() => setCreateOpen(true)}
          disabled={lists.length >= MAX_LISTS_PER_MARKET}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: lists.length >= MAX_LISTS_PER_MARKET ? T.bg3 : T.bg2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: T.text0, fontSize: 22, fontWeight: '700' }}>+</Text>
        </Pressable>
      </View>

      {error ? <Text style={{ color: T.red, fontSize: 12 }}>{error}</Text> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {lists.map((wl) => {
          const active = wl.id === selectedId;
          return (
            <Pressable
              key={wl.id}
              onPress={() => setSelectedId(wl.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: active ? wl.color : T.border,
                backgroundColor: T.bg1,
                maxWidth: 200,
              }}
            >
              <Text style={{ color: T.text0, fontWeight: '700' }} numberOfLines={1}>
                {wl.name}
              </Text>
              <Text style={{ color: T.text3, fontSize: 11, marginTop: 2 }}>{wl.symbols.length} symbols</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {selected ? (
        <View style={{ borderTopWidth: 1, borderColor: T.border, paddingTop: 12, gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: T.text1, fontSize: 12, fontWeight: '700' }}>Symbols in “{selected.name}”</Text>
            <Pressable onPress={() => onDelete(selected.id)}>
              <Text style={{ color: T.red, fontSize: 12, fontWeight: '700' }}>Delete list</Text>
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 220 }}>
            {(cfg?.pairs ?? []).map((sym) => {
              const inList = selected.symbols.includes(sym.toUpperCase());
              return (
                <View
                  key={sym}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderColor: T.border,
                    gap: 8,
                  }}
                >
                  <Pressable onPress={() => onToggleSymbol(sym)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: inList ? T.yellow : T.text3, fontSize: 16 }}>{inList ? '★' : '☆'}</Text>
                    <Text style={{ color: T.text0, fontWeight: '600' }}>{sym}</Text>
                  </Pressable>
                  {onTradeSymbol ? (
                    <Pressable onPress={() => onTradeSymbol(sym)}>
                      <Text style={{ color: T.green, fontSize: 12, fontWeight: '700' }}>Trade →</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <Modal visible={createOpen} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }} onPress={() => setCreateOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: T.bg1, borderRadius: T.radiusLg, padding: 20, borderWidth: 1, borderColor: T.border }}
          >
            <Text style={{ color: T.text0, fontWeight: '800', marginBottom: 12 }}>New watchlist</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder={`My ${cfg?.name ?? market} Picks`}
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
                  onPress={() => setNewColor(c)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: c,
                    borderWidth: newColor === c ? 3 : 0,
                    borderColor: T.text0,
                  }}
                />
              ))}
            </View>
            <Pressable
              onPress={onCreate}
              style={{ backgroundColor: newColor, padding: 14, borderRadius: T.radiusMd, alignItems: 'center' }}
            >
              <Text style={{ color: '#000', fontWeight: '800' }}>Create</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
