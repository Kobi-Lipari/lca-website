// test/unit/redesign-status-ws16-step3.test.ts
//
// REDESIGN_STATUS.md records WS16 step 3: the links, the footer and the
// link endpoints. Like the record tests of WS16 steps 1 and 2, this file
// reads only the WS16 section, from its heading to the Phase 0 heading, and
// the date at the start of the date line, never every table row or heading
// of the file, and it reads no count or figure from the code. Pinned here:
// the Status line's tail while this step is the latest; the block's place
// and its parts in order, its files with their counts, which must add up,
// and its figures, the worker's against part one's ceiling; the sentences
// this step added to eight map items, each ahead of its planned step, and
// the close it added to one follow-up of WS16 step 2, whose earlier words
// stay; this step's entries in the four lists, each with its tag, D34's and
// D41's among them; the plain-language rules over everything this step
// wrote; and the date, any real day from Wednesday, November 11, 2026 on.
// The new files are read only to find them and to hold them to the
// plain-language rules.
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
const TAG = '(WS16 step 3).'
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
const STEP_TWO = '### WS16 step 2: migration 0060 and the do-not-send gate'
const STEP = '### WS16 step 3: the links, the footer and the link endpoints'
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
const TAIL = 'steps 1 to 3 are built.'

/** The sentences this step adds to the map, each with its item, ahead of the item's planned step, WS16 step 3 for all four. */
const PROVED: ReadonlyArray<readonly [string, string]> = [
  ['AC6', 'Proved in WS16 step 3 by `test/integration/mail-email-choices.test.ts`: '],
  ['AC7', 'Proved in WS16 step 3 by `test/unit/mail-links.test.ts` and `test/integration/mail-email-choices.test.ts`: '],
  ['D34', 'Proved in WS16 step 3 by `test/integration/mail-email-choices.test.ts` and `test/unit/mail-footer.test.ts`: '],
  ['D41', 'Proved in WS16 step 3 by `test/unit/mail-footer.test.ts`: '],
]
/** The items later steps prove that this step builds a part of, with the step planned to prove each. */
const BUILT: ReadonlyArray<readonly [string, number]> = [['AC8', 7], ['AC9', 5], ['AC13', 8], ['Q41', 4]]

/** The files this step adds. */
const NEW_FILES = [
  'functions/utils/mail/links.ts', 'domain/mail/footer.ts', 'functions/utils/mail/footer.ts', 'functions/utils/mail/lists.ts',
  'functions/utils/mail/linkAnswers.ts', 'functions/api/mail/unsubscribe/[token].ts', 'functions/api/mail/preferences/[token].ts', 'domain/contracts/mail.ts',
  'test/unit/mail-links.test.ts', 'test/unit/mail-footer.test.ts', 'test/integration/mail-email-choices.test.ts',
  'test/integration/contracts/mail-links.test.ts', 'test/integration/mail-email-choices-edges.test.ts', 'test/unit/mail-link-files-closure.test.ts',
  'test/unit/mail-contract-schemas.test.ts', 'test/unit/mail-step3-words.test.ts', 'test/unit/redesign-status-ws16-step3.test.ts',
]
const NEW_UNIT = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.ts$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The new files that are code or tests, which lint reads. */
const NEW_LINTED = NEW_FILES.filter((f) => /\.ts$/.test(f))
/** The files of code, configuration and record this step changes. */
const CHANGED = [
  'functions/utils/emailLayout.ts', 'functions/utils/mail/send.ts', 'functions/utils/mail/resend.ts', 'functions/utils/mail/rules.ts',
  'functions/utils/mail/outcome.ts', 'functions/utils/mail/gate.ts', 'domain/mail/address.ts', 'domain/contracts/index.ts', 'domain/contracts/registry.ts',
  'functions/types.ts', 'vitest.integration.config.ts', 'test/a11y/global-setup.ts', 'test/integration/harness.ts', 'test/integration/factories.ts',
  'test/integration/mailRuns.ts', 'REDESIGN_STATUS.md',
]
/** The test files this step changes, each with its count written in the block, unit and integration apart. */
const CHANGED_UNIT = ['test/unit/mail-rules-outcome.test.ts', 'test/unit/routes.test.ts', 'test/unit/redesign-status-ws16-step2.test.ts']
const CHANGED_INTEGRATION = ['test/integration/mail-gate.test.ts', 'test/integration/mail-gate-edges.test.ts']
/** The unit test file whose count grows with no change of its own. */
const GROWN = ['test/unit/domain-boundaries.test.ts']

/** The heads of this step's entries in the four lists, in their order. */
const HEADS = {
  decisions: ['Opt-outs per list, in our own database (WS16 step 3).', 'No postal address in any email (WS16 step 3).'],
  deviations: ['The unsubscribe links are WS16\'s own (WS16 step 3).', 'Links keep working once a list email has gone (WS16 step 3).'],
  verify: [
    'No signing code to reuse (WS16 step 3).',
    'The footer today (WS16 step 3).',
    'A GET of the header\'s address (WS16 step 3).',
    'Resend takes the two headers (WS16 step 3).',
    'Every setting the functions read is bound in the browser tests (WS16 step 3).',
    'A public form POST and the route audit (WS16 step 3).',
    'The files read as the WS08 branch left them (WS16 step 3).',
    'Cloudflare\'s limit on a Worker\'s size (WS16 step 3).',
  ],
  followUps: [
    'A signed link through Pages\' own routing (WS16 step 3).',
    'The seam\'s two new answers in Group email\'s sender and in sendEmail (WS16 step 3).',
    'A list turned back on keeps its place on the preferences page (WS16 step 3).',
  ],
}

/** The follow-up of WS16 step 2 that this step closes, how its words began, and the sentence it closes with. */
const CLOSED = 'The worker\'s bundle against the plan\'s ceiling (WS16 step 2).'
const CLOSED_START = `- **${CLOSED}** After this step the daily-emails worker's dry-run upload is 45.36 KiB, gzip 12.69 KiB, against the plan's ceiling for part one of 48 KiB, gzip 14 KiB,`
const CLOSE = ' Done in WS16 step 3: '

describe('REDESIGN_STATUS.md, WS16 step 3: the Status line', () => {
  it('keeps the fixed prefix and gives this step\'s tail while this step is the latest', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(3)
    if (latestStep === 3) expect(tail).toBe(TAIL)
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 3: the block', () => {
  it('sits right after WS16 step 2\'s block and before the four lists, once', () => {
    expect(ws16.split(`\n${STEP}\n`)).toHaveLength(2)
    const at = [STEP_TWO, STEP, LISTS[0]].map((h) => ws16.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    // Nothing between the two blocks but step 2's own, and nothing between this block and the decisions but itself and what a
    // later step adds there: its own block, "### WS16 step N: ...", or a checkpoint's section.
    // The page half of WS16 part two adds its part of the record there too, under its one heading (its page step 3).
    const later = (l: string) =>
      /^### WS16 step (?:[4-9]|1[0-2]): \S/.test(l) || /^### Checkpoint [MNO]: WS16 (?:steps \d+ to \d+|step \d+)$/.test(l) || l === '### WS16 part two: the newsletter\'s own page'
    expect(ws16.slice(at[0], at[1]).split('\n').filter((l) => l.startsWith('### '))).toEqual([STEP_TWO])
    expect(ws16.slice(at[1], at[2]).split('\n').filter((l) => l.startsWith('### ') && !later(l))).toEqual([STEP])
    // The test of that rule: a later step's block passes it, and a stray heading does not.
    expect(later('### WS16 step 4: a later block')).toBe(true)
    expect(later('### Checkpoint M: WS16 steps 1 to 8')).toBe(true)
    expect(later('### Step 4: a stray heading')).toBe(false)
    expect(later('### WS16 step 2: an earlier block')).toBe(false)
  })

  it('has every part, in order, each a bullet of its own, and says what a visitor or a member meets', () => {
    const parts = [
      '- **Files.**', '- **The links.**', '- **The footer and the headers.**', '- **The endpoints.**', '- **What ships with every switch off.**',
      '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- **Worker.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(block.split('\n').filter((l) => l.startsWith('- Checks:'))).toHaveLength(1)
    expect(block).toContain('what a visitor or a member meets, by switch, is nothing new')
  })

  it('names every file it adds and changes, each test with its count, and the files beyond the step\'s list', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT, ...CHANGED_INTEGRATION, ...GROWN]) expect(files, name).toContain(`\`${name}\``)
    for (const name of [...NEW_UNIT, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of [...CHANGED_UNIT, ...CHANGED_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before)[:)]`))
    for (const name of GROWN) expect(bullet(files, '  - Grown with no change:'), name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, \\d+ before: `))
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const name of ['functions/utils/mail/linkAnswers.ts', 'functions/utils/mail/gate.ts', 'domain/mail/address.ts', 'functions/utils/mail/outcome.ts', 'test/integration/factories.ts', 'test/integration/mailRuns.ts']) {
      expect(beyond, name).toContain(`\`${name}\``)
    }
  })

  it('gives the links their token, their key and the previous key, no expiry, and why WS06\'s tokens are not used', () => {
    const links = bullet(block, '- **The links.**')
    for (const piece of [
      '`${contactId}.${scope}.${mac}`', '`MAIL_LINK_SECRET`', '`MAIL_LINK_SECRET_PREVIOUS`', '132 bits', '70 characters', 'no date', 'no link expires',
      'the 30 days the FTC\'s CAN-SPAM guide asks for', '`MailLinkKeyMissing`', '`linkKeyCheck`', 'nothing is ever signed with the previous key',
      '`functions/utils/stripe.ts`', '`functions/utils/tokens.ts`', 'an expiry',
    ]) expect(links, piece).toContain(piece)
  })

  it('gives the footer and the headers their words, their order, no mailto, no postal address, and list mail through Amazon SES only', () => {
    const footer = bullet(block, '- **The footer and the headers.**')
    const order = ['`List-Unsubscribe`', '`List-Unsubscribe-Post: List-Unsubscribe=One-Click`'].map((h) => footer.indexOf(h))
    for (const i of order) expect(i).toBeGreaterThan(-1)
    expect(order[0]).toBeLessThan(order[1])
    for (const piece of [
      '`listMailParts', 'one HTTPS address', 'no mailto', '"You\'re getting the LCA newsletter because this address is on an LCA member\'s account."',
      '"Unsubscribe from the LCA newsletter"', '"You\'re getting LCA tournament email because this address is on an LCA member\'s account."',
      '"Unsubscribe from LCA tournament email"', '"Email preferences"', 'no postal address', 'one small change', '`renderEmail`', 'byte for byte',
      '`not_list_mail`', '"Not sent: an optional email must carry its unsubscribe headers."', 'before the gate is read', '`waitForSes`',
      '"Not sent yet: list mail goes out through Amazon SES only."', 'never handed to Resend', '`DEFAULT_FROM`', 'event mail\'s bytes are unchanged',
    ]) expect(footer, piece).toContain(piece)
  })

  it('gives the endpoints the one-click POST, the GET that leads to the page, nothing changed by opening a link, what 404 means, the links kept live, and the contract figures as text', () => {
    const endpoints = bullet(block, '- **The endpoints.**')
    for (const piece of [
      '`functions/api/mail/unsubscribe/[token].ts`', '`functions/api/mail/preferences/[token].ts`', 'RFC 8058', 'multipart', 'urlencoded', 'never a redirect',
      'a second and a third POST answer the same and change nothing', 'changes nothing', '303', 'asks for JSON', 'the person\'s own stop-all',
      'in its audience', '"That list is not one of yours."', 'no \'in\' is ever written on a main mailer', '`complaintStops`', '`Cache-Control: no-store`',
      '"This link isn\'t working."', '`listLinksLive`', 'once a list email is on record', 'exactly as a token that never existed',
      '21 of the 131 methods under `functions/api` contracted, 17 of 127 before', '`PENDING_COUNT` 110, unchanged',
    ]) expect(endpoints, piece).toContain(piece)
  })

  it('says nothing a visitor or a member meets ships with every switch off, names the only thing a request can meet, and lists the pins it moved', () => {
    const off = bullet(block, '- **What ships with every switch off.**')
    expect(off.startsWith('- **What ships with every switch off.** Nothing a visitor or a member meets.')).toBe(true)
    for (const piece of ['the only things a request can meet are the two new routes', '404', 'No page, no email and no existing answer changes', 'WS16 step 5', '`test/a11y/baseline.json` is unchanged']) {
      expect(off, piece).toContain(piece)
    }
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      '`test/integration/mail-gate.test.ts`', '`test/integration/mail-gate-edges.test.ts`', '`ONE_CLICK_HEADERS`', '`waitForSes`', '`test/unit/mail-rules-outcome.test.ts`',
      '`test/unit/routes.test.ts`', '91 to 93', '`not_list_mail`', '17 to 21', '127 to 131', '`A11Y_EMPTY_SECRETS`', '`test/unit/route-audit.test.ts`',
    ]) expect(pins, piece).toContain(piece)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
  })

  it('gives the lint as unchanged, the build against the base, and each check once', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['`764f32f`', 'a local production build', '`index-BGHuXroV.js` at 550,347 bytes', '`index-De3UpPLs.css` at 130,375 bytes', '`features-DxqQlIon.js` at 698 bytes', 'the same name and size as on the base']) {
      expect(build, piece).toContain(piece)
    }
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('one run')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` before and after')
  })

  it('gives the worker\'s dry run on the base and after, measured on their day, with the growth and what is left under part one\'s ceiling of 96 KiB, gzip 28 KiB', () => {
    const worker = bullet(block, '- **Worker.**')
    for (const piece of ['`npx wrangler deploy --dry-run`', '`--config workers/daily-emails/wrangler.toml`', '`764f32f`', 'Wednesday, November 11, 2026', 'The bundle holds no package.', '96 KiB, gzip 28 KiB']) {
      expect(worker, piece).toContain(piece)
    }
    const sizes = [...worker.matchAll(/([\d.]+) KiB, gzip ([\d.]+) KiB/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(sizes.length).toBeGreaterThanOrEqual(2)
    const [base, after] = sizes
    expect(base).toEqual([45.36, 12.69])
    const more = /([\d.]+) KiB more, gzip ([\d.]+) KiB/.exec(worker)
    expect(more, 'the growth').not.toBeNull()
    expect(Number(more![1])).toBeCloseTo(after[0] - base[0], 2)
    expect(Number(more![2])).toBeCloseTo(after[1] - base[1], 2)
    expect(after[0]).toBeLessThan(96)
    expect(after[1]).toBeLessThan(28)
    const left = /leaves ([\d.]+) KiB, gzip ([\d.]+) KiB/.exec(worker)
    expect(left, 'what the ceiling leaves').not.toBeNull()
    expect(Number(left![1])).toBeCloseTo(96 - after[0], 2)
    expect(Number(left![2])).toBeCloseTo(28 - after[1], 2)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 3: the figures add up', () => {
  const files = bullet(block, '- **Files.**')
  const countOf = (name: string) => {
    const m = new RegExp(`\`${escape(name)}\` \\((\\d+)(?:, (\\d+) before|, as before)?[:)]`).exec(files)
    return m ? { now: Number(m[1]), before: Number(m[2] ?? m[1]) } : null
  }

  it('gives unit counts that add up: the base\'s, the new files\' tests, the changed files\' gains and the grown file\'s growth', () => {
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([8162, 313])
    const counts = [...NEW_UNIT, ...CHANGED_UNIT, ...GROWN].map((name) => [name, countOf(name)] as const)
    for (const [name, count] of counts) expect(count, name).not.toBeNull()
    const gain = counts.reduce((sum, [name, count]) => sum + (NEW_UNIT.includes(name) ? count!.now : count!.now - count!.before), 0)
    expect(num(before) + gain).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts that add up: the base\'s, the new files\' and the changed files\' gains', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1423, 87])
    for (const name of [...NEW_INTEGRATION, ...CHANGED_INTEGRATION]) expect(countOf(name), name).not.toBeNull()
    const fresh = NEW_INTEGRATION.reduce((sum, name) => sum + countOf(name)!.now, 0)
    const gains = CHANGED_INTEGRATION.reduce((sum, name) => sum + countOf(name)!.now - countOf(name)!.before, 0)
    expect(num(before) + fresh + gains).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the browser run as one run whose counts add up, and the lint figures as the base\'s with the new files added', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, one run/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect(num(run![2]) + num(run![3])).toBe(num(run![1]))
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![2])).toBe(881)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_LINTED.length)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 3: the map and the close of a follow-up', () => {
  it('adds the four sentences of what this step proves, once each, ahead of the planned step, and to no other item', () => {
    for (const [id, sentence] of PROVED) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.endsWith('Planned: WS16 step 3.'), id).toBe(true)
      expect(item.indexOf(sentence), id).toBeLessThan(item.indexOf('Planned: WS16 step 3.'))
    }
    expect(entries(map).filter((l) => l.includes('Proved in WS16 step 3 by')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(PROVED.map(([id]) => id))
    const ac7 = added('AC7', PROVED[1][1])
    for (const piece of ['`MAIL_LINK_SECRET`', '70 characters', '132 bits', 'holds no date', 'no sign-in', 'multipart', 'urlencoded', 'no Location and no Set-Cookie', 'a second and a third POST change nothing', '303', 'comes with the pages in WS16 step 5']) {
      expect(ac7, piece).toContain(piece)
    }
    for (const piece of ['the one list it names', 'no member account', 'with the engine\'s rules on and off']) expect(added('AC6', PROVED[0][1]), piece).toContain(piece)
    expect(added('D34', PROVED[2][1])).toContain('The page that shows the choices comes in WS16 step 5.')
    expect(added('D41', PROVED[3][1])).toContain('no street, box, suite, city line or ZIP code')
  })

  it('keeps WS16 step 2\'s sentence on AC6 word for word, ahead of this step\'s', () => {
    const item = mapItem('AC6')
    const before = 'Built in WS16 step 2: the tables that hold the choices, `mail_contacts` keyed by address, so an address with no member account can hold a choice and a family\'s one address holds one'
    expect(item.split(before)).toHaveLength(2)
    expect(item.indexOf(before)).toBeLessThan(item.indexOf(PROVED[0][1]))
  })

  it('adds a sentence that starts "Built in WS16 step 3" to the four items this step builds a part of, once each, ahead of their planned steps', () => {
    for (const [id, step] of BUILT) {
      const item = mapItem(id)
      expect(item.split('Built in WS16 step 3: '), id).toHaveLength(2)
      expect(item.endsWith(`Planned: WS16 step ${step}.`), id).toBe(true)
      expect(item.indexOf('Built in WS16 step 3: '), id).toBeLessThan(item.indexOf(`Planned: WS16 step ${step}.`))
    }
    expect(entries(map).filter((l) => l.includes('Built in WS16 step 3:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(BUILT.map(([id]) => id))
    expect(added('AC8', 'Built in WS16 step 3: ')).toContain('`listMailParts`')
    expect(added('AC9', 'Built in WS16 step 3: ')).toContain('`/api/mail/preferences/:token`')
    expect(added('AC13', 'Built in WS16 step 3: ')).toContain('`A11Y_EMPTY_SECRETS`')
    expect(added('Q41', 'Built in WS16 step 3: ')).toContain('`waitForSes`')
  })

  it('closes WS16 step 2\'s follow-up on the worker\'s bundle at its end, with the ceiling chosen and its reasons, its earlier words as that step wrote them', () => {
    const entry = entries(followUps).find((l) => head(l) === CLOSED) ?? ''
    expect(entry.startsWith(CLOSED_START)).toBe(true)
    expect(entry.split(CLOSE)).toHaveLength(2)
    const close = entry.slice(entry.indexOf(CLOSE))
    for (const piece of [
      '96 KiB, gzip 28 KiB', '`workers/daily-emails/wrangler.toml` gains no `minify` setting', '31.99 KiB', '`test/unit/mail-worker-closure.test.ts`',
      'not a limit of Cloudflare\'s', '64 MiB', 'Wednesday, November 11, 2026', 'harder to read',
    ]) expect(close, piece).toContain(piece)
    expect(entry.endsWith('.')).toBe(true)
    expect(entries(ws16).filter((l) => l.includes(' Done in WS16 step 3:')).map(head)).toEqual([CLOSED])
  })
})

describe('REDESIGN_STATUS.md, WS16 step 3: the lists', () => {
  it('records this step\'s entries in each list, in their order, each once and tagged', () => {
    expect(tagged(decisions).map(head)).toEqual(HEADS.decisions)
    expect(tagged(deviations).map(head)).toEqual(HEADS.deviations)
    expect(tagged(verify).map(head)).toEqual(HEADS.verify)
    expect(tagged(followUps).map(head)).toEqual(HEADS.followUps)
    for (const list of [decisions, deviations, verify, followUps]) {
      for (const entry of tagged(list)) expect(entry, head(entry)).toMatch(/^- \*\*[^*]+ \(WS16 step 3\)\.\*\* \S/)
    }
  })

  it('puts its entries after WS16 step 2\'s in each list', () => {
    const last = { decisions: 'A reminder claimed before its send, under the rules (WS16 step 2).', deviations: 'No cron and no phase, and the daily run\'s reminders before its rating lookups (WS16 step 2).', verify: 'The runtime\'s words for too many outside calls (WS16 step 2).', followUps: 'The attendee and week-before reminders a run leaves (WS16 step 2).' }
    for (const [name, list] of [['decisions', decisions], ['deviations', deviations], ['verify', verify], ['followUps', followUps]] as const) {
      const heads = entries(list).map(head)
      expect(heads.indexOf(HEADS[name][0]), name).toBeGreaterThan(heads.indexOf(last[name]))
      expect(heads.indexOf(last[name]), name).toBeGreaterThan(-1)
    }
  })

  it('records D34 and D41 with K\'s date and what each turned down', () => {
    const [optOuts, postal] = tagged(decisions)
    expect(optOuts).toContain('D34, settled by K on Tuesday, November 10, 2026')
    expect(postal).toContain('D41, settled by K on Tuesday, November 10, 2026')
    for (const piece of ['no setting, no empty slot and no reminder', 'one small change']) expect(postal, piece).toContain(piece)
    for (const entry of tagged(decisions)) expect(entry, head(entry)).toContain('Turned down:')
  })

  it('records the two deviations against brief 1.4 and the WS16 section', () => {
    const [links, live] = tagged(deviations)
    for (const piece of ['`functions/utils/tokens.ts`', 'line 403', '`SIGNING_SECRET`', '`MAIL_LINK_SECRET`', 'no expiry', 'at least 30 days']) expect(links, piece).toContain(piece)
    for (const piece of ['`listLinksLive`', 'whatever the constant says', 'a revert of the switch-on change can never break a link already sent', 'WS16 step 5']) expect(live, piece).toContain(piece)
  })

  it('confirms every verify item it resolves, each read in the code or on its source, with the day it was read', () => {
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed\b/)
    const byHead = (h: string) => tagged(verify).find((e) => head(e) === h) ?? ''
    expect(byHead(HEADS.verify[2])).toContain('RFC 8058, read on Wednesday, November 11, 2026')
    expect(byHead(HEADS.verify[3])).toContain('read on Wednesday, November 11, 2026')
    for (const piece of ['read on Wednesday, November 11, 2026', 'Thursday, October 29, 2026', '64 MiB on Workers Free and 64 MiB on Workers Paid']) expect(byHead(HEADS.verify[7]), piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 3: plain language', () => {
  /** Everything this step wrote in the section: its block, its entries, its map sentences, its close and the Status line's tail. */
  const written = [
    block, ...[decisions, deviations, verify, followUps].flatMap(tagged), ...PROVED.map(([id, s]) => added(id, s)),
    ...BUILT.map(([id]) => added(id, 'Built in WS16 step 3: ')), followUps.slice(followUps.indexOf(CLOSE), followUps.indexOf('\n', followUps.indexOf(CLOSE))),
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

describe('REDESIGN_STATUS.md, WS16 step 3: the date and the new files', () => {
  it('dates the record on a real day, on or after Wednesday, November 11, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-11').toBe(true)
  })

  it('lists as new only files that exist, the code and tests among them free of a dash, a tool\'s name, the two letters on their own and the old initials', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT, ...CHANGED_INTEGRATION, ...GROWN]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_LINTED) {
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
  })
})
