# Task 5 report — PDF extraction and invoice matching services

## Scope

- Added pure invoice text parsing in `src/invoices/parseInvoice.ts`.
- Added weighted purchase ranking in `src/invoices/matchPurchases.ts` (60% item token overlap, 30% amount proximity, 10% ISO-date proximity; confidence thresholds 0.80/0.45).
- Added browser-local `pdfjs-dist` adapter in `src/invoices/pdfText.ts` with a 20 MiB preflight limit and typed recoverable errors for oversized, encrypted, or unreadable PDFs.
- Added deterministic parser and matcher tests under `src/invoices/__tests__/`.

## TDD evidence

1. Wrote parser/matcher tests before production modules.
2. RED run: `npm run test:run -- src/invoices` failed both suites with expected missing-module errors (`../parseInvoice`, `../matchPurchases`).
3. Implemented the minimal services, then reran targeted tests successfully.

## Verification

- `npm run test:run -- src/invoices`: **2 files, 5 tests passed**.
- `npm run test:run`: **12 files, 35 tests passed**.
- `npm run typecheck`: passed.
- `npm run build`: passed (`vite v8.2.1`).

## Concerns / follow-up

- The adapter imports `pdf.worker.min.mjs?url` and sets `GlobalWorkerOptions.workerSrc` to a local Vite asset; an invoice UI should still verify that asset is served in its deployment target.
- Scanned/image PDFs produce empty text and should remain `needs_review` for manual association (OCR is intentionally out of scope).
