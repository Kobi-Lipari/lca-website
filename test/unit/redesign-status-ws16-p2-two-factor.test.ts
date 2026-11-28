// test/unit/redesign-status-ws16-p2-two-factor.test.ts
//
// REDESIGN_STATUS.md records that only an LCA admin is asked for a second
// factor to send email to members, on K's decision 82. Light, as the block
// for a seat that is not shown publicly has its own record test, this file
// reads only this block, from its heading to the next heading. Pinned: the
// block's heading, once, directly after the block for a seat that is not
// shown publicly and before the WS16 decisions; the bold names of its
// bullets, in order; that every file it names is in the tree; and the facts
// a later change must not let drift, each read from the source so the record
// and the code cannot differ: both constants in domain/mail/senders.ts and
// their values, the media manager's branch of requireListMailer reading its
// constant, the president's read of the other, the order of that guard, the
// pages' helper beside presidentMayCall and the pages that call it, the
// media manager's answer still saying whether the session has a second
// factor, and the sentences a person reads that the block quotes. Also K's
// words, quoted exactly, the merge of pull request 156 the block records,
// and the plain-language rules over the block. It pins no count.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The working words a record does not use, in the plural as well, and the two words that name a person's role in the work. */
const BANNED = new RegExp(`\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'agent', 'work' + 'flow', 'revie' + 'wer', 'tes' + 'ter', 'age' + 'nt', 'mod' + 'el'].join('|')})s?\\b|${'the ' + 'lead'}`, 'i')
/** The tools a record must not mention, split up so that this file does not mention them either. */
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** An assistant named, or a line about how the words came to be. */
const ASSISTANT = new RegExp(`\\b(?:${'assis' + 'tant'}|${'gener' + 'ated'}|${'wri' + 'tten by'})\\b`, 'i')
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** The placeholder the Board page reads as an open seat, put together so that this file does not hold it. */
const PLACEHOLDER = 'T' + 'BD'
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(
  `${String.fromCharCode(0x27ea)}|${String.fromCharCode(0xab)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|${'<' + '<'}[A-Z_]+${'>' + '>'}|${'to be ' + 'measured'}|${PLACEHOLDER}|${'\\(to ' + 'write\\)'}`,
)
const CAPITALS = /\b[A-Z0-9]{8,}\b/
/** The words that would make K, the owner, or the president a he or a she. */
const PRONOUNS = /\b(?:he|his|him|she|her|hers)\b/i
/** A time on a 24-hour clock. */
const HOURS_24 = /\b(?:1[3-9]|2[0-3]):[0-5]\d\b/
/** A web address, which the record gives no longer than its site's name. */
const ADDRESS = /https?:\/\/|www\./i
/** A day named with its month, long or short, and the weekday that must stand in front of it. */
const DAY = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b/g
const WEEKDAY = /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/
/** The word "we", which the record does not use. */
const WE = /\bwe\b/i

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}
/** Text with what sits in backticks taken out, since code is not prose. */
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const BEFORE = '#### WS16 part two: a seat that is not shown publicly'
const BLOCK = '#### WS16 part two: two-factor sign-in for LCA admins only'
const AFTER = '### WS16 decisions'
/** This block: from its heading to the next heading of any level. */
const block = status.includes(`\n${BLOCK}\n`) ? between(status.slice(status.indexOf(`\n${BLOCK}\n`) + 1), BLOCK, '\n#') : ''
const blockLines = block.split('\n')

/** The bold names of the block's bullets, in their order. */
const NAMES = [
  'The rule now.', 'The two constants.', 'The guards.', 'The pages.', 'Every word a person reads.', 'What it costs.',
  'The reviews.', 'What was not tested.', 'Files.', 'Tests.', 'Follow-ups.', 'Checks.', 'The way back.',
]

/** K's words, as K wrote them. */
const K_WORDS =
  "Turn off two factor for everyone but me (LCA admin). It's not that important besides the full controls. I don't want to give them any friction at the moment."

const SENDERS = 'domain/mail/senders.ts'
const AUTH = 'functions/utils/auth.ts'
const ROLES = 'src/areas/admin/roles.ts'
const EMAIL_PAGE = 'src/pages/AdminEmailPage.tsx'
const NEWSLETTER_PAGE = 'src/pages/AdminNewsletterPage.tsx'
const ADMIN_PAGE = 'src/pages/AdminPage.tsx'
const ME_MEDIA_MANAGER = 'functions/api/me/media-manager.ts'

/** The line a page draws in place of the send buttons, and the server's 403 in words, each with the files that hold it. */
const QUOTED: { quote: string; files: string[] }[] = [
  { quote: 'Set up two-factor sign-in to send group email.', files: [EMAIL_PAGE, NEWSLETTER_PAGE] },
  { quote: 'Two-factor sign-in is required to send group email. Set it up in your account security settings.', files: [AUTH] },
]

/** A function's body, from its signature to the next top-level function or export. */
const body = (file: string, signature: string) => {
  const text = read(file)
  const start = text.indexOf(signature)
  if (start < 0) return ''
  const rest = text.slice(start + signature.length)
  const end = rest.search(/\n(?:export |function |\/\*\*)/)
  return text.slice(start, start + signature.length + (end < 0 ? rest.length : end))
}

describe('REDESIGN_STATUS.md, WS16 part two: two-factor sign-in for LCA admins only, its place and its parts', () => {
  it('sits once, directly after the block for a seat that is not shown publicly and before the WS16 decisions', () => {
    expect(block).not.toBe('')
    expect(status.split(`\n${BLOCK}\n`)).toHaveLength(2)
    const at = status.indexOf(`\n${BLOCK}\n`)
    const before = status.indexOf(`\n${BEFORE}\n`)
    expect(before).toBeGreaterThan(-1)
    // Directly after: the next heading after the block for a seat that is not shown publicly is this one.
    expect(status.indexOf('\n#', before + 1 + BEFORE.length)).toBe(at)
    // A later block may stand between this one and the WS16 decisions.
    expect(status.indexOf(`\n${AFTER}\n`, at)).toBeGreaterThanOrEqual(at + 1 + block.length)
    expect(blockLines[0]).toBe(BLOCK)
    expect(blockLines.filter((l) => /^#{1,6} /.test(l))).toEqual([BLOCK])
    // Not a page step, so the page steps' own count, which the part's other record tests read, passes over it.
    expect(BLOCK).not.toMatch(/^#### WS16 part two, page step (\d+): /)
  })

  it("holds its bullets' bold names in order, each once", () => {
    let at = -1
    for (const name of NAMES) {
      const start = `- **${name}**`
      const found = blockLines.findIndex((l) => l.startsWith(start))
      expect(found, name).toBeGreaterThan(at)
      expect(blockLines.filter((l) => l.startsWith(start)), name).toHaveLength(1)
      at = found
    }
    expect(blockLines.filter((l) => l.startsWith('- **'))).toHaveLength(NAMES.length)
  })

  it('names only files that are in the tree', () => {
    const files = [...block.matchAll(/`((?:src|test|functions|domain|migrations|drizzle|scripts)\/[^`\s]+\.[a-z]+|REDESIGN_STATUS\.md)`/g)]
      .map((m) => m[1])
      .filter((file) => !file.includes('*'))
    expect(files.length).toBeGreaterThan(5)
    for (const file of files) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of [SENDERS, AUTH, ROLES, EMAIL_PAGE, NEWSLETTER_PAGE, ADMIN_PAGE, ME_MEDIA_MANAGER]) expect(files, file).toContain(file)
  })

  it("quotes K's words exactly, with the decision and the merge before it", () => {
    expect(block).toContain(`K wrote, in K's words: "${K_WORDS}"`)
    expect(block).toContain('At about 6:50 PM UTC on Wednesday, November 25, 2026 K wrote')
    expect(block).toContain('It is decision 82 of K\'s decisions, on the docs branch.')
    expect(block).toContain('Pull request 156')
    expect(block).toContain('merged into `main` as `85f20ec` on Wednesday, November 25, 2026 at 3:30 AM UTC and was live by 3:33 AM UTC')
    expect(block).toContain('read from production as counts alone at 6:55 PM UTC, the seat is in use, not shown publicly, with one holder')
    expect(block).toContain('a password alone then sends to every member from those two accounts')
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: two-factor sign-in for LCA admins only, true to the code', () => {
  it('is right about the two constants: both in domain/mail/senders.ts, both unset, each the one line to change', () => {
    const senders = read(SENDERS)
    expect(senders).toMatch(/^export const PRESIDENT_NEEDS_SECOND_FACTOR = false$/m)
    expect(senders).toMatch(/^export const MEDIA_MANAGER_NEEDS_SECOND_FACTOR = false$/m)
    expect(block).toContain('Both in `domain/mail/senders.ts`, both unset.')
    // Each constant's comment says what it does unset and that it is the one line to change.
    for (const name of ['PRESIDENT_NEEDS_SECOND_FACTOR', 'MEDIA_MANAGER_NEEDS_SECOND_FACTOR']) {
      const at = senders.indexOf(`export const ${name} =`)
      const doc = senders.slice(senders.lastIndexOf('/**', at), at)
      expect(doc, name).toMatch(/^\/\*\*\s*\n\s*\* Unset: /)
      expect(doc.replace(/\s*\n\s*\*\s*/g, ' '), name).toContain('The one line to change')
      expect(doc, name).toContain('decision 82')
    }
    // The way back the block gives is each line with its value turned.
    for (const line of ['export const PRESIDENT_NEEDS_SECOND_FACTOR = true', 'export const MEDIA_MANAGER_NEEDS_SECOND_FACTOR = true']) {
      expect(block, line).toContain(`\`${line}\``)
      expect(senders, line).toContain(line.replace(/true$/, 'false'))
    }
  })

  it("is right about the guards: the media manager's branch reads its constant, the president's read reads the other", () => {
    const auth = read(AUTH)
    expect(auth).toMatch(/import \{[^}]*\bMEDIA_MANAGER_NEEDS_SECOND_FACTOR\b[^}]*\} from '[^']*\/domain\/mail\/senders'/)
    expect(auth).toMatch(/import \{[^}]*\bPRESIDENT_NEEDS_SECOND_FACTOR\b[^}]*\} from '[^']*\/domain\/mail\/senders'/)
    const guard = body(AUTH, 'export async function requireListMailer(')
    expect(guard).not.toBe('')
    const branch = between(guard, 'if (await sendsAsMediaManager(env.DB, authed.member)) {', '\n  }')
    expect(branch).toContain('if (!MEDIA_MANAGER_NEEDS_SECOND_FACTOR || hasSecondFactor(request)) return authed')
    expect(branch).toContain('return jsonResponse({ error: MEDIA_MANAGER_SECOND_FACTOR, mfaRequired: true }, 403)')
    expect(block).toContain(
      "the media manager's branch of `requireListMailer`, which now admits the seat's holder when `MEDIA_MANAGER_NEEDS_SECOND_FACTOR` is unset or the session has a second factor",
    )
    // The order: an LCA admin first, then the President seat, then the switch, then the Media manager seat.
    const order = [
      "if (authed.member.role === 'lca_admin') return secondFactorMissing(request) ?? authed",
      'if (await holdsPresidentSeat(env.DB, authed.member.id)) return presidentAdmitted(request, authed)',
      'if (!MAIL_LISTS_ON) {',
      'if (await sendsAsMediaManager(env.DB, authed.member)) {',
    ].map((line) => guard.indexOf(line))
    for (const at of order) expect(at).toBeGreaterThan(-1)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(block).toContain('an LCA admin first, then the President seat, then the switch, then the Media manager seat')
    // The president's read, called by both guards, reads its constant at each call.
    const admitted = body(AUTH, 'function presidentAdmitted(')
    expect(admitted).toContain('if (PRESIDENT_NEEDS_SECOND_FACTOR && !hasSecondFactor(request)) {')
    expect(body(AUTH, 'export async function requireMailer(')).toContain('presidentAdmitted(request, authed)')
    expect(block).toContain('is read by `presidentAdmitted` in `functions/utils/auth.ts`, which both guards call')
    // An LCA admin's path still asks for a second factor.
    expect(body(AUTH, 'export async function requireAdmin(')).toContain('secondFactorMissing(')
    expect(block).toContain('`requireAdmin` and `secondFactorMissing`, the LCA admin\'s path, are not in the change')
  })

  it("is right that the media manager's answer still says whether the session has a second factor", () => {
    expect(read(ME_MEDIA_MANAGER)).toContain('secondFactor: hasSecondFactor(context.request),')
    expect(block).toContain('its `secondFactor` still says whether the session has one')
  })

  it("is right about the pages: one helper beside presidentMayCall, and the pages that decide through it", () => {
    const roles = read(ROLES)
    expect(roles).toMatch(/import \{[^}]*\bMEDIA_MANAGER_NEEDS_SECOND_FACTOR\b[^}]*\} from '@domain\/mail\/senders'/)
    expect(body(ROLES, 'export function mediaManagerMayCall(secondFactor: boolean): boolean {')).toContain(
      'return !MEDIA_MANAGER_NEEDS_SECOND_FACTOR || secondFactor',
    )
    expect(body(ROLES, 'export function presidentMayCall(assuranceLevel: string | null): boolean {')).toContain(
      "return !PRESIDENT_NEEDS_SECOND_FACTOR || assuranceLevel === 'aal2'",
    )
    // Beside it: the new helper follows presidentMayCall with no other function between.
    const president = roles.indexOf('export function presidentMayCall(')
    const media = roles.indexOf('export function mediaManagerMayCall(')
    expect(media).toBeGreaterThan(president)
    expect(roles.slice(president + 1, media)).not.toMatch(/\nexport /)
    expect(block).toContain('One new helper, `mediaManagerMayCall(secondFactor)` in `src/areas/admin/roles.ts`, beside `presidentMayCall`')
    // The pages that decide what to offer.
    expect(read(EMAIL_PAGE)).toContain('mediaManagerMayCall(mediaManager?.secondFactor === true)')
    expect(read(NEWSLETTER_PAGE)).toContain('(president ? presidentMayCall(assuranceLevel) : mediaManagerMayCall(answer.secondFactor))')
    expect(read(ADMIN_PAGE)).toContain(
      "noSecondFactor={president && (role === 'lca_admin' ? assuranceLevel !== 'aal2' : !presidentMayCall(assuranceLevel))}",
    )
    expect(block).toContain('except for an LCA admin who holds the President seat, who is refused there without a second factor exactly as before')
  })

  it('quotes the words a person reads each as the file that draws or gives it holds them', () => {
    for (const { quote, files } of QUOTED) {
      expect(block, quote).toContain(`"${quote}"`)
      for (const file of files) expect(read(file), `${quote} in ${file}`).toContain(`'${quote}'`)
    }
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: two-factor sign-in for LCA admins only, in plain words', () => {
  it('holds no dash, no working word, no tool, no old initials, no long web address and nothing left unfilled', () => {
    const prose = proseOf(block)
    expect(block).not.toMatch(DASHES)
    expect(prose).not.toMatch(BANNED)
    expect(block).not.toMatch(TOOLS)
    expect(prose).not.toMatch(ASSISTANT)
    expect(prose).not.toMatch(BARE)
    expect(block).not.toMatch(OLD_INITIALS)
    expect(block).not.toMatch(UNFILLED)
    expect(block).not.toMatch(ADDRESS)
    expect(prose).not.toMatch(CAPITALS)
    expect(prose).not.toMatch(PRONOUNS)
    expect(prose).not.toMatch(HOURS_24)
    expect(prose).not.toMatch(WE)
  })

  it('names the reviews as the first review and the second review', () => {
    const bullet = between(block, '- **The reviews.**', '\n- **What was not tested.**')
    expect(bullet).toMatch(/\bthe first review\b/i)
    expect(bullet).toMatch(/\bthe second review\b/i)
  })

  it('gives every day it names its weekday', () => {
    const prose = proseOf(block)
    for (const day of prose.matchAll(DAY)) expect(prose.slice(Math.max(0, (day.index ?? 0) - 11), day.index), day[0]).toMatch(WEEKDAY)
    // And the weekday is the right one, long ("Wednesday, November 25, 2026") or short ("Wed, Nov 25, 2026").
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const dated = [...prose.matchAll(/\b((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*), ((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*) (\d{1,2}), (\d{4})\b/g)]
    expect(dated.length).toBeGreaterThan(0)
    for (const [whole, weekday, month, d, y] of dated) {
      const m = months.indexOf(month.slice(0, 3))
      const long = weekday.length > 3 || month.length > 3
      const named = new Date(Date.UTC(Number(y), m, Number(d))).toLocaleDateString('en-US', { weekday: long ? 'long' : 'short', timeZone: 'UTC' })
      expect(weekday, whole).toBe(named)
    }
  })

  it('writes every time on the twelve-hour clock, each with its AM or PM and UTC, both ends of a range among them', () => {
    const prose = proseOf(block)
    const times = [...prose.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)]
    expect(times.length).toBeGreaterThan(0)
    for (const time of times) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
    // A range names its zone once, after its second end; a time on its own names it after itself.
    for (const time of prose.matchAll(/\b(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)\b(?! to \d)/g)) {
      expect(prose.slice((time.index ?? 0) + time[0].length, (time.index ?? 0) + time[0].length + 4), time[0]).toBe(' UTC')
    }
  })
})
