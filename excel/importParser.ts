import * as XLSX from 'xlsx';
import { AccountType, LineStatus, MeterStatus } from '../types';
import { base64ToBytes } from './base64';
import {
  COL,
  FIRST_DATA_ROW,
  MAX_DATA_ROW,
  MONTH_NAMES,
  SHEET_NAME,
  colName,
  monthCols,
  monthNumber,
  norm,
  parseBalance,
  parseReading,
  parseYear,
  sheetToLine,
  sheetToMeter,
  sheetToType,
  squash,
} from './format';

export class FormatError extends Error {}

export interface ParsedRow {
  /** Row number in the sheet (1-based), for messages. */
  rowNumber: number;
  barangay: string;
  name: string;
  type: AccountType | null;
  line: LineStatus | null;
  meter: MeterStatus | null;
  januaryPast: number | null;
  /** index 0 = January ... 11 = December. Only typed PRESENT readings; formulas are ignored. */
  present: (number | null)[];
  payYear: string | null;
  /** Full upper-case month name (e.g. 'MARCH') or null. */
  payMonth: string | null;
  balance: number | null;
  remarks: string | null;
  /** Hidden ACCOUNT ID (column BJ), when the file was exported by this app. */
  accountId: number | null;
}

export interface ParseResult {
  year: number;
  rows: ParsedRow[];
  /** Rows with data but no usable subscriber name (skipped). */
  skippedNoName: number[];
  /** Rows with a name but no barangay (skipped). */
  skippedNoBarangay: number[];
  unknownLine: number;
  unknownMeter: number;
  warnings: string[];
}

type Cell = { v?: unknown; t?: string };
type Sheet = Record<string, Cell | unknown>;

function cell(ws: Sheet, col: number, row: number): Cell | undefined {
  return ws[`${colName(col)}${row}`] as Cell | undefined;
}

function text(ws: Sheet, col: number, row: number): string {
  const c = cell(ws, col, row);
  if (!c || c.v == null) return '';
  return squash(c.v);
}

function rawValue(ws: Sheet, col: number, row: number): unknown {
  const c = cell(ws, col, row);
  return c ? c.v : undefined;
}

function findSheet(wb: XLSX.WorkBook): XLSX.WorkSheet | null {
  const want = norm(SHEET_NAME);
  const name = wb.SheetNames.find((n) => norm(n) === want);
  return name ? wb.Sheets[name] : null;
}

function checkHeaders(ws: Sheet): void {
  const expect = (col: number, row: number, token: string) => {
    if (!norm(text(ws, col, row)).includes(token)) {
      throw new FormatError(
        `This is not the official WATER READING SYSTEM workbook: cell ${colName(col)}${row} should say "${token}".`
      );
    }
  };
  expect(COL.barangay, 2, 'BARANGAY');
  expect(COL.name, 2, 'SUBSCRIBER');
  expect(COL.line, 2, 'LINE');
  expect(COL.meter, 2, 'METER');
  for (let m = 0; m < 12; m++) {
    const c = monthCols(m);
    expect(c.past, 3, 'PAST');
    expect(c.present, 3, 'PRESENT');
    expect(c.cu, 3, 'CU');
    expect(c.amount, 3, 'AMOUNT');
  }
  expect(COL.payYear, 2, 'YEAR');
  expect(COL.payMonth, 2, 'MONTH');
  expect(COL.balance, 2, 'BALANCE');
  expect(COL.remarks, 2, 'REMARKS');
}

function readYear(ws: Sheet, warnings: string[]): number {
  const counts = new Map<number, number>();
  for (let c = COL.firstMonth; c <= COL.lastMonthEnd; c++) {
    const y = parseYear(rawValue(ws, c, 1));
    if (y) counts.set(Number(y), (counts.get(Number(y)) ?? 0) + 1);
  }
  if (counts.size === 0) {
    throw new FormatError('Row 1 of the workbook does not contain the year (cells F1 to BA1).');
  }
  let best = 0;
  let bestN = -1;
  counts.forEach((n, y) => {
    if (n > bestN) { best = y; bestN = n; }
  });
  if (counts.size > 1) {
    warnings.push(`Row 1 contains more than one year; using ${best}.`);
  }
  return best;
}

/** Parses a workbook already read with XLSX.read(). Throws FormatError when it is not the official format. */
export function parseOfficialWorkbook(wb: XLSX.WorkBook): ParseResult {
  const ws = findSheet(wb) as Sheet | null;
  if (!ws) {
    throw new FormatError(
      `This is not the official WATER READING SYSTEM workbook: there is no "${SHEET_NAME}" sheet.`
    );
  }

  checkHeaders(ws);
  const warnings: string[] = [];
  const year = readYear(ws, warnings);

  const ref = (ws as { '!ref'?: string })['!ref'];
  const lastSheetRow = ref ? XLSX.utils.decode_range(ref).e.r + 1 : FIRST_DATA_ROW;
  const lastRow = Math.min(lastSheetRow, MAX_DATA_ROW + 6);

  const rows: ParsedRow[] = [];
  const skippedNoName: number[] = [];
  const skippedNoBarangay: number[] = [];
  let unknownLine = 0;
  let unknownMeter = 0;

  for (let r = FIRST_DATA_ROW; r <= lastRow; r++) {
    const name = text(ws, COL.name, r);
    const barangay = text(ws, COL.barangay, r);

    const present: (number | null)[] = [];
    let anyReading = false;
    for (let m = 0; m < 12; m++) {
      const p = parseReading(rawValue(ws, monthCols(m).present, r));
      present.push(p);
      if (p !== null) anyReading = true;
    }
    const janPast = parseReading(rawValue(ws, monthCols(0).past, r));

    const rowIsEmpty =
      name === '' && barangay === '' && !anyReading && janPast === null &&
      text(ws, COL.balance, r) === '' && text(ws, COL.remarks, r) === '';
    if (rowIsEmpty) continue;

    if (name === '' || /^\d+$/.test(name)) {
      skippedNoName.push(r);
      continue;
    }
    if (barangay === '') {
      skippedNoBarangay.push(r);
      continue;
    }

    const lineRaw = rawValue(ws, COL.line, r);
    const meterRaw = rawValue(ws, COL.meter, r);
    const line = sheetToLine(lineRaw);
    const meter = sheetToMeter(meterRaw);
    if (line === null && squash(lineRaw) !== '') unknownLine++;
    if (meter === null && squash(meterRaw) !== '') unknownMeter++;

    const monthRaw = rawValue(ws, COL.payMonth, r);
    let payMonth: string | null = null;
    if (typeof monthRaw === 'number' && monthRaw > 31) {
      // a real date typed into the month cell (Excel serial number)
      const d = XLSX.SSF.parse_date_code(monthRaw);
      if (d && d.m >= 1 && d.m <= 12) payMonth = MONTH_NAMES[d.m - 1];
    } else {
      const mn = monthNumber(monthRaw);
      payMonth = mn ? MONTH_NAMES[mn - 1] : null;
    }

    const idRaw = rawValue(ws, COL.accountId, r);
    const idNum = typeof idRaw === 'number' ? idRaw : parseReading(idRaw);
    const accountId = idNum !== null && Number.isInteger(idNum) && idNum > 0 ? idNum : null;

    const remarks = text(ws, COL.remarks, r);

    rows.push({
      rowNumber: r,
      barangay,
      name,
      type: sheetToType(rawValue(ws, COL.type, r)),
      line,
      meter,
      januaryPast: janPast,
      present,
      payYear: parseYear(rawValue(ws, COL.payYear, r)),
      payMonth,
      balance: parseBalance(rawValue(ws, COL.balance, r)),
      remarks: remarks !== '' ? remarks : null,
      accountId,
    });
  }

  if (rows.length === 0) {
    throw new FormatError('No subscriber rows were found in the workbook.');
  }

  return { year, rows, skippedNoName, skippedNoBarangay, unknownLine, unknownMeter, warnings };
}

/** Reads only the official sheet from base64 file data. */
export function readOfficialWorkbook(base64: string): XLSX.WorkBook {
  const bytes = base64ToBytes(base64);

  // First pass: sheet names only (cheap), so the real name can be matched ignoring case/spaces.
  const names = XLSX.read(bytes, { type: 'array', bookSheets: true }).SheetNames;
  const want = norm(SHEET_NAME);
  const actual = names.find((n) => norm(n) === want);
  if (!actual) {
    throw new FormatError(
      `This is not the official WATER READING SYSTEM workbook: there is no "${SHEET_NAME}" sheet.`
    );
  }

  return XLSX.read(bytes, {
    type: 'array',
    sheets: actual,
    cellFormula: false,
    cellStyles: false,
    cellNF: false,
    cellDates: false,
  });
}
