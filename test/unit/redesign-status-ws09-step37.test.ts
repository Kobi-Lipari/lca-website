// test/unit/redesign-status-ws09-step37.test.ts
//
// REDESIGN_STATUS.md records WS09's thirty-seventh step, players are not tied
// to clubs, the first step built of checkpoint Z. Like the other record tests
// of WS09, this file reads only the WS09 section, from its heading to the
// WS10 heading. Pinned here: this step's block right after checkpoint Y's
// review, and before the four lists while it is the latest; the Status and PR
// lines' clauses; the block's parts in order and this step's own figures,
// which must agree with the files they describe; every reader and writer the
// block names, each a file in the tree; what is owed in the held files and
// the four choices owed to K; the moved pins against their files; the
// Checks line in the forms the close reads; the sentences this step added to
// the map; the tagged entries of the lists; and the plain-language rules over
// what the step wrote and the files it adds. It counts no file of the whole
// tree, holds no line of another file by its number, and no line here reads
// how a switch ships.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored', 'assis' + 'tant'].join('|')})\\b`, 'i')
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|${'%' + '[A-Z]'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|${'CHECKS' + '_LINE'}|<<`)
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
const entries = (text: string) => text.split('\n').filter((l) => l.startsWith('- **'))
const head = (entry: string) => entry.slice(4, entry.indexOf('**', 4))
const TAG = '(WS09 step 37).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 checkpoint Y: the review of the whole and its fixes'
const STEP = '### WS09 step 37: players are not tied to clubs'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(STEP)
const map = part('### WS09 map: what proves each acceptance criterion and decision')
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))
const headings = lines.filter((l) => l.startsWith('### '))
const latestBlock = headings[headings.indexOf(LISTS[0]) - 1] ?? ''
const latest = latestStep === 37 && latestBlock === STEP
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''

const SELF = 'test/unit/redesign-status-ws09-step37.test.ts'
/** Each new test with the count of cases its run gives. */
const NEW_TESTS: Record<string, number> = {
  'test/unit/admin-club-page-no-roster.test.tsx': 9,
  'test/unit/manage-page-keep-apart.test.tsx': 6,
  'test/unit/workspace-club-no-roster.test.tsx': 2,
  'test/unit/club-detail-no-officers.test.tsx': 1,
  'test/integration/club-rep-naming-kept.test.ts': 8,
}
/** Each grown test, from and to, by its written cases. */
const GROWN_TESTS: Record<string, readonly [number, number]> = {
  'test/integration/club-permissions.test.ts': [43, 50],
  'test/integration/public-answer-trim.test.ts': [11, 13],
  'test/integration/pairing-flow.test.ts': [8, 12],
}
/** The new test whose loops write fewer `it(` lines than its run gives cases, with its written count. */
const WRITTEN: Record<string, number> = { 'test/unit/admin-club-page-no-roster.test.tsx': 5, 'test/integration/club-rep-naming-kept.test.ts': 4 }
const FIXTURE = 'test/unit/fixtures/admin-club-page-base-markup.json'
const CHANGED = [
  'functions/api/admin/clubs/[id]/roster.ts', 'functions/api/admin/clubs/[id]/officers.ts', 'functions/api/admin/clubs/[id]/officers/[officerId].ts', 'functions/api/admin/clubs/[id].ts',
  'domain/contracts/clubs.ts', 'domain/contracts/registry.ts', 'functions/api/clubs/[id].ts', 'functions/api/admin/tournaments/[id]/generate-pairings.ts', 'src/pages/AdminClubPage.tsx',
  'src/pages/TournamentManagePage.tsx', 'src/pages/WorkspacePage.tsx', 'src/areas/clubs/api.ts',
]
const MOVED = [
  'test/unit/redesign-status-ws09-step6.test.ts', 'test/unit/club-page-html.test.tsx', 'test/unit/redesign-status-ws09-step23.test.ts', 'test/unit/redesign-status-ws09-switch-on-region.test.ts',
  'test/unit/redesign-status-ws09-y-review.test.ts', 'test/integration/club-answer-by-address.test.ts', 'test/integration/club-reports-region.test.ts',
]
/** The held files and the shared ones this step leaves alone. */
const UNTOUCHED = [
  'functions/utils/admin/campaigns.ts', 'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/pages/AdminNewsletterPage.tsx', 'src/areas/admin/components/MembersTable.tsx',
  'functions/api/admin/members.ts', 'functions/api/admin/members/export.ts', 'functions/utils/auth.ts', 'functions/utils/email.ts', 'src/lib/nav.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts',
  'functions/api/admin/tournaments/[id].ts', 'wrangler.toml', 'src/lib/features.ts', 'functions/utils/clubs/pages.ts', 'src/App.tsx', 'test/unit/contracts-pending.ts',
  'test/unit/fixtures/api-added-since-split.json', 'test/integration/contracts/admin-clubs.test.ts', 'test/integration/harness.ts', 'src/pages/ClubDetailPage.tsx',
]
/** What this step names, which no untouched file may hold. */
const OURS = /ROSTER_NOT_KEPT|OFFICERS_NOT_KEPT|adminClubAnswerSchema|adminClubWithoutRosterResponseSchema|WS09 step 37/
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,)]`).exec(files)?.[1])
/** A file's cases as written: every `it(` and `test(` line. */
function casesIn(file: string): number {
  return (read(file).match(/^\s*(?:it|test)\(/gm) ?? []).length
}

describe('REDESIGN_STATUS.md, the thirty-seventh step of WS09: the block', () => {
  it('sits once, right after checkpoint Y\'s review, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status and PR lines what the step makes true: checkpoint Y in draft pull request 159, and checkpoint Z begun with step 37', () => {
    expect(status).toContain('\n## WS09: Clubs as living listings\n')
    expect(statusLine).toContain('holds checkpoints X and W and `main` at `85f20ec`, and waits in draft pull request 159 for K\'s word, merging after 158, which merges after 154')
    expect(statusLine).not.toContain('waits for its own draft pull request, which is opened after its review\'s fixes')
    expect(statusLine).toContain('and checkpoint Z, WS09 steps 37 and 38, is built on `redesign/ws09-clubs-z`, cut from checkpoint Y\'s head, `c930b20`') // moved by WS09 step 38, which builds the checkpoint's last step
    expect(statusLine).toContain('while step 36, club photos, waits for K\'s preview bucket as a checkpoint of its own; steps 1 to 14')
    const tail = statusLine.slice(statusLine.lastIndexOf('; ') + 2)
    if (latest) expect(tail).toContain('step 35, checkpoint Y\'s review and its fixes, step 37, K\'s answers')
    expect(tail).toMatch(/\bbuilt\.$/)
    expect(prLine).toContain('and waits in draft pull request 159 for K\'s word for its merge, after 158; checkpoint Z, steps 37 and 38, is built on `redesign/ws09-clubs-z`, cut from checkpoint Y\'s head, and reviewed there, holds checkpoints Y, X and W and `main` at `85f20ec`, and waits for its own draft pull request and K\'s word for its merge, after 159, and step 36 waits for K\'s preview bucket as a checkpoint of its own; the question marks\' words') // moved by WS09 step 38, and by WS09 checkpoint Z's review
    expect(prLine.endsWith('wait in pull request 151 for K\'s word.')).toBe(true)
    const lines = bullet(block, '- **The Status and PR lines.**')
    for (const piece of ['three clauses', 'draft pull request 159', 'checkpoint Z has begun', 'its tail names step 37', 'changes in two']) expect(lines, piece).toContain(piece)
  })

  it('opens by saying where the step sits, what it builds, what stays in the tables and why step 36 waits', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the first step built of checkpoint Z (steps 36 to 38)', '`redesign/ws09-clubs-z`', '`c930b20`', '`CLUB_PAGES_ON`', '`clubPagesOn()`', 'P2.18 (assumed)', 'answer 410 in words',
      '`members.club_id` and `club_officers` stay', '0074 stays unclaimed', 'today\'s to the byte', '`wrangler.toml`', '`CLUB_LOGOS`', 'No handler file, no switch and no migration is added.',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The readers.**', '- **The admin club page.**', '- **The three endpoints.**', '- **The admin club answer.**', '- **Today\'s public answer.**',
      '- **The pairing rule.**', '- **The Workspace\'s counts.**', '- **Both states.**', '- **The map (D17 and the rest of P2.18).**', '- **Branch.**', '- **The Status and PR lines.**',
      '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Owed in held files.**',
      '- **Owed before newClubs goes on.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })

  it('names every file it adds and changes, each new test with its count, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...Object.keys(NEW_TESTS), ...Object.keys(GROWN_TESTS), SELF, FIXTURE, ...CHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...Object.keys(NEW_TESTS), FIXTURE]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const [file, count] of Object.entries(NEW_TESTS)) {
      expect(writtenCount(files, file), file).toBe(count)
      expect(casesIn(file), file).toBe(WRITTEN[file] ?? count)
    }
    for (const [file, [from, to]] of Object.entries(GROWN_TESTS)) {
      expect(files, file).toContain(`\`${file}\` (${from} to ${to}: `)
      expect(casesIn(file), file).toBe(to)
    }
    expect(writtenCount(files, SELF)).toBe(casesIn(SELF))
    // The stored copy holds the page at the tab in both of its forms.
    const stored = JSON.parse(read(FIXTURE)) as Record<string, string>
    expect(Object.keys(stored)).toEqual(['lca_admin', 'club_rep', 'region_alone'])
    expect(stored.lca_admin).toContain('Add officer')
    expect(stored.region_alone).toContain('Club roster')
    const grown = bullet(files, '  - Grown with no change:')
    for (const piece of ['117 handler files', '`PENDING_COUNT` stays 104', '`test/unit/fixtures/api-added-since-split.json` does not move', '`test/unit/fixtures/api-exports.json`']) expect(grown, piece).toContain(piece)
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const file of UNTOUCHED) {
      expect(beyond, file).toContain(`\`${file}\``)
      expect(read(file), file).not.toMatch(OURS)
    }
    for (const dir of ['functions/utils/mail/', 'domain/mail/', 'workers/daily-emails/', 'src/components/layout/', 'src/areas/admin/newsletter/']) expect(beyond, dir).toContain(`\`${dir}\``)
  })
})

describe('REDESIGN_STATUS.md, the thirty-seventh step of WS09: the parts against the files', () => {
  it('names every reader and writer by a file in the tree, each with its fate', () => {
    const readers = bullet(block, '- **The readers.**')
    for (const fate of ['  - Goes with the switch: ', '  - Kept, a club rep\'s own club and the people who keep a listing: ', '  - Waits for the mail work, read and unchanged: ']) {
      expect(readers, fate).toContain(fate)
    }
    const named = [...new Set([...readers.matchAll(/`((?:functions|src|domain|test)\/[^`\s]+\.(?:ts|tsx))`/g)].map((m) => m[1]))]
    expect(named.length).toBeGreaterThan(40)
    for (const file of named) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of [
      'functions/api/admin/clubs/[id]/roster.ts', 'functions/api/admin/clubs/[id]/officers.ts', 'functions/api/admin/clubs/[id]/officers/[officerId].ts', 'functions/api/clubs/[id].ts',
      'src/pages/ClubDetailPage.tsx', 'functions/api/admin/tournaments/[id]/generate-pairings.ts', 'functions/api/admin/members/[id]/club.ts', 'functions/utils/supabase.ts', 'functions/api/me/children.ts',
      'functions/utils/clubs/nameRep.ts', 'src/components/auth/RoleProtectedRoute.tsx', 'functions/utils/admin/campaigns.ts', 'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx',
      'src/areas/admin/components/MembersTable.tsx', 'functions/api/admin/members.ts', 'functions/api/admin/members/export.ts', 'functions/utils/clubs/monthlyCheck.ts', 'functions/api/workspace/region.ts',
    ]) expect(named, file).toContain(file)
    expect(readers).toContain('the new club page never reads it')
    expect(readers).toContain('Nothing in `workers/` reads either.')
  })

  it('gives the refusals in the words the files hold, after today\'s checks', () => {
    const roster = read('functions/api/admin/clubs/[id]/roster.ts')
    const officers = read('functions/api/admin/clubs/[id]/officers.ts')
    expect(roster).toContain('export const ROSTER_NOT_KEPT = \'LCA no longer keeps a roster for each club. Reload the page.\'')
    expect(officers).toContain('export const OFFICERS_NOT_KEPT = \'LCA no longer keeps a list of officers for each club. Reload the page.\'')
    expect(read('functions/api/admin/clubs/[id]/officers/[officerId].ts')).toContain('import { OFFICERS_NOT_KEPT } from \'../officers\'')
    const endpoints = bullet(block, '- **The three endpoints.**')
    for (const piece of [
      '"LCA no longer keeps a roster for each club. Reload the page."', '"LCA no longer keeps a list of officers for each club. Reload the page."', '`ROSTER_NOT_KEPT`', '`OFFICERS_NOT_KEPT`',
      'every method but OPTIONS answers 410', '`ROSTER_KEPT_BACK`', 'a count of the statements',
    ]) expect(endpoints, piece).toContain(piece)
  })

  it('gives the answer\'s second shape as the contract holds it, and the pairing rule, the pages and both states', () => {
    const contracts = read('domain/contracts/clubs.ts')
    expect(contracts).toContain('export const adminClubWithoutRosterResponseSchema = z.strictObject(\n  adminClubResponseSchema.omit({ officers: true, roster: true }).shape,\n)')
    expect(contracts).toContain('export const adminClubAnswerSchema = z.union([adminClubResponseSchema, adminClubWithoutRosterResponseSchema])')
    expect(read('domain/contracts/registry.ts')).toContain('\'admin/clubs/[id]\': {\n    GET: { response: adminClubAnswerSchema },')
    const answer = bullet(block, '- **The admin club answer.**')
    for (const piece of ['`adminClubResponseSchema`', '`adminClubWithoutRosterResponseSchema`', '`adminClubAnswerSchema`', 'as step 32\'s list did', '`rosterKeptBack: true`', 'The DELETE clears']) {
      expect(answer, piece).toContain(piece)
    }
    const pairing = bullet(block, '- **The pairing rule.**')
    for (const piece of ['pairs exactly as one set to family', 'The stored value is never rewritten', '`functions/api/admin/tournaments/[id].ts`', '"Family members and players from the same club"', '" · keep families apart"', 'only when the director picks Nobody', 'No question mark and no new sentence']) {
      expect(pairing, piece).toContain(piece)
    }
    expect(read('functions/api/admin/tournaments/[id]/generate-pairings.ts')).toContain('const keepApart = CLUB_PAGES_ON && stored === \'family_club\' ? \'family\' : stored')
    const page = bullet(block, '- **The admin club page.**')
    for (const piece of ['`?tab=roster`', 'opens Club details', 'asks nothing of the roster or the officers', 'in both of the tab\'s forms', 'keeps its number']) expect(page, piece).toContain(piece)
    expect(bullet(block, '- **The Workspace\'s counts.**')).toContain('"Members on roster" and "Officers listed"')
    const both = bullet(block, '- **Both states.**')
    for (const file of [...Object.keys(GROWN_TESTS), 'test/unit/admin-club-page-no-roster.test.tsx', 'test/unit/manage-page-keep-apart.test.tsx', 'test/unit/workspace-club-no-roster.test.tsx']) {
      expect(both, file).toContain(`\`${file}\``)
    }
    expect(both).toContain('no case reads how a switch ships')
  })

  it('gives the branch, the merge, the database, a revert and what ships', () => {
    expect(bullet(block, '- **Branch.**')).toContain('`redesign/ws09-clubs-z`, cut from checkpoint Y\'s head, `c930b20`')
    expect(bullet(block, '- **Branch.**')).toContain('Step 36 waits for K\'s preview bucket as a checkpoint of its own. Checkpoint Y waits in draft pull request 159')
    const merge = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration', '117 handler files', '58 of the 162 methods', '`PENDING_COUNT` still 104', '`deploy-worker.yml` runs', '76.61 KiB']) expect(merge, piece).toContain(piece)
    expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**')).toContain('writes no row')
    expect(bullet(block, '- **What a revert leaves.**')).toContain('no stored value is rewritten')
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['Today\'s roster, officers and pairing option, unchanged', 'held against the stored copy', 'No switch is added.']) expect(off, piece).toContain(piece)
    expect(off).toContain('and the main script and every chunk that imports it, which take new names at their own sizes') // added by WS09 checkpoint Z's review, as the Build bullet says
    // No migration is made while this step is the latest, and the preview's pictures still go to the production bucket.
    if (latest) expect(readdirSync(join(ROOT, 'migrations')).filter((f) => f.startsWith('0074'))).toEqual([])
    if (latest) expect(read('wrangler.toml')).toContain('[[env.preview.r2_buckets]]\nbinding = "CLUB_LOGOS"\nbucket_name = "lca-club-logos"') // guarded by WS09 checkpoint Z's review: club photos rebinds the preview's bucket
  })

  it('names what is owed in the held files, the four choices for K, the moved pins and the build\'s figures', () => {
    const held = bullet(block, '- **Owed in held files.**')
    for (const piece of ['`functions/utils/admin/campaigns.ts`', '`src/pages/AdminEmailPage.tsx`', '"by role or membership status"', '`src/pages/AdminPage.tsx`', '`src/areas/admin/components/MembersTable.tsx`', '`functions/api/admin/members.ts`', '`functions/api/admin/members/export.ts`', '`HANDOFF-ws09.md` is not this step\'s']) {
      expect(held, piece).toContain(piece)
    }
    // The new club form still promises officers on the next screen, in a held file.
    const promise = 'You\'ll add the description, meeting details, logo and officers on the next screen.'
    if (latest) expect(read('src/pages/AdminPage.tsx')).toContain(promise) // guarded by WS09 checkpoint Z's review: the mail work is asked to change this sentence
    expect(held).toContain(`"${promise}" drops "and officers" with the club pages on`)
    const owed =bullet(block, '- **Owed before newClubs goes on.**').split('\n').filter((l) => l.startsWith('  - '))
    expect(owed).toHaveLength(4)
    for (const [i, piece] of ['the roster and officers tools leave the admin club page', '"Family members and players from the same club" leaves the pairing choice', 'today\'s public answer carries no officers', 'what waits in the mail work\'s files'].entries()) {
      expect(owed[i], piece).toContain(piece)
      expect(owed[i], piece).toContain('as built')
    }
    expect(owed[0]).toContain('never yet answered by K in so many words')
    expect(owed[1]).toContain('the switch is best turned between events')
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    for (const file of MOVED) expect(read(file), file).toContain('WS09 step 37')
    expect(read(MOVED[0])).toContain('GET: { response: adminClubAnswerSchema }')
    expect(read(MOVED[3])).toContain('count + 7 : count')
    expect(read(MOVED[4])).toContain('and waits in draft pull request 159 for K\\\'s word, merging after 158, which merges after 154\')')
    expect(pins).toContain('`PENDING_COUNT` at 104')
    expect(casesIn(MOVED[5])).toBe(4)
    expect(casesIn(MOVED[6])).toBe(6)
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `c930b20`')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', '`index-whXnuZ9_.js` at 524,195 bytes', '`index-BUAlFXpD.css` stays at 176,332 bytes', '`features-BFUKrFdH.js` at 741', '245 files']) {
      expect(build, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, the thirty-seventh step of WS09: the Checks line, the map and the lists', () => {
  it('gives each figure once, in the forms the close reads, with the base\'s figures', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', ' over ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toMatch(/over [\d,]+ files \(1,564 on the base\)/)
    expect(checksLine).toMatch(/unit [\d,]+ tests in [\d,]+ files \(13,609 in 640 on the base\)/)
    expect(checksLine).toMatch(/integration [\d,]+ in [\d,]+ files \(3,975 in 223 on the base\)[^;]*with the one todo beside them/)
    expect(checksLine).not.toMatch(/that run in [\d,]+ files/)
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('the base\'s browser run 1,065 tests, 728 that run and 337 that skip')
    expect(checksLine).toContain('no browser run of this step\'s own')
  })

  it('adds one sentence to D17 and to criterion 8, each before its planned step, and to no other item', () => {
    for (const [id, step, test] of [['D17', 37, '`test/integration/pairing-flow.test.ts`'], ['Criterion 8', 27, '`test/integration/public-answer-trim.test.ts`']] as const) {
      const item = mapItem(id)
      const sentence = 'Built in WS09 step 37: '
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.endsWith(`Planned: WS09 step ${step}.`), id).toBe(true)
      expect(item.slice(item.indexOf(sentence)), id).toContain(test)
    }
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 37:')).map(head)).toEqual(['Criterion 8.', 'D17.'])
  })

  it('tags its deviations, verify items and follow-ups', () => {
    expect(tagged(deviations).map(head)).toEqual([
      'Read as the club pages\' switch (WS09 step 37).', 'The roster kept back still said (WS09 step 37).', 'The Workspace\'s two counts (WS09 step 37).', 'Read and written, not unread (WS09 step 37).',
      'No handoff file (WS09 step 37).', 'Step 36 waits (WS09 step 37).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'The readers (WS09 step 37).', 'The pairing option (WS09 step 37).', 'The mail stream builds on the filter (WS09 step 37).', 'P2.18 (WS09 step 37).',
      'The preview\'s picture bucket (WS09 step 37).', 'The counts the entry gives (WS09 step 37).',
    ])
    expect(tagged(followUps).map(head)).toEqual(['What waits in the mail work\'s files (WS09 step 37).'])
  })

  it('keeps the plain-language rules in what the step wrote and in the files it adds', () => {
    const written = [block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps), ...['D17', 'Criterion 8'].map((id) => mapItem(id).slice(mapItem(id).indexOf('Built in WS09 step 37: ')))].join('\n')
    const files = Object.keys(NEW_TESTS).map((f) => read(f)).join('\n')
    for (const [name, rule] of [['dashes', DASHES], ['working words', BANNED], ['tools', TOOLS], ['bare letters', BARE], ['old initials', OLD_INITIALS], ['unfilled', UNFILLED], ['he', HE]] as const) {
      expect(name === 'working words' || name === 'bare letters' || name === 'he' ? proseOf(written) : written, name).not.toMatch(rule)
      // The files' code calls .slice() and .filter(), so the working words are read in their comments alone.
      const text = name === 'working words' ? files.split('\n').filter((l) => /^\s*(?:\/\/|\*)/.test(l)).join('\n') : files
      if (name !== 'unfilled' && name !== 'he') expect(text, name).not.toMatch(rule)
    }
    for (const date of written.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 2026\b/g)) {
      expect(written.slice(Math.max(0, date.index - 12), date.index), date[0]).toMatch(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), $/)
    }
    expect(read(SELF)).not.toMatch(DASHES)
  })
})
