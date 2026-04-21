/**
 * TopNavBar — shows on mobile screens.
 * Desktop already has the sidebar with profile. Mobile gets this top bar.
 *
 * Contains:
 *  - App logo (left)
 *  - Chat icon with unread badge (right)
 *  - Profile avatar with first name (right, hides name on narrow screens)
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';

import { auth } from '@/config/firebaseConfig';
import { T } from '@/src/constants/theme';

function Avatar({ url, name, size = 34 }: { url: string; name: string; size?: number }) {
  const initial = name ? name[0].toUpperCase() : 'U';
  const [err, setErr] = useState(false);

  if (url && !err) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: T.yellow }}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: T.yellow, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#000', fontSize: size * 0.42, fontWeight: '800' }}>{initial}</Text>
    </View>
  );
}

export function TopNavBar({ title }: { title?: string }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const currentUser = auth?.currentUser;
  const displayName = currentUser?.displayName ?? '';
  const firstName = displayName.split(' ')[0] ?? 'Profile';
  const photoURL = currentUser?.photoURL ?? '';
  const uid = currentUser?.uid ?? '';

  const [unreadChat, setUnreadChat] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let unsub: (() => void) | null = null;
    const init = async () => {
      try {
        const { subscribeTotalUnread } = await import('@/services/firebase/chatRepository');
        unsub = subscribeTotalUnread(uid, setUnreadChat);
      } catch { /* ignore */ }
    };
    const t = setTimeout(() => { void init(); }, 1000);
    return () => { clearTimeout(t); unsub?.(); };
  }, [uid]);

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 10,
      backgroundColor: T.bg1, borderBottomWidth: 1, borderBottomColor: T.border,
    }}>
      {/* Logo / Title */}
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.yellow, fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>
          ⚡ {title ?? 'ATHARVA CAPITAL'}
        </Text>
      </View>

      {/* Right icons */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {/* Chat icon */}
        <Pressable
          onPress={() => router.push('/chats' as never)}
          style={{ position: 'relative' }}
        >
          <Text style={{ fontSize: 20 }}>💬</Text>
          {unreadChat > 0 && (
            <View style={{
              position: 'absolute', top: -4, right: -6,
              minWidth: 16, height: 16, borderRadius: 8,
              backgroundColor: T.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
            }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>
                {unreadChat > 9 ? '9+' : String(unreadChat)}
              </Text>
            </View>
          )}
        </Pressable>

        {/* Profile */}
        <Pressable
          onPress={() => uid ? router.push(`/profile/${uid}` as never) : router.push('/login' as never)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Avatar url={photoURL} name={displayName || 'U'} size={34} />
          {/* Hide name on very narrow screens */}
          {!isMobile && (
            <Text style={{ color: T.text1, fontSize: 13, fontWeight: '600', maxWidth: 80 }} numberOfLines={1}>
              {firstName}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
