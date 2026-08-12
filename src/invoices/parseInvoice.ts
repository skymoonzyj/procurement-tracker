export type InvoiceParseStatus = 'parsed' | 'empty' | 'failed'

export interface InvoiceFields {
  itemName: string | null
  issueDate: string | null
  invoiceNumber: string | null
  vendorName: string | null
  totalAmountCents: number | null
  rawText: string
  parseStatus: InvoiceParseStatus
  needsReview: boolean
  /** Optional workflow hint for consumers that map fields directly to InvoiceRecord. */
  matchStatus?: 'unmatched' | 'needs_review'
}

const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim()

const INLINE_LABELS = [
  '货物或应税劳务、服务名称',
  '货物或应税劳务服务名称',
  '销售方名称',
  '开票日期',
  '发票号码',
  '购买商品',
  '项目名称',
  '商品名称',
  '销方名称',
  '开票日',
  '销售方',
  '发票号',
  '价税合计',
  '日期',
  '金额',
  '合计',
]

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const valueAfterLabel = (lines: string[], labels: string[]) => {
  for (const line of lines) {
    for (const label of labels) {
      const marker = line.match(new RegExp(`${escapeRegExp(label)}\\s*[:：]?\\s*`, 'i'))
      if (!marker || marker.index == null) continue
      const start = marker.index + marker[0].length
      const rest = line.slice(start)
      const nextLabel = new RegExp(`\\s+(?:${INLINE_LABELS.sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})\\s*[:：]?`, 'i').exec(rest)
      const value = rest.slice(0, nextLabel?.index ?? rest.length).trim()
      if (value) return value
    }
  }
  return null
}

const parseAmountCents = (text: string): number | null => {
  const normalized = normalize(text)
  const amountAfter = (labelPattern: string) => {
    const match = normalized.match(new RegExp(`${labelPattern}\\s*[:：]?\\s*[¥￥]?\\s*([\\d,]+(?:\\.\\d{1,2})?)`, 'i'))
    if (!match) return null
    const numeric = Number(match[1].replace(/,/g, ''))
    return Number.isFinite(numeric) ? Math.round(numeric * 100) : null
  }
  // Prefer the invoice total, even when line-item 金额 appears first.
  return amountAfter('价税合计(?:\\s*\\(小写\\))?') ?? amountAfter('金额') ?? amountAfter('合计')
}

const parseDate = (text: string): string | null => {
  const value = valueAfterLabel(text.split(/\r?\n/).map(normalize), ['开票日期', '开票日', '日期'])
  const match = (value ?? normalize(text)).match(/(20\d{2})[年./-](\d{1,2})[月./-](\d{1,2})日?/)
  if (!match) return null
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

export function parseInvoiceText(rawText: string): InvoiceFields {
  const original = rawText ?? ''
  if (!original.trim()) {
    return {
      itemName: null,
      issueDate: null,
      invoiceNumber: null,
      vendorName: null,
      totalAmountCents: null,
      rawText: original,
      parseStatus: 'empty',
      needsReview: true,
      matchStatus: 'needs_review',
    }
  }

  const lines = original.split(/\r?\n/).map(normalize).filter(Boolean)
  const normalizedText = normalize(original)
  const labeledItem = valueAfterLabel(lines, ['货物或应税劳务、服务名称', '货物或应税劳务服务名称', '项目名称', '购买商品', '商品名称'])
  // Many exported text PDFs omit the item label but place the description directly
  // above the total. Preserve that useful signal as a conservative fallback.
  const amountLineIndex = lines.findIndex((line) => /价税合计|金额|合计/.test(line))
  const precedingLine = amountLineIndex > 0 ? lines[amountLineIndex - 1] : null
  const inlineItem = amountLineIndex >= 0
    ? lines[amountLineIndex].split(/价税合计|金额|合计/)[0].replace(/^[：:\s]+/, '').trim()
    : ''
  const itemName = labeledItem
    ?? (precedingLine && !/发票|销售方|开票日期|号码|金额|合计/.test(precedingLine) ? precedingLine : null)
    ?? (inlineItem && !/发票|销售方|开票日期|号码/.test(inlineItem) ? inlineItem : null)
  const vendorName = valueAfterLabel(lines, ['销售方名称', '销售方', '销方名称'])
  const invoiceNumber = valueAfterLabel(lines, ['发票号码', '发票号'])?.match(/[A-Za-z0-9-]{3,}/)?.[0] ?? null
  const issueDate = parseDate(original)

  return {
    itemName,
    issueDate,
    invoiceNumber,
    vendorName,
    totalAmountCents: parseAmountCents(normalizedText),
    rawText: original,
    parseStatus: 'parsed',
    needsReview: !itemName || !issueDate || !vendorName || !invoiceNumber || parseAmountCents(normalizedText) == null,
    matchStatus: !itemName || !issueDate || !vendorName || !invoiceNumber || parseAmountCents(normalizedText) == null ? 'needs_review' : 'unmatched',
  }
}
