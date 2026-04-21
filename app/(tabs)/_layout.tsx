import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { DesktopSideNav } from '@/components/DesktopSideNav';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { AdRotatorProvider } from '@/hooks/useAdRotator';

function TabBarIcon(props: {
  name: ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

function BadgeDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={{ position: 'absolute', top: -2, right: -6, minWidth: 14, height: 14, borderRadius: 7, backgroundColor: '#f6465d', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 }}>
      <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>{count > 9 ? '9+' : String(count)}</Text>
    </View>
  );
}

/** Lazily imports Firebase badge subscriptions — loaded only after auth is ready. */
function useBadges() {
  const [unreadNotif, setUnreadNotif] = useState(0);

  useEffect(() => {
    let unsub: (() => void) | null = null;

    const init = async () => {
      try {
        const { auth } = await import('@/config/firebaseConfig');
        const uid = auth?.currentUser?.uid;
        if (!uid) return;
        const { subscribeNotifications } = await import('@/services/firebase/notificationRepository');
        unsub = subscribeNotifications(uid, (ns) => {
          setUnreadNotif(ns.filter((n) => !n.read).length);
        });
      } catch {
        // Firebase not available — silently ignore
      }
    };

    // Small delay to let auth initialize
    const t = setTimeout(() => { void init(); }, 1500);
    return () => {
      clearTimeout(t);
      unsub?.();
    };
  }, []);

  return { unreadNotif };
}

function TabLayoutInner() {
  const { isNavRail } = useBreakpoint();
  const headerShown = useClientOnlyValue(false, true);
  const { unreadNotif } = useBadges();

  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => (isNavRail ? null : <BottomTabBar {...props} />),
    [isNavRail]
  );

  const screenOptions = useMemo(
    () => ({
      tabBarActiveTintColor: '#ff6a00',
      tabBarInactiveTintColor: '#737373',
      tabBarStyle: { backgroundColor: '#0a0a0a', borderTopColor: '#262626' },
      headerShown,
      tabBar: renderTabBar,
    }),
    [headerShown, renderTabBar]
  );

  return (
    <AdRotatorProvider>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {isNavRail ? <DesktopSideNav /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tabs screenOptions={screenOptions}>
            <Tabs.Screen
              name="index"
              options={{
                title: 'Markets',
                headerShown: false,
                tabBarIcon: ({ color }) => <TabBarIcon name="line-chart" color={color} />,
              }}
            />
            <Tabs.Screen
              name="crypto"
              options={{
                title: 'Crypto',
                headerShown: false,
                tabBarIcon: ({ color }) => <TabBarIcon name="btc" color={color} />,
              }}
            />
            <Tabs.Screen
              name="dashboard"
              options={{
                title: 'Dash',
                headerShown: false,
                tabBarIcon: ({ color }) => <TabBarIcon name="bar-chart" color={color} />,
              }}
            />
            <Tabs.Screen
              name="wallet"
              options={{
                title: 'Wallet',
                headerShown: false,
                tabBarIcon: ({ color }) => <TabBarIcon name="money" color={color} />,
              }}
            />
            <Tabs.Screen
              name="leaderboard"
              options={{
                title: 'Board',
                headerShown: false,
                tabBarIcon: ({ color }) => <TabBarIcon name="trophy" color={color} />,
              }}
            />
            <Tabs.Screen
              name="journal"
              options={{
                title: 'Journal',
                headerShown: false,
                tabBarIcon: ({ color }) => <TabBarIcon name="book" color={color} />,
              }}
            />
            <Tabs.Screen
              name="alerts"
              options={{
                title: 'Alerts',
                headerShown: false,
                tabBarIcon: ({ color }) => (
                  <View>
                    <TabBarIcon name="bell" color={color} />
                    <BadgeDot count={unreadNotif} />
                  </View>
                ),
              }}
            />
            <Tabs.Screen
              name="profile"
              options={{
                title: 'Profile',
                headerShown: false,
                tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
              }}
            />
          </Tabs>
        </View>
      </View>
    </AdRotatorProvider>
  );
}

export default function TabLayout() {
  return <TabLayoutInner />;
}
