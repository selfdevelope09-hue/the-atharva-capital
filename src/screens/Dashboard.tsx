/**
 * Portfolio dashboard — Firestore `trades`, KPIs, equity curve, breakdown, recent trades, calendar.
 */

import { useRouter } from 'expo-router';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Defs, Line, LinearGradient, Polygon, Polyline, Stop } from 'react-native-svg';

import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';
import { T } from '@/src/constants/theme';
import { useProfileStore } from '@/store/profileStore';

interface Trade {
  id: string;
  symbol: string;
  market: string;
  side: 'BUY' | 'SELL';
  pnl: number;
  status: string;
  openedAt?: Timestamp | { seconds: number };
  closedAt?: Timestamp | { seconds: number };
  price?: number;
  units?: number;
}

interface MarketPnl {
  market: string;
  flag: string;
  currency: string;
  pnl: number;
  trades: number;
}

const MARKET_META: Record<string, { flag: string; currency: string; color: string }> = {
  crypto: { flag: '🌐', currency: 'USDT', color: '#f0b90b' },
  india: { flag: '🇮🇳', currency: 'INR', color: '#ff6b35' },
  usa: { flag: '🇺🇸', currency: 'USD', color: '#4dabf7' },
  uk: { flag: '🇬🇧', currency: 'GBP', color: '#748ffc' },
  china: { flag: '🇨🇳', currency: 'CNY', color: '#ff4757' },
  japan: { flag: '🇯🇵', currency: 'JPY', color: '#ff6b81' },
  australia: { flag: '🇦🇺', currency: 'AUD', color: '#26de81' },
  germany: { flag: '🇩🇪', currency: 'EUR', color: '#fd9644' },
  canada: { flag: '🇨🇦', currency: 'CAD', color: '#fc5c65' },
  switzerland: { flag: '🇨🇭', currency: 'CHF', color: '#a55eea' },
};

function tsSeconds(v: Timestamp | { seconds: number } | undefined): number | undefined {
  if (!v) return undefined;
  const s = 'seconds' in v ? v.seconds : (v as Timestamp).seconds;
  return typeof s === 'number' ? s : undefined;
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 32;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <Svg width={w} height={h}>
      <Polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

function KpiCard({
  label,
  value,
  color,
  sub,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  sub: string;
  icon: string;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: '46%',
        minWidth: 140,
        maxWidth: '100%',
        backgroundColor: '#111122',
        borderWidth: 1,
        borderColor: '#1e1e30',
        borderRadius: 12,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
        <Text style={{ fontSize: 20, fontWeight: '800', color }}>{value}</Text>
      </View>
      <Text style={{ color: '#888', fontSize: 12, marginTop: 6, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: '#444', fontSize: 11, marginTop: 2 }}>{sub}</Text>
    </View>
  );
}

function EquityChart({ data, color, width }: { data: number[]; color: string; width: number }) {
  const h = 120;
  const w = Math.max(280, Math.min(width - 48, 600));
  const min = Math.min(0, ...data);
  const max = Math.max(0, ...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1 || 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');
  const zeroY = h - ((0 - min) / range) * h;
  const polyPts = `0,${h} ${pts} ${w},${h}`;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Defs>
        <LinearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="#333" strokeWidth={1} strokeDasharray="4,4" />
      <Polygon points={polyPts} fill="url(#eq-grad)" />
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} />
    </Svg>
  );
}

function CalendarHeatmap({ trades }: { trades: Trade[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const dayPnl: Record<number, number> = {};
  trades.forEach((t) => {
    const sec = tsSeconds(t.closedAt);
    if (sec == null) return;
    const d = new Date(sec * 1000);
    if (d.getFullYear() === year && d.getMonth() === month) {
      dayPnl[d.getDate()] = (dayPnl[d.getDate()] ?? 0) + (t.pnl || 0);
    }
  });

  const header = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<View key={`e${i}`} style={{ flex: 1, minWidth: '12%' }} />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const pnl = dayPnl[d];
    const isToday = d === now.getDate();
    const opacity = pnl === undefined ? 0 : Math.min(0.9, 0.2 + Math.abs(pnl) / 500);
    cells.push(
      <View
        key={d}
        style={{
          flex: 1,
          minWidth: '12%',
          margin: 1,
          borderRadius: 4,
          padding: 4,
          minHeight: 36,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            pnl === undefined ? '#1a1a2e' : pnl > 0 ? `rgba(38,222,129,${opacity})` : `rgba(255,71,87,${opacity})`,
          borderWidth: isToday ? 1 : 0,
          borderColor: '#f0b90b',
        }}
      >
        <Text style={{ fontSize: 10, color: pnl !== undefined ? '#fff' : '#444' }}>{d}</Text>
        {pnl !== undefined ? (
          <Text style={{ fontSize: 8, color: '#fff' }}>
            {pnl > 0 ? '+' : ''}
            {pnl.toFixed(0)}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {header.map((d) => (
          <View key={d} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 }}>
            <Text style={{ fontSize: 10, color: '#555' }}>{d}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{cells}</View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 11, color: '#555' }}>🟢 Profit day</Text>
        <Text style={{ fontSize: 11, color: '#555' }}>🔴 Loss day</Text>
        <Text style={{ fontSize: 11, color: '#555' }}>⬛ No trades</Text>
      </View>
    </View>
  );
}

function SkeletonRows() {
  return (
    <View style={{ gap: 8, marginTop: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            height: 36,
            borderRadius: 6,
            backgroundColor: '#1a1a2e',
            opacity: 0.8,
          }}
        />
      ))}
    </View>
  );
}

const RANGE_MS: Record<string, number> = {
  '1D': 86400000,
  '1W': 86400000 * 7,
  '1M': 86400000 * 30,
  '3M': 86400000 * 90,
  ALL: Number.MAX_SAFE_INTEGER,
};

export default function Dashboard() {
  const router = useRouter();
  const firebaseUser = useProfileStore((s) => s.firebaseUser);
  const { width } = useWindowDimensions();

  const [trades, setTrades] = useState<Trade[]>([]);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMarket, setActiveMarket] = useState('all');
  const [equityRange, setEquityRange] = useState('1M');

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !auth?.currentUser?.uid) {
      setLoading(false);
      return;
    }
    const uid = auth.currentUser.uid;
    const q = query(
      collection(db, 'trades'),
      where('uid', '==', uid),
      orderBy('openedAt', 'desc'),
      limit(500)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trade);
        setTrades(all.filter((t) => t.status === 'closed'));
        setOpenTrades(all.filter((t) => t.status === 'open'));
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const filteredClosed = useMemo(() => {
    const base =
      activeMarket === 'all' ? trades : trades.filter((t) => t.market === activeMarket);
    const cutoff = Date.now() - (RANGE_MS[equityRange] ?? RANGE_MS['1M']);
    return base.filter((t) => {
      const sec = tsSeconds(t.closedAt);
      if (sec == null) return false;
      return sec * 1000 >= cutoff;
    });
  }, [trades, activeMarket, equityRange]);

  const filteredTrades =
    activeMarket === 'all' ? trades : trades.filter((t) => t.market === activeMarket);

  const totalRealized = filteredTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  const totalUnrealized = openTrades
    .filter((t) => activeMarket === 'all' || t.market === activeMarket)
    .reduce((s, t) => s + (t.pnl || 0), 0);
  const winRate = filteredTrades.length
    ? ((filteredTrades.filter((t) => t.pnl > 0).length / filteredTrades.length) * 100).toFixed(1)
    : '0.0';
  const bestTrade = filteredTrades.reduce(
    (b, t) => (t.pnl > (b?.pnl ?? -Infinity) ? t : b),
    null as Trade | null
  );
  const worstTrade = filteredTrades.reduce(
    (w, t) => (t.pnl < (w?.pnl ?? Infinity) ? t : w),
    null as Trade | null
  );
  const avgHold = filteredTrades.length
    ? Math.round(
        filteredTrades
          .filter((t) => t.closedAt && t.openedAt)
          .reduce((s, t) => {
            const c = tsSeconds(t.closedAt as Timestamp);
            const o = tsSeconds(t.openedAt as Timestamp);
            if (c == null || o == null) return s;
            return s + (c - o) / 60;
          }, 0) / filteredTrades.length
      )
    : 0;

  const marketPnls: MarketPnl[] = Object.keys(MARKET_META).map((m) => ({
    market: m,
    flag: MARKET_META[m].flag,
    currency: MARKET_META[m].currency,
    pnl: trades.filter((t) => t.market === m).reduce((s, t) => s + (t.pnl || 0), 0),
    trades: trades.filter((t) => t.market === m).length,
  }));

  const equityData = useMemo(() => {
    const sorted = [...filteredClosed].sort((a, b) => {
      const sa = tsSeconds(a.closedAt as Timestamp) ?? 0;
      const sb = tsSeconds(b.closedAt as Timestamp) ?? 0;
      return sa - sb;
    });
    let cum = 0;
    return sorted.map((t) => {
      cum += t.pnl || 0;
      return cum;
    });
  }, [filteredClosed]);

  const fmtPnl = (v: number, currency = 'USD') => {
    const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sym = currency === 'USD' ? '$' : currency === 'INR' ? '₹' : '';
    return `${v >= 0 ? '+' : '-'}${sym}${abs}`;
  };

  const recentTrades = [...filteredTrades].slice(0, 8);

  const greetingName = firebaseUser?.displayName?.split(' ')[0] ?? 'Trader';
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const chipList = [
    { key: 'all', label: 'ALL', flag: '🏆' },
    ...Object.entries(MARKET_META).map(([k, v]) => ({
      key: k,
      label: k.toUpperCase().slice(0, 3),
      flag: v.flag,
    })),
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0a0a14' }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>
            Good {greeting},{' '}
            <Text style={{ color: '#f0b90b' }}>{greetingName}</Text> 👋
          </Text>
          <Text style={{ fontSize: 13, color: '#555', marginTop: 4 }}>Here's your trading overview</Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#0d2a0d',
            borderWidth: 1,
            borderColor: '#26de81',
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 4,
          }}
        >
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#26de81' }} />
          <Text style={{ color: '#26de81', fontSize: 12, fontWeight: '700' }}>LIVE</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {chipList.map((m) => (
            <Pressable
              key={m.key}
              onPress={() => setActiveMarket(m.key)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: activeMarket === m.key ? '#f0b90b' : '#2a2a3e',
                backgroundColor: activeMarket === m.key ? '#f0b90b22' : '#111122',
              }}
            >
              <Text style={{ color: activeMarket === m.key ? '#f0b90b' : '#888', fontSize: 12, fontWeight: '600' }}>
                {m.flag} {m.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <KpiCard
          label="Realized P&L"
          value={fmtPnl(totalRealized)}
          color={totalRealized >= 0 ? '#26de81' : '#ff4757'}
          sub="Closed trades"
          icon="💰"
        />
        <KpiCard
          label="Unrealized P&L"
          value={fmtPnl(totalUnrealized)}
          color={totalUnrealized >= 0 ? '#26de81' : '#ff4757'}
          sub="Open positions"
          icon="📈"
        />
        <KpiCard label="Win Rate" value={`${winRate}%`} color="#f0b90b" sub={`${filteredTrades.length} trades`} icon="🎯" />
        <KpiCard
          label="Open Positions"
          value={String(openTrades.filter((t) => activeMarket === 'all' || t.market === activeMarket).length)}
          color="#4dabf7"
          sub="Currently open"
          icon="⚡"
        />
        <KpiCard
          label="Best Trade"
          value={bestTrade ? fmtPnl(bestTrade.pnl) : '—'}
          color="#26de81"
          sub={bestTrade?.symbol ?? 'No trades yet'}
          icon="🚀"
        />
        <KpiCard
          label="Worst Trade"
          value={worstTrade ? fmtPnl(worstTrade.pnl) : '—'}
          color="#ff4757"
          sub={worstTrade?.symbol ?? 'No trades yet'}
          icon="📉"
        />
        <KpiCard label="Total Trades" value={String(filteredTrades.length)} color="#a55eea" sub="All time" icon="📊" />
        <KpiCard
          label="Avg Hold Time"
          value={avgHold < 60 ? `${avgHold}m` : `${Math.round(avgHold / 60)}h`}
          color="#fd9644"
          sub="Per trade"
          icon="⏱️"
        />
      </View>

      <View style={{ gap: 16, marginBottom: 16 }}>
        <View style={{ backgroundColor: '#111122', borderWidth: 1, borderColor: '#1e1e30', borderRadius: 12, padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#e0e0e0' }}>📈 Equity Curve</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {(['1D', '1W', '1M', '3M', 'ALL'] as const).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setEquityRange(r)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: equityRange === r ? '#f0b90b' : '#2a2a3e',
                    backgroundColor: equityRange === r ? '#f0b90b22' : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 11, color: equityRange === r ? '#f0b90b' : '#555', fontWeight: '600' }}>{r}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {equityData.length > 1 ? (
            <EquityChart
              data={equityData}
              color={totalRealized >= 0 ? '#26de81' : '#ff4757'}
              width={width}
            />
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
              <Text style={{ fontSize: 32 }}>📊</Text>
              <Text style={{ color: '#444', fontSize: 13 }}>Close trades to build your equity curve</Text>
            </View>
          )}
        </View>

        <View style={{ backgroundColor: '#111122', borderWidth: 1, borderColor: '#1e1e30', borderRadius: 12, padding: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#e0e0e0', marginBottom: 12 }}>🌍 Market Breakdown</Text>
          {marketPnls.map((m) => (
            <View
              key={m.market}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 8,
                marginBottom: 8,
                borderRadius: 8,
                backgroundColor: '#0d0d1a',
                borderWidth: 1,
                borderColor: '#1a1a2e',
              }}
            >
              <Text style={{ fontSize: 20 }}>{m.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#e0e0e0', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>{m.market}</Text>
                <Text style={{ color: '#666', fontSize: 11 }}>{m.trades} trades</Text>
              </View>
              <MiniSparkline
                data={trades.filter((t) => t.market === m.market).map((t) => t.pnl)}
                color={m.pnl >= 0 ? '#26de81' : '#ff4757'}
              />
              <Text
                style={{
                  color: m.pnl >= 0 ? '#26de81' : '#ff4757',
                  fontWeight: '700',
                  fontSize: 13,
                  minWidth: 72,
                  textAlign: 'right',
                }}
              >
                {fmtPnl(m.pnl, m.currency === 'USDT' ? 'USD' : m.currency)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 16 }}>
        <View style={{ backgroundColor: '#111122', borderWidth: 1, borderColor: '#1e1e30', borderRadius: 12, padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#e0e0e0' }}>🕐 Recent Trades</Text>
            <Text style={{ color: '#666', fontSize: 12 }}>{filteredTrades.length} total</Text>
          </View>
          {loading ? (
            <SkeletonRows />
          ) : recentTrades.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
              <Text style={{ fontSize: 32 }}>📭</Text>
              <Text style={{ color: '#444', fontSize: 13 }}>No closed trades yet. Start trading!</Text>
              <Pressable onPress={() => router.push('/(tabs)')} style={{ marginTop: 8 }}>
                <Text style={{ color: T.yellow, fontWeight: '700' }}>Go to Markets</Text>
              </Pressable>
            </View>
          ) : (
            recentTrades.map((t) => (
              <View
                key={t.id}
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: '#111122',
                  gap: 8,
                }}
              >
                <Text style={{ fontWeight: '700', color: '#e0e0e0', flex: 1, minWidth: 80 }}>
                  {t.symbol?.split(':')[1] || t.symbol}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: t.side === 'BUY' ? '#1a3a2a' : '#3a1a1a',
                  }}
                >
                  <Text style={{ color: t.side === 'BUY' ? '#26de81' : '#ff4757', fontSize: 11, fontWeight: '700' }}>{t.side}</Text>
                </View>
                <Text style={{ color: '#aaa', fontSize: 12, flexBasis: '40%' }}>
                  {MARKET_META[t.market]?.flag} {t.market}
                </Text>
                <Text style={{ color: t.pnl >= 0 ? '#26de81' : '#ff4757', fontWeight: '700', flexBasis: '25%' }}>
                  {fmtPnl(t.pnl)}
                </Text>
                <Text style={{ color: '#555', fontSize: 11 }}>
                  {tsSeconds(t.closedAt as Timestamp)
                    ? new Date(tsSeconds(t.closedAt as Timestamp)! * 1000).toLocaleDateString()
                    : '—'}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ backgroundColor: '#111122', borderWidth: 1, borderColor: '#1e1e30', borderRadius: 12, padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#e0e0e0' }}>📅 P&L Calendar</Text>
            <Text style={{ color: '#666', fontSize: 12 }}>This month</Text>
          </View>
          <CalendarHeatmap trades={filteredTrades} />
        </View>
      </View>
    </ScrollView>
  );
}
