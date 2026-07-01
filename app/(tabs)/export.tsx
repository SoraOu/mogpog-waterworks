import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from 'expo-router';
import * as XLSX from 'xlsx';
import {
  getAllBarangaysForExport,
  getExportData,
  getOverallProgress,
  currentMonth,
  getSetting,
} from '../../db/queries';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

type BarangayMeta = { id: number; name: string };

const EXPORT_HEADERS = [
  'Subscriber Name',
  'Type',
  'Line Status',
  'Water Meter Status',
  'Previous Reading',
  'Present Reading',
  'Consumption',
  'Remarks',
  'Year of Last Payment',
  'Month of Last Payment',
  'Remaining Balance',
];

function generateMonthOptions(): string[] {
  const year = new Date().getFullYear();
  const months: string[] = [];
  for (let m = 1; m <= 12; m++) {
    months.push(`${year}-${String(m).padStart(2, '0')}`);
  }
  return months;
}

function monthLabel(m: string): string {
  const [y, mo] = m.split('-');
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long' });
}

export default function ExportScreen() {
  const [barangays, setBarangays] = useState<BarangayMeta[]>([]);
  const [progress, setProgress] = useState({ total: 0, done: 0 });
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const monthOptions = generateMonthOptions();

  const load = useCallback(() => {
    setBarangays(getAllBarangaysForExport());
    setProgress(getOverallProgress(selectedMonth));
  }, [selectedMonth]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function buildSheet(barangayId: number) {
    const rows = getExportData(barangayId, selectedMonth);
    const data = rows.map((r) => ({
      'Subscriber Name': r.subscriberName,
      'Type': r.type,
      'Line Status': r.lineStatus,
      'Water Meter Status': r.meterStatus,
      'Previous Reading': r.previousReading ?? '',
      'Present Reading': r.presentReading ?? '',
      'Consumption': r.consumption ?? '',
      'Remarks': r.remarks ?? '',
      'Year of Last Payment': r.yearLastPayment ?? '',
      'Month of Last Payment': r.monthLastPayment ?? '',
      'Remaining Balance': r.remainingBalance ?? '',
    }));
    return XLSX.utils.json_to_sheet(data, { header: EXPORT_HEADERS });
  }

  async function exportBarangay(barangay: BarangayMeta) {
    if (progress.done === 0) {
      Alert.alert(
        'No data for this month',
        `No readings recorded for ${monthLabel(selectedMonth)}. Select a different month or record readings first.`
      );
      return;
    }
    setLoading(barangay.name);
    try {
      const readerName = getSetting('reader_name') ?? 'Mogpog_Waterworks';
      const safeName = readerName.replace(/\s+/g, '_');
      const wb = XLSX.utils.book_new();
      const ws = buildSheet(barangay.id);
      XLSX.utils.book_append_sheet(wb, ws, barangay.name);
      const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const filename = `${safeName}_${barangay.name.replace(/\s+/g, '_')}_${selectedMonth}.xlsx`;
      const path = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(path, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Export – ${barangay.name}`,
      });
    } catch (e) {
      Alert.alert('Export failed', String(e));
    } finally {
      setLoading(null);
    }
  }

  async function exportAll() {
    if (progress.done === 0) {
      Alert.alert(
        'No data for this month',
        `No readings recorded for ${monthLabel(selectedMonth)}. Select a different month or record readings first.`
      );
      return;
    }
    setLoading('all');
    try {
      const readerName = getSetting('reader_name') ?? 'Mogpog_Waterworks';
      const safeName = readerName.replace(/\s+/g, '_');
      const wb = XLSX.utils.book_new();
      for (const b of barangays) {
        const ws = buildSheet(b.id);
        XLSX.utils.book_append_sheet(wb, ws, b.name);
      }
      const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const filename = `${safeName}_All_Barangays_${selectedMonth}.xlsx`;
      const path = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(path, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export – All Barangays',
      });
    } catch (e) {
      Alert.alert('Export failed', String(e));
    } finally {
      setLoading(null);
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Month picker */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Export Month</Text>
        <TouchableOpacity style={styles.monthBtn} onPress={() => setShowMonthPicker(true)}>
          <Text style={styles.monthBtnText}>{monthLabel(selectedMonth)}</Text>
          <Text style={styles.monthBtnChevron}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* Overall progress */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Progress – {monthLabel(selectedMonth)}</Text>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>{progress.done} / {progress.total} accounts read</Text>
          <Text style={styles.pct}>{pct}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` as any }]} />
        </View>
      </View>

      {/* Export all */}
      <TouchableOpacity
        style={[styles.exportAllBtn, loading === 'all' && styles.btnDisabled]}
        onPress={exportAll}
        disabled={!!loading || barangays.length === 0}
        activeOpacity={0.8}
      >
        {loading === 'all'
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.exportAllText}>📤  Export All Barangays (1 file)</Text>
        }
      </TouchableOpacity>

      {/* Per-barangay */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Export by Barangay</Text>
        {barangays.length === 0 && (
          <Text style={styles.emptyHint}>No barangays imported yet.</Text>
        )}
        {barangays.map((b) => (
          <TouchableOpacity
            key={b.id}
            style={[styles.barangayRow, loading === b.name && styles.btnDisabled]}
            onPress={() => exportBarangay(b)}
            disabled={!!loading}
            activeOpacity={0.7}
          >
            <Text style={styles.barangayName}>{b.name}</Text>
            {loading === b.name
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Text style={styles.exportChip}>Export ›</Text>
            }
          </TouchableOpacity>
        ))}
      </View>

      {/* Month picker modal */}
      <Modal
        visible={showMonthPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowMonthPicker(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Select Month</Text>
          <ScrollView>
            {monthOptions.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.monthOption, m === selectedMonth && styles.monthOptionActive]}
                onPress={() => { setSelectedMonth(m); setShowMonthPicker(false); }}
              >
                <Text style={[styles.monthOptionText, m === selectedMonth && styles.monthOptionTextActive]}>
                  {monthLabel(m)}
                </Text>
                {m === selectedMonth && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  monthBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthBtnText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.primary },
  monthBtnChevron: { fontSize: FontSize.lg, color: Colors.textMuted },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  pct: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary },
  track: { height: 8, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: Colors.green, borderRadius: Radius.full },
  exportAllBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 4,
    alignItems: 'center',
  },
  exportAllText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
  btnDisabled: { opacity: 0.5 },
  emptyHint: { fontSize: FontSize.sm, color: Colors.textMuted },
  barangayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  barangayName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  exportChip: { fontSize: FontSize.sm, color: Colors.primaryLight, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    maxHeight: '60%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  monthOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  monthOptionActive: { backgroundColor: Colors.surfaceAlt },
  monthOptionText: { fontSize: FontSize.md, color: Colors.textPrimary },
  monthOptionTextActive: { fontWeight: '700', color: Colors.primary },
  checkmark: { color: Colors.green, fontWeight: '700', fontSize: FontSize.md },
});