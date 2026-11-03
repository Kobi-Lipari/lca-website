// test/unit/redesign-status-ws08-step1-claims.test.ts
//
// The WS08 step 1 record's claims that its own record test,
// test/unit/redesign-status-ws08-step1.test.ts, leaves open, and the claims
// about files that stay true after the step:
// - the map: only AC12 to AC15 name a half that waits for a later part, each
//   naming the parts the plan gives it and no other, and no other item
//   speaks of waiting;
// - K's two production reads: K's alone, with K's own credentials, each a
//   single read-only SELECT that names no email column;
// - the Files bullet: the parts of test/unit/creation-rules.test.ts's count
//   add up to the count it gives;
// - D23's "Proved" sentence: the three events it names are the three cases
//   of test/unit/creation-rules.test.ts;
// - the verify items: what they say of the migrations is in the migrations,
//   word for word, and canManageTournament never reads created_by, as the
//   brief keeps it.
// It reads only the WS08 section of REDESIGN_STATUS.md and the files the
// section names, and pins no switch's value.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')

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
const headOf = (entry: string) => entry.slice(4, entry.indexOf('**', 4))
const map = part('### WS08 map: what proves each acceptance criterion and decision')
const block = part('### WS08 step 1: the record and the creation rules')
const verify = part('### WS08 verify items resolved')
const followUps = ws08.slice(ws08.indexOf('\n### WS08 follow-ups\n') + 1)
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''
/** What WS08 step 1 wrote of a map item: the words before the first sentence a later step adds to it. */
const ownOf = (item: string) => item.split(/ (?:Proved|Built|Read|Handed on) in WS08 step (?:[2-9]|10)\b/)[0]

describe('the WS08 map: which items wait for a later part', () => {
  /** The parts each criterion's deferred half waits for, as the plan's list gives them. */
  const WAITING: Readonly<Record<string, readonly string[]>> = {
    AC12: ['the Phase 4 part', 'the console part'],
    AC13: ['the admin home part', 'the console part'],
    AC14: ['the console part', 'WS09', 'the Phase 4 part'],
    AC15: ['the Phase 4 part', 'the console part'],
  }
  const PARTS = ['the console part', 'the admin home part', 'the Phase 4 part', 'WS09']

  it('reads the section and its map', () => {
    expect(ws08.startsWith(`${HEADING}\n`)).toBe(true)
    expect(entries(map).length).toBeGreaterThan(Object.keys(WAITING).length)
  })

  /** Holds a waiting item's step 1 text to the parts the plan gives it and no other. */
  const holdsItsParts = (id: string, item: string) => {
    const own = ownOf(item)
    // The words before the step 1 text's last sentence, where its halves are named.
    const end = own.lastIndexOf(' Planned: WS08 step')
    const halves = end < 0 ? own : own.slice(0, end)
    expect(halves, id).toMatch(/\bwaits for\b/)
    for (const name of PARTS) expect(halves.includes(name), `${id}: ${name}`).toBe(WAITING[id].includes(name))
  }
  /** Holds any other item's step 1 text free of waiting. */
  const speaksOfNoWaiting = (id: string, item: string) => {
    const own = ownOf(item)
    expect(own, id).not.toMatch(/\bwait/i)
  }

  it('names, in each of AC12 to AC15, a half that waits, and the parts the plan gives it and no other', () => {
    for (const id of Object.keys(WAITING)) holdsItsParts(id, mapItem(id))
  })

  it('speaks of waiting in no other item planned in this part: only AC12 to AC15 have a half for a later part', () => {
    const planned = entries(map).filter((item) => /Planned: WS08 step (?:[1-9]|10)\.$/.test(ownOf(item)))
    expect(planned.length).toBeGreaterThan(Object.keys(WAITING).length)
    for (const item of planned) {
      const id = headOf(item).replace(/\.$/, '')
      if (id in WAITING) continue
      speaksOfNoWaiting(id, item)
    }
  })

  it('reads only what step 1 wrote, so a sentence a later step adds to an item leaves both checks as they were', () => {
    const later = ' Built in WS08 step 2: the column waits for nothing.'
    for (const id of Object.keys(WAITING)) holdsItsParts(id, `${mapItem(id)}${later}`)
    const d20 = `${mapItem('D20')}${later}`
    expect(d20).toMatch(/\bwait/i)
    speaksOfNoWaiting('D20', d20)
    expect(ownOf(`${mapItem('D20')} Handed on in WS08 step 10: the admin home part waits.`)).toBe(mapItem('D20'))
  })
})

describe('the follow-up on K\'s two production reads', () => {
  const reads = entries(followUps).find((l) => headOf(l).startsWith('K\'s two production reads')) ?? ''
  const statements = [...reads.matchAll(/`(SELECT [^`]+)`/g)].map((m) => m[1])

  it('leaves them to K alone, with K\'s own credentials, names reported and never emails', () => {
    for (const words of ['K\'s alone', 'K runs them with K\'s own credentials', 'never a write', 'reports names, never emails']) {
      expect(reads, words).toContain(words)
    }
  })

  it('gives two statements, each a single read-only SELECT that names no email column', () => {
    expect(statements).toHaveLength(2)
    for (const sql of statements) {
      expect(sql.endsWith(';'), sql).toBe(true)
      expect(sql.slice(0, -1), sql).not.toContain(';')
      expect(sql, sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|PRAGMA|ATTACH)\b/i)
      expect(sql, sql).not.toMatch(/\bemail\b/i)
    }
  })
})

describe('the step block\'s figures and its D23 sentence', () => {
  it('gives test/unit/creation-rules.test.ts a count its parts add up to', () => {
    const files = block.split('\n').find((l) => l.startsWith('- **Files.**')) ?? ''
    const found = /`test\/unit\/creation-rules\.test\.ts` \((\d+): ([^)]*)\)/.exec(files)
    expect(found, 'the rules test in the Files bullet').not.toBeNull()
    const [, total, parts] = found!
    const counts = [...parts.matchAll(/, (\d+)(?=[,;]| and|$)|`[^`]+`, (\d+)/g)].map((m) => Number(m[1] ?? m[2]))
    expect(counts.length).toBeGreaterThanOrEqual(6)
    expect(counts.reduce((a, n) => a + n, 0)).toBe(Number(total))
  })

  it('names, for D23, the three events test/unit/creation-rules.test.ts asks lcaAffiliateAllowed about', () => {
    const d23 = mapItem('D23')
    const tests = read('test/unit/creation-rules.test.ts')
    for (const event of ['an LCA-run event', 'a club event', 'an event whose creator is not known']) {
      expect(d23, event).toContain(event)
      expect(tests, event).toContain(`['${event}', event(`)
    }
  })
})

describe('the verify items\' claims about the migrations and today\'s manage check', () => {
  const seat = entries(verify).find((l) => headOf(l).startsWith('The President seat')) ?? ''

  it('names the three migrations, and each holds what the item says of it', () => {
    for (const file of ['migrations/0011_governance.sql', 'migrations/0025_board_seats.sql', 'migrations/0027_shared_seats.sql']) expect(seat, file).toContain(`\`${file}\``)
    expect(read('migrations/0011_governance.sql')).toContain("('President', 'TBD', 1)")
    const seats = read('migrations/0025_board_seats.sql')
    for (const words of [
      'ALTER TABLE board_members ADD COLUMN slug TEXT;',
      'ALTER TABLE board_members ADD COLUMN category TEXT',
      'ALTER TABLE board_members ADD COLUMN is_active INTEGER',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_board_members_slug',
      'CREATE TABLE IF NOT EXISTS board_seat_assignments',
      'ended_at TEXT,',
    ]) expect(seats, words).toContain(words)
    const shared = read('migrations/0027_shared_seats.sql')
    expect(shared).toContain('DROP INDEX IF EXISTS idx_seat_current;')
    expect(shared).toContain('ON board_seat_assignments(seat_id, member_id) WHERE ended_at IS NULL;')
  })

  it('canManageTournament never reads created_by, as the record says and the brief keeps it', () => {
    expect(verify).toContain('`canManageTournament` never reads `created_by`')
    const source = read('functions/utils/admin/permissions.ts')
    const start = source.indexOf('export async function canManageTournament(')
    expect(start).toBeGreaterThan(-1)
    const end = source.indexOf('\n}\n', start)
    const body = source.slice(start, end)
    expect(body).not.toMatch(/created_by|createdBy/)
  })
})
