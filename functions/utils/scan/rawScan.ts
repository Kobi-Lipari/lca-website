// functions/utils/scan/rawScan.ts
//
// The wire contract between the vision model and the move decoder, and the
// code that turns the model's reply into it.
//
// The model is asked for JSON only, but a model's JSON is a suggestion, not a
// guarantee: it wraps it in ``` fences, puts a sentence in front, sends a
// rating as a number, leaves out a field, or invents one. Rejecting the whole
// scan over any of that would throw away a perfectly good transcription, so
// this parser is forgiving about shape and strict only about the one thing
// that makes a scan useless: no rows to decode.
//
// The types mirror scanner/src/lib/scanner/types.ts (SCANNER_SPEC §3.1). They
// are repeated here rather than imported because functions/ is typechecked on
// its own and the scanner is still in its own workspace; when the scanner
// moves into src/, both sides should import one shared definition.

export type Confidence = 'high' | 'medium' | 'low'
export type Legibility = 'clear' | 'partial' | 'unreadable'

export interface RawCell {
  /** best-effort verbatim transcription, e.g. "Nf3", "R1e2", "0-0", "e8=Q" */
  raw: string
  /** plausible alternative readings, whole-token */
  alts?: string[]
  confidence: Confidence
  /** move appears crossed out / rewritten */
  struck?: boolean
}

export interface RawRow {
  /** printed move number on the sheet */
  n: number
  /** null = the cell is blank */
  white: RawCell | null
  black: RawCell | null
}

export interface RawScan {
  header: {
    event?: string
    date?: string
    round?: string
    board?: string
    whiteName?: string
    blackName?: string
    whiteRating?: string
    blackRating?: string
    /** verbatim, e.g. "1-0", "½-½", "1/2-1/2", "0-1" */
    result?: string
    timeControl?: string
    legibility: Legibility
  }
  rows: RawRow[]
  sheetNotes?: string[]
}

export type ParseResult =
  | { ok: true; scan: RawScan }
  | { ok: false; reason: string }

const HEADER_TEXT_FIELDS = [
  'event', 'date', 'round', 'board', 'whiteName', 'blackName',
  'whiteRating', 'blackRating', 'result', 'timeControl',
] as const

// A USCF sheet has 60 rows at most, with a second sheet sometimes adding as
// many again. Anything far past that is the model looping, not a game.
const MAX_ROWS = 200
const MAX_ALTS = 5
const MAX_TEXT = 200

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A string, or a number the model sent where a string belongs (ratings,
 *  round numbers). Trimmed and capped; empty comes back as undefined. */
function text(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) value = String(value)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim().slice(0, MAX_TEXT)
  return trimmed.length > 0 ? trimmed : undefined
}

function confidence(value: unknown): Confidence {
  // An unlabelled reading is treated as the least trustworthy kind. Guessing
  // high would hide exactly the cells the member most needs to look at.
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low'
}

function legibility(value: unknown): Legibility {
  return value === 'clear' || value === 'partial' || value === 'unreadable' ? value : 'partial'
}

function cell(value: unknown): RawCell | null {
  // Some replies use a bare string for a confident cell. Accept it.
  if (typeof value === 'string') value = { raw: value }
  if (!isObject(value)) return null

  const raw = text(value.raw)
  if (!raw) return null

  const result: RawCell = { raw, confidence: confidence(value.confidence) }

  if (Array.isArray(value.alts)) {
    const alts = [...new Set(value.alts.map(text).filter((a): a is string => !!a && a !== raw))]
    if (alts.length > 0) result.alts = alts.slice(0, MAX_ALTS)
  }
  if (value.struck === true) result.struck = true

  return result
}

function moveNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.trim()) : value
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 999 ? n : null
}

/** Pull the JSON object out of whatever the model wrapped around it. */
export function extractJson(reply: string): unknown {
  const unfenced = reply.replace(/```(?:json)?/gi, '').trim()
  try {
    return JSON.parse(unfenced)
  } catch {
    // A sentence before or after the object. Take the outermost braces.
    const start = unfenced.indexOf('{')
    const end = unfenced.lastIndexOf('}')
    if (start === -1 || end <= start) return undefined
    try {
      return JSON.parse(unfenced.slice(start, end + 1))
    } catch {
      return undefined
    }
  }
}

/** Validate and normalise a parsed reply into a RawScan. */
export function toRawScan(value: unknown): ParseResult {
  if (!isObject(value)) return { ok: false, reason: 'reply was not a JSON object' }

  const headerIn = isObject(value.header) ? value.header : {}
  const header: RawScan['header'] = { legibility: legibility(headerIn.legibility) }
  for (const field of HEADER_TEXT_FIELDS) {
    const v = text(headerIn[field])
    if (v !== undefined) header[field] = v
  }

  if (!Array.isArray(value.rows)) {
    // An unreadable photo legitimately has no rows. Anything else without
    // them is a reply that did not follow the schema.
    if (header.legibility === 'unreadable') {
      const scan: RawScan = { header, rows: [] }
      const sheetNotes = notes(value.sheetNotes)
      if (sheetNotes) scan.sheetNotes = sheetNotes
      return { ok: true, scan }
    }
    return { ok: false, reason: 'reply had no rows array' }
  }

  const rows: RawRow[] = []
  for (const rowIn of value.rows.slice(0, MAX_ROWS)) {
    if (!isObject(rowIn)) continue
    const n = moveNumber(rowIn.n)
    if (n === null) continue
    rows.push({ n, white: cell(rowIn.white), black: cell(rowIn.black) })
  }
  // The decoder walks rows in order. The model usually sends them that way,
  // but not always when a sheet has a second column of moves.
  rows.sort((a, b) => a.n - b.n)

  const scan: RawScan = { header, rows }
  const sheetNotes = notes(value.sheetNotes)
  if (sheetNotes) scan.sheetNotes = sheetNotes

  return { ok: true, scan }
}

function notes(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const list = value.map(text).filter((n): n is string => !!n).slice(0, 20)
  return list.length > 0 ? list : undefined
}

/** The whole path from the model's text reply to a RawScan. */
export function parseModelReply(reply: string): ParseResult {
  const json = extractJson(reply)
  if (json === undefined) return { ok: false, reason: 'reply was not valid JSON' }
  return toRawScan(json)
}
