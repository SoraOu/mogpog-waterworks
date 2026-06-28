import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  getAccount,
  getReadingsForAccount,
  updateAccountDetails,
  deleteAccount,
  deleteReading,
} from '../../db/queries';
import { Account, Reading, LineStatus, MeterStatus } from '../../types';
import StatusDot from '../../components/StatusDot';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long' });
}

function readingStatusColor(r: Reading) {
  if (r.presentReading === null) return 'orange' as const;
  if (r.remark && r.remark !== 'No issue') return 'orange' as const;
  return 'green' as const;
}

const LINE_STATUSES: LineStatus[] = ['Operational', 'Disconnected', 'No Occupant', 'Temporary Closed'];
const METER_STATUSES: MeterStatus[] = ['In-service', 'Blurred'];

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [selectedReading, setSelectedReading] = useState<Reading | null>(null);

  // Edit account modal
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLine, setEditLine] = useState<LineStatus>('Operational');
  const [editMeter, setEditMeter] = useState<MeterStatus>('In-service');
  const [editPrevReading, setEditPrevReading] = useState('');

  const load = useCallback(() => {
    const a = getAccount(Number(id));
    setAccount(a);
    setReadings(getReadingsForAccount(Number(id)));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!account) return null;

  const lineStatusColor: Record<string, string> = {
    Operational: Colors.green,
    Disconnected: Colors.red,
    'No Occupant': Colors.orange,
    'Temporary Closed': Colors.orange,
  };

  function openEdit() {
    setEditName(account!.subscriberName);
    setEditLine(account!.lineStatus);
    setEditMeter(account!.meterStatus);
    setEditPrevReading(account!.previousReading != null ? String(account!.previousReading) : '');
    setShowEdit(true);
  }

  function saveEdit() {
    if (!editName.trim()) {
      Alert.alert('Name required', 'Subscriber name cannot be empty.');
      return;
    }
    updateAccountDetails(Number(id), {
      subscriberName: editName.trim(),
      lineStatus: editLine,
      meterStatus: editMeter,
      previousReading: editPrevReading !== '' ? parseFloat(editPrevReading) : null,
    });
    setShowEdit(false);
    load();
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      `Delete "${account!.subscriberName}" and all its readings? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteAccount(Number(id));
            router.back();
          },
        },
      ]
    );
  }

  function handleDeleteReading(r: Reading) {
    Alert.alert(
      'Delete Reading',
      `Delete the reading for ${monthLabel(r.month)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteReading(Number(id), r.month);
            setSelectedReading(null);
            load();
          },
        },
      ]
    );
  }

  // Always opens reading form — month picker inside lets them choose
  function handleAddReading() {
    router.push(`/reading/${id}`);
  }

  // Directly edit a specific month's reading
  function handleEditReading(r: Reading) {
    setSelectedReading(null);
    router.push(`/reading/${id}?month=${r.month}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Subscriber info card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.subscriberName}>{account.subscriberName}</Text>
            <TouchableOpacity style={styles.editAccountBtn} onPress={openEdit}>
              <Text style={styles.editAccountBtnText}>✏️ Edit</Text>
            </TouchableOpacity>
          </View>
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
          <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleDeleteAccount}>
            <Text style={styles.deleteAccountBtnText}>🗑 Delete Account</Text>
          </TouchableOpacity>
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
              {/* Inline edit button */}
              <TouchableOpacity
                style={styles.editReadingBtn}
                onPress={() => handleEditReading(r)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.editReadingBtnText}>Edit ›</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Add Reading FAB — always visible, month picker inside reading form */}
      <View style={styles.fabWrap}>
        <TouchableOpacity
          style={styles.fab}
          onPress={handleAddReading}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>+ Add Reading</Text>
        </TouchableOpacity>
      </View>

      {/* Reading detail modal (view + delete only) */}
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
              />
              {selectedReading.remark && <DetailItem label="Remark" value={selectedReading.remark} />}
              {selectedReading.notes && <DetailItem label="Notes" value={selectedReading.notes} />}
              {selectedReading.recordedBy && <DetailItem label="Recorded by" value={selectedReading.recordedBy} />}
              {selectedReading.dateRecorded && (
                <DetailItem label="Date" value={new Date(selectedReading.dateRecorded).toLocaleString('en-PH')} />
              )}
            </View>
            <TouchableOpacity style={styles.deleteReadingBtn} onPress={() => handleDeleteReading(selectedReading)}>
              <Text style={styles.deleteReadingBtnText}>🗑 Delete Reading</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedReading(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      {/* Edit account modal */}
      <Modal visible={showEdit} transparent animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowEdit(false)} />
        <ScrollView style={styles.editSheet} contentContainerStyle={styles.editSheetContent}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Edit Account</Text>

          <Text style={styles.fieldLabel}>Subscriber Name</Text>
          <TextInput
            style={styles.textInput}
            value={editName}
            onChangeText={setEditName}
            placeholder="Subscriber name"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.fieldLabel}>Line Status</Text>
          <View style={styles.optionRow}>
            {LINE_STATUSES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.optionChip, editLine === s && styles.optionChipActive]}
                onPress={() => setEditLine(s)}
              >
                <Text style={[styles.optionChipText, editLine === s && styles.optionChipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Meter Status</Text>
          <View style={styles.optionRow}>
            {METER_STATUSES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.optionChip, editMeter === s && styles.optionChipActive]}
                onPress={() => setEditMeter(s)}
              >
                <Text style={[styles.optionChipText, editMeter === s && styles.optionChipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Previous Reading (m³)</Text>
          <TextInput
            style={styles.textInput}
            value={editPrevReading}
            onChangeText={setEditPrevReading}
            placeholder="e.g. 123.5"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numeric"
          />

          <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEdit(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
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
      <Text style={[styles.detailValue, highlight && { color: Colors.red }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  subscriberName: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary, flex: 1 },
  editAccountBtn: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editAccountBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  infoGrid: { gap: Spacing.xs },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  deleteAccountBtn: { marginTop: Spacing.sm, paddingVertical: Spacing.sm, alignItems: 'center' },
  deleteAccountBtnText: { color: Colors.red, fontWeight: '600', fontSize: FontSize.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  emptyReadings: { padding: Spacing.lg, alignItems: 'center' },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  readingInfo: { flex: 1, gap: 2 },
  readingMonth: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  readingMeta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  editReadingBtn: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editReadingBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '700' },
  fabWrap: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  fab: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontWeight: '800', fontSize: FontSize.md },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  editSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: '85%',
  },
  editSheetContent: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  sheetHandle: {
    width: 40, height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.sm },
  readingDetail: { gap: 8, marginVertical: Spacing.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  detailValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  deleteReadingBtn: { paddingVertical: Spacing.sm, alignItems: 'center' },
  deleteReadingBtnText: { color: Colors.red, fontWeight: '600' },
  closeBtn: { paddingVertical: Spacing.sm, alignItems: 'center' },
  closeBtnText: { color: Colors.textMuted, fontWeight: '600' },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  optionChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionChipText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  optionChipTextActive: { color: '#fff' },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: FontSize.md },
  cancelBtn: { paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelBtnText: { color: Colors.textMuted, fontWeight: '600' },
});