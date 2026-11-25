// test/unit/redesign-status-ws16-p2-senders.test.ts
//
// REDESIGN_STATUS.md records who may send email to members, on K's decision
// 79. Light, as the saved templates block's record test is, this file reads
// only this block, from its heading to the next heading. Pinned: the block's
// heading, once, directly after the saved templates block and before the WS16
// decisions; the bold names of its bullets, in order; that every file it
// names is in the tree; and the facts a later change must not let drift, each
// read from the source so the record and the code cannot differ: the
// constant for the president's second factor and its value, the words of
// LIST_MAILERS_ONLY and where they are written, that both guards call the
// president's read, that the president's file imports nothing, that the mail
// guards and the creation rules do not import each other, the two new
// sentences N1 and N2 as the page holds them, the pages reading the same
// constant, no migration added, and the words on the page the block quotes.
// Also K's words, quoted exactly, and the plain-language rules over the
// block. It pins no count and no figure.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(
  `${String.fromCharCode(0x27ea)}|${String.fromCharCode(0xab)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|${'<' + '<'}[A-Z_]+${'>' + '>'}|${'to be ' + 'measured'}|${'T' + 'BD'}|${'\\(to ' + 'write\\)'}`,
)
const CAPITALS = /\b[A-Z0-9]{8,}\b/
/** The words that would make K, the owner, a he. */
const HE = /\b(?:he|his|him)\b/i
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

const BEFORE = "#### WS16 part two: saved templates and the tutorial's first card"
const BLOCK = '#### WS16 part two: who may send'
const AFTER = '### WS16 decisions'
/** This block: from its heading to the next heading of any level. */
const block = status.includes(`\n${BLOCK}\n`) ? between(status.slice(status.indexOf(`\n${BLOCK}\n`) + 1), BLOCK, '\n#') : ''
const blockLines = block.split('\n')

/** The bold names of the block's bullets, in their order. */
const NAMES = [
  'The rule.', 'The two guards.', "The president's read.", 'The pages.', 'Every word added or changed, for K.', 'What an observer keeps.',
  'The reviews.', 'What was not tested.', 'Files.', 'Tests.', 'Follow-ups.', 'Checks.',
]

/** K's answer as K typed it, Tuesday, November 24, 2026, and the words of the choice it picked. */
const K_WORDS = ['2 b.', 'only LCA admins, the media manager and one account you name may send; other observers may not.']

const SENDERS = 'domain/mail/senders.ts'
const AUTH = 'functions/utils/auth.ts'
const SEAT = 'functions/utils/admin/presidentSeat.ts'
const CREATION = 'functions/utils/events/creation.ts'
const ROLES = 'src/areas/admin/roles.ts'
const ADMIN = 'src/pages/AdminPage.tsx'
const EMAIL = 'src/pages/AdminEmailPage.tsx'
const NEWSLETTER = 'src/pages/AdminNewsletterPage.tsx'

/** The latest migration: `0072` on main at `992b145`, which this change was built on and adds none to; the seat listing's `0073` came after. */
const LATEST_MIGRATION = '0073'

/** A string a source file exports by name, read from its `export const NAME = '...'`. */
const exportedWords = (file: string, name: string) => new RegExp(`export const ${name} = '((?:[^'\\\\\\n]|\\\\.)*)'`).exec(read(file))?.[1] ?? ''

/** A guard's body in functions/utils/auth.ts, from its signature to the next export. */
const guard = (name: string) => between(read(AUTH), `export async function ${name}(`, '\nexport ')

/** N1, for an LCA Observer without the President seat, and N2, for an LCA Officer who holds it, as the block quotes them. */
const N1 = 'See everything across the LCA. You can email entrants, answer support tickets and manage the bylaws and minutes; other changes are made by admins.'
const N2 = 'See everything across the LCA. You can send group email, answer support tickets and manage the bylaws and minutes; other changes are made by admins.'

/** The words the block quotes, in double quotes, each with the file that draws or gives it. */
const QUOTED: { quote: string; files: string[] }[] = [
  { quote: 'Set up two-factor sign-in to send group email.', files: [EMAIL, NEWSLETTER] },
  { quote: 'Two-factor sign-in is required to send group email. Set it up in your account security settings.', files: [AUTH] },
  { quote: 'Failed to load members', files: [EMAIL] },
  { quote: 'No members match', files: [EMAIL] },
  { quote: 'View only, except the newsletter', files: [ADMIN] },
  { quote: 'Group email', files: [ADMIN] },
  { quote: 'Newsletter', files: [NEWSLETTER] },
  {
    quote: 'See everything across the LCA. You can send group email, email entrants, answer support tickets and manage the bylaws and minutes; other changes are made by admins.',
    files: [ADMIN],
  },
]

/** Every source file under a folder, for the words no code sends now. */
const sourcesUnder = (dir: string) =>
  (readdirSync(join(ROOT, dir), { recursive: true }) as string[]).filter((file) => /\.(?:ts|tsx)$/.test(file)).map((file) => join(dir, file))

describe('REDESIGN_STATUS.md, WS16 part two: who may send, its place and its parts', () => {
  it('sits once, directly after the saved templates block and before the WS16 decisions', () => {
    expect(block).not.toBe('')
    expect(status.split(`\n${BLOCK}\n`)).toHaveLength(2)
    const at = status.indexOf(`\n${BLOCK}\n`)
    const before = status.indexOf(`\n${BEFORE}\n`)
    expect(before).toBeGreaterThan(-1)
    // Directly after: the next heading after the saved templates block's own is this one.
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

  it('names only files that are in the tree, this test among them', () => {
    const files = [...block.matchAll(/`((?:src|test|functions|domain)\/[^`\s]+\.[a-z]+|REDESIGN_STATUS\.md)`/g)].map((m) => m[1]).filter((file) => !file.includes('*'))
    expect(files.length).toBeGreaterThan(5)
    for (const file of files) expect(existsSync(join(ROOT, file)), file).toBe(true)
    expect(files).toContain('test/unit/redesign-status-ws16-p2-senders.test.ts')
  })

  it("quotes K's words exactly", () => {
    for (const words of K_WORDS) expect(block, words).toContain(`"${words}"`)
    expect(block).toContain(`K answered, in K's words: "${K_WORDS[0]}" Choice 2 (b) read: "${K_WORDS[1]}"`)
    expect(block).toContain('decision 79')
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: who may send, true to the code', () => {
  it("is right about the president's second factor: one constant, set, in domain/mail/senders.ts", () => {
    expect(read(SENDERS)).toMatch(/^export const PRESIDENT_NEEDS_SECOND_FACTOR = true$/m)
    expect(block).toContain(`while \`PRESIDENT_NEEDS_SECOND_FACTOR\` in \`${SENDERS}\` is set, as it is`)
    // The guards and the pages read the same constant, so both answer the same.
    expect(read(AUTH)).toMatch(/import \{[^}]*\bPRESIDENT_NEEDS_SECOND_FACTOR\b[^}]*\} from '[^']*\/domain\/mail\/senders'/)
    expect(read(ROLES)).toMatch(/import \{[^}]*\bPRESIDENT_NEEDS_SECOND_FACTOR\b[^}]*\} from '@domain\/mail\/senders'/)
    expect(block).toContain(`\`presidentMayCall\` in \`${ROLES}\`, the second reading the same constant from \`${SENDERS}\``)
    expect(read(ROLES)).toMatch(/export function presidentMayCall\(/)
  })

  it("is right about LIST_MAILERS_ONLY: its words, written once in domain/mail/senders.ts and given out again by auth.ts", () => {
    const words = exportedWords(SENDERS, 'LIST_MAILERS_ONLY')
    expect(words).toBe('Group email is limited to LCA admins, the president and the media manager.')
    expect(block).toContain(`"${words}"`)
    const auth = read(AUTH)
    expect(auth).not.toMatch(/const LIST_MAILERS_ONLY\b/)
    expect(auth).toMatch(/import \{[^}]*\bLIST_MAILERS_ONLY\b[^}]*\} from '[^']*\/domain\/mail\/senders'/)
    expect(auth).toContain('export { LIST_MAILERS_ONLY }')
    expect(block).toContain(`it moved word for word to \`${SENDERS}\`, and \`${AUTH}\` gives it out again from there`)
    // The old 403's words, which the block says no code sends now.
    const old = 'Group email is limited to admins and the LCA Observer'
    expect(block).toContain(`"${old}"`)
    for (const file of [...sourcesUnder('functions'), ...sourcesUnder('src'), ...sourcesUnder('domain')]) expect(read(file), file).not.toContain(old)
  })

  it("is right that both guards keep their names and call the president's read", () => {
    for (const name of ['requireMailer', 'requireListMailer']) {
      const body = guard(name)
      expect(body, name).not.toBe('')
      expect(body, name).toContain('holdsPresidentSeat(env.DB, authed.member.id)')
      expect(body, name).toContain('LIST_MAILERS_ONLY')
      expect(block).toContain(`\`${name}\``)
    }
    expect(read(AUTH)).toMatch(/import \{ holdsPresidentSeat \} from '\.\/admin\/presidentSeat'/)
    expect(block).toContain(`\`requireMailer\` and \`requireListMailer\` in \`${AUTH}\` keep their names, parameters and return types`)
  })

  it("is right that the president's file imports nothing and the creation rules hand its read on", () => {
    const seat = read(SEAT)
    expect(seat).not.toMatch(/^\s*import\b/m)
    expect(seat).not.toMatch(/\brequire\(|\bimport\(/)
    expect(seat).toMatch(/^export async function holdsPresidentSeat\(db: D1Database, memberId: string\): Promise<boolean>/m)
    expect(seat).toContain("AND s.slug = 'president'")
    expect(block).toContain(`\`${SEAT}\`, which imports nothing`)
    const creation = read(CREATION)
    expect(creation).toMatch(/import \{ holdsPresidentSeat \} from '\.\.\/admin\/presidentSeat'/)
    expect(creation).toContain('export { holdsPresidentSeat }')
    expect(creation).not.toMatch(/function holdsPresidentSeat\(/)
    expect(block).toContain(`\`${CREATION}\` imports it and gives it out again`)
  })

  it('is right that auth.ts and the creation rules do not import each other', () => {
    expect(read(AUTH)).not.toMatch(/from '[^']*\/events\/creation'/)
    expect(read(CREATION)).not.toMatch(/from '[^']*\/auth'/)
    expect(block).toContain(`that file and \`${AUTH}\` still do not import each other`)
  })

  it('quotes N1 and N2 as Admin holds them', () => {
    const admin = read(ADMIN)
    for (const [label, words] of [['N1', N1], ['N2', N2]] as const) {
      expect(block, label).toContain(`${label}, for `)
      expect(block, label).toContain(`"${words}"`)
      expect(admin, label).toContain(`'${words}'`)
    }
    const bullet = blockLines.find((l) => l.startsWith('- **Every word added or changed, for K.**')) ?? ''
    expect(bullet).toContain(`N1, for an LCA Observer without the President seat: "${N1}"`)
    expect(bullet).toContain(`N2, for an LCA Officer who holds the President seat: "${N2}"`)
  })

  it('quotes the words on the page each as the file that draws or gives it holds them', () => {
    for (const { quote, files } of QUOTED) {
      expect(block, quote).toContain(`"${quote}"`)
      for (const file of files) expect(read(file), `${quote} in ${file}`).toContain(quote)
    }
  })

  it('is right that no migration was added', () => {
    expect(block).toContain('There is no migration')
    const numbered = readdirSync(join(ROOT, 'migrations')).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort()
    expect(numbered.length).toBeGreaterThan(0)
    expect(numbered[numbered.length - 1].slice(0, 4)).toBe(LATEST_MIGRATION)
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: who may send, in plain words', () => {
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
    expect(prose).not.toMatch(HE)
    expect(prose).not.toMatch(HOURS_24)
    expect(prose).not.toMatch(WE)
  })

  it('names the reviews as the first review and the second review', () => {
    const bullet = between(block, '- **The reviews.**', '\n- **What was not tested.**')
    expect(bullet).toContain('the first review')
    expect(bullet).toContain('The second review')
  })

  it('gives every day it names its weekday', () => {
    const prose = proseOf(block)
    for (const day of prose.matchAll(DAY)) expect(prose.slice(Math.max(0, (day.index ?? 0) - 11), day.index), day[0]).toMatch(WEEKDAY)
    // And the weekday is the right one, long ("Tuesday, November 24, 2026") or short ("Tue, Nov 24, 2026").
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

  it("writes every time on the twelve-hour clock, each with its AM or PM, both ends of a range among them", () => {
    const prose = proseOf(block)
    const times = [...prose.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)]
    expect(times.length).toBeGreaterThan(0)
    for (const time of times) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
  })
})
