# Graph Report - mogpog-waterworks  (2026-10-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 323 nodes · 851 edges · 12 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ade5f11c`
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

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 34 edges
2. `norm()` - 22 edges
3. `AccountDetailScreen()` - 20 edges
4. `parseOfficialWorkbook()` - 19 edges
5. `ReadingEntryScreen()` - 17 edges
6. `buildRow()` - 16 edges
7. `react` - 16 edges
8. `ImportScreen()` - 15 edges
9. `Colors` - 15 edges
10. `react-native` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Props` --references--> `Account`  [EXTRACTED]
  components/AccountRow.tsx → types/index.ts
- `Props` --references--> `Barangay`  [EXTRACTED]
  components/BarangayRow.tsx → types/index.ts
- `ParsedRow` --references--> `AccountType`  [EXTRACTED]
  excel/importParser.ts → types/index.ts
- `ParsedRow` --references--> `LineStatus`  [EXTRACTED]
  excel/importParser.ts → types/index.ts
- `ParsedRow` --references--> `MeterStatus`  [EXTRACTED]
  excel/importParser.ts → types/index.ts

## Import Cycles
- None detected.

## Communities (12 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (48): AddAccountScreen(), handleSave(), BarangayScreen(), handleMarkNoReading(), styles, formatDateLabel(), generateMonthOptions(), monthLabel() (+40 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (48): amountFormula(), buildOfficialWorkbook(), buildRow(), esc(), LOOKUP_ROWS, lookupCell(), num(), numCell() (+40 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (39): ACCOUNT_TYPES, LINE_STATUSES, METER_STATUSES, styles, longDate(), monthLabel(), ReceiptScreen(), styles (+31 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (29): hashBytes(), ImportScreen(), handleConfirm(), handlePick(), readAndPlan(), Pending, Stat(), styles (+21 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (25): backgroundColor, foregroundImage, adaptiveIcon, package, predictiveBackGestureEnabled, projectId, expo, android (+17 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (25): devDependencies, @types/react, typescript, main, name, private, scripts, android (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (17): RootLayout(), BlankRow(), Receipt(), RECEIPT_WIDTH, ReceiptData, Row(), styles, initDb() (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (14): AccountDetailScreen(), handleDeleteAccount(), handleDeleteReading(), saveEdit(), DetailItem(), InfoRow(), LINE_STATUSES, METER_STATUSES (+6 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (17): dependencies, expo, expo-document-picker, expo-file-system, expo-linking, expo-router, expo-sharing, expo-splash-screen (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (12): BarangayMeta, ExportScreen(), doExport(), monthLabel(), styles, yearOptions(), getAccountsForExport(), getAllBarangaysForExport() (+4 more)

### Community 10 - "Community 10"
Cohesion: 0.80
Nodes (6): evalArithmetic(), expression(), factor(), number(), peek(), term()

### Community 11 - "Community 11"
Cohesion: 0.40
Nodes (4): expo/tsconfig.base, compilerOptions, strict, extends

## Knowledge Gaps
- **90 isolated node(s):** `AccountRow`, `ReadingRow`, `Sheet`, `SearchMode`, `ImportResult` (+85 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 100 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 8` to `Community 5`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `react` connect `Community 2` to `Community 0`, `Community 3`, `Community 5`, `Community 6`, `Community 7`, `Community 9`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `react-native` connect `Community 2` to `Community 0`, `Community 3`, `Community 5`, `Community 6`, `Community 7`, `Community 9`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `AccountRow`, `ReadingRow`, `Sheet` to the rest of the system?**
  _90 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08944793850454227 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.10784313725490197 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09568627450980392 - nodes in this community are weakly interconnected._