/**
 * Chat List — Instagram DM-style conversation list.
 */

import { useGlobalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, Text, TextInput, View } from 'react-native';

import { auth } from '@/config/firebaseConfig';
import {
  getOrCreateConversation,
  subscribeConversations,
  type Conversation,
} from '@/services/firebase/chatRepository';
import { getProfile } from '@/services/firebase/userProfileRepository';
import { T } from '@/src/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ConvRow extends Conversation {
  otherName: string;
  otherPhoto: string;
  unreadForMe: number;
}

function Avatar({ url, name, size = 44 }: { url: string; name: string; size?: number }) {
  const initials = name ? name[0].toUpperCase() : '?';
  const [err, setErr] = React.useState(false);

  if (url && !err) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: T.bg3, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: T.yellow, fontSize: size * 0.38, fontWeight: '800' }}>{initials}</Text>
    </View>
  );
}

function SkeletonRow() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: T.bg2 }} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ width: '55%', height: 13, borderRadius: 4, backgroundColor: T.bg2 }} />
        <View style={{ width: '75%', height: 11, borderRadius: 4, backgroundColor: T.bg2 }} />
      </View>
    </View>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function ChatListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useGlobalSearchParams<{ with?: string | string[] }>();
  const withUid = typeof params.with === 'string' ? params.with : params.with?.[0];
  const myUid = auth?.currentUser?.uid ?? '';
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const openedRef = useRef<string | null>(null);

  useEffect(() => {
    const other = typeof withUid === 'string' ? withUid : Array.isArray(withUid) ? withUid[0] : undefined;
    if (!other || !myUid || other === myUid) return;
    if (openedRef.current === other) return;
    openedRef.current = other;
    void (async () => {
      try {
        const convId = await getOrCreateConversation(other);
        router.replace(`/chats/${convId}?otherUid=${encodeURIComponent(other)}` as never);
      } catch {
        openedRef.current = null;
      }
    })();
  }, [withUid, myUid, router]);

  useEffect(() => {
    if (!myUid) { setLoading(false); return; }
    const unsub = subscribeConversations(myUid, async (rawConvs) => {
      // Enrich with other user's profile
      const enriched = await Promise.all(
        rawConvs.map(async (c) => {
          const otherUid = c.participants.find((p) => p !== myUid) ?? '';
          let otherName = 'Unknown';
          let otherPhoto = '';
          if (otherUid) {
            const p = await getProfile(otherUid).catch(() => null);
            otherName = p?.displayName ?? 'Unknown';
            otherPhoto = p?.photoURL ?? '';
          }
          return {
            ...c,
            otherName,
            otherPhoto,
            unreadForMe: c.unreadCount[myUid] ?? 0,
          };
        })
      );
      setConvs(enriched);
      setLoading(false);
    });
    return () => unsub();
  }, [myUid]);

  const filtered = convs.filter((c) =>
    !search || c.otherName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      {/* Header — DM-style */}
      <View style={{
        paddingHorizontal: 16,
        paddingTop: 12 + insets.top,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
        backgroundColor: T.bg0,
      }}>
        <Text style={{ color: T.text0, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 }}>Messages</Text>
        <Text style={{ color: T.text3, fontSize: 13, marginBottom: 14 }}>Your conversations</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search"
          placeholderTextColor={T.text3}
          style={{
            backgroundColor: T.bg1,
            borderRadius: 22,
            paddingHorizontal: 18,
            paddingVertical: 12,
            color: T.text0,
            fontSize: 15,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        />
      </View>

      {loading ? (
        <View>{[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}</View>
      ) : filtered.length === 0 ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1, padding: 32 }}>
          <Text style={{ fontSize: 36 }}>💬</Text>
          <Text style={{ color: T.text2, marginTop: 12, fontSize: 15 }}>No conversations yet</Text>
          <Text style={{ color: T.text3, marginTop: 4, fontSize: 13, textAlign: 'center' }}>
            Start a chat from the leaderboard or a user's profile
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                const oid = item.participants.find((p) => p !== myUid) ?? '';
                if (oid) {
                  router.push(`/chats/${item.id}?otherUid=${encodeURIComponent(oid)}` as never);
                } else {
                  router.push(`/chats/${item.id}` as never);
                }
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 14,
                gap: 14,
                backgroundColor: pressed ? T.bg1 : 'transparent',
                borderBottomWidth: 1,
                borderBottomColor: T.bg2,
              })}
            >
              <View>
                <View style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 24, padding: 1 }}>
                  <Avatar url={item.otherPhoto} name={item.otherName} size={48} />
                </View>
                {item.unreadForMe > 0 && (
                  <View style={{
                    position: 'absolute', top: 0, right: 0,
                    width: 16, height: 16, borderRadius: 8,
                    backgroundColor: T.red, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>
                      {item.unreadForMe > 9 ? '9+' : String(item.unreadForMe)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: item.unreadForMe > 0 ? T.text0 : T.text1, fontWeight: item.unreadForMe > 0 ? '800' : '600', fontSize: 14 }}>
                    {item.otherName}
                  </Text>
                  <Text style={{ color: T.text3, fontSize: 11 }}>{timeAgo(item.lastMessageAt)}</Text>
                </View>
                <Text style={{ color: item.unreadForMe > 0 ? T.text1 : T.text3, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {item.lastMessage || 'Say hello!'}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
