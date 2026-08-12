import { useEffect, useMemo, useState } from 'react'
import type { InvoiceRecord, PurchaseRecord } from '../../domain/types'
import type { MatchSuggestion } from '../../invoices/matchPurchases'

interface MatchReviewPanelProps {
  invoice: InvoiceRecord
  suggestions: MatchSuggestion[]
  purchases: PurchaseRecord[]
  onConfirm: (ids: string[]) => void
  onSkip: () => void
  onUnlink: (id: string) => void
}

export function MatchReviewPanel({ invoice, suggestions, purchases, onConfirm, onSkip, onUnlink }: MatchReviewPanelProps) {
  const [selected, setSelected] = useState<string[]>(invoice.matchedPurchaseIds)
  const [query, setQuery] = useState('')
  useEffect(() => setSelected(invoice.matchedPurchaseIds), [invoice.matchedPurchaseIds])
  const available = useMemo(() => purchases.filter((purchase) => purchase.itemName.toLowerCase().includes(query.trim().toLowerCase())), [purchases, query])
  const rows = invoice.parseStatus === 'empty' ? available.map((purchase) => ({ purchaseId: purchase.id, score: 0, reasons: ['手动关联'], confidence: 'review' as const })) : suggestions
  return <section className="match-review-panel" aria-label={`匹配复核 ${invoice.fileName}`}>
    <div className="match-review-head"><h3>关联采购记录</h3>{invoice.parseStatus === 'empty' && <p className="muted">扫描 PDF：OCR 未包含在 v1，请手动搜索关联。</p>}</div>
    {invoice.parseStatus === 'empty' && <input aria-label="搜索采购记录" placeholder="搜索采购记录" value={query} onChange={(event) => setQuery(event.target.value)} />}
    {rows.length === 0 ? <p className="muted">暂无候选记录</p> : <div className="candidate-list">{rows.map((suggestion) => {
      const purchase = purchases.find((record) => record.id === suggestion.purchaseId)
      if (!purchase) return null
      const checked = selected.includes(purchase.id)
      return <div key={purchase.id} data-purchase-row className="candidate-row"><label><input type="checkbox" aria-label={`选择${purchase.itemName}`} checked={checked} onChange={() => setSelected((ids) => checked ? ids.filter((id) => id !== purchase.id) : [...ids, purchase.id])} /><span>{purchase.itemName}</span></label><span className="candidate-score">{suggestion.confidence === 'high' ? '高置信度' : suggestion.confidence === 'review' ? '建议复核' : '低置信度'} · {suggestion.reasons.join('，')}</span>{invoice.matchedPurchaseIds.includes(purchase.id) && <button className="button link" onClick={() => onUnlink(purchase.id)}>解除关联</button>}</div>
    })}</div>}
    <div className="match-review-actions"><button className="button primary" onClick={() => onConfirm(selected)} disabled={!selected.length}>确认匹配</button><button className="button secondary" onClick={onSkip}>跳过</button></div>
  </section>
}
