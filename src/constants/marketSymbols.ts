import type { MarketId } from '@/src/constants/markets';

/** Curated TradingView symbols + tick keys for live price polling (see `useMarketPrices`). */
export type MarketSymbolRow = {
  /** TradingView `EXCHANGE:SYMBOL` */
  symbol: string;
  label: string;
  currency: string;
  /**
   * Key in unified price `ticks` map (Yahoo full symbol or Binance pair).
   * Empty if not covered by app polling (forex/indices) — user enters price manually.
   */
  pollKey: string;
};

export const MARKET_SYMBOLS: Record<MarketId, MarketSymbolRow[]> = {
  crypto: [
    { symbol: 'BINANCE:BTCUSDT', label: 'BTC/USDT', currency: 'USDT', pollKey: 'BTCUSDT' },
    { symbol: 'BINANCE:ETHUSDT', label: 'ETH/USDT', currency: 'USDT', pollKey: 'ETHUSDT' },
    { symbol: 'BINANCE:SOLUSDT', label: 'SOL/USDT', currency: 'USDT', pollKey: 'SOLUSDT' },
    { symbol: 'BINANCE:BNBUSDT', label: 'BNB/USDT', currency: 'USDT', pollKey: 'BNBUSDT' },
    { symbol: 'BINANCE:XRPUSDT', label: 'XRP/USDT', currency: 'USDT', pollKey: 'XRPUSDT' },
    { symbol: 'BINANCE:DOGEUSDT', label: 'DOGE/USDT', currency: 'USDT', pollKey: 'DOGEUSDT' },
  ],

  usa: [
    { symbol: 'NASDAQ:AAPL', label: 'Apple', currency: 'USD', pollKey: 'AAPL' },
    { symbol: 'NASDAQ:TSLA', label: 'Tesla', currency: 'USD', pollKey: 'TSLA' },
    { symbol: 'NASDAQ:NVDA', label: 'NVIDIA', currency: 'USD', pollKey: 'NVDA' },
    { symbol: 'NYSE:JPM', label: 'JPMorgan', currency: 'USD', pollKey: 'JPM' },
    { symbol: 'NASDAQ:MSFT', label: 'Microsoft', currency: 'USD', pollKey: 'MSFT' },
    { symbol: 'NASDAQ:GOOGL', label: 'Google', currency: 'USD', pollKey: 'GOOGL' },
    { symbol: 'NASDAQ:AMZN', label: 'Amazon', currency: 'USD', pollKey: 'AMZN' },
    { symbol: 'NYSE:BAC', label: 'Bank of America', currency: 'USD', pollKey: 'BAC' },
  ],

  india: [
    { symbol: 'NSE:RELIANCE', label: 'Reliance', currency: 'INR', pollKey: 'RELIANCE.NS' },
    { symbol: 'NSE:TCS', label: 'TCS', currency: 'INR', pollKey: 'TCS.NS' },
    { symbol: 'NSE:INFY', label: 'Infosys', currency: 'INR', pollKey: 'INFY.NS' },
    { symbol: 'NSE:HDFCBANK', label: 'HDFC Bank', currency: 'INR', pollKey: 'HDFCBANK.NS' },
    { symbol: 'NSE:^NSEI', label: 'Nifty 50', currency: 'INR', pollKey: '^NSEI' },
    { symbol: 'BSE:^BSESN', label: 'Sensex', currency: 'INR', pollKey: '^BSESN' },
    { symbol: 'NSE:WIPRO', label: 'Wipro', currency: 'INR', pollKey: 'WIPRO.NS' },
    { symbol: 'NSE:SBIN', label: 'SBI', currency: 'INR', pollKey: 'SBIN.NS' },
  ],

  uk: [
    { symbol: 'LSE:HSBA', label: 'HSBC', currency: 'GBP', pollKey: 'HSBA.L' },
    { symbol: 'LSE:BP', label: 'BP', currency: 'GBP', pollKey: 'BP.L' },
    { symbol: 'LSE:VOD', label: 'Vodafone', currency: 'GBP', pollKey: 'VOD.L' },
    { symbol: 'LSE:LLOY', label: 'Lloyds', currency: 'GBP', pollKey: 'LLOY.L' },
    { symbol: 'FOREXCOM:GBPUSD', label: 'GBP/USD', currency: 'USD', pollKey: '' },
    { symbol: 'CAPITALCOM:UK100', label: 'FTSE 100', currency: 'GBP', pollKey: '^FTSE' },
  ],

  australia: [
    { symbol: 'ASX:BHP', label: 'BHP', currency: 'AUD', pollKey: 'BHP.AX' },
    { symbol: 'ASX:CBA', label: 'CommBank', currency: 'AUD', pollKey: 'CBA.AX' },
    { symbol: 'ASX:NAB', label: 'NAB', currency: 'AUD', pollKey: 'NAB.AX' },
    { symbol: 'ASX:ANZ', label: 'ANZ', currency: 'AUD', pollKey: 'ANZ.AX' },
    { symbol: 'FOREXCOM:AUDUSD', label: 'AUD/USD', currency: 'USD', pollKey: '' },
  ],

  canada: [
    { symbol: 'TSX:RY', label: 'Royal Bank', currency: 'CAD', pollKey: 'RY.TO' },
    { symbol: 'TSX:TD', label: 'TD Bank', currency: 'CAD', pollKey: 'TD.TO' },
    { symbol: 'TSX:CNR', label: 'CN Rail', currency: 'CAD', pollKey: 'CNR.TO' },
    { symbol: 'TSX:SU', label: 'Suncor', currency: 'CAD', pollKey: 'SU.TO' },
    { symbol: 'FOREXCOM:USDCAD', label: 'USD/CAD', currency: 'CAD', pollKey: '' },
  ],

  germany: [
    { symbol: 'XETR:SAP', label: 'SAP', currency: 'EUR', pollKey: 'SAP.DE' },
    { symbol: 'XETR:SIE', label: 'Siemens', currency: 'EUR', pollKey: 'SIE.DE' },
    { symbol: 'XETR:BMW', label: 'BMW', currency: 'EUR', pollKey: 'BMW.DE' },
    { symbol: 'XETR:VOW3', label: 'Volkswagen', currency: 'EUR', pollKey: 'VOW3.DE' },
    { symbol: 'FOREXCOM:EURUSD', label: 'EUR/USD', currency: 'USD', pollKey: '' },
    { symbol: 'CAPITALCOM:DEUIDXEUR', label: 'DAX 40', currency: 'EUR', pollKey: '^GDAXI' },
  ],

  japan: [
    { symbol: 'TSE:7203', label: 'Toyota', currency: 'JPY', pollKey: '7203.T' },
    { symbol: 'TSE:6758', label: 'Sony', currency: 'JPY', pollKey: '6758.T' },
    { symbol: 'TSE:9984', label: 'SoftBank', currency: 'JPY', pollKey: '9984.T' },
    { symbol: 'TSE:6501', label: 'Hitachi', currency: 'JPY', pollKey: '6501.T' },
    { symbol: 'FOREXCOM:USDJPY', label: 'USD/JPY', currency: 'JPY', pollKey: '' },
    { symbol: 'INDEX:NKY', label: 'Nikkei 225', currency: 'JPY', pollKey: '^N225' },
  ],

  china: [
    { symbol: 'HKEX:700', label: 'Tencent', currency: 'HKD', pollKey: '0700.HK' },
    { symbol: 'HKEX:9988', label: 'Alibaba', currency: 'HKD', pollKey: '9988.HK' },
    { symbol: 'HKEX:3690', label: 'Meituan', currency: 'HKD', pollKey: '3690.HK' },
    { symbol: 'SSE:600519', label: 'Kweichow', currency: 'CNY', pollKey: '600519.SS' },
    { symbol: 'FOREXCOM:USDCNH', label: 'USD/CNH', currency: 'CNH', pollKey: '' },
    { symbol: 'HSI:HSI', label: 'Hang Seng', currency: 'HKD', pollKey: '^HSI' },
  ],

  switzerland: [
    { symbol: 'SIX:NESN', label: 'Nestle', currency: 'CHF', pollKey: 'NESN.SW' },
    { symbol: 'SIX:NOVN', label: 'Novartis', currency: 'CHF', pollKey: 'NOVN.SW' },
    { symbol: 'SIX:ROG', label: 'Roche', currency: 'CHF', pollKey: 'ROG.SW' },
    { symbol: 'SIX:UHR', label: 'Swatch', currency: 'CHF', pollKey: 'UHR.SW' },
    { symbol: 'FOREXCOM:USDCHF', label: 'USD/CHF', currency: 'CHF', pollKey: '' },
    { symbol: 'SMI:SMI', label: 'SMI', currency: 'CHF', pollKey: '^SSMI' },
  ],
};
