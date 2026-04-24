/**
 * Price alerts — `users/{uid}/alerts` via alertsRepository; live checks via `AlertPriceMonitor`.
 */

import type { AppMarket } from '@/constants/appMarkets';
import { ALL_APP_MARKETS } from '@/constants/appMarkets';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { auth, isFirebaseConfigured } from '@/config/firebaseConfig';
import { deleteAlert, saveAlert, subscribeAlerts, type AlertDoc } from '@/services/firebase/alertsRepository';
import { MARKETS, type MarketId, toYahooFullSymbol } from '@/src/constants/markets';
import { useAlertUiStore } from '@/store/alertUiStore';

/** Labels for common tickers (falls back to raw symbol). */
const SYMBOL_LABELS: Record<string, string> = {
  BTCUSDT: 'BTC/USDT',
  ETHUSDT: 'ETH/USDT',
  SOLUSDT: 'SOL/USDT',
  BNBUSDT: 'BNB/USDT',
  XRPUSDT: 'XRP/USDT',
  AAPL: 'Apple',
  TSLA: 'Tesla',
  NVDA: 'NVIDIA',
  MSFT: 'Microsoft',
  GOOGL: 'Google',
  'RELIANCE.BSE': 'Reliance',
  'TCS.BSE': 'TCS',
  'INFY.BSE': 'Infosys',
  'HDFCBANK.NSE': 'HDFC Bank',
  'HSBA.L': 'HSBC',
  'BP.L': 'BP',
  'VOD.L': 'Vodafone',
};

async function fetchPrice(symbol: string, market: AppMarket): Promise<number | null> {
  try {
    if (market === 'crypto') {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      const data = (await res.json()) as { price?: string };
      return data.price ? parseFloat(data.price) : null;
    }
    const ticker = symbol.split('.')[0];
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = (await res.json()) as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
    };
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return price != null ? Number(price) : null;
  } catch {
    return null;
  }
}

export default function AlertsScreen() {
  const [rows, setRows] = useState<AlertDoc[]>([]);
  const [activeMarket, setActiveMarket] = useState<AppMarket>('crypto');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [targetPrice, setTargetPrice] = useState('');
  const [frequency, setFrequency] = useState<'once' | 'every' | 'daily'>('once');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const priceInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const setActiveCount = useAlertUiStore((s) => s.setActiveCount);

  const symbolsList = useMemo(() => {
    const cfg = MARKETS[activeMarket as MarketId];
    return (cfg.pairs ?? []).slice(0, 12).map((s) => ({
      symbol: s,
      label: SYMBOL_LABELS[s] ?? s,
    }));
  }, [activeMarket]);

  useEffect(() => {
    const u = auth?.currentUser;
    if (!u) {
      setRows([]);
      setActiveCount(0);
      return;
    }
    const unsub = subscribeAlerts(u.uid, (r) => {
      setRows(r);
      setActiveCount(r.filter((x) => x.active).length);
    });
    return () => unsub();
  }, [setActiveCount]);

  useEffect(() => {
    const first = MARKETS[activeMarket as MarketId].pairs?.[0];
    if (first) setSymbol(first);
  }, [activeMarket]);

  useEffect(() => {
    setCurrentPrice(null);
    setLoadingPrice(true);
    void fetchPrice(symbol, activeMarket).then((p) => {
      setCurrentPrice(p);
      setLoadingPrice(false);
    });
    if (priceInterval.current) clearInterval(priceInterval.current);
    priceInterval.current = setInterval(async () => {
      const p = await fetchPrice(symbol, activeMarket);
      setCurrentPrice(p);
    }, 15000);
    return () => {
      if (priceInterval.current) clearInterval(priceInterval.current);
    };
  }, [symbol, activeMarket]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  const createAlert = async () => {
    const u = auth?.currentUser;
    if (!targetPrice || !u || creating || !isFirebaseConfigured) return;
    const p = parseFloat(targetPrice);
    if (!isFinite(p)) return;
    setCreating(true);
    try {
      const cfg = MARKETS[activeMarket as MarketId];
      const symU = symbol.trim().toUpperCase();
      const symbolFull = toYahooFullSymbol(cfg, symU);
      const label = SYMBOL_LABELS[symU] ?? symU;
      await saveAlert(u.uid, {
        market: activeMarket,
        symbol: symU,
        symbolFull,
        condition,
        price: p,
        alertType: frequency,
        active: true,
        createdAt: new Date().toISOString(),
      });
      setTargetPrice('');
    } finally {
      setCreating(false);
    }
  };

  const onDelete = async (id: string) => {
    const u = auth?.currentUser;
    if (!u) return;
    await deleteAlert(u.uid, id);
  };

  const activeAlerts = rows.filter((a) => a.active);
  const historyAlerts = rows.filter((a) => !a.active);

  const fmtPrice = (x: number) => (x >= 100 ? x.toLocaleString('en-US', { maximumFractionDigits: 2 }) : x.toFixed(6));

  const fmtRowLabel = (r: AlertDoc) => {
    const lbl = SYMBOL_LABELS[r.symbol] ?? r.symbolFull;
    return lbl;
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0a0a14' }} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 4 }}>🔔 Price Alerts</Text>
      <Text style={{ color: '#555', fontSize: 13, marginBottom: 20 }}>
        Auto-checked every ~15s · In-app toasts + optional browser notifications (web)
      </Text>

      {!isFirebaseConfigured || !auth?.currentUser ? (
        <Text style={{ color: '#ff4757', marginBottom: 16 }}>Sign in to sync alerts.</Text>
      ) : (
        <>
          <View style={{ backgroundColor: '#111122', borderWidth: 1, borderColor: '#1e1e30', borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <Text style={{ color: '#fff', fontWeight: '700', marginBottom: 14, fontSize: 16 }}>+ New Alert</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {ALL_APP_MARKETS.map((m) => {
                  const cfg = MARKETS[m as MarketId];
                  const on = activeMarket === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setActiveMarket(m)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: on ? '#f0b90b' : '#2a2a3e',
                        backgroundColor: on ? '#f0b90b15' : '#0d0d1a',
                      }}
                    >
                      <Text style={{ fontSize: 11, color: on ? '#f0b90b' : '#666' }}>
                        {cfg.flag} {m.toUpperCase().slice(0, 3)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={{ color: '#666', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Symbol</Text>
            <ScrollView style={{ maxHeight: 120, marginBottom: 14 }} nestedScrollEnabled>
              {symbolsList.map((s) => (
                <Pressable
                  key={s.symbol}
                  onPress={() => setSymbol(s.symbol)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    backgroundColor: symbol === s.symbol ? '#f0b90b22' : 'transparent',
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: symbol === s.symbol ? '#f0b90b' : '#ccc', fontSize: 14 }}>
                    {s.label} ({s.symbol})
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: '#0d0d1a',
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: '#1a1a2e',
              }}
            >
              <Text style={{ color: '#555', fontSize: 12 }}>Current price:</Text>
              {loadingPrice ? (
                <Text style={{ color: '#555', fontSize: 13 }}>Loading…</Text>
              ) : currentPrice != null ? (
                <Text style={{ color: '#f0b90b', fontWeight: '800', fontSize: 16 }}>${fmtPrice(currentPrice)}</Text>
              ) : (
                <Text style={{ color: '#555', fontSize: 13 }}>Unavailable</Text>
              )}
              <Text style={{ marginLeft: 'auto', color: '#333', fontSize: 11 }}>↻ 15s</Text>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 14, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a3e' }}>
              <Pressable
                onPress={() => setCondition('above')}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  backgroundColor: condition === 'above' ? '#0d2a0d' : '#111122',
                  borderRightWidth: 1,
                  borderRightColor: '#2a2a3e',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: condition === 'above' ? '#26de81' : '#555', fontWeight: '700', fontSize: 14 }}>↑ Above</Text>
              </Pressable>
              <Pressable
                onPress={() => setCondition('below')}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  backgroundColor: condition === 'below' ? '#2a0d0d' : '#111122',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: condition === 'below' ? '#ff4757' : '#555', fontWeight: '700', fontSize: 14 }}>↓ Below</Text>
              </Pressable>
            </View>

            <Text style={{ color: '#666', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Target price (USD)</Text>
            <TextInput
              value={targetPrice}
              onChangeText={setTargetPrice}
              keyboardType="decimal-pad"
              placeholder={currentPrice ? `e.g. ${fmtPrice(currentPrice * (condition === 'above' ? 1.05 : 0.95))}` : 'Enter price'}
              placeholderTextColor="#555"
              style={{
                width: '100%',
                paddingHorizontal: 14,
                paddingVertical: 11,
                backgroundColor: '#0d0d1a',
                borderWidth: 1,
                borderColor: '#2a2a3e',
                borderRadius: 10,
                color: '#fff',
                fontSize: 14,
                marginBottom: 8,
              }}
            />
            {currentPrice != null && targetPrice ? (
              <Text style={{ fontSize: 12, color: '#555', marginBottom: 14 }}>
                {(((parseFloat(targetPrice) - currentPrice) / currentPrice) * 100).toFixed(2)}% from current
              </Text>
            ) : null}

            <Text style={{ color: '#666', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>Alert frequency</Text>
            <View style={{ flexDirection: 'row', marginBottom: 18, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a3e' }}>
              {(['once', 'every', 'daily'] as const).map((f, i) => (
                <Pressable
                  key={f}
                  onPress={() => setFrequency(f)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    backgroundColor: frequency === f ? '#f0b90b22' : '#111122',
                    borderRightWidth: i < 2 ? 1 : 0,
                    borderRightColor: '#2a2a3e',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: frequency === f ? '#f0b90b' : '#555', fontWeight: frequency === f ? '700' : '400', fontSize: 12 }}>
                    {f === 'once' ? 'Once' : f === 'every' ? 'Every' : 'Daily'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={createAlert}
              disabled={!targetPrice || creating}
              style={{
                width: '100%',
                paddingVertical: 14,
                backgroundColor: '#f0b90b',
                borderRadius: 12,
                alignItems: 'center',
                opacity: targetPrice && !creating ? 1 : 0.5,
              }}
            >
              <Text style={{ color: '#000', fontWeight: '800', fontSize: 15 }}>{creating ? 'Creating…' : '🚀 Create Alert'}</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            <Pressable
              onPress={() => setTab('active')}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: tab === 'active' ? '#f0b90b' : '#2a2a3e',
                backgroundColor: tab === 'active' ? '#f0b90b22' : '#111122',
              }}
            >
              <Text style={{ color: tab === 'active' ? '#f0b90b' : '#666', fontSize: 13, fontWeight: '600' }}>Active ({activeAlerts.length})</Text>
            </Pressable>
            <Pressable
              onPress={() => setTab('history')}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: tab === 'history' ? '#f0b90b' : '#2a2a3e',
                backgroundColor: tab === 'history' ? '#f0b90b22' : '#111122',
              }}
            >
              <Text style={{ color: tab === 'history' ? '#f0b90b' : '#666', fontSize: 13, fontWeight: '600' }}>History ({historyAlerts.length})</Text>
            </Pressable>
          </View>

          {(tab === 'active' ? activeAlerts : historyAlerts).length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 36, gap: 10 }}>
              <Text style={{ fontSize: 36 }}>{tab === 'active' ? '🔕' : '📭'}</Text>
              <Text style={{ color: '#444', fontSize: 14 }}>
                {tab === 'active' ? 'No active alerts. Create one above!' : 'No triggered alerts yet.'}
              </Text>
            </View>
          ) : (
            (tab === 'active' ? activeAlerts : historyAlerts).map((alert) => (
              <View
                key={alert.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#111122',
                  borderWidth: 1,
                  borderColor: '#1e1e30',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  marginBottom: 8,
                  opacity: !alert.active ? 0.65 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <Text style={{ fontSize: 20 }}>{MARKETS[alert.market as MarketId]?.flag ?? '•'}</Text>
                  <View>
                    <Text style={{ color: '#e0e0e0', fontWeight: '700', fontSize: 14 }}>{fmtRowLabel(alert)}</Text>
                    <Text style={{ color: '#555', fontSize: 12, marginTop: 2 }}>
                      <Text style={{ color: alert.condition === 'above' ? '#26de81' : '#ff4757', fontWeight: '600' }}>
                        {alert.condition === 'above' ? '↑ Above' : '↓ Below'}
                      </Text>
                      {` $${alert.price.toLocaleString()} · ${alert.alertType}`}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 20,
                      overflow: 'hidden',
                      color: alert.active ? '#26de81' : '#888',
                      backgroundColor: alert.active ? '#0d2a0d' : '#1a1a2e',
                    }}
                  >
                    {alert.active ? '● Active' : '✓ Triggered'}
                  </Text>
                  {tab === 'active' ? (
                    <Pressable onPress={() => void onDelete(alert.id)} style={{ paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#2a2a3e', borderRadius: 6 }}>
                      <Text style={{ color: '#666', fontSize: 13 }}>✕</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}
