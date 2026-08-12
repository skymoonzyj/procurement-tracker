import { fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InvoiceCard } from '../InvoiceCard'
import type { InvoiceRecord } from '../../../domain/types'

const invoice: InvoiceRecord = {
  id: 'invoice-1', fileName: 'test.pdf', mimeType: 'application/pdf', sizeBytes: 100, blob: new Blob(['pdf'], { type: 'application/pdf' }), uploadedAt: '2026-08-01T00:00:00.000Z', rawText: '', parseStatus: 'parsed', matchStatus: 'unmatched', matchedPurchaseIds: [],
}

afterEach(() => vi.restoreAllMocks())

describe('InvoiceCard object URL lifecycle', () => {
  it('revokes download URL on unmount and preview URL after opening', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:download').mockReturnValueOnce('blob:preview')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(window, 'open').mockReturnValue(null)
    const view = render(<InvoiceCard invoice={invoice} />)
    expect(create).toHaveBeenCalledTimes(1)
    fireEvent.click(view.getByRole('button', { name: '预览 PDF' }))
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:preview'))
    view.unmount()
    expect(revoke).toHaveBeenCalledWith('blob:download')
  })
})
