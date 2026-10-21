// test/unit/dark-spot-later.test.ts
//
// The classes test/a11y/dark-spot.spec.ts credits to a later step (WS01 step
// 24). The spec runs axe in dark mode on /, /tournaments and /membership, and
// lets a colour-contrast failure through only when a class on the element,
// or on an ancestor up to its ground, is one a later step still moves to the
// tokens. After step 25 that is StatusBadge's light tones (step 26), and
// nothing else: gold text (text-lca-gold, left only on navy, and the gold
// tokens step 25 writes), and a status or hex colour step 24 converted or
// kept for a reason of its own (the white veils on navy, the banners'
// grounds, Facebook's blue, the map's paper, the light tones on the navy
// heroes, the check-in toggle, the print page's row rules, the dots), fail
// the spec if they fail in dark mode. The list is read from the spec itself
// and held against the TSX files, the allowlist of
// test/unit/raw-colours.test.ts and the status map.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STATUS_MAP, classStrings, loadMap, parseToken, planRewrite, tokensOf, tsxFiles } from '../../scripts/codemods/semantic-colours'
import { read, ROOT } from './helpers/cssTokens'

/** The spec's LATER list, as the regular expressions it holds. */
function laterList(): RegExp[] {
  const spec = read('test/a11y/dark-spot.spec.ts')
  const body = spec.match(/\nconst LATER = \[\n([\s\S]*?)\n\]\n/)?.[1]
  if (!body) throw new Error('no LATER list in test/a11y/dark-spot.spec.ts')
  return body.split('\n').map((line) => {
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

describe('the classes the dark spot run credits to a later step', () => {
  it('reads the list from the spec', () => {
    expect(LATER.length).toBeGreaterThan(0)
    expect(credited('bg-emerald-100')).toBe(true)
  })

  it('credits no gold text since step 25, in any form the pages use or used, so a gold text failure in dark mode fails the spec', () => {
    const gold = treeTokens.filter((t) => isGoldText(t.cls))
    // text-lca-gold on navy (53), text-gold-ink on a light ground (82) and the gold hex classes as tokens (34).
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

  it('credits StatusBadge\'s light tones, which step 26 maps, and nothing of StatusBadge that is not text or a ground under it', () => {
    const tones = kept.filter((k) => k.file === STATUS_BADGE && /step 26/.test(k.reason))
    const light = tones.filter((k) => parseToken(k.token).modifier === '' && !/^bg-\w+-500$/.test(parseToken(k.token).utility))
    expect(light.map((k) => k.token).sort()).toEqual(['bg-blue-50', 'bg-emerald-100', 'bg-red-100', 'border-blue-200', 'text-blue-800', 'text-emerald-800', 'text-red-700'])
    for (const k of light) expect(credited(k.token), k.token).toBe(true)
  })

  it('every class of the pages it credits sits in StatusBadge', () => {
    const others = treeTokens.filter((t) => credited(t.cls) && t.file !== STATUS_BADGE)
    expect(others).toEqual([])
  })

  it('credits no class the status map writes, and of the classes it rewrote only those StatusBadge keeps', () => {
    const written = [...statusMap.rules.map((r) => r.to), ...statusMap.sites.map((s) => parseToken(s.to).utility)]
    expect(written.filter(credited)).toEqual([])
    const rewrote = [...new Set([...statusMap.rules.map((r) => r.from), ...statusMap.sites.map((s) => parseToken(s.from).utility)])]
    const badge = new Set(kept.filter((k) => k.file === STATUS_BADGE).map((k) => k.token))
    expect(rewrote.filter((c) => credited(c) && !badge.has(c))).toEqual([])
    // With a variant too: neither the hover tint the map wrote nor the one it
    // replaced (put together when the test runs, so Tailwind, which reads this
    // file, builds no CSS for a class the pages no longer use).
    expect(credited('hover:bg-bad-50')).toBe(false)
    expect(credited(['hover:bg-', 'red-50'].join(''))).toBe(false)
  })

  it('credits none of the raw colours step 24 keeps for a reason of its own, so a dark mode failure in one fails the spec', () => {
    // The allowlist's entries for a later step: StatusBadge's tones (step 26); gold text has none since step 25.
    const later = (e: AllowEntry) => e.file === STATUS_BADGE && /step 26/i.test(e.reason)
    const ownReasons = allowlist.filter((e) => !later(e))
    const kinds = new Set(ownReasons.map((e) => parseToken(e.class).utility.replace(/^(bg-white)$/, 'a white veil').replace(/-\[#[0-9a-fA-F]+\]$/, ' hex')))
    expect([...kinds].sort()).toEqual(['a white veil', 'bg hex', 'bg-slate-400', 'bg-slate-500', 'border hex', 'border-gray-300', 'text hex'])
    expect(ownReasons.filter((e) => /\[#/.test(e.class)).map((e) => e.class).sort()).toEqual([
      'bg-[#1e4d7b]', 'bg-[#1e4d7b]', 'bg-[#9b1c1c]', 'bg-[#9b1c1c]', 'bg-[#f2efe6]', 'bg-[#f2efe6]',
      'hover:bg-[#1877F2]', 'hover:border-[#1877F2]', 'hover:text-[#1877F2]', 'text-[#1877F2]',
    ])
    for (const e of ownReasons) expect(credited(e.class), `${e.file} ${e.class}`).toBe(false)
    // StatusBadge's entries for step 26 are its seven light tone classes, which the spec credits, and StatusDot's dot.
    const badge = allowlist.filter((e) => e.file === STATUS_BADGE && /step 26/i.test(e.reason))
    expect(badge.map((e) => e.class).sort()).toEqual(['bg-blue-50', 'bg-emerald-100', 'bg-emerald-500', 'bg-red-100', 'border-blue-200', 'text-blue-800', 'text-emerald-800', 'text-red-700'])
    expect(badge.filter((e) => !credited(e.class)).map((e) => e.class)).toEqual(['bg-emerald-500'])
    const keptForItself = kept.filter((k) => k.file !== STATUS_BADGE)
    expect(keptForItself.length).toBeGreaterThan(15)
    for (const k of keptForItself) expect(credited(k.token), `${k.file} ${k.token}`).toBe(false)
  })
})
