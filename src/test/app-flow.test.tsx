import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../components/layout/AppShell'
import { AppProvider, useApp } from '../state/AppProvider'
import * as db from '../storage/db'
import { makePurchaseFixture } from './fixtures'
import { extractPdfText } from '../invoices/pdfText'

vi.mock('../invoices/pdfText', async () => {
  const actual = await vi.importActual<typeof import('../invoices/pdfText')>('../invoices/pdfText')
  return { ...actual, extractPdfText: vi.fn() }
})

function FlowProbe() {
  const { state, refresh } = useApp()
  return <div>
    <output aria-label="待报销合计">{state.metrics.pendingTotalCents}</output>
    <button onClick={() => void refresh()}>刷新数据</button>
  </div>
}

describe('app acceptance flow', () => {
  beforeEach(() => {
    let hydratedPurchases = [makePurchaseFixture()]
    let hydratedInvoices: import('../domain/types').InvoiceRecord[] = []
    vi.spyOn(db.purchaseRepo, 'list').mockImplementation(async () => hydratedPurchases)
    vi.spyOn(db.invoiceRepo, 'list').mockImplementation(async () => hydratedInvoices)
    vi.spyOn(db, 'persistSnapshot').mockImplementation(async (snapshot) => {
      hydratedPurchases = snapshot.purchases
      hydratedInvoices = snapshot.invoices
    })
    vi.mocked(extractPdfText).mockResolvedValue({
      text: '商品名称：人体工学椅\n销售方名称：办公用品店\n开票日期：2026-08-12\n发票号码：INV-001\n价税合计(小写)：¥20.00',
      pageCount: 1,
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fixture')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  afterEach(() => vi.restoreAllMocks())

  it('completes add → refresh → bulk reimburse → invoice match → backup export', async () => {
    render(<AppProvider><AppShell /><FlowProbe /></AppProvider>)
    await waitFor(() => expect(screen.getByRole('heading', { name: '采购记录' })).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('商品名称'), { target: { value: '无线鼠标' } })
    fireEvent.change(screen.getByLabelText('数量'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('单价（元）'), { target: { value: '20.00' } })
    fireEvent.click(screen.getByRole('button', { name: '保存采购记录' }))
    await waitFor(() => expect(screen.getByText('无线鼠标')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByLabelText('待报销合计')).toHaveTextContent('4000'))

    fireEvent.click(screen.getByRole('button', { name: '刷新数据' }))
    await waitFor(() => expect(screen.getByLabelText('待报销合计')).toHaveTextContent('4000'))

    fireEvent.click(screen.getByRole('checkbox', { name: '选择无线鼠标' }))
    fireEvent.click(screen.getByRole('button', { name: '批量标记已报销' }))
    await waitFor(() => expect(screen.getByLabelText('待报销合计')).toHaveTextContent('2000'))

    fireEvent.click(screen.getByRole('button', { name: '发票中心' }))
    const file = new File(['%PDF-1.7'], 'chair-invoice.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('上传 PDF 发票'), { target: { files: [file] } })
    const candidate = await screen.findByText('人体工学椅')
    fireEvent.click(within(candidate.closest('[data-purchase-row]') as HTMLElement).getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: '确认匹配' }))
    await waitFor(() => expect(screen.getByText('已匹配')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '设置' }))
    fireEvent.click(screen.getByRole('button', { name: '导出备份' }))
    await waitFor(() => expect(screen.getByText('备份已导出')).toBeInTheDocument())
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })
})
