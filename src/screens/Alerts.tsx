/**
 * Phase 4 — Price alerts: Firestore `users/{uid}/alerts/{alertId}` + live checks via `AlertPriceMonitor`.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import type { AppMarket } from '@/constants/appMarkets';
import { ALL_APP_MARKETS } from '@/constants/appMarkets';
import { auth, isFirebaseConfigured } from '@/config/firebaseConfig';
import { MARKETS, type MarketId, yahooSymbolFor, toYahooFullSymbol } from '@/src/constants/markets';
import { T } from '@/src/constants/theme';
import { deleteAlert, loadAlertsOnce, saveAlert, subscribeAlerts, type AlertDoc } from '@/services/firebase/alertsRepository';
import { useAlertUiStore } from '@/store/alertUiStore';

export default function AlertsScreen() {
  const [rows, setRows] = useState<AlertDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [market, setMarket] = useState<AppMarket>('usa');
  const [symbol, setSymbol] = useState('AAPL');
  const [cond, setCond] = useState<'above' | 'below'>('above');
  const [price, setPrice] = useState('150');
  const [alertType, setAlertType] = useState<'once' | 'every' | 'daily'>('once');

  const setActiveCount = useAlertUiStore((s) => s.setActiveCount);

  useEffect(() => {
    const u = auth?.currentUser;
    if (!u) {
      setRows([]);
      setLoading(false);
      return;
    }
    const unsub = subscribeAlerts(u.uid, (r) => {
      setRows(r);
      setActiveCount(r.filter((x) => x.active).length);
      setLoading(false);
    });
    return () => unsub();
  }, [setActiveCount]);

  const history = useMemo(() => rows.filter((r) => r.triggeredAt), [rows]);

  const onCreate = async () => {
    const u = auth?.currentUser;
    if (!u) return;
    const cfg = MARKETS[market as MarketId];
    const p = parseFloat(price);
    if (!isFinite(p)) return;
    const symU = symbol.trim().toUpperCase();
    const full = cfg.dataSource === 'binance_websocket' ? symU : toYahooFullSymbol(cfg, symU);
    await saveAlert(u.uid, {
      market,
      symbol: symU,
      symbolFull: full,
      condition: cond,
      price: p,
      alertType,
      active: true,
      createdAt: new Date().toISOString(),
    });
    const list = await loadAlertsOnce(u.uid);
    setRows(list);
  };

  const w = Dimensions.get('window').width;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Text style={{ color: T.text0, fontSize: 22, fontWeight: '800' }}>Price alerts</Text>
        <Text style={{ color: T.text3, fontSize: 12, marginTop: 4 }}>
          Stored at users/&#123;uid&#125;/alerts/&#123;alertId&#125;. Checked every ~15s.
        </Text>

        {!isFirebaseConfigured || !auth?.currentUser ? (
          <Text style={{ color: T.red, marginTop: 12 }}>Sign in to sync alerts.</Text>
        ) : (
          <>
            <Text style={{ color: T.text1, fontWeight: '800', marginTop: 16 }}>New alert</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginVertical: 8 }}>
              {ALL_APP_MARKETS.map((m) => {
                const cfg = MARKETS[m as MarketId];
                const on = market === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMarket(m)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: on ? cfg.accentColor ?? T.yellow : T.border,
                      backgroundColor: T.bg1,
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>{cfg.flag}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={{ color: T.text3, fontSize: 11, marginBottom: 4 }}>Symbol (base ticker)</Text>
            <TextInput
              value={symbol}
              onChangeText={setSymbol}
              placeholder="AAPL"
              placeholderTextColor={T.text3}
              autoCapitalize="characters"
              style={{
                borderWidth: 1,
                borderColor: T.border,
                borderRadius: 8,
                padding: 12,
                color: T.text0,
                marginBottom: 10,
              }}
            />
            <Text style={{ color: T.text3, fontSize: 11, marginBottom: 4 }}>Yahoo full (optional override)</Text>
            <Text style={{ color: T.text2, fontSize: 11, marginBottom: 8 }}>
              Preview: {MARKETS[market as MarketId].dataSource === 'binance_websocket' ? symbol : yahooSymbolFor(MARKETS[market as MarketId], symbol.trim() || '—')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <Pressable
                onPress={() => setCond('above')}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: cond === 'above' ? T.greenDim : T.bg1,
                  borderWidth: 1,
                  borderColor: T.border,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: T.green, fontWeight: '800' }}>Above</Text>
              </Pressable>
              <Pressable
                onPress={() => setCond('below')}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: cond === 'below' ? T.redDim : T.bg1,
                  borderWidth: 1,
                  borderColor: T.border,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: T.red, fontWeight: '800' }}>Below</Text>
              </Pressable>
            </View>
            <TextInput
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="Price"
              placeholderTextColor={T.text3}
              style={{
                borderWidth: 1,
                borderColor: T.border,
                borderRadius: 8,
                padding: 12,
                color: T.text0,
                marginBottom: 10,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['once', 'every', 'daily'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setAlertType(t)}
                  style={{
                    flex: 1,
                    padding: 8,
                    borderRadius: 8,
                    backgroundColor: alertType === t ? T.bg2 : T.bg1,
                    borderWidth: 1,
                    borderColor: alertType === t ? T.yellow : T.border,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: T.text1, fontSize: 11, fontWeight: '700' }}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={onCreate} style={{ backgroundColor: T.yellow, padding: 14, borderRadius: T.radiusMd, alignItems: 'center' }}>
              <Text style={{ color: '#000', fontWeight: '800' }}>Create alert</Text>
            </Pressable>
          </>
        )}

        <Text style={{ color: T.text0, fontWeight: '800', marginTop: 24, marginBottom: 8 }}>Active</Text>
        {loading ? <Text style={{ color: T.text3 }}>Loading…</Text> : null}
        {rows
          .filter((r) => r.active)
          .map((r) => (
            <View
              key={r.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderColor: T.border,
                maxWidth: w,
              }}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: T.text0, fontWeight: '700' }}>{r.symbolFull}</Text>
                <Text style={{ color: T.text3, fontSize: 11 }}>
                  {r.condition} {r.price} · {r.alertType}
                </Text>
              </View>
              <Pressable
                onPress={() => auth?.currentUser && deleteAlert(auth.currentUser.uid, r.id)}
                style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: T.redDim, borderRadius: 8 }}
              >
                <Text style={{ color: T.red, fontWeight: '800', fontSize: 11 }}>Delete</Text>
              </Pressable>
            </View>
          ))}

        <Text style={{ color: T.text0, fontWeight: '800', marginTop: 20, marginBottom: 8 }}>History</Text>
        {history.map((r) => (
          <View key={`${r.id}-h`} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: T.border }}>
            <Text style={{ color: T.text2, fontSize: 12, fontWeight: '700' }}>{r.symbolFull}</Text>
            <Text style={{ color: T.text3, fontSize: 11 }}>
              {r.triggeredAt ?? '—'} · hits {r.triggerCount}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
