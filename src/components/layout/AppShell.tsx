import { useState } from 'react'
import type { PurchaseRecord } from '../../domain/types'
import { Sidebar } from './Sidebar'
import { Toast } from '../common/Toast'
import { OverviewPage } from '../../pages/OverviewPage'
import { PurchasesPage } from '../../pages/PurchasesPage'
export function AppShell() {
  const [activePage, setActivePage] = useState<'overview' | 'purchases'>('purchases')
  const [pendingEdit, setPendingEdit] = useState<PurchaseRecord | undefined>()
  const [menuOpen, setMenuOpen] = useState(false)
  return <div className="app-shell">
    <button className="mobile-menu" aria-label="打开导航" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
    <div className={menuOpen ? 'sidebar-wrap open' : 'sidebar-wrap'}><Sidebar activePage={activePage} onNavigate={(page) => { setPendingEdit(undefined); setActivePage(page); setMenuOpen(false) }} /></div>
    <main className="main-content">
      <header className="topbar"><div><p className="eyebrow">采购与报销管理</p><h1>{activePage === 'overview' ? '概览' : '采购记录'}</h1></div><span className="topbar-date">{new Date().toLocaleDateString('zh-CN')}</span></header>
      {activePage === 'overview' ? <OverviewPage onEditPurchase={(record) => { setPendingEdit(record); setActivePage('purchases') }} /> : <PurchasesPage initialEdit={pendingEdit} onEditStateChange={(editing) => { if (!editing) setPendingEdit(undefined) }} onNavigateOverview={() => { setPendingEdit(undefined); setActivePage('overview') }} />}
    </main>
    <Toast />
  </div>
}
