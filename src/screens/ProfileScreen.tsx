/**
 * Profile Screen — shows own or another user's profile.
 * Own profile: shows Edit button.
 * Other profile: shows Follow + Message buttons.
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { auth } from '@/config/firebaseConfig';
import {
  followUser,
  getProfile,
  isFollowing,
  unfollowUser,
  updateProfile,
  type UserProfile,
} from '@/services/firebase/userProfileRepository';
import { getOrCreateConversation } from '@/services/firebase/chatRepository';
import { useLedgerStore } from '@/store/ledgerStore';
import { T } from '@/src/constants/theme';

const S = {
  bg: T.bg0,
  card: T.bg1,
  border: T.border,
  text: T.text0,
  muted: T.text2,
  accent: T.yellow,
  green: T.green,
  red: T.red,
};

interface Props {
  userId: string;
}

function Avatar({ url, name, size = 64 }: { url: string; name: string; size?: number }) {
  const initials = name ? name[0].toUpperCase() : '?';
  const [imgErr, setImgErr] = React.useState(false);

  if (url && !imgErr) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: T.border }}
        onError={() => setImgErr(true)}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: T.bg3, alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: T.border,
    }}>
      <Text style={{ color: T.yellow, fontSize: size * 0.38, fontWeight: '800' }}>{initials}</Text>
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: color ?? T.text0, fontSize: 17, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: T.text3, fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
    </View>
  );
}

function SkeletonRow() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: T.bg3 }} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ width: '60%', height: 12, borderRadius: 4, backgroundColor: T.bg3 }} />
        <View style={{ width: '40%', height: 10, borderRadius: 4, backgroundColor: T.bg3 }} />
      </View>
    </View>
  );
}

export function ProfileScreen({ userId }: Props) {
  const router = useRouter();
  const myUid = auth?.currentUser?.uid ?? '';
  const isOwn = myUid === userId;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const closedTrades = useLedgerStore((s) => s.closedTrades);

  useEffect(() => {
    setLoading(true);
    getProfile(userId).then((p) => {
      setProfile(p);
      setLoading(false);
    });
  }, [userId]);

  useEffect(() => {
    if (!isOwn && myUid) {
      isFollowing(userId).then(setFollowing);
    }
  }, [userId, isOwn, myUid]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ displayName: nameDraft.trim() || undefined, bio: bioDraft });
      setProfile((p) => p ? { ...p, displayName: nameDraft || p.displayName, bio: bioDraft } : p);
      setEditing(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleFollow = async () => {
    if (!myUid) return;
    setFollowLoading(true);
    try {
      if (following) {
        await unfollowUser(userId);
        setFollowing(false);
        setProfile((p) => p ? { ...p, followers: Math.max(0, p.followers - 1) } : p);
      } else {
        await followUser(userId);
        setFollowing(true);
        setProfile((p) => p ? { ...p, followers: p.followers + 1 } : p);
      }
    } catch (e) {
      Alert.alert('Error', 'Action failed. Try again.');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!myUid) return;
    try {
      const convId = await getOrCreateConversation(userId);
      router.push(`/chats/${convId}` as never);
    } catch (e) {
      Alert.alert('Error', 'Could not open chat.');
    }
  };

  const recentTrades = closedTrades.slice(-10).reverse();

  const totalPnl = profile
    ? profile.pnl.crypto + profile.pnl.forex + profile.pnl.stocks + profile.pnl.commodities
    : 0;

  const joinedDate = profile?.joinedAt
    ? new Date(profile.joinedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : '—';

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: S.bg }}>
        {[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: S.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ color: T.text2, fontSize: 15 }}>User not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: S.bg }}
      contentContainerStyle={{ paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero ── */}
      <View style={{ backgroundColor: S.card, padding: 24, borderBottomWidth: 1, borderBottomColor: S.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
          <Avatar url={profile.photoURL} name={profile.displayName} size={72} />
          <View style={{ flex: 1 }}>
            {editing ? (
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                style={{
                  color: S.text, fontSize: 20, fontWeight: '800',
                  borderBottomWidth: 1, borderBottomColor: S.accent,
                  paddingVertical: 2, marginBottom: 4,
                }}
                placeholder="Display name"
                placeholderTextColor={T.text3}
                maxLength={40}
              />
            ) : (
              <Text style={{ color: S.text, fontSize: 20, fontWeight: '800' }}>{profile.displayName}</Text>
            )}
            <Text style={{ color: T.text3, fontSize: 12, marginTop: 2 }}>Member since {joinedDate}</Text>

            {editing ? (
              <TextInput
                value={bioDraft}
                onChangeText={setBioDraft}
                multiline
                style={{
                  color: T.text1, fontSize: 13, marginTop: 8,
                  borderWidth: 1, borderColor: S.border, borderRadius: 8,
                  padding: 8, maxHeight: 80,
                }}
                placeholder="Short bio (max 150 chars)"
                placeholderTextColor={T.text3}
                maxLength={150}
              />
            ) : (
              <Text style={{ color: T.text1, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
                {profile.bio || (isOwn ? '+ Add a bio' : '')}
              </Text>
            )}
          </View>
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          {isOwn && !editing && (
            <Pressable
              onPress={() => router.push('/trades' as never)}
              style={{ minWidth: '45%', flexGrow: 1, backgroundColor: T.bg2, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: S.border }}
            >
              <Text style={{ color: S.text, fontWeight: '700', fontSize: 13 }}>📜 Trade History</Text>
            </Pressable>
          )}
          {isOwn && !editing && (
            <Pressable
              onPress={() => { setEditing(true); setNameDraft(profile.displayName); setBioDraft(profile.bio); }}
              style={{ minWidth: '45%', flexGrow: 1, backgroundColor: T.bg3, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: S.border }}
            >
              <Text style={{ color: S.text, fontWeight: '700', fontSize: 13 }}>✏️ Edit Profile</Text>
            </Pressable>
          )}
          {isOwn && editing && (
            <>
              <Pressable onPress={() => setEditing(false)} style={{ flex: 1, backgroundColor: T.bg3, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: T.text2, fontWeight: '700', fontSize: 13 }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSave} disabled={saving} style={{ flex: 1, backgroundColor: S.accent, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={{ color: '#000', fontWeight: '800', fontSize: 13 }}>Save</Text>}
              </Pressable>
            </>
          )}
          {!isOwn && (
            <>
              <Pressable onPress={handleFollow} disabled={followLoading} style={{
                flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
                backgroundColor: following ? T.bg3 : S.accent,
                borderWidth: following ? 1 : 0, borderColor: S.border,
              }}>
                {followLoading ? <ActivityIndicator color={following ? T.text0 : '#000'} size="small" /> : (
                  <Text style={{ color: following ? T.text1 : '#000', fontWeight: '700', fontSize: 13 }}>
                    {following ? '✓ Following' : '+ Follow'}
                  </Text>
                )}
              </Pressable>
              <Pressable onPress={handleMessage} style={{ flex: 1, backgroundColor: T.bg3, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: S.border }}>
                <Text style={{ color: S.text, fontWeight: '700', fontSize: 13 }}>💬 Message</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* ── Stats row ── */}
      <View style={{ flexDirection: 'row', backgroundColor: S.card, borderBottomWidth: 1, borderBottomColor: S.border, paddingVertical: 16 }}>
        <StatBox label="Followers" value={profile.followers.toLocaleString()} />
        <View style={{ width: 1, backgroundColor: S.border }} />
        <StatBox label="Following" value={profile.following.toLocaleString()} />
        <View style={{ width: 1, backgroundColor: S.border }} />
        <StatBox label="Trades" value={profile.totalTrades.toLocaleString()} />
        <View style={{ width: 1, backgroundColor: S.border }} />
        <StatBox label="Win Rate" value={`${profile.winRate.toFixed(0)}%`} color={profile.winRate >= 50 ? T.green : T.red} />
      </View>

      {/* ── Total PnL ── */}
      <View style={{ margin: 16, backgroundColor: S.card, borderRadius: T.radiusLg, padding: 16, borderWidth: 1, borderColor: S.border }}>
        <Text style={{ color: T.text3, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Total Profit / Loss</Text>
        <Text style={{ color: totalPnl >= 0 ? T.green : T.red, fontSize: 26, fontWeight: '900' }}>
          {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>

        {/* Per-market breakdown */}
        <View style={{ marginTop: 12, gap: 6 }}>
          {[
            { label: 'Crypto', val: profile.pnl.crypto, sym: '₮' },
            { label: 'Stocks', val: profile.pnl.stocks, sym: '$' },
            { label: 'Forex', val: profile.pnl.forex, sym: '$' },
            { label: 'Commodities', val: profile.pnl.commodities, sym: '$' },
          ].map((row) => (
            <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ color: T.text2, fontSize: 13 }}>{row.label}</Text>
              <Text style={{ color: row.val >= 0 ? T.green : T.red, fontWeight: '700', fontSize: 13, fontFamily: T.fontMono }}>
                {row.val >= 0 ? '+' : ''}{row.sym}{Math.abs(row.val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Recent Trades ── */}
      {isOwn && recentTrades.length > 0 && (
        <View style={{ marginHorizontal: 16, backgroundColor: S.card, borderRadius: T.radiusLg, borderWidth: 1, borderColor: S.border, overflow: 'hidden' }}>
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: S.border }}>
            <Text style={{ color: T.text2, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>Recent Trades</Text>
          </View>
          {recentTrades.slice(0, 10).map((t) => (
            <View key={t.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.bg3 }}>
              <View>
                <Text style={{ color: T.text0, fontSize: 12, fontWeight: '700' }}>{t.symbol} <Text style={{ color: t.side === 'long' ? T.green : T.red }}>({t.side.toUpperCase()})</Text></Text>
                <Text style={{ color: T.text3, fontSize: 10 }}>{t.market} · {new Date(t.closedAt).toLocaleDateString()}</Text>
              </View>
              <Text style={{ color: t.realizedPnl >= 0 ? T.green : T.red, fontWeight: '700', fontSize: 13 }}>
                {t.realizedPnl >= 0 ? '+' : ''}${Math.abs(t.realizedPnl).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
