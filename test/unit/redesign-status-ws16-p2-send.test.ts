// test/unit/redesign-status-ws16-p2-send.test.ts
//
// REDESIGN_STATUS.md records the real Send on the newsletter's own page,
// joined with "who may send" and switched on in the same change. Light, as the
// record test of "who may send" is, this file reads only this block, from its
// heading to the next heading. Pinned: the block's heading, once, directly
// after the block for a seat that is not shown publicly, which reached main
// first and stands directly after "who may send", and before the WS16
// decisions; the bold names of its
// bullets, in order; that every file it names is in the tree; and the facts a
// later change must not let drift, each read from the source so the record
// and the code cannot differ: both switch constants set, the list of WS16
// switches still off empty, the browser suite's shipped list naming the Send,
// the endpoint's file, its guard and the order of its first checks, the bar
// and Help given one value, Help's words with the Send on and off, the words
// on the page the block quotes, and the two sweeps of the media manager's
// reach naming the endpoint. Also K's words, quoted exactly, and the
// plain-language rules over the block. It pins no count and no figure.
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
/** The word "we", which the record does not use outside K's own quoted words. */
const WE = /\bwe\b/i

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}
/** Text with what sits in backticks taken out, since code is not prose. */
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
/** Prose with what sits in double quotes taken out, since a quote keeps its speaker's words. */
const ownWordsOf = (text: string) => proseOf(text).replace(/"[^"\n]*"/g, '""')

const BEFORE = '#### WS16 part two: a seat that is not shown publicly'
const BLOCK = "#### WS16 part two: the page's own Send"
const AFTER = '### WS16 decisions'
/** This block: from its heading to the next heading of any level. */
const block = status.includes(`\n${BLOCK}\n`) ? between(status.slice(status.indexOf(`\n${BLOCK}\n`) + 1), BLOCK, '\n#') : ''
const blockLines = block.split('\n')
/** One bullet of the block, by its bold name, to the next bullet at its own level. */
const bullet = (name: string) => between(block, `\n- **${name}**`, '\n- **')

/** The bold names of the block's bullets, in their order. */
const NAMES = [
  'What a person can do.', 'The switch pair.', 'The server.', 'The page.', 'Help.', 'Who may send it.', "The owner's choices, as built.",
  'Every word added or changed, for K.', 'The reviews.', 'The pictures.', 'What was not tested.', 'Files.', 'Tests.', 'Follow-ups.', 'Checks.', 'The way back.',
]

/** K's question as K wrote it, Tuesday, November 24, 2026, at about 3:20 PM UTC. */
const K_WORDS = 'I will get those keys connected in about an hour or so. But will we be able to have the newsletter stuff fully ready for them to use tomorrow?'

const SWITCHES = 'functions/utils/mail/switches.ts'
const FEATURES = 'src/lib/features.ts'
const FEATURES_TEST = 'test/unit/features.test.ts'
const BUILDS = 'test/a11y/builds.spec.ts'
const SEND = 'functions/api/admin/mail/newsletter/issue/send.ts'
const AUTH = 'functions/utils/auth.ts'
const LISTS = 'functions/utils/mail/lists.ts'
const CAMPAIGNS = 'functions/utils/admin/campaigns.ts'
const WORDS = 'domain/mail/newsletterWords.ts'
const PAGE = 'src/pages/AdminNewsletterPage.tsx'
const HELP = 'src/areas/admin/newsletter/HelpWalkthrough.tsx'
const QUESTION = 'src/areas/admin/newsletter/SendQuestion.tsx'
const HEAD = 'src/areas/admin/newsletter/NewsletterHead.tsx'
const USE_SEND = 'src/areas/admin/newsletter/useSend.ts'
const EMAIL = 'src/pages/AdminEmailPage.tsx'
const OFFICER = 'test/integration/media-manager-officer.test.ts'
const REACH = 'test/integration/media-manager-reach.test.ts'

/** Help's last card with the Send on, and its other sentence, kept for the state that still sends through Resend. */
const HELP_ON = 'Send a test to yourself first. Then send.'
const HELP_OFF = 'Sending to members from this page is not available yet.'

/** The words the block quotes, in double quotes, each with the file that draws or gives it. */
const QUOTED: { quote: string; files: string[] }[] = [
  { quote: 'goes to the LCA newsletter list. A sent newsletter cannot be taken back.', files: [QUESTION] },
  { quote: 'Not now', files: [QUESTION] },
  { quote: 'Stop the newsletter?', files: [QUESTION] },
  { quote: 'Stop sending', files: [QUESTION] },
  { quote: 'Keep sending', files: [PAGE] },
  { quote: 'Nothing was sent, since your words changed as it went. Press Send again.', files: [PAGE] },
  { quote: 'Your words are still being saved, so nothing was sent. Try again in a moment.', files: [PAGE] },
  { quote: 'The newsletter could not be sent. Try again in a moment.', files: [USE_SEND] },
  { quote: 'Nothing was sent: someone else has changed, replaced or sent this letter.', files: [WORDS] },
  { quote: 'This letter has no subject yet, so nothing was sent. Add a subject first.', files: [WORDS] },
  { quote: 'characters over what Gmail shows whole. Make the letter shorter, then send it.', files: [WORDS] },
  { quote: 'Start the next letter?', files: [HEAD] },
  { quote: 'The next letter takes the place of your words on this page. Copy anything of yours you want to keep first.', files: [HEAD] },
  { quote: 'Addresses not yet reached won\'t get it.', files: [EMAIL] },
  { quote: HELP_ON, files: [HELP] },
  { quote: HELP_OFF, files: [HELP] },
]

describe("REDESIGN_STATUS.md, WS16 part two: the page's own Send, its place and its parts", () => {
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

  it('names only files that are in the tree, this test among them', () => {
    const files = [...block.matchAll(/`((?:src|test|functions|domain|workers)\/[^`\s]+\.[a-z]+|REDESIGN_STATUS\.md)`/g)].map((m) => m[1]).filter((file) => !file.includes('*'))
    expect(files.length).toBeGreaterThan(5)
    for (const file of files) expect(existsSync(join(ROOT, file)), file).toBe(true)
    expect(files).toContain('test/unit/redesign-status-ws16-p2-send.test.ts')
    // The scheduled jobs worker it names by its folder.
    expect(block).toContain('`workers/daily-emails`')
    expect(existsSync(join(ROOT, 'workers/daily-emails'))).toBe(true)
  })

  it("quotes K's words exactly, with the day and the time they were written", () => {
    expect(block).toContain('Tuesday, November 24, 2026')
    expect(block).toContain(`at about 3:20 PM UTC, K wrote: "${K_WORDS}"`)
    expect(block).toContain("K's choice 1")
  })
})

describe("REDESIGN_STATUS.md, WS16 part two: the page's own Send, true to the code", () => {
  it('is right that both switch constants are set, the first only beside the page\'s own', () => {
    const switches = read(SWITCHES)
    expect(switches).toMatch(/^export const MAIL_PAGE_SEND_ON = true$/m)
    expect(switches).toMatch(/^export const MAIL_PAGE_ON = true$/m)
    expect(read(FEATURES)).toMatch(/^\s*mailPageSend: true,$/m)
    const pair = bullet('The switch pair.')
    expect(pair).toContain(`\`MAIL_PAGE_SEND_ON\` in \`${SWITCHES}\` and \`mailPageSend\` in \`${FEATURES}\`, both set to true in this change`)
    expect(pair).toContain('one line in each file')
    expect(bullet('The way back.')).toContain('back to false, one line in each file')
  })

  it("is right that the list of WS16 switches still off is empty and the browser suite's shipped list names the Send", () => {
    expect(read(FEATURES_TEST)).toMatch(/^const WS16 = \[\] as const$/m)
    expect(block).toContain(`\`${FEATURES_TEST}\`, `)
    expect(block).toContain('its list of switches still off for WS16 empty again')
    const shipped = /^const SHIPPED_ON = \[([^\]]*)\]$/m.exec(read(BUILDS))?.[1] ?? ''
    expect(shipped).toContain("'mailPageSend'")
    expect(block).toContain(`\`${BUILDS}\`, whose \`SHIPPED_ON\``)
    expect(block).toContain('gains `mailPageSend`')
  })

  it("is right about the endpoint: its file, its guard and the order of what it checks", () => {
    const send = read(SEND)
    expect(send).toMatch(/^export const onRequestPost: PagesFunction<Env> = /m)
    expect(send).toMatch(/import \{[^}]*\brequireListMailer\b[^}]*\} from '[^']*\/utils\/auth'/)
    const post = between(send, 'export const onRequestPost', '\nexport ')
    const order = [
      'if (!MAIL_PAGE_ON || !MAIL_PAGE_SEND_ON) return pageNotFound()',
      'await requireListMailer(context.request, context.env)',
      "if (senderNow() === 'resend') return errorResponse(WAITS_FOR_SES, 409)",
      'await createLetterCampaign(',
      'errorResponse(ALREADY_SENDING, 409)',
      'context.waitUntil(drainCampaign(context.env, ',
    ]
    let at = -1
    for (const step of order) {
      const found = post.indexOf(step)
      expect(found, step).toBeGreaterThan(at)
      at = found
    }
    const server = bullet('The server.')
    expect(server).toContain(`New: \`${SEND}\`, POST, in this order: the pair and \`MAIL_PAGE_ON\`, else "Not found"; \`requireListMailer\`;`)
    expect(server).toContain('`WAITS_FOR_SES` with 409 while it is Resend')
    expect(server).toContain('`drainCampaign` in `waitUntil`')
    expect(read(AUTH)).toMatch(/^export async function requireListMailer\(/m)
    expect(bullet('Who may send it.')).toContain('The Send is behind `requireListMailer`')
    expect(read(LISTS)).toMatch(/^export async function createLetterCampaign\(/m)
    expect(server).toContain(`\`createLetterCampaign\` in \`${LISTS}\``)
    expect(read(CAMPAIGNS)).toMatch(/^export function lookOf\(/m)
    expect(server).toContain(`\`lookOf\` in \`${CAMPAIGNS}\``)
  })

  it('is right that the refusals it names are the site\'s own words', () => {
    for (const name of ['WAITS_FOR_SES', 'ALREADY_SENDING', 'SEND_CHANGED']) {
      expect(read(WORDS), name).toMatch(new RegExp(`^export const ${name} = '`, 'm'))
      expect(block, name).toContain(`\`${name}\``)
    }
  })

  it('is right that the bar and Help are given one value, and quotes Help\'s words with the Send on and off', () => {
    const page = read(PAGE)
    expect(page).toContain("const barSends = send.state !== 'off' && send.state !== 'waits'")
    expect(page).toContain('sendReady={barSends} phoneSends={barSends}')
    const help = read(HELP)
    // Both branches stay in the source, each as a single-quoted literal.
    expect(help).toContain(`'${HELP_ON}'`)
    expect(help).toContain(`'${HELP_OFF}'`)
    const card = bullet('Help.')
    expect(card).toContain('`sendReady` and `phoneSends` are given one value, true whenever the bar offers Send')
    expect(card).toContain(`the card reads "${HELP_ON}"`)
    expect(card).toContain(`"${HELP_OFF}", stays in \`helpSteps\``)
    expect(help).toMatch(/function helpSteps\(/)
  })

  it('quotes the words on the page each as the file that draws or gives it holds them', () => {
    for (const { quote, files } of QUOTED) {
      expect(block, quote).toContain(`"${quote}"`)
      for (const file of files) expect(read(file), `${quote} in ${file}`).toContain(quote)
    }
    // The start line, quoted with an example count, as the page writes it with the count filled in.
    expect(block).toContain('"is sending to 155 people. It goes on if you close this page."')
    expect(read(PAGE)).toContain("is sending to ${total.toLocaleString('en-US')} ${total === 1 ? 'person' : 'people'}. It goes on if you close this page.")
  })

  it("is right that both sweeps of the media manager's reach name the endpoint", () => {
    expect(read(OFFICER)).toContain("'mail/newsletter/issue/send.ts'")
    expect(read(OFFICER)).toContain("'POST mail/newsletter/issue/send.ts'")
    expect(read(REACH)).toContain("'mail/newsletter/issue/send.ts'")
    expect(bullet('Who may send it.')).toContain('The two sweeps of what the media manager may reach list `mail/newsletter/issue/send.ts`, and the officer sweep its POST')
  })

  it('says there is no migration in this change', () => {
    expect(block).toContain('There is no migration in this change.')
  })
})

describe("REDESIGN_STATUS.md, WS16 part two: the page's own Send, in plain words", () => {
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
    // Only K's quoted question holds the word.
    expect(ownWordsOf(block)).not.toMatch(WE)
  })

  it('names the build, the reviews and the join in plain words', () => {
    const reviews = bullet('The reviews.')
    expect(reviews).toContain("The build's first review")
    expect(reviews).toContain("The build's second review")
    expect(reviews).toContain("The join's first review")
    expect(reviews).toContain("The join's second review")
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

  it('writes every time on the twelve-hour clock, each with its AM or PM, both ends of a range among them', () => {
    const prose = proseOf(block)
    const times = [...prose.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)]
    expect(times.length).toBeGreaterThan(0)
    for (const time of times) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
    // Each time says its zone.
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2} (?:AM|PM)\b(?! UTC)/g)) expect(prose.slice(time.index ?? 0, (time.index ?? 0) + 40), time[0]).toMatch(/^\S+ (?:AM|PM)(?: to \d{1,2}:\d{2} (?:AM|PM))? UTC/)
  })
})
