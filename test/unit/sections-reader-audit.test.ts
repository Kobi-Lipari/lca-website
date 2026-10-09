// test/unit/sections-reader-audit.test.ts
//
// K2e: the server reads sections from tournament_sections, never from the
// legacy tournaments.sections JSON, which is now only a mirror the writer
// keeps (sections-writer-audit.test.ts). This scans every source file under
// functions/ and workers/ for:
//
// - a parse of the column: parseJsonArray(t.sections), JSON.parse(row.sections),
//   JSON.parse(sectionsJson) and the like, and a call of the legacy readers
//   (normalizeLegacySections, and the parse helpers the handlers used to have)
// - a read of the column: SQL text that selects sections from tournaments,
//   tournaments.sections in a Drizzle query, and .sections read from a row
//   that a SELECT * (or t.*) on tournaments returned
// - a tournaments row answered as it is: a row that SELECT * (or t.*, or
//   Drizzle's select() with no columns) on tournaments returned, reaching
//   jsonResponse (directly, spread, mapped, or through variables) without
//   going through toTournamentResponse. Such a row carries the sections and
//   round_schedule JSON text to the client.
//
// Only functions/utils/events/sectionsRepo.ts may do the first two; domain/
// is not scanned (normalizeLegacySections lives there, for the site's own
// readers until step 13).
//
// Like the writer audit, it is a guard on the source text, not a proof: it
// follows a row through plain assignments in the same file, not through
// function calls (an argument of a call does not make its result a row,
// except for prepare(), whose SQL decides) or other files.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const REPO = 'functions/utils/events/sectionsRepo.ts'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name === 'dist' || name === '.wrangler') return []
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx|js|mjs|cjs)$/.test(name) ? [path] : []
  })
}

// ── A small lexer: comments out, string contents found ─────────────────

interface Literal {
  start: number
  end: number
  /** The text inside the quotes; a template keeps its ${...} parts as written. */
  text: string
}

interface Lexed {
  /** The source with comments blanked (same length, line breaks kept). */
  code: string
  /** The same, with the inside of every string literal blanked too (a template's ${...} code is kept). */
  masked: string
  literals: Literal[]
}

const WORD = /[\w$]/
const REGEX_AFTER = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^'])
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'await'])

export function lex(src: string): Lexed {
  const code = src.split('')
  const masked = src.split('')
  const literals: Literal[] = []
  const n = src.length
  const blank = (arrays: string[][], from: number, to: number) => {
    for (const a of arrays) for (let k = from; k < to; k++) if (a[k] !== '\n') a[k] = ' '
  }

  function scanString(i: number): number {
    const quote = src[i]
    let j = i + 1
    while (j < n && src[j] !== quote && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1
    literals.push({ start: i, end: j + 1, text: src.slice(i + 1, j) })
    blank([masked], i + 1, j)
    return j + 1
  }

  function scanTemplate(i: number): number {
    const start = i
    let text = ''
    let seg = ++i
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { i += 2; continue }
      if (src[i] === '$' && src[i + 1] === '{') {
        text += src.slice(seg, i)
        blank([masked], seg, i)
        const exprStart = i + 2
        i = scanCode(exprStart, true)
        text += `\${${src.slice(exprStart, i - 1)}}`
        seg = i
        continue
      }
      i++
    }
    text += src.slice(seg, i)
    blank([masked], seg, i)
    literals.push({ start, end: i + 1, text })
    return i + 1
  }

  function scanRegex(i: number): number {
    let j = i + 1
    let inClass = false
    while (j < n && src[j] !== '\n') {
      if (src[j] === '\\') { j += 2; continue }
      if (src[j] === '[') inClass = true
      else if (src[j] === ']') inClass = false
      else if (src[j] === '/' && !inClass) break
      j++
    }
    j++
    while (j < n && /[a-z]/i.test(src[j])) j++
    blank([masked], i + 1, j)
    return j
  }

  /** Code until the end, or (in a template's ${...}) until its closing brace; returns the index after it. */
  function scanCode(i: number, inTemplate: boolean): number {
    let depth = 0
    let prev = ''
    let prevWord = ''
    while (i < n) {
      const c = src[i]
      if (c === '/' && src[i + 1] === '/') {
        const end = src.indexOf('\n', i)
        const e = end === -1 ? n : end
        blank([code, masked], i, e)
        i = e
        continue
      }
      if (c === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2)
        const e = end === -1 ? n : end + 2
        blank([code, masked], i, e)
        i = e
        continue
      }
      if (c === '\'' || c === '"') { i = scanString(i); prev = c; prevWord = ''; continue }
      if (c === '`') { i = scanTemplate(i); prev = '`'; prevWord = ''; continue }
      if (c === '/' && (REGEX_AFTER.has(prev) || REGEX_AFTER_WORD.has(prevWord))) { i = scanRegex(i); prev = '/'; prevWord = ''; continue }
      if (WORD.test(c)) {
        let j = i
        while (j < n && WORD.test(src[j])) j++
        prevWord = src.slice(i, j)
        prev = 'a'
        i = j
        continue
      }
      if (c === '{') depth++
      else if (c === '}') {
        if (depth === 0 && inTemplate) return i + 1
        depth--
      }
      if (!/\s/.test(c)) { prev = c; prevWord = '' }
      i++
    }
    return i
  }

  scanCode(0, false)
  return { code: code.join(''), masked: masked.join(''), literals }
}

// ── SQL that reads tournaments ─────────────────────────────────────────

const SELECT_ALL = /\bSELECT\s+(?:DISTINCT\s+)?(?:(\*)|([A-Za-z_]\w*)\.\*)[\s\S]*?\bFROM\s+["`]?tournaments["`]?(?![\w])(?:\s+(?:AS\s+)?([A-Za-z_]\w*))?/i

/** SQL that selects every column of tournaments: SELECT * FROM tournaments, or t.* with t its alias. */
export function selectsWholeTournament(sql: string): boolean {
  const m = SELECT_ALL.exec(sql)
  if (!m) return false
  return m[1] === '*' || (m[2] !== undefined && m[2] === m[3])
}

const FROM_TOURNAMENTS = /\b(?:FROM|JOIN)\s+["`]?tournaments["`]?(?![\w])/i
const SECTIONS_COLUMN = /(?<![\w$])(?:[A-Za-z_]\w*\.)?["`[]?sections["`\]]?(?![\w$])/i

/** SQL that names tournaments.sections in a SELECT. */
export function selectsSectionsColumn(sql: string): boolean {
  return /\bSELECT\b/i.test(sql) && FROM_TOURNAMENTS.test(sql) && SECTIONS_COLUMN.test(sql)
}

// ── Following a row through the code ───────────────────────────────────

/** Methods that hand back the rows (or the statement) they are called on. */
const KEEPS_ROWS = new Set(['results', 'map', 'flatMap', 'filter', 'slice', 'concat', 'find', 'sort', 'reverse', 'at', 'all', 'first', 'raw', 'bind'])
const KEYWORDS = new Set([
  'const', 'let', 'var', 'await', 'new', 'typeof', 'return', 'true', 'false', 'null', 'undefined', 'as',
  'if', 'else', 'for', 'while', 'of', 'in', 'async', 'function', 'satisfies', 'void', 'this', 'instanceof',
])
const GROUPING_BEFORE = new Set(['if', 'for', 'while', 'switch', 'return', 'catch', 'function', 'await', 'typeof', 'in', 'of', 'else', 'void'])

/** Index of the bracket that closes the one at `open`. */
function closing(m: string, open: number): number {
  let depth = 0
  for (let i = open; i < m.length; i++) {
    if ('([{'.includes(m[i])) depth++
    else if (')]}'.includes(m[i])) {
      depth--
      if (depth === 0) return i
    }
  }
  return m.length
}

/**
 * Where the statement that starts at `from` ends (no semicolons in this
 * repo: a line break at depth 0 that continues nothing). A string literal,
 * a template over several lines included, is passed over whole.
 */
function statementEnd(m: string, from: number, literalEnds: ReadonlyMap<number, number>): number {
  let depth = 0
  for (let i = from; i < m.length; i++) {
    const skip = literalEnds.get(i)
    if (skip !== undefined) {
      i = skip - 1
      continue
    }
    const c = m[i]
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) {
      if (depth === 0) return i
      depth--
    } else if (c === ';' && depth === 0) return i
    else if (c === '\n' && depth === 0) {
      const before = m.slice(from, i).trimEnd()
      const last = before[before.length - 1]
      const next = /^\s*(\S)/.exec(m.slice(i + 1, i + 400))?.[1]
      if (last && !'=(,[{?:&|+-*/.<>!'.includes(last) && (!next || !'.?:)]}&|+-*/'.includes(next))) return i
    }
  }
  return m.length
}

interface Definition { name: string; start: number; end: number }

function bindingNames(pattern: string): string[] {
  const inner = pattern.slice(1, -1)
  return inner.split(',').map((part) => {
    const p = part.split('=')[0].trim().replace(/^\.\.\./, '')
    const target = p.includes(':') ? p.slice(p.indexOf(':') + 1).trim() : p
    return target
  }).filter((name) => /^[A-Za-z_$][\w$]*$/.test(name))
}

function definitions(m: string, literals: readonly Literal[]): Definition[] {
  const literalEnds = new Map(literals.map((l) => [l.start, l.end]))
  const out: Definition[] = []
  for (const d of m.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*|[{[][^=]*?[}\]])\s*(?::[^=;\n]*)?=(?![=>])/g)) {
    const start = (d.index ?? 0) + d[0].length
    const end = statementEnd(m, start, literalEnds)
    const names = /^[{[]/.test(d[1]) ? bindingNames(d[1]) : [d[1]]
    for (const name of names) out.push({ name, start, end })
  }
  for (const d of m.matchAll(/(?:^|[;{}\n])[ \t]*([A-Za-z_$][\w$]*)[ \t]*=(?![=>])/g)) {
    if (KEYWORDS.has(d[1])) continue
    const start = (d.index ?? 0) + d[0].length
    out.push({ name: d[1], start, end: statementEnd(m, start, literalEnds) })
  }
  return out
}

interface Ref { name: string; pos: number }

interface Source {
  lexed: Lexed
  defs: Definition[]
  /** Ranges inside toTournamentResponse(...) calls: nothing there is answered as it is. */
  wrapped: Array<[number, number]>
}

function source(text: string): Source {
  const lexed = lex(text)
  const wrapped: Array<[number, number]> = []
  for (const w of lexed.masked.matchAll(/\btoTournamentResponse\s*\(/g)) {
    const open = (w.index ?? 0) + w[0].length - 1
    wrapped.push([open, closing(lexed.masked, open)])
  }
  return { lexed, defs: definitions(lexed.masked, lexed.literals), wrapped }
}

const isWrapped = (src: Source, pos: number) => src.wrapped.some(([a, b]) => pos > a && pos < b)

/** True when [start, end) holds, outside toTournamentResponse, SQL or a Drizzle select that returns whole tournaments rows. */
function wholeRowQueryIn(src: Source, start: number, end: number): boolean {
  const sql = src.lexed.literals.some((l) => l.start >= start && l.end <= end && !isWrapped(src, l.start) && selectsWholeTournament(l.text))
  if (sql) return true
  const span = src.lexed.masked.slice(start, end)
  for (const d of span.matchAll(/\.select\(\s*\)[\s\S]{0,80}?\.from\(\s*tournaments\s*\)/g)) {
    if (!isWrapped(src, start + (d.index ?? 0))) return true
  }
  return false
}

/**
 * The names in [start, end) used as values that can carry a row: not a
 * property name, an object key, a called function, an argument of a call
 * (its result is something else), or a field read off the row; a method
 * that hands rows back (map, filter, results...) keeps them, unless a map
 * puts each one through toTournamentResponse.
 */
function valueRefs(src: Source, start: number, end: number): Ref[] {
  const m = src.lexed.masked
  const code = src.lexed.code
  const refs: Ref[] = []
  const stack: Array<{ call: boolean; callee: string }> = []
  let i = start
  while (i < end) {
    const c = m[i]
    if (c === '(') {
      const before = m.slice(Math.max(start, i - 80), i).trimEnd()
      const word = /([A-Za-z_$][\w$]*)$/.exec(before)?.[1] ?? ''
      const call = /[\w$)\]>]$/.test(before) && !GROUPING_BEFORE.has(word)
      stack.push({ call, callee: word })
      i++
      continue
    }
    if (c === '[' || c === '{') { stack.push({ call: false, callee: '' }); i++; continue }
    if (c === ')' || c === ']' || c === '}') { stack.pop(); i++; continue }
    if (WORD.test(c) && !/[\w$]/.test(m[i - 1] ?? '')) {
      let j = i
      while (j < end && WORD.test(m[j])) j++
      const name = m.slice(i, j)
      const pos = i
      i = j
      if (/^\d/.test(name) || KEYWORDS.has(name)) continue
      const lead = m.slice(Math.max(start, pos - 40), pos)
      const prev = /(\S)\s*$/.exec(lead)?.[1] ?? ''
      if (prev === '.' && !/\.\.\.\s*$/.test(lead)) continue
      const after = m.slice(j, j + 200)
      if (/^\s*(?:<[^()]*>)?\s*\(/.test(after)) continue
      if (/^\s*:(?!:)/.test(after) && (prev === '{' || prev === ',')) continue
      if (stack.some((s) => s.call && s.callee !== 'prepare')) continue
      if (isWrapped(src, pos)) continue
      const member = /^\s*!?\s*\??\.\s*([A-Za-z_$][\w$]*)/.exec(after)
      if (member) {
        if (!KEEPS_ROWS.has(member[1])) continue
        if (member[1] === 'map' || member[1] === 'flatMap') {
          const open = j + after.indexOf('(', member.index + member[0].length)
          if (open > j && /\btoTournamentResponse\s*\(/.test(code.slice(open, closing(m, open)))) continue
        }
      }
      refs.push({ name, pos })
      continue
    }
    i++
  }
  return refs
}

/** Whether `name`, as used at `pos`, can hold a whole tournaments row. */
function holdsRow(src: Source, name: string, pos: number, seen = new Set<number>()): boolean {
  for (const d of src.defs) {
    if (d.name !== name || d.start > pos || seen.has(d.start)) continue
    seen.add(d.start)
    if (wholeRowQueryIn(src, d.start, d.end)) return true
    if (valueRefs(src, d.start, d.end).some((r) => holdsRow(src, r.name, r.pos, seen))) return true
  }
  return false
}

/** Each way the text reads the legacy sections column, as a short description. */
export function sectionsReads(text: string): string[] {
  const src = source(text)
  const found: string[] = []
  // Found in the code with strings blanked; the argument is read with its strings.
  for (const m of src.lexed.masked.matchAll(/(?<![\w$.])(parseJsonArray|JSON\.parse)\s*\(\s*([^),]*)/g)) {
    const from = (m.index ?? 0) + m[0].length - m[2].length
    const arg = src.lexed.code.slice(from, from + m[2].length)
    if (/(?:^|[^\w$])sections\w*|\[\s*['"`]sections['"`]\s*\]/.test(arg)) found.push(`${m[1]} of sections`)
  }
  for (const m of src.lexed.masked.matchAll(/\b(normalizeLegacySections|parseTournamentSections|parseSections|parseSectionList|parseSectionNames)\s*\(/g)) {
    const before = src.lexed.masked.slice(Math.max(0, (m.index ?? 0) - 20), m.index)
    if (!/function\s*$/.test(before)) found.push(`${m[1]}()`)
  }
  for (const l of src.lexed.literals) {
    if (selectsSectionsColumn(l.text)) found.push('SQL selecting tournaments.sections')
  }
  if (/\btournaments\s*\.\s*sections\b/.test(src.lexed.masked)) found.push('Drizzle tournaments.sections')
  for (const m of src.lexed.masked.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*!?\s*\??\.\s*sections\b/g)) {
    if (holdsRow(src, m[1], m.index ?? 0)) found.push(`${m[1]}.sections of a tournaments row`)
  }
  return found
}

/** Each jsonResponse that answers a whole tournaments row without toTournamentResponse. */
export function rawTournamentAnswers(text: string): string[] {
  const src = source(text)
  const m = src.lexed.masked
  const found: string[] = []
  for (const call of m.matchAll(/\bjsonResponse\s*\(/g)) {
    const open = (call.index ?? 0) + call[0].length - 1
    const close = closing(m, open)
    const line = m.slice(0, open).split('\n').length
    if (wholeRowQueryIn(src, open + 1, close)) {
      found.push(`jsonResponse at line ${line}: a tournaments query`)
      continue
    }
    const raw = valueRefs(src, open + 1, close).filter((r) => holdsRow(src, r.name, r.pos))
    for (const r of raw) found.push(`jsonResponse at line ${line}: ${r.name}`)
  }
  return found
}

// ── The scan ────────────────────────────────────────────────────────────

describe('the server reads sections only from the table (K2e)', () => {
  const files = ['functions', 'workers'].flatMap((d) => sourceFiles(join(ROOT, d)))
  const named = files.map((f) => ({ file: relative(ROOT, f).split('\\').join('/'), text: readFileSync(f, 'utf8') }))

  it('scans every reader the step moved, the helpers and both workers', () => {
    expect(named.map((f) => f.file)).toEqual(expect.arrayContaining([
      'functions/api/tournaments.ts',
      'functions/api/tournaments/[id].ts',
      'functions/api/clearinghouse.ts',
      'functions/api/clubs/[id].ts',
      'functions/api/admin/tournaments.ts',
      'functions/api/admin/tournaments/[id].ts',
      'functions/api/admin/tournaments/[id]/registration.ts',
      'functions/api/admin/tournaments/[id]/manage.ts',
      'functions/api/admin/tournaments/[id]/rating-report.ts',
      'functions/utils/tournament-manage.ts',
      'functions/utils/prizes.ts',
      REPO,
      'workers/daily-emails/src/index.ts',
      'workers/clearinghouse-sync/index.ts',
    ]))
  })

  it('finds no read of the JSON column outside sectionsRepo', () => {
    const readers = named
      .filter((f) => f.file !== REPO)
      .map((f) => ({ file: f.file, reads: sectionsReads(f.text) }))
      .filter((f) => f.reads.length > 0)
    expect(readers).toEqual([])
  })

  it('finds no handler answering a tournaments row without toTournamentResponse', () => {
    const raw = named
      .map((f) => ({ file: f.file, answers: rawTournamentAnswers(f.text) }))
      .filter((f) => f.answers.length > 0)
    expect(raw).toEqual([])
  })

  it('sees the whole-row queries the handlers make, so the check above is not empty', () => {
    const wholeRow = named
      .filter((f) => f.file.startsWith('functions/api/'))
      .filter((f) => lex(f.text).literals.some((l) => selectsWholeTournament(l.text)))
      .map((f) => f.file)
    expect(wholeRow).toEqual(expect.arrayContaining([
      'functions/api/tournaments.ts',
      'functions/api/tournaments/[id].ts',
      'functions/api/admin/tournaments.ts',
      'functions/api/admin/tournaments/[id].ts',
      'functions/api/admin/tournaments/[id]/registration.ts',
      'functions/api/admin/tournaments/[id]/manage.ts',
    ]))
  })
})

// ── What the audit sees ─────────────────────────────────────────────────

describe('the audit sees each way of reading the column', () => {
  it('parses of the column', () => {
    expect(sectionsReads('const s = parseJsonArray(t.sections as string)')).toEqual(['parseJsonArray of sections'])
    expect(sectionsReads('const s = JSON.parse(row!.sections)')).toEqual(['JSON.parse of sections'])
    expect(sectionsReads('const s = JSON.parse(String(tournament.sections))')).toEqual(['JSON.parse of sections'])
    expect(sectionsReads("const s = parseJsonArray(row['sections'])")).toEqual(['parseJsonArray of sections'])
    expect(sectionsReads('function f(sectionsJson: string) { return JSON.parse(sectionsJson) }')).toEqual(['JSON.parse of sections'])
    expect(sectionsReads('const list = normalizeLegacySections(text)')).toEqual(['normalizeLegacySections()'])
    expect(sectionsReads('const list = parseTournamentSections(t)')).toEqual(['parseTournamentSections()'])
  })

  it('SQL and Drizzle reads of the column', () => {
    expect(sectionsReads("db.prepare('SELECT id, sections FROM tournaments WHERE id = ?')")).toEqual(['SQL selecting tournaments.sections'])
    expect(sectionsReads('db.prepare(`SELECT t.id,\n  t.sections,\n  c.name\n FROM tournaments t LEFT JOIN clubs c ON c.id = t.club_id`)'))
      .toEqual(['SQL selecting tournaments.sections'])
    expect(sectionsReads('db.select({ s: tournaments.sections }).from(tournaments)')).toEqual(['Drizzle tournaments.sections'])
    expect(sectionsReads("const t = await db.prepare('SELECT * FROM tournaments WHERE id = ?').bind(id).first()\nconst n = t.sections.length"))
      .toEqual(['t.sections of a tournaments row'])
  })

  it('leaves alone the table, other columns, other JSON, comments and request bodies', () => {
    expect(sectionsReads("db.prepare('SELECT * FROM tournament_sections WHERE tournament_id = ?')")).toEqual([])
    expect(sectionsReads("db.prepare('SELECT id, name FROM tournaments WHERE id = ?')")).toEqual([])
    expect(sectionsReads('const r = parseJsonArray(t.round_schedule)\nconst d = parseJsonArray(t.custom_details)')).toEqual([])
    expect(sectionsReads('const b = JSON.parse(r.bye_rounds as string)')).toEqual([])
    expect(sectionsReads('// parseJsonArray(t.sections) was here\n/* JSON.parse(row.sections) */')).toEqual([])
    expect(sectionsReads("const help = 'parseJsonArray(t.sections) is gone'")).toEqual([])
    expect(sectionsReads('if (body.sections != null) save(body.sections)\nconst p = answer.sections')).toEqual([])
    expect(sectionsReads('const rows = await loadSections(db, id)\nconst s = tournamentSections.name')).toEqual([])
    expect(sectionsReads('export function normalizeLegacySections(value: unknown) {}')).toEqual([])
  })
})

describe('the audit sees a tournaments row answered as it is', () => {
  const one = (answer: string) =>
    `const tournament = await context.env.DB.prepare(\n  'SELECT * FROM tournaments WHERE id = ?',\n).bind(id).first<TournamentRow>()\n${answer}`

  it('a planted SELECT * row passed straight to jsonResponse', () => {
    expect(rawTournamentAnswers(one('return jsonResponse({ tournament })'))).toEqual(['jsonResponse at line 4: tournament'])
    expect(rawTournamentAnswers(one('return jsonResponse({ tournament: { ...tournament, sections } })'))).toHaveLength(1)
    expect(rawTournamentAnswers(one('return jsonResponse(tournament)'))).toHaveLength(1)
    expect(rawTournamentAnswers(one('const updated = tournament\nreturn jsonResponse({ tournament: updated })'))).toHaveLength(1)
    expect(rawTournamentAnswers("return jsonResponse({ t: await db.prepare('SELECT * FROM tournaments').first() })")).toHaveLength(1)
  })

  it('a list, through the statement, its results and a map that spreads each row', () => {
    const list = [
      'const base = `SELECT t.*, c.color AS club_color, c.name AS club_name',
      '     FROM tournaments t',
      '     LEFT JOIN clubs c ON t.club_id = c.id`',
      '',
      'let statement: D1PreparedStatement',
      'if (admin) {',
      '  statement = context.env.DB.prepare(`${base} ORDER BY t.date`)',
      '} else {',
      '  statement = context.env.DB.prepare(`${base} WHERE t.is_visible = 1`).bind(x)',
      '}',
      'const { results } = await statement.all()',
    ].join('\n')
    expect(rawTournamentAnswers(`${list}\nconst tournaments = (results ?? []).map((t) => ({ ...t, sections: [] }))\nreturn jsonResponse({ tournaments })`))
      .toEqual(['jsonResponse at line 13: tournaments'])
    expect(rawTournamentAnswers(`${list}\nreturn jsonResponse({ tournaments: results })`)).toHaveLength(1)
    expect(rawTournamentAnswers(`${list}\nconst rows = results ?? []\nconst tournaments = rows.map((t) => toTournamentResponse(t, sections.get(t.id) ?? []))\nreturn jsonResponse({ tournaments })`))
      .toEqual([])
  })

  it('a row from Drizzle select() with no columns', () => {
    expect(rawTournamentAnswers('const [existing] = await db.select().from(tournaments).where(eq(tournaments.id, id))\nreturn jsonResponse({ tournament: existing })'))
      .toHaveLength(1)
  })

  it('leaves alone a row through toTournamentResponse, fields read off it, and other tables', () => {
    expect(rawTournamentAnswers(one('return jsonResponse({ tournament: toTournamentResponse(tournament, sections) })'))).toEqual([])
    expect(rawTournamentAnswers(one('const answer = toTournamentResponse(tournament, sections)\nreturn jsonResponse({ tournament: { ...answer, waitlist_count: n } })'))).toEqual([])
    expect(rawTournamentAnswers(one('return jsonResponse({ name: tournament.name, rated: tournament.is_rated ?? 1 })'))).toEqual([])
    expect(rawTournamentAnswers(one('const amount = priceEntry(row, tournament, now)\nreturn jsonResponse({ success: true, amount })'))).toEqual([])
    expect(rawTournamentAnswers("const r = await db.prepare('SELECT * FROM registrations WHERE id = ?').first()\nreturn jsonResponse({ registration: r })")).toEqual([])
    expect(rawTournamentAnswers("const t = await db.prepare('SELECT t.*, m.body FROM support_tickets t').all()\nreturn jsonResponse({ tickets: t.results })")).toEqual([])
    expect(rawTournamentAnswers("const t = await db.prepare('SELECT id, name, date FROM tournaments').all()\nreturn jsonResponse({ tournaments: t.results })")).toEqual([])
    expect(rawTournamentAnswers("// return jsonResponse(await db.prepare('SELECT * FROM tournaments').first())")).toEqual([])
  })

  it('reads the SQL the way the handlers write it', () => {
    expect(selectsWholeTournament('SELECT * FROM tournaments WHERE id = ?')).toBe(true)
    expect(selectsWholeTournament('SELECT t.*, c.color AS club_color FROM tournaments t LEFT JOIN clubs c ON t.club_id = c.id')).toBe(true)
    expect(selectsWholeTournament('select * from "tournaments"')).toBe(true)
    expect(selectsWholeTournament('SELECT t.* FROM support_tickets t')).toBe(false)
    expect(selectsWholeTournament('SELECT g.* FROM tournament_games g JOIN tournaments t ON t.id = g.tournament_id')).toBe(false)
    expect(selectsWholeTournament('SELECT * FROM tournament_sections')).toBe(false)
    expect(selectsWholeTournament('SELECT id, name FROM tournaments')).toBe(false)
  })
})

// ── The readers this step moved, as they were before it ───────────────
// Excerpts of the handlers as the step found them. Each must still be
// caught, so the scan over functions/ would fail if one came back.

describe('the audit catches each reader as it was before the step', () => {
  const selectAllByIdFirst = "const tournament = await context.env.DB.prepare(\n  'SELECT * FROM tournaments WHERE id = ?',\n).bind(tournamentId).first<Record<string, unknown>>()\n"

  it('the public list: a parse of t.sections, and the row spread into the answer', () => {
    const before = [
      "const base = `SELECT t.*, c.color AS club_color, c.name AS club_name",
      '       FROM tournaments t',
      '       LEFT JOIN clubs c ON t.club_id = c.id`',
      'const statement = context.env.DB.prepare(`${base} WHERE t.is_visible = 1 ORDER BY t.date ASC`)',
      'const { results } = await statement.all<Record<string, unknown>>()',
      'const tournaments = (results ?? []).map((t) => {',
      '  const sections = parseJsonArray(t.sections as string)',
      '  return { ...t, sections }',
      '})',
      'return jsonResponse({ tournaments })',
    ].join('\n')
    expect(sectionsReads(before)).toEqual(['parseJsonArray of sections'])
    expect(rawTournamentAnswers(before)).toEqual(['jsonResponse at line 10: tournaments'])
  })

  it('the event page and the manage page: sections and round_schedule parsed off a SELECT * row', () => {
    const before = `${selectAllByIdFirst}const sections = parseJsonArray(tournament.sections as string)\nconst roundSchedule = parseJsonArray(tournament.round_schedule as string)\nreturn jsonResponse({ tournament: { ...tournament, sections, round_schedule: roundSchedule } })`
    expect(sectionsReads(before)).toEqual(['parseJsonArray of sections', 'tournament.sections of a tournaments row'])
    expect(rawTournamentAnswers(before)).toEqual(['jsonResponse at line 6: tournament'])
  })

  it('the registration settings save: SELECT * returned as it is', () => {
    const before = "await db.prepare('UPDATE tournaments SET registration_status = ? WHERE id = ?').bind(s, id).run()\nconst updated = await context.env.DB.prepare(\n  'SELECT * FROM tournaments WHERE id = ?',\n).bind(tournamentId).first()\nreturn jsonResponse({ tournament: updated })"
    expect(sectionsReads(before)).toEqual([])
    expect(rawTournamentAnswers(before)).toEqual(['jsonResponse at line 5: updated'])
  })

  it('the clearinghouse feed: the column in the SQL and the parse of it', () => {
    const before = [
      'const lcaRows = await context.env.DB.prepare(`',
      '  SELECT t.id, t.name, t.entry_fee,',
      '    t.sections,',
      '    t.rounds',
      '  FROM tournaments t',
      '  WHERE t.is_visible = 1',
      '`).all<Record<string, unknown>>()',
      'const lca = (lcaRows.results ?? []).map(t => {',
      '  const sections = parseJsonArray(t.sections as string)',
      "  return { ...t, sections, is_lca: 1, source: 'lca' }",
      '})',
      'return jsonResponse({ tournaments: lca })',
    ].join('\n')
    expect(sectionsReads(before)).toEqual(['parseJsonArray of sections', 'SQL selecting tournaments.sections'])
    // Named columns, not the whole row: the second check has nothing to say.
    expect(rawTournamentAnswers(before)).toEqual([])
  })

  it('the rating report: the section names read off the column', () => {
    const before = `${selectAllByIdFirst}const sectionNames = (parseJsonArray(tournament.sections) as Array<{ name: string } | string>)\n  .map((s) => (typeof s === 'string' ? s : s.name))`
    expect(sectionsReads(before)).toEqual(['parseJsonArray of sections', 'tournament.sections of a tournaments row'])
  })

  it('a club page that selects the column by name', () => {
    expect(sectionsReads("const t = await db.prepare(\n  `SELECT id, name, date, end_date, status, entry_fee, sections, rounds\n   FROM tournaments\n   WHERE club_id = ? AND is_visible = 1`,\n).bind(id).all()"))
      .toEqual(['SQL selecting tournaments.sections'])
  })
})

describe('the audit catches ways of getting around it', () => {
  const row = "const row = await db.prepare('SELECT * FROM tournaments WHERE id = ?').bind(id).first()\n"

  it('an answer built in a variable first, or wrapped around the row', () => {
    expect(rawTournamentAnswers(`${row}const payload = { tournament: row, ok: true }\nreturn jsonResponse(payload)`)).toEqual(['jsonResponse at line 3: payload'])
    expect(rawTournamentAnswers(`${row}const copy = { ...row }\nconst payload = { data: [copy] }\nreturn jsonResponse(payload)`)).toHaveLength(1)
    expect(rawTournamentAnswers(`${row}return jsonResponse({ data: { tournament: row } }, 201)`)).toHaveLength(1)
  })

  it('a row passed through a typed query, a destructuring and a reassignment', () => {
    expect(rawTournamentAnswers("const t = await db.prepare('SELECT * FROM tournaments WHERE id = ?').bind(id).first<TournamentRow>()\nreturn jsonResponse({ tournament: t! })")).toHaveLength(1)
    expect(rawTournamentAnswers("const { results } = await db.prepare('SELECT t.* FROM tournaments AS t').all()\nreturn jsonResponse({ tournaments: results })")).toHaveLength(1)
    expect(rawTournamentAnswers(`${row}let out = null\nout = row\nreturn jsonResponse({ tournament: out })`)).toHaveLength(1)
  })

  it('a column read through brackets or a destructuring, then parsed', () => {
    expect(sectionsReads("const text = row['sections']\nconst list = JSON.parse(text)")).toEqual([])
    expect(sectionsReads("const list = JSON.parse(row['sections'])")).toEqual(['JSON.parse of sections'])
    expect(sectionsReads('const { sections } = row\nconst list = JSON.parse(sections)')).toEqual(['JSON.parse of sections'])
    expect(sectionsReads('const list = parseJsonArray(row?.sections)')).toEqual(['parseJsonArray of sections'])
  })

  it('the Drizzle select of the column, with or without the table name in front', () => {
    expect(sectionsReads('const [t] = await db.select({ sections: tournaments.sections }).from(tournaments)')).toEqual(['Drizzle tournaments.sections'])
    expect(sectionsReads("const rows = await db.all(sql`SELECT sections FROM tournaments WHERE id = ${id}`)")).toEqual(['SQL selecting tournaments.sections'])
  })

  it('the repo, domain code and request bodies stay out of it', () => {
    // A request body field is not the column; the scan skips sectionsRepo and domain/ by path.
    expect(sectionsReads('if (body.sections != null) await save(body.sections)')).toEqual([])
    expect(sectionsReads("const rows = await db.prepare('SELECT * FROM tournament_sections WHERE tournament_id = ?')")).toEqual([])
    expect(rawTournamentAnswers("const rows = await db.prepare('SELECT * FROM tournament_sections').all()\nreturn jsonResponse({ sections: rows.results })")).toEqual([])
  })
})

describe('a handler file planted among the others is found by the same scan', () => {
  it('a SELECT * FROM tournaments handler that answers the row as it is, and one that reads the column', () => {
    const dir = mkdtempSync(join(tmpdir(), 'reader-audit-'))
    try {
      mkdirSync(join(dir, 'api'), { recursive: true })
      writeFileSync(join(dir, 'api', 'planted.ts'), [
        "import type { Env } from '../types'",
        "import { jsonResponse } from '../utils/response'",
        '',
        'export const onRequestGet: PagesFunction<Env> = async (context) => {',
        "  const tournament = await context.env.DB.prepare('SELECT * FROM tournaments WHERE id = ?')",
        '    .bind(context.params.id)',
        '    .first()',
        '  return jsonResponse({ tournament })',
        '}',
        '',
      ].join('\n'))
      writeFileSync(join(dir, 'api', 'planted-parse.ts'), [
        "import { parseJsonArray } from '../utils/json'",
        '',
        'export function names(t: { sections: string }) {',
        '  return parseJsonArray(t.sections)',
        '}',
        '',
      ].join('\n'))
      writeFileSync(join(dir, 'api', 'clean.ts'), [
        "import { jsonResponse } from '../utils/response'",
        "import { toTournamentResponse } from '../utils/events/sectionsRepo'",
        '',
        'export const onRequestGet: PagesFunction = async (context) => {',
        "  const tournament = await context.env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(context.params.id).first()",
        '  return jsonResponse({ tournament: toTournamentResponse(tournament, []) })',
        '}',
        '',
      ].join('\n'))
      const scanned = sourceFiles(dir).map((f) => ({ file: relative(dir, f).split('\\').join('/'), text: readFileSync(f, 'utf8') }))
      expect(scanned.map((f) => f.file).sort()).toEqual(['api/clean.ts', 'api/planted-parse.ts', 'api/planted.ts'])
      const raw = scanned.filter((f) => rawTournamentAnswers(f.text).length > 0).map((f) => f.file)
      const reads = scanned.filter((f) => sectionsReads(f.text).length > 0).map((f) => f.file)
      expect(raw).toEqual(['api/planted.ts'])
      expect(reads).toEqual(['api/planted-parse.ts'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
