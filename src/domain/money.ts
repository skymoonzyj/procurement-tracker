function parseDecimal(value: string | number): { whole: string; fraction: string } {
  const text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : value.trim()
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error('金额格式无效')
  const [whole, fraction = ''] = text.split('.')
  return { whole, fraction }
}

export function toCents(value: string | number): number {
  const { whole, fraction } = parseDecimal(value)
  const normalized = fraction.padEnd(3, '0')
  let cents = Number(whole) * 100 + Number(normalized.slice(0, 2))
  if (Number(normalized[2]) >= 5) cents += 1
  if (!Number.isSafeInteger(cents)) throw new Error('金额超出范围')
  return cents
}

export function formatCNY(cents: number): string {
  if (!Number.isFinite(cents) || !Number.isInteger(cents)) throw new Error('金额必须为整数分')
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(Math.trunc(cents))
  return `¥${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`
}

export function calculateTotalCents(quantity: number, unitPriceCents: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPriceCents)) throw new Error('金额无效')
  return Math.round(quantity * unitPriceCents)
}
