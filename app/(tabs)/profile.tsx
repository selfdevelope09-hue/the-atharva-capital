import React from 'react';
import { auth } from '@/config/firebaseConfig';
import { ProfileScreen } from '@/src/screens/ProfileScreen';
import { View, Text } from 'react-native';
import { T } from '@/src/constants/theme';

export default function ProfileTab() {
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: T.text2 }}>Please log in to view your profile.</Text>
      </View>
    );
  }
  return <ProfileScreen userId={uid} />;
}
