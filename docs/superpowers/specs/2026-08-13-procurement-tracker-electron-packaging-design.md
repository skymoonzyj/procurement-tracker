# 采购报销台账 Electron 安装包设计

日期：2026-08-13

## 目标

将现有 Vite + React 单机采购报销台账封装为 Windows x64 Electron 桌面应用，生成可分发的 NSIS `.exe` 安装程序，同时保留现有本地 IndexedDB、PDF 发票处理、备份恢复和网盘链接字段行为。

## 已确认的约束

- 目标系统：Windows 10/11 x64。
- 使用 Electron + electron-builder NSIS，不引入后端服务。
- 生产环境从应用包内加载 Vite 构建产物，不依赖开发服务器或公网。
- 数据只保存在当前 Windows 用户的 Electron 本地数据目录；卸载默认不删除用户数据。
- 发票 PDF 保持本地处理；网盘链接只作为地址保存，不自动上传文件。
- 同时产出 NSIS 安装程序和便携版目录，便于不同分发场景使用。

## 架构

新增 Electron 主进程入口 `electron/main.cjs`。主进程启用 `contextIsolation`、关闭渲染进程 Node 集成，并通过 `loadFile` 加载 `dist/index.html`。渲染进程继续使用现有 React 代码和 IndexedDB，避免改变数据模型或引入 IPC 数据层。

开发模式由 Vite 提供页面，Electron 可通过 `ELECTRON_START_URL` 加载 Vite 地址；生产构建先运行 `vite build`，再由 electron-builder 将 `dist` 和主进程入口打入安装包。主进程不暴露文件系统或任意 IPC，只提供窗口生命周期和安全的外部链接打开能力（若现有页面需要）。

## 打包与分发

- `electron-builder` 配置放在 `package.json` 的 `build` 字段：`appId` 固定、产品名为“采购报销台账”、目标为 `nsis` 和 `portable`。
- 安装程序输出到 `release/`，文件名包含应用名和版本号。
- NSIS 安装器允许用户选择安装目录，创建桌面和开始菜单快捷方式，并保留用户数据目录。
- 应用版本从 `package.json` 读取；升级不覆盖用户数据。
- `.gitignore` 忽略 `release/` 和 Electron 临时构建目录，避免提交二进制产物。

## 安全与兼容性

- `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`（若当前 pdf.js/Electron 版本兼容）。
- 不使用远程脚本、远程页面或不受信任的 preload API。
- 外部 HTTP/HTTPS 链接通过系统默认浏览器打开；不允许 `javascript:` 等危险协议。
- 生产环境资源使用相对路径和 `file://` 兼容配置，确保 Vite 静态资源、pdf.js worker 和 Blob URL 正常加载。
- Windows 端 PDF 仍在渲染进程本地解析；扫描件无 OCR，沿用现有“需手动关联”提示。

## 测试与验收

1. `npm run test:run` 全部通过。
2. `npm run typecheck` 全部通过。
3. `npm run build` 生成可加载的 `dist/index.html`。
4. Electron smoke test 验证生产入口存在且能创建 BrowserWindow、加载本地页面并退出。
5. `npm run dist:win` 生成 `.exe` 安装程序和便携版目录；检查产物名称、文件大小和退出码。
6. 在安装后的应用中验证：新增采购、刷新后数据仍在、上传 PDF、导出/导入备份，以及打开商品/网盘链接。

## 不在本次范围

- 代码签名证书、自动更新服务器和微软商店发布。
- 自动 OCR、云端同步或网盘 API 上传。
- macOS/Linux 安装包。
