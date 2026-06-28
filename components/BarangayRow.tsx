import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Barangay } from '../types';
import { Colors, Spacing, FontSize, Radius } from '../constants/theme';

interface Props {
  barangay: Barangay;
  onPress: () => void;
}

function progressLabel(b: Barangay): string {
  if (b.totalAccounts === 0) return 'Empty';
  if (b.doneCount === 0) return 'Not started';
  if (b.doneCount >= b.totalAccounts) return 'Done';
  return 'In progress';
}

function progressColor(b: Barangay): string {
  if (b.totalAccounts === 0) return Colors.gray;
  if (b.doneCount === 0) return Colors.gray;
  if (b.doneCount >= b.totalAccounts) return Colors.green;
  return Colors.orange;
}

export default function BarangayRow({ barangay, onPress }: Props) {
  const label = progressLabel(barangay);
  const color = progressColor(barangay);
  const pct = barangay.totalAccounts > 0
    ? Math.round((barangay.doneCount / barangay.totalAccounts) * 100)
    : 0;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.left}>
        <Text style={styles.name}>{barangay.name}</Text>
        <View style={styles.counters}>
          <Text style={styles.counter}>{barangay.totalAccounts} accounts</Text>
          {barangay.issueCount > 0 && (
            <Text style={[styles.counter, { color: Colors.orange }]}>
              {barangay.issueCount} issues
            </Text>
          )}
          <Text style={[styles.counter, { color: Colors.textMuted }]}>
            {barangay.pendingCount} pending
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: color }]} />
        </View>
      </View>
      <View style={styles.right}>
        <View style={[styles.statusBadge, { backgroundColor: color }]}>
          <Text style={styles.statusText}>{label}</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  left: { flex: 1, gap: 4 },
  name: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  counters: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  counter: { fontSize: FontSize.sm, color: Colors.textSecondary },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: Radius.full },
  right: { alignItems: 'center', gap: 4 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  statusText: { fontSize: FontSize.xs, color: '#fff', fontWeight: '600' },
  arrow: { fontSize: 20, color: Colors.textMuted },
});
