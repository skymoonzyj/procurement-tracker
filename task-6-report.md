# Task 6 report — invoice center and linking workflow

Implemented the invoice center UI and purchase-linking workflow.

## Delivered

- PDF dropzone with MIME/extension and 20 MB validation.
- Upload queue with parse progress and retryable errors.
- Invoice cards with parsed number/date/vendor/amount metadata plus preview/download actions.
- Candidate match review with confidence/reason display, multi-select confirmation, skip, and unlink.
- Empty/scanned PDF manual purchase search with explicit v1 OCR limitation copy.
- Reducer actions keep invoice and purchase relationships in sync and mark confirmed purchases `invoiceStatus: matched`.
- Added 发票中心 navigation entry and page route in `AppShell`.

## Verification

- `npm run test:run -- src/pages/__tests__/InvoicesPage.test.tsx` — 4 passed.
- `npm run test:run` — 41 tests passed (13 files).
- `npm run typecheck` — passed.
- `npm run build` — passed.

## Concerns

- PDF preview uses `window.open`; popup blockers may require the user to click again.
- OCR is intentionally not implemented in v1; scanned PDFs require manual association.
