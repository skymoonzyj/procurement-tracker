import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { AppProvider, useApp } from '../../state/AppProvider'
import { InvoicesPage } from '../InvoicesPage'
import * as db from '../../storage/db'
import type { PurchaseRecord } from '../../domain/types'

vi.mock('../../invoices/pdfText', () => ({
  extractPdfText: vi.fn(),
  MAX_PDF_BYTES: 20 * 1024 * 1024,
}))

import { extractPdfText } from '../../invoices/pdfText'

const makePurchase = (id = 'purchase-1'): PurchaseRecord => ({
  id,
  purchasedAt: '2026-08-01', itemUrl: '', itemName: '办公椅', quantity: 1,
  unitPriceCents: 1234, totalPriceCents: 1234, storageLink: '', notes: '',
  reimbursed: false, invoiceStatus: 'missing', invoiceIds: [],
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
})

beforeEach(() => {
  vi.spyOn(db.purchaseRepo, 'list').mockResolvedValue([makePurchase()])
  vi.spyOn(db.invoiceRepo, 'list').mockResolvedValue([])
  vi.spyOn(db, 'persistSnapshot').mockResolvedValue(undefined)
  vi.mocked(extractPdfText).mockResolvedValue({
    text: '商品名称：办公椅\n销售方名称：办公用品店\n开票日期：2026-08-01\n发票号码：12345678\n价税合计(小写)：¥12.34',
    pageCount: 1,
  })
})

afterEach(() => vi.restoreAllMocks())

describe('invoice center interactions', () => {
  it('uploads a PDF, parses it, and shows filename and amount', async () => {
    render(<AppProvider><InvoicesPage /></AppProvider>)
    await waitFor(() => expect(screen.getByRole('heading', { name: '发票中心' })).toBeInTheDocument())
    const file = new File(['%PDF-1.7'], 'office-chair.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('上传 PDF 发票'), { target: { files: [file] } })
    expect(await screen.findByText('office-chair.pdf')).toBeInTheDocument()
    expect(await screen.findByText('¥12.34')).toBeInTheDocument()
  })

  it('keeps a failed upload retryable', async () => {
    vi.mocked(extractPdfText).mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce({ text: '价税合计：12.34', pageCount: 1 })
    render(<AppProvider><InvoicesPage /></AppProvider>)
    await waitFor(() => expect(screen.getByRole('heading', { name: '发票中心' })).toBeInTheDocument())
    const file = new File(['bad'], 'retry.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('上传 PDF 发票'), { target: { files: [file] } })
    expect(await screen.findByText(/解析失败/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重试解析 retry.pdf' }))
    expect(await screen.findByText('¥12.34')).toBeInTheDocument()
  })

  it('confirms a candidate and marks both invoice and purchase matched', async () => {
    render(<AppProvider><InvoicesPage /></AppProvider>)
    await waitFor(() => expect(screen.getByRole('heading', { name: '发票中心' })).toBeInTheDocument())
    const file = new File(['%PDF-1.7'], 'match.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('上传 PDF 发票'), { target: { files: [file] } })
    const candidate = await screen.findByText('办公椅')
    const row = candidate.closest('[data-purchase-row]') ?? candidate.parentElement
    fireEvent.click(within(row as HTMLElement).getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: '确认匹配' }))
    await waitFor(() => expect(screen.getByText('已匹配')).toBeInTheDocument())
    expect(screen.getByText('匹配成功')).toBeInTheDocument()
  })

  it('offers manual purchase search for an empty PDF', async () => {
    vi.mocked(extractPdfText).mockResolvedValue({ text: '', pageCount: 1 })
    render(<AppProvider><InvoicesPage /></AppProvider>)
    await waitFor(() => expect(screen.getByRole('heading', { name: '发票中心' })).toBeInTheDocument())
    const file = new File(['scan'], 'scanned.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('上传 PDF 发票'), { target: { files: [file] } })
    expect(await screen.findByText(/OCR 未包含/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('搜索采购记录'), { target: { value: '办公' } })
    expect(screen.getByText('办公椅')).toBeInTheDocument()
  })
})
