import { afterEach, describe, expect, it, vi } from 'vitest'
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb'
import type { PurchaseRecord } from '../../domain/types'
import { invoiceRepo, openAppDb, persistSnapshot, purchaseRepo, resetAppDbForTests } from '../db'

const purchase = (id: string): PurchaseRecord => ({
  id, purchasedAt: '2026-08-01', itemUrl: '', itemName: id, quantity: 1,
  unitPriceCents: 100, totalPriceCents: 100, storageLink: '', notes: '', reimbursed: false,
  invoiceStatus: 'missing', invoiceIds: [], createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
})

afterEach(() => {
  vi.restoreAllMocks()
  resetAppDbForTests()
})

describe('IndexedDB persistence', () => {
  it('does not cache a failed open forever', async () => {
    const original = globalThis.indexedDB
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined })
    await expect(openAppDb()).rejects.toThrow('IndexedDB is unavailable')
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: fakeIndexedDB })
    await expect(openAppDb()).resolves.toSatisfy((db) => db.objectStoreNames.contains('purchases'))
    ;(await openAppDb()).close()
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: original })
  })

  it('serializes complete snapshots so the latest concurrent snapshot wins', async () => {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: fakeIndexedDB })
    await Promise.all([persistSnapshot({ purchases: [purchase('one')], invoices: [] }), persistSnapshot({ purchases: [purchase('two')], invoices: [] })])
    const records = await purchaseRepo.list()
    expect(records).toHaveLength(1)
    expect(records[0].id).toBe('two')
    expect(await invoiceRepo.list()).toEqual([])
    ;(await openAppDb()).close()
  })
})
