import type { InvoiceStatus } from '../../domain/types'
export function StatusBadge({ reimbursed, invoiceStatus }: { reimbursed?: boolean; invoiceStatus?: InvoiceStatus }) {
  if (reimbursed) return <span className="status-badge reimbursed">已报销</span>
  if (invoiceStatus === 'missing') return <span className="status-badge missing">待补发票</span>
  return <span className="status-badge pending">待报销</span>
}
