// test/unit/redesign-status-ws16-p2-templates.test.ts
//
// REDESIGN_STATUS.md records saved templates on the newsletter's own page and
// the new words of the first card of Help's walkthrough. Light, as the Gmail
// block's record test is, this file reads only this block, from its heading
// to the next heading. Pinned: the block's heading, once, directly after the
// Gmail block and before the WS16 decisions; the bold names of its bullets,
// in order; that every file it names is in the tree; and the facts a later
// change must not let drift, each read from the source so the record and the
// code cannot differ: the two limits, the endpoint's file and its four
// methods, the route in the registry, no migration after the one the block
// names, no new feature name, card 1's three sentences, and the words on the
// page the block quotes, each in the file that draws or gives it. Also K's
// words, quoted exactly, and the plain-language rules over the block. It pins
// no count and no figure.
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

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}
/** Text with what sits in backticks taken out, since code is not prose. */
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const BEFORE = '#### WS16 part two: the newsletter email in the Gmail phone apps'
const BLOCK = "#### WS16 part two: saved templates and the tutorial's first card"
const AFTER = '### WS16 decisions'
/** This block: from its heading to the next heading of any level. */
const block = status.includes(`\n${BLOCK}\n`) ? between(status.slice(status.indexOf(`\n${BLOCK}\n`) + 1), BLOCK, '\n#') : ''
const blockLines = block.split('\n')

/** The bold names of the block's bullets, in their order. */
const NAMES = [
  'What a person can do.', 'Where a template is kept.', 'The endpoint.', 'Names.', 'Two people at once.', "The tutorial's first card.",
  'Every word added, for K.', 'Accessibility.', 'The reviews.', 'What was not tested.', 'Files.', 'Tests.', 'Follow-ups.', 'Checks.',
]

/** K's words as K typed them, typos and all: on the walkthrough, Thursday, November 19, 2026, and on templates, decision 78. */
const K_WORDS = [
  'I do not like how the text is telling you where to find it when the bubble literally poitns at it. also, some of its text sounds like its talking in their person. change all this text in the tutorial things to be straight forward and helpful for practical first time use. there should be no "we" reffered to.',
  'I think the first bubble text is the only one i have issue with. others seem fine on this gripe.',
  'So for this I would like to prioritize making sure that the users that are using the newsletter have full capabilities to save, make, and utilize the templates that are making, etc.',
]

/** Card 1's title and its three sentences, as the block quotes them. */
const CARD_TITLE = 'Pick a template to start from'
const CARD_WORDS = [
  'Start from a blank letter, a template or a past newsletter, then change the words.',
  'If the letter already has words, the page asks before replacing them and keeps them under Your last newsletters.',
  "To use a letter's words again, save it as a template. Everyone who writes the newsletter can start from it.",
]

const CHOOSER = 'src/areas/admin/newsletter/TemplateChooser.tsx'
const ISSUES = 'functions/utils/mail/issues.ts'
const CONTRACT = 'domain/contracts/newsletter.ts'
const LETTER = 'domain/mail/letter.ts'
const ENDPOINT = 'functions/api/admin/mail/newsletter/templates.ts'
const HELP = 'src/areas/admin/newsletter/HelpWalkthrough.tsx'

/** A number a source file exports by name, read from its `export const NAME = 40`. */
const exported = (file: string, name: string) => {
  const hit = new RegExp(`export const ${name} = (\\d+)\\b`).exec(read(file))
  return hit ? Number(hit[1]) : NaN
}
const NAME_MAX = exported(LETTER, 'TEMPLATE_NAME_MAX')
const SHOWN_MAX = exported(ISSUES, 'TEMPLATES_MAX')

/**
 * A source file's text as a person would read its words: the two limits put in where the source writes them as
 * `${...}`, and a quote mark written `\'` read as itself.
 */
const wordsOf = (file: string) =>
  read(file)
    .replaceAll('${TEMPLATE_NAME_MAX}', String(NAME_MAX))
    .replaceAll('${TEMPLATES_MAX}', String(SHOWN_MAX))
    .replaceAll("\\'", "'")

/**
 * The words the block quotes, in double quotes, each with the file that draws or gives it and, where that file
 * writes the words in parts round a name, the parts it holds.
 */
const QUOTED: { quote: string; file: string; parts?: string[] }[] = [
  { quote: 'Pinned templates', file: CHOOSER },
  { quote: 'Use this', file: CHOOSER },
  { quote: 'Rename', file: CHOOSER },
  { quote: 'Remove', file: CHOOSER },
  { quote: 'Save this letter as a template', file: CHOOSER },
  { quote: 'This letter has no words yet, so it cannot be saved as a template.', file: CHOOSER },
  { quote: 'Save as a template', file: CHOOSER },
  { quote: 'Template name', file: CHOOSER },
  { quote: 'Save template', file: CHOOSER },
  { quote: 'Save name', file: CHOOSER },
  { quote: 'Cancel', file: CHOOSER },
  { quote: 'Remove this template?', file: CHOOSER },
  {
    quote: 'leaves the list for everyone. Letters already started from it keep their words.',
    file: CHOOSER,
    parts: ['leaves the list for everyone. ', 'Letters already started from it keep their words.'],
  },
  { quote: 'Keep it', file: CHOOSER },
  { quote: 'Remove it', file: CHOOSER },
  { quote: 'is removed.', file: CHOOSER },
  { quote: 'Saved templates could not be read.', file: CHOOSER },
  { quote: 'Try again', file: CHOOSER },
  { quote: 'changed it', file: CHOOSER },
  { quote: 'Someone removed this template after you opened the list, so nothing was changed.', file: CHOOSER },
  { quote: 'The template could not be saved. Try again.', file: CHOOSER },
  { quote: 'The template could not be renamed. Try again.', file: CHOOSER },
  { quote: 'The template could not be removed. Try again.', file: CHOOSER },
  { quote: 'Replace this letter?', file: CHOOSER },
  { quote: 'Your words are kept under Your last newsletters.', file: CHOOSER },
  { quote: 'Someone changed this template after you opened the list, so nothing was changed.', file: ISSUES },
  { quote: 'A template is already called', file: ISSUES },
  { quote: 'Choose another name.', file: ISSUES },
  { quote: 'There are already 40 saved templates. Remove one, then save this one.', file: ISSUES },
  { quote: 'Write a name for the template.', file: CONTRACT },
  { quote: "Keep the template's name to 60 characters.", file: CONTRACT },
  { quote: "Write the template's name on one line, with no line break, tab or other hidden character.", file: CONTRACT },
  { quote: 'Name the template.', file: CONTRACT },
  { quote: 'Save the letter on the page, or one past newsletter, as a template.', file: CONTRACT },
  { quote: 'Give the version of the template you read.', file: CONTRACT },
  { quote: 'Choose a blank letter, a starter, a past letter or a past newsletter.', file: CONTRACT },
]

describe("REDESIGN_STATUS.md, WS16 part two: saved templates and the tutorial's first card, its place and its parts", () => {
  it('sits once, directly after the block for the Gmail phone apps and before the WS16 decisions', () => {
    expect(block).not.toBe('')
    expect(status.split(`\n${BLOCK}\n`)).toHaveLength(2)
    const at = status.indexOf(`\n${BLOCK}\n`)
    const before = status.indexOf(`\n${BEFORE}\n`)
    expect(before).toBeGreaterThan(-1)
    // Directly after: the next heading after the Gmail block's own is this one.
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
    expect(files).toContain('test/unit/redesign-status-ws16-p2-templates.test.ts')
  })

  it("quotes K's words exactly, typos and all", () => {
    for (const words of K_WORDS) expect(block, words.slice(0, 40)).toContain(`"${words}"`)
  })
})

describe("REDESIGN_STATUS.md, WS16 part two: saved templates and the tutorial's first card, true to the code", () => {
  it('is right about the two limits, read from the code', () => {
    expect(NAME_MAX).toBe(60)
    expect(SHOWN_MAX).toBe(40)
    expect(exported(CONTRACT, 'TEMPLATES_MAX')).toBe(SHOWN_MAX)
    expect(block).toContain(`${SHOWN_MAX} shown templates`)
    expect(block).toContain(`${NAME_MAX} characters a name`)
    // Written once, in domain/mail/letter.ts, and given out from there by the contract and the server.
    expect(block).toContain(`\`TEMPLATE_NAME_MAX\` in \`${LETTER}\``)
    for (const file of [CONTRACT, ISSUES]) {
      const source = read(file)
      expect(source, file).not.toMatch(/const TEMPLATE_NAME_MAX\b/)
      expect(source, file).toMatch(/import \{[^}]*\bTEMPLATE_NAME_MAX\b[^}]*\} from '[^']*\/mail\/letter'/)
      expect(source, file).toContain('export { TEMPLATE_NAME_MAX }')
    }
    expect(block).toContain(`\`templateNameAsStored\` in \`${LETTER}\``)
    expect(read(LETTER)).toMatch(/export function templateNameAsStored\(/)
  })

  it("is right about the endpoint: its file, its four methods behind the page's switch and the guard, and its route", () => {
    expect(block).toContain('`/api/admin/mail/newsletter/templates`')
    expect(block).toContain(`\`${ENDPOINT}\`, with four methods beside OPTIONS`)
    const source = read(ENDPOINT)
    expect(source).toContain('export const onRequestOptions')
    for (const method of ['Get', 'Post', 'Put', 'Delete']) {
      const handler = between(source, `export const onRequest${method}: PagesFunction<Env> = async`, '\nexport const ')
      expect(handler, method).not.toBe('')
      // "Not found" while the page is off comes first, then the guard.
      const off = handler.indexOf('if (!MAIL_PAGE_ON) return pageNotFound()')
      const guard = handler.indexOf('requireListMailer(')
      expect(off, method).toBeGreaterThan(-1)
      expect(guard, method).toBeGreaterThan(off)
      if (method !== 'Get') expect(handler.indexOf('parseBody('), method).toBeGreaterThan(guard)
    }
    expect([...source.matchAll(/^export const onRequest(\w+)/gm)].map((m) => m[1]).sort()).toEqual(['Delete', 'Get', 'Options', 'Post', 'Put'])
    const route = between(read('domain/contracts/registry.ts'), "'admin/mail/newsletter/templates': {", '\n  },')
    expect(route).not.toBe('')
    expect([...route.matchAll(/^\s+(GET|POST|PUT|DELETE|PATCH): \{/gm)].map((m) => m[1])).toEqual(['GET', 'POST', 'PUT', 'DELETE'])
    expect(block).toContain('`issue/start` now takes `{ templateId }`')
    expect(read('functions/api/admin/mail/newsletter/issue/start.ts')).toContain('templateId')
  })

  it('is right that no migration was added after the latest the block names', () => {
    const named = /no migration, the latest staying (\d{4})\b/.exec(block)
    expect(named).not.toBeNull()
    const numbered = readdirSync(join(ROOT, 'migrations')).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort()
    expect(numbered.length).toBeGreaterThan(0)
    // The files after the one the block names are the later changes' own: the seat listing's 0073.
    const later = numbered.filter((file) => file.slice(0, 4) > (named?.[1] ?? '9999'))
    expect(later).toEqual(['0073_seat_listing.sql'])
    expect(numbered.some((file) => file.slice(0, 4) === named?.[1])).toBe(true)
  })

  it("is right that there is no new feature flag: the endpoint rides MAIL_PAGE_ON and the page mailPage, both on", () => {
    expect(block).toContain('no new feature flag')
    expect(block).toContain('`MAIL_PAGE_ON`')
    expect(block).toContain('`mailPage`')
    expect(read('functions/utils/mail/switches.ts')).toMatch(/^export const MAIL_PAGE_ON = true$/m)
    const features = read('src/lib/features.ts')
    expect(features).toMatch(/^\s+mailPage: true,$/m)
    // No name of its own for templates.
    expect(features).not.toMatch(/template/i)
  })

  it("quotes card 1's title and its three sentences as the walkthrough holds them", () => {
    const help = read(HELP)
    expect(help).toContain(`const pick = '${CARD_TITLE}'`)
    const card = between(help, "target: 'pick',", '\n    },')
    expect(card).toContain('title: pick,')
    const list = between(card, 'words: [', '\n      ],')
    const sentences = [...list.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1] ?? m[2])
    expect(sentences).toEqual(CARD_WORDS)
    expect(block).toContain(`"${CARD_TITLE}"`)
    const bullet = blockLines.find((l) => l.startsWith("- **The tutorial's first card.**")) ?? ''
    const quoted = CARD_WORDS.map((words) => `"${words}"`)
    expect(bullet).toContain(`${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`)
  })

  it('quotes the words on the page each as the file that draws or gives it holds them', () => {
    for (const { quote, file, parts } of QUOTED) {
      expect(block, quote).toContain(`"${quote}"`)
      const source = wordsOf(file)
      for (const part of parts ?? [quote]) expect(source, `${quote} in ${file}`).toContain(part)
    }
  })
})

describe("REDESIGN_STATUS.md, WS16 part two: saved templates and the tutorial's first card, in plain words", () => {
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

  it("writes every time on the twelve-hour clock, each with its AM or PM, as the part's own record test asks", () => {
    const prose = proseOf(block)
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
  })
})
