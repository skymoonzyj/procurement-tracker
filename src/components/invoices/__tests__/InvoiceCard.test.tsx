import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InvoiceCard } from '../InvoiceCard'
import type { InvoiceRecord } from '../../../domain/types'

const invoice: InvoiceRecord = {
  id: 'invoice-1', fileName: 'test.pdf', mimeType: 'application/pdf', sizeBytes: 100, blob: new Blob(['pdf'], { type: 'application/pdf' }), uploadedAt: '2026-08-01T00:00:00.000Z', rawText: '', parseStatus: 'parsed', matchStatus: 'unmatched', matchedPurchaseIds: [],
}

afterEach(() => vi.restoreAllMocks())

describe('InvoiceCard object URL lifecycle', () => {
  it('revokes preview URL on popup load and uses a long fallback timeout', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:download').mockReturnValueOnce('blob:preview')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const addEventListener = vi.fn()
    vi.spyOn(window, 'open').mockReturnValue({ addEventListener } as unknown as Window)
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout')
    const view = render(<InvoiceCard invoice={invoice} />)
    expect(create).toHaveBeenCalledTimes(1)
    fireEvent.click(view.getByRole('button', { name: '预览 PDF' }))
    expect(revoke).not.toHaveBeenCalledWith('blob:preview')
    const fallbackDelay = setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1]?.[1]
    expect(typeof fallbackDelay).toBe('number')
    expect(fallbackDelay as number).toBeGreaterThanOrEqual(60_000)
    const loadHandler = addEventListener.mock.calls[0]?.[1] as (() => void) | undefined
    loadHandler?.()
    expect(revoke).toHaveBeenCalledWith('blob:preview')
    view.unmount()
    expect(revoke).toHaveBeenCalledWith('blob:download')
  })

  it('keeps preview URL alive when browser returns null for a successful navigation', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:download').mockReturnValueOnce('blob:blocked')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(window, 'open').mockReturnValue(null)
    const view = render(<InvoiceCard invoice={invoice} />)
    fireEvent.click(view.getByRole('button', { name: '预览 PDF' }))
    expect(revoke).not.toHaveBeenCalledWith('blob:blocked')
    view.unmount()
  })

  it('keeps URL until fallback when popup event registration throws', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:download').mockReturnValueOnce('blob:hostile')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const addEventListener = vi.fn(() => { throw new Error('WindowProxy unavailable') })
    vi.spyOn(window, 'open').mockReturnValue({ addEventListener } as unknown as Window)
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout')
    const view = render(<InvoiceCard invoice={invoice} />)
    fireEvent.click(view.getByRole('button', { name: '预览 PDF' }))
    expect(revoke).not.toHaveBeenCalledWith('blob:hostile')
    expect(setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1]?.[1]).toBeGreaterThanOrEqual(60_000)
    view.unmount()
  })
})
