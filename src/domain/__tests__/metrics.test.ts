import { describe, expect, it } from 'vitest'
import { calculateMetrics } from '../metrics'
import type { PurchaseRecord } from '../types'

const record = (id: string, purchasedAt: string, totalPriceCents: number, reimbursed: boolean, invoiceStatus: PurchaseRecord['invoiceStatus'] = 'missing'): PurchaseRecord => ({
  id, purchasedAt, itemUrl: '', itemName: id, quantity: 1, unitPriceCents: totalPriceCents, totalPriceCents, storageLink: '', notes: '', reimbursed, invoiceStatus, invoiceIds: [], createdAt: purchasedAt, updatedAt: purchasedAt,
})

describe('dashboard metrics', () => {
  it('computes pending and reimbursed totals from pending records', () => {
    const metrics = calculateMetrics([record('a', '2026-08-01', 1000, true), record('b', '2026-08-04', 2000, true), record('c', '2026-08-07', 3000, false)])
    expect(metrics.pendingCount).toBe(1)
    expect(metrics.pendingTotalCents).toBe(3000)
    expect(metrics.reimbursedTotalCents).toBe(3000)
    expect(metrics.pendingDateSpanDays).toBe(0)
  })
  it('returns an explicit empty state when all are reimbursed', () => {
    const metrics = calculateMetrics([record('a', '2026-08-01', 1000, true)])
    expect(metrics.pendingCount).toBe(0)
    expect(metrics.pendingDateSpanLabel).toBe('暂无未报销记录')
    expect(metrics.pendingDateSpanDays).toBe(0)
  })
})
