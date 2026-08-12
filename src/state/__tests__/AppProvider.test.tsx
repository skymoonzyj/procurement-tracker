import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { invoiceRepo, purchaseRepo } from '../../storage/db'
import type { PurchaseRecord } from '../../domain/types'
import { AppProvider, useApp } from '../AppProvider'

const purchase: PurchaseRecord = {
  id: 'existing', purchasedAt: '2026-08-01', itemUrl: '', itemName: '已有记录', quantity: 1,
  unitPriceCents: 100, totalPriceCents: 100, storageLink: '', notes: '', reimbursed: false,
  invoiceStatus: 'missing', invoiceIds: [], createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
}

function Probe() {
  const { state, refresh } = useApp()
  return <><span data-testid="record">{state.purchases[0]?.id}</span><span data-testid="error">{state.persistenceError}</span><button onClick={() => void refresh()}>刷新</button></>
}

afterEach(() => vi.restoreAllMocks())

describe('AppProvider hydration errors', () => {
  it('keeps hydrated records when a later refresh fails', async () => {
    vi.spyOn(purchaseRepo, 'list').mockResolvedValueOnce([purchase]).mockRejectedValueOnce(new Error('read failed'))
    vi.spyOn(invoiceRepo, 'list').mockResolvedValueOnce([]).mockResolvedValueOnce([])
    render(<AppProvider><Probe /></AppProvider>)
    await waitFor(() => expect(screen.getByTestId('record')).toHaveTextContent('existing'))
    fireEvent.click(screen.getByRole('button', { name: '刷新' }))
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('read failed'))
    expect(screen.getByTestId('record')).toHaveTextContent('existing')
  })
})
