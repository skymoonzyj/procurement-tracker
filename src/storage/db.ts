import type { InvoiceRecord, PurchaseRecord } from '../domain/types'

const DB_NAME = 'procurement-reimbursement-tracker'
const DB_VERSION = 1
let dbPromise: Promise<IDBDatabase> | undefined
let writeQueue: Promise<unknown> = Promise.resolve()

export function openAppDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('purchases')) db.createObjectStore('purchases', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('invoices')) db.createObjectStore('invoices', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
  })
  let retryable: Promise<IDBDatabase>
  retryable = opening.catch((error: unknown) => {
    if (dbPromise === retryable) dbPromise = undefined
    throw error
  })
  dbPromise = retryable
  return dbPromise
}

function readRequest<T>(storeName: string, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openAppDb().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const request = operation(tx.objectStore(storeName))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
  }))
}

function writeRequest<T>(storeName: string, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const run = writeQueue.then(() => openAppDb()).then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const request = operation(tx.objectStore(storeName))
    let result: T
    request.onsuccess = () => { result = request.result }
    request.onerror = () => reject(request.error ?? new Error('IndexedDB write failed'))
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  }))
  writeQueue = run.catch(() => undefined)
  return run
}

/** Persist a complete application snapshot in one serialized, atomic transaction. */
export function persistSnapshot(state: { purchases: PurchaseRecord[]; invoices: InvoiceRecord[] }): Promise<void> {
  const run = writeQueue.then(() => openAppDb()).then((db) => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['purchases', 'invoices'], 'readwrite')
    const purchases = tx.objectStore('purchases')
    const invoices = tx.objectStore('invoices')
    purchases.clear()
    invoices.clear()
    for (const purchase of state.purchases) purchases.put(purchase)
    for (const invoice of state.invoices) invoices.put(invoice)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB snapshot transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB snapshot transaction aborted'))
  }))
  writeQueue = run.catch(() => undefined)
  return run
}

export const purchaseRepo = {
  list: () => readRequest<PurchaseRecord[]>('purchases', (store) => store.getAll()),
  put: (record: PurchaseRecord) => writeRequest('purchases', (store) => store.put(record)),
  putMany: async (records: PurchaseRecord[]) => {
    for (const record of records) await purchaseRepo.put(record)
  },
  remove: (id: string) => writeRequest('purchases', (store) => store.delete(id)),
  clear: () => writeRequest('purchases', (store) => store.clear()),
}

export const invoiceRepo = {
  list: () => readRequest<InvoiceRecord[]>('invoices', (store) => store.getAll()),
  put: (invoice: InvoiceRecord) => writeRequest('invoices', (store) => store.put(invoice)),
  getBlob: async (id: string) => (await readRequest<InvoiceRecord | undefined>('invoices', (store) => store.get(id)))?.blob,
  remove: (id: string) => writeRequest('invoices', (store) => store.delete(id)),
  clear: () => writeRequest('invoices', (store) => store.clear()),
}

export function resetAppDbForTests(): void {
  dbPromise = undefined
  writeQueue = Promise.resolve()
}
