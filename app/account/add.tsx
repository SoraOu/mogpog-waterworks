import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  createAccount,
  createBarangay,
  getAllBarangayNames,
} from '../../db/queries';
import { LineStatus, MeterStatus, AccountType } from '../../types';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

const LINE_STATUSES: LineStatus[] = ['Operational', 'Disconnected', 'No Occupant', 'Temporary Closed'];
const METER_STATUSES: MeterStatus[] = ['In-service', 'Blurred'];
const ACCOUNT_TYPES: AccountType[] = ['Residential', 'Commercial'];

export default function AddAccountScreen() {
  const { barangayId, barangayName } = useLocalSearchParams<{ barangayId: string; barangayName: string }>();
  const router = useRouter();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('Residential');
  const [lineStatus, setLineStatus] = useState<LineStatus>('Operational');
  const [meterStatus, setMeterStatus] = useState<MeterStatus>('In-service');
  const [newBarangayName, setNewBarangayName] = useState('');
  const [createNewBarangay, setCreateNewBarangay] = useState(false);

  const decodedBarangayName = decodeURIComponent(barangayName ?? '');

  function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter the subscriber name.');
      return;
    }

    let targetBarangayId = Number(barangayId);

    if (createNewBarangay) {
      if (!newBarangayName.trim()) {
        Alert.alert('Barangay name required', 'Please enter the new barangay name.');
        return;
      }
      targetBarangayId = createBarangay(newBarangayName.trim());
    }

    createAccount({
      barangayId: targetBarangayId,
      subscriberName: name.trim(),
      type,
      lineStatus,
      meterStatus,
    });

    Alert.alert('Account created', `"${name.trim()}" has been added.`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>New Account</Text>
        <Text style={styles.barangayNote}>
          Barangay: <Text style={styles.barangayName}>{decodedBarangayName}</Text>
        </Text>
      </View>

      <Text style={styles.fieldLabel}>Subscriber Name *</Text>
      <TextInput
        style={styles.textInput}
        value={name}
        onChangeText={setName}
        placeholder="Full name of subscriber"
        placeholderTextColor={Colors.textMuted}
      />

      <Text style={styles.fieldLabel}>Account Type</Text>
      <View style={styles.optionRow}>
        {ACCOUNT_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.optionChip, type === t && styles.optionChipActive]}
            onPress={() => setType(t)}
          >
            <Text style={[styles.optionChipText, type === t && styles.optionChipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Line Status</Text>
      <View style={styles.optionRow}>
        {LINE_STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.optionChip, lineStatus === s && styles.optionChipActive]}
            onPress={() => setLineStatus(s)}
          >
            <Text style={[styles.optionChipText, lineStatus === s && styles.optionChipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Meter Status</Text>
      <View style={styles.optionRow}>
        {METER_STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.optionChip, meterStatus === s && styles.optionChipActive]}
            onPress={() => setMeterStatus(s)}
          >
            <Text style={[styles.optionChipText, meterStatus === s && styles.optionChipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Option to create new barangay */}
      <TouchableOpacity
        style={styles.newBarangayToggle}
        onPress={() => setCreateNewBarangay((v) => !v)}
      >
        <View style={[styles.checkbox, createNewBarangay && styles.checkboxActive]}>
          {createNewBarangay && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.newBarangayLabel}>Assign to a different / new barangay</Text>
      </TouchableOpacity>

      {createNewBarangay && (
        <>
          <Text style={styles.fieldLabel}>New Barangay Name</Text>
          <TextInput
            style={styles.textInput}
            value={newBarangayName}
            onChangeText={setNewBarangayName}
            placeholder="e.g. Barangay Puting Buhangin"
            placeholderTextColor={Colors.textMuted}
          />
        </>
      )}

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Create Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  barangayNote: { fontSize: FontSize.sm, color: Colors.textSecondary },
  barangayName: { fontWeight: '700', color: Colors.primary },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
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
  newBarangayToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkbox: {
    width: 22, height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: '#fff', fontWeight: '800', fontSize: FontSize.sm },
  newBarangayLabel: { fontSize: FontSize.md, color: Colors.textPrimary },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 4,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: FontSize.lg },
});
