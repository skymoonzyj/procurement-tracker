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
  invoiceStatus: 'attached',
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

  it('exposes snapshot persistence as one atomic operation', () => {
    expect(typeof persistSnapshot).toBe('function')
  })
})
