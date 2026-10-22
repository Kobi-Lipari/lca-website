// test/unit/sections-writer-audit.test.ts
//
// K2b: one writer owns a tournament's sections. Only
// functions/utils/events/sectionsRepo.ts may write tournaments.sections, so
// the section rows and the legacy JSON never drift apart. This scans every
// source file under functions/ and workers/ for a write to that column:
//
// - SQL text: UPDATE tournaments SET ... sections = ..., INSERT INTO
//   tournaments (... sections ...), and REPLACE INTO tournaments (which
//   rewrites every column)
// - Drizzle: .update(tournaments).set({ sections ... }) and
//   .insert(tournaments).values({ sections ... }), shorthand included, and
//   ${tournaments.sections} = ... inside a sql`` template
//
// It is a guard on the source text, not a proof: a write built from an
// object assembled elsewhere is not seen. The migrations are not scanned;
// the 0053 sync trigger writes the column on purpose.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const WRITER = 'functions/utils/events/sectionsRepo.ts'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name === 'dist' || name === '.wrangler') return []
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx|js|mjs|cjs)$/.test(name) ? [path] : []
  })
}

/** The text after `from` up to the end of the builder chain (its .where, a semicolon or a blank line). */
function chainAfter(text: string, from: number): string {
  const rest = text.slice(from, from + 4000)
  const end = rest.search(/\.where\(|;|\n\s*\n/)
  return end === -1 ? rest : rest.slice(0, end)
}

/** Each way the text writes tournaments.sections, as a short description. */
export function sectionsWrites(text: string): string[] {
  const found: string[] = []
  for (const m of text.matchAll(/\bUPDATE\s+["`[]?tournaments["`\]]?\s+SET\b([\s\S]*?)(?:\bWHERE\b|`|'|"|;)/gi)) {
    if (/(?:^|[\s,(])["`[]?sections["`\]]?\s*=(?!=)/i.test(m[1])) found.push('UPDATE tournaments SET sections')
  }
  for (const m of text.matchAll(/\bINSERT\s+(?:OR\s+\w+\s+)?INTO\s+["`[]?tournaments["`\]]?\s*\(([^)]*)\)/gi)) {
    if (/\bsections\b/i.test(m[1])) found.push('INSERT INTO tournaments (sections)')
  }
  if (/\bREPLACE\s+INTO\s+["`[]?tournaments["`\]]?[\s(]/i.test(text)) found.push('REPLACE INTO tournaments')
  for (const m of text.matchAll(/\.(update|insert)\(\s*tournaments\s*\)/g)) {
    const chain = chainAfter(text, (m.index ?? 0) + m[0].length)
    if (/[{,]\s*sections\s*(?::|,|\})/.test(chain) || /\[\s*tournaments\.sections\s*\]/.test(chain)) {
      found.push(`Drizzle .${m[1]}(tournaments) with sections`)
    }
  }
  if (/\$\{\s*tournaments\.sections\s*\}\s*=(?!=)/.test(text)) found.push('sql`${tournaments.sections} = ...`')
  return found
}

describe('one writer for tournaments.sections (K2b)', () => {
  const files = ['functions', 'workers'].flatMap((d) => sourceFiles(join(ROOT, d)))

  it('scans the handlers, the helpers and both workers', () => {
    const names = files.map((f) => relative(ROOT, f).split('\\').join('/'))
    expect(names).toEqual(expect.arrayContaining([
      'functions/api/admin/tournaments.ts',
      'functions/api/admin/tournaments/[id].ts',
      'functions/api/admin/tournaments/[id]/registration.ts',
      WRITER,
      'workers/daily-emails/src/index.ts',
      'workers/clearinghouse-sync/index.ts',
    ]))
  })

  it('finds a write to the column only in sectionsRepo', () => {
    const writers = files
      .map((f) => ({ file: relative(ROOT, f).split('\\').join('/'), writes: sectionsWrites(readFileSync(f, 'utf8')) }))
      .filter((w) => w.writes.length > 0)
    expect(writers).toEqual([{ file: WRITER, writes: ['Drizzle .update(tournaments) with sections'] }])
  })
})

describe('the audit sees each way of writing the column', () => {
  it('SQL text', () => {
    expect(sectionsWrites("db.prepare('UPDATE tournaments SET name = ?, sections = ? WHERE id = ?')")).toHaveLength(1)
    expect(sectionsWrites('`UPDATE tournaments SET\n  entry_fee = ?,\n  sections = ?\n WHERE id = ?`')).toHaveLength(1)
    expect(sectionsWrites('"update Tournaments set sections=? where id=?"')).toHaveLength(1)
    expect(sectionsWrites('`INSERT INTO tournaments (id, name, sections) VALUES (?, ?, ?)`')).toHaveLength(1)
    expect(sectionsWrites('`INSERT OR IGNORE INTO tournaments (\n id,\n sections\n) VALUES (?, ?)`')).toHaveLength(1)
    expect(sectionsWrites("'REPLACE INTO tournaments SELECT * FROM backup'")).toHaveLength(1)
  })

  it('Drizzle', () => {
    expect(sectionsWrites('await db.update(tournaments).set({ name, sections: json }).where(eq(tournaments.id, id))')).toHaveLength(1)
    expect(sectionsWrites('db.update(tournaments)\n  .set({\n    sections,\n  })\n  .where(x)')).toHaveLength(1)
    expect(sectionsWrites('db.insert(tournaments).values({ id, sections: "[]" })')).toHaveLength(1)
    expect(sectionsWrites('db.update(tournaments).set({ [tournaments.sections]: x })')).toHaveLength(1)
    expect(sectionsWrites('sql`UPDATE ${tournaments} SET ${tournaments.sections} = ${json}`')).toHaveLength(1)
  })

  it('leaves alone writes to other columns and tables, and reads', () => {
    expect(sectionsWrites("'UPDATE tournaments SET registration_status = ? WHERE id = ?'")).toEqual([])
    expect(sectionsWrites("'UPDATE tournament_sections SET name = ? WHERE id = ?'")).toEqual([])
    expect(sectionsWrites("'UPDATE tournaments SET status = ? WHERE sections = ?'")).toEqual([])
    expect(sectionsWrites("'SELECT id, sections FROM tournaments'")).toEqual([])
    expect(sectionsWrites('`INSERT INTO tournaments (id, name) VALUES (?, ?)`')).toEqual([])
    expect(sectionsWrites('db.update(tournaments).set({ name, sectionsCount: 2 }).where(x)')).toEqual([])
    expect(sectionsWrites('db.update(tournamentSections).set({ name }).where(x); const sections = 1')).toEqual([])
    expect(sectionsWrites('db.select({ sections: tournaments.sections }).from(tournaments)')).toEqual([])
    expect(sectionsWrites('if (${tournaments.sections} == x) {}')).toEqual([])
  })
})
