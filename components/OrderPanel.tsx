import Slider from '@react-native-community/slider';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import {
  CRYPTO_MAKER_FEE_RATE,
  CRYPTO_TAKER_FEE_RATE,
  useCryptoMarginStore,
} from '@/store/cryptoMarginStore';
import { useCryptoPaperStore } from '@/store/cryptoPaperStore';
import { useThemeStore } from '@/store/themeStore';

export type OrderPanelMode = 'crypto' | 'us';

export type OrderPanelProps = {
  mode: OrderPanelMode;
  visible: boolean;
  onClose: () => void;
  /** Live mark (USDT) for crypto ticket sizing & paper execution. */
  markPrice?: number;
};

/** Professional order ticket: leverage, margin, buy/sell — bottom sheet so the chart stays visible. */
export function OrderPanel({ mode, visible, onClose, markPrice = 0 }: OrderPanelProps) {
  const palette = useThemeStore((s) => s.palette);
  const leverage = useCryptoMarginStore((s) => s.leverage);
  const marginMode = useCryptoMarginStore((s) => s.marginMode);
  const side = useCryptoMarginStore((s) => s.side);
  const entryPrice = useCryptoMarginStore((s) => s.entryPrice);
  const positionQty = useCryptoMarginStore((s) => s.positionQty);
  const symbol = useCryptoMarginStore((s) => s.symbol);
  const takeProfitPrice = useCryptoMarginStore((s) => s.takeProfitPrice);
  const stopLossPrice = useCryptoMarginStore((s) => s.stopLossPrice);
  const feeScenario = useCryptoMarginStore((s) => s.feeScenario);
  const setLeverage = useCryptoMarginStore((s) => s.setLeverage);
  const setMarginMode = useCryptoMarginStore((s) => s.setMarginMode);
  const setSide = useCryptoMarginStore((s) => s.setSide);
  const setTakeProfitPrice = useCryptoMarginStore((s) => s.setTakeProfitPrice);
  const setStopLossPrice = useCryptoMarginStore((s) => s.setStopLossPrice);
  const setFeeScenario = useCryptoMarginStore((s) => s.setFeeScenario);
  const setPositionQty = useCryptoMarginStore((s) => s.setPositionQty);
  const getRequiredMarginUsd = useCryptoMarginStore((s) => s.getRequiredMarginUsd);
  const getLiquidationPrice = useCryptoMarginStore((s) => s.getLiquidationPrice);

  const paperUsdt = useCryptoPaperStore((s) => s.paperUsdt);
  const openFromTicket = useCryptoPaperStore((s) => s.openFromTicket);

  const [orderKind, setOrderKind] = useState<'Market' | 'Limit'>('Market');
  const [amountStr, setAmountStr] = useState('');
  const [limitStr, setLimitStr] = useState('');
  const [tpStr, setTpStr] = useState('');
  const [slStr, setSlStr] = useState('');
  const [amtPct, setAmtPct] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const maxLev = mode === 'us' ? 20 : 125;
  const execMark = markPrice > 0 ? markPrice : entryPrice;
  const execPrice =
    mode === 'crypto' && orderKind === 'Limit'
      ? Math.max(1e-8, parseFloat(limitStr) || execMark)
      : execMark;

  useEffect(() => {
    if (!visible) return;
    const d = execMark > 10 ? 2 : 5;
    setTpStr(takeProfitPrice.toFixed(d));
    setSlStr(stopLossPrice.toFixed(d));
  }, [visible, takeProfitPrice, stopLossPrice, execMark]);

  const marginUsd = getRequiredMarginUsd();
  const liq = getLiquidationPrice();

  const notionalPreview = useMemo(() => {
    if (mode !== 'crypto') return 0;
    const raw = parseFloat(amountStr);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }, [mode, amountStr]);

  const feeRate = feeScenario === 'maker' ? CRYPTO_MAKER_FEE_RATE : CRYPTO_TAKER_FEE_RATE;
  const feePreview = notionalPreview * feeRate;
  const marginPreview = leverage > 0 ? notionalPreview / leverage : 0;
  const totalPreview = marginPreview + feePreview;

  const setPct = useCallback(
    (pct: number) => {
      const v = ((paperUsdt * pct) / 100).toFixed(2);
      setAmountStr(v);
      setAmtPct(pct);
    },
    [paperUsdt]
  );

  const autoTPSL = useCallback(() => {
    if (!execPrice) return;
    const d = execPrice > 10 ? 2 : 5;
    if (side === 'long') {
      const tp = execPrice * 1.02;
      const sl = execPrice * 0.98;
      setTakeProfitPrice(tp);
      setStopLossPrice(sl);
      setTpStr(tp.toFixed(d));
      setSlStr(sl.toFixed(d));
    } else {
      const tp = execPrice * 0.98;
      const sl = execPrice * 1.02;
      setTakeProfitPrice(tp);
      setStopLossPrice(sl);
      setTpStr(tp.toFixed(d));
      setSlStr(sl.toFixed(d));
    }
  }, [execPrice, side, setTakeProfitPrice, setStopLossPrice]);

  const applyTpSlFromInputs = useCallback(() => {
    const d = execPrice > 10 ? 2 : 5;
    const tp = parseFloat(tpStr);
    const sl = parseFloat(slStr);
    if (Number.isFinite(tp) && tp > 0) setTakeProfitPrice(tp);
    if (Number.isFinite(sl) && sl > 0) setStopLossPrice(sl);
    setTpStr((Number.isFinite(tp) && tp > 0 ? tp : takeProfitPrice).toFixed(d));
    setSlStr((Number.isFinite(sl) && sl > 0 ? sl : stopLossPrice).toFixed(d));
  }, [tpStr, slStr, execPrice, setTakeProfitPrice, setStopLossPrice, takeProfitPrice, stopLossPrice]);

  const placePaper = useCallback(() => {
    if (mode !== 'crypto') return;
    setMsg(null);
    applyTpSlFromInputs();
    if (!notionalPreview) {
      setMsg({ t: 'err', m: 'Enter position size (USDT).' });
      return;
    }
    setBusy(true);
    const tpVal = parseFloat(tpStr);
    const slVal = parseFloat(slStr);
    const res = openFromTicket({
      symbol,
      side: side === 'long' ? 'LONG' : 'SHORT',
      markPrice: execPrice,
      notionalUsdt: notionalPreview,
      leverage,
      feeType: feeScenario,
      tp: Number.isFinite(tpVal) && tpVal > 0 ? tpVal : null,
      sl: Number.isFinite(slVal) && slVal > 0 ? slVal : null,
    });
    setBusy(false);
    if (res.ok) {
      setMsg({ t: 'ok', m: `${side === 'long' ? 'LONG' : 'SHORT'} ${symbol} @ $${execPrice.toFixed(2)}` });
      setAmountStr('');
      setAmtPct(null);
      setPositionQty(notionalPreview / Math.max(execPrice, 1e-8));
    } else {
      setMsg({ t: 'err', m: res.error });
    }
  }, [
    mode,
    applyTpSlFromInputs,
    notionalPreview,
    tpStr,
    slStr,
    openFromTicket,
    symbol,
    side,
    execPrice,
    leverage,
    feeScenario,
    setPositionQty,
  ]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/55" onPress={onClose}>
        <Pressable
          className="max-h-[88%] rounded-t-3xl border-t px-4 pb-8 pt-3"
          style={{ backgroundColor: palette.surface, borderColor: palette.border }}
          onPress={(e) => e.stopPropagation()}>
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-black" style={{ color: palette.text }}>
                {mode === 'crypto' ? 'USDT-M paper order' : 'US equity (sim)'}
              </Text>
              <Text className="text-xs" style={{ color: palette.textMuted }}>
                {mode === 'crypto' ? 'Virtual ledger · Binance-style fees' : 'Margin · leverage · execution (demo)'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="times" size={22} color={palette.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {mode === 'crypto' ? (
              <>
                <View className="mb-3 flex-row gap-2">
                  <View
                    className="flex-1 flex-row overflow-hidden rounded-lg border"
                    style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
                    {(['Market', 'Limit'] as const).map((k) => (
                      <Pressable
                        key={k}
                        onPress={() => setOrderKind(k)}
                        className="flex-1 py-2"
                        style={{
                          backgroundColor: orderKind === k ? palette.accent : 'transparent',
                        }}>
                        <Text
                          className="text-center text-[11px] font-bold"
                          style={{ color: orderKind === k ? '#000' : palette.textMuted }}>
                          {k}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View
                    className="flex-1 flex-row overflow-hidden rounded-lg border"
                    style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
                    {(['maker', 'taker'] as const).map((f) => (
                      <Pressable
                        key={f}
                        onPress={() => setFeeScenario(f)}
                        className="flex-1 py-2"
                        style={{
                          backgroundColor: feeScenario === f ? `${palette.accent}33` : 'transparent',
                        }}>
                        <Text
                          className="text-center text-[11px] font-bold capitalize"
                          style={{ color: feeScenario === f ? palette.accent : palette.textMuted }}>
                          {f}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View
                  className="mb-3 rounded-lg border px-3 py-2"
                  style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
                  <Text className="text-[10px] font-bold uppercase" style={{ color: palette.textMuted }}>
                    Paper wallet (USDT)
                  </Text>
                  <Text className="mt-1 font-mono text-lg font-black tabular-nums" style={{ color: palette.accent }}>
                    ${paperUsdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>

                {orderKind === 'Limit' ? (
                  <View className="mb-3">
                    <Text className="mb-1 text-[11px] font-bold" style={{ color: palette.textMuted }}>
                      Limit price
                    </Text>
                    <TextInput
                      keyboardType="decimal-pad"
                      placeholder={execMark.toFixed(2)}
                      placeholderTextColor={palette.textMuted}
                      value={limitStr}
                      onChangeText={setLimitStr}
                      className="rounded-lg border px-3 py-2 font-mono text-sm tabular-nums"
                      style={{
                        borderColor: palette.border,
                        color: palette.text,
                        backgroundColor: palette.surface2,
                      }}
                    />
                  </View>
                ) : null}

                <View className="mb-3">
                  <Text className="mb-1 text-[11px] font-bold" style={{ color: palette.textMuted }}>
                    Size (USDT notional)
                  </Text>
                  <TextInput
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={palette.textMuted}
                    value={amountStr}
                    onChangeText={(t) => {
                      setAmountStr(t);
                      setAmtPct(null);
                    }}
                    className="rounded-lg border px-3 py-2 font-mono text-sm tabular-nums"
                    style={{
                      borderColor: palette.border,
                      color: palette.text,
                      backgroundColor: palette.surface2,
                    }}
                  />
                  <View className="mt-2 flex-row gap-1">
                    {[25, 50, 75, 100].map((p) => (
                      <Pressable
                        key={p}
                        onPress={() => setPct(p)}
                        className="flex-1 rounded border py-1.5"
                        style={{
                          borderColor: amtPct === p ? palette.accent : palette.border,
                          backgroundColor: amtPct === p ? `${palette.accent}22` : 'transparent',
                        }}>
                        <Text
                          className="text-center text-[10px] font-bold"
                          style={{ color: amtPct === p ? palette.accent : palette.textMuted }}>
                          {p}%
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            ) : null}

            <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Leverage ({leverage}x)
            </Text>
            <Slider
              style={{ width: '100%', height: 44, marginTop: 4 }}
              minimumValue={1}
              maximumValue={maxLev}
              step={1}
              value={Math.min(leverage, maxLev)}
              onValueChange={(v) => setLeverage(Math.round(v))}
              minimumTrackTintColor={palette.accent}
              maximumTrackTintColor={palette.border}
              thumbTintColor={palette.text}
            />

            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={() => setMarginMode('cross')}
                className="flex-1 rounded-xl border px-2 py-3"
                style={{
                  borderColor: marginMode === 'cross' ? palette.accent : palette.border,
                  backgroundColor: marginMode === 'cross' ? `${palette.accent}18` : palette.surface2,
                }}>
                <Text className="text-center text-xs font-bold" style={{ color: palette.text }}>
                  Cross
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMarginMode('isolated')}
                className="flex-1 rounded-xl border px-2 py-3"
                style={{
                  borderColor: marginMode === 'isolated' ? palette.accent : palette.border,
                  backgroundColor: marginMode === 'isolated' ? `${palette.accent}18` : palette.surface2,
                }}>
                <Text className="text-center text-xs font-bold" style={{ color: palette.text }}>
                  Isolated
                </Text>
              </Pressable>
            </View>

            <View
              className="mt-5 rounded-2xl border p-4"
              style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
              <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
                Margin required (USD)
              </Text>
              <Text className="mt-1 text-2xl font-black tabular-nums" style={{ color: palette.text }}>
                ${marginUsd.toFixed(2)}
              </Text>
              <Text className="mt-2 text-xs" style={{ color: palette.textMuted }}>
                Est. liq @ {liq.toFixed(2)} · chart qty {positionQty} · ref {entryPrice.toFixed(2)}
              </Text>
            </View>

            {mode === 'crypto' ? (
              <View className="mt-5">
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-[11px] font-bold" style={{ color: palette.text }}>
                    Take profit / Stop loss
                  </Text>
                  <Pressable
                    onPress={autoTPSL}
                    className="rounded border px-2 py-1"
                    style={{ borderColor: palette.accent, backgroundColor: `${palette.accent}18` }}>
                    <Text className="text-[10px] font-bold" style={{ color: palette.accent }}>
                      Auto ±2%
                    </Text>
                  </Pressable>
                </View>
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Text className="mb-1 text-[10px] font-bold text-emerald-400">TP</Text>
                    <TextInput
                      keyboardType="decimal-pad"
                      value={tpStr}
                      onChangeText={setTpStr}
                      onBlur={applyTpSlFromInputs}
                      className="rounded-lg border px-2 py-2 font-mono text-xs tabular-nums"
                      style={{
                        borderColor: '#22c55e88',
                        color: palette.text,
                        backgroundColor: palette.surface2,
                      }}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="mb-1 text-[10px] font-bold text-rose-400">SL</Text>
                    <TextInput
                      keyboardType="decimal-pad"
                      value={slStr}
                      onChangeText={setSlStr}
                      onBlur={applyTpSlFromInputs}
                      className="rounded-lg border px-2 py-2 font-mono text-xs tabular-nums"
                      style={{
                        borderColor: '#f8717188',
                        color: palette.text,
                        backgroundColor: palette.surface2,
                      }}
                    />
                  </View>
                </View>
                <Text className="mt-2 text-center text-[10px]" style={{ color: palette.textMuted }}>
                  Chart sliders still fine-tune TP/SL · inputs commit on blur
                </Text>
              </View>
            ) : null}

            {mode === 'crypto' && notionalPreview > 0 ? (
              <View
                className="mt-4 rounded-xl border p-3"
                style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
                <Text className="mb-2 text-[10px] font-bold uppercase" style={{ color: palette.textMuted }}>
                  Order summary
                </Text>
                {(
                  [
                    ['Notional', `$${notionalPreview.toFixed(2)}`, palette.text],
                    ['Margin', `$${marginPreview.toFixed(2)}`, palette.accent],
                    [`Fee (${feeScenario})`, `-$${feePreview.toFixed(4)}`, '#f87171'],
                    ['Total cost', `$${totalPreview.toFixed(2)}`, palette.text],
                  ] as const
                ).map(([a, b, c]) => (
                  <View key={a} className="mb-1 flex-row justify-between">
                    <Text className="text-[11px]" style={{ color: palette.textMuted }}>
                      {a}
                    </Text>
                    <Text className="font-mono text-[11px] font-semibold tabular-nums" style={{ color: c }}>
                      {b}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {msg ? (
              <View
                className="mt-3 rounded-lg border px-3 py-2"
                style={{
                  borderColor: msg.t === 'ok' ? '#22c55e' : '#f87171',
                  backgroundColor: msg.t === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(248,113,113,0.12)',
                }}>
                <Text
                  className="text-center text-xs font-semibold"
                  style={{ color: msg.t === 'ok' ? '#86efac' : '#fecaca' }}>
                  {msg.m}
                </Text>
              </View>
            ) : null}

            <Text className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
              Buy / sell zone
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setSide('short')}
                className="flex-1 items-center rounded-2xl border-2 py-4 active:opacity-90"
                style={{ borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.12)' }}>
                <Text className="text-lg font-black text-red-300">Short</Text>
                <Text className="mt-1 text-[10px]" style={{ color: palette.textMuted }}>
                  {side === 'short' ? 'armed' : 'tap'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSide('long')}
                className="flex-1 items-center rounded-2xl border-2 py-4 active:opacity-90"
                style={{ borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.12)' }}>
                <Text className="text-lg font-black text-emerald-300">Long</Text>
                <Text className="mt-1 text-[10px]" style={{ color: palette.textMuted }}>
                  {side === 'long' ? 'armed' : 'tap'}
                </Text>
              </Pressable>
            </View>

            {mode === 'crypto' ? (
              <Pressable
                onPress={placePaper}
                disabled={busy}
                className="mt-6 rounded-xl py-3.5 active:opacity-90"
                style={{
                  backgroundColor: side === 'long' ? '#22c55e' : '#f87171',
                  opacity: busy ? 0.6 : 1,
                }}>
                <Text className="text-center text-sm font-black" style={{ color: side === 'long' ? '#000' : '#fff' }}>
                  {busy ? 'Placing…' : `${side === 'long' ? 'Open paper LONG' : 'Open paper SHORT'} · ${symbol.replace('USDT', '')}`}
                </Text>
              </Pressable>
            ) : null}

            <Text className="mt-6 text-center text-[11px]" style={{ color: palette.textMuted }}>
              Simulated execution. Sync to Firestore when auth + rules are wired — never ship API keys in source.
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
