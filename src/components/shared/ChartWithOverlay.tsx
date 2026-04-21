/**
 * Chart + TP/SL overlay — web uses HTML Canvas + requestAnimationFrame.
 * Native uses View-based overlay with PanResponder handles.
 *
 * Extended with:
 *  - Pre-trade mode: draggable entry / TP / SL lines before confirming a trade
 *  - Open-position lines: entry, live P&L badge, TP/SL targets for active positions
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

/* ─── Public types ─────────────────────────────────────────────────────────── */

export interface TpSl {
  entry: number;
  tp: number | null;
  sl: number | null;
  side: 'long' | 'short';
}

/** Mutable state for the pre-trade drag overlay. Kept in a ref so canvas reads it every frame. */
export interface PreTradeState {
  mode: boolean;
  side: 'long' | 'short';
  entry: number;
  tp: number;
  sl: number;
  /** Notional qty (order.amount) used for P&L preview. */
  qty: number;
}

/** Slimmed position shape needed for chart rendering. */
export interface ChartPosition {
  id: string;
  side: 'long' | 'short';
  entryPrice: number;
  qty: number;
  margin: number;
  leverage: number;
  tp: number | null;
  sl: number | null;
  openedAt: string;
  currencySymbol: string;
}

export interface ChartWithOverlayProps {
  tvSymbol: string;
  interval?: string;
  theme?: 'dark' | 'light';
  locale?: string;
  timezone?: string;
  /** Live session band forwarded into `getRange`. */
  priceBand?: PriceBand | null;
  tpsl: TpSl;
  onChangeTp?: (price: number) => void;
  onChangeSl?: (price: number) => void;
  style?: StyleProp<ViewStyle>;
  height?: number;
  accentColor?: string;
  showFullscreenButton?: boolean;
  onFullscreenPress?: () => void;

  /* ── Pre-trade mode props ── */
  preTradeMode?: boolean;
  preTradeSide?: 'long' | 'short';
  /** Current pre-trade entry (null → not set). */
  preTradeEntry?: number | null;
  preTradeTP?: number | null;
  preTradeSL?: number | null;
  /** Units (order.amount) for P&L preview. */
  preTradeQty?: number;
  onPreTradeEntryChange?: (v: number) => void;
  onPreTradeTpChange?: (v: number) => void;
  onPreTradeSlChange?: (v: number) => void;
  onPreTradeConfirm?: () => void;
  onPreTradeDiscard?: () => void;

  /* ── Open positions shown as lines on chart ── */
  openPositions?: ChartPosition[];
}

/* ─── Ref shape for existing entry/tp/sl/band ─────────────────────────────── */

export type ChartOverlayPriceRef = {
  entry: number;
  tp: number;
  sl: number;
  top: number;
  bottom: number;
  side: 'long' | 'short';
};

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

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

function formatTimeHeld(openedAt: string): string {
  const diff = Date.now() - new Date(openedAt).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

/* ─── Main component ────────────────────────────────────────────────────────── */

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
    preTradeMode = false,
    preTradeSide = 'long',
    preTradeEntry = null,
    preTradeTP = null,
    preTradeSL = null,
    preTradeQty = 0,
    onPreTradeEntryChange,
    onPreTradeTpChange,
    onPreTradeSlChange,
    onPreTradeConfirm,
    onPreTradeDiscard,
    openPositions,
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
    priceRef.current = { entry: tpsl.entry, tp, sl, top, bottom, side: tpsl.side };
  }, [tpsl.entry, tp, sl, top, bottom, tpsl.side]);

  /* Pre-trade ref — updated every render so canvas reads latest values. */
  const preTradeRef = useRef<PreTradeState>({
    mode: preTradeMode,
    side: preTradeSide,
    entry: preTradeEntry ?? tpsl.entry,
    tp: preTradeTP ?? tp,
    sl: preTradeSL ?? sl,
    qty: preTradeQty,
  });
  useLayoutEffect(() => {
    preTradeRef.current = {
      mode: preTradeMode,
      side: preTradeSide,
      entry: preTradeEntry ?? tpsl.entry,
      tp: preTradeTP ?? tp,
      sl: preTradeSL ?? sl,
      qty: preTradeQty,
    };
  });

  /* Open positions ref */
  const openPositionsRef = useRef<ChartPosition[]>(openPositions ?? []);
  useLayoutEffect(() => {
    openPositionsRef.current = openPositions ?? [];
  });

  /* Stable callback refs — avoids effect re-running when callbacks change */
  const cbPreEntry = useRef(onPreTradeEntryChange);
  const cbPreTp = useRef(onPreTradeTpChange);
  const cbPreSl = useRef(onPreTradeSlChange);
  const cbConfirm = useRef(onPreTradeConfirm);
  const cbDiscard = useRef(onPreTradeDiscard);
  useLayoutEffect(() => {
    cbPreEntry.current = onPreTradeEntryChange;
    cbPreTp.current = onPreTradeTpChange;
    cbPreSl.current = onPreTradeSlChange;
    cbConfirm.current = onPreTradeConfirm;
    cbDiscard.current = onPreTradeDiscard;
  });

  const frameBg = T.bg0;

  return (
    <View
      style={[
        {
          width: '100%',
          height,
          borderRadius: T.radiusLg,
          overflow: 'hidden',
          backgroundColor: frameBg,
          borderWidth: 1,
          borderColor: T.border,
        },
        style,
      ]}
    >
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
          preTradeRef={preTradeRef}
          openPositionsRef={openPositionsRef}
          cbPreEntry={cbPreEntry}
          cbPreTp={cbPreTp}
          cbPreSl={cbPreSl}
          cbConfirm={cbConfirm}
          cbDiscard={cbDiscard}
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
            preTradeMode={preTradeMode}
            preTradeSide={preTradeSide}
            preTradeEntry={preTradeEntry}
            preTradeTP={preTradeTP}
            preTradeSL={preTradeSL}
            onPreTradeEntryChange={onPreTradeEntryChange}
            onPreTradeTpChange={onPreTradeTpChange}
            onPreTradeSlChange={onPreTradeSlChange}
            onPreTradeConfirm={onPreTradeConfirm}
            onPreTradeDiscard={onPreTradeDiscard}
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

/* ─── Web: iframe + Canvas rAF ─────────────────────────────────────────────── */

type BtnRect = { x: number; y: number; w: number; h: number };

type WebChartBlockProps = {
  url: string;
  height: number;
  priceRef: React.MutableRefObject<ChartOverlayPriceRef>;
  top: number;
  bottom: number;
  onChangeTp?: (p: number) => void;
  onChangeSl?: (p: number) => void;
  accentColor: string;
  preTradeRef: React.MutableRefObject<PreTradeState>;
  openPositionsRef: React.MutableRefObject<ChartPosition[]>;
  cbPreEntry: React.MutableRefObject<((v: number) => void) | undefined>;
  cbPreTp: React.MutableRefObject<((v: number) => void) | undefined>;
  cbPreSl: React.MutableRefObject<((v: number) => void) | undefined>;
  cbConfirm: React.MutableRefObject<(() => void) | undefined>;
  cbDiscard: React.MutableRefObject<(() => void) | undefined>;
};

type DragTarget = 'tp' | 'sl' | 'preEntry' | 'preTP' | 'preSL' | null;

function WebChartBlock({
  url,
  height,
  priceRef,
  top,
  bottom,
  onChangeTp,
  onChangeSl,
  accentColor,
  preTradeRef,
  openPositionsRef,
  cbPreEntry,
  cbPreTp,
  cbPreSl,
  cbConfirm,
  cbDiscard,
}: WebChartBlockProps) {
  const hostRef = useRef<View | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef({ w: 400, h: height });
  const dragRef = useRef<DragTarget>(null);
  const scheduleDrawRef = useRef<() => void>(() => {});
  const confirmBtnRef = useRef<BtnRect | null>(null);
  const discardBtnRef = useRef<BtnRect | null>(null);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });

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
    const pt = preTradeRef.current;

    ctx.clearRect(0, 0, w, h);

    /* ── roundRect helper ── */
    const rrect = (rx: number, ry: number, rw: number, rh: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(rx + r, ry);
      ctx.lineTo(rx + rw - r, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r);
      ctx.lineTo(rx + rw, ry + rh - r);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - r, ry + rh);
      ctx.lineTo(rx + r, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - r);
      ctx.lineTo(rx, ry + r);
      ctx.quadraticCurveTo(rx, ry, rx + r, ry);
      ctx.closePath();
    };

    const pToY = (price: number) => priceToYMath(price, pr.top, pr.bottom, h);

    /* ── draw dashed horizontal ── */
    const drawDashed = (y: number, color: string, lw = 1.5) => {
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.restore();
    };

    /* ── draw pre-trade line ── */
    const drawPreTradeLine = (
      price: number,
      color: string,
      label: string,
      pnl: number | null,
      isDragging: boolean
    ) => {
      const y = pToY(price);
      if (y < -20 || y > h + 20) return;

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = isDragging ? 20 : 8;
      ctx.setLineDash([10, 6]);
      ctx.strokeStyle = color;
      ctx.lineWidth = isDragging ? 2.5 : 1.5;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Left label pill
      const lh = 22;
      const lw2 = 76;
      ctx.fillStyle = color;
      rrect(4, y - lh / 2, lw2, lh, 4);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(label, 10, y);

      // Right price pill
      const priceStr = fmtPrice(price);
      ctx.font = 'bold 10px monospace';
      const pw = Math.max(50, ctx.measureText(priceStr).width + 16);
      ctx.fillStyle = color;
      rrect(w - pw - 4, y - lh / 2, pw, lh, 4);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.fillText(priceStr, w - pw + 6, y);

      // Center P&L badge
      if (pnl !== null) {
        const sign = pnl >= 0 ? '+' : '';
        const pnlStr = `${sign}${Math.abs(pnl) < 0.01 ? pnl.toFixed(4) : pnl.toFixed(2)}`;
        ctx.font = 'bold 10px monospace';
        const bw = Math.max(60, ctx.measureText(pnlStr).width + 20);
        const bh = 22;
        const bx = (w - bw) / 2;
        const by2 = y - bh / 2;
        ctx.fillStyle = 'rgba(11,14,17,0.92)';
        rrect(bx, by2, bw, bh, 4);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        rrect(bx, by2, bw, bh, 4);
        ctx.stroke();
        ctx.fillStyle = pnl >= 0 ? T.green : T.red;
        ctx.fillText(pnlStr, bx + 10, y);
      }

      // Drag handle circle
      const r = isDragging ? 9 : 7;
      ctx.shadowColor = color;
      ctx.shadowBlur = isDragging ? 16 : 6;
      ctx.fillStyle = T.bg1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.restore();
    };

    /* ── draw confirm bar (top of chart) ── */
    const drawConfirmBar = () => {
      const barH = 44;
      const barY = 8;
      const barX = 8;
      const barW = w - 16;

      ctx.fillStyle = 'rgba(11,14,17,0.96)';
      rrect(barX, barY, barW, barH, 8);
      ctx.fill();
      ctx.strokeStyle = T.borderBright ?? '#333';
      ctx.lineWidth = 1;
      rrect(barX, barY, barW, barH, 8);
      ctx.stroke();

      const sc = pt.side === 'long' ? T.green : T.red;
      ctx.fillStyle = `${sc}22`;
      rrect(16, barY + 8, 72, 28, 5);
      ctx.fill();
      ctx.fillStyle = sc;
      ctx.font = 'bold 11px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(`${pt.side.toUpperCase()}`, 22, barY + 22);

      // R:R in center
      if (pt.entry && pt.tp && pt.sl) {
        const tpDist = Math.abs(pt.tp - pt.entry);
        const slDist = Math.abs(pt.sl - pt.entry);
        const rr = slDist > 0 ? (tpDist / slDist).toFixed(1) : '—';
        ctx.fillStyle = T.yellow;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`R:R 1:${rr}`, w / 2, barY + 22);
        ctx.textAlign = 'left';
      }

      // Discard button
      const db: BtnRect = { x: w - 210, y: barY + 8, w: 82, h: 28 };
      discardBtnRef.current = db;
      ctx.fillStyle = T.bg2 ?? '#1a1d24';
      rrect(db.x, db.y, db.w, db.h, 5);
      ctx.fill();
      ctx.strokeStyle = T.border;
      ctx.lineWidth = 1;
      rrect(db.x, db.y, db.w, db.h, 5);
      ctx.stroke();
      ctx.fillStyle = T.text0;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText('Discard', db.x + db.w / 2, db.y + db.h / 2);

      // Confirm button
      const cb: BtnRect = { x: w - 118, y: barY + 8, w: 82, h: 28 };
      confirmBtnRef.current = cb;
      ctx.fillStyle = T.green;
      rrect(cb.x, cb.y, cb.w, cb.h, 5);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.fillText('Confirm', cb.x + cb.w / 2, cb.y + cb.h / 2);
      ctx.textAlign = 'left';
    };

    /* ── draw open position lines ── */
    const drawPositionLines = (pos: ChartPosition) => {
      const ey = pToY(pos.entryPrice);

      // Entry line (blue solid)
      if (ey >= 0 && ey <= h) {
        ctx.save();
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.moveTo(0, ey);
        ctx.lineTo(w, ey);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#2196F3';
        rrect(4, ey - 11, 106, 22, 4);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px monospace';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(`${pos.side.toUpperCase()} ${pos.leverage}x · ${formatTimeHeld(pos.openedAt)}`, 10, ey);
        ctx.restore();
      }

      // TP line
      if (pos.tp != null) {
        const ty = pToY(pos.tp);
        if (ty >= 0 && ty <= h) {
          drawDashed(ty, T.green, 1);
          ctx.save();
          ctx.fillStyle = T.green;
          rrect(w - 66, ty - 10, 60, 20, 3);
          ctx.fill();
          ctx.fillStyle = '#000';
          ctx.font = 'bold 9px monospace';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          ctx.fillText(`TP ${fmtPrice(pos.tp)}`, w - 62, ty);
          ctx.restore();
        }
      }

      // SL line
      if (pos.sl != null) {
        const sy = pToY(pos.sl);
        if (sy >= 0 && sy <= h) {
          drawDashed(sy, T.red, 1);
          ctx.save();
          ctx.fillStyle = T.red;
          rrect(w - 66, sy - 10, 60, 20, 3);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 9px monospace';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          ctx.fillText(`SL ${fmtPrice(pos.sl)}`, w - 62, sy);
          ctx.restore();
        }
      }
    };

    /* ────────────────────────────────────────────────────────────────
       DRAW ORDER:
       1. Existing TP/SL overlay (when NOT in pre-trade mode)
       2. Open position lines
       3. Pre-trade overlay (draws on top — includes confirm bar)
    ──────────────────────────────────────────────────────────────── */

    if (!pt.mode) {
      // Normal existing TP/SL overlay
      const entryY = pToY(pr.entry);
      const tpY = pToY(pr.tp);
      const slY = pToY(pr.sl);

      drawDashed(entryY, accentColor, 1);
      drawDashed(tpY, T.green, 1.5);
      drawDashed(slY, T.red, 1.5);

      const rr = rrCompute(pr.entry, pr.tp, pr.sl, pr.side);
      ctx.save();
      ctx.fillStyle = rr >= 2 ? 'rgba(14,203,129,0.18)' : 'rgba(0,0,0,0.55)';
      ctx.strokeStyle = rr >= 2 ? T.green : (T.borderBright ?? '#333');
      const bx = 10, by = 10, bw = 88, bh = 26;
      ctx.beginPath();
      ctx.moveTo(bx + 6, by); ctx.lineTo(bx + bw - 6, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 6);
      ctx.lineTo(bx + bw, by + bh - 6);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - 6, by + bh);
      ctx.lineTo(bx + 6, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - 6);
      ctx.lineTo(bx, by + 6);
      ctx.quadraticCurveTo(bx, by, bx + 6, by);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
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

      // Handles
      const drawHandle = (cx: number, cy: number, color: string, label: string) => {
        ctx.save();
        ctx.shadowColor = color; ctx.shadowBlur = 10;
        ctx.fillStyle = T.bg1; ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = color; ctx.font = '700 9px system-ui';
        ctx.textAlign = 'center'; ctx.fillText(label, cx, cy + 3); ctx.restore();
      };
      drawHandle(w / 2, tpY, T.green, 'TP');
      drawHandle(w / 2, slY, T.red, 'SL');
    }

    /* ── Open position lines (always shown) ── */
    for (const pos of openPositionsRef.current) {
      drawPositionLines(pos);
    }

    /* ── Pre-trade overlay ── */
    if (pt.mode) {
      const drag = dragRef.current;
      const calcPnl = (entry: number, target: number, side: 'long' | 'short', qty: number) => {
        const diff = side === 'long' ? target - entry : entry - target;
        return diff * qty;
      };

      if (pt.entry) {
        drawPreTradeLine(pt.entry, '#2196F3', '📍 ENTRY', null, drag === 'preEntry');
      }
      if (pt.tp && pt.entry) {
        const pnl = calcPnl(pt.entry, pt.tp, pt.side, pt.qty);
        drawPreTradeLine(pt.tp, T.green, '🎯 TP', pnl, drag === 'preTP');
      }
      if (pt.sl && pt.entry) {
        const pnl = calcPnl(pt.entry, pt.sl, pt.side, pt.qty);
        drawPreTradeLine(pt.sl, T.red, '🛑 SL', pnl, drag === 'preSL');
      }

      drawConfirmBar();
    }
  }, [accentColor, priceRef, preTradeRef, openPositionsRef]);

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
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
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

    /* ── Drag target detection ── */
    const pickDrag = (clientY: number, rect: DOMRect): DragTarget => {
      const y = clientY - rect.top;
      const hh = rect.height;
      const pr = priceRef.current;
      const pt = preTradeRef.current;
      const THR = 22;

      // Pre-trade lines take priority
      if (pt.mode) {
        if (pt.entry) {
          const ey = priceToYMath(pt.entry, pr.top, pr.bottom, hh);
          if (Math.abs(y - ey) < THR) return 'preEntry';
        }
        if (pt.tp) {
          const ty = priceToYMath(pt.tp, pr.top, pr.bottom, hh);
          if (Math.abs(y - ty) < THR) return 'preTP';
        }
        if (pt.sl) {
          const sy = priceToYMath(pt.sl, pr.top, pr.bottom, hh);
          if (Math.abs(y - sy) < THR) return 'preSL';
        }
      }

      // Existing TP/SL
      const tpY = priceToYMath(pr.tp, pr.top, pr.bottom, hh);
      const slY = priceToYMath(pr.sl, pr.top, pr.bottom, hh);
      if (onChangeTp && Math.abs(y - tpY) < THR) return 'tp';
      if (onChangeSl && Math.abs(y - slY) < THR) return 'sl';

      return null;
    };

    const onDown = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientY = 'touches' in e && e.touches[0] ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const clientX = 'touches' in e && e.touches[0] ? e.touches[0].clientX : (e as MouseEvent).clientX;
      dragRef.current = pickDrag(clientY, rect);
      mouseDownPosRef.current = { x: clientX, y: clientY };
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

      switch (dragRef.current) {
        case 'preEntry':
          preTradeRef.current = { ...preTradeRef.current, entry: next };
          cbPreEntry.current?.(next);
          break;
        case 'preTP':
          preTradeRef.current = { ...preTradeRef.current, tp: next };
          cbPreTp.current?.(next);
          break;
        case 'preSL':
          preTradeRef.current = { ...preTradeRef.current, sl: next };
          cbPreSl.current?.(next);
          break;
        case 'tp':
          priceRef.current = { ...pr, tp: next };
          onChangeTp?.(next);
          break;
        case 'sl':
          priceRef.current = { ...pr, sl: next };
          onChangeSl?.(next);
          break;
      }
      e.preventDefault();
    };

    const onUp = () => {
      dragRef.current = null;
    };

    /* ── Click handler for confirm / discard buttons ── */
    const onClick = (e: MouseEvent) => {
      const pt = preTradeRef.current;
      if (!pt.mode) return;

      // Only treat as click if mouse didn't drag far
      const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
      const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
      if (dx > 6 || dy > 6) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const cb = confirmBtnRef.current;
      if (cb && x >= cb.x && x <= cb.x + cb.w && y >= cb.y && y <= cb.y + cb.h) {
        cbConfirm.current?.();
        return;
      }
      const db = discardBtnRef.current;
      if (db && x >= db.x && x <= db.x + db.w && y >= db.y && y <= db.y + db.h) {
        cbDiscard.current?.();
        return;
      }
    };

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('click', onClick);
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
      canvas.removeEventListener('click', onClick);
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

/* ─── Native WebView block ──────────────────────────────────────────────────── */

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

/* ─── Native TP/SL overlay (extended with pre-trade lines) ─────────────────── */

function NativeTpSlOverlay({
  entry,
  takeProfit,
  stopLoss,
  side,
  onChange,
  priceBand,
  accentColor,
  preTradeMode = false,
  preTradeSide = 'long',
  preTradeEntry,
  preTradeTP,
  preTradeSL,
  onPreTradeEntryChange,
  onPreTradeTpChange,
  onPreTradeSlChange,
  onPreTradeConfirm,
  onPreTradeDiscard,
}: {
  entry: number;
  takeProfit: number;
  stopLoss: number;
  side: 'long' | 'short';
  onChange: (patch: { takeProfit?: number; stopLoss?: number }) => void;
  priceBand: PriceBand;
  accentColor: string;
  preTradeMode?: boolean;
  preTradeSide?: 'long' | 'short';
  preTradeEntry?: number | null;
  preTradeTP?: number | null;
  preTradeSL?: number | null;
  onPreTradeEntryChange?: (v: number) => void;
  onPreTradeTpChange?: (v: number) => void;
  onPreTradeSlChange?: (v: number) => void;
  onPreTradeConfirm?: () => void;
  onPreTradeDiscard?: () => void;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { top, bottom } = useMemo(
    () => getRange(priceBand, entry, takeProfit, stopLoss),
    [priceBand, entry, takeProfit, stopLoss]
  );

  const priceToYFn = (price: number): number => priceToYMath(price, top, bottom, size.h);
  const yToPriceFn = (y: number): number => yToPrice(y, top, bottom, size.h, entry);

  const tpY = priceToYFn(takeProfit);
  const slY = priceToYFn(stopLoss);
  const entryY = priceToYFn(entry);
  const rr = useMemo(() => rrCompute(entry, takeProfit, stopLoss, side), [entry, takeProfit, stopLoss, side]);
  const tpPnl = pctPnl(entry, takeProfit, side);
  const slPnl = pctPnl(entry, stopLoss, side);

  const ptEntryY = preTradeEntry != null ? priceToYFn(preTradeEntry) : null;
  const ptTpY = preTradeTP != null ? priceToYFn(preTradeTP) : null;
  const ptSlY = preTradeSL != null ? priceToYFn(preTradeSL) : null;

  return (
    <View
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, pointerEvents: 'box-none' }}
    >
      {/* Existing entry/TP/SL lines — only when not in pre-trade mode */}
      {!preTradeMode && (
        <>
          <DashedLine y={entryY} color={accentColor} label="Entry" tagColor={accentColor} labelText={fmtPrice(entry)} pnlText={null} interactive={false} width={size.w} />
          <DraggableLine y={tpY} color={T.green} labelText={fmtPrice(takeProfit)} pnlText={`${tpPnl >= 0 ? '+' : ''}${tpPnl.toFixed(2)}%`} labelTag="TP" containerH={size.h} width={size.w} onDrag={(y) => onChange({ takeProfit: yToPriceFn(y) })} />
          <DraggableLine y={slY} color={T.red} labelText={fmtPrice(stopLoss)} pnlText={`${slPnl >= 0 ? '+' : ''}${slPnl.toFixed(2)}%`} labelTag="SL" containerH={size.h} width={size.w} onDrag={(y) => onChange({ stopLoss: yToPriceFn(y) })} />
          <View style={{ position: 'absolute', top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: rr >= 2 ? T.green : (T.borderBright ?? '#333'), backgroundColor: rr >= 2 ? T.greenDim : 'rgba(0,0,0,0.55)' }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: rr >= 2 ? T.green : T.text0 }}>R:R {rr.toFixed(2)}</Text>
          </View>
        </>
      )}

      {/* Pre-trade lines */}
      {preTradeMode && (
        <>
          {ptEntryY != null && (
            <DraggableLine y={ptEntryY} color="#2196F3" labelText={preTradeEntry != null ? fmtPrice(preTradeEntry) : ''} pnlText="ENTRY" labelTag="📍" containerH={size.h} width={size.w} onDrag={(y) => onPreTradeEntryChange?.(yToPriceFn(y))} />
          )}
          {ptTpY != null && (
            <DraggableLine y={ptTpY} color={T.green} labelText={preTradeTP != null ? fmtPrice(preTradeTP) : ''} pnlText="TP" labelTag="🎯" containerH={size.h} width={size.w} onDrag={(y) => onPreTradeTpChange?.(yToPriceFn(y))} />
          )}
          {ptSlY != null && (
            <DraggableLine y={ptSlY} color={T.red} labelText={preTradeSL != null ? fmtPrice(preTradeSL) : ''} pnlText="SL" labelTag="🛑" containerH={size.h} width={size.w} onDrag={(y) => onPreTradeSlChange?.(yToPriceFn(y))} />
          )}
          {/* Native confirm / discard buttons at bottom */}
          <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={onPreTradeDiscard} style={{ flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: T.border, backgroundColor: T.bg2, alignItems: 'center' }}>
              <Text style={{ color: T.text0, fontWeight: '700', fontSize: 13 }}>Discard</Text>
            </Pressable>
            <Pressable onPress={onPreTradeConfirm} style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: T.green, alignItems: 'center' }}>
              <Text style={{ color: '#000', fontWeight: '800', fontSize: 13 }}>Confirm</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

/* ─── Shared sub-components (native overlay) ────────────────────────────────── */

function DashedLine({
  y, color, labelText, pnlText, tagColor, label, interactive, width,
}: {
  y: number; color: string; labelText: string; pnlText: string | null;
  tagColor: string; label: string; interactive: boolean; width: number;
}) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: Math.max(0, y - 1), pointerEvents: interactive ? 'box-none' : 'none' }}>
      <DashedRule color={color} width={width} />
      <View style={{ position: 'absolute', right: 6, top: -10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: tagColor }}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: '#0b0e11' }}>{label} {labelText}</Text>
      </View>
      {pnlText ? (
        <View style={{ position: 'absolute', left: '50%', top: -10, marginLeft: -28, width: 56, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.75)', borderWidth: 1, borderColor: color }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color, textAlign: 'center' }}>{pnlText}</Text>
        </View>
      ) : null}
    </View>
  );
}

function DraggableLine({
  y, color, labelText, pnlText, labelTag, containerH, width, onDrag,
}: {
  y: number; color: string; labelText: string; pnlText: string;
  labelTag: string; containerH: number; width: number; onDrag: (y: number) => void;
}) {
  const startYRef = useRef(y);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { startYRef.current = y; },
      onPanResponderMove: (_, g) => {
        const nextY = Math.max(0, Math.min(containerH, startYRef.current + g.dy));
        onDrag(nextY);
      },
    })
  ).current;
  startYRef.current = y;

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: Math.max(0, y - 12), pointerEvents: 'box-none' }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 11 }}>
        <DashedRule color={color} width={width} />
      </View>
      <View {...panResponder.panHandlers} style={{ position: 'absolute', left: '50%', top: 0, marginLeft: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: color, borderWidth: 2, borderColor: '#0b0e11', shadowColor: color, shadowOpacity: 0.5, shadowRadius: 4 }} />
      <View style={{ position: 'absolute', left: '50%', top: 0, marginLeft: 18, paddingHorizontal: 6, height: 24, justifyContent: 'center', borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.85)', borderWidth: 1, borderColor: color, pointerEvents: 'none' }}>
        <Text style={{ fontSize: 10, fontWeight: '800', color }}>{pnlText}</Text>
      </View>
      <View style={{ position: 'absolute', right: 6, top: 2, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, backgroundColor: color, pointerEvents: 'none' }}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: '#0b0e11' }}>{labelTag} {labelText}</Text>
      </View>
    </View>
  );
}

function DashedRule({ color, width }: { color: string; width: number }) {
  const dash = 8, gap = 6;
  const count = Math.max(0, Math.floor(width / (dash + gap)));
  return (
    <View style={{ width: '100%', height: 2, flexDirection: 'row', alignItems: 'center', pointerEvents: 'none' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: dash, height: 2, marginRight: gap, backgroundColor: color, opacity: 0.95 }} />
      ))}
    </View>
  );
}
