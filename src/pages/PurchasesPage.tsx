import { useMemo, useState } from 'react'
import type { PurchaseInput, PurchaseRecord } from '../domain/types'
import { calculateTotalCents, toCents } from '../domain/money'
import { useApp } from '../state/AppProvider'
import { PurchaseForm } from '../components/purchases/PurchaseForm'
import { PurchaseTable } from '../components/purchases/PurchaseTable'

export function PurchasesPage({ onNavigateOverview }: { onNavigateOverview?: () => void }) {
  const { state, dispatch } = useApp(); const [selectedIds, setSelectedIds] = useState<string[]>([]); const [editing, setEditing] = useState<PurchaseRecord | undefined>(); const [query, setQuery] = useState('')
  const records = useMemo(() => state.purchases.filter(r => !query.trim() || r.itemName.toLowerCase().includes(query.trim().toLowerCase())), [state.purchases, query])
  const submit = async (input: PurchaseInput) => {
    const now = new Date().toISOString(); const quantity = Number(input.quantity); const unitPriceCents = typeof input.unitPriceCents === 'string' ? toCents(input.unitPriceCents) : Number(input.unitPriceCents); const existing = editing
    const purchase: PurchaseRecord = { id: existing?.id ?? crypto.randomUUID(), purchasedAt: input.purchasedAt, itemUrl: input.itemUrl ?? '', itemName: input.itemName.trim(), quantity, unitPriceCents, totalPriceCents: calculateTotalCents(quantity, unitPriceCents), storageLink: input.storageLink ?? '', notes: input.notes ?? '', reimbursed: existing?.reimbursed ?? false, reimbursedAt: existing?.reimbursedAt, invoiceStatus: existing?.invoiceStatus ?? 'missing', invoiceIds: existing?.invoiceIds ?? [], createdAt: existing?.createdAt ?? now, updatedAt: now }
    dispatch({ type: existing ? 'updatePurchase' : 'addPurchase', purchase }); setEditing(undefined)
  }
  const reimburse = async (ids: string[], value: boolean) => { dispatch({ type: 'setReimbursed', ids, reimbursed: value }); setSelectedIds([]) }
  const remove = async (id: string) => { dispatch({ type: 'replaceAll', purchases: state.purchases.filter(r => r.id !== id), invoices: state.invoices }); setSelectedIds(ids => ids.filter(x => x !== id)) }
  const initialValue = editing ? { purchasedAt: editing.purchasedAt, itemName: editing.itemName, quantity: editing.quantity, unitPriceCents: (editing.unitPriceCents / 100).toFixed(2), itemUrl: editing.itemUrl, storageLink: editing.storageLink, notes: editing.notes } : undefined
  return <div className="page purchases-page"><div className="page-intro"><div><p className="eyebrow">台账</p><h2>记录每一笔采购，报销更从容</h2><p className="muted">跟踪发票、报销状态和采购明细。</p></div><div className="summary-chip">待报销 <strong>{state.metrics.pendingCount}</strong> 笔 · ¥{(state.metrics.pendingTotalCents / 100).toFixed(2)}</div></div>
    <PurchaseForm initialValue={initialValue} onSubmit={submit} onCancel={() => setEditing(undefined)} />
    <div className="filter-row"><label className="search-label">搜索采购记录<input aria-label="搜索采购记录" value={query} onChange={e => setQuery(e.target.value)} placeholder="按商品名称搜索" /></label>{onNavigateOverview && <button className="button secondary" onClick={onNavigateOverview}>查看概览</button>}</div>
    <PurchaseTable records={records} selectedIds={selectedIds} onSelectionChange={setSelectedIds} onReimburse={reimburse} onEdit={setEditing} onDelete={remove} />
  </div>
}
