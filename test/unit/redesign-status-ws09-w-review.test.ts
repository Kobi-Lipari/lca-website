// test/unit/redesign-status-ws09-w-review.test.ts
//
// REDESIGN_STATUS.md records checkpoint W as a whole: its own section, WS09
// steps 20 to 24, and the block of its merge-safety review with the one round
// of fixes it led to. Like the other record tests of WS09, this file reads only
// the WS09 section, from its heading to the WS10 heading. Pinned here: the two
// blocks in their places and their parts in order; the section's commits in
// order, what the merge carries as one list, the way a revert goes and what K
// is asked; the review's fourteen findings each by its id and the six refuted;
// the fixes it names, against the files; the Status and PR lines as this round
// leaves them; the criterion map's two sentences, the two deviations, the
// follow-ups and the browser half's one corrected sentence; the figures; and
// the plain-language rules over what this round wrote. No line here reads how
// a switch ships.
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
/** The words that would make K, the owner, a he. */
const HE = /\b(?:he|his|him)\b/i
/** A short date: a weekday, a month and a day, with the year. */
const SHORT_DATE = /\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat), (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}\b/g
/** A long date: a weekday, a month and a day, with the year. */
const LONG_DATE = /\b(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b/g
/** A month and a day, with or without a weekday before it. */
const ANY_DATE = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, \d{4}\b/g

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
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const lines = ws09.split('\n')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### Checkpoint W: WS09 main taken in again after the saved templates'
const SECTION = '### Checkpoint W: WS09 steps 20 to 24, the public club page'
const BLOCK = '### WS09 checkpoint W: the review of the whole and its fixes'
const LISTS = '### WS09 decisions'
const section = part(SECTION)
const block = part(BLOCK)
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS) - 1] === BLOCK
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const mapItem = (id: string) => lines.find((l) => l.startsWith(`- **${id}.**`)) ?? ''
const deviations = part('### WS09 deviations from the brief')
const followUps = part('### WS09 follow-ups')
const entry = (list: string, title: string) => list.split('\n').find((l) => l.startsWith(`- **${title}**`)) ?? ''
const TAGGED_W = /^- \*\*[^*]+ \(WS09 checkpoint W\)\.\*\* \S/

const SELF = 'test/unit/redesign-status-ws09-w-review.test.ts'
/** The checkpoint's commits, oldest first, as `git log --oneline --no-merges` lists them since main. */
const COMMITS = ['45d86bd', '0b75f5d', '0a25e33', '09ca444', 'ad47e8a', 'b6bf464', '9549f4f', '216e7ae', 'fd157fd', '294cb1a', '6e11649']
const FINDINGS = ['B5', 'B6', 'C1', 'D1', 'D2', 'D3', 'D4', 'D6', 'E1', 'E2', 'E3', 'E4']
const REFUTED = ['A1', 'B1', 'B2', 'B3', 'C2', 'D7']
const NEW_TESTS: ReadonlyArray<readonly [string, string]> = [
  ['test/unit/club-page-review-fixes.test.tsx', 'the helper\'s hosts'],
  ['test/unit/club-editor-page-preview-links.test.tsx', 'the preview\'s About'],
  ['test/unit/seed-fixtures-header.test.ts', 'the tables deleted from'],
  ['test/integration/club-page-review-fixes.test.ts', 'the label by its host'],
  [SELF, 'the two blocks\' places and parts'],
]
const HELD = [
  'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts',
  'test/a11y/signedIn.ts',
]

describe('REDESIGN_STATUS.md, checkpoint W: the two blocks', () => {
  it('stand once each, the section right after the second taking in of main and the review right after it, before the four lists while the review is the latest', () => {
    expect(section).not.toBe('')
    expect(block).not.toBe('')
    for (const heading of [SECTION, BLOCK]) expect(ws09.split(`\n${heading}\n`), heading).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(SECTION)
    expect(headings[headings.indexOf(SECTION) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS)
  })

  it('the section gives its commits in order, oldest first, this round last and without a hash, and has every part in order', () => {
    const opening = section.split('\n')[2] ?? ''
    const at = COMMITS.map((hash) => opening.indexOf(`\`${hash}\``))
    for (const [i, hash] of COMMITS.entries()) expect(at[i], hash).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(opening.indexOf('and last the one round of fixes of its review, which the next block records')).toBeGreaterThan(at.at(-1)!)
    for (const piece of ['`992b145`', 'draft pull request 154 for K\'s word', 'WS09 step 15', '`newClubs` and `newLook`', '`CLUB_PAGES_ON`']) expect(opening, piece).toContain(piece)
    const parts = ['- **What the merge carries.**', '- **Owed before newClubs goes on, K\'s own.**', '- **The gate.**']
    const where = parts.map((p) => section.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(where[i], p).toBeGreaterThan(-1)
    expect([...where].sort((a, b) => a - b)).toEqual(where)
    expect(bullet(section, '- **The gate.**')).toContain('The next block\'s Checks line')
  })

  it('the section lists what a person or a program meets differently as one list, the switches, and the way a revert goes', () => {
    const carries = bullet(section, '- **What the merge carries.**')
    const list = bullet(carries, '  - Everything a person or a program can meet differently')
    expect(list.split('\n').filter((l) => /^ {4}- /.test(l))).toHaveLength(9)
    for (const piece of [
      'No migration', '`0072_regions_by_seat.sql` stays the newest', '`GET /api/clubs/{slug}` finds its club by its short address', 'K\'s choice 8 (a)',
      'up to two reads more', 'Step 20\'s answer, `GET /api/clubs/:id/page`, with `CLUB_KEEPERS_ON` on as `main` ships it', '`requireClubRep`', '`Cache-Control: no-store`',
      '`/sitemap.xml` and `/robots.txt` now pass through a function each', '`chunk-KS7C4IRE-B8gADeQx.js` at 41,642 bytes', '`roles-BW0GGqXX.js` at 1,280', '604,502 bytes against `main`\'s 603,205',
      'The daily-emails worker', '76.61 KiB, gzip 20.53 KiB', 'The site\'s growth against `main`', '`index-DOwZK3_c.js` at 562,337 bytes', '`index-BSav8PcT.js` at 520,712',
      '`index-D4ifEC4r.css` at 168,767 bytes', '`index-CGFkXpdq.css` at 171,910', '`features-BFUKrFdH.js` at 741 bytes', 'from 217 files to 223', 'The browser tests\' third build',
      'CI\'s own minutes were not measured',
    ]) expect(list, piece).toContain(piece)
    expect(carries).toContain('No switch is added and none changes')
    const revert = bullet(carries, '  - The way a revert goes')
    for (const piece of ['leaves the database as it found it', 'puts back `main`\'s site', 'Were `CLUB_PAGES_ON` ever set before a revert, it goes off first', 'for up to a day']) expect(revert, piece).toContain(piece)
  })

  it('the section names the four choices put to K at the pull request and what else K owes', () => {
    const owed = bullet(section, '- **Owed before newClubs goes on, K\'s own.**')
    const choices = bullet(owed, '  - The four choices put to K at the pull request:')
    expect(choices.split('\n').filter((l) => /^ {4}- /.test(l))).toHaveLength(4)
    for (const piece of [
      'step 20\'s answer goes to a club\'s keepers', 'Lake Charles / Southwestern', 'the room under Save and publish', '1,356 pixels at 1,280 by 800 and 1,256 at 1,440 by 900',
      'the club editor\'s Facebook field should refuse an address on another site',
    ]) expect(choices, piece).toContain(piece)
    for (const piece of [
      'straight-line miles', 'The page\'s preview in the editor', 'the name under the cover', 'Follow this club and Add to calendar', 'N of M spots filled', '"All {region} clubs"',
      'The jolt a slow connection shows', 'no header and no link home with scripts off', '`og-default.jpg`', 'the 301s, once served', 'the sitemap lists every listed event',
    ]) expect(owed, piece).toContain(piece)
  })

  it('the review block has its parts in order, a sub-bullet for each of the fourteen findings, and one line for the six refuted', () => {
    const parts = [
      '- **What this is.**', '- **Findings and fixes.**', '- **The Status and PR lines.**', '- **What ships with every switch off.**', '- **Pins moved.**', '- **Follow-ups.**',
      '- **Judgement calls.**', '- Checks:', '- **Files.**', '- **Branch.**',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const what = bullet(block, '- **What this is.**')
    for (const piece of ['Five readers', 'A second reader tested each finding', 'Twenty were reported and fourteen stood, none blocking; six were refuted']) expect(what, piece).toContain(piece)
    const findings = bullet(block, '- **Findings and fixes.**').split('\n').filter((l) => /^ {2}- /.test(l))
    expect(findings).toHaveLength(14)
    expect(findings[0]).toMatch(/^ {2}- B4, with D5, one fix in words\. /)
    for (const [i, id] of FINDINGS.entries()) expect(findings[i + 1], id).toMatch(new RegExp(`^ {2}- ${id}\\. `))
    const refuted = findings.at(-1)!
    expect(refuted).toMatch(/^ {2}- Refuted, and not acted on: /)
    for (const id of REFUTED) expect(refuted, id).toMatch(new RegExp(`\\b${id}, since `))
    expect(findings[0]).toContain('Corrected where the sentence stands')
    expect(findings[0]).toContain('the mail stream is told')
  })
})

describe('REDESIGN_STATUS.md, checkpoint W\'s review: the fixes against the files', () => {
  it('names each fix of the product where the tree holds it', () => {
    const helper = read('domain/clubs/facebook.ts')
    expect(helper).toContain('export function isFacebookAddress(')
    expect(read('src/areas/clubs/components/ClubAbout.tsx')).toContain('words: isFacebookAddress(facebook) ? \'Facebook\' : siteOf(facebook)')
    expect(read('functions/utils/clubs/pageHtml.ts')).toContain('words: isFacebookAddress(facebook) ? \'Facebook\' : siteOf(facebook)')
    expect(read('src/areas/clubs/components/ClubCover.tsx')).toContain('className="min-w-0 whitespace-pre-line [overflow-wrap:anywhere]">{meets}</span>')
    expect(read('src/areas/clubs/components/ClubAbout.tsx')).toContain('<span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>')
    for (const file of ['src/areas/clubs/components/ClubEvents.tsx', 'src/areas/clubs/components/NearbyClubs.tsx']) expect(read(file), file).toContain('[overflow-wrap:anywhere]')
    expect(read('domain/clubs/pageWords.ts')).toContain('export const PAGE_SECTION_IDS')
    // Since checkpoint X took checkpoint W in, checkpoint X's contact follows news on the same line.
    expect(read('src/areas/clubs/clubPage.ts')).toContain('export const SECTION_IDS: Record<DrawnSection, string> = { ...PAGE_SECTION_IDS, news: \'news\'')
    expect(read('src/areas/clubs/components/PagePreview.tsx')).toContain('links: [about.facebook, about.website, about.other].map(webLink)')
    const findings = bullet(block, '- **Findings and fixes.**')
    for (const piece of ['`isFacebookAddress` in `domain/clubs/facebook.ts`', '`PAGE_SECTION_IDS` in `domain/clubs/pageWords.ts`', '`whitespace-pre-line`', '`<br>`', '`webLink`', '`min-w-0`', '`[overflow-wrap:anywhere]`']) {
      expect(findings, piece).toContain(piece)
    }
  })

  it('names each fix of the seed, the tests and the routes\' title where the tree holds it', () => {
    const seed = read('scripts/seed/fixtures.sql')
    expect(seed).toContain('Every row it owns has an')
    expect(seed).toContain('the fixture clubs\' places (club_places) are deleted and written again')
    expect(seed).toContain('needs migrations 0001 to 0066 applied first')
    expect(seed).toContain('https://example.org/fixturenorthchessclubmeetingchangesandclosures.')
    // The title gives the figure the count line holds, read from the file, so a later route moves nothing here: 109 at this step.
    const routes = read('test/unit/routes.test.ts')
    const handlers = /expect\(real\.filter\(\(r\) => r\.startsWith\('api\/'\)\)\.length\)\.toBe\((\d+)\)/.exec(routes)?.[1]
    expect(Number(handlers)).toBeGreaterThanOrEqual(109)
    expect(routes).toContain(`it('finds the ${handlers} handler files under api plus the page routes'`)
    const ws02 = read('test/unit/redesign-status-ws02-step2.test.ts')
    expect(ws02).toContain('it(\'holds none of the five early switches off by name in the switch test or the builds spec, as the record says\'')
    expect(ws02).toContain('not\\.toContain')
    for (const piece of ['`0066_club_pages.sql`', '90001 to 90003', '`test/unit/seed-fixtures-header.test.ts`', '568 pixels wide in a window of 320 and of 390']) {
      expect(bullet(block, '- **Findings and fixes.**'), piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, checkpoint W\'s review: the Status and PR lines', () => {
  it('give checkpoint W\'s own clause as it stands, the merges clause straight after it, and the tail\'s new words', () => {
    expect(statusLine).not.toContain('checkpoint W is under way')
    const own = 'checkpoint W, steps 20 to 24, is built and reviewed on `redesign/ws09-clubs-w`, cut from checkpoint V\'s head, holds `main` as it stands and waits in draft pull request 154 for K\'s word, and WS09 step 20, the club page\'s answer behind `CLUB_PAGES_ON` and `CLUB_KEEPERS_ON`, answers 404 to everyone while both are unset and, with `CLUB_KEEPERS_ON` on as `main` ships it, answers a club\'s keepers, and WS09 steps 21 and 22,'
    const merges = 'checkpoint V merged into `main` as pull request 134, `498ec7f`, on Tue, Nov 17, 2026, and the switch-on of `clubKeepers` and `CLUB_KEEPERS_ON` as pull request 139, `35ef23f`, on Wed, Nov 18, 2026, so the two clauses of this line that say they wait for K\'s word stand as they were written before those merges; WS09 step 15 follows as its own pull request;'
    expect(statusLine).toContain(own)
    expect(statusLine).toContain(`only with \`CLUB_PAGES_ON\` set; ${merges}`)
    expect(statusLine.indexOf(merges)).toBeGreaterThan(statusLine.indexOf(own))
    // What the clause says of steps 21 to 24 and of K's decisions 11 and 12 stays in its words.
    for (const piece of [
      'are drawn only with `newClubs` and `newLook` on, and WS09 step 23, the page before any script, is written by the server only with `CLUB_PAGES_ON` set',
      'and on K\'s decision 12 the club page names no keeper to anyone', 'and on K\'s decision 11 a small `robots.txt` that names the sitemap is served only',
    ]) expect(statusLine, piece).toContain(piece)
    const tail = statusLine.slice(statusLine.lastIndexOf('; ') + 2)
    // The third taking in of main adds its own item straight after this one, before K's answers.
    expect(tail).toContain('the new club page in the browser, `main` taken in again after the saved templates, checkpoint W\'s review and its fixes, ')
    // Since checkpoint X took checkpoint W in, checkpoint X's items stand between the two pieces: both are held, in order.
    const review = tail.indexOf('the new club page in the browser, `main` taken in again after the saved templates, checkpoint W\'s review and its fixes, ')
    expect(review).toBeGreaterThanOrEqual(0)
    expect(tail.indexOf('K\'s answers', review)).toBeGreaterThan(review)
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('give the PR line checkpoint W\'s clause in the manner of checkpoint V\'s, and change no other clause', () => {
    expect(prLine).not.toContain('under way')
    expect(prLine.endsWith('; checkpoint W, steps 20 to 24, is built and reviewed on `redesign/ws09-clubs-w` and waits in draft pull request 154 for K\'s word for its merge, and WS09 step 15 follows as a pull request of its own.')).toBe(true)
    expect(prLine).toContain('checkpoint V, its first step and steps 16 to 19, is built and reviewed on `redesign/ws09-clubs-v` and waits in draft pull request 134 for K\'s word for its merge')
    expect(prLine).toContain('as pull request 140, `6257419`, on Thu, Nov 19, 2026, so the three clauses of this line that say they wait stand as they were written before those merges; checkpoint W, steps 20 to 24,')
    const said = bullet(block, '- **The Status and PR lines.**')
    for (const piece of ['No other clause of either line changes', 'no pin moved for the two lines', 'pull request 134, `498ec7f`, on Tue, Nov 17, 2026', 'pull request 139, `35ef23f`, on Wed, Nov 18, 2026']) {
      expect(said, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, checkpoint W\'s review: the map, the deviations, the follow-ups and the one corrected sentence', () => {
  it('ends each step 21 entry of criteria 1 and 6 with its one sentence, before the next entry', () => {
    const one = mapItem('Criterion 1')
    expect(one).toContain('held by `test/unit/club-pages-no-dates.test.tsx`. K\'s decision 12, in checkpoint W, changed it: the told line now reads "Last checked" with its month and year. Planned: WS09 step 33.')
    const six = mapItem('Criterion 6')
    expect(six).toContain('Contact comes with its form. K\'s decision 12, in checkpoint W, took the author line away. Built in WS09 step 22:')
  })

  it('adds the two deviations, tagged for checkpoint W, at the end of their list', () => {
    const tagged = deviations.split('\n').filter((l) => TAGGED_W.test(l))
    expect(tagged.map((l) => /^- \*\*([^*]+)\*\*/.exec(l)![1])).toEqual(['A public "Last checked" month (WS09 checkpoint W).', 'No author line (WS09 checkpoint W).'])
    const entries = deviations.split('\n').filter((l) => l.startsWith('- **'))
    // Since checkpoint X took checkpoint W in, checkpoint X's entries follow the two: they stand together, and last while the review is the latest.
    expect(entries.slice(entries.indexOf(tagged[0]), entries.indexOf(tagged[0]) + 2)).toEqual(tagged)
    if (latest) expect(entries.slice(-2)).toEqual(tagged)
    expect(tagged[0]).toContain('K\'s decision 12 of Tuesday, November 17, 2026')
    expect(tagged[1]).toContain('draws no author line')
  })

  it('closes step 20\'s two follow-ups, gives step 23\'s its sentence, and adds two follow-ups tagged for checkpoint W', () => {
    const closing = ' Closed in checkpoint W by K\'s decision 12, since the page and its answer name no keeper and the told line reads "Last checked" with its month whoever saved.'
    for (const title of ['A child the site cannot tell (WS09 step 20).', 'The told line reads the saver\'s role as it is now (WS09 step 20).']) {
      expect(entry(followUps, title).endsWith(closing), title).toBe(true)
    }
    expect(entry(followUps, 'A child the site cannot tell (WS09 step 20).')).toContain('which may keep the line without a name for every rep, or for a later step that adds such a mark.')
    expect(entry(followUps, 'The plain page before the scripts (WS09 step 23).').endsWith(' The gutter, the measure and the heading sizes were built in "Checkpoint W: WS09 the written page reads as a page", and the jolt when the app draws is what is left.')).toBe(true)
    const tagged = followUps.split('\n').filter((l) => /\(WS09 checkpoint W\)\.\*\*/.test(l))
    for (const line of tagged) expect(line).toMatch(TAGGED_W)
    expect(tagged.map((l) => /^- \*\*([^*]+)\*\*/.exec(l)![1])).toEqual(['No header and no link home with scripts off (WS09 checkpoint W).', 'The Facebook field takes any web address (WS09 checkpoint W).'])
    expect(tagged[1]).toContain('K\'s choice, put to K at checkpoint W\'s pull request')
  })

  it('corrects the browser half\'s one false sentence, in both places it was said, and nothing else of that block', () => {
    const browser = part('### WS09 step 24: the new club page in the browser')
    const opening = browser.split('\n')[2] ?? ''
    expect(opening.split(/\.\s/)).toHaveLength(1)
    expect(opening).toContain('gains one list and its check for the third build, `A11Y_CLUBS_VARIANT` in its import from `./global-setup` and three comment lines, two in its header and one over the list, with its other lines as they were.')
    expect(bullet(browser, '- **Files.**')).toContain('`test/a11y/builds.spec.ts` (one list and its check, `A11Y_CLUBS_VARIANT` in its import from `./global-setup` and three comment lines, two in its header and one over the list)')
    // What the sentence says is what the builds spec holds.
    const spec = read('test/a11y/builds.spec.ts')
    expect(spec).toContain('import { A11Y_CLUBS_VARIANT, A11Y_VARIANTS, ROOT } from \'./global-setup\'')
    expect(spec).toContain('const CLUBS_SWITCHES_ON = [...SWITCHES_ON, \'newClubs\']')
  })
})

describe('REDESIGN_STATUS.md, checkpoint W\'s review: the figures, the files and the plain words', () => {
  it('gives each check once, with the base beside it, and the base\'s browser totals by project', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'one whole run of `npm run test:a11y`', 'worker\'s dry run ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    for (const piece of [
      '13 errors and 11 warnings', '(1,362 on the base)', '(12,352 in 548 on the base)', '(3,475 in 189 on the base)', 'integration 3,483 tests that run in 190 files', 'a local production build', '`VITE_`',
      '`index-BSav8PcT.js` at 520,712 bytes', '`index-fk0AyRCw.js`', '`index-CGFkXpdq.css` at 171,910 bytes', '`features-BFUKrFdH.js` at 741 bytes',
      '`a11y-on` 463 passed and 36 skipped, `a11y-off` 199 and 301, `a11y-clubs` 14 passed, 676 passed and 337 skipped together', 'before the fix with the new fixture words: 2 failed and 16 passed',
      '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched', '76.61 KiB, gzip 20.53 KiB', '78,448 bytes', 'Tuesday, November 24, 2026',
    ]) expect(checksLine, piece).toContain(piece)
    expect(checksLine).not.toMatch(/@@/)
    const built = /`npm run build` \((\d+) files in `dist\/assets`/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
  })

  it('names every file it adds with its count of cases, the files it changes, and no file the mail stream holds as touched', () => {
    const files = bullet(block, '- **Files.**')
    for (const [file, first] of NEW_TESTS) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect(files, file).toContain(`\`${file}\` (${casesIn(file)}: ${first}`)
    }
    expect(files).toContain('`domain/clubs/facebook.ts` (the helper)')
    for (const piece of ['`scripts/seed/fixtures.sql` (its header and one club\'s meeting words)', 'Nothing under `migrations/`, `drizzle/` or `workers/` changes', 'No file the mail stream holds is touched', ...HELD.map((f) => `\`${f}\``)]) {
      expect(files, piece).toContain(piece)
    }
    for (const piece of ['`redesign/ws09-clubs-w`', '`6e11649`', 'this block\'s diff is against `6e11649`']) expect(bullet(block, '- **Branch.**'), piece).toContain(piece)
  })

  it('keeps the dashes, the working words, any tool\'s name and the old initials out of what this round wrote, and gives every date its weekday', () => {
    const written = [
      section, block, mapItem('Criterion 1'), mapItem('Criterion 6'), statusLine, prLine,
      ...deviations.split('\n').filter((l) => TAGGED_W.test(l)), ...followUps.split('\n').filter((l) => TAGGED_W.test(l)),
    ]
    for (const text of written) {
      for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS]) expect(text).not.toMatch(rule)
      expect(proseOf(text)).not.toMatch(HE)
    }
    for (const text of [section, block]) {
      const dates = (text.match(ANY_DATE) ?? []).length
      expect((text.match(SHORT_DATE) ?? []).length + (text.match(LONG_DATE) ?? []).length, 'every date has its weekday').toBe(dates)
    }
  })
})
