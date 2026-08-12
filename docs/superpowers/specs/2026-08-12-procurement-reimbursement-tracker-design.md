# 行政采购未报销收集工具设计规格

**日期：** 2026-08-12  
**状态：** 已获用户确认，待 review 规格文本  
**目标用户：** 单人行政/采购工作者

## 1. 目标与范围

这是一个单机浏览器工具，用来持续收集行政采购后尚未报销的物品，并把采购记录、报销状态和发票文件放在同一处查询。

首版必须支持：

1. 录入采购日期、购买物品链接、商品名称、数量、单价、网盘/共享盘链接和备注。
2. 自动计算每条记录的总价，并在保存后持续保存在本机。
3. 首页实时显示未报销件数、未报销金额、未取得发票数，以及最早采购日至最新采购日的时间跨度。
4. 上传 PDF 发票，在本机提取可读文字并按商品名称和金额提出匹配建议。
5. 低置信度匹配进入待确认队列；用户可以手动确认、改绑或跳过。
6. 在采购清单中多选记录，批量标记“已报销”或批量恢复为“未报销”。标记后首页未报销金额立即扣除/恢复对应总价。
7. 后台表格查询商品链接、名称、数量、单价、总价、采购日期、发票状态、发票文件、网盘链接和报销状态。
8. 导出/导入本地备份，便于换浏览器或重装系统后恢复。

不在首版范围内：账号登录、多人协作、服务器同步、自动 OCR 扫描图片发票、自动提交财务系统、真实网盘 API 同步。网盘地址只作为用户填写并可点击打开的外部链接保存。

## 2. 交互设计

### 2.1 页面结构

采用单页应用，左侧为导航，右侧为内容区：

- **概览**：四张指标卡和近期未报销记录。
- **采购记录**：录入表单、筛选工具条、可多选数据表。
- **发票中心**：PDF 上传、解析结果、匹配建议和待确认列表。
- **全部档案**：包含已报销和未报销记录的完整查询表格。
- **设置/备份**：导出、导入、清理本地数据和存储说明。

### 2.2 采购录入

表单字段及规则：

| 字段 | 规则 |
| --- | --- |
| 采购日期 | 必填，默认当天，按本地日历保存为 `YYYY-MM-DD` |
| 购买物品链接 | 可选；输入后显示“打开链接” |
| 商品名称 | 必填，去除首尾空格，最多 200 字符 |
| 数量 | 必填，正数，最多两位小数 |
| 单价 | 必填，非负金额，保存两位小数 |
| 网盘/共享盘地址 | 可选；必须是 `http://`、`https://` 或用户本机可识别的路径文本 |
| 备注 | 可选，最多 500 字符 |

总价由 `数量 × 单价` 计算，不能手工覆盖。提交成功后记录立即进入列表，并写入 IndexedDB；编辑已有记录时采用相同规则即时更新。

### 2.3 未报销汇总与批量操作

首页只把 `reimbursed = false` 的记录纳入未报销指标：

- `allTotal = Σ totalPrice`
- `reimbursedTotal = Σ totalPrice where reimbursed = true`
- `pendingTotal = allTotal - reimbursedTotal`
- `pendingCount = count where reimbursed = false`
- `pendingInvoiceCount = count where reimbursed = false and invoiceStatus = missing`
- `pendingDateSpan = max(purchasedAt) - min(purchasedAt)`，按自然日计算；只有一条记录时显示“当天”，没有未报销记录时显示“暂无未报销记录”。

采购清单支持复选框、全选当前筛选结果和批量动作：

- **标记已报销**：将选中记录的 `reimbursed` 设为 `true`，记录 `reimbursedAt`。
- **恢复未报销**：将选中记录的 `reimbursed` 设为 `false`，清空 `reimbursedAt`。
- 批量操作完成后重新计算指标并显示成功条数；失败项保留选择状态并提示原因。

默认排序为采购日期从新到旧；支持关键词（商品名/链接/备注）、报销状态、发票状态和日期范围筛选。

### 2.4 发票中心与匹配确认

用户拖拽或选择一个或多个 PDF。文件在浏览器中读取并存入 IndexedDB，不上传网络。

解析流程：

1. 使用 `pdfjs-dist` 逐页提取文字。
2. 以正则和标签词尝试识别发票号码、开票日期、销售方名称、价税合计/金额，并保留 `rawText` 供查看。
3. 对每条未报销采购记录计算匹配分数：商品名称 token 命中（60%）+ 金额接近度（30%）+ 日期接近度（10%）。
4. 分数 `>= 0.80` 显示“高置信度建议”；`0.45–0.79` 显示“需要确认”；低于 `0.45` 显示“未找到明显匹配”。阈值写在匹配服务中，便于后续调整。

确认界面展示发票摘要、候选商品、匹配分数和差异原因。用户可以：

- 确认候选并关联一个或多个采购记录；
- 改选其他记录；
- 保留发票但暂不关联；
- 解除已有关联。

一张发票允许关联多个采购记录；一条采购记录首版只显示一个主发票关联，但可在详情中看到所有关联记录。扫描图片型或加密 PDF 若无法提取文字，状态为 `needs_review`，仍可手动关联。

### 2.5 表格与文件查看

表格列至少包含：采购日期、商品名称、商品链接、数量、单价、总价、发票状态、发票文件、网盘地址、报销状态、操作。

- 链接列以新窗口打开，并对无效 URL 显示为普通文本。
- 发票文件列显示文件名、解析状态和“查看/下载”；浏览器支持时提供 PDF 预览，否则下载。
- 删除记录前必须确认；若记录有关联发票，确认框明确提示“仅删除关联，不删除原 PDF”或同时删除文件，由用户选择。

## 3. 数据模型

```ts
type InvoiceStatus = 'missing' | 'attached' | 'matched' | 'needs_review'

interface PurchaseRecord {
  id: string
  purchasedAt: string          // YYYY-MM-DD
  itemUrl: string
  itemName: string
  quantity: number
  unitPriceCents: number       // 以分存储，避免浮点误差
  totalPriceCents: number
  storageLink: string
  notes: string
  reimbursed: boolean
  reimbursedAt?: string
  invoiceStatus: InvoiceStatus
  invoiceIds: string[]
  createdAt: string
  updatedAt: string
}

interface InvoiceRecord {
  id: string
  fileName: string
  mimeType: 'application/pdf'
  sizeBytes: number
  blob: Blob
  uploadedAt: string
  issueDate?: string
  invoiceNumber?: string
  vendorName?: string
  totalAmountCents?: number
  rawText: string
  parseStatus: 'parsed' | 'empty' | 'failed'
  matchStatus: 'unmatched' | 'suggested' | 'confirmed' | 'needs_review'
  matchedPurchaseIds: string[]
}
```

## 4. 技术架构与本地存储

- **前端：** React + Vite + TypeScript，组件按页面/领域拆分；不依赖后端。
- **状态：** 应用级 store 负责记录、发票、筛选条件和选择集；计算指标使用纯函数，便于测试。
- **持久化：** 原生 IndexedDB，至少包含 `purchases`、`invoices`、`settings` 三个 object store。PDF 以 `Blob` 存储，采购记录与发票元数据分离。
- **PDF：** `pdfjs-dist` 在浏览器 Worker 中解析；解析失败不影响上传和手动关联。
- **备份：** JSON 文件包含版本号、采购记录、发票元数据和 PDF 的 base64 数据；导入时先预览数量和冲突，再由用户确认合并或覆盖。导出大文件时显示大小提示。
- **隐私：** 不发起业务数据网络请求；仅当用户点击外部链接时离开本机。

## 5. 错误处理与边界

- 空名称、数量为 0/负数、金额为负数时阻止保存并在字段旁给出中文提示。
- PDF 超过 20 MB、格式不是 PDF、或浏览器 IndexedDB 写入失败时，显示可操作错误，不丢失已有记录。
- 匹配结果永远是建议，不自动改变报销状态；只有用户确认后才建立关联。
- 浏览器不支持文件预览时提供下载；浏览器清理站点数据可能导致本地数据丢失，设置页持续显示备份提醒。
- 计算金额时所有输入转为整数分，显示层统一 `¥0.00` 格式。

## 6. 验收标准

1. 添加一条采购记录后刷新页面，记录、总价和网盘链接仍存在。
2. 添加三条不同日期记录，批量标记其中两条已报销后，首页待报销金额只剩未标记记录金额；恢复其中一条后金额相应增加。
3. 筛选和排序不会改变记录本身；清空筛选后可看到全部记录。
4. 上传可提取文字的 PDF 后，界面显示解析摘要和至少一个候选（若文本包含商品名/金额）；低置信度结果可手动确认。
5. 上传扫描型 PDF 时不会崩溃，显示需要手动关联，并可将文件关联到采购记录。
6. 导出后清空数据，再导入备份，采购记录、状态、链接和 PDF 文件均可恢复。
7. 关键计算函数和匹配服务有自动化测试；生产构建成功且浏览器控制台无未处理错误。

