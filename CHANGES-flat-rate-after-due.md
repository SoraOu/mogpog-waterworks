# Update 3 - blurred meter flat rate and amount after due date

Extract at the project root, then rebuild the app (no new packages, nothing to npm install).

## Behaviour
* **Blurred meter:** a reading with the remark "Blurred meter" is billed the flat minimum of the account's class
  (residential 75, commercial 150), whatever number was typed. No present reading is saved for it.
  The reading screen shows "Flat rate - blurred meter"; the receipt says "Flat rate" instead of usage.
  The next month's previous reading is the last real reading, and that month is billed on the combined usage.
* **Receipt:** "Amount After Due Date" = Total Current Charges + 15 percent, rounded to the centavo
  (75 -> 86.25, 175 -> 201.25, 270 -> 310.50). Current charges only, not the remaining balance.
  "Due Date" is still a blank line until the rule is decided.
* **Excel export:** the PAST cell of a month that follows a month with no reading used to become 0 (the workbook's own
  formula), which billed the whole meter value. It now falls back to the last known reading:
  `=IF(ISNUMBER(G4),G4,120)`. Where the previous month has a reading the plain official formula `=G4` is unchanged.
  Once the missing PRESENT is typed in Excel the formula follows it again.

## Files
`lib/billing.ts`, `db/schema.ts`, `excel/exportWorkbook.ts`, `components/Receipt.tsx`, `app/receipt/[id].tsx`,
`app/reading/[id].tsx`, `app/account/[id].tsx`

## Database
One-time migration `migrated_blurred_amount_v1` gives existing "Blurred meter" readings their flat amount.

## Known limits
* Existing blurred readings that already have a number typed still bill flat in the app, but Excel calculates from that number.
* Rates are still fixed in `lib/billing.ts` (rate changes are not handled yet).
