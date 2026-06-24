import React, { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  TextInput,
  Text,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { getAccountsByBarangay } from '../../db/queries';
import { Account } from '../../types';
import AccountRow from '../../components/AccountRow';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

export default function BarangayScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: decodeURIComponent(name ?? 'Accounts') });
      setAccounts(getAccountsByBarangay(Number(id)));
    }, [id, name])
  );

  const filtered = accounts.filter((a) =>
    a.subscriberName.toLowerCase().includes(query.toLowerCase())
  );

  const done = accounts.filter((a) => a.currentMonthStatus !== 'gray').length;
  const issues = accounts.filter((a) => ['orange', 'red'].includes(a.currentMonthStatus)).length;
  const pending = accounts.filter((a) => a.currentMonthStatus === 'gray').length;

  return (
    <View style={styles.container}>
      {/* Counters */}
      <View style={styles.counters}>
        <View style={[styles.chip, { backgroundColor: Colors.greenLight }]}>
          <Text style={[styles.chipNum, { color: Colors.green }]}>{done}</Text>
          <Text style={[styles.chipLabel, { color: Colors.green }]}>Done</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: Colors.orangeLight }]}>
          <Text style={[styles.chipNum, { color: Colors.orange }]}>{issues}</Text>
          <Text style={[styles.chipLabel, { color: Colors.orange }]}>Issues</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: Colors.grayLight }]}>
          <Text style={[styles.chipNum, { color: Colors.gray }]}>{pending}</Text>
          <Text style={[styles.chipLabel, { color: Colors.gray }]}>Pending</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search account..."
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(a) => String(a.id)}
        renderItem={({ item }) => (
          <AccountRow
            account={item}
            onPress={() => router.push(`/account/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No accounts found.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  counters: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    gap: 2,
  },
  chipNum: { fontSize: FontSize.xl, fontWeight: '800' },
  chipLabel: { fontSize: FontSize.xs, fontWeight: '600' },
  searchWrap: {
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  search: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },
});
