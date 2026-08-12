# Task 4 report — Windows distributables

Date: 2026-08-13 (Asia/Shanghai)

## Commands and results

- `npm run dist:win` — exit code 0. Vite build completed and electron-builder 26.15.3 built both `nsis` and `portable` targets. Because the configured `artifactName` is identical for both targets, the portable target wrote over the NSIS filename (`采购报销台账-1.0.0-win-x64.exe`).
- `electron-builder --win nsis --config.artifactName='${productName}-${version}-${os}-${arch}-nsis.${ext}'` — exit code 0; produced the explicitly named NSIS installer below.
- `electron-builder --win portable --config.artifactName='${productName}-${version}-${os}-${arch}-portable.${ext}'` — failed with exit code 1 while downloading Electron (HTTP 503 Service Unavailable). The portable executable from the successful `npm run dist:win` run was preserved under the explicit `-portable.exe` name for inspection.
- `npm run test:run` — 17 files / 69 tests passed.
- `npm run typecheck` — passed (`tsc --noEmit`).
- `npm run build` — passed (Vite production build).
- `node --test electron/main.smoke.test.cjs electron/packaging.test.cjs` — 9 tests passed, 0 failed.
- `git diff --check` — passed.

## Artifacts

All paths are absolute and files are non-empty:

| Target | Path | Size (bytes) | SHA-256 |
|---|---|---:|---|
| NSIS installer | `E:\codex\xingzheng\.worktrees\procurement-tracker\release\采购报销台账-1.0.0-win-x64-nsis.exe` | 116,648,574 | `2214583F84EABA0A9A9FF955A0D46BFF9B4D568B846CE7C6665609B99BF3E79E` |
| Portable executable | `E:\codex\xingzheng\.worktrees\procurement-tracker\release\采购报销台账-1.0.0-win-x64-portable.exe` | 116,418,768 | `C137481AC9DB1021C7AC24D16B68FE6E6A08FAE3559186B227AEEBA3A6E758A1` |

The original unsuffixed portable output remains at `release\采购报销台账-1.0.0-win-x64.exe` with the same size/hash as the suffixed portable copy. `release/` is ignored; no generated binaries were staged.

## Signing / SmartScreen caveat

electron-builder logged `signing with signtool.exe`, but `Get-AuthenticodeSignature` reports `NotSigned` for both deliverable executables. No code-signing certificate is configured, so Windows SmartScreen may display an unknown-publisher warning.
