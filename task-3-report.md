# Task 3 report

## Root cause / RED

Before the configuration change, `npm run test:run` discovered
`electron/main.smoke.test.cjs` and `electron/packaging.test.cjs` as Vitest files.
Both are Node built-in test-runner files, so Vitest reported `0 test` and failed
each with `No test suite found` while the Node tests themselves passed.

## Fix

`vite.config.ts` now extends Vitest's default exclusions with
`electron/**/*.test.cjs`. The Electron tests remain runnable directly through
`node --test`.

## Verification

- `npm run test:run` — 17 files, 69 tests passed.
- `node --test electron/main.smoke.test.cjs electron/packaging.test.cjs` — 9 tests passed.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `git diff --check` — passed.
