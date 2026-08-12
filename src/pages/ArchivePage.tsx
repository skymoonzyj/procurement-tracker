import { useEffect, useMemo, useState } from 'react'
import { formatCNY } from '../domain/money'
import { useApp } from '../state/AppProvider'
import type { PurchaseRecord } from '../domain/types'

function safeHttpUrl(value: string): string | undefined {
  try { const parsed = new URL(value); return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined } catch { return undefined }
}

export function ArchivePage({ onEditPurchase }: { onEditPurchase?: (record: PurchaseRecord) => void }) {
  const { state } = useApp()
  const [query, setQuery] = useState('')
  const [reimbursed, setReimbursed] = useState('all')
  const [invoice, setInvoice] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [detail, setDetail] = useState<PurchaseRecord | null>(null)
  const invoiceUrls = useMemo(() => {
    const urls = new Map<string, string>()
    if (typeof URL.createObjectURL === 'function') for (const invoice of state.invoices) urls.set(invoice.id, URL.createObjectURL(invoice.blob))
    return urls
  }, [state.invoices])
  useEffect(() => () => { for (const url of invoiceUrls.values()) URL.revokeObjectURL(url) }, [invoiceUrls])
  const records = useMemo(() => state.purchases.filter(record => {
    const needle = query.trim().toLowerCase()
    const haystack = [record.itemName, record.itemUrl, record.storageLink, record.notes].join(' ').toLowerCase()
    return (!needle || haystack.includes(needle)) && (reimbursed === 'all' || (reimbursed === 'reimbursed') === record.reimbursed) && (invoice === 'all' || record.invoiceStatus === invoice) && (!fromDate || record.purchasedAt >= fromDate) && (!toDate || record.purchasedAt <= toDate)
  }).sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt)), [state.purchases, query, reimbursed, invoice, fromDate, toDate])
  return <div className="page archive-page"><div className="page-intro"><div><p className="eyebrow">历史台账</p><h2>档案</h2><p className="muted">查看全部采购记录，包括已报销和待报销项目。</p></div><div className="summary-chip">共 <strong>{records.length}</strong> 条</div></div>
    <div className="filter-row"><label className="search-label">搜索采购记录<input aria-label="搜索档案" value={query} onChange={e => setQuery(e.target.value)} placeholder="按名称、链接或备注搜索" /></label><label>报销状态<select aria-label="档案报销状态" value={reimbursed} onChange={e => setReimbursed(e.target.value)}><option value="all">全部</option><option value="pending">待报销</option><option value="reimbursed">已报销</option></select></label><label>发票状态<select aria-label="档案发票状态" value={invoice} onChange={e => setInvoice(e.target.value)}><option value="all">全部</option><option value="missing">待补发票</option><option value="attached">已附发票</option><option value="matched">已匹配</option><option value="needs_review">需复核</option></select></label><label>起始日期<input aria-label="档案起始日期" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></label><label>结束日期<input aria-label="档案结束日期" type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></label></div>
    <section className="table-card"><div className="table-toolbar"><div><h2>采购档案</h2><span className="muted">已报销与未报销记录</span></div></div><div className="table-scroll"><table><thead><tr><th>商品</th><th>商品链接</th><th>网盘地址</th><th>日期</th><th>数量</th><th>单价</th><th>总价</th><th>报销状态</th><th>发票状态</th><th>发票文件</th><th>操作</th></tr></thead><tbody>{records.map(record => { const itemUrl = safeHttpUrl(record.itemUrl); const storageUrl = safeHttpUrl(record.storageLink); return <tr key={record.id}><td><strong>{record.itemName}</strong>{record.notes && <small>{record.notes}</small>}</td><td>{record.itemUrl ? itemUrl ? <a href={itemUrl} target="_blank" rel="noreferrer">{record.itemUrl}</a> : record.itemUrl : '—'}</td><td>{record.storageLink ? storageUrl ? <a href={storageUrl} target="_blank" rel="noreferrer">{record.storageLink}</a> : record.storageLink : '—'}</td><td>{record.purchasedAt}</td><td>{record.quantity}</td><td>{formatCNY(record.unitPriceCents)}</td><td><strong>{formatCNY(record.totalPriceCents)}</strong></td><td>{record.reimbursed ? `已报销${record.reimbursedAt ? ` · ${record.reimbursedAt.slice(0, 10)}` : ''}` : '待报销'}</td><td>{record.invoiceStatus}</td><td>{record.invoiceIds.length ? record.invoiceIds.map(id => { const inv = state.invoices.find(item => item.id === id); const url = invoiceUrls.get(id); return inv ? <span key={id}><span>{inv.fileName} · {inv.parseStatus}</span>{url && <><a href={url} target="_blank" rel="noreferrer">查看/预览</a><a href={url} download={inv.fileName}>下载</a></>}<br /></span> : null }) : '—'}</td><td>{onEditPurchase && <button className="link-button" onClick={() => onEditPurchase(record)}>编辑</button>}<button className="link-button" onClick={() => setDetail(record)}>详情</button></td></tr>})}</tbody></table></div>{!records.length && <div className="empty-state">暂无符合条件的档案。</div>}{detail && <div className="backup-preview" role="dialog" aria-label="采购详情"><h3>{detail.itemName}</h3><p>采购日期：{detail.purchasedAt} · 数量：{detail.quantity} · 总价：{formatCNY(detail.totalPriceCents)}</p><p>{detail.notes || '暂无备注'}</p><button className="button secondary" onClick={() => setDetail(null)}>关闭</button></div>}</section>
  </div>
}
