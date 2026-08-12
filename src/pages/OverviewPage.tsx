import type { PurchaseRecord } from '../domain/types'
import { formatCNY } from '../domain/money'
import { useApp } from '../state/AppProvider'
import { StatusBadge } from '../components/common/StatusBadge'
export function OverviewPage({ onEditPurchase }: { onEditPurchase?: (record: PurchaseRecord) => void }) {
  const { state } = useApp(); const pending = state.purchases.filter(p => !p.reimbursed)
  return <div className="page overview-page"><div className="page-intro"><div><p className="eyebrow">总览</p><h2>掌握报销进度</h2><p className="muted">所有关键数字，一眼看清。</p></div></div>
    <div className="metric-grid"><article><span>采购总额</span><strong>{formatCNY(state.metrics.allTotalCents)}</strong></article><article><span>已报销</span><strong>{formatCNY(state.metrics.reimbursedTotalCents)}</strong></article><article className="accent"><span>待报销</span><strong>{formatCNY(state.metrics.pendingTotalCents)}</strong><small>{state.metrics.pendingCount} 笔</small></article><article><span>待补发票</span><strong>{state.metrics.pendingInvoiceCount}</strong><small>日期跨度 {state.metrics.pendingDateSpanLabel}</small></article></div>
    <section className="pending-card"><div className="table-toolbar"><h2>待报销清单</h2><span className="muted">按采购日期排序</span></div>{pending.length ? <ul className="pending-list">{pending.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt)).map(record => <li key={record.id} onClick={() => onEditPurchase?.(record)}><div><strong>{record.itemName}</strong><span>{record.purchasedAt} · {record.quantity} 件</span></div><div><strong>{formatCNY(record.totalPriceCents)}</strong><StatusBadge invoiceStatus={record.invoiceStatus} /></div></li>)}</ul> : <div className="empty-state">暂无待报销记录</div>}</section>
  </div>
}
