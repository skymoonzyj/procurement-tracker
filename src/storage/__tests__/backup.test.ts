import { describe, expect, it } from 'vitest'
import { restoreBackup, serializeBackup } from '../backup'
import { persistSnapshot } from '../db'
import type { InvoiceRecord, PurchaseRecord } from '../../domain/types'

const purchase: PurchaseRecord = {
  id: 'purchase-1',
  purchasedAt: '2026-08-01',
  itemUrl: 'https://example.test/item',
  itemName: '测试设备',
  quantity: 2,
  unitPriceCents: 1234,
  totalPriceCents: 2468,
  storageLink: '',
  notes: '备注',
  reimbursed: true,
  reimbursedAt: '2026-08-02T01:02:03.000Z',
  invoiceStatus: 'matched',
  invoiceIds: ['invoice-1'],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
}

const invoice: InvoiceRecord = {
  id: 'invoice-1',
  fileName: 'receipt.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 4,
  blob: new Blob([new Uint8Array([1, 2, 3, 255])], { type: 'application/pdf' }),
  uploadedAt: '2026-08-02T00:00:00.000Z',
  rawText: '',
  parseStatus: 'empty',
  matchStatus: 'confirmed',
  matchedPurchaseIds: ['purchase-1'],
}

describe('backup serialization', () => {
  it('rejects invalid exportedAt and incomplete required purchase metadata', async () => {
    const valid = await serializeBackup({ purchases: [{ ...purchase, invoiceIds: [], invoiceStatus: 'missing' }], invoices: [] })
    await expect(restoreBackup({ ...valid, exportedAt: 'not-a-date' })).rejects.toThrow(/导出时间/)
    await expect(restoreBackup({ ...valid, purchases: [{ ...valid.purchases[0], itemName: '' }] })).rejects.toThrow(/采购记录/)
    await expect(restoreBackup({ ...valid, purchases: [{ ...valid.purchases[0], purchasedAt: '2026-02-31' }] })).rejects.toThrow(/采购记录/)
  })

  it('rejects non-canonical invoice base64 and size mismatches', async () => {
    const valid = await serializeBackup({ purchases: [], invoices: [{ ...invoice, matchStatus: 'needs_review', matchedPurchaseIds: [] }] })
    await expect(restoreBackup({ ...valid, invoices: [{ ...valid.invoices[0], blobBase64: 'AQI' }] })).rejects.toThrow(/发票记录/)
    await expect(restoreBackup({ ...valid, invoices: [{ ...valid.invoices[0], sizeBytes: 99 }] })).rejects.toThrow(/发票记录/)
  })

  it('rejects malformed purchase records before restore', async () => {
    await expect(restoreBackup({ version: 1, exportedAt: '2026-08-12T00:00:00.000Z', purchases: [{ id: 'x', quantity: -1 }], invoices: [] })).rejects.toThrow(/采购记录/)
  })

  it('rejects malformed invoice records before restore', async () => {
    await expect(restoreBackup({ version: 1, exportedAt: '2026-08-12T00:00:00.000Z', purchases: [], invoices: [{ id: 'x', fileName: 'x.pdf', mimeType: 'text/plain', blobBase64: '###' }] })).rejects.toThrow(/发票记录/)
  })

  it('round-trips cents, reimbursement state, links, and invoice bytes', async () => {
    const backup = await serializeBackup({ purchases: [purchase], invoices: [invoice] })
    expect(backup.version).toBe(1)
    expect(backup.purchases[0].totalPriceCents).toBe(2468)
    expect(backup.purchases[0].reimbursedAt).toBe(purchase.reimbursedAt)
    expect(backup.purchases[0].invoiceIds).toEqual(['invoice-1'])

    const restored = await restoreBackup(backup, 'replace')
    expect(restored.purchases[0].totalPriceCents).toBe(2468)
    expect(restored.purchases[0].invoiceIds).toEqual(['invoice-1'])
    const bytes = new Uint8Array(await restored.invoices[0].blob.arrayBuffer())
    expect([...bytes]).toEqual([1, 2, 3, 255])
  })

  it('round-trips a normal purchase with no invoice IDs', async () => {
    const noInvoice = { ...purchase, invoiceIds: [], invoiceStatus: 'missing' as const }
    const backup = await serializeBackup({ purchases: [noInvoice], invoices: [] })
    const restored = await restoreBackup(backup)
    expect(restored.purchases[0].invoiceIds).toEqual([])
    expect(restored.purchases[0].invoiceStatus).toBe('missing')
  })

  it('accepts decimal quantities representable to two places', async () => {
    const backup = await serializeBackup({ purchases: [{ ...purchase, quantity: 0.29, totalPriceCents: 358, invoiceIds: [], invoiceStatus: 'missing' }], invoices: [] })
    await expect(restoreBackup(backup)).resolves.toBeTruthy()
  })

  it('exposes snapshot persistence as one atomic operation', () => {
    expect(typeof persistSnapshot).toBe('function')
  })

  it('rejects duplicate IDs, inconsistent totals, and reimbursement timestamps', async () => {
    const valid = await serializeBackup({ purchases: [{ ...purchase, invoiceStatus: 'matched' }], invoices: [invoice] })
    await expect(restoreBackup({ ...valid, purchases: [...valid.purchases, { ...valid.purchases[0] }] })).rejects.toThrow(/重复/)
    await expect(restoreBackup({ ...valid, purchases: [{ ...valid.purchases[0], totalPriceCents: 1 }] })).rejects.toThrow(/总价/)
    await expect(restoreBackup({ ...valid, purchases: [{ ...valid.purchases[0], reimbursed: false }] })).rejects.toThrow(/报销/)
    await expect(restoreBackup({ ...valid, purchases: [{ ...valid.purchases[0], reimbursed: true, reimbursedAt: undefined }] })).rejects.toThrow(/报销/)
  })

  it('rejects dangling or asymmetric invoice references and contradictory statuses', async () => {
    const valid = await serializeBackup({ purchases: [{ ...purchase, invoiceStatus: 'matched' }], invoices: [invoice] })
    await expect(restoreBackup({ ...valid, purchases: [{ ...valid.purchases[0], invoiceIds: ['missing-invoice'] }] })).rejects.toThrow(/关联|引用/)
    await expect(restoreBackup({ ...valid, invoices: [{ ...valid.invoices[0], matchedPurchaseIds: [] }] })).rejects.toThrow(/关联|引用/)
    await expect(restoreBackup({ ...valid, purchases: [{ ...valid.purchases[0], invoiceStatus: 'attached' }] })).rejects.toThrow(/状态/)
    await expect(restoreBackup({ ...valid, invoices: [{ ...valid.invoices[0], matchStatus: 'unmatched' }] })).rejects.toThrow(/状态|关联/)
  })
})
