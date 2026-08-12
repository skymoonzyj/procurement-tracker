import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../components/layout/AppShell'
import { AppProvider, useApp } from '../state/AppProvider'
import * as db from '../storage/db'
import { makePurchaseFixture } from './fixtures'
import { extractPdfText } from '../invoices/pdfText'
import type { InvoiceRecord, PurchaseRecord } from '../domain/types'

vi.mock('../invoices/pdfText', async () => {
  const actual = await vi.importActual<typeof import('../invoices/pdfText')>('../invoices/pdfText')
  return { ...actual, extractPdfText: vi.fn() }
})

function FlowProbe() {
  const { state, refresh } = useApp()
  return <div>
    <output aria-label="待报销合计">{state.metrics.pendingTotalCents}</output>
    <output aria-label="应用状态">{JSON.stringify({ purchases: state.purchases, invoices: state.invoices }, (_key, value) => value instanceof Blob ? '[Blob]' : value)}</output>
    <button onClick={() => void refresh()}>刷新数据</button>
  </div>
}

describe('app acceptance flow', () => {
  let repoPurchases: PurchaseRecord[]
  let repoInvoices: InvoiceRecord[]

  beforeEach(() => {
    repoPurchases = [makePurchaseFixture()]
    repoInvoices = []
    vi.spyOn(db.purchaseRepo, 'list').mockImplementation(async () => repoPurchases)
    vi.spyOn(db.invoiceRepo, 'list').mockImplementation(async () => repoInvoices)
    vi.spyOn(db, 'persistSnapshot').mockImplementation(async (snapshot) => {
      repoPurchases = snapshot.purchases
      repoInvoices = snapshot.invoices
    })
    vi.mocked(extractPdfText).mockResolvedValue({
      text: '商品名称：人体工学椅\n销售方名称：办公用品店\n开票日期：2026-08-12\n发票号码：INV-001\n价税合计(小写)：¥20.00',
      pageCount: 1,
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  afterEach(() => vi.restoreAllMocks())

  it('completes add → refresh → bulk reimburse → invoice match → backup export', async () => {
    let exportedBlob: Blob | undefined
    let clickedDownload = ''
    let clickedHref = ''
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => {
      if (value instanceof Blob && value.type === 'application/json') exportedBlob = value
      return value instanceof Blob && value.type === 'application/json' ? 'blob:backup' : 'blob:invoice'
    })
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownload = this.download
      clickedHref = this.href
    })
    render(<AppProvider><AppShell /><FlowProbe /></AppProvider>)
    await waitFor(() => expect(screen.getByRole('heading', { name: '采购记录' })).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('商品名称'), { target: { value: '无线鼠标' } })
    fireEvent.change(screen.getByLabelText('数量'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('单价（元）'), { target: { value: '20.00' } })
    fireEvent.click(screen.getByRole('button', { name: '保存采购记录' }))
    await waitFor(() => expect(screen.getByText('无线鼠标')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByLabelText('待报销合计')).toHaveTextContent('4000'))

    const listCallsBeforeRefresh = vi.mocked(db.purchaseRepo.list).mock.calls.length
    repoPurchases = repoPurchases.map((purchase) => purchase.itemName === '人体工学椅'
      ? { ...purchase, unitPriceCents: 3500, totalPriceCents: 3500 }
      : purchase)
    fireEvent.click(screen.getByRole('button', { name: '刷新数据' }))
    await waitFor(() => expect(db.purchaseRepo.list).toHaveBeenCalledTimes(listCallsBeforeRefresh + 1))
    await waitFor(() => expect(screen.getByLabelText('待报销合计')).toHaveTextContent('5500'))

    fireEvent.click(screen.getByRole('checkbox', { name: '选择无线鼠标' }))
    fireEvent.click(screen.getByRole('button', { name: '批量标记已报销' }))
    await waitFor(() => expect(screen.getByLabelText('待报销合计')).toHaveTextContent('3500'))

    fireEvent.click(screen.getByRole('button', { name: '发票中心' }))
    const file = new File(['%PDF-1.7'], 'chair-invoice.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('上传 PDF 发票'), { target: { files: [file] } })
    const candidate = await screen.findByText('人体工学椅')
    fireEvent.click(within(candidate.closest('[data-purchase-row]') as HTMLElement).getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: '确认匹配' }))
    await waitFor(() => expect(screen.getByText('已匹配')).toBeInTheDocument())
    const matchedState = JSON.parse(screen.getByLabelText('应用状态').textContent ?? '{}') as { purchases: PurchaseRecord[]; invoices: InvoiceRecord[] }
    const matchedPurchase = matchedState.purchases.find((purchase) => purchase.itemName === '人体工学椅')
    const confirmedInvoice = matchedState.invoices.find((invoice) => invoice.fileName === 'chair-invoice.pdf')
    expect(matchedPurchase?.invoiceStatus).toBe('matched')
    expect(matchedPurchase?.invoiceIds).toContain(confirmedInvoice?.id)
    expect(confirmedInvoice?.matchStatus).toBe('confirmed')
    expect(confirmedInvoice?.matchedPurchaseIds).toContain(matchedPurchase?.id)

    fireEvent.click(screen.getByRole('button', { name: '设置' }))
    fireEvent.click(screen.getByRole('button', { name: '导出备份' }))
    await waitFor(() => expect(screen.getByText('备份已导出')).toBeInTheDocument())
    expect(anchorClick).toHaveBeenCalledTimes(1)
    expect(clickedHref).toBe('blob:backup')
    expect(clickedDownload).toMatch(/^采购报销备份-\d{4}-\d{2}-\d{2}\.json$/)
    expect(exportedBlob).toBeDefined()
    const backup = JSON.parse(await exportedBlob!.text()) as {
      purchases: PurchaseRecord[]
      invoices: Array<Omit<InvoiceRecord, 'blob'> & { blobBase64: string }>
    }
    const reimbursed = backup.purchases.find((purchase) => purchase.itemName === '无线鼠标')
    const pendingMatched = backup.purchases.find((purchase) => purchase.itemName === '人体工学椅')
    const exportedInvoice = backup.invoices.find((invoice) => invoice.fileName === 'chair-invoice.pdf')
    expect(reimbursed?.reimbursed).toBe(true)
    expect(pendingMatched?.reimbursed).toBe(false)
    expect(pendingMatched?.invoiceStatus).toBe('matched')
    expect(pendingMatched?.invoiceIds).toContain(exportedInvoice?.id)
    expect(exportedInvoice?.matchStatus).toBe('confirmed')
    expect(exportedInvoice?.matchedPurchaseIds).toContain(pendingMatched?.id)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:backup')
  })
})
