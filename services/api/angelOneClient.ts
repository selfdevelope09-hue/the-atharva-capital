import axios, { type AxiosInstance } from 'axios';

/** Official SmartAPI REST host (see angel-one/smartapi-python). */
export const ANGEL_API_BASE_URL = 'https://apiconnect.angelone.in';

const LOGIN_PATH = '/rest/auth/angelbroking/user/v1/loginByPassword';

export type AngelEnv = {
  apiKey: string;
  secretKey: string;
  clientId: string;
  pin: string;
};

export function readAngelEnvFromProcess(): AngelEnv {
  return {
    apiKey: process.env.EXPO_PUBLIC_ANGEL_API_KEY ?? '',
    secretKey: process.env.EXPO_PUBLIC_ANGEL_SECRET_KEY ?? '',
    clientId: process.env.EXPO_PUBLIC_ANGEL_CLIENT_ID ?? '',
    pin: process.env.EXPO_PUBLIC_ANGEL_PIN ?? '',
  };
}

/**
 * SmartAPI login headers (password flow).
 * IP/MAC are placeholders — replace with device-derived values before production.
 */
export function buildAngelLoginHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-ClientLocalIP': '127.0.0.1',
    'X-ClientPublicIP': '0.0.0.0',
    'X-MACAddress': '00:00:00:00:00:00',
    'X-PrivateKey': apiKey,
    'X-UserType': 'USER',
    'X-SourceID': 'WEB',
  } as const;
}

/** Axios instance for Angel One REST (relative paths from SmartAPI root). */
export function createAngelOneHttp(): AxiosInstance {
  return axios.create({
    baseURL: ANGEL_API_BASE_URL,
    timeout: 20_000,
    validateStatus: (s) => s >= 200 && s < 600,
  });
}

export type LoginByPasswordBody = {
  clientcode: string;
  password: string;
  totp: string;
};

export type LoginByPasswordResponse = unknown;

/**
 * POST loginByPassword — requires TOTP when 2FA is enabled on the account.
 * Credentials are read from EXPO_PUBLIC_* env (Expo inlines these at build time; treat as non-secret for packaging risk).
 */
export async function loginByPassword(totp: string): Promise<LoginByPasswordResponse> {
  const env = readAngelEnvFromProcess();
  const http = createAngelOneHttp();

  const body: LoginByPasswordBody = {
    clientcode: env.clientId,
    password: env.pin,
    totp,
  };

  const { data, status } = await http.post<LoginByPasswordResponse>(LOGIN_PATH, body, {
    headers: buildAngelLoginHeaders(env.apiKey),
  });

  if (status < 200 || status >= 300) {
    const message = typeof data === 'object' && data && 'message' in data ? String((data as { message?: unknown }).message) : `HTTP ${status}`;
    throw new Error(`Angel One login failed: ${message}`);
  }

  return data;
}

/**
 * `secretKey` is reserved for token refresh / signing flows — not sent on password login.
 * Import `readAngelEnvFromProcess().secretKey` when you wire those endpoints.
 */
export const angelOneClient = {
  ANGEL_API_BASE_URL,
  LOGIN_PATH,
  createAngelOneHttp,
  readAngelEnvFromProcess,
  loginByPassword,
};
