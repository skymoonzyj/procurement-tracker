import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export const MAX_PDF_BYTES = 20 * 1024 * 1024

export type PdfExtractionErrorCode = 'file-too-large' | 'encrypted' | 'unreadable'

export class PdfExtractionError extends Error {
  readonly code: PdfExtractionErrorCode

  constructor(code: PdfExtractionErrorCode, message: string) {
    super(message)
    this.name = 'PdfExtractionError'
    this.code = code
  }
}

export async function extractPdfText(file: Blob): Promise<{ text: string; pageCount: number }> {
  if (file.size > MAX_PDF_BYTES) {
    throw new PdfExtractionError('file-too-large', 'PDF 文件不能超过 20 MB')
  }

  try {
    const pdfjs = await import('pdfjs-dist')
    // Vite turns the ?url import into a local asset URL; this keeps parsing in
    // the browser worker instead of relying on a remote CDN worker.
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
    const data = new Uint8Array(await file.arrayBuffer())
    const loadingTask = pdfjs.getDocument({ data })
    const pdf = await loadingTask.promise
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ')
      pages.push(text)
    }
    return { text: pages.join('\n'), pageCount: pdf.numPages }
  } catch (error) {
    if (error instanceof PdfExtractionError) throw error
    const message = error instanceof Error ? error.message : String(error)
    const code: PdfExtractionErrorCode = /password|encrypt/i.test(message) ? 'encrypted' : 'unreadable'
    throw new PdfExtractionError(code, code === 'encrypted' ? 'PDF 已加密，无法提取文字' : 'PDF 无法读取或未包含可提取文字')
  }
}
