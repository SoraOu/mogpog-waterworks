# Graph Report - mogpog-waterworks  (2026-10-01)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 219 nodes · 506 edges · 10 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7540e8dc`
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

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 29 edges
2. `AccountDetailScreen()` - 17 edges
3. `getSetting()` - 16 edges
4. `Colors` - 14 edges
5. `react` - 14 edges
6. `expo` - 14 edges
7. `ReadingEntryScreen()` - 13 edges
8. `react-native` - 13 edges
9. `currentMonth()` - 12 edges
10. `expo-router` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Props` --references--> `Account`  [EXTRACTED]
  components/AccountRow.tsx → types/index.ts
- `Props` --references--> `Barangay`  [EXTRACTED]
  components/BarangayRow.tsx → types/index.ts
- `SettingsScreen()` --calls--> `getSetting()`  [EXTRACTED]
  app/settings/index.tsx → db/queries.ts
- `handleSave()` --calls--> `setSetting()`  [EXTRACTED]
  app/settings/index.tsx → db/queries.ts
- `handleQueryChange()` --calls--> `searchAllAccounts()`  [EXTRACTED]
  app/(tabs)/index.tsx → db/queries.ts

## Import Cycles
- None detected.

## Communities (10 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (32): styles, SettingsScreen(), handleSave(), styles, HomeScreen(), handleQueryChange(), SearchMode, styles (+24 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (26): BarangayScreen(), handleMarkNoReading(), formatDateLabel(), generateMonthOptions(), monthLabel(), ReadingEntryScreen(), doSave(), handleSave() (+18 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (26): RootLayout(), initDb(), devDependencies, @types/react, typescript, main, name, private (+18 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (25): backgroundColor, foregroundImage, adaptiveIcon, package, predictiveBackGestureEnabled, projectId, expo, android (+17 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (17): ACCOUNT_TYPES, AddAccountScreen(), handleSave(), LINE_STATUSES, METER_STATUSES, styles, Props, createAccount() (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (15): AccountDetailScreen(), handleDeleteAccount(), handleDeleteReading(), saveEdit(), DetailItem(), InfoRow(), LINE_STATUSES, METER_STATUSES (+7 more)

### Community 6 - "Community 6"
Cohesion: 0.20
Nodes (16): findHeaderRowIndex(), ImportScreen(), handlePick(), processSheet(), mapColumns(), parseBalance(), parseLastPayment(), parseLineStatus() (+8 more)

### Community 7 - "Community 7"
Cohesion: 0.26
Nodes (14): BarangayMeta, ExportScreen(), buildTemplateSheet(), exportAll(), exportBarangay(), generateMonthOptions(), monthLabel(), styles (+6 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (15): dependencies, expo, expo-document-picker, expo-file-system, expo-linking, expo-router, expo-sharing, expo-splash-screen (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.40
Nodes (4): expo/tsconfig.base, compilerOptions, strict, extends

## Knowledge Gaps
- **76 isolated node(s):** `SearchMode`, `FullExportRow`, `BarangayMeta`, `styles`, `styles` (+71 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 86 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 8` to `Community 2`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Why does `react` connect `Community 0` to `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `react-native` connect `Community 0` to `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **What connects `SearchMode`, `FullExportRow`, `BarangayMeta` to the rest of the system?**
  _76 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12179487179487179 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13118279569892474 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07586206896551724 - nodes in this community are weakly interconnected._