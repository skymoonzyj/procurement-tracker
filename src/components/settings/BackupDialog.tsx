import { useRef, useState } from 'react'
import { restoreBackup, serializeBackup, type RestorePreview } from '../../storage/backup'
import type { InvoiceRecord, PurchaseRecord } from '../../domain/types'

interface BackupDialogProps {
  purchases: PurchaseRecord[]
  invoices: InvoiceRecord[]
  onRestore: (preview: RestorePreview) => Promise<boolean>
  onClear: () => Promise<boolean>
}

export function BackupDialog({ purchases, invoices, onRestore, onClear }: BackupDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<RestorePreview | null>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('replace')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [clearText, setClearText] = useState('')
  const [busy, setBusy] = useState(false)

  const exportBackup = async () => {
    setError(''); setMessage('')
    let url: string | undefined
    try {
      const backup = await serializeBackup({ purchases, invoices })
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `采购报销备份-${new Date().toISOString().slice(0, 10)}.json`
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setMessage('备份已导出')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (url) URL.revokeObjectURL(url)
    }
  }

  const importFile = async (file: File) => {
    setError(''); setMessage(''); setPreview(null)
    try {
      const parsed = JSON.parse(await file.text())
      const restored = await restoreBackup(parsed, mode)
      const conflictCount = restored.purchases.filter(item => purchases.some(current => current.id === item.id)).length + restored.invoices.filter(item => invoices.some(current => current.id === item.id)).length
      setPreview({ ...restored, conflictCount })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '备份文件无效')
    }
  }

  const confirmRestore = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const ok = await onRestore({ ...preview, mode })
      if (ok) { setMessage(mode === 'replace' ? '已覆盖导入备份' : '已合并导入备份'); setPreview(null); if (inputRef.current) inputRef.current.value = '' }
      else setError('导入保存失败，请重试')
    } catch (cause) {
      setError(`恢复失败：${cause instanceof Error ? cause.message : '未知错误'}，请重试`)
    } finally { setBusy(false) }
  }

  const handleModeChange = async (value: 'merge' | 'replace') => {
    setMode(value)
    if (!preview) return
    setPreview({ ...preview, mode: value })
  }

  const clearData = async () => {
    if (clearText !== '清空本机数据') { setError('请输入“清空本机数据”以确认'); return }
    setBusy(true)
    try {
      if (await onClear()) { setMessage('本机数据已清空；已导出的备份仍可恢复'); setClearText('') }
      else setError('清空失败，请重试')
    } finally { setBusy(false) }
  }

  return <section className="settings-card">
    <div className="settings-block"><h2>备份与恢复</h2><p className="muted">导出全部采购和发票数据，或从 JSON 备份恢复。</p>
      <div className="settings-actions"><button className="button primary" onClick={() => void exportBackup()}>导出备份</button><label className="button secondary file-button">导入备份<input ref={inputRef} aria-label="导入备份文件" type="file" accept="application/json,.json" onChange={e => { const file = e.target.files?.[0]; if (file) void importFile(file) }} /></label></div>
      {preview && <div className="backup-preview" role="dialog" aria-label="导入预览"><h3>导入预览</h3><p>采购记录：{preview.purchaseCount} · 发票：{preview.invoiceCount} · 冲突：{preview.conflictCount}</p><label>导入方式<select aria-label="导入方式" value={mode} onChange={e => void handleModeChange(e.target.value as 'merge' | 'replace')}><option value="replace">覆盖现有数据</option><option value="merge">合并（同 ID 覆盖）</option></select></label><div><button className="button primary" disabled={busy} onClick={() => void confirmRestore()}>{mode === 'replace' ? '确认覆盖导入' : '确认合并导入'}</button><button className="button secondary" onClick={() => setPreview(null)}>取消</button></div></div>}
      {error && <p className="field-error" role="alert">{error}</p>}{message && <p className="muted" role="status">{message}</p>}
    </div>
    <div className="settings-block danger-zone"><h2>清空本机数据</h2><p className="muted">此操作会删除浏览器中的采购和发票记录。已导出的备份文件仍可恢复。</p><label>请输入“清空本机数据”<input aria-label="清空本机数据确认" value={clearText} onChange={e => setClearText(e.target.value)} /></label><button className="button secondary" disabled={busy || clearText !== '清空本机数据'} onClick={() => void clearData}>清空本机数据</button></div>
  </section>
}
