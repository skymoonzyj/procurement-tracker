import type { InvoiceRecord, PurchaseRecord } from '../domain/types'
import { calculateTotalCents } from '../domain/money'

export interface BackupInvoice extends Omit<InvoiceRecord, 'blob'> {
  blobBase64: string
}

export interface BackupFile {
  version: 1
  exportedAt: string
  purchases: PurchaseRecord[]
  invoices: BackupInvoice[]
}

export interface RestorePreview {
  mode: 'merge' | 'replace'
  purchases: PurchaseRecord[]
  invoices: InvoiceRecord[]
  purchaseCount: number
  invoiceCount: number
  conflictCount: number
}

type BackupState = { purchases: PurchaseRecord[]; invoices: InvoiceRecord[] }

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function validIso(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.exec(value)
  if (!match || Number.isNaN(Date.parse(value))) return false
  const expected = `${match[1]}-${match[2]}-${match[3]}`
  const date = new Date(`${expected}T00:00:00.000Z`)
  return date.toISOString().slice(0, 10) === expected
}

function nonEmptyString(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 }

function validBase64(value: unknown, expectedSize?: unknown): value is string {
  if (typeof value !== 'string' || (value.length === 0 && expectedSize !== 0)) return false
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return false
  try {
    const bytes = base64ToBytes(value)
    return (expectedSize === undefined || (Number.isSafeInteger(expectedSize) && expectedSize === bytes.length)) && bytesToBase64(bytes) === value
  } catch { return false }
}

export async function serializeBackup(state: BackupState): Promise<BackupFile> {
  const invoices = await Promise.all(
    state.invoices.map(async ({ blob, ...invoice }) => ({
      ...invoice,
      blobBase64: bytesToBase64(new Uint8Array(await blob.arrayBuffer())),
    })),
  )
  const backup: BackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    purchases: state.purchases.map((purchase) => ({ ...purchase, invoiceIds: [...purchase.invoiceIds] })),
    invoices,
  }
  // Validate application-generated snapshots too, so an invalid relationship
  // can never be silently exported and later overwrite a valid local record.
  assertBackup(backup)
  return backup
}

function assertBackup(value: unknown): asserts value is BackupFile {
  if (!value || typeof value !== 'object') throw new Error('Invalid backup')
  const backup = value as Partial<BackupFile>
  if (backup.version !== 1) throw new Error('Unsupported backup version')
  if (!Array.isArray(backup.purchases) || !Array.isArray(backup.invoices)) throw new Error('Invalid backup arrays')
  if (!validIso(backup.exportedAt)) throw new Error('导出时间无效')
  const purchases = backup.purchases as unknown[]
  const purchaseIds = new Set<string>()
  for (const candidate of purchases) {
    if (!candidate || typeof candidate !== 'object') throw new Error('采购记录结构无效')
    const p = candidate as Record<string, unknown>
    const required = ['id', 'purchasedAt', 'itemUrl', 'itemName', 'quantity', 'unitPriceCents', 'totalPriceCents', 'storageLink', 'notes', 'reimbursed', 'invoiceStatus', 'invoiceIds', 'createdAt', 'updatedAt']
    const unitPrice = p.unitPriceCents, totalPrice = p.totalPriceCents
    if (!required.every(key => key in p) || !nonEmptyString(p.id)) throw new Error('采购记录结构无效')
    if (purchaseIds.has(p.id)) throw new Error('采购记录 ID 重复')
    purchaseIds.add(p.id)
    if (!validIso(p.purchasedAt) || typeof p.itemUrl !== 'string' || !nonEmptyString(p.itemName) || typeof p.quantity !== 'number' || !Number.isFinite(p.quantity) || p.quantity <= 0 || Math.round(p.quantity * 100) / 100 !== p.quantity || !Number.isSafeInteger(unitPrice) || (unitPrice as number) < 0 || !Number.isSafeInteger(totalPrice) || (totalPrice as number) < 0 || typeof p.storageLink !== 'string' || typeof p.notes !== 'string' || typeof p.reimbursed !== 'boolean' || !Array.isArray(p.invoiceIds) || !p.invoiceIds.every(id => nonEmptyString(id)) || new Set(p.invoiceIds).size !== p.invoiceIds.length || !validIso(p.createdAt) || !validIso(p.updatedAt)) throw new Error('采购记录结构无效')
    if (calculateTotalCents(p.quantity as number, unitPrice as number) !== totalPrice) throw new Error('采购记录总价不一致')
    if (p.reimbursed && !validIso(p.reimbursedAt)) throw new Error('报销状态与时间戳不一致')
    if (!p.reimbursed && p.reimbursedAt !== undefined) throw new Error('报销状态与时间戳不一致')
    if (!['missing', 'attached', 'matched', 'needs_review'].includes(String(p.invoiceStatus))) throw new Error('采购记录状态无效')
  }
  const purchaseById = new Map<string, Record<string, unknown>>()
  for (const candidate of purchases) purchaseById.set((candidate as Record<string, unknown>).id as string, candidate as Record<string, unknown>)
  const invoiceIds = new Set<string>()
  for (const candidate of backup.invoices as unknown[]) {
    if (!candidate || typeof candidate !== 'object') throw new Error('发票记录结构无效')
    const i = candidate as Record<string, unknown>
    const sizeBytes = i.sizeBytes, totalAmount = i.totalAmountCents
    if (!nonEmptyString(i.id)) throw new Error('发票记录结构无效')
    if (invoiceIds.has(i.id)) throw new Error('发票记录 ID 重复')
    invoiceIds.add(i.id)
    if (!nonEmptyString(i.fileName) || i.mimeType !== 'application/pdf' || !Number.isSafeInteger(sizeBytes) || (sizeBytes as number) < 0 || !validIso(i.uploadedAt) || (i.issueDate !== undefined && !validIso(i.issueDate)) || (i.invoiceNumber !== undefined && typeof i.invoiceNumber !== 'string') || (i.vendorName !== undefined && typeof i.vendorName !== 'string') || (totalAmount !== undefined && (!Number.isSafeInteger(totalAmount) || (totalAmount as number) < 0)) || typeof i.rawText !== 'string' || !Array.isArray(i.matchedPurchaseIds) || !i.matchedPurchaseIds.every(id => nonEmptyString(id)) || new Set(i.matchedPurchaseIds).size !== i.matchedPurchaseIds.length || !['parsed', 'empty', 'failed'].includes(String(i.parseStatus)) || !['unmatched', 'suggested', 'confirmed', 'needs_review'].includes(String(i.matchStatus)) || !validBase64(i.blobBase64, sizeBytes)) throw new Error('发票记录结构无效')
  }
  const invoiceById = new Map<string, Record<string, unknown>>()
  for (const candidate of backup.invoices as unknown[]) invoiceById.set((candidate as Record<string, unknown>).id as string, candidate as Record<string, unknown>)

  for (const candidate of purchases) {
    const purchase = candidate as Record<string, unknown>
    const ids = purchase.invoiceIds as string[]
    if (ids.length === 0) {
      if (purchase.invoiceStatus !== 'missing') throw new Error('采购记录状态无效')
      continue
    }
    let hasConfirmed = false
    for (const invoiceId of ids) {
      const invoice = invoiceById.get(invoiceId)
      if (!invoice) throw new Error('采购与发票关联引用无效')
      const matched = invoice.matchedPurchaseIds as string[]
      if (!matched.includes(purchase.id as string)) throw new Error('采购与发票关联不对称')
      if (invoice.matchStatus === 'confirmed') hasConfirmed = true
    }
    if (hasConfirmed && purchase.invoiceStatus !== 'matched') throw new Error('采购记录状态无效')
    if (!hasConfirmed && !['attached', 'needs_review'].includes(String(purchase.invoiceStatus))) throw new Error('采购记录状态无效')
  }
  for (const candidate of backup.invoices as unknown[]) {
    const invoice = candidate as Record<string, unknown>
    const matched = invoice.matchedPurchaseIds as string[]
    if (matched.length === 0) {
      if (invoice.matchStatus === 'confirmed') throw new Error('发票记录状态无效')
      continue
    }
    if (invoice.matchStatus !== 'confirmed') throw new Error('发票记录状态无效')
    for (const purchaseId of matched) {
      const purchase = purchaseById.get(purchaseId)
      if (!purchase) throw new Error('发票与采购关联引用无效')
      if (!(purchase.invoiceIds as string[]).includes(invoice.id as string)) throw new Error('发票与采购关联不对称')
    }
  }
}

export async function restoreBackup(file: BackupFile | unknown, mode: 'merge' | 'replace' = 'replace'): Promise<RestorePreview> {
  assertBackup(file)
  const invoices = await Promise.all(
    file.invoices.map(async (invoice) => {
      const { blobBase64, ...metadata } = invoice
      const blob = new Blob([base64ToBytes(blobBase64).buffer as ArrayBuffer], { type: metadata.mimeType })
      return { ...metadata, blob, sizeBytes: metadata.sizeBytes ?? blob.size } as InvoiceRecord
    }),
  )
  const purchases = file.purchases.map((purchase) => ({ ...purchase, invoiceIds: [...purchase.invoiceIds] }))
  return { mode, purchases, invoices, purchaseCount: purchases.length, invoiceCount: invoices.length, conflictCount: 0 }
}
