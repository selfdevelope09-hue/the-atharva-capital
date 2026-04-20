import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { NAV_BREAKPOINT, ORDER_SHEET_BREAKPOINT } from '@/constants/theme';

export type BreakpointState = {
  width: number;
  height: number;
  /** Desktop / large tablet: left navigation rail instead of bottom tabs. */
  isNavRail: boolean;
  /** Narrow: order panel becomes a bottom sheet in fullscreen terminal. */
  isOrderBottomSheet: boolean;
};

export function useBreakpoint(): BreakpointState {
  const { width, height } = useWindowDimensions();
  return useMemo(
    () => ({
      width,
      height,
      isNavRail: width >= NAV_BREAKPOINT,
      isOrderBottomSheet: width < ORDER_SHEET_BREAKPOINT,
    }),
    [width, height]
  );
}
