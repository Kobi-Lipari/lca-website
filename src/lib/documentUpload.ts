// src/lib/documentUpload.ts
//
// The small, cheap half of document uploading: what the picker accepts and
// how a filename becomes a default title.
//
// Split out from parseDocumentFile so the upload UI can render without it.
// That module pulls in mammoth and pdfjs-dist — well over a megabyte — and
// the governance pages that host this UI are public, so importing a single
// `accept` string from it used to cost every visitor the whole parser.

/** File types the document uploader will take. Mirrors parseFileToHtml. */
export const ACCEPTED_UPLOAD_TYPES = '.docx,.pdf'

/** "Bylaws 2026.docx" → "Bylaws 2026", for prefilling the title field. */
export function stripDocumentExtension(filename: string): string {
  return filename.replace(/\.(docx|pdf)$/i, '')
}
