import { getDb } from './schema';
import { norm, squash } from '../excel/format';
import type { ExistingAccount, ImportPlan } from '../excel/importPlan';

export function getImportContext(): { existing: ExistingAccount[]; barangays: string[] } {
  const db = getDb();
  const existing = db
    .getAllSync<{ id: number; barangay_name: string; subscriber_name: string }>(
      `SELECT a.id, b.name AS barangay_name, a.subscriber_name
       FROM accounts a JOIN barangays b ON b.id = a.barangay_id`
    )
    .map((r) => ({ id: r.id, barangayName: r.barangay_name, subscriberName: r.subscriber_name }));
  const barangays = db.getAllSync<{ name: string }>('SELECT name FROM barangays').map((r) => r.name);
  return { existing, barangays };
}

export interface ImportResult {
  created: number;
  updated: number;
  readingsWritten: number;
  barangaysCreated: number;
}

/**
 * Recomputes previous_reading / consumption for every reading of one account
 * from the PRESENT values: previous = latest earlier present reading, or the
 * account's opening reading for the first one. Same rule as the db layer.
 */
function rechainAccount(accountId: number): void {
  const db = getDb();
  const acc = db.getFirstSync<{ previous_reading: number | null }>(
    'SELECT previous_reading FROM accounts WHERE id = ?',
    [accountId]
  );
  let running: number | null = acc?.previous_reading ?? null;

  const rows = db.getAllSync<{ id: number; present_reading: number | null }>(
    'SELECT id, present_reading FROM readings WHERE account_id = ? ORDER BY month ASC',
    [accountId]
  );
  for (const r of rows) {
    if (r.present_reading === null) continue;
    const consumption = running !== null ? r.present_reading - running : null;
    db.runSync('UPDATE readings SET previous_reading = ?, consumption = ? WHERE id = ?', [
      running,
      consumption,
      r.id,
    ]);
    running = r.present_reading;
  }
}

/**
 * Writes the plan. Everything happens in ONE transaction: if anything fails,
 * nothing is changed. Rules:
 *  - 'review' rows are never written.
 *  - New accounts get all the sheet's values.
 *  - Existing accounts are updated only from NON-blank cells (a blank cell
 *    never erases something already stored). Name and barangay are never changed.
 *  - January PAST (F) is stored as the account's opening reading only when the
 *    account has no readings before that year (otherwise it is derived).
 *  - PRESENT readings are written for the file's year. Existing readings keep
 *    their notes / reader / date; a 'No reading' remark becomes 'No issue'
 *    when a value is supplied. CU.M USED and AMOUNT are never imported.
 */
export function applyImportPlan(plan: ImportPlan): ImportResult {
  const db = getDb();
  const result: ImportResult = { created: 0, updated: 0, readingsWritten: 0, barangaysCreated: 0 };

  db.withTransactionSync(() => {
    // barangays (case/spacing-insensitive match to what the app already has)
    const barangayIds = new Map<string, number>();
    for (const b of db.getAllSync<{ id: number; name: string }>('SELECT id, name FROM barangays')) {
      barangayIds.set(norm(b.name), b.id);
    }

    for (const item of plan.items) {
      const row = item.row;

      let accountId: number;
      if (item.action === 'create') {
        const bKey = norm(row.barangay);
        let barangayId = barangayIds.get(bKey);
        if (barangayId === undefined) {
          db.runSync('INSERT INTO barangays (name) VALUES (?)', [squash(row.barangay)]);
          barangayId = db.getFirstSync<{ id: number }>('SELECT last_insert_rowid() AS id')!.id;
          barangayIds.set(bKey, barangayId);
          result.barangaysCreated++;
        }
        db.runSync(
          `INSERT INTO accounts
             (barangay_id, subscriber_name, type, line_status, meter_status,
              year_last_payment, month_last_payment, remaining_balance, previous_reading, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            barangayId,
            row.name,
            row.type ?? 'Residential',
            row.line ?? 'Operational',
            row.meter ?? 'In-service',
            row.payYear,
            row.payMonth,
            row.balance,
            row.januaryPast,
            row.remarks,
          ]
        );
        accountId = db.getFirstSync<{ id: number }>('SELECT last_insert_rowid() AS id')!.id;
        result.created++;
      } else {
        accountId = item.accountId!;
        const sets: string[] = [];
        const vals: (string | number | null)[] = [];
        const add = (col: string, v: string | number | null) => {
          if (v !== null) { sets.push(`${col} = ?`); vals.push(v); }
        };
        add('type', row.type);
        add('line_status', row.line);
        add('meter_status', row.meter);
        add('year_last_payment', row.payYear);
        add('month_last_payment', row.payMonth);
        add('remaining_balance', row.balance);
        add('remarks', row.remarks);

        if (row.januaryPast !== null) {
          const earlier = db.getFirstSync<{ n: number }>(
            'SELECT COUNT(*) AS n FROM readings WHERE account_id = ? AND month < ? AND present_reading IS NOT NULL',
            [accountId, `${plan.year}-01`]
          );
          if (!earlier || earlier.n === 0) add('previous_reading', row.januaryPast);
        }

        if (sets.length > 0) {
          vals.push(accountId);
          db.runSync(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`, vals);
        }
        result.updated++;
      }

      // readings
      let wrote = 0;
      for (let m = 0; m < 12; m++) {
        const present = row.present[m];
        if (present === null) continue;
        const month = `${plan.year}-${String(m + 1).padStart(2, '0')}`;
        const existing = db.getFirstSync<{ id: number }>(
          'SELECT id FROM readings WHERE account_id = ? AND month = ?',
          [accountId, month]
        );
        if (existing) {
          db.runSync(
            `UPDATE readings SET present_reading = ?,
               remark = CASE WHEN remark IS NULL OR remark = 'No reading' THEN 'No issue' ELSE remark END
             WHERE id = ?`,
            [present, existing.id]
          );
        } else {
          db.runSync(
            `INSERT INTO readings
               (account_id, month, previous_reading, present_reading, consumption, remark, notes, recorded_by, date_recorded)
             VALUES (?, ?, NULL, ?, NULL, 'No issue', NULL, NULL, NULL)`,
            [accountId, month, present]
          );
        }
        wrote++;
      }
      if (wrote > 0) {
        rechainAccount(accountId);
        result.readingsWritten += wrote;
      }
    }
  });

  return result;
}
