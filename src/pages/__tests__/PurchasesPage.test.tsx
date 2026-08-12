import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../App'
import { AppProvider, useApp } from '../../state/AppProvider'
import * as db from '../../storage/db'
import { PurchaseTable } from '../../components/purchases/PurchaseTable'
import type { PurchaseRecord } from '../../domain/types'

const makeRecord = (id: string, itemName: string, totalPriceCents: number): PurchaseRecord => ({
  id,
  purchasedAt: '2026-08-01', itemUrl: '', itemName, quantity: 1, unitPriceCents: totalPriceCents,
  totalPriceCents, storageLink: '', notes: '', reimbursed: false, invoiceStatus: 'missing', invoiceIds: [],
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
})

afterEach(() => vi.restoreAllMocks())
beforeEach(() => vi.spyOn(db, 'persistSnapshot').mockResolvedValue(undefined))

describe('purchase page interactions', () => {
  it('submits a purchase and shows computed total with a selection checkbox', async () => {
    vi.spyOn(db.purchaseRepo, 'list').mockResolvedValue([])
    vi.spyOn(db.invoiceRepo, 'list').mockResolvedValue([])
    render(<AppProvider><App /></AppProvider>)

    await waitFor(() => expect(screen.getByRole('heading', { name: '采购记录' })).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('商品名称'), { target: { value: '办公椅' } })
    fireEvent.change(screen.getByLabelText('数量'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('单价（元）'), { target: { value: '125.50' } })
    expect(screen.getByText('¥251.00')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '保存采购记录' }))

    await waitFor(() => expect(screen.getByText('¥251.00')).toBeInTheDocument())
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0)
  })

  it('bulk marks selected rows reimbursed and removes their totals from overview pending total', async () => {
    vi.spyOn(db.purchaseRepo, 'list').mockResolvedValue([makeRecord('a', '键盘', 1000), makeRecord('b', '鼠标', 2000), makeRecord('c', '显示器', 3000)])
    vi.spyOn(db.invoiceRepo, 'list').mockResolvedValue([])
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

  it('shows inline validation for malformed amount without throwing', async () => {
    vi.spyOn(db.purchaseRepo, 'list').mockResolvedValue([])
    vi.spyOn(db.invoiceRepo, 'list').mockResolvedValue([])
    render(<AppProvider><App /></AppProvider>)
    await waitFor(() => expect(screen.getByRole('heading', { name: '采购记录' })).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('商品名称'), { target: { value: '测试' } })
    fireEvent.change(screen.getByLabelText('单价（元）'), { target: { value: 'abc' } })
    expect(() => fireEvent.click(screen.getByRole('button', { name: '保存采购记录' }))).not.toThrow()
    expect(await screen.findByText('单价不能为负数')).toBeInTheDocument()
  })

  it('filters across links and notes and sorts newest purchase first', async () => {
    vi.spyOn(db.purchaseRepo, 'list').mockResolvedValue([
      { ...makeRecord('old', '旧商品', 100), purchasedAt: '2026-01-01', itemUrl: 'https://example.com/needle' },
      { ...makeRecord('new', '新商品', 200), purchasedAt: '2026-08-01', notes: 'needle' },
    ])
    vi.spyOn(db.invoiceRepo, 'list').mockResolvedValue([])
    render(<AppProvider><App /></AppProvider>)
    await waitFor(() => expect(screen.getByText('新商品')).toBeInTheDocument())
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('新商品')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('搜索采购记录'), { target: { value: 'needle' } })
    expect(screen.getByText('旧商品')).toBeInTheDocument()
    expect(screen.getByText('新商品')).toBeInTheDocument()
  })

  it('can restore selected rows to pending and shows action feedback', async () => {
    vi.spyOn(db.purchaseRepo, 'list').mockResolvedValue([makeRecord('a', '键盘', 1000)])
    vi.spyOn(db.invoiceRepo, 'list').mockResolvedValue([])
    render(<AppProvider><App /></AppProvider>)
    await waitFor(() => expect(screen.getByText('键盘')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('checkbox', { name: '选择键盘' }))
    fireEvent.click(screen.getByRole('button', { name: '批量标记已报销' }))
    await waitFor(() => expect(screen.getByText('已更新 1 条记录')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('checkbox', { name: '选择键盘' }))
    fireEvent.click(screen.getByRole('button', { name: '批量恢复未报销' }))
    expect(await screen.findByText('已更新 1 条记录')).toBeInTheDocument()
  })

  it('opens the clicked overview row in the purchase editor', async () => {
    vi.spyOn(db.purchaseRepo, 'list').mockResolvedValue([makeRecord('edit-me', '待编辑商品', 1500)])
    vi.spyOn(db.invoiceRepo, 'list').mockResolvedValue([])
    render(<AppProvider><App /></AppProvider>)
    await waitFor(() => expect(screen.getByText('待编辑商品')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '概览' }))
    fireEvent.click(screen.getByText('待编辑商品'))
    await waitFor(() => expect(screen.getByRole('heading', { name: '采购记录' })).toBeInTheDocument())
    expect(screen.getByLabelText('商品名称')).toHaveValue('待编辑商品')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    fireEvent.click(screen.getByRole('button', { name: '概览' }))
    fireEvent.click(screen.getByRole('button', { name: '采购记录' }))
    expect(screen.getByLabelText('商品名称')).toHaveValue('')
  })

  it('keeps bulk selection and reports failure when persistence rejects', async () => {
    const failure = vi.fn().mockRejectedValue(new Error('disk full'))
    render(<PurchaseTable records={[makeRecord('fail', '失败记录', 1000)]} selectedIds={['fail']} onSelectionChange={() => undefined} onReimburse={failure} onEdit={() => undefined} onDelete={async () => undefined} />)
    fireEvent.click(screen.getByRole('checkbox', { name: '选择失败记录' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '选择失败记录' }))
    fireEvent.click(screen.getByRole('button', { name: '批量标记已报销' }))
    await waitFor(() => expect(screen.getByText('批量操作失败，请重试')).toBeInTheDocument())
    expect(screen.getByRole('checkbox', { name: '选择失败记录' })).toBeChecked()
  })

  it('keeps entered form data and shows a retryable error when save persistence fails', async () => {
    vi.spyOn(db.purchaseRepo, 'list').mockResolvedValue([])
    vi.spyOn(db.invoiceRepo, 'list').mockResolvedValue([])
    vi.mocked(db.persistSnapshot).mockRejectedValueOnce(new Error('disk full'))
    render(<AppProvider><App /></AppProvider>)
    await waitFor(() => expect(screen.getByRole('heading', { name: '采购记录' })).toBeInTheDocument())
    await waitFor(() => expect(screen.queryByText('加载中…')).not.toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('商品名称'), { target: { value: '待重试采购' } })
    fireEvent.change(screen.getByLabelText('单价（元）'), { target: { value: '10.00' } })
    fireEvent.click(screen.getByRole('button', { name: '保存采购记录' }))
    expect((await screen.findAllByText(/保存失败/)).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('商品名称')).toHaveValue('待重试采购')
  })

  it('keeps a deleted record and its selection when delete persistence fails', async () => {
    vi.spyOn(db.purchaseRepo, 'list').mockResolvedValue([makeRecord('delete-fail', '不可删除', 1000)])
    vi.spyOn(db.invoiceRepo, 'list').mockResolvedValue([])
    vi.mocked(db.persistSnapshot).mockRejectedValueOnce(new Error('disk full'))
    render(<AppProvider><App /></AppProvider>)
    await waitFor(() => expect(screen.getByText('不可删除')).toBeInTheDocument())
    await waitFor(() => expect(screen.queryByText('加载中…')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('checkbox', { name: '选择不可删除' }))
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect((await screen.findAllByText(/删除失败/)).length).toBeGreaterThan(0)
    expect(screen.getByText('不可删除')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '选择不可删除' })).toBeChecked()
  })
})
