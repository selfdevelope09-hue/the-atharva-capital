/**
 * Top-Up Screen — submit a top-up request to Firestore.
 * Admin reviews and approves from Firebase Console.
 */

import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

import { auth, db } from '@/config/firebaseConfig';
import { MARKETS, type MarketId } from '@/src/constants/markets';
import { T } from '@/src/constants/theme';

const MIN_USD = 3000;

const METHODS = [
  { id: 'card', icon: '💳', label: 'Card Payment', sub: 'Visa / Mastercard / Amex' },
  { id: 'crypto', icon: '₿', label: 'Crypto Payment', sub: 'USDT · BTC · ETH' },
  { id: 'upi', icon: '📱', label: 'UPI', sub: 'GPay · PhonePe · Paytm (INR markets)' },
];

export function TopUpScreen({ market }: { market: string }) {
  const cfg = MARKETS[market as MarketId];
  const [amount, setAmount] = useState('3000');
  const [method, setMethod] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const sym = cfg?.currencySymbol ?? '$';
  const currency = cfg?.currency ?? 'USD';

  const numAmount = parseFloat(amount) || 0;
  const isValid = numAmount >= MIN_USD && method;

  const handleSubmit = async () => {
    if (!isValid || !auth?.currentUser || !db) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'topupRequests'), {
        uid: auth.currentUser.uid,
        market,
        amount: numAmount,
        currency,
        method,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg0, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>✅</Text>
        <Text style={{ color: T.text0, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>Request Submitted!</Text>
        <Text style={{ color: T.text2, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
          Our team will review your top-up request and credit your account within 24–48 hours.
        </Text>
        <View style={{ marginTop: 24, backgroundColor: T.bg2, borderRadius: T.radiusLg, padding: 16, width: '100%', borderWidth: 1, borderColor: T.border }}>
          <Row label="Market" value={cfg?.name ?? market} />
          <Row label="Amount" value={`${sym}${numAmount.toLocaleString()}`} />
          <Row label="Method" value={METHODS.find((m) => m.id === method)?.label ?? method ?? ''} />
          <Row label="Status" value="Pending review" color={T.yellow} />
        </View>
        <Text style={{ color: T.text3, fontSize: 12, marginTop: 16, textAlign: 'center' }}>
          Questions? Contact support@theatharvacapital.com
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg0 }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}>
      {/* Market info */}
      <View style={{ backgroundColor: T.bg1, borderRadius: T.radiusLg, padding: 16, borderWidth: 1, borderColor: T.border }}>
        <Text style={{ color: T.text3, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Top-up for</Text>
        <Text style={{ color: T.text0, fontSize: 18, fontWeight: '800' }}>{cfg?.flag} {cfg?.name ?? market}</Text>
        <Text style={{ color: T.text2, fontSize: 12, marginTop: 2 }}>Currency: {currency} · Min: ${MIN_USD.toLocaleString()} USD</Text>
      </View>

      {/* Amount */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: T.text2, fontSize: 13, fontWeight: '600' }}>Amount (USD)</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          style={{
            backgroundColor: T.bg1, borderRadius: T.radiusMd, paddingHorizontal: 14, paddingVertical: 12,
            color: T.text0, fontSize: 18, fontWeight: '700', borderWidth: 1,
            borderColor: numAmount < MIN_USD && amount ? T.red : T.border,
          }}
          placeholder={`Min $${MIN_USD.toLocaleString()}`}
          placeholderTextColor={T.text3}
        />
        {numAmount > 0 && numAmount < MIN_USD && (
          <Text style={{ color: T.red, fontSize: 12 }}>Minimum top-up is ${MIN_USD.toLocaleString()} USD</Text>
        )}
        {numAmount >= MIN_USD && (
          <Text style={{ color: T.green, fontSize: 12 }}>≈ {sym}{numAmount.toLocaleString()} {currency}</Text>
        )}
      </View>

      {/* Payment method */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: T.text2, fontSize: 13, fontWeight: '600' }}>Payment Method</Text>
        {METHODS.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setMethod(m.id)}
            style={{
              backgroundColor: T.bg1, borderRadius: T.radiusMd, padding: 14,
              flexDirection: 'row', alignItems: 'center', gap: 14,
              borderWidth: 1.5,
              borderColor: method === m.id ? T.yellow : T.border,
            }}
          >
            <Text style={{ fontSize: 26 }}>{m.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: T.text0, fontWeight: '700', fontSize: 14 }}>{m.label}</Text>
              <Text style={{ color: T.text3, fontSize: 12, marginTop: 2 }}>{m.sub}</Text>
            </View>
            <View style={{
              width: 20, height: 20, borderRadius: 10,
              borderWidth: 2, borderColor: method === m.id ? T.yellow : T.border,
              backgroundColor: method === m.id ? T.yellow : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {method === m.id && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#000' }} />}
            </View>
          </Pressable>
        ))}
      </View>

      {/* Submit */}
      <Pressable
        onPress={handleSubmit}
        disabled={!isValid || loading}
        style={{
          backgroundColor: isValid ? T.yellow : T.bg3, borderRadius: T.radiusMd,
          paddingVertical: 16, alignItems: 'center', marginTop: 8,
          borderWidth: isValid ? 0 : 1, borderColor: T.border,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={{ color: isValid ? '#000' : T.text3, fontWeight: '800', fontSize: 16 }}>
            {isValid ? `Submit Top-Up Request` : `Select amount & method`}
          </Text>
        )}
      </Pressable>

      <Text style={{ color: T.text3, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
        Your request will be reviewed by our team within 24–48 hours.
        Funds will be credited to your {market} trading wallet.
      </Text>
    </ScrollView>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{ color: T.text2, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: color ?? T.text0, fontWeight: '600', fontSize: 13 }}>{value}</Text>
    </View>
  );
}
