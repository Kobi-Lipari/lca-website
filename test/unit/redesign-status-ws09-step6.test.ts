// test/unit/redesign-status-ws09-step6.test.ts
//
// REDESIGN_STATUS.md records WS09 step 6: saving a listing, the server side
// of the one club editor behind CLUB_KEEPERS_ON. Like WS09 step 5's record
// test, this file reads only the WS09 section, from its heading to the WS10
// heading. Pinned here: the block's place, right after WS09 step 5's and
// before the four lists; the Status line's tail while this step is the
// latest; the block's parts in order and its figures, which must agree with
// each other and with the files they describe; the sentences this step added
// to the map; the tagged entries of the four lists; and the plain-language
// rules over the block and the files the step adds or changes. What a later
// step will change in the tree (the pending count, the handler count) is read
// only while this step is the latest.
import { readFileSync } from 'node:fs'
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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'UNIT' + 'COUNT'}|${'RECORD' + '_CASES'}|${'LINT' + '_FILES'}`)
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
const entries = (text: string) => text.split('\n').filter((l) => l.startsWith('- **'))
const head = (entry: string) => entry.slice(4, entry.indexOf('**', 4))
const TAG = '(WS09 step 6).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const STEP_5 = '### WS09 step 5: the seed on today\'s clubs'
const STEP = '### WS09 step 6: saving a listing'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(STEP)
const map = part('### WS09 map: what proves each acceptance criterion and decision')
const decisions = part(LISTS[0])
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))

const HANDLER = 'functions/api/admin/clubs/[id].ts'
const PLACES = 'functions/api/admin/clubs/[id]/places.ts'
const SAVE = 'functions/utils/clubs/save.ts'
const ROUTING = 'functions/utils/clubs/routing.ts'
const EMAILS = 'functions/utils/clubs/emails.ts'
const CHILD_DELETE = 'functions/api/me/children/[id].ts'
/** The files this step adds, and those of them that are unit tests and integration tests. */
const NEW_FILES = [
  PLACES, SAVE, ROUTING, EMAILS, 'test/integration/club-save.test.ts', 'test/integration/club-save-edges.test.ts', 'test/integration/contracts/admin-clubs.test.ts',
  'test/unit/club-routing-server-only.test.ts', 'test/unit/redesign-status-ws09-step6.test.ts',
]
const NEW_TESTS = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.ts$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The new files lint reads. */
const NEW_LINTED = NEW_FILES.filter((f) => f.endsWith('.ts'))
/** The files this step changes that are not tests. */
const CHANGED = [HANDLER, CHILD_DELETE, 'domain/contracts/clubs.ts', 'domain/contracts/registry.ts', 'test/unit/contracts-pending.ts']
/** The tests this step changes, each with its count and the count before, unit and integration apart. */
const CHANGED_INTEGRATION: ReadonlyArray<readonly [string, number, number]> = [
  ['test/integration/club-permissions.test.ts', 35, 23],
  ['test/integration/role-safety.test.ts', 8, 6],
]
const CHANGED_UNIT: ReadonlyArray<readonly [string, number, number]> = [
  ['test/unit/routes.test.ts', 15, 15],
  ['test/unit/redesign-status-ws09-step3.test.ts', 22, 22],
  ['test/unit/redesign-status-ws09-step4.test.ts', 23, 23],
]
const CHANGED_TESTS = [...CHANGED_INTEGRATION, ...CHANGED_UNIT]
/** The cases a unit test that grew with no change of its own gained. */
const GROWN = 0
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
/** A file's cases as vitest counts them, for a file whose every case is a plain `it(` line. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: no each`).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])
/** A file's code with its comments taken out, line comments and block comments alike. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('REDESIGN_STATUS.md, WS09 step 6: the block and the Status line', () => {
  it('sits once, right after WS09 step 5\'s block and before the four lists', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    const at = [STEP_5, STEP, LISTS[0]].map((h) => ws09.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
    expect(headings.slice(headings.indexOf(STEP_5) + 1).find((h) => !h.startsWith('### WS09 checkpoint S, after K\'s answers: '))).toBe(STEP)
    if (latestStep === 6) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest', () => {
    expect(latestStep).toBeGreaterThanOrEqual(6)
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestStep === 6) expect(tail).toBe('checkpoint S waits for its pull request; checkpoint T has begun on its own branch; steps 1 to 6 are built.')
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying the step changes no page, what it builds behind the constant, and K\'s three choices that bind it', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the first step of checkpoint T', 'It changes no page', '`CLUB_KEEPERS_ON`, which stays false', '`PUT /api/admin/clubs/[id]/places`',
      'K\'s decision 1 of Friday, November 13, 2026', 'choice 3 (a)', 'so the mirror is built', 'choice 1 (a)', 'choice 2 (a)', 'this step turns nothing on',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **Who may save.**', '- **One save.**', '- **The notice.**', '- **The page address.**', '- **The contracts.**',
      '- **The map.**', '- **The branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**',
      '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 6: the parts', () => {
  it('names every file it adds and changes, each test with its count, and the two sub-lines', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_TESTS.map(([f]) => f), 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of [...NEW_TESTS, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const [name, after, before] of CHANGED_TESTS) {
      expect(files, name).toContain(after === before ? `\`${name}\` (${after}, as before: ` : `\`${name}\` (${after}, ${before} before: `)
    }
    expect(files).toContain('  - Grown with no change: none')
    expect(files).toContain('  - Files beyond the step\'s list: `functions/api/me/children/[id].ts`')
    expect(files).toContain('Nothing under `src/` or `workers/` changes, no migration is added, and no file the mail stream holds is touched.')
  })

  it('names who may save as the handlers admit them, and the cases that hold each refusal', () => {
    const who = bullet(block, '- **Who may save.**')
    for (const piece of [
      'an LCA admin, the club\'s rep and the representative for the club\'s region', '`requireClubRep`', '`canManageClub`, unchanged',
      'Another region\'s representative, another club\'s rep, a one-event director and a member get 403',
      'an observer, an LCA officer, a seat holder whose term has ended, a guest and a child account', '"Only LCA admins can change a club\'s page address"',
    ]) expect(who, piece).toContain(piece)
    for (const file of [HANDLER, PLACES]) expect(read(file), file).toContain('await requireClubRep(context.request, context.env, clubId)')
    expect(read('functions/utils/admin/permissions.ts')).toContain('if (member.role === \'guest\') return false\n  return isRegionalRepFor(db, member.id, clubId)')
    const cases = read('test/integration/club-permissions.test.ts')
    for (const name of [
      'with CLUB_KEEPERS_ON set, an LCA admin, the club\\\'s rep and the region\\\'s representative save the listing and its places',
      ...[
        'another region\\\'s representative gets', 'another club\\\'s rep gets', 'a one-event director gets', 'a member of the club gets', 'an observer gets',
        'an LCA officer gets', 'a seat holder whose term has ended gets', 'a guest gets', 'a child account gets',
      ].map((person) => `with CLUB_KEEPERS_ON set, ${person} 403 on PATCH and PUT, and nothing is written`),
      'with CLUB_KEEPERS_ON set, only an LCA admin changes a club\\\'s region or its page address',
    ]) expect(cases, name).toContain(`  it('${name}', async () => {`)
  })

  it('says each save is one batch with its stamps, its activity row and the mirror, as save.ts writes them', () => {
    const save = bullet(block, '- **One save.**')
    for (const piece of [
      'one `db.batch`', '`told_updated_at` and `last_confirmed_at` set to now', '`told_by` and `confirmed_by` set to the saver', 'the `club_edit` row',
      'K\'s choice 3 (a)', 'each only when the new text is not empty', 'place 1\'s name and street', 'A case makes one statement of the batch fail',
    ]) expect(save, piece).toContain(piece)
    const code = codeOf(SAVE)
    expect(code.match(/await db\.batch\(statements\)/g) ?? []).toHaveLength(2)
    expect(code).not.toMatch(/\.run\(\)/)
    expect(code).not.toContain('recordAdminAction')
    expect(code).toContain(String.raw`told_updated_at = datetime(\'now\'), told_by = ?, last_confirmed_at = datetime(\'now\'), confirmed_by = ?`)
    expect(code).toContain('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)')
    const handler = codeOf(HANDLER)
    expect(handler).toContain('if (typeof next.about_text === \'string\') next.description = next.about_text')
    expect(handler).toContain('if (typeof next.how_we_meet_text === \'string\') next.meeting_schedule = next.how_we_meet_text')
    expect(read('test/integration/club-save.test.ts')).toContain('  it(\'a save that fails part way leaves nothing half written\', async () => {')
  })

  it('says the notice names fields to the region\'s representatives alone, through the one seam, with no address in any answer', () => {
    const notice = bullet(block, '- **The notice.**')
    for (const piece of [
      '`renderEmail`', '`trySendEmail`', 'the saver is not a representative of the club\'s region', 'however many seats they hold', 'never a value, so never the private address',
      'the saver is never sent one', 'a failed send never fails the save', '`functions/utils/clubs/routing.ts`', 'No file of WS09 calls `deliver()`',
    ]) expect(notice, piece).toContain(piece)
    const emails = codeOf(EMAILS)
    expect(emails).toContain('import { trySendEmail, type EmailEnv, type EmailMessage } from \'../email\'')
    expect(emails).toContain('renderEmail({')
    for (const file of [EMAILS, ROUTING, SAVE, HANDLER, PLACES]) {
      expect(codeOf(file), file).not.toMatch(/\bdeliver\(/)
      expect(read(file), file).not.toMatch(/api\.resend\.com|amazonaws\.com/)
    }
    expect(read(ROUTING)).not.toMatch(/^import /m)
    const cases = read('test/integration/club-save.test.ts')
    for (const name of [
      'the notice goes once, to the region\\\'s representatives, and not to the saver', 'the notice names the fields alone, never a value and never the private address',
      'a failure to send never fails the save',
    ]) expect(cases, name).toContain(`  it('${name}', async () => {`)
  })

  it('gives the page address\'s rules as the save reads them', () => {
    const address = bullet(block, '- **The page address.**')
    for (const piece of [
      'a reserved word (400)', 'another club\'s id, any other club\'s slug or another club\'s old slug (409)', '"monroe" stays Monroe Chess Club\'s for good',
      'The club\'s own id and its own old slugs may be taken back', 'at most 48 characters',
    ]) expect(address, piece).toContain(piece)
    const code = codeOf(SAVE)
    for (const piece of ['SELECT 1 FROM clubs WHERE id = ? AND id != ?', 'UNION ALL SELECT 1 FROM clubs WHERE slug = ? AND id != ?', 'UNION ALL SELECT 1 FROM club_slug_history WHERE old_slug = ? AND club_id != ?']) {
      expect(code, piece).toContain(piece)
    }
    expect(read('domain/contracts/clubs.ts')).toContain('export const CLUB_SLUG_MAX = 48')
  })

  it('names the contracts, their registry lines and the pending list as the files hold them', () => {
    const contracts = bullet(block, '- **The contracts.**')
    for (const piece of [
      '`adminClubResponseSchema`', '`updateClubRequestSchema`', '`updateClubResponseSchema`', '`clubPlacesRequestSchema`', '`clubPlacesResponseSchema`',
      '`CLUB_TEXT_LIMITS`', '`CLUB_PLACE_LIMITS`', 'an http or https address', '`src/pages/AdminClubPage.tsx` lines 134 and 472',
    ]) expect(contracts, piece).toContain(piece)
    const registry = read('domain/contracts/registry.ts')
    expect(registry).toContain('\'admin/clubs/[id]\': {\n    GET: { response: adminClubResponseSchema },\n    PATCH: { request: updateClubRequestSchema, response: updateClubResponseSchema },\n  },')
    expect(registry).toContain('\'admin/clubs/[id]/places\': {\n    PUT: { request: clubPlacesRequestSchema, response: clubPlacesResponseSchema },\n  },')
    const pending = read('test/unit/contracts-pending.ts')
    for (const line of ['\'GET admin/clubs/[id]\',', '\'PATCH admin/clubs/[id]\',', '\'PUT admin/clubs/[id]/places\',']) expect(pending, line).not.toContain(line)
    expect(pending).toContain('\'DELETE admin/clubs/[id]\',')
    const tests = read('test/integration/contracts/admin-clubs.test.ts')
    for (const reference of ['contracts[\'admin/clubs/[id]\'].GET', 'contracts[\'admin/clubs/[id]\'].PATCH', 'contracts[\'admin/clubs/[id]/places\'].PUT']) expect(tests, reference).toContain(reference)
    for (const file of [HANDLER, PLACES]) expect(read(file), file).toMatch(/await parseBody\(context\.request, /)
    expect(read(HANDLER)).not.toContain('parseJsonBody')
    const callers = read('src/pages/AdminClubPage.tsx').split('\n')
    if (latestStep === 6) expect(callers[133]).toContain('await adminUpdateClub(id, {')
    if (latestStep === 6) expect(callers[471]).toContain('await adminUpdateClub(club.id, { mapLocation: location })')
  })

  it('names the map\'s sentences, the branch, what the merge does, and the figures while this step is the latest', () => {
    const mapPart = bullet(block, '- **The map.**')
    for (const piece of ['20 items', 'a sentence added to criterion 9', 'one to D17', 'is not proved in full']) expect(mapPart, piece).toContain(piece)
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-t`, cut from checkpoint S\'s head `6c62fcf`', 'pull request 130 on `redesign/ws09-clubs` keeps to checkpoint S', 'this step\'s diff is against `6c62fcf`']) {
      expect(branch, piece).toContain(piece)
    }
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration and one new route', '99 handler files', '31 of the 138 methods under `functions/api` contracted, 28 of 137 before', '`PENDING_COUNT` 107, 109 before']) {
      expect(does, piece).toContain(piece)
    }
    if (latestStep !== 6) return
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 107')
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(99)')
  })

  it('answers what main\'s code does on this database and what a revert leaves', () => {
    const main = bullet(block, '- **What `main`\'s code does on this step\'s database.**')
    for (const piece of ['adds no migration', 'items R1 and R2 of checkpoint S\'s merge-safety review', 'only columns and tables of migration 0066']) expect(main, piece).toContain(piece)
    const revert = bullet(block, '- **What a revert leaves.**')
    for (const piece of ['leaves the database exactly as it found it', 'checkpoint S\'s code, which stays', 'the rows its saves wrote stay']) expect(revert, piece).toContain(piece)
  })

  it('says what ships with every switch off, and the constant stays false, read inside each handler', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Today\'s PATCH and GET for today\'s bodies, unchanged')).toBe(true)
    for (const piece of [
      'an LCA admin, an observer, the club\'s rep and a person admitted by the region alone', 'byte for byte', 'no stamp and no email',
      '"The new club page fields cannot be saved yet."', '"A club\'s places cannot be saved yet."', 'No switch is added',
    ]) expect(ships, piece).toContain(piece)
    expect(read('functions/utils/clubs/pages.ts')).toContain('export const CLUB_KEEPERS_ON = false')
    for (const file of [HANDLER, PLACES]) {
      expect(read(file), file).toContain('import { CLUB_KEEPERS_ON } from')
      expect(read(file), file).not.toMatch(/^(?:const|let|var|export const) \w+ = CLUB_KEEPERS_ON/m)
    }
    expect(read('test/integration/club-save.test.ts')).toContain('  it(\'with the constant unset a club rep\\\'s save in a club whose region has a representative sends nothing (the harness\\\'s outbox is empty) and leaves told_updated_at, told_by, last_confirmed_at and confirmed_by as they were\', async () => {')
  })

  it('names its pins with the figures as they stand on this branch, and the closed checks hold', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      '`test/unit/contracts-pending.ts`: `PENDING_COUNT` 107, 109 on the base', '`test/unit/routes.test.ts`: the handler count, 99 handler files under `functions/api`, 98 on the base',
      '`test/unit/redesign-status-ws09-step3.test.ts` line 357', '`test/unit/redesign-status-ws09-step4.test.ts` line 375', 'line 381 on the base and line 399 now', 'Not moved:',
    ]) expect(pins, piece).toContain(piece)
    expect(read('test/unit/redesign-status-ws09-step3.test.ts').split('\n')[356]).toContain('if (latestStep === 3) expect(casesIn(\'test/integration/club-permissions.test.ts\')).toBe(23)')
    expect(read('test/unit/redesign-status-ws09-step4.test.ts').split('\n')[374]).toContain('if (latestStep === 4 || file !== \'test/integration/club-permissions.test.ts\')')
    expect(read('test/integration/club-permissions.test.ts').split('\n')[398]).toContain('body.tournaments')
    const handler = read(HANDLER)
    expect(handler.split('SELECT ${ADMIN_CLUB_COLUMNS} FROM clubs')).toHaveLength(3)
    expect(handler).toContain('admittedByRegionAlone(authResult.member, clubId)')
    expect(handler).toContain('FROM tournaments WHERE club_id = ? ORDER BY date DESC')
    expect(read('functions/utils/clubs/adminAnswer.ts')).not.toMatch(/\b(?:slug|about_text|told_by|club_places)\b/)
  })

  it('gives the lint as unchanged and the build\'s names and sizes as the base\'s', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-YVdCmnd0.js` 554,147 bytes', '`index-MGRWYyBv.css` 131,136 bytes', '`features-nZCZoT6G.js` 729 bytes',
      'the same names and sizes as the base `6c62fcf`\'s', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 6: the Checks line', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
  })

  it('counts as many cases for each new test and each changed test as the file holds', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of [...NEW_TESTS, ...NEW_INTEGRATION]) expect(writtenCount(files, file), file).toBe(casesIn(file))
    // WS09 step 9 adds cases to club-permissions, which its own record test counts, so that count is read only while this step is the latest.
    for (const [file, n] of CHANGED_TESTS) if (latestStep === 6 || file !== 'test/integration/club-permissions.test.ts') expect(casesIn(file), file).toBe(n)
  })

  it('gives unit counts that add up: the base\'s, the new file\'s and the changed files\'', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([9212, 360])
    const fresh = NEW_TESTS.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    const moved = CHANGED_UNIT.reduce((a, [, n, was]) => a + n - was, 0)
    expect(num(before) + fresh + GROWN + moved).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
  })

  it('gives integration counts that add up: the base\'s, the new files\' and the cases the changed files gained', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([2243, 120])
    const fresh = NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    expect(num(before) + fresh + CHANGED_INTEGRATION.reduce((a, [, n, was]) => a + n - was, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the lint files as the base\'s with the new files lint reads added, and the build\'s file count once on each side', () => {
    const lint = /`npm run lint` 13 errors and 13 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1002)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_LINTED.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 6: the map and the lists', () => {
  it('adds one sentence to criterion 9 and one to D17, each before the planned step, and to no other item', () => {
    for (const id of ['Criterion 9', 'D17']) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 6: the keepers\' save'), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 6: '), id).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
    }
    expect(mapItem('Criterion 9').endsWith('Planned: WS09 step 6.')).toBe(true)
    expect(mapItem('Criterion 9').split('Built in WS09 step 4: the ground, ')).toHaveLength(2)
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 6:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 9', 'D17'])
  })

  it('records the step\'s decisions, deviations, verify items and follow-ups, each tagged', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'The mirror is built (WS09 step 6).', 'The save notice goes to the region\'s representatives (WS09 step 6).', 'The child profile delete clears the club references (WS09 step 6).',
    ])
    expect(tagged(deviations).map(head)).toEqual([
      'No lookup at any provider (WS09 step 6).', 'The new fields in the body\'s own form (WS09 step 6).', 'The places save tells and checks too (WS09 step 6).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'Who the endpoints admit (WS09 step 6).', 'Today\'s PATCH rules (WS09 step 6).', 'What today\'s pages read (WS09 step 6).', 'Several holders or none (WS09 step 6).',
      'The email function (WS09 step 6).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `6c62fcf`/)
    expect(tagged(followUps).map(head)).toEqual([
      'Today\'s fields ahead of the new ones (WS09 step 6).', 'The site\'s calls for the new save (WS09 step 6).', 'Items R3 and R4 stay with K (WS09 step 6).',
    ])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 6: plain language', () => {
  const written = [block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps), mapItem('Criterion 9'), mapItem('D17'), statusLine].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the step wrote, and dates and times in their plain form', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(written).not.toMatch(rule)
    expect(written).not.toMatch(/\.github\//)
    const prose = proseOf(written)
    expect(prose).not.toMatch(HE)
    expect(written).not.toMatch(/\(step \d+[;),]/)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds or changes', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_TESTS.map(([f]) => f)]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE]) expect(text, file).not.toMatch(rule)
      // The child profile's words for a member's ID predate this step, which changes only its delete.
      if (file === CHILD_DELETE) {
        for (const line of text.split('\n').filter((l) => OLD_INITIALS.test(l))) expect(line, line).toMatch(/errorResponse\('(?:A|That) /)
      } else {
        expect(text, file).not.toMatch(OLD_INITIALS)
      }
    }
  })
})
