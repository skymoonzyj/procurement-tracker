import { describe, expect, it } from 'vitest'
import { appReducer, initialAppState } from '../appReducer'
import type { InvoiceRecord, PurchaseRecord } from '../../domain/types'

const makePurchase = (id: string, reimbursed = false): PurchaseRecord => ({
  id,
  purchasedAt: '2026-08-01',
  itemUrl: '',
  itemName: id,
  quantity: 1,
  unitPriceCents: 100,
  totalPriceCents: 100,
  storageLink: '',
  notes: '',
  reimbursed,
  ...(reimbursed ? { reimbursedAt: '2026-08-01T00:00:00.000Z' } : {}),
  invoiceStatus: 'missing',
  invoiceIds: [],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
})

describe('appReducer', () => {
  it('bulk marks requested purchases reimbursed with one shared ISO timestamp', () => {
    const state = { ...initialAppState, purchases: [makePurchase('a'), makePurchase('b')] }
    const next = appReducer(state, { type: 'setReimbursed', ids: ['a', 'b'], reimbursed: true })
    expect(next.purchases.every((record) => record.reimbursed)).toBe(true)
    expect(next.purchases[0].reimbursedAt).toBe(next.purchases[1].reimbursedAt)
    expect(() => new Date(next.purchases[0].reimbursedAt ?? '').toISOString()).not.toThrow()
    expect(next.purchases.map((record) => record.totalPriceCents)).toEqual([100, 100])
  })

  it('clears reimbursement timestamps without changing totals', () => {
    const state = { ...initialAppState, purchases: [makePurchase('a', true)] }
    const next = appReducer(state, { type: 'setReimbursed', ids: ['a'], reimbursed: false })
    expect(next.purchases[0].reimbursed).toBe(false)
    expect(next.purchases[0].reimbursedAt).toBeUndefined()
    expect(next.purchases[0].totalPriceCents).toBe(100)
    expect(Object.prototype.hasOwnProperty.call(next.purchases[0], 'reimbursedAt')).toBe(false)
  })

  it('keeps a consistent attached status when removing one of several invoices', () => {
    const state = {
      ...initialAppState,
      purchases: [{ ...makePurchase('a'), invoiceStatus: 'attached' as const, invoiceIds: ['invoice-1', 'invoice-2'] }],
    }
    const next = appReducer(state, { type: 'removeInvoice', id: 'invoice-1' })
    expect(next.purchases[0].invoiceIds).toEqual(['invoice-2'])
    expect(next.purchases[0].invoiceStatus).toBe('attached')
  })

  it('preserves matched status when removing one of several matched invoices', () => {
    const state = {
      ...initialAppState,
      purchases: [{ ...makePurchase('a'), invoiceStatus: 'matched' as const, invoiceIds: ['invoice-1', 'invoice-2'] }],
    }
    const next = appReducer(state, { type: 'removeInvoice', id: 'invoice-1' })
    expect(next.purchases[0].invoiceStatus).toBe('matched')
  })

  it('preserves needs_review status when invoice links remain', () => {
    const state = {
      ...initialAppState,
      purchases: [{ ...makePurchase('a'), invoiceStatus: 'needs_review' as const, invoiceIds: ['invoice-1', 'invoice-2'] }],
    }
    const next = appReducer(state, { type: 'removeInvoice', id: 'invoice-1' })
    expect(next.purchases[0].invoiceStatus).toBe('needs_review')
  })

  it('keeps matched status when confirming another invoice leaves a confirmed link', () => {
    const invoice = (id: string, matchedPurchaseIds: string[], matchStatus: InvoiceRecord['matchStatus']): InvoiceRecord => ({
      id, fileName: `${id}.pdf`, mimeType: 'application/pdf', sizeBytes: 1, blob: new Blob(['pdf'], { type: 'application/pdf' }), uploadedAt: '2026-08-01T00:00:00.000Z', rawText: '', parseStatus: 'parsed', matchStatus, matchedPurchaseIds,
    })
    const state = {
      ...initialAppState,
      purchases: [{ ...makePurchase('a'), invoiceStatus: 'matched' as const, invoiceIds: ['invoice-1', 'invoice-2'] }],
      invoices: [invoice('invoice-1', ['a'], 'confirmed'), invoice('invoice-2', ['a'], 'confirmed')],
    }
    const next = appReducer(state, { type: 'confirmInvoiceMatch', invoiceId: 'invoice-1', purchaseIds: [] })
    expect(next.purchases[0].invoiceIds).toEqual(['invoice-2'])
    expect(next.purchases[0].invoiceStatus).toBe('matched')
  })

  it('marks a purchase matched when linking a confirmed invoice', () => {
    const invoice: InvoiceRecord = {
      id: 'invoice-1', fileName: 'invoice.pdf', mimeType: 'application/pdf', sizeBytes: 3,
      blob: new Blob(['pdf'], { type: 'application/pdf' }), uploadedAt: '2026-08-01T00:00:00.000Z',
      rawText: '', parseStatus: 'parsed', matchStatus: 'unmatched', matchedPurchaseIds: [],
    }
    const state = { ...initialAppState, purchases: [makePurchase('a')], invoices: [invoice] }
    const next = appReducer(state, { type: 'linkInvoice', purchaseId: 'a', invoiceId: 'invoice-1' })
    expect(next.purchases[0].invoiceStatus).toBe('matched')
    expect(next.purchases[0].invoiceIds).toEqual(['invoice-1'])
    expect(next.invoices[0].matchStatus).toBe('confirmed')
    expect(next.invoices[0].matchedPurchaseIds).toEqual(['a'])
  })

  it('removes a purchase from every invoice and derives unmatched invoice status', () => {
    const invoice: InvoiceRecord = {
      id: 'invoice-1', fileName: 'invoice.pdf', mimeType: 'application/pdf', sizeBytes: 3,
      blob: new Blob(['pdf'], { type: 'application/pdf' }), uploadedAt: '2026-08-01T00:00:00.000Z',
      rawText: '', parseStatus: 'parsed', matchStatus: 'confirmed', matchedPurchaseIds: ['a'],
    }
    const state = { ...initialAppState, purchases: [makePurchase('a')], invoices: [invoice] }
    const next = appReducer(state, { type: 'removePurchase', id: 'a' })
    expect(next.purchases).toEqual([])
    expect(next.invoices[0].matchedPurchaseIds).toEqual([])
    expect(next.invoices[0].matchStatus).toBe('unmatched')
  })
})
