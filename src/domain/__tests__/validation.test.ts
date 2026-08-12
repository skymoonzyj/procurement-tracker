import { describe, expect, it } from 'vitest'
import { validatePurchaseInput } from '../validation'

describe('purchase validation', () => {
  const valid = { purchasedAt: '2026-08-12', itemName: '纸张', quantity: 2, unitPriceCents: 1234, itemUrl: '', storageLink: '', notes: '' }
  it('returns Chinese field errors for invalid input', () => {
    const errors = validatePurchaseInput({ ...valid, itemName: '', quantity: 0, unitPriceCents: -1, purchasedAt: '2026/08/12' })
    expect(errors.itemName).toBeTruthy()
    expect(errors.quantity).toBeTruthy()
    expect(errors.unitPriceCents).toBeTruthy()
    expect(errors.purchasedAt).toBeTruthy()
  })
  it('returns an empty map for valid input', () => {
    expect(validatePurchaseInput(valid)).toEqual({})
  })
  it('rejects blank or malformed unit price strings', () => {
    expect(validatePurchaseInput({ ...valid, unitPriceCents: ' ' }).unitPriceCents).toBeTruthy()
    expect(validatePurchaseInput({ ...valid, unitPriceCents: '12.34' }).unitPriceCents).toBeTruthy()
  })
})
