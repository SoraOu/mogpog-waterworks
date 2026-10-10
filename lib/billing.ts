// ---------------------------------------------------------------------------
// Water billing - the ONE place where the tariff lives.
// Rates are the ones in the AMOUNT formula of the official WATER READING SYSTEM
// workbook (sheet 1). Confirm them against the LGU's current rate schedule.
//
//   Residential: PHP 75 covers up to 12 m3, then PHP 12.50 per m3 above that.
//   Commercial:  PHP 150 covers up to 12 m3, then PHP 15 per m3 above that.
//   Zero usage still pays the minimum.
// ---------------------------------------------------------------------------

export const INCLUDED_CU_M = 12;

export const RATES: Record<'RESIDENTIAL' | 'COMMERCIAL', { minimum: number; perCuM: number }> = {
  RESIDENTIAL: { minimum: 75, perCuM: 12.5 },
  COMMERCIAL: { minimum: 150, perCuM: 15 },
};

function rateFor(type: string | null | undefined) {
  const t = String(type ?? '').trim().toUpperCase();
  if (t === 'RESIDENTIAL') return RATES.RESIDENTIAL;
  if (t === 'COMMERCIAL') return RATES.COMMERCIAL;
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Amount for a consumption, or null when the account type is unknown or consumption is not a valid number. */
export function computeAmount(type: string | null | undefined, consumption: number | null | undefined): number | null {
  const rate = rateFor(type);
  if (!rate || consumption == null || !isFinite(consumption)) return null;
  if (consumption <= INCLUDED_CU_M) return rate.minimum;
  return round2(rate.minimum + (consumption - INCLUDED_CU_M) * rate.perCuM);
}

/**
 * The same arithmetic as the workbook's AMOUNT formula, INCLUDING its behaviour
 * for empty/negative usage (it bills the minimum). Used only to fill the cached
 * values of the exported workbook so file previews match what Excel shows.
 */
export function workbookAmount(type: string | null | undefined, cu: number): number | 'Invalid Category' {
  const rate = rateFor(type);
  if (!rate) return 'Invalid Category';
  return cu <= INCLUDED_CU_M ? rate.minimum : (cu - INCLUDED_CU_M) * rate.perCuM + rate.minimum;
}

export type BillingStatus =
  | { kind: 'amount'; amount: number }
  /** consumption is negative: typo or replaced meter - do not bill until confirmed */
  | { kind: 'check' }
  /** nothing to bill: no reading, no previous reading to compare with, or unknown class */
  | { kind: 'none' };

export function billingStatus(
  type: string | null | undefined,
  consumption: number | null | undefined,
  presentReading?: number | null,
  remark?: string | null
): BillingStatus {
  if (remark === 'No reading') return { kind: 'none' };
  if (presentReading !== undefined && presentReading === null) return { kind: 'none' };
  if (consumption == null || !isFinite(consumption)) return { kind: 'none' };
  if (consumption < 0) return { kind: 'check' };
  const amount = computeAmount(type, consumption);
  return amount === null ? { kind: 'none' } : { kind: 'amount', amount };
}

/** 1234.5 -> "₱1,234.50" (no Intl dependency, so it behaves the same on every device). */
export function formatPeso(n: number): string {
  const fixed = Math.abs(n).toFixed(2);
  const [whole, dec] = fixed.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}₱${withCommas}.${dec}`;
}

/** Consumption for display, without floating-point noise: 12.300000000000001 -> "12.3" */
export function formatCuM(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}
