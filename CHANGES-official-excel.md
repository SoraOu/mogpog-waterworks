# Official WATER READING SYSTEM workbook - update

Extract at the project root (overwrites the files below), then run:

    npm install          # adds fflate (pure JS zip library)
    npx tsc --noEmit     # optional type check

Back up `waterworks.db` (or test on a copy) before the first launch: `initDb()` runs a
one-time migration (see "Database").

## Files
| File | Change |
|---|---|
| `package.json` | + `fflate` |
| `types/index.ts` | + line statuses `Pending Verification`, `High Consumption`; `Account.openingReading`, `Account.remarks`; `Account.previousReading` is now the derived previous for the current month |
| `db/schema.ts` | + `accounts.remarks`; drops the unique index on (barangay, name); one-time migration restoring each account's opening reading |
| `db/queries.ts` | derived previous reading (`getPreviousReading`), re-chaining after save/delete/opening edit, `getAccountsForExport`, `getReadingYears`, `countAccountsWithName`; removed `upsertAccount`, `upsertBarangay`, `getFullExportData`, `updateAccountFields` |
| `db/officialImport.ts` | NEW - applies an import plan in one transaction |
| `excel/*.ts` | NEW - layout/mappers, template skeleton (generated), export builder, import parser, matching plan, base64 helpers |
| `app/(tabs)/import.tsx` | rewritten: official workbook only, preview/confirm, review list |
| `app/(tabs)/export.tsx` | rewritten: fills the official template, year picker |
| `app/reading/[id].tsx` | "previous" follows the selected month |
| `app/account/[id].tsx`, `app/account/add.tsx` | 6 line statuses, remarks field, opening-reading label, duplicate-name warning |

## Database
* Readings store PRESENT. Previous = latest earlier month's present reading, else the account's opening reading (`accounts.previous_reading`).
* Migration (once, flag `migrated_opening_reading_v1` in `settings`): `accounts.previous_reading` used to hold the latest present reading; it is restored from the earliest saved reading's own previous value, only where one exists.
* Name is no longer unique; account `id` is the identity.

## Export
* `excel/templateSkeleton.ts` is the fixed master template with the subscriber rows removed. Do not edit by hand.
* Written: A-E, January PAST, 12 PRESENT columns, BD-BG, hidden ACCOUNT ID (BJ), year in row 1, hidden dropdown lists (BI).
* Formulas for PAST (Feb-Dec), CU.M USED and AMOUNT are written per row (`$C<row>`, the bug fix).
* Max 4,995 subscribers per file (the sheet's counts/dropdowns stop at row 4998).

## Import
* Only the `WATER SUBSCRIBERS` sheet; layout checked before anything is read.
* CU.M USED, AMOUNT and PAST (except January) are ignored.
* Matching: hidden ACCOUNT ID, else barangay + exact name when unambiguous, else the row goes to a review list and is NOT imported.
* Blank cells never erase stored data; name and barangay of existing accounts are never changed.
* One transaction: any failure changes nothing.
