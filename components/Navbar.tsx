import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarketSwitcher } from '@/components/MarketSwitcher';
import { activeMarketFromSearchHit } from '@/lib/searchRouting';
import { unifiedSearch, type UnifiedSearchHit } from '@/services/api/searchService';
import { type ActiveMarket, useMarketStore } from '@/store/marketStore';
import { useThemeStore } from '@/store/themeStore';
import { useUiStore } from '@/store/uiStore';
import { useWalletStore } from '@/store/walletStore';

type NavbarProps = {
  onOpenWatchlist?: () => void;
  showWatchlistTrigger?: boolean;
  isWide?: boolean;
};

function searchPlaceholder(market: ActiveMarket, isWide: boolean): string {
  if (market === 'INDIA') return isWide ? 'Search: RELIANCE, NIFTY, BANKNIFTY…' : 'Search…';
  if (market === 'US') return isWide ? 'Search: AAPL, TSLA, NVDA…' : 'Search…';
  if (market === 'CHINA')
    return isWide ? 'Search: 0700.HK, 9988.HK, 600519, 002594…' : 'Search…';
  if (market === 'JAPAN')
    return isWide ? 'Search: 7203.T, 6758.T, 9984.T, 7974.T…' : 'Search…';
  if (market === 'UK')
    return isWide ? 'Search: SHEL.L, HSBA.L, AZN.L, ULVR.L…' : 'Search…';
  if (market === 'AUSTRALIA')
    return isWide ? 'Search: BHP.AX, CBA.AX, CSL.AX, MQG.AX…' : 'Search…';
  if (market === 'GERMANY')
    return isWide ? 'Search: SAP.DE, SIE.DE, ALV.DE, VOW3.DE…' : 'Search…';
  if (market === 'CANADA')
    return isWide ? 'Search: SHOP.TO, RY.TO, TD.TO, ENB.TO…' : 'Search…';
  if (market === 'SWITZERLAND')
    return isWide ? 'Search: NESN.SW, NOVN.SW, ROG.SW, UBSG.SW…' : 'Search…';
  return isWide ? 'Search: BTC, ETH, SOL…' : 'Search…';
}

function walletSub(market: ActiveMarket): string {
  if (market === 'INDIA') return 'USD base · INR display';
  if (market === 'US') return 'Virtual USD';
  if (market === 'CHINA') return 'USD base · CN¥ display';
  if (market === 'JAPAN') return 'USD base · JP¥ display';
  if (market === 'UK') return 'USD base · £ display';
  if (market === 'AUSTRALIA') return 'USD base · A$ display';
  if (market === 'GERMANY') return 'USD base · € display';
  if (market === 'CANADA') return 'USD base · CA$ display';
  if (market === 'SWITZERLAND') return 'USD base · CHF display';
  return 'Virtual USD (notional)';
}

export function Navbar({
  onOpenWatchlist,
  showWatchlistTrigger = false,
  isWide = false,
}: NavbarProps) {
  const insets = useSafeAreaInsets();
  const palette = useThemeStore((s) => s.palette);
  const openSettings = useUiStore((s) => s.openSettings);
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const formatBaseUsdAsInr = useWalletStore((s) => s.formatBaseUsdAsInr);
  const formatBaseUsdAsCny = useWalletStore((s) => s.formatBaseUsdAsCny);
  const formatBaseUsdAsJpy = useWalletStore((s) => s.formatBaseUsdAsJpy);
  const formatBaseUsdAsGbp = useWalletStore((s) => s.formatBaseUsdAsGbp);
  const formatBaseUsdAsAud = useWalletStore((s) => s.formatBaseUsdAsAud);
  const formatBaseUsdAsEur = useWalletStore((s) => s.formatBaseUsdAsEur);
  const formatBaseUsdAsCad = useWalletStore((s) => s.formatBaseUsdAsCad);
  const formatBaseUsdAsChf = useWalletStore((s) => s.formatBaseUsdAsChf);
  const formatBaseUsd = useWalletStore((s) => s.formatBaseUsd);
  const setActiveMarket = useMarketStore((s) => s.setActiveMarket);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<UnifiedSearchHit[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchSeq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      setSearchBusy(false);
      return;
    }
    const id = ++searchSeq.current;
    setSearchBusy(true);
    const t = setTimeout(() => {
      void unifiedSearch(q, 10).then((h) => {
        if (searchSeq.current === id) setHits(h);
      }).finally(() => {
        if (searchSeq.current === id) setSearchBusy(false);
      });
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  const walletLine =
    activeMarket === 'INDIA'
      ? formatBaseUsdAsInr()
      : activeMarket === 'CHINA'
        ? formatBaseUsdAsCny()
        : activeMarket === 'JAPAN'
          ? formatBaseUsdAsJpy()
          : activeMarket === 'UK'
            ? formatBaseUsdAsGbp()
            : activeMarket === 'AUSTRALIA'
              ? formatBaseUsdAsAud()
              : activeMarket === 'GERMANY'
                ? formatBaseUsdAsEur()
                : activeMarket === 'CANADA'
                  ? formatBaseUsdAsCad()
                  : activeMarket === 'SWITZERLAND'
                    ? formatBaseUsdAsChf()
                    : formatBaseUsd();
  const sub = walletSub(activeMarket);

  return (
    <View
      className="font-sans"
      style={{ borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface2 }}>
      <View style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center gap-2 px-3 py-2.5">
          {showWatchlistTrigger ? (
            <Pressable
              accessibilityRole="button"
              onPress={onOpenWatchlist}
              className="h-10 w-10 items-center justify-center rounded-md border active:opacity-80"
              style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
              <FontAwesome name="bars" size={18} color={palette.textMuted} />
            </Pressable>
          ) : null}

          <View className="min-w-[128px] shrink-0">
            <Text className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              The Atharva Capital
            </Text>
            <Text className="text-base font-bold" style={{ color: palette.text }}>
              Trade
            </Text>
          </View>

          <View
            className="mx-1 min-w-0 flex-1 flex-row items-center rounded-md border px-3 py-2"
            style={{ borderColor: palette.border, backgroundColor: palette.bg }}>
            <FontAwesome name="search" size={14} color={palette.textMuted} />
            <TextInput
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                setSearchOpen(t.trim().length > 0);
              }}
              onFocus={() => setSearchOpen(query.trim().length > 0)}
              onBlur={() => {
                setTimeout(() => setSearchOpen(false), 200);
              }}
              placeholder={searchPlaceholder(activeMarket, isWide)}
              placeholderTextColor={palette.textMuted}
              className="ml-2 flex-1 py-0 text-sm"
              style={{ color: palette.text }}
              autoCorrect={false}
              autoCapitalize="characters"
            />
          </View>

          <View className="shrink-0 items-end pr-1">
            <Text className="text-[10px] font-medium uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Virtual wallet
            </Text>
            <Text className="text-sm font-semibold tabular-nums" style={{ color: palette.text }}>
              {walletLine}
            </Text>
            <Text className="text-[9px]" style={{ color: palette.textMuted }}>
              {sub}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={openSettings}
            className="h-10 w-10 items-center justify-center rounded-full border active:opacity-80"
            style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
            <FontAwesome name="user" size={18} color={palette.textMuted} />
          </Pressable>
        </View>
      </View>

      {searchOpen && query.trim().length >= 1 ? (
        <View className="px-3 pb-2" style={{ zIndex: 40, elevation: 10 }}>
          <View
            className="max-h-64 rounded-lg border"
            style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
            {searchBusy && hits.length === 0 ? (
              <Text className="px-3 py-3 text-xs" style={{ color: palette.textMuted }}>
                Searching…
              </Text>
            ) : null}
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {hits.map((h) => (
                <Pressable
                  key={h.id}
                  onPress={() => {
                    setActiveMarket(activeMarketFromSearchHit(h));
                    setQuery(h.symbol);
                    setHits([]);
                    setSearchOpen(false);
                    Keyboard.dismiss();
                  }}
                  className="flex-row items-center border-b px-3 py-2.5 active:opacity-80"
                  style={{ borderColor: palette.border }}>
                  <Text className="mr-2 text-base">{h.flag}</Text>
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-bold" style={{ color: palette.text }}>
                      {h.symbol}
                    </Text>
                    <Text className="text-[11px]" style={{ color: palette.textMuted }} numberOfLines={1}>
                      {h.name} · {h.venue}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {!searchBusy && hits.length === 0 ? (
                <Text className="px-3 py-3 text-xs" style={{ color: palette.textMuted }}>
                  No matches (try FMP key for US equities).
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      ) : null}

      <MarketSwitcher />
    </View>
  );
}
