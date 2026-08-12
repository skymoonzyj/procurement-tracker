import { useMemo, useState } from 'react'
import type { InvoiceRecord } from '../domain/types'
import { extractPdfText } from '../invoices/pdfText'
import { parseInvoiceText } from '../invoices/parseInvoice'
import { rankPurchaseMatches } from '../invoices/matchPurchases'
import { useApp } from '../state/AppProvider'
import { InvoiceDropzone } from '../components/invoices/InvoiceDropzone'
import { InvoiceCard } from '../components/invoices/InvoiceCard'
import { MatchReviewPanel } from '../components/invoices/MatchReviewPanel'

interface UploadState { progress: number; error?: string }

export function InvoicesPage() {
  const { state, dispatch } = useApp()
  const [uploads, setUploads] = useState<Record<string, UploadState>>({})
  const [notice, setNotice] = useState('')

  const processFile = async (file: File, id: string = crypto.randomUUID()) => {
    const initial: InvoiceRecord = { id, fileName: file.name, mimeType: 'application/pdf', sizeBytes: file.size, blob: file, uploadedAt: new Date().toISOString(), rawText: '', parseStatus: 'failed', matchStatus: 'needs_review', matchedPurchaseIds: [] }
    setUploads((items) => ({ ...items, [id]: { progress: 10 } }))
    const existing = state.invoices.some((invoice) => invoice.id === id)
    if (existing) await dispatch({ type: 'updateInvoice', invoice: initial })
    else await dispatch({ type: 'addInvoice', invoice: initial })
    try {
      setUploads((items) => ({ ...items, [id]: { progress: 45 } }))
      const extracted = await extractPdfText(file)
      const fields = parseInvoiceText(extracted.text)
      const invoice: InvoiceRecord = { ...initial, issueDate: fields.issueDate ?? undefined, invoiceNumber: fields.invoiceNumber ?? undefined, vendorName: fields.vendorName ?? undefined, totalAmountCents: fields.totalAmountCents ?? undefined, rawText: fields.rawText, parseStatus: fields.parseStatus, matchStatus: fields.parseStatus === 'empty' || fields.needsReview ? 'needs_review' : 'suggested' }
      await dispatch({ type: 'updateInvoice', invoice })
      setUploads((items) => ({ ...items, [id]: { progress: 100 } }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      const failed = { ...initial, rawText: '', parseStatus: 'failed' as const, matchStatus: 'needs_review' as const }
      await dispatch({ type: 'updateInvoice', invoice: failed })
      setUploads((items) => ({ ...items, [id]: { progress: 100, error: message } }))
    }
  }

  const onFiles = (files: File[]) => { files.forEach((file) => { void processFile(file) }) }
  const retry = (invoice: InvoiceRecord) => { void processFile(new File([invoice.blob], invoice.fileName, { type: 'application/pdf' }), invoice.id) }
  const invoices = useMemo(() => [...state.invoices].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)), [state.invoices])

  return <div className="page invoices-page"><div className="page-intro"><div><p className="eyebrow">发票</p><h2>发票中心</h2><p className="muted">上传 PDF，提取摘要并关联采购记录。</p></div><div className="summary-chip">待匹配 <strong>{invoices.filter((invoice) => invoice.matchStatus !== 'confirmed').length}</strong> 张</div></div>
    <InvoiceDropzone onFiles={onFiles} />
    {notice && <div role="status" className="toast-inline">{notice}</div>}
    <div className="invoice-list">{invoices.map((invoice) => {
      const suggestions = rankPurchaseMatches({ itemName: invoice.rawText ? parseInvoiceText(invoice.rawText).itemName : null, issueDate: invoice.issueDate ?? null, invoiceNumber: invoice.invoiceNumber ?? null, vendorName: invoice.vendorName ?? null, totalAmountCents: invoice.totalAmountCents ?? null, rawText: invoice.rawText, parseStatus: invoice.parseStatus, needsReview: invoice.matchStatus === 'needs_review' }, state.purchases)
      return <div key={invoice.id} className="invoice-work-item"><InvoiceCard invoice={invoice} progress={uploads[invoice.id]?.progress} error={uploads[invoice.id]?.error} onRetry={() => retry(invoice)} />
        {invoice.parseStatus !== 'failed' && <MatchReviewPanel invoice={invoice} suggestions={suggestions} purchases={state.purchases} onConfirm={(ids) => { void dispatch({ type: 'confirmInvoiceMatch', invoiceId: invoice.id, purchaseIds: ids }); setNotice('匹配成功'); setTimeout(() => setNotice(''), 1800) }} onSkip={() => setNotice('已跳过匹配')} onUnlink={(purchaseId) => { void dispatch({ type: 'unlinkInvoice', invoiceId: invoice.id, purchaseId }) }} />}
      </div>
    })}</div>
  </div>
}
