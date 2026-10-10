import { getDb } from './schema';
import { Account, Barangay, Reading, ImportLog, StatusColor } from '../types';
import { billingStatus } from '../lib/billing';

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

// --- Previous-reading model ----------------------------------------------
// Readings store the PRESENT value. "Previous" is not kept as a rolling number
// on the account; it is derived:
//   1. the present reading of the latest EARLIER month that has one, otherwise
//   2. the account's opening reading (accounts.previous_reading).
// This matches the official workbook, where each month's PAST is the previous
// month's PRESENT and only January's PAST is typed in.

// SQL fragment: derived previous for account alias `a`, for the month bound to
// its single `?` placeholder.
const DERIVED_PREVIOUS_SQL = `COALESCE(
  (SELECT r2.present_reading FROM readings r2
   WHERE r2.account_id = a.id AND r2.month < ? AND r2.present_reading IS NOT NULL
   ORDER BY r2.month DESC LIMIT 1),
  a.previous_reading
)`;

export function getPreviousReading(accountId: number, month: string): number | null {
  const db = getDb();
  const earlier = db.getFirstSync<{ present_reading: number }>(
    `SELECT present_reading FROM readings
     WHERE account_id = ? AND month < ? AND present_reading IS NOT NULL
     ORDER BY month DESC LIMIT 1`,
    [accountId, month]
  );
  if (earlier) return earlier.present_reading;

  const acc = db.getFirstSync<{ previous_reading: number | null }>(
    'SELECT previous_reading FROM accounts WHERE id = ?',
    [accountId]
  );
  return acc?.previous_reading ?? null;
}

/** Amount to store for a reading: the tariff amount, or null when there is nothing to bill. */
function amountToStore(
  accountId: number,
  consumption: number | null,
  presentReading: number | null,
  remark: string | null
): number | null {
  const db = getDb();
  const acc = db.getFirstSync<{ type: string }>('SELECT type FROM accounts WHERE id = ?', [accountId]);
  const bill = billingStatus(acc?.type, consumption, presentReading, remark);
  return bill.kind === 'amount' ? bill.amount : null;
}

// After a reading is saved/deleted (or the opening reading changes), the next
// later reading that has a present value must pick up its new previous value.
// Only that one row can change: later rows depend on present values, which are
// untouched. Pass '' to start from the beginning.
function rechainAfter(accountId: number, afterMonth: string): void {
  const db = getDb();
  const next = db.getFirstSync<{ id: number; month: string; present_reading: number; remark: string | null }>(
    `SELECT id, month, present_reading, remark FROM readings
     WHERE account_id = ? AND month > ? AND present_reading IS NOT NULL
     ORDER BY month ASC LIMIT 1`,
    [accountId, afterMonth]
  );
  if (!next) return;

  const prev = getPreviousReading(accountId, next.month);
  const consumption = prev !== null ? next.present_reading - prev : null;
  const amount = amountToStore(accountId, consumption, next.present_reading, next.remark);
  db.runSync('UPDATE readings SET previous_reading = ?, consumption = ?, amount = ? WHERE id = ?', [
    prev,
    consumption,
    amount,
    next.id,
  ]);
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

interface AccountRow {
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
  previous_reading: number | null; // opening reading
  remarks: string | null;
  derived_previous: number | null;
  remark: string | null; // this month's reading remark
  consumption: number | null;
  has_reading: number;
}

function mapAccount(r: AccountRow): Account {
  return {
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
    previousReading: r.derived_previous,
    openingReading: r.previous_reading,
    remarks: r.remarks,
    currentMonthStatus: deriveStatus(r.remark, !!r.has_reading, r.consumption),
  };
}

const ACCOUNT_SELECT = `
  SELECT
    a.*,
    b.name AS barangay_name,
    ${DERIVED_PREVIOUS_SQL} AS derived_previous,
    r.remark,
    r.consumption,
    CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END AS has_reading
  FROM accounts a
  JOIN barangays b ON b.id = a.barangay_id
  LEFT JOIN readings r ON r.account_id = a.id AND r.month = ?
`;

export function getAccountsByBarangay(
  barangayId: number,
  sortField: SortField = 'name',
  sortDir: SortDir = 'asc'
): Account[] {
  const db = getDb();
  const month = currentMonth();

  const orderClause =
    sortField === 'status'
      ? `has_reading ${sortDir}, a.subscriber_name ASC, a.id ASC`
      : `a.subscriber_name ${sortDir}, a.id ASC`;

  const rows = db.getAllSync<AccountRow>(
    `${ACCOUNT_SELECT}
     WHERE a.barangay_id = ?
     ORDER BY ${orderClause}`,
    [month, month, barangayId]
  );

  return rows.map(mapAccount);
}

export function searchAllAccounts(query: string): Account[] {
  const db = getDb();
  const month = currentMonth();

  const rows = db.getAllSync<AccountRow>(
    `${ACCOUNT_SELECT}
     WHERE a.subscriber_name LIKE ?
     ORDER BY a.subscriber_name ASC, a.id ASC`,
    [month, month, `%${query}%`]
  );

  return rows.map(mapAccount);
}

export function getAccount(accountId: number): Account | null {
  const db = getDb();
  const month = currentMonth();

  const row = db.getFirstSync<AccountRow>(
    `${ACCOUNT_SELECT}
     WHERE a.id = ?`,
    [month, month, accountId]
  );

  return row ? mapAccount(row) : null;
}

export function updateAccountStatus(accountId: number, lineStatus: string, meterStatus: string): void {
  const db = getDb();
  db.runSync('UPDATE accounts SET line_status = ?, meter_status = ? WHERE id = ?', [lineStatus, meterStatus, accountId]);
}

// `previousReading` here is the account's OPENING reading (used only for the
// first month that has no earlier reading). `remarks` is left alone when omitted.
export function updateAccountDetails(accountId: number, params: {
  subscriberName: string;
  lineStatus: string;
  meterStatus: string;
  previousReading: number | null;
  remarks?: string | null;
}): void {
  const db = getDb();
  const old = db.getFirstSync<{ previous_reading: number | null }>(
    'SELECT previous_reading FROM accounts WHERE id = ?',
    [accountId]
  );

  db.runSync(
    'UPDATE accounts SET subscriber_name = ?, line_status = ?, meter_status = ?, previous_reading = ? WHERE id = ?',
    [params.subscriberName, params.lineStatus, params.meterStatus, params.previousReading, accountId]
  );
  if (params.remarks !== undefined) {
    db.runSync('UPDATE accounts SET remarks = ? WHERE id = ?', [params.remarks, accountId]);
  }

  if ((old?.previous_reading ?? null) !== params.previousReading) {
    rechainAfter(accountId, '');
  }
}

export function createAccount(params: {
  barangayId: number;
  subscriberName: string;
  type: string;
  lineStatus: string;
  meterStatus: string;
  previousReading?: number | null;
  remarks?: string | null;
}): number {
  const db = getDb();
  db.runSync(
    `INSERT INTO accounts (barangay_id, subscriber_name, type, line_status, meter_status, previous_reading, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      params.barangayId,
      params.subscriberName,
      params.type,
      params.lineStatus,
      params.meterStatus,
      params.previousReading ?? null,
      params.remarks ?? null,
    ]
  );
  const row = db.getFirstSync<{ id: number }>('SELECT last_insert_rowid() AS id');
  return row!.id;
}

// True when another account in the same barangay already has this exact name
// (case-insensitive, trimmed). Used to WARN on add; duplicates are allowed.
export function countAccountsWithName(barangayId: number, name: string): number {
  const db = getDb();
  const row = db.getFirstSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM accounts
     WHERE barangay_id = ? AND TRIM(subscriber_name) = TRIM(?) COLLATE NOCASE`,
    [barangayId, name]
  );
  return row?.n ?? 0;
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
interface ReadingRow {
  id: number;
  account_id: number;
  month: string;
  previous_reading: number | null;
  present_reading: number | null;
  consumption: number | null;
  amount: number | null;
  remark: string | null;
  notes: string | null;
  recorded_by: string | null;
  date_recorded: string | null;
}

function mapReading(r: ReadingRow): Reading {
  return {
    id: r.id,
    accountId: r.account_id,
    month: r.month,
    previousReading: r.previous_reading,
    presentReading: r.present_reading,
    consumption: r.consumption,
    amount: r.amount,
    remark: r.remark as Reading['remark'],
    notes: r.notes,
    recordedBy: r.recorded_by,
    dateRecorded: r.date_recorded,
  };
}

export function getReadingsForAccount(accountId: number): Reading[] {
  const db = getDb();
  const rows = db.getAllSync<ReadingRow>(
    'SELECT * FROM readings WHERE account_id = ? ORDER BY month DESC',
    [accountId]
  );
  return rows.map(mapReading);
}

export function getReading(readingId: number): Reading | null {
  const db = getDb();
  const r = db.getFirstSync<ReadingRow>('SELECT * FROM readings WHERE id = ?', [readingId]);
  return r ? mapReading(r) : null;
}

// Saves (or replaces) the reading for an account + month. The caller should pass
// previousReading = getPreviousReading(accountId, month). Saving no longer
// overwrites the account's opening reading; instead the next later reading is
// re-chained so its previous/consumption stay correct.
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
  const amount = amountToStore(params.accountId, params.consumption, params.presentReading, params.remark);

  db.runSync(`
    INSERT INTO readings (account_id, month, previous_reading, present_reading, consumption, amount, remark, notes, recorded_by, date_recorded)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, month) DO UPDATE SET
      previous_reading = excluded.previous_reading,
      present_reading = excluded.present_reading,
      consumption = excluded.consumption,
      amount = excluded.amount,
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
    amount,
    params.remark,
    params.notes,
    params.recordedBy,
    now,
  ]);

  rechainAfter(params.accountId, params.month);
}

export function deleteReading(accountId: number, month: string): void {
  const db = getDb();
  db.runSync('DELETE FROM readings WHERE account_id = ? AND month = ?', [accountId, month]);
  rechainAfter(accountId, month);
}

export function markNoReading(accountId: number, month: string, recordedBy: string | null): void {
  saveReading({
    accountId,
    month,
    previousReading: getPreviousReading(accountId, month),
    presentReading: null,
    consumption: null,
    remark: 'No reading',
    notes: null,
    recordedBy,
  });
}

// Years that have at least one saved reading (newest first), for the export year picker.
export function getReadingYears(): number[] {
  const db = getDb();
  const rows = db.getAllSync<{ y: string }>(
    'SELECT DISTINCT substr(month, 1, 4) AS y FROM readings ORDER BY y DESC'
  );
  return rows.map((r) => Number(r.y)).filter((y) => Number.isFinite(y));
}

// --- Import log ------------------------------------------------------------
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
// Everything the official workbook export needs, for one calendar year:
// one entry per account, with the 12 PRESENT readings and January's PAST.
// Months without a saved present reading are null (left blank in the sheet).
export interface ExportAccount {
  id: number;
  barangay: string;
  subscriberName: string;
  type: string;
  lineStatus: string;
  meterStatus: string;
  yearLastPayment: string | null;
  monthLastPayment: string | null;
  remainingBalance: number | null;
  remarks: string | null;
  januaryPast: number | null;
  present: (number | null)[]; // index 0 = January ... 11 = December
  /** The most recent month in the year that has a remark (reading notes), for the REMARKS cell. */
  monthRemark: { monthIndex: number; text: string } | null;
}

export function getAccountsForExport(year: number, barangayId?: number): ExportAccount[] {
  const db = getDb();
  const first = `${year}-01`;
  const last = `${year}-12`;

  const accParams: (string | number)[] = [first];
  let where = '';
  if (barangayId != null) {
    where = 'WHERE a.barangay_id = ?';
    accParams.push(barangayId);
  }

  const accounts = db.getAllSync<{
    id: number;
    barangay_name: string;
    subscriber_name: string;
    type: string;
    line_status: string;
    meter_status: string;
    year_last_payment: string | null;
    month_last_payment: string | null;
    remaining_balance: number | null;
    remarks: string | null;
    january_past: number | null;
  }>(`
    SELECT
      a.id, b.name AS barangay_name, a.subscriber_name, a.type, a.line_status, a.meter_status,
      a.year_last_payment, a.month_last_payment, a.remaining_balance, a.remarks,
      ${DERIVED_PREVIOUS_SQL} AS january_past
    FROM accounts a
    JOIN barangays b ON b.id = a.barangay_id
    ${where}
    ORDER BY b.name COLLATE NOCASE, a.subscriber_name COLLATE NOCASE, a.id
  `, accParams);

  const readParams: (string | number)[] = [first, last];
  let readWhere = '';
  if (barangayId != null) {
    readWhere = 'AND a.barangay_id = ?';
    readParams.push(barangayId);
  }
  const readings = db.getAllSync<{ account_id: number; month: string; present_reading: number }>(`
    SELECT r.account_id, r.month, r.present_reading
    FROM readings r
    JOIN accounts a ON a.id = r.account_id
    WHERE r.month >= ? AND r.month <= ? AND r.present_reading IS NOT NULL
    ${readWhere}
  `, readParams);

  const byAccount = new Map<number, (number | null)[]>();
  for (const r of readings) {
    const idx = parseInt(r.month.slice(5, 7), 10) - 1;
    if (idx < 0 || idx > 11) continue;
    let arr = byAccount.get(r.account_id);
    if (!arr) {
      arr = new Array<number | null>(12).fill(null);
      byAccount.set(r.account_id, arr);
    }
    arr[idx] = r.present_reading;
  }

  const noteParams: (string | number)[] = [first, last];
  let noteWhere = '';
  if (barangayId != null) {
    noteWhere = 'AND a.barangay_id = ?';
    noteParams.push(barangayId);
  }
  const notes = db.getAllSync<{ account_id: number; month: string; notes: string }>(`
    SELECT r.account_id, r.month, r.notes
    FROM readings r
    JOIN accounts a ON a.id = r.account_id
    WHERE r.month >= ? AND r.month <= ? AND r.notes IS NOT NULL AND TRIM(r.notes) <> ''
    ${noteWhere}
    ORDER BY r.month ASC
  `, noteParams);
  const latestNote = new Map<number, { monthIndex: number; text: string }>();
  for (const n of notes) {
    const idx = parseInt(n.month.slice(5, 7), 10) - 1;
    if (idx < 0 || idx > 11) continue;
    latestNote.set(n.account_id, { monthIndex: idx, text: n.notes.trim() }); // ascending order: last one wins
  }

  return accounts.map((a) => ({
    id: a.id,
    barangay: a.barangay_name,
    subscriberName: a.subscriber_name,
    type: a.type,
    lineStatus: a.line_status,
    meterStatus: a.meter_status,
    yearLastPayment: a.year_last_payment,
    monthLastPayment: a.month_last_payment,
    remainingBalance: a.remaining_balance,
    remarks: a.remarks,
    januaryPast: a.january_past,
    present: byAccount.get(a.id) ?? new Array<number | null>(12).fill(null),
    monthRemark: latestNote.get(a.id) ?? null,
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
