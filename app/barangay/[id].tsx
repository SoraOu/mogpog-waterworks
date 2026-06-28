import React, { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  TextInput,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, useNavigation } from 'expo-router';
import {
  getAccountsByBarangay,
  markNoReading,
  currentMonth,
  getSetting,
  SortField,
  SortDir,
} from '../../db/queries';
import { Account } from '../../types';
import AccountRow from '../../components/AccountRow';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

export default function BarangayScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const load = useCallback(() => {
    navigation.setOptions({ title: decodeURIComponent(name ?? 'Accounts') });
    setAccounts(getAccountsByBarangay(Number(id), sortField, sortDir));
  }, [id, name, sortField, sortDir]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function handleMarkNoReading(account: Account) {
    const month = currentMonth();
    const readerName = getSetting('reader_name');
    Alert.alert(
      'Mark as No Reading',
      `Mark "${account.subscriberName}" as No Reading for ${month}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            markNoReading(account.id, month, readerName);
            load();
          },
        },
      ]
    );
  }

  const filtered = accounts.filter((a) =>
    a.subscriberName.toLowerCase().includes(query.toLowerCase())
  );

  const done = accounts.filter((a) => a.currentMonthStatus !== 'gray').length;
  const issues = accounts.filter((a) => ['orange', 'red'].includes(a.currentMonthStatus)).length;
  const pending = accounts.filter((a) => a.currentMonthStatus === 'gray').length;

  const sortLabel = (field: SortField) => {
    if (sortField !== field) return field === 'name' ? 'A-Z' : 'Status';
    if (field === 'name') return sortDir === 'asc' ? 'A-Z ↑' : 'Z-A ↓';
    return sortDir === 'asc' ? 'Status ↑' : 'Status ↓';
  };

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

      {/* Sort + Add */}
      <View style={styles.toolbar}>
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Sort:</Text>
          <TouchableOpacity
            style={[styles.sortBtn, sortField === 'name' && styles.sortBtnActive]}
            onPress={() => toggleSort('name')}
          >
            <Text style={[styles.sortBtnText, sortField === 'name' && styles.sortBtnTextActive]}>
              {sortLabel('name')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, sortField === 'status' && styles.sortBtnActive]}
            onPress={() => toggleSort('status')}
          >
            <Text style={[styles.sortBtnText, sortField === 'status' && styles.sortBtnTextActive]}>
              {sortLabel('status')}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push(`/account/add?barangayId=${id}&barangayName=${encodeURIComponent(name ?? '')}`)}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
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
            onLongPress={() => handleMarkNoReading(item)}
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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sortLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },
  sortBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortBtnText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },
  sortBtnTextActive: { color: '#fff' },
  addBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
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
