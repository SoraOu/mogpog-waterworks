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
import * as XLSX from 'xlsx';
import {
  upsertBarangay,
  upsertAccount,
  updateAccountFields,
  logImport,
  getImportLog,
} from '../../db/queries';
import { ImportLog } from '../../types';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Some balance cells contain Excel formula strings like "=603.75+75".
 * This evaluates simple addition/subtraction formulas into a number.
 * If it can't be parsed, returns null.
 */
function parseBalance(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim();
  if (s === '') return null;
  // Handle formula strings like =603.75+75 or =86.25*4+75
  if (s.startsWith('=')) {
    try {
      // Only allow safe math characters
      const expr = s.slice(1).replace(/[^0-9+\-*/.]/g, '');
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expr})`)();
      return typeof result === 'number' && isFinite(result) ? result : null;
    } catch {
      return null;
    }
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

/**
 * Parses the "Last Payment" field which comes in many formats:
 * - A JS Date object (from Excel date cells)
 * - A string like "5/11/26", "03/17/26", "1/30/2026", "4/30/36"
 * - A plain year number like 2025
 * Returns { year, month } strings or nulls.
 */
function parseLastPayment(raw: unknown): { year: string | null; month: string | null } {
  if (raw == null) return { year: null, month: null };

  // JS Date from openpyxl / xlsx
  if (raw instanceof Date) {
    return {
      year: String(raw.getFullYear()),
      month: String(raw.getMonth() + 1).padStart(2, '0'),
    };
  }

  if (typeof raw === 'number') {
    // Plain year like 2025
    if (raw > 1900 && raw < 2100) return { year: String(raw), month: null };
    // Could be an Excel serial date number
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return { year: String(d.y), month: String(d.m).padStart(2, '0') };
    return { year: null, month: null };
  }

  const s = String(raw).trim();
  if (s === '' || s === ' ') return { year: null, month: null };

  // Try M/D/YY or M/D/YYYY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let yr = parseInt(slashMatch[3], 10);
    if (yr < 100) yr += yr >= 50 ? 1900 : 2000;
    const mo = parseInt(slashMatch[1], 10);
    return { year: String(yr), month: String(mo).padStart(2, '0') };
  }

  // Plain 4-digit year
  if (/^\d{4}$/.test(s)) return { year: s, month: null };

  return { year: null, month: null };
}

/**
 * Maps freeform remarks from the Excel to the app's remark types.
 * The Excel uses all-caps and various wordings/combinations.
 */
function parseRemark(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).toUpperCase().trim();
  if (s === '') return null;

  if (s.includes('HIGH CONSUMPTION')) return 'High consumption';
  if (s.includes('BLURRED')) return 'Blurred meter';
  if (s.includes('NO OCCUPANT')) return 'No occupant';
  if (s.includes('NO READING') || s.includes('NO METER READING') || s.includes('UNCHANGED')) return 'No reading';
  if (s.includes('DISCONNECTED') || s.includes('DISC') || s.includes('CUT')) return 'No issue'; // disconnected is a line status, not a reading remark
  return null;
}

/**
 * Maps freeform line status values from the Excel.
 */
function parseLineStatus(raw: unknown): string {
  if (raw == null) return 'Operational';
  const s = String(raw).toUpperCase().trim();
  if (s.includes('DISCONNECTED') || s.includes('DISC')) return 'Disconnected';
  if (s.includes('NO OCCUPANT')) return 'No Occupant';
  if (s.includes('TEMPORARY') || s.includes('TEMP')) return 'Temporary Closed';
  if (s.includes('OPERATIONAL')) return 'Operational';
  return 'Operational';
}

/**
 * Maps freeform meter status values.
 */
function parseMeterStatus(raw: unknown): string {
  if (raw == null) return 'In-service';
  const s = String(raw).toUpperCase().trim();
  if (s.includes('BLURRED')) return 'Blurred';
  return 'In-service';
}

/**
 * Finds the header row in a sheet. Scans the first 10 rows for one that
 * contains a name-like keyword. Returns the 0-based row index, or 0.
 */
function findHeaderRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    const joined = row
      .map((c) => (c != null ? String(c).toUpperCase() : ''))
      .join(' ');
    if (
      joined.includes('SUBSCRIBER') ||
      joined.includes('NAME OF') ||
      joined.includes('NAME')
    ) {
      return i;
    }
  }
  return 0;
}

/**
 * Given a header row array, returns a map of { fieldKey: columnIndex }.
 * Handles the different column name variations across sheets.
 */
function mapColumns(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((cell, i) => {
    if (cell == null) return;
    const s = String(cell).toUpperCase().trim();

    if (s.includes('SUBSCRIBER') || s === 'NAME OF SUBSCRIBER' || s === "SUBSCRIBER'S NAME") {
      map['name'] = i;
    } else if (s === 'NAME OF SUBSCRIBERS' || (s.includes('NAME') && !map['name'])) {
      map['name'] = i;
    } else if (s === 'TYPE') {
      map['type'] = i;
    } else if (s.includes('LINE STATUS')) {
      map['lineStatus'] = i;
    } else if (s.includes('WATER METER STATUS') || s.includes('METER STATUS')) {
      map['meterStatus'] = i;
    } else if (s.includes('YEAR OF LAST') || s === 'YEAR') {
      map['yearLastPayment'] = i;
    } else if (s.includes('MONTH OF LAST') || s === 'MONTH') {
      map['monthLastPayment'] = i;
    } else if (s.includes('LAST PAYMENT') || s === 'LAST PAYMENT') {
      map['lastPayment'] = i; // combined year+month field
    } else if (s.includes('BALANCE') || s.includes('REMAINING BALANCE')) {
      map['balance'] = i;
    } else if (s.includes('REMARKS') || s === 'REMARKS') {
      map['remarks'] = i;
    } else if (s === 'BARANGAY') {
      map['barangay'] = i;
    }
  });
  return map;
}

// ─── Main import logic ─────────────────────────────────────────────────────

export default function ImportScreen() {
  const [loading, setLoading] = useState(false);
  const [importLog, setImportLog] = useState<ImportLog[]>([]);

  const loadLog = useCallback(() => {
    setImportLog(getImportLog());
  }, []);

  useFocusEffect(useCallback(() => { loadLog(); }, [loadLog]));

  async function handlePick() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setLoading(true);

      const b64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const workbook = XLSX.read(b64, { type: 'base64', cellDates: true });

      let totalLoaded = 0;
      const skippedSheets: string[] = [];

      for (const sheetName of workbook.SheetNames) {
        // Skip non-barangay sheets
        const upperName = sheetName.toUpperCase().trim();
        if (
          upperName === 'SHEET1' ||
          upperName === 'WATER SUBSCRIBERS' ||
          upperName === 'SUMMARY'
        ) {
          // Sheet1 may have a barangay name in cell A1 — try to use that
          if (upperName === 'SHEET1') {
            const ws = workbook.Sheets[sheetName];
            const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
              header: 1,
              defval: null,
            }) as unknown[][];
            // First non-empty cell in first row is likely the barangay name
            const firstRow = allRows[0] ?? [];
            const barangayNameCell = firstRow.find(
              (c) => c != null && String(c).trim() !== ''
            );
            if (barangayNameCell) {
              const barangayName = String(barangayNameCell).trim();
              const count = processSheet(ws, barangayName, allRows);
              totalLoaded += count;
            } else {
              skippedSheets.push(sheetName);
            }
          } else {
            skippedSheets.push(sheetName);
          }
          continue;
        }

        const ws = workbook.Sheets[sheetName];
        const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
          header: 1,
          defval: null,
        }) as unknown[][];

        const count = processSheet(ws, sheetName, allRows);
        totalLoaded += count;
      }

      logImport(asset.name, totalLoaded);
      loadLog();

      let msg = `${totalLoaded} accounts loaded from ${workbook.SheetNames.length} sheet(s).`;
      if (skippedSheets.length > 0) {
        msg += `\n\nSkipped sheets: ${skippedSheets.join(', ')}`;
      }
      Alert.alert('Import complete', msg);
    } catch (e) {
      console.error(e);
      Alert.alert('Import failed', String(e));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Processes one sheet and inserts/updates accounts.
   * Returns the number of accounts loaded.
   */
  function processSheet(
    _ws: XLSX.WorkSheet,
    barangayName: string,
    allRows: unknown[][]
  ): number {
    if (allRows.length === 0) return 0;

    const headerRowIdx = findHeaderRowIndex(allRows);
    const headerRow = allRows[headerRowIdx] as unknown[];
    const colMap = mapColumns(headerRow);

    // Must at least have a name column
    if (colMap['name'] === undefined) return 0;

    const barangayId = upsertBarangay(barangayName);
    let count = 0;

    for (let i = headerRowIdx + 1; i < allRows.length; i++) {
      const row = allRows[i] as unknown[];

      // Get subscriber name
      const rawName = row[colMap['name']];
      if (rawName == null) continue;
      const subscriberName = String(rawName).trim();
      if (subscriberName === '' || /^\d+$/.test(subscriberName)) continue; // skip row numbers

      // Type
      const type =
        colMap['type'] !== undefined
          ? String(row[colMap['type']] ?? 'Residential').trim() || 'Residential'
          : 'Residential';
      const normalizedType =
        type.toUpperCase() === 'COMMERCIAL' ? 'Commercial' : 'Residential';

      // Line status — derive from remarks if no dedicated column
      let lineStatus = 'Operational';
      if (colMap['lineStatus'] !== undefined) {
        lineStatus = parseLineStatus(row[colMap['lineStatus']]);
      } else if (colMap['remarks'] !== undefined) {
        const remarkRaw = row[colMap['remarks']];
        const s = remarkRaw ? String(remarkRaw).toUpperCase() : '';
        if (s.includes('DISCONNECTED') || s.includes('DISC') || s.includes('CUT')) {
          lineStatus = 'Disconnected';
        } else if (s.includes('NO OCCUPANT')) {
          lineStatus = 'No Occupant';
        } else if (s.includes('TEMPORARY CLOSED') || s.includes('TEMP CLOSED')) {
          lineStatus = 'Temporary Closed';
        }
      }

      // Meter status — derive from remarks if no dedicated column
      let meterStatus = 'In-service';
      if (colMap['meterStatus'] !== undefined) {
        meterStatus = parseMeterStatus(row[colMap['meterStatus']]);
      } else if (colMap['remarks'] !== undefined) {
        const remarkRaw = row[colMap['remarks']];
        const s = remarkRaw ? String(remarkRaw).toUpperCase() : '';
        if (s.includes('BLURRED')) meterStatus = 'Blurred';
      }

      // Balance
      const balance =
        colMap['balance'] !== undefined
          ? parseBalance(row[colMap['balance']])
          : null;

      // Last payment — either split year/month columns or combined
      let yearLastPayment: string | null = null;
      let monthLastPayment: string | null = null;

      if (
        colMap['yearLastPayment'] !== undefined &&
        colMap['monthLastPayment'] !== undefined
      ) {
        // Dedicated year and month columns (WATER SUBSCRIBERS sheet)
        const yr = row[colMap['yearLastPayment']];
        const mo = row[colMap['monthLastPayment']];
        yearLastPayment = yr != null ? String(yr).trim() : null;
        monthLastPayment = mo != null ? String(mo).trim() : null;
      } else if (colMap['lastPayment'] !== undefined) {
        // Combined "Last Payment" column
        const parsed = parseLastPayment(row[colMap['lastPayment']]);
        yearLastPayment = parsed.year;
        monthLastPayment = parsed.month;
      }

      const accountId = upsertAccount({
        barangayId,
        subscriberName,
        type: normalizedType,
        lineStatus,
        meterStatus,
        yearLastPayment,
        monthLastPayment,
        remainingBalance: balance,
        previousReading: null, // Excel doesn't have meter readings
      });

      updateAccountFields(accountId, {
        lineStatus,
        meterStatus,
        yearLastPayment,
        monthLastPayment,
        remainingBalance: balance,
      });

      count++;
    }

    return count;
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Load Subscriber List</Text>
        <Text style={styles.cardBody}>
          Select the Excel file (.xlsx) from the Mogpog Waterworks office.{'\n'}
          Each sheet should represent one barangay. The importer will
          automatically detect column names and formats.
        </Text>
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handlePick}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>📂  Pick .xlsx file</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Supported Column Formats</Text>
        <Text style={styles.cardBody}>
          The importer handles all the barangay sheet formats in your Excel file,
          including different column names, header row positions, freeform remarks,
          formula-based balances, and mixed date formats.
        </Text>
        <View style={styles.tagRow}>
          {[
            'Name of Subscriber',
            "Subscriber's Name",
            'TYPE',
            'Last Payment',
            'Balance',
            'Remarks',
            'Line Status',
            'Water Meter Status',
          ].map((col) => (
            <View key={col} style={styles.tag}>
              <Text style={styles.tagText}>{col}</Text>
            </View>
          ))}
        </View>
      </View>

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
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tag: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },
  logRow: {
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 2,
  },
  logFile: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  logMeta: { fontSize: FontSize.xs, color: Colors.textMuted },
});
