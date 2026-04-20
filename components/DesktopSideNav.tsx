import FontAwesome from '@expo/vector-icons/FontAwesome';
import { memo, useCallback, useMemo, type ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';

import { FontSans } from '@/constants/theme';
import { useThemeStore } from '@/store/themeStore';

type NavItem = {
  key: string;
  label: string;
  href: '/(tabs)' | '/(tabs)/dashboard';
  icon: ComponentProps<typeof FontAwesome>['name'];
};

const ITEMS: NavItem[] = [
  { key: 'trade', label: 'Markets', href: '/(tabs)', icon: 'line-chart' },
  { key: 'dash', label: 'Dashboard', href: '/(tabs)/dashboard', icon: 'bar-chart' },
];

function DesktopSideNavInner() {
  const insets = useSafeAreaInsets();
  const palette = useThemeStore((s) => s.palette);
  const router = useRouter();
  const pathname = usePathname();

  const activeHref = useMemo(() => {
    if (pathname?.includes('dashboard')) return '/(tabs)/dashboard' as const;
    return '/(tabs)' as const;
  }, [pathname]);

  const go = useCallback(
    (href: NavItem['href']) => {
      router.replace(href);
    },
    [router]
  );

  return (
    <View
      style={{
        width: 220,
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 12,
        borderRightWidth: 1,
        borderRightColor: palette.border,
        backgroundColor: palette.surface2,
      }}>
      <Text
        style={{
          paddingHorizontal: 16,
          paddingBottom: 16,
          fontFamily: FontSans.bold,
          fontSize: 13,
          letterSpacing: 1.2,
          color: palette.textMuted,
        }}>
        THE ATHARVA CAPITAL
      </Text>
      {ITEMS.map((item) => {
        const active = item.href === activeHref;
        return (
          <Pressable
            key={item.key}
            onPress={() => go(item.href)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginHorizontal: 8,
              marginVertical: 4,
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: active ? `${palette.accent}22` : 'transparent',
              borderWidth: active ? 1 : 0,
              borderColor: active ? palette.accent : 'transparent',
            }}>
            <FontAwesome name={item.icon} size={18} color={active ? palette.accent : palette.textMuted} />
            <Text
              style={{
                marginLeft: 12,
                fontFamily: active ? FontSans.semibold : FontSans.regular,
                fontSize: 15,
                color: active ? palette.text : palette.textMuted,
              }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const DesktopSideNav = memo(DesktopSideNavInner);
