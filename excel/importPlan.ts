import { norm } from './format';
import type { ParsedRow } from './importParser';

export interface ExistingAccount {
  id: number;
  barangayName: string;
  subscriberName: string;
}

export interface PlanItem {
  row: ParsedRow;
  action: 'create' | 'update';
  /** Set for 'update'. */
  accountId: number | null;
}

export interface ReviewItem {
  row: ParsedRow;
  reason: string;
}

export interface ImportPlan {
  year: number;
  items: PlanItem[];
  review: ReviewItem[];
  created: number;
  updated: number;
  newBarangays: string[];
  readingCount: number;
}

function key(barangay: string, name: string): string {
  return `${norm(barangay)}\u0001${norm(name)}`;
}

/**
 * Decides, for every parsed row, whether it updates an existing account,
 * creates a new one, or needs a human decision. Nothing is ever merged by
 * guessing:
 *   1. A row whose hidden ACCOUNT ID (BJ) points at an existing account with
 *      the same barangay + name updates exactly that account. This is what
 *      keeps two subscribers with the same name apart.
 *   2. Otherwise rows are matched by barangay + exact name (case/spacing
 *      ignored) ONLY when it is unambiguous: one row in the file and one
 *      account in the app. No account with that name -> create.
 *   3. Any other case (several rows and/or several accounts share the name,
 *      or an ID points at a different subscriber) goes to `review` and is not
 *      imported.
 */
export function planImport(
  year: number,
  rows: ParsedRow[],
  existing: ExistingAccount[],
  existingBarangays: string[]
): ImportPlan {
  const byId = new Map<number, ExistingAccount>();
  const byKey = new Map<string, number[]>();
  for (const a of existing) {
    byId.set(a.id, a);
    const k = key(a.barangayName, a.subscriberName);
    const list = byKey.get(k);
    if (list) list.push(a.id);
    else byKey.set(k, [a.id]);
  }

  const items: PlanItem[] = [];
  const review: ReviewItem[] = [];
  const usedIds = new Set<number>();
  const decided = new Set<ParsedRow>();

  // Pass 1: rows carrying a usable ACCOUNT ID
  for (const row of rows) {
    if (row.accountId === null) continue;
    const acc = byId.get(row.accountId);
    if (!acc) continue; // ID from another database: fall back to name matching

    if (usedIds.has(acc.id)) {
      review.push({ row, reason: `ACCOUNT ID ${acc.id} appears on more than one row` });
      decided.add(row);
      continue;
    }
    if (key(acc.barangayName, acc.subscriberName) !== key(row.barangay, row.name)) {
      review.push({
        row,
        reason: `ACCOUNT ID ${acc.id} belongs to "${acc.subscriberName}" (${acc.barangayName}) in the app, not this subscriber`,
      });
      decided.add(row);
      continue;
    }
    usedIds.add(acc.id);
    items.push({ row, action: 'update', accountId: acc.id });
    decided.add(row);
  }

  // Pass 2: everything else, grouped by barangay + name
  const groups = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    if (decided.has(row)) continue;
    const k = key(row.barangay, row.name);
    const g = groups.get(k);
    if (g) g.push(row);
    else groups.set(k, [row]);
  }

  groups.forEach((group, k) => {
    const candidates = (byKey.get(k) ?? []).filter((id) => !usedIds.has(id));
    if (candidates.length === 0) {
      for (const row of group) items.push({ row, action: 'create', accountId: null });
    } else if (group.length === 1 && candidates.length === 1) {
      usedIds.add(candidates[0]);
      items.push({ row: group[0], action: 'update', accountId: candidates[0] });
    } else {
      for (const row of group) {
        review.push({
          row,
          reason: `${group.length} row(s) in the file and ${candidates.length} account(s) in the app share this name`,
        });
      }
    }
  });

  items.sort((a, b) => a.row.rowNumber - b.row.rowNumber);
  review.sort((a, b) => a.row.rowNumber - b.row.rowNumber);

  const known = new Set(existingBarangays.map((b) => norm(b)));
  const newBarangays: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const nb = norm(it.row.barangay);
    if (!known.has(nb) && !seen.has(nb)) {
      seen.add(nb);
      newBarangays.push(it.row.barangay);
    }
  }

  let readingCount = 0;
  for (const it of items) for (const p of it.row.present) if (p !== null) readingCount++;

  return {
    year,
    items,
    review,
    created: items.filter((i) => i.action === 'create').length,
    updated: items.filter((i) => i.action === 'update').length,
    newBarangays,
    readingCount,
  };
}
