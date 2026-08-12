import { describe, expect, it } from 'vitest'
import { calculateTotalCents, formatCNY, toCents } from '../money'

describe('money helpers', () => {
  it('calculates integer cents without floating point drift', () => {
    expect(toCents('12.34')).toBe(1234)
    expect(calculateTotalCents(2, toCents('12.34'))).toBe(2468)
    expect(formatCNY(2468)).toBe('¥24.68')
  })

  it.each(['-1', 'abc', '', '1.234.5'])('rejects invalid value %s', (value) => {
    expect(() => toCents(value)).toThrow()
  })
})
