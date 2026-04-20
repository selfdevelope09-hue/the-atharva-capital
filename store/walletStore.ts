import { create } from 'zustand';

const BASE_USD = 10_000;
const DEFAULT_USD_INR = 83.05;
const DEFAULT_USD_CNY = 7.24;
const DEFAULT_USD_JPY = 152;
/** GBP per 1 USD — $10k ≈ £7,800 */
const DEFAULT_USD_GBP = 0.78;
/** AUD per 1 USD — $10k ≈ A$15,300 */
const DEFAULT_USD_AUD = 1.53;
/** EUR per 1 USD — $10k ≈ €9,200 */
const DEFAULT_USD_EUR = 0.92;
/** CAD per 1 USD — $10k USD ≈ $13,700 CAD */
const DEFAULT_USD_CAD = 1.37;
/** CHF per 1 USD — $10k USD ≈ 9,100 CHF */
const DEFAULT_USD_CHF = 0.91;

export type WalletState = {
  /** Canonical virtual balance in USD */
  baseUsd: number;
  /** Mock FX; replace with live `services/api` feed */
  usdToInr: number;
  usdToCny: number;
  usdToJpy: number;
  usdToGbp: number;
  usdToAud: number;
  usdToEur: number;
  usdToCad: number;
  usdToChf: number;
  setUsdToInr: (rate: number) => void;
  setUsdToCny: (rate: number) => void;
  setUsdToJpy: (rate: number) => void;
  setUsdToGbp: (rate: number) => void;
  setUsdToAud: (rate: number) => void;
  setUsdToEur: (rate: number) => void;
  setUsdToCad: (rate: number) => void;
  setUsdToChf: (rate: number) => void;
  getInrFromBaseUsd: () => number;
  /** Format any INR amount with Indian grouping, e.g. ₹8,30,000 */
  formatInr: (amountInr: number) => string;
  /** Convert + format the user's base allocation for India view */
  formatBaseUsdAsInr: () => string;
  /** Native USD display for US / universal views */
  formatBaseUsd: () => string;
  getCnyFromBaseUsd: () => number;
  /** Format any CNY amount (¥) */
  formatCny: (amountCny: number) => string;
  formatBaseUsdAsCny: () => string;
  getJpyFromBaseUsd: () => number;
  formatJpy: (amountJpy: number) => string;
  formatBaseUsdAsJpy: () => string;
  getGbpFromBaseUsd: () => number;
  formatGbp: (amountGbp: number) => string;
  formatBaseUsdAsGbp: () => string;
  getAudFromBaseUsd: () => number;
  formatAud: (amountAud: number) => string;
  formatBaseUsdAsAud: () => string;
  getEurFromBaseUsd: () => number;
  formatEur: (amountEur: number) => string;
  formatBaseUsdAsEur: () => string;
  getCadFromBaseUsd: () => number;
  formatCad: (amountCad: number) => string;
  formatBaseUsdAsCad: () => string;
  getChfFromBaseUsd: () => number;
  formatChf: (amountChf: number) => string;
  formatBaseUsdAsChf: () => string;
  /** Virtual ledger: apply signed delta to base USD (clamped ≥ 0). */
  adjustBaseUsd: (deltaUsd: number) => void;
};

function formatInrUtil(amountInr: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(amountInr));
}

function formatUsdUtil(amountUsd: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountUsd);
}

function formatCnyUtil(amountCny: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(Math.round(amountCny));
}

function formatJpyUtil(amountJpy: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(Math.round(amountJpy));
}

function formatGbpUtil(amountGbp: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountGbp);
}

function formatAudUtil(amountAud: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amountAud));
}

function formatEurUtil(amountEur: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amountEur));
}

function formatCadUtil(amountCad: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amountCad));
}

function formatChfUtil(amountChf: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amountChf));
}

export const useWalletStore = create<WalletState>((set, get) => ({
  baseUsd: BASE_USD,
  usdToInr: DEFAULT_USD_INR,
  usdToCny: DEFAULT_USD_CNY,
  usdToJpy: DEFAULT_USD_JPY,
  usdToGbp: DEFAULT_USD_GBP,
  usdToAud: DEFAULT_USD_AUD,
  usdToEur: DEFAULT_USD_EUR,
  usdToCad: DEFAULT_USD_CAD,
  usdToChf: DEFAULT_USD_CHF,
  setUsdToInr: (rate) => set({ usdToInr: Math.max(rate, 0) }),
  setUsdToCny: (rate) => set({ usdToCny: Math.max(rate, 0) }),
  setUsdToJpy: (rate) => set({ usdToJpy: Math.max(rate, 0) }),
  setUsdToGbp: (rate) => set({ usdToGbp: Math.max(rate, 0) }),
  setUsdToAud: (rate) => set({ usdToAud: Math.max(rate, 0) }),
  setUsdToEur: (rate) => set({ usdToEur: Math.max(rate, 0) }),
  setUsdToCad: (rate) => set({ usdToCad: Math.max(rate, 0) }),
  setUsdToChf: (rate) => set({ usdToChf: Math.max(rate, 0) }),
  getInrFromBaseUsd: () => get().baseUsd * get().usdToInr,
  getCnyFromBaseUsd: () => get().baseUsd * get().usdToCny,
  formatInr: (amountInr) => formatInrUtil(amountInr),
  formatBaseUsdAsInr: () => formatInrUtil(get().baseUsd * get().usdToInr),
  formatBaseUsd: () => formatUsdUtil(get().baseUsd),
  formatCny: (amountCny) => formatCnyUtil(amountCny),
  formatBaseUsdAsCny: () => formatCnyUtil(get().baseUsd * get().usdToCny),
  getJpyFromBaseUsd: () => get().baseUsd * get().usdToJpy,
  formatJpy: (amountJpy) => formatJpyUtil(amountJpy),
  formatBaseUsdAsJpy: () => formatJpyUtil(get().baseUsd * get().usdToJpy),
  getGbpFromBaseUsd: () => get().baseUsd * get().usdToGbp,
  formatGbp: (amountGbp) => formatGbpUtil(amountGbp),
  formatBaseUsdAsGbp: () => formatGbpUtil(get().baseUsd * get().usdToGbp),
  getAudFromBaseUsd: () => get().baseUsd * get().usdToAud,
  formatAud: (amountAud) => formatAudUtil(amountAud),
  formatBaseUsdAsAud: () => formatAudUtil(get().baseUsd * get().usdToAud),
  getEurFromBaseUsd: () => get().baseUsd * get().usdToEur,
  formatEur: (amountEur) => formatEurUtil(amountEur),
  formatBaseUsdAsEur: () => formatEurUtil(get().baseUsd * get().usdToEur),
  getCadFromBaseUsd: () => get().baseUsd * get().usdToCad,
  formatCad: (amountCad) => formatCadUtil(amountCad),
  formatBaseUsdAsCad: () => formatCadUtil(get().baseUsd * get().usdToCad),
  getChfFromBaseUsd: () => get().baseUsd * get().usdToChf,
  formatChf: (amountChf) => formatChfUtil(amountChf),
  formatBaseUsdAsChf: () => formatChfUtil(get().baseUsd * get().usdToChf),
  adjustBaseUsd: (deltaUsd) =>
    set((s) => ({
      baseUsd: Math.max(0, s.baseUsd + deltaUsd),
    })),
}));
