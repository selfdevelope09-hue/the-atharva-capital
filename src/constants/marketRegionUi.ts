/**
 * Localized trading UI rules for the global terminal — order modes, quantity steps,
 * fee display lines, and labels. Used by `useMarketConfig` + `RegionalOrderForm`.
 */

import type { MarketConfig, MarketId } from '@/src/constants/markets';

/** Regions we can route today, plus synthetic forex / future B3. */
export type TradingRegion = MarketId | 'forex' | 'brazil';

export type OrderKind = 'market' | 'limit' | 'stop_limit' | 'oco';

export interface QuantityRule {
  unit: 'shares' | 'lots' | 'contracts' | 'crypto_units' | 'forex_lots';
  step: number;
  min: number;
  /** Allow fractional quantity (e.g. US equities, crypto). */
  fractional: boolean;
  /** F&O / index lot (India Nifty, etc.) — informational + snap. */
  lotSize?: number;
  lotLabel?: string;
}

export interface FeeDisplayLine {
  key: string;
  label: string;
  /** Estimate in quote currency for current notional / side. */
  estimate: (args: { notional: number; side: 'long' | 'short'; price: number }) => number;
  format: (v: number, currencySymbol: string) => string;
}

export interface MarketRegionUiConfig {
  region: TradingRegion;
  symbol: string;
  title: string;
  subtitle?: string;
  allowedOrderKinds: OrderKind[];
  /** India MIS/CNC, US margin/cash, UK CFD vs spread bet */
  equityModes?: { id: string; label: string; description?: string }[];
  quantity: QuantityRule;
  leverage: { min: number; max: number; step: number; show: boolean };
  marginMode?: 'cross' | 'isolated';
  pricing: {
    priceDecimals: number;
    showPricesInPence?: boolean;
    showDailyPriceLimit?: boolean;
    dailyLimitPct?: number;
  };
  sessionHints?: string[];
  /** Prominent spread for FX (pips). */
  spreadPipsEstimate?: number;
  /** Extra summary rows (STT, SDRT, SEC, …). */
  feeLines: FeeDisplayLine[];
  labels: {
    amount: string;
    buyLong: string;
    sellShort: string;
  };
  derivatives?: {
    optionChain: boolean;
    warrantsNote?: string;
  };
  crypto?: {
    showFundingCountdown: boolean;
    makerTakerFromMarket: boolean;
  };
  australia?: { chessSponsored: boolean };
  brazil?: { fractionalSuffix: string };
}

const fmtMoneyLine = (v: number, sym: string) =>
  `${sym}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function inferIndiaLot(symbol: string): number {
  const u = symbol.toUpperCase();
  if (u.includes('NIFTY') && !u.includes('BANK')) return 75;
  if (u.includes('BANKNIFTY')) return 15;
  if (u.includes('SENSEX')) return 20;
  return 1;
}

/** Rough STT / stamp / txn charge estimates for demo (not tax advice). */
function indiaFeeLines(): FeeDisplayLine[] {
  return [
    {
      key: 'stt',
      label: 'STT (est.)',
      estimate: ({ notional, side }) => notional * (side === 'long' ? 0.00025 : 0.00025),
      format: fmtMoneyLine,
    },
    {
      key: 'stamp',
      label: 'Stamp duty (est.)',
      estimate: ({ notional }) => notional * 0.00003,
      format: fmtMoneyLine,
    },
    {
      key: 'txn',
      label: 'Exchange + SEBI (est.)',
      estimate: ({ notional }) => notional * 0.0000325,
      format: fmtMoneyLine,
    },
  ];
}

function usRegFeeLines(): FeeDisplayLine[] {
  return [
    {
      key: 'sec',
      label: 'SEC fee (sell est.)',
      estimate: ({ notional, side }) => (side === 'short' ? notional * 0.000008 : 0),
      format: fmtMoneyLine,
    },
    {
      key: 'finra',
      label: 'FINRA TAF (est.)',
      estimate: ({ notional }) => Math.min(7.27, notional * 0.000145),
      format: fmtMoneyLine,
    },
  ];
}

function ukFeeLines(cfg: MarketConfig): FeeDisplayLine[] {
  const sdrt = cfg.stampDuty ?? 0.005;
  return [
    {
      key: 'sdrt',
      label: 'SDRT (buy est.)',
      estimate: ({ notional, side }) => (side === 'long' ? notional * sdrt : 0),
      format: fmtMoneyLine,
    },
  ];
}

export function buildMarketRegionUiConfig(
  symbol: string,
  region: TradingRegion,
  market: MarketConfig | null
): MarketRegionUiConfig {
  const sym = symbol.trim();
  const base = (
    id: TradingRegion,
    title: string
  ): Pick<MarketRegionUiConfig, 'region' | 'symbol' | 'title' | 'allowedOrderKinds'> => ({
    region: id,
    symbol: sym,
    title,
    allowedOrderKinds: ['market', 'limit'],
  });

  if (region === 'brazil') {
    return {
      ...base('brazil', 'Brazil (B3)'),
      subtitle: 'Fractional lots use F suffix in places',
      allowedOrderKinds: ['market', 'limit'],
      quantity: { unit: 'shares', step: 1, min: 1, fractional: true },
      leverage: { min: 1, max: 20, step: 1, show: true },
      pricing: { priceDecimals: 2 },
      sessionHints: ['10:00–17:55 BRT'],
      feeLines: [],
      labels: { amount: 'Qty (shares)', buyLong: 'Buy', sellShort: 'Sell' },
      brazil: { fractionalSuffix: 'F' },
      derivatives: { optionChain: true },
    };
  }

  if (region === 'forex') {
    return {
      ...base('forex', 'Forex'),
      subtitle: 'OTC FX — lots & pips',
      allowedOrderKinds: ['market', 'limit', 'stop_limit'],
      quantity: {
        unit: 'forex_lots',
        step: 0.01,
        min: 0.01,
        fractional: true,
      },
      leverage: { min: 1, max: 500, step: 1, show: true },
      pricing: { priceDecimals: 5 },
      spreadPipsEstimate: 1.2,
      sessionHints: ['Sun 22:00 – Fri 22:00 GMT (typical)'],
      feeLines: [
        {
          key: 'spread',
          label: 'Spread (est. pips)',
          estimate: ({ notional: _n }) => 1.2,
          format: (v, _s) => `${v.toFixed(1)} pips`,
        },
      ],
      labels: { amount: 'Volume (lots)', buyLong: 'Buy base', sellShort: 'Sell base' },
      derivatives: { optionChain: false },
    };
  }

  if (!market) {
    const fallback: MarketRegionUiConfig = {
      ...base(region, 'Market'),
      quantity: { unit: 'shares', step: 1, min: 1, fractional: true },
      leverage: { min: 1, max: 10, step: 1, show: true },
      pricing: { priceDecimals: 2 },
      feeLines: [],
      labels: { amount: 'Qty', buyLong: 'Buy', sellShort: 'Sell' },
      derivatives: { optionChain: false },
    };
    return fallback;
  }

  const m = market;
  const cs = m.currencySymbol;

  switch (m.id) {
    case 'crypto':
      return {
        ...base('crypto', 'Crypto perpetual / spot'),
        subtitle: 'Cross / isolated · maker / taker',
        allowedOrderKinds: ['market', 'limit', 'stop_limit', 'oco'],
        quantity: { unit: 'crypto_units', step: 0.00001, min: 0.00001, fractional: true },
        leverage: { min: 1, max: m.maxLeverage, step: 1, show: true },
        marginMode: 'cross',
        pricing: { priceDecimals: sym.includes('BTC') ? 2 : 4 },
        sessionHints: ['24/7 spot', 'Perp funding every 8h'],
        feeLines: [
          {
            key: 'maker',
            label: 'Maker fee (est.)',
            estimate: ({ notional }) => notional * (m.fees?.maker ?? 0.0002),
            format: fmtMoneyLine,
          },
          {
            key: 'taker',
            label: 'Taker fee (est.)',
            estimate: ({ notional }) => notional * (m.fees?.taker ?? 0.0005),
            format: fmtMoneyLine,
          },
        ],
        labels: { amount: 'Size', buyLong: 'Long / Buy', sellShort: 'Short / Sell' },
        crypto: { showFundingCountdown: true, makerTakerFromMarket: true },
        derivatives: { optionChain: false },
      };

    case 'india': {
      const lot = inferIndiaLot(sym);
      return {
        ...base('india', 'India NSE / BSE'),
        subtitle: 'MIS intraday · CNC delivery',
        allowedOrderKinds: ['market', 'limit'],
        equityModes: [
          { id: 'mis', label: 'Intraday (MIS)', description: 'Higher leverage, square-off rules' },
          { id: 'cnc', label: 'Delivery (CNC)', description: 'Cash & carry' },
        ],
        quantity: {
          unit: 'contracts',
          step: lot,
          min: lot,
          fractional: false,
          lotSize: lot,
          lotLabel: sym.toUpperCase().includes('NIFTY') ? 'Index F&O lot' : 'Lot',
        },
        leverage: { min: 1, max: m.maxLeverageFO ?? m.maxLeverage, step: 1, show: true },
        pricing: { priceDecimals: 2 },
        sessionHints: ['09:15–15:30 IST'],
        feeLines: indiaFeeLines(),
        labels: { amount: 'Qty (lot multiples)', buyLong: 'Buy', sellShort: 'Sell' },
        derivatives: { optionChain: true },
      };
    }

    case 'usa':
      return {
        ...base('usa', 'US equities & options'),
        subtitle: 'Margin vs cash · fractional shares',
        allowedOrderKinds: ['market', 'limit', 'stop_limit'],
        equityModes: [
          { id: 'margin', label: 'Margin', description: 'Reg-T / portfolio margin rules apply' },
          { id: 'cash', label: 'Cash', description: 'No leverage' },
        ],
        quantity: { unit: 'shares', step: 0.0001, min: 0.0001, fractional: true },
        leverage: { min: 1, max: m.maxLeverage, step: 1, show: true },
        pricing: { priceDecimals: 2 },
        sessionHints: ['Pre-market 04:00–09:30', 'Regular 09:30–16:00', 'After-hours 16:00–20:00 ET'],
        feeLines: usRegFeeLines(),
        labels: { amount: 'Shares (fractional OK)', buyLong: 'Buy', sellShort: 'Sell short' },
        derivatives: { optionChain: true, warrantsNote: 'US options ×100 contract multiplier' },
      };

    case 'uk':
      return {
        ...base('uk', 'UK LSE'),
        subtitle: 'CFD / spread bet · GBX for some listings',
        allowedOrderKinds: ['market', 'limit'],
        equityModes: [
          { id: 'cfd', label: 'CFD', description: 'Leveraged OTC' },
          { id: 'spread', label: 'Spread bet', description: 'Tax treatment may differ — demo only' },
        ],
        quantity: { unit: 'shares', step: 1, min: 1, fractional: false },
        leverage: { min: 1, max: m.maxLeverage, step: 1, show: true },
        pricing: { priceDecimals: 2, showPricesInPence: true },
        sessionHints: m.hours ? [m.hours] : [],
        feeLines: ukFeeLines(m),
        labels: { amount: 'Qty', buyLong: 'Buy', sellShort: 'Sell' },
        derivatives: { optionChain: true },
      };

    case 'japan':
      return {
        ...base('japan', 'Japan TSE'),
        subtitle: '100-share standard lot (tangenkabu)',
        allowedOrderKinds: ['market', 'limit'],
        quantity: { unit: 'shares', step: 100, min: 100, fractional: false, lotSize: 100, lotLabel: 'Standard lot' },
        leverage: { min: 1, max: Math.ceil(m.maxLeverage), step: 1, show: true },
        pricing: { priceDecimals: 0, showDailyPriceLimit: true, dailyLimitPct: 0.2 },
        sessionHints: ['Daily price limits — circuit filters apply'],
        feeLines: [],
        labels: { amount: 'Qty (×100 shares)', buyLong: 'Buy', sellShort: 'Sell' },
        derivatives: { optionChain: false },
      };

    case 'germany':
    case 'switzerland':
      return {
        ...base(m.id, m.name),
        subtitle: 'Xetra / SIX routing — EU-style products',
        allowedOrderKinds: ['market', 'limit'],
        quantity: { unit: 'shares', step: 1, min: 1, fractional: false },
        leverage: { min: 1, max: m.maxLeverage, step: 1, show: true },
        pricing: { priceDecimals: m.id === 'switzerland' ? 2 : 2 },
        sessionHints: m.hours ? [m.hours] : [],
        feeLines: m.flatFee
          ? [
              {
                key: 'flat',
                label: 'Exchange flat (demo)',
                estimate: () => m.flatFee ?? 0,
                format: fmtMoneyLine,
              },
            ]
          : [],
        labels: { amount: 'Qty', buyLong: 'Buy', sellShort: 'Sell' },
        derivatives: { optionChain: true, warrantsNote: 'Knock-outs & warrants — venue-specific' },
      };

    case 'australia':
      return {
        ...base('australia', 'Australia ASX'),
        subtitle: 'CHESS-sponsored settlement (indicator)',
        allowedOrderKinds: ['market', 'limit'],
        quantity: { unit: 'shares', step: 1, min: 1, fractional: false },
        leverage: { min: 1, max: m.maxLeverage, step: 1, show: true },
        pricing: { priceDecimals: 2 },
        sessionHints: m.hours ? [m.hours] : [],
        feeLines: [],
        labels: { amount: 'Qty', buyLong: 'Buy', sellShort: 'Sell' },
        australia: { chessSponsored: true },
        derivatives: { optionChain: false },
      };

    case 'china':
      return {
        ...base('china', 'China A-shares'),
        subtitle: `±${((m.limitUpDown ?? 0.1) * 100).toFixed(0)}% daily limit band (typical)`,
        allowedOrderKinds: ['market', 'limit'],
        quantity: { unit: 'shares', step: 100, min: 100, fractional: false },
        leverage: { min: 1, max: m.maxLeverage, step: 1, show: true },
        pricing: { priceDecimals: 2, showDailyPriceLimit: true, dailyLimitPct: m.limitUpDown },
        sessionHints: m.hours ? [m.hours] : [],
        feeLines: [],
        labels: { amount: 'Qty (board lot)', buyLong: 'Buy', sellShort: 'Sell' },
        derivatives: { optionChain: false },
      };

    case 'canada':
      return {
        ...base('canada', 'Canada TSX'),
        allowedOrderKinds: ['market', 'limit'],
        quantity: { unit: 'shares', step: 1, min: 1, fractional: true },
        leverage: { min: 1, max: m.maxLeverage, step: 1, show: true },
        pricing: { priceDecimals: 2 },
        sessionHints: m.hours ? [m.hours] : [],
        feeLines: [],
        labels: { amount: 'Qty', buyLong: 'Buy', sellShort: 'Sell short' },
        derivatives: { optionChain: false },
      };

    default:
      return {
        region: m.id,
        symbol: sym,
        title: m.name,
        allowedOrderKinds: ['market', 'limit'],
        quantity: { unit: 'shares', step: 0.0001, min: 0.0001, fractional: true },
        leverage: { min: 1, max: m.maxLeverage, step: 1, show: true },
        pricing: { priceDecimals: 2 },
        feeLines: [],
        labels: { amount: 'Amount', buyLong: 'Long / Buy', sellShort: 'Short / Sell' },
        derivatives: { optionChain: false },
      };
  }
}

export function snapQuantity(q: number, rule: QuantityRule): number {
  if (!Number.isFinite(q) || q <= 0) return rule.min;
  const step = rule.step;
  const snapped = Math.round(q / step) * step;
  return Math.max(rule.min, snapped);
}

export function pipsFromPriceDistance(
  price: number,
  target: number,
  pipSize: number,
  side: 'long' | 'short'
): number {
  if (!Number.isFinite(price) || !Number.isFinite(target) || pipSize <= 0) return 0;
  const diff = side === 'long' ? target - price : price - target;
  return diff / pipSize;
}

/** Infer pip size from a FX-ish price (demo). */
export function inferPipSize(price: number): number {
  if (price >= 50) return 0.0001;
  if (price >= 1) return 0.0001;
  return 0.00001;
}
