import * as SQLite from 'expo-sqlite';
import { computeAmount } from '../lib/billing';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('waterworks.db');
  }
  return db;
}

export function initDb(): void {
  const database = getDb();

  database.execSync(`
    CREATE TABLE IF NOT EXISTS barangays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barangay_id INTEGER NOT NULL,
      subscriber_name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Residential',
      line_status TEXT NOT NULL DEFAULT 'Operational',
      meter_status TEXT NOT NULL DEFAULT 'In-service',
      year_last_payment TEXT,
      month_last_payment TEXT,
      remaining_balance REAL,
      previous_reading REAL,
      remarks TEXT,
      FOREIGN KEY (barangay_id) REFERENCES barangays(id)
    );

    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      previous_reading REAL,
      present_reading REAL,
      consumption REAL,
      amount REAL,
      remark TEXT,
      notes TEXT,
      recorded_by TEXT,
      date_recorded TEXT,
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      UNIQUE(account_id, month)
    );

    CREATE TABLE IF NOT EXISTS import_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      accounts_loaded INTEGER NOT NULL,
      file_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migration: add file_hash column to import_log for existing installs
  try {
    database.execSync(`ALTER TABLE import_log ADD COLUMN file_hash TEXT`);
  } catch {
    // column already exists, ignore
  }

  // Migration: the amount billed is saved with each reading
  try {
    database.execSync(`ALTER TABLE readings ADD COLUMN amount REAL`);
  } catch {
    // column already exists, ignore
  }

  // Migration: free-text account remarks (the REMARKS column of the official workbook)
  try {
    database.execSync(`ALTER TABLE accounts ADD COLUMN remarks TEXT`);
  } catch {
    // column already exists, ignore
  }

  // Migration: two subscribers may legitimately share a name (the official
  // workbook has such pairs), so name can no longer be a unique key. Account
  // `id` is the identity. Drop the old unique index if an earlier version
  // created it, and keep a plain (non-unique) index for fast name lookups.
  try {
    database.execSync(`DROP INDEX IF EXISTS idx_accounts_barangay_name`);
  } catch {
    console.warn('[initDb] Could not drop idx_accounts_barangay_name');
  }
  try {
    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_accounts_barangay_name_lookup
      ON accounts (barangay_id, subscriber_name);
    `);
  } catch {
    console.warn('[initDb] Could not create lookup index on accounts');
  }

  // Migration (runs once): readings now store PRESENT only and "previous" is
  // derived from the earlier month. accounts.previous_reading therefore means
  // "opening reading" (used only when an account has no earlier reading).
  // Before this change it was overwritten with the latest present reading on
  // every save, so restore it from the earliest saved reading's own previous
  // value, where one exists.
  try {
    const done = database.getFirstSync<{ value: string }>(
      `SELECT value FROM settings WHERE key = 'migrated_opening_reading_v1'`
    );
    if (!done) {
      database.execSync(`
        UPDATE accounts
        SET previous_reading = (
          SELECT r.previous_reading
          FROM readings r
          WHERE r.account_id = accounts.id
          ORDER BY r.month ASC
          LIMIT 1
        )
        WHERE (
          SELECT r.previous_reading
          FROM readings r
          WHERE r.account_id = accounts.id
          ORDER BY r.month ASC
          LIMIT 1
        ) IS NOT NULL;
      `);
      database.runSync(
        `INSERT OR REPLACE INTO settings (key, value) VALUES ('migrated_opening_reading_v1', '1')`
      );
    }
  } catch {
    console.warn('[initDb] Opening-reading migration failed; will retry on next launch');
  }

  // Migration (runs once): fill in the amount for readings saved before billing existed.
  try {
    const done = database.getFirstSync<{ value: string }>(
      `SELECT value FROM settings WHERE key = 'migrated_amount_v1'`
    );
    if (!done) {
      const rows = database.getAllSync<{ id: number; consumption: number; type: string }>(
        `SELECT r.id, r.consumption, a.type
         FROM readings r JOIN accounts a ON a.id = r.account_id
         WHERE r.amount IS NULL AND r.consumption IS NOT NULL AND r.consumption >= 0`
      );
      database.withTransactionSync(() => {
        for (const r of rows) {
          const amount = computeAmount(r.type, r.consumption);
          if (amount !== null) database.runSync('UPDATE readings SET amount = ? WHERE id = ?', [amount, r.id]);
        }
        database.runSync(
          `INSERT OR REPLACE INTO settings (key, value) VALUES ('migrated_amount_v1', '1')`
        );
      });
    }
  } catch {
    console.warn('[initDb] Amount backfill failed; will retry on next launch');
  }
}
