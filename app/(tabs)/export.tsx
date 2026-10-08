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
import {
  getAccountsForExport,
  getAllBarangaysForExport,
  getOverallProgress,
  getReadingYears,
  currentMonth,
} from '../../db/queries';
import { buildOfficialWorkbook } from '../../excel/exportWorkbook';
import { bytesToBase64 } from '../../excel/base64';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

type BarangayMeta = { id: number; name: string };

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function monthLabel(m: string): string {
  const [y, mo] = m.split('-');
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long' });
}

function yearOptions(): number[] {
  const now = new Date().getFullYear();
  const set = new Set<number>([now, now - 1, ...getReadingYears()]);
  return Array.from(set).sort((a, b) => b - a);
}

export default function ExportScreen() {
  const [barangays, setBarangays] = useState<BarangayMeta[]>([]);
  const [progress, setProgress] = useState({ total: 0, done: 0 });
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [years, setYears] = useState<number[]>([]);
  const month = currentMonth();

  const load = useCallback(() => {
    setBarangays(getAllBarangaysForExport());
    setProgress(getOverallProgress(currentMonth()));
    setYears(yearOptions());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // barangay omitted => every subscriber, in one file
  async function doExport(key: string, barangay?: BarangayMeta) {
    setLoading(key);
    try {
      // let the spinner render before the heavy synchronous work
      await new Promise((r) => setTimeout(r, 50));

      const accounts = getAccountsForExport(selectedYear, barangay?.id);
      if (accounts.length === 0) {
        Alert.alert('Nothing to export', 'There are no subscribers to export yet.');
        return;
      }

      const bytes = buildOfficialWorkbook(accounts, selectedYear);
      const b64 = bytesToBase64(bytes);

      const safeBarangay = barangay ? '_' + barangay.name.replace(/[^A-Za-z0-9]+/g, '_') : '';
      const filename = `WATER_READING_SYSTEM${safeBarangay}_${selectedYear}.xlsx`;
      const path = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(path, {
        mimeType: XLSX_MIME,
        dialogTitle: barangay ? `Export – ${barangay.name}` : 'Export – All Barangays',
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Export failed', String(e));
    } finally {
      setLoading(null);
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Year picker */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Export Year</Text>
        <Text style={styles.hint}>
          The file is the official WATER READING SYSTEM workbook: all 12 months of the year, with the
          workbook's own formulas for CU.M USED and AMOUNT.
        </Text>
        <TouchableOpacity style={styles.monthBtn} onPress={() => setShowYearPicker(true)}>
          <Text style={styles.monthBtnText}>{selectedYear}</Text>
          <Text style={styles.monthBtnChevron}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* Overall progress (current month) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Progress – {monthLabel(month)}</Text>
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
        onPress={() => doExport('all')}
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
            onPress={() => doExport(b.name, b)}
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

      {/* Year picker modal */}
      <Modal
        visible={showYearPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowYearPicker(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowYearPicker(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Select Year</Text>
          <ScrollView>
            {years.map((y) => (
              <TouchableOpacity
                key={y}
                style={[styles.monthOption, y === selectedYear && styles.monthOptionActive]}
                onPress={() => { setSelectedYear(y); setShowYearPicker(false); }}
              >
                <Text style={[styles.monthOptionText, y === selectedYear && styles.monthOptionTextActive]}>
                  {y}
                </Text>
                {y === selectedYear && <Text style={styles.checkmark}>✓</Text>}
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
  hint: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
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