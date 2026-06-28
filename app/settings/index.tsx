import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getSetting, setSetting } from '../../db/queries';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const [readerName, setReaderName] = useState('');
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const name = getSetting('reader_name');
      setReaderName(name ?? '');
    }, [])
  );

  function handleSave() {
    if (!readerName.trim()) {
      Alert.alert('Name required', 'Please enter the reader name.');
      return;
    }
    setSetting('reader_name', readerName.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.back();
    }, 800);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reader Name</Text>
        <Text style={styles.cardBody}>
          This name will appear on the home screen header and will be included in exported Excel filenames.
        </Text>
        <TextInput
          style={styles.textInput}
          value={readerName}
          onChangeText={(t) => { setReaderName(t); setSaved(false); }}
          placeholder="e.g. Juan dela Cruz"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="words"
        />
        <TouchableOpacity
          style={[styles.saveBtn, saved && styles.saveBtnDone]}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>
            {saved ? '✓  Saved!' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>ℹ️  How it's used</Text>
        <Text style={styles.infoItem}>• Home screen header shows the reader name</Text>
        <Text style={styles.infoItem}>• Exported files are named: <Text style={styles.code}>ReaderName_Barangay_Month.xlsx</Text></Text>
        <Text style={styles.infoItem}>• Reading form auto-fills the "Meter Reader" field</Text>
      </View>
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
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  cardBody: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  saveBtnDone: { backgroundColor: Colors.green },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: FontSize.md },
  infoCard: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  infoItem: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  code: { fontFamily: 'monospace', color: Colors.primary, fontWeight: '600' },
});
