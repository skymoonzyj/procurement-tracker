# Windows desktop distribution

This project packages the local procurement and reimbursement tracker as a Windows Electron app. It has no server component: records and invoice PDFs stay in the current Windows user's local browser storage, and are not uploaded to a server or cloud service.

## Development

From the repository root, install dependencies once with `npm install`, then run:

```powershell
npm run dev:desktop
```

`electron/dev.cjs` starts Vite on `127.0.0.1:5173` and launches Electron after that URL responds. To use another free port (for example, when 5173 is occupied):

```powershell
$env:VITE_PORT = '4173'
npm run dev:desktop
```

The launcher passes the selected URL through `ELECTRON_START_URL`; it stops the Vite child process when the desktop app exits.

## Build and distribute

Create the production web build and both Windows targets with:

```powershell
npm run dist:win
```

`dist:win` runs `npm run build` and then `electron-builder --win nsis portable`. Artifacts are written to `release/` (the directory is intentionally git-ignored). The configured artifact naming pattern is:

```text
采购报销台账-1.0.0-win-x64.exe
```

The release contains an NSIS installer (`nsis`) and a portable executable (`portable`); the exact file suffix/name can include electron-builder's target disambiguation when both targets use the same artifact template. Give end users the NSIS installer for normal installation, or the portable executable when installation is not desired.

The NSIS installer permits choosing an installation directory and creates Desktop and Start Menu shortcuts. Uninstall preserves the app's user data (`deleteAppDataOnUninstall: false`).

## Local data and backups

Data is stored in IndexedDB for the current Windows user under Electron's per-user app-data directory (normally `%APPDATA%\\采购报销台账\\`, with Chromium IndexedDB files below that directory). Another Windows user has a separate dataset. No business data is sent to a server or cloud by this app.

Use **设置 → 备份与恢复 → 导出备份** to create a versioned JSON backup (including invoice PDF data), and keep a copy outside the app-data directory—such as OneDrive, an encrypted external drive, or an organization backup share. Before uninstalling, replacing a machine, or clearing data, export a backup. Restore with **导入备份** and review the preview before choosing merge or replace. Do not edit the IndexedDB files manually.

## Signing and SmartScreen

Builds from this repository are unsigned. Windows Defender SmartScreen may show an “unknown publisher” warning for either executable, especially on the first downloads. Verify the artifact came from the expected release location and use your organization's approved allow-list/review process. For production distribution, sign the installer and portable executable with a trusted Authenticode certificate (and protect the signing key); signing is not configured by this repository.

## Troubleshooting

- **Vite port conflict:** stop the process using port 5173, or set `VITE_PORT` to an available port before `npm run dev:desktop`. If `ELECTRON_START_URL` is set, ensure it points to the same reachable Vite URL.
- **Defender/SmartScreen blocks the file:** this is expected for unsigned artifacts. Confirm the checksum/source, then follow your organization's policy or distribute a signed build.
- **Can't find the installer:** run `npm run dist:win` from the repository root and inspect `release\\`. If the build fails, check the terminal output and ensure dependencies are installed with `npm install`.
- **Data appears missing after reinstall:** confirm you are using the same Windows user and application profile. The installer does not delete app data by default; restore the latest JSON backup from **设置 → 备份与恢复** if needed.
