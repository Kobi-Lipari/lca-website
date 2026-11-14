// test/unit/redesign-status-ws09-step2.test.ts
//
// REDESIGN_STATUS.md records WS09 step 2: the two new clubs switches, the
// three server constants, the order they may be turned on in, the
// generator's number option, and the preview's picture bucket left unbound
// by K's decision. Like WS09 step 1's record test, this file reads only the
// WS09 section, from its heading to the WS10 heading. Pinned here: the
// block's place, right after WS09 step 1's and before the four lists; the
// Status line's tail while this step is the latest; the block's parts in
// order and its figures, which must agree with each other and with the
// files they describe; the two sentences this step added to the map; the
// tagged entries of the four lists; and the plain-language rules over the
// block and the files the step adds or changes. It never reads whether a
// switch is on, which test/unit/features.test.ts holds, nor the count of
// switches, which test/unit/redesign-status-ws02-step2.test.ts holds; what
// a later step will change in the tree is read only while this step is the
// latest.
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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'RECORD' + '_CASES'}|${'LINT' + '_FILES'}|${'UNIT' + '_TESTS'}`)
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
const TAG = '(WS09 step 2).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const STEP_1 = '### WS09 step 1: the record and a named public answer'
const STEP = '### WS09 step 2: the switches and the preview bucket'
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

/** The files this step adds, and those of them that are unit tests. */
const NEW_FILES = ['functions/utils/clubs/pages.ts', 'src/areas/clubs/switches.ts', 'test/unit/club-pages-switch.test.ts', 'test/unit/club-switches.test.ts', 'test/unit/club-switches-exhaustive.test.ts', 'test/unit/redesign-status-ws09-step2.test.ts']
const NEW_TESTS = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.ts$/.test(f))
/** The files this step changes that are not tests. */
const CHANGED = ['src/lib/features.ts', 'scripts/db/generate.ts', 'migrations/README.md']
/** The unit tests this step changes, each with its count and the count before. */
const CHANGED_TESTS: ReadonlyArray<readonly [string, number, number]> = [
  ['test/unit/db-generate-guard.test.ts', 31, 25],
  ['test/unit/features.test.ts', 27, 24],
  ['test/unit/redesign-status-ws02-step2.test.ts', 34, 34],
]
/** The cases a file that grew with no change of its own gained. */
const GROWN = 2
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))

/** A file's cases as vitest counts them: each `it(` line, each `it.each(PAIRS)` line once for each of the pairs, and each `it.each(SETTINGS` line once for each of the settings. */
function casesIn(file: string): number {
  const text = read(file)
  const plain = (text.match(/^\s*it\(/gm) ?? []).length
  const each = (text.match(/^\s*it\.each\(PAIRS\)\(/gm) ?? []).length
  const pairs = (between(text, 'const PAIRS = [', '] as const').match(/^\s*\{ feature: /gm) ?? []).length
  const overSettings = (text.match(/^\s*it\.each\(SETTINGS\b/gm) ?? []).length
  const settings = Number(/^const SETTINGS: \w+\[\] = Array\.from\(\{ length: (\d+) \}/m.exec(text)?.[1] ?? 0)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: every each in the file is over PAIRS or SETTINGS`).toBe(each + overSettings)
  return plain + each * pairs + overSettings * settings
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])

describe('REDESIGN_STATUS.md, WS09 step 2: the block and the Status line', () => {
  it('sits once, right after WS09 step 1\'s block and before the four lists', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    const at = [STEP_1, STEP, LISTS[0]].map((h) => ws09.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
    expect(headings[headings.indexOf(STEP_1) + 1]).toBe(STEP)
    // Once WS09 step 3 is written, its block is the one that follows this one.
    expect(headings[headings.indexOf(STEP) + 1]).toBe(latestStep === 2 ? LISTS[0] : '### WS09 step 3: the regions fill')
  })

  it('gives the Status line this step\'s tail while this step is the latest', () => {
    expect(latestStep).toBeGreaterThanOrEqual(2)
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestStep === 2) expect(tail).toBe('steps 1 and 2 are built.')
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying the step changes no page and leaves the bucket by K\'s decision', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of ['the second step of checkpoint S', 'It changes no page', 'all off', 'K\'s decision 1, choice 9 (a)', 'WS09 step 36', 'the step keeps its name']) {
      expect(opening, piece).toContain(piece)
    }
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The pairs.**', '- **The order.**', '- **The number option.**', '- **The preview bucket.**', '- **The map.**',
      '- **The branch.**', '- **What the merge does.**', '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 2: the parts', () => {
  it('names every file it adds and changes, each test with its count, and the two sub-lines', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_TESTS.map(([f]) => f), 'REDESIGN_STATUS.md', 'test/unit/test-setup.test.ts']) expect(files, name).toContain(`\`${name}\``)
    for (const name of NEW_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const [name, after, before] of CHANGED_TESTS) {
      expect(files, name).toContain(after === before ? `\`${name}\` (${after}, as before: ` : `\`${name}\` (${after}, ${before} before: `)
    }
    expect(files).toContain('  - Grown with no change: `test/unit/test-setup.test.ts`, by two cases')
    expect(files).toContain('  - Files beyond the step\'s list: `test/unit/club-switches-exhaustive.test.ts`')
  })

  it('gives the three pairs and how the test holds them', () => {
    const pairs = bullet(block, '- **The pairs.**')
    for (const [feature, constant] of [['newClubs', 'CLUB_PAGES_ON'], ['clubKeepers', 'CLUB_KEEPERS_ON'], ['regionEvents', 'REGION_EVENTS_ON']]) {
      expect(pairs, constant).toContain(`\`${constant}\` follows \`${feature}\``)
    }
    for (const piece of ['` * Set: `', 'The file imports nothing', '`test/unit/creation-switch.test.ts`', 'twelve cases']) expect(pairs, piece).toContain(piece)
  })

  it('names the eight states the order refuses, and its three helpers', () => {
    const order = bullet(block, '- **The order.**')
    for (const piece of [
      '`clubKeepers` on while `clubEmailHidden` is off', '`CLUB_KEEPERS_ON` set while `CLUB_EMAIL_HIDDEN` is not', '`newClubs` on while `clubEmailHidden` is off',
      '`CLUB_PAGES_ON` set while `CLUB_EMAIL_HIDDEN` is not', '`newClubs` on, or `CLUB_PAGES_ON` set, while `newLook` is off', '`regionEvents` on while `clubKeepers` is off',
      '`REGION_EVENTS_ON` set while `CLUB_KEEPERS_ON` is not', 'Each of the eight has its own case', 'K\'s choice 7 (a)', '(criterion 8)',
      '`clubPagesOn` is `newClubs` and `newLook` together', '`keepersOn` is `clubKeepers` alone', '`regionEventsOn` is `regionEvents` and `clubKeepers` together',
    ]) expect(order, piece).toContain(piece)
    const test = read('test/unit/club-pages-switch.test.ts')
    expect((test.match(/^ {2}it\('refuses /gm) ?? []).length).toBe(8)
  })

  it('gives the number option as the README and the generator have it, and makes no migration', () => {
    const option = bullet(block, '- **The number option.**')
    for (const piece of ['--number 0065`', '`--number=0065`', '`0000`', '`0022`', '`0061` today', '`0061` to `0064` are kept for the mail work', '`0065` to `0071` for the clubs work', '`0068`', 'No migration is made in this step.']) {
      expect(option, piece).toContain(piece)
    }
    const readme = read('migrations/README.md').replace(/\s+/g, ' ')
    for (const piece of ['`--number`', '`0061` to `0064` are kept for the mail work', '`0065` to `0071` for the clubs work', 'nobody is handed a number the other stream holds']) {
      expect(readme, piece).toContain(piece)
    }
    expect(read('scripts/db/generate.ts')).toContain('export function numberProblem(')
  })

  it('says the bucket is not bound, and while this step is the latest wrangler.toml still binds the preview to production\'s bucket', () => {
    const bucket = bullet(block, '- **The preview bucket.**')
    for (const piece of ['Not bound', 'K\'s decision 1, choice 9 (a)', '`wrangler.toml`', '`test/unit/wrangler-config.test.ts`', 'are exactly as they were', '`lca-club-logos-preview`', 'owed to WS09 step 36', 'no remote read was made']) {
      expect(bucket, piece).toContain(piece)
    }
    // WS09 step 36 binds the bucket, so the file is read only while this step is the latest.
    if (latestStep === 2) {
      const toml = read('wrangler.toml')
      const preview = toml.slice(toml.indexOf('[[env.preview.r2_buckets]]'))
      expect(preview.split('\n').slice(0, 3)).toEqual(['[[env.preview.r2_buckets]]', 'binding = "CLUB_LOGOS"', 'bucket_name = "lca-club-logos"'])
      expect(toml).not.toContain('lca-club-logos-preview')
    }
  })

  it('names the map\'s two sentences, the branch, the merge and what ships off', () => {
    const mapPart = bullet(block, '- **The map.**')
    for (const piece of ['20 items', 'criterion 14\'s unset state', 'criterion 8\'s order', 'The brief\'s switch rule', 'It proves no item in full.']) expect(mapPart, piece).toContain(piece)
    expect(bullet(block, '- **The branch.**')).toContain('`redesign/ws09-clubs`, with WS09 step 1 at `0fec98b` on `af4a21c`; this step\'s diff is against `0fec98b`.')
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration, no new endpoint and no route.', '`deploy-worker.yml`', 'byte for byte as before', 'applies nothing']) expect(does, piece).toContain(piece)
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Nothing a visitor or a member can see or do, and nothing a keeper meets.')).toBe(true)
    expect(ships).toContain('without `--number` proposes what it proposed before')
  })

  it('imports the new files nowhere outside the tests while this step is the latest, as What ships with every switch off says', () => {
    // Later steps wire the constants and the helpers in, so the files are read only while this step is the latest.
    expect(latestStep).toBeGreaterThanOrEqual(2)
    if (latestStep !== 2) return
    for (const file of ['functions/api/clubs/[id].ts', 'functions/api/clubs.ts', 'workers/daily-emails/index.ts', 'src/areas/clubs/index.ts']) {
      if (existsSync(join(ROOT, file))) expect(read(file), file).not.toContain('clubs/pages')
    }
    expect(read('src/areas/clubs/index.ts')).not.toContain('./switches')
  })

  it('names its pins and the switch count as it stands on this branch', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of ['`test/unit/redesign-status-ws02-step2.test.ts`', '43 on `main` and 45 on this branch', 'passes over `newClubs` in `test/unit/features.test.ts` alone', '`test/unit/db-generate-guard.test.ts`', 'No pin of WS09 step 1\'s record test moves.']) {
      expect(pins, piece).toContain(piece)
    }
  })

  it('gives the lint as unchanged and the build\'s names and sizes against the base\'s', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`features-DxqQlIon.js` 698 bytes', '`index-B-xykFls.js`', '554,147 bytes', '`index-MGRWYyBv.css` 131,136 bytes', 'and 31 more',
      '76.61 KiB, gzip 20.53 KiB', '78,449 bytes', 'on the base and on the finished tree alike',
    ]) expect(build, piece).toContain(piece)
    const chunk = /the switches chunk `(features-[\w-]+\.js)` (\d+) bytes/.exec(build)
    expect(chunk, 'the switches chunk').not.toBeNull()
    expect(Number(chunk![2]) - 698).toBe('clubKeepers:!1,regionEvents:!1,'.length)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 2: the Checks line', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('from 3:38 AM to 4:01 AM UTC')
  })

  it('counts as many cases for each new test as the file holds', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
    expect(writtenCount(files, 'test/unit/club-pages-switch.test.ts')).toBe(23)
  })

  it('gives unit counts that add up: the base\'s, the new files\', the changed files\' and the grown file\'s', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([8874, 339])
    const fresh = NEW_TESTS.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    const moved = CHANGED_TESTS.reduce((a, [, n, was]) => a + n - was, 0)
    expect(num(before) + fresh + moved + GROWN).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
  })

  it('gives the integration counts as the base\'s, since no integration test changes', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    expect(integration!.slice(1)).toEqual(['1,836', '110', '1,836', '110'])
  })

  it('gives the lint files as the base\'s with the new files added, and the build\'s file count once on each side', () => {
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(Number(lint![2])).toBe(962)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_FILES.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 2: the map and the lists', () => {
  it('adds one sentence to criterion 8 and one to criterion 14, each before the planned step, and to no other item', () => {
    for (const id of ['Criterion 8', 'Criterion 14']) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 2: '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 2: '), id).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
    }
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 2:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 8', 'Criterion 14'])
    expect(mapItem('Criterion 14')).toContain('`REGION_EVENTS_ON` in `functions/utils/clubs/pages.ts`, written `false`')
  })

  it('records the step\'s decisions, deviations, verify items and follow-ups, each tagged', () => {
    expect(tagged(decisions).map(head)).toEqual(['Two more switches and their order (WS09 step 2).', 'Each stream makes its migrations with its own numbers (WS09 step 2).'])
    expect(tagged(decisions)[1]).toContain('Tuesday, December 1, 2026')
    expect(deviations).toContain('None in WS09 step 1.')
    expect(tagged(deviations).map(head)).toEqual(['Two more switches than the brief names (WS09 step 2).', 'The preview bucket waits for WS09 step 36 (WS09 step 2).'])
    expect(tagged(verify).map(head)).toEqual([
      '`newClubs` exists (WS09 step 2).', 'Several constants in one file (WS09 step 2).', 'The switch file\'s banned words (WS09 step 2).', 'The bucket test (WS09 step 2).',
      'Whether the bucket exists (WS09 step 2).', 'Today\'s club page prints the club\'s address (WS09 step 2).', 'The generator\'s numbering (WS09 step 2).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^(?:Confirmed on `0fec98b`: |Not checked: )/)
    expect(tagged(followUps).map(head)).toEqual([
      'The switch count beside the mail stream\'s (WS09 step 2).', 'The preview bucket (WS09 step 2).', 'The numbers in the notes on the docs branch (WS09 step 2).',
      'WS02\'s words on the five early switches (WS09 step 2).',
    ])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 2: plain language', () => {
  const written = [block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps), mapItem('Criterion 8'), mapItem('Criterion 14')].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the step wrote', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(written).not.toMatch(rule)
    expect(written).not.toMatch(/\.github\//)
    expect(proseOf(written)).not.toMatch(HE)
    expect(written).not.toMatch(/\(step \d+[;),]/)
  })

  it('gives every date its weekday and every time the twelve-hour clock', () => {
    const prose = proseOf(written)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds or changes', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_TESTS.map(([f]) => f)]) {
      const text = read(file)
      for (const rule of [DASHES, TOOLS, BARE]) expect(text, file).not.toMatch(rule)
      // The switch file's earliest comments name a filter by its old words, so only the lines this step wrote there are read for the initials.
      const own = file === 'src/lib/features.ts' ? between(text, '  // Redesign, clubs.', 'regionEvents: false,') : text
      expect(own, file).not.toBe('')
      expect(own, file).not.toMatch(OLD_INITIALS)
    }
  })
})
