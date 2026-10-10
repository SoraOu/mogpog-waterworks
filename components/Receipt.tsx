import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCuM, formatPeso } from '../lib/billing';

// E-receipt laid out like sheet 2 ("WATER BILLING") of the official workbook:
// header, subscriber block, billing dates, METER DETAILS, charges, reader, footer.
// Due Date and Amount After Due Date are left as blank lines for now.

export interface ReceiptData {
  name: string;
  address: string;
  accountClass: string;
  billingMonth: string; // e.g. "October 2026"
  readDate: string; // e.g. "October 8, 2026"
  presentReading: number;
  previousReading: number | null;
  consumed: number;
  amount: number;
  reader: string;
}

export const RECEIPT_WIDTH = 360;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function BlankRow({ label }: { label: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.blankLine} />
    </View>
  );
}

export default function Receipt({ data }: { data: ReceiptData }) {
  return (
    <View style={styles.paper}>
      <Text style={styles.title}>MOGPOG MUNICIPAL WATERWORKS SYSTEM</Text>
      <Text style={styles.subtitle}>Mogpog, Marinduque</Text>
      <Text style={styles.billTitle}>WATER CONSUMPTION BILL</Text>

      <View style={styles.rule} />

      <Row label="Name:" value={data.name} />
      <Row label="Address:" value={data.address} />
      <Row label="Class:" value={data.accountClass} />

      <View style={styles.gap} />

      <Row label="Billing Month:" value={data.billingMonth} />
      <Row label="Read Date:" value={data.readDate} />
      <BlankRow label="Due Date:" />

      <View style={styles.rule} />

      <Text style={styles.section}>METER DETAILS</Text>
      <Row label="Present Reading:" value={`${formatCuM(data.presentReading)} m³`} />
      <Row
        label="Previous Reading:"
        value={data.previousReading != null ? `${formatCuM(data.previousReading)} m³` : '—'}
      />
      <Row label="Total Consumed:" value={`${formatCuM(data.consumed)} m³`} />

      <View style={styles.rule} />

      <View style={styles.row}>
        <Text style={styles.chargeLabel}>Total Current Charges:</Text>
        <Text style={styles.chargeValue}>{formatPeso(data.amount)}</Text>
      </View>
      <BlankRow label="Amount After Due Date:" />

      <View style={styles.gap} />

      <Row label="Meter Reader:" value={data.reader || '—'} />

      <View style={styles.rule} />

      <Text style={styles.footer}>Please pay before the due date to avoid water disconnection.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    width: RECEIPT_WIDTH,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  title: { fontSize: 15, fontWeight: '800', color: '#000', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#000', textAlign: 'center', marginTop: 2 },
  billTitle: { fontSize: 14, fontWeight: '700', color: '#000', textAlign: 'center', marginTop: 10 },
  rule: { height: 1, backgroundColor: '#000', marginVertical: 12 },
  gap: { height: 10 },
  section: { fontSize: 13, fontWeight: '800', color: '#000', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 3 },
  label: { fontSize: 13, color: '#000', fontWeight: '600', marginRight: 8 },
  value: { flex: 1, fontSize: 13, color: '#000', textAlign: 'right' },
  blankLine: { flex: 1, height: 14, borderBottomWidth: 1, borderBottomColor: '#000' },
  chargeLabel: { fontSize: 14, color: '#000', fontWeight: '800', marginRight: 8 },
  chargeValue: { flex: 1, fontSize: 18, color: '#000', fontWeight: '800', textAlign: 'right' },
  footer: { fontSize: 11, color: '#000', textAlign: 'center', fontStyle: 'italic' },
});
