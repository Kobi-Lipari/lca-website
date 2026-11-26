// test/unit/redesign-status-ws09-step26.test.ts
//
// REDESIGN_STATUS.md records WS09's twenty-sixth step, the contact relay, the second of
// the plan's seven steps of checkpoint X. Like WS09 step 25's record test,
// this file reads only the WS09 section, from its heading to the WS10
// heading. Pinned here: this step's block right after the block of
// checkpoint W's newer commits taken in, and before the four lists while it
// is the latest; the Status line's tail while this step is the latest; the
// block's parts in order and its figures, which must agree with each other
// and with the files they describe; the sentences this step added to the
// map; the tagged entries of the lists; and the plain-language rules over
// what the step wrote and the files it adds. No line here reads how a switch
// ships.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'
import { PENDING_CONTRACTS } from './contracts-pending'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|[${String.fromCharCode(0x27e6, 0x27e7)}]|\\b[A-Z]+[0-9]*_[A-Z_0-9]+\\b(?!\`)`)
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
const TAG = '(WS09 step 26).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### Checkpoint X: WS09 checkpoint W\'s newer commits taken in'
const STEP = '### WS09 step 26: the contact relay'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(STEP)
const map = part('### WS09 map: what proves each acceptance criterion and decision')
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latestBlock = headings[headings.indexOf(LISTS[0]) - 1] ?? ''
const latest = latestStep === 26 && latestBlock === STEP

const ENDPOINT = 'functions/api/clubs/[id]/contact.ts'
const RELAY = 'functions/utils/clubs/relay.ts'
const CONTRACT = 'domain/contracts/clubContact.ts'
const RULES = 'domain/clubs/contactMessage.ts'
const FORM = 'src/areas/clubs/components/ContactRelayForm.tsx'
const EMAILS = 'functions/utils/clubs/emails.ts'
const HTML = 'functions/utils/clubs/pageHtml.ts'
const WORDS = 'domain/clubs/pageWords.ts'
const WIDGET = 'src/areas/clubs/components/SpamCheck.tsx'
const HARNESS = 'test/integration/harness.ts'
const BAR = 'src/areas/clubs/components/ClubBar.tsx'
const COVER = 'src/areas/clubs/components/ClubCover.tsx'
const PLAIN = 'src/areas/clubs/clubPage.ts'
const SELF = 'test/unit/redesign-status-ws09-step26.test.ts'
const NEW_FILES = [ENDPOINT, RELAY, CONTRACT, RULES, FORM]
/**
 * The cases WS09 checkpoint X's review added to this block's test files, each held to a fix of that review; the
 * block keeps the count each file had at this step.
 */
const X_REVIEW_ADDED: Record<string, number> = {
  'test/integration/club-contact-relay.test.ts': 2,
  'test/unit/contact-relay-form.test.tsx': 1,
}
const NEW_TESTS = [
  'test/integration/club-contact-relay.test.ts', 'test/integration/contracts/club-contact.test.ts', 'test/integration/spam-check-no-signal.test.ts',
  'test/unit/contact-relay-form.test.tsx', 'test/unit/spam-check-widget-mends.test.tsx', 'test/integration/club-contact-relay-edges.test.ts',
  'test/unit/contact-message-rules.test.ts', 'test/unit/contact-relay-source.test.ts', 'test/unit/contact-relay-form-edges.test.tsx',
  'test/unit/contact-relay-form-status-place.test.tsx', SELF,
]
/**
 * The new tests that draw some cases in a loop over a written list, with the count of
 * cases the suite runs: a count of `it(` lines cannot give it, so it is pinned here, and
 * no file may hold more `it(` lines than its pinned count.
 */
const LOOPED: Record<string, number> = {
  'test/integration/club-contact-relay-edges.test.ts': 26,
  'test/unit/contact-relay-source.test.ts': 10,
  'test/unit/contact-relay-form-edges.test.tsx': 18,
  'test/unit/contact-relay-form-status-place.test.tsx': 11,
}
const CHANGED = [
  EMAILS, 'functions/utils/clubs/pageAnswer.ts', 'domain/contracts/clubPage.ts', WORDS, HTML, 'domain/contracts/index.ts', 'domain/contracts/registry.ts', 'src/areas/clubs/api.ts',
  'test/unit/fixtures/api-added-since-split.json', PLAIN, 'src/areas/clubs/components/ClubPage.tsx', COVER, BAR, 'src/areas/clubs/components/SectionNav.tsx', WIDGET, HARNESS,
  'test/unit/helpers/clubPageAnswer.ts',
]
/** The test files whose checks this step makes false, each changed in place. */
const MOVED = [
  'test/unit/routes.test.ts', 'test/unit/redesign-status-ws09-step20.test.ts', 'test/unit/redesign-status-ws09-step21.test.ts', 'test/unit/redesign-status-ws09-step22.test.ts',
  'test/unit/redesign-status-ws09-step23.test.ts', 'test/unit/redesign-status-ws09-step24.test.ts', 'test/unit/redesign-status-ws09-step25.test.ts', 'test/unit/club-page-bare.test.tsx',
  'test/unit/club-page-full.test.tsx', 'test/unit/club-page-edges.test.tsx', 'test/unit/club-page-helpers.test.ts', 'test/unit/club-page-rest.test.tsx', 'test/unit/club-page-rest-edges.test.tsx',
  'test/unit/club-page-phone.test.tsx', 'test/unit/club-events.test.tsx', 'test/unit/club-page-contract.test.ts', 'test/unit/club-page-html.test.tsx', 'test/integration/club-page.test.ts',
  'test/integration/club-page-edges.test.ts', 'test/integration/club-page-route.test.ts', 'test/integration/club-page-route-edges.test.ts', 'test/integration/club-written-look.test.ts',
  'test/unit/rate-limit-boundaries.test.ts', 'test/unit/spam-check-widget.test.tsx', 'test/unit/api-split-modules.test.ts',
]
const HELD = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts']
const UNTOUCHED = [
  'src/lib/features.ts', 'functions/utils/clubs/pages.ts', 'src/lib/nav.ts', 'scripts/seed/fixtures.sql', 'playwright.config.ts', 'wrangler.toml', 'src/App.tsx', 'test/unit/contracts-pending.ts',
  'functions/api/contact.ts', 'functions/utils/clubs/publicAnswer.ts', 'functions/utils/events/publicAnswer.ts', 'test/unit/features.test.ts', 'test/unit/nav.test.ts',
  'test/unit/sweep-fixes.test.tsx', 'test/unit/club-confirm-page.test.tsx', 'test/unit/my-region-page.test.tsx', 'test/unit/my-region-club-page.test.tsx',
  'test/integration/public-answer-columns.test.ts', 'test/integration/club-seed-live.test.ts', 'test/integration/club-columns-stay-off-answers.test.ts', 'test/integration/club-roster-kept-back.test.ts',
]
const num = (text: string) => Number(text.replace(/,/g, ''))
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** A file's cases: every `it(` line, or the pinned count of a file that draws some in a loop; none draws cases from a table. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, file).toBe(0)
  const lines = (text.match(/^\s*it\(/gm) ?? []).length
  if (!(file in LOOPED)) return lines
  expect(lines, file).toBeLessThan(LOOPED[file])
  return LOOPED[file]
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])
/** A file's code with its comments taken out. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** A quoted constant's words in a file's code. */
const wordsOf = (file: string, name: string) => /'((?:[^'\\]|\\.)*)'/.exec(codeOf(file).slice(codeOf(file).indexOf(`export const ${name} = `)))?.[1].replace(/\\'/g, '\'') ?? ''

describe('REDESIGN_STATUS.md, WS09 step 26: the block', () => {
  it('sits once, right after the block of checkpoint W\'s newer commits taken in, and before the four lists while it is the latest', () => {
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
        'WS09 step 26, the contact relay, sends a visitor\'s message from a club\'s page to the club\'s own address, else its region\'s representative, else the LCA admins, and stores none of it, only with `CLUB_PAGES_ON` set',
        'checkpoint W\'s newer commits taken into checkpoint X, step 26,',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132']) expect(lines.find((l) => l.startsWith('**PR:**')), pr).toContain(pr)
  })

  it('opens by saying where the step sits, what it builds, and that one endpoint and one contract are added and no switch', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the second of the plan\'s seven steps of checkpoint X (steps 25 to 31)', '`redesign/ws09-clubs-x`', 'WS09 step 15, the worker\'s one line, is still to come',
      '`POST /api/clubs/:id/contact`', `\`${ENDPOINT}\``, `\`${RELAY}\``, 'D29: relayed, never shown, never stored', 'answers 403 in words and reads nothing',
      'One endpoint and one contract are added, and no switch and no migration',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **Where it goes.**', '- **Before any script.**', '- **Nothing stored.**', '- **Guards.**', '- **Never shown.**',
      '- **Never an open relay.**', '- **The form.**', '- **The page.**', '- **The widget\'s two mends and the harness.**', '- **The map (criteria 7 and 8, D29).**',
      '- **The branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**',
      '- **Owed before newClubs goes on.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })

  it('names every file it adds and changes, each new test with its count, the files grown with no change, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...NEW_TESTS, ...CHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...NEW_TESTS]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file) - (X_REVIEW_ADDED[file] ?? 0))
    const grown = bullet(files, '  - Grown with no change:')
    for (const piece of ['`test/unit/domain-boundaries.test.ts`', 'from 60 cases to 62', '`test/unit/route-audit.test.ts`', 'from 95 to 96']) expect(grown, piece).toContain(piece)
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of ['No file the mail stream holds is touched', '`functions/clubs/[id].ts` is in the entry\'s list and is not changed', ...HELD.map((f) => `\`${f}\``), ...UNTOUCHED.map((f) => `\`${f}\``)]) {
      expect(beyond, piece).toContain(piece)
    }
    for (const file of [...HELD, 'src/lib/features.ts', 'functions/utils/clubs/pages.ts', 'src/App.tsx', 'test/unit/contracts-pending.ts', 'src/lib/nav.ts']) {
      expect(read(file), file).not.toMatch(/relay\.ts|ContactRelay|clubContact|WS09 step 26/)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 step 26: the parts against the files', () => {
  it('says where a message goes, in the order and words the files hold', () => {
    const goes = bullet(block, '- **Where it goes.**')
    for (const piece of ['`clubs.contact_email`', '`regionRepresentativesOf`', '`lcaAdmins`', 'with the visitor\'s address as the reply-to', '`keeperOf`', '"Sent."', '`renderEmail`', '`sendEmail`, inside the relay\'s own catch', '`deliver()`', 'only once the mail engine\'s rules are on']) {
      expect(goes, piece).toContain(piece)
    }
    expect(goes).toContain(`"${wordsOf(RULES, 'CONTACT_NOT_SENT')}"`)
    // Moved at WS09 step 27, whose Reply through LCA changed the line's words: this block keeps the words it shipped with.
    expect(goes).toContain('"To answer, write to them at the address above. An answer from your own mail shows them your address."')
    const relay = codeOf(RELAY)
    expect(relay).toContain('const own = await clubAddressOf(env.DB, club.id)')
    expect(relay.indexOf('clubAddressOf(env.DB, club.id)')).toBeLessThan(relay.indexOf('regionRepresentativesOf(env.DB, club.id)'))
    expect(relay.indexOf('regionRepresentativesOf(env.DB, club.id)')).toBeLessThan(relay.indexOf('lcaAdmins(env.DB)'))
    expect(relay).toContain('...(kind === \'club\' ? { replyTo: visitor.email.trim() } : {})')
    for (const file of [RELAY, ENDPOINT, FORM]) expect(codeOf(file), file).not.toMatch(/\bdeliver\(|resend|amazon|\bses\b|keeperOf/i)
    const emails = codeOf(EMAILS)
    expect(emails).toContain('`${why}, so this message came to you as the ${area} representative.`')
    expect(emails).toContain('`${why}, so this message came to you as an LCA admin.`')
    expect(emails).toContain('`${club} has no connected email yet`')
    expect(emails).toContain('`${club}\'s email could not be reached`')
  })

  it('says what the written body gains before any script, as the files hold it', () => {
    const before = bullet(block, '- **Before any script.**')
    for (const piece of ['`clubPageBody`', '`data-club-written-page`', 'its one style element, which this step does not change', 'The JSON-LD block gains nothing', 'criterion 7\'s whole body']) {
      expect(before, piece).toContain(piece)
    }
    expect(before).toContain(`"${wordsOf(WORDS, 'CONTACT_WRITTEN_LINE')}"`)
    expect(wordsOf(WORDS, 'CONTACT_HEADING')).toBe('Contact')
    expect(codeOf(HTML)).toContain('return [`<section><h2>${CONTACT_HEADING}</h2><p>${CONTACT_WRITTEN_LINE}</p></section>`]')
    expect(codeOf(HTML)).toContain('...eventsHtml(answer), ...contactHtml()].join(\'\')')
  })

  it('says what is stored and logged, as the mail engine and the relay hold it', () => {
    const stored = bullet(block, '- **Nothing stored.**')
    for (const piece of ['only `rate_limits` grows', 'The mail engine records nothing for a send', '`mail_do_not_send`', 'made only once the engine\'s rules are on', 'in both states']) {
      expect(stored, piece).toContain(piece)
    }
    for (const file of ['functions/utils/mail/send.ts', 'functions/utils/mail/resend.ts', 'functions/utils/mail/ses.ts', 'functions/utils/mail/gate.ts']) {
      expect(codeOf(file), file).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/)
    }
    for (const file of [RELAY, ENDPOINT]) expect(codeOf(file), file).not.toMatch(/INSERT|UPDATE|DELETE/)
    // The endpoint logs nothing; the relay one fixed line, and never what a failure says.
    expect(codeOf(ENDPOINT)).not.toMatch(/console\./)
    expect([...codeOf(RELAY).matchAll(/console\.\w+\(([^)]*)\)/g)].map((m) => m[1])).toEqual(['COPY_NOT_SENT_LOG'])
    expect(stored).toContain(`"${wordsOf(RELAY, 'COPY_NOT_SENT_LOG')}"`)
    for (const piece of ['the relay catches the failure of `sendEmail` itself', 'a case has the service refuse each copy in words that name its address, with either sender']) expect(stored, piece).toContain(piece)
  })

  it('gives the guards in their order, with their words and caps, as the endpoint and the rules hold them', () => {
    const guards = bullet(block, '- **Guards.**')
    for (const piece of ['`parseBody`', '`clubs/contact`', '`clubs/contact:club`', '`clubNamedBy`', 'The club\'s count comes after the spam check', '100 characters', '254', '5,000']) {
      expect(guards, piece).toContain(piece)
    }
    for (const name of ['CONTACT_CLOSED', 'CONTACT_CLUB_BUSY']) expect(guards, name).toContain(`"${wordsOf(ENDPOINT, name)}"`)
    expect(guards).toContain(`"${wordsOf('functions/utils/rateLimit.ts', 'TOO_MANY')}"`)
    expect(guards).toContain(`"${wordsOf('functions/utils/rateLimit.ts', 'CANT_SEND_NOW')}"`)
    const code = codeOf(ENDPOINT)
    const order = [
      'if (!CLUB_PAGES_ON) return errorResponse(CONTACT_CLOSED, 403)', 'await parseBody(request, clubContactRequestSchema)', 'await limit(env, request, CONTACT_PLACE_ROUTE',
      'await checkSpam(env, body.token, request)', 'await clubNamedBy(env.DB, raw)', 'await limit(env, request, CONTACT_CLUB_ROUTE', 'await relayMessage(',
    ].map((piece) => code.indexOf(piece))
    for (const at of order) expect(at).toBeGreaterThan(-1)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(code).toContain('export const MESSAGES_AN_HOUR_FROM_ONE_PLACE = 5')
    expect(code).toContain('export const MESSAGES_AN_HOUR_TO_ONE_CLUB = 20')
    expect(codeOf(RULES)).toContain('export const CONTACT_LIMITS = { name: 100, email: 254, message: 5000 } as const')
  })

  it('says what is never shown and why no request can steer the mail, as the contract and the form hold it', () => {
    const shown = bullet(block, '- **Never shown.**')
    for (const piece of ['`contact.goes_to`', '`\'club\'`, `\'region\'` or `\'lca\'`', 'never whether an address works', '`relayKind`', 'since the page\'s About does not show it']) expect(shown, piece).toContain(piece)
    expect(read('domain/contracts/clubPage.ts')).toContain('contact: z.strictObject({ name: z.string().nullable(), goes_to: z.enum(CONTACT_GOES_TO) }),')
    expect(codeOf(RULES)).toContain('export const CONTACT_GOES_TO = [\'club\', \'region\', \'lca\'] as const')
    const open = bullet(block, '- **Never an open relay.**')
    for (const piece of ['drops any other key', 'No copy and no receipt goes to the address the visitor typed', 'on the club\'s own copy alone', '"A message for {Club} from the LCA website"', 'escaped']) {
      expect(open, piece).toContain(piece)
    }
    expect(codeOf(CONTRACT)).toContain('export const clubContactRequestSchema = z.object({')
    expect(codeOf(EMAILS)).toContain('subject: `A message for ${clubName} from the LCA website`,')
    expect(codeOf(RELAY)).toContain('const tried = new Set<string>([typed])')
  })

  it('says how the form, the page and the mends behave, as the components and the harness hold them', () => {
    const form = bullet(block, '- **The form.**')
    for (const piece of ['"Your name"', '"Your email"', '"Message"', '"Send message"', '"Sending…"', '"Sent."', '`aria-disabled`', 'Write another message', 'browser\'s storage', '44 pixels']) {
      expect(form, piece).toContain(piece)
    }
    const code = read(FORM)
    for (const piece of ['autoComplete="name"', 'autoComplete="email"', '{sending ? \'Sending…\' : \'Send message\'}', 'Write another message', 'onFocus={() => setEngaged(true)}']) expect(code, piece).toContain(piece)
    expect(code).not.toMatch(/localStorage|sessionStorage|#c8a94a/i)
    // A refusal's words stand above Send message and are brought into sight when they fill.
    for (const piece of ['stand above "Send message"', '`bringClearOfBars`', 'the focus left on the button', 'seventh sheet of pictures, the refusals in sight']) expect(form, piece).toContain(piece)
    // The form's own status is found by its id, since the wait words' line under the spam check is a status too.
    const formStatusAt = code.indexOf("id={idOf('status')} role=\"status\"")
    expect(formStatusAt).toBeGreaterThan(-1)
    expect(formStatusAt).toBeLessThan(code.indexOf('type="submit"'))
    expect(code.indexOf('<SpamCheck ')).toBeLessThan(formStatusAt)
    expect(codeOf(PLAIN)).toContain('export function bringClearOfBars(words: Element): void {')
    expect(bullet(block, '- **Judgement calls.**')).toContain('The pictures found four faults. Three are mended in the form\'s own files')
    expect(bullet(block, '- **Judgement calls.**')).toContain('The fourth is left to the dock\'s own files')
    const page = bullet(block, '- **The page.**')
    for (const piece of ['"Message the club"', '"Contact the club"', '`#contact`', '`/contact`', 'Message the club alone']) expect(page, piece).toContain(piece)
    expect(codeOf(PLAIN)).toContain('export const DRAWN_SECTIONS = [\'about\', \'when_and_where\', \'events\', \'news\', \'contact\'] as const')
    expect(codeOf(COVER)).toContain('<a href={`#${SECTION_IDS.contact}`} onClick={focusContactForm}')
    expect(codeOf(BAR)).toContain('Message the club')
    expect(codeOf(BAR)).not.toContain('if (!place) return null')
    const mends = bullet(block, '- **The widget\'s two mends and the harness.**')
    for (const piece of ['taken off the page', '`refresh`', 'a token is good once', 'refuses at once a caller that passes no signal', 'The limiter and the spam check on the server are not changed']) {
      expect(mends, piece).toContain(piece)
    }
    expect(codeOf(WIDGET)).toContain('}, [siteKey, attempt, refresh])')
    expect(codeOf(WIDGET)).toContain('      gone = true\n')
    expect(read(HARNESS)).toContain('if (!signal || signal.aborted) throw new Error(\'harness: the spam check gave up waiting\')')
  })

  it('names the branch, the merge, the database, a revert, what ships and what is owed', () => {
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-x`', '`01fb87d`', 'checkpoints W and X are not', 'does not hold `main`\'s later changes', 'this step\'s diff is against `01fb87d`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration, no table and no switch', '106 handler files', '42 of the 146 methods', '`PENDING_COUNT` still 104']) expect(does, piece).toContain(piece)
    expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**')).toContain('adds no table')
    expect(bullet(block, '- **What a revert leaves.**')).toContain('no row of a message')
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['One endpoint that answers 403', '`POST /api/contact`', 'with `clubKeepers` unset or set', 'No switch is added']) expect(ships, piece).toContain(piece)
    const owed = bullet(block, '- **Owed before newClubs goes on.**')
    expect(owed).toContain('Step 25\'s sixteen, with this step\'s')
    expect(owed.split('\n').filter((l) => /^\s+- /.test(l))).toHaveLength(20)
    for (const piece of ['before WS09 step 27 is in', 'shows the visitor their address', 'the one line beside the form', '`TURNSTILE_SECRET_KEY`', '`SIGNING_SECRET` for every public form', 'the mail engine\'s rules on, `MAIL_LISTS_ON` set or `MAIL_SENDER` `\'ses\'`, before newClubs', 'the visitor told "Sent." and the representative never hearing of it']) expect(owed, piece).toContain(piece)
  })

  it('names each moved pin by its file, and the handler and contract figures hold', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('no earlier test file changes its count of cases')
    // The figure read from the routes' own test, so a later route moves nothing here: 106 at this step, a later figure since checkpoint X took checkpoint W in.
    expect(Number(/expect\(real\.filter\(\(r\) => r\.startsWith\('api\/'\)\)\.length\)\.toBe\((\d+)\)/.exec(read('test/unit/routes.test.ts'))?.[1])).toBeGreaterThanOrEqual(106)
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 104')
    expect(contracts['clubs/[id]/contact']).toBeDefined()
    expect(Object.keys(contracts['clubs/[id]/contact'])).toEqual(['POST'])
    if (!latest) return
    expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(42)
    expect(PENDING_CONTRACTS).toHaveLength(104)
  })

  it('gives the lint as the base\'s, the build\'s figures with why each moved, and the worker\'s dry run', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `01fb87d`')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-D8ekMO07.js` at 559,676', '`sendClubMessage`', '`index-DpyXZnV6.css` at 138,073', '`features-nZCZoT6G.js` stays at 729 bytes',
      'from 13,387 bytes', '`WhenAndWhere-', '.js`, goes from 13,103 bytes to 13,885', '`challenges.cloudflare.com`, is in that chunk alone and never in the main script', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
    // Read the build where one is at hand: while this step is the latest, the provider's address is in the club page's chunk alone.
    if (!latest || !existsSync(join(ROOT, 'dist/assets'))) return
    const built = readdirSync(join(ROOT, 'dist/assets')).filter((f) => /\.(?:js|css)$/.test(f))
    expect(built.filter((f) => read(`dist/assets/${f}`).includes('challenges.cloudflare.com')).every((f) => f.startsWith('ClubListingPage-'))).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 26: the Checks line', () => {
  it('gives each figure once, and no browser run of its own', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `01fb87d`\'s tree')
  })

  it('gives unit and integration counts that add up: the base\'s, the files grown and the new files\'', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    expect([num(unit![3]), Number(unit![4])]).toEqual([11282, 495])
    const newUnit = NEW_TESTS.filter((f) => f.startsWith('test/unit/'))
    // Three cases grow in two files that draw their cases from the tree, by Grown with no change.
    expect(num(unit![3]) + 3 + newUnit.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(unit![1]))
    expect(Number(unit![2]) - Number(unit![4])).toBe(newUnit.length)
    // The integration figures count the tests that run, as the gate gives them; the one todo stands beside them.
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing, with the one todo beside them/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    expect([num(integration![3]), Number(integration![4])]).toEqual([3004, 176])
    const newIntegration = NEW_TESTS.filter((f) => f.startsWith('test/integration/'))
    expect(num(integration![3]) + newIntegration.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(integration![1]))
    expect(Number(integration![2]) - Number(integration![4])).toBe(newIntegration.length)
  })

  it('gives the lint files as the base\'s with the new code and test files, and the build\'s file counts', () => {
    const lint = /`npm run lint` 13 errors and 11 warnings over ([\d,]+) files \(([\d,]+) on the base\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1271)
    const linted = [...NEW_FILES, ...NEW_TESTS].filter((f) => /\.tsx?$/.test(f))
    expect(num(lint![1]) - num(lint![2])).toBe(linted.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[2]).toBe('214')
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 26: the map and the lists', () => {
  it('adds one sentence to criteria 7 and 8 and to D29, each before its planned step, and to no other item', () => {
    for (const [id, planned] of [['Criterion 7', 26], ['Criterion 8', 27], ['D29', 26]] as const) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 26: '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 26: ')).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
      expect(item.endsWith(`Planned: WS09 step ${planned}.`), id).toBe(true)
      expect(item.slice(item.indexOf('Built in WS09 step 26: ')), id).toContain('`test/integration/club-contact-relay.test.ts`')
    }
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 26:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 7', 'Criterion 8', 'D29'])
  })

  it('records the step\'s deviations, verify items and follow-ups, each tagged, and adds no decision', () => {
    expect(tagged(part(LISTS[0])).filter((l) => !l.endsWith(' Recorded at the close, in WS09 step 38.'))).toEqual([]) // moved by WS09 step 38: the close records the step's decisions under its own tag
    expect(tagged(deviations).map(head)).toEqual([
      'The club\'s contact name (WS09 step 26).', 'The representative is named by the region (WS09 step 26).', 'The order the relay reads (WS09 step 26).',
      'The written page\'s file (WS09 step 26).', 'The spam check drawn when the form is used (WS09 step 26).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'Today\'s contact stores everything (WS09 step 26).', 'Reply-to exists (WS09 step 26).', 'A dead address (WS09 step 26).', 'K\'s words (WS09 step 26).', 'What a send records (WS09 step 26).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `01fb87d`/)
    expect(tagged(followUps).map(head)).toEqual([
      'A lost answer sends a second copy (WS09 step 26).', 'The service\'s words in the log (WS09 step 26).', 'The contact name beside Contact (WS09 step 26).',
      'The form in the browser builds (WS09 step 26).', 'A visitor who types a keeper\'s address (WS09 step 26).',
      'A pointer\'s first press from the message box (WS09 step 26).', 'The wait words on a second press (WS09 step 26).',
    ])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 26: plain language', () => {
  const sentences = ['Criterion 7', 'Criterion 8', 'D29'].map((id) => mapItem(id)).map((item) => item.slice(item.indexOf('Built in WS09 step 26: '), item.search(/ Planned: WS09 step \d+\.$/)))
  const written = [block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps), ...sentences, statusLine].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the step wrote, and dates and times in their plain form', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS]) expect(written).not.toMatch(rule)
    const prose = proseOf(written)
    expect(prose).not.toMatch(UNFILLED)
    expect(prose).not.toMatch(HE)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const found of prose.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b(?!:)/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 5), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds, and writes the tests\' people made up, reading no switch\'s shipped value', () => {
    for (const file of [...NEW_FILES, ...NEW_TESTS]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
    for (const file of NEW_TESTS.filter((f) => f !== SELF)) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env/)
      for (const address of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(address, file).toMatch(/@example\.org$/)
      expect(text, file).not.toMatch(/src\/lib\/features|\bfeatures\.\w+|FEATURES\.\w+/)
      // A server switch is never imported: it is read only as a getter on a mock of its module, which the case sets itself.
      expect(text, file).not.toMatch(/import\s*\{[^}]*\b(?:CLUB_PAGES_ON|CLUB_KEEPERS_ON|MAIL_LISTS_ON|MAIL_SENDER)\b/)
      for (const name of new Set(text.match(/\b(?:CLUB_PAGES_ON|CLUB_KEEPERS_ON|MAIL_LISTS_ON|MAIL_SENDER)\b/g) ?? [])) expect(text, `${file} ${name}`).toContain(`get ${name}() {`)
      // Every network address a test writes is from the ranges set aside for documentation.
      for (const address of text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) ?? []) expect(address, file).toMatch(/^(?:192\.0\.2|198\.51\.100|203\.0\.113)\./)
    }
  })
})
