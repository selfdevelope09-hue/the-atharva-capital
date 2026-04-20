/**
 * Static company / sector labels for market cards (Yahoo symbol keys = tick keys).
 */
import type { MarketId } from '../constants/markets';

export type StockMeta = { company: string; sector: string };

const CRYPTO: Record<string, StockMeta> = {
  BTCUSDT: { company: 'Bitcoin', sector: 'Crypto' },
  ETHUSDT: { company: 'Ethereum', sector: 'Crypto' },
  BNBUSDT: { company: 'BNB', sector: 'Crypto' },
  SOLUSDT: { company: 'Solana', sector: 'Crypto' },
  XRPUSDT: { company: 'XRP', sector: 'Crypto' },
  DOGEUSDT: { company: 'Dogecoin', sector: 'Crypto' },
  ADAUSDT: { company: 'Cardano', sector: 'Crypto' },
  AVAXUSDT: { company: 'Avalanche', sector: 'Crypto' },
  LINKUSDT: { company: 'Chainlink', sector: 'Crypto' },
  MATICUSDT: { company: 'Polygon', sector: 'Crypto' },
};

const INDIA: Record<string, StockMeta> = {
  RELIANCE: { company: 'Reliance Industries', sector: 'Energy' },
  TCS: { company: 'Tata Consultancy Services', sector: 'Technology' },
  INFY: { company: 'Infosys', sector: 'Technology' },
  HDFCBANK: { company: 'HDFC Bank', sector: 'Financials' },
  ICICIBANK: { company: 'ICICI Bank', sector: 'Financials' },
  WIPRO: { company: 'Wipro', sector: 'Technology' },
  BAJFINANCE: { company: 'Bajaj Finance', sector: 'Financials' },
  SBIN: { company: 'State Bank of India', sector: 'Financials' },
  ITC: { company: 'ITC', sector: 'Consumer' },
  ADANIENT: { company: 'Adani Enterprises', sector: 'Industrials' },
};

const USA: Record<string, StockMeta> = {
  AAPL: { company: 'Apple Inc.', sector: 'Technology' },
  TSLA: { company: 'Tesla Inc.', sector: 'Consumer Cyclical' },
  NVDA: { company: 'NVIDIA Corp.', sector: 'Technology' },
  MSFT: { company: 'Microsoft Corp.', sector: 'Technology' },
  GOOGL: { company: 'Alphabet Inc.', sector: 'Communication' },
  AMZN: { company: 'Amazon.com Inc.', sector: 'Consumer Cyclical' },
  META: { company: 'Meta Platforms Inc.', sector: 'Communication' },
  NFLX: { company: 'Netflix Inc.', sector: 'Communication' },
  AMD: { company: 'Advanced Micro Devices', sector: 'Technology' },
  COIN: { company: 'Coinbase Global Inc.', sector: 'Financials' },
};

const UK: Record<string, StockMeta> = {
  BARC: { company: 'Barclays PLC', sector: 'Financials' },
  HSBA: { company: 'HSBC Holdings', sector: 'Financials' },
  BP: { company: 'BP PLC', sector: 'Energy' },
  SHEL: { company: 'Shell PLC', sector: 'Energy' },
  AZN: { company: 'AstraZeneca PLC', sector: 'Healthcare' },
  ULVR: { company: 'Unilever PLC', sector: 'Consumer' },
  GSK: { company: 'GSK PLC', sector: 'Healthcare' },
  LLOY: { company: 'Lloyds Banking Group', sector: 'Financials' },
  VOD: { company: 'Vodafone Group', sector: 'Communication' },
  RIO: { company: 'Rio Tinto PLC', sector: 'Materials' },
};

const CHINA: Record<string, StockMeta> = {
  '600519': { company: 'Kweichow Moutai', sector: 'Consumer' },
  '601318': { company: 'Ping An Insurance', sector: 'Financials' },
  '600036': { company: 'China Merchants Bank', sector: 'Financials' },
  '600900': { company: 'Yangtze Power', sector: 'Utilities' },
  '601166': { company: 'Industrial Bank', sector: 'Financials' },
  '000858': { company: 'Wuliangye Yibin', sector: 'Consumer' },
  '002594': { company: 'BYD Company', sector: 'Consumer Cyclical' },
  '300750': { company: 'CATL', sector: 'Industrials' },
};

const JAPAN: Record<string, StockMeta> = {
  '7203': { company: 'Toyota Motor Corp.', sector: 'Consumer Cyclical' },
  '9984': { company: 'SoftBank Group', sector: 'Communication' },
  '6758': { company: 'Sony Group Corp.', sector: 'Technology' },
  '8306': { company: 'Mitsubishi UFJ Financial', sector: 'Financials' },
  '7267': { company: 'Honda Motor Co.', sector: 'Consumer Cyclical' },
  '9432': { company: 'NTT Inc.', sector: 'Communication' },
  '6501': { company: 'Hitachi Ltd.', sector: 'Industrials' },
  '4063': { company: 'Shin-Etsu Chemical', sector: 'Materials' },
};

const AUSTRALIA: Record<string, StockMeta> = {
  CBA: { company: 'Commonwealth Bank', sector: 'Financials' },
  BHP: { company: 'BHP Group Ltd.', sector: 'Materials' },
  CSL: { company: 'CSL Ltd.', sector: 'Healthcare' },
  NAB: { company: 'National Australia Bank', sector: 'Financials' },
  WBC: { company: 'Westpac Banking Corp.', sector: 'Financials' },
  ANZ: { company: 'ANZ Group', sector: 'Financials' },
  WES: { company: 'Wesfarmers Ltd.', sector: 'Consumer' },
  TLS: { company: 'Telstra Corp.', sector: 'Communication' },
  RIO: { company: 'Rio Tinto Ltd.', sector: 'Materials' },
  FMG: { company: 'Fortescue Metals', sector: 'Materials' },
};

const GERMANY: Record<string, StockMeta> = {
  SAP: { company: 'SAP SE', sector: 'Technology' },
  SIE: { company: 'Siemens AG', sector: 'Industrials' },
  ALV: { company: 'Allianz SE', sector: 'Financials' },
  BAS: { company: 'BASF SE', sector: 'Materials' },
  BMW: { company: 'BMW AG', sector: 'Consumer Cyclical' },
  MBG: { company: 'Mercedes-Benz Group AG', sector: 'Consumer Cyclical' },
  VOW3: { company: 'Volkswagen AG', sector: 'Consumer Cyclical' },
  DTE: { company: 'Deutsche Telekom AG', sector: 'Communication' },
  ADS: { company: 'Adidas AG', sector: 'Consumer Cyclical' },
  MUV2: { company: 'Münchener Rück', sector: 'Financials' },
};

const CANADA: Record<string, StockMeta> = {
  SHOP: { company: 'Shopify Inc.', sector: 'Technology' },
  RY: { company: 'Royal Bank of Canada', sector: 'Financials' },
  TD: { company: 'Toronto-Dominion Bank', sector: 'Financials' },
  ENB: { company: 'Enbridge Inc.', sector: 'Energy' },
  CNR: { company: 'Canadian National Railway', sector: 'Industrials' },
  BMO: { company: 'Bank of Montreal', sector: 'Financials' },
  SU: { company: 'Suncor Energy Inc.', sector: 'Energy' },
  MFC: { company: 'Manulife Financial', sector: 'Financials' },
  BCE: { company: 'BCE Inc.', sector: 'Communication' },
  CP: { company: 'Canadian Pacific Kansas City', sector: 'Industrials' },
};

const SWITZERLAND: Record<string, StockMeta> = {
  NESN: { company: 'Nestlé SA', sector: 'Consumer' },
  ROG: { company: 'Roche Holding AG', sector: 'Healthcare' },
  NOVN: { company: 'Novartis AG', sector: 'Healthcare' },
  ABB: { company: 'ABB Ltd.', sector: 'Industrials' },
  UHR: { company: 'Swatch Group AG', sector: 'Consumer Cyclical' },
  ZURN: { company: 'Zurich Insurance Group', sector: 'Financials' },
  CSGN: { company: 'Credit Suisse Group AG', sector: 'Financials' },
  UBSG: { company: 'UBS Group AG', sector: 'Financials' },
  GEBN: { company: 'Geberit AG', sector: 'Industrials' },
  SREN: { company: 'Swiss Re AG', sector: 'Financials' },
};

/** India F&O / indices / ETF Yahoo keys → labels (full Yahoo symbol). */
export const INDIA_FO_META: Record<string, StockMeta> = {
  '^NSEI': { company: 'NIFTY 50 Index', sector: 'Index' },
  '^BSESN': { company: 'S&P BSE SENSEX', sector: 'Index' },
  'NIFTYBEES.NS': { company: 'Nippon India ETF Nifty BeES', sector: 'ETF' },
  'BANKBEES.NS': { company: 'Nippon India ETF Bank BeES', sector: 'ETF' },
  'SETFNIF50.NS': { company: 'SBI ETF Nifty 50', sector: 'ETF' },
  'MON100.NS': { company: 'Motilal Oswal Nasdaq 100 ETF', sector: 'ETF' },
  'LIQUIDBEES.NS': { company: 'Nippon India ETF Liquid BeES', sector: 'ETF' },
  'GOLDBEES.NS': { company: 'Nippon India ETF Gold BeES', sector: 'ETF' },
};

const BY_MARKET: Partial<Record<MarketId, Record<string, StockMeta>>> = {
  crypto: CRYPTO,
  india: INDIA,
  usa: USA,
  uk: UK,
  china: CHINA,
  japan: JAPAN,
  australia: AUSTRALIA,
  germany: GERMANY,
  canada: CANADA,
  switzerland: SWITZERLAND,
};

export function getStockMeta(market: MarketId, ticker: string): StockMeta {
  const m = BY_MARKET[market]?.[ticker];
  if (m) return m;
  if (market === 'india' && INDIA_FO_META[ticker]) return INDIA_FO_META[ticker];
  return { company: ticker, sector: '—' };
}
