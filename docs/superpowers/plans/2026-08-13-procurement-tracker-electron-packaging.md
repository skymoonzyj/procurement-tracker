# 采购报销台账 Electron 打包实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有 Vite + React 单机台账增加 Electron 桌面入口，并生成 Windows x64 NSIS 安装程序和便携版产物。

**Architecture:** Electron 主进程创建安全的 BrowserWindow；开发时加载 `ELECTRON_START_URL`，生产时加载打包进 `dist/index.html`。渲染进程继续使用现有 IndexedDB 和 PDF.js 逻辑，不新增后端或数据迁移层。electron-builder 负责 NSIS/portable 产物。

**Tech Stack:** Electron、electron-builder、Vite、React、Node.js CommonJS 主进程、Vitest。

## Global Constraints

- 目标平台固定为 Windows 10/11 x64。
- `contextIsolation: true`、`nodeIntegration: false`，不暴露任意 IPC。
- 只允许 `http:`、`https:` 外链交给系统浏览器；允许本地 `blob:` 发票预览。
- 安装、升级和卸载默认保留用户数据目录。
- 不实现代码签名、自动更新、OCR 或云端同步。
- 打包产物写入 `release/`，不提交二进制文件。

---

### Task 1: Add the secure Electron main process

**Files:**
- Create: `electron/main.cjs`
- Create: `electron/main.smoke.test.cjs`
- Modify: `package.json` (`main` entry and desktop scripts only if needed)

**Interfaces:**
- `electron/main.cjs` exports `createMainWindow` and `resolveRendererTarget` when loaded under tests, while starting the app only when run by Electron.
- `resolveRendererTarget({ appPath, startUrl })` returns the dev URL when provided, otherwise the absolute `dist/index.html` path.

- [ ] **Step 1: Write the failing smoke test**

  Test that the Electron entry module is missing or does not yet expose a production renderer target, and assert the exact expected `dist/index.html` path and URL behavior.

- [ ] **Step 2: Run the smoke test and record the expected failure**

  Run `node --test electron/main.smoke.test.cjs`; it must fail before the entry implementation exists.

- [ ] **Step 3: Implement the main process**

  Create a single-instance app, a 1440×900 window with a 960×640 minimum, secure webPreferences, ready-to-show behavior, dev/prod renderer loading, and safe navigation/window-open handlers. Permit `blob:` previews; route only HTTP(S) links to `shell.openExternal` and deny other external navigation.

- [ ] **Step 4: Run the smoke test and typecheck**

  Run `node --test electron/main.smoke.test.cjs` and `npm run typecheck`; both must exit 0.

- [ ] **Step 5: Commit**

  `git add electron/main.cjs electron/main.smoke.test.cjs package.json && git commit -m "feat: add secure electron desktop entry"`

### Task 2: Configure Electron development and Windows packaging

**Files:**
- Modify: `package.json` scripts, version, devDependencies, and `build` configuration
- Modify: `.gitignore` for `release/`, `electron-builder` cache, and desktop logs
- Create: `electron/dev.cjs`
- Create: `electron/packaging.test.cjs`

**Interfaces:**
- `npm run dev:desktop` starts Vite and Electron against the same local development URL.
- `npm run dist:win` runs the web build and electron-builder with `nsis` and `portable` targets.
- `electron/packaging.test.cjs` validates the package metadata, scripts, and required files without launching a GUI.

- [ ] **Step 1: Write the failing packaging metadata test**

  Assert that `package.json` has `main: electron/main.cjs`, `dev:desktop`, `dist:win`, Electron/electron-builder dev dependencies, and `build.win.target` entries for `nsis` and `portable`.

- [ ] **Step 2: Run the metadata test and confirm failure**

  Run `node --test electron/packaging.test.cjs`; it should report the missing desktop metadata.

- [ ] **Step 3: Add the configuration and scripts**

  Set version `1.0.0`, add Electron and electron-builder, define a portable dev launcher that starts Vite on port 4173 and forwards its exit signal, and configure NSIS shortcuts, install directory selection, `deleteAppDataOnUninstall: false`, artifact naming, and `release/` output.

- [ ] **Step 4: Run metadata tests and install dependencies**

  Run `node --test electron/packaging.test.cjs` and `npm install`; verify the lockfile includes the new packages.

- [ ] **Step 5: Commit**

  `git add package.json package-lock.json .gitignore electron/dev.cjs electron/packaging.test.cjs && git commit -m "build: configure windows electron installer"`

### Task 3: Add packaging documentation and smoke checks

**Files:**
- Create: `ELECTRON.md`
- Modify: `electron/main.smoke.test.cjs` if production path checks need expansion
- Modify: `package.json` only for a `package:check` script if useful

**Interfaces:**
- `ELECTRON.md` documents local development, installer generation, artifact locations, data preservation, and Windows SmartScreen/code-signing caveats.
- Smoke checks must run headlessly in CI environments and must not require a display server.

- [ ] **Step 1: Write the failing documentation/command check**

  Verify the documented commands and required output directory names against the actual package scripts/configuration.

- [ ] **Step 2: Implement the documentation and check**

  Document `npm run dev:desktop`, `npm run dist:win`, `release/`, the user data backup path concept, and the fact that unsigned installers may trigger SmartScreen.

- [ ] **Step 3: Run all web and desktop checks**

  Run `npm run test:run`, `npm run typecheck`, `npm run build`, `node --test electron/main.smoke.test.cjs electron/packaging.test.cjs`, and `git diff --check`.

- [ ] **Step 4: Commit**

  `git add ELECTRON.md electron package.json package-lock.json .gitignore && git commit -m "docs: document windows desktop distribution"`

### Task 4: Build and inspect distributable artifacts

**Files:**
- Generated only: `dist/`, `release/` (ignored; do not commit)

- [ ] **Step 1: Run the Windows packaging command**

  Run `npm run dist:win` from the project worktree. Capture the exit code and list `release/` artifacts.

- [ ] **Step 2: Validate artifacts**

  Confirm one `.exe` NSIS installer and one portable Windows artifact exist, names include `采购报销台账` or the configured product name, and files have non-zero sizes.

- [ ] **Step 3: Run the final verification suite**

  Re-run `npm run test:run`, `npm run typecheck`, `npm run build`, and `git diff --check`; confirm source worktree is clean except ignored build outputs.

- [ ] **Step 4: Commit only source/config changes**

  Do not add `dist/` or `release/`; report their absolute paths and checksums/sizes to the user.
