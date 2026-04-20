/**
 * Chart + TP/SL overlay — web uses HTML Canvas + requestAnimationFrame (crypto-identical math).
 * Native uses View-based overlay matching `components/crypto/TpSlOverlay.tsx` (PanResponder handles).
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { T } from '../../constants/theme';
import {
  computeRR as rrCompute,
  getRange,
  pctPnl,
  priceToY as priceToYMath,
  type PriceBand,
  yToPrice,
} from './chartOverlayMath';

export interface TpSl {
  entry: number;
  tp: number | null;
  sl: number | null;
  side: 'long' | 'short';
}

export interface ChartWithOverlayProps {
  tvSymbol: string;
  interval?: string;
  theme?: 'dark' | 'light';
  locale?: string;
  timezone?: string;
  /** Live session band — forwarded into `getRange` / `paddedBand` like crypto. */
  priceBand?: PriceBand | null;
  tpsl: TpSl;
  onChangeTp?: (price: number) => void;
  onChangeSl?: (price: number) => void;
  style?: StyleProp<ViewStyle>;
  height?: number;
  accentColor?: string;
  showFullscreenButton?: boolean;
  onFullscreenPress?: () => void;
}

function buildWidgetUrl(args: {
  symbol: string;
  interval: string;
  theme: 'dark' | 'light';
  locale: string;
  timezone: string;
}): string {
  const p = [
    `symbol=${encodeURIComponent(args.symbol)}`,
    `interval=${encodeURIComponent(args.interval)}`,
    `theme=${args.theme}`,
    `style=1`,
    `locale=${encodeURIComponent(args.locale)}`,
    `timezone=${encodeURIComponent(args.timezone)}`,
    `toolbar_bg=%230a0a0a`,
    `hide_side_toolbar=0`,
    `hide_top_toolbar=0`,
    `withdateranges=1`,
    `allow_symbol_change=0`,
    `save_image=0`,
    `studies=%5B%22RSI%40tv-basicstudies%22%2C%22MACD%40tv-basicstudies%22%5D`,
  ].join('&');
  return `https://s.tradingview.com/widgetembed/?${p}`;
}

function fmtPrice(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  const digits = a >= 1000 ? 2 : a >= 1 ? 2 : 6;
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Ref bundle mutated every frame by rAF — same role as imperative `priceRef` in canvas terminals. */
export type ChartOverlayPriceRef = {
  entry: number;
  tp: number;
  sl: number;
  top: number;
  bottom: number;
  side: 'long' | 'short';
};

export function ChartWithOverlay(props: ChartWithOverlayProps) {
  const {
    tvSymbol,
    interval = '15',
    theme = 'dark',
    locale = 'en',
    timezone = 'Etc/UTC',
    priceBand,
    tpsl,
    onChangeTp,
    onChangeSl,
    style,
    height = 520,
    accentColor = T.yellow,
    showFullscreenButton = false,
    onFullscreenPress,
  } = props;

  const url = useMemo(
    () => buildWidgetUrl({ symbol: tvSymbol, interval, theme, locale, timezone }),
    [tvSymbol, interval, theme, locale, timezone]
  );

  const tp = tpsl.tp ?? tpsl.entry;
  const sl = tpsl.sl ?? tpsl.entry;
  const { top, bottom } = useMemo(
    () => getRange(priceBand ?? undefined, tpsl.entry, tp, sl),
    [priceBand, tpsl.entry, tp, sl]
  );

  const priceRef = useRef<ChartOverlayPriceRef>({
    entry: tpsl.entry,
    tp,
    sl,
    top,
    bottom,
    side: tpsl.side,
  });

  useLayoutEffect(() => {
    priceRef.current = {
      entry: tpsl.entry,
      tp,
      sl,
      top,
      bottom,
      side: tpsl.side,
    };
  }, [tpsl.entry, tp, sl, top, bottom, tpsl.side]);

  const frameBg = T.bg0;

  return (
    <View style={[{ width: '100%', height, borderRadius: T.radiusLg, overflow: 'hidden', backgroundColor: frameBg, borderWidth: 1, borderColor: T.border }, style]}>
      {Platform.OS === 'web' ? (
        <WebChartBlock
          url={url}
          height={height}
          priceRef={priceRef}
          top={top}
          bottom={bottom}
          onChangeTp={onChangeTp}
          onChangeSl={onChangeSl}
          accentColor={accentColor}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <NativeWebBlock url={url} frameBg={frameBg} />
          <NativeTpSlOverlay
            entry={tpsl.entry}
            takeProfit={tp}
            stopLoss={sl}
            side={tpsl.side}
            priceBand={priceBand ?? { high: top, low: bottom }}
            onChange={(patch) => {
              if (patch.takeProfit != null) onChangeTp?.(patch.takeProfit);
              if (patch.stopLoss != null) onChangeSl?.(patch.stopLoss);
            }}
            accentColor={accentColor}
          />
        </View>
      )}
      {showFullscreenButton && onFullscreenPress ? (
        <Pressable
          onPress={onFullscreenPress}
          hitSlop={8}
          accessibilityLabel="Full screen chart"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 50,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: T.borderBright,
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        >
          <Text style={{ color: T.text0, fontSize: 11, fontWeight: '800' }}>⛶ Fullscreen</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ─── Web: iframe + Canvas + rAF — crypto-equivalent drawing ───────────────── */

type WebChartBlockProps = {
  url: string;
  height: number;
  priceRef: React.MutableRefObject<ChartOverlayPriceRef>;
  top: number;
  bottom: number;
  onChangeTp?: (p: number) => void;
  onChangeSl?: (p: number) => void;
  accentColor: string;
};

function WebChartBlock({
  url,
  height,
  priceRef,
  top,
  bottom,
  onChangeTp,
  onChangeSl,
  accentColor,
}: WebChartBlockProps) {
  const hostRef = useRef<View | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef({ w: 400, h: height });
  const dragRef = useRef<'tp' | 'sl' | null>(null);
  const scheduleDrawRef = useRef<() => void>(() => {});

  const scheduleDraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx) return;
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const pr = priceRef.current;
    ctx.clearRect(0, 0, w, h);

    const entryY = priceToYMath(pr.entry, pr.top, pr.bottom, h);
    const tpY = priceToYMath(pr.tp, pr.top, pr.bottom, h);
    const slY = priceToYMath(pr.sl, pr.top, pr.bottom, h);

    const drawDashedH = (y: number, color: string, lineW = 1.5) => {
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.restore();
    };

    drawDashedH(entryY, accentColor, 1);
    drawDashedH(tpY, T.green, 1.5);
    drawDashedH(slY, T.red, 1.5);

    const rr = rrCompute(pr.entry, pr.tp, pr.sl, pr.side);
    ctx.save();
    ctx.fillStyle = rr >= 2 ? 'rgba(14,203,129,0.18)' : 'rgba(0,0,0,0.55)';
    ctx.strokeStyle = rr >= 2 ? T.green : T.borderBright;
    const bx = 10;
    const by = 10;
    const bw = 88;
    const bh = 26;
    ctx.beginPath();
    ctx.moveTo(bx + 6, by);
    ctx.lineTo(bx + bw - 6, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 6);
    ctx.lineTo(bx + bw, by + bh - 6);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - 6, by + bh);
    ctx.lineTo(bx + 6, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - 6);
    ctx.lineTo(bx, by + 6);
    ctx.quadraticCurveTo(bx, by, bx + 6, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rr >= 2 ? T.green : T.text0;
    ctx.font = '800 11px system-ui,Segoe UI,sans-serif';
    ctx.fillText(`R:R ${rr.toFixed(2)}`, bx + 8, by + 17);
    ctx.restore();

    const tpPct = pctPnl(pr.entry, pr.tp, pr.side);
    const slPct = pctPnl(pr.entry, pr.sl, pr.side);
    ctx.fillStyle = accentColor;
    ctx.fillRect(8, entryY - 10, 58, 20);
    ctx.fillStyle = '#0b0e11';
    ctx.font = '700 10px system-ui';
    ctx.fillText('ENTRY', 18, entryY + 4);

    ctx.fillStyle = T.green;
    ctx.fillRect(w - 96, tpY - 11, 88, 22);
    ctx.fillStyle = '#0b0e11';
    ctx.fillText(`TP ${tpPct >= 0 ? '+' : ''}${tpPct.toFixed(2)}%`, w - 90, tpY + 4);

    ctx.fillStyle = T.red;
    ctx.fillRect(w - 96, slY - 11, 88, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`SL ${slPct >= 0 ? '+' : ''}${slPct.toFixed(2)}%`, w - 90, slY + 4);

    // Handles — glow (crypto shadow)
    const drawHandle = (cx: number, cy: number, color: string, label: string) => {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = T.bg1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      ctx.font = '700 9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, cy + 3);
      ctx.restore();
    };
    drawHandle(w / 2, tpY, T.green, 'TP');
    drawHandle(w / 2, slY, T.red, 'SL');
  }, [accentColor, priceRef]);

  scheduleDrawRef.current = scheduleDraw;

  useLayoutEffect(() => {
    priceRef.current = { ...priceRef.current, top, bottom };
  }, [top, bottom, priceRef]);

  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    const host = hostRef.current as unknown as HTMLDivElement | null;
    if (!host) return undefined;

    let cancelled = false;
    let rafLoop = 0;

      host.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = '0';
      iframe.style.background = T.bg0;
      iframe.setAttribute('allowfullscreen', 'true');
      iframe.setAttribute(
        'allow',
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
      );
      host.appendChild(iframe);

      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.left = '0';
      canvas.style.top = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'auto';
      canvas.style.touchAction = 'none';
      host.style.position = 'relative';
      host.appendChild(canvas);
      canvasRef.current = canvas;

      const pickDrag = (clientY: number, rect: DOMRect): 'tp' | 'sl' | null => {
        const y = clientY - rect.top;
        const hh = rect.height;
        const pr = priceRef.current;
        const tpY = priceToYMath(pr.tp, pr.top, pr.bottom, hh);
        const slY = priceToYMath(pr.sl, pr.top, pr.bottom, hh);
        if (onChangeTp && Math.abs(y - tpY) < 22) return 'tp';
        if (onChangeSl && Math.abs(y - slY) < 22) return 'sl';
        return null;
      };

      const onDown = (e: MouseEvent | TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        const clientY = 'touches' in e && e.touches[0] ? e.touches[0].clientY : (e as MouseEvent).clientY;
        dragRef.current = pickDrag(clientY, rect);
        e.preventDefault();
      };

      const onMoveWin = (e: MouseEvent | TouchEvent) => {
        if (!dragRef.current) return;
        const rect = canvas.getBoundingClientRect();
        const hh = rect.height;
        const clientY = 'touches' in e && e.touches[0] ? e.touches[0].clientY : (e as MouseEvent).clientY;
        const y = clientY - rect.top;
        const pr = priceRef.current;
        const next = yToPrice(y, pr.top, pr.bottom, hh, pr.entry);
        if (dragRef.current === 'tp') {
          priceRef.current = { ...pr, tp: next };
          onChangeTp?.(next);
        } else if (dragRef.current === 'sl') {
          priceRef.current = { ...pr, sl: next };
          onChangeSl?.(next);
        }
      };

      const onUp = () => {
        dragRef.current = null;
      };

      canvas.addEventListener('mousedown', onDown);
      canvas.addEventListener('touchstart', onDown, { passive: false });
      window.addEventListener('mousemove', onMoveWin);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMoveWin, { passive: false });
      window.addEventListener('touchend', onUp);

      const ro = new ResizeObserver(() => {
        const r = host.getBoundingClientRect();
        sizeRef.current = { w: r.width, h: r.height };
        scheduleDrawRef.current();
      });
      ro.observe(host);
      const br = host.getBoundingClientRect();
      sizeRef.current = { w: br.width, h: br.height };

      const loop = () => {
        if (cancelled) return;
        scheduleDrawRef.current();
        rafLoop = requestAnimationFrame(loop);
      };
      rafLoop = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafLoop);
      ro.disconnect();
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMoveWin);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMoveWin);
      window.removeEventListener('touchend', onUp);
      host.innerHTML = '';
      canvasRef.current = null;
    };
  }, [url, onChangeTp, onChangeSl, priceRef]);

  return <View ref={hostRef} collapsable={false} style={{ flex: 1, minHeight: 320, backgroundColor: T.bg0 }} />;
}

type NativeWebBlockProps = { url: string; frameBg: string };

function NativeWebBlock({ url, frameBg }: NativeWebBlockProps) {
  return (
    <WebView
      source={{ uri: url }}
      style={{ flex: 1, backgroundColor: frameBg }}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      startInLoadingState={false}
      originWhitelist={['*']}
    />
  );
}

/* ─── Native overlay — same structure as crypto `TpSlOverlay` ───────────────── */

function NativeTpSlOverlay({
  entry,
  takeProfit,
  stopLoss,
  side,
  onChange,
  priceBand,
  accentColor,
}: {
  entry: number;
  takeProfit: number;
  stopLoss: number;
  side: 'long' | 'short';
  onChange: (patch: { takeProfit?: number; stopLoss?: number }) => void;
  priceBand: PriceBand;
  accentColor: string;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { top, bottom } = useMemo(
    () => getRange(priceBand, entry, takeProfit, stopLoss),
    [priceBand, entry, takeProfit, stopLoss]
  );

  const priceToY = (price: number): number => priceToYMath(price, top, bottom, size.h);

  const yToPriceFn = (y: number): number => yToPrice(y, top, bottom, size.h, entry);

  const tpY = priceToY(takeProfit);
  const slY = priceToY(stopLoss);
  const entryY = priceToY(entry);
  const rr = useMemo(() => rrCompute(entry, takeProfit, stopLoss, side), [entry, takeProfit, stopLoss, side]);
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
      }}
    >
      <DashedLine
        y={entryY}
        color={accentColor}
        label="Entry"
        tagColor={accentColor}
        labelText={fmtPrice(entry)}
        pnlText={null}
        interactive={false}
        width={size.w}
      />
      <DraggableLine
        y={tpY}
        color={T.green}
        labelText={fmtPrice(takeProfit)}
        pnlText={`${tpPnl >= 0 ? '+' : ''}${tpPnl.toFixed(2)}%`}
        labelTag="TP"
        containerH={size.h}
        width={size.w}
        onDrag={(y) => onChange({ takeProfit: yToPriceFn(y) })}
      />
      <DraggableLine
        y={slY}
        color={T.red}
        labelText={fmtPrice(stopLoss)}
        pnlText={`${slPnl >= 0 ? '+' : ''}${slPnl.toFixed(2)}%`}
        labelTag="SL"
        containerH={size.h}
        width={size.w}
        onDrag={(y) => onChange({ stopLoss: yToPriceFn(y) })}
      />
      <View
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: rr >= 2 ? T.green : T.borderBright,
          backgroundColor: rr >= 2 ? T.greenDim : 'rgba(0,0,0,0.55)',
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '800', color: rr >= 2 ? T.green : T.text0 }}>
          R:R {rr.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

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
      }}
    >
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
        }}
      >
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
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '800', color, textAlign: 'center' }}>{pnlText}</Text>
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
  startYRef.current = y;

  return (
    <View
      style={{ position: 'absolute', left: 0, right: 0, top: Math.max(0, y - 12), pointerEvents: 'box-none' }}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, top: 11 }}>
        <DashedRule color={color} width={width} />
      </View>
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
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: '800', color }}>{pnlText}</Text>
      </View>
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
        }}
      >
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
      }}
    >
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
