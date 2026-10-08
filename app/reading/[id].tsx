import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  getAccount,
  getPreviousReading,
  getReadingsForAccount,
  saveReading,
  currentMonth,
  getSetting,
} from '../../db/queries';
import { Account, ReadingRemark } from '../../types';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

const REMARKS: ReadingRemark[] = [
  'No issue',
  'Blurred meter',
  'No occupant',
  'High consumption',
  'No reading',
];

const REMARK_COLORS: Record<ReadingRemark, string> = {
  'No issue': Colors.green,
  'Blurred meter': Colors.orange,
  'No occupant': Colors.orange,
  'High consumption': Colors.red,
  'No reading': Colors.gray,
};

function generateMonthOptions(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function monthLabel(m: string): string {
  const [y, mo] = m.split('-');
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long' });
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ReadingEntryScreen() {
  const { id, month: monthParam } = useLocalSearchParams<{ id: string; month?: string }>();
  const router = useRouter();

  const [account, setAccount] = useState<Account | null>(null);
  const [presentValue, setPresentValue] = useState('');
  const [remark, setRemark] = useState<ReadingRemark>('No issue');
  const [notes, setNotes] = useState('');
  const [readerName, setReaderName] = useState('');
  const [saved, setSaved] = useState(false);

  // Month selection
  const monthOptions = generateMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthParam ?? currentMonth());
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Date selection
  const [recordedDate, setRecordedDate] = useState(new Date().toISOString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDay, setTempDay] = useState(String(new Date().getDate()));
  const [tempMonth, setTempMonth] = useState(String(new Date().getMonth() + 1));
  const [tempYear, setTempYear] = useState(String(new Date().getFullYear()));

  const load = useCallback(() => {
    const a = getAccount(Number(id));
    setAccount(a);

    // Auto-fill reader name from settings
    const savedReader = getSetting('reader_name');
    if (savedReader) setReaderName(savedReader);

    // Pre-fill if existing reading for selected month
    const readings = getReadingsForAccount(Number(id));
    const existing = readings.find((r) => r.month === selectedMonth);
    if (existing) {
      setPresentValue(existing.presentReading != null ? String(existing.presentReading) : '');
      setRemark(existing.remark ?? 'No issue');
      setNotes(existing.notes ?? '');
      if (existing.recordedBy) setReaderName(existing.recordedBy);
      if (existing.dateRecorded) setRecordedDate(existing.dateRecorded);
    }
  }, [id, selectedMonth]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!account) return null;

  // Previous follows the selected month: the latest earlier present reading,
  // or the account's opening reading when there is none.
  const prev = getPreviousReading(Number(id), selectedMonth);
  const present = parseFloat(presentValue);
  const consumption = !isNaN(present) && prev !== null ? present - prev : null;

  function numpadPress(key: string) {
    if (key === '⌫') {
      setPresentValue((v) => v.slice(0, -1));
    } else if (key === '.') {
      if (!presentValue.includes('.')) setPresentValue((v) => v + '.');
    } else {
      setPresentValue((v) => (v.length < 8 ? v + key : v));
    }
  }

  function applyDatePicker() {
    const d = new Date(Number(tempYear), Number(tempMonth) - 1, Number(tempDay));
    if (isNaN(d.getTime())) {
      Alert.alert('Invalid date', 'Please enter a valid date.');
      return;
    }
    setRecordedDate(d.toISOString());
    setShowDatePicker(false);
  }

  function handleSave() {
    if (
      remark !== 'No reading' &&
      remark !== 'No occupant' &&
      remark !== 'Blurred meter' &&
      presentValue === ''
    ) {
      Alert.alert('Missing reading', 'Enter the meter reading or choose a remark like "No reading".');
      return;
    }

    const presentNum = presentValue !== '' ? parseFloat(presentValue) : null;
    if (presentNum !== null && prev !== null && presentNum < prev) {
      Alert.alert(
        'Reading is lower than previous',
        `Previous: ${prev} m³. Present: ${presentNum} m³.\nThis may indicate a meter reset. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save anyway', onPress: () => doSave(presentNum) },
        ]
      );
      return;
    }

    doSave(presentNum);
  }

  function doSave(presentNum: number | null) {
    const cons = presentNum !== null && prev !== null ? presentNum - prev : null;

    saveReading({
      accountId: Number(id),
      month: selectedMonth,
      previousReading: prev,
      presentReading: presentNum,
      consumption: cons,
      remark: remark,
      notes: notes.trim() || null,
      recordedBy: readerName.trim() || null,
      dateRecorded: recordedDate,
    });

    setSaved(true);
    setTimeout(() => router.back(), 600);
  }

  const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Subscriber name */}
      <View style={styles.subHeader}>
        <Text style={styles.subName}>{account.subscriberName}</Text>
        <Text style={styles.subBarangay}>{account.barangayName}</Text>
      </View>

      {/* Month selector */}
      <View>
        <Text style={styles.sectionLabel}>Reading Month</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowMonthPicker(true)}>
          <Text style={styles.pickerBtnText}>{monthLabel(selectedMonth)}</Text>
          <Text style={styles.pickerChevron}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* Previous vs present display */}
      <View style={styles.readingDisplay}>
        <View style={styles.readingBox}>
          <Text style={styles.readingBoxLabel}>Previous</Text>
          <Text style={styles.readingBoxValue}>{prev ?? '—'}</Text>
          <Text style={styles.readingBoxUnit}>m³</Text>
        </View>
        <View style={styles.arrow}>
          <Text style={styles.arrowText}>→</Text>
        </View>
        <View style={[styles.readingBox, styles.presentBox]}>
          <Text style={styles.readingBoxLabel}>Present</Text>
          <Text style={[styles.readingBoxValue, styles.presentValue]}>
            {presentValue || '—'}
          </Text>
          <Text style={styles.readingBoxUnit}>m³</Text>
        </View>
      </View>

      {/* Numpad */}
      <View style={styles.numpad}>
        {numpadKeys.map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.numKey, k === '⌫' && styles.numKeyDelete]}
            onPress={() => numpadPress(k)}
            activeOpacity={0.6}
          >
            <Text style={[styles.numKeyText, k === '⌫' && { color: Colors.red }]}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Remarks */}
      <Text style={styles.sectionLabel}>Remark</Text>
      <View style={styles.remarkGrid}>
        {REMARKS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[
              styles.remarkChip,
              remark === r && { backgroundColor: REMARK_COLORS[r], borderColor: REMARK_COLORS[r] },
            ]}
            onPress={() => setRemark(r)}
            activeOpacity={0.7}
          >
            <Text style={[styles.remarkText, remark === r && { color: '#fff' }]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Reading date */}
      <Text style={styles.sectionLabel}>Reading Date</Text>
      <TouchableOpacity style={styles.pickerBtn} onPress={() => {
        const d = new Date(recordedDate);
        setTempDay(String(d.getDate()));
        setTempMonth(String(d.getMonth() + 1));
        setTempYear(String(d.getFullYear()));
        setShowDatePicker(true);
      }}>
        <Text style={styles.pickerBtnText}>📅  {formatDateLabel(recordedDate)}</Text>
        <Text style={styles.pickerChevron}>▾</Text>
      </TouchableOpacity>

      {/* Reader name */}
      <Text style={styles.sectionLabel}>Meter Reader</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Name of reader..."
        placeholderTextColor={Colors.textMuted}
        value={readerName}
        onChangeText={setReaderName}
      />

      {/* Notes */}
      <Text style={styles.sectionLabel}>Notes (optional)</Text>
      <TextInput
        style={[styles.textInput, styles.notesInput]}
        placeholder="Any additional notes..."
        placeholderTextColor={Colors.textMuted}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveBtn, saved && styles.saveBtnDone]}
        onPress={handleSave}
        activeOpacity={0.85}
      >
        <Text style={styles.saveBtnText}>
          {saved ? '✓  Saved!' : 'Save Reading'}
        </Text>
      </TouchableOpacity>

      {/* Month picker modal */}
      <Modal visible={showMonthPicker} transparent animationType="slide" onRequestClose={() => setShowMonthPicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowMonthPicker(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Select Reading Month</Text>
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
        </View>
      </Modal>

      {/* Date picker modal */}
      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowDatePicker(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Select Reading Date</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>Month</Text>
              <TextInput
                style={styles.dateInput}
                value={tempMonth}
                onChangeText={setTempMonth}
                keyboardType="numeric"
                maxLength={2}
                placeholder="MM"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>Day</Text>
              <TextInput
                style={styles.dateInput}
                value={tempDay}
                onChangeText={setTempDay}
                keyboardType="numeric"
                maxLength={2}
                placeholder="DD"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>Year</Text>
              <TextInput
                style={styles.dateInput}
                value={tempYear}
                onChangeText={setTempYear}
                keyboardType="numeric"
                maxLength={4}
                placeholder="YYYY"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>
          <TouchableOpacity style={styles.applyDateBtn} onPress={applyDatePicker}>
            <Text style={styles.applyDateBtnText}>Set Date</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  subHeader: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 2,
  },
  subName: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  subBarangay: { fontSize: FontSize.sm, color: Colors.textMuted },

  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerBtnText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.primary },
  pickerChevron: { fontSize: FontSize.lg, color: Colors.textMuted },

  readingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  readingBox: { flex: 1, alignItems: 'center', gap: 2 },
  presentBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  readingBoxLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  readingBoxValue: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  presentValue: { color: Colors.primary },
  readingBoxUnit: { fontSize: FontSize.sm, color: Colors.textMuted },
  arrow: { paddingHorizontal: Spacing.xs },
  arrowText: { fontSize: FontSize.xl, color: Colors.textMuted },

  consumptionBadge: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
  },
  consumptionNormal: { backgroundColor: Colors.greenLight, borderColor: Colors.green },
  consumptionHigh: { backgroundColor: Colors.redLight, borderColor: Colors.red },
  consumptionText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.green, textAlign: 'center' },

  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  numKey: {
    width: '30%',
    aspectRatio: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  numKeyDelete: { backgroundColor: Colors.redLight, borderColor: Colors.red },
  numKeyText: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },

  sectionLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  remarkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  remarkChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  remarkText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },

  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  notesInput: { minHeight: 80 },

  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 4,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnDone: { backgroundColor: Colors.green },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: FontSize.lg },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sheetHandle: {
    width: 40, height: 4,
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

  dateRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
  dateField: { flex: 1, gap: Spacing.xs },
  dateFieldLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', textAlign: 'center' },
  dateInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  applyDateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  applyDateBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
});
