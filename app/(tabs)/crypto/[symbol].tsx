import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CRYPTO_THEME, displayBase, formatPct, formatPrice } from '@/components/crypto/cryptoTheme';
import { CryptoChartFrame } from '@/components/crypto/CryptoChartFrame';
import {
  MAKER_FEE,
  OrderFormPanel,
  type FeeTier,
  type OrderMode,
  type OrderSide,
} from '@/components/crypto/OrderFormPanel';
import { SymbolTabs } from '@/components/crypto/SymbolTabs';
import { TpSlOverlay } from '@/components/crypto/TpSlOverlay';
import { usePriceContext, usePriceTick } from '@/contexts/PriceContext';
import { useWalletStore } from '@/store/walletStore';
import { useTradeStore } from '@/store/tradeStore';

void MAKER_FEE; // re-exported fee constants are used inside the panel

const HOT_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'TONUSDT',
  'DOTUSDT',
  'MATICUSDT',
];

/** Trade page per coin: symbol tabs + TradingView chart + TP/SL overlay + order form. */
export default function CryptoTradeScreen() {
  const params = useLocalSearchParams<{ symbol?: string }>();
  const initialSymbol = (params.symbol || 'BTCUSDT').toString().toUpperCase();
  const [symbol, setSymbol] = useState(initialSymbol);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { width, height: winH } = useWindowDimensions();
  const isDesktop = width >= 900;
  const chartMinH = isDesktop ? 360 : Math.min(580, Math.max(380, Math.floor(winH * 0.48)));

  const tick = usePriceTick(symbol);
  const { prices } = usePriceContext();
  const availableUsd = useWalletStore((s) => (typeof s.baseUsd === 'number' ? s.baseUsd : 10_000));
  const placeVirtualTrade = useTradeStore((s) => s.placeVirtualTrade);

  const [mode, setMode] = useState<OrderMode>('market');
  const [feeTier, setFeeTier] = useState<FeeTier>('taker');
  const [side, setSide] = useState<OrderSide>('long');
  const [amountUsd, setAmountUsd] = useState('100');
  const [leverage, setLeverage] = useState(10);
  const [entry, setEntry] = useState(0);
  const [takeProfit, setTakeProfit] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);

  // When the symbol or live price arrives, seed TP/SL at ±2% if not yet set.
  useEffect(() => {
    const p = tick?.price ?? 0;
    if (p <= 0) return;
    if (takeProfit <= 0 || stopLoss <= 0) {
      if (side === 'long') {
        setTakeProfit(p * 1.02);
        setStopLoss(p * 0.98);
      } else {
        setTakeProfit(p * 0.98);
        setStopLoss(p * 1.02);
      }
    }
  }, [tick?.price, side, takeProfit, stopLoss]);

  // Reset TP/SL when side flips so the defaults make sense.
  useEffect(() => {
    const p = tick?.price ?? 0;
    if (p <= 0) return;
    if (side === 'long') {
      setTakeProfit(p * 1.02);
      setStopLoss(p * 0.98);
    } else {
      setTakeProfit(p * 0.98);
      setStopLoss(p * 1.02);
    }
    // Intentionally only re-run on side toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  const livePrice = tick?.price ?? 0;
  const effectiveEntry = mode === 'market' ? livePrice : entry || livePrice;

  const priceBand = useMemo(() => {
    if (!tick) return { high: livePrice * 1.05 || 1, low: livePrice * 0.95 || 0 };
    return { high: tick.high24h, low: tick.low24h };
  }, [tick, livePrice]);

  const onSubmit = () => {
    const n = parseFloat(amountUsd.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || livePrice <= 0) return;
    placeVirtualTrade({
      market: 'CRYPTO',
      symbol,
      side: side === 'long' ? 'buy' : 'sell',
      qty: (n * leverage) / livePrice,
      price: effectiveEntry,
      feeRate: feeTier === 'maker' ? 0.0002 : 0.0005,
    });
    setOrderSheetOpen(false);
  };

  const handleSymbolChange = (next: string) => {
    setSymbol(next);
    setTakeProfit(0);
    setStopLoss(0);
    setEntry(0);
  };

  const orderForm = (
    <OrderFormPanel
      layout={isDesktop ? 'rail' : 'sheet'}
      symbol={symbol}
      mode={mode}
      setMode={setMode}
      feeTier={feeTier}
      setFeeTier={setFeeTier}
      side={side}
      setSide={setSide}
      amountUsd={amountUsd}
      setAmountUsd={setAmountUsd}
      availableUsd={availableUsd}
      leverage={leverage}
      setLeverage={setLeverage}
      livePrice={livePrice}
      entry={entry}
      setEntry={setEntry}
      takeProfit={takeProfit}
      setTakeProfit={setTakeProfit}
      stopLoss={stopLoss}
      setStopLoss={setStopLoss}
      onSubmit={onSubmit}
      onClose={!isDesktop ? () => setOrderSheetOpen(false) : undefined}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CRYPTO_THEME.bg }} edges={['top']}>
      <Header symbol={symbol} tick={tick} onBack={() => router.back()} />
      <SymbolTabs
        symbols={Array.from(new Set([...HOT_SYMBOLS, ...Object.keys(prices).filter((k) => k.endsWith('USDT')).slice(0, 40)]))}
        active={symbol}
        onChange={handleSymbolChange}
      />
      <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column', minHeight: 0 }}>
        <View style={{ flex: 1, minWidth: 0, minHeight: isDesktop ? undefined : chartMinH }}>
          <View style={{ flex: 1, minHeight: chartMinH, position: 'relative' }}>
            <CryptoChartFrame
              symbol={symbol}
              interval="15"
              theme="dark"
              minHeight={chartMinH}
              showFullscreen
              onFullscreen={() => setIsFullscreen(true)}
            />
            {effectiveEntry > 0 && takeProfit > 0 && stopLoss > 0 ? (
              <TpSlOverlay
                entry={effectiveEntry}
                takeProfit={takeProfit}
                stopLoss={stopLoss}
                side={side}
                onChange={(patch) => {
                  if (patch.takeProfit != null) setTakeProfit(patch.takeProfit);
                  if (patch.stopLoss != null) setStopLoss(patch.stopLoss);
                }}
                priceBand={priceBand}
              />
            ) : null}
          </View>
        </View>
        {isDesktop ? orderForm : null}
      </View>

      {!isDesktop ? (
        <Pressable
          onPress={() => setOrderSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open order panel"
          style={{
            position: 'absolute',
            right: 16,
            bottom: 24,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 26,
            backgroundColor: CRYPTO_THEME.accent,
            shadowColor: CRYPTO_THEME.accent,
            shadowOpacity: 0.5,
            shadowRadius: 10,
            elevation: 6,
          }}>
          <Text style={{ color: '#0b0e11', fontSize: 13, fontWeight: '800' }}>Trade ↗</Text>
        </Pressable>
      ) : null}

      {!isDesktop ? (
        <Modal
          visible={orderSheetOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setOrderSheetOpen(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
            <Pressable style={{ flex: 1 }} onPress={() => setOrderSheetOpen(false)} />
            <View style={{ height: '80%' }}>{orderForm}</View>
          </View>
        </Modal>
      ) : null}

      {isFullscreen ? (
        <Modal
          visible
          animationType="fade"
          presentationStyle="fullScreen"
          onRequestClose={() => setIsFullscreen(false)}>
          <View style={{ flex: 1, backgroundColor: CRYPTO_THEME.bg }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: CRYPTO_THEME.border,
              }}>
              <Text style={{ color: CRYPTO_THEME.text, fontSize: 14, fontWeight: '800' }}>
                {displayBase(symbol)}/USDT · fullscreen
              </Text>
              <Pressable
                onPress={() => setIsFullscreen(false)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: CRYPTO_THEME.borderStrong,
                }}>
                <Text style={{ color: CRYPTO_THEME.text, fontSize: 12, fontWeight: '800' }}>
                  Exit
                </Text>
              </Pressable>
            </View>
            <View style={{ flex: 1, position: 'relative' }}>
              <CryptoChartFrame symbol={symbol} interval="15" theme="dark" minHeight={chartMinH} />
              {effectiveEntry > 0 && takeProfit > 0 && stopLoss > 0 ? (
                <TpSlOverlay
                  entry={effectiveEntry}
                  takeProfit={takeProfit}
                  stopLoss={stopLoss}
                  side={side}
                  onChange={(patch) => {
                    if (patch.takeProfit != null) setTakeProfit(patch.takeProfit);
                    if (patch.stopLoss != null) setStopLoss(patch.stopLoss);
                  }}
                  priceBand={priceBand}
                />
              ) : null}
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

function Header({
  symbol,
  tick,
  onBack,
}: {
  symbol: string;
  tick: ReturnType<typeof usePriceTick>;
  onBack: () => void;
}) {
  const up = (tick?.changePct24h ?? 0) >= 0;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: CRYPTO_THEME.border,
        gap: 10,
        backgroundColor: CRYPTO_THEME.bg,
      }}>
      <Pressable
        onPress={onBack}
        hitSlop={10}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: CRYPTO_THEME.borderStrong,
        }}>
        <Text style={{ color: CRYPTO_THEME.text, fontSize: 12, fontWeight: '800' }}>← Markets</Text>
      </Pressable>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <Text style={{ color: CRYPTO_THEME.text, fontSize: 16, fontWeight: '800' }}>
          {displayBase(symbol)}
          <Text style={{ color: CRYPTO_THEME.textMuted, fontSize: 12, fontWeight: '600' }}> /USDT</Text>
        </Text>
        <Text
          style={{
            color: CRYPTO_THEME.text,
            fontSize: 14,
            fontWeight: '800',
            fontVariant: ['tabular-nums'],
          }}>
          ${tick ? formatPrice(tick.price) : '—'}
        </Text>
        <Text
          style={{
            color: up ? CRYPTO_THEME.up : CRYPTO_THEME.down,
            fontSize: 12,
            fontWeight: '800',
            fontVariant: ['tabular-nums'],
          }}>
          {tick ? formatPct(tick.changePct24h) : ''}
        </Text>
      </View>
    </View>
  );
}
