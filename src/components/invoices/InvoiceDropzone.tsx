import { useState } from 'react'
import { MAX_PDF_BYTES } from '../../invoices/pdfText'

interface InvoiceDropzoneProps { onFiles: (files: File[]) => void }

export function InvoiceDropzone({ onFiles }: InvoiceDropzoneProps) {
  const [errors, setErrors] = useState<string[]>([])
  const handleFiles = (list: FileList | null) => {
    if (!list) return
    const accepted: File[] = []
    const nextErrors: string[] = []
    Array.from(list).forEach((file) => {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        nextErrors.push(`${file.name} 不是 PDF 文件`)
      } else if (file.size > MAX_PDF_BYTES) {
        nextErrors.push(`${file.name} 超过 20 MB 限制`)
      } else accepted.push(file)
    })
    setErrors(nextErrors)
    if (accepted.length) onFiles(accepted)
  }
  return <section className="invoice-dropzone" aria-label="上传发票">
    <label className="dropzone-label">上传 PDF 发票
      <input aria-label="上传 PDF 发票" type="file" accept="application/pdf,.pdf" multiple onChange={(event) => { handleFiles(event.target.files); event.currentTarget.value = '' }} />
    </label>
    <p className="muted">支持多个 PDF，单个文件不超过 20 MB</p>
    {errors.length > 0 && <div role="alert" className="form-error">{errors.map((error) => <div key={error}>{error}</div>)}</div>}
  </section>
}

