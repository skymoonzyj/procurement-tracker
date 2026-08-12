import type { InvoiceRecord, PurchaseRecord } from '../domain/types'

export interface BackupInvoice extends Omit<InvoiceRecord, 'blob'> {
  blobBase64: string
}

export interface BackupFile {
  version: 1
  exportedAt: string
  purchases: PurchaseRecord[]
  invoices: BackupInvoice[]
}

export interface RestorePreview {
  mode: 'merge' | 'replace'
  purchases: PurchaseRecord[]
  invoices: InvoiceRecord[]
  purchaseCount: number
  invoiceCount: number
}

type BackupState = { purchases: PurchaseRecord[]; invoices: InvoiceRecord[] }

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export async function serializeBackup(state: BackupState): Promise<BackupFile> {
  const invoices = await Promise.all(
    state.invoices.map(async ({ blob, ...invoice }) => ({
      ...invoice,
      blobBase64: bytesToBase64(new Uint8Array(await blob.arrayBuffer())),
    })),
  )
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    purchases: state.purchases.map((purchase) => ({ ...purchase, invoiceIds: [...purchase.invoiceIds] })),
    invoices,
  }
}

function assertBackup(value: unknown): asserts value is BackupFile {
  if (!value || typeof value !== 'object') throw new Error('Invalid backup')
  const backup = value as Partial<BackupFile>
  if (backup.version !== 1) throw new Error('Unsupported backup version')
  if (!Array.isArray(backup.purchases) || !Array.isArray(backup.invoices)) throw new Error('Invalid backup arrays')
}

export async function restoreBackup(file: BackupFile | unknown, mode: 'merge' | 'replace' = 'replace'): Promise<RestorePreview> {
  assertBackup(file)
  const invoices = await Promise.all(
    file.invoices.map(async (invoice) => {
      const { blobBase64, ...metadata } = invoice
      const blob = new Blob([base64ToBytes(blobBase64).buffer as ArrayBuffer], { type: metadata.mimeType })
      return { ...metadata, blob, sizeBytes: metadata.sizeBytes ?? blob.size } as InvoiceRecord
    }),
  )
  const purchases = file.purchases.map((purchase) => ({ ...purchase, invoiceIds: [...purchase.invoiceIds] }))
  return { mode, purchases, invoices, purchaseCount: purchases.length, invoiceCount: invoices.length }
}
