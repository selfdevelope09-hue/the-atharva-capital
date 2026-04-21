import Slider from '@react-native-community/slider';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View, ViewStyle } from 'react-native';
import { MarketConfig } from '../../constants/markets';
import { fmtMoney, FEE_DEFAULTS, T } from '../../constants/theme';

type Side = 'long' | 'short';
type OrderType = 'market' | 'limit';
type FeeRole = 'maker' | 'taker';

export interface OrderFormValue {
  side: Side;
  orderType: OrderType;
  feeRole: FeeRole;
  amount: number;
  limitPrice: number | null;
  leverage: number;
  tp: number | null;
  sl: number | null;
}

export interface OrderFormProps {
  market: MarketConfig;
  lastPrice: number | null;
  balance: number;
  value: OrderFormValue;
  onChange: (next: OrderFormValue) => void;
  onSubmit?: (v: OrderFormValue) => void;
  style?: ViewStyle;
}

const LEVERAGE_PRESETS = [1, 2, 5, 10, 25, 50, 75, 100, 125];

export function OrderForm(props: OrderFormProps) {
  const { market, lastPrice, balance, value, onChange, onSubmit, style } = props;
  const [amountStr, setAmountStr] = useState<string>(value.amount ? String(value.amount) : '');
  const [limitStr, setLimitStr] = useState<string>(value.limitPrice != null ? String(value.limitPrice) : '');
  const [tpStr, setTpStr] = useState<string>(value.tp != null ? String(value.tp) : '');
  const [slStr, setSlStr] = useState<string>(value.sl != null ? String(value.sl) : '');

  const maxLev = market.maxLeverage ?? 1;
  const price = value.orderType === 'limit' && value.limitPrice ? value.limitPrice : (lastPrice ?? 0);

  const feeRate = value.feeRole === 'maker' ? market.fees?.maker ?? FEE_DEFAULTS.maker : market.fees?.taker ?? FEE_DEFAULTS.taker;
  const notional = value.amount * price;
  const margin = value.leverage > 0 ? notional / value.leverage : notional;
  const fee = notional * feeRate;
  const total = margin + fee;

  const estProfit = useMemo(() => {
    if (value.tp == null || !price) return null;
    const raw = (value.tp - price) * value.amount;
    return value.side === 'long' ? raw : -raw;
  }, [value.tp, value.amount, value.side, price]);

  const estLoss = useMemo(() => {
    if (value.sl == null || !price) return null;
    const raw = (value.sl - price) * value.amount;
    return value.side === 'long' ? raw : -raw;
  }, [value.sl, value.amount, value.side, price]);

  const update = (patch: Partial<OrderFormValue>) => onChange({ ...value, ...patch });

  const setPctOfBalance = (pct: number) => {
    if (!price) return;
    const budget = balance * (pct / 100) * Math.max(1, value.leverage);
    const nextAmt = price > 0 ? budget / price : 0;
    setAmountStr(nextAmt.toFixed(6));
    update({ amount: nextAmt });
  };

  const setAutoTpSl = () => {
    if (!price) return;
    const tp = value.side === 'long' ? price * 1.02 : price * 0.98;
    const sl = value.side === 'long' ? price * 0.98 : price * 1.02;
    setTpStr(tp.toFixed(2));
    setSlStr(sl.toFixed(2));
    update({ tp, sl });
  };

  const parseNum = (s: string): number | null => {
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  };

  return (
    <View style={[{ backgroundColor: T.bg1, borderRadius: T.radiusLg, borderWidth: 1, borderColor: T.border, padding: 16, gap: 14 }, style]}>
      <SegmentRow
        options={[
          { id: 'market', label: 'Market' },
          { id: 'limit', label: 'Limit' },
        ]}
        value={value.orderType}
        onChange={(id) => update({ orderType: id as OrderType })}
      />

      <SegmentRow
        options={[
          { id: 'long', label: 'Long', activeColor: T.green },
          { id: 'short', label: 'Short', activeColor: T.red },
        ]}
        value={value.side}
        onChange={(id) => update({ side: id as Side })}
      />

      <SegmentRow
        options={[
          { id: 'maker', label: `Maker ${pct(market.fees?.maker ?? FEE_DEFAULTS.maker)}` },
          { id: 'taker', label: `Taker ${pct(market.fees?.taker ?? FEE_DEFAULTS.taker)}` },
        ]}
        value={value.feeRole}
        onChange={(id) => update({ feeRole: id as FeeRole })}
      />

      {value.orderType === 'limit' && (
        <Field label={`Limit price (${market.currencySymbol})`}>
          <TextInput
            keyboardType="decimal-pad"
            value={limitStr}
            onChangeText={(s) => {
              setLimitStr(s);
              update({ limitPrice: parseNum(s) });
            }}
            placeholder={price ? price.toFixed(2) : '0.00'}
            placeholderTextColor={T.text3}
            style={inputStyle}
          />
        </Field>
      )}

      <Field label={`Amount (${market.pairs[0] ?? 'units'})`}>
        <TextInput
          keyboardType="decimal-pad"
          value={amountStr}
          onChangeText={(s) => {
            setAmountStr(s);
            update({ amount: parseNum(s) ?? 0 });
          }}
          placeholder="0.00"
          placeholderTextColor={T.text3}
          style={inputStyle}
        />
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {[25, 50, 75, 100].map((p) => (
            <Pressable
              key={p}
              onPress={() => setPctOfBalance(p)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: T.radiusSm, backgroundColor: T.bg2, alignItems: 'center' }}
            >
              <Text style={{ color: T.text1, fontSize: 12, fontWeight: '600' }}>{p}%</Text>
            </Pressable>
          ))}
        </View>
      </Field>

      <Field label={`Leverage  ·  ${value.leverage}x   (max ${maxLev}x)`}>
        <Slider
          minimumValue={1}
          maximumValue={maxLev}
          step={1}
          value={value.leverage}
          minimumTrackTintColor={market.accentColor ?? T.yellow}
          maximumTrackTintColor={T.border}
          thumbTintColor={market.accentColor ?? T.yellow}
          onValueChange={(v) => update({ leverage: Math.round(v) })}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {LEVERAGE_PRESETS.filter((p) => p <= maxLev).map((p) => {
            const active = value.leverage === p;
            return (
              <Pressable
                key={p}
                onPress={() => update({ leverage: p })}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: T.radiusSm,
                  backgroundColor: active ? market.accentColor ?? T.yellow : T.bg2,
                }}
              >
                <Text style={{ color: active ? '#000' : T.text1, fontSize: 12, fontWeight: '700' }}>{p}x</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="Take Profit">
            <TextInput
              keyboardType="decimal-pad"
              value={tpStr}
              onChangeText={(s) => {
                setTpStr(s);
                update({ tp: parseNum(s) });
              }}
              placeholder="—"
              placeholderTextColor={T.text3}
              style={inputStyle}
            />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Stop Loss">
            <TextInput
              keyboardType="decimal-pad"
              value={slStr}
              onChangeText={(s) => {
                setSlStr(s);
                update({ sl: parseNum(s) });
              }}
              placeholder="—"
              placeholderTextColor={T.text3}
              style={inputStyle}
            />
          </Field>
        </View>
      </View>

      <Pressable onPress={setAutoTpSl} style={{ alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 10, borderRadius: T.radiusSm, backgroundColor: T.bg2 }}>
        <Text style={{ color: T.text1, fontSize: 12, fontWeight: '600' }}>Auto ±2%</Text>
      </Pressable>

      <View style={{ backgroundColor: T.bg0, borderRadius: T.radiusMd, borderWidth: 1, borderColor: T.border, padding: 12, gap: 6 }}>
        <SummaryRow label="Price" value={fmtMoney(price || null, market.currencySymbol)} />
        <SummaryRow label="Notional" value={fmtMoney(notional, market.currencySymbol)} />
        <SummaryRow label="Margin" value={fmtMoney(margin, market.currencySymbol)} />
        <SummaryRow label={`Fee (${pct(feeRate)})`} value={fmtMoney(fee, market.currencySymbol)} />
        <SummaryRow label="Total cost" value={fmtMoney(total, market.currencySymbol)} strong />
        {estProfit != null && <SummaryRow label="Est. profit @ TP" value={fmtMoney(estProfit, market.currencySymbol)} valueColor={estProfit >= 0 ? T.green : T.red} />}
        {estLoss != null && <SummaryRow label="Est. loss @ SL" value={fmtMoney(estLoss, market.currencySymbol)} valueColor={estLoss >= 0 ? T.green : T.red} />}
      </View>

      <Pressable
        onPress={() => onSubmit?.(value)}
        style={{
          backgroundColor: value.side === 'long' ? T.green : T.red,
          paddingVertical: 14,
          borderRadius: T.radiusMd,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#000', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 }}>
          {value.side === 'long' ? 'BUY / LONG' : 'SELL / SHORT'}
        </Text>
      </Pressable>
    </View>
  );
}

function SegmentRow<T extends string>(props: {
  options: { id: T; label: string; activeColor?: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: T.bg2, borderRadius: T.radiusMd, padding: 4 }}>
      {props.options.map((o) => {
        const active = props.value === o.id;
        const bg = active ? o.activeColor ?? T.yellow : 'transparent';
        const fg = active ? '#000' : T.text1;
        return (
          <Pressable key={o.id} onPress={() => props.onChange(o.id)} style={{ flex: 1, paddingVertical: 8, borderRadius: T.radiusSm, backgroundColor: bg, alignItems: 'center' }}>
            <Text style={{ color: fg, fontWeight: '700', fontSize: 12 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ color: T.text2, fontSize: 11, fontWeight: '600', marginBottom: 6, letterSpacing: 0.4 }}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function SummaryRow({ label, value, strong, valueColor }: { label: string; value: string; strong?: boolean; valueColor?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: T.text2, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: valueColor ?? T.text0, fontSize: 12, fontWeight: strong ? '800' : '600' }}>{value}</Text>
    </View>
  );
}

const inputStyle = {
  backgroundColor: T.bg0,
  borderWidth: 1,
  borderColor: T.border,
  borderRadius: T.radiusMd,
  paddingHorizontal: 12,
  paddingVertical: 10,
  color: T.text0,
  fontSize: 14,
};

function pct(v: number): string {
  return `${(v * 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}%`;
}
