export type MarketId =
  | 'crypto'
  | 'india'
  | 'usa'
  | 'uk'
  | 'china'
  | 'japan'
  | 'australia'
  | 'germany'
  | 'canada'
  | 'switzerland';

export type MarketDataSource = 'binance_websocket' | 'yahoo_finance';

export interface MarketFees {
  intraday?: number;
  delivery?: number;
  fo?: number;
  equity?: number;
  options?: number;
  maker?: number;
  taker?: number;
}

export interface MarketConfig {
  id: MarketId;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  color: string;
  vibe: string;
  maxLeverage: number;
  maxLeverageFO?: number;
  maxLeverageOptions?: number;
  pairs: string[];
  dataSource: MarketDataSource;
  suffix?: string;
  tvExchange?: string;
  hours?: string;
  timezone?: string;
  fees?: MarketFees;
  stampDuty?: number;
  limitUpDown?: number;
  flatFee?: number;
  accentColor?: string;
  /** Full Yahoo symbols merged into batch poll (indices, ETFs) — ticker keys in `ticks` are these strings. */
  yahooPollExtras?: string[];
}

export const MARKETS: Record<MarketId, MarketConfig> = {
  crypto: {
    id: 'crypto',
    name: 'Crypto Universe',
    flag: '🌐',
    currency: 'USDT',
    currencySymbol: '₮',
    color: '#f0b90b',
    vibe: 'Binance Pro',
    maxLeverage: 125,
    pairs: [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT',
      'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT',
      'LINKUSDT', 'MATICUSDT',
    ],
    dataSource: 'binance_websocket',
    tvExchange: 'BINANCE',
    timezone: 'Etc/UTC',
    hours: '24/7',
    fees: { maker: 0.0002, taker: 0.0005 },
    accentColor: '#f0b90b',
  },

  india: {
    id: 'india',
    name: 'India (NSE)',
    flag: '🇮🇳',
    currency: 'INR',
    currencySymbol: '₹',
    color: '#FF6B35',
    vibe: 'Zerodha Kite',
    maxLeverage: 10,
    maxLeverageFO: 30,
    pairs: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'WIPRO', 'BAJFINANCE', 'SBIN', 'ITC', 'ADANIENT'],
    yahooPollExtras: [
      '^NSEI',
      '^BSESN',
      'NIFTYBEES.NS',
      'BANKBEES.NS',
      'SETFNIF50.NS',
      'MON100.NS',
      'LIQUIDBEES.NS',
      'GOLDBEES.NS',
    ],
    dataSource: 'yahoo_finance',
    suffix: '.NS',
    tvExchange: 'NSE',
    hours: '09:15–15:30 IST',
    timezone: 'Asia/Kolkata',
    fees: { intraday: 0.0003, delivery: 0.001, fo: 0.0005 },
    accentColor: '#FF6B35',
  },

  usa: {
    id: 'usa',
    name: 'USA (NASDAQ)',
    flag: '🇺🇸',
    currency: 'USD',
    currencySymbol: '$',
    color: '#00C805',
    vibe: 'Robinhood',
    maxLeverage: 4,
    maxLeverageOptions: 20,
    pairs: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'AMD', 'COIN'],
    dataSource: 'yahoo_finance',
    suffix: '',
    tvExchange: 'NASDAQ',
    hours: '09:30–16:00 EST',
    timezone: 'America/New_York',
    fees: { equity: 0, options: 0.65 },
    accentColor: '#00C805',
  },

  uk: {
    id: 'uk',
    name: 'UK (LSE)',
    flag: '🇬🇧',
    currency: 'GBP',
    currencySymbol: '£',
    color: '#7B68EE',
    vibe: 'Trading 212',
    maxLeverage: 30,
    pairs: ['BARC', 'HSBA', 'BP', 'SHEL', 'AZN', 'ULVR', 'GSK', 'LLOY', 'VOD', 'RIO'],
    dataSource: 'yahoo_finance',
    suffix: '.L',
    tvExchange: 'LSE',
    hours: '08:00–16:30 GMT',
    timezone: 'Europe/London',
    stampDuty: 0.005,
    accentColor: '#7B68EE',
  },

  china: {
    id: 'china',
    name: 'China (SSE)',
    flag: '🇨🇳',
    currency: 'CNY',
    currencySymbol: '¥',
    color: '#E8212A',
    vibe: 'Ping An',
    maxLeverage: 5,
    pairs: ['600519', '601318', '600036', '600900', '601166', '000858', '002594', '300750'],
    dataSource: 'yahoo_finance',
    suffix: '.SS',
    tvExchange: 'SSE',
    hours: '09:30–15:00 CST',
    timezone: 'Asia/Shanghai',
    limitUpDown: 0.10,
    accentColor: '#E8212A',
  },

  japan: {
    id: 'japan',
    name: 'Japan (TSE)',
    flag: '🇯🇵',
    currency: 'JPY',
    currencySymbol: '¥',
    color: '#BC002D',
    vibe: 'SBI Neo',
    maxLeverage: 3.3,
    pairs: ['7203', '9984', '6758', '8306', '7267', '9432', '6501', '4063'],
    dataSource: 'yahoo_finance',
    suffix: '.T',
    tvExchange: 'TSE',
    hours: '09:00–15:30 JST',
    timezone: 'Asia/Tokyo',
    accentColor: '#BC002D',
  },

  australia: {
    id: 'australia',
    name: 'Australia (ASX)',
    flag: '🇦🇺',
    currency: 'AUD',
    currencySymbol: 'A$',
    color: '#00B4D8',
    vibe: 'CommSec',
    maxLeverage: 5,
    pairs: ['CBA', 'BHP', 'CSL', 'NAB', 'WBC', 'ANZ', 'WES', 'TLS', 'RIO', 'FMG'],
    dataSource: 'yahoo_finance',
    suffix: '.AX',
    tvExchange: 'ASX',
    hours: '10:00–16:00 AEST',
    timezone: 'Australia/Sydney',
    accentColor: '#00B4D8',
  },

  germany: {
    id: 'germany',
    name: 'Germany (XETRA)',
    flag: '🇩🇪',
    currency: 'EUR',
    currencySymbol: '€',
    color: '#FFFFFF',
    vibe: 'Trade Republic',
    maxLeverage: 20,
    pairs: ['SAP', 'SIE', 'ALV', 'BAS', 'BMW', 'MBG', 'VOW3', 'DTE', 'ADS', 'MUV2'],
    dataSource: 'yahoo_finance',
    suffix: '.DE',
    tvExchange: 'XETRA',
    hours: '09:00–17:30 CET',
    timezone: 'Europe/Berlin',
    flatFee: 1,
    accentColor: '#FFFFFF',
  },

  canada: {
    id: 'canada',
    name: 'Canada (TSX)',
    flag: '🇨🇦',
    currency: 'CAD',
    currencySymbol: 'C$',
    color: '#FF6B6B',
    vibe: 'Wealthsimple',
    maxLeverage: 3,
    pairs: ['SHOP', 'RY', 'TD', 'ENB', 'CNR', 'BMO', 'SU', 'MFC', 'BCE', 'CP'],
    dataSource: 'yahoo_finance',
    suffix: '.TO',
    tvExchange: 'TSX',
    hours: '09:30–16:00 EST',
    timezone: 'America/Toronto',
    accentColor: '#FF6B6B',
  },

  switzerland: {
    id: 'switzerland',
    name: 'Switzerland (SIX)',
    flag: '🇨🇭',
    currency: 'CHF',
    currencySymbol: 'Fr.',
    color: '#C8A951',
    vibe: 'Swissquote',
    maxLeverage: 50,
    pairs: ['NESN', 'ROG', 'NOVN', 'ABB', 'UHR', 'ZURN', 'CSGN', 'UBSG', 'GEBN', 'SREN'],
    dataSource: 'yahoo_finance',
    suffix: '.SW',
    tvExchange: 'SIX',
    hours: '09:00–17:30 CET',
    timezone: 'Europe/Zurich',
    accentColor: '#C8A951',
  },
};

export const MARKET_IDS: MarketId[] = [
  'crypto', 'india', 'usa', 'uk', 'china', 'japan', 'australia', 'germany', 'canada', 'switzerland',
];

export function getMarket(id: string | undefined): MarketConfig | null {
  if (!id) return null;
  return (MARKETS as Record<string, MarketConfig>)[id] ?? null;
}

export function yahooSymbolFor(cfg: MarketConfig, ticker: string): string {
  return `${ticker}${cfg.suffix ?? ''}`;
}

/** Resolve UI/route `ticker` to Yahoo key — supports bare pair or already-full Yahoo symbol (^, suffix). */
export function toYahooFullSymbol(cfg: MarketConfig, ticker: string): string {
  if (cfg.dataSource === 'binance_websocket') return ticker;
  if (ticker.includes('.') || ticker.startsWith('^')) return ticker;
  return yahooSymbolFor(cfg, ticker);
}

export function tvSymbolFor(cfg: MarketConfig, ticker: string): string {
  const exchange = cfg.tvExchange ?? '';
  return exchange ? `${exchange}:${ticker}` : ticker;
}
