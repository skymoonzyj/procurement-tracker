import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppProvider, useApp } from '../AppProvider'
import { invoiceRepo, purchaseRepo } from '../../storage/db'
import type { PurchaseRecord } from '../../domain/types'

const record: PurchaseRecord = { id: 'hydrated', purchasedAt: '2026-01-01', itemUrl: '', itemName: '服务端记录', quantity: 1, unitPriceCents: 100, totalPriceCents: 100, storageLink: '', notes: '', reimbursed: false, invoiceStatus: 'missing', invoiceIds: [], createdAt: '2026-01-01', updatedAt: '2026-01-01' }
function Probe() { const { state, dispatch } = useApp(); return <><button onClick={() => dispatch({ type: 'setReimbursed', ids: ['hydrated'], reimbursed: true })}>mutate</button><span data-testid="names">{state.purchases.map(p => p.itemName).join(',')}</span></> }
describe('hydration mutation guard', () => {
  it('ignores mutations issued before hydration completes', async () => {
    vi.spyOn(purchaseRepo, 'list').mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([record]), 20)))
    vi.spyOn(invoiceRepo, 'list').mockResolvedValue([])
    render(<AppProvider><Probe /></AppProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'mutate' }))
    await waitFor(() => expect(screen.getByTestId('names')).toHaveTextContent('服务端记录'))
    expect(screen.getByTestId('names')).toHaveTextContent('服务端记录')
  })
})
