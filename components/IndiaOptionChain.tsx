import { memo, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { NseOptionChainRow } from '@/services/api/angelOptionChain';
import type { ThemePalette } from '@/store/themeStore';

type Props = {
  spotPrice: number;
  rows: NseOptionChainRow[];
  /** Optional: avoid `useThemeStore` in every row. */
  palette: ThemePalette;
};

function itmCall(spot: number, strike: number) {
  return strike < spot;
}
function itmPut(spot: number, strike: number) {
  return strike > spot;
}

function g(n: number | undefined, digits: number) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toFixed(digits);
}

type StrikeRowProps = {
  r: NseOptionChainRow;
  spotPrice: number;
  palette: ThemePalette;
};

const OptionStrikeRow = memo(function OptionStrikeRow({ r, spotPrice, palette }: StrikeRowProps) {
  const callItm = itmCall(spotPrice, r.strike);
  const putItm = itmPut(spotPrice, r.strike);
  const ceBg = callItm ? 'rgba(34,197,94,0.12)' : 'transparent';
  const peBg = putItm ? 'rgba(248,113,113,0.12)' : 'transparent';
  const gCe = r.ce.greeks;
  const gPe = r.pe.greeks;
  return (
    <View className="flex-row border-b py-0.5" style={{ borderColor: palette.border }}>
      <Text className="w-14 text-center font-mono text-[10px] tabular-nums" style={{ color: palette.text, backgroundColor: ceBg }}>
        {r.ce.oi.toLocaleString()}
      </Text>
      <Text className="w-14 text-center font-mono text-[10px] tabular-nums" style={{ color: palette.text, backgroundColor: ceBg }}>
        {r.ce.oiChange.toLocaleString()}
      </Text>
      <Text className="w-12 text-center font-mono text-[10px] tabular-nums" style={{ color: palette.text, backgroundColor: ceBg }}>
        {r.ce.volume.toLocaleString()}
      </Text>
      <Text className="w-11 text-center font-mono text-[10px] tabular-nums" style={{ color: palette.text, backgroundColor: ceBg }}>
        {(r.ce.iv * 100).toFixed(1)}%
      </Text>
      <Text className="w-12 text-center font-mono text-[10px] font-semibold tabular-nums" style={{ color: palette.text, backgroundColor: ceBg }}>
        {r.ce.ltp.toFixed(2)}
      </Text>
      <Text className="w-11 text-center font-mono text-[9px] tabular-nums" style={{ color: palette.textMuted, backgroundColor: ceBg }}>
        {g(gCe.delta, 3)}
      </Text>
      <Text className="w-11 text-center font-mono text-[9px] tabular-nums" style={{ color: palette.textMuted, backgroundColor: ceBg }}>
        {g(gCe.gamma, 3)}
      </Text>
      <Text className="w-11 text-center font-mono text-[9px] tabular-nums" style={{ color: palette.textMuted, backgroundColor: ceBg }}>
        {g(gCe.theta, 3)}
      </Text>
      <Text className="w-11 text-center font-mono text-[9px] tabular-nums" style={{ color: palette.textMuted, backgroundColor: ceBg }}>
        {g(gCe.vega, 3)}
      </Text>

      <View
        className="w-14 items-center justify-center py-0.5"
        style={{
          backgroundColor: Math.abs(r.strike - spotPrice) < 40 ? `${palette.accent}28` : palette.surface2,
        }}>
        <Text className="font-mono text-[11px] font-black tabular-nums" style={{ color: palette.accent }}>
          {r.strike}
        </Text>
      </View>

      <Text className="w-12 text-center font-mono text-[10px] font-semibold tabular-nums" style={{ color: palette.text, backgroundColor: peBg }}>
        {r.pe.ltp.toFixed(2)}
      </Text>
      <Text className="w-11 text-center font-mono text-[10px] tabular-nums" style={{ color: palette.text, backgroundColor: peBg }}>
        {(r.pe.iv * 100).toFixed(1)}%
      </Text>
      <Text className="w-12 text-center font-mono text-[10px] tabular-nums" style={{ color: palette.text, backgroundColor: peBg }}>
        {r.pe.volume.toLocaleString()}
      </Text>
      <Text className="w-14 text-center font-mono text-[10px] tabular-nums" style={{ color: palette.text, backgroundColor: peBg }}>
        {r.pe.oiChange.toLocaleString()}
      </Text>
      <Text className="w-14 text-center font-mono text-[10px] tabular-nums" style={{ color: palette.text, backgroundColor: peBg }}>
        {r.pe.oi.toLocaleString()}
      </Text>
      <Text className="w-11 text-center font-mono text-[9px] tabular-nums" style={{ color: palette.textMuted, backgroundColor: peBg }}>
        {g(gPe.delta, 3)}
      </Text>
      <Text className="w-11 text-center font-mono text-[9px] tabular-nums" style={{ color: palette.textMuted, backgroundColor: peBg }}>
        {g(gPe.gamma, 3)}
      </Text>
      <Text className="w-11 text-center font-mono text-[9px] tabular-nums" style={{ color: palette.textMuted, backgroundColor: peBg }}>
        {g(gPe.theta, 3)}
      </Text>
      <Text className="w-11 text-center font-mono text-[9px] tabular-nums" style={{ color: palette.textMuted, backgroundColor: peBg }}>
        {g(gPe.vega, 3)}
      </Text>
    </View>
  );
});

/** NSE-style option chain: OI, ΔOI, volume, IV, LTP, Greeks — ITM strikes highlighted. */
export { OptionStrikeRow as OptionChainRow };

export const IndiaOptionChain = memo(function IndiaOptionChain({ spotPrice, rows, palette }: Props) {
  const sorted = useMemo(() => [...rows].sort((a, b) => a.strike - b.strike), [rows]);

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: 900 }}>
            <View
              className="flex-row border-b py-1"
              style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
              <Text className="w-14 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                CE OI
              </Text>
              <Text className="w-14 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                ΔOI
              </Text>
              <Text className="w-12 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                Vol
              </Text>
              <Text className="w-11 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                IV
              </Text>
              <Text className="w-12 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                LTP
              </Text>
              <Text className="w-11 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                Δ
              </Text>
              <Text className="w-11 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                Γ
              </Text>
              <Text className="w-11 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                Θ
              </Text>
              <Text className="w-11 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                Vega
              </Text>
              <Text className="w-14 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                Strike
              </Text>
              <Text className="w-12 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                LTP
              </Text>
              <Text className="w-11 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                IV
              </Text>
              <Text className="w-12 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                Vol
              </Text>
              <Text className="w-14 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                ΔOI
              </Text>
              <Text className="w-14 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                PE OI
              </Text>
              <Text className="w-11 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                Δ
              </Text>
              <Text className="w-11 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                Γ
              </Text>
              <Text className="w-11 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                Θ
              </Text>
              <Text className="w-11 text-center font-sans text-[9px] font-bold uppercase" style={{ color: palette.textMuted }}>
                Vega
              </Text>
            </View>

            {sorted.map((r) => (
              <OptionStrikeRow key={r.strike} r={r} spotPrice={spotPrice} palette={palette} />
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
});
