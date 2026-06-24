import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getAccount, getReadingsForAccount, saveReading, currentMonth } from '../../db/queries';
import { Account, Reading, ReadingRemark } from '../../types';
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

export default function ReadingEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [account, setAccount] = useState<Account | null>(null);
  const [presentValue, setPresentValue] = useState('');
  const [remark, setRemark] = useState<ReadingRemark>('No issue');
  const [notes, setNotes] = useState('');
  const [readerName, setReaderName] = useState('');
  const [saved, setSaved] = useState(false);

  const month = currentMonth();

  const load = useCallback(() => {
    const a = getAccount(Number(id));
    setAccount(a);

    // Pre-fill if existing reading this month
    const readings = getReadingsForAccount(Number(id));
    const existing = readings.find((r) => r.month === month);
    if (existing) {
      setPresentValue(existing.presentReading != null ? String(existing.presentReading) : '');
      setRemark(existing.remark ?? 'No issue');
      setNotes(existing.notes ?? '');
      setReaderName(existing.recordedBy ?? '');
    }
  }, [id, month]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!account) return null;

  const prev = account.previousReading;
  const present = parseFloat(presentValue);
  const consumption = !isNaN(present) && prev !== null ? present - prev : null;
  const isHighConsumption = consumption !== null && consumption > 50;

  function numpadPress(key: string) {
    if (key === '⌫') {
      setPresentValue((v) => v.slice(0, -1));
    } else if (key === '.') {
      if (!presentValue.includes('.')) setPresentValue((v) => v + '.');
    } else {
      setPresentValue((v) => (v.length < 8 ? v + key : v));
    }
  }

  function handleSave() {
    if (remark !== 'No reading' && remark !== 'No occupant' && remark !== 'Blurred meter' && presentValue === '') {
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
    const finalRemark: ReadingRemark = isHighConsumption && remark === 'No issue' ? 'High consumption' : remark;

    saveReading({
      accountId: Number(id),
      month,
      previousReading: prev,
      presentReading: presentNum,
      consumption: cons,
      remark: finalRemark,
      notes: notes.trim() || null,
      recordedBy: readerName.trim() || null,
    });

    setSaved(true);
    setTimeout(() => router.back(), 600);
  }

  const numpadKeys = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

      {/* Consumption */}
      {consumption !== null && (
        <View style={[styles.consumptionBadge, isHighConsumption ? styles.consumptionHigh : styles.consumptionNormal]}>
          <Text style={[styles.consumptionText, isHighConsumption && { color: Colors.red }]}>
            {isHighConsumption ? '⚠️  ' : '✓  '}Consumption: {consumption} m³
            {isHighConsumption ? '  — HIGH' : ''}
          </Text>
        </View>
      )}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

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
});
