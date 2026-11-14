// test/unit/redesign-status-ws09-s-answers.test.ts
//
// REDESIGN_STATUS.md records K's answers to the six choices of checkpoint
// S's merge-safety review in a block of its own, "WS09 checkpoint S, after
// K's answers", straight after WS09 step 5's block, and marks each sentence
// it added to the section's earlier bullets and lists with "Changed after
// K's answers:". Like the step record tests, this file reads only the WS09
// section, from its heading to the WS10 heading. Pinned here: the block's
// place and parts; K's six answers in its opening; its claims against the
// files it names (the club's answer and the removal of an officer on the
// server, the admin club page's words, the two sentences and the card); the
// old and new words for K; the results of the read of production and of
// the rehearsal; its pins; the sentences it marks; the Status line's tail;
// the Checks line's figures; and the plain-language rules. What a later step
// moves (line numbers of the pages, the Status line's tail) is read only
// while WS09 step 5 is the latest step.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The working words a record does not use, in the plural as well, and the two words that name a person's role in the work. */
const BANNED = new RegExp(`\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'agent', 'work' + 'flow'].join('|')})s?\\b|${'the ' + 'lead'}`, 'i')
/** The tools a record must not mention, split up so that this file does not mention them either. */
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b`)
/** The words that would make K, the owner, a he. */
const HE = /\b(?:he|his|him)\b/i

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}
/** A bullet and the indented lines under it. */
function bullet(text: string, start: string): string {
  const all = text.split('\n')
  const at = all.findIndex((l) => l.startsWith(start))
  if (at < 0) return ''
  let end = at + 1
  while (end < all.length && /^\s+\S/.test(all[end])) end++
  return all.slice(at, end).join('\n')
}
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const STEP_5 = '### WS09 step 5: the seed on today\'s clubs'
const BLOCK = '### WS09 checkpoint S, after K\'s answers: the roster kept back, hidden drafts and the card'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const step3 = part('### WS09 step 3: the regions fill')
const step5 = part(STEP_5)
const decisions = part(LISTS[0])
const verify = part(LISTS[2])
const followUps = ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1)
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))

const MARK = 'Changed after K\'s answers: '
/** The sentences this block added to a line: from the mark to the line's end. */
const added = (line: string) => (line.includes(MARK) ? line.slice(line.indexOf(MARK)) : '')
const addedTo = (text: string, start: string) => added(text.split('\n').find((l) => l.startsWith(start)) ?? '')
const marked = ws09.split('\n').filter((l) => l.includes(MARK)).map(added)

const GET = 'functions/api/admin/clubs/[id].ts'
const DELETE = 'functions/api/admin/clubs/[id]/officers/[officerId].ts'
const PAGE = 'src/pages/AdminClubPage.tsx'
const DASHBOARD = 'src/pages/DashboardPage.tsx'
const SEATS = 'src/areas/admin/components/BoardSeatsPanel.tsx'
const CARD = 'src/pages/ClubsPage.tsx'
/** The files this block adds, unit and integration apart. */
const NEW_UNIT = [
  'test/unit/admin-club-page-roster.test.tsx', 'test/unit/admin-club-page-roster-reading.test.tsx', 'test/unit/club-region-words.test.tsx',
  'test/unit/redesign-status-ws09-s-answers.test.ts',
]
const NEW_INTEGRATION = ['test/integration/club-roster-kept-back.test.ts', 'test/integration/club-roster-kept-back-edges.test.ts']
/** The files of code this block changes. */
const CHANGED = [
  GET, DELETE, 'functions/api/admin/clubs/[id]/officers.ts', 'functions/utils/clubs/memberView.ts', 'src/areas/clubs/api.ts', PAGE, DASHBOARD, SEATS, CARD,
]
/** The tests this block changes, each with its count, which does not move. */
const CHANGED_TESTS: ReadonlyArray<readonly [string, number]> = [
  ['test/integration/club-permissions.test.ts', 23], ['test/integration/club-regions-fill.test.ts', 14], ['test/unit/redesign-status-ws09-review.test.ts', 6],
  ['test/unit/redesign-status-ws09-step5.test.ts', 23], ['test/unit/redesign-status-ws09-step1.test.ts', 33],
]
/** The server's words for a roster kept back, and the page's. */
const KEPT_BACK = 'A club\'s roster is kept for LCA admins and the club\'s own rep.'
const ASK = 'To add or remove an officer, ask an LCA admin or the club\'s own rep.'
const LISTED = 'Listed on the club\'s public page by name and role.'
const NONE = 'No officers are listed for this club.'
const DASHBOARD_OLD = 'As regional representative you can update these clubs\' pages, officers and news.'
const DASHBOARD_NEW = 'As regional representative you can update these clubs\' pages and news.'
const SEATS_OLD = 'Whoever holds the seat can manage every club in those regions: the club page, officers, news and logo.'
const SEATS_NEW = 'Whoever holds the seat can manage every club in those regions: the club page, news and logo.'
/** A file's cases as vitest counts them, for a file whose every case is a plain `it(` line. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: no each`).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])
/** A file's text with every run of white space made one space, so words split over lines read whole. */
const flat = (file: string) => read(file).replace(/\s+/g, ' ')

describe('REDESIGN_STATUS.md, WS09 checkpoint S after K\'s answers: the block and the Status line', () => {
  it('sits once, right after WS09 step 5\'s block and before the four lists', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
    expect(headings[headings.indexOf(STEP_5) + 1]).toBe(BLOCK)
    if (latestStep === 5) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
    // Step 5's own block still holds the review and its last bullet.
    expect(step5).toContain('- **Checkpoint S\'s merge-safety review.**')
    expect(step5).toContain('- **Checks after the review\'s fixes.**')
  })

  it('gives the Status line its tail while WS09 step 5 is the latest step', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestStep === 5) expect(tail).toBe('checkpoint S waits for its pull request; steps 1 to 5 and K\'s answers to its review are built.')
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens with K\'s six answers, each in one sentence, and what the block builds', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'K\'s decision 3, of Saturday, November 14, 2026, about 2:54 AM UTC', '"All recommended"', 'option (a) of each', '`ws09-k-decisions.md`', '`redesign/docs-phase2`',
      'Answer 1 (a): the merge is made code first', 'starting it by hand and seeing it green',
      'Answer 2 (a): for now a person admitted to a club by a regional seat alone gets no hidden draft', 'cannot remove an officer', 'lose the word "officers"',
      'Answer 3 (a): the one read of production was made.', 'Answer 4 (a): the rehearsal on the preview database was made.',
      'Answer 5 (a): the long line in the message of the merge commit `be9ef6d` is left as it is.',
      'Answer 6 (a): on a club card of the public Clubs page the region\'s name wraps onto a second line instead of being cut short.',
      'builds answers 2 (a) and 6 (a) and records all six', 'none of the plan\'s 38 steps', 'ships with every switch off, on K\'s answer',
    ]) expect(opening, piece).toContain(piece)
    const answers = opening.split(/(?=Answer \d \(a\): )/).slice(1)
    expect(answers.map((a) => a.slice(0, 14))).toEqual([1, 2, 3, 4, 5, 6].map((n) => `Answer ${n} (a): `))
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What it builds.**', '- **The server.**', '- **The admin club page.**', '- **The two sentences and the card.**', '- **The words, old and new.**',
      '- **The read of production.**', '- **The rehearsal on the preview database.**', '- **The branch.**', '- **What the merge does.**',
      '- **What `main`\'s code does on this database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Seen in a browser.**',
      '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(6)
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint S after K\'s answers: its claims against the files', () => {
  it('names every file it adds and changes, each test with its count, and only files that exist', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_UNIT, ...NEW_INTEGRATION, ...CHANGED, ...CHANGED_TESTS.map(([f]) => f), 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_UNIT, ...NEW_INTEGRATION]) expect(writtenCount(files, file), file).toBe(casesIn(file))
    for (const [file, n] of CHANGED_TESTS) {
      expect(files, file).toContain(`\`${file}\` (${n}, as before: `)
      expect(casesIn(file), file).toBe(n)
    }
    expect(files).toContain('No migration, switch, route or contract is added')
    const paths = [...block.matchAll(/`([a-z][\w./[\]-]*\/[\w.[\]-]+\.(?:ts|tsx|sql|md|json))`/g)].map((m) => m[1])
    expect(paths.length).toBeGreaterThan(15)
    for (const path of new Set(paths)) expect(existsSync(join(ROOT, path)), path).toBe(true)
  })

  it('says what the server answers a person admitted by the region alone, as the two handlers hold', () => {
    const server = bullet(block, '- **The server.**')
    for (const piece of [
      '`AND is_visible = 1` when `regionAlone` is true', 'every visible event and no hidden one', '`rosterKeptBack: true`',
      `\`${JSON.stringify({ error: KEPT_BACK })}\``, 'before it reads the officer', 'writes no audit row', '`test/integration/club-roster-kept-back.test.ts`',
      'stays on the pending list',
    ]) expect(server, piece).toContain(piece)
    const get = read(GET)
    expect(get).toContain('FROM tournaments WHERE club_id = ? AND is_visible = 1 ORDER BY date DESC')
    expect(get).toContain('FROM tournaments WHERE club_id = ? ORDER BY date DESC')
    expect(get).toContain('...(regionAlone ? { rosterKeptBack: true } : {}),')
    expect(get).not.toContain('the people\n  // allowed here are exactly the people who manage those drafts')
    const del = read(DELETE)
    const refusal = 'if (admittedByRegionAlone(authResult.member, clubId)) return errorResponse(ROSTER_KEPT_BACK, 403)'
    expect(del).toContain(refusal)
    expect(del.indexOf(refusal)).toBeLessThan(del.indexOf('SELECT co.member_id'))
    expect(read('functions/utils/clubs/memberView.ts')).toContain(`export const ROSTER_KEPT_BACK = '${KEPT_BACK.replace(/'/g, '\\\'')}'`)
    expect(read('test/unit/contracts-pending.ts')).toContain('\'GET admin/clubs/[id]\',')
  })

  it('quotes the admin club page\'s words for a roster kept back as the page holds them, and keeps today\'s for the rest', () => {
    const page = bullet(block, '- **The admin club page.**')
    for (const words of [KEPT_BACK, ASK, LISTED, NONE, '"Roster & officers", with no count']) expect(page, words).toContain(words)
    const source = read(PAGE)
    expect(source).toContain(`{'${KEPT_BACK.replace(/'/g, '\\\'')} ${ASK.replace(/'/g, '\\\'')}'}`)
    expect(source).toContain(`{'${LISTED.replace(/'/g, '\\\'')}'}`)
    expect(source).toContain(NONE)
    expect(source).toContain('`Published tournaments of ${club.name} show up here. Drafts stay with LCA admins and the club\'s own rep.`')
    expect(source).toContain('setRoster(clubData.rosterKeptBack ? null : clubData.roster ?? [])')
    expect(source).toContain('label: roster === null ? \'Roster & officers\' : `Roster & officers (${roster.length})`')
    // Today's words stay for an LCA admin and the club's own rep.
    for (const words of [
      'Club roster · {roster.length} members', 'No members assigned to this club yet.', 'Officers are chosen from the roster, which is empty right now.',
      'Listed on your public club page with their name and email, so visitors know who to contact.',
    ]) expect(source, words).toContain(words)
    expect(read('src/areas/clubs/api.ts')).toContain('rosterKeptBack?: true')
  })

  it('gives the two sentences and the card\'s line as the files hold them', () => {
    const two = bullet(block, '- **The two sentences and the card.**')
    for (const piece of [DASHBOARD_NEW, SEATS_NEW, '`src/pages/DashboardPage.tsx` line 340', '`src/areas/admin/components/BoardSeatsPanel.tsx` lines 323 and 324', '`test/unit/club-region-words.test.tsx`']) {
      expect(two, piece).toContain(piece)
    }
    expect(flat(DASHBOARD)).toContain(DASHBOARD_NEW)
    expect(flat(DASHBOARD)).not.toContain(DASHBOARD_OLD)
    expect(flat(SEATS)).toContain(SEATS_NEW)
    expect(flat(SEATS)).not.toContain(SEATS_OLD)
    const card = read(CARD)
    expect(card).toContain('<p className="flex items-start gap-1.5">\n            <MapPin className="mt-0.5 size-3 flex-shrink-0 text-gold-ink" />\n            <span className="min-w-0 break-words">')
    expect(card).toContain('<span className="truncate">{club.meeting_schedule}</span>')
    if (latestStep !== 5) return
    const line = (file: string, n: number) => read(file).split('\n')[n - 1] ?? ''
    expect(line(DASHBOARD, 340)).toContain(DASHBOARD_NEW)
    expect(`${line(SEATS, 323).trim()} ${line(SEATS, 324).trim()}`).toContain(SEATS_NEW)
    expect(line(CARD, 156)).toContain('flex items-start gap-1.5')
    expect(line(CARD, 161)).toContain('</p>')
  })

  it('lists the words for K, old and new, side by side, each old one gone from its file', () => {
    const words = bullet(block, '- **The words, old and new.**')
    for (const [old, now] of [
      ['"Roster & officers (0)"', '"Roster & officers"'], ['"Club roster · 0 members"', '"Club roster"'],
      ['"No members assigned to this club yet."', `"${KEPT_BACK} ${ASK}"`], ['"Officers · 1"', '"Officers"'],
      ['"Listed on your public club page with their name and email, so visitors know who to contact."', `"${LISTED}"`],
      [`"${DASHBOARD_OLD}"`, `"${DASHBOARD_NEW}"`], [`"${SEATS_OLD}"`, `"${SEATS_NEW}"`],
      ['"Tournaments you create for" the club "will show up here, including drafts."', '"Published tournaments of" the club "show up here. Drafts stay with LCA admins and the club\'s own rep."'],
    ]) {
      expect(words, old).toContain(old)
      expect(words.indexOf(now, words.indexOf(old)), now).toBeGreaterThan(words.indexOf(old))
    }
    for (const piece of ['"Officers are chosen from the roster, which is empty right now." is gone', `"${NONE}" is new`, 'On `/clubs` no word changes.']) expect(words, piece).toContain(piece)
  })

  it('records the read of production and the rehearsal as given, with no person named', () => {
    const readOf = bullet(block, '- **The read of production.**')
    for (const piece of [
      'Saturday, November 14, 2026, about 3:00 AM UTC, 17 SELECT statements, one per command', 'exactly the 25 clubs', 'every club\'s region is blank',
      'no club has a stored latitude or longitude', 'differs from what migration 0013 stored', 'none equals a typed slug or a reserved word',
      'there are 2 lists, neither with a club', 'ends at 0060', 'gain 8, 5, 2 and 3 clubs', 'The Baton Rouge / East Central seat has one holder and no region',
      'the Baton Rouge, Bluebonnet and Gonzales clubs go to the Lafayette / South Central seat alone', 'North of Lake Pontchartrain, Central Louisiana or Bayou Region',
      'none of the six is renamed', 'No database was read or written here.',
    ]) expect(readOf, piece).toContain(piece)
    const rehearsal = bullet(block, '- **The rehearsal on the preview database.**')
    for (const piece of [
      '`npm run db:migrate:preview` applied 0065, 0066 and 0067', 'with no error', '25 with a region (8, 3, 5, 2, 2, 2 and 3 by region)', '25 distinct slugs',
      '18 meeting statements', '7 About texts', '26 places, every one with a pin', '6 old addresses kept', 'no doubled apostrophe',
    ]) expect(rehearsal, piece).toContain(piece)
  })

  it('names its pins, each against the file it moved', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const [file] of CHANGED_TESTS) expect(pins, file).toContain(`\`${file}\``)
    for (const piece of ['line 381', 'line 375', '`rosterKeptBack` between `roster` and `tournaments`', '200 before, is 403 now', 'still ending "built."', '`test/unit/goldText.test.ts`']) {
      expect(pins, piece).toContain(piece)
    }
    const line = (file: string, n: number) => read(file).split('\n')[n - 1] ?? ''
    expect(line('test/integration/club-permissions.test.ts', 381)).toContain('expect(body.tournaments.map((t) => t.id), draft).toEqual([])')
    expect(line('test/integration/club-permissions.test.ts', 375)).toContain('[\'club\', \'officers\', \'roster\', \'rosterKeptBack\', \'tournaments\']')
    expect(read('test/integration/club-regions-fill.test.ts')).toContain('expect(statuses[\'officer DELETE\']).toBe(403)')
    expect(read('test/unit/redesign-status-ws09-review.test.ts')).toContain(DASHBOARD_NEW.replace(/'/g, '\\\''))
    expect(read('test/unit/redesign-status-ws09-step5.test.ts')).toContain('!h.startsWith(\'### WS09 checkpoint S, after K\\\'s answers: \')')
    expect(read('test/unit/redesign-status-ws09-step1.test.ts')).toContain('|WS09 checkpoint S, after K\'s answers: \\S)')
    // goldText's two pins by line hold, since no line above them moved.
    expect(read(PAGE).split('\n')[405]).toContain('color: clubTextColor(color),')
    expect(read(CARD).split('\n')[74]).toContain('style={{ color: clubTextColor(club.color) }}')
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint S after K\'s answers: the sentences it marks', () => {
  it('marks each sentence it added to the earlier bullets and lists, each where it belongs and saying what it must', () => {
    const where: ReadonlyArray<readonly [string, string, readonly string[]]> = [
      [step3, '- **The roster stays back.**', ['the removal of an officer is refused', 'no hidden draft']],
      [step3, '  - The officers\' rows keep every other key', ['`rosterKeptBack`']],
      [step3, '- **What ships with every switch off.**', ['no count', 'no longer name officers', 'no hidden draft']],
      [step5, '- **Owed before the pull request.**', ['were made on Saturday, November 14, 2026']],
      [step5, '  - R1. ', ['K chose (a), the build first', 'decision 3']],
      [step5, '  - R3. ', ['K chose (a)', DASHBOARD_NEW, SEATS_NEW]],
      [step5, '  - R4. ', ['K chose (a)', '`AND is_visible = 1`', 'line 381 now holds no event', 'the removal of an officer is refused']],
      [step5, '  - R6. ', ['the question does not arise', 'none of the six is renamed']],
      [decisions, '- **The regions are filled, and the roster stays with its keepers (WS09 step 3).**', ['removes no officer', 'no hidden draft']],
      [verify, '- **What a filled region opens (WS09 step 3).**', ['the visible events alone']],
      [verify, '- **Production\'s rows (WS09 step 5).**', ['the read was made on Saturday, November 14, 2026']],
      [followUps, '- **The one read of production, owed before checkpoint S merges (WS09 step 3).**', ['made on Saturday, November 14, 2026', 'no club holds a region']],
      [followUps, '- **The Baton Rouge seat, owed before checkpoint S merges (WS09 step 3).**', ['one holder and no region', 'Bluebonnet and Gonzales']],
      [followUps, '- **The admin club page\'s words for a roster kept back (WS09 step 3).**', ['closed.', KEPT_BACK, ASK, LISTED, DASHBOARD_NEW, SEATS_NEW]],
      [followUps, '- **The migration run at checkpoint S\'s merge (WS09 step 4).**', ['answer 1 (a)', 'started by hand']],
      [followUps, '- **The rehearsal on the preview database, owed before checkpoint S\'s pull request (WS09 step 5).**', ['with no error', '26 places, every one with a pin']],
      [followUps, '- **The four counts of production, owed before checkpoint S\'s pull request (WS09 step 5).**', ['17 SELECT statements', '(1)', '(7)', 'gain 8, 5, 2 and 3 clubs']],
    ]
    for (const [text, start, pieces] of where) {
      const sentence = addedTo(text, start)
      expect(sentence, start).not.toBe('')
      for (const piece of pieces) expect(sentence, `${start}: ${piece}`).toContain(piece)
    }
    expect(marked.length).toBe(where.length)
    // The earlier words are kept: each marked line still holds what was there before the mark.
    expect(addedTo(step5, '  - R4. ')).not.toContain('Changed in checkpoint S\'s review: ')
    expect(bullet(verify, '- **Production\'s rows (WS09 step 5).**')).toMatch(/^- \*\*Production's rows \(WS09 step 5\)\.\*\* Not checked: no remote read was made\./)
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint S after K\'s answers: the Checks line and plain language', () => {
  it('gives each figure once, and counts that add up from the base\'s', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    expect([num(unit![3]), Number(unit![4])]).toEqual([9212, 360])
    expect(num(unit![3]) + NEW_UNIT.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(unit![1]))
    expect(Number(unit![2]) - Number(unit![4])).toBe(NEW_UNIT.length)
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    expect([num(integration![3]), Number(integration![4])]).toEqual([2243, 120])
    expect(num(integration![3]) + NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(integration![1]))
    expect(Number(integration![2]) - Number(integration![4])).toBe(NEW_INTEGRATION.length)
    const lint = /`npm run lint` 13 errors and (\d+) warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this block touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![3])).toBe(1002)
    expect(num(lint![2]) - num(lint![3])).toBe(NEW_UNIT.length + NEW_INTEGRATION.length)
    expect(bullet(block, '- **Lint.**')).toContain(`13 errors and ${lint![1]} warnings`)
    const built = /`npm run build` \((\d+) files in `dist\/assets`\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
    for (const piece of ['a local production build', '`VITE_`', '`features-nZCZoT6G.js` 729 bytes', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes']) {
      expect(bullet(block, '- **Build.**'), piece).toContain(piece)
    }
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what it wrote and the files it adds or changes', () => {
    const written = [block, ...marked, statusLine].join('\n')
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(written).not.toMatch(rule)
    expect(written).not.toMatch(/\.github\//)
    const prose = proseOf(written)
    expect(prose).not.toMatch(HE)
    expect(written).not.toMatch(/\(step \d+[;),]/)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
    expect(written).not.toMatch(/\bUS Chess Federation\b/)
    for (const file of [...NEW_UNIT, ...NEW_INTEGRATION]) {
      const text = read(file)
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
    // Four of the pages and the client hold dashes and the old initials in words older than this block, so only a tool's name is read there.
    for (const file of CHANGED) for (const rule of [TOOLS, BARE]) expect(read(file), file).not.toMatch(rule)
  })
})
