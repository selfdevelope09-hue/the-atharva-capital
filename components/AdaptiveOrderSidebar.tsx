import Slider from '@react-native-community/slider';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import type { ActiveMarket } from '@/store/marketStore';
import { useMarketStore } from '@/store/marketStore';
import {
  CRYPTO_MAKER_FEE_RATE,
  CRYPTO_TAKER_FEE_RATE,
  useCryptoMarginStore,
} from '@/store/cryptoMarginStore';
import { useThemeStore } from '@/store/themeStore';
import { useTradeStore } from '@/store/tradeStore';
import { useWalletStore } from '@/store/walletStore';

export type AdaptiveOrderSidebarProps = {
  symbol: string;
  activeMarket: ActiveMarket;
  onClose: () => void;
  onSymbolChange?: (symbol: string) => void;
  /** Desktop rail vs mobile bottom sheet container. */
  layout?: 'rail' | 'sheet';
};

type IndiaProduct = 'intraday' | 'delivery' | 'margin';
type IndiaOrderType = 'limit' | 'market' | 'sl';
type GlobalTif = 'day' | 'gtc';

function lotSizeIndia(sym: string): number {
  const u = sym.toUpperCase();
  if (u.includes('BANKNIFTY')) return 15;
  if (u.includes('NIFTY')) return 75;
  return 1;
}

function isGlobalMarket(m: ActiveMarket): boolean {
  return m !== 'INDIA' && m !== 'CRYPTO';
}

/** Right-hand order rail (or full-width sheet): market-specific fields + virtual execution via `tradeStore`. */
function AdaptiveOrderSidebarInner({
  symbol,
  activeMarket,
  onClose,
  onSymbolChange,
  layout = 'rail',
}: AdaptiveOrderSidebarProps) {
  const palette = useThemeStore((s) => s.palette);
  const liveQuotes = useMarketStore((s) => s.liveQuotes);
  const setChartTicker = useMarketStore((s) => s.setChartTicker);
  const placeVirtualTrade = useTradeStore((s) => s.placeVirtualTrade);

  const formatBaseUsd = useWalletStore((s) => s.formatBaseUsd);
  const usdToInr = useWalletStore((s) => s.usdToInr);
  const formatInr = useWalletStore((s) => s.formatInr);
  const getInrFromBaseUsd = useWalletStore((s) => s.getInrFromBaseUsd);

  const leverage = useCryptoMarginStore((s) => s.leverage);
  const marginMode = useCryptoMarginStore((s) => s.marginMode);
  const setLeverage = useCryptoMarginStore((s) => s.setLeverage);
  const setMarginMode = useCryptoMarginStore((s) => s.setMarginMode);
  const entryPrice = useCryptoMarginStore((s) => s.entryPrice);
  const feeScenario = useCryptoMarginStore((s) => s.feeScenario);
  const setFeeScenario = useCryptoMarginStore((s) => s.setFeeScenario);

  const [draftSymbol, setDraftSymbol] = useState(symbol);
  useEffect(() => {
    setDraftSymbol(symbol);
  }, [symbol]);

  const [orderQty, setOrderQty] = useState('0.02');
  const [indiaLots, setIndiaLots] = useState('1');
  const [indiaProduct, setIndiaProduct] = useState<IndiaProduct>('intraday');
  const [indiaOrderType, setIndiaOrderType] = useState<IndiaOrderType>('limit');
  const [indiaLimitPx, setIndiaLimitPx] = useState('2450');
  const [globalFractional, setGlobalFractional] = useState('1.5');
  const [globalTif, setGlobalTif] = useState<GlobalTif>('day');
  const [globalLimitPx, setGlobalLimitPx] = useState('198');

  const ltpCrypto = liveQuotes[draftSymbol]?.ltp ?? entryPrice;
  const feeRateCrypto = feeScenario === 'maker' ? CRYPTO_MAKER_FEE_RATE : CRYPTO_TAKER_FEE_RATE;

  const qtyNum = useMemo(() => {
    const n = parseFloat(orderQty.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [orderQty]);

  const notionalCrypto = qtyNum * ltpCrypto;
  const makerFeeUsd = notionalCrypto * CRYPTO_MAKER_FEE_RATE;
  const takerFeeUsd = notionalCrypto * CRYPTO_TAKER_FEE_RATE;

  const lot = lotSizeIndia(draftSymbol);
  const lotsParsed = useMemo(() => {
    const n = parseInt(indiaLots, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [indiaLots]);
  const indiaPx = useMemo(() => {
    const n = parseFloat(indiaLimitPx.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [indiaLimitPx]);
  const indiaNotionalInr = lotsParsed * lot * indiaPx;
  const indiaNotionalUsd = indiaNotionalInr / Math.max(usdToInr, 1e-6);

  const globalQty = useMemo(() => {
    const n = parseFloat(globalFractional.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [globalFractional]);
  const globalPx = useMemo(() => {
    const n = parseFloat(globalLimitPx.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [globalLimitPx]);
  const globalFeeRate = 0.0005;

  const commitSymbol = useCallback(() => {
    const next = draftSymbol.trim().toUpperCase();
    if (!next) return;
    setChartTicker(next);
    onSymbolChange?.(next);
  }, [draftSymbol, onSymbolChange, setChartTicker]);

  const execBuy = useCallback(() => {
    if (activeMarket === 'CRYPTO' && qtyNum <= 0) return;
    if (activeMarket === 'INDIA' && lotsParsed <= 0) return;
    if (isGlobalMarket(activeMarket) && globalQty <= 0) return;

    if (activeMarket === 'CRYPTO') {
      placeVirtualTrade({
        market: 'CRYPTO',
        symbol: draftSymbol,
        side: 'buy',
        qty: qtyNum,
        price: ltpCrypto,
        feeRate: feeRateCrypto,
      });
    } else if (activeMarket === 'INDIA') {
      placeVirtualTrade({
        market: 'INDIA',
        symbol: draftSymbol,
        side: 'buy',
        qty: lotsParsed * lot,
        price: indiaPx,
        feeRate: 0.0003,
        notionalUsdOverride: indiaNotionalUsd,
      });
    } else {
      placeVirtualTrade({
        market: activeMarket,
        symbol: draftSymbol,
        side: 'buy',
        qty: globalQty,
        price: globalPx,
        feeRate: globalFeeRate,
      });
    }
  }, [
    activeMarket,
    draftSymbol,
    feeRateCrypto,
    globalPx,
    globalQty,
    indiaNotionalUsd,
    indiaPx,
    lot,
    lotsParsed,
    ltpCrypto,
    placeVirtualTrade,
    qtyNum,
  ]);

  const execSell = useCallback(() => {
    if (activeMarket === 'CRYPTO' && qtyNum <= 0) return;
    if (activeMarket === 'INDIA' && lotsParsed <= 0) return;
    if (isGlobalMarket(activeMarket) && globalQty <= 0) return;

    if (activeMarket === 'CRYPTO') {
      placeVirtualTrade({
        market: 'CRYPTO',
        symbol: draftSymbol,
        side: 'sell',
        qty: qtyNum,
        price: ltpCrypto,
        feeRate: feeRateCrypto,
      });
    } else if (activeMarket === 'INDIA') {
      placeVirtualTrade({
        market: 'INDIA',
        symbol: draftSymbol,
        side: 'sell',
        qty: lotsParsed * lot,
        price: indiaPx,
        feeRate: 0.0003,
        notionalUsdOverride: indiaNotionalUsd,
      });
    } else {
      placeVirtualTrade({
        market: activeMarket,
        symbol: draftSymbol,
        side: 'sell',
        qty: globalQty,
        price: globalPx,
        feeRate: globalFeeRate,
      });
    }
  }, [
    activeMarket,
    draftSymbol,
    feeRateCrypto,
    globalPx,
    globalQty,
    indiaNotionalUsd,
    indiaPx,
    lot,
    lotsParsed,
    ltpCrypto,
    placeVirtualTrade,
    qtyNum,
  ]);

  const marginInr = getInrFromBaseUsd() * 0.85;

  return (
    <View
      style={{
        width: layout === 'rail' ? 300 : '100%',
        borderLeftWidth: layout === 'rail' ? 1 : 0,
        borderColor: palette.border,
        backgroundColor: palette.surface,
      }}>
      <View
        className="flex-row items-center justify-between border-b px-3 py-3"
        style={{ borderColor: palette.border }}>
        <Text className="text-xs font-black uppercase tracking-wide" style={{ color: palette.text }}>
          Order
        </Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close order sidebar">
          <FontAwesome name="times" size={22} color={palette.textMuted} />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-3 py-3" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text className="text-[10px] font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
          Ticker
        </Text>
        <View className="mt-1 flex-row gap-2">
          <TextInput
            value={draftSymbol}
            onChangeText={setDraftSymbol}
            autoCapitalize="characters"
            className="min-w-0 flex-1 rounded-lg border px-2 py-2 text-sm font-bold"
            style={{ borderColor: palette.border, color: palette.text, backgroundColor: palette.surface2 }}
          />
          <Pressable
            onPress={commitSymbol}
            className="justify-center rounded-lg border px-3 py-2 active:opacity-80"
            style={{ borderColor: palette.accent, backgroundColor: `${palette.accent}22` }}>
            <Text className="text-xs font-bold" style={{ color: palette.accent }}>
              Set
            </Text>
          </Pressable>
        </View>

        <View
          className="mt-4 rounded-xl border p-3"
          style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
          <Text className="text-[10px] font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
            Wallet (virtual)
          </Text>
          <Text className="mt-1 text-lg font-black tabular-nums" style={{ color: palette.text }}>
            {formatBaseUsd()} <Text className="text-xs font-semibold text-neutral-500">base</Text>
          </Text>
          {activeMarket === 'INDIA' ? (
            <Text className="mt-1 text-[11px]" style={{ color: palette.textMuted }}>
              Est. margin {formatInr(marginInr)} · lot {lot}/lot
            </Text>
          ) : null}
        </View>

        {activeMarket === 'CRYPTO' ? (
          <View className="mt-5">
            <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Leverage ({leverage}x)
            </Text>
            <Slider
              style={{ width: '100%', height: 40, marginTop: 4 }}
              minimumValue={1}
              maximumValue={100}
              step={1}
              value={leverage}
              onValueChange={(v) => setLeverage(Math.round(v))}
              minimumTrackTintColor={palette.accent}
              maximumTrackTintColor={palette.border}
              thumbTintColor={palette.text}
            />
            <Text className="mt-3 text-[10px] font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Margin mode
            </Text>
            <View className="mt-2 flex-row gap-2">
              <Pressable
                onPress={() => setMarginMode('cross')}
                className="flex-1 rounded-lg border py-2"
                style={{
                  borderColor: marginMode === 'cross' ? palette.accent : palette.border,
                  backgroundColor: marginMode === 'cross' ? `${palette.accent}18` : palette.surface2,
                }}>
                <Text className="text-center text-[11px] font-bold" style={{ color: palette.text }}>
                  Cross
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMarginMode('isolated')}
                className="flex-1 rounded-lg border py-2"
                style={{
                  borderColor: marginMode === 'isolated' ? palette.accent : palette.border,
                  backgroundColor: marginMode === 'isolated' ? `${palette.accent}18` : palette.surface2,
                }}>
                <Text className="text-center text-[11px] font-bold" style={{ color: palette.text }}>
                  Isolated
                </Text>
              </Pressable>
            </View>
            <Text className="mt-4 text-[10px] font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Available (USDT ≈ USD)
            </Text>
            <Text className="mt-1 text-sm font-semibold tabular-nums" style={{ color: palette.text }}>
              {formatBaseUsd()} <Text className="text-[10px] text-neutral-500">(USDT≈USD)</Text>
            </Text>
            <Text className="mt-4 text-[10px] font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Quantity (contracts)
            </Text>
            <TextInput
              value={orderQty}
              onChangeText={setOrderQty}
              keyboardType="decimal-pad"
              className="mt-1 rounded-lg border px-2 py-2 text-sm"
              style={{ borderColor: palette.border, color: palette.text, backgroundColor: palette.bg }}
            />
            <Text className="mt-1 text-[10px]" style={{ color: palette.textMuted }}>
              Mark / ref: {ltpCrypto.toFixed(ltpCrypto < 10 ? 4 : 2)}
            </Text>
            <Text className="mt-4 text-[10px] font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Fee scenario
            </Text>
            <View className="mt-2 flex-row gap-2">
              <Pressable
                onPress={() => setFeeScenario('maker')}
                className="flex-1 rounded-lg border py-2"
                style={{
                  borderColor: feeScenario === 'maker' ? '#22d3ee' : palette.border,
                  backgroundColor: feeScenario === 'maker' ? 'rgba(34,211,238,0.12)' : palette.surface2,
                }}>
                <Text className="text-center text-[10px] font-bold text-cyan-200">
                  Maker {(CRYPTO_MAKER_FEE_RATE * 100).toFixed(3)}%
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setFeeScenario('taker')}
                className="flex-1 rounded-lg border py-2"
                style={{
                  borderColor: feeScenario === 'taker' ? '#fb923c' : palette.border,
                  backgroundColor: feeScenario === 'taker' ? 'rgba(251,146,60,0.12)' : palette.surface2,
                }}>
                <Text className="text-center text-[10px] font-bold text-orange-200">
                  Taker {(CRYPTO_TAKER_FEE_RATE * 100).toFixed(3)}%
                </Text>
              </Pressable>
            </View>
            <Text className="mt-4 text-[10px] font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Est. fees (on notional ${notionalCrypto.toFixed(2)})
            </Text>
            <Text className="mt-1 text-xs" style={{ color: palette.text }}>
              Maker ≈ ${makerFeeUsd.toFixed(4)} · Taker ≈ ${takerFeeUsd.toFixed(4)}
            </Text>
          </View>
        ) : null}

        {activeMarket === 'INDIA' ? (
          <View className="mt-5">
            <Text className="text-[10px] font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Product
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {(['intraday', 'delivery', 'margin'] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setIndiaProduct(p)}
                  className="rounded-lg border px-2 py-1.5"
                  style={{
                    borderColor: indiaProduct === p ? palette.accent : palette.border,
                    backgroundColor: indiaProduct === p ? `${palette.accent}22` : palette.surface2,
                  }}>
                  <Text className="text-[10px] font-bold capitalize" style={{ color: palette.text }}>
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="mt-4 text-[10px] font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Order type
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {(['limit', 'market', 'sl'] as const).map((o) => (
                <Pressable
                  key={o}
                  onPress={() => setIndiaOrderType(o)}
                  className="rounded-lg border px-2 py-1.5"
                  style={{
                    borderColor: indiaOrderType === o ? palette.accent : palette.border,
                    backgroundColor: indiaOrderType === o ? `${palette.accent}22` : palette.surface2,
                  }}>
                  <Text className="text-[10px] font-bold uppercase" style={{ color: palette.text }}>
                    {o}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="mt-4 text-[10px] font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Lots (× {lot} shares)
            </Text>
            <TextInput
              value={indiaLots}
              onChangeText={setIndiaLots}
              keyboardType="number-pad"
              className="mt-1 rounded-lg border px-2 py-2 text-sm"
              style={{ borderColor: palette.border, color: palette.text, backgroundColor: palette.bg }}
            />
            <Text className="mt-4 text-[10px] font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Limit price (INR)
            </Text>
            <TextInput
              value={indiaLimitPx}
              onChangeText={setIndiaLimitPx}
              keyboardType="decimal-pad"
              className="mt-1 rounded-lg border px-2 py-2 text-sm"
              style={{ borderColor: palette.border, color: palette.text, backgroundColor: palette.bg }}
            />
            <Text className="mt-2 text-[10px]" style={{ color: palette.textMuted }}>
              Exposure ≈ {formatInr(indiaNotionalInr)} · USD book ≈ ${indiaNotionalUsd.toFixed(2)}
            </Text>
          </View>
        ) : null}

        {isGlobalMarket(activeMarket) ? (
          <View className="mt-5">
            <Text className="text-[10px] font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Base currency
            </Text>
            <Text className="mt-1 text-sm font-bold" style={{ color: palette.text }}>
              USD (virtual)
            </Text>
            <Text className="mt-4 text-[10px] font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Fractional shares
            </Text>
            <TextInput
              value={globalFractional}
              onChangeText={setGlobalFractional}
              keyboardType="decimal-pad"
              className="mt-1 rounded-lg border px-2 py-2 text-sm"
              style={{ borderColor: palette.border, color: palette.text, backgroundColor: palette.bg }}
            />
            <Text className="mt-4 text-[10px] font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Limit price (USD)
            </Text>
            <TextInput
              value={globalLimitPx}
              onChangeText={setGlobalLimitPx}
              keyboardType="decimal-pad"
              className="mt-1 rounded-lg border px-2 py-2 text-sm"
              style={{ borderColor: palette.border, color: palette.text, backgroundColor: palette.bg }}
            />
            <Text className="mt-4 text-[10px] font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Time in force
            </Text>
            <View className="mt-2 flex-row gap-2">
              {(['day', 'gtc'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setGlobalTif(t)}
                  className="flex-1 rounded-lg border py-2"
                  style={{
                    borderColor: globalTif === t ? palette.accent : palette.border,
                    backgroundColor: globalTif === t ? `${palette.accent}22` : palette.surface2,
                  }}>
                  <Text className="text-center text-[11px] font-bold uppercase" style={{ color: palette.text }}>
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="mt-2 text-[10px]" style={{ color: palette.textMuted }}>
              Est. taker fee {(globalFeeRate * 100).toFixed(2)}% on ${(globalQty * globalPx).toFixed(2)} notional
            </Text>
          </View>
        ) : null}

        <View className="mt-8 flex-row gap-3 pb-6">
          <Pressable
            onPress={execSell}
            className="flex-1 items-center rounded-xl border-2 py-3 active:opacity-90"
            style={{ borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.12)' }}>
            <Text className="text-sm font-black text-red-200">Sell</Text>
          </Pressable>
          <Pressable
            onPress={execBuy}
            className="flex-1 items-center rounded-xl border-2 py-3 active:opacity-90"
            style={{ borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.12)' }}>
            <Text className="text-sm font-black text-emerald-200">Buy</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

export const AdaptiveOrderSidebar = memo(AdaptiveOrderSidebarInner);
