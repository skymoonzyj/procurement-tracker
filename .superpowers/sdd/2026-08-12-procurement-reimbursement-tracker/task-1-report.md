# Task 1 Report

## Changes

- Bootstrapped Vite + React + TypeScript project configuration.
- Added Vitest/jsdom and Testing Library setup with the required scripts.
- Added the smoke test and minimal `App` shell heading `采购报销台账`.
- Added `pdfjs-dist` dependency for later tasks.

## Verification

- `npm run test:run -- src/App.smoke.test.tsx` — PASS (1 file, 1 test).
- `npm run typecheck` — PASS.
- `npm run build` — PASS (Vite production build completed).

## Concerns

- Initial typecheck exposed TypeScript 7 removal of `moduleResolution: node10`; updated both configs to `Bundler` and re-ran successfully.
- Initial mandated RED run could not start because the project had no `test:run` script yet (`npm error Missing script: "test:run"`); this was expected before bootstrap.

## Commit

`957eef9 chore: bootstrap local procurement tracker`
