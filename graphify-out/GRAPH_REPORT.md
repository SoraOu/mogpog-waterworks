# Graph Report - mogpog-waterworks  (2026-10-28)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 325 nodes · 858 edges · 13 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c2f89bee`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 34 edges
2. `norm()` - 22 edges
3. `AccountDetailScreen()` - 20 edges
4. `parseOfficialWorkbook()` - 19 edges
5. `ReadingEntryScreen()` - 17 edges
6. `buildRow()` - 16 edges
7. `react` - 16 edges
8. `BillingStatus` - 15 edges
9. `ImportScreen()` - 15 edges
10. `Colors` - 15 edges

## Surprising Connections (you probably didn't know these)
- `ParsedRow` --references--> `AccountType`  [EXTRACTED]
  excel/importParser.ts → types/index.ts
- `Props` --references--> `Account`  [EXTRACTED]
  components/AccountRow.tsx → types/index.ts
- `Props` --references--> `Barangay`  [EXTRACTED]
  components/BarangayRow.tsx → types/index.ts
- `ParsedRow` --references--> `MeterStatus`  [EXTRACTED]
  excel/importParser.ts → types/index.ts
- `AccountDetailScreen()` --calls--> `BillingStatus`  [EXTRACTED]
  app/account/[id].tsx → lib/billing.ts

## Import Cycles
- None detected.

## Communities (13 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (50): base64ToBytes(), amountFormula(), buildOfficialWorkbook(), buildRow(), esc(), LOOKUP_ROWS, lookupCell(), num() (+42 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (31): styles, styles, styles, SearchMode, styles, TabIcon(), TabLayout(), AccountRow() (+23 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (36): BarangayScreen(), handleMarkNoReading(), formatDateLabel(), generateMonthOptions(), monthLabel(), ReadingEntryScreen(), doSave(), handleSave() (+28 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (29): hashBytes(), ImportScreen(), handleConfirm(), handlePick(), readAndPlan(), Pending, Stat(), styles (+21 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (24): RootLayout(), longDate(), monthLabel(), ReceiptScreen(), BlankRow(), Receipt(), RECEIPT_WIDTH, ReceiptData (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (26): devDependencies, @types/react, typescript, main, name, private, scripts, android (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (25): backgroundColor, foregroundImage, adaptiveIcon, package, predictiveBackGestureEnabled, projectId, expo, android (+17 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (15): AccountDetailScreen(), handleDeleteAccount(), handleDeleteReading(), saveEdit(), DetailItem(), InfoRow(), LINE_STATUSES, METER_STATUSES (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (17): dependencies, expo, expo-document-picker, expo-file-system, expo-linking, expo-router, expo-sharing, expo-splash-screen (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (12): BarangayMeta, ExportScreen(), doExport(), monthLabel(), styles, yearOptions(), getAccountsForExport(), getAllBarangaysForExport() (+4 more)

### Community 10 - "Community 10"
Cohesion: 0.26
Nodes (11): ACCOUNT_TYPES, AddAccountScreen(), handleSave(), LINE_STATUSES, METER_STATUSES, styles, countAccountsWithName(), createAccount() (+3 more)

### Community 11 - "Community 11"
Cohesion: 0.80
Nodes (6): evalArithmetic(), expression(), factor(), number(), peek(), term()

### Community 12 - "Community 12"
Cohesion: 0.40
Nodes (4): expo/tsconfig.base, compilerOptions, strict, extends

## Knowledge Gaps
- **91 isolated node(s):** `Sheet`, `SearchMode`, `AccountRow`, `ReadingRow`, `ImportResult` (+86 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 101 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 8` to `Community 5`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `react` connect `Community 1` to `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 7`, `Community 9`, `Community 10`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `react-native` connect `Community 1` to `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 7`, `Community 9`, `Community 10`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `Sheet`, `SearchMode`, `AccountRow` to the rest of the system?**
  _91 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10482180293501048 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13124274099883856 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0951219512195122 - nodes in this community are weakly interconnected._