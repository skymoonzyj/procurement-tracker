export type InvoiceStatus = 'missing' | 'attached' | 'matched' | 'needs_review'

export interface PurchaseRecord {
  id: string
  purchasedAt: string
  itemUrl: string
  itemName: string
  quantity: number
  unitPriceCents: number
  totalPriceCents: number
  storageLink: string
  notes: string
  reimbursed: boolean
  reimbursedAt?: string
  invoiceStatus: InvoiceStatus
  invoiceIds: string[]
  createdAt: string
  updatedAt: string
}

export interface InvoiceRecord {
  id: string
  fileName: string
  mimeType: 'application/pdf'
  sizeBytes: number
  blob: Blob
  uploadedAt: string
  issueDate?: string
  invoiceNumber?: string
  vendorName?: string
  totalAmountCents?: number
  rawText: string
  parseStatus: 'parsed' | 'empty' | 'failed'
  matchStatus: 'unmatched' | 'suggested' | 'confirmed' | 'needs_review'
  matchedPurchaseIds: string[]
}

export interface PurchaseInput {
  purchasedAt: string
  itemName: string
  quantity: number | string
  unitPriceCents: number | string
  itemUrl?: string
  storageLink?: string
  notes?: string
}

export interface DashboardMetrics {
  allTotalCents: number
  reimbursedTotalCents: number
  pendingTotalCents: number
  pendingCount: number
  pendingInvoiceCount: number
  pendingDateSpanDays: number
  pendingDateSpanLabel: string
}
