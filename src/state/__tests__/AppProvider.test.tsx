import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { invoiceRepo, purchaseRepo } from '../../storage/db'
import * as db from '../../storage/db'
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

function InitialHydrationProbe() {
  const { state, dispatch, refresh } = useApp()
  const queued = {
    id: 'queued', purchasedAt: '2026-08-02', itemUrl: '', itemName: '排队记录', quantity: 1,
    unitPriceCents: 200, totalPriceCents: 200, storageLink: '', notes: '', reimbursed: false,
    invoiceStatus: 'missing' as const, invoiceIds: [], createdAt: '2026-08-02T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z',
  }
  return <>
    <span data-testid="hydration-loading">{String(state.loading)}</span>
    <span data-testid="hydration-records">{state.purchases.map((item) => item.id).join(',')}</span>
    <span data-testid="hydration-error">{state.persistenceError}</span>
    <button onClick={() => void dispatch({ type: 'addPurchase', purchase: queued })}>排队新增</button>
    <button onClick={() => void refresh()}>重试加载</button>
  </>
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

  it('keeps initial loading and queued mutations until a retry hydrates successfully', async () => {
    vi.spyOn(purchaseRepo, 'list').mockRejectedValueOnce(new Error('first read failed')).mockResolvedValueOnce([purchase])
    vi.spyOn(invoiceRepo, 'list').mockRejectedValueOnce(new Error('first read failed')).mockResolvedValueOnce([])
    const modulePersistSpy = vi.spyOn(db, 'persistSnapshot').mockResolvedValue(undefined)
    render(<AppProvider><InitialHydrationProbe /></AppProvider>)

    fireEvent.click(screen.getByRole('button', { name: '排队新增' }))
    await waitFor(() => expect(screen.getByTestId('hydration-error')).toHaveTextContent('first read failed'))
    expect(screen.getByTestId('hydration-loading')).toHaveTextContent('true')
    expect(screen.getByTestId('hydration-records')).toHaveTextContent('')
    expect(modulePersistSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getAllByRole('button', { name: '重试加载' })[0])
    await waitFor(() => expect(screen.getByTestId('hydration-records')).toHaveTextContent('existing,queued'))
    expect(screen.getByTestId('hydration-loading')).toHaveTextContent('false')
    expect(modulePersistSpy).toHaveBeenCalledTimes(1)
    expect(modulePersistSpy).toHaveBeenCalledWith(expect.objectContaining({ purchases: expect.arrayContaining([expect.objectContaining({ id: 'queued' })]) }))
  })

  it('preserves replayed queued edits when a failed write is followed by refresh', async () => {
    vi.spyOn(purchaseRepo, 'list').mockRejectedValueOnce(new Error('first read failed')).mockResolvedValue([purchase])
    vi.spyOn(invoiceRepo, 'list').mockRejectedValueOnce(new Error('first read failed')).mockResolvedValue([])
    const modulePersistSpy = vi.spyOn(db, 'persistSnapshot')
      .mockRejectedValueOnce(new Error('queued write failed'))
      .mockResolvedValue(undefined)
    render(<AppProvider><InitialHydrationProbe /></AppProvider>)

    fireEvent.click(screen.getByRole('button', { name: '排队新增' }))
    await waitFor(() => expect(screen.getByTestId('hydration-error')).toHaveTextContent('first read failed'))

    fireEvent.click(screen.getAllByRole('button', { name: '重试加载' })[0])
    await waitFor(() => expect(screen.getByTestId('hydration-records')).toHaveTextContent('existing,queued'))
    await waitFor(() => expect(screen.getByTestId('hydration-error')).toHaveTextContent('queued write failed'))

    fireEvent.click(screen.getAllByRole('button', { name: '重试加载' })[0])
    await waitFor(() => expect(modulePersistSpy).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('hydration-records')).toHaveTextContent('existing,queued')
  })
})
