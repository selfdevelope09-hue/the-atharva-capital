import { useMemo, useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';

import { CRYPTO_THEME, formatPrice } from '@/components/crypto/cryptoTheme';

export type TpSlOverlayProps = {
  entry: number;
  takeProfit: number;
  stopLoss: number;
  side: 'long' | 'short';
  onChange: (patch: { takeProfit?: number; stopLoss?: number }) => void;
  /** Visible price range for mapping y-coordinates → price. Derived from live 24h H/L. */
  priceBand: { high: number; low: number };
};

/**
 * Canvas-equivalent overlay layered above the chart frame.
 *
 * - Green dashed line = Take Profit (draggable).
 * - Red dashed line   = Stop Loss  (draggable).
 * - Price tag pill on the right edge of each line.
 * - PnL % badge in the middle of each line.
 * - Midpoint drag handle (circle).
 * - R:R ratio badge floats at top-right.
 *
 * `style.pointerEvents: 'box-none'` lets taps pass through to the TradingView iframe
 * everywhere except on the actual drag handles and price pills.
 */
export function TpSlOverlay({
  entry,
  takeProfit,
  stopLoss,
  side,
  onChange,
  priceBand,
}: TpSlOverlayProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const { top, bottom } = useMemo(() => paddedBand(priceBand, entry, takeProfit, stopLoss), [
    priceBand,
    entry,
    takeProfit,
    stopLoss,
  ]);

  const priceToY = (price: number): number => {
    if (bottom === top || size.h <= 0) return size.h / 2;
    const ratio = (top - price) / (top - bottom);
    return Math.max(0, Math.min(size.h, ratio * size.h));
  };

  const yToPrice = (y: number): number => {
    if (size.h <= 0) return price(entry);
    const clamped = Math.max(0, Math.min(size.h, y));
    const ratio = clamped / size.h;
    return price(top - ratio * (top - bottom));
  };

  const rr = useMemo(() => computeRR(entry, takeProfit, stopLoss, side), [
    entry,
    takeProfit,
    stopLoss,
    side,
  ]);

  const tpY = priceToY(takeProfit);
  const slY = priceToY(stopLoss);
  const entryY = priceToY(entry);

  const tpPnl = pctPnl(entry, takeProfit, side);
  const slPnl = pctPnl(entry, stopLoss, side);

  return (
    <View
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        pointerEvents: 'box-none',
      }}>
      {/* Entry reference (non-interactive). */}
      <DashedLine y={entryY} color={CRYPTO_THEME.accent} label="Entry" tagColor={CRYPTO_THEME.accent} labelText={formatPrice(entry)} pnlText={null} interactive={false} width={size.w} />

      {/* Take Profit — draggable */}
      <DraggableLine
        y={tpY}
        color={CRYPTO_THEME.up}
        labelText={formatPrice(takeProfit)}
        pnlText={`${tpPnl >= 0 ? '+' : ''}${tpPnl.toFixed(2)}%`}
        labelTag="TP"
        containerH={size.h}
        width={size.w}
        onDrag={(y) => onChange({ takeProfit: yToPrice(y) })}
      />

      {/* Stop Loss — draggable */}
      <DraggableLine
        y={slY}
        color={CRYPTO_THEME.down}
        labelText={formatPrice(stopLoss)}
        pnlText={`${slPnl >= 0 ? '+' : ''}${slPnl.toFixed(2)}%`}
        labelTag="SL"
        containerH={size.h}
        width={size.w}
        onDrag={(y) => onChange({ stopLoss: yToPrice(y) })}
      />

      {/* R:R badge */}
      <View
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: rr >= 2 ? CRYPTO_THEME.up : CRYPTO_THEME.borderStrong,
          backgroundColor: rr >= 2 ? CRYPTO_THEME.upSoft : 'rgba(0,0,0,0.55)',
        }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            color: rr >= 2 ? CRYPTO_THEME.up : CRYPTO_THEME.text,
          }}>
          R:R {rr.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

/* ----- internal pieces --------------------------------------------------- */

function DashedLine({
  y,
  color,
  labelText,
  pnlText,
  tagColor,
  label,
  interactive,
  width,
}: {
  y: number;
  color: string;
  labelText: string;
  pnlText: string | null;
  tagColor: string;
  label: string;
  interactive: boolean;
  width: number;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: Math.max(0, y - 1),
        pointerEvents: interactive ? 'box-none' : 'none',
      }}>
      <DashedRule color={color} width={width} />
      <View
        style={{
          position: 'absolute',
          right: 6,
          top: -10,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
          backgroundColor: tagColor,
        }}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: '#0b0e11' }}>
          {label} {labelText}
        </Text>
      </View>
      {pnlText ? (
        <View
          style={{
            position: 'absolute',
            left: '50%',
            top: -10,
            marginLeft: -28,
            width: 56,
            paddingVertical: 2,
            borderRadius: 4,
            backgroundColor: 'rgba(0,0,0,0.75)',
            borderWidth: 1,
            borderColor: color,
          }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color, textAlign: 'center' }}>
            {pnlText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function DraggableLine({
  y,
  color,
  labelText,
  pnlText,
  labelTag,
  containerH,
  width,
  onDrag,
}: {
  y: number;
  color: string;
  labelText: string;
  pnlText: string;
  labelTag: string;
  containerH: number;
  width: number;
  onDrag: (y: number) => void;
}) {
  const startYRef = useRef(y);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startYRef.current = y;
      },
      onPanResponderMove: (_, g) => {
        const nextY = Math.max(0, Math.min(containerH, startYRef.current + g.dy));
        onDrag(nextY);
      },
    })
  ).current;

  // PanResponder captures the startY at grant time; we need it fresh each render.
  startYRef.current = y;

  return (
    <View
      style={{ position: 'absolute', left: 0, right: 0, top: Math.max(0, y - 12), pointerEvents: 'box-none' }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 11 }}>
        <DashedRule color={color} width={width} />
      </View>

      {/* Midpoint handle — capture drag */}
      <View
        {...panResponder.panHandlers}
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          marginLeft: -12,
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: color,
          borderWidth: 2,
          borderColor: '#0b0e11',
          shadowColor: color,
          shadowOpacity: 0.5,
          shadowRadius: 4,
        }}
      />

      {/* PnL badge next to handle */}
      <View
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          marginLeft: 18,
          paddingHorizontal: 6,
          height: 24,
          justifyContent: 'center',
          borderRadius: 4,
          backgroundColor: 'rgba(0,0,0,0.85)',
          borderWidth: 1,
          borderColor: color,
          pointerEvents: 'none',
        }}>
        <Text style={{ fontSize: 10, fontWeight: '800', color }}>{pnlText}</Text>
      </View>

      {/* Right-edge price pill */}
      <View
        style={{
          position: 'absolute',
          right: 6,
          top: 2,
          paddingHorizontal: 6,
          paddingVertical: 3,
          borderRadius: 4,
          backgroundColor: color,
          pointerEvents: 'none',
        }}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: '#0b0e11' }}>
          {labelTag} {labelText}
        </Text>
      </View>
    </View>
  );
}

function DashedRule({ color, width }: { color: string; width: number }) {
  const dash = 8;
  const gap = 6;
  const total = dash + gap;
  const count = Math.max(0, Math.floor(width / total));
  const segments = Array.from({ length: count });
  return (
    <View
      style={{
        width: '100%',
        height: 2,
        flexDirection: 'row',
        alignItems: 'center',
        pointerEvents: 'none',
      }}>
      {segments.map((_, i) => (
        <View
          key={i}
          style={{
            width: dash,
            height: 2,
            marginRight: gap,
            backgroundColor: color,
            opacity: 0.95,
          }}
        />
      ))}
    </View>
  );
}

function paddedBand(
  band: { high: number; low: number },
  entry: number,
  tp: number,
  sl: number
): { top: number; bottom: number } {
  const all = [band.high, band.low, entry, tp, sl].filter((n) => Number.isFinite(n) && n > 0);
  if (all.length === 0) return { top: entry * 1.1, bottom: entry * 0.9 };
  const hi = Math.max(...all);
  const lo = Math.min(...all);
  const span = Math.max(hi - lo, hi * 0.01);
  return { top: hi + span * 0.15, bottom: Math.max(0, lo - span * 0.15) };
}

function pctPnl(entry: number, target: number, side: 'long' | 'short'): number {
  if (!Number.isFinite(entry) || entry <= 0) return 0;
  const raw = ((target - entry) / entry) * 100;
  return side === 'short' ? -raw : raw;
}

function computeRR(
  entry: number,
  tp: number,
  sl: number,
  side: 'long' | 'short'
): number {
  const reward = Math.abs(tp - entry);
  const risk = Math.abs(entry - sl);
  if (risk <= 0) return 0;
  // Sanity: for long, tp should be > entry, sl < entry. For short, reverse.
  if (side === 'long' && (tp <= entry || sl >= entry)) return 0;
  if (side === 'short' && (tp >= entry || sl <= entry)) return 0;
  return reward / risk;
}

function price(v: number): number {
  return Number.isFinite(v) ? v : 0;
}
