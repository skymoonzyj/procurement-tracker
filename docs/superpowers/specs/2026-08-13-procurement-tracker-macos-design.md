# macOS Universal 桌面版设计

## 目标

在现有 Electron 单机版采购报销台账基础上增加 macOS Universal 构建，生成同时支持 Intel（x64）和 Apple Silicon（arm64）的 DMG 安装包与 ZIP 便携包，不改变业务数据模型和本地存储行为。

## 方案

继续复用现有 Electron 主进程和 Vite 渲染层。Electron Builder 在 macOS 上分别构建 x64 与 arm64，再使用 `--universal` 合并为一个 Universal 应用；目标格式为 DMG 和 ZIP。渲染层通过现有相对资源路径加载，主进程继续强制生产环境使用应用内 `dist/index.html`，不受外部 `ELECTRON_START_URL` 影响。

## 交付物

- `npm run dist:mac`：构建 Universal macOS 应用。
- `采购报销台账-1.0.0-mac-universal-dmg.dmg`：推荐给普通用户安装。
- `采购报销台账-1.0.0-mac-universal-zip.zip`：便携分发和测试使用。
- `npm run dev:desktop`：macOS 开发启动方式保持与 Windows 一致。
- `ELECTRON.md`：增加 macOS 构建、运行、首次打开和签名说明。

## Electron Builder 配置

- 保留现有 `appId`、产品名、输出目录和 Windows targets。
- 新增 `build.mac`，架构为 `x64` 与 `arm64`，targets 为 `dmg` 和 `zip`。
- 使用 target-specific artifact names，避免 DMG、ZIP 或不同架构产物互相覆盖。
- DMG 使用可写安装布局，应用拖拽到 Applications；不配置图标时继续使用 Electron 默认图标，并在文档中说明可替换图标。
- `deleteAppDataOnUninstall` 不适用于 macOS；卸载或删除应用不主动删除本地 IndexedDB，用户可通过应用内“备份与恢复”迁移数据。

## 安全与兼容性

- 保持 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`、`webSecurity: true`。
- 本地 `file:`, `blob:`, `about:` 页面和发票预览继续允许；HTTP(S) 外链交给系统浏览器；其他协议拒绝。
- Universal 构建只解决 CPU 架构兼容，不等于代码签名或公证。未签名构建在 macOS 可能显示“无法验证开发者”；正式公开分发需 Developer ID、Hardened Runtime 和 Apple notarization。

## 验证

- Node 原生 Electron 测试覆盖 macOS metadata、目标名称、架构和相对资源路径。
- `npm run test:run`、`npm run typecheck`、`npm run build` 全部通过。
- 在 macOS builder 环境执行 `npm run dist:mac`，检查 DMG/ZIP 文件存在、大小非零、名称包含 `mac-universal`。
- 在实际 macOS 设备或 CI macOS runner 上打开 Universal 应用，确认应用启动、IndexedDB 可写、发票 PDF Worker 可加载。
- Windows target 现有配置和测试不得回归。

## 不在本次范围

- 不新增飞书 API 服务端或 OAuth 流程。
- 不实现自动签名、公证凭据托管或 CI 发布流水线；只提供配置入口和操作文档。
- 不修改采购、发票匹配、备份恢复等业务规则。
