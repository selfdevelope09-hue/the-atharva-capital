/**
 * SliderInput — platform-safe slider.
 *
 * On web: renders a styled <input type="range"> injected via DOM API.
 *         Never puts raw HTML in JSX (avoids "H is not a function" crash).
 * On native: uses @react-native-community/slider (no bridge issues on iOS/Android).
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

export interface SliderInputProps {
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  onValueChange?: (v: number) => void;
  onSlidingComplete?: (v: number) => void;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  disabled?: boolean;
  style?: object;
}

/* ─── Web implementation ──────────────────────────────────────────────────── */
function SliderWeb({
  value,
  minimumValue,
  maximumValue,
  step = 1,
  onValueChange,
  onSlidingComplete,
  minimumTrackTintColor = '#f0b90b',
  maximumTrackTintColor = '#333',
  thumbTintColor = '#f0b90b',
  disabled = false,
}: SliderInputProps) {
  const ref = useRef<View>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Inject <input type="range"> via DOM API — never in JSX
  useEffect(() => {
    const host = ref.current as unknown as HTMLElement | null;
    if (!host) return;

    const style = document.createElement('style');
    style.textContent = `
      .ac-slider{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:4px;outline:none;cursor:pointer}
      .ac-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;border-radius:50%;background:${thumbTintColor};cursor:pointer}
      .ac-slider::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:${thumbTintColor};cursor:pointer;border:none}
      .ac-slider:disabled{opacity:0.4;cursor:not-allowed}
    `;
    document.head.appendChild(style);

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'ac-slider';
    input.min = String(minimumValue);
    input.max = String(maximumValue);
    input.step = String(step);
    input.value = String(value);
    input.disabled = disabled;
    input.style.cssText = `background:linear-gradient(to right,${minimumTrackTintColor} 0%,${minimumTrackTintColor} ${((value - minimumValue) / (maximumValue - minimumValue)) * 100}%,${maximumTrackTintColor} ${((value - minimumValue) / (maximumValue - minimumValue)) * 100}%,${maximumTrackTintColor} 100%)`;

    const updateGradient = (v: number) => {
      const pct = ((v - minimumValue) / (maximumValue - minimumValue)) * 100;
      input.style.background = `linear-gradient(to right,${minimumTrackTintColor} 0%,${minimumTrackTintColor} ${pct}%,${maximumTrackTintColor} ${pct}%,${maximumTrackTintColor} 100%)`;
    };

    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      updateGradient(v);
      onValueChange?.(v);
    });
    input.addEventListener('change', () => {
      onSlidingComplete?.(parseFloat(input.value));
    });

    host.appendChild(input);
    inputRef.current = input;

    return () => {
      try { host.removeChild(input); } catch { /* ignore */ }
      try { document.head.removeChild(style); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minimumValue, maximumValue, step, disabled]);

  // Sync value changes from parent
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = String(value);
    }
  }, [value]);

  return (
    <View
      ref={ref}
      style={[{ width: '100%', height: 20, justifyContent: 'center' }]}
    />
  );
}

/* ─── Native implementation ───────────────────────────────────────────────── */
let NativeSlider: React.ComponentType<SliderInputProps> | null = null;

// Lazily require native slider — this module reference is never evaluated on web
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    NativeSlider = require('@react-native-community/slider').default;
  } catch {
    NativeSlider = null;
  }
}

function SliderNative(props: SliderInputProps) {
  if (!NativeSlider) {
    // Fallback: plain View placeholder if slider package is missing
    return <View style={[{ height: 20, backgroundColor: '#333', borderRadius: 4 }]} />;
  }
  return <NativeSlider {...props} />;
}

/* ─── Unified export ──────────────────────────────────────────────────────── */
export function SliderInput(props: SliderInputProps) {
  if (Platform.OS === 'web') {
    return <SliderWeb {...props} />;
  }
  return <SliderNative {...props} />;
}

export default SliderInput;
