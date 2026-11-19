// test/unit/redesign-status-ws09-switch-on-region-joined.test.ts
//
// REDESIGN_STATUS.md records the switch-on of the representatives' club
// events with main taken in, in the block "WS09 switch-on: regionEvents with
// main taken in": the join of two files by hand, what ships on, a correction
// to the block before it about guests, the one pin moved and the checks.
// Like the other record tests of WS09, this file reads only the WS09
// section, from its heading to the WS10 heading. No case reads or pins a
// switch's shipped value.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The working words a record does not use, and the two words that name a person's role in the work. */
const BANNED = new RegExp(`\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'agent', 'work' + 'flow'].join('|')})s?\\b|${'the ' + 'lead'}`, 'i')
/** The tools a record must not mention, split up so that this file does not mention them either. */
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
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

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const BEFORE = '### WS09 switch-on: regionEvents on main\'s tree'
const BLOCK = '### WS09 switch-on: regionEvents with main taken in'
const LISTS = '### WS09 decisions'
const block = part(BLOCK)
const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS) - 1] === BLOCK
const MOVED = 'test/unit/redesign-status-ws09-switch-on-region-main.test.ts'
/** A test file's cases as vitest counts them: each plain `it(`. */
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length

describe('REDESIGN_STATUS.md, WS09 switch-on of regionEvents with main taken in', () => {
  it('sits once, right after the block on main\'s tree, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(BEFORE) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS)
  })

  it('has every part, in order', () => {
    const parts = ['- **The join.**', '- **What ships on, on this tree.**', '- **A correction to the block before this one.**', '- **Pins moved.**', '- Checks:', '- **Branch.**']
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('names the two files joined by hand, and quotes the browser builds\' list as the file holds it while this block is the latest', () => {
    const joined = bullet(block, '- **The join.**')
    for (const piece of ['`test/a11y/builds.spec.ts`', '`test/unit/features.test.ts`', '`REDESIGN_STATUS.md`', '`src/lib/features.ts`', 'joined by hand', 'No line of product moved in the join']) expect(joined, piece).toContain(piece)
    const spec = read('test/a11y/builds.spec.ts').split('\n').filter((l) => l.startsWith('const SHIPPED_ON = '))
    expect(spec).toHaveLength(1)
    const namesIn = (line: string) => (/\[([^\]]*)\]/.exec(line)?.[1] ?? '').split(',').map((n) => n.trim()).filter(Boolean)
    const quoted = namesIn(/`const SHIPPED_ON = \[[^\]]*\]`/.exec(joined)?.[0] ?? '')
    expect(quoted.at(-1)).toBe('\'regionEvents\'')
    if (latest) expect(joined).toContain(`\`${spec[0]}\``)
    else expect(namesIn(spec[0]).filter((n) => quoted.includes(n))).toEqual(quoted)
    // The other file as the block says it: the mail work's list empty, and one name of WS09 still held off.
    const features = read('test/unit/features.test.ts')
    expect(features).toMatch(/^const WS16 = \[\] as const$/m)
    if (latest) expect(features).toMatch(/^const WS09 = \['newClubs'\] as const$/m)
  })

  it('says what a guest is, against the two files it names', () => {
    const correction = bullet(block, '- **A correction to the block before this one.**')
    for (const piece of ['"to member accounts, not guest accounts"', 'a walk-in entered at the door', '`functions/api/admin/tournaments/[id]/walk-ins.ts`', '`MEMBER_ROLES`', '`functions/utils/admin/permissions.ts`', 'signed in to the site once']) expect(correction, piece).toContain(piece)
    // The block it corrects holds the words it quotes.
    expect(bullet(part(BEFORE), '- **Owed, K\'s own.**')).toContain('to member accounts, not guest accounts')
    expect(read('functions/api/admin/tournaments/[id]/walk-ins.ts')).toMatch(/role: 'guest'/)
    const roles = between(read('functions/utils/admin/permissions.ts'), 'export const MEMBER_ROLES', ']')
    expect(roles).not.toBe('')
    expect(roles).not.toContain('guest')
  })

  it('lists the one pin moved with its file\'s count of cases and its case\'s title', () => {
    const pins = bullet(block, '- **Pins moved.**')
    expect(pins).toContain(`\`${MOVED}\` (${casesIn(MOVED)})`)
    const title = 'names the base, the two commits by their subjects and each conflict, quoting the one list the browser builds\\\' file holds'
    expect(read(MOVED)).toContain(`it('${title}'`)
    expect(pins).toContain(`"${title.replace(/\\'/g, '\'')}"`)
    expect(read(MOVED)).toContain('else expect(namesIn(spec[0]).filter((n) => quoted.includes(n))).toEqual(quoted)')
  })

  it('gives each figure of the checks once, the integration figure with the one todo beside it', () => {
    const checks = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
    for (const piece of ['`npm run lint` 13 errors and 12 warnings over ', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', ' tests in ', 'with the one todo beside them', 'the browser run ', 'the stored baseline unchanged', 'the worker\'s dry run ']) {
      expect(checks.split(piece), piece).toHaveLength(2)
    }
  })

  it('keeps the record\'s plain language in what it wrote', () => {
    for (const rule of [DASHES, BANNED, TOOLS, OLD_INITIALS, HE]) expect(block).not.toMatch(rule)
    for (const date of block.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/g) ?? []) {
      expect(block, date).toMatch(new RegExp(`(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), ${date}`))
    }
  })
})
