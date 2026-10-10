# Billing, e-receipt and monthly remarks - update 2

Extract at the project root (overwrites the files below), then:

    npm install --legacy-peer-deps    # adds react-native-view-shot (NATIVE module)
    npx expo run:android --variant release --device    # a rebuild is required

Because react-native-view-shot is a native module, installing only the JavaScript
(e.g. a reload) is not enough: the app must be rebuilt and reinstalled.

## New behaviour
* **Tariff in the app** (`lib/billing.ts`, the only place the rates live): residential 75 up to 12 m3 then 12.50/m3;
  commercial 150 up to 12 m3 then 15/m3; zero usage bills the minimum. Rates come from the workbook's AMOUNT formula: confirm them with the LGU.
* **Amount saved with each reading** (`readings.amount`). Not billed: "No reading", a missing previous reading, or a reading lower than the previous one ("Check reading").
* **Reading screen:** live "Amount due" while typing; after Save a result screen with Generate Receipt / Edit this reading / Done.
* **E-receipt image** (`app/receipt/[id].tsx`, `components/Receipt.tsx`), laid out like sheet 2 of the workbook, shared as a PNG
  through the phone's share sheet. Address = barangay. Due Date and Amount After Due Date are blank lines for now.
  Also available from a month's detail on the account page.
* **Remarks per month:** the bottom box of the reading screen (formerly "Notes") is the month's remark.
  Excel REMARKS shows the most recent month's remark as `OCT: text`; on import `OCT: text` goes back to that month's reading
  (or stays an account remark when that month has no reading). Anything else in REMARKS stays an account remark.

## Files
`package.json`, `types/index.ts`, `lib/billing.ts` (new), `db/schema.ts`, `db/queries.ts`, `db/officialImport.ts`,
`excel/format.ts`, `excel/exportWorkbook.ts`, `components/Receipt.tsx` (new), `app/receipt/[id].tsx` (new),
`app/reading/[id].tsx`, `app/account/[id].tsx`, `app/_layout.tsx`.

## Database
Additive only: `readings.amount`. One-time migration `migrated_amount_v1` fills the amount of existing readings. Back up first.

## Not changed
Excel layout/format, matching rules of the import, Sheet 2 of the workbook, due date / penalty / remaining balance on the receipt.
