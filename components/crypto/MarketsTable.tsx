import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import {
  CRYPTO_THEME,
  displayBase,
  formatCompactUsd,
  formatPct,
  formatPrice,
} from '@/components/crypto/cryptoTheme';
import type { PriceTick } from '@/contexts/PriceContext';
import { useCryptoWatchlistStore } from '@/store/cryptoWatchlistStore';

export type SortKey = 'symbol' | 'price' | 'changePct24h' | 'quoteVolume';
type SortDir = 'asc' | 'desc';

export type MarketsTableProps = {
  rows: PriceTick[];
  onTradePress: (symbol: string) => void;
  /** When true, row list is already filtered to starred rows. */
  watchlistOnly?: boolean;
};

/** Sortable, searchable markets table with watchlist star toggle. */
export function MarketsTable({ rows, onTradePress, watchlistOnly }: MarketsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('quoteVolume');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    const copy = rows.slice();
    copy.sort((a, b) => {
      const va = readSort(a, sortKey);
      const vb = readSort(b, sortKey);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const bumpSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir(k === 'symbol' ? 'asc' : 'desc');
    }
  };

  return (
    <View
      style={{
        marginTop: 16,
        borderWidth: 1,
        borderColor: CRYPTO_THEME.border,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: CRYPTO_THEME.surface,
      }}>
      <HeaderRow sortKey={sortKey} sortDir={sortDir} onSort={bumpSort} />
      {sorted.length === 0 ? (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: CRYPTO_THEME.textMuted, fontSize: 13 }}>
            {watchlistOnly
              ? 'No starred coins yet. Tap a ☆ on any row to add it here.'
              : 'No matching markets.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.symbol}
          renderItem={({ item }) => <Row tick={item} onTradePress={onTradePress} />}
          initialNumToRender={24}
          windowSize={8}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

function readSort(t: PriceTick, k: SortKey): number | string {
  switch (k) {
    case 'symbol':
      return t.symbol;
    case 'price':
      return t.price;
    case 'changePct24h':
      return t.changePct24h;
    case 'quoteVolume':
      return t.quoteVolume;
    default:
      return 0;
  }
}

function HeaderRow({
  sortKey,
  sortDir,
  onSort,
}: {
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: CRYPTO_THEME.border,
        backgroundColor: CRYPTO_THEME.surfaceAlt,
      }}>
      <View style={{ width: 32 }} />
      <HeaderCell
        label="Symbol"
        active={sortKey === 'symbol'}
        dir={sortDir}
        onPress={() => onSort('symbol')}
        flex={2}
        align="left"
      />
      <HeaderCell
        label="Price"
        active={sortKey === 'price'}
        dir={sortDir}
        onPress={() => onSort('price')}
        flex={2}
        align="right"
      />
      <HeaderCell
        label="24h %"
        active={sortKey === 'changePct24h'}
        dir={sortDir}
        onPress={() => onSort('changePct24h')}
        flex={1.2}
        align="right"
      />
      <HeaderCell
        label="24h Vol"
        active={sortKey === 'quoteVolume'}
        dir={sortDir}
        onPress={() => onSort('quoteVolume')}
        flex={1.6}
        align="right"
      />
      <View style={{ width: 80 }} />
    </View>
  );
}

function HeaderCell({
  label,
  active,
  dir,
  onPress,
  flex,
  align,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onPress: () => void;
  flex: number;
  align: 'left' | 'right';
}) {
  const arrow = active ? (dir === 'asc' ? ' ↑' : ' ↓') : '';
  return (
    <Pressable onPress={onPress} style={{ flex, paddingHorizontal: 4 }}>
      <Text
        style={{
          color: active ? CRYPTO_THEME.accent : CRYPTO_THEME.textMuted,
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          textAlign: align,
        }}>
        {label}
        {arrow}
      </Text>
    </Pressable>
  );
}

function Row({ tick, onTradePress }: { tick: PriceTick; onTradePress: (s: string) => void }) {
  const isStarred = useCryptoWatchlistStore((s) => s.stars.has(tick.symbol));
  const toggle = useCryptoWatchlistStore((s) => s.toggle);
  const up = tick.changePct24h >= 0;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: CRYPTO_THEME.border,
      }}>
      <Pressable
        onPress={() => toggle(tick.symbol)}
        hitSlop={8}
        style={{ width: 32, alignItems: 'center' }}
        accessibilityRole="button"
        accessibilityLabel={isStarred ? `Unstar ${tick.symbol}` : `Star ${tick.symbol}`}>
        <Text
          style={{
            fontSize: 16,
            color: isStarred ? CRYPTO_THEME.accent : CRYPTO_THEME.textDim,
          }}>
          {isStarred ? '★' : '☆'}
        </Text>
      </Pressable>
      <View style={{ flex: 2, flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={{ color: CRYPTO_THEME.text, fontSize: 14, fontWeight: '700' }}>
          {displayBase(tick.symbol)}
        </Text>
        <Text style={{ color: CRYPTO_THEME.textMuted, fontSize: 10, marginLeft: 4 }}>/USDT</Text>
      </View>
      <Text
        style={{
          flex: 2,
          color: CRYPTO_THEME.text,
          fontSize: 13,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
          textAlign: 'right',
        }}>
        ${formatPrice(tick.price)}
      </Text>
      <Text
        style={{
          flex: 1.2,
          color: up ? CRYPTO_THEME.up : CRYPTO_THEME.down,
          fontSize: 13,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
          textAlign: 'right',
        }}>
        {formatPct(tick.changePct24h)}
      </Text>
      <Text
        style={{
          flex: 1.6,
          color: CRYPTO_THEME.textMuted,
          fontSize: 12,
          fontVariant: ['tabular-nums'],
          textAlign: 'right',
        }}>
        {formatCompactUsd(tick.quoteVolume)}
      </Text>
      <Pressable
        onPress={() => onTradePress(tick.symbol)}
        style={{
          width: 80,
          height: 30,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: CRYPTO_THEME.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 8,
        }}>
        <Text style={{ color: CRYPTO_THEME.accent, fontSize: 12, fontWeight: '800' }}>
          Trade →
        </Text>
      </Pressable>
    </View>
  );
}
