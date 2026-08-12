import { describe, expect, it } from 'vitest'
import { parseInvoiceText } from '../parseInvoice'

describe('parseInvoiceText', () => {
  it('extracts total amount and common invoice labels', () => {
    const raw = `
      购买商品：无线键盘
      开票日期：2026-08-10
      发票号码：12345678
      销售方：深圳办公用品有限公司
      价税合计 246.80
    `

    const result = parseInvoiceText(raw)

    expect(result.totalAmountCents).toBe(24680)
    expect(result.issueDate).toBe('2026-08-10')
    expect(result.invoiceNumber).toBe('12345678')
    expect(result.vendorName).toContain('深圳办公用品')
    expect(result.itemName).toContain('无线键盘')
    expect(result.parseStatus).toBe('parsed')
  })

  it('marks empty text for manual review without throwing', () => {
    const result = parseInvoiceText('   ')

    expect(result.parseStatus).toBe('empty')
    expect(result.needsReview).toBe(true)
    expect(result.totalAmountCents).toBeNull()
  })

  it('keeps an unlabeled item placed before the total on the same line', () => {
    const result = parseInvoiceText('无线键盘 价税合计 246.80')

    expect(result.itemName).toBe('无线键盘')
    expect(result.totalAmountCents).toBe(24680)
  })
})
