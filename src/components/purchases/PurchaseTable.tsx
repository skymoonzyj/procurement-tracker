import { useState } from 'react'
import { formatCNY } from '../../domain/money'
import type { PurchaseRecord } from '../../domain/types'
import { StatusBadge } from '../common/StatusBadge'
interface PurchaseTableProps { records: PurchaseRecord[]; selectedIds: string[]; onSelectionChange: (ids: string[]) => void; onReimburse: (ids: string[], value: boolean) => Promise<void>; onEdit: (record: PurchaseRecord) => void; onDelete: (id: string) => Promise<boolean | void> }
export function PurchaseTable({ records, selectedIds, onSelectionChange, onReimburse, onEdit, onDelete }: PurchaseTableProps) {
  const [feedback, setFeedback] = useState('')
  const selected = new Set(selectedIds); const allSelected = records.length > 0 && records.every(r => selected.has(r.id))
  const toggle = (id: string) => onSelectionChange(selected.has(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  const runBulk = async (value: boolean) => { try { await onReimburse(selectedIds, value); setFeedback(`已更新 ${selectedIds.length} 条记录`) } catch { setFeedback('批量操作失败，请重试') } }
  const runDelete = async (id: string) => { try { const ok = await onDelete(id); if (ok === false) throw new Error('delete failed'); setFeedback('记录已删除') } catch { setFeedback('删除失败，请重试') } }
  return <section className="table-card"><div className="table-toolbar"><div><h2>采购明细</h2><span className="muted">共 {records.length} 条记录</span></div><div>{feedback && <span className="bulk-feedback" role="status">{feedback}</span>}<button className="button primary" disabled={!selectedIds.length} onClick={() => void runBulk(true)}>批量标记已报销</button><button className="button secondary" disabled={!selectedIds.length} onClick={() => void runBulk(false)}>批量恢复未报销</button></div></div>
    <div className="table-scroll"><table><thead><tr><th><input type="checkbox" aria-label="全选当前记录" checked={allSelected} onChange={() => onSelectionChange(allSelected ? selectedIds.filter(id => !records.some(r => r.id === id)) : [...new Set([...selectedIds, ...records.map(r => r.id)])])} /></th><th>商品</th><th>日期</th><th>数量</th><th>单价</th><th>总价</th><th>状态</th><th>操作</th></tr></thead><tbody>{records.map(record => <tr key={record.id}><td><input type="checkbox" aria-label={`选择${record.itemName}`} checked={selected.has(record.id)} onChange={() => toggle(record.id)} /></td><td><strong>{record.itemName}</strong>{record.notes && <small>{record.notes}</small>}</td><td>{record.purchasedAt}</td><td>{record.quantity}</td><td>{formatCNY(record.unitPriceCents)}</td><td><strong>{formatCNY(record.totalPriceCents)}</strong></td><td><StatusBadge reimbursed={record.reimbursed} invoiceStatus={record.invoiceStatus} /></td><td><button className="link-button" onClick={() => onEdit(record)}>编辑</button><button className="link-button danger" onClick={() => void runDelete(record.id)}>删除</button></td></tr>)}</tbody></table></div>
    {!records.length && <div className="empty-state">暂无采购记录，先添加一笔吧。</div>}
  </section>
}
