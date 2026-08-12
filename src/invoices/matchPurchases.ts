import type { PurchaseRecord } from '../domain/types'
import type { InvoiceFields } from './parseInvoice'

export type MatchConfidence = 'high' | 'review' | 'none'

export interface MatchSuggestion {
  purchaseId: string
  score: number
  reasons: string[]
  confidence: MatchConfidence
}

const tokenize = (value: string | null | undefined): string[] => {
  if (!value) return []
  const normalized = value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  if (!normalized) return []
  const tokens: string[] = []
  for (const part of normalized.split(/\s+/)) {
    if (/^[\p{Script=Han}]+$/u.test(part)) tokens.push(...Array.from(part))
    else tokens.push(part)
  }
  return [...new Set(tokens)]
}

const itemSimilarity = (a: string | null, b: string): number => {
  const left = tokenize(a)
  const right = tokenize(b)
  if (!left.length || !right.length) return 0
  const rightSet = new Set(right)
  const overlap = left.filter((token) => rightSet.has(token)).length
  return overlap / Math.max(left.length, right.length)
}

const amountSimilarity = (a: number | null, b: number): number => {
  if (a == null || !Number.isFinite(a) || !Number.isFinite(b)) return 0
  const denominator = Math.max(Math.abs(a), Math.abs(b), 1)
  return Math.max(0, 1 - Math.abs(a - b) / denominator)
}

const dateSimilarity = (a: string | null, b: string): number => {
  if (!a || !b) return 0
  const left = Date.parse(a)
  const right = Date.parse(b)
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0
  const days = Math.abs(left - right) / 86_400_000
  return Math.max(0, 1 - days / 30)
}

export function rankPurchaseMatches(invoice: InvoiceFields, records: PurchaseRecord[]): MatchSuggestion[] {
  return records
    .filter((record) => !record.reimbursed)
    .map((record) => {
      const item = itemSimilarity(invoice.itemName, record.itemName)
      const amount = amountSimilarity(invoice.totalAmountCents, record.totalPriceCents)
      const date = dateSimilarity(invoice.issueDate, record.purchasedAt)
      const score = Number((item * 0.6 + amount * 0.3 + date * 0.1).toFixed(4))
      const reasons: string[] = []
      if (item > 0) reasons.push(`商品名称匹配 ${(item * 100).toFixed(0)}%`)
      if (amount > 0) reasons.push(invoice.totalAmountCents === record.totalPriceCents ? '金额完全一致' : `金额接近 ${(amount * 100).toFixed(0)}%`)
      if (date > 0) reasons.push(date === 1 ? '日期一致' : `日期相差 ${Math.round((1 - date) * 30)} 天`)
      if (!reasons.length) reasons.push('缺少可匹配字段')
      const confidence: MatchConfidence = score >= 0.8 ? 'high' : score >= 0.45 ? 'review' : 'none'
      return { purchaseId: record.id, score, reasons, confidence }
    })
    .sort((a, b) => b.score - a.score)
}
