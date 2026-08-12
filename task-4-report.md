# Task 4 report — application shell and purchase ledger UI

## Status

Implemented the responsive application shell, purchase form/table, overview metrics and bulk reimbursement flow. Existing domain/state contracts are used; `AppProvider` now renders children during hydration with a small loading bar so the shell is available immediately.

## TDD evidence

Added `src/pages/__tests__/PurchasesPage.test.tsx` before production UI. Initial targeted run was RED: both tests failed because the expected `采购记录` heading/UI was absent (App only rendered the placeholder heading). After implementation, targeted run was GREEN: 2 tests passed.

## Verification output

- `npm run test:run -- src/pages/__tests__/PurchasesPage.test.tsx` — 1 file, 2 tests passed.
- `npm run test:run` — 9 files, 24 tests passed.
- `npm run typecheck` — passed.
- `npm run build` — passed (`vite v8.2.1`, 31 modules transformed).

## Files

- Modified: `src/App.tsx`, `src/main.tsx`, `src/state/AppProvider.tsx`
- Added: `src/components/layout/{AppShell,Sidebar}.tsx`, `src/components/common/{Toast,StatusBadge}.tsx`, `src/components/purchases/{PurchaseForm,PurchaseTable}.tsx`, `src/pages/{PurchasesPage,OverviewPage}.tsx`, `src/pages/__tests__/PurchasesPage.test.tsx`, `src/styles.css`, `src/vite-env.d.ts`

## Concerns

- Persistence errors can appear as a toast when IndexedDB is unavailable (expected in non-browser test environments); state changes remain visible in-memory.
- Delete is implemented through `replaceAll` because the reducer currently has no `removePurchase` action.
