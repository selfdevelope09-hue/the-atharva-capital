import Slider from '@react-native-community/slider';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { CRYPTO_THEME, displayBase, formatPrice } from '@/components/crypto/cryptoTheme';

export type OrderMode = 'market' | 'limit';
export type OrderSide = 'long' | 'short';
export type FeeTier = 'maker' | 'taker';

export const MAKER_FEE = 0.0002; // 0.02%
export const TAKER_FEE = 0.0005; // 0.05%

export type OrderFormState = {
  symbol: string;
  mode: OrderMode;
  setMode: (m: OrderMode) => void;
  feeTier: FeeTier;
  setFeeTier: (f: FeeTier) => void;
  side: OrderSide;
  setSide: (s: OrderSide) => void;
  amountUsd: string;
  setAmountUsd: (s: string) => void;
  /** Available balance (USDT). */
  availableUsd: number;
  leverage: number;
  setLeverage: (n: number) => void;
  livePrice: number;
  entry: number;
  setEntry: (n: number) => void;
  takeProfit: number;
  setTakeProfit: (n: number) => void;
  stopLoss: number;
  setStopLoss: (n: number) => void;
  onSubmit: () => void;
};

export type OrderFormPanelProps = OrderFormState & {
  /** Desktop rail (default) or mobile slide-up sheet. */
  layout?: 'rail' | 'sheet';
  onClose?: () => void;
};

const LEVERAGE_PRESETS = [1, 5, 10, 25, 50, 100, 125];

export function OrderFormPanel(props: OrderFormPanelProps) {
  const {
    symbol,
    mode,
    setMode,
    feeTier,
    setFeeTier,
    side,
    setSide,
    amountUsd,
    setAmountUsd,
    availableUsd,
    leverage,
    setLeverage,
    livePrice,
    entry,
    setEntry,
    takeProfit,
    setTakeProfit,
    stopLoss,
    setStopLoss,
    onSubmit,
    layout = 'rail',
    onClose,
  } = props;

  const amount = parseAmount(amountUsd);
  const effectiveEntry = mode === 'market' ? livePrice : entry || livePrice;
  const notional = amount * leverage;
  const quantity = effectiveEntry > 0 ? notional / effectiveEntry : 0;
  const margin = amount;
  const feeRate = feeTier === 'maker' ? MAKER_FEE : TAKER_FEE;
  const fee = notional * feeRate;
  const totalCost = margin + fee;

  const { estProfit, estLoss } = useMemo(() => {
    const dirSign = side === 'long' ? 1 : -1;
    const profit = quantity * (takeProfit - effectiveEntry) * dirSign - fee;
    const loss = quantity * (stopLoss - effectiveEntry) * dirSign - fee;
    return { estProfit: profit, estLoss: loss };
  }, [quantity, takeProfit, stopLoss, effectiveEntry, side, fee]);

  const applyPct = (pct: number) => {
    const v = availableUsd * pct;
    setAmountUsd(v > 0 ? v.toFixed(2) : '0');
  };

  const autoTpSl = () => {
    const p = effectiveEntry || livePrice;
    if (p <= 0) return;
    if (side === 'long') {
      setTakeProfit(p * 1.02);
      setStopLoss(p * 0.98);
    } else {
      setTakeProfit(p * 0.98);
      setStopLoss(p * 1.02);
    }
  };

  const containerStyle =
    layout === 'sheet'
      ? {
          width: '100%' as const,
          maxHeight: '80%' as const,
          backgroundColor: CRYPTO_THEME.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: 1,
          borderColor: CRYPTO_THEME.border,
        }
      : {
          width: 340,
          height: '100%' as const,
          backgroundColor: CRYPTO_THEME.surface,
          borderLeftWidth: 1,
          borderColor: CRYPTO_THEME.border,
        };

  return (
    <View style={containerStyle}>
      {layout === 'sheet' ? (
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <View
            style={{
              width: 44,
              height: 4,
              borderRadius: 2,
              backgroundColor: CRYPTO_THEME.borderStrong,
            }}
          />
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: CRYPTO_THEME.border,
        }}>
        <Text style={{ color: CRYPTO_THEME.text, fontSize: 14, fontWeight: '800' }}>
          {displayBase(symbol)}
          <Text style={{ color: CRYPTO_THEME.textMuted, fontWeight: '600' }}> /USDT</Text>
        </Text>
        {onClose ? (
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: CRYPTO_THEME.textMuted, fontSize: 18 }}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 14 }}
        keyboardShouldPersistTaps="handled">
        <SegControl<OrderMode>
          options={[
            { v: 'market', label: 'Market' },
            { v: 'limit', label: 'Limit' },
          ]}
          value={mode}
          onChange={setMode}
        />

        <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
          <SideButton
            label="Long"
            active={side === 'long'}
            color={CRYPTO_THEME.up}
            onPress={() => setSide('long')}
          />
          <SideButton
            label="Short"
            active={side === 'short'}
            color={CRYPTO_THEME.down}
            onPress={() => setSide('short')}
          />
        </View>

        <Label>Fee tier</Label>
        <SegControl<FeeTier>
          options={[
            { v: 'maker', label: 'Maker 0.02%' },
            { v: 'taker', label: 'Taker 0.05%' },
          ]}
          value={feeTier}
          onChange={setFeeTier}
        />

        {mode === 'limit' ? (
          <>
            <Label>Limit price (USDT)</Label>
            <TextInput
              value={entry > 0 ? String(entry) : ''}
              onChangeText={(t) => setEntry(parseAmount(t))}
              placeholder={formatPrice(livePrice)}
              placeholderTextColor={CRYPTO_THEME.textDim}
              keyboardType="decimal-pad"
              style={inputStyle}
            />
          </>
        ) : null}

        <Label>Amount (USDT margin)</Label>
        <TextInput
          value={amountUsd}
          onChangeText={setAmountUsd}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={CRYPTO_THEME.textDim}
          style={inputStyle}
        />
        <View style={{ flexDirection: 'row', marginTop: 8, gap: 6 }}>
          {[0.25, 0.5, 0.75, 1].map((p) => (
            <Pressable
              key={p}
              onPress={() => applyPct(p)}
              style={{
                flex: 1,
                paddingVertical: 6,
                alignItems: 'center',
                borderRadius: 6,
                borderWidth: 1,
                borderColor: CRYPTO_THEME.border,
                backgroundColor: CRYPTO_THEME.surfaceAlt,
              }}>
              <Text style={{ color: CRYPTO_THEME.text, fontSize: 11, fontWeight: '700' }}>
                {Math.round(p * 100)}%
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: CRYPTO_THEME.textMuted, fontSize: 10, marginTop: 6 }}>
          Available: ${availableUsd.toFixed(2)} USDT
        </Text>

        <Label>Leverage — {leverage}×</Label>
        <Slider
          minimumValue={1}
          maximumValue={125}
          step={1}
          value={leverage}
          onValueChange={(v) => setLeverage(Math.round(v))}
          minimumTrackTintColor={CRYPTO_THEME.accent}
          maximumTrackTintColor={CRYPTO_THEME.border}
          thumbTintColor={CRYPTO_THEME.accent}
          style={{ width: '100%', height: 36, marginTop: 4 }}
        />
        <View style={{ flexDirection: 'row', marginTop: 4, gap: 6, flexWrap: 'wrap' }}>
          {LEVERAGE_PRESETS.map((lv) => (
            <Pressable
              key={lv}
              onPress={() => setLeverage(lv)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: leverage === lv ? CRYPTO_THEME.accent : CRYPTO_THEME.border,
                backgroundColor:
                  leverage === lv ? CRYPTO_THEME.accentSoft : CRYPTO_THEME.surfaceAlt,
              }}>
              <Text
                style={{
                  color: leverage === lv ? CRYPTO_THEME.accent : CRYPTO_THEME.text,
                  fontSize: 11,
                  fontWeight: '800',
                }}>
                {lv}×
              </Text>
            </Pressable>
          ))}
        </View>

        <View
          style={{
            marginTop: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <Text
            style={{
              color: CRYPTO_THEME.textMuted,
              fontSize: 10,
              fontWeight: '800',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}>
            TP / SL
          </Text>
          <Pressable
            onPress={autoTpSl}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: CRYPTO_THEME.accent,
              backgroundColor: CRYPTO_THEME.accentSoft,
            }}>
            <Text style={{ color: CRYPTO_THEME.accent, fontSize: 11, fontWeight: '800' }}>
              Auto ±2%
            </Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: CRYPTO_THEME.up, fontSize: 10, fontWeight: '800', marginBottom: 4 }}>
              Take Profit
            </Text>
            <TextInput
              value={takeProfit > 0 ? formatPrice(takeProfit) : ''}
              onChangeText={(t) => setTakeProfit(parseAmount(t))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={CRYPTO_THEME.textDim}
              style={inputStyle}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: CRYPTO_THEME.down, fontSize: 10, fontWeight: '800', marginBottom: 4 }}>
              Stop Loss
            </Text>
            <TextInput
              value={stopLoss > 0 ? formatPrice(stopLoss) : ''}
              onChangeText={(t) => setStopLoss(parseAmount(t))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={CRYPTO_THEME.textDim}
              style={inputStyle}
            />
          </View>
        </View>

        <SummaryBox
          margin={margin}
          fee={fee}
          totalCost={totalCost}
          estProfit={estProfit}
          estLoss={estLoss}
          notional={notional}
          quantity={quantity}
          symbol={symbol}
        />

        <Pressable
          onPress={onSubmit}
          style={{
            marginTop: 16,
            paddingVertical: 14,
            alignItems: 'center',
            borderRadius: 10,
            backgroundColor: side === 'long' ? CRYPTO_THEME.up : CRYPTO_THEME.down,
          }}>
          <Text style={{ color: '#0b0e11', fontSize: 14, fontWeight: '800' }}>
            {side === 'long' ? 'Open Long' : 'Open Short'} · {displayBase(symbol)}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/* ---------- pieces ------------------------------------------------------ */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: CRYPTO_THEME.textMuted,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginTop: 14,
        marginBottom: 6,
      }}>
      {children}
    </Text>
  );
}

const inputStyle = {
  paddingHorizontal: 10,
  paddingVertical: 10,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: CRYPTO_THEME.border,
  backgroundColor: CRYPTO_THEME.surfaceAlt,
  color: CRYPTO_THEME.text,
  fontSize: 14,
  fontWeight: '600' as const,
};

function SegControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 4,
        borderRadius: 8,
        backgroundColor: CRYPTO_THEME.surfaceAlt,
        borderWidth: 1,
        borderColor: CRYPTO_THEME.border,
        marginTop: 4,
      }}>
      {options.map((o) => {
        const active = o.v === value;
        return (
          <Pressable
            key={o.v}
            onPress={() => onChange(o.v)}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: 'center',
              borderRadius: 6,
              backgroundColor: active ? CRYPTO_THEME.accent : 'transparent',
            }}>
            <Text
              style={{
                color: active ? '#0b0e11' : CRYPTO_THEME.text,
                fontSize: 12,
                fontWeight: '800',
              }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SideButton({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: active ? color : CRYPTO_THEME.border,
        backgroundColor: active ? `${color}22` : CRYPTO_THEME.surfaceAlt,
      }}>
      <Text style={{ color: active ? color : CRYPTO_THEME.text, fontSize: 13, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryBox({
  margin,
  fee,
  totalCost,
  estProfit,
  estLoss,
  notional,
  quantity,
  symbol,
}: {
  margin: number;
  fee: number;
  totalCost: number;
  estProfit: number;
  estLoss: number;
  notional: number;
  quantity: number;
  symbol: string;
}) {
  return (
    <View
      style={{
        marginTop: 16,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: CRYPTO_THEME.border,
        backgroundColor: CRYPTO_THEME.surfaceAlt,
      }}>
      <Row label="Notional" value={`$${notional.toFixed(2)}`} />
      <Row label="Quantity" value={`${quantity.toFixed(6)} ${displayBase(symbol)}`} />
      <Row label="Margin" value={`$${margin.toFixed(2)}`} />
      <Row label="Fee" value={`$${fee.toFixed(4)}`} />
      <Row label="Total cost" value={`$${totalCost.toFixed(2)}`} bold />
      <Row
        label="Est. profit (at TP)"
        value={`${estProfit >= 0 ? '+' : ''}$${estProfit.toFixed(2)}`}
        color={estProfit >= 0 ? CRYPTO_THEME.up : CRYPTO_THEME.down}
      />
      <Row
        label="Est. loss (at SL)"
        value={`${estLoss >= 0 ? '+' : ''}$${estLoss.toFixed(2)}`}
        color={estLoss >= 0 ? CRYPTO_THEME.up : CRYPTO_THEME.down}
      />
    </View>
  );
}

function Row({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 3,
      }}>
      <Text style={{ color: CRYPTO_THEME.textMuted, fontSize: 11 }}>{label}</Text>
      <Text
        style={{
          color: color ?? CRYPTO_THEME.text,
          fontSize: 12,
          fontWeight: bold ? '800' : '600',
          fontVariant: ['tabular-nums'],
        }}>
        {value}
      </Text>
    </View>
  );
}

function parseAmount(raw: string | number): number {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : 0;
  const n = parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
