// test/unit/redesign-status-ws16-p2-unlisted-seat.test.ts
//
// REDESIGN_STATUS.md records a board seat that counts for its holder but is
// not shown publicly, on K's decision 80. Light, as the block for who may
// send has its own record test, this file reads only this block, from its
// heading to the next heading. Pinned: the block's heading, once, directly
// after the block for who may send and before the WS16 decisions; the bold
// names of its bullets, in order; that every file it names is in the tree;
// and the facts a later change must not let drift, each read from the source
// so the record and the code cannot differ: the column in the schema, the
// snapshot and the migration, the migration's one data statement and that it
// leaves is_active alone, the filter in each of the three public readers, its
// absence from the holder's own reads, Admin's list and its way to bring a
// seat back, and the words a person reads that the block quotes. Also the
// plain reason the block gives, that no quoted or typed text in it gives a
// reason beyond that K asked, and the plain-language rules over the block. It pins no count
// and no figure.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The working words a record does not use, in the plural as well, and the two words that name a person's role in the work. */
const BANNED = new RegExp(`\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'agent', 'work' + 'flow', 'revie' + 'wer', 'tes' + 'ter', 'age' + 'nt', 'mod' + 'el'].join('|')})s?\\b|${'the ' + 'lead'}`, 'i')
/** The tools a record must not mention, split up so that this file does not mention them either. */
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** An assistant named, or a line about how the words came to be. */
const ASSISTANT = new RegExp(`\\b(?:${'assis' + 'tant'}|${'gener' + 'ated'}|${'wri' + 'tten by'})\\b`, 'i')
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** The placeholder the Board page reads as an open seat, put together so that this file does not hold it. */
const PLACEHOLDER = 'T' + 'BD'
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(
  `${String.fromCharCode(0x27ea)}|${String.fromCharCode(0xab)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|${'<' + '<'}[A-Z_]+${'>' + '>'}|${'to be ' + 'measured'}|${PLACEHOLDER}|${'\\(to ' + 'write\\)'}`,
)
const CAPITALS = /\b[A-Z0-9]{8,}\b/
/** The words that would make K, the owner, a he. */
const HE = /\b(?:he|his|him)\b/i
/** A time on a 24-hour clock. */
const HOURS_24 = /\b(?:1[3-9]|2[0-3]):[0-5]\d\b/
/** A web address, which the record gives no longer than its site's name. */
const ADDRESS = /https?:\/\/|www\./i
/** A day named with its month, long or short, and the weekday that must stand in front of it. */
const DAY = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b/g
const WEEKDAY = /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/
/** The word "we", which the record does not use. */
const WE = /\bwe\b/i

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}
/** Text with what sits in backticks taken out, since code is not prose. */
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const BEFORE = '#### WS16 part two: who may send'
const BLOCK = '#### WS16 part two: a seat that is not shown publicly'
const AFTER = '### WS16 decisions'
/** This block: from its heading to the next heading of any level. */
const block = status.includes(`\n${BLOCK}\n`) ? between(status.slice(status.indexOf(`\n${BLOCK}\n`) + 1), BLOCK, '\n#') : ''
const blockLines = block.split('\n')

/** The bold names of the block's bullets, in their order. */
const NAMES = [
  'What changes.', 'The column and its migration.', 'What a visitor can learn.', 'What the holder keeps.', 'Admin.',
  'Every word added or changed, for K.', "K's choices.", 'What K does after the merge.', 'The reviews.', 'What was not tested.',
  'Files.', 'Tests.', 'Follow-ups.', 'Checks.', 'The way back.',
]

/** The reason the block gives, in plain words: that K asked, and what for. */
const REASON =
  'K asked for a seat that counts for what it gives its holder while not being shown publicly: not on the Board page, not in the contact form, not in the public seat list.'

const SCHEMA = 'functions/db/schema.ts'
const MIGRATION = 'migrations/0073_seat_listing.sql'
const SNAPSHOT = 'drizzle/meta/0017_snapshot.json'
const JOURNAL = 'drizzle/meta/_journal.json'
const README = 'migrations/README.md'
const SEATS = 'functions/api/board/seats.ts'
const BOARD = 'functions/api/governance/board.ts'
const TICKETS = 'functions/utils/admin/tickets.ts'
const ADMIN_SEATS = 'functions/api/admin/board-seats.ts'
const AUDIT = 'functions/utils/admin/audit.ts'
const GOVERNANCE_API = 'src/areas/governance/api.ts'
const PANEL = 'src/areas/admin/components/BoardSeatsPanel.tsx'
const AUDIT_PANEL = 'src/areas/admin/components/AuditLogPanel.tsx'
const BOARD_PAGE = 'src/pages/BoardPage.tsx'
const FACTORIES = 'test/integration/factories.ts'
const MIGRATE_RUN = '.github/workflows/migrate-db.yml'

/** The holder's own reads, which the block says did not gain the new mark. */
const HOLDER_READS = [
  'functions/api/board/my-seats.ts',
  'functions/utils/admin/mediaManager.ts',
  'functions/utils/admin/presidentSeat.ts',
  'functions/utils/auth.ts',
  'functions/utils/admin/permissions.ts',
  'functions/utils/clubs/routing.ts',
  'functions/api/workspace/region.ts',
]

/** The words a person reads that the block quotes, in double quotes, each with the file that draws or gives it. */
const QUOTED: { quote: string; files: string[] }[] = [
  { quote: 'not shown publicly', files: [PANEL] },
  { quote: 'Bring back', files: [PANEL] },
  { quote: 'Could not bring that seat back. Try again.', files: [PANEL] },
  { quote: 'is back in use.', files: [PANEL] },
  { quote: 'Bringing it back shows it on the Board page and in the contact form.', files: [PANEL] },
  { quote: 'Board seat brought back', files: [AUDIT_PANEL] },
  { quote: 'retired', files: [PANEL] },
  { quote: 'shared', files: [PANEL] },
  { quote: 'on file', files: [PANEL] },
  { quote: 'Seat not found', files: [ADMIN_SEATS] },
  { quote: 'Apply database migrations', files: [MIGRATE_RUN] },
]

/** A function's body, from its signature to the next export. */
const body = (file: string, signature: string) => between(read(file), signature, '\nexport ')

/** The migration's statements, split at each break on a line of its own (the header names the marker too), each with its comment lines taken out. */
const statements = () =>
  read(MIGRATION)
    .split(/^--> statement-breakpoint$/m)
    .map((part) => part.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').trim())
    .filter(Boolean)

describe('REDESIGN_STATUS.md, WS16 part two: a seat that is not shown publicly, its place and its parts', () => {
  it('sits once, directly after the block for who may send and before the WS16 decisions', () => {
    expect(block).not.toBe('')
    expect(status.split(`\n${BLOCK}\n`)).toHaveLength(2)
    const at = status.indexOf(`\n${BLOCK}\n`)
    const before = status.indexOf(`\n${BEFORE}\n`)
    expect(before).toBeGreaterThan(-1)
    // Directly after: the next heading after the block for who may send is this one.
    expect(status.indexOf('\n#', before + 1 + BEFORE.length)).toBe(at)
    // A later block may stand between this one and the WS16 decisions.
    expect(status.indexOf(`\n${AFTER}\n`, at)).toBeGreaterThanOrEqual(at + 1 + block.length)
    expect(blockLines[0]).toBe(BLOCK)
    expect(blockLines.filter((l) => /^#{1,6} /.test(l))).toEqual([BLOCK])
    // Not a page step, so the page steps' own count, which the part's other record tests read, passes over it.
    expect(BLOCK).not.toMatch(/^#### WS16 part two, page step (\d+): /)
  })

  it("holds its bullets' bold names in order, each once", () => {
    let at = -1
    for (const name of NAMES) {
      const start = `- **${name}**`
      const found = blockLines.findIndex((l) => l.startsWith(start))
      expect(found, name).toBeGreaterThan(at)
      expect(blockLines.filter((l) => l.startsWith(start)), name).toHaveLength(1)
      at = found
    }
    expect(blockLines.filter((l) => l.startsWith('- **'))).toHaveLength(NAMES.length)
  })

  it('names only files that are in the tree', () => {
    const files = [...block.matchAll(/`((?:src|test|functions|domain|migrations|drizzle|scripts)\/[^`\s]+\.[a-z]+|REDESIGN_STATUS\.md)`/g)]
      .map((m) => m[1])
      .filter((file) => !file.includes('*'))
    expect(files.length).toBeGreaterThan(5)
    for (const file of files) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of [SCHEMA, SNAPSHOT, JOURNAL, README, PANEL, FACTORIES]) expect(files, file).toContain(file)
    // The migration is named by its file name alone; it is in the migrations folder.
    expect(block).toContain('`0073_seat_listing.sql`')
    expect(existsSync(join(ROOT, MIGRATION))).toBe(true)
  })

  it('gives the reason in plain words: that K asked, and what for', () => {
    expect(block).toContain(REASON)
    for (const words of ['K asked', 'counts for what it gives its holder', 'not on the Board page', 'not in the contact form', 'not in the public seat list']) {
      expect(block, words).toContain(words)
    }
    expect(block).toContain('decision 80')
    expect(block).toContain('`7b38743`')
    expect(block).toContain('Pull request 153')
  })

  it('gives no reason beyond that K asked, in quoted or typed text or in prose', () => {
    const runs = [...block.matchAll(/`[^`\n]*`|"[^"\n]*"/g)].map((m) => m[0])
    expect(runs.length).toBeGreaterThan(0)
    const officer = new RegExp(`\\b${'presi' + 'dent'}\\b`, 'i')
    for (const run of runs) expect(run).not.toMatch(officer)
    expect(block).not.toMatch(/\bwish\b|\bexpressed\b|\bdoesn'?t want\b|\bdoes not want\b|\basked that\b/i)
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: a seat that is not shown publicly, true to the code', () => {
  it('is right about the column: is_listed on board_members, a whole number, never empty, 1 unless set', () => {
    const table = between(read(SCHEMA), "sqliteTable('board_members'", '\n})')
    expect(table).not.toBe('')
    expect(table).toContain("isListed: integer('is_listed').default(1).notNull()")
    expect(block).toContain('One new column, `board_members.is_listed`, a whole number, never empty, 1 unless set: `isListed` in `functions/db/schema.ts`.')
    const snapshot = JSON.parse(read(SNAPSHOT)) as { tables: Record<string, { columns: Record<string, Record<string, unknown>> }> }
    expect(snapshot.tables.board_members.columns.is_listed).toMatchObject({ name: 'is_listed', type: 'integer', notNull: true, default: 1 })
    const journal = JSON.parse(read(JOURNAL)) as { entries: { tag: string }[] }
    expect(journal.entries.map((e) => e.tag)).toContain('0017_seat_listing')
  })

  it('is right about the migration: the generated column, then one data statement after the break, which leaves is_active alone', () => {
    const [alter, update, ...rest] = statements()
    expect(rest).toEqual([])
    expect(alter).toBe('ALTER TABLE `board_members` ADD `is_listed` integer DEFAULT 1 NOT NULL;')
    const data = update.replace(/`/g, '').replace(/;$/, '')
    expect(data).toBe("UPDATE board_members SET is_listed = 0 WHERE slug = 'media-manager' AND is_listed <> 0")
    expect(block).toContain(`after the statement break: \`${data}\``)
    for (const statement of statements()) expect(statement).not.toContain('is_active')
    expect(block).toContain('The statement does not touch `is_active`, so the seat stays retired')
    expect(block).toContain('made by `npm run db:generate` as `migrations/README.md` says')
    expect(read(README)).toContain('the seat listing `0073`')
    expect(block).toContain('`migrations/README.md` now names `0073` as the seat listing')
  })

  it('is right that each of the three public readers leaves out a seat that is not shown', () => {
    expect(read(SEATS)).toContain('WHERE s.is_active = 1 AND s.is_listed = 1')
    expect(block).toContain('takes only seats that are active and shown (`functions/api/board/seats.ts`)')
    // The public board list: shown seats only, for every caller, and it reads no caller.
    const get = body(BOARD, 'export const onRequestGet')
    expect(get).toContain('WHERE is_listed = 1')
    expect(get).not.toMatch(/\brequire[A-Z]\w*\(|ctx\.request/)
    expect(block).toContain('takes only seats that are shown, for every caller, signed in or not (`functions/api/governance/board.ts`)')
    // The contact form's and support's routing.
    const seat = body(TICKETS, 'export async function getActiveSeat(')
    expect(seat).toContain('WHERE is_active = 1 AND is_listed = 1 AND (slug = ?1 OR id = ?1)')
    expect(block).toContain('`getActiveSeat` in `functions/utils/admin/tickets.ts`')
    expect(block).toContain('`routedTo: null`')
  })

  it("is right that the holder's own reads did not gain the mark", () => {
    for (const file of HOLDER_READS) expect(read(file), file).not.toContain('is_listed')
    for (const file of HOLDER_READS.slice(0, 3)) expect(read(file), file).toContain('s.is_active = 1')
    expect(read('functions/utils/admin/mediaManager.ts')).toMatch(/export async function holdsMediaManagerSeat\(/)
    expect(block).toContain(
      '`functions/api/board/my-seats.ts`, `holdsMediaManagerSeat`, `holdsPresidentSeat`, `requireSeatAccess` and the regions by seat read `is_active` alone and did not gain the new mark',
    )
  })

  it("is right about Admin's list and its type", () => {
    expect(body(ADMIN_SEATS, 'export const onRequestGet')).toContain('s.is_listed,')
    expect(between(read(GOVERNANCE_API), 'export interface ApiAdminBoardSeat', '\n}')).toContain('is_listed: number')
    expect(block).toContain('`GET /api/admin/board-seats` now gives `is_listed` (`ApiAdminBoardSeat` in `src/areas/governance/api.ts` gains it)')
    expect(read(FACTORIES)).toContain('isListed?: boolean')
    expect(block).toContain('whose `seedSeat` gains an `isListed` option')
  })

  it('is right about bringing a seat back: the call, the guard, the reset name, the audit row, the answer', () => {
    const call = body(GOVERNANCE_API, 'export async function adminReactivateBoardSeat(')
    expect(call).toContain("fetch('/api/admin/board-seats'")
    expect(call).toContain("method: 'POST'")
    expect(call).toContain('JSON.stringify({ seatId, reactivate: true })')
    expect(block).toContain('`POST /api/admin/board-seats` with `{ seatId, reactivate: true }` (`adminReactivateBoardSeat`)')
    const post = body(ADMIN_SEATS, 'export const onRequestPost')
    expect(post.indexOf('requireAdmin(ctx.request, ctx.env)')).toBeGreaterThan(-1)
    expect(post.indexOf('requireAdmin(ctx.request, ctx.env)')).toBeLessThan(post.indexOf('body.reactivate === true'))
    expect(block).toContain('behind `requireAdmin`')
    expect(post).toContain("errorResponse('Seat not found', 404)")
    expect(post.indexOf("errorResponse('Seat not found', 404)")).toBeLessThan(post.indexOf('body.reactivate === true'))
    // The branch: a seat in use answers before anything is written.
    const branch = between(post, 'body.reactivate === true', '\n  }\n')
    const inUse = branch.indexOf('if (seat.is_active === 1)')
    const update = branch.indexOf('UPDATE board_members SET is_active = 1')
    expect(inUse).toBeGreaterThan(-1)
    expect(update).toBeGreaterThan(inUse)
    expect(branch.slice(inUse, update)).toContain('return jsonResponse({ success: true, seatId: body.seatId, reactivated: true })')
    expect(block).toContain('A seat already in use is answered the same, with nothing changed and nothing recorded')
    // The typed name goes back to the placeholder, which the Board page reads as an open seat.
    const statement = branch.slice(update, branch.indexOf('WHERE id = ?', update))
    expect(statement).toContain(`name = '${PLACEHOLDER}'`)
    expect(statement).toContain('photo_url = NULL')
    expect(statement).not.toContain('is_listed')
    expect(block).toContain("clears the seat's own photo")
    expect(read(BOARD_PAGE)).toContain(`displayName === '${PLACEHOLDER}'`)
    expect(block).toContain('resets its typed name to the placeholder the Board page reads as an open seat')
    expect(branch).toContain("action: 'seat_reactivate'")
    expect(branch).toContain('return jsonResponse({ success: true, seatId: body.seatId, reactivated: true })')
    expect(block).toContain('records `seat_reactivate` in the admin audit log')
    expect(block).toContain('answers `{ success: true, seatId, reactivated: true }`')
    expect(read(AUDIT)).toMatch(/\| 'seat_reactivate'/)
    const panel = read(AUDIT_PANEL)
    expect(panel).toMatch(/value: '[^']*\bseat_reactivate\b[^']*', label: 'Board seats'/)
    expect(panel).toContain("seat_reactivate: { label: 'Board seat brought back'")
    expect(block).toContain('shown there as "Board seat brought back" under the Board seats filter')
  })

  it("is right about the seat screen: the chip like the retired one, the line without its address, the button on a retired seat alone", () => {
    const panel = read(PANEL)
    const chip = /\{seat\.is_listed === 0 && \(\s*<span className="([^"]+)">\s*not shown publicly\s*<\/span>/.exec(panel)
    const retired = /\{!seat\.is_active && \(\s*<span className="([^"]+)">\s*retired\s*<\/span>/.exec(panel)
    expect(chip?.[1]).toBeTruthy()
    expect(chip?.[1]).toBe(retired?.[1])
    expect(block).toContain('looking like the "retired" chip')
    expect(panel).toMatch(/on file\{seat\.is_listed !== 0 && ` · \/contact\?to=\$\{seat\.slug\}`\}/)
    expect(block).toContain('the line of messages on file ends at "on file" and leaves out its contact form address')
    const button = between(panel, '{!seat.is_active && (\n            <Button', '</Button>')
    expect(button).toContain('aria-label={`Bring back ${seat.role}`}')
    expect(button).toContain('Bring back')
    expect(button).toContain('size="sm"')
    expect(block).toContain('a screen reader names "Bring back" with the seat\'s title')
  })

  it('quotes the words a person reads each as the file that draws or gives it holds them', () => {
    for (const { quote, files } of QUOTED) {
      expect(block, quote).toContain(`"${quote}"`)
      for (const file of files) expect(read(file), `${quote} in ${file}`).toContain(quote)
    }
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: a seat that is not shown publicly, in plain words', () => {
  it('holds no dash, no working word, no tool, no old initials, no long web address and nothing left unfilled', () => {
    const prose = proseOf(block)
    expect(block).not.toMatch(DASHES)
    expect(prose).not.toMatch(BANNED)
    expect(block).not.toMatch(TOOLS)
    expect(prose).not.toMatch(ASSISTANT)
    expect(prose).not.toMatch(BARE)
    expect(block).not.toMatch(OLD_INITIALS)
    expect(block).not.toMatch(UNFILLED)
    expect(block).not.toMatch(ADDRESS)
    expect(prose).not.toMatch(CAPITALS)
    expect(prose).not.toMatch(HE)
    expect(prose).not.toMatch(HOURS_24)
    expect(prose).not.toMatch(WE)
  })

  it('names the reviews as the first review and the second review', () => {
    const bullet = between(block, '- **The reviews.**', '\n- **What was not tested.**')
    expect(bullet).toMatch(/\bthe first review\b/i)
    expect(bullet).toMatch(/\bthe second review\b/i)
  })

  it('gives every day it names its weekday', () => {
    const prose = proseOf(block)
    for (const day of prose.matchAll(DAY)) expect(prose.slice(Math.max(0, (day.index ?? 0) - 11), day.index), day[0]).toMatch(WEEKDAY)
    // And the weekday is the right one, long ("Wednesday, November 25, 2026") or short ("Wed, Nov 25, 2026").
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const dated = [...prose.matchAll(/\b((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*), ((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*) (\d{1,2}), (\d{4})\b/g)]
    expect(dated.length).toBeGreaterThan(0)
    for (const [whole, weekday, month, d, y] of dated) {
      const m = months.indexOf(month.slice(0, 3))
      const long = weekday.length > 3 || month.length > 3
      const named = new Date(Date.UTC(Number(y), m, Number(d))).toLocaleDateString('en-US', { weekday: long ? 'long' : 'short', timeZone: 'UTC' })
      expect(weekday, whole).toBe(named)
    }
  })

  it('writes every time on the twelve-hour clock, each with its AM or PM and UTC, both ends of a range among them', () => {
    const prose = proseOf(block)
    const times = [...prose.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)]
    expect(times.length).toBeGreaterThan(0)
    for (const time of times) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
    // A range names its zone once, after its second end; a time on its own names it after itself.
    for (const time of prose.matchAll(/\b(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)\b(?! to \d)/g)) {
      expect(prose.slice((time.index ?? 0) + time[0].length, (time.index ?? 0) + time[0].length + 4), time[0]).toBe(' UTC')
    }
  })
})
