import * as SQLite from 'expo-sqlite';

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
      FOREIGN KEY (barangay_id) REFERENCES barangays(id)
    );

    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      previous_reading REAL,
      present_reading REAL,
      consumption REAL,
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
      accounts_loaded INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}
