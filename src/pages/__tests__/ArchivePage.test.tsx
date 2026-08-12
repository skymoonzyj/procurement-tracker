import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { ArchivePage } from '../ArchivePage'
import { AppProvider } from '../../state/AppProvider'
import * as db from '../../storage/db'

const record = { id: 'p1', purchasedAt: '2026-08-01', itemUrl: 'javascript:alert(1)', itemName: '设备', quantity: 1, unitPriceCents: 100, totalPriceCents: 100, storageLink: 'https://drive.example/file', notes: '', reimbursed: false, invoiceStatus: 'missing' as const, invoiceIds: [], createdAt: '2026-08-01', updatedAt: '2026-08-01' }

beforeEach(() => { vi.spyOn(db.purchaseRepo, 'list').mockResolvedValue([record]); vi.spyOn(db.invoiceRepo, 'list').mockResolvedValue([]) })
afterEach(() => vi.restoreAllMocks())

describe('archive columns and links', () => {
  it('shows storage link separately and renders unsafe item URL as text', async () => {
    render(<AppProvider><ArchivePage /></AppProvider>)
    await waitFor(() => expect(screen.getByRole('heading', { name: '档案' })).toBeInTheDocument())
    expect(screen.getByText('https://drive.example/file')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '商品链接' })).not.toBeInTheDocument()
  })
})
