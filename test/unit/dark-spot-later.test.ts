// test/unit/dark-spot-later.test.ts
//
// The classes test/a11y/dark-spot.spec.ts credits to a later step (WS01 step
// 24). The spec runs axe in dark mode on /, /tournaments and /membership, and
// lets a colour-contrast failure through only when a class on the element,
// or on an ancestor up to its ground, is one a later step still moves to the
// tokens. Since step 26 that is nothing at all: gold text (text-lca-gold,
// left only on navy, and the gold tokens step 25 writes), StatusBadge's tones
// (which step 26 keeps for today's callers, each in its one string, as opaque
// light pills with words of their own), and a status or hex colour step 24
// converted or kept for a reason of its own (the white veils on navy, the
// banners' grounds, Facebook's blue, the map's paper, the light tones on the
// navy heroes, the check-in toggle, the print page's row rules, the dots)
// fail the spec if they fail in dark mode. The list is read from the spec
// itself and held against the TSX files, the allowlist of
// test/unit/raw-colours.test.ts and the status map.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STATUS_MAP, classStrings, loadMap, parseToken, planRewrite, tokensOf, tsxFiles } from '../../scripts/codemods/semantic-colours'
import { read, ROOT } from './helpers/cssTokens'

/** The spec's LATER list, as the regular expressions it holds (none since step 26). */
function laterList(): RegExp[] {
  const spec = read('test/a11y/dark-spot.spec.ts')
  const body = spec.match(/\nconst LATER(?:: RegExp\[\])? = \[\n([\s\S]*?)\]\n/)?.[1]
  if (body === undefined) throw new Error('no LATER list in test/a11y/dark-spot.spec.ts')
  return body.split('\n').filter((line) => line.trim() !== '').map((line) => {
    const m = line.trim().match(/^\/(.+)\/([a-z]*),$/)
    if (!m) throw new Error(`not a regular expression literal: ${line}`)
    return new RegExp(m[1], m[2])
  })
}

const LATER = laterList()
const credited = (cls: string) => LATER.some((re) => re.test(cls))

interface AllowEntry { file: string; class: string; count: number; reason: string }
const allowlist = (JSON.parse(readFileSync(join(__dirname, 'fixtures/raw-colours-allowlist.json'), 'utf8')) as { entries: AllowEntry[] }).entries

const statusMap = loadMap(STATUS_MAP)
const kept = planRewrite(ROOT, statusMap, 'check').kept
const STATUS_BADGE = 'src/components/StatusBadge.tsx'

/**
 * Gold text, with any variant or modifier: text-lca-gold, the gold tokens
 * step 25 writes, and the three gold hex colours it moved to them.
 */
const isGoldText = (cls: string) => /^text-(?:lca-gold|gold-ink(?:-badge(?:-club)?)?|gold-on-dark-badge|\[#(?:7a5c00|f0d07a|8a6d1f)\])$/i.test(parseToken(cls).utility)

/** Every class token of the TSX files under src, with its file. */
const treeTokens = tsxFiles(ROOT).flatMap((file) =>
  classStrings(file, read(file)).flatMap((s) => tokensOf(s.text).map(({ token }) => ({ file, cls: token.text }))))

/** StatusBadge's seven light tone classes, put together when the test runs, as the class names the list credited before step 26. */
const LIGHT_TONES = [
  ['bg-emerald', '-100'], ['text-emerald', '-800'], ['bg-red', '-100'], ['text-red', '-700'],
  ['border-blue', '-200'], ['bg-blue', '-50'], ['text-blue', '-800'],
].map((parts) => parts.join(''))

describe('the classes the dark spot run credits to a later step', () => {
  it('reads the list from the spec, and it is empty since step 26', () => {
    expect(LATER).toEqual([])
    // The reader still reads a list with entries, so a later step can add one.
    const sample = '\nconst LATER: RegExp[] = [\n  /^(?:bg-x)$/,\n]\n'
    expect(sample.match(/\nconst LATER(?:: RegExp\[\])? = \[\n([\s\S]*?)\]\n/)?.[1]).toBe('  /^(?:bg-x)$/,\n')
  })

  it('credits no gold text since step 25, in any form the pages use or used, so a gold text failure in dark mode fails the spec', () => {
    const gold = treeTokens.filter((t) => isGoldText(t.cls))
    // text-lca-gold on navy (53), text-gold-ink on a light ground (83) and the gold hex classes as tokens (34).
    expect(gold.length).toBeGreaterThan(150)
    expect(gold.filter((t) => credited(t.cls))).toEqual([])
    for (const cls of ['text-lca-gold', 'hover:text-lca-gold', 'text-lca-gold/90', 'text-gold-ink', 'text-gold-ink-badge', 'hover:text-gold-ink-badge', 'text-gold-ink-badge-club', 'text-gold-on-dark-badge']) {
      expect(credited(cls), cls).toBe(false)
    }
    // The hex classes the pages used before step 25, put together when the
    // test runs so Tailwind, which reads this file, builds no CSS for them.
    for (const hex of ['7a5c00', 'f0d07a', '8a6d1f']) {
      const cls = ['text-[#', hex, ']'].join('')
      expect(isGoldText(cls), cls).toBe(true)
      expect(credited(cls), cls).toBe(false)
    }
    expect(allowlist.filter((e) => /step 25/.test(e.reason))).toEqual([])
  })

  it('credits StatusBadge\'s light tones no more: the status map keeps them, each in its one string, with reasons of their own', () => {
    const tones = kept.filter((k) => k.file === STATUS_BADGE && LIGHT_TONES.includes(k.token))
    expect(tones.map((k) => k.token).sort()).toEqual([...LIGHT_TONES].sort())
    for (const k of tones) {
      expect(credited(k.token), k.token).toBe(false)
      expect(k.reason, k.token).not.toMatch(/step 2[6-9]|step 3\d/)
    }
    const entries = statusMap.keep.filter((k) => k.file === STATUS_BADGE && LIGHT_TONES.includes(k.class))
    expect(entries).toHaveLength(7)
    for (const k of entries) expect(k.contains, k.class).toBeDefined()
    // And the allowlist holds none of them, nor StatusDot's dot: only the navy surface's white veil is left there.
    expect(allowlist.filter((e) => e.file === STATUS_BADGE).map((e) => e.class)).toEqual(['bg-white/10'])
  })

  it('credits no class of the pages', () => {
    expect(treeTokens.filter((t) => credited(t.cls))).toEqual([])
  })

  it('credits no class the status map writes or rewrote', () => {
    const written = [...statusMap.rules.map((r) => r.to), ...statusMap.sites.map((s) => parseToken(s.to).utility)]
    expect(written.filter(credited)).toEqual([])
    const rewrote = [...new Set([...statusMap.rules.map((r) => r.from), ...statusMap.sites.map((s) => parseToken(s.from).utility)])]
    expect(rewrote.filter(credited)).toEqual([])
    // With a variant too: neither the hover tint the map wrote nor the one it
    // replaced (put together when the test runs, so Tailwind, which reads this
    // file, builds no CSS for a class the pages no longer use).
    expect(credited('hover:bg-bad-50')).toBe(false)
    expect(credited(['hover:bg-', 'red-50'].join(''))).toBe(false)
  })

  it('credits none of the raw colours kept for a reason of their own, so a dark mode failure in one fails the spec', () => {
    const kinds = new Set(allowlist.map((e) => parseToken(e.class).utility.replace(/^(bg-white)$/, 'a white veil').replace(/-\[#[0-9a-fA-F]+\]$/, ' hex')))
    expect([...kinds].sort()).toEqual(['a white veil', 'bg hex', 'bg-slate-400', 'bg-slate-500', 'border hex', 'border-gray-300', 'text hex'])
    // WS02 step 5 added two hex classes for the About menu's gold, which are
    // not WS01's: WS01's ten are the allowlist's hex classes less those, named beside them.
    const WS02_FILES = ['src/components/layout/AboutMenu.tsx']
    expect(allowlist.filter((e) => WS02_FILES.includes(e.file)).map((e) => e.class).sort()).toEqual(['bg-[#f3eedc]', 'text-[#705718]'])
    expect(allowlist.filter((e) => /\[#/.test(e.class) && !WS02_FILES.includes(e.file)).map((e) => e.class).sort()).toEqual([
      'bg-[#1e4d7b]', 'bg-[#1e4d7b]', 'bg-[#9b1c1c]', 'bg-[#9b1c1c]', 'bg-[#f2efe6]', 'bg-[#f2efe6]',
      'hover:bg-[#1877F2]', 'hover:border-[#1877F2]', 'hover:text-[#1877F2]', 'text-[#1877F2]',
    ])
    for (const e of allowlist) expect(credited(e.class), `${e.file} ${e.class}`).toBe(false)
    expect(allowlist.some((e) => /step 2[6-9]|step 3\d/.test(e.reason))).toBe(false)
    expect(kept.length).toBeGreaterThan(30)
    for (const k of kept) expect(credited(k.token), `${k.file} ${k.token}`).toBe(false)
  })
})
