// test/unit/redesign-status-ws16-step6.test.ts
//
// REDESIGN_STATUS.md records WS16 step 6: who sends, the media manager. Like
// the record tests of WS16 steps 1 to 5, this file reads only the WS16
// section, from its heading to the Phase 0 heading, and the date at the
// start of the date line, never every table row or heading of the file, and
// it reads no count or figure from the code. Pinned here: the Status line's
// tail while this step is the latest; the block's place and its parts in
// order, its files with their counts, which must add up, and its figures,
// the worker's against part one's ceiling; the sentences this step added to
// three map items, each ahead of its planned step and behind the earlier
// steps' own sentences, which stay; this step's entries in the four lists,
// each with its tag; the plain-language rules over everything this step
// wrote; and the date, any real day from Wednesday, November 11, 2026 on.
// The new files, and the parts this step wrote in older ones, are read only
// to find them and to hold them to the plain-language rules.
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
/** What a draft would hold before its figures were filled in: the earlier records' marks, and a word of eight capitals or more. */
const UNFILLED = new RegExp(
  `${String.fromCharCode(0x27ea)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|${'<' + '<'}[A-Z_]+${'>' + '>'}|${'to be ' + 'measured'}|${'T' + 'BD'}`,
)
const CAPITALS = /\b[A-Z0-9]{8,}\b/
/** The merge-pending phrase, which the file holds once, in WS01 step 32's line, and this section never. */
const PENDING = new RegExp(`checkpoint D's merge is ${'pen' + 'ding'}|merge into \`main\` is ${'pen' + 'ding'}`)
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
const TAG = '(WS16 step 6).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
/** Text with what sits in backticks taken out, since code is not prose. */
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** A number as the record writes it, with or without its thousands' commas. */
const num = (text: string) => Number(text.replace(/,/g, ''))

const HEADING = '## WS16: Mail (the mail engine, lists and the LCA newsletter)'
/** The WS16 section, from its heading to the Phase 0 heading. */
const ws16 = between(status, `\n${HEADING}\n`, '\n## Phase 0:')
const sectionLines = ws16.split('\n')
/** A part of the section, from its heading, a line of its own, to the next. */
const part = (heading: string) => {
  const at = ws16.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws16.slice(at + 1), heading, '\n### ')
}
const STEP_FIVE = '### WS16 step 5: Group email\'s newsletter tab, the two member pages and the daily run\'s reminders'
const STEP = '### WS16 step 6: who sends, the media manager'
const LISTS = ['### WS16 decisions', '### WS16 deviations from the brief', '### WS16 verify items resolved', '### WS16 follow-ups']
const map = part('### WS16 map: what proves each acceptance criterion and decision')
const block = part(STEP)
const decisions = part(LISTS[0])
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
/** The follow-ups, the section's last part, to its end. */
const followUps = ws16.includes(`\n${LISTS[3]}\n`) ? ws16.slice(ws16.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const statusLine = sectionLines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''
/** What this step added to a map item: from its sentence to the start of the planned step. */
const added = (id: string, start: string) => {
  const item = mapItem(id)
  const at = item.indexOf(start)
  return at < 0 ? '' : item.slice(at, item.search(/ Planned: WS16 step \d+\.$/))
}
/** The date at the start of the date line, the one piece of that line a step writes. */
const date = /^Last updated: (\d{4})-(\d{2})-(\d{2}) \(/.exec(status.split('\n').find((l) => l.startsWith('Last updated:')) ?? '')
/** The highest step of WS16 with a block of its own: this step's tail of the Status line holds only while it is the latest. */
const latestStep = Math.max(0, ...[...ws16.matchAll(/^### WS16 step (\d+): /gm)].map((m) => Number(m[1])))

const STATUS_PREFIX =
  '**Status:** in progress: part one, the mail engine and the first LCA newsletter, twelve steps in three checkpoints (checkpoint M for steps 1 to 8, checkpoint N for steps 9 to 11, checkpoint O for step 12); '
const TAIL = 'steps 1 to 6 are built.'

/** The sentences this step adds to the map for the items it proves, each planned for this step. */
const PROVED: ReadonlyArray<readonly [string, string]> = [
  ['AC11', 'Proved in WS16 step 6 by `test/integration/media-manager.test.ts` and `test/integration/newsletter.test.ts`: '],
  ['D39', 'Proved in WS16 step 6 by `test/unit/admin-media-manager.test.tsx` and `test/integration/media-manager.test.ts`: '],
  ['Q43', 'Proved in WS16 step 6 by `test/integration/media-manager.test.ts` and `test/integration/contracts/me-media-manager.test.ts`: '],
]
/** The earlier steps' sentences on the items this step adds to, which stay word for word, ahead of this step's. */
const EARLIER: ReadonlyArray<readonly [string, string]> = [
  ['AC11', 'Built in WS16 step 4: `requireListMailer` in `functions/utils/auth.ts`, the guard of the newsletter\'s four methods'],
  ['AC11', 'Built in WS16 step 5: the newsletter tab in today\'s Group email, drawn only with `mailLists` on'],
]

/** The files this step adds. */
const NEW_FILES = [
  'functions/utils/admin/mediaManager.ts', 'functions/api/me/media-manager.ts', 'src/areas/admin/useMediaManager.ts', 'src/areas/admin/mediaManagerAnswer.ts',
  'test/unit/fixtures/admin-page-today.tsx', 'test/integration/media-manager.test.ts', 'test/integration/contracts/me-media-manager.test.ts',
  'test/unit/admin-media-manager.test.tsx', 'test/integration/media-manager-reach.test.ts', 'test/integration/media-manager-seat.test.ts',
  'test/unit/use-media-manager.test.tsx', 'test/unit/redesign-status-ws16-step6.test.ts',
]
const NEW_UNIT = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The new files that are code or tests, which lint reads. */
const NEW_LINTED = NEW_FILES.filter((f) => /\.tsx?$/.test(f))
/** The files of code, fixture and record this step changes. */
const CHANGED = [
  'functions/utils/auth.ts', 'functions/api/admin/mail/newsletter.ts', 'domain/contracts/me.ts', 'domain/contracts/registry.ts', 'src/areas/admin/api.ts',
  'src/components/auth/RoleProtectedRoute.tsx', 'src/App.tsx', 'src/components/layout/Navbar.tsx', 'src/pages/AdminPage.tsx', 'src/pages/AdminEmailPage.tsx',
  'src/lib/features.ts', 'test/integration/factories.ts', 'test/unit/fixtures/api-added-since-split.json', 'REDESIGN_STATUS.md',
]
/** The test files this step changes, each with its count written in the block. */
const CHANGED_UNIT = ['test/unit/api-split-modules.test.ts', 'test/unit/routes.test.ts', 'test/unit/goldText.test.ts']
/** The unit test file whose count grows with no change of its own. */
const GROWN = ['test/unit/route-audit.test.ts']

/** The heads of this step's entries in the four lists, in their order. */
const HEADS = {
  decisions: ['The first version, and who sends it (WS16 step 6).', 'The media manager is a board seat\'s holder (WS16 step 6).'],
  deviations: ['The media manager reaches only WS16\'s own endpoints (WS16 step 6).'],
  verify: [
    'A seat as a grant has precedents (WS16 step 6).',
    'How roles are held (WS16 step 6).',
    'How a seat is added and assigned today (WS16 step 6).',
    'The second factor (WS16 step 6).',
    'Where a seat holder finds their page today (WS16 step 6).',
    'What today\'s campaign endpoints read (WS16 step 6).',
    'The navigation tests that pin a seat holder\'s links (WS16 step 6).',
    'The browser specs that sign in as a seat holder (WS16 step 6).',
    'The files read as the base has them (WS16 step 6).',
  ],
  followUps: [
    'The media manager\'s seat and role on switch-on day (WS16 step 6).',
    'The media manager\'s link under the new chrome (WS16 step 6).',
    'A media manager\'s test through Amazon SES (WS16 step 6).',
  ],
}

/** The words a person reads that this step draws or answers, as the step's list gives them. */
const WORDS = {
  listMailersOnly: '"Group email is limited to LCA admins, the president and the media manager."',
  secondFactor: '"Two-factor sign-in is required to send group email. Set it up in your account security settings."',
  line: '"Set up two-factor sign-in to send group email."',
  subtitle: '"Send the LCA newsletter."',
}

describe('REDESIGN_STATUS.md, WS16 step 6: the Status line', () => {
  it('keeps the fixed prefix and gives this step\'s tail while this step is the latest', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(6)
    if (latestStep === 6) expect(tail).toBe(TAIL)
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 6: the block', () => {
  it('sits right after WS16 step 5\'s block and before the four lists, once', () => {
    expect(ws16.split(`\n${STEP}\n`)).toHaveLength(2)
    const at = [STEP_FIVE, STEP, LISTS[0]].map((h) => ws16.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    // Nothing between the two blocks but step 5's own, and nothing between this block and the decisions but itself and what a
    // later step adds there: its own block, "### WS16 step 7: ..." and on, or a checkpoint's section.
    const later = (l: string) => /^### WS16 step (?:[7-9]|1[0-2]): \S/.test(l) || /^### Checkpoint [MNO]: WS16 (?:steps \d+ to \d+|step \d+)$/.test(l)
    expect(ws16.slice(at[0], at[1]).split('\n').filter((l) => l.startsWith('### '))).toEqual([STEP_FIVE])
    expect(ws16.slice(at[1], at[2]).split('\n').filter((l) => l.startsWith('### ') && !later(l))).toEqual([STEP])
    expect(later('### WS16 step 7: a later block')).toBe(true)
    expect(later('### Checkpoint M: WS16 steps 1 to 8')).toBe(true)
    expect(later('### Step 7: a stray heading')).toBe(false)
    expect(later('### WS16 step 5: an earlier block')).toBe(false)
  })

  it('has every part, in order, each a bullet of its own, and says what a visitor or a member meets', () => {
    const parts = [
      '- **Files.**', '- **The grant.**', '- **Who may do what.**', '- **The pages.**', '- **What ships with every switch off.**', '- **Pins moved.**',
      '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- **Worker.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(block.split('\n').filter((l) => l.startsWith('- Checks:'))).toHaveLength(1)
    expect(block).toContain('what a visitor or a member meets, by switch, is nothing new')
  })

  it('names every file it adds and changes, each test with its count, and the files beyond the step\'s list', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT, ...GROWN]) expect(files, name).toContain(`\`${name}\``)
    for (const name of [...NEW_UNIT, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of CHANGED_UNIT) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before)[:)]`))
    for (const name of GROWN) expect(bullet(files, '  - Grown with no change:'), name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, \\d+ before: `))
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const name of [
      'src/areas/admin/mediaManagerAnswer.ts', 'test/unit/fixtures/admin-page-today.tsx', 'functions/api/admin/mail/newsletter.ts', 'test/integration/factories.ts',
      'test/unit/routes.test.ts', 'test/unit/goldText.test.ts', 'test/unit/api-split-modules.test.ts',
    ]) {
      expect(beyond, name).toContain(`\`${name}\``)
    }
    expect(beyond).toContain('`test/a11y/baseline.json`')
  })

  it('gives the grant: the seat by its link name, read in one statement at each request, what ends it, the rule, the officer, the second factor, no migration, the endpoint and the contract figures as text', () => {
    const grant = bullet(block, '- **The grant.**')
    for (const piece of [
      '`media-manager`', '`slugifyRole`', '`holdsMediaManagerSeat`', '`functions/utils/admin/mediaManager.ts`', 'one statement that names its column', '`SELECT 1 AS held`',
      'letter case and spaces included', '`MEDIA_MANAGER_SEAT`', '`media-manager-2`, which grants nothing', 'read at each request and never remembered',
      'the term ends or the seat is marked inactive', '`requireSeatAccess`', '`holdsPresidentSeat`', '`functions/utils/events/creation.ts`', '`sendsAsMediaManager`',
      'a member, a club rep, a director or an auditor', 'an officer, whom Admin lets in to read only, is refused whatever seat they hold', '`hasSecondFactor`',
      'exactly \'aal2\'', '`members.role`', 'No migration and no seed row', 'switch-on day', '`{ mediaManager, secondFactor }`', 'about the person signed in alone',
      '`Cache-Control: no-store`', 'It is never the grant', '`mediaManagerResponseSchema`',
      '26 of the 136 methods under `functions/api` contracted, 25 of 135 before', '`PENDING_COUNT` 110, unchanged',
    ]) expect(grant, piece).toContain(piece)
  })

  it('gives who may do what: the media manager\'s read, test, stop and guarded send, the two refusals in their words, the answers with the constant unset, and what stays refused', () => {
    const who = bullet(block, '- **Who may do what.**')
    for (const piece of [
      'verifies the session once', 'send a test', 'stop a newsletter that is sending', 'the activity row naming them as who stopped it', 'answers 409 while Resend sends',
      '`{ error, mfaRequired: true }`', WORDS.secondFactor, WORDS.listMailersOnly, 'a former holder', 'an inactive seat', 'a seat named almost the same',
      'byte for byte, and no seat is read', '403 \'Forbidden\'', 'all five of today\'s campaign methods', '`/api/admin/campaigns/preview`', '`requireMailer`, is unchanged',
      'no typed-in address, hand-picked member or member\'s address from a preview', 'the members list, a member\'s record, its export, a role change',
      'logging in as a member', 'support', 'the activity log', 'News posts and the announcement banner', 'the board seats', 'tournaments',
      'a director\'s announce for an event they do not manage', 'their club\'s page, its events and the members list', 'their own event\'s entrants', 'WS16 step 7',
    ]) expect(who, piece).toContain(piece)
  })

  it('gives the pages: the route and its loading line, Admin with Group email alone, the newsletter\'s tab alone with no Send history column, the second factor\'s line and its link, the account menu\'s link, and the question asked once a session', () => {
    const pages = bullet(block, '- **The pages.**')
    for (const piece of [
      '`allowMediaManager`', '`RoleProtectedRoute`', '"Loading..."', 'nothing of Admin is drawn and nobody is sent away', 'only once it has come', '`MediaManagerAnswerContext`',
      'Communications, with Group email alone', 'goes to `/admin/email` before a section is drawn', 'its banner has no subtitle', '"The LCA newsletter list"',
      'no Specific people, no Groups of members and no way to add people or type addresses', WORDS.subtitle, 'Help and Who gets it as WS16 step 5 drew them',
      'no Send history column', '"Stop sending"', 'each with its status in words', 'under the tab, below the compose card', 'no Amazon SES box',
      'no call but GET `/api/admin/mail/newsletter`', 'nothing of today\'s history, the members list or the clubs', WORDS.line, '`/account/security`',
      'visible focus ring', '`useAccountLinks`', '"Group email"', 'right after "Board inbox"', 'once a session', 'a refreshed token asks nothing more',
      '`/admin/clubs/:id`', '`/admin/tournaments/:id`',
    ]) expect(pages, piece).toContain(piece)
  })

  it('says nothing a visitor or a member meets ships with every switch off, and what each new piece does then', () => {
    const off = bullet(block, '- **What ships with every switch off.**')
    expect(off.startsWith('- **What ships with every switch off.** Nothing a visitor or a member meets.')).toBe(true)
    for (const piece of [
      'as WS16 step 4 did, byte for byte', 'reads no seat', 'answers false for everyone', 'no page asks it anything', '`allowMediaManager` changes nothing',
      'the account menu holds no new link', '`test/unit/fixtures/admin-email-today.tsx`', '`4b9d780`', 'which this step does not change',
      '`test/unit/fixtures/admin-page-today.tsx`, the copy of the page at `5e7a23c`', 'for everyone Admin lets in by role and for a member\'s role who holds the seat',
      '`test/unit/header-today.test.tsx`', '`7568680`', '`test/a11y/baseline.json` is unchanged', '`test/a11y/signed-in.spec.ts`', '`test/a11y/signed-in-edges.spec.ts`', 'This step adds no migration',
      '`deploy-worker.yml`', 'byte for byte as before',
    ]) expect(off, piece).toContain(piece)
  })

  it('lists the pins it moved, each with its figures and its reason, and the suites it leaves as they were', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      '`test/unit/fixtures/api-added-since-split.json`', '`/api/me/media-manager`', '`ApiMediaManager`', '`getMediaManager`', '88 to 89',
      '`test/unit/api-split-modules.test.ts`', 'line 335', 'seven to eight', '`test/unit/routes.test.ts`', '96 to 97', '`test/unit/goldText.test.ts`',
      '`src/pages/AdminEmailPage.tsx:622`', '`:668`', '25 to 26', '135 to 136', '`contracts[\'me/media-manager\'].GET`',
      'No test held `requireListMailer`\'s 403 words with the constant set', '`test/integration/newsletter.test.ts`', '`test/integration/newsletter-edges.test.ts`',
      '`test/integration/contracts/newsletter.test.ts`', 'no closed record test changes',
    ]) expect(pins, piece).toContain(piece)
  })

  it('makes its judgement calls, at least ten, the officer\'s, the endpoint\'s rule, the claim, the question\'s keys and the context\'s with the build it measured among them', () => {
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
    for (const piece of [
      'An officer is refused whatever seat they hold', 'answers by `sendsAsMediaManager`', 'the claim exactly \'aal2\'', 'The harness checks no signature',
      'the sign-in session\'s id in the token and its assurance level', '`src/areas/admin/mediaManagerAnswer.ts`', '203,977 bytes', 'Wednesday, November 11, 2026',
      'no Send history column', 'no subtitle', '`StillLoading`', 'held to its copy drawn alone', 'plainly made up',
    ]) expect(calls, piece).toContain(piece)
  })

  it('gives the lint as unchanged, the build against the base with each file that changed in size, and each check once', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      '`5e7a23c`', 'a local production build', '`index-CEqI9sAS.js` at 552,245 bytes', '`index-B39ST1_o.css` at 130,557 bytes', '`features-DxqQlIon.js` at 698 bytes',
      '194 files, as on the base, none of them new', '`AdminPage` (99,695 to', 'a local build\'s figures',
    ]) {
      expect(build, piece).toContain(piece)
    }
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('one run with nothing else running beside it')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` before and after')
  })

  it('gives the worker\'s dry run on the base and after, measured on their day, the same, with what is left under part one\'s ceiling of 96 KiB, gzip 28 KiB', () => {
    const worker = bullet(block, '- **Worker.**')
    for (const piece of [
      '`npx wrangler deploy --dry-run`', '`--config workers/daily-emails/wrangler.toml`', '`5e7a23c`', 'Wednesday, November 11, 2026', 'The bundle holds no package.',
      '96 KiB, gzip 28 KiB', 'no minify setting', '`functions/utils/auth.ts`', 'the upload does not move',
    ]) {
      expect(worker, piece).toContain(piece)
    }
    const sizes = [...worker.matchAll(/([\d.]+) KiB, gzip ([\d.]+) KiB/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(sizes.length).toBeGreaterThanOrEqual(2)
    const [base, after] = sizes
    expect(base).toEqual([64.94, 17.48])
    expect(after).toEqual(base)
    const left = /leaves ([\d.]+) KiB, gzip ([\d.]+) KiB/.exec(worker)
    expect(left, 'what the ceiling leaves').not.toBeNull()
    expect(Number(left![1])).toBeCloseTo(96 - after[0], 2)
    expect(Number(left![2])).toBeCloseTo(28 - after[1], 2)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 6: the figures add up', () => {
  const files = bullet(block, '- **Files.**')
  const countOf = (name: string) => {
    const m = new RegExp(`\`${escape(name)}\` \\((\\d+)(?:, (\\d+) before|, as before)?[:)]`).exec(files)
    return m ? { now: Number(m[1]), before: Number(m[2] ?? m[1]) } : null
  }

  it('gives unit counts that add up: the base\'s, the new files\' tests, the changed files\' gains and the grown file\'s growth', () => {
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([8424, 325])
    const counts = [...NEW_UNIT, ...CHANGED_UNIT, ...GROWN].map((name) => [name, countOf(name)] as const)
    for (const [name, count] of counts) expect(count, name).not.toBeNull()
    const gain = counts.reduce((sum, [name, count]) => sum + (NEW_UNIT.includes(name) ? count!.now : count!.now - count!.before), 0)
    expect(num(before) + gain).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts that add up: the base\'s and the new files\'', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1572, 95])
    for (const name of NEW_INTEGRATION) expect(countOf(name), name).not.toBeNull()
    const fresh = NEW_INTEGRATION.reduce((sum, name) => sum + countOf(name)!.now, 0)
    expect(num(before) + fresh).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the browser run as one run whose counts add up, and the lint figures as the base\'s with the new files added', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, one run/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect(num(run![2]) + num(run![3])).toBe(num(run![1]))
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![2])).toBe(918)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_LINTED.length)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 6: the map', () => {
  it('adds a sentence of what this step proves to the three items planned for it, once each, ahead of the planned step, and to no other item', () => {
    for (const [id, sentence] of PROVED) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.endsWith('Planned: WS16 step 6.'), id).toBe(true)
      expect(item.indexOf(sentence), id).toBeLessThan(item.indexOf('Planned: WS16 step 6.'))
    }
    expect(entries(map).filter((l) => l.includes('Proved in WS16 step 6 by')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(PROVED.map(([id]) => id))
    expect(entries(map).filter((l) => l.includes('Built in WS16 step 6:'))).toEqual([])
  })

  it('says in each sentence what the tests hold: AC11\'s who may and may not send, D39\'s pages, Q43\'s seat and its open half', () => {
    for (const piece of [
      '`media-manager`', 'with a second factor', 'an officer with or without the seat', 'a token whose second-factor claim is missing or is not exactly aal2',
      'a holder whose term ended a moment before', 'the holder of a seat marked inactive', 'seats named almost the same', 'all five of today\'s campaign methods',
      'every other part of Admin', 'writing nothing and sending nothing', 'keeps their own role\'s rights', 'byte for byte', 'no seat is read',
    ]) expect(added('AC11', PROVED[0][1]), piece).toContain(piece)
    for (const piece of ['Group email alone', 'the newsletter\'s tab alone', 'no Send history column', 'account menu', WORDS.line, '`/account/security`', 'WS16 step 10']) {
      expect(added('D39', PROVED[1][1]), piece).toContain(piece)
    }
    for (const piece of ['read at each request', '`media-manager` exactly', 'marked inactive', '`members.role`', 'Specific people is not the media manager\'s', 'which K may still change']) {
      expect(added('Q43', PROVED[2][1]), piece).toContain(piece)
    }
  })

  it('keeps the earlier steps\' sentences on AC11 word for word, ahead of this step\'s', () => {
    for (const [id, sentence] of EARLIER) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.indexOf(sentence), id).toBeLessThan(item.indexOf('Proved in WS16 step 6 by'))
    }
  })
})

describe('REDESIGN_STATUS.md, WS16 step 6: the lists', () => {
  it('records this step\'s entries in each list, in their order, each once and tagged', () => {
    expect(tagged(decisions).map(head)).toEqual(HEADS.decisions)
    expect(tagged(deviations).map(head)).toEqual(HEADS.deviations)
    expect(tagged(verify).map(head)).toEqual(HEADS.verify)
    expect(tagged(followUps).map(head)).toEqual(HEADS.followUps)
    for (const list of [decisions, deviations, verify, followUps]) {
      for (const entry of tagged(list)) expect(entry, head(entry)).toMatch(/^- \*\*[^*]+ \(WS16 step 6\)\.\*\* \S/)
    }
  })

  it('puts its entries after the earlier steps\' in each list, and closes no earlier entry', () => {
    const last = {
      decisions: 'Build once (WS16 step 5).',
      deviations: 'Explaining words sit behind Help (WS16 step 5).',
      verify: 'The files read as the base has them (WS16 step 5).',
      followUps: 'The test through Amazon SES, read from WS16 step 7 (WS16 step 5).',
    }
    for (const [name, list] of [['decisions', decisions], ['deviations', deviations], ['verify', verify], ['followUps', followUps]] as const) {
      const heads = entries(list).map(head)
      expect(heads.indexOf(HEADS[name][0]), name).toBeGreaterThan(heads.indexOf(last[name]))
      expect(heads.indexOf(last[name]), name).toBeGreaterThan(-1)
    }
    expect(entries(ws16).filter((l) => l.includes(' Done in WS16 step 6:'))).toEqual([])
  })

  it('records D39 with K\'s date and decisions 14 and 17, who sends, what waits for WS16 steps 10 and 11, and what it turned down', () => {
    const [firstVersion] = tagged(decisions)
    for (const piece of [
      'D39, settled by K on Tuesday, November 10, 2026', 'the week of Monday, November 16, 2026', 'decisions 14 and 17', 'the LCA admins with a second factor, the president and the media manager with a second factor',
      'Group email alone', 'WS16 step 10', 'WS16 step 11', 'Turned down:',
    ]) expect(firstVersion, piece).toContain(piece)
  })

  it('records the seat with the comparison, K\'s answer to question 4, the officer, and Q43\'s open half as K\'s to change with what would change', () => {
    const [, seat] = tagged(decisions)
    for (const piece of [
      'settled by K on Tuesday, November 10, 2026 (decision 28, question 4)', '`members_role_insert`', '`members_role_update`', 'migration 0057, lines 24 to 38',
      '0046 rebuilt `members` without a CHECK on role', '`MemberRole`', 'a club rep or a director could not also be the media manager', 'needs no migration and no role list',
      '`started_at`', '`ended_at`', '`appointed_by`', 'shows on the public Board page with its holder', 'which K accepted', 'one indexed row', 'an officer is refused',
      'Q43\'s second half is still K\'s', 'It is K\'s to change', 'masked', '`requireMailer`', 'Turned down:',
    ]) expect(seat, piece).toContain(piece)
  })

  it('records the deviation: WS16\'s own endpoints alone, today\'s five keeping their guard, files and place on the pending list', () => {
    const [reach] = tagged(deviations)
    for (const piece of ['`requireListMailer`', '`requireMailer`', 'their place on the pending list', 'WS08\'s admin home part', 'lines 13 to 31 and 62 to 101', '`PENDING_COUNT`', 'WS16 step 11']) {
      expect(reach, piece).toContain(piece)
    }
  })

  it('resolves the verify items, each confirmed in the code, with the base\'s lines', () => {
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed\b/)
    const byHead = (h: string) => tagged(verify).find((e) => head(e) === h) ?? ''
    expect(byHead(HEADS.verify[0])).toContain('`holdsPresidentSeat`')
    expect(byHead(HEADS.verify[2])).toContain('"Add a board seat"')
    expect(byHead(HEADS.verify[2])).toContain('`MEDIA_MANAGER_SEAT`')
    expect(byHead(HEADS.verify[4])).toContain('line 297')
    expect(byHead(HEADS.verify[8])).toContain('`git diff 16c188a 5e7a23c`')
  })

  it('hands on the seat and the role for switch-on day, the new chrome\'s menu and the test through Amazon SES', () => {
    const [seat, chrome, ses] = HEADS.followUps.map((h) => entries(followUps).find((l) => head(l) === h) ?? '')
    for (const piece of ['WS16 step 8', 'exactly "Media manager"', '`media-manager`', '`media-manager-2`', '`/account/security`', 'an officer is refused']) expect(seat, piece).toContain(piece)
    for (const piece of ['`newNav`', '`newLook`', '`src/lib/nav.ts`', 'WS16 step 10', 'WS13']) expect(chrome, piece).toContain(piece)
    for (const piece of ['`service: \'ses\'`', 'WS16 step 7', 'refuses it to the media manager']) expect(ses, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 6: plain language', () => {
  /** Everything this step wrote in the section: its block, its entries, its map sentences and the Status line's tail. */
  const written = [
    block, ...[decisions, deviations, verify, followUps].flatMap(tagged), ...PROVED.map(([id, s]) => added(id, s)),
    statusLine.slice(STATUS_PREFIX.length), date?.[0] ?? '',
  ]

  it('reads every piece it means to', () => {
    for (const text of written) expect(text).not.toBe('')
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials, unfilled marks and the merge-pending phrase out of what the step wrote', () => {
    for (const text of written) {
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(TOOLS)
      expect(text).not.toMatch(BARE)
      expect(text).not.toMatch(OLD_INITIALS)
      expect(text).not.toMatch(UNFILLED)
      expect(proseOf(text)).not.toMatch(CAPITALS)
      expect(text).not.toMatch(PENDING)
      expect(text).not.toContain('is pending')
      expect(text).not.toMatch(/\.github\//)
      expect(proseOf(text)).not.toMatch(HE)
      expect(text).not.toMatch(/\(step \d+[;),]/)
    }
    expect(ws16.split('\n').filter((l) => l.startsWith('|'))).toEqual([])
  })

  it('gives every date the weekday it falls on, and writes every time on the twelve-hour clock', () => {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const months = MONTHS.join('|')
    const short = MONTHS.map((m) => m.slice(0, 3)).join('|')
    for (const text of written.map(proseOf)) {
      for (const found of text.matchAll(new RegExp(`\\b(?:${months}|${short}) \\d{1,2}\\b`, 'g'))) {
        expect(text.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
      }
      for (const [whole, weekday, month, day, year] of text.matchAll(new RegExp(`\\b(${WEEKDAYS.join('|')}), (${months}) (\\d{1,2})\\b(?:, (\\d{4}))?`, 'g'))) {
        expect(WEEKDAYS[new Date(Date.UTC(Number(year ?? 2026), MONTHS.indexOf(month), Number(day))).getUTCDay()], whole).toBe(weekday)
      }
      for (const time of text.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
    }
  })

  it('names steps as "WS16 step N" and checkpoints in full, and K as K or they', () => {
    for (const text of written) {
      const bare = proseOf(text).replace(/\b[Cc]heckpoints [J-O](?:, [J-O])* and [J-O]\b|\b[Cc]heckpoint [J-O]\b/g, 'checkpoint')
      expect([...bare.matchAll(/(?<![\w-])[JLMNO](?![\w-])/g)].map((m) => m[0]), text.slice(0, 60)).toEqual([])
    }
  })
})

describe('REDESIGN_STATUS.md, WS16 step 6: the date and the new files', () => {
  it('dates the record on a real day, on or after Wednesday, November 11, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-11').toBe(true)
  })

  it('lists as new only files that exist, the new code and tests free of a dash, a tool\'s name, the two letters on their own and the old initials', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT, ...GROWN]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_LINTED) {
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
  })

  it('keeps the same out of the changed files that held none before, whole, and out of the parts this step wrote in the four that did', () => {
    const older = ['functions/utils/auth.ts', 'src/areas/admin/api.ts', 'src/pages/AdminEmailPage.tsx', 'src/lib/features.ts']
    const page = read(older[2])
    const texts: Array<readonly [string, string]> = [
      ...[...CHANGED.filter((f) => /\.tsx?$/.test(f) && !older.includes(f)), ...CHANGED_UNIT].map((file) => [file, read(file)] as const),
      ['auth.ts, the list mailers', between(read(older[0]), ' * The people who may send the LCA newsletter', ' * Adding, editing and removing governance documents')],
      ['auth.ts, the second factor', between(read(older[0]), 'Whether the session carries a second factor', '// ')],
      ['admin/api.ts, the media manager\'s call', between(read(older[1]), '// The media manager (WS16 step 6)', 'export type AnnouncementTone')],
      ['AdminEmailPage.tsx, the words', between(page, 'The media manager\'s one tab (WS16 step 6)', '/** K\'s guardrails')],
      ['AdminEmailPage.tsx, the page\'s props', between(page, '`mediaManager`, which', 'const [clubs, setClubs]')],
      ['AdminEmailPage.tsx, the calls', between(page, 'The media manager\'s page asks for none of Group email\'s own lists', '// Final send list')],
      ['AdminEmailPage.tsx, the recent sends', between(page, 'The newsletter\'s own recent sends, with the status region and the stop', '  return (')],
      ['AdminEmailPage.tsx, the line', between(page, 'The media manager signed in without a second factor', ') : mode === \'newsletter\' ? (')],
      ['AdminEmailPage.tsx, under the tab', between(page, 'The media manager\'s page has no history column', '/* ── History')],
      ['features.ts, the comment on mailLists', between(read(older[3]), 'The LCA newsletter list in Group email, with the unsubscribe link', 'mailLists: false')],
    ]
    for (const [name, text] of texts) {
      expect(text.length, name).toBeGreaterThan(60)
      expect(text, name).not.toMatch(DASHES)
      expect(text, name).not.toMatch(TOOLS)
      expect(text, name).not.toMatch(BARE)
      expect(text, name).not.toMatch(OLD_INITIALS)
    }
  })
})
