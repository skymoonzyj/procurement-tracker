import { useEffect, useMemo } from 'react'
import type { InvoiceRecord } from '../../domain/types'

interface InvoiceCardProps { invoice: InvoiceRecord; progress?: number; error?: string; onRetry?: () => void }

const statusLabel: Record<InvoiceRecord['parseStatus'], string> = { parsed: '已解析', empty: '无可提取文字', failed: '解析失败' }

export function InvoiceCard({ invoice, progress, error, onRetry }: InvoiceCardProps) {
  const downloadUrl = useMemo(() => URL.createObjectURL(invoice.blob), [invoice.blob])
  useEffect(() => () => URL.revokeObjectURL(downloadUrl), [downloadUrl])
  const preview = () => {
    const url = URL.createObjectURL(invoice.blob)
    let settled = false
    let fallback: number | undefined
    const cleanup = () => {
      if (settled) return
      settled = true
      if (fallback != null) window.clearTimeout(fallback)
      URL.revokeObjectURL(url)
    }
    try {
      const popup = window.open(url, '_blank')
      if (popup) {
        try { popup.opener = null } catch { /* cross-origin popup */ }
        popup.addEventListener('load', cleanup, { once: true })
        popup.addEventListener('error', cleanup, { once: true })
        fallback = window.setTimeout(cleanup, 60_000)
      } else {
        // Some browsers return null for a successful noopener navigation. Keep
        // the URL alive until the fallback rather than revoking too early.
        fallback = window.setTimeout(cleanup, 60_000)
      }
    } catch {
      cleanup()
    }
  }
  return <article className="invoice-card">
    <div className="invoice-card-head"><div><h3>{invoice.fileName}</h3><p className="muted">{(invoice.sizeBytes / 1024 / 1024).toFixed(2)} MB · {statusLabel[invoice.parseStatus]}</p></div><span className={`status-badge ${invoice.matchStatus}`}>{invoice.matchStatus === 'confirmed' ? '已匹配' : invoice.matchStatus === 'needs_review' ? '需复核' : '待匹配'}</span></div>
    {progress != null && progress < 100 && <progress value={progress} max="100" aria-label={`上传进度 ${invoice.fileName}`}>{progress}%</progress>}
    {(error || invoice.parseStatus === 'failed') && <div role="alert" className="form-error">{error ?? '解析失败，请重试'}<button className="button secondary" onClick={onRetry}>{`重试解析 ${invoice.fileName}`}</button></div>}
    <dl className="invoice-metadata">
      {invoice.invoiceNumber && <><dt>发票号码</dt><dd>{invoice.invoiceNumber}</dd></>}
      {invoice.issueDate && <><dt>开票日期</dt><dd>{invoice.issueDate}</dd></>}
      {invoice.vendorName && <><dt>销售方</dt><dd>{invoice.vendorName}</dd></>}
      {invoice.totalAmountCents != null && <><dt>价税合计</dt><dd>¥{(invoice.totalAmountCents / 100).toFixed(2)}</dd></>}
    </dl>
    <div className="invoice-actions"><button className="button secondary" onClick={preview}>预览 PDF</button><a className="button secondary" href={downloadUrl} download={invoice.fileName}>下载</a></div>
  </article>
}
