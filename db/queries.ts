import { getDb } from './schema';
import { Account, Barangay, Reading, ImportLog, StatusColor } from '../types';

// --- Settings ------------------------------------------------------------
export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

// --- Month helpers -------------------------------------------------------
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// --- Barangays -----------------------------------------------------------
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
      COUNT(r.id) AS done,
      SUM(
        CASE WHEN r.remark IN ('Blurred meter','No occupant','No reading')
        THEN 1 ELSE 0 END
      ) AS issues
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

// --- Accounts ------------------------------------------------------------
function deriveStatus(remark: string | null, hasReading: boolean, consumption: number | null): StatusColor {
  if (!hasReading) return 'gray';
  if (remark === 'Blurred meter' || remark === 'No occupant' || remark === 'No reading') return 'orange';
  return 'green';
}

export type SortField = 'name' | 'status';
export type SortDir = 'asc' | 'desc';

export function getAccountsByBarangay(
  barangayId: number,
  sortField: SortField = 'name',
  sortDir: SortDir = 'asc'
): Account[] {
  const db = getDb();
  const month = currentMonth();

  const orderClause =
    sortField === 'status'
      ? `has_reading ${sortDir}, a.subscriber_name ASC`
      : `a.subscriber_name ${sortDir}`;

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
    ORDER BY ${orderClause}
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

export function searchAllAccounts(query: string): Account[] {
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
    WHERE a.subscriber_name LIKE ?
    ORDER BY a.subscriber_name ASC
  `, [month, `%${query}%`]);

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
  const month = currentMonth();

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
    WHERE a.id = ?
  `, [month, accountId]);

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
    currentMonthStatus: deriveStatus(row.remark, !!row.has_reading, row.consumption),
  };
}

export function updateAccountStatus(accountId: number, lineStatus: string, meterStatus: string): void {
  const db = getDb();
  db.runSync('UPDATE accounts SET line_status = ?, meter_status = ? WHERE id = ?', [lineStatus, meterStatus, accountId]);
}

export function updateAccountDetails(accountId: number, params: {
  subscriberName: string;
  lineStatus: string;
  meterStatus: string;
  previousReading: number | null;
}): void {
  const db = getDb();
  db.runSync(
    'UPDATE accounts SET subscriber_name = ?, line_status = ?, meter_status = ?, previous_reading = ? WHERE id = ?',
    [params.subscriberName, params.lineStatus, params.meterStatus, params.previousReading, accountId]
  );
}

export function createAccount(params: {
  barangayId: number;
  subscriberName: string;
  type: string;
  lineStatus: string;
  meterStatus: string;
}): number {
  const db = getDb();
  db.runSync(
    'INSERT INTO accounts (barangay_id, subscriber_name, type, line_status, meter_status) VALUES (?, ?, ?, ?, ?)',
    [params.barangayId, params.subscriberName, params.type, params.lineStatus, params.meterStatus]
  );
  const row = db.getFirstSync<{ id: number }>('SELECT last_insert_rowid() AS id');
  return row!.id;
}

export function deleteAccount(accountId: number): void {
  const db = getDb();
  db.runSync('DELETE FROM readings WHERE account_id = ?', [accountId]);
  db.runSync('DELETE FROM accounts WHERE id = ?', [accountId]);
}

export function getAllBarangayNames(): { id: number; name: string }[] {
  const db = getDb();
  return db.getAllSync<{ id: number; name: string }>('SELECT id, name FROM barangays ORDER BY name');
}

export function createBarangay(name: string): number {
  const db = getDb();
  db.runSync('INSERT OR IGNORE INTO barangays (name) VALUES (?)', [name]);
  const row = db.getFirstSync<{ id: number }>('SELECT id FROM barangays WHERE name = ?', [name]);
  return row!.id;
}

// --- Readings ------------------------------------------------------------
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
  }>('SELECT * FROM readings WHERE account_id = ? ORDER BY month DESC', [accountId]);

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
  dateRecorded?: string | null;
}): void {
  const db = getDb();
  const now = params.dateRecorded ?? new Date().toISOString();

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

  if (params.presentReading !== null) {
    db.runSync('UPDATE accounts SET previous_reading = ? WHERE id = ?', [params.presentReading, params.accountId]);
  }
}

export function deleteReading(accountId: number, month: string): void {
  const db = getDb();
  db.runSync('DELETE FROM readings WHERE account_id = ? AND month = ?', [accountId, month]);
}

export function markNoReading(accountId: number, month: string, recordedBy: string | null): void {
  const db = getDb();
  const prev = db.getFirstSync<{ previous_reading: number | null }>(
    'SELECT previous_reading FROM accounts WHERE id = ?', [accountId]
  );
  saveReading({
    accountId,
    month,
    previousReading: prev?.previous_reading ?? null,
    presentReading: null,
    consumption: null,
    remark: 'No reading',
    notes: null,
    recordedBy,
  });
}

// --- Import --------------------------------------------------------------
export function upsertBarangay(name: string): number {
  const db = getDb();
  db.runSync('INSERT OR IGNORE INTO barangays (name) VALUES (?)', [name]);
  const row = db.getFirstSync<{ id: number }>('SELECT id FROM barangays WHERE name = ?', [name]);
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
    ON CONFLICT(barangay_id, subscriber_name) DO UPDATE SET
      type               = excluded.type,
      line_status        = excluded.line_status,
      meter_status       = excluded.meter_status,
      year_last_payment  = excluded.year_last_payment,
      month_last_payment = excluded.month_last_payment,
      remaining_balance  = excluded.remaining_balance,
      previous_reading   = excluded.previous_reading
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

export function logImport(filename: string, accountsLoaded: number, fileHash: string): void {
  const db = getDb();
  db.runSync(
    'INSERT INTO import_log (filename, imported_at, accounts_loaded, file_hash) VALUES (?, ?, ?, ?)',
    [filename, new Date().toISOString(), accountsLoaded, fileHash]
  );
}

export function getImportLog(): ImportLog[] {
  const db = getDb();
  return db.getAllSync<ImportLog>(
    'SELECT id, filename, imported_at AS importedAt, accounts_loaded AS accountsLoaded FROM import_log ORDER BY imported_at DESC'
  );
}

export function isFileAlreadyImported(hash: string): boolean {
  const db = getDb();
  const row = db.getFirstSync<{ id: number }>(
    'SELECT id FROM import_log WHERE file_hash = ?', [hash]
  );
  return !!row;
}

// --- Export ----------------------------------------------------------------
// Matches the "WATER SUBSCRIBERS" sheet layout of WATER_SUBSCRIBER_REPORT.xlsx:
// BARANGAY | SUBSCRIBER'S NAME | TYPE | LINE STATUS | WATER METER STATUS |
// WATER METER READER | ISSUANCE OF DISCONNECTION | DATE OF ISSUANCE |
// NOD DATE RECEIVED | DISCONNECTION DATE | DISCONNECTION STATUS | (blank) |
// MONTH OF LAST PAYMENT | REMAINING BALANCE | REMARKS
//
// The disconnection-process columns (issuance, NOD date, disconnection date/
// status) aren't tracked anywhere in this app's data model, so they're left
// blank for the reader to fill in on paper/Excel. WATER METER READER is
// filled from the 'reader_name' setting since that's already captured.
export interface FullExportRow {
  barangay: string;
  subscriberName: string;
  type: string;
  lineStatus: string;
  meterStatus: string;
  meterReader: string;
  monthLastPayment: string | null;
  remainingBalance: number | null;
  remarks: string | null;
}

export function getFullExportData(month: string, barangayId?: number): FullExportRow[] {
  const db = getDb();
  const readerName = getSetting('reader_name') ?? '';

  const params: (string | number)[] = [month];
  let where = '';
  if (barangayId != null) {
    where = 'WHERE a.barangay_id = ?';
    params.push(barangayId);
  }

  const rows = db.getAllSync<{
    barangay_name: string;
    subscriber_name: string;
    type: string;
    line_status: string;
    meter_status: string;
    month_last_payment: string | null;
    remaining_balance: number | null;
    remark: string | null;
  }>(`
    SELECT
      b.name AS barangay_name,
      a.subscriber_name, a.type, a.line_status, a.meter_status,
      a.month_last_payment, a.remaining_balance,
      r.remark
    FROM accounts a
    JOIN barangays b ON b.id = a.barangay_id
    LEFT JOIN readings r ON r.account_id = a.id AND r.month = ?
    ${where}
    ORDER BY b.name, a.subscriber_name
  `, params);

  return rows.map((r) => ({
    barangay: r.barangay_name,
    subscriberName: r.subscriber_name,
    type: r.type,
    lineStatus: r.line_status,
    meterStatus: r.meter_status,
    meterReader: readerName,
    monthLastPayment: r.month_last_payment,
    remainingBalance: r.remaining_balance,
    remarks: r.remark,
  }));
}

export function getAllBarangaysForExport(): { id: number; name: string }[] {
  const db = getDb();
  return db.getAllSync<{ id: number; name: string }>('SELECT id, name FROM barangays ORDER BY name');
}

// --- Stats ---------------------------------------------------------------
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