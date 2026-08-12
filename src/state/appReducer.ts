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
  | { type: 'replaceAll'; purchases: PurchaseRecord[]; invoices: InvoiceRecord[] }
  | { type: 'setHydrated'; purchases: PurchaseRecord[]; invoices: InvoiceRecord[] }
  | { type: 'setPersistenceError'; error?: string }

function withDerived(state: Omit<AppState, 'metrics'> & { metrics?: DashboardMetrics }): AppState {
  return { ...state, metrics: calculateMetrics(state.purchases) }
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
    case 'linkInvoice':
      return withDerived({
        ...state,
        purchases: state.purchases.map((purchase) => purchase.id === action.purchaseId
          ? { ...purchase, invoiceIds: purchase.invoiceIds.includes(action.invoiceId) ? purchase.invoiceIds : [...purchase.invoiceIds, action.invoiceId], invoiceStatus: 'attached' }
          : purchase),
        invoices: state.invoices.map((invoice) => invoice.id === action.invoiceId
          ? { ...invoice, matchedPurchaseIds: invoice.matchedPurchaseIds.includes(action.purchaseId) ? invoice.matchedPurchaseIds : [...invoice.matchedPurchaseIds, action.purchaseId], matchStatus: 'confirmed' }
          : invoice),
        persistenceError: undefined,
      })
    case 'unlinkInvoice':
      return withDerived({
        ...state,
        purchases: state.purchases.map((purchase) => purchase.id === action.purchaseId
          ? { ...purchase, invoiceIds: purchase.invoiceIds.filter((id) => id !== action.invoiceId), invoiceStatus: purchase.invoiceIds.length <= 1 ? 'missing' : purchase.invoiceStatus }
          : purchase),
        invoices: state.invoices.map((invoice) => invoice.id === action.invoiceId
          ? { ...invoice, matchedPurchaseIds: invoice.matchedPurchaseIds.filter((id) => id !== action.purchaseId), matchStatus: invoice.matchedPurchaseIds.length <= 1 ? 'unmatched' : invoice.matchStatus }
          : invoice),
        persistenceError: undefined,
      })
    case 'addInvoice':
      return { ...state, invoices: [...state.invoices, action.invoice], persistenceError: undefined }
    case 'updateInvoice':
      return { ...state, invoices: state.invoices.map((invoice) => invoice.id === action.invoice.id ? action.invoice : invoice), persistenceError: undefined }
    case 'confirmInvoiceMatch': {
      const ids = new Set(action.purchaseIds)
      return withDerived({
        ...state,
        invoices: state.invoices.map((invoice) => invoice.id === action.invoiceId
          ? { ...invoice, matchedPurchaseIds: action.purchaseIds, matchStatus: 'confirmed' }
          : invoice),
        purchases: state.purchases.map((purchase) => {
          if (ids.has(purchase.id)) {
            return { ...purchase, invoiceIds: purchase.invoiceIds.includes(action.invoiceId) ? purchase.invoiceIds : [...purchase.invoiceIds, action.invoiceId], invoiceStatus: 'matched' }
          }
          if (!purchase.invoiceIds.includes(action.invoiceId)) return purchase
          const invoiceIds = purchase.invoiceIds.filter((id) => id !== action.invoiceId)
          const hasConfirmedRemaining = invoiceIds.some((invoiceId) => state.invoices.find((invoice) => invoice.id === invoiceId)?.matchStatus === 'confirmed')
          return { ...purchase, invoiceIds, invoiceStatus: invoiceIds.length === 0 ? 'missing' : hasConfirmedRemaining ? 'matched' : 'attached' }
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
          const invoiceStatus = invoiceIds.length === 0
            ? 'missing'
            : purchase.invoiceStatus === 'missing'
              ? 'attached'
              : purchase.invoiceStatus
          return { ...purchase, invoiceIds, invoiceStatus }
        }),
        persistenceError: undefined,
      })
    case 'replaceAll':
    case 'setHydrated':
      return withDerived({ ...state, purchases: action.purchases, invoices: action.invoices, loading: false, persistenceError: undefined })
    case 'setPersistenceError':
      return { ...state, persistenceError: action.error }
    default:
      return state
  }
}
