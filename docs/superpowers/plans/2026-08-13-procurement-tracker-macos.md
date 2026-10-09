# macOS Universal Desktop Build Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

Goal: Add a macOS Universal Electron distribution that produces distinct DMG and ZIP artifacts for Intel and Apple Silicon while preserving the current local procurement tracker behavior.

Architecture: Reuse the existing Electron main process and Vite renderer. Add Electron Builder mac targets with Universal architecture and target-specific artifact names, while leaving Windows targets unchanged. Extend the existing Node packaging tests to validate scripts, architecture, category, and collision-free names; document macOS development, distribution, unsigned Gatekeeper behavior, and local data migration.

Tech Stack: Electron 43, electron-builder 26, Vite, React, Node node:test, PowerShell on the current Windows host, macOS builder/runner for real Universal artifacts.

## Global Constraints

- Universal must include both x64 and arm64 slices.
- DMG and ZIP artifact names must be distinct and include mac-universal.
- Existing Windows NSIS and portable targets must remain unchanged.
- Renderer assets must remain relative for Electron file loading.
- Keep contextIsolation true, nodeIntegration false, sandbox true, webSecurity true, and the existing protocol policy.
- No Apple signing, notarization credentials, Feishu backend, or business-rule changes are in scope.
- Real Universal artifacts are verified on macOS; Windows verification covers configuration, tests, typecheck, and renderer build.

---

### Task 1: Add macOS packaging metadata and regression tests

Files:
- Modify: package.json
- Modify: electron/packaging.test.cjs

Interfaces:
- Produces npm run dist:mac, running npm run build and electron-builder --mac dmg zip --universal.
- Produces build.mac, build.dmg, and build.zip metadata with Universal architecture and distinct artifact names.

- [ ] Step 1: Write the failing metadata test.

Add a Node test asserting:

~~~js
assert.match(pkg.scripts['dist:mac'], /npm run build/);
assert.match(pkg.scripts['dist:mac'], /electron-builder/);
assert.match(pkg.scripts['dist:mac'], /--mac/);
assert.match(pkg.scripts['dist:mac'], /--universal/);
const macTargets = Array.isArray(pkg.build.mac.target) ? pkg.build.mac.target : [pkg.build.mac.target];
assert.deepEqual(macTargets.map((target) => target.target), ['dmg', 'zip']);
for (const target of macTargets) assert.deepEqual(target.arch, ['universal']);
assert.equal(pkg.build.mac.category, 'public.app-category.business');
assert.match(pkg.build.dmg.artifactName, /mac-universal-dmg/);
assert.match(pkg.build.zip.artifactName, /mac-universal-zip/);
assert.notEqual(pkg.build.dmg.artifactName, pkg.build.zip.artifactName);
~~~

- [ ] Step 2: Run the focused test to verify RED.

~~~powershell
node --test electron/packaging.test.cjs
~~~

Expected: existing tests pass and the new macOS test fails because dist:mac and build.mac are missing.

- [ ] Step 3: Implement the minimum package configuration.

Add this script while preserving Windows targets:

~~~json
"dist:mac": "npm run build && electron-builder --mac dmg zip --universal"
~~~

Add mac target configuration with target entries for dmg and zip, each using arch universal, category public.app-category.business, and distinct artifact names ending in mac-universal-dmg and mac-universal-zip.

- [ ] Step 4: Run focused verification.

~~~powershell
node --test electron/packaging.test.cjs
npm run build
npm run typecheck
~~~

Expected: packaging tests pass; build and typecheck exit 0; Windows target assertions remain green.

- [ ] Step 5: Commit.

~~~powershell
git add package.json electron/packaging.test.cjs
git commit -m "feat: configure macOS universal packaging"
~~~

### Task 2: Document macOS development and distribution

Files:
- Modify: ELECTRON.md
- Modify: electron/packaging.test.cjs

Interfaces:
- Documents npm run dev:desktop, npm run dist:mac, Universal architecture, DMG/ZIP names, Gatekeeper approval, local data, and unsigned-build limitations.

- [ ] Step 1: Write the failing documentation assertion.

Add a test asserting ELECTRON.md contains npm run dist:mac, mac-universal-dmg, mac-universal-zip, Intel, Apple Silicon, and 无法验证开发者 or the English Gatekeeper equivalent.

- [ ] Step 2: Run RED.

~~~powershell
node --test electron/packaging.test.cjs
~~~

Expected: the new documentation assertion fails until the macOS section is added.

- [ ] Step 3: Add the macOS section.

Document these exact operational facts:

~~~text
开发：npm run dev:desktop
构建：npm run dist:mac
产物：采购报销台账-1.0.0-mac-universal-dmg.dmg and ...-zip.zip
架构：Universal = Intel x64 + Apple Silicon arm64
首次打开：右键打开，或系统设置 → 隐私与安全性 → 仍要打开
数据：~/Library/Application Support/采购报销台账/
备份：设置 → 备份与恢复 → 导出备份
签名：当前未签名；公开分发需要 Developer ID 和 Apple 公证
~~~

Clarify that a real Universal build must run on macOS and deleting the app does not intentionally remove app data.

- [ ] Step 4: Run GREEN.

~~~powershell
node --test electron/packaging.test.cjs
~~~

Expected: the complete packaging test file passes.

- [ ] Step 5: Commit.

~~~powershell
git add ELECTRON.md electron/packaging.test.cjs
git commit -m "docs: document macOS universal distribution"
~~~

### Task 3: Run cross-platform verification and record release handoff

Files:
- Create: docs/superpowers/sdd/2026-08-13-procurement-tracker-macos/task-3-report.md

- [ ] Step 1: Run Windows-host verification in order.

~~~powershell
npm run build
npm run test:run
npm run typecheck
node --test electron/main.smoke.test.cjs electron/packaging.test.cjs
git diff --check
~~~

Expected: 17 Vitest files / 69 tests pass, 12 Electron Node tests pass, and build/typecheck/diff checks exit 0.

- [ ] Step 2: Run a real macOS Universal build where supported.

~~~bash
npm ci
npm run dist:mac
file release/采购报销台账-1.0.0-mac-universal-dmg.dmg
unzip -l release/采购报销台账-1.0.0-mac-universal-zip.zip | head
~~~

Expected: both files are non-empty and the contained app reports Mach-O universal binary or contains both x86_64 and arm64 slices with lipo -info.

- [ ] Step 3: Record the actual result.

Write exact command output, test counts, artifact paths/hashes if built, and the unsigned Gatekeeper limitation. If this Windows host cannot run dist:mac, state that configuration was verified and a macOS runner is required for artifacts.

- [ ] Step 4: Commit the report.

~~~powershell
git add docs/superpowers/sdd/2026-08-13-procurement-tracker-macos/task-3-report.md
git commit -m "docs: record macOS packaging verification"
~~~

### Task 4: Push and open the macOS feature update

Files:
- No additional source files.

- [ ] Step 1: Verify branch state.

~~~powershell
git status --short --branch
git log --oneline --decorate -5
~~~

Expected: clean feature/procurement-tracker-mac branch with only macOS commits on top of master.

- [ ] Step 2: Push.

~~~powershell
git push -u origin feature/procurement-tracker-mac
~~~

- [ ] Step 3: Create pull request to master.

~~~powershell
gh pr create --base master --head feature/procurement-tracker-mac --title "新增 macOS Universal 桌面版" --body "增加 macOS Universal DMG/ZIP 构建配置、测试和分发文档。"
~~~

- [ ] Step 4: Report the pull request URL and artifact status.

State whether a real DMG/ZIP was built locally or whether the repository is ready for a macOS runner. Do not claim artifact availability without checking the files.
