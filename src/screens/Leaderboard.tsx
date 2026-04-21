/**
 * Leaderboard — per-market tabs, real Firebase data, search, user cards, ads.
 * All ad injection done via useEffect DOM APIs (no raw HTML JSX).
 *
 * Firestore: leaderboard/{market}/entries/{uid}
 * Ad rules: Video zone at tab top, native banner after every 3 rows.
 */

import { useRouter } from 'expo-router';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';
import { AadsAdaptiveBanner } from '@/src/components/ads/AadsAdaptiveBanner';
import { MonetagBanner } from '@/src/components/ads/MonetagBanner';
import { getOrCreateConversation } from '@/services/firebase/chatRepository';
import { T } from '@/src/constants/theme';
import { useProfileStore } from '@/store/profileStore';
import { useLedgerStore } from '@/store/ledgerStore';

/** Firestore: leaderboard/{crypto|forex|stocks|commodities}/entries/{uid} */
type LBMarket = 'crypto' | 'forex' | 'stocks' | 'commodities';

interface LBEntry {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
  trades: number;
  pnl: number;
  winRate: number;
}

// ── Inline ad banner (AADS) between leaderboard rows ─────────────────────────
function InlineBanner({ slotId }: { slotId: string }) {
  const ref = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const node = ref.current as unknown as HTMLElement | null;
    if (!node) return;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-aa', '2435144');
    iframe.src = `//acceptable.a-ads.com/2435144/?size=Adaptive&t=${Date.now() + Math.random()}`;
    iframe.style.cssText = 'border:0;width:100%;height:60px;overflow:hidden;display:block;pointer-events:auto';
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
    node.appendChild(iframe);
    return () => { try { node.removeChild(iframe); } catch { /* ignore */ } };
  }, [slotId]);

  if (Platform.OS !== 'web') return null;
  return <View ref={ref} style={{ width: '100%', height: 60, marginVertical: 4 }} />;
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ url, name, size = 38 }: { url: string; name: string; size?: number }) {
  const initials = name ? name[0].toUpperCase() : '?';
  const [imgError, setImgError] = useState(false);

  if (url && !imgError) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: T.bg3, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: T.yellow, fontSize: size * 0.38, fontWeight: '800' }}>{initials}</Text>
    </View>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
      <View style={{ width: 32, height: 32, borderRadius: 4, backgroundColor: T.bg2 }} />
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: T.bg2 }} />
      <View style={{ flex: 1, gap: 5 }}>
        <View style={{ width: '55%', height: 12, borderRadius: 4, backgroundColor: T.bg2 }} />
        <View style={{ width: '30%', height: 10, borderRadius: 4, backgroundColor: T.bg2 }} />
      </View>
      <View style={{ width: 70, height: 16, borderRadius: 4, backgroundColor: T.bg2 }} />
    </View>
  );
}

// ── User card popup ────────────────────────────────────────────────────────────
function UserCard({ entry, onClose, market }: { entry: LBEntry; onClose: () => void; market: string }) {
  const router = useRouter();
  const myUid = auth?.currentUser?.uid ?? '';

  const handleChat = async () => {
    onClose();
    try {
      const convId = await getOrCreateConversation(entry.uid);
      router.push(`/chats/${convId}?otherUid=${entry.uid}` as never);
    } catch { /* silently skip */ }
  };

  const symMap: Record<string, string> = {
    crypto: '₮', forex: '$', stocks: '$', commodities: '$',
  };
  const sym = symMap[market] ?? '$';

  return (
    <View style={{
      backgroundColor: T.bg1, borderRadius: T.radiusLg, padding: 20,
      borderWidth: 1, borderColor: T.border, margin: 20,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Avatar url={entry.photoURL} name={entry.displayName} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.text0, fontSize: 17, fontWeight: '800' }}>{entry.displayName}</Text>
          {!!entry.bio && (
            <Text style={{ color: T.text2, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{entry.bio}</Text>
          )}
        </View>
        <Pressable onPress={onClose}>
          <Text style={{ color: T.text3, fontSize: 22 }}>✕</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Trades', value: String(entry.trades), color: T.text0 },
          { label: 'Win Rate', value: `${entry.winRate.toFixed(0)}%`, color: entry.winRate >= 50 ? T.green : T.red },
          { label: 'PnL', value: `${entry.pnl >= 0 ? '+' : ''}${sym}${Math.abs(entry.pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, color: entry.pnl >= 0 ? T.green : T.red },
        ].map((s) => (
          <View key={s.label} style={{ flex: 1, backgroundColor: T.bg2, borderRadius: T.radiusSm, padding: 10, alignItems: 'center' }}>
            <Text style={{ color: s.color, fontWeight: '800', fontSize: 14 }}>{s.value}</Text>
            <Text style={{ color: T.text3, fontSize: 10, marginTop: 2 }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {entry.uid !== myUid && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => { onClose(); router.push(`/profile/${entry.uid}` as never); }}
            style={{ flex: 1, backgroundColor: T.bg3, borderRadius: T.radiusMd, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: T.border }}
          >
            <Text style={{ color: T.text0, fontWeight: '700', fontSize: 13 }}>👤 View Profile</Text>
          </Pressable>
          <Pressable
            onPress={handleChat}
            style={{ flex: 1, backgroundColor: T.yellow, borderRadius: T.radiusMd, paddingVertical: 10, alignItems: 'center' }}
          >
            <Text style={{ color: '#000', fontWeight: '800', fontSize: 13 }}>💬 Chat</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Category tabs (Firestore paths) ────────────────────────────────────────────
const TABS: { id: LBMarket; label: string }[] = [
  { id: 'crypto', label: '🌐 Crypto' },
  { id: 'forex', label: '💱 Forex' },
  { id: 'stocks', label: '📈 Stocks' },
  { id: 'commodities', label: '🛢 Commodities' },
];

const SYM_MAP: Record<string, string> = {
  crypto: '₮', forex: '$', stocks: '$', commodities: '$',
};

function closedTradesForTab(
  tab: LBMarket,
  trades: import('@/types/ledger').LedgerClosedTrade[],
): import('@/types/ledger').LedgerClosedTrade[] {
  if (tab === 'crypto') return trades.filter((t) => t.market === 'crypto');
  if (tab === 'stocks') return trades.filter((t) => t.market !== 'crypto');
  return [];
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Leaderboard() {
  const myUid = auth?.currentUser?.uid ?? '';
  const [tab, setTab] = useState<LBMarket>('crypto');
  const [entries, setEntries] = useState<LBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userCard, setUserCard] = useState<LBEntry | null>(null);

  const closedTrades = useLedgerStore((s) => s.closedTrades);
  const firebaseUser = useProfileStore((s) => s.firebaseUser);

  const myEntry = useMemo<LBEntry>(() => {
    const subset = closedTradesForTab(tab, closedTrades);
    const wins = subset.filter((t) => t.realizedPnl > 0).length;
    const total = subset.length;
    const pnl = subset.reduce((sum, t) => sum + t.realizedPnl, 0);
    const currentUser = auth?.currentUser;
    return {
      uid: myUid,
      displayName: firebaseUser?.displayName ?? currentUser?.displayName ?? 'You',
      photoURL: firebaseUser?.photoURL ?? currentUser?.photoURL ?? '',
      bio: '',
      trades: total,
      pnl,
      winRate: total > 0 ? (wins / total) * 100 : 0,
    };
  }, [closedTrades, firebaseUser, myUid, tab]);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      setEntries([myEntry]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const colPath = `leaderboard/${tab}/entries`;
    const q = query(collection(db, colPath), orderBy('pnl', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const rows: LBEntry[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          uid: d.id,
          displayName: (data['displayName'] as string) || 'Trader',
          photoURL: (data['photoURL'] as string) || '',
          bio: (data['bio'] as string) || '',
          trades: (data['trades'] as number) || 0,
          pnl: (data['pnl'] as number) || 0,
          winRate: (data['winRate'] as number) || 0,
        };
      });
      const hasMe = rows.some((r) => r.uid === myUid);
      const merged = hasMe ? rows : (myUid ? [myEntry, ...rows] : rows);
      setEntries(merged.sort((a, b) => b.pnl - a.pnl));
      setLoading(false);
    }, () => {
      setEntries(myUid ? [myEntry] : []);
      setLoading(false);
    });
    return () => unsub();
  }, [tab, myUid, myEntry]);

  const sym = SYM_MAP[tab] ?? '$';

  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) => e.displayName.toLowerCase().includes(q));
  }, [entries, search]);

  // Build flat list data with ad slots (every 3 rows)
  type ListItem = { type: 'row'; entry: LBEntry; rank: number } | { type: 'ad'; id: string };
  const listData = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];
    filtered.forEach((entry, i) => {
      items.push({ type: 'row', entry, rank: i + 1 });
      if ((i + 1) % 3 === 0) items.push({ type: 'ad', id: `ad-${tab}-${i}` });
    });
    return items;
  }, [filtered, tab]);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'ad') {
      return <InlineBanner slotId={item.id} />;
    }
    const { entry, rank } = item;
    const isMe = entry.uid === myUid;
    const pnlColor = entry.pnl >= 0 ? T.green : T.red;
    const rankLabel = rank <= 3 ? (['🥇', '🥈', '🥉'] as const)[rank - 1] : String(rank);
    const rankColor = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : T.text3;

    return (
      <Pressable
        onPress={() => setUserCard(entry)}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingHorizontal: 16, paddingVertical: 11,
          backgroundColor: isMe ? `${T.yellow}12` : pressed ? T.bg2 : 'transparent',
          borderBottomWidth: 1, borderBottomColor: T.bg2,
          borderLeftWidth: isMe ? 3 : 0, borderLeftColor: T.yellow,
        })}
      >
        <Text style={{ width: 26, textAlign: 'center', color: rankColor, fontWeight: '800', fontSize: rank <= 3 ? 16 : 13 }}>
          {rankLabel}
        </Text>
        <Avatar url={entry.photoURL} name={entry.displayName} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: isMe ? T.yellow : T.text0, fontWeight: isMe ? '800' : '600', fontSize: 13 }} numberOfLines={1}>
            {entry.displayName}{isMe ? ' (You)' : ''}
          </Text>
          <Text style={{ color: T.text3, fontSize: 11, marginTop: 1 }}>
            {entry.trades} trades · {entry.winRate.toFixed(0)}% win
          </Text>
        </View>
        <Text style={{ color: pnlColor, fontWeight: '800', fontSize: 13, fontFamily: T.fontMono }}>
          {entry.pnl >= 0 ? '+' : ''}{sym}{Math.abs(entry.pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      {/* A-ADS below title strip (non-intrusive) */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <AadsAdaptiveBanner widthPct={100} />
      </View>

      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: T.text0, fontSize: 22, fontWeight: '800' }}>🏆 Leaderboard</Text>
        <Text style={{ color: T.text2, fontSize: 12, marginTop: 2 }}>Realized P&L only · Updated live</Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search traders…"
          placeholderTextColor={T.text3}
          style={{
            backgroundColor: T.bg1, borderRadius: T.radiusMd, paddingHorizontal: 14, paddingVertical: 10,
            color: T.text0, fontSize: 14, borderWidth: 1, borderColor: T.border,
          }}
        />
      </View>

      {/* Market tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingBottom: 8 }}
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Pressable
              key={t.id}
              onPress={() => { setTab(t.id); setSearch(''); }}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                backgroundColor: active ? T.yellow : T.bg2,
                borderWidth: active ? 0 : 1, borderColor: T.border,
              }}
            >
              <Text style={{ color: active ? '#000' : T.text1, fontWeight: active ? '800' : '600', fontSize: 12 }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Video / native zone (Monetag placeholder — no popunder scripts) */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ color: T.text3, fontSize: 9, marginBottom: 4 }}>ADVERTISEMENT</Text>
        <MonetagBanner variant="video" />
      </View>

      {/* Table header */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.border }}>
        <Text style={{ width: 26, color: T.text3, fontSize: 10, fontWeight: '700' }}>#</Text>
        <View style={{ width: 36, marginLeft: 12 }} />
        <Text style={{ flex: 1, color: T.text3, fontSize: 10, fontWeight: '700', marginLeft: 12 }}>TRADER</Text>
        <Text style={{ color: T.text3, fontSize: 10, fontWeight: '700' }}>PROFIT/LOSS</Text>
      </View>

      {loading ? (
        <View>{[0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}</View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.type === 'row' ? `row-${item.entry.uid}` : item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ color: T.text2, fontSize: 15 }}>
                {search ? 'No traders match.' : 'Be the first to trade!'}
              </Text>
            </View>
          }
        />
      )}

      {/* User card modal */}
      <Modal visible={!!userCard} transparent animationType="fade" onRequestClose={() => setUserCard(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center' }}
          onPress={() => setUserCard(null)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {userCard && <UserCard entry={userCard} onClose={() => setUserCard(null)} market={tab} />}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
