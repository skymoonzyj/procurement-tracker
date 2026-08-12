import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../App'
import { AppProvider } from '../../state/AppProvider'
import { invoiceRepo, purchaseRepo } from '../../storage/db'
import type { PurchaseRecord } from '../../domain/types'

const makeRecord = (id: string, itemName: string, totalPriceCents: number): PurchaseRecord => ({
  id,
  purchasedAt: '2026-08-01', itemUrl: '', itemName, quantity: 1, unitPriceCents: totalPriceCents,
  totalPriceCents, storageLink: '', notes: '', reimbursed: false, invoiceStatus: 'missing', invoiceIds: [],
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
})

afterEach(() => vi.restoreAllMocks())

describe('purchase page interactions', () => {
  it('submits a purchase and shows computed total with a selection checkbox', async () => {
    vi.spyOn(purchaseRepo, 'list').mockResolvedValue([])
    vi.spyOn(invoiceRepo, 'list').mockResolvedValue([])
    render(<AppProvider><App /></AppProvider>)

    await waitFor(() => expect(screen.getByRole('heading', { name: '采购记录' })).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('商品名称'), { target: { value: '办公椅' } })
    fireEvent.change(screen.getByLabelText('数量'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('单价（元）'), { target: { value: '125.50' } })
    fireEvent.click(screen.getByRole('button', { name: '保存采购记录' }))

    await waitFor(() => expect(screen.getByText('¥251.00')).toBeInTheDocument())
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0)
  })

  it('bulk marks selected rows reimbursed and removes their totals from overview pending total', async () => {
    vi.spyOn(purchaseRepo, 'list').mockResolvedValue([makeRecord('a', '键盘', 1000), makeRecord('b', '鼠标', 2000), makeRecord('c', '显示器', 3000)])
    vi.spyOn(invoiceRepo, 'list').mockResolvedValue([])
    render(<AppProvider><App /></AppProvider>)

    await waitFor(() => expect(screen.getByRole('heading', { name: '采购记录' })).toBeInTheDocument())
    const rows = screen.getAllByRole('row').slice(1)
    fireEvent.click(within(rows[0]).getByRole('checkbox'))
    fireEvent.click(within(rows[1]).getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: '批量标记已报销' }))

    fireEvent.click(screen.getByRole('button', { name: '概览' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument())
    const pendingCard = screen.getByText('待报销').closest('article')
    expect(pendingCard).toHaveTextContent('¥30.00')
    expect(pendingCard).not.toHaveTextContent('¥60.00')
  })
})
