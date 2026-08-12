import { BackupDialog } from '../components/settings/BackupDialog'
import { useApp } from '../state/AppProvider'
import type { RestorePreview } from '../storage/backup'

export function SettingsPage() {
  const { state, dispatch } = useApp()
  const restore = async (preview: RestorePreview) => {
    const purchases = preview.mode === 'replace'
      ? preview.purchases
      : [...state.purchases.filter(item => !preview.purchases.some(next => next.id === item.id)), ...preview.purchases]
    const invoices = preview.mode === 'replace'
      ? preview.invoices
      : [...state.invoices.filter(item => !preview.invoices.some(next => next.id === item.id)), ...preview.invoices]
    return dispatch({ type: 'replaceAll', purchases, invoices })
  }
  const clear = () => dispatch({ type: 'replaceAll', purchases: [], invoices: [] })
  return <div className="page settings-page"><div className="page-intro"><div><p className="eyebrow">本机设置</p><h2>设置</h2><p className="muted">管理数据备份、恢复和本机存储。</p></div></div><BackupDialog purchases={state.purchases} invoices={state.invoices} onRestore={restore} onClear={clear} /></div>
}
