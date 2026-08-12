# Task 2 实现报告：领域模型与计算

## 改动

- 新增 `src/domain/types.ts`：采购、发票、表单输入和仪表盘指标类型。
- 新增 `money.ts`：整数分解析、人民币格式化、数量总价计算。
- 新增 `date.ts`：ISO 日期校验与自然日跨度计算。
- 新增 `validation.ts`：采购输入中文字段错误校验。
- 新增 `metrics.ts`：未报销/已报销金额、数量、缺票数和日期跨度计算。
- 新增三组 Vitest 领域测试。

## TDD 证据

先运行缺少导出实现时的金额测试：

`npm run test:run -- src/domain/__tests__/money.test.ts`

结果：失败，测试套件无法解析 `../money`（缺少领域函数）。

实现后运行：

`npm run test:run -- src/domain`

结果：3 个测试文件、9 个测试全部通过（GREEN）。

## 验证命令

- `npm run test:run -- src/domain`：3 files passed，9 tests passed。
- `npm run test:run`：4 files passed，10 tests passed。
- `npm run typecheck`：通过，`tsc --noEmit` 无错误。

## 自检与疑虑

- 金额解析不使用浮点累加，超过两位小数按第三位四舍五入；不对负数或非法值静默钳制。
- `PurchaseInput.unitPriceCents` 约定为整数分（表单层负责把元转换为分）。
- 当前 `formatCNY` 对负分值显示负号，业务校验会阻止负单价。

## Commit

`91836d02eea00b8f77e5e76cad135a1d91443718`
