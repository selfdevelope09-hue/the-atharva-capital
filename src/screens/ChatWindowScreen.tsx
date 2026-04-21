/**
 * Chat Window — Instagram DM-style message thread.
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { auth } from '@/config/firebaseConfig';
import {
  markConversationRead,
  sendMessage,
  subscribeMessages,
  type ChatMessage,
} from '@/services/firebase/chatRepository';
import { getProfile, type UserProfile } from '@/services/firebase/userProfileRepository';
import { T } from '@/src/constants/theme';

interface Props {
  conversationId: string;
  otherUid?: string;
}

function Avatar({ url, name, size = 36 }: { url: string; name: string; size?: number }) {
  const initials = name ? name[0].toUpperCase() : '?';
  if (url) {
    return (
      // @ts-ignore
      <img src={url} style={{ width: size, height: size, borderRadius: size / 2, objectFit: 'cover' }} alt={name} />
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
  const router = useRouter();
  const myUid = auth?.currentUser?.uid ?? '';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [otherProfile, setOtherProfile] = useState<UserProfile | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);

  // Load other user's profile
  useEffect(() => {
    if (otherUid) {
      getProfile(otherUid).then(setOtherProfile);
    }
  }, [otherUid]);

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
            maxWidth: '72%',
            backgroundColor: isMine ? T.yellow : T.bg2,
            borderRadius: 18,
            borderBottomRightRadius: isMine ? 4 : 18,
            borderBottomLeftRadius: isMine ? 18 : 4,
            paddingHorizontal: 14,
            paddingVertical: 9,
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
      keyboardVerticalOffset={60}
    >
      {/* Top bar */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: 14, borderBottomWidth: 1, borderBottomColor: T.border,
        backgroundColor: T.bg1,
      }}>
        <Pressable onPress={() => router.back()} style={{ paddingRight: 4 }}>
          <Text style={{ color: T.yellow, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Avatar url={otherProfile?.photoURL ?? ''} name={otherProfile?.displayName ?? '?'} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.text0, fontWeight: '700', fontSize: 15 }}>
            {otherProfile?.displayName ?? 'Loading…'}
          </Text>
        </View>
        <Pressable onPress={() => router.push(`/profile/${otherUid}` as never)}>
          <Text style={{ color: T.yellow, fontSize: 12 }}>View Profile</Text>
        </Pressable>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMsg}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 8 }}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <Text style={{ fontSize: 40 }}>👋</Text>
            <Text style={{ color: T.text2, marginTop: 8 }}>Say hello!</Text>
          </View>
        }
      />

      {/* Input */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        padding: 10, borderTopWidth: 1, borderTopColor: T.border,
        backgroundColor: T.bg1,
      }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor={T.text3}
          multiline
          style={{
            flex: 1, backgroundColor: T.bg2, borderRadius: 20,
            paddingHorizontal: 16, paddingVertical: 10,
            color: T.text0, fontSize: 14, maxHeight: 120,
            borderWidth: 1, borderColor: T.border,
          }}
          onSubmitEditing={Platform.OS === 'web' ? handleSend : undefined}
        />
        <Pressable
          onPress={handleSend}
          disabled={!text.trim() || sending}
          style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: text.trim() ? T.yellow : T.bg3,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ color: text.trim() ? '#000' : T.text3, fontSize: 18 }}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
