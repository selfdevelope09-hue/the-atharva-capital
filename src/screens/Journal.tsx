/**
 * Phase 4 — Trade journal: tags, emotions, notes, summaries.
 */

import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { MARKETS, type MarketId } from '@/src/constants/markets';
import { fmtMoney, T } from '@/src/constants/theme';
import { useLedgerStore } from '@/store/ledgerStore';
import { tradePnlUsd } from '@/src/screens/dashboardMath';
import { useMultiMarketBalanceStore } from '@/store/multiMarketBalanceStore';

const ENTRY_TAGS = ['Technical', 'News', 'Momentum', 'FOMO', 'Breakout', 'Support'] as const;
const EMOTIONS = ['Confident', 'Patient', 'FOMO', 'Greedy', 'Fearful'] as const;

export default function Journal() {
  const pending = useLedgerStore((s) => s.pendingJournalTrade);
  const saveJournal = useLedgerStore((s) => s.saveJournal);
  const dismissJournal = useLedgerStore((s) => s.dismissJournalPrompt);
  const closed = useLedgerStore((s) => s.closedTrades);
  const journalMap = useLedgerStore((s) => s.journalByTradeId);
  const rates = useMultiMarketBalanceStore((s) => s.usdRates);

  const [tags, setTags] = useState<string[]>([]);
  const [emotion, setEmotion] = useState('Confident');
  const [notes, setNotes] = useState('');

  const weeklyPnl = useMemo(() => {
    const cut = Date.now() - 86400000 * 7;
    return closed
      .filter((t) => new Date(t.closedAt).getTime() >= cut)
      .reduce((a, t) => a + tradePnlUsd(t, rates), 0);
  }, [closed, rates]);

  const tagStats = useMemo(() => {
    const m = new Map<string, { n: number; pnl: number }>();
    for (const t of closed) {
      const j = journalMap[t.id];
      if (!j) continue;
      for (const tag of j.entryTags) {
        const cur = m.get(tag) ?? { n: 0, pnl: 0 };
        cur.n += 1;
        cur.pnl += tradePnlUsd(t, rates);
        m.set(tag, cur);
      }
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [closed, journalMap, rates]);

  const emotionPerf = useMemo(() => {
    const m = new Map<string, { n: number; pnl: number }>();
    for (const t of closed) {
      const j = journalMap[t.id];
      if (!j?.emotion) continue;
      const cur = m.get(j.emotion) ?? { n: 0, pnl: 0 };
      cur.n += 1;
      cur.pnl += tradePnlUsd(t, rates);
      m.set(j.emotion, cur);
    }
    return [...m.entries()];
  }, [closed, journalMap, rates]);

  const maxTag = tagStats[0]?.[1].n ?? 1;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Text style={{ color: T.text0, fontSize: 22, fontWeight: '800' }}>Trade Journal</Text>

        <View style={{ backgroundColor: T.bg1, borderRadius: T.radiusLg, borderWidth: 1, borderColor: T.border, padding: 14, marginTop: 14 }}>
          <Text style={{ color: T.text3, fontSize: 11, fontWeight: '800' }}>WEEKLY P&L (USD est.)</Text>
          <Text style={{ color: weeklyPnl >= 0 ? T.green : T.red, fontSize: 24, fontWeight: '800', marginTop: 6 }}>{fmtMoney(weeklyPnl, '$')}</Text>
        </View>

        <Text style={{ color: T.text0, fontWeight: '800', marginTop: 20, marginBottom: 8 }}>Most used tags</Text>
        {tagStats.length === 0 ? (
          <Text style={{ color: T.text3, fontSize: 13 }}>Tag closed trades when prompted to see analytics.</Text>
        ) : (
          tagStats.map(([tag, st]) => (
            <View key={tag} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: T.text0, fontWeight: '700' }}>{tag}</Text>
                <Text style={{ color: T.text2, fontSize: 12 }}>{fmtMoney(st.pnl, '$')}</Text>
              </View>
              <View style={{ height: 8, backgroundColor: T.bg2, borderRadius: 4, marginTop: 4 }}>
                <View style={{ width: `${Math.min(100, (st.n / maxTag) * 100)}%`, height: 8, backgroundColor: T.yellow, borderRadius: 4 }} />
              </View>
            </View>
          ))
        )}

        <Text style={{ color: T.text0, fontWeight: '800', marginTop: 16, marginBottom: 8 }}>Emotion vs performance</Text>
        {emotionPerf.length === 0 ? (
          <Text style={{ color: T.text3, fontSize: 13 }}>No emotion tags yet.</Text>
        ) : (
          emotionPerf.map(([em, st]) => (
            <View key={em} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: T.border }}>
              <Text style={{ color: T.text1 }}>{em}</Text>
              <Text style={{ color: st.pnl >= 0 ? T.green : T.red, fontWeight: '700' }}>{fmtMoney(st.pnl, '$')}</Text>
            </View>
          ))
        )}

        <Text style={{ color: T.text0, fontWeight: '800', marginTop: 20, marginBottom: 8 }}>Recent closes</Text>
        {closed.slice(0, 30).map((t) => {
          const cfg = MARKETS[t.market as MarketId];
          const j = journalMap[t.id];
          return (
            <View key={t.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: T.border }}>
              <Text style={{ color: T.text0, fontWeight: '700' }}>
                {cfg.flag} {t.symbol} · {t.closedAt.slice(0, 10)}
              </Text>
              <Text style={{ color: T.text3, fontSize: 12 }}>
                {j ? `${j.entryTags.join(', ')} · ${j.emotion}` : '— no journal'}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!pending} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: T.bg1, borderTopLeftRadius: T.radiusXl, borderTopRightRadius: T.radiusXl, padding: 18, borderWidth: 1, borderColor: T.border }}>
            <Text style={{ color: T.text0, fontSize: 18, fontWeight: '800' }}>Log this trade</Text>
            <Text style={{ color: T.text2, fontSize: 12, marginTop: 6 }}>
              {pending ? `${pending.symbol} · ${fmtMoney(tradePnlUsd(pending, rates), '$')}` : ''}
            </Text>
            <Text style={{ color: T.text3, marginTop: 12, fontSize: 11, fontWeight: '700' }}>ENTRY REASON</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {ENTRY_TAGS.map((tag) => {
                const on = tags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => setTags(on ? tags.filter((x) => x !== tag) : [...tags, tag])}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: on ? T.greenDim : T.bg2,
                      borderWidth: 1,
                      borderColor: on ? T.green : T.border,
                    }}
                  >
                    <Text style={{ color: on ? T.green : T.text1, fontSize: 12, fontWeight: '700' }}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: T.text3, marginTop: 14, fontSize: 11, fontWeight: '700' }}>EMOTION</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {EMOTIONS.map((em) => {
                const on = emotion === em;
                return (
                  <Pressable
                    key={em}
                    onPress={() => setEmotion(em)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: on ? T.yellow : T.bg2,
                      borderWidth: 1,
                      borderColor: on ? T.yellow : T.border,
                    }}
                  >
                    <Text style={{ color: on ? '#000' : T.text1, fontSize: 12, fontWeight: '700' }}>{em}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: T.text3, marginTop: 14, fontSize: 11, fontWeight: '700' }}>NOTES</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="What did you learn?"
              placeholderTextColor={T.text3}
              multiline
              style={{
                marginTop: 8,
                minHeight: 80,
                borderWidth: 1,
                borderColor: T.border,
                borderRadius: T.radiusMd,
                padding: 12,
                color: T.text0,
                textAlignVertical: 'top',
              }}
            />
            <Pressable
              onPress={() => {
                if (!pending) return;
                saveJournal(pending.id, tags, emotion, notes);
                setTags([]);
                setNotes('');
              }}
              style={{ marginTop: 16, backgroundColor: T.green, padding: 14, borderRadius: T.radiusMd, alignItems: 'center' }}
            >
              <Text style={{ color: '#000', fontWeight: '800' }}>Save journal</Text>
            </Pressable>
            <Pressable onPress={() => dismissJournal()} style={{ marginTop: 10, alignItems: 'center', padding: 10 }}>
              <Text style={{ color: T.text3 }}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
