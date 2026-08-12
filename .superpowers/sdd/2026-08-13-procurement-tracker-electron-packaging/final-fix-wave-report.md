# Final fix wave report

日期：2026-08-13  
基线：`e21ea0d` (`fix: disambiguate Windows packaging artifacts`)

## 范围

本轮只处理最终发布审查中的两个 Electron 打包阻塞项，没有改变业务 UI、数据模型或数据行为，也没有添加/暂存 `dist/`、`release/` 二进制产物。

### A. `file://` 资源路径

- 在 `vite.config.ts` 设置 `base: './'`，使 `dist/index.html` 的脚本和样式引用形如 `./assets/...`。
- 在 `electron/packaging.test.cjs` 增加构建产物回归检查，拒绝 `/assets/...` 根绝对路径。
- 同一检查确认 PDF.js worker 文件被 Vite 发出，并由应用 bundle 通过相对 `new URL(worker, import.meta.url)` 引用，确保 Electron `loadFile` 下仍能解析 worker。

### B. 生产环境启动 URL

- `resolveRendererTarget` 现在只在显式传入 `startUrl`，或应用未打包（`app.isPackaged === false`）时读取 `ELECTRON_START_URL`。
- `createMainWindow` 将 Electron `app` 传入 resolver；已打包应用即使继承了环境变量，也始终加载包内 `dist/index.html`。
- `electron/main.smoke.test.cjs` 增加 headless 回归：生产 resolver 忽略继承的远程 URL，开发显式 URL 仍生效。

## TDD 证据

先添加回归测试并在未修复的基线/旧构建产物上运行：12 个 Electron 测试中 3 个失败（生产环境变量被采用、HTML `/assets/...`、worker 相对引用缺失）。随后实施最小修复；重建后目标测试 12/12 通过。

## 验证结果

以下命令均在本 worktree 执行并返回退出码 0：

| 命令 | 结果 |
| --- | --- |
| `npm run test:run` | 17 个文件、69 个测试通过 |
| `npm run typecheck` | 通过 |
| `npm run build` | 通过；生成 `dist/index.html` 与 PDF.js worker |
| `node --test electron/main.smoke.test.cjs electron/packaging.test.cjs` | 12/12 通过 |
| `git diff --check` | 通过（仅显示 Windows 换行提示） |

构建后的 `dist/index.html` 已核验为 `./assets/index-iHzfL2dG.js` 与 `./assets/index-Bu0UR40T.css`。现有 `release/` 文件保持未触碰且未纳入提交；本轮只提交源码、测试与本报告。

## 交付

最终修复提交 hash 在 handoff 中返回；后续若重新打包，应使用本次已验证的 `npm run build` 产物再执行 `npm run dist:win`。
