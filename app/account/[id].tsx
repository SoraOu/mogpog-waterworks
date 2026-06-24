import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getAccount, getReadingsForAccount } from '../../db/queries';
import { Account, Reading } from '../../types';
import StatusDot from '../../components/StatusDot';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';
import { currentMonth } from '../../db/queries';

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long' });
}

function readingStatusColor(r: Reading) {
  if (r.presentReading === null) return 'orange' as const;
  if (r.remark === 'High consumption' || (r.consumption !== null && r.consumption > 50)) return 'red' as const;
  if (r.remark && r.remark !== 'No issue') return 'orange' as const;
  return 'green' as const;
}

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [selectedReading, setSelectedReading] = useState<Reading | null>(null);

  const load = useCallback(() => {
    const a = getAccount(Number(id));
    setAccount(a);
    setReadings(getReadingsForAccount(Number(id)));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!account) return null;

  const thisMonth = currentMonth();
  const hasCurrentReading = readings.some((r) => r.month === thisMonth);

  const lineStatusColor: Record<string, string> = {
    Operational: Colors.green,
    Disconnected: Colors.red,
    'No Occupant': Colors.orange,
    'Temporary Closed': Colors.orange,
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Subscriber info card */}
        <View style={styles.card}>
          <Text style={styles.subscriberName}>{account.subscriberName}</Text>
          <View style={styles.infoGrid}>
            <InfoRow label="Type" value={account.type} />
            <InfoRow
              label="Line Status"
              value={account.lineStatus}
              valueColor={lineStatusColor[account.lineStatus]}
            />
            <InfoRow
              label="Meter"
              value={account.meterStatus}
              valueColor={account.meterStatus === 'Blurred' ? Colors.orange : Colors.green}
            />
            <InfoRow label="Barangay" value={account.barangayName} />
            {account.yearLastPayment && (
              <InfoRow label="Last Payment" value={`${account.monthLastPayment ?? '?'} ${account.yearLastPayment}`} />
            )}
            {account.remainingBalance != null && (
              <InfoRow
                label="Balance"
                value={`₱${account.remainingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                valueColor={account.remainingBalance > 0 ? Colors.red : Colors.green}
              />
            )}
            {account.previousReading != null && (
              <InfoRow label="Previous Reading" value={`${account.previousReading} m³`} />
            )}
          </View>
        </View>

        {/* Reading history */}
        <Text style={styles.sectionTitle}>Reading History</Text>
        {readings.length === 0 && (
          <View style={styles.emptyReadings}>
            <Text style={styles.emptyText}>No readings recorded yet.</Text>
          </View>
        )}
        {readings.map((r) => {
          const color = readingStatusColor(r);
          return (
            <TouchableOpacity
              key={r.id}
              style={styles.readingRow}
              onPress={() => setSelectedReading(r)}
              activeOpacity={0.7}
            >
              <StatusDot status={color} size={10} />
              <View style={styles.readingInfo}>
                <Text style={styles.readingMonth}>{monthLabel(r.month)}</Text>
                <Text style={styles.readingMeta}>
                  {r.presentReading != null ? `${r.presentReading} m³` : '—'}
                  {r.consumption != null ? `  ·  Δ ${r.consumption} m³` : ''}
                  {r.remark && r.remark !== 'No issue' ? `  ·  ${r.remark}` : ''}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Add reading FAB */}
      <View style={styles.fabWrap}>
        <TouchableOpacity
          style={[styles.fab, hasCurrentReading && styles.fabEdit]}
          onPress={() => router.push(`/reading/${id}`)}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>
            {hasCurrentReading ? '✏️  Edit Reading' : '+ Add Reading'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Reading detail modal */}
      {selectedReading && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedReading(null)}>
          <Pressable style={styles.overlay} onPress={() => setSelectedReading(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{monthLabel(selectedReading.month)}</Text>
            <View style={styles.readingDetail}>
              <DetailItem label="Previous" value={selectedReading.previousReading != null ? `${selectedReading.previousReading} m³` : '—'} />
              <DetailItem label="Present" value={selectedReading.presentReading != null ? `${selectedReading.presentReading} m³` : '—'} />
              <DetailItem
                label="Consumption"
                value={selectedReading.consumption != null ? `${selectedReading.consumption} m³` : '—'}
                highlight={selectedReading.consumption !== null && selectedReading.consumption > 50}
              />
              {selectedReading.remark && (
                <DetailItem label="Remark" value={selectedReading.remark} />
              )}
              {selectedReading.notes && (
                <DetailItem label="Notes" value={selectedReading.notes} />
              )}
              {selectedReading.recordedBy && (
                <DetailItem label="Recorded by" value={selectedReading.recordedBy} />
              )}
              {selectedReading.dateRecorded && (
                <DetailItem label="Date" value={new Date(selectedReading.dateRecorded).toLocaleString('en-PH')} />
              )}
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => { setSelectedReading(null); router.push(`/reading/${id}`); }}
            >
              <Text style={styles.editBtnText}>Edit this reading</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedReading(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

function DetailItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && { color: Colors.red, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  subscriberName: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  infoGrid: { gap: 6 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textSecondary, paddingHorizontal: 2 },
  emptyReadings: { padding: Spacing.lg, alignItems: 'center' },
  emptyText: { color: Colors.textMuted },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  readingInfo: { flex: 1 },
  readingMonth: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  readingMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 20, color: Colors.textMuted },
  fabWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  fab: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  fabEdit: { backgroundColor: Colors.accent },
  fabText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: Radius.full, alignSelf: 'center', marginBottom: Spacing.sm },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  readingDetail: { gap: 8, marginVertical: Spacing.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  detailValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  editBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
  },
  editBtnText: { color: '#fff', fontWeight: '700' },
  closeBtn: { paddingVertical: Spacing.sm, alignItems: 'center' },
  closeBtnText: { color: Colors.textMuted, fontWeight: '600' },
});
