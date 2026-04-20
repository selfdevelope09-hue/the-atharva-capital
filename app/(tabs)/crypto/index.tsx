import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CRYPTO_THEME, formatPct, formatPrice } from '@/components/crypto/cryptoTheme';
import { CryptoTickerBar } from '@/components/crypto/CryptoTickerBar';
import { MarketCard } from '@/components/crypto/MarketCard';
import { MarketsTable } from '@/components/crypto/MarketsTable';
import { usePriceContext, useTopUsdtMarkets } from '@/contexts/PriceContext';
import { useCryptoWatchlistStore } from '@/store/cryptoWatchlistStore';

/** Markets landing page: ticker bar + hero grid + All / Watchlist table. */
export default function CryptoMarketsScreen() {
  const { status, reconnectAttempts } = usePriceContext();
  const allMarkets = useTopUsdtMarkets(500);
  const hydrate = useCryptoWatchlistStore((s) => s.hydrate);
  const stars = useCryptoWatchlistStore((s) => s.stars);
  const ready = useCryptoWatchlistStore((s) => s.ready);
  const [tab, setTab] = useState<'all' | 'watchlist'>('all');
  const [search, setSearch] = useState('');
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (!ready) void hydrate();
  }, [ready, hydrate]);

  const heroMarkets = useMemo(() => allMarkets.slice(0, 8), [allMarkets]);

  const filteredRows = useMemo(() => {
    const base = tab === 'watchlist' ? allMarkets.filter((m) => stars.has(m.symbol)) : allMarkets;
    const q = search.trim().toUpperCase();
    if (!q) return base;
    return base.filter((m) => m.symbol.includes(q));
  }, [tab, allMarkets, stars, search]);

  const goToTrade = (symbol: string) => {
    router.push({ pathname: '/(tabs)/crypto/[symbol]', params: { symbol } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CRYPTO_THEME.bg }} edges={['top']}>
      <Header status={status} reconnectAttempts={reconnectAttempts} count={allMarkets.length} />
      <CryptoTickerBar />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 40 }}>
        <HeroHeadline markets={heroMarkets} />

        <Text
          style={{
            marginTop: 22,
            marginBottom: 10,
            color: CRYPTO_THEME.text,
            fontSize: 16,
            fontWeight: '800',
          }}>
          Top markets
        </Text>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'stretch',
          }}>
          {heroMarkets.length === 0
            ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
            : heroMarkets.map((m) => (
                <View key={m.symbol} style={{ flexGrow: 1, flexBasis: width < 600 ? '100%' : 240 }}>
                  <MarketCard tick={m} onTradePress={goToTrade} />
                </View>
              ))}
        </View>

        <View
          style={{
            marginTop: 28,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TabButton label="All Markets" active={tab === 'all'} onPress={() => setTab('all')} />
            <TabButton
              label="Watchlist"
              badge={stars.size}
              active={tab === 'watchlist'}
              onPress={() => setTab('watchlist')}
            />
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search coin (BTC, ETH, SOL…)"
            placeholderTextColor={CRYPTO_THEME.textDim}
            autoCapitalize="characters"
            style={{
              flexGrow: 1,
              minWidth: 200,
              maxWidth: 360,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: CRYPTO_THEME.border,
              backgroundColor: CRYPTO_THEME.surface,
              color: CRYPTO_THEME.text,
              fontSize: 13,
              fontWeight: '600',
            }}
          />
        </View>

        <MarketsTable
          rows={filteredRows}
          onTradePress={goToTrade}
          watchlistOnly={tab === 'watchlist'}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({
  status,
  reconnectAttempts,
  count,
}: {
  status: string;
  reconnectAttempts: number;
  count: number;
}) {
  const online = status === 'open';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: CRYPTO_THEME.border,
        backgroundColor: CRYPTO_THEME.bg,
      }}>
      <View>
        <Text style={{ color: CRYPTO_THEME.text, fontSize: 20, fontWeight: '800', letterSpacing: 0.2 }}>
          Crypto Markets
        </Text>
        <Text style={{ color: CRYPTO_THEME.textMuted, fontSize: 11, marginTop: 2 }}>
          Live from Binance · {count} pairs
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: online ? CRYPTO_THEME.up : CRYPTO_THEME.down,
          backgroundColor: online ? CRYPTO_THEME.upSoft : CRYPTO_THEME.downSoft,
        }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: online ? CRYPTO_THEME.up : CRYPTO_THEME.down,
            marginRight: 6,
          }}
        />
        <Text
          style={{
            color: online ? CRYPTO_THEME.up : CRYPTO_THEME.down,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 0.4,
          }}>
          {online ? 'LIVE' : status === 'reconnecting' ? `RECONNECTING${reconnectAttempts > 1 ? ` (${reconnectAttempts})` : ''}` : status.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
  badge,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: active ? CRYPTO_THEME.accent : CRYPTO_THEME.border,
        backgroundColor: active ? CRYPTO_THEME.accentSoft : CRYPTO_THEME.surface,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
      <Text
        style={{
          color: active ? CRYPTO_THEME.accent : CRYPTO_THEME.text,
          fontSize: 12,
          fontWeight: '800',
        }}>
        {label}
      </Text>
      {badge != null && badge > 0 ? (
        <Text
          style={{
            marginLeft: 6,
            color: active ? CRYPTO_THEME.accent : CRYPTO_THEME.textMuted,
            fontSize: 11,
            fontWeight: '800',
          }}>
          · {badge}
        </Text>
      ) : null}
    </Pressable>
  );
}

function HeroHeadline({ markets }: { markets: { symbol: string; price: number; changePct24h: number }[] }) {
  const fade = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [fade]);

  if (markets.length === 0) return null;
  const top = markets[0];
  const up = top.changePct24h >= 0;

  return (
    <Animated.View
      style={{
        opacity: fade,
        transform: [
          {
            translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
          },
        ],
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: CRYPTO_THEME.border,
        backgroundColor: CRYPTO_THEME.surface,
      }}>
      <Text style={{ color: CRYPTO_THEME.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>
        HOT · 24H VOLUME LEADER
      </Text>
      <Text style={{ color: CRYPTO_THEME.text, fontSize: 28, fontWeight: '800', marginTop: 6 }}>
        {top.symbol.replace(/USDT$/, '')}
        <Text style={{ color: CRYPTO_THEME.textMuted, fontSize: 18 }}> /USDT</Text>
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
        <Text
          style={{
            color: CRYPTO_THEME.text,
            fontSize: 24,
            fontWeight: '800',
            fontVariant: ['tabular-nums'],
          }}>
          ${formatPrice(top.price)}
        </Text>
        <Text
          style={{
            color: up ? CRYPTO_THEME.up : CRYPTO_THEME.down,
            fontSize: 14,
            fontWeight: '800',
            fontVariant: ['tabular-nums'],
          }}>
          {formatPct(top.changePct24h)}
        </Text>
      </View>
    </Animated.View>
  );
}

function CardSkeleton() {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 240,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: CRYPTO_THEME.border,
        backgroundColor: CRYPTO_THEME.surface,
        minHeight: 160,
      }}>
      <View
        style={{
          width: 60,
          height: 12,
          borderRadius: 4,
          backgroundColor: CRYPTO_THEME.border,
        }}
      />
      <View
        style={{
          marginTop: 12,
          width: 120,
          height: 20,
          borderRadius: 4,
          backgroundColor: CRYPTO_THEME.border,
        }}
      />
      <View
        style={{
          marginTop: 14,
          width: '60%',
          height: 10,
          borderRadius: 4,
          backgroundColor: CRYPTO_THEME.border,
        }}
      />
    </View>
  );
}
