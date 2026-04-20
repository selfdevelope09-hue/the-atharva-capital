import axios, { type AxiosInstance } from 'axios';

export const FMP_API_V3_BASE = 'https://financialmodelingprep.com/api/v3';

export type FmpQuoteShortRow = {
  symbol: string;
  price: number;
  volume?: number;
  changesPercentage?: number;
};

function readFmpKey(): string | undefined {
  return process.env.EXPO_PUBLIC_FMP_API_KEY;
}

/** Axios client for FMP v3 (quotes, profiles, etc.). */
export function createFmpClient(): AxiosInstance {
  const key = readFmpKey();
  return axios.create({
    baseURL: FMP_API_V3_BASE,
    timeout: 15_000,
    params: key ? { apikey: key } : {},
    headers: { Accept: 'application/json' },
  });
}

/**
 * Real-time / delayed quote-short for one or more symbols (comma-separated path).
 * TSE symbols use FMP form `7203.T`, `6758.T`, etc.
 */
export async function fetchFmpQuoteShort(symbols: string[]): Promise<FmpQuoteShortRow[]> {
  const key = readFmpKey();
  if (!key) {
    throw new Error('EXPO_PUBLIC_FMP_API_KEY is not set');
  }
  const list = symbols.map((s) => s.trim()).filter(Boolean).join(',');
  if (!list) return [];
  const { data } = await axios.get<FmpQuoteShortRow[]>(`${FMP_API_V3_BASE}/quote-short/${list}`, {
    params: { apikey: key },
    timeout: 15_000,
    headers: { Accept: 'application/json' },
  });
  return Array.isArray(data) ? data : [];
}

export const fmpClient = {
  FMP_API_V3_BASE,
  createFmpClient,
  fetchFmpQuoteShort,
  readFmpKey,
};
