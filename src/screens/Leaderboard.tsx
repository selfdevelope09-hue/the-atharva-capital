/**
 * Leaderboard — per-market tabs, real Firebase data, search, user cards, ads.
 *
 * Firestore: leaderboard/{market}/entries/{uid}
 * Ad rules: Video zone at tab top, native banner after every 3 rows.
 */

import { useRouter } from 'expo-router';
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';
import { BannerAd } from '@/src/components/ads/BannerAd';
import { AadsBanner } from '@/src/components/ads/AadsBanner';
import { getOrCreateConversation } from '@/services/firebase/chatRepository';
import { T } from '@/src/constants/theme';
import { useProfileStore } from '@/store/profileStore';
import { useLedgerStore } from '@/store/ledgerStore';

type LBMarket = 'crypto' | 'india' | 'usa' | 'uk' | 'china' | 'japan' | 'australia' | 'germany' | 'canada' | 'switzerland' | 'global';

interface LBEntry {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
  trades: number;
  pnl: number;
  winRate: number;
  market: string;
}

// ── Monetag native banner container ──────────────────────────────────────────
function MonetagBanner({ id }: { id: string }) {
  if (Platform.OS !== 'web') return null;
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
      {/* @ts-ignore */}
      <div
        className="monetag-banner"
        data-zone="232062"
        id={`monetag-lb-${id}`}
        style={{ minHeight: 60, width: '100%' }}
      />
    </View>
  );
}

// ── Monetag Video zone container ─────────────────────────────────────────────
function MonetagVideoZone({ market }: { market: string }) {
  if (Platform.OS !== 'web') return null;
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
      {/* @ts-ignore */}
      <div
        id={`monetag-video-${market}`}
        data-zone="232062"
        data-type="video"
        style={{ minHeight: 90, width: '100%', background: 'transparent' }}
      />
    </View>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ url, name, size = 38 }: { url: string; name: string; size?: number }) {
  const initials = name ? name[0].toUpperCase() : '?';
  if (url && Platform.OS === 'web') {
    return (
      // @ts-ignore
      <img src={url} style={{ width: size, height: size, borderRadius: size / 2, objectFit: 'cover' }} alt={name} />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: T.bg3, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: T.yellow, fontSize: size * 0.38, fontWeight: '800' }}>{initials}</Text>
    </View>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
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

// ── User popup card ───────────────────────────────────────────────────────────
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

  const sym = { crypto: '₮', india: '₹', usa: '$', uk: '£', china: '¥', japan: '¥', australia: 'A$', germany: '€', canada: 'C$', switzerland: 'Fr.' }[market] ?? '$';

  return (
    <View style={{
      backgroundColor: T.bg1, borderRadius: T.radiusLg, padding: 20,
      borderWidth: 1, borderColor: T.border, margin: 20,
      shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Avatar url={entry.photoURL} name={entry.displayName} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.text0, fontSize: 17, fontWeight: '800' }}>{entry.displayName}</Text>
          {entry.bio ? <Text style={{ color: T.text2, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{entry.bio}</Text> : null}
        </View>
        <Pressable onPress={onClose}><Text style={{ color: T.text3, fontSize: 20 }}>✕</Text></Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Trades', value: String(entry.trades) },
          { label: 'Win Rate', value: `${entry.winRate.toFixed(0)}%`, color: entry.winRate >= 50 ? T.green : T.red },
          { label: 'PnL', value: `${entry.pnl >= 0 ? '+' : ''}${sym}${Math.abs(entry.pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, color: entry.pnl >= 0 ? T.green : T.red },
        ].map((s) => (
          <View key={s.label} style={{ flex: 1, backgroundColor: T.bg2, borderRadius: T.radiusSm, padding: 10, alignItems: 'center' }}>
            <Text style={{ color: s.color ?? T.text0, fontWeight: '800', fontSize: 14 }}>{s.value}</Text>
            <Text style={{ color: T.text3, fontSize: 10, marginTop: 2 }}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {entry.uid !== myUid && (
          <Pressable
            onPress={() => { onClose(); router.push(`/profile/${entry.uid}` as never); }}
            style={{ flex: 1, backgroundColor: T.bg3, borderRadius: T.radiusMd, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: T.border }}
          >
            <Text style={{ color: T.text0, fontWeight: '700', fontSize: 13 }}>👤 View Profile</Text>
          </Pressable>
        )}
        {entry.uid !== myUid && (
          <Pressable
            onPress={handleChat}
            style={{ flex: 1, backgroundColor: T.yellow, borderRadius: T.radiusMd, paddingVertical: 10, alignItems: 'center' }}
          >
            <Text style={{ color: '#000', fontWeight: '800', fontSize: 13 }}>💬 Chat</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Market tab config ─────────────────────────────────────────────────────────
const TABS: { id: LBMarket; label: string; sym: string }[] = [
  { id: 'global', label: '🌍 Global', sym: '$' },
  { id: 'crypto', label: '🌐 Crypto', sym: '₮' },
  { id: 'india', label: '🇮🇳 India', sym: '₹' },
  { id: 'usa', label: '🇺🇸 USA', sym: '$' },
  { id: 'uk', label: '🇬🇧 UK', sym: '£' },
  { id: 'china', label: '🇨🇳 China', sym: '¥' },
  { id: 'japan', label: '🇯🇵 Japan', sym: '¥' },
  { id: 'australia', label: '🇦🇺 ASX', sym: 'A$' },
  { id: 'germany', label: '🇩🇪 XETRA', sym: '€' },
  { id: 'canada', label: '🇨🇦 TSX', sym: 'C$' },
  { id: 'switzerland', label: '🇨🇭 SIX', sym: 'Fr.' },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function Leaderboard() {
  const myUid = auth?.currentUser?.uid ?? '';
  const [tab, setTab] = useState<LBMarket>('global');
  const [entries, setEntries] = useState<LBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userCard, setUserCard] = useState<LBEntry | null>(null);

  const closedTrades = useLedgerStore((s) => s.closedTrades);
  const profile = useProfileStore((s) => s.userData);

  // Build "my" leaderboard entry from local data
  const myEntry = useMemo<LBEntry>(() => {
    const wins = closedTrades.filter((t) => t.realizedPnl > 0).length;
    const total = closedTrades.length;
    const pnl = closedTrades.reduce((s, t) => s + t.realizedPnl, 0);
    return {
      uid: myUid,
      displayName: (profile?.name ?? auth?.currentUser?.displayName ?? 'You'),
      photoURL: profile?.photoURL ?? auth?.currentUser?.photoURL ?? '',
      bio: '',
      trades: total,
      pnl,
      winRate: total > 0 ? (wins / total) * 100 : 0,
      market: tab,
    };
  }, [closedTrades, profile, myUid, tab]);

  // Load leaderboard from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const colPath = tab === 'global' ? 'leaderboard/global/entries' : `leaderboard/${tab}/entries`;
    const q = query(collection(db, colPath), orderBy('pnl', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const rows: LBEntry[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          uid: d.id,
          displayName: (data['displayName'] as string) || (data['name'] as string) || 'Trader',
          photoURL: (data['photoURL'] as string) || '',
          bio: (data['bio'] as string) || '',
          trades: (data['trades'] as number) || 0,
          pnl: (data['pnl'] as number) || 0,
          winRate: (data['winRate'] as number) || 0,
          market: tab,
        };
      });
      // Merge own entry if not present
      const hasMe = rows.some((r) => r.uid === myUid);
      const merged = hasMe ? rows : [myEntry, ...rows];
      setEntries(merged.sort((a, b) => b.pnl - a.pnl));
      setLoading(false);
    }, () => {
      // No data yet — show own entry only
      setEntries([myEntry]);
      setLoading(false);
    });
    return () => unsub();
  }, [tab, myUid, myEntry]);

  const sym = TABS.find((t) => t.id === tab)?.sym ?? '$';

  const filtered = useMemo(() => {
    if (!search) return entries;
    return entries.filter((e) => e.displayName.toLowerCase().includes(search.toLowerCase()));
  }, [entries, search]);

  // Build flat list data with ad slots (every 3 rows)
  const listData = useMemo(() => {
    const items: ({ type: 'row'; entry: LBEntry; rank: number } | { type: 'ad'; id: string })[] = [];
    filtered.forEach((entry, i) => {
      items.push({ type: 'row', entry, rank: i + 1 });
      if ((i + 1) % 3 === 0) {
        items.push({ type: 'ad', id: `ad-${i}` });
      }
    });
    return items;
  }, [filtered]);

  const renderItem = ({ item }: { item: typeof listData[0] }) => {
    if (item.type === 'ad') {
      return <MonetagBanner id={item.id} />;
    }
    const { entry, rank } = item;
    const isMe = entry.uid === myUid;
    const pnlColor = entry.pnl >= 0 ? T.green : T.red;
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
        {/* Rank */}
        <Text style={{ width: 26, textAlign: 'center', color: rankColor, fontWeight: '800', fontSize: rank <= 3 ? 16 : 13 }}>
          {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : String(rank)}
        </Text>

        {/* Avatar */}
        <Avatar url={entry.photoURL} name={entry.displayName} size={36} />

        {/* Name + trades */}
        <View style={{ flex: 1 }}>
          <Text style={{ color: isMe ? T.yellow : T.text0, fontWeight: isMe ? '800' : '600', fontSize: 13 }} numberOfLines={1}>
            {entry.displayName}{isMe ? ' (You)' : ''}
          </Text>
          <Text style={{ color: T.text3, fontSize: 11, marginTop: 1 }}>{entry.trades} trades · {entry.winRate.toFixed(0)}% win</Text>
        </View>

        {/* PnL */}
        <Text style={{ color: pnlColor, fontWeight: '800', fontSize: 13, fontFamily: T.fontMono }}>
          {entry.pnl >= 0 ? '+' : ''}{sym}{Math.abs(entry.pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      {/* ── AADS Banner below header ── */}
      <AadsBanner />

      {/* ── Header ── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: T.text0, fontSize: 22, fontWeight: '800' }}>🏆 Leaderboard</Text>
        <Text style={{ color: T.text2, fontSize: 12, marginTop: 2 }}>Realized P&L only · Updated live</Text>
      </View>

      {/* ── Search ── */}
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

      {/* ── Market tabs ── */}
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
              onPress={() => setTab(t.id)}
              style={{
                paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: 20,
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

      {/* ── Monetag Video Zone (top of each tab) ── */}
      <MonetagVideoZone market={tab} />

      {/* ── Table header ── */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.border }}>
        <Text style={{ width: 26, color: T.text3, fontSize: 10, fontWeight: '700' }}>#</Text>
        <Text style={{ width: 36, color: T.text3, fontSize: 10, fontWeight: '700', marginLeft: 12 }}></Text>
        <Text style={{ flex: 1, color: T.text3, fontSize: 10, fontWeight: '700', marginLeft: 12 }}>TRADER</Text>
        <Text style={{ color: T.text3, fontSize: 10, fontWeight: '700' }}>PROFIT/LOSS</Text>
      </View>

      {/* ── List ── */}
      {loading ? (
        <View>{[0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}</View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.type === 'row' ? item.entry.uid : item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ color: T.text2, fontSize: 15 }}>
                {search ? 'No traders match your search.' : 'No data yet. Start trading!'}
              </Text>
            </View>
          }
        />
      )}

      {/* ── User card modal ── */}
      <Modal visible={!!userCard} transparent animationType="fade" onRequestClose={() => setUserCard(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center' }}
          onPress={() => setUserCard(null)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {userCard && (
              <UserCard entry={userCard} onClose={() => setUserCard(null)} market={tab} />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
