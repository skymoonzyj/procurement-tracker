import type { InvoiceRecord, PurchaseRecord } from '../domain/types'

export function makePurchaseFixture(overrides: Partial<PurchaseRecord> = {}): PurchaseRecord {
  return {
    id: 'purchase-fixture',
    purchasedAt: '2026-08-12',
    itemUrl: 'https://shop.example.test/item',
    itemName: '人体工学椅',
    quantity: 1,
    unitPriceCents: 2000,
    totalPriceCents: 2000,
    storageLink: 'https://drive.example.test/chair',
    notes: '',
    reimbursed: false,
    invoiceStatus: 'missing',
    invoiceIds: [],
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
    ...overrides,
  }
}

export function makeInvoiceFixture(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: 'invoice-fixture',
    fileName: 'chair-invoice.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 8,
    blob: new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
    uploadedAt: '2026-08-12T00:00:00.000Z',
    rawText: '',
    parseStatus: 'failed',
    matchStatus: 'needs_review',
    matchedPurchaseIds: [],
    ...overrides,
  }
}
