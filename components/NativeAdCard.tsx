import { Pressable, Text, View } from 'react-native';

import { useAdRotator } from '@/hooks/useAdRotator';
import type { NativeAd } from '@/services/ads/AdAggregator';

export type NativeAdCardProps = {
  ad: NativeAd;
  /** Slightly tighter layout for inline leaderboard rows */
  compact?: boolean;
  /** Trade Republic–style: no border, whisper-quiet chrome */
  variant?: 'default' | 'minimal';
};

/**
 * In-stream native placement — no absolute overlay; sits in document flow.
 */
export function NativeAdCard({ ad, compact, variant = 'default' }: NativeAdCardProps) {
  if (variant === 'minimal') {
    return (
      <View
        className={`rounded-xl ${compact ? 'px-3 py-3' : 'px-4 py-4'}`}
        style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
        <Text className="text-[9px] font-medium uppercase tracking-widest text-neutral-600">Sponsored</Text>
        <Text className={`mt-2 font-semibold text-neutral-200 ${compact ? 'text-sm' : 'text-base'}`}>{ad.title}</Text>
        <Text className={`mt-1.5 text-neutral-500 ${compact ? 'text-[11px] leading-snug' : 'text-xs leading-snug'}`}>
          {ad.description}
        </Text>
        <Text className="mt-2 text-[10px] text-neutral-600">{ad.sponsor}</Text>
        <Pressable className="mt-4 self-start border-b border-neutral-500 pb-0.5 active:opacity-70">
          <Text className="text-xs font-semibold text-neutral-300">{ad.ctaText}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      className={`rounded-2xl border border-neutral-700/80 bg-neutral-900/90 ${compact ? 'px-3 py-2.5' : 'px-4 py-3'}`}>
      <Text className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Sponsored</Text>
      <Text className={`mt-1 font-bold text-neutral-100 ${compact ? 'text-sm' : 'text-base'}`}>{ad.title}</Text>
      <Text className={`mt-1 text-neutral-400 ${compact ? 'text-[11px] leading-snug' : 'text-xs leading-snug'}`}>
        {ad.description}
      </Text>
      <Text className="mt-2 text-[10px] text-neutral-500">{ad.sponsor}</Text>
      <Pressable className="mt-3 self-start rounded-full bg-neutral-800 px-3 py-1.5 active:opacity-80">
        <Text className="text-xs font-bold text-[#ff6a00]">{ad.ctaText}</Text>
      </Pressable>
    </View>
  );
}

/** Subscribes to the shared 30s rotation and renders {@link NativeAdCard}. */
export function NativeAdSlot({
  compact,
  variant,
}: {
  compact?: boolean;
  variant?: 'default' | 'minimal';
}) {
  const ad = useAdRotator();
  return <NativeAdCard ad={ad} compact={compact} variant={variant} />;
}
