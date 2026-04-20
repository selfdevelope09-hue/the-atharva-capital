import FontAwesome from '@expo/vector-icons/FontAwesome';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { auth, isFirebaseConfigured } from '@/config/firebaseConfig';
import type { WatchlistDoc } from '@/services/firebase/watchlistRepository';
import type { ThemePalette } from '@/store/themeStore';
import { useThemeStore } from '@/store/themeStore';
import { useWatchlistListsStore } from '@/store/watchlistListsStore';

export type WatchlistRow = {
  symbol: string;
  name: string;
  ltp: number;
  changePct: number;
};

const STATIC_SEED: WatchlistRow[] = [
  { symbol: 'NIFTY', name: 'Nifty 50', ltp: 22487.55, changePct: 0.42 },
  { symbol: 'BANKNIFTY', name: 'Bank Nifty', ltp: 48126.3, changePct: -0.18 },
  { symbol: 'RELIANCE', name: 'Reliance Ind.', ltp: 2894.2, changePct: 1.12 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', ltp: 1642.75, changePct: -0.64 },
  { symbol: 'SBIN', name: 'State Bank', ltp: 812.35, changePct: 0.09 },
];

function rowFromSymbol(sym: string): WatchlistRow {
  const u = sym.toUpperCase();
  const hit = STATIC_SEED.find((r) => r.symbol === u);
  if (hit) return hit;
  let h = 0;
  for (let i = 0; i < u.length; i++) h += u.charCodeAt(i) * (i + 3);
  return {
    symbol: u,
    name: u,
    ltp: Math.round((500 + ((h % 50_000) / 10)) * 100) / 100,
    changePct: Math.round(((h % 400) - 200)) / 100,
  };
}

function formatLtp(v: number): string {
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const GUEST_MAIN = 'guest_main';

type WatchlistProps = {
  onSelect: (row: WatchlistRow) => void;
  /** Legacy static rows; when omitted, Firestore / guest lists drive symbols. */
  rows?: WatchlistRow[];
  title?: string;
};

type WatchlistRowItemProps = {
  row: WatchlistRow;
  palette: ThemePalette;
  onPress: (row: WatchlistRow) => void;
};

const WatchlistRowItem = memo(function WatchlistRowItem({ row, palette, onPress }: WatchlistRowItemProps) {
  const up = row.changePct >= 0;
  const color = up ? '#22c55e' : '#f87171';
  const sign = up ? '+' : '';
  return (
    <Pressable
      onPress={() => onPress(row)}
      className="border-b px-2 py-1.5 active:opacity-80"
      style={{ borderColor: palette.border }}>
      <View className="flex-row items-start justify-between">
        <View className="min-w-0 flex-1 pr-1.5">
          <Text className="font-mono text-[12px] font-bold tabular-nums" style={{ color: palette.text }}>
            {row.symbol}
          </Text>
          <Text className="mt-0.5 font-sans text-[10px]" style={{ color: palette.textMuted }} numberOfLines={1}>
            {row.name}
          </Text>
        </View>
        <View className="items-end">
          <Text className="font-mono text-[12px] font-semibold tabular-nums" style={{ color: palette.text }}>
            {formatLtp(row.ltp)}
          </Text>
          <Text className="mt-0.5 font-mono text-[10px] font-semibold tabular-nums" style={{ color }}>
            {sign}
            {row.changePct.toFixed(2)}%
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

function WatchlistInner({ onSelect, rows: rowsOverride, title = 'Watchlist' }: WatchlistProps) {
  const palette = useThemeStore((s) => s.palette);
  const storeLists = useWatchlistListsStore((s) => s.lists);
  const activeListId = useWatchlistListsStore((s) => s.activeListId);
  const loading = useWatchlistListsStore((s) => s.loading);
  const refresh = useWatchlistListsStore((s) => s.refresh);
  const selectList = useWatchlistListsStore((s) => s.selectList);
  const createList = useWatchlistListsStore((s) => s.createList);
  const renameList = useWatchlistListsStore((s) => s.renameList);
  const deleteList = useWatchlistListsStore((s) => s.deleteList);
  const setSymbolsForActive = useWatchlistListsStore((s) => s.setSymbolsForActive);

  const [guestLists, setGuestLists] = useState<WatchlistDoc[]>([
    { id: GUEST_MAIN, name: 'Main', symbols: STATIC_SEED.map((r) => r.symbol), order: 0 },
  ]);
  const [guestActiveId, setGuestActiveId] = useState(GUEST_MAIN);
  const [newNameOpen, setNewNameOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [addSym, setAddSym] = useState('');

  const signedIn = Boolean(isFirebaseConfigured && auth?.currentUser);
  const lists = signedIn ? storeLists : guestLists;
  const activeId = signedIn ? activeListId : guestActiveId;
  const activeList = lists.find((l) => l.id === activeId) ?? lists[0];

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const displayRows = useMemo(() => {
    if (rowsOverride?.length) return rowsOverride;
    const syms = activeList?.symbols ?? [];
    return syms.map(rowFromSymbol);
  }, [rowsOverride, activeList?.symbols]);

  const handleRowPress = useCallback((r: WatchlistRow) => onSelect(r), [onSelect]);

  const persistSymbols = useCallback(
    async (symbols: string[]) => {
      if (signedIn) {
        await setSymbolsForActive(symbols);
        return;
      }
      setGuestLists((prev) =>
        prev.map((l) => (l.id === guestActiveId ? { ...l, symbols } : l))
      );
    },
    [guestActiveId, setSymbolsForActive, signedIn]
  );

  const onCreate = useCallback(async () => {
    const name = draftName.trim() || 'New list';
    if (signedIn) {
      await createList(name);
    } else {
      const id = `g_${Math.random().toString(36).slice(2, 9)}`;
      setGuestLists((p) => [...p, { id, name, symbols: [], order: p.length }]);
      setGuestActiveId(id);
    }
    setDraftName('');
    setNewNameOpen(false);
  }, [createList, draftName, signedIn]);

  const onRename = useCallback(async () => {
    if (!activeList) return;
    const name = draftName.trim() || activeList.name;
    if (signedIn) {
      await renameList(activeList.id, name);
    } else {
      setGuestLists((p) => p.map((l) => (l.id === activeList.id ? { ...l, name } : l)));
    }
    setDraftName('');
    setRenameOpen(false);
  }, [activeList, draftName, renameList, signedIn]);

  const onDelete = useCallback(() => {
    if (!activeList) return;
    Alert.alert('Delete list', `Remove “${activeList.name}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            if (signedIn) {
              await deleteList(activeList.id);
            } else {
              setGuestLists((p) => p.filter((l) => l.id !== activeList.id));
              setGuestActiveId((id) => (id === activeList.id ? GUEST_MAIN : id));
            }
          })();
        },
      },
    ]);
  }, [activeList, deleteList, signedIn]);

  const addSymbol = useCallback(async () => {
    const sym = addSym.trim().toUpperCase();
    if (!sym || !activeList) return;
    if (activeList.symbols.includes(sym)) {
      setAddSym('');
      return;
    }
    await persistSymbols([...activeList.symbols, sym]);
    setAddSym('');
  }, [activeList, addSym, persistSymbols]);

  if (rowsOverride?.length) {
    return (
      <View className="h-full" style={{ borderColor: palette.border, backgroundColor: palette.bg }}>
        <View
          className="flex-row items-center justify-between border-b px-2 py-1.5"
          style={{ borderColor: palette.border }}>
          <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
            {title}
          </Text>
        </View>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {rowsOverride.map((r) => (
            <WatchlistRowItem key={r.symbol} row={r} palette={palette} onPress={handleRowPress} />
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="h-full" style={{ borderColor: palette.border, backgroundColor: palette.bg }}>
      <View
        className="flex-row flex-wrap items-center gap-1.5 border-b px-2 py-1"
        style={{ borderColor: palette.border }}>
        <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
          {title}
        </Text>
        {loading ? <Text className="text-[10px] text-neutral-500">Sync…</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-h-9 flex-1">
          <View className="flex-row items-center gap-1.5 pr-2">
            {lists.map((l) => {
              const on = l.id === activeId;
              return (
                <Pressable
                  key={l.id}
                  onPress={() => {
                    if (signedIn) void selectList(l.id);
                    else setGuestActiveId(l.id);
                  }}
                  className="rounded-full border px-2.5 py-1"
                  style={{
                    borderColor: on ? palette.accent : palette.border,
                    backgroundColor: on ? `${palette.accent}22` : palette.surface2,
                  }}>
                  <Text className="text-[11px] font-bold" style={{ color: palette.text }} numberOfLines={1}>
                    {l.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View className="flex-row flex-wrap gap-1.5 border-b px-2 py-1" style={{ borderColor: palette.border }}>
        <Pressable
          onPress={() => {
            setDraftName('');
            setNewNameOpen(true);
          }}
          className="flex-row items-center gap-1 rounded border px-1.5 py-1 active:opacity-80"
          style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
          <FontAwesome name="plus" size={12} color={palette.textMuted} />
          <Text className="text-[11px] font-semibold" style={{ color: palette.textMuted }}>
            New
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (!activeList) return;
            setDraftName(activeList.name);
            setRenameOpen(true);
          }}
          className="flex-row items-center gap-1 rounded border px-1.5 py-1 active:opacity-80"
          style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
          <FontAwesome name="pencil" size={12} color={palette.textMuted} />
          <Text className="text-[11px] font-semibold" style={{ color: palette.textMuted }}>
            Rename
          </Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          className="flex-row items-center gap-1 rounded border px-1.5 py-1 active:opacity-80"
          style={{ borderColor: '#7f1d1d', backgroundColor: 'rgba(127,29,29,0.2)' }}>
          <FontAwesome name="trash" size={12} color="#fca5a5" />
          <Text className="text-[11px] font-semibold text-red-200">Delete</Text>
        </Pressable>
        {!signedIn ? (
          <Text className="flex-1 text-[10px]" style={{ color: palette.textMuted }}>
            Sign in to sync lists to the cloud.
          </Text>
        ) : null}
      </View>

      <View className="flex-row items-center gap-1.5 border-b px-2 py-1" style={{ borderColor: palette.border }}>
        <TextInput
          value={addSym}
          onChangeText={setAddSym}
          placeholder="Add symbol"
          placeholderTextColor={palette.textMuted}
          autoCapitalize="characters"
          className="min-w-0 flex-1 rounded border px-2 py-1.5 text-sm"
          style={{ borderColor: palette.border, color: palette.text, backgroundColor: palette.surface2 }}
        />
        <Pressable
          onPress={() => void addSymbol()}
          className="rounded border px-2 py-1.5 active:opacity-80"
          style={{ borderColor: palette.accent, backgroundColor: `${palette.accent}22` }}>
          <Text className="text-xs font-bold" style={{ color: palette.accent }}>
            Add
          </Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {displayRows.map((r) => (
          <WatchlistRowItem key={r.symbol} row={r} palette={palette} onPress={handleRowPress} />
        ))}
      </ScrollView>

      <Modal visible={newNameOpen} transparent animationType="fade" onRequestClose={() => setNewNameOpen(false)}>
        <Pressable className="flex-1 justify-center bg-black/60 px-6" onPress={() => setNewNameOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="rounded-2xl border p-4"
            style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
            <Text className="text-sm font-bold" style={{ color: palette.text }}>
              New watchlist
            </Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="List name"
              placeholderTextColor={palette.textMuted}
              className="mt-3 rounded-lg border px-3 py-2 text-base"
              style={{ borderColor: palette.border, color: palette.text }}
            />
            <View className="mt-4 flex-row justify-end gap-2">
              <Pressable onPress={() => setNewNameOpen(false)} className="px-3 py-2">
                <Text style={{ color: palette.textMuted }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void onCreate()}
                className="rounded-lg px-4 py-2"
                style={{ backgroundColor: palette.accent }}>
                <Text className="font-bold text-black">Create</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <Pressable className="flex-1 justify-center bg-black/60 px-6" onPress={() => setRenameOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="rounded-2xl border p-4"
            style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
            <Text className="text-sm font-bold" style={{ color: palette.text }}>
              Rename list
            </Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="List name"
              placeholderTextColor={palette.textMuted}
              className="mt-3 rounded-lg border px-3 py-2 text-base"
              style={{ borderColor: palette.border, color: palette.text }}
            />
            <View className="mt-4 flex-row justify-end gap-2">
              <Pressable onPress={() => setRenameOpen(false)} className="px-3 py-2">
                <Text style={{ color: palette.textMuted }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void onRename()}
                className="rounded-lg px-4 py-2"
                style={{ backgroundColor: palette.accent }}>
                <Text className="font-bold text-black">Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export const Watchlist = memo(WatchlistInner);
