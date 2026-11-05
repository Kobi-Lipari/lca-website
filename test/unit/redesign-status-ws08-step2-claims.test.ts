// test/unit/redesign-status-ws08-step2-claims.test.ts
//
// The WS08 step 2 record's claims that its own record test,
// test/unit/redesign-status-ws08-step2.test.ts, leaves open, checked against
// the files they are about:
// - the migration is the brief's 00xx_ticket_kinds.sql, statement for
//   statement, and the brief's three ticket kinds are the ones schema.ts and
//   the migration's header name; publish_at is the brief's Phase 2 column,
//   in 00xx_console.sql, which only the setup checklist's Publish step
//   writes, and 0059 leaves it out;
// - the two "Built in WS08 step 2" sentences of the map name columns 0059
//   adds, as they say them;
// - 0059 is the next number after 0058, and migrations/README.md names the
//   ticket kinds 0059 and the number the generator gives next;
// - the contract's key is stored time, and MANAGER_ONLY_TOURNAMENT_KEYS has
//   it right after the trim's three, in the order of its sorted keys;
// - the verify items: the six handlers named each read the whole row and
//   answer through toTournamentResponse, and every such answer outside
//   Admin goes through the trim; the four support answers named each read
//   the whole ticket, while the board's ticket views name their columns;
//   and 0027's index, which refuses a second current term, still stands;
// - the merge of checkpoint J: migrate-db.yml applies the migrations folder
//   to production on a push to main, deploy-worker.yml redeploys the
//   worker on a change under domain/ or functions/utils/, and none of
//   checkpoint J's four files of code there is in the worker's imports;
//   and the create's insert and the setup save's read name every column of
//   tournaments through Drizzle: without 0059 the insert fails, while the
//   read, whose names stand unqualified in double quotes, passes where
//   SQLite reads a name it cannot find as a string, as D1 does, and both
//   run with 0059;
// - the follow-up for K: it quotes ordering rule 2 word for word, nothing
//   migrates lca-db-preview on its own, and the preview's migrate script
//   runs the guard before wrangler.
// It reads the WS08 section of REDESIGN_STATUS.md, ordering rule 2, which
// the follow-up quotes, and the files the section names.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { eq } from 'drizzle-orm'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { MANAGER_ONLY_TOURNAMENT_KEYS } from '../../domain/contracts/events'
import { getDb } from '../../functions/db/client'
import { tournaments } from '../../functions/db/schema'
import { nextMigrationNumber } from '../../scripts/db/generate'
import { splitSql } from '../shared/splitSql'
import { applyMigrations, migrationFiles, openMigratedDb } from './helpers/sqlite'
import { block, fileLines } from './helpers/workflow'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')
const spec = read('docs/redesign/REDESIGN_SPEC.md')

const HEADING = '## WS08: Director and admin tools (TD console, setup checklist, admin home and queues)'
const ws08 = (() => {
  const start = status.indexOf(`\n${HEADING}\n`)
  const end = status.indexOf('\n## WS09:', start + 1)
  return start < 0 ? '' : status.slice(start + 1, end < 0 ? undefined : end)
})()
/** A part of the section, from its heading to the next heading. */
const part = (heading: string) => {
  const at = ws08.indexOf(`\n${heading}\n`)
  if (at < 0) return ''
  const next = ws08.indexOf('\n### ', at + heading.length + 1)
  return ws08.slice(at + 1, next < 0 ? undefined : next)
}
const entries = (text: string) => text.split('\n').filter((l) => l.startsWith('- **'))
const entryOf = (text: string, head: string) => entries(text).find((l) => l.startsWith(`- **${head}`)) ?? ''
/** A bullet of the step's block and the indented lines under it. */
const bulletOf = (text: string, start: string) => {
  const lines = text.split('\n')
  const at = lines.findIndex((l) => l.startsWith(start))
  if (at < 0) return ''
  let end = at + 1
  while (end < lines.length && /^\s+\S/.test(lines[end])) end++
  return lines.slice(at, end).join('\n')
}
const map = part('### WS08 map: what proves each acceptance criterion and decision')
const block2 = part('### WS08 step 2: migration 0059, the ticket kinds and the review mark')
const verify = part('### WS08 verify items resolved')
const followUps = ws08.slice(ws08.indexOf('\n### WS08 follow-ups\n') + 1)
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''

const MIGRATION = 'migrations/0059_ticket_kinds.sql'
const migrationText = read(MIGRATION)
/** A statement as comparable text: no comment, no quoting, no COLUMN keyword, one case, single spaces. */
const normalise = (statement: string) =>
  statement.replace(/--.*$/gm, '').replace(/[`;]/g, '').replace(/\bCOLUMN\b/gi, '').replace(/\s+/g, ' ').trim().toLowerCase()
const migrationStatements = splitSql(migrationText).map(normalise)
/** The brief's block for a migration, from its comment line to the next migration's. */
const briefBlock = (name: string) => {
  const lines = spec.split('\n')
  const at = lines.findIndex((l) => l.startsWith(`-- ${name} `))
  if (at < 0) return [] as string[]
  const end = lines.findIndex((l, i) => i > at && /^-- 00xx_/.test(l))
  return lines.slice(at, end < 0 ? undefined : end)
}
const quotedKinds = (text: string) => [...text.matchAll(/'([a-z]+_[a-z_]+)'/g)].map((m) => m[1])

describe('the migration is the brief\'s 00xx_ticket_kinds.sql', () => {
  const brief = briefBlock('00xx_ticket_kinds.sql')

  it('puts it in Phase 1, ahead of WS04, as the deviation says', () => {
    expect(brief[0]).toMatch(/^-- 00xx_ticket_kinds\.sql \(Phase 1, ahead of WS04, section 4\)/)
    const deviation = entryOf(part('### WS08 deviations from the brief'), 'The migration is Phase 1\'s, ahead of WS04 (WS08 step 2).')
    for (const piece of ['`00xx_ticket_kinds.sql`', 'Phase 1 ahead of WS04 (section 4)', '`0059_ticket_kinds.sql`', '`0058_state_champion_2026.sql`']) {
      expect(deviation, piece).toContain(piece)
    }
  })

  it('holds the brief\'s three statements, in the brief\'s order, and nothing else', () => {
    const statements = brief.filter((l) => l.startsWith('ALTER TABLE')).map(normalise)
    expect(statements).toEqual([
      'alter table support_tickets add kind text',
      'alter table support_tickets add about_id text',
      'alter table tournaments add review_notified_at text',
    ])
    expect(migrationStatements).toEqual(statements)
  })

  it('names the brief\'s three kinds in schema.ts\'s comment over the column and in its own header', () => {
    const kinds = quotedKinds(brief.find((l) => /ADD COLUMN kind\b/.test(l)) ?? '')
    expect(kinds).toEqual(['listing_report', 'event_report', 'payout_request'])
    const schema = read('functions/db/schema.ts').split('\n')
    const column = schema.findIndex((l) => /^\s+kind: text\(\),$/.test(l))
    expect(column).toBeGreaterThan(0)
    expect(schema[column - 1]).toMatch(/^\s+\/\/ /)
    expect(quotedKinds(schema[column - 1])).toEqual(kinds)
    const header = migrationText.split('\n').filter((l) => l.startsWith('-- ') && !l.startsWith('-->')).join('\n')
    expect(quotedKinds(header)).toEqual(kinds)
    for (const kind of kinds) expect(bulletOf(block2, '- **The columns.**'), kind).toContain(`\`${kind}\``)
  })

  it('leaves publish_at out, as the brief does: it is Phase 2\'s, in 00xx_console.sql, and only the setup checklist\'s Publish step writes it', () => {
    const consoleBlock = briefBlock('00xx_console.sql')
    expect(consoleBlock[0]).toMatch(/^-- 00xx_console\.sql \(Phase 2, tdConsole\)/)
    expect(consoleBlock.map(normalise)).toContain('alter table tournaments add publish_at text')
    expect(spec.split('\n').filter((l) => l.includes('`tournaments.publish_at`'))).toEqual([expect.stringMatching(/^\s+10\. \*\*Publish:\*\*/)])
    expect(migrationText).not.toMatch(/publish_at/i)
    expect(bulletOf(block2, '- **The columns.**')).toContain('`publish_at` is not among them')
  })
})

describe('what the record says of the migration elsewhere', () => {
  it('the two "Built in WS08 step 2" sentences name columns 0059 adds, nullable, on the tables they say', () => {
    const ac13 = /Built in WS08 step 2: the column, `(\w+)\.(\w+)`, nullable, in migration 0059\./.exec(mapItem('AC13'))
    expect(ac13, 'AC13').not.toBeNull()
    expect(migrationStatements).toContain(`alter table ${ac13![1]} add ${ac13![2]} text`)
    const ac15 = /Built in WS08 step 2: the ticket's `(\w+)` and `(\w+)` columns\./.exec(mapItem('AC15'))
    expect(ac15, 'AC15').not.toBeNull()
    for (const column of [ac15![1], ac15![2]]) expect(migrationStatements).toContain(`alter table support_tickets add ${column} text`)
    expect(migrationText.replace(/--.*$/gm, '')).not.toMatch(/NOT NULL|DEFAULT/i)
  })

  it('0059 is the next number after 0058, the only file with it, and migrations/README.md names it and the number the generator gives next', () => {
    const files = migrationFiles()
    expect(files.indexOf('0059_ticket_kinds.sql')).toBe(files.indexOf('0058_state_champion_2026.sql') + 1)
    expect(files.filter((f) => f.startsWith('0059_'))).toEqual(['0059_ticket_kinds.sql'])
    const readme = read('migrations/README.md').replace(/\s+/g, ' ')
    const next = nextMigrationNumber(readdirSync(join(ROOT, 'migrations')))
    expect(readme).toContain('the ticket kinds `0059`')
    expect(readme).toContain(`\`${next}\` is next`)
    expect(readme).toContain(`\`${next}_club_notes.sql\``)
  })

  it('names the journal\'s ninth entry and its snapshot as drizzle/meta holds them', () => {
    const journal = JSON.parse(read('drizzle/meta/_journal.json')) as { entries: Array<{ idx: number; tag: string }> }
    const ninth = journal.entries[8]
    expect(ninth.idx).toBe(8)
    expect(bulletOf(block2, '- **Files.**')).toContain(`(its ninth entry, \`${ninth.tag}\`)`)
    const snapshot = `${ninth.tag.slice(0, 4)}_snapshot.json`
    expect(existsSync(join(ROOT, 'drizzle/meta', snapshot)), snapshot).toBe(true)
    const generator = entryOf(verify, 'The generator runs with no terminal (WS08 step 2).')
    expect(generator).toContain(`\`${snapshot}\``)
    expect(generator).toContain(`staged as \`drizzle/${ninth.tag}.sql\``)
    expect(migrationText).toContain(`-- staged as drizzle/${ninth.tag}.sql.`)
  })
})

describe('the contract', () => {
  it('names the key once, as stored time and nullable, as the decision says', () => {
    const source = read('domain/contracts/events.ts').split('\n')
    expect(source.filter((l) => /^\s+review_notified_at:/.test(l))).toEqual(['  review_notified_at: storedTimestampSchema.nullable(),'])
    expect(entryOf(part('### WS08 decisions'), 'The mark is database time (WS08 step 2).')).toContain('`storedTimestampSchema`')
  })

  it('puts the key in MANAGER_ONLY_TOURNAMENT_KEYS right after the trim\'s three, in the order the sorted keys take', () => {
    const keys = [...MANAGER_ONLY_TOURNAMENT_KEYS]
    expect(keys.slice(0, 4)).toEqual(['created_by', 'keep_apart', 'report_settings', 'review_notified_at'])
    expect([...keys].sort()).toEqual(keys)
  })
})

// ── The verify items, read against the code ──────────────────────────

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = `${dir}/${name}`
    if (statSync(join(ROOT, path)).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

/** The string literals of a file, a template's parts joined, and the names it calls, with comments never read. */
function literalsAndCalls(path: string): { strings: string[]; calls: string[] } {
  const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true)
  const strings: string[] = []
  const calls: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) strings.push(node.text)
    else if (ts.isTemplateExpression(node)) strings.push([node.head.text, ...node.templateSpans.map((s) => `\${} ${s.literal.text}`)].join(''))
    if (ts.isCallExpression(node)) calls.push(node.expression.getText(source))
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { strings, calls }
}
const FUNCTIONS = sourceFiles('functions').map((path) => ({ path, ...literalsAndCalls(path) }))
const WHOLE_TOURNAMENT = /\bSELECT\s+(?:\w+\.)?\*[\s\S]*?\bFROM\s+tournaments\b/i
const WHOLE_TICKET = /\bSELECT\s+(?:\w+\.)?\*[\s\S]*?\bFROM\s+support_tickets\b/i

describe('the verify items, read against the code', () => {
  it('the six handlers "Every tournament answer spreads the row" names each read the whole row and answer through toTournamentResponse, and no answer outside Admin skips the trim', () => {
    const SIX = [
      'functions/api/tournaments.ts', 'functions/api/tournaments/[id].ts', 'functions/api/admin/tournaments.ts',
      'functions/api/admin/tournaments/[id].ts', 'functions/api/admin/tournaments/[id]/manage.ts', 'functions/api/admin/tournaments/[id]/registration.ts',
    ]
    const item = entryOf(verify, 'Every tournament answer spreads the row (WS08 step 2).')
    for (const path of SIX.slice(0, 4)) expect(item, path).toContain(`\`${path}\``)
    expect(item).toContain('the event\'s `manage.ts` and `registration.ts`')
    const answering = FUNCTIONS.filter((f) => f.calls.includes('toTournamentResponse'))
    for (const path of SIX) {
      const file = answering.find((f) => f.path === path)
      expect(file, path).toBeDefined()
      expect(file!.strings.some((s) => WHOLE_TOURNAMENT.test(s)), path).toBe(true)
    }
    // The routes outside Admin answer anyone who asks, so each one takes the manager-only keys, the mark among them, out for a non-manager.
    const outside = answering.filter((f) => !f.path.startsWith('functions/api/admin/'))
    expect(outside.map((f) => f.path)).toEqual(expect.arrayContaining(['functions/api/tournaments.ts', 'functions/api/tournaments/[id].ts']))
    for (const file of outside) expect(file.calls, file.path).toContain('publicTournamentAnswer')
  })

  it('the four support answers the block names each read the whole ticket, while the board\'s ticket views name their columns', () => {
    const ships = bulletOf(block2, '- **What ships with every switch off.**')
    const FOUR: Record<string, string> = {
      'GET /api/support': 'functions/api/support.ts',
      'GET /api/support/[id]': 'functions/api/support/[id].ts',
      'GET /api/admin/support': 'functions/api/admin/support.ts',
      'GET /api/admin/support/[id]': 'functions/api/admin/support/[id].ts',
    }
    for (const route of Object.keys(FOUR)) expect(ships, route).toContain(`\`${route}\``)
    const readers = FUNCTIONS.filter((f) => f.strings.some((s) => WHOLE_TICKET.test(s))).map((f) => f.path)
    expect(readers).toEqual(expect.arrayContaining(Object.values(FOUR)))
    const board = FUNCTIONS.filter((f) => f.path.startsWith('functions/api/board/tickets'))
    expect(board.length).toBeGreaterThan(0)
    for (const file of board) expect(file.strings.some((s) => /\bFROM\s+support_tickets\b/i.test(s)), file.path).toBe(true)
    for (const file of board) expect(readers, file.path).not.toContain(file.path)
  })

  it('0027\'s index, which refuses a second current term for the same member, stands, as the judgement call on seedPresident says', () => {
    expect(read('migrations/0027_shared_seats.sql').replace(/\s+/g, ' '))
      .toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_seat_member_current ON board_seat_assignments(seat_id, member_id) WHERE ended_at IS NULL;')
    for (const file of migrationFiles().filter((f) => f > '0027')) {
      expect(read(`migrations/${file}`).replace(/--.*$/gm, ''), file).not.toMatch(/DROP INDEX[^;]*idx_seat_member_current/i)
    }
    expect(bulletOf(block2, '- **Judgement calls.**')).toContain('a second current term for the same member is refused by 0027\'s index')
  })
})

// ── The merge of checkpoint J ────────────────────────────────────────

/** The file a relative import names, as a bundler finds it: the path, with .ts or .tsx, or its folder's index. */
function resolveImport(from: string, specifier: string): string | null {
  const base = resolve(dirname(join(ROOT, from)), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return relative(ROOT, candidate)
  }
  return null
}

/** Every file an entry reaches through relative imports and re-exports, types included. */
function closure(entry: string): Set<string> {
  const files = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.shift()!
    if (files.has(file)) continue
    files.add(file)
    for (const { fileName } of ts.preProcessFile(read(file), true, true).importedFiles) {
      if (!fileName.startsWith('.')) continue
      const found = resolveImport(file, fileName)
      expect(found, `${file}: ${fileName}`).not.toBeNull()
      queue.push(found!)
    }
  }
  return files
}

/**
 * The files of functions/ with a Drizzle query that names every column of
 * tournaments from the schema: an insert, a select of no fields, or the
 * relational query API. Such a query fails on a database that lacks a
 * column the schema names.
 */
function fullColumnQueries(): string[] {
  return sourceFiles('functions').filter((path) => {
    const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true)
    let found = false
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && node.arguments.length === 1 && node.arguments[0].getText(source) === 'tournaments') {
        const { name, expression } = node.expression
        const selectAll = name.text === 'from' && ts.isCallExpression(expression) && expression.arguments.length === 0
          && ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text === 'select'
        if (name.text === 'insert' || selectAll) found = true
      }
      if (ts.isPropertyAccessExpression(node) && node.name.text === 'tournaments'
        && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'query') found = true
      ts.forEachChild(node, visit)
    }
    visit(source)
    return found
  }).sort()
}

/** A query Drizzle built, run on a node:sqlite database. */
type Built = { sql: string; params: unknown[] }
const runBuilt = (db: DatabaseSync, query: Built) => db.prepare(query.sql).run(...(query.params as Array<string | number | null>))
const rowsOf = (db: DatabaseSync, query: Built) => db.prepare(query.sql).all(...(query.params as Array<string | number | null>))

/** Checkpoint J's files of code under the two folders the worker's deploy watches: WS08 step 1's two and WS08 step 2's two. */
const CHECKPOINT_J_SHARED = ['domain/events/creation.ts', 'functions/utils/events/creation.ts', 'domain/contracts/events.ts', 'functions/utils/events/publicAnswer.ts']

describe('what the merge of checkpoint J does, as the block says', () => {
  const merge = bulletOf(block2, '- **What the merge of checkpoint J does.**')

  it('migrate-db.yml applies the migrations folder to production, and only production, on a push to main', () => {
    const text = read('.github/workflows/migrate-db.yml')
    expect(text).toMatch(/\n {2}push:\n {4}branches: \[main\]\n {4}paths: \['migrations\/\*\*'\]\n/)
    expect(text).toContain('run: npx wrangler d1 migrations apply lca-db --remote')
    expect(text).not.toContain('lca-db-preview')
    expect(existsSync(join(ROOT, MIGRATION))).toBe(true)
    expect(merge).toContain('`migrate-db.yml` applies 0059 to production')
  })

  it('deploy-worker.yml redeploys the worker on a push to main under domain/ or functions/utils/, where checkpoint J changes files', () => {
    const lines = fileLines('.github/workflows/deploy-worker.yml')
    const paths = block(lines, /^ {4}paths:$/).map((l) => l.trim())
    expect(paths).toEqual(expect.arrayContaining(["- 'functions/utils/**'", "- 'domain/**'"]))
    expect(block(lines, /^ {2}push:$/).map((l) => l.trim())).toContain('branches: [main]')
    for (const file of CHECKPOINT_J_SHARED) expect(file).toMatch(/^(?:domain|functions\/utils)\//)
    for (const file of ['domain/contracts/events.ts', 'functions/utils/events/publicAnswer.ts']) expect(merge, file).toContain(`\`${file}\``)
  })

  it('bundles none of checkpoint J\'s four files of code there, so the worker it redeploys is the one that runs today', () => {
    const files = closure('workers/daily-emails/src/index.ts')
    for (const usual of ['functions/utils/time.ts', 'functions/utils/email.ts', 'domain/format/centralTime.ts']) expect([...files], usual).toContain(usual)
    for (const file of CHECKPOINT_J_SHARED) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect([...files], file).not.toContain(file)
    }
    expect(merge).toContain('none of those files is in its import closure')
  })

  it('the create and the setup save name every column of tournaments through Drizzle: without 0059 the insert fails and the read passes where SQLite reads a name it cannot find as a string, as D1 does, and both run with 0059', () => {
    // Among the queries that do, not the only ones: a later step may read tournaments the same way.
    expect(fullColumnQueries()).toEqual(expect.arrayContaining(['functions/api/admin/tournaments.ts', 'functions/api/admin/tournaments/[id].ts']))
    // The two queries as the handlers build them, on the Drizzle the handlers use; building one sends nothing anywhere.
    const db = getDb({} as never)
    const insert = db.insert(tournaments).values({ id: 'probe-1', name: 'Bayou Open', location: 'Houma, LA', date: '2026-12-12' }).toSQL()
    const select = db.select().from(tournaments).where(eq(tournaments.id, 'probe-1')).toSQL()
    for (const query of [insert, select]) expect(query.sql).toContain('"review_notified_at"')
    // The read names every column on its own, unqualified, in double quotes, the mark among them.
    expect(select.sql).toMatch(/^select (?:"\w+", )*"review_notified_at"(?:, "\w+")* from "tournaments" where /)
    const files = migrationFiles().filter((f) => f < '0059')
    const before = openMigratedDb({ files })
    expect(() => runBuilt(before, insert)).toThrow(/table tournaments has no column named review_notified_at/)
    // node:sqlite, opened as these tests open it, refuses a double-quoted name it cannot find, where D1 reads it as a string.
    expect(() => rowsOf(before, select)).toThrow(/no such column: "?review_notified_at/)
    // Opened to read such a name as D1 does, a database without 0059 still refuses the insert, and answers the read
    // with the text of the mark's name in the mark's place, as the setup save gets it.
    const asD1 = new DatabaseSync(':memory:', { enableDoubleQuotedStringLiterals: true })
    asD1.exec('PRAGMA foreign_keys = ON')
    applyMigrations(asD1, files)
    expect(() => runBuilt(asD1, insert)).toThrow(/table tournaments has no column named review_notified_at/)
    asD1.prepare('INSERT INTO tournaments (id, name, location, date) VALUES (?, ?, ?, ?)').run('probe-1', 'Bayou Open', 'Houma, LA', '2026-12-12')
    const names = [...select.sql.slice(0, select.sql.indexOf(' from ')).matchAll(/"(\w+)"/g)].map((m) => m[1])
    const rows = rowsOf(asD1, select) as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
    const values = Object.values(rows[0])
    expect(values).toHaveLength(names.length)
    expect(values[names.indexOf('id')]).toBe('probe-1')
    expect(values[names.indexOf('review_notified_at')]).toBe('review_notified_at')
    const after = openMigratedDb()
    runBuilt(after, insert)
    expect(rowsOf(after, select)).toHaveLength(1)
    for (const piece of [
      'one of which needs 0059', '`POST /api/admin/tournaments`', '`PATCH /api/admin/tournaments/[id]`',
      'the create answers 500 for every create that passes its checks',
      'its read of the event names each column unqualified, in double quotes, and SQLite reads a double-quoted name it cannot find as a string',
    ]) {
      expect(merge, piece).toContain(piece)
    }
    const followUp = entryOf(followUps, 'K migrates the preview database before checkpoint J\'s preview (WS08 step 2).')
    expect(followUp).toContain('Without 0059, the create answers 500 on the branch\'s preview for every create that passes its checks')
  })
})

// ── The follow-up for K ──────────────────────────────────────────────

/** What each step of a workflow runs: the text after `run:`, or the block under `run: |`. */
function runCommands(lines: string[]): string[] {
  const out: string[] = []
  lines.forEach((line, i) => {
    const m = /^(\s*)(?:- )?run:\s*(.*)$/.exec(line)
    if (!m) return
    if (m[2] !== '|' && m[2] !== '>') {
      out.push(m[2])
      return
    }
    const indent = m[1].length
    const body: string[] = []
    for (let j = i + 1; j < lines.length && (lines[j].trim() === '' || /^\s*/.exec(lines[j])![0].length > indent); j++) body.push(lines[j])
    out.push(body.join('\n'))
  })
  return out
}

describe('the follow-up for K on the preview database', () => {
  const followUp = entryOf(followUps, 'K migrates the preview database before checkpoint J\'s preview (WS08 step 2).')

  it('quotes ordering rule 2 word for word, as WS08 step 4 reworded it', () => {
    const rule = status.split('\n').find((l) => l.startsWith('2. **The preview database is migrated from the branch')) ?? ''
    const plain = rule.replace(/^2\. /, '').replace(/\*\*/g, '')
    const quoted = /ordering rule 2 now reads: "([^"]+)"/.exec(followUp)
    expect(quoted, 'the quotation').not.toBeNull()
    expect(quoted![1].endsWith('.')).toBe(true)
    expect(plain.startsWith(quoted![1])).toBe(true)
    expect(quoted![1].split('. ').length).toBeGreaterThanOrEqual(2)
  })

  it('is right that nothing migrates lca-db-preview on its own, and that the script runs the guard before wrangler', () => {
    // A workflow may name the preview database in its words (the end-to-end run asks whether it was migrated), but no command it runs migrates it.
    const commands = readdirSync(join(ROOT, '.github/workflows')).flatMap((file) => runCommands(fileLines(`.github/workflows/${file}`)))
    expect(commands.some((c) => /wrangler d1 migrations apply lca-db --remote/.test(c)), 'the walk finds the production run').toBe(true)
    for (const command of commands) expect(command).not.toMatch(/lca-db-preview|db:migrate:preview|--env preview/)
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts
    const [guard, apply, ...rest] = scripts['db:migrate:preview'].split(' && ')
    expect(rest).toEqual([])
    expect(guard).toMatch(/ scripts\/db\/preview-guard\.ts lca-db-preview$/)
    expect(apply).toBe('wrangler d1 migrations apply lca-db-preview --remote --env preview')
    for (const piece of ['`migrate-db.yml`', '`lca-db-preview`', '`scripts/db/preview-guard.ts`', 'stops unless its target is `lca-db-preview`']) {
      expect(followUp, piece).toContain(piece)
    }
  })
})
