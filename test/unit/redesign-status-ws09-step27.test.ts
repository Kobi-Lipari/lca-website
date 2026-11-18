// test/unit/redesign-status-ws09-step27.test.ts
//
// REDESIGN_STATUS.md records WS09's twenty-seventh step, Reply through LCA,
// the third of the plan's seven steps of checkpoint X. Like the contact
// relay's record test, this file reads only the WS09 section, from its heading to the
// WS10 heading. Pinned here: this step's block right after the contact
// relay's, and before the four lists while it is the latest; the Status
// line's tail while this step is the latest; the block's parts in order and
// its figures, which must agree with each other and with the files they
// describe; the sentence this step added to the map; the tagged entries of
// the lists; and the plain-language rules over what the step wrote and the
// files it adds. No line here reads how a switch ships.
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
const TAG = '(WS09 step 27).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 26: the contact relay'
const STEP = '### WS09 step 27: Reply through LCA'
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
const latest = latestStep === 27 && latestBlock === STEP

const ENDPOINT = 'functions/api/clubs/reply/[token].ts'
const LINK = 'functions/utils/clubs/reply.ts'
const CONTRACT = 'domain/contracts/clubReply.ts'
const RULES = 'domain/clubs/replyMessage.ts'
const PAGE = 'src/pages/ClubReplyPage.tsx'
const EMAILS = 'functions/utils/clubs/emails.ts'
const RELAY = 'functions/utils/clubs/relay.ts'
const SELF = 'test/unit/redesign-status-ws09-step27.test.ts'
const NEW_FILES = [ENDPOINT, LINK, CONTRACT, RULES, PAGE]
const NEW_TESTS = [
  'test/integration/club-reply.test.ts', 'test/integration/contracts/club-reply.test.ts', 'test/unit/club-reply-page.test.tsx', 'test/unit/club-reply-link.test.ts',
  'test/integration/club-reply-edges.test.ts', 'test/unit/club-reply-edges.test.ts', 'test/unit/club-reply-page-edges.test.tsx', SELF,
]
const CHANGED = [
  EMAILS, RELAY, 'domain/contracts/index.ts', 'domain/contracts/registry.ts', 'src/areas/clubs/api.ts', 'test/unit/fixtures/api-added-since-split.json', 'src/App.tsx', 'public/_headers',
]
/** The test files whose checks this step makes false, each changed in place. */
const MOVED = [
  'test/unit/routes.test.ts', 'test/unit/app-routes.test.tsx', 'test/integration/club-contact-relay.test.ts', 'test/unit/redesign-status-ws09-step26.test.ts',
  'test/unit/rate-limit-boundaries.test.ts', 'test/unit/automation-runs-lagging-run.test.ts', 'test/unit/api-split-modules.test.ts', 'test/unit/redesign-status-ws09-u-review.test.ts',
  'test/unit/redesign-status-ws09-step14.test.ts', 'test/unit/redesign-status-ws09-step21.test.ts',
]
const HELD = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts']
const UNTOUCHED = [
  'src/lib/features.ts', 'functions/utils/clubs/pages.ts', 'src/lib/nav.ts', 'scripts/seed/fixtures.sql', 'playwright.config.ts', 'wrangler.toml', 'test/unit/contracts-pending.ts',
  'functions/api/contact.ts', 'functions/utils/clubs/publicAnswer.ts', 'functions/utils/events/publicAnswer.ts', 'test/unit/features.test.ts', 'functions/utils/rateLimit.ts',
  'functions/utils/spamCheck.ts', 'functions/utils/tokens.ts',
]
const num = (text: string) => Number(text.replace(/,/g, ''))
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** A file's cases: every `it(` line; none of this step's files draws cases from a table or a loop. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:test|describe)\.each\(/gm) ?? []).length, file).toBe(0)
  // A case drawn from a list of files is counted once for each file the list in that same file names.
  const listed = (name: string) => {
    const list = new RegExp(`^const ${name} = \\[([\\s\\S]*?)\\n\\]`, 'm').exec(text)
    expect(list, `${file} ${name}`).not.toBeNull()
    return (list![1].match(/'[^']*'/g) ?? []).length
  }
  const eaches = [...text.matchAll(/^\s*it\.each\((\[[^\]]*\]|\w+)\)\(/gm)]
  expect(eaches.length, file).toBe((text.match(/^\s*it\.each\(/gm) ?? []).length)
  const drawn = eaches.map((m) => m[1].replace(/^\[|\]$/g, '').split(',').map((n) => listed(n.trim().replace(/^\.\.\./, ''))).reduce((a, n) => a + n, 0))
  return (text.match(/^\s*it\(/gm) ?? []).length + drawn.reduce((a, n) => a + n, 0)
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])
/** A file's code with its comments taken out. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** A quoted constant's words in a file's code. */
const wordsOf = (file: string, name: string) => /'((?:[^'\\]|\\.)*)'/.exec(codeOf(file).slice(codeOf(file).indexOf(`export const ${name} = `)))?.[1].replace(/\\'/g, '\'') ?? ''

describe('REDESIGN_STATUS.md, WS09 step 27: the block', () => {
  it('sits once, right after the contact relay\'s block, and before the four lists while it is the latest', () => {
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
        'WS09 step 27, Reply through LCA, lets the region\'s representative or an LCA admin answer a relayed message with neither address shown, only with `CLUB_PAGES_ON` set',
        'checkpoint W\'s newer commits taken into checkpoint X, step 26, step 27,',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132']) expect(lines.find((l) => l.startsWith('**PR:**')), pr).toContain(pr)
  })

  it('opens by saying where the step sits, what it builds, and that one endpoint and one contract are added and no switch', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the third of the plan\'s seven steps of checkpoint X (steps 25 to 31)', '`redesign/ws09-clubs-x`', 'WS09 step 15, the worker\'s one line, is still to come',
      '`GET` and `POST /api/clubs/reply/:token`', `\`${ENDPOINT}\``, '`/clubs/reply/{token}`', '`sealToken`', '`club_reply`', 'for 30 days', `\`${PAGE}\``,
      'answers 403 in words and reads nothing', 'One endpoint and one contract are added, and no switch and no migration',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The link.**', '- **The reply.**', '- **Who may reply.**', '- **Nothing stored.**', '- **The sign-off.**', '- **The page.**',
      '- **The address.**', '- **The map (criterion 8).**', '- **The branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**',
      '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Owed before newClubs goes on.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**',
      '- **Build.**', '- Checks:',
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
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
    const grown = bullet(files, '  - Grown with no change:')
    for (const piece of ['`test/unit/domain-boundaries.test.ts`', 'from 62 cases to 64', '`test/unit/route-audit.test.ts`', 'from 96 to 97', '`test/unit/app-routes.test.tsx`', 'from 43 to 44']) {
      expect(grown, piece).toContain(piece)
    }
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of ['No file the mail stream holds is touched', '`functions/clubs/[id].ts` and `domain/clubs/slug.ts` are not changed', '`test/integration/harness.ts` is not changed', ...HELD.map((f) => `\`${f}\``), ...UNTOUCHED.map((f) => `\`${f}\``)]) {
      expect(beyond, piece).toContain(piece)
    }
    for (const file of [...HELD, ...UNTOUCHED, 'test/integration/harness.ts']) expect(read(file), file).not.toMatch(/clubs\/reply|ClubReply|clubReply|club_reply|WS09 step 27/)
    // The two shared files gain this stream's own lines alone, each naming the step.
    expect(read('src/App.tsx').match(/ClubReplyPage/g)).toHaveLength(4)
    expect(read('public/_headers').split('\n').filter((l) => l.startsWith('/'))).toEqual(['/clubs/confirm/*', '/clubs/reply/*'])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 27: the parts against the files', () => {
  it('says what the link is, sealed for 30 days under its own purpose, in the words and figures the files hold', () => {
    const link = bullet(block, '- **The link.**')
    for (const piece of ['"Reply through LCA"', '`resolveSiteUrl`', '`SITE_URL`', '`encodeURIComponent`', '`sealToken`', '`club_reply`', 'for 30 days', '160 characters', '310 characters', '906 characters', '2,240', '4,096', 'The club\'s own copy is untouched']) {
      expect(link, piece).toContain(piece)
    }
    expect(link).toContain(`"${wordsOf(EMAILS, 'RELAY_OWN_MAIL_LINE')}"`)
    expect(link).toContain(`"${wordsOf(EMAILS, 'RELAY_NO_LINK_LINE')}"`)
    expect(link).toContain(`"${wordsOf(ENDPOINT, 'REPLY_NO_KEY')}"`)
    const code = codeOf(LINK)
    expect(code).toContain('export const REPLY_PURPOSE = \'club_reply\'')
    expect(code).toContain('export const REPLY_TTL_SECONDS = 30 * 24 * 60 * 60')
    expect(code).toContain('export const REPLY_EXCERPT_LENGTH = 160')
    expect(code).toContain('sealToken(env.SIGNING_SECRET, REPLY_PURPOSE')
    expect(code).toContain('return `${siteUrl}/clubs/reply/${encodeURIComponent(token)}`')
    expect(read('test/unit/club-reply-link.test.ts')).toMatch(/toBe\(2240\)[\s\S]*toBe\(906\)[\s\S]*toBe\(310\)/)
    // The relay seals once for a message, for the two copies alone.
    const relay = codeOf(RELAY)
    expect(relay).toContain('const replyUrl = kind === \'club\' ? null : await linkFor()')
    expect([...relay.matchAll(/replyLink\(/g)]).toHaveLength(1)
  })

  it('says what the reply is and sends, from LCA\'s own address with LCA\'s own reply-to, in the words the files hold', () => {
    const reply = bullet(block, '- **The reply.**')
    for (const piece of ['`parseBody`', '5,000 characters', '"Write your reply."', '"Your reply can be at most 5,000 characters."', '`sendEmail`', '`noreply@louisianachess.org`', '"Louisiana Chess Association"', '"An answer to your message to {Club}"', '`renderEmail`', '"Reply through LCA: a reply was not sent."']) {
      expect(reply, piece).toContain(piece)
    }
    const code = codeOf(ENDPOINT)
    expect([...code.matchAll(/\bsendEmail\(/g)]).toHaveLength(1)
    expect(code).toContain('await sendEmail(env, { ...mail, to: link.claim.email })')
    expect(code).not.toMatch(/replyTo|\bcc\b|\bbcc\b|deliver\(|trySendEmail|sendEmailOutcome|resend|amazonaws/i)
    expect([...code.matchAll(/console\.\w+\(([^)]*)\)/g)].map((m) => m[1])).toEqual(['REPLY_NOT_SENT_LOG'])
    expect(codeOf(EMAILS)).toContain('subject: `An answer to your message to ${clubName}`')
  })

  it('says who may reply, in the order and words the endpoint holds', () => {
    const who = bullet(block, '- **Who may reply.**')
    for (const name of ['REPLY_CLOSED', 'REPLY_NOT_YOURS', 'REPLY_LINK_REFUSED', 'REPLY_CLUB_GONE']) expect(who, name).toContain(`"${wordsOf(ENDPOINT, name)}"`)
    for (const piece of ['`isRegionalRepFor`', '`canManageClub`', 'no second factor', '`requireAdmin`', 'a guest who holds the seat', 'another region\'s representative']) expect(who, piece).toContain(piece)
    const code = codeOf(ENDPOINT)
    const order = ['if (!CLUB_PAGES_ON)', 'requireUser(', 'getMemberById(', "member.role === 'guest'", 'openReplyLink(', 'isRegionalRepFor(', 'FROM clubs WHERE id = ?']
    const opened = code.slice(code.indexOf('async function opened'))
    const at = order.slice(1).map((piece) => opened.indexOf(piece))
    expect(at.every((i) => i > 0), JSON.stringify(at)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(code).not.toMatch(/requireAuthedMember|requireAdmin|upsertMemberFromAuth/)
  })

  it('says what is stored and counted, and the files hold it', () => {
    const stored = bullet(block, '- **Nothing stored.**')
    for (const piece of ['ten replies an hour', '`REPLIES_AN_HOUR`', '`clubs/reply`', `"${wordsOf(ENDPOINT, 'REPLY_BUSY')}"`, 'The GET is not counted', 'only `rate_limits` grows', 'used again within its 30 days']) {
      expect(stored, piece).toContain(piece)
    }
    const code = codeOf(ENDPOINT)
    expect(code).toMatch(/REPLIES_AN_HOUR = 10\b/)
    expect(code).toContain('limit(env, request, REPLY_LIMIT_ROUTE, { perHour: REPLIES_AN_HOUR, key: link.member.id })')
    expect(code.indexOf('parseBody(request, clubReplyRequestSchema)')).toBeLessThan(code.indexOf('limit(env, request, REPLY_LIMIT_ROUTE'))
    for (const file of [ENDPOINT, LINK]) expect(codeOf(file), file).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE)\b\s+(INTO|\w+)/i)
    expect(codeOf(LINK)).not.toMatch(/console\./)
  })

  it('says how the reply is signed, by K\'s decision 12, as a deviation and a choice for K, and what the page draws', () => {
    const signOff = bullet(block, '- **The sign-off.**')
    for (const piece of ['K\'s decision 12 of Tuesday, November 17, 2026', '"{first name}, LCA {region} representative"', '"LCA {region} representative"', '"Louisiana Chess Association"', 'a choice for K']) {
      expect(signOff, piece).toContain(piece)
    }
    expect(codeOf(EMAILS)).toContain('`LCA ${oneLine(by.region)} representative` : \'Louisiana Chess Association\'')
    const page = bullet(block, '- **The page.**')
    for (const piece of ['"Log in first to answer this message."', '"Your reply"', '"Send reply"', '"Sending…"', '"Sent to {first name}. Their address was never shown to you."', '`bringClearOfBars`', 'opens by itself once', '`/clubs/reply/*`', '`Cache-Control: no-store`']) {
      expect(page, piece).toContain(piece)
    }
    expect(read(PAGE)).toContain('export const LOG_IN_FIRST = \'Log in first to answer this message.\'')
    expect(read(RULES)).toContain('`Sent to ${firstName}. Their address was never shown to you.`')
  })

  it('says what the address and the written club page answer for the word reply', () => {
    const address = bullet(block, '- **The address.**')
    for (const piece of ['`RESERVED_SLUGS`', '`domain/clubs/slug.ts`', '`functions/clubs/[id].ts`', '`/clubs/reply`', 'with `CLUB_PAGES_ON` set', 'unset']) expect(address, piece).toContain(piece)
    expect(read('domain/clubs/slug.ts')).toMatch(/RESERVED_SLUGS[^\n]*'reply'/)
  })

  it('gives the branch, the merge, what ships with every switch off and what is owed, with the figures the tree holds', () => {
    expect(bullet(block, '- **The branch.**')).toContain('`redesign/ws09-clubs-x`, at `655bd3d`, "WS09 step 26: the contact relay (checkpoint X)"')
    expect(bullet(block, '- **The branch.**')).toContain('this branch does not hold `main`\'s later changes')
    const merge = bullet(block, '- **What the merge does.**')
    for (const piece of ['107 handler files', '44 of the 148 methods', '`PENDING_COUNT` still 104', '`deploy-worker.yml`']) expect(merge, piece).toContain(piece)
    expect(read('test/unit/routes.test.ts')).toMatch(/expect\(real\.filter\(\(r\) => r\.startsWith\('api\/'\)\)\.length\)\.toBe\(10[7-9]\)/)
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 104')
    expect(Object.keys(contracts['clubs/reply/[token]'])).toEqual(['GET', 'POST'])
    expect(PENDING_CONTRACTS.some((p) => String(p).includes('clubs/reply'))).toBe(false)
    if (latest) expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(44)
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of [`"${wordsOf(ENDPOINT, 'REPLY_CLOSED')}"`, 'The relay cannot run', 'The route is not drawn', 'No switch is added']) expect(ships, piece).toContain(piece)
    const owed = bullet(block, '- **Owed before newClubs goes on.**')
    expect(owed).toContain('Step 26\'s twenty, with the one this step settles taken away')
    expect(owed).toContain('the switch may now go on')
    expect(owed).not.toContain('does not go on before WS09 step 27 is in:')
    expect(owed.split('\n').filter((l) => l.startsWith('  - '))).toHaveLength(22)
    for (const piece of ['the sign-off', 'Q36', 'LCA\'s own mailbox', 'second factor']) expect(owed, piece).toContain(piece)
  })

  it('names each moved pin by its file', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('no earlier test file changes its count of cases')
    expect(pins).toContain('The file keeps its 19 cases.')
    expect(read('test/integration/club-contact-relay.test.ts').match(/^\s*it\(/gm)).toHaveLength(19)
    for (const file of ['test/unit/redesign-status-step27.test.ts', 'test/unit/club-routing-server-only.test.ts', 'test/unit/club-confirm-page.test.tsx']) expect(pins, file).toContain(`Not moved: ${file === 'test/unit/redesign-status-step27.test.ts' ? 'WS01\'s ' : ''}\`${file}\``)
  })

  it('gives the lint as the base\'s, the build\'s figures with why each moved, and the worker\'s dry run', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `655bd3d`')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-C3pRj36A.js` is 560,485 bytes', '`index-BgrU4uSO.js` at 559,867', '`index-DkWjPWKo.css` is 138,507 bytes', '`index-DA8K2gB9.css` at 138,460',
      '`features-nZCZoT6G.js` stays at 729 bytes', '`ClubReplyPage-', '7,723 bytes', '`clubPage-', '4,068 bytes', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
    // Read the build where one is at hand: while this step is the latest, the page is a chunk of its own and the main script does not hold its words.
    if (!latest || !existsSync(join(ROOT, 'dist/assets'))) return
    const built = readdirSync(join(ROOT, 'dist/assets')).filter((f) => /\.js$/.test(f))
    expect(built.filter((f) => f.startsWith('ClubReplyPage-'))).toHaveLength(1)
    const main = built.find((f) => /^index-[\w-]+\.js$/.test(f))
    if (main) expect(read(`dist/assets/${main}`)).not.toContain('Their address was never shown to you')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 27: the Checks line', () => {
  it('gives each figure once, and no browser run of its own', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `655bd3d`\'s tree')
  })

  it('gives unit and integration counts that add up: the base\'s, the files grown and the new files\'', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    expect([num(unit![3]), Number(unit![4])]).toEqual([11375, 502])
    const newUnit = NEW_TESTS.filter((f) => f.startsWith('test/unit/'))
    // Four cases grow in three files that draw their cases from the tree, by Grown with no change.
    expect(num(unit![3]) + 4 + newUnit.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(unit![1]))
    expect(Number(unit![2]) - Number(unit![4])).toBe(newUnit.length)
    // The integration figures count the tests that run, as the gate gives them; the one todo stands beside them.
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing, with the one todo beside them/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    expect([num(integration![3]), Number(integration![4])]).toEqual([3052, 180])
    const newIntegration = NEW_TESTS.filter((f) => f.startsWith('test/integration/'))
    expect(num(integration![3]) + newIntegration.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(integration![1]))
    expect(Number(integration![2]) - Number(integration![4])).toBe(newIntegration.length)
  })

  it('gives the lint files as the base\'s with the new code and test files, and the build\'s file counts', () => {
    const lint = /`npm run lint` 13 errors and 11 warnings over ([\d,]+) files \(([\d,]+) on the base\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1287)
    const linted = [...NEW_FILES, ...NEW_TESTS].filter((f) => /\.tsx?$/.test(f))
    expect(num(lint![1]) - num(lint![2])).toBe(linted.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[2]).toBe('214')
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 27: the map and the lists', () => {
  it('adds one sentence to criterion 8, before its planned step, and to no other item', () => {
    const item = mapItem('Criterion 8')
    expect(item.split('Built in WS09 step 27: ')).toHaveLength(2)
    expect(item.indexOf('Built in WS09 step 27: ')).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
    expect(item.slice(item.indexOf('Built in WS09 step 27: '))).toContain('`test/integration/club-reply.test.ts`')
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 27:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 8'])
  })

  it('records the step\'s deviations, verify items and follow-ups, each tagged, and adds no decision', () => {
    expect(tagged(part(LISTS[0]))).toEqual([])
    expect(tagged(deviations).map(head)).toEqual([
      'The sign-off by the role alone (WS09 step 27).', 'The reply\'s cases in a file of their own (WS09 step 27).', 'One set of words for a refused link (WS09 step 27).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'The sealed kind (WS09 step 27).', 'From and reply-to (WS09 step 27).', 'Q36 (WS09 step 27).', 'The word reply (WS09 step 27).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed (?:on `655bd3d`|in the brief)/)
    expect(tagged(followUps).map(head)).toEqual([
      'An answer to a reply (WS09 step 27).', 'A link used again (WS09 step 27).', 'A long link in a plain part (WS09 step 27).', 'The admin\'s second factor (WS09 step 27).',
      'The sign-in ending before the press (WS09 step 27).', 'An address typed as the name (WS09 step 27).',
    ])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 27: plain language', () => {
  const item = mapItem('Criterion 8')
  const sentence = item.slice(item.indexOf('Built in WS09 step 27: '), item.search(/ Planned: WS09 step \d+\.$/))
  const written = [block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps), sentence, statusLine].join('\n')

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
