import { calculateMetrics } from '../domain/metrics'
import type { DashboardMetrics, InvoiceRecord, PurchaseRecord } from '../domain/types'

export interface AppState {
  purchases: PurchaseRecord[]
  invoices: InvoiceRecord[]
  metrics: DashboardMetrics
  loading: boolean
  persistenceError?: string
}

export const initialAppState: AppState = {
  purchases: [],
  invoices: [],
  metrics: calculateMetrics([]),
  loading: true,
}

export type AppAction =
  | { type: 'addPurchase'; purchase: PurchaseRecord }
  | { type: 'updatePurchase'; purchase: PurchaseRecord }
  | { type: 'setReimbursed'; ids: string[]; reimbursed: boolean }
  | { type: 'linkInvoice'; purchaseId: string; invoiceId: string }
  | { type: 'unlinkInvoice'; purchaseId: string; invoiceId: string }
  | { type: 'addInvoice'; invoice: InvoiceRecord }
  | { type: 'updateInvoice'; invoice: InvoiceRecord }
  | { type: 'confirmInvoiceMatch'; invoiceId: string; purchaseIds: string[] }
  | { type: 'removeInvoice'; id: string }
  | { type: 'removePurchase'; id: string }
  | { type: 'replaceAll'; purchases: PurchaseRecord[]; invoices: InvoiceRecord[] }
  | { type: 'setHydrated'; purchases: PurchaseRecord[]; invoices: InvoiceRecord[] }
  | { type: 'setPersistenceError'; error?: string }

function withDerived(state: Omit<AppState, 'metrics'> & { metrics?: DashboardMetrics }): AppState {
  return { ...state, metrics: calculateMetrics(state.purchases) }
}

function derivePurchaseInvoiceStatus(purchase: PurchaseRecord, invoices: InvoiceRecord[]): PurchaseRecord['invoiceStatus'] {
  if (purchase.invoiceIds.length === 0) return 'missing'
  const linked = purchase.invoiceIds
    .map((id) => invoices.find((invoice) => invoice.id === id))
    .filter((invoice): invoice is InvoiceRecord => Boolean(invoice))
  if (linked.some((invoice) => invoice.matchStatus === 'confirmed' && invoice.matchedPurchaseIds.includes(purchase.id))) return 'matched'
  // Keep a review marker while links remain unresolved. If records are not yet
  // available (legacy/in-memory state), preserve the existing stronger status.
  if (linked.length === 0 && purchase.invoiceStatus === 'matched') return 'matched'
  return purchase.invoiceStatus === 'needs_review' ? 'needs_review' : 'attached'
}

function deriveInvoiceMatchStatus(invoice: InvoiceRecord, matchedPurchaseIds: string[]): InvoiceRecord['matchStatus'] {
  if (matchedPurchaseIds.length > 0) return 'confirmed'
  return invoice.parseStatus === 'failed' || invoice.matchStatus === 'needs_review' ? 'needs_review' : 'unmatched'
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'addPurchase':
      return withDerived({ ...state, purchases: [...state.purchases, action.purchase], persistenceError: undefined })
    case 'updatePurchase':
      return withDerived({ ...state, purchases: state.purchases.map((p) => (p.id === action.purchase.id ? action.purchase : p)), persistenceError: undefined })
    case 'setReimbursed': {
      const timestamp = action.reimbursed ? new Date().toISOString() : undefined
      const ids = new Set(action.ids)
      return withDerived({
        ...state,
        purchases: state.purchases.map((purchase) =>
          ids.has(purchase.id)
            ? (() => {
                const { reimbursedAt: _removed, ...withoutTimestamp } = purchase
                return { ...withoutTimestamp, reimbursed: action.reimbursed, ...(timestamp ? { reimbursedAt: timestamp } : {}) }
              })()
            : purchase,
        ),
        persistenceError: undefined,
      })
    }
    case 'linkInvoice': {
      if (!state.purchases.some((purchase) => purchase.id === action.purchaseId) || !state.invoices.some((invoice) => invoice.id === action.invoiceId)) return state
      const invoices = state.invoices.map((invoice) => invoice.id === action.invoiceId
        ? { ...invoice, matchedPurchaseIds: invoice.matchedPurchaseIds.includes(action.purchaseId) ? invoice.matchedPurchaseIds : [...invoice.matchedPurchaseIds, action.purchaseId], matchStatus: 'confirmed' as const }
        : invoice)
      const purchases = state.purchases.map((purchase) => purchase.id === action.purchaseId
        ? { ...purchase, invoiceIds: purchase.invoiceIds.includes(action.invoiceId) ? purchase.invoiceIds : [...purchase.invoiceIds, action.invoiceId], invoiceStatus: 'matched' as const }
        : purchase)
      return withDerived({ ...state, purchases, invoices, persistenceError: undefined })
    }
    case 'unlinkInvoice': {
      const invoices = state.invoices.map((invoice) => invoice.id === action.invoiceId
        ? (() => {
            const matchedPurchaseIds = invoice.matchedPurchaseIds.filter((id) => id !== action.purchaseId)
            return { ...invoice, matchedPurchaseIds, matchStatus: deriveInvoiceMatchStatus(invoice, matchedPurchaseIds) }
          })()
        : invoice)
      const purchases = state.purchases.map((purchase) => {
        if (purchase.id !== action.purchaseId) return purchase
        const invoiceIds = purchase.invoiceIds.filter((id) => id !== action.invoiceId)
        const nextPurchase = { ...purchase, invoiceIds }
        return { ...nextPurchase, invoiceStatus: derivePurchaseInvoiceStatus(nextPurchase, invoices) }
      })
      return withDerived({ ...state, purchases, invoices, persistenceError: undefined })
    }
    case 'addInvoice':
      return { ...state, invoices: [...state.invoices, action.invoice], persistenceError: undefined }
    case 'updateInvoice':
      return { ...state, invoices: state.invoices.map((invoice) => invoice.id === action.invoice.id ? action.invoice : invoice), persistenceError: undefined }
    case 'confirmInvoiceMatch': {
      const ids = new Set(action.purchaseIds.filter((id) => state.purchases.some((purchase) => purchase.id === id)))
      const targetInvoice = state.invoices.find((invoice) => invoice.id === action.invoiceId)
      if (!targetInvoice) return state
      const selectedIds = [...ids]
      const invoices = state.invoices.map((invoice) => invoice.id === action.invoiceId
        ? { ...invoice, matchedPurchaseIds: selectedIds, matchStatus: deriveInvoiceMatchStatus(invoice, selectedIds) }
        : invoice)
      return withDerived({
        ...state,
        invoices,
        purchases: state.purchases.map((purchase) => {
          const invoiceIds = ids.has(purchase.id)
            ? purchase.invoiceIds.includes(action.invoiceId) ? purchase.invoiceIds : [...purchase.invoiceIds, action.invoiceId]
            : purchase.invoiceIds.filter((id) => id !== action.invoiceId)
          const nextPurchase = { ...purchase, invoiceIds }
          return { ...nextPurchase, invoiceStatus: derivePurchaseInvoiceStatus(nextPurchase, invoices) }
        }),
        persistenceError: undefined,
      })
    }
    case 'removeInvoice':
      return withDerived({
        ...state,
        invoices: state.invoices.filter((invoice) => invoice.id !== action.id),
        purchases: state.purchases.map((purchase) => {
          if (!purchase.invoiceIds.includes(action.id)) return purchase
          const invoiceIds = purchase.invoiceIds.filter((id) => id !== action.id)
          const nextPurchase = { ...purchase, invoiceIds }
          return { ...nextPurchase, invoiceStatus: derivePurchaseInvoiceStatus(nextPurchase, state.invoices.filter((invoice) => invoice.id !== action.id)) }
        }),
        persistenceError: undefined,
      })
    case 'removePurchase': {
      const purchases = state.purchases.filter((purchase) => purchase.id !== action.id)
      const invoices = state.invoices.map((invoice) => {
        const matchedPurchaseIds = invoice.matchedPurchaseIds.filter((id) => id !== action.id)
        return matchedPurchaseIds.length === invoice.matchedPurchaseIds.length
          ? invoice
          : { ...invoice, matchedPurchaseIds, matchStatus: deriveInvoiceMatchStatus(invoice, matchedPurchaseIds) }
      })
      return withDerived({ ...state, purchases, invoices, persistenceError: undefined })
    }
    case 'replaceAll':
    case 'setHydrated':
      return withDerived({ ...state, purchases: action.purchases, invoices: action.invoices, loading: false, persistenceError: undefined })
    case 'setPersistenceError':
      return { ...state, persistenceError: action.error }
    default:
      return state
  }
}
