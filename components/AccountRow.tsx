import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Account } from '../types';
import { Colors, Spacing, FontSize, Radius } from '../constants/theme';
import StatusDot from './StatusDot';

interface Props {
  account: Account;
  onPress: () => void;
  onLongPress?: () => void;
}

const typeBadgeColor: Record<string, string> = {
  Residential: Colors.primaryLight,
  Commercial: Colors.accent,
};

export default function AccountRow({ account, onPress, onLongPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <StatusDot status={account.currentMonthStatus} size={12} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {account.subscriberName}
        </Text>
        <View style={styles.meta}>
          <View style={[styles.badge, { backgroundColor: typeBadgeColor[account.type] ?? Colors.gray }]}>
            <Text style={styles.badgeText}>{account.type}</Text>
          </View>
          {account.previousReading !== null && (
            <Text style={styles.reading}>Prev: {account.previousReading} m³</Text>
          )}
        </View>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  info: { flex: 1, gap: 4 },
  name: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  badgeText: { fontSize: FontSize.xs, color: '#fff', fontWeight: '600' },
  reading: { fontSize: FontSize.sm, color: Colors.textSecondary },
  arrow: { fontSize: 20, color: Colors.textMuted },
});
