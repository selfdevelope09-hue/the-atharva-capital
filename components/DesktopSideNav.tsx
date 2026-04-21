/**
 * Desktop side navigation — includes profile avatar, chat badge, notification bell.
 */

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { memo, useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';

import { FontSans } from '@/constants/theme';
import { useThemeStore } from '@/store/themeStore';
import { auth } from '@/config/firebaseConfig';
import { subscribeTotalUnread } from '@/services/firebase/chatRepository';
import { subscribeNotifications } from '@/services/firebase/notificationRepository';
import { T } from '@/src/constants/theme';

type NavHref = string;
type NavItem = {
  key: string;
  label: string;
  href: NavHref;
  icon: ComponentProps<typeof FontAwesome>['name'];
};

const MAIN_ITEMS: NavItem[] = [
  { key: 'markets', label: 'Markets', href: '/(tabs)', icon: 'line-chart' },
  { key: 'dashboard', label: 'Dashboard', href: '/(tabs)/dashboard', icon: 'bar-chart' },
  { key: 'wallet', label: 'Wallet', href: '/(tabs)/wallet', icon: 'money' },
  { key: 'leaderboard', label: 'Leaderboard', href: '/(tabs)/leaderboard', icon: 'trophy' },
  { key: 'journal', label: 'Journal', href: '/(tabs)/journal', icon: 'book' },
  { key: 'alerts', label: 'Alerts', href: '/(tabs)/alerts', icon: 'bell' },
];

function Badge({ count, color = T.red }: { count: number; color?: string }) {
  if (count <= 0) return null;
  return (
    <View style={{
      minWidth: 18, height: 18, borderRadius: 9,
      backgroundColor: color, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 4,
    }}>
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', lineHeight: 14 }}>
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
}

function Avatar({ url, name, size = 32 }: { url: string; name: string; size?: number }) {
  const initials = name ? name[0].toUpperCase() : '?';
  if (url) {
    return (
      // @ts-ignore
      <img src={url} style={{ width: size, height: size, borderRadius: size / 2, objectFit: 'cover', border: `2px solid ${T.border}` }} alt={name} />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: T.bg3, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.border }}>
      <Text style={{ color: T.yellow, fontSize: size * 0.4, fontWeight: '800' }}>{initials}</Text>
    </View>
  );
}

function DesktopSideNavInner() {
  const insets = useSafeAreaInsets();
  const palette = useThemeStore((s) => s.palette);
  const router = useRouter();
  const pathname = usePathname();

  const myUid = auth?.currentUser?.uid ?? '';
  const myName = auth?.currentUser?.displayName ?? 'Trader';
  const myPhoto = auth?.currentUser?.photoURL ?? '';

  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!myUid) return;
    const unsub1 = subscribeTotalUnread(myUid, setUnreadChat);
    const unsub2 = subscribeNotifications(myUid, (notifs) => {
      setUnreadNotif(notifs.filter((n) => !n.read).length);
    });
    return () => { unsub1(); unsub2(); };
  }, [myUid]);

  const go = useCallback((href: string) => {
    router.push(href as never);
    setShowDropdown(false);
  }, [router]);

  return (
    <View
      style={{
        width: 220,
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 12,
        borderRightWidth: 1,
        borderRightColor: palette.border,
        backgroundColor: palette.surface2,
        flexDirection: 'column',
      }}
    >
      {/* Brand */}
      <Text style={{
        paddingHorizontal: 16, paddingBottom: 12,
        fontFamily: FontSans.bold, fontSize: 13, letterSpacing: 1.2,
        color: palette.textMuted,
      }}>
        THE ATHARVA CAPITAL
      </Text>

      {/* Main nav items */}
      {MAIN_ITEMS.map((item) => {
        const active = pathname?.includes(item.key === 'markets' ? '(tabs)' : item.key) && !(item.key !== 'markets' && pathname === '/(tabs)');
        const isMarkets = item.key === 'markets' && (pathname === '/' || pathname === '/(tabs)' || pathname?.endsWith('index'));
        const isActive = isMarkets || (item.key !== 'markets' && pathname?.includes(item.key));

        return (
          <Pressable
            key={item.key}
            onPress={() => go(item.href)}
            style={{
              flexDirection: 'row', alignItems: 'center',
              marginHorizontal: 8, marginVertical: 2,
              paddingVertical: 11, paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: isActive ? `${palette.accent}22` : 'transparent',
              borderWidth: isActive ? 1 : 0, borderColor: isActive ? palette.accent : 'transparent',
            }}
          >
            <FontAwesome name={item.icon} size={17} color={isActive ? palette.accent : palette.textMuted} />
            <Text style={{ marginLeft: 12, fontFamily: isActive ? FontSans.semibold : FontSans.regular, fontSize: 14, color: isActive ? palette.text : palette.textMuted, flex: 1 }}>
              {item.label}
            </Text>
            {item.key === 'alerts' && <Badge count={unreadNotif} />}
          </Pressable>
        );
      })}

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: palette.border, marginHorizontal: 12, marginVertical: 8 }} />

      {/* Chat */}
      <Pressable
        onPress={() => go('/chats')}
        style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 8, marginVertical: 2, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10 }}
      >
        <FontAwesome name="comments" size={17} color={palette.textMuted} />
        <Text style={{ marginLeft: 12, fontFamily: FontSans.regular, fontSize: 14, color: palette.textMuted, flex: 1 }}>Messages</Text>
        <Badge count={unreadChat} />
      </Pressable>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Profile section */}
      <View style={{ borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12, marginHorizontal: 8 }}>
        <Pressable
          onPress={() => setShowDropdown((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: showDropdown ? `${palette.accent}22` : 'transparent' }}
        >
          <Avatar url={myPhoto} name={myName} size={32} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{myName}</Text>
            <Text style={{ color: palette.textMuted, fontSize: 11 }}>My Account</Text>
          </View>
          <Text style={{ color: palette.textMuted, fontSize: 12 }}>{showDropdown ? '▾' : '▸'}</Text>
        </Pressable>

        {showDropdown && (
          <View style={{ backgroundColor: palette.surface, borderRadius: 10, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', marginTop: 4 }}>
            {[
              { label: '👤 View Profile', href: myUid ? `/profile/${myUid}` : '/login' },
              { label: '💬 Messages', href: '/chats' },
            ].map((item) => (
              <Pressable
                key={item.label}
                onPress={() => go(item.href)}
                style={{ paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: palette.border }}
              >
                <Text style={{ color: palette.text, fontSize: 13 }}>{item.label}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => { setShowDropdown(false); auth?.signOut(); }}
              style={{ paddingHorizontal: 16, paddingVertical: 11 }}
            >
              <Text style={{ color: T.red, fontSize: 13, fontWeight: '700' }}>🚪 Logout</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

export const DesktopSideNav = memo(DesktopSideNavInner);
