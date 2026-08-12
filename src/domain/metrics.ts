import { dateSpanDays } from './date'
import type { DashboardMetrics, PurchaseRecord } from './types'

export function calculateMetrics(records: PurchaseRecord[]): DashboardMetrics {
  const allTotalCents = records.reduce((sum, r) => sum + r.totalPriceCents, 0)
  const reimbursedTotalCents = records.filter(r => r.reimbursed).reduce((sum, r) => sum + r.totalPriceCents, 0)
  const pending = records.filter(r => !r.reimbursed)
  const pendingTotalCents = pending.reduce((sum, r) => sum + r.totalPriceCents, 0)
  const pendingInvoiceCount = pending.filter(r => r.invoiceStatus === 'missing').length
  let pendingDateSpanDays = 0
  let pendingDateSpanLabel = '暂无未报销记录'
  if (pending.length) {
    const dates = pending.map(r => r.purchasedAt).sort()
    pendingDateSpanDays = dateSpanDays(dates[0], dates[dates.length - 1])
    pendingDateSpanLabel = pendingDateSpanDays === 0 ? '当天' : `${pendingDateSpanDays}天`
  }
  return { allTotalCents, reimbursedTotalCents, pendingTotalCents, pendingCount: pending.length, pendingInvoiceCount, pendingDateSpanDays, pendingDateSpanLabel }
}
