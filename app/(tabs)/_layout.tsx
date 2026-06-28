import { useCallback, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/theme';
import { getSetting } from '../../db/queries';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6 }}>
      {emoji}
    </Text>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const [readerName, setReaderName] = useState('Mogpog Waterworks');

  useFocusEffect(
    useCallback(() => {
      const name = getSetting('reader_name');
      setReaderName(name && name.trim() ? name.trim() : 'Mogpog Waterworks');
    }, [])
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Barangays',
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏘️" focused={focused} />,
          headerTitle: readerName,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              style={{ marginRight: 16 }}
            >
              <Text style={{ color: '#fff', fontSize: 20 }}>⚙️</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="export"
        options={{
          title: 'Export',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📤" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="import"
        options={{
          title: 'Import',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📥" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
