interface SidebarProps { activePage: 'overview' | 'purchases' | 'invoices'; onNavigate: (page: 'overview' | 'purchases' | 'invoices') => void }
export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return <aside className="sidebar" aria-label="主导航">
    <div className="brand"><span className="brand-mark">账</span><h1>采购报销台账</h1></div>
    <nav>
      <button className={activePage === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate('overview')}>概览</button>
      <button className={activePage === 'purchases' ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate('purchases')}>采购记录</button>
      <button className={activePage === 'invoices' ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate('invoices')}>发票中心</button>
    </nav>
  </aside>
}
