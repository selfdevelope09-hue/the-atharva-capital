/**
 * Leaderboard — aggregates closed `trades` by market tab; search; profile popup; Monetag placeholders.
 */

import { useRouter } from 'expo-router';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';

interface LeaderUser {
  uid: string;
  displayName: string;
  photoURL?: string;
  totalTrades: number;
  winRate: number;
  pnl: number;
  rank?: number;
}

const TABS = [
  { key: 'crypto', label: 'Crypto', icon: '🌐', currency: 'USDT', color: '#f0b90b' },
  { key: 'forex', label: 'Forex', icon: '💱', currency: 'USD', color: '#4dabf7' },
  { key: 'stocks', label: 'Stocks', icon: '📈', currency: 'USD', color: '#26de81' },
  { key: 'commodities', label: 'Commodities', icon: '🏅', currency: 'USD', color: '#fd9644' },
];

const MEDAL = ['🥇', '🥈', '🥉'];

function displayNameFromUserDoc(d: Record<string, unknown>): string {
  return (
    (d.displayName as string) ||
    (d.username as string) ||
    (d.name as string) ||
    (d.gmailName as string) ||
    'Anonymous'
  );
}

export default function Leaderboard() {
  const router = useRouter();
  const myUid = auth?.currentUser?.uid ?? '';
  const [tab, setTab] = useState('crypto');
  const [users, setUsers] = useState<LeaderUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<LeaderUser | null>(null);

  const activeTab = TABS.find((t) => t.key === tab)!;

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'trades'),
      where('market', '==', tab),
      where('status', '==', 'closed')
    );
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const byUser: Record<string, { pnl: number; trades: number; wins: number }> = {};
        snap.docs.forEach((d) => {
          const t = d.data() as { uid?: string; pnl?: number };
          const uid = t.uid;
          if (!uid) return;
          if (!byUser[uid]) byUser[uid] = { pnl: 0, trades: 0, wins: 0 };
          byUser[uid].pnl += t.pnl || 0;
          byUser[uid].trades += 1;
          if ((t.pnl || 0) > 0) byUser[uid].wins += 1;
        });

        const uids = Object.keys(byUser);
        if (uids.length === 0) {
          setUsers([]);
          setLoading(false);
          return;
        }

        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          const profiles: Record<string, Record<string, unknown>> = {};
          usersSnap.forEach((d) => {
            profiles[d.id] = d.data() as Record<string, unknown>;
          });

          const ranked = uids
            .map((uid) => ({
              uid,
              displayName: displayNameFromUserDoc(profiles[uid] ?? {}),
              photoURL: (profiles[uid]?.photoURL as string) || '',
              totalTrades: byUser[uid].trades,
              winRate:
                byUser[uid].trades > 0 ? Math.round((byUser[uid].wins / byUser[uid].trades) * 100) : 0,
              pnl: byUser[uid].pnl,
            }))
            .sort((a, b) => b.pnl - a.pnl)
            .map((u, i) => ({ ...u, rank: i + 1 }));

          setUsers(ranked);
        } catch {
          setUsers([]);
        } finally {
          setLoading(false);
        }
      },
      () => {
        setUsers([]);
        setLoading(false);
      }
    );
    return unsub;
  }, [tab]);

  const filtered = users.filter((u) => u.displayName.toLowerCase().includes(search.toLowerCase()));

  const handleOpenChat = (uid: string) => {
    router.push(`/chats?with=${encodeURIComponent(uid)}` as never);
  };

  const fmtPnl = (v: number) => {
    const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${v >= 0 ? '+' : '-'}$${abs}`;
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0a0a14' }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff' }}>🏆 Leaderboard</Text>
          <Text style={{ fontSize: 13, color: '#555', marginTop: 4 }}>Realized P&L only · Updated live</Text>
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

      <View style={{ position: 'relative', marginBottom: 16 }}>
        <Text style={{ position: 'absolute', left: 14, top: 14, fontSize: 16, zIndex: 1 }}>🔍</Text>
        <TextInput
          style={{
            paddingLeft: 42,
            paddingRight: search ? 36 : 14,
            paddingVertical: 12,
            backgroundColor: '#111122',
            borderWidth: 1,
            borderColor: '#2a2a3e',
            borderRadius: 12,
            color: '#fff',
            fontSize: 14,
          }}
          placeholder="Search traders by name..."
          placeholderTextColor="#666"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <Pressable
            onPress={() => setSearch('')}
            style={{ position: 'absolute', right: 12, top: 12 }}
            hitSlop={8}
          >
            <Text style={{ color: '#666', fontSize: 16 }}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: tab === t.key ? t.color : '#2a2a3e',
              backgroundColor: tab === t.key ? `${t.color}15` : '#111122',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: tab === t.key ? '700' : '600', color: tab === t.key ? t.color : '#666' }}>
              {t.icon} {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 10, color: '#333', textAlign: 'right', marginBottom: 4 }}>Advertisement</Text>
        <View
          nativeID="monetag-video-leaderboard"
          style={{
            minHeight: 90,
            backgroundColor: '#0d0d1a',
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#333', fontSize: 12 }}> </Text>
        </View>
      </View>

      <View style={{ backgroundColor: '#111122', borderWidth: 1, borderColor: '#1e1e30', borderRadius: 14, overflow: 'hidden' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#1e1e30',
          }}
        >
          <Text style={{ width: 40, textAlign: 'center', color: '#555', fontSize: 12, fontWeight: '600' }}>#</Text>
          <Text style={{ flex: 1, color: '#555', fontSize: 12, fontWeight: '600' }}>Trader</Text>
          <Text style={{ width: 72, textAlign: 'center', color: '#555', fontSize: 12, fontWeight: '600' }}>Trades</Text>
          <Text style={{ width: 56, textAlign: 'center', color: '#555', fontSize: 12, fontWeight: '600' }}>Win %</Text>
          <Text style={{ width: 100, textAlign: 'right', color: '#555', fontSize: 12, fontWeight: '600' }}>
            P&L ({activeTab.currency})
          </Text>
        </View>

        {loading ? (
          <View style={{ padding: 12, gap: 8 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={{ height: 60, borderRadius: 10, backgroundColor: '#1a1a2e' }} />
            ))}
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 48, gap: 10 }}>
            <Text style={{ fontSize: 40 }}>🏜️</Text>
            <Text style={{ color: '#444', fontSize: 14, textAlign: 'center' }}>
              {search ? 'No traders match your search' : 'No traders yet. Be the first!'}
            </Text>
          </View>
        ) : (
          filtered.map((user, idx) => (
            <React.Fragment key={user.uid}>
              {idx > 0 && idx % 3 === 0 ? (
                <View
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    backgroundColor: '#0d0d1a',
                    borderBottomWidth: 1,
                    borderBottomColor: '#1a1a2e',
                  }}
                >
                  <Text style={{ fontSize: 11, color: '#444', textAlign: 'center' }}>Sponsored</Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => setSelectedUser(user)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: '#0d0d1a',
                  backgroundColor: user.uid === myUid ? '#1a1a0a' : 'transparent',
                  borderLeftWidth: user.rank && user.rank <= 3 ? 3 : 0,
                  borderLeftColor: user.rank === 1 ? '#f0b90b' : user.rank === 2 ? '#aaa' : '#cd7f32',
                }}
              >
                <View style={{ width: 40, alignItems: 'center' }}>
                  {user.rank && user.rank <= 3 ? (
                    <Text style={{ fontSize: 18 }}>{MEDAL[user.rank - 1]}</Text>
                  ) : (
                    <Text style={{ color: '#555', fontSize: 13 }}>#{user.rank}</Text>
                  )}
                </View>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ position: 'relative' }}>
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: '#1a1a2e',
                        borderWidth: 2,
                        borderColor: '#2a2a3e',
                        overflow: 'hidden',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {user.photoURL ? (
                        <Image source={{ uri: user.photoURL }} style={{ width: 42, height: 42 }} />
                      ) : (
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#f0b90b' }}>
                          {user.displayName[0]?.toUpperCase()}
                        </Text>
                      )}
                    </View>
                    {user.uid === myUid ? (
                      <View
                        style={{
                          position: 'absolute',
                          bottom: -2,
                          right: -2,
                          backgroundColor: '#f0b90b',
                          paddingHorizontal: 4,
                          borderRadius: 4,
                        }}
                      >
                        <Text style={{ fontSize: 8, fontWeight: '800', color: '#000' }}>You</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#e0e0e0', fontWeight: '700', fontSize: 14 }}>{user.displayName}</Text>
                    <Text style={{ color: '#555', fontSize: 11 }}>Tap for profile & chat</Text>
                  </View>
                </View>
                <Text style={{ width: 72, textAlign: 'center', color: '#aaa', fontSize: 13 }}>{user.totalTrades}</Text>
                <View style={{ width: 56, alignItems: 'center' }}>
                  <Text
                    style={{
                      color: user.winRate >= 50 ? '#26de81' : '#ff4757',
                      fontWeight: '600',
                      fontSize: 13,
                    }}
                  >
                    {user.winRate}%
                  </Text>
                </View>
                <Text
                  style={{
                    width: 100,
                    textAlign: 'right',
                    fontWeight: '800',
                    fontSize: 15,
                    color: user.pnl >= 0 ? '#26de81' : '#ff4757',
                  }}
                >
                  {fmtPnl(user.pnl)}
                </Text>
              </Pressable>
            </React.Fragment>
          ))
        )}
      </View>

      <Modal visible={!!selectedUser} transparent animationType="fade" onRequestClose={() => setSelectedUser(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setSelectedUser(null)}>
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: '#151528',
              borderWidth: 1,
              borderColor: '#2a2a3e',
              borderRadius: 20,
              padding: 28,
              width: '100%',
              maxWidth: 360,
              alignItems: 'center',
            }}
          >
            <Pressable onPress={() => setSelectedUser(null)} style={{ position: 'absolute', top: 12, right: 12, padding: 8 }} hitSlop={12}>
              <Text style={{ color: '#555', fontSize: 18 }}>✕</Text>
            </Pressable>
            {selectedUser ? (
              <>
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: '#1a1a2e',
                    borderWidth: 3,
                    borderColor: '#f0b90b',
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  {selectedUser.photoURL ? (
                    <Image source={{ uri: selectedUser.photoURL }} style={{ width: 80, height: 80 }} />
                  ) : (
                    <Text style={{ fontSize: 36, fontWeight: '800', color: '#f0b90b' }}>
                      {selectedUser.displayName[0]?.toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 4 }}>{selectedUser.displayName}</Text>
                {selectedUser.uid === myUid ? (
                  <Text style={{ color: '#f0b90b', fontSize: 13, marginBottom: 12 }}>That&apos;s you! 👋</Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 12, marginVertical: 16, width: '100%' }}>
                  <View style={{ flex: 1, backgroundColor: '#0d0d1a', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1e1e30', alignItems: 'center' }}>
                    <Text style={{ color: '#f0b90b', fontSize: 18, fontWeight: '800' }}>{selectedUser.totalTrades}</Text>
                    <Text style={{ color: '#666', fontSize: 11 }}>Trades</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#0d0d1a', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1e1e30', alignItems: 'center' }}>
                    <Text
                      style={{
                        color: selectedUser.winRate >= 50 ? '#26de81' : '#ff4757',
                        fontSize: 18,
                        fontWeight: '800',
                      }}
                    >
                      {selectedUser.winRate}%
                    </Text>
                    <Text style={{ color: '#666', fontSize: 11 }}>Win Rate</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#0d0d1a', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1e1e30', alignItems: 'center' }}>
                    <Text
                      style={{
                        color: selectedUser.pnl >= 0 ? '#26de81' : '#ff4757',
                        fontSize: 18,
                        fontWeight: '800',
                      }}
                    >
                      {fmtPnl(selectedUser.pnl)}
                    </Text>
                    <Text style={{ color: '#666', fontSize: 11 }}>P&L</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' }}>
                  <Pressable
                    onPress={() => {
                      const u = selectedUser.uid;
                      setSelectedUser(null);
                      router.push(`/profile/${u}` as never);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      backgroundColor: '#f0b90b',
                      borderRadius: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#000', fontWeight: '800', fontSize: 14 }}>👤 View Profile</Text>
                  </Pressable>
                  {selectedUser.uid !== myUid ? (
                    <Pressable
                      onPress={() => {
                        handleOpenChat(selectedUser.uid);
                        setSelectedUser(null);
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderWidth: 2,
                        borderColor: '#f0b90b',
                        borderRadius: 10,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#f0b90b', fontWeight: '800', fontSize: 14 }}>💬 Message</Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
