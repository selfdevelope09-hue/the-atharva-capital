/**
 * Chat Window — Instagram DM-style message thread.
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { auth } from '@/config/firebaseConfig';
import {
  getOtherParticipantUid,
  markConversationRead,
  sendMessage,
  subscribeMessages,
  type ChatMessage,
} from '@/services/firebase/chatRepository';
import { getProfile, type UserProfile } from '@/services/firebase/userProfileRepository';
import { T } from '@/src/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  conversationId: string;
  otherUid?: string;
}

function Avatar({ url, name, size = 36 }: { url: string; name: string; size?: number }) {
  const initials = name ? name[0].toUpperCase() : '?';
  const [err, setErr] = React.useState(false);

  if (url && !err) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: T.bg3, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: T.yellow, fontSize: size * 0.38, fontWeight: '800' }}>{initials}</Text>
    </View>
  );
}

function timeStr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function ChatWindowScreen({ conversationId, otherUid }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const myUid = auth?.currentUser?.uid ?? '';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [otherProfile, setOtherProfile] = useState<UserProfile | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const [resolvedOtherUid, setResolvedOtherUid] = useState<string | undefined>(otherUid);

  useEffect(() => {
    if (otherUid) {
      setResolvedOtherUid(otherUid);
      return;
    }
    void getOtherParticipantUid(conversationId).then((uid) => {
      if (uid) setResolvedOtherUid(uid);
    });
  }, [conversationId, otherUid]);

  useEffect(() => {
    if (!resolvedOtherUid) return;
    getProfile(resolvedOtherUid).then(setOtherProfile);
  }, [resolvedOtherUid]);

  // Subscribe to messages
  useEffect(() => {
    const unsub = subscribeMessages(conversationId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => unsub();
  }, [conversationId]);

  // Mark as read on open
  useEffect(() => {
    if (conversationId && myUid) {
      markConversationRead(conversationId);
    }
  }, [conversationId, myUid]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(conversationId, text.trim());
      setText('');
    } catch {
      // silently fail
    } finally {
      setSending(false);
    }
  };

  const renderMsg = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMine = item.senderId === myUid;
    const prevMsg = messages[index - 1];
    const showTime = !prevMsg || (new Date(item.sentAt).getTime() - new Date(prevMsg.sentAt).getTime()) > 5 * 60 * 1000;

    return (
      <View>
        {showTime && (
          <Text style={{ color: T.text3, fontSize: 11, textAlign: 'center', marginVertical: 8 }}>
            {timeStr(item.sentAt)}
          </Text>
        )}
        <View style={{
          flexDirection: isMine ? 'row-reverse' : 'row',
          alignItems: 'flex-end',
          gap: 8,
          marginHorizontal: 12,
          marginVertical: 2,
        }}>
          {!isMine && (
            <Avatar
              url={otherProfile?.photoURL ?? ''}
              name={otherProfile?.displayName ?? '?'}
              size={28}
            />
          )}
          <View style={{
            maxWidth: '76%',
            backgroundColor: isMine ? T.yellow : T.bg2,
            borderRadius: 22,
            borderBottomRightRadius: isMine ? 6 : 22,
            borderBottomLeftRadius: isMine ? 22 : 6,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderWidth: isMine ? 0 : 1,
            borderColor: T.border,
            ...(isMine && Platform.OS === 'web'
              ? { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }
              : isMine
                ? { elevation: 2 }
                : {}),
          }}>
            <Text style={{ color: isMine ? '#000' : T.text0, fontSize: 14, lineHeight: 20 }}>
              {item.text}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T.bg0 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 + insets.top : 0}
    >
      {/* Top bar — DM-style */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 12, paddingVertical: 12, paddingTop: 8 + insets.top,
        borderBottomWidth: 1, borderBottomColor: T.border,
        backgroundColor: T.bg0,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 6 }}>
          <Text style={{ color: T.text0, fontSize: 26, fontWeight: '300', lineHeight: 28 }}>‹</Text>
        </Pressable>
        <View style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 22, padding: 1 }}>
          <Avatar url={otherProfile?.photoURL ?? ''} name={otherProfile?.displayName ?? '?'} size={36} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.text0, fontWeight: '800', fontSize: 16, letterSpacing: -0.2 }}>
            {otherProfile?.displayName ?? 'Messages'}
          </Text>
          {otherProfile ? (
            <Text style={{ color: T.text3, fontSize: 11, marginTop: 2 }}>Direct message</Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => {
            const uid = resolvedOtherUid ?? otherUid;
            if (uid) router.push(`/profile/${uid}` as never);
          }}
          disabled={!(resolvedOtherUid ?? otherUid)}
          style={{ paddingVertical: 8, paddingHorizontal: 4 }}
        >
          <Text style={{ color: T.yellow, fontSize: 13, fontWeight: '700' }}>Profile</Text>
        </Pressable>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMsg}
        style={{ flex: 1, backgroundColor: T.bg0 }}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 12, flexGrow: 1 }}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <Text style={{ fontSize: 40 }}>👋</Text>
            <Text style={{ color: T.text2, marginTop: 8 }}>Say hello!</Text>
          </View>
        }
      />

      {/* Input — pill composer */}
      <View style={{
        flexDirection: 'row', alignItems: 'flex-end', gap: 10,
        paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 10 + insets.bottom,
        borderTopWidth: 1, borderTopColor: T.border,
        backgroundColor: T.bg0,
      }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor={T.text3}
          multiline
          style={{
            flex: 1, backgroundColor: T.bg1, borderRadius: 24,
            paddingHorizontal: 18, paddingVertical: 12,
            color: T.text0, fontSize: 15, maxHeight: 120,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}
          onSubmitEditing={Platform.OS === 'web' ? handleSend : undefined}
        />
        <Pressable
          onPress={handleSend}
          disabled={!text.trim() || sending}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: text.trim() ? T.yellow : T.bg3,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 2,
          }}
        >
          <Text style={{ color: text.trim() ? '#000' : T.text3, fontSize: 20 }}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
