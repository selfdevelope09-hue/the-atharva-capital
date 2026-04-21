/**
 * TopNavBar — mobile / compact top bar.
 * Profile opens a dropdown (View / Edit / Settings / Logout). Chat + optional A-ADS strip below (web).
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { auth } from '@/config/firebaseConfig';
import { AadsAdaptiveBanner } from '@/src/components/ads/AadsAdaptiveBanner';
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

export function TopNavBar({ title, showAadsStrip = true }: { title?: string; showAadsStrip?: boolean }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const currentUser = auth?.currentUser;
  const displayName = currentUser?.displayName ?? '';
  const firstName = displayName.split(' ')[0] ?? 'Profile';
  const photoURL = currentUser?.photoURL ?? '';
  const uid = currentUser?.uid ?? '';

  const [unreadChat, setUnreadChat] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const go = (href: string) => {
    setMenuOpen(false);
    router.push(href as never);
  };

  return (
    <>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 10,
        backgroundColor: T.bg1, borderBottomWidth: 1, borderBottomColor: T.border,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.yellow, fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>
            ⚡ {title ?? 'ATHARVA CAPITAL'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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

          <Pressable
            onPress={() => (uid ? setMenuOpen(true) : router.push('/login' as never))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Avatar url={photoURL} name={displayName || 'U'} size={34} />
            {!isMobile && (
              <Text style={{ color: T.text1, fontSize: 13, fontWeight: '600', maxWidth: 80 }} numberOfLines={1}>
                {firstName}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {Platform.OS === 'web' && showAadsStrip ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 8, backgroundColor: T.bg0 }}>
          <AadsAdaptiveBanner widthPct={100} />
        </View>
      ) : null}

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={() => setMenuOpen(false)} />
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 12,
              backgroundColor: T.bg1,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: T.border,
              minWidth: 210,
              overflow: 'hidden',
            }}
            pointerEvents="box-none"
          >
            {[
              { label: '👤 View Profile', href: uid ? `/profile/${uid}` : '/login' },
              { label: '✏️ Edit Profile', href: uid ? `/profile/${uid}` : '/login' },
              { label: '⚙️ Settings', href: '/modal' },
              { label: '📜 Trade History', href: '/trades' },
              { label: '💬 Messages', href: '/chats' },
            ].map((item) => (
              <Pressable
                key={item.label}
                onPress={() => go(item.href)}
                style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border }}
              >
                <Text style={{ color: T.text0, fontSize: 14 }}>{item.label}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => { setMenuOpen(false); auth?.signOut(); }}
              style={{ paddingHorizontal: 16, paddingVertical: 12 }}
            >
              <Text style={{ color: T.red, fontSize: 14, fontWeight: '700' }}>🚪 Logout</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
