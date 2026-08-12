interface SidebarProps { activePage: 'overview' | 'purchases'; onNavigate: (page: 'overview' | 'purchases') => void }
export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return <aside className="sidebar" aria-label="主导航">
    <div className="brand"><span className="brand-mark">账</span><h1>采购报销台账</h1></div>
    <nav>
      <button className={activePage === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate('overview')}>概览</button>
      <button className={activePage === 'purchases' ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate('purchases')}>采购记录</button>
    </nav>
  </aside>
}
