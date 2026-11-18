// test/unit/redesign-status-ws16-p2-step5c.test.ts
//
// REDESIGN_STATUS.md records the part of WS16 part two's page step 5's third
// part that holds Help's walkthrough and "Add an event". Lighter than the
// page half's other record tests, this file reads only this part's block,
// from its heading to the next heading. Pinned: the block's place, after the
// block for the page switched on and before the WS16 decisions; its heading;
// the bold names of its bullets, in order; that every card's title and words,
// every label, button and refusal of "Add an event" and the Add menu's rows
// are in the record as the code has them, read from the source files so the
// two cannot drift; that every file it names is in the tree; and the
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

const BEFORE = '#### WS16 part two: the page switched on'
const BLOCK = '#### WS16 part two, page step 5, third part: Help and "Add an event"'
const AFTER = '### WS16 decisions'
/** This part's block: from its heading to the next heading of any level. */
const block = status.includes(`\n${BLOCK}\n`) ? between(status.slice(status.indexOf(`\n${BLOCK}\n`) + 1), BLOCK, '\n#') : ''
const blockLines = block.split('\n')

/** The bold names of the block's bullets, in their order. */
const NAMES = [
  "Help's button.", "The walkthrough's six cards.", 'Help never says what the page cannot do today.', 'Opening by itself once.',
  'Focus, the page behind it and forced colours.', 'The card on small windows and at 200 per cent.', '"Add an event".', "The event's line.",
  '"A line" given the same placing.', 'The reviews.', 'Words no board draws, for K.', 'Differences from the board.', 'What every visitor loads.',
  'Files.', 'Tests.', 'Follow-ups.', 'Checks.',
]

/** The walkthrough's card words as a person reads them, taken from helpSteps in the source, offFront's rule applied. */
function cardWords(): string[] {
  const source = read('src/areas/admin/newsletter/HelpWalkthrough.tsx')
  const steps = between(source, 'function helpSteps(', '\nexport interface')
  const pick = /const pick = '([^']+)'/.exec(steps)?.[1] ?? ''
  const off = (sentence: string, name: string) => {
    if (!sentence.startsWith(name)) return sentence
    const rest = sentence.slice(name.length).replace(/^,?\s+(is\s+)?/, '')
    return rest.charAt(0).toUpperCase() + rest.slice(1)
  }
  const inputs = new Set<string>()
  const words: string[] = []
  for (const found of steps.matchAll(/offFront\('([^']+)', (?:pick|'([^']+)')\)/g)) {
    inputs.add(found[1])
    words.push(off(found[1], found[2] ?? pick))
  }
  for (const found of steps.matchAll(/'([A-Z][^']*)'/g)) if (!inputs.has(found[1])) words.push(found[1])
  return words
}

describe('REDESIGN_STATUS.md, WS16 part two: Help and "Add an event", its place and its parts', () => {
  it('sits once, after the block for the page switched on and before the WS16 decisions', () => {
    expect(block).not.toBe('')
    expect(status.split(`\n${BLOCK}\n`)).toHaveLength(2)
    const at = status.indexOf(`\n${BLOCK}\n`)
    expect(at).toBeGreaterThan(status.indexOf(`\n${BEFORE}\n`))
    expect(status.indexOf(`\n${BEFORE}\n`)).toBeGreaterThan(-1)
    // A later part of the same page step may put its own block between this one and the decisions.
    expect(status.indexOf(`\n${AFTER}\n`, at)).toBeGreaterThanOrEqual(at + 1 + block.length)
    expect(blockLines[0]).toBe(BLOCK)
    expect(blockLines.filter((l) => /^#{1,6} /.test(l))).toEqual([BLOCK])
    // A part of a page step, so the page steps' own count, which the part's other record tests read, passes over it.
    expect(BLOCK).not.toMatch(/^#### WS16 part two, page step (\d+): /)
  })

  it('opens with what this part is, its day and K\'s word, and what comes later', () => {
    const opening = blockLines[2] ?? ''
    for (const piece of ['Wednesday, November 18, 2026', 'decision 74', 'switched on', "The bar's narrow form", 'unsaved words', 'the Subject and the month']) {
      expect(opening, piece).toContain(piece)
    }
  })

  it('holds its bullets\' bold names in order, each once', () => {
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
})

describe('REDESIGN_STATUS.md, WS16 part two: Help and "Add an event", the words as the code has them', () => {
  it('gives every card\'s title and words as the walkthrough draws them', () => {
    const words = cardWords()
    expect(words).toContain('Pick a template to start from')
    expect(words).toContain('Who members see as the sender.')
    for (const line of words) expect(block, line).toContain(`"${line}"`)
  })

  it('gives the Add menu\'s rows, the form\'s labels and buttons, and every refusal word for word', () => {
    const rows = /const ADD_ROWS = \[([^\]]+)\]/.exec(read('src/areas/admin/newsletter/LetterEditor.tsx'))?.[1] ?? ''
    const form = read('src/areas/admin/newsletter/AddEventForm.tsx')
    const line = read('src/areas/admin/newsletter/eventLine.ts')
    const pieces = [
      ...[...rows.matchAll(/'([^']+)'/g)].map((m) => m[1]),
      ...[...form.matchAll(/label: '([^']+)'/g)].map((m) => m[1]),
      ...['Add the event', 'Cancel', 'Add an event or line'].filter((words) => form.includes(words) || read('src/areas/admin/newsletter/LetterEditor.tsx').includes(words)),
      ...[...line.matchAll(/words: (?:'([^']+)'|"([^"]+)")/g)].map((m) => m[1] ?? m[2]),
      ...[...line.matchAll(/^\s*words:\s*\n?\s*'([^']+)'/gm)].map((m) => m[1]),
    ]
    expect(pieces.length).toBeGreaterThan(10)
    for (const piece of pieces) expect(block, piece).toContain(`"${piece}"`)
  })

  it('names only files that are in the tree', () => {
    const files = [...block.matchAll(/`((?:src|test|functions|domain)\/[^`\s]+\.[a-z]+|REDESIGN_STATUS\.md)`/g)].map((m) => m[1]).filter((file) => !file.includes('*'))
    expect(files.length).toBeGreaterThan(5)
    for (const file of files) expect(existsSync(join(ROOT, file)), file).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: Help and "Add an event", in plain words', () => {
  it('holds no dash, no working word, no tool, no old initials and nothing left unfilled', () => {
    const prose = proseOf(block)
    expect(block).not.toMatch(DASHES)
    expect(prose).not.toMatch(BANNED)
    expect(block).not.toMatch(TOOLS)
    expect(prose).not.toMatch(ASSISTANT)
    expect(prose).not.toMatch(BARE)
    expect(block).not.toMatch(OLD_INITIALS)
    expect(block).not.toMatch(UNFILLED)
    expect(prose).not.toMatch(CAPITALS)
    expect(prose).not.toMatch(HE)
    expect(prose).not.toMatch(HOURS_24)
  })

  it('gives every day it names its weekday', () => {
    const prose = proseOf(block)
    for (const day of prose.matchAll(DAY)) expect(prose.slice(Math.max(0, (day.index ?? 0) - 11), day.index), day[0]).toMatch(WEEKDAY)
  })
})
