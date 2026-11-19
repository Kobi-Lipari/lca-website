// test/unit/redesign-status-ws16-p2-step5d.test.ts
//
// REDESIGN_STATUS.md records the part of WS16 part two's page step 5's third
// part that gives the bar at the foot its narrow form and its forms for
// raised text. Light, as the Help and "Add an event" record test is, this
// file reads only this part's block, from its heading to the next heading.
// Pinned: the block's place, directly after the block for Help and "Add an
// event" and before the WS16 decisions; its heading; the bold names of its
// bullets, in order; that every file it names is in the tree; that neither
// of the bar's two files holds a math function inside a condition, as the
// block says, read from the source so the two cannot drift; and the
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

const BEFORE = '#### WS16 part two, page step 5, third part: Help and "Add an event"'
const BLOCK = "#### WS16 part two, page step 5, third part: the bar's narrow form and its forms for raised text"
const AFTER = '### WS16 decisions'
/** This part's block: from its heading to the next heading of any level. */
const block = status.includes(`\n${BLOCK}\n`) ? between(status.slice(status.indexOf(`\n${BLOCK}\n`) + 1), BLOCK, '\n#') : ''
const blockLines = block.split('\n')

/** The bold names of the block's bullets, in their order. */
const NAMES = [
  'The forms.', 'Units and plain conditions.', 'Raised text.', 'What every form keeps.', "More options at a phone's page end.", 'With Help.',
  'The reviews.', 'Differences from the board.', 'What every visitor loads.', 'Files.', 'Tests.', 'Follow-ups.', 'Checks.',
]

describe("REDESIGN_STATUS.md, WS16 part two: the bar's narrow form and its forms for raised text, its place and its parts", () => {
  it('sits once, directly after the block for Help and "Add an event" and before the WS16 decisions', () => {
    expect(block).not.toBe('')
    expect(status.split(`\n${BLOCK}\n`)).toHaveLength(2)
    const at = status.indexOf(`\n${BLOCK}\n`)
    const before = status.indexOf(`\n${BEFORE}\n`)
    expect(before).toBeGreaterThan(-1)
    // Directly after: the next heading after the Help and "Add an event" block's own is this one.
    expect(status.indexOf('\n#', before + 1 + BEFORE.length)).toBe(at)
    // A later block, the newsletter email in the Gmail phone apps, may stand between this one and the WS16 decisions.
    expect(status.indexOf(`\n${AFTER}\n`, at)).toBeGreaterThanOrEqual(at + 1 + block.length)
    expect(blockLines[0]).toBe(BLOCK)
    expect(blockLines.filter((l) => /^#{1,6} /.test(l))).toEqual([BLOCK])
    // A part of a page step, so the page steps' own count, which the part's other record tests read, passes over it.
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
    const files = [...block.matchAll(/`((?:src|test|functions|domain)\/[^`\s]+\.[a-z]+|REDESIGN_STATUS\.md)`/g)].map((m) => m[1]).filter((file) => !file.includes('*'))
    expect(files.length).toBeGreaterThan(5)
    for (const file of files) expect(existsSync(join(ROOT, file)), file).toBe(true)
  })

  it("is right that neither of the bar's two files holds a math function inside a condition", () => {
    expect(block).toContain('No condition holds a math function')
    for (const file of ['src/areas/admin/newsletter/FootBar.tsx', 'src/areas/admin/newsletter/MoreOptions.tsx']) {
      const conditions = [...read(file).matchAll(/(?<![\w-])@?(?:max|min)-\[([^\]\s]+)\]:/g)].map((hit) => hit[1])
      expect(conditions.length, file).toBeGreaterThan(0)
      expect(conditions.filter((value) => /(?:max|min|clamp|calc)\(/.test(value)), file).toEqual([])
    }
  })
})

describe("REDESIGN_STATUS.md, WS16 part two: the bar's narrow form and its forms for raised text, in plain words", () => {
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
