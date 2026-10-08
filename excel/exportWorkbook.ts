import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import type { ExportAccount } from '../db/queries';
import { base64ToBytes } from './base64';
import { TEMPLATE_SKELETON_B64 } from './templateSkeleton';
import {
  COL,
  FIRST_DATA_ROW,
  MAX_SUBSCRIBERS,
  colName,
  lineToSheet,
  meterToSheet,
  monthCols,
  monthToSheet,
  norm,
  tariffAmount,
  typeToSheet,
} from './format';

// ---------------------------------------------------------------------------
// XML cell writers
// ---------------------------------------------------------------------------

// Cell style ids from the template's styles.xml (same ids in the master template).
const S = {
  barangay: 4,
  text: 5,
  center: 6,
  derived: 15, // grey formula cells (PAST for Feb-Dec, CU.M USED)
  amount: 16, // peso-formatted formula cells
  payYear: 4,
  payMonth: 4,
  balance: 7,
} as const;

function esc(t: string): string {
  // eslint-disable-next-line no-control-regex
  return t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function num(n: number): string {
  return String(Math.round(n * 1e6) / 1e6);
}

function textCell(ref: string, style: number, text: string): string {
  if (text === '') return `<c r="${ref}" s="${style}"/>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
}

function numCell(ref: string, style: number, n: number | null): string {
  if (n === null || !isFinite(n)) return `<c r="${ref}" s="${style}"/>`;
  return `<c r="${ref}" s="${style}"><v>${num(n)}</v></c>`;
}

function amountFormula(r: number, cuRef: string): string {
  return (
    `IF($C${r}="RESIDENTIAL", IF(${cuRef}&lt;=12, 75, ((${cuRef}-12)*12.5)+75), ` +
    `IF($C${r}="COMMERCIAL", IF(${cuRef}&lt;=12, 150, ((${cuRef}-12)*15)+150), "Invalid Category"))`
  );
}

// Hidden lookup cells (column BI) that feed the dropdown lists of columns D and E.
// They sit in the same rows as the first subscribers, so they are rewritten with
// those rows exactly as in the master template (BI4:BI5 meter status, BI7:BI12
// line status, BI14:BI15 YES/NO).
const LOOKUP_ROWS: Record<number, string> = {
  4: 'IN-SERVICE',
  5: 'BLURRED',
  7: 'OPERATIONAL',
  8: 'DISCONNECTED',
  9: 'TEMPORARY CLOSED',
  10: 'PENDING VERIFICATION',
  11: 'NO OCCUPANT',
  12: 'HIGH CONSUMPTION',
  14: 'YES',
  15: 'NO',
};
const LAST_LOOKUP_ROW = 15;

function lookupCell(r: number): string {
  const v = LOOKUP_ROWS[r];
  return v ? `<c r="${colName(61)}${r}" t="inlineStr"><is><t>${v}</t></is></c>` : '';
}

function buildRow(a: ExportAccount, r: number, year: number): string {
  const type = typeToSheet(a.type);
  const c: string[] = [];

  c.push(textCell(`A${r}`, S.barangay, norm(a.barangay)));
  c.push(textCell(`B${r}`, S.text, a.subscriberName));
  c.push(textCell(`C${r}`, S.center, type));
  c.push(textCell(`D${r}`, S.text, lineToSheet(a.lineStatus)));
  c.push(textCell(`E${r}`, S.center, meterToSheet(a.meterStatus)));

  for (let m = 0; m < 12; m++) {
    const cols = monthCols(m);
    const pastRef = `${colName(cols.past)}${r}`;
    const presRef = `${colName(cols.present)}${r}`;
    const cuRef = `${colName(cols.cu)}${r}`;
    const amtRef = `${colName(cols.amount)}${r}`;

    const present = a.present[m] ?? null;
    // Value Excel will compute for PAST (empty cells count as 0)
    const pastVal = m === 0 ? a.januaryPast ?? 0 : a.present[m - 1] ?? 0;

    if (m === 0) {
      c.push(numCell(pastRef, S.text, a.januaryPast));
    } else {
      const prevPres = `${colName(monthCols(m - 1).present)}${r}`;
      c.push(`<c r="${pastRef}" s="${S.derived}"><f>${prevPres}</f><v>${num(pastVal)}</v></c>`);
    }

    c.push(numCell(presRef, S.text, present));

    const cu = (present ?? 0) - pastVal;
    c.push(`<c r="${cuRef}" s="${S.derived}"><f>${presRef}-${pastRef}</f><v>${num(cu)}</v></c>`);

    const amt = tariffAmount(type, cu);
    if (amt === 'Invalid Category') {
      c.push(`<c r="${amtRef}" s="${S.amount}" t="str"><f>${amountFormula(r, cuRef)}</f><v>Invalid Category</v></c>`);
    } else {
      c.push(`<c r="${amtRef}" s="${S.amount}"><f>${amountFormula(r, cuRef)}</f><v>${num(amt)}</v></c>`);
    }
  }

  // BB / BC: disconnection status / date (not tracked in the app yet) - keep styled and empty
  c.push(`<c r="${colName(COL.disconnectionStatus)}${r}" s="${S.text}"/>`);
  c.push(`<c r="${colName(COL.disconnectionDate)}${r}" s="${S.text}"/>`);

  const yr = a.yearLastPayment && /^\d{4}$/.test(a.yearLastPayment.trim()) ? Number(a.yearLastPayment.trim()) : null;
  c.push(numCell(`${colName(COL.payYear)}${r}`, S.payYear, yr));
  c.push(textCell(`${colName(COL.payMonth)}${r}`, S.payMonth, monthToSheet(a.monthLastPayment)));
  c.push(numCell(`${colName(COL.balance)}${r}`, S.balance, a.remainingBalance));
  c.push(textCell(`${colName(COL.remarks)}${r}`, S.text, a.remarks ?? ''));

  c.push(lookupCell(r));

  // Hidden ACCOUNT ID (BJ) - lets a later import match this row to the same account
  c.push(`<c r="${colName(COL.accountId)}${r}"><v>${a.id}</v></c>`);

  return `<row r="${r}">${c.join('')}</row>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class TooManySubscribersError extends Error {}

/**
 * Fills the embedded official template (header rows, merges, dropdowns,
 * conditional formatting, hidden lookup cells, sheet 2 ... all untouched) with
 * the given accounts and returns the .xlsx file bytes.
 *
 * Only these are written: A-E, January PAST (F), the 12 PRESENT columns, BD-BG
 * and the hidden ACCOUNT ID (BJ), plus the year in row 1. PAST (Feb-Dec),
 * CU.M USED and AMOUNT are written as the workbook's own formulas, one per row.
 */
export function buildOfficialWorkbook(accounts: ExportAccount[], year: number): Uint8Array {
  if (accounts.length > MAX_SUBSCRIBERS) {
    throw new TooManySubscribersError(
      `The workbook supports up to ${MAX_SUBSCRIBERS} subscribers; there are ${accounts.length}. Export by barangay instead.`
    );
  }

  const files = unzipSync(base64ToBytes(TEMPLATE_SKELETON_B64));
  let sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
  let workbook = strFromU8(files['xl/workbook.xml']);

  const rows: string[] = new Array<string>(accounts.length);
  let balanceTotal = 0;
  const barangays = new Set<string>();
  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i];
    rows[i] = buildRow(a, FIRST_DATA_ROW + i, year);
    if (a.remainingBalance != null && isFinite(a.remainingBalance)) balanceTotal += a.remainingBalance;
    const b = norm(a.barangay);
    if (b !== '') barangays.add(b);
  }

  const lastRow = Math.max(FIRST_DATA_ROW, FIRST_DATA_ROW + accounts.length - 1);

  // With very few subscribers the dropdown lookup cells (rows up to 15) still need their rows.
  for (let r = FIRST_DATA_ROW + accounts.length; r <= LAST_LOOKUP_ROW; r++) {
    const cell = lookupCell(r);
    if (cell) rows.push(`<row r="${r}">${cell}</row>`);
  }
  const lastUsedRow = Math.max(lastRow, LAST_LOOKUP_ROW);

  // split/join avoids '$' replacement patterns in String.replace
  sheet = sheet.split('__YEAR__').join(String(year));
  sheet = sheet.split('__A1__').join(`${barangays.size} BARANGAYS`);
  sheet = sheet.split('__B1__').join(`${accounts.length} SUBSCRIBERS`);
  sheet = sheet.split('__BF1__').join(num(balanceTotal));
  sheet = sheet.split('__DIM__').join(`A1:BM${lastUsedRow}`);
  sheet = sheet.split('__ROWS__').join(rows.join(''));
  workbook = workbook.split('__PRINT__').join(String(lastRow + 2));

  files['xl/worksheets/sheet1.xml'] = strToU8(sheet);
  files['xl/workbook.xml'] = strToU8(workbook);

  return zipSync(files, { level: 4 });
}
