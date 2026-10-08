import { AccountType, LineStatus, MeterStatus } from '../types';

// ---------------------------------------------------------------------------
// Layout of sheet 1 ("WATER SUBSCRIBERS") of the official WATER READING SYSTEM
// workbook. This is the single source of truth for both import and export.
// Sheet 2 ("WATER BILLING") is not used here.
// ---------------------------------------------------------------------------

export const SHEET_NAME = 'WATER SUBSCRIBERS';

/** First subscriber row. Rows 1-3 are the year / header rows. */
export const FIRST_DATA_ROW = 4;
/** Last row covered by the sheet's SUBTOTAL counts, dropdowns and conditional formatting. */
export const MAX_DATA_ROW = 4998;
export const MAX_SUBSCRIBERS = MAX_DATA_ROW - FIRST_DATA_ROW + 1;

/** 1-based column numbers (A = 1). */
export const COL = {
  barangay: 1, // A
  name: 2, // B
  type: 3, // C
  line: 4, // D
  meter: 5, // E
  firstMonth: 6, // F  (JANUARY: PAST, PRESENT, CU.M USED, AMOUNT)
  lastMonthEnd: 53, // BA (end of DECEMBER)
  disconnectionStatus: 54, // BB (not used yet)
  disconnectionDate: 55, // BC (not used yet)
  payYear: 56, // BD
  payMonth: 57, // BE
  balance: 58, // BF
  remarks: 59, // BG
  accountId: 62, // BJ (hidden)
} as const;

export function monthCols(monthIndex: number) {
  const past = COL.firstMonth + monthIndex * 4;
  return { past, present: past + 1, cu: past + 2, amount: past + 3 };
}

/** 1 -> 'A', 27 -> 'AA' */
export function colName(n: number): string {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Value mappers (app <-> sheet). The sheet writes everything in UPPER CASE.
// ---------------------------------------------------------------------------

export function squash(s: unknown): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

export function norm(s: unknown): string {
  return squash(s).toUpperCase();
}

const LINE_PAIRS: [LineStatus, string][] = [
  ['Operational', 'OPERATIONAL'],
  ['Disconnected', 'DISCONNECTED'],
  ['Temporary Closed', 'TEMPORARY CLOSED'],
  ['Pending Verification', 'PENDING VERIFICATION'],
  ['No Occupant', 'NO OCCUPANT'],
  ['High Consumption', 'HIGH CONSUMPTION'],
];

export function lineToSheet(v: string | null | undefined): string {
  return norm(v);
}

export function sheetToLine(raw: unknown): LineStatus | null {
  const s = norm(raw);
  if (s === '') return null;
  for (const [app, sheet] of LINE_PAIRS) if (s === sheet) return app;
  if (s.includes('DISC')) return 'Disconnected';
  if (s.includes('OCCUPANT')) return 'No Occupant';
  if (s.includes('TEMP')) return 'Temporary Closed';
  if (s.includes('PENDING')) return 'Pending Verification';
  if (s.includes('HIGH')) return 'High Consumption';
  if (s.includes('OPERATION')) return 'Operational';
  return null;
}

export function meterToSheet(v: string | null | undefined): string {
  return norm(v);
}

export function sheetToMeter(raw: unknown): MeterStatus | null {
  const s = norm(raw).replace(/[\s_]+/g, '-');
  if (s === '') return null;
  if (s.includes('BLUR')) return 'Blurred';
  if (s === 'IN-SERVICE' || s === 'INSERVICE' || s.includes('SERVICE')) return 'In-service';
  return null;
}

export function typeToSheet(v: string | null | undefined): string {
  return norm(v);
}

export function sheetToType(raw: unknown): AccountType | null {
  const s = norm(raw);
  if (s === '') return null;
  if (s.startsWith('COMM')) return 'Commercial';
  if (s.startsWith('RES')) return 'Residential';
  return null;
}

export const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

/** Accepts 'MARCH', 'Mar', 'SEPT', '03', 3 (and the 'JLUY' typo found in old files) -> 1..12, or null. */
export function monthNumber(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw >= 1 && raw <= 12 && Number.isInteger(raw) ? raw : null;
  const s = norm(raw);
  if (s === '') return null;
  if (/^\d{1,2}$/.test(s)) {
    const n = parseInt(s, 10);
    return n >= 1 && n <= 12 ? n : null;
  }
  if (s === 'JLUY') return 7;
  if (s.length >= 3) {
    for (let i = 0; i < 12; i++) if (MONTH_NAMES[i].startsWith(s.slice(0, 3)) && MONTH_NAMES[i].startsWith(s)) return i + 1;
    for (let i = 0; i < 12; i++) if (MONTH_NAMES[i].slice(0, 3) === s.slice(0, 3)) return i + 1;
  }
  return null;
}

export function monthToSheet(stored: string | null | undefined): string {
  const n = monthNumber(stored);
  if (n) return MONTH_NAMES[n - 1];
  return norm(stored);
}

/** Year of last payment as a 4-digit string, or null. */
export function parseYear(raw: unknown): string | null {
  if (raw == null) return null;
  const s = squash(raw);
  if (!/^\d{4}(\.0+)?$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n >= 1900 && n <= 2100 ? String(n) : null;
}

/** Tiny arithmetic evaluator for balance cells typed like "=8228.75+150" or "86.25*4+75". No eval. */
export function evalArithmetic(expr: string): number | null {
  const src = expr.replace(/\s+/g, '');
  if (src === '' || !/^[0-9+\-*/().]+$/.test(src)) return null;
  let pos = 0;
  let failed = false;

  function peek() { return src[pos]; }
  function number(): number {
    const start = pos;
    while (pos < src.length && /[0-9.]/.test(src[pos])) pos++;
    const t = src.slice(start, pos);
    const n = parseFloat(t);
    if (t === '' || isNaN(n)) { failed = true; return 0; }
    return n;
  }
  function factor(): number {
    if (peek() === '-') { pos++; return -factor(); }
    if (peek() === '+') { pos++; return factor(); }
    if (peek() === '(') {
      pos++;
      const v = expression();
      if (peek() === ')') pos++; else failed = true;
      return v;
    }
    return number();
  }
  function term(): number {
    let v = factor();
    while (peek() === '*' || peek() === '/') {
      const op = src[pos++];
      const r = factor();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function expression(): number {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = src[pos++];
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }

  const result = expression();
  if (failed || pos !== src.length || !isFinite(result)) return null;
  return Math.round(result * 100) / 100;
}

/** Balance cell -> number. Handles numbers, numeric text, and "=a+b" text. */
export function parseBalance(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return isFinite(raw) ? raw : null;
  const s = squash(raw);
  if (s === '') return null;
  if (s.startsWith('=')) return evalArithmetic(s.slice(1));
  const cleaned = s.replace(/[₱,\s]/g, '');
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) return parseFloat(cleaned);
  return evalArithmetic(cleaned);
}

/** Meter reading cell -> number or null. */
export function parseReading(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return isFinite(raw) ? raw : null;
  const s = squash(raw);
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return parseFloat(s);
}

/** The workbook's tariff, used only to fill cached cell values so file previews show numbers. */
export function tariffAmount(type: string, cu: number): number | 'Invalid Category' {
  const t = norm(type);
  if (t === 'RESIDENTIAL') return cu <= 12 ? 75 : (cu - 12) * 12.5 + 75;
  if (t === 'COMMERCIAL') return cu <= 12 ? 150 : (cu - 12) * 15 + 150;
  return 'Invalid Category';
}
