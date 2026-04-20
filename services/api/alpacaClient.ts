import axios, { type AxiosInstance } from 'axios';

/** Alpaca paper trading REST host */
export const ALPACA_PAPER_REST_BASE = 'https://paper-api.alpaca.markets';

export type AlpacaEnv = {
  apiKey: string;
  secretKey: string;
};

export function readAlpacaEnvFromProcess(): AlpacaEnv {
  return {
    apiKey: process.env.EXPO_PUBLIC_ALPACA_API_KEY ?? '',
    secretKey: process.env.EXPO_PUBLIC_ALPACA_SECRET_KEY ?? '',
  };
}

export function buildAlpacaAuthHeaders(env: AlpacaEnv) {
  return {
    'APCA-API-KEY-ID': env.apiKey,
    'APCA-API-SECRET-KEY': env.secretKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  } as const;
}

export function createAlpacaPaperClient(): AxiosInstance {
  const env = readAlpacaEnvFromProcess();
  return axios.create({
    baseURL: ALPACA_PAPER_REST_BASE,
    timeout: 20_000,
    headers: buildAlpacaAuthHeaders(env),
    validateStatus: (s) => s >= 200 && s < 600,
  });
}

/** Smoke-check paper account (requires real keys in .env). */
export async function getAlpacaAccount(): Promise<unknown> {
  const http = createAlpacaPaperClient();
  const { data, status } = await http.get('/v2/account');
  if (status < 200 || status >= 300) {
    throw new Error(`Alpaca account fetch failed: HTTP ${status}`);
  }
  return data;
}

export const alpacaClient = {
  ALPACA_PAPER_REST_BASE,
  createAlpacaPaperClient,
  readAlpacaEnvFromProcess,
  getAlpacaAccount,
};
