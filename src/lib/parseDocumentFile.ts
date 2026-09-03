// Importing this module pulls in mammoth and pdfjs-dist — over a megabyte
// between them. It is loaded on demand, when someone actually picks a file;
// see documentUpload.ts for the part the UI needs up front.
import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

export async function parseFileToHtml(file: File): Promise<string> {
  const ext = file.name.toLowerCase().split('.').pop()

  if (ext === 'docx') {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer })
    return result.value
  }

  if (ext === 'pdf') {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    let html = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      // getTextContent yields TextItem and TextMarkedContent; only the
      // former carries text, and marked-content entries have no str.
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
      const paragraphs = pageText.split(/\s{2,}|(?<=[.?!])\s+(?=[A-Z])/g)
      html += paragraphs.filter(Boolean).map((p) => `<p>${p.trim()}</p>`).join('')
    }
    return html
  }

  throw new Error('Unsupported file type. Please upload a .docx or .pdf file.')
}
