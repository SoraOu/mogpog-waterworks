import React, { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  TextInput,
  StyleSheet,
  Text,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getAllBarangays } from '../../db/queries';
import { Barangay } from '../../types';
import BarangayRow from '../../components/BarangayRow';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setBarangays(getAllBarangays());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
    setRefreshing(false);
  };

  const filtered = barangays.filter((b) =>
    b.name.toLowerCase().includes(query.toLowerCase())
  );

  const totalAccounts = barangays.reduce((s, b) => s + b.totalAccounts, 0);
  const totalDone = barangays.reduce((s, b) => s + b.doneCount, 0);
  const totalIssues = barangays.reduce((s, b) => s + b.issueCount, 0);

  return (
    <View style={styles.container}>
      {/* Summary banner */}
      <View style={styles.banner}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{totalAccounts}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: Colors.green }]}>{totalDone}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: Colors.orange }]}>{totalIssues}</Text>
          <Text style={styles.statLabel}>Issues</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: Colors.gray }]}>{totalAccounts - totalDone}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search barangay..."
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(b) => String(b.id)}
        renderItem={({ item }) => (
          <BarangayRow
            barangay={item}
            onPress={() => router.push(`/barangay/${item.id}?name=${encodeURIComponent(item.name)}`)}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No barangays yet</Text>
            <Text style={styles.emptyBody}>Go to Import to load the subscriber list.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  banner: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 4 },
  searchWrap: { padding: Spacing.sm, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  search: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  empty: { padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  emptyBody: { fontSize: FontSize.md, color: Colors.textMuted, textAlign: 'center' },
});
