import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from 'expo-router';
import { logImport, getImportLog, isFileAlreadyImported } from '../../db/queries';
import { applyImportPlan, getImportContext } from '../../db/officialImport';
import { base64ToBytes } from '../../excel/base64';
import { FormatError, parseOfficialWorkbook, readOfficialWorkbook, ParseResult } from '../../excel/importParser';
import { planImport, ImportPlan } from '../../excel/importPlan';
import { ImportLog } from '../../types';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

/** Content hash of the file bytes (two 32-bit hashes + length), used to warn about re-importing the same file. */
function hashBytes(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5;
  let h2 = 5381;
  for (let i = 0; i < bytes.length; i++) {
    h1 ^= bytes[i];
    h1 = Math.imul(h1, 0x01000193);
    h2 = (Math.imul(h2, 33) + bytes[i]) | 0;
  }
  return `v2:${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}:${bytes.length}`;
}

interface Pending {
  fileName: string;
  fileHash: string;
  parsed: ParseResult;
  plan: ImportPlan;
}

export default function ImportScreen() {
  const [loading, setLoading] = useState(false);
  const [importLog, setImportLog] = useState<ImportLog[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);

  const loadLog = useCallback(() => {
    setImportLog(getImportLog());
  }, []);

  useFocusEffect(useCallback(() => { loadLog(); }, [loadLog]));

  async function readAndPlan(uri: string, fileName: string, force: boolean) {
    setLoading(true);
    try {
      // let the spinner render before the heavy synchronous parsing
      await new Promise((r) => setTimeout(r, 50));

      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const fileHash = hashBytes(base64ToBytes(b64));

      if (!force && isFileAlreadyImported(fileHash)) {
        setLoading(false);
        Alert.alert(
          'Already imported',
          'This exact file has already been imported. Importing it again will not change anything unless the app data was changed since.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Import again', onPress: () => readAndPlan(uri, fileName, true) },
          ]
        );
        return;
      }

      const parsed = parseOfficialWorkbook(readOfficialWorkbook(b64));
      const ctx = getImportContext();
      const plan = planImport(parsed.year, parsed.rows, ctx.existing, ctx.barangays);
      setPending({ fileName, fileHash, parsed, plan });
    } catch (e) {
      if (e instanceof FormatError) {
        Alert.alert('Not the official format', e.message);
      } else {
        console.error(e);
        Alert.alert('Could not read the file', String(e));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePick() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setPending(null);
      await readAndPlan(asset.uri, asset.name, false);
    } catch (e) {
      Alert.alert('Import failed', String(e));
    }
  }

  async function handleConfirm() {
    if (!pending) return;
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 50));
      const res = applyImportPlan(pending.plan);
      logImport(pending.fileName, res.created + res.updated, pending.fileHash);
      loadLog();
      setPending(null);
      Alert.alert(
        'Import complete',
        `${res.created} added, ${res.updated} updated, ${res.readingsWritten} readings saved.` +
          (pending.plan.review.length > 0
            ? `\n\n${pending.plan.review.length} row(s) were not imported (see the review list you were shown).`
            : '')
      );
    } catch (e) {
      console.error(e);
      Alert.alert('Import failed', `Nothing was changed.\n\n${String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const plan = pending?.plan;
  const parsed = pending?.parsed;
  const skipped = parsed ? parsed.skippedNoName.length + parsed.skippedNoBarangay.length : 0;
  const nothingToImport = !!plan && plan.items.length === 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Load Water Reading System File</Text>
        <Text style={styles.cardBody}>
          Select the official WATER READING SYSTEM workbook (.xlsx). The app reads the
          "WATER SUBSCRIBERS" sheet: subscribers, account type, line and meter status,
          the 12 monthly PRESENT readings, last payment, balance and remarks.{'\n\n'}
          You will see a summary to confirm before anything is saved.
        </Text>
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handlePick}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading && !pending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>📂  Pick .xlsx file</Text>
          )}
        </TouchableOpacity>
      </View>

      {pending && plan && parsed && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ready to import</Text>
          <Text style={styles.fileName}>{pending.fileName}</Text>
          <Text style={styles.cardBody}>Year in the file: {parsed.year}</Text>

          <View style={styles.statGrid}>
            <Stat label="New accounts" value={plan.created} />
            <Stat label="Accounts updated" value={plan.updated} />
            <Stat label="Readings" value={plan.readingCount} />
            <Stat label="New barangays" value={plan.newBarangays.length} />
          </View>

          <Text style={styles.cardBody}>
            CU.M USED, AMOUNT and PAST (except January) are formulas in the workbook and are not imported.
            Blank cells never erase data already in the app.
          </Text>

          {skipped > 0 && (
            <View style={styles.warnBox}>
              <Text style={styles.warnTitle}>{skipped} row(s) skipped</Text>
              {parsed.skippedNoName.length > 0 && (
                <Text style={styles.warnText}>
                  No subscriber name: row {parsed.skippedNoName.slice(0, 10).join(', ')}
                  {parsed.skippedNoName.length > 10 ? ' …' : ''}
                </Text>
              )}
              {parsed.skippedNoBarangay.length > 0 && (
                <Text style={styles.warnText}>
                  No barangay: row {parsed.skippedNoBarangay.slice(0, 10).join(', ')}
                  {parsed.skippedNoBarangay.length > 10 ? ' …' : ''}
                </Text>
              )}
            </View>
          )}

          {plan.review.length > 0 && (
            <View style={styles.warnBox}>
              <Text style={styles.warnTitle}>{plan.review.length} row(s) need review — NOT imported</Text>
              <Text style={styles.warnText}>
                These could be the same subscriber as an account already in the app, or share a name with another
                account, so the app will not guess.
              </Text>
              {plan.review.slice(0, 8).map((r) => (
                <Text key={r.row.rowNumber} style={styles.warnText}>
                  • Row {r.row.rowNumber}: {r.row.name} ({r.row.barangay}) — {r.reason}
                </Text>
              ))}
              {plan.review.length > 8 && (
                <Text style={styles.warnText}>…and {plan.review.length - 8} more.</Text>
              )}
            </View>
          )}

          {(parsed.unknownLine > 0 || parsed.unknownMeter > 0) && (
            <Text style={styles.warnText}>
              {parsed.unknownLine} unrecognised line status and {parsed.unknownMeter} unrecognised meter status value(s)
              were left unchanged.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.btn, (loading || nothingToImport) && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={loading || nothingToImport}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Import {plan.items.length} subscribers</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => setPending(null)}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {importLog.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Import History</Text>
          {importLog.map((log) => (
            <View key={log.id} style={styles.logRow}>
              <Text style={styles.logFile}>{log.filename}</Text>
              <Text style={styles.logMeta}>
                {log.accountsLoaded} accounts · {formatDate(log.importedAt)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value.toLocaleString('en-PH')}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  cardBody: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  fileName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
  cancelBtn: { paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: FontSize.md },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },
  warnBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.orange,
  },
  warnTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.orange },
  warnText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  logRow: {
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 2,
  },
  logFile: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  logMeta: { fontSize: FontSize.xs, color: Colors.textMuted },
});
