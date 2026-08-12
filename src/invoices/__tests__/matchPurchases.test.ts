import { describe, expect, it } from 'vitest'
import { rankPurchaseMatches } from '../matchPurchases'
import type { InvoiceFields } from '../parseInvoice'
import type { PurchaseRecord } from '../../domain/types'

const purchase = (overrides: Partial<PurchaseRecord>): PurchaseRecord => ({
  id: 'p-1',
  purchasedAt: '2026-08-10',
  itemUrl: '',
  itemName: '无线键盘',
  quantity: 1,
  unitPriceCents: 24680,
  totalPriceCents: 24680,
  storageLink: '',
  notes: '',
  reimbursed: false,
  invoiceStatus: 'missing',
  invoiceIds: [],
  createdAt: '',
  updatedAt: '',
  ...overrides,
})

describe('rankPurchaseMatches', () => {
  it('ranks matching item above unrelated item using item, amount, and date signals', () => {
    const invoice: InvoiceFields = {
      itemName: '无线键盘',
      issueDate: '2026-08-10',
      invoiceNumber: '123',
      vendorName: '办公用品店',
      totalAmountCents: 24680,
      rawText: '无线键盘 价税合计 246.80',
      parseStatus: 'parsed',
      needsReview: false,
    }

    const suggestions = rankPurchaseMatches(invoice, [
      purchase({ id: 'matching' }),
      purchase({ id: 'other', itemName: '显示器', totalPriceCents: 10000, purchasedAt: '2026-01-01' }),
    ])

    expect(suggestions[0]?.purchaseId).toBe('matching')
    expect(suggestions[0]?.score).toBeGreaterThan(suggestions[1]?.score ?? 0)
    expect(suggestions[0]?.confidence).toBe('high')
    expect(suggestions[0]?.reasons.length).toBeGreaterThan(0)
  })

  it('returns no-signal suggestions with none confidence for empty invoices', () => {
    const suggestions = rankPurchaseMatches(
      {
        itemName: null,
        issueDate: null,
        invoiceNumber: null,
        vendorName: null,
        totalAmountCents: null,
        rawText: '',
        parseStatus: 'empty',
        needsReview: true,
      },
      [purchase({ id: 'p-empty' })],
    )

    expect(suggestions[0]?.confidence).toBe('none')
    expect(suggestions[0]?.score).toBe(0)
  })
})
