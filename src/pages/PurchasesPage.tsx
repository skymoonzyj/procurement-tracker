import { useEffect, useMemo, useState } from 'react'
import type { PurchaseInput, PurchaseRecord } from '../domain/types'
import { calculateTotalCents, toCents } from '../domain/money'
import { useApp } from '../state/AppProvider'
import { PurchaseForm } from '../components/purchases/PurchaseForm'
import { PurchaseTable } from '../components/purchases/PurchaseTable'

export function PurchasesPage({ onNavigateOverview, initialEdit, onEditStateChange }: { onNavigateOverview?: () => void; initialEdit?: PurchaseRecord; onEditStateChange?: (editing: boolean) => void }) {
  const { state, dispatch } = useApp(); const [selectedIds, setSelectedIds] = useState<string[]>([]); const [editing, setEditing] = useState<PurchaseRecord | undefined>(initialEdit); const [query, setQuery] = useState(''); const [reimbursedFilter, setReimbursedFilter] = useState('all'); const [invoiceFilter, setInvoiceFilter] = useState('all'); const [fromDate, setFromDate] = useState(''); const [toDate, setToDate] = useState('')
  useEffect(() => { if (initialEdit) setEditing(initialEdit) }, [initialEdit])
  useEffect(() => {
    const available = new Set(state.purchases.map((purchase) => purchase.id))
    setSelectedIds((ids) => ids.filter((id) => available.has(id)))
  }, [state.purchases])
  const records = useMemo(() => [...state.purchases].filter(r => {
    const needle = query.trim().toLowerCase(); const haystack = [r.itemName, r.itemUrl, r.storageLink, r.notes].join(' ').toLowerCase()
    return (!needle || haystack.includes(needle)) && (reimbursedFilter === 'all' || (reimbursedFilter === 'reimbursed') === r.reimbursed) && (invoiceFilter === 'all' || r.invoiceStatus === invoiceFilter) && (!fromDate || r.purchasedAt >= fromDate) && (!toDate || r.purchasedAt <= toDate)
  }).sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt)), [state.purchases, query, reimbursedFilter, invoiceFilter, fromDate, toDate])
  const submit = async (input: PurchaseInput): Promise<boolean> => {
    const now = new Date().toISOString(); const quantity = Number(input.quantity); const unitPriceCents = typeof input.unitPriceCents === 'string' ? toCents(input.unitPriceCents) : Number(input.unitPriceCents); const existing = editing
    const purchase: PurchaseRecord = { id: existing?.id ?? crypto.randomUUID(), purchasedAt: input.purchasedAt, itemUrl: input.itemUrl ?? '', itemName: input.itemName.trim(), quantity, unitPriceCents, totalPriceCents: calculateTotalCents(quantity, unitPriceCents), storageLink: input.storageLink ?? '', notes: input.notes ?? '', reimbursed: existing?.reimbursed ?? false, reimbursedAt: existing?.reimbursedAt, invoiceStatus: existing?.invoiceStatus ?? 'missing', invoiceIds: existing?.invoiceIds ?? [], createdAt: existing?.createdAt ?? now, updatedAt: now }
    try {
      const ok = await dispatch({ type: existing ? 'updatePurchase' : 'addPurchase', purchase })
      if (!ok) return false
      setEditing(undefined); onEditStateChange?.(false); return true
    } catch {
      return false
    }
  }
  const reimburse = async (ids: string[], value: boolean) => { const ok = await dispatch({ type: 'setReimbursed', ids, reimbursed: value }); if (ok) setSelectedIds([]); else throw new Error('persistence failed') }
  const remove = async (id: string): Promise<boolean> => {
    const wasSelected = selectedIds.includes(id)
    try {
      const ok = await dispatch({ type: 'removePurchase', id })
      if (!ok) {
        if (wasSelected) setSelectedIds(ids => ids.includes(id) ? ids : [...ids, id])
        return false
      }
      setSelectedIds(ids => ids.filter(x => x !== id))
      return true
    } catch (cause) {
      if (wasSelected) setSelectedIds(ids => ids.includes(id) ? ids : [...ids, id])
      void cause
      return false
    }
  }
  const initialValue = useMemo(() => editing ? ({ purchasedAt: editing.purchasedAt, itemName: editing.itemName, quantity: editing.quantity, unitPriceCents: (editing.unitPriceCents / 100).toFixed(2), itemUrl: editing.itemUrl, storageLink: editing.storageLink, notes: editing.notes }) : undefined, [editing])
  return <div className="page purchases-page"><div className="page-intro"><div><p className="eyebrow">台账</p><h2>记录每一笔采购，报销更从容</h2><p className="muted">跟踪发票、报销状态和采购明细。</p></div><div className="summary-chip">待报销 <strong>{state.metrics.pendingCount}</strong> 笔 · ¥{(state.metrics.pendingTotalCents / 100).toFixed(2)}</div></div>
    <PurchaseForm initialValue={initialValue} onSubmit={submit} onCancel={() => { setEditing(undefined); onEditStateChange?.(false) }} />
    <div className="filter-row"><label className="search-label">搜索采购记录<input aria-label="搜索采购记录" value={query} onChange={e => setQuery(e.target.value)} placeholder="按名称、链接或备注搜索" /></label><label>报销状态<select aria-label="报销状态" value={reimbursedFilter} onChange={e => setReimbursedFilter(e.target.value)}><option value="all">全部</option><option value="pending">待报销</option><option value="reimbursed">已报销</option></select></label><label>发票状态<select aria-label="发票状态" value={invoiceFilter} onChange={e => setInvoiceFilter(e.target.value)}><option value="all">全部</option><option value="missing">待补发票</option><option value="attached">已附发票</option><option value="matched">已匹配</option><option value="needs_review">需复核</option></select></label><label>起始日期<input aria-label="起始日期" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></label><label>结束日期<input aria-label="结束日期" type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></label>{onNavigateOverview && <button className="button secondary" onClick={onNavigateOverview}>查看概览</button>}</div>
    <PurchaseTable records={records} selectedIds={selectedIds} onSelectionChange={setSelectedIds} onReimburse={reimburse} onEdit={setEditing} onDelete={remove} />
  </div>
}
