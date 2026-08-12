import { describe, expect, it } from 'vitest'
import { appReducer, initialAppState } from '../appReducer'
import type { PurchaseRecord } from '../../domain/types'

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
})
