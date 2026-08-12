import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProvider, useApp } from '../AppProvider'
import { invoiceRepo, purchaseRepo } from '../../storage/db'
import type { PurchaseRecord } from '../../domain/types'

afterEach(() => vi.restoreAllMocks())

const record: PurchaseRecord = { id: 'hydrated', purchasedAt: '2026-01-01', itemUrl: '', itemName: '服务端记录', quantity: 1, unitPriceCents: 100, totalPriceCents: 100, storageLink: '', notes: '', reimbursed: false, invoiceStatus: 'missing', invoiceIds: [], createdAt: '2026-01-01', updatedAt: '2026-01-01' }
function Probe() { const { state, dispatch } = useApp(); return <><button onClick={() => dispatch({ type: 'setReimbursed', ids: ['hydrated'], reimbursed: true })}>mutate</button><span data-testid="names">{state.purchases.map(p => `${p.itemName}:${p.reimbursed}`).join(',')}</span></> }
describe('hydration mutation guard', () => {
  it('ignores mutations issued before hydration completes', async () => {
    vi.spyOn(purchaseRepo, 'list').mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([record]), 20)))
    vi.spyOn(invoiceRepo, 'list').mockResolvedValue([])
    render(<AppProvider><Probe /></AppProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'mutate' }))
    await waitFor(() => expect(screen.getByTestId('names')).toHaveTextContent('服务端记录'))
    expect(screen.getByTestId('names')).toHaveTextContent('服务端记录:true')
  })

  it('does not let a stale refresh overwrite a mutation made while reading', async () => {
    let releaseRefresh!: (records: PurchaseRecord[]) => void
    const delayedRefresh = new Promise<PurchaseRecord[]>((resolve) => { releaseRefresh = resolve })
    const list = vi.spyOn(purchaseRepo, 'list')
      .mockResolvedValueOnce([record])
      .mockReturnValueOnce(delayedRefresh)
    vi.spyOn(invoiceRepo, 'list').mockResolvedValue([])
    const db = await import('../../storage/db')
    vi.spyOn(db, 'persistSnapshot').mockResolvedValue(undefined)
    function RefreshProbe() {
      const { state, dispatch, refresh } = useApp()
      return <>
        <button onClick={() => void refresh()}>refresh</button>
        <button onClick={() => void dispatch({ type: 'setReimbursed', ids: ['hydrated'], reimbursed: true })}>mutate</button>
        <span data-testid="race-value">{String(state.purchases[0]?.reimbursed)}</span>
      </>
    }
    render(<AppProvider><RefreshProbe /></AppProvider>)
    await waitFor(() => expect(screen.getByTestId('race-value')).toHaveTextContent('false'))
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }))
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'mutate' }))
    await waitFor(() => expect(screen.getByTestId('race-value')).toHaveTextContent('true'))
    releaseRefresh([record])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByTestId('race-value')).toHaveTextContent('true')
  })

  it('waits for a pending mutation write before refreshing the repository snapshot', async () => {
    let releaseWrite!: () => void
    const write = new Promise<void>((resolve) => { releaseWrite = resolve })
    let repoPurchases = [record]
    vi.spyOn(purchaseRepo, 'list').mockImplementation(async () => repoPurchases)
    vi.spyOn(invoiceRepo, 'list').mockResolvedValue([])
    const db = await import('../../storage/db')
    vi.spyOn(db, 'persistSnapshot').mockImplementation(async (snapshot) => {
      await write
      repoPurchases = snapshot.purchases
    })
    function PendingWriteProbe() {
      const { state, dispatch, refresh } = useApp()
      return <>
        <button onClick={() => void dispatch({ type: 'setReimbursed', ids: ['hydrated'], reimbursed: true })}>mutate</button>
        <button onClick={() => void refresh()}>refresh</button>
        <span data-testid="pending-write-value">{String(state.purchases[0]?.reimbursed)}</span>
      </>
    }
    render(<AppProvider><PendingWriteProbe /></AppProvider>)
    await waitFor(() => expect(screen.getByTestId('pending-write-value')).toHaveTextContent('false'))
    fireEvent.click(screen.getByRole('button', { name: 'mutate' }))
    await waitFor(() => expect(screen.getByTestId('pending-write-value')).toHaveTextContent('true'))
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByTestId('pending-write-value')).toHaveTextContent('true')
    releaseWrite()
    await waitFor(() => expect(screen.getByTestId('pending-write-value')).toHaveTextContent('true'))
  })
})
