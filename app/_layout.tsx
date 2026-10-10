import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDb } from '../db/schema';
import { Colors } from '../constants/theme';

export default function RootLayout() {
  useEffect(() => {
    initDb();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="barangay/[id]" options={{ title: 'Accounts' }} />
        <Stack.Screen name="account/[id]" options={{ title: 'Account Detail' }} />
        <Stack.Screen name="reading/[id]" options={{ title: 'Add Reading' }} />
        <Stack.Screen name="receipt/[id]" options={{ title: 'Receipt' }} />
        <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
        <Stack.Screen name="account/add" options={{ title: 'Add Account' }} />
      </Stack>
    </>
  );
}
