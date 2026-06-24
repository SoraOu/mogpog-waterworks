import { getDb } from './schema';
import { Account, Barangay, Reading, ImportLog, StatusColor } from '../types';

// ─── Current month helper ──────────────────────────────────────────────────
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Barangays ─────────────────────────────────────────────────────────────
export function getAllBarangays(): Barangay[] {
  const db = getDb();
  const month = currentMonth();

  const rows = db.getAllSync<{
    id: number;
    name: string;
    total: number;
    done: number;
    issues: number;
  }>(`
    SELECT
      b.id,
      b.name,
      COUNT(a.id) AS total,
      SUM(CASE WHEN r.id IS NOT NULL AND r.remark IN ('No issue','High consumption') THEN 1 ELSE 0 END) AS done,
      SUM(CASE WHEN r.remark IN ('Blurred meter','No occupant','High consumption','No reading') THEN 1 ELSE 0 END) AS issues
    FROM barangays b
    LEFT JOIN accounts a ON a.barangay_id = b.id
    LEFT JOIN readings r ON r.account_id = a.id AND r.month = ?
    GROUP BY b.id
    ORDER BY b.name
  `, [month]);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    totalAccounts: r.total,
    doneCount: r.done,
    issueCount: r.issues,
    pendingCount: r.total - r.done,
  }));
}

// ─── Accounts ──────────────────────────────────────────────────────────────
function deriveStatus(remark: string | null, hasReading: boolean, consumption: number | null): StatusColor {
  if (!hasReading) return 'gray';
  if (remark === 'Blurred meter' || remark === 'No occupant' || remark === 'No reading') return 'orange';
  if (remark === 'High consumption' || (consumption !== null && consumption > 50)) return 'red';
  return 'green';
}

export function getAccountsByBarangay(barangayId: number): Account[] {
  const db = getDb();
  const month = currentMonth();

  const rows = db.getAllSync<{
    id: number;
    barangay_id: number;
    barangay_name: string;
    subscriber_name: string;
    type: string;
    line_status: string;
    meter_status: string;
    year_last_payment: string | null;
    month_last_payment: string | null;
    remaining_balance: number | null;
    previous_reading: number | null;
    remark: string | null;
    consumption: number | null;
    has_reading: number;
  }>(`
    SELECT
      a.*,
      b.name AS barangay_name,
      r.remark,
      r.consumption,
      CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END AS has_reading
    FROM accounts a
    JOIN barangays b ON b.id = a.barangay_id
    LEFT JOIN readings r ON r.account_id = a.id AND r.month = ?
    WHERE a.barangay_id = ?
    ORDER BY a.subscriber_name
  `, [month, barangayId]);

  return rows.map((r) => ({
    id: r.id,
    barangayId: r.barangay_id,
    barangayName: r.barangay_name,
    subscriberName: r.subscriber_name,
    type: r.type as Account['type'],
    lineStatus: r.line_status as Account['lineStatus'],
    meterStatus: r.meter_status as Account['meterStatus'],
    yearLastPayment: r.year_last_payment,
    monthLastPayment: r.month_last_payment,
    remainingBalance: r.remaining_balance,
    previousReading: r.previous_reading,
    currentMonthStatus: deriveStatus(r.remark, !!r.has_reading, r.consumption),
  }));
}

export function getAccount(accountId: number): Account | null {
  const db = getDb();
  const row = db.getFirstSync<{
    id: number;
    barangay_id: number;
    barangay_name: string;
    subscriber_name: string;
    type: string;
    line_status: string;
    meter_status: string;
    year_last_payment: string | null;
    month_last_payment: string | null;
    remaining_balance: number | null;
    previous_reading: number | null;
  }>(`
    SELECT a.*, b.name AS barangay_name
    FROM accounts a
    JOIN barangays b ON b.id = a.barangay_id
    WHERE a.id = ?
  `, [accountId]);

  if (!row) return null;

  return {
    id: row.id,
    barangayId: row.barangay_id,
    barangayName: row.barangay_name,
    subscriberName: row.subscriber_name,
    type: row.type as Account['type'],
    lineStatus: row.line_status as Account['lineStatus'],
    meterStatus: row.meter_status as Account['meterStatus'],
    yearLastPayment: row.year_last_payment,
    monthLastPayment: row.month_last_payment,
    remainingBalance: row.remaining_balance,
    previousReading: row.previous_reading,
    currentMonthStatus: 'gray',
  };
}

export function updateAccountStatus(
  accountId: number,
  lineStatus: string,
  meterStatus: string
): void {
  const db = getDb();
  db.runSync(
    'UPDATE accounts SET line_status = ?, meter_status = ? WHERE id = ?',
    [lineStatus, meterStatus, accountId]
  );
}

// ─── Readings ──────────────────────────────────────────────────────────────
export function getReadingsForAccount(accountId: number): Reading[] {
  const db = getDb();
  const rows = db.getAllSync<{
    id: number;
    account_id: number;
    month: string;
    previous_reading: number | null;
    present_reading: number | null;
    consumption: number | null;
    remark: string | null;
    notes: string | null;
    recorded_by: string | null;
    date_recorded: string | null;
  }>(`
    SELECT * FROM readings
    WHERE account_id = ?
    ORDER BY month DESC
  `, [accountId]);

  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    month: r.month,
    previousReading: r.previous_reading,
    presentReading: r.present_reading,
    consumption: r.consumption,
    remark: r.remark as Reading['remark'],
    notes: r.notes,
    recordedBy: r.recorded_by,
    dateRecorded: r.date_recorded,
  }));
}

export function getReading(readingId: number): Reading | null {
  const db = getDb();
  const r = db.getFirstSync<{
    id: number;
    account_id: number;
    month: string;
    previous_reading: number | null;
    present_reading: number | null;
    consumption: number | null;
    remark: string | null;
    notes: string | null;
    recorded_by: string | null;
    date_recorded: string | null;
  }>('SELECT * FROM readings WHERE id = ?', [readingId]);

  if (!r) return null;

  return {
    id: r.id,
    accountId: r.account_id,
    month: r.month,
    previousReading: r.previous_reading,
    presentReading: r.present_reading,
    consumption: r.consumption,
    remark: r.remark as Reading['remark'],
    notes: r.notes,
    recordedBy: r.recorded_by,
    dateRecorded: r.date_recorded,
  };
}

export function saveReading(params: {
  accountId: number;
  month: string;
  previousReading: number | null;
  presentReading: number | null;
  consumption: number | null;
  remark: Reading['remark'];
  notes: string | null;
  recordedBy: string | null;
}): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.runSync(`
    INSERT INTO readings (account_id, month, previous_reading, present_reading, consumption, remark, notes, recorded_by, date_recorded)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, month) DO UPDATE SET
      previous_reading = excluded.previous_reading,
      present_reading = excluded.present_reading,
      consumption = excluded.consumption,
      remark = excluded.remark,
      notes = excluded.notes,
      recorded_by = excluded.recorded_by,
      date_recorded = excluded.date_recorded
  `, [
    params.accountId,
    params.month,
    params.previousReading,
    params.presentReading,
    params.consumption,
    params.remark,
    params.notes,
    params.recordedBy,
    now,
  ]);

  // Update account's previous_reading to current for next month
  if (params.presentReading !== null) {
    db.runSync(
      'UPDATE accounts SET previous_reading = ? WHERE id = ?',
      [params.presentReading, params.accountId]
    );
  }
}

// ─── Import ────────────────────────────────────────────────────────────────
export function upsertBarangay(name: string): number {
  const db = getDb();
  db.runSync(
    'INSERT OR IGNORE INTO barangays (name) VALUES (?)',
    [name]
  );
  const row = db.getFirstSync<{ id: number }>(
    'SELECT id FROM barangays WHERE name = ?',
    [name]
  );
  return row!.id;
}

export function upsertAccount(params: {
  barangayId: number;
  subscriberName: string;
  type: string;
  lineStatus: string;
  meterStatus: string;
  yearLastPayment: string | null;
  monthLastPayment: string | null;
  remainingBalance: number | null;
  previousReading: number | null;
}): number {
  const db = getDb();
  db.runSync(`
    INSERT INTO accounts
      (barangay_id, subscriber_name, type, line_status, meter_status, year_last_payment, month_last_payment, remaining_balance, previous_reading)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `, [
    params.barangayId,
    params.subscriberName,
    params.type,
    params.lineStatus,
    params.meterStatus,
    params.yearLastPayment,
    params.monthLastPayment,
    params.remainingBalance,
    params.previousReading,
  ]);

  const row = db.getFirstSync<{ id: number }>(
    'SELECT id FROM accounts WHERE barangay_id = ? AND subscriber_name = ?',
    [params.barangayId, params.subscriberName]
  );
  return row!.id;
}

export function updateAccountFields(accountId: number, params: {
  lineStatus?: string;
  meterStatus?: string;
  yearLastPayment?: string | null;
  monthLastPayment?: string | null;
  remainingBalance?: number | null;
  previousReading?: number | null;
}): void {
  const db = getDb();
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];

  if (params.lineStatus !== undefined) { sets.push('line_status = ?'); vals.push(params.lineStatus); }
  if (params.meterStatus !== undefined) { sets.push('meter_status = ?'); vals.push(params.meterStatus); }
  if (params.yearLastPayment !== undefined) { sets.push('year_last_payment = ?'); vals.push(params.yearLastPayment); }
  if (params.monthLastPayment !== undefined) { sets.push('month_last_payment = ?'); vals.push(params.monthLastPayment); }
  if (params.remainingBalance !== undefined) { sets.push('remaining_balance = ?'); vals.push(params.remainingBalance); }
  if (params.previousReading !== undefined) { sets.push('previous_reading = ?'); vals.push(params.previousReading); }

  if (sets.length === 0) return;
  vals.push(accountId);
  db.runSync(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export function logImport(filename: string, accountsLoaded: number): void {
  const db = getDb();
  db.runSync(
    'INSERT INTO import_log (filename, imported_at, accounts_loaded) VALUES (?, ?, ?)',
    [filename, new Date().toISOString(), accountsLoaded]
  );
}

export function getImportLog(): ImportLog[] {
  const db = getDb();
  return db.getAllSync<ImportLog>(
    'SELECT id, filename, imported_at AS importedAt, accounts_loaded AS accountsLoaded FROM import_log ORDER BY imported_at DESC'
  );
}

// ─── Export ────────────────────────────────────────────────────────────────
export interface ExportRow {
  subscriberName: string;
  type: string;
  lineStatus: string;
  meterStatus: string;
  previousReading: number | null;
  presentReading: number | null;
  consumption: number | null;
  remarks: string | null;
  yearLastPayment: string | null;
  monthLastPayment: string | null;
  remainingBalance: number | null;
}

export function getExportData(barangayId: number, month: string): ExportRow[] {
  const db = getDb();
  const rows = db.getAllSync<{
    subscriber_name: string;
    type: string;
    line_status: string;
    meter_status: string;
    previous_reading: number | null;
    present_reading: number | null;
    consumption: number | null;
    remark: string | null;
    year_last_payment: string | null;
    month_last_payment: string | null;
    remaining_balance: number | null;
  }>(`
    SELECT
      a.subscriber_name, a.type, a.line_status, a.meter_status,
      a.year_last_payment, a.month_last_payment, a.remaining_balance,
      r.previous_reading, r.present_reading, r.consumption, r.remark
    FROM accounts a
    LEFT JOIN readings r ON r.account_id = a.id AND r.month = ?
    WHERE a.barangay_id = ?
    ORDER BY a.subscriber_name
  `, [month, barangayId]);

  return rows.map((r) => ({
    subscriberName: r.subscriber_name,
    type: r.type,
    lineStatus: r.line_status,
    meterStatus: r.meter_status,
    previousReading: r.previous_reading,
    presentReading: r.present_reading,
    consumption: r.consumption,
    remarks: r.remark,
    yearLastPayment: r.year_last_payment,
    monthLastPayment: r.month_last_payment,
    remainingBalance: r.remaining_balance,
  }));
}

export function getAllBarangaysForExport(): { id: number; name: string }[] {
  const db = getDb();
  return db.getAllSync<{ id: number; name: string }>(
    'SELECT id, name FROM barangays ORDER BY name'
  );
}

// ─── Stats ─────────────────────────────────────────────────────────────────
export function getOverallProgress(month: string): { total: number; done: number } {
  const db = getDb();
  const row = db.getFirstSync<{ total: number; done: number }>(`
    SELECT
      COUNT(a.id) AS total,
      COUNT(r.id) AS done
    FROM accounts a
    LEFT JOIN readings r ON r.account_id = a.id AND r.month = ?
  `, [month]);
  return row ?? { total: 0, done: 0 };
}
