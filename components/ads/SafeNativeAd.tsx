/**
 * Non-intrusive native ad slot: relative flow, fixed height, no overlap with charts.
 * Web: script + container injection. iOS/Android: WebView HTML shell.
 */

import React, { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import {
  A_ADS_SLOT_2,
  NATIVE_AD_HEIGHT,
  NATIVE_AD_SLOTS,
  buildAAdsAdaptiveSlot2Html,
  buildSlotHtml,
  type NativeSlotId,
} from '@/services/ads/nativeAdSlots';
import { T } from '@/src/constants/theme';

const PAD = 12;

/** Adaptive A-ADS unit: stable layout band (iframe is height:100% of this box). */
const SLOT_2_AD_MIN_H = 100;
const SLOT_2_AD_MAX_H = 250;
const SLOT_2_AD_HEIGHT = 220;

function WebAdSlotFailed({ slotId }: { slotId: NativeSlotId }) {
  return (
    <View
      style={{
        position: 'relative',
        flexShrink: 0,
        height: NATIVE_AD_HEIGHT,
        marginVertical: PAD,
        marginHorizontal: 0,
        borderRadius: T.radiusMd,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: T.bg1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ color: '#7b8390', fontSize: 10, fontWeight: '800' }}>SPONSORED</Text>
      <Text style={{ color: T.text3, fontSize: 13, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>
        {`Ad slot ${slotId} could not be loaded`}
      </Text>
    </View>
  );
}

function PlaceholderSlot({ slotId }: { slotId: NativeSlotId }) {
  return (
    <View
      style={{
        position: 'relative',
        flexShrink: 0,
        height: NATIVE_AD_HEIGHT,
        marginVertical: PAD,
        marginHorizontal: 0,
        borderRadius: T.radiusMd,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: T.bg1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ color: '#7b8390', fontSize: 10, fontWeight: '800' }}>SPONSORED</Text>
      <Text style={{ color: T.text3, fontSize: 13, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>
        {`Ad Network [${slotId}] Pending Setup`}
      </Text>
    </View>
  );
}

function WebSlotInject({ slotId }: { slotId: 1 }) {
  const ref = useRef<View | null>(null);
  const cfg = NATIVE_AD_SLOTS[slotId];
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!cfg.scriptSrc || !cfg.containerId) return;

    const host = ref.current as unknown as HTMLElement | null;
    if (!host) return;

    try {
      host.innerHTML = '';

      const s = document.createElement('script');
      s.async = true;
      s.setAttribute('data-cfasync', 'false');
      s.setAttribute('data-atc-slot', String(slotId));
      s.src = cfg.scriptSrc;
      s.onerror = () => setFailed(true);
      host.appendChild(s);

      const div = document.createElement('div');
      div.id = cfg.containerId;
      host.appendChild(div);
    } catch {
      setFailed(true);
    }

    return () => {
      try {
        host.innerHTML = '';
      } catch {
        /* noop */
      }
    };
  }, [cfg.containerId, cfg.scriptSrc, slotId]);

  if (failed) {
    return <WebAdSlotFailed slotId={slotId} />;
  }

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        position: 'relative',
        flexShrink: 0,
        height: NATIVE_AD_HEIGHT,
        marginVertical: PAD,
        width: '100%',
        borderRadius: T.radiusMd,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: T.bg1,
        overflow: 'hidden',
      }}
    />
  );
}

function NativeWebViewSlot({ slotId }: { slotId: 1 }) {
  const cfg = NATIVE_AD_SLOTS[slotId];
  const html = useMemo(() => buildSlotHtml(cfg), [cfg]);

  return (
    <View
      style={{
        position: 'relative',
        flexShrink: 0,
        height: NATIVE_AD_HEIGHT,
        marginVertical: PAD,
        borderRadius: T.radiusMd,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: T.bg1,
        overflow: 'hidden',
      }}
    >
      <WebView
        source={{ html, baseUrl: 'https://pl29181549.profitablecpmratenetwork.com' }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        originWhitelist={['*']}
        mixedContentMode="always"
        scrollEnabled={false}
      />
    </View>
  );
}

function SponsoredLabel() {
  return (
    <Text style={{ color: '#7b8390', fontSize: 10, fontWeight: '800', paddingHorizontal: 12, paddingTop: 8 }}>SPONSORED</Text>
  );
}

/** Web: inject A-ADS adaptive iframe (Slot 2). */
function WebSlot2AAds() {
  const ref = useRef<View | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const host = ref.current as unknown as HTMLElement | null;
    if (!host) return;

    try {
      host.innerHTML = '';

      const wrap = document.createElement('div');
      wrap.id = 'frame';
      wrap.style.cssText =
        'width:100%;margin:auto;position:relative;z-index:99998;height:100%;min-height:100px;max-height:250px;';

      const iframe = document.createElement('iframe');
      iframe.setAttribute('data-aa', A_ADS_SLOT_2.dataAa);
      iframe.src = A_ADS_SLOT_2.iframeSrc;
      iframe.setAttribute(
        'style',
        'border:0;padding:0;width:100%;height:100%;overflow:hidden;display:block;margin:auto;background-color:transparent;',
      );
      iframe.setAttribute('title', 'Advertisement');
      iframe.onerror = () => setFailed(true);

      wrap.appendChild(iframe);
      host.appendChild(wrap);
    } catch {
      setFailed(true);
    }

    return () => {
      try {
        host.innerHTML = '';
      } catch {
        /* noop */
      }
    };
  }, []);

  if (failed) {
    return (
      <View
        style={{
          width: '100%',
          minHeight: SLOT_2_AD_MIN_H,
          maxHeight: SLOT_2_AD_MAX_H,
          height: SLOT_2_AD_HEIGHT,
          backgroundColor: T.bg1,
          borderRadius: T.radiusMd,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 12,
        }}
      >
        <Text style={{ color: T.text3, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>Ad could not be loaded</Text>
      </View>
    );
  }

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width: '100%',
        minHeight: SLOT_2_AD_MIN_H,
        maxHeight: SLOT_2_AD_MAX_H,
        height: SLOT_2_AD_HEIGHT,
        backgroundColor: 'transparent',
      }}
    />
  );
}

/** iOS/Android: WebView shell for A-ADS adaptive iframe. */
function NativeWebViewSlot2() {
  const html = useMemo(() => buildAAdsAdaptiveSlot2Html(), []);

  return (
    <View
      style={{
        position: 'relative',
        flexShrink: 0,
        marginVertical: PAD,
        width: '100%',
        borderRadius: T.radiusMd,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: T.bg0,
        overflow: 'hidden',
      }}
    >
      <SponsoredLabel />
      <View
        style={{
          minHeight: SLOT_2_AD_MIN_H,
          maxHeight: SLOT_2_AD_MAX_H,
          height: SLOT_2_AD_HEIGHT,
          marginHorizontal: 0,
          marginBottom: 8,
        }}
      >
        <WebView
          source={{ html, baseUrl: 'https://acceptable.a-ads.com' }}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          originWhitelist={['*']}
          mixedContentMode="always"
          scrollEnabled={false}
          {...(Platform.OS === 'android' ? { scalesPageToFit: true } : {})}
        />
      </View>
    </View>
  );
}

/** Web: Slot 2 card with Sponsored + iframe. */
function WebSlot2Card() {
  return (
    <View
      style={{
        position: 'relative',
        flexShrink: 0,
        marginVertical: PAD,
        width: '100%',
        borderRadius: T.radiusMd,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: T.bg0,
        overflow: 'hidden',
      }}
    >
      <SponsoredLabel />
      <WebSlot2AAds />
    </View>
  );
}

export type SafeNativeAdProps = {
  slotId: NativeSlotId;
};

class SafeNativeAdRenderBoundary extends Component<{ slotId: NativeSlotId; children: ReactNode }, { err: boolean }> {
  state = { err: false };

  static getDerivedStateFromError() {
    return { err: true };
  }

  render() {
    if (this.state.err) {
      return <WebAdSlotFailed slotId={this.props.slotId} />;
    }
    return this.props.children;
  }
}

function SafeNativeAdInner({ slotId }: SafeNativeAdProps) {
  if (slotId === 1) {
    if (Platform.OS === 'web') {
      return <WebSlotInject slotId={1} />;
    }
    return <NativeWebViewSlot slotId={1} />;
  }

  if (slotId === 2) {
    if (Platform.OS === 'web') {
      return <WebSlot2Card />;
    }
    return <NativeWebViewSlot2 />;
  }

  return <PlaceholderSlot slotId={slotId} />;
}

/** Inline ad block — never absolutely positioned; keep inside ScrollViews only. */
export function SafeNativeAd(props: SafeNativeAdProps) {
  return (
    <SafeNativeAdRenderBoundary slotId={props.slotId}>
      <SafeNativeAdInner {...props} />
    </SafeNativeAdRenderBoundary>
  );
}
