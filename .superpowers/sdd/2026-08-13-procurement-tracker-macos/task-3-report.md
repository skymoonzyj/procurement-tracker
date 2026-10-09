# Task 3 verification report

Date: 2026-08-13  
Host: Windows 11 (`os=10.0.26200`), PowerShell, worktree `procurement-tracker-mac`

## Windows-host verification (run in brief order)

All commands below exited with code 0.

### `npm run build`

```
> procurement-reimbursement-tracker@1.0.0 build
> vite build

vite v8.2.1 building client environment for production...
transforming... 45 modules transformed.
dist/index.html                              0.42 kB (gzip 0.30 kB)
dist/assets/pdf.worker.min-CHFwMXne.mjs  1,262.39 kB
dist/assets/index-Bu0UR40T.css               8.66 kB (gzip 2.58 kB)
dist/assets/index-iHzfL2dG.js              244.74 kB (gzip 74.90 kB)
dist/assets/pdf-Et_Ivh5i.js                427.31 kB (gzip 127.40 kB)
✓ built in 132ms
```

### `npm run test:run`

```
Test Files  17 passed (17)
Tests       69 passed (69)
Duration    3.35s
```

### `npm run typecheck`

```
> tsc --noEmit
```

No diagnostics were emitted.

### `node --test electron/main.smoke.test.cjs electron/packaging.test.cjs`

```
tests 14
pass  14
fail  0
cancelled 0
skipped 0
todo 0
duration_ms 257.9951
```

The brief's expected count says 12 tests; the current suite contains 14 and all pass.

### `git diff --check`

Exited 0 with no output.

## macOS packaging

`npm run dist:mac` was attempted on this Windows host. The renderer build completed, then electron-builder stopped during configuration validation:

```
electron-builder  version=26.15.3 os=10.0.26200
loaded configuration file=package.json ("build" field)
⨯ Invalid configuration object.
electron-builder 26.15.3 ... unknown property 'zip'
```

No DMG/ZIP artifacts were produced, so there are no artifact paths or hashes to report. A real macOS runner is required to produce and inspect Universal artifacts; this Windows attempt must not be treated as a macOS build.

Run on macOS (after dependencies are installed):

```bash
npm ci
npm run dist:mac
file 'release/采购报销台账-1.0.0-mac-universal-dmg.dmg'
unzip -l 'release/采购报销台账-1.0.0-mac-universal-zip.zip' | head
# Verify the contained app binary is Universal:
lipo -info 'release/mac-universal/采购报销台账.app/Contents/MacOS/采购报销台账'
```

Artifacts are unsigned; Gatekeeper may warn or block first launch until the app is explicitly allowed (or signed/notarized in a release environment).

## Configuration regression fix

The packaging test initially failed after asserting that `build.mac.artifactName` must provide the ZIP fallback and that no root `build.zip` block exists. The fix removes the unsupported root `zip` configuration and sets:

```json
"mac": {
  "artifactName": "${productName}-${version}-mac-universal-zip.${ext}"
},
"dmg": {
  "artifactName": "${productName}-${version}-mac-universal-dmg.${ext}"
}
```

After the fix:

* `node --test electron/packaging.test.cjs`: 9 passed, 0 failed.
* `npm run build`: exit 0.
* `npm run typecheck`: exit 0.
* A second `npm run dist:mac` passed configuration validation and then correctly stopped with `Build for macOS is supported only on macOS`; a macOS runner remains required for artifacts.
