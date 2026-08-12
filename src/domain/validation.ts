import { isValidISODate } from './date'
import type { PurchaseInput } from './types'

export function validatePurchaseInput(input: PurchaseInput): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!input.itemName || !input.itemName.trim()) errors.itemName = '请输入商品名称'
  const quantity = typeof input.quantity === 'string' ? Number(input.quantity) : input.quantity
  if (!Number.isFinite(quantity) || quantity <= 0 || Math.round(quantity * 100) !== quantity * 100) errors.quantity = '数量必须为正数且最多两位小数'
  const cents = typeof input.unitPriceCents === 'string' ? Number(input.unitPriceCents) : input.unitPriceCents
  if (!Number.isFinite(cents) || cents < 0 || !Number.isInteger(cents)) errors.unitPriceCents = '单价不能为负数'
  if (!isValidISODate(input.purchasedAt)) errors.purchasedAt = '采购日期格式无效'
  return errors
}
