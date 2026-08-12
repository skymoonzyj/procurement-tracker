# 行政采购未报销收集工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, single-user, browser-local procurement tracker that stores purchase records and invoice PDFs locally, suggests invoice matches, and keeps the unreimbursed total accurate after bulk reimbursement actions.

**Architecture:** A React + Vite + TypeScript SPA uses a small domain layer for money, dates, validation, metrics, matching, and backup serialization. A reducer-backed application store hydrates from native IndexedDB and persists mutations; PDF.js extracts text in the browser and a pure matcher ranks candidate purchases. Pages share a shell and reusable table/form/status components, with no server or business-data network calls.

**Tech Stack:** React 18, TypeScript, Vite, native IndexedDB, `pdfjs-dist`, Vitest, Testing Library, plain CSS (no runtime UI framework).

## Global Constraints

- All purchase amounts are stored as integer cents; displayed with `¥0.00`.
- `pendingTotal` is the sum of records where `reimbursed === false`; bulk mark/unmark must update it immediately.
- PDF files and extracted text stay in the browser; OCR, login, collaboration, server sync, and real cloud-drive APIs are out of scope.
- The app must work after refresh with IndexedDB data and must provide JSON export/import backup.
- All user-facing copy is Simplified Chinese; invalid input and failed PDF parsing must be recoverable.
- New behavior follows red-green-refactor: write a failing test, run it, implement the minimum, then rerun the targeted and full suites.

---

### Task 1: Bootstrap the Vite application and test harness

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/main.tsx`
- Create: `src/test/setup.ts`

**Interfaces:**
- Produces `npm run dev`, `npm run build`, `npm run typecheck`, and `npm run test:run` commands for all later tasks.

- [ ] **Step 1: Write the failing smoke test**

Create `src/App.smoke.test.tsx` with a test that imports `App` and expects the shell heading `采购报销台账`.

```tsx
import { render, screen } from '@testing-library/react'
import { App } from './App'

it('renders the procurement ledger shell', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: '采购报销台账' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the smoke test and verify the expected missing-module failure**

Run `npm run test:run -- src/App.smoke.test.tsx`. It must fail because the initial app entry is not implemented yet, not because Vitest cannot start.

- [ ] **Step 3: Add the minimal Vite/React package and test configuration**

Define scripts (`dev`, `build`, `typecheck`, `test:run`) and dependencies for React, `pdfjs-dist`, Vitest, jsdom, Testing Library, and the Vite React plugin. Configure Vitest with `environment: 'jsdom'`, `setupFiles: './src/test/setup.ts'`, and globals enabled.

- [ ] **Step 4: Add the minimal app entry that satisfies the smoke test**

Create `src/App.tsx` exporting `App` with one `h1` and wire it from `src/main.tsx`.

- [ ] **Step 5: Run the targeted and baseline checks**

Run `npm run test:run -- src/App.smoke.test.tsx`, then `npm run typecheck`. Expected: both pass with no unhandled console errors.

- [ ] **Step 6: Commit the bootstrap**

```powershell
git add package.json index.html vite.config.ts tsconfig.json tsconfig.node.json src
git commit -m "chore: bootstrap local procurement tracker"
```

### Task 2: Implement the tested domain model and calculations

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/money.ts`
- Create: `src/domain/date.ts`
- Create: `src/domain/validation.ts`
- Create: `src/domain/metrics.ts`
- Create: `src/domain/__tests__/money.test.ts`
- Create: `src/domain/__tests__/validation.test.ts`
- Create: `src/domain/__tests__/metrics.test.ts`

**Interfaces:**
- `PurchaseRecord`, `InvoiceRecord`, `InvoiceStatus` match the design spec.
- `toCents(value: string | number): number`, `formatCNY(cents: number): string`, `calculateTotalCents(quantity: number, unitPriceCents: number): number`.
- `validatePurchaseInput(input: PurchaseInput): Record<string, string>`.
- `calculateMetrics(records: PurchaseRecord): DashboardMetrics`.

- [ ] **Step 1: Write failing money tests**

Cover `2 × ¥12.34 = 2468` cents and reject negative/invalid values. Assert `formatCNY(2468) === '¥24.68'`.

- [ ] **Step 2: Run the money tests and verify they fail for missing exports**

Run `npm run test:run -- src/domain/__tests__/money.test.ts` and confirm the failure is the absent domain functions.

- [ ] **Step 3: Implement the minimal integer-cent money helpers**

Parse decimal strings without binary floating-point accumulation, round to two decimal places, and clamp no values silently; validation owns rejection.

- [ ] **Step 4: Write failing validation tests**

Assert empty item name, zero quantity, negative price, and malformed date each produce a Chinese field error; a valid input returns an empty error map.

- [ ] **Step 5: Implement validation and typed input definitions**

Use `PurchaseInput` for form values and return stable keys (`itemName`, `quantity`, `unitPriceCents`, `purchasedAt`).

- [ ] **Step 6: Write failing metrics tests**

Create three records dated `2026-08-01`, `2026-08-04`, and `2026-08-07`; mark the first two reimbursed. Assert pending count is 1, pending total is the third total, reimbursed total is the first two totals, and span is 0 days for the single pending record. Add an all-reimbursed case.

- [ ] **Step 7: Implement metrics and date-span helpers**

Filter only `reimbursed === false` for pending metrics, calculate natural-day difference from ISO dates, and return explicit empty-state labels/data instead of `NaN`.

- [ ] **Step 8: Run the domain suite and commit**

Run `npm run test:run -- src/domain`, then `npm run typecheck`; commit with `feat: add tested procurement domain logic`.

### Task 3: Add IndexedDB persistence, backup serialization, and the application store

**Files:**
- Create: `src/storage/db.ts`
- Create: `src/storage/backup.ts`
- Create: `src/state/appReducer.ts`
- Create: `src/state/AppProvider.tsx`
- Create: `src/storage/__tests__/backup.test.ts`
- Create: `src/state/__tests__/appReducer.test.ts`

**Interfaces:**
- `openAppDb(): Promise<IDBDatabase>` with stores `purchases`, `invoices`, `settings`.
- `purchaseRepo` methods: `list()`, `put(record)`, `putMany(records)`, `remove(id)`, `clear()`.
- `invoiceRepo` methods: `list()`, `put(invoice)`, `getBlob(id)`, `remove(id)`.
- `serializeBackup(state): Promise<BackupFile>` and `restoreBackup(file, mode): Promise<RestorePreview>`.
- `AppProvider` exposes `{ state, dispatch, refresh }`; actions include `addPurchase`, `updatePurchase`, `setReimbursed`, `linkInvoice`, `unlinkInvoice`, `addInvoice`, `removeInvoice`, `replaceAll`.

- [ ] **Step 1: Write failing backup round-trip tests**

Use a fixture with one record and one tiny PDF Blob; assert serialization preserves cents, reimbursement state, links, and the invoice binary after decode.

- [ ] **Step 2: Run the backup tests and verify the expected missing-function failure**

Run `npm run test:run -- src/storage/__tests__/backup.test.ts`; confirm it fails on missing backup exports.

- [ ] **Step 3: Implement versioned backup encode/decode**

Use `{ version: 1, exportedAt, purchases, invoices }`; encode Blob bytes as base64 and validate the version and required arrays before restore.

- [ ] **Step 4: Write failing reducer tests for bulk reimbursement**

Assert `setReimbursed` updates every requested ID, sets one shared ISO timestamp, and `setReimbursed(false)` clears `reimbursedAt` without changing totals stored on records.

- [ ] **Step 5: Implement the reducer with immutable updates**

Keep derived metrics out of record mutation; calculate them from state with `calculateMetrics`.

- [ ] **Step 6: Implement IndexedDB repositories and hydration**

Create the database lazily, handle `onupgradeneeded`, serialize writes sequentially, and make `AppProvider` show a loading state until records/invoices are read.

- [ ] **Step 7: Add optimistic persistence with recoverable errors**

Dispatch local state first, persist second, and expose the last persistence error so the shell can show a retryable toast without discarding the in-memory change.

- [ ] **Step 8: Run storage/state tests and commit**

Run `npm run test:run -- src/storage src/state`; commit with `feat: persist local records and backups`.

### Task 4: Build the application shell, purchase form, and purchase table

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/layout/AppShell.tsx`
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/common/Toast.tsx`
- Create: `src/components/common/StatusBadge.tsx`
- Create: `src/components/purchases/PurchaseForm.tsx`
- Create: `src/components/purchases/PurchaseTable.tsx`
- Create: `src/pages/PurchasesPage.tsx`
- Create: `src/pages/OverviewPage.tsx`
- Create: `src/styles.css`
- Create: `src/pages/__tests__/PurchasesPage.test.tsx`

**Interfaces:**
- `PurchaseForm` accepts `initialValue?: PurchaseInput` and `onSubmit(input): Promise<void>`.
- `PurchaseTable` accepts `records`, `selectedIds`, `onSelectionChange`, `onReimburse(ids, value)`, `onEdit`, and `onDelete`.
- `AppShell` owns active page navigation and renders a consistent sidebar/header/content layout.

- [ ] **Step 1: Write the failing purchase-page interaction test**

Render the provider with an empty repository stub, fill item name/quantity/unit price, submit, and assert the table shows the computed total and a checkbox. Add a second test that selects two rows, clicks `批量标记已报销`, and asserts the overview pending total excludes their totals.

- [ ] **Step 2: Run the tests and verify they fail because the form/table are absent**

Run `npm run test:run -- src/pages/__tests__/PurchasesPage.test.tsx` and confirm the failure is a missing UI behavior, not a test setup error.

- [ ] **Step 3: Implement the shell and navigation**

Add Chinese navigation labels, active states, a compact top bar, and responsive collapse behavior at `900px`.

- [ ] **Step 4: Implement the validated purchase form**

Use controlled fields, show inline errors, preview `总价`, preserve the optional link fields, and call the store action only after validation succeeds.

- [ ] **Step 5: Implement filtering, sorting, selection, and bulk actions**

Keep selection IDs stable across rerenders, support current-filter “全选”, disable actions with no selection, and clear selected IDs after a successful bulk action.

- [ ] **Step 6: Implement the overview metric cards and pending list**

Use `calculateMetrics`, render currency/date-span empty states, and make each pending row open the corresponding record editor.

- [ ] **Step 7: Add responsive and accessible styling**

Use semantic headings, labels, keyboard-focus styles, a horizontal table scroll on narrow screens, and the approved visual direction: warm off-white background, dark ink text, coral action accent, muted green reimbursement status.

- [ ] **Step 8: Run the targeted UI tests and commit**

Run the purchase-page test and `npm run build`; commit with `feat: add purchase ledger and bulk reimbursement UI`.

### Task 5: Implement PDF extraction and invoice matching as pure/testable services

**Files:**
- Create: `src/invoices/pdfText.ts`
- Create: `src/invoices/parseInvoice.ts`
- Create: `src/invoices/matchPurchases.ts`
- Create: `src/invoices/__tests__/matchPurchases.test.ts`
- Create: `src/invoices/__tests__/parseInvoice.test.ts`

**Interfaces:**
- `extractPdfText(file: Blob): Promise<{ text: string; pageCount: number }>`.
- `parseInvoiceText(rawText: string): InvoiceFields`.
- `rankPurchaseMatches(invoice: InvoiceFields, records: PurchaseRecord[]): MatchSuggestion[]`.
- `MatchSuggestion` contains `purchaseId`, `score`, `reasons`, and `confidence: 'high' | 'review' | 'none'`.

- [ ] **Step 1: Write failing parser/matcher tests with deterministic text fixtures**

Use raw text containing an item name and `价税合计 246.80`; assert the parser extracts `totalAmountCents: 24680`, and the matcher ranks the matching item above an unrelated item. Add an empty-text fixture that returns `parseStatus: 'empty'` and `needs_review`.

- [ ] **Step 2: Run the invoice tests and verify expected missing-export failures**

Run `npm run test:run -- src/invoices`; confirm failures are from absent service functions.

- [ ] **Step 3: Implement normalization and token scoring**

Normalize full-width punctuation, whitespace, and case; score item token overlap, amount proximity, and ISO-date proximity using the exact 60/30/10 weights from the design.

- [ ] **Step 4: Implement field extraction and confidence thresholds**

Support common Chinese labels (`价税合计`, `开票日期`, `发票号码`, `销售方`) and return nullable fields instead of throwing when labels are absent.

- [ ] **Step 5: Implement the PDF.js worker adapter**

Load each page, concatenate text items with spaces, enforce the 20 MB file limit before parsing, and return a structured failure for encrypted/unreadable PDFs.

- [ ] **Step 6: Run invoice tests and commit**

Run `npm run test:run -- src/invoices`; commit with `feat: parse local invoices and rank matches`.

### Task 6: Build the invoice center and linking workflow

**Files:**
- Create: `src/components/invoices/InvoiceDropzone.tsx`
- Create: `src/components/invoices/InvoiceCard.tsx`
- Create: `src/components/invoices/MatchReviewPanel.tsx`
- Create: `src/pages/InvoicesPage.tsx`
- Create: `src/pages/__tests__/InvoicesPage.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- `InvoiceDropzone` emits `File[]` and displays validation errors.
- `MatchReviewPanel` receives an invoice, suggestions, and purchase records; emits `onConfirm(ids)`, `onSkip()`, and `onUnlink(id)`.

- [ ] **Step 1: Write the failing upload/review interaction tests**

Mock only the PDF adapter boundary, upload a PDF fixture, assert the filename and parsed amount appear, then click a candidate confirmation and assert the purchase row changes to `matched`.

- [ ] **Step 2: Run the tests and verify the missing invoice-center behavior**

Run `npm run test:run -- src/pages/__tests__/InvoicesPage.test.tsx`; confirm the expected UI failure.

- [ ] **Step 3: Implement the dropzone and upload queue**

Accept only PDFs under 20 MB, show progress per file, and keep failed files in a retryable error state.

- [ ] **Step 4: Implement invoice cards and parsed metadata**

Show file name, size, parse status, invoice number/date/vendor/amount when available, and local preview/download actions.

- [ ] **Step 5: Implement match review and store linking**

Render confidence/reasons, allow multi-select purchase candidates, update both sides of the relationship, and set `invoiceStatus` to `matched` only after confirmation.

- [ ] **Step 6: Add manual association for empty/scanned PDFs**

Provide a searchable purchase selector and clear copy that OCR is not included in v1.

- [ ] **Step 7: Run invoice UI tests and commit**

Run the targeted suite and `npm run typecheck`; commit with `feat: add invoice upload and confirmation flow`.

### Task 7: Add archive search, settings, and JSON backup/restore UI

**Files:**
- Create: `src/pages/ArchivePage.tsx`
- Create: `src/pages/SettingsPage.tsx`
- Create: `src/components/settings/BackupDialog.tsx`
- Create: `src/pages/__tests__/SettingsPage.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- `ArchivePage` reuses the table with `includeReimbursed: true` and exposes all columns from the design.
- `BackupDialog` calls `serializeBackup`/`restoreBackup` and returns the chosen merge/replace mode.

- [ ] **Step 1: Write failing settings tests**

Assert clicking `导出备份` triggers a download with the versioned JSON shape, and importing a valid fixture displays a preview before replacement.

- [ ] **Step 2: Run settings tests and verify expected missing behavior**

Run `npm run test:run -- src/pages/__tests__/SettingsPage.test.tsx`.

- [ ] **Step 3: Implement archive filters and file links**

Expose reimbursed and unreimbursed states, invoice/file links, and row detail/edit actions without duplicating calculation logic.

- [ ] **Step 4: Implement export download**

Create a Blob URL, trigger a download named `采购报销备份-YYYY-MM-DD.json`, and revoke the URL in a `finally` callback.

- [ ] **Step 5: Implement import preview and merge/replace**

Validate the backup version and arrays, show counts/conflicts, require explicit confirmation, and preserve existing data on parse/validation failure.

- [ ] **Step 6: Implement local-data reset with confirmation**

Require typing `清空本机数据` before clearing stores; explain that exported backups remain recoverable.

- [ ] **Step 7: Run settings/archive tests and commit**

Run the targeted suite and `npm run build`; commit with `feat: add archive and local backup controls`.

### Task 8: Polish the visual system and run end-to-end verification

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/**/*.tsx`
- Create: `src/test/fixtures.ts`
- Create: `src/test/app-flow.test.tsx`

**Interfaces:**
- No new public domain interfaces; this task hardens the existing pages and verifies the acceptance flow.

- [ ] **Step 1: Write the failing end-to-end app-flow test**

Exercise add purchase → refresh provider → bulk mark reimbursed → upload/confirm invoice → export backup, asserting each state transition and pending-total change.

- [ ] **Step 2: Run the flow test and verify the first missing integration**

Run `npm run test:run -- src/test/app-flow.test.tsx`; record the first real integration failure.

- [ ] **Step 3: Fix integration seams without changing the approved behavior**

Address provider hydration timing, object-URL cleanup, selection reset, and toast error handling; do not bypass failed assertions with test-only conditionals.

- [ ] **Step 4: Polish responsive states and empty/error/loading views**

Check 1440px desktop and 390px mobile widths, focus order, reduced-motion preference, table overflow, and long-link truncation.

- [ ] **Step 5: Run the complete verification suite**

Run `npm run test:run`, `npm run typecheck`, and `npm run build`. Expected: all tests pass, typecheck is clean, and production build completes.

- [ ] **Step 6: Inspect the final diff and commit**

Run `git diff --check` and `git status --short`; commit with `chore: verify local procurement tracker release`.

