import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '../../state/AppProvider'
import { SettingsPage } from '../SettingsPage'
import { BackupDialog } from '../../components/settings/BackupDialog'
import * as db from '../../storage/db'
import type { PurchaseRecord } from '../../domain/types'

const purchase: PurchaseRecord = {
  id: 'existing', purchasedAt: '2026-08-01', itemUrl: 'https://example.com', itemName: '已有记录', quantity: 1,
  unitPriceCents: 100, totalPriceCents: 100, storageLink: '', notes: '', reimbursed: false,
  invoiceStatus: 'missing', invoiceIds: ['invoice-existing'], createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.spyOn(db.purchaseRepo, 'list').mockResolvedValue([purchase])
  vi.spyOn(db.invoiceRepo, 'list').mockResolvedValue([])
  vi.spyOn(db, 'persistSnapshot').mockResolvedValue(undefined)
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('settings backup controls', () => {
  it('downloads a versioned JSON backup when export is clicked', async () => {
    const click = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click)
    render(<AppProvider><SettingsPage /></AppProvider>)
    await waitFor(() => expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '导出备份' }))
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled())
    const anchor = click.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toMatch(/^采购报销备份-\d{4}-\d{2}-\d{2}\.json$/)
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })

  it('shows import preview before replacement and requires explicit confirmation', async () => {
    render(<AppProvider><SettingsPage /></AppProvider>)
    await waitFor(() => expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument())
    const backup = { version: 1, exportedAt: '2026-08-12T00:00:00.000Z', purchases: [purchase], invoices: [] }
    const file = new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('导入备份文件'), { target: { files: [file] } })
    expect(await screen.findByText(/导入预览/)).toBeInTheDocument()
    expect(screen.getByText(/采购记录：1/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认覆盖导入' })).toBeInTheDocument()
    expect(db.persistSnapshot).not.toHaveBeenCalledWith(expect.objectContaining({ purchases: [purchase] }))
  })

  it('shows conflict count and handles restore rejection without staying busy', async () => {
    const onRestore = vi.fn().mockRejectedValue(new Error('network down'))
    render(<BackupDialog purchases={[purchase]} invoices={[]} onRestore={onRestore} onClear={vi.fn()} />)
    const backup = { version: 1, exportedAt: '2026-08-12T00:00:00.000Z', purchases: [purchase], invoices: [] }
    fireEvent.change(screen.getByLabelText('导入备份文件'), { target: { files: [new File([JSON.stringify(backup)], 'backup.json')] } })
    expect(await screen.findByText(/冲突：1/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认覆盖导入' }))
    expect(await screen.findByText(/恢复失败/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认覆盖导入' })).not.toBeDisabled()
  })
})
