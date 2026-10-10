import React, { useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { getAccount, getReading } from '../../db/queries';
import { billingStatus } from '../../lib/billing';
import Receipt, { ReceiptData } from '../../components/Receipt';
import { Account, Reading } from '../../types';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

function monthLabel(m: string): string {
  const [y, mo] = m.split('-');
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long' });
}

function longDate(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); // reading id
  const router = useRouter();
  const shotRef = useRef<View>(null);

  const [reading, setReading] = useState<Reading | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const r = getReading(Number(id));
      setReading(r);
      setAccount(r ? getAccount(r.accountId) : null);
    }, [id])
  );

  if (!reading || !account) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>This reading could not be found.</Text>
      </View>
    );
  }

  const bill = billingStatus(account.type, reading.consumption, reading.presentReading, reading.remark);

  if (bill.kind !== 'amount') {
    return (
      <View style={styles.center}>
        <Text style={styles.messageTitle}>
          {bill.kind === 'check' ? 'Check reading' : 'No receipt for this reading'}
        </Text>
        <Text style={styles.message}>
          {bill.kind === 'check'
            ? 'The present reading is lower than the previous reading, so no amount is billed. Correct the reading, or confirm it is a replaced meter, before making a receipt.'
            : 'There is nothing to bill: the month has no reading, or there is no previous reading to compare with.'}
        </Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const data: ReceiptData = {
    name: account.subscriberName,
    address: account.barangayName,
    accountClass: account.type.toUpperCase(),
    billingMonth: monthLabel(reading.month),
    readDate: longDate(reading.dateRecorded),
    presentReading: reading.presentReading as number,
    previousReading: reading.previousReading,
    consumed: reading.consumption as number,
    amount: bill.amount,
    reader: reading.recordedBy ?? '',
  };

  async function handleShare() {
    setBusy(true);
    try {
      const uri = await captureRef(shotRef, { format: 'png', quality: 1, result: 'tmpfile' });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing not available', 'This device cannot share files.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share receipt' });
    } catch (e) {
      console.error(e);
      Alert.alert('Could not create the receipt image', String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* The image is a snapshot of exactly this view */}
      <View ref={shotRef} collapsable={false} style={styles.shadow}>
        <Receipt data={data} />
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
        onPress={handleShare}
        disabled={busy}
        activeOpacity={0.85}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>📤  Share receipt image</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
        <Text style={styles.secondaryText}>Close</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, alignItems: 'center', gap: Spacing.md },
  shadow: { elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: Spacing.md },
  messageTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  message: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
  secondaryBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, alignItems: 'center' },
  secondaryText: { color: Colors.textSecondary, fontWeight: '600', fontSize: FontSize.md },
});
