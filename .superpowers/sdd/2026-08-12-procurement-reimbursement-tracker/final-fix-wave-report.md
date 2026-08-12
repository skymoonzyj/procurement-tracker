# Final fix wave report

Date: 2026-08-12

## Scope

This wave addressed the final review findings A–E:

- Initial hydration failures now preserve loading and queued actions, never persist an unknown/empty snapshot, expose a retry banner, and replay queued mutations only after a successful retry.
- Refreshes use a serialized write barrier plus mutation generation guard, so stale reads cannot overwrite local changes made during a refresh or pending write.
- Backup validation now rejects duplicate IDs, incorrect calculated totals, reimbursement/timestamp contradictions, dangling or asymmetric purchase↔invoice references, and contradictory link statuses. `serializeBackup` validates application-generated snapshots before export.
- Reducer invoice linking/removal/confirmation derives both sides of the relationship, and `removePurchase` removes the purchase from all invoice links and derives unmatched invoice status.
- Purchase submit/delete flows await the persistence boolean and retain form/record/selection state on failure with Chinese retry feedback. The settings clear button now invokes `clearData()` and handles both false and thrown failures.

## Regression coverage

- Initial hydration failure → retry success with queued mutation replay and no persistence during failure.
- Hydration refresh race with a mutation during a delayed read, plus pending-write refresh barrier.
- Backup duplicate IDs, total calculation, reimbursement semantics, dangling/asymmetric references, and status contradictions.
- Reducer confirmed link status and purchase deletion relationship cleanup.
- Purchase save/delete persistence failures retain user data and selection.
- Backup clear success, false result, and thrown error feedback.

## Verification

- `npm run test:run -- src/state src/storage src/pages/__tests__/InvoicesPage.test.tsx src/pages/__tests__/SettingsPage.test.tsx`: 7 files, 34 tests passed.
- `npm run test:run`: 17 files, 68 tests passed.
- `npm run typecheck`: passed (`tsc --noEmit`).
- `npm run build`: passed (Vite transformed 45 modules).
- `git diff --check`: passed.

## Remaining concerns

- The backup validator intentionally rejects legacy snapshots with contradictory or dangling relationships; users must repair/export from a valid current state rather than silently importing corrupt links.
- No screenshot automation is configured (existing deferred concern); responsive behavior remains covered by the existing CSS and UI tests.
