// functions/utils/csv.ts — CSV that opens cleanly in Excel and Google Sheets.

/**
 * One cell. Quotes when needed, and defuses values starting with = + - @
 * so a name or note typed into the site can never run as a spreadsheet
 * formula when the file is opened ("CSV injection").
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Header row plus data rows, with a BOM so Excel reads accents correctly. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
