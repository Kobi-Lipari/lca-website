// src/lib/uschessUpload.ts
//
// The three files US Chess takes for a rating report upload, built in the
// browser from the site's rating report:
//
//   THEXPORT.DBF  one record for the event (header)
//   TSEXPORT.DBF  one record per section
//   TDEXPORT.DBF  one record per player per section, with every round
//
// They're dBase III tables, the format US Chess's rating system has used
// since the 1990s (the "2C" version, which adds colors and time control).
//
// US Chess's field-by-field spec is only published inside the TD/Affiliate
// area, so the LAYOUT tables below are our best reconstruction from public
// sources. Everything about the layout lives in those tables: if US Chess's
// upload rejects a file, the fix is a change there, nothing else.

import type { ApiRatingReport } from '@/lib/api'

// ── dBase III writer ─────────────────────────────────────────────────────────

export type DbfType = 'C' | 'N' | 'D'
export interface DbfField { name: string; type: DbfType; length: number; decimals?: number }
export type DbfValue = string | number | null | undefined

const ascii = (s: string) =>
  // dBase files are single-byte text: drop accents and anything non-ASCII.
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '')

function cell(field: DbfField, value: DbfValue): string {
  if (field.type === 'N') {
    if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return ' '.repeat(field.length)
    const text = Number(value).toFixed(field.decimals ?? 0)
    return text.length > field.length ? '9'.repeat(field.length) : text.padStart(field.length, ' ')
  }
  if (field.type === 'D') {
    const d = String(value ?? '').replace(/[^0-9]/g, '').slice(0, 8)
    return d.length === 8 ? d : ' '.repeat(8)
  }
  return ascii(String(value ?? '')).slice(0, field.length).padEnd(field.length, ' ')
}

/** A dBase III (.dbf) file with the given fields and rows. */
export function writeDbf(fields: DbfField[], rows: Array<Record<string, DbfValue>>, today = new Date()): Uint8Array {
  for (const f of fields) {
    if (f.name.length > 10) throw new Error(`DBF field name too long: ${f.name}`)
    if (f.type === 'D' && f.length !== 8) throw new Error(`Date field ${f.name} must be 8 wide`)
  }
  const headerLength = 32 + fields.length * 32 + 1
  const recordLength = 1 + fields.reduce((n, f) => n + f.length, 0)
  const out = new Uint8Array(headerLength + rows.length * recordLength + 1)
  const view = new DataView(out.buffer)

  out[0] = 0x03 // dBase III, no memo
  out[1] = today.getFullYear() - 1900
  out[2] = today.getMonth() + 1
  out[3] = today.getDate()
  view.setUint32(4, rows.length, true)
  view.setUint16(8, headerLength, true)
  view.setUint16(10, recordLength, true)

  fields.forEach((f, i) => {
    const at = 32 + i * 32
    for (let c = 0; c < f.name.length; c++) out[at + c] = f.name.charCodeAt(c)
    out[at + 11] = f.type.charCodeAt(0)
    out[at + 16] = f.length
    out[at + 17] = f.decimals ?? 0
  })
  out[headerLength - 1] = 0x0d

  rows.forEach((row, r) => {
    let at = headerLength + r * recordLength
    out[at++] = 0x20 // not deleted
    for (const f of fields) {
      const text = cell(f, row[f.name])
      for (let c = 0; c < f.length; c++) out[at++] = text.charCodeAt(c)
    }
  })
  out[out.length - 1] = 0x1a
  return out
}

/** Read a .dbf back (field list and rows as trimmed strings). For tests and for checking a file by eye. */
export function readDbf(bytes: Uint8Array): { fields: DbfField[]; rows: Array<Record<string, string>> } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const count = view.getUint32(4, true)
  const headerLength = view.getUint16(8, true)
  const recordLength = view.getUint16(10, true)
  const fields: DbfField[] = []
  for (let at = 32; bytes[at] !== 0x0d; at += 32) {
    let name = ''
    for (let c = 0; c < 11 && bytes[at + c]; c++) name += String.fromCharCode(bytes[at + c])
    fields.push({ name, type: String.fromCharCode(bytes[at + 11]) as DbfType, length: bytes[at + 16], decimals: bytes[at + 17] })
  }
  const rows: Array<Record<string, string>> = []
  for (let r = 0; r < count; r++) {
    let at = headerLength + r * recordLength + 1
    const row: Record<string, string> = {}
    for (const f of fields) {
      let text = ''
      for (let c = 0; c < f.length; c++) text += String.fromCharCode(bytes[at + c])
      row[f.name] = text.trim()
      at += f.length
    }
    rows.push(row)
  }
  return { fields, rows }
}

// ── What the director fills in once ──────────────────────────────────────────

/** US Chess rating system for a section: Regular, Quick, Dual (both), Blitz. */
export type RatingSystem = 'R' | 'Q' | 'D' | 'B'
/** Who US Chess mails the crosstable to: Affiliate, TD, or Nobody. */
export type SendCrosstable = 'A' | 'T' | 'N'

export interface UploadSettings {
  affiliateId: string
  chiefTdId: string
  assistantTdId: string
  city: string
  state: string
  zip: string
  scholastic: boolean
  sections: Record<string, { ratingSystem: RatingSystem; sendCrosstable: SendCrosstable }>
}

/**
 * The US Chess rating system a time control falls under. Total time is the
 * base minutes plus the increment or delay in seconds (each second counts
 * as a minute): over 65 is regular, 30–65 dual (regular and quick), over
 * 10 and under 30 quick, 10 or under blitz.
 */
export function ratingSystemFor(timeControl: string | null | undefined): RatingSystem {
  const tc = (timeControl ?? '').toUpperCase()
  const base = /G(?:AME IN)?\s*\/?\s*(\d+)/.exec(tc) ?? /SD\s*\/\s*(\d+)/.exec(tc)
  const extra = /[+;,]\s*(?:INC\s*|D(?:ELAY)?\s*)?(\d+)/.exec(tc.replace(/G(?:AME IN)?\s*\/?\s*\d+/, '')) ?? /\bD(\d+)\b/.exec(tc)
  const moves = /^\s*(\d+)\s*\/\s*(\d+)/.exec(tc)
  let total = base ? Number(base[1]) + (extra ? Number(extra[1]) : 0) : NaN
  // "40/90, SD/30" and similar: a primary control means a long game.
  if (moves) total = Math.max(Number.isNaN(total) ? 0 : total, Number(moves[2]) + (base ? Number(base[1]) : 0))
  if (Number.isNaN(total)) return 'R'
  if (total > 65) return 'R'
  if (total >= 30) return 'D'
  if (total > 10) return 'Q'
  return 'B'
}

export function defaultSettings(report: ApiRatingReport): UploadSettings {
  const saved = (report.upload?.settings ?? {}) as Partial<UploadSettings>
  const s = report.upload?.suggested
  const sections: UploadSettings['sections'] = {}
  for (const sec of report.sections) {
    sections[sec.name] = saved.sections?.[sec.name] ?? { ratingSystem: ratingSystemFor(report.tournament.timeControl), sendCrosstable: 'A' }
  }
  return {
    affiliateId: saved.affiliateId ?? '',
    chiefTdId: saved.chiefTdId || s?.chiefTdId || '',
    assistantTdId: saved.assistantTdId ?? s?.assistantTdId ?? '',
    city: saved.city || s?.city || '',
    state: saved.state || s?.state || 'LA',
    zip: saved.zip || s?.zip || '',
    scholastic: saved.scholastic ?? false,
    sections,
  }
}

/** What's missing before the files can be made. */
export function settingsProblems(s: UploadSettings): string[] {
  const out: string[] = []
  if (!/^[A-Z]\d{7}$/i.test(s.affiliateId.trim())) out.push('Affiliate ID: a letter and 7 digits, like A1234567.')
  if (!/^\d{8}$/.test(s.chiefTdId.trim())) out.push("Chief TD's US Chess ID: 8 digits.")
  if (s.assistantTdId.trim() && !/^\d{8}$/.test(s.assistantTdId.trim())) out.push("Assistant TD's US Chess ID: 8 digits, or leave it blank.")
  if (!s.city.trim()) out.push('City.')
  if (!/^[A-Z]{2}$/i.test(s.state.trim())) out.push('State: two letters.')
  if (s.zip.trim() && !/^\d{5}(-\d{4})?$/.test(s.zip.trim())) out.push('ZIP: 5 digits.')
  return out
}

// ── The layout (best reconstruction; see the note at the top) ────────────────

const MAX_ROUNDS = 20

export const HEADER_LAYOUT: DbfField[] = [
  { name: 'H_EVENT_ID', type: 'C', length: 12 }, // assigned by US Chess; blank on upload
  { name: 'H_NAME', type: 'C', length: 35 },
  { name: 'H_TOT_SECT', type: 'N', length: 2 },
  { name: 'H_BEG_DATE', type: 'D', length: 8 },
  { name: 'H_END_DATE', type: 'D', length: 8 },
  { name: 'H_RECVD', type: 'D', length: 8 }, // filled in by US Chess
  { name: 'H_AFF_ID', type: 'C', length: 8 },
  { name: 'H_CITY', type: 'C', length: 21 },
  { name: 'H_STATE', type: 'C', length: 2 },
  { name: 'H_ZIPCODE', type: 'C', length: 10 },
  { name: 'H_COUNTRY', type: 'C', length: 21 },
  { name: 'H_SCHOLAST', type: 'C', length: 1 },
  { name: 'H_CTD_ID', type: 'C', length: 8 },
  { name: 'H_ATD_ID', type: 'C', length: 8 },
]

export const SECTION_LAYOUT: DbfField[] = [
  { name: 'S_EVENT_ID', type: 'C', length: 12 },
  { name: 'S_SEC_NUM', type: 'N', length: 2 },
  { name: 'S_SEC_NAME', type: 'C', length: 30 },
  { name: 'S_R_SYSTEM', type: 'C', length: 1 },
  { name: 'S_CTD_ID', type: 'C', length: 8 },
  { name: 'S_ATD_ID', type: 'C', length: 8 },
  { name: 'S_TRN_TYPE', type: 'C', length: 1 }, // S = Swiss
  { name: 'S_TOT_RNDS', type: 'N', length: 2 },
  { name: 'S_LST_PAIR', type: 'N', length: 4 }, // highest pairing number
  { name: 'S_BEG_DATE', type: 'D', length: 8 },
  { name: 'S_END_DATE', type: 'D', length: 8 },
  { name: 'S_TIME_CTL', type: 'C', length: 40 },
  { name: 'S_SENDCROS', type: 'C', length: 1 },
]

/** Width of each D_RNDnn field and how a round is written into it. */
const ROUND_WIDTH = 7
export function roundCell(code: string, opponent: number | null, color: 'W' | 'B' | null): string {
  // Result letter, the opponent's pairing number right-aligned, the color.
  return `${code}${(opponent ? String(opponent) : '').padStart(ROUND_WIDTH - 2, ' ')}${color ?? ' '}`
}

export function detailLayout(rounds: number): DbfField[] {
  const fields: DbfField[] = [
    { name: 'D_EVENT_ID', type: 'C', length: 12 },
    { name: 'D_SEC_NUM', type: 'N', length: 2 },
    { name: 'D_PAIR_NUM', type: 'N', length: 4 },
    { name: 'D_REC_SEQ', type: 'N', length: 1 },
    { name: 'D_MEM_ID', type: 'C', length: 8 },
    { name: 'D_NAME', type: 'C', length: 30 },
    { name: 'D_STATE', type: 'C', length: 2 },
    { name: 'D_RATING', type: 'N', length: 4 },
  ]
  for (let r = 1; r <= Math.min(rounds, MAX_ROUNDS); r++) {
    fields.push({ name: `D_RND${String(r).padStart(2, '0')}`, type: 'C', length: ROUND_WIDTH })
  }
  return fields
}

/** "Jane Q. Smith" → "SMITH, JANE Q", the way US Chess lists names. */
export function uschessName(fullName: string): string {
  const parts = ascii(fullName).replace(/[.]/g, '').trim().split(/\s+/)
  if (parts.length < 2) return parts.join(' ').toUpperCase()
  const suffix = /^(JR|SR|II|III|IV)$/i.test(parts[parts.length - 1]) ? parts.pop() : null
  const last = parts.pop() as string
  return `${last}${suffix ? ` ${suffix}` : ''}, ${parts.join(' ')}`.toUpperCase()
}

const ymd = (d: string) => String(d ?? '').slice(0, 10).replace(/-/g, '')

export interface UploadFiles { thexport: Uint8Array; tsexport: Uint8Array; tdexport: Uint8Array }

export function buildUploadFiles(report: ApiRatingReport, s: UploadSettings): UploadFiles {
  const t = report.tournament
  const rounds = Math.min(t.rounds, MAX_ROUNDS)
  const up = (v: string) => v.trim().toUpperCase()

  const header = writeDbf(HEADER_LAYOUT, [{
    H_EVENT_ID: '',
    H_NAME: t.name,
    H_TOT_SECT: report.sections.length,
    H_BEG_DATE: ymd(t.startDate),
    H_END_DATE: ymd(t.endDate || t.startDate),
    H_RECVD: '',
    H_AFF_ID: up(s.affiliateId),
    H_CITY: s.city.trim(),
    H_STATE: up(s.state),
    H_ZIPCODE: s.zip.trim(),
    H_COUNTRY: 'USA',
    H_SCHOLAST: s.scholastic ? 'Y' : 'N',
    H_CTD_ID: s.chiefTdId.trim(),
    H_ATD_ID: s.assistantTdId.trim(),
  }])

  const sections = writeDbf(SECTION_LAYOUT, report.sections.map((sec, i) => ({
    S_EVENT_ID: '',
    S_SEC_NUM: i + 1,
    S_SEC_NAME: sec.name,
    S_R_SYSTEM: s.sections[sec.name]?.ratingSystem ?? 'R',
    S_CTD_ID: s.chiefTdId.trim(),
    S_ATD_ID: s.assistantTdId.trim(),
    S_TRN_TYPE: 'S',
    S_TOT_RNDS: rounds,
    S_LST_PAIR: sec.players.reduce((m, p) => Math.max(m, p.pairingNum), 0),
    S_BEG_DATE: ymd(t.startDate),
    S_END_DATE: ymd(t.endDate || t.startDate),
    S_TIME_CTL: t.timeControl ?? '',
    S_SENDCROS: s.sections[sec.name]?.sendCrosstable ?? 'A',
  })))

  const details = writeDbf(detailLayout(rounds), report.sections.flatMap((sec, i) => sec.players.map((p) => {
    const row: Record<string, DbfValue> = {
      D_EVENT_ID: '',
      D_SEC_NUM: i + 1,
      D_PAIR_NUM: p.pairingNum,
      D_REC_SEQ: 1,
      D_MEM_ID: p.uscfId ?? '',
      D_NAME: uschessName(p.name),
      D_STATE: '',
      D_RATING: p.preRating ?? '',
    }
    for (let r = 1; r <= rounds; r++) {
      const e = p.rounds.find((x) => x.round === r)
      row[`D_RND${String(r).padStart(2, '0')}`] = e ? roundCell(e.code, e.opponentPairingNum, e.color) : roundCell('U', null, null)
    }
    return row
  })))

  return { thexport: header, tsexport: sections, tdexport: details }
}

// ── One download: a plain (uncompressed) zip of the three files ──────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function zipFiles(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = new TextEncoder().encode(f.name)
    const crc = crc32(f.data)
    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, f.data.length, true)
    lv.setUint32(22, f.data.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    chunks.push(local, f.data)

    const dir = new Uint8Array(46 + name.length)
    const dv = new DataView(dir.buffer)
    dv.setUint32(0, 0x02014b50, true)
    dv.setUint16(4, 20, true)
    dv.setUint16(6, 20, true)
    dv.setUint32(16, crc, true)
    dv.setUint32(20, f.data.length, true)
    dv.setUint32(24, f.data.length, true)
    dv.setUint16(28, name.length, true)
    dv.setUint32(42, offset, true)
    dir.set(name, 46)
    central.push(dir)
    offset += local.length + f.data.length
  }
  const dirSize = central.reduce((n, c) => n + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, dirSize, true)
  ev.setUint32(16, offset, true)
  const all = [...chunks, ...central, end]
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0))
  let at = 0
  for (const c of all) { out.set(c, at); at += c.length }
  return out
}
