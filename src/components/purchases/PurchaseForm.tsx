import { useEffect, useState } from 'react'
import type { PurchaseInput } from '../../domain/types'
import { calculateTotalCents, formatCNY, toCents } from '../../domain/money'
import { validatePurchaseInput } from '../../domain/validation'

interface PurchaseFormProps { initialValue?: PurchaseInput; onSubmit: (input: PurchaseInput) => Promise<boolean>; onCancel?: () => void }
const blank: PurchaseInput = { purchasedAt: new Date().toISOString().slice(0, 10), itemName: '', quantity: '1', unitPriceCents: '', itemUrl: '', storageLink: '', notes: '' }
export function PurchaseForm({ initialValue, onSubmit, onCancel }: PurchaseFormProps) {
  const [value, setValue] = useState<PurchaseInput>(initialValue ?? blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setValue(initialValue ?? blank); setErrors({}); setFormError('') }, [initialValue])
  const update = (key: keyof PurchaseInput, next: string) => { setFormError(''); setValue(prev => ({ ...prev, [key]: next })) }
  const quantity = Number(value.quantity)
  let preview = 0
  try {
    const cents = typeof value.unitPriceCents === 'string' && value.unitPriceCents.trim() ? toCents(value.unitPriceCents) : Number(value.unitPriceCents)
    if (Number.isFinite(quantity) && quantity > 0 && Number.isFinite(cents)) preview = calculateTotalCents(quantity, cents)
  } catch { preview = 0 }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    let next: PurchaseInput = { ...value }
    if (typeof value.unitPriceCents === 'string' && value.unitPriceCents.trim()) {
      try { next = { ...value, unitPriceCents: toCents(value.unitPriceCents) } } catch { setErrors({ unitPriceCents: '单价不能为负数' }); return }
    }
    const validation = validatePurchaseInput(next)
    if (Object.keys(validation).length) { setErrors(validation); return }
    setSaving(true)
    setFormError('')
    try {
      const ok = await onSubmit(next)
      if (!ok) { setFormError('保存失败，请重试'); return }
      setValue(blank); setErrors({})
    } catch (cause) {
      setFormError(`保存失败：${cause instanceof Error ? cause.message : '未知错误'}，请重试`)
    } finally { setSaving(false) }
  }
  return <form className="purchase-form" onSubmit={submit} noValidate>
    <div className="form-grid">
      <label>商品名称<input aria-label="商品名称" value={value.itemName} onChange={e => update('itemName', e.target.value)} />{errors.itemName && <small className="field-error">{errors.itemName}</small>}</label>
      <label>采购日期<input type="date" aria-label="采购日期" value={value.purchasedAt} onChange={e => update('purchasedAt', e.target.value)} />{errors.purchasedAt && <small className="field-error">{errors.purchasedAt}</small>}</label>
      <label>数量<input type="number" min="0" step="0.01" aria-label="数量" value={value.quantity} onChange={e => update('quantity', e.target.value)} />{errors.quantity && <small className="field-error">{errors.quantity}</small>}</label>
      <label>单价（元）<input inputMode="decimal" aria-label="单价（元）" value={value.unitPriceCents} onChange={e => update('unitPriceCents', e.target.value)} />{errors.unitPriceCents && <small className="field-error">{errors.unitPriceCents}</small>}</label>
      <label>商品链接<input type="url" value={value.itemUrl ?? ''} onChange={e => update('itemUrl', e.target.value)} placeholder="可选" /></label>
      <label>存储链接<input type="url" value={value.storageLink ?? ''} onChange={e => update('storageLink', e.target.value)} placeholder="可选" /></label>
      <label className="wide">备注<textarea value={value.notes ?? ''} onChange={e => update('notes', e.target.value)} /></label>
    </div>
    {formError && <p className="field-error" role="alert">{formError}</p>}
    <div className="form-footer"><span className="total-preview">总价预览 <strong>{formatCNY(preview)}</strong></span><div><button type="button" className="button secondary" onClick={onCancel}>取消</button><button className="button primary" disabled={saving}>{saving ? '保存中…' : '保存采购记录'}</button></div></div>
  </form>
}
