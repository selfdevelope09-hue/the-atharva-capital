import { Redirect, type Href } from 'expo-router';
import React from 'react';

export default function MarketsIndex() {
  return <Redirect href={'/v2' as Href} />;
}
