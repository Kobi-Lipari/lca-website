// test/unit/schedules-audit.test.ts
//
// K2g: one writer and reader owns a tournament's round schedule.
// functions/utils/events/schedulesRepo.ts writes tournament_schedules, their
// rounds and the legacy tournaments.round_schedule JSON together, and every
// answer takes round_schedule and schedules from the rows it reads. This
// scans every source file under functions/ and workers/ for:
//
// - a write to the column: SQL text (UPDATE tournaments SET ...
//   round_schedule = ..., INSERT INTO tournaments (... round_schedule ...),
//   REPLACE INTO tournaments), Drizzle .update(tournaments) or
//   .insert(tournaments) with roundSchedule (shorthand included), and
//   ${tournaments.roundSchedule} = ... inside a sql`` template. Only the
//   repository may write it, in one place.
// - a read or parse of the column: parseJsonArray or JSON.parse of
//   round_schedule (or roundSchedule), SQL text that selects round_schedule
//   from tournaments, tournaments.roundSchedule in a Drizzle query,
//   .round_schedule or ['round_schedule'] read off a row, .roundSchedule
//   read off anything but a request body (`body`), and a call of the legacy
//   reader normalizeRoundSchedule. Only the repository may do these;
//   domain/ is not scanned (normalizeRoundSchedule lives there).
//
// sections-reader-audit.test.ts already fails on a handler that answers a
// SELECT * row without toTournamentResponse, which drops the column's text.
// Like the other audits, this is a guard on the source text, not a proof.
// The migrations are not scanned; the 0053 sync trigger reads and writes the
// column on purpose.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const REPO = 'functions/utils/events/schedulesRepo.ts'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name === 'dist' || name === '.wrangler') return []
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx|js|mjs|cjs)$/.test(name) ? [path] : []
  })
}

// ── A small lexer: comments out, string contents set apart ─────────────

interface Lexed {
  /** The source with comments blanked (same length, line breaks kept). */
  code: string
  /** The same, with the inside of every string literal blanked too (a template's ${...} code is kept). */
  masked: string
  /** The text inside each string literal; a template keeps its ${...} parts as written. */
  literals: string[]
}

const WORD = /[\w$]/
const REGEX_AFTER = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^'])
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'await'])

export function lex(src: string): Lexed {
  const code = src.split('')
  const masked = src.split('')
  const literals: string[] = []
  const n = src.length
  const blank = (arrays: string[][], from: number, to: number) => {
    for (const a of arrays) for (let k = from; k < to; k++) if (a[k] !== '\n') a[k] = ' '
  }

  function scanString(i: number): number {
    const quote = src[i]
    let j = i + 1
    while (j < n && src[j] !== quote && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1
    literals.push(src.slice(i + 1, j))
    blank([masked], i + 1, j)
    return j + 1
  }

  function scanTemplate(i: number): number {
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
    literals.push(text)
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

// ── Writes ──────────────────────────────────────────────────────────────

/** The text after `from` up to the end of the builder chain (its .where, a semicolon or a blank line). */
function chainAfter(text: string, from: number): string {
  const rest = text.slice(from, from + 4000)
  const end = rest.search(/\.where\(|;|\n\s*\n/)
  return end === -1 ? rest : rest.slice(0, end)
}

/** Each way the text writes tournaments.round_schedule, as a short description. Comments do not count. */
export function roundScheduleWrites(text: string): string[] {
  const { code, masked, literals } = lex(text)
  const found: string[] = []
  for (const sql of literals) {
    for (const m of sql.matchAll(/\bUPDATE\s+["`[]?tournaments["`\]]?\s+SET\b([\s\S]*?)(?:\bWHERE\b|$)/gi)) {
      if (/(?:^|[\s,(])["`[]?round_schedule["`\]]?\s*=(?!=)/i.test(m[1])) found.push('UPDATE tournaments SET round_schedule')
    }
    for (const m of sql.matchAll(/\bINSERT\s+(?:OR\s+\w+\s+)?INTO\s+["`[]?tournaments["`\]]?\s*\(([^)]*)\)/gi)) {
      if (/\bround_schedule\b/i.test(m[1])) found.push('INSERT INTO tournaments (round_schedule)')
    }
    if (/\bREPLACE\s+INTO\s+["`[]?tournaments["`\]]?[\s(]/i.test(sql)) found.push('REPLACE INTO tournaments')
  }
  for (const m of masked.matchAll(/\.(update|insert)\(\s*tournaments\s*\)/g)) {
    const chain = chainAfter(code, (m.index ?? 0) + m[0].length)
    if (/[{,]\s*roundSchedule\s*(?::|,|\})/.test(chain) || /\[\s*tournaments\.roundSchedule\s*\]/.test(chain)) {
      found.push(`Drizzle .${m[1]}(tournaments) with roundSchedule`)
    }
  }
  if (/\$\{\s*tournaments\.roundSchedule\s*\}\s*=(?!=)/.test(code)) found.push('sql`${tournaments.roundSchedule} = ...`')
  return found
}

// ── Reads ───────────────────────────────────────────────────────────────

const COLUMN = /round_schedule|roundSchedule/

/** SQL that names tournaments.round_schedule in a SELECT. */
export function selectsRoundScheduleColumn(sql: string): boolean {
  return /\bSELECT\b/i.test(sql) && /\b(?:FROM|JOIN)\s+["`]?tournaments["`]?(?![\w])/i.test(sql)
    && /(?<![\w$])(?:[A-Za-z_]\w*\.)?["`[]?round_schedule["`\]]?(?![\w$])/i.test(sql)
}

/** Each way the text reads or parses tournaments.round_schedule outside the repository, as a short description. */
export function roundScheduleReads(text: string): string[] {
  const { code, masked, literals } = lex(text)
  const found: string[] = []
  for (const m of masked.matchAll(/(?<![\w$.])(parseJsonArray|JSON\.parse)\s*\(\s*([^),]*)/g)) {
    const from = (m.index ?? 0) + m[0].length - m[2].length
    if (COLUMN.test(code.slice(from, from + m[2].length))) found.push(`${m[1]} of round_schedule`)
  }
  for (const sql of literals) {
    if (selectsRoundScheduleColumn(sql)) found.push('SQL selecting tournaments.round_schedule')
  }
  if (/\btournaments\s*\.\s*roundSchedule\b/.test(masked)) found.push('Drizzle tournaments.roundSchedule')
  if (/(?:\?\.|\.)\s*round_schedule\b/.test(masked) || /\[\s*['"`]round_schedule['"`]\s*\]/.test(code)) {
    found.push('round_schedule read off a row')
  }
  for (const m of masked.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*!?\s*\??\.\s*roundSchedule\b/g)) {
    if (m[1] !== 'body' && m[1] !== 'tournaments') found.push(`${m[1]}.roundSchedule`)
  }
  for (const m of masked.matchAll(/\bnormalizeRoundSchedule\s*\(/g)) {
    const before = masked.slice(Math.max(0, (m.index ?? 0) - 20), m.index)
    if (!/function\s*$/.test(before)) found.push('normalizeRoundSchedule()')
  }
  return found
}

// ── The scan ────────────────────────────────────────────────────────────

describe('one writer and reader for tournaments.round_schedule (K2g)', () => {
  const files = ['functions', 'workers'].flatMap((d) => sourceFiles(join(ROOT, d)))
  const named = files.map((f) => ({ file: relative(ROOT, f).split('\\').join('/'), text: readFileSync(f, 'utf8') }))

  it('scans every handler that answers with a tournament, both repositories and both workers', () => {
    expect(named.map((f) => f.file)).toEqual(expect.arrayContaining([
      'functions/api/tournaments.ts',
      'functions/api/tournaments/[id].ts',
      'functions/api/admin/tournaments.ts',
      'functions/api/admin/tournaments/[id].ts',
      'functions/api/admin/tournaments/[id]/registration.ts',
      'functions/api/admin/tournaments/[id]/manage.ts',
      'functions/utils/events/sectionsRepo.ts',
      REPO,
      'workers/daily-emails/src/index.ts',
      'workers/clearinghouse-sync/index.ts',
    ]))
  })

  it('finds a write to the column only in schedulesRepo, once', () => {
    const writers = named
      .map((f) => ({ file: f.file, writes: roundScheduleWrites(f.text) }))
      .filter((w) => w.writes.length > 0)
    expect(writers).toEqual([{ file: REPO, writes: ['Drizzle .update(tournaments) with roundSchedule'] }])
  })

  it('finds no read or parse of the column outside schedulesRepo', () => {
    const readers = named
      .filter((f) => f.file !== REPO)
      .map((f) => ({ file: f.file, reads: roundScheduleReads(f.text) }))
      .filter((f) => f.reads.length > 0)
    expect(readers).toEqual([])
  })

  it('every handler that answers with a tournament reads the schedules from the repository', () => {
    const answering = named.filter((f) => f.file.startsWith('functions/api/') && /\btoTournamentResponse\s*\(/.test(lex(f.text).masked))
    expect(answering.map((f) => f.file).sort()).toEqual([
      'functions/api/admin/tournaments.ts',
      'functions/api/admin/tournaments/[id].ts',
      'functions/api/admin/tournaments/[id]/manage.ts',
      'functions/api/admin/tournaments/[id]/registration.ts',
      'functions/api/tournaments.ts',
      'functions/api/tournaments/[id].ts',
    ])
    for (const f of answering) expect(lex(f.text).masked, f.file).toMatch(/\bloadSchedules(?:For)?\s*\(/)
  })
})

// ── What the audit sees ─────────────────────────────────────────────────

describe('the writer audit sees each way of writing the column', () => {
  it('SQL text', () => {
    expect(roundScheduleWrites("db.prepare('UPDATE tournaments SET name = ?, round_schedule = ? WHERE id = ?')")).toHaveLength(1)
    expect(roundScheduleWrites('`UPDATE tournaments SET\n  entry_fee = ?,\n  round_schedule = ?\n WHERE id = ?`')).toHaveLength(1)
    expect(roundScheduleWrites('"update Tournaments set round_schedule=? where id=?"')).toHaveLength(1)
    expect(roundScheduleWrites('`INSERT INTO tournaments (id, name, round_schedule) VALUES (?, ?, ?)`')).toHaveLength(1)
    expect(roundScheduleWrites("'REPLACE INTO tournaments SELECT * FROM backup'")).toHaveLength(1)
  })

  it('Drizzle, as the admin edit wrote it before this step and with shorthand', () => {
    expect(roundScheduleWrites('db.update(tournaments).set({\n  name: body.name ?? existing.name,\n  roundSchedule: roundSchedule ?? null,\n}).where(eq(tournaments.id, id))')).toHaveLength(1)
    expect(roundScheduleWrites('db.update(tournaments)\n  .set({\n    roundSchedule,\n  })\n  .where(x)')).toHaveLength(1)
    expect(roundScheduleWrites("db.insert(tournaments).values({ id, roundSchedule: '[]' })")).toHaveLength(1)
    expect(roundScheduleWrites('db.update(tournaments).set({ [tournaments.roundSchedule]: x })')).toHaveLength(1)
    expect(roundScheduleWrites('sql`UPDATE ${tournaments} SET ${tournaments.roundSchedule} = ${json}`')).toHaveLength(1)
  })

  it('leaves alone other columns and tables, reads, comments and request bodies', () => {
    expect(roundScheduleWrites("'UPDATE tournaments SET sections = ? WHERE round_schedule = ?'")).toEqual([])
    expect(roundScheduleWrites("'UPDATE tournament_schedule_rounds SET time = ? WHERE schedule_id = ?'")).toEqual([])
    expect(roundScheduleWrites("'SELECT round_schedule FROM tournaments'")).toEqual([])
    expect(roundScheduleWrites('db.update(tournaments).set({ name, roundScheduleCount: 2 }).where(x)')).toEqual([])
    expect(roundScheduleWrites('db.update(tournamentSchedules).set({ label }).where(x); const roundSchedule = 1')).toEqual([])
    expect(roundScheduleWrites('// db.update(tournaments).set({ roundSchedule })\n/* UPDATE tournaments SET round_schedule = ? */')).toEqual([])
    expect(roundScheduleWrites('if (body.roundSchedule !== undefined) save({ roundSchedule: body.roundSchedule })')).toEqual([])
  })
})

describe('the reader audit sees each way of reading the column', () => {
  it('the readers as they were before this step', () => {
    // The event page and the manage page (step 11 and before).
    expect(roundScheduleReads('const roundSchedule = parseJsonArray(tournament.round_schedule as string)'))
      .toEqual(['parseJsonArray of round_schedule', 'round_schedule read off a row'])
    // toTournamentResponse until this step.
    expect(roundScheduleReads('round_schedule: schedules ? [...schedules] : parseJsonArray(row.round_schedule),'))
      .toEqual(['parseJsonArray of round_schedule', 'round_schedule read off a row'])
    // The admin edit kept the stored text when no schedule was sent.
    expect(roundScheduleReads('const roundSchedule = body.roundSchedule !== undefined\n  ? JSON.stringify(body.roundSchedule)\n  : existing.roundSchedule'))
      .toEqual(['existing.roundSchedule'])
  })

  it('parses, SQL, Drizzle and bracket reads', () => {
    expect(roundScheduleReads('const s = JSON.parse(row!.round_schedule)')).toEqual(['JSON.parse of round_schedule', 'round_schedule read off a row'])
    expect(roundScheduleReads('function f(roundScheduleJson: string) { return JSON.parse(roundScheduleJson) }')).toEqual(['JSON.parse of round_schedule'])
    expect(roundScheduleReads("db.prepare('SELECT id, round_schedule FROM tournaments WHERE id = ?')")).toEqual(['SQL selecting tournaments.round_schedule'])
    expect(roundScheduleReads('db.prepare(`SELECT t.id,\n  t.round_schedule\n FROM tournaments t`)')).toEqual(['SQL selecting tournaments.round_schedule'])
    expect(roundScheduleReads('db.select({ r: tournaments.roundSchedule }).from(tournaments)')).toEqual(['Drizzle tournaments.roundSchedule'])
    expect(roundScheduleReads("const text = row['round_schedule']")).toEqual(['round_schedule read off a row'])
    expect(roundScheduleReads('const text = row?.round_schedule')).toEqual(['round_schedule read off a row'])
    expect(roundScheduleReads('const [t] = await db.select().from(tournaments)\nconst text = t.roundSchedule')).toEqual(['t.roundSchedule'])
    expect(roundScheduleReads('const rounds = normalizeRoundSchedule(text)')).toEqual(['normalizeRoundSchedule()'])
  })

  it('leaves alone the tables, other columns, answers built by key, comments, strings and request bodies', () => {
    expect(roundScheduleReads("db.prepare('SELECT * FROM tournament_schedule_rounds WHERE schedule_id = ?')")).toEqual([])
    expect(roundScheduleReads("db.prepare('SELECT id, name FROM tournaments WHERE id = ?')")).toEqual([])
    expect(roundScheduleReads('const d = parseJsonArray(t.custom_details)\nconst b = JSON.parse(r.bye_rounds as string)')).toEqual([])
    expect(roundScheduleReads('const answer = { ...row, round_schedule: roundScheduleResponse(live) }')).toEqual([])
    expect(roundScheduleReads("type R = Omit<Row, 'sections' | 'round_schedule'>\ninterface T { round_schedule: string | null }")).toEqual([])
    expect(roundScheduleReads('// parseJsonArray(t.round_schedule) was here\n/* JSON.parse(row.round_schedule) */')).toEqual([])
    expect(roundScheduleReads("const help = 'parseJsonArray(t.round_schedule) is gone'")).toEqual([])
    expect(roundScheduleReads('if (body.roundSchedule !== undefined) schedules = { roundSchedule: body.roundSchedule }')).toEqual([])
    expect(roundScheduleReads('const r = roundScheduleResponse(x)\nconst j = roundScheduleJson(y)')).toEqual([])
    expect(roundScheduleReads('export function normalizeRoundSchedule(value: unknown) {}')).toEqual([])
    expect(roundScheduleReads('const ok = /round_schedule/.test(s)')).toEqual([])
  })
})

describe('a handler file planted among the others is found by the same scan', () => {
  it('one that parses the column and one that writes it; a clean one passes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'schedules-audit-'))
    try {
      mkdirSync(join(dir, 'api'), { recursive: true })
      writeFileSync(join(dir, 'api', 'planted-read.ts'), [
        "import { parseJsonArray } from '../utils/json'",
        '',
        'export function rounds(t: { round_schedule: string }) {',
        '  return parseJsonArray(t.round_schedule)',
        '}',
        '',
      ].join('\n'))
      writeFileSync(join(dir, 'api', 'planted-write.ts'), [
        'export async function save(db: D1Database, id: string, rounds: unknown[]) {',
        "  await db.prepare('UPDATE tournaments SET round_schedule = ? WHERE id = ?').bind(JSON.stringify(rounds), id).run()",
        '}',
        '',
      ].join('\n'))
      writeFileSync(join(dir, 'api', 'clean.ts'), [
        "import { loadSchedules } from '../utils/events/schedulesRepo'",
        '',
        'export async function rounds(db: Db, id: string) {',
        '  return (await loadSchedules(db, id)).find((s) => s.isPrimary)?.rounds ?? []',
        '}',
        '',
      ].join('\n'))
      const scanned = sourceFiles(dir).map((f) => ({ file: relative(dir, f).split('\\').join('/'), text: readFileSync(f, 'utf8') }))
      expect(scanned.map((f) => f.file).sort()).toEqual(['api/clean.ts', 'api/planted-read.ts', 'api/planted-write.ts'])
      expect(scanned.filter((f) => roundScheduleReads(f.text).length > 0).map((f) => f.file)).toEqual(['api/planted-read.ts'])
      expect(scanned.filter((f) => roundScheduleWrites(f.text).length > 0).map((f) => f.file)).toEqual(['api/planted-write.ts'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
