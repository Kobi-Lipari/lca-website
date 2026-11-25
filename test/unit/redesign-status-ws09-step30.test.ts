// test/unit/redesign-status-ws09-step30.test.ts
//
// REDESIGN_STATUS.md records WS09's thirtieth step, Suggest a club and Start
// a club, the sixth of the plan's seven steps of checkpoint X. Like step 29's
// record test, this file reads only the WS09 section, from its heading to the
// WS10 heading. Pinned here: this step's block right after step 29's, and
// before the four lists while it is the latest; the Status line's tail while
// this step is the latest; the block's parts in order and its figures, which
// must agree with each other and with the files they describe; the parishes
// as the table holds them; the sentences this step added to the map; the
// tagged entries of the lists, the fourteen days first among this step's
// follow-ups; and the plain-language rules over what the step wrote and the
// files it adds. No line here reads how a switch ships.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'
import { PARISH_REGIONS } from '../../domain/clubs/parishRegions'
import { REGIONS } from '../../domain/clubs/regions'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|${'Z' + 'Z'}[A-Z]|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|[A-Z]+_(?:${['WORDS', 'LINE', 'BYTES', 'SHA', 'CASES', 'RESULT', 'OWED'].join('|')})\\b`)
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
const TAG = '(WS09 step 30).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 29: the fourteen-day step'
const STEP = '### WS09 step 30: Suggest a club, or start one'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(STEP)
const map = part('### WS09 map: what proves each acceptance criterion and decision')
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))
const headings = lines.filter((l) => l.startsWith('### '))
const latestBlock = headings[headings.indexOf(LISTS[0]) - 1] ?? ''
const latest = latestStep === 30 && latestBlock === STEP

const PUBLIC = 'functions/api/clubs/reports.ts'
const KEEPER = 'functions/api/admin/club-reports/[reportId].ts'
const SAVE = 'functions/utils/clubs/clubRequests.ts'
const LOOKUP = 'functions/utils/clubs/places.ts'
const EMAILS = 'functions/utils/clubs/emails.ts'
const PLACES = 'domain/clubs/laPlaces.ts'
const PARISHES = 'domain/clubs/parishRegions.ts'
const RULES = 'domain/clubs/newClub.ts'
const ROWS = 'src/areas/clubs/components/ClubRequestRows.tsx'
const FORM = 'src/areas/clubs/components/SuggestClubForm.tsx'
const PAGE = 'src/pages/SuggestClubPage.tsx'
const SELF = 'test/unit/redesign-status-ws09-step30.test.ts'
const NEW_FILES = [
  PLACES, PARISHES, 'domain/clubs/placeNames.ts', RULES, 'domain/contracts/clubRequests.ts', LOOKUP, SAVE, PUBLIC, KEEPER, PAGE, FORM, 'src/areas/clubs/suggestClub.ts',
  ROWS, 'src/areas/clubs/clubRequestRows.ts', 'scripts/data/build-la-places.ts',
]
/** Each new test with the count of cases its run gives; the three with tables of cases are counted by their rows. */
const NEW_TESTS: Record<string, number> = {
  'test/integration/club-suggest-club.test.ts': 24,
  'test/integration/club-suggest-club-edges.test.ts': 31,
  'test/integration/contracts/club-suggest.test.ts': 4,
  'test/unit/la-places.test.ts': 43,
  'test/unit/la-places-edges.test.ts': 79,
  'test/unit/la-places-reach.test.ts': 6,
  'test/unit/suggest-club-form.test.tsx': 12,
  'test/unit/suggest-club-form-edges.test.tsx': 17,
  'test/unit/club-request-rows.test.tsx': 9,
  'test/unit/club-request-words.test.ts': 10,
  'test/a11y/clubs-suggest-club.spec.ts': 4,
}
const FIXTURE = 'test/unit/fixtures/my-region-base-markup.json'
const CHANGED = [
  EMAILS, 'functions/api/workspace/region.ts', 'functions/utils/admin/audit.ts', 'domain/contracts/clubs.ts', 'domain/contracts/index.ts', 'domain/contracts/registry.ts',
  'src/areas/clubs/api.ts', 'test/unit/fixtures/api-added-since-split.json', 'src/pages/MyRegionPage.tsx', 'src/App.tsx',
]
const MOVED = [
  'test/unit/routes.test.ts', 'test/unit/redesign-status-ws09-step20.test.ts', 'test/unit/redesign-status-ws09-step21.test.ts', 'test/unit/redesign-status-ws09-step22.test.ts',
  'test/unit/redesign-status-ws09-step23.test.ts', 'test/unit/redesign-status-ws09-step24.test.ts', 'test/unit/redesign-status-ws09-w-takes-main.test.ts',
  'test/unit/redesign-status-ws09-step28.test.ts', 'test/unit/nav.test.ts', 'test/unit/club-page-off.test.tsx', 'test/unit/app-routes.test.tsx', 'test/unit/api-split-modules.test.ts',
  'test/unit/base-components-scope.test.ts', 'test/unit/rate-limit-boundaries.test.ts', 'test/unit/spam-check-widget.test.tsx',
]
const UNTOUCHED = [
  'workers/daily-emails/src/index.ts', 'test/unit/mail-worker-closure.test.ts', 'functions/utils/admin/campaigns.ts', 'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx',
  'src/pages/AdminNewsletterPage.tsx', 'src/lib/nav.ts', 'functions/api/contact.ts', 'src/lib/features.ts', 'functions/utils/clubs/pages.ts', 'test/unit/features.test.ts',
  'test/integration/harness.ts', 'scripts/seed/fixtures.sql', 'playwright.config.ts', 'package.json', 'wrangler.toml', 'functions/utils/rateLimit.ts', 'functions/utils/spamCheck.ts',
  'functions/utils/clubs/reportClock.ts', 'functions/api/clubs/[id]/reports.ts', 'functions/api/admin/clubs/[id]/reports/[reportId].ts', 'src/areas/admin/components/AuditLogPanel.tsx',
]
/** What this step names, which no untouched file may hold. */
const OURS = /clubRequest|ClubRequest|club_request|laPlaces|parishRegions|SuggestClub|club-reports\/|WS09 step 30/
const num = (text: string) => Number(text.replace(/,/g, ''))
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,)]`).exec(files)?.[1])
/**
 * A file's cases as its run gives them: every `it(` and `test(` line, each row of a table of cases (a row of its own
 * on each line, or the items of a table on one line), and a second for a `test(` in a loop over the two sizes.
 */
function casesIn(file: string): number {
  const text = read(file)
  let count = (text.match(/^\s*(?:it|test)\(/gm) ?? []).length
  for (const m of text.matchAll(/^\s*it\.each\(\[/gm)) {
    const start = m.index + m[0].length
    const ends = ['])(', '] as const)('].map((end) => text.indexOf(end, start)).filter((at) => at >= 0)
    const body = text.slice(start, Math.min(...ends))
    // A one-line table of quoted words is counted by its words, since a word may hold a comma.
    const words = body.match(/'(?:[^'\\]|\\.)*'/g) ?? []
    const onlyWords = words.length > 0 && body.replace(/'(?:[^'\\]|\\.)*'/g, '').replace(/[\s,]/g, '') === ''
    count += body.includes('\n') ? (body.match(/^\s*\[/gm) ?? []).length : onlyWords ? words.length : body.split(',').length
  }
  // A test in a loop over the two sizes runs once more, for the second.
  count += (text.match(/^for \(const size of SIZES\) \{\n\s+test\(/gm) ?? []).length
  return count
}
/** A file's code with its comments taken out. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** A quoted constant's words in a file's code. */
const wordsOf = (file: string, name: string) => /'((?:[^'\\]|\\.)*)'/.exec(codeOf(file).slice(codeOf(file).indexOf(`export const ${name} = `)))?.[1].replace(/\\'/g, '\'') ?? ''
/** Every code file under a folder. */
function codeFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const path = `${dir}/${name}`
    if (statSync(join(ROOT, path)).isDirectory()) out.push(...codeFiles(path))
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(path)
  }
  return out
}

describe('REDESIGN_STATUS.md, the thirtieth step of WS09: the block', () => {
  it('sits once, right after step 29\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest, and keeps the section\'s heading and the pull request numbers', () => {
    expect(status).toContain('\n## WS09: Clubs as living listings\n')
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of [
        'WS09 step 30, Suggest a club and Start a club, one form with a switch at `/clubs/suggest`, routed by city or ZIP to the region\'s representatives or the LCA admins',
        'only with `CLUB_PAGES_ON` set',
        'step 28, step 29, step 30, K\'s answers',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132']) expect(lines.find((l) => l.startsWith('**PR:**')), pr).toContain(pr)
  })

  it('opens by saying where the step sits and what it builds, behind which constants', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the sixth of the plan\'s seven steps of checkpoint X (steps 25 to 31)', '`redesign/ws09-clubs-x`', 'step 31 is the next step', '`/clubs/suggest`', `\`${PAGE}\``, `\`${FORM}\``,
      '`POST /api/clubs/reports`', `\`${PUBLIC}\``, `\`${PLACES}\``, '`POST /api/admin/club-reports/[reportId]`', '`CLUB_PAGES_ON` and `newClubs`', '`CLUB_KEEPERS_ON`',
      'Two endpoints and two handler files are added; no switch and no migration.',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order, with the keeper seeing the address first among the judgement calls and the sent sentence second', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The place file.**', '- **The parishes.**', '- **Routing.**', '- **The guards.**', '- **What the row holds.**',
      '- **The keeper\'s side.**', '- **The page.**', '- **The map (criteria 4 and 10).**', '- **Branch.**', '- **What the merge does.**',
      '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **What ships as main stands.**',
      '- **Owed before newClubs goes on.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const calls = bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l))
    expect(calls.length).toBeGreaterThanOrEqual(10)
    expect(calls[0]).toMatch(/^ {2}- The keeper sees the person's name and address on the row, and nowhere else\./)
    expect(calls[1]).toMatch(/^ {2}- The sentence after sending is true wherever it went:/)
    // The entry's record lines, each in its part.
    for (const [part, words] of [['- **Routing.**', 'Routing by place'], ['- **The keeper\'s side.**', 'Who may answer'], ['- **The place file.**', 'The place list'], ['- **What the row holds.**', 'The place'], ['- **Build.**', 'Bundle']] as const) {
      expect(bullet(block, part), words).toContain(words)
    }
  })

  it('names every file it adds and changes, each new test with its count, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...Object.keys(NEW_TESTS), SELF, FIXTURE, ...CHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...Object.keys(NEW_TESTS), FIXTURE]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const [file, count] of Object.entries(NEW_TESTS)) {
      expect(writtenCount(files, file), file).toBe(count)
      expect(casesIn(file), file).toBe(count)
    }
    expect(writtenCount(files, SELF)).toBe((read(SELF).match(/^\s*it\(/gm) ?? []).length)
    const grown = bullet(files, '  - Grown with no change:')
    for (const piece of ['`test/unit/domain-boundaries.test.ts` from 70 to 75', '`test/unit/route-audit.test.ts` from 103 to 105', '`test/unit/chrome-reads.test.ts` from 54 to 55', '`test/unit/app-routes.test.tsx` from 45 to 46', 'from 21 to 25', '115 handler files']) {
      expect(grown, piece).toContain(piece)
    }
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const file of UNTOUCHED.filter((f) => f !== 'workers/daily-emails/src/index.ts')) expect(beyond, file).toContain(`\`${file}\``)
    expect(beyond).toContain('everything under `workers/daily-emails/`')
    for (const file of UNTOUCHED) expect(read(file), file).not.toMatch(OURS)
    for (const file of [...codeFiles('workers'), ...codeFiles('functions/utils/mail'), ...codeFiles('domain/mail')]) expect(read(file), file).not.toMatch(OURS)
    expect(readdirSync(join(ROOT, 'migrations')).filter((f) => /^\d{4}_/.test(f)).sort().at(-1)).toBe('0072_regions_by_seat.sql')
  })
})

describe('REDESIGN_STATUS.md, the thirtieth step of WS09: the parts against the files', () => {
  it('names the place file\'s sources with their sha256, its size and what it holds, as the file\'s header has them', () => {
    const placeFile = bullet(block, '- **The place file.**')
    const header = read(PLACES).split('\n').filter((l) => l.startsWith('//'))
    for (const line of header.filter((l) => / sha256 [0-9a-f]{64}$/.test(l))) {
      const [, name, size, sha] = /^\/\/ {3}(\S+): ([\d,]+) bytes, sha256 ([0-9a-f]{64})$/.exec(line) ?? []
      expect(placeFile, name).toContain(`\`${name}\``)
      expect(placeFile, name).toContain(`${size} bytes, sha256 \`${sha}\``)
    }
    expect(placeFile).toContain(`\`${PLACES}\`, ${Buffer.byteLength(read(PLACES)).toLocaleString('en-US')} bytes`)
    for (const piece of ['`www2.census.gov` alone', 'the agent "curl"', 'never committed', 'the same bytes each time', '540 ZIP code areas', '490 town names', 'Picayune\'s (39466)', 'No point is written', 'What "not found" means', 'not an error', '`test/unit/la-places.test.ts`']) {
      expect(placeFile, piece).toContain(piece)
    }
    expect(read(PLACES)).toContain('// 540 ZIP code areas (Louisiana\'s and Picayune\'s) and 490 town names, each')
  })

  it('lists the five regions each with its parishes, as the table holds them, for K to confirm', () => {
    const parishes = bullet(block, '- **The parishes.**')
    expect(PARISH_REGIONS).toHaveLength(64)
    for (const region of REGIONS) {
      const names = PARISH_REGIONS.filter((p) => p.region === region).map((p) => p.name)
      expect(parishes, region).toContain(`  - ${region} (${names.length}): ${names.join(', ')}.`)
    }
    for (const piece of ['for K to confirm', 'Pearl River County, Mississippi', 'The ones a reader might question', 'Tangipahoa', 'Concordia']) expect(parishes, piece).toContain(piece)
  })

  it('says where it goes, by the routing that already knows, and what the email holds, in the words the files hold', () => {
    const routing = bullet(block, '- **Routing.**')
    for (const piece of ['`representativesOfRegion`', '`lcaAdmins`', 'a guest never', 'One email to each person', '`renderEmail`', '`sendEmail`', '`resolveSiteUrl`', '`/workspace/region#club-request-{id}`', 'neither the person\'s name nor their address', 'still shows in My region']) {
      expect(routing, piece).toContain(piece)
    }
    expect(routing).toContain(`"${wordsOf(SAVE, 'CLUB_REQUEST_NOT_SENT_LOG')}"`)
    expect(routing).toContain(`"${wordsOf('functions/utils/clubs/emails.ts', 'SUGGESTION_FOOTER')}"`)
    for (const subject of ['Someone suggested a club for the map', 'Someone wants to start a club']) {
      expect(routing).toContain(`"${subject}"`)
      expect(read(EMAILS)).toContain(`'${subject}'`)
    }
    expect(codeOf(SAVE)).toContain('from \'./emails\'')
    expect(codeOf(SAVE)).not.toMatch(/from '\.\/routing'|\bdeliver\(|replyTo/)
    expect(read(EMAILS)).toMatch(/export \{ clubRepsOf, keeperOf, lcaAdmins, regionRepresentativesOf, representativesOfRegion, /)
  })

  it('gives the guards in step 28\'s order with the limit\'s figures, as the endpoint holds them', () => {
    const guards = bullet(block, '- **The guards.**')
    for (const name of ['CLUB_REQUESTS_CLOSED', 'CLUB_REQUESTS_BUSY']) expect(guards, name).toContain(`"${wordsOf(PUBLIC, name)}"`)
    for (const piece of ['five an hour from one place', 'ten an hour to one set of keepers', '240 in a day', '`clubs/new` and `clubs/new:keepers`', '`{ sent: true }`']) expect(guards, piece).toContain(piece)
    const code = codeOf(PUBLIC)
    expect(code).toMatch(/CLUB_REQUESTS_AN_HOUR_FROM_ONE_PLACE = 5\b/)
    expect(code).toMatch(/CLUB_REQUESTS_AN_HOUR_TO_ONE_KEEPER = 10\b/)
    const order = ['if (!CLUB_PAGES_ON)', 'parseBody(request, clubRequestSchema)', 'CLUB_REQUEST_PLACE_ROUTE, {', 'checkSpam(env', 'regionOfPlace(place)', 'CLUB_REQUEST_KEEPER_ROUTE, {', 'saveClubRequest(env']
    const at = order.map((piece) => code.indexOf(piece))
    for (const [i, piece] of order.entries()) expect(at[i], piece).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('bounds the mail by each set of keepers a person is in, with a row that falls to the admins counted against theirs, and names the ruling not kept', () => {
    const guards = bullet(block, '- **The guards.**')
    for (const piece of ['counted again against the admins\' set before it falls to them', 'for each set they are in', 'one set for each region their seats cover']) expect(guards, piece).toContain(piece)
    const code = codeOf(PUBLIC)
    expect(code).toContain('key: CLUB_REQUEST_ADMINS_KEY })).ok')
    expect(code.indexOf('const adminsMayBeWritten')).toBeLessThan(code.indexOf('saveClubRequest(env'))
    expect(codeOf(SAVE)).toContain('if (key === own) return true')
    expect(codeOf(SAVE)).not.toMatch(/new Set<string>\(\[sent\.email/)
    const kept = bullet(block, '- **Rulings not kept.**')
    for (const piece of ['ruling fourteen', '`admin_audit_log.actor_id`', 'a 500', 'The club delete half is kept']) expect(kept, piece).toContain(piece)
    expect(block.indexOf('\n- **Rulings not kept.**')).toBeLessThan(block.indexOf('\n- **Owed before newClubs goes on.**'))
    expect(block.indexOf('\n- **Rulings not kept.**')).toBeGreaterThan(block.indexOf('\n- **What ships as main stands.**'))
  })

  it('says what the row holds and the caps, as the rules hold them', () => {
    const row = bullet(block, '- **What the row holds.**')
    for (const piece of ['`new_club` or `start_club`', '`reporter_email`', '`proposed_json`', 'no network address', 'no member id', 'only `club_reports` and `rate_limits` grow', 'The typed city or ZIP is in no log line']) expect(row, piece).toContain(piece)
    expect(read(RULES)).toContain('export const CLUB_REQUEST_LIMITS = { clubName: 100, place: 100, message: 2000, name: 100, email: 254 } as const')
    for (const piece of ['club\'s name 100', 'city or ZIP 100', 'where and when 2,000', 'the name 100 and the address 254']) expect(row, piece).toContain(piece)
    expect(codeOf(SAVE)).toContain('JSON.stringify({ clubName: sent.clubName, place: sent.place, name: sent.name })')
  })

  it('says what a keeper meets and who may mark a row, in the words the files hold', () => {
    const side = bullet(block, '- **The keeper\'s side.**')
    for (const name of ['ALREADY_HANDLED', 'HAS_A_CLUB', 'REQUESTS_CLOSED']) expect(side, name).toContain(`"${wordsOf(KEEPER, name)}"`)
    for (const piece of [
      '"New clubs to check"', '`clubRequests`', 'absent when there is none', '"New club suggested"', '"Wants to start a club"', '"Email {first name}"', '"Mark as handled"', '"Add the club"',
      '`/admin/clubs`', '`requireAdmin`', '`club_request_handled`', 'with no second factor', 'a row with no region is the admins\' alone', 'one guarded statement',
    ]) expect(side, piece).toContain(piece)
    expect(side).toContain(`"${wordsOf('src/areas/clubs/clubRequestRows.ts', 'MARK_HANDLED_QUESTION')}"`)
    expect(codeOf(KEEPER)).toContain('proposed_json = CASE WHEN json_valid(proposed_json) THEN json_remove(proposed_json, \'$.name\') ELSE NULL END')
    expect(codeOf(KEEPER)).toContain('WHERE id = ? AND club_id IS NULL AND kind IN (\'new_club\', \'start_club\') AND status = \'open\'')
    expect(read('functions/utils/admin/audit.ts')).toContain('| \'club_request_handled\'')
    expect(codeOf('functions/api/admin/clubs.ts')).toContain('requireAdmin(')
    expect(read('src/pages/AdminPage.tsx')).not.toMatch(OURS)
  })

  it('says what the page draws, in the words the rules hold', () => {
    const page = bullet(block, '- **The page.**')
    for (const name of ['new_club', 'start_club'] as const) expect(page, name).toContain(`"${/(?:new_club|start_club): '([^']*)'/.exec(codeOf(RULES).slice(codeOf(RULES).indexOf(`  ${name}: 'Sent.`)))?.[1]}"`)
    for (const piece of ['`/clubs/suggest?kind=start`', '`aria-pressed`', '"Your email (stays private)"', '"Send to LCA"', 'names no region, no seat and no person', 'fetched the first time it is opened']) expect(page, piece).toContain(piece)
    expect(read('src/App.tsx')).toContain('{FEATURES.newClubs && <Route path="/clubs/suggest" element={<SuggestClubPage />} />}')
  })

  it('gives the branch, the merge, what ships with every switch off and as main stands, and what is owed, with the figures the tree holds', () => {
    expect(bullet(block, '- **Branch.**')).toContain('`redesign/ws09-clubs-x`, at `6786cba`, "WS09 step 29: the fourteen-day step"')
    const merge = bullet(block, '- **What the merge does.**')
    for (const piece of ['115 handler files', '56 of the 160 methods', '`PENDING_COUNT` still 104', '`deploy-worker.yml`']) expect(merge, piece).toContain(piece)
    expect(Number(/expect\(real\.filter\(\(r\) => r\.startsWith\('api\/'\)\)\.length\)\.toBe\((\d+)\)/.exec(read('test/unit/routes.test.ts'))?.[1])).toBeGreaterThanOrEqual(115)
    if (latest) {
      expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 104')
      expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(56)
    }
    expect(Object.keys(contracts['clubs/reports'])).toEqual(['POST'])
    expect(Object.keys(contracts['admin/club-reports/[reportId]'])).toEqual(['POST'])
    expect(read('test/unit/contracts-pending.ts')).not.toMatch(/clubs\/reports'|club-reports/)
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['Two endpoints that answer 403', `"${wordsOf(PUBLIC, 'CLUB_REQUESTS_CLOSED')}"`, `"${wordsOf(KEEPER, 'REQUESTS_CLOSED')}"`, 'today\'s "Club not found"', 'No switch is added']) {
      expect(off, piece).toContain(piece)
    }
    const stands = bullet(block, '- **What ships as main stands.**')
    for (const piece of ['no row of these two kinds can exist', 'nothing a keeper meets changes', 'to the byte', 'only by the new key, which is absent', `"${wordsOf(KEEPER, 'NOT_A_REQUEST')}"`, '"Club not found"']) {
      expect(stands, piece).toContain(piece)
    }
    const owed = bullet(block, '- **Owed before newClubs goes on.**')
    expect(owed).toContain('step 29\'s twenty-eight as they stand, with none taken away')
    const items = owed.split('\n').filter((l) => l.startsWith('  - '))
    expect(items).toHaveLength(34)
    expect(items[0]).toContain('the parishes of "The parishes" above')
    const before = bullet(part(PREVIOUS), '- **Owed before newClubs goes on.**').split('\n').filter((l) => l.startsWith('  - '))
    expect(items.slice(1, 29)).toEqual(before)
    for (const [i, piece] of ['the keeper seeing the person\'s name and address', 'what a handled row keeps', 'the two sent sentences', 'the fourteen days for these rows', '"Add the club" for a representative'].entries()) {
      expect(items[29 + i], piece).toContain(piece)
    }
  })

  it('names each moved pin by its file, and each moved file holds the count as it stands', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('no earlier test file changes its count of cases')
    // Moved at WS09 step 31, whose two routes are the 116th and 117th: 115 before it.
    expect(read(MOVED[0])).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(117)')
    // Moved at WS09 step 31, whose two routes are the 116th and 117th: 115 before it.
    for (const file of MOVED.slice(1, 7)) expect(read(file), file).toContain('expect(read(\'test/unit/routes.test.ts\')).toContain(\'expect(real.filter((r) => r.startsWith(\\\'api/\\\')).length).toBe(117)\')')
    expect(read('test/unit/nav.test.ts')).toContain('{FEATURES.newClubs && <Route path="/clubs/suggest" element={<SuggestClubPage />} />}')
    for (const file of ['test/unit/redesign-status-step30.test.ts', 'test/unit/club-routing-server-only.test.ts', 'test/unit/club-page-edges.test.tsx', 'test/unit/mail-worker-closure.test.ts']) {
      expect(pins, file).toContain(`\`${file}\``)
    }
  })

  it('gives the lint as the base\'s and the build\'s figures with why each moved, and the worker\'s dry run unmoved', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `6786cba`')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', '`index-BHrFU1By.js` at 522,522 bytes', '`index-BA4R4uMw.css`', '`features-BFUKrFdH.js`', '76.61 KiB, gzip 20.53 KiB', '78,448 bytes', 'Pages Functions']) {
      expect(build, piece).toContain(piece)
    }
    const grew = /at 522,522 bytes to `index-[\w-]+\.js` at ([\d,]+), ([\d,]+) bytes/.exec(build)
    expect(grew).not.toBeNull()
    expect(num(grew![1]) - 522522).toBe(num(grew![2]))
    for (const file of codeFiles('workers')) expect(read(file), file).not.toMatch(/laPlaces|clubRequests|utils\/clubs\/places/)
  })
})

describe('REDESIGN_STATUS.md, the thirtieth step of WS09: the Checks line, the map and the lists', () => {
  it('gives each figure once, the third browser project before and after, and the base\'s figures', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('with the one todo beside them')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('the base\'s browser run 1,020 tests, 683 that run and 337 that skip')
    expect(checksLine).toMatch(/the third project, `a11y-clubs`, alone: 21 passed on the base and 25 passed/)
  })

  it('adds one sentence to criterion 10 and one to criterion 4, each before its planned step', () => {
    const ten = entries(map).find((l) => l.startsWith('- **Criterion 10.**')) ?? ''
    const sentence = 'Built in WS09 step 30: Suggest a club and Start a club'
    expect(ten.split(sentence)).toHaveLength(2)
    expect(ten.indexOf(sentence)).toBeLessThan(ten.indexOf('Planned: WS09 step 30.'))
    expect(ten).toContain('`test/integration/club-suggest-club.test.ts`')
    const four = entries(map).find((l) => l.startsWith('- **Criterion 4.**')) ?? ''
    const city = 'Built in WS09 step 30: the forms\' city or ZIP'
    expect(four.split(city)).toHaveLength(2)
    expect(four.indexOf(city)).toBeLessThan(four.indexOf('Planned: WS09 step 34.'))
  })

  it('tags its deviations, verify items and follow-ups, the fourteen days first among the follow-ups', () => {
    expect(tagged(deviations).map(head)).toEqual([
      'The five regions, not seven (WS09 step 30).', 'The place file on the server alone (WS09 step 30).', 'The sent sentences (WS09 step 30).', 'The cases in a file of their own (WS09 step 30).',
    ])
    expect(tagged(verify).length).toBeGreaterThanOrEqual(7)
    for (const piece of ['`6786cba`', 'line 2205', '`Clubs-H-2`', 'Wed, Nov 25, 2026', 'migration 0066', 'STREAMS.md', '`requireAdmin`']) expect(tagged(verify).join('\n'), piece).toContain(piece)
    const follows = tagged(followUps)
    expect(head(follows[0])).toBe('The fourteen days for a new club\'s rows (WS09 step 30).')
    expect(follows.map(head)).toContain('The audit page\'s name for Mark as handled (WS09 step 30).')
    expect(follows.map(head)).toContain('The form\'s browser test cannot send (WS09 step 30).')
  })

  it('keeps the plain-language rules in what the step wrote and in the files it adds', () => {
    const written = [block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps)].join('\n')
    const files = [...NEW_FILES.filter((f) => f !== PLACES), ...Object.keys(NEW_TESTS)].map((f) => read(f)).join('\n')
    for (const [name, rule] of [['dashes', DASHES], ['working words', BANNED], ['tools', TOOLS], ['bare letters', BARE], ['old initials', OLD_INITIALS], ['unfilled', UNFILLED], ['he', HE]] as const) {
      expect(written, name).not.toMatch(rule)
      // The files' code calls .slice(), so the working words are read in their comments alone.
      const text = name === 'working words' ? files.split('\n').filter((l) => /^\s*(?:\/\/|\*)/.test(l)).join('\n') : files
      if (name !== 'unfilled' && name !== 'he') expect(text, name).not.toMatch(rule)
    }
    expect(read(SELF)).not.toMatch(DASHES)
    expect(read(PLACES)).not.toMatch(DASHES)
  })
})
