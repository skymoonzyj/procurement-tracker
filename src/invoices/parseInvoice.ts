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

const valueAfterLabel = (lines: string[], labels: string[]) => {
  for (const line of lines) {
    for (const label of labels) {
      const match = line.match(new RegExp(`${label}\\s*[:：]?\\s*(.+)$`, 'i'))
      if (match?.[1]) return match[1].trim()
    }
  }
  return null
}

const parseAmountCents = (text: string): number | null => {
  const normalized = normalize(text)
  const match = normalized.match(/(?:价税合计|价税合计\(小写\)|金额|合计)\s*[:：]?\s*[¥￥]?\s*([\d,]+(?:\.\d{1,2})?)/i)
  if (!match) return null
  const numeric = Number(match[1].replace(/,/g, ''))
  if (!Number.isFinite(numeric)) return null
  return Math.round(numeric * 100)
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
