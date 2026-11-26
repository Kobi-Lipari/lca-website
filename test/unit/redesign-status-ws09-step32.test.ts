// test/unit/redesign-status-ws09-step32.test.ts
//
// REDESIGN_STATUS.md records WS09's thirty-second step, the list's answer
// and the order, the first of the plan's four steps of checkpoint Y. Like
// step 31's record test, this file reads only the WS09 section, from its
// heading to the WS10 heading. Pinned here: this step's block right after
// checkpoint X's review, and before the four lists while it is the latest;
// the Status line's clause and tail while this step is the latest; the
// block's parts in order and this step's own figures, which must agree with
// the files they describe; the sentences this step added to the map; the
// tagged entries of the lists; and the plain-language rules over what the
// step wrote and the files it adds. It counts no file of the whole tree, and
// no line here reads how a switch ships.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'
import { clubDirectoryItemSchema } from '../../domain/contracts/clubs'
import { DIVIDER_MILES, NO_FILTER_MATCH, filterCaption, nameCaption } from '../../domain/clubs/order'
import { regionKey } from '../../domain/clubs/directoryAddress'
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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|${'Z' + 'Z'}[A-Z]|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|${'CHECKS' + '_LINE'}|[A-Z]+_(?:${['WORDS', 'LINE', 'BYTES', 'SHA', 'CASES', 'RESULT', 'OWED'].join('|')})\\b`)
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
const TAG = '(WS09 step 32).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 checkpoint X: the review of the whole and its fixes'
const STEP = '### WS09 step 32: the list\'s answer and the order'
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
const latest = latestStep === 32 && latestBlock === STEP

const HANDLER = 'functions/api/clubs.ts'
const DIRECTORY = 'functions/utils/clubs/directory.ts'
const ORDER = 'domain/clubs/order.ts'
const NEAR = 'domain/clubs/nearZip.ts'
const POINTS = 'domain/clubs/laPoints.ts'
const ADDRESS = 'domain/clubs/directoryAddress.ts'
const DESCRIPTION = 'domain/clubs/description.ts'
const SELF = 'test/unit/redesign-status-ws09-step32.test.ts'
const NEW_FILES = [DIRECTORY, ORDER, NEAR, POINTS, ADDRESS, DESCRIPTION]
/** Each new test with the count of cases its run gives. */
const NEW_TESTS: Record<string, number> = {
  'test/integration/clubs-directory.test.ts': 10,
  'test/unit/club-order.test.ts': 19,
  'test/unit/near-zip.test.ts': 12,
  'test/unit/directory-address.test.ts': 7,
  'test/unit/club-list-callers.test.ts': 5,
  'test/integration/clubs-directory-edges.test.ts': 17,
  'test/unit/club-order-edges.test.ts': 16,
  'test/unit/near-zip-edges.test.ts': 19,
}
/** Each test this step grew, from its count on the base to its count now. */
const GROWN_TESTS: Record<string, [number, number]> = {
  'test/integration/contracts/clubs.test.ts': [8, 10],
  'test/unit/la-places.test.ts': [43, 47],
}
const CHANGED = [
  HANDLER, 'domain/contracts/clubs.ts', 'domain/contracts/registry.ts', 'src/areas/clubs/api.ts', 'test/unit/fixtures/api-added-since-split.json', 'functions/utils/clubs/nearest.ts',
  'functions/utils/clubs/pageHtml.ts', 'scripts/data/build-la-places.ts', ...Object.keys(GROWN_TESTS),
]
const MOVED = ['test/unit/redesign-status-ws09-step1.test.ts', 'test/unit/redesign-status-ws09-step30.test.ts']
const UNTOUCHED = [
  'src/pages/ClubsPage.tsx', 'src/pages/HomePage.tsx', 'src/pages/AdminPage.tsx', 'src/pages/AdminEmailPage.tsx', 'src/pages/AdminNewsletterPage.tsx', 'src/lib/features.ts', 'src/lib/nav.ts',
  'src/App.tsx', 'functions/utils/clubs/pages.ts', 'functions/utils/search.ts', 'domain/clubs/laPlaces.ts', 'domain/clubs/placeNames.ts', 'domain/clubs/pageWords.ts', 'test/unit/contracts-pending.ts',
  'functions/utils/auth.ts', 'functions/utils/email.ts', 'functions/utils/admin/campaigns.ts', 'test/integration/harness.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts',
]
/** What this step names, which no untouched file may hold. */
const OURS = /directoryAddress|nearZip|laPoints|clubDirectory|ClubDirectory|answerDirectory|clubDescription|WS09 step 32/
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,)]`).exec(files)?.[1])
/** A file's cases as its run gives them: every `it(` and `test(` line and each item of a one-line table of cases. */
function casesIn(file: string): number {
  const text = read(file)
  let count = (text.match(/^\s*(?:it|test)\(/gm) ?? []).length
  for (const m of text.matchAll(/^\s*it\.each\(\[([^\]\n]*)\]/gm)) count += m[1].split(',').length
  for (const m of text.matchAll(/^\s*it\.each\(\[\n((?:[ \t]*\[.*\],?\n)+)[ \t]*\]\)/gm)) count += m[1].split('\n').filter((l) => l.trim().startsWith('[')).length
  return count
}
/** A file's code with its comments taken out. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
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

describe('REDESIGN_STATUS.md, the thirty-second step of WS09: the block', () => {
  it('sits once, right after checkpoint X\'s review, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line the clause that checkpoint Y is under way, and this step\'s tail while it is the latest', () => {
    expect(status).toContain('\n## WS09: Clubs as living listings\n')
    expect(statusLine).toContain('and waits for its own draft pull request and K\'s word, checkpoint Y, steps 32 to 35, is under way on `redesign/ws09-clubs-y`, cut from checkpoint X\'s head')
    const tail = statusLine.slice(statusLine.lastIndexOf('; ') + 2)
    if (latest) {
      expect(statusLine).toContain('WS09 step 32, the list\'s answer and the order, gives `GET /api/clubs` the new directory\'s wider answer, kept five minutes at the edge, only with `CLUB_PAGES_ON` set')
      expect(tail).toContain('checkpoint X\'s review and its fixes, step 32, K\'s answers to checkpoint S\'s review')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying where the step sits and what it builds, behind which constant', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the first of the plan\'s four steps of checkpoint Y (steps 32 to 35)', '`redesign/ws09-clubs-y`', '`f46fd6d`', '`CLUB_PAGES_ON`', `\`${HANDLER}\``, `\`${DIRECTORY}\``,
      `\`${ORDER}\``, `\`${NEAR}\``, `\`${POINTS}\``, `\`${ADDRESS}\``, 'the base\'s to the byte', 'No handler file, no switch and no migration is added, and no page changes.',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order, with the description first among the judgement calls', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The answer.**', '- **The keepers.**', '- **The cache.**', '- **The place stays on the device.**', '- **The points file.**',
      '- **The order.**', '- **The address.**', '- **The contract.**', '- **The callers.**', '- **The map (criteria 2 and 4, the rules).**', '- **Branch.**', '- **What the merge does.**',
      '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Rulings not kept.**',
      '- **Owed before newClubs goes on.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const calls = bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l))
    expect(calls.length).toBeGreaterThanOrEqual(8)
    expect(calls[0]).toMatch(/^ {2}- The description: /)
    // The entry's record lines, each in its part; the keepers' says what ruling one says instead.
    for (const [name, words] of [
      ['- **The order.**', 'Neither order ever removes a club.'],
      ['- **The place stays on the device.**', 'The list\'s endpoint reads no parameter of the request at all'],
      ['- **What ships with every switch off.**', 'Today\'s list answer, byte for byte'],
      ['- **The keepers.**', 'No keeper is named, by K\'s decision 12'],
      ['- **Build.**', 'Bundle'],
    ] as const) expect(bullet(block, name), words).toContain(words)
    expect(bullet(block, '- **Rulings not kept.**')).toBe('- **Rulings not kept.** None.')
  })

  it('names every file it adds and changes, each new test with its count, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...Object.keys(NEW_TESTS), SELF, ...CHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...Object.keys(NEW_TESTS)]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const [file, count] of Object.entries(NEW_TESTS)) {
      expect(writtenCount(files, file), file).toBe(count)
      expect(casesIn(file), file).toBe(count)
    }
    for (const [file, [from, to]] of Object.entries(GROWN_TESTS)) expect(files, file).toContain(`\`${file}\` (${from} to ${to}: `)
    expect(casesIn('test/integration/contracts/clubs.test.ts')).toBe(GROWN_TESTS['test/integration/contracts/clubs.test.ts'][1])
    expect(writtenCount(files, SELF)).toBe((read(SELF).match(/^\s*it\(/gm) ?? []).length)
    const grown = bullet(files, '  - Grown with no change:')
    for (const piece of ['`test/unit/domain-boundaries.test.ts` from 78 to 83', 'one case for each of the five new files under `domain/`', '117 handler files', '`test/unit/route-audit.test.ts` does not move']) {
      expect(grown, piece).toContain(piece)
    }
    expect(NEW_FILES.filter((f) => f.startsWith('domain/'))).toHaveLength(5)
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const file of UNTOUCHED) expect(beyond, file).toContain(`\`${file}\``)
    for (const file of UNTOUCHED) expect(read(file), file).not.toMatch(OURS)
    // The directory's own files read the address, the order and, for the place, the nearest ZIP code, as step 32 wrote them to be read (WS09 steps 33 and 34).
    const reads: Record<string, RegExp> = {
      'src/areas/clubs/components/ClubDirectory.tsx': /laPoints|answerDirectory/,
      'src/areas/clubs/components/PlaceField.tsx': /laPoints|directoryAddress|clubs\/order|answerDirectory/,
      'src/areas/clubs/components/ClubFilters.tsx': /nearZip|laPoints|directoryAddress|answerDirectory/,
    }
    for (const file of [...codeFiles('workers'), ...codeFiles('functions/utils/mail'), ...codeFiles('domain/mail'), ...codeFiles('src')]) expect(read(file), file).not.toMatch(reads[file] ?? (['src/areas/clubs/components/ClubDirectory.tsx', 'src/areas/clubs/directoryWords.ts'].includes(file) ? /nearZip|laPoints|answerDirectory/ : /nearZip|laPoints|directoryAddress|clubs\/order|answerDirectory/))
    expect(readdirSync(join(ROOT, 'migrations')).filter((f) => /^\d{4}_/.test(f)).sort().at(-1)).toBe(/expect\(sql\.at\(-1\)\)\.toBe\('(\d{4}_\w+\.sql)'\)/.exec(read('test/unit/drizzle-baseline.test.ts'))?.[1])
  })
})

describe('REDESIGN_STATUS.md, the thirty-second step of WS09: the parts against the files', () => {
  it('gives the answer\'s keys in their order, the nine and then the directory\'s, as the contract holds them', () => {
    const answer = bullet(block, '- **The answer.**')
    const keys = Object.keys(clubDirectoryItemSchema.shape)
    expect(keys.slice(0, 9)).toEqual(['id', 'name', 'city', 'meeting_schedule', 'color', 'image_url', 'region', 'latitude', 'longitude'])
    const at = keys.map((key) => answer.indexOf(`\`${key}\``))
    for (const [i, key] of keys.entries()) expect(at[i], key).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const piece of ['`FIRST_PLACE_JOIN`', '`clubAddress`', '`clubDescription`', '`firstPlacePoint`', 'never a spread of a row', 'every club the base lists']) expect(answer, piece).toContain(piece)
    expect(codeOf(DIRECTORY)).toContain('ORDER BY c.name ASC, c.id ASC')
    expect(codeOf(DIRECTORY)).not.toMatch(/\.\.\.row\b/)
  })

  it('says no keeper is named, and the code and the contract carry none', () => {
    const keepers = bullet(block, '- **The keepers.**')
    for (const piece of ['no seat, no person\'s name and no "kept by" of any kind', 'no row carries an email address', 'are not built']) expect(keepers, piece).toContain(piece)
    for (const key of Object.keys(clubDirectoryItemSchema.shape)) expect(key).not.toMatch(/keep|rep|seat|officer|contact|email|person|member/)
    expect(codeOf(DIRECTORY)).not.toMatch(/contact_email|contact_name|club_officers|seat_regions|board_seat|keeper/)
  })

  it('says how the answer is kept, five minutes under one key, as the code holds it', () => {
    const cache = bullet(block, '- **The cache.**')
    for (const piece of [
      '`Cache-Control: public, max-age=300`', '`Cache-Control: no-cache`', 'every query parameter dropped', 'the same for every reader', 'can take up to five minutes to show in the directory',
      'the admin page\'s Clubs tab, the clubs of its Members tab and the club picker of its tournament form, and the email page\'s choice of clubs', 'No sentence on any page says it in this step.',
    ]) expect(cache, piece).toContain(piece)
    const code = codeOf(DIRECTORY)
    expect(code).toContain('export const DIRECTORY_CACHE_CONTROL = \'public, max-age=300\'')
    // Only the edge keeps the list: the reader is sent no-cache, a kept answer too.
    expect(code).toContain('export const DIRECTORY_READER_CACHE_CONTROL = \'no-cache\'')
    expect(code).toContain('if (kept) return forTheReader(kept)')
    expect(code).toContain('return forTheReader(response)')
    expect(code).toContain('return `${origin}/api/clubs`')
    expect(code).toContain('directoryCacheKey(new URL(context.request.url).origin)')
    // The constant is read in the handler at each call, never copied.
    const handler = codeOf(HANDLER)
    expect(handler).toContain('if (CLUB_PAGES_ON) return answerDirectory(context, directoryCache())')
    expect(handler).not.toMatch(/=\s*CLUB_PAGES_ON/)
  })

  it('says the place stays on the device, and the server reads no parameter', () => {
    const place = bullet(block, '- **The place stays on the device.**')
    for (const piece of ['`nearestZip(point)`', '`placeFor(text)`', '`readTypedPlace`', 'one read statement with no bound value, no write and no log line', 'No file under `src/` imports']) expect(place, piece).toContain(piece)
    // No part of the request is read: no query, no header and no cookie. The answer's own cache line is set, not read.
    for (const file of [HANDLER, DIRECTORY]) expect(codeOf(file), file).not.toMatch(/searchParams|request\.headers|\.headers\.(?:get|has|entries|forEach)\b|cookie|console\./i)
    expect(codeOf(NEAR)).toContain('import { readTypedPlace } from \'./placeNames\'')
  })

  it('gives the points file\'s size and the downloads\' sha256 as the files hold them', () => {
    const points = bullet(block, '- **The points file.**')
    const size = Buffer.byteLength(read(POINTS))
    expect(size).toBeLessThan(24000)
    expect(points).toContain(`in ${size.toLocaleString('en-US')} bytes, under the 24,000 asked`)
    const header = read('domain/clubs/laPlaces.ts')
    for (const [, name, hash] of header.matchAll(/^\/\/ {3}(\S+): [\d,]+ bytes, sha256 ([0-9a-f]{64})$/gm)) expect(points, name).toContain(`\`${name}\` \`${hash}\``)
    for (const piece of ['540 ZIP code areas', '490 towns', 'three decimal places', 'byte for byte as it stands', '`LA_PLACES_DOWNLOADS`']) expect(points, piece).toContain(piece)
    expect(read(POINTS)).toContain('540 ZIP code areas\' points and 490 towns\' points')
    expect(createHash('sha256').update(read(POINTS)).digest('hex')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('gives the order\'s and the address\'s words as the files hold them', () => {
    const order = bullet(block, '- **The order.**')
    expect(DIVIDER_MILES).toBe(75)
    for (const piece of [`"Farther than ${DIVIDER_MILES} miles"`, `"${nameCaption(1, 'kni', 25)}"`, `"${nameCaption(12, 'Example Chess', 12)}"`, `"${filterCaption(5)}"`, `"${filterCaption(1)}"`, `"${NO_FILTER_MATCH}"`, 'BINARY collation', '`REGIONS`']) {
      expect(order, piece).toContain(piece)
    }
    const address = bullet(block, '- **The address.**')
    const baton = REGIONS.find((r) => r.startsWith('Baton Rouge'))!
    expect(address).toContain(`\`${regionKey(baton)}\` for ${baton}`)
    for (const piece of ['`near`', '`sort`', '`sort=az`', '`region`', '`weekends`', '`scholastic`', 'Reading is forgiving', 'Writing is canonical']) expect(address, piece).toContain(piece)
  })

  it('gives the branch, the merge and what ships with every switch off, with the figures the tree holds', () => {
    expect(bullet(block, '- **Branch.**')).toContain('`redesign/ws09-clubs-y`, cut from checkpoint X\'s head, `f46fd6d`, "WS09 checkpoint X: the review of the whole and its fixes"')
    const merge = bullet(block, '- **What the merge does.**')
    for (const piece of ['117 handler files', '58 of the 162 methods', '`PENDING_COUNT` still 104', '`deploy-worker.yml`']) expect(merge, piece).toContain(piece)
    expect(Number(/expect\(real\.filter\(\(r\) => r\.startsWith\('api\/'\)\)\.length\)\.toBe\((\d+)\)/.exec(read('test/unit/routes.test.ts'))?.[1])).toBeGreaterThanOrEqual(117)
    if (latest) {
      expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 104')
      expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(58)
    }
    expect(Object.keys(contracts['clubs'])).toEqual(['GET'])
    expect(read('test/unit/contracts-pending.ts')).not.toContain('\'GET clubs\'')
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['the base\'s bytes and the base\'s headers for every request', 'the same one query', 'nothing kept at the edge', 'the site\'s bundle is the base\'s', 'No switch is added.']) {
      expect(off, piece).toContain(piece)
    }
  })

  it('names each moved pin by its file, the choices owed to K, and the build\'s figures', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of [...MOVED, 'test/unit/club-editor.test.tsx', 'test/unit/api-split-modules.test.ts']) expect(pins, file).toContain(`\`${file}\``)
    expect(read(MOVED[0])).toContain('const step32Added: Record<string, number> = { \'test/integration/contracts/clubs.test.ts\': 2 }')
    expect(read(MOVED[1])).toContain('(file === \'test/unit/la-places.test.ts\' ? 4 : 0)')
    const owed = bullet(block, '- **Owed before newClubs goes on.**').split('\n').filter((l) => l.startsWith('  - '))
    expect(owed).toHaveLength(4)
    for (const [i, piece] of ['the divider at 75 miles', 'straight-line miles', 'the five minutes', 'three decimal places'].entries()) expect(owed[i], piece).toContain(piece)
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `f46fd6d`')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', 'every file of `dist/` is the base\'s to the byte', '`index-CrDF3D7U.js` at 523,761 bytes', '`index-B62MA3MO.css` at 173,817 bytes', '`features-BFUKrFdH.js` at 741 bytes', '76.61 KiB, gzip 20.53 KiB', '78,448 bytes']) {
      expect(build, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, the thirty-second step of WS09: the Checks line, the map and the lists', () => {
  it('gives each figure once, in the forms the close reads, with the base\'s figures', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', ' over ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toMatch(/over [\d,]+ files \(1,511 on the base\)/)
    expect(checksLine).toMatch(/unit [\d,]+ tests in [\d,]+ files \(13,211 in 609 on the base\)/)
    expect(checksLine).toMatch(/integration [\d,]+ in [\d,]+ files \(3,939 in 220 on the base\)[^;]*with the one todo beside them/)
    expect(checksLine).not.toMatch(/that run in [\d,]+ files/)
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('the base\'s browser run 1,028 tests, 691 that run and 337 that skip')
    expect(checksLine).toContain('no browser run of this step\'s own')
  })

  it('adds one sentence to criteria 2 and 4, each before its planned step', () => {
    for (const [criterion, test] of [['- **Criterion 2.**', '`test/unit/club-order.test.ts`'], ['- **Criterion 4.**', '`test/unit/near-zip.test.ts`']] as const) {
      const entry = entries(map).find((l) => l.startsWith(criterion)) ?? ''
      const sentence = 'Built in WS09 step 32: '
      expect(entry.split(sentence), criterion).toHaveLength(2)
      expect(entry.indexOf(sentence), criterion).toBeLessThan(entry.indexOf('Planned: WS09 step 34.'))
      expect(entry, criterion).toContain(test)
    }
  })

  it('tags its deviations, verify items and follow-ups', () => {
    expect(tagged(deviations).map(head)).toEqual([
      'No keeper in the list (WS09 step 32).', 'Five regions (WS09 step 32).', 'No near on the server (WS09 step 32).', 'One key for the cache (WS09 step 32).',
      'A Louisiana ZIP code not found (WS09 step 32).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'Today\'s list (WS09 step 32).', 'The cache\'s precedent (WS09 step 32).', 'Today\'s Near me (WS09 step 32).', '75 or 60 (WS09 step 32).', 'Straight-line miles (WS09 step 32).',
      'The collation (WS09 step 32).', 'The counts the entry gives (WS09 step 32).', 'The downloads (WS09 step 32).',
    ])
    expect(tagged(verify).join('\n')).toContain('line 449')
    // The precedent is held by its words, never by its line: a line added above it in that file moves nothing here.
    expect(read('functions/utils/search.ts')).toContain('export function edgeCache()')
    expect(tagged(followUps).map(head)).toEqual(['A save takes up to five minutes to show (WS09 step 32).', 'The place names in the site\'s scripts (WS09 step 32).'])
  })

  it('keeps the plain-language rules in what the step wrote and in the files it adds', () => {
    const written = [block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps)].join('\n')
    const files = [...NEW_FILES, ...Object.keys(NEW_TESTS)].map((f) => read(f)).join('\n')
    for (const [name, rule] of [['dashes', DASHES], ['working words', BANNED], ['tools', TOOLS], ['bare letters', BARE], ['old initials', OLD_INITIALS], ['unfilled', UNFILLED], ['he', HE]] as const) {
      expect(written, name).not.toMatch(rule)
      // The files' code calls .slice(), so the working words are read in their comments alone.
      const text = name === 'working words' ? files.split('\n').filter((l) => /^\s*(?:\/\/|\*)/.test(l)).join('\n') : files
      if (name !== 'unfilled' && name !== 'he') expect(text, name).not.toMatch(rule)
    }
    expect(read(SELF)).not.toMatch(DASHES)
  })
})
