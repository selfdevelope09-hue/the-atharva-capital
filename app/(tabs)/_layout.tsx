import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { useCallback, useMemo, type ComponentProps } from 'react';
import { View } from 'react-native';
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

function TabLayoutInner() {
  const { isNavRail } = useBreakpoint();
  const headerShown = useClientOnlyValue(false, true);

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
                tabBarIcon: ({ color }) => <TabBarIcon name="bell" color={color} />,
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
