// test/unit/raw-colours.test.ts
//
// The raw colour ratchet (WS01 step 24). Steps 23 and 24 moved the pages'
// colours to the design tokens, so each follows dark mode and the looks. This
// test keeps raw colours from coming back: it fails when a TSX file under src
// uses a colour class that follows no look, unless something allows it with
// its reason. The raw colour classes are:
// - the brand navy as a class that follows nothing (text-lca-navy,
//   bg-lca-navy, border-lca-navy, ring-lca-navy and the like);
// - bg-white, in any form;
// - a Tailwind palette colour (text-emerald-700, bg-red-100, border-gray-300,
//   from any of Tailwind's colours: the status colours and every other);
// - a colour given as an arbitrary hex value (text-[#7a5c00], bg-[#f2efe6]),
//   the same hex after a type hint, inside a longer value or in an
//   arbitrary property included.
//
// What allows one: a keep entry of either codemod map that names its one
// string (a file and the text only that string holds), read from the maps
// rather than repeated (step 23's white mats; step 24's light tones on navy
// and the check-in toggle's hover line), or an entry of
// test/unit/fixtures/raw-colours-allowlist.json, with its reason and the
// number of uses, which must match: a new use fails, and a removed use must
// take its count down, so the list only shrinks. A keep entry that reaches
// further allows nothing here, because it would let any number of new uses
// through: the translucent white veils step 23's map keeps in every file, and
// the classes the status map keeps for a whole file (StatusBadge's own tones,
// the print page's row rules, the dots), are counted in the allowlist like
// any other. A keep entry whose text matches more than one string of its
// file allows nothing and fails too.
//
// Step 25 moved the gold hex text classes to the gold tokens and took their
// entries out of the allowlist; a block below holds that one written back
// fails in the very file that held it, and that the gold tokens are not raw.
//
// Class strings are read with the codemod's own parser: string literals,
// template text, and the quoted strings of commented-out code. Club colours
// are user data and inline styles; no class is built from a value at run
// time, and no colour class is put together around a ${}, which the last
// tests hold.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { compile } from 'tailwindcss'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_MAP, STATUS_MAP, classStrings, loadMap, parseToken, planRewrite, tokensOf, tsxFiles, type ClassToken, type Keep } from '../../scripts/codemods/semantic-colours'
import { read, ROOT } from './helpers/cssTokens'

interface AllowEntry {
  file: string
  class: string
  count: number
  reason: string
}

const ALLOWLIST_PATH = join(__dirname, 'fixtures/raw-colours-allowlist.json')
const allowlist = (JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as { entries: AllowEntry[] }).entries

/** Tailwind's own colours, read from its theme so a colour it adds is covered too. */
const FAMILIES = [...new Set([...read('node_modules/tailwindcss/theme.css').matchAll(/--color-([a-z]+)-50:/g)].map((m) => m[1]))]

/**
 * The utilities that take a colour, as Tailwind 4 names them: text shadows,
 * the logical block borders, scrollbars and mask edges included (each of
 * these builds a palette colour, which the planted tree below checks with
 * Tailwind itself).
 */
const COLOUR_PREFIX = '(?:bg|text|text-shadow|border|border-(?:[xytrblse]|bs|be)|ring|ring-offset|inset-ring|outline|fill|stroke|accent|caret|decoration|divide|placeholder|shadow|inset-shadow|drop-shadow|from|via|to|scrollbar-(?:thumb|track)|mask-(?:linear|radial|conic|[xytrbl])-(?:from|to))'
const PALETTE = new RegExp(`^${COLOUR_PREFIX}-(?:${FAMILIES.join('|')})-(?:50|[1-9]00|950)$`)
/**
 * A hex colour in an arbitrary value or property, however it is written: the
 * value alone in the brackets, after a type hint ("color:"), inside a longer
 * value such as a shadow's, or as an arbitrary property that sets a colour.
 * The hex stands alone in the value: a bracket, colon, underscore, comma or
 * parenthesis before it, and a bracket, underscore, comma or parenthesis
 * after. (The forms are planted below, put together when the test runs, so
 * Tailwind, which reads this file, builds no CSS for them.)
 */
const HEX = /\[[^\]]*?(?<=[[:_,(])#[0-9a-fA-F]{3,8}(?=[\]_,)])/

/** Why a class is a raw colour, or null when it is not one. */
function rawKind(token: ClassToken): string | null {
  const u = token.utility
  if (/^[a-z-]+-lca-navy$/.test(u)) return 'the brand navy as a class that follows no look'
  if (u === 'bg-white') return token.modifier ? 'a white veil' : 'a white ground'
  if (PALETTE.test(u)) return 'a Tailwind palette colour'
  if (HEX.test(u)) return 'a hex colour'
  return null
}

interface Use {
  file: string
  line: number
  token: string
  kind: string
}

/** Every raw colour class in the TSX files under <root>/src. */
function rawUses(root: string): Use[] {
  const out: Use[] = []
  for (const file of tsxFiles(root)) {
    const source = readFileSync(join(root, file), 'utf8')
    for (const s of classStrings(file, source)) {
      for (const { token, offset } of tokensOf(s.escaped ? s.value : s.text)) {
        const kind = rawKind(token)
        if (kind) out.push({ file, line: source.slice(0, s.start + offset).split('\n').length, token: token.text, kind })
      }
    }
  }
  return out
}

const key = (file: string, token: string) => `${file} ${token}`

/** A keep entry that names its one string: a file, and the text only that string holds. */
const namesOneString = (k: Keep) => k.file !== undefined && k.contains !== undefined

/** What the ratchet finds under <root>: raw classes nothing allows, and allowlist entries whose count is wrong. */
function ratchet(root: string, entries: AllowEntry[] = allowlist) {
  const uses = rawUses(root)
  // The maps' keep entries that name their one string, as the codemod's
  // check finds them under this root: the check is run with those entries
  // alone, and the most particular entry wins there as in a run, so what it
  // keeps is exactly what they keep.
  const kept = new Map<string, number>()
  const problems: string[] = []
  for (const path of [DEFAULT_MAP, STATUS_MAP]) {
    const map = loadMap(path)
    const plan = planRewrite(root, { ...map, keep: map.keep.filter(namesOneString) }, 'check')
    for (const k of plan.kept) kept.set(key(k.file, k.token), (kept.get(key(k.file, k.token)) ?? 0) + 1)
    // A keep entry names one string; one whose text two strings hold (a kept
    // string copied elsewhere in its file) would keep both.
    for (const p of plan.problems) if (/^(?:[2-9]|\d{2,}) strings contain .*; a keep entry names exactly one$/.test(p.message)) problems.push(`${p.file}: ${p.message}`)
  }
  const listed = new Map(entries.map((e) => [key(e.file, e.class), e.count]))
  const found = new Map<string, Use[]>()
  for (const u of uses) found.set(key(u.file, u.token), [...(found.get(key(u.file, u.token)) ?? []), u])
  for (const [k, list] of found) {
    const allowed = (kept.get(k) ?? 0) + (listed.get(k) ?? 0)
    if (list.length > allowed) {
      for (const u of list.slice(allowed)) problems.push(`${u.file}:${u.line} ${u.token} is ${u.kind}; use a token, or allow it with its reason`)
    }
  }
  for (const e of entries) {
    const n = (found.get(key(e.file, e.class))?.length ?? 0) - (kept.get(key(e.file, e.class)) ?? 0)
    if (n !== e.count) problems.push(`the allowlist gives ${e.file} ${e.class} ${e.count} uses, and the file has ${Math.max(n, 0)}: set its count`)
  }
  return { uses, kept, problems }
}

describe('the raw colour ratchet on the tree', () => {
  const result = ratchet(ROOT)

  it('finds no raw colour class that nothing allows, and every allowlist count is right', () => {
    expect(result.problems).toEqual([])
  })

  it('what is left: the maps\' keep entries for one string and the allowlist, every one with its reason', () => {
    // The raw classes a keep entry names in its one string: step 23's five
    // white mats, and step 24's light tones on navy with their tints (18) and
    // the check-in toggle's hover line (1); step 24 also keeps one navy tint
    // in its string, which is not raw. The allowlist counts the rest: the
    // hex colours (10, since step 25 moved the 34 gold text classes to the
    // gold tokens), the translucent white veils on navy (34), and the
    // classes the status map keeps for a whole file (13: StatusBadge's light
    // tones and StatusDot's dot 8, the print page's row rules 2 and the
    // dots 3).
    const keptRaw = [...result.kept].filter(([k]) => result.uses.some((u) => key(u.file, u.token) === k)).reduce((a, [, n]) => a + n, 0)
    const fromList = allowlist.reduce((a, e) => a + e.count, 0)
    expect(keptRaw).toBe(5 + 18 + 1)
    expect(fromList).toBe(10 + 34 + 13)
    expect(result.uses.length).toBe(keptRaw + fromList)
    const veils = allowlist.filter((e) => parseToken(e.class).utility === 'bg-white')
    expect(veils.reduce((a, e) => a + e.count, 0)).toBe(34)
    for (const e of veils) expect(parseToken(e.class).modifier, `${e.file} ${e.class}`).not.toBe('')
    for (const e of allowlist) {
      expect(e.reason.length, e.class).toBeGreaterThan(40)
      expect(e.reason).toMatch(/\.$/)
      expect(e.reason).not.toContain('\u2014')
      expect(e.reason).not.toMatch(/\bUSCF\b/)
    }
    expect(new Set(allowlist.map((e) => key(e.file, e.class))).size).toBe(allowlist.length)
  })

  it('every allowlist entry names a raw colour class of a TSX file under src, used at least once', () => {
    // A count of 0 would sit in the list for ever, allowing nothing; an entry
    // for a class that is not raw, or for a file that is gone, allows nothing either.
    const files = tsxFiles(ROOT)
    for (const e of allowlist) {
      expect(Number.isInteger(e.count) && e.count >= 1, `${e.file} ${e.class} ${e.count}`).toBe(true)
      expect(rawKind(parseToken(e.class)), e.class).not.toBeNull()
      expect(files, e.file).toContain(e.file)
    }
  })

  it('leaves no text-lca-navy or other brand navy class, and no status colour of a palette but the kept ones', () => {
    expect(result.uses.filter((u) => u.kind.startsWith('the brand navy'))).toEqual([])
    const palette = result.uses.filter((u) => u.kind === 'a Tailwind palette colour')
    // StatusBadge (step 26), the light tones on the navy heroes, the check-in toggle, the print page's row rules and the dots.
    expect([...new Set(palette.map((u) => u.file))].sort()).toEqual([
      'src/components/StatusBadge.tsx',
      'src/pages/TournamentDetailPage.tsx',
      'src/pages/TournamentManagePage.tsx',
      'src/pages/TournamentPrintPage.tsx',
      'src/pages/TournamentsPage.tsx',
    ])
  })

  it('the hex colours left are the banners\' fixed grounds, Facebook\'s blue and the map\'s paper: no gold text (step 25)', () => {
    const hexUses = result.uses.filter((u) => u.kind === 'a hex colour')
    const hexes = new Set(hexUses.map((u) => u.token.match(/#[0-9a-fA-F]+/)![0].toLowerCase()))
    expect([...hexes].sort()).toEqual(['#1877f2', '#1e4d7b', '#9b1c1c', '#f2efe6'])
    // 10 classes in 7 files: the banners' grounds and their swatches (4), Facebook's blue (4) and the map's paper (2).
    expect(hexUses).toHaveLength(10)
    expect(new Set(hexUses.map((u) => u.file)).size).toBe(7)
    expect(allowlist.some((e) => /step 25/.test(e.reason))).toBe(false)
  })
})

describe('the ratchet on a planted tree', () => {
  const work = mkdtempSync(join(tmpdir(), 'raw-colours-'))
  afterAll(() => rmSync(work, { recursive: true, force: true }))
  let n = 0

  /** A class name no page uses, put together when the test runs, so Tailwind, which reads this file, builds no CSS for it. */
  const c = (...parts: string[]) => parts.join('')

  function tree(files: Record<string, string>): string {
    const root = join(work, `t${n++}`)
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    return root
  }
  const page = (classes: string) => `export function Planted() {\n  return <div className="p-4 ${classes}">x</div>\n}\n`

  it('passes a page on the tokens', () => {
    expect(ratchet(tree({ 'src/pages/Planted.tsx': page('bg-surface text-ink border-hairline') }), []).problems).toEqual([])
  })

  it.each([
    ['an opaque white ground', c('bg-', 'white')],
    ['a hex text colour', c('text-[#', '123456]')],
    ['a hex colour behind a variant and a modifier', c('hover:bg-[#', 'abcdef]/50')],
    ['a status colour of a palette', c('text-emerald', '-700')],
    ['a colour from another palette', c('bg-', 'indigo-50')],
    ['the navy that follows nothing', c('text-lca', '-navy')],
  ])('fails on %s outside the allowlist', (_, cls) => {
    const { problems } = ratchet(tree({ 'src/pages/Planted.tsx': page(cls) }), [])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain(`src/pages/Planted.tsx:2 ${cls} is `)
  })

  it('fails on a raw class in commented-out code too, but not on one named in prose', () => {
    const navy = c('text-lca', '-navy')
    const source = `${page('bg-surface')}// <p className="${navy}">old</p>\n// We don't want ${navy} here, it's dark mode's job.\n`
    const { problems } = ratchet(tree({ 'src/pages/Planted.tsx': source }), [])
    expect(problems).toEqual([`src/pages/Planted.tsx:4 ${navy} is the brand navy as a class that follows no look; use a token, or allow it with its reason`])
  })

  it('allows a class the allowlist names, up to its count, and fails on one more', () => {
    const hex = c('text-[#', '123456]')
    const entry = { file: 'src/pages/Planted.tsx', class: hex, count: 1, reason: 'A planted colour, allowed for this test only.' }
    expect(ratchet(tree({ 'src/pages/Planted.tsx': page(hex) }), [entry]).problems).toEqual([])
    const twice = ratchet(tree({ 'src/pages/Planted.tsx': `${page(hex)}export const Two = () => <p className="${hex}">y</p>\n` }), [entry])
    expect(twice.problems).toEqual([
      `src/pages/Planted.tsx:4 ${hex} is a hex colour; use a token, or allow it with its reason`,
      `the allowlist gives src/pages/Planted.tsx ${hex} 1 uses, and the file has 2: set its count`,
    ])
    // A count above what the file holds fails too: the list only shrinks.
    expect(ratchet(tree({ 'src/pages/Planted.tsx': page('bg-surface') }), [entry]).problems).toEqual([
      `the allowlist gives src/pages/Planted.tsx ${hex} 1 uses, and the file has 0: set its count`,
    ])
  })

  // The step 23 map keeps translucent white in every file (the veils on
  // navy), and the status map keeps a few classes for a whole file. The
  // ratchet counts those uses in the allowlist, so a new one fails wherever
  // it is written: a translucent white card under text-ink would be a light
  // box under light words in dark mode.
  it.each([
    ['a translucent white card', c('bg-', 'white/90')],
    ['a white veil on hover', c('hover:bg-', 'white/10')],
    ['a faint white veil', c('bg-', 'white/5')],
  ])('fails on %s in a new page, though the step 23 map keeps translucent white in every file', (_, cls) => {
    const { problems } = ratchet(tree({ 'src/pages/Planted.tsx': page(`${cls} text-ink`) }), [])
    expect(problems).toEqual([`src/pages/Planted.tsx:2 ${cls} is a white veil; use a token, or allow it with its reason`])
  })

  it('fails on a white mat outside the one string its keep entry names, in its own file too', () => {
    expect(ratchet(tree({ 'src/pages/Planted.tsx': page(c('bg-', 'white')) }), []).problems).toHaveLength(1)
    expect(ratchet(tree({ 'src/pages/ClubsPage.tsx': page(c('bg-', 'white')) }), []).problems).toHaveLength(1)
  })

  it('counts a white veil in a file the allowlist names, and fails on one more there', () => {
    const veil = c('hover:bg-', 'white/10')
    const entry = { file: 'src/components/layout/Navbar.tsx', class: veil, count: 1, reason: 'A planted veil on the navy header, allowed for this test only.' }
    expect(ratchet(tree({ [entry.file]: page(veil) }), [entry]).problems).toEqual([])
    const twice = ratchet(tree({ [entry.file]: `${page(veil)}export const Two = () => <a className="${veil}">y</a>\n` }), [entry])
    expect(twice.problems).toEqual([
      `src/components/layout/Navbar.tsx:4 ${veil} is a white veil; use a token, or allow it with its reason`,
      `the allowlist gives src/components/layout/Navbar.tsx ${veil} 1 uses, and the file has 2: set its count`,
    ])
  })

  it.each([
    ['StatusBadge\'s light green, which the status map keeps for the whole file', 'src/components/StatusBadge.tsx', c('bg-emerald', '-100')],
    ['StatusDot\'s open dot', 'src/components/StatusBadge.tsx', c('bg-emerald', '-500')],
    ['the print page\'s grey row rule', 'src/pages/TournamentPrintPage.tsx', c('border-gray', '-300')],
    ['the external-event dot', 'src/pages/TournamentsPage.tsx', c('bg-slate', '-400')],
  ])('fails on %s in its own file when the allowlist does not count it', (_, file, cls) => {
    const { problems } = ratchet(tree({ [file]: page(cls) }), [])
    expect(problems).toEqual([`${file}:2 ${cls} is a Tailwind palette colour; use a token, or allow it with its reason`])
  })

  // The status map keeps the light green, red, blue and green tones and
  // their 20 per cent tints for the navy heroes of the tournament and manage
  // pages and for StatusBadge's navy surface. A new page that writes one is
  // a raw emerald or red class outside the allowlist like any other: on a
  // light card a light red word is unreadable, and nothing there is navy.
  it.each([
    ['a light green word', c('text-emerald', '-300')],
    ['a green tint', c('bg-emerald', '-500/20')],
    ['a light red word', c('text-red', '-300')],
    ['a red tint', c('bg-red', '-500/20')],
    ['a light blue word', c('text-blue', '-200')],
    ['a blue tint', c('bg-blue', '-500/20')],
    ['a light green tag', c('text-green', '-300')],
    ['a green tag\'s tint', c('bg-green', '-500/20')],
  ])('fails on %s in a new page, though the status map keeps the class on the navy heroes and StatusBadge', (_, cls) => {
    const { problems } = ratchet(tree({ 'src/pages/Planted.tsx': page(cls) }), [])
    expect(problems).toEqual([`src/pages/Planted.tsx:2 ${cls} is a Tailwind palette colour; use a token, or allow it with its reason`])
  })

  it.each([
    ['the print page\'s old grey words, which the status map now writes as text-quiet-600', 'src/pages/TournamentPrintPage.tsx', c('text-gray', '-600')],
    ['the print page\'s grey rules', 'src/pages/Planted.tsx', c('border-gray', '-300')],
    ['the external-event dot', 'src/pages/Planted.tsx', c('bg-slate', '-400')],
    ['StatusBadge\'s light green', 'src/components/Planted.tsx', c('bg-emerald', '-100')],
    ['StatusBadge\'s light red words', 'src/components/Planted.tsx', c('text-red', '-700')],
    ['the check-in toggle\'s old fill, which the status map now writes as bg-ok-fill', 'src/pages/TournamentManagePage.tsx', c('bg-emerald', '-600')],
    ['the check-in toggle\'s hover line, in another string of its own file', 'src/pages/TournamentManagePage.tsx', c('border-emerald', '-600/50')],
    ['the light red word of the manage page\'s navy hero, in another string of its own file', 'src/pages/TournamentManagePage.tsx', c('text-red', '-300')],
    ['the light green word of the tournament page\'s navy hero, in another string of its own file', 'src/pages/TournamentDetailPage.tsx', c('text-emerald', '-300')],
    ['the 20 per cent green tint of StatusBadge\'s navy surface, in another string of its own file', 'src/components/StatusBadge.tsx', c('bg-emerald', '-500/20')],
  ])('fails on %s outside the file or the one string the status map keeps it in', (_, file, cls) => {
    const { problems } = ratchet(tree({ [file]: page(cls) }), [])
    expect(problems).toEqual([`${file}:2 ${cls} is a Tailwind palette colour; use a token, or allow it with its reason`])
  })

  it('keeps a light tone of the navy hero in its own string, and fails on the same class in a second string beside it', () => {
    const word = c('text-red', '-300')
    const kept = `rounded-full px-2 py-0.5 text-xs font-medium ${c('bg-red', '-500/20')} ${word}`
    const source = `${page(kept)}export const Other = () => <p className="p-1 ${word}">y</p>\n`
    const { problems } = ratchet(tree({ 'src/pages/TournamentManagePage.tsx': source }), [])
    expect(problems).toEqual([`src/pages/TournamentManagePage.tsx:4 ${word} is a Tailwind palette colour; use a token, or allow it with its reason`])
  })

  it('keeps the check-in toggle\'s hover line in its own string, and fails when a second string holds the text the keep entry names', () => {
    const hover = c('hover:border-emerald', '-600/50')
    const kept = `border-border text-muted-foreground ${hover}`
    expect(ratchet(tree({ 'src/pages/TournamentManagePage.tsx': page(kept) }), []).problems).toEqual([])
    // A copy of the kept string elsewhere in the file: the keep entry would
    // match both, so it allows neither and says why.
    const source = `${page(kept)}export const Copy = () => <p className="${kept}">y</p>\n`
    expect(ratchet(tree({ 'src/pages/TournamentManagePage.tsx': source }), []).problems).toEqual([
      'src/pages/TournamentManagePage.tsx: 2 strings contain "hover:border-emerald-600/50"; a keep entry names exactly one',
    ])
  })

  describe('colour classes in every way Tailwind writes them', () => {
    let colourOf: (cls: string) => string | null
    beforeAll(async () => {
      // Tailwind's own theme, so the check below uses Tailwind's own reading of each class.
      const compiler = await compile(`${read('node_modules/tailwindcss/theme.css')}\n@tailwind utilities;`, {
        base: ROOT,
        loadStylesheet: async () => ({ content: '', base: ROOT, path: '' }),
      })
      colourOf = (cls) => compiler.build([cls]).match(/(?:^|[\s;{])(color|background-color|border-[a-z-]*color|--tw-[a-z-]*color|fill|stroke|accent-color|outline-color|text-decoration-color|caret-color|--tw-shadow|box-shadow|--tw-mask-[a-z-]+):\s*[^;]*(?:var\(--color-[a-z]+-\d+\)|#[0-9a-f]{3,8}\b)/i)?.[1] ?? null
    })

    it.each([
      ['a hex colour with a type hint', c('text-[color:#', '123456]')],
      ['a hex ground with a type hint, behind a variant', c('hover:bg-[color:#', 'abcdef]')],
      ['a hex colour as an arbitrary property', c('[color:#', '123456]')],
      ['a hex ground as an arbitrary property, behind a variant', c('md:[background-color:#', 'abcdef]')],
      ['a hex colour inside a longer value', c('shadow-[0_0_0_1px_#', '123456]')],
      ['a hex colour in capitals', c('text-[#', 'ABCDEF]')],
      ['a palette colour on a text shadow', c('text-shadow-', 'red-500')],
      ['a palette colour on a logical border', c('border-bs-', 'emerald-700')],
      ['a palette colour on a scrollbar', c('scrollbar-thumb-', 'red-300')],
      ['a palette colour on a mask\'s edge', c('mask-l-from-', 'emerald-100')],
    ])('fails on %s, which Tailwind builds as a colour', (_, cls) => {
      expect(colourOf(cls), `Tailwind should build ${cls} as a colour`).not.toBeNull()
      const { problems } = ratchet(tree({ 'src/pages/Planted.tsx': page(cls) }), [])
      expect(problems).toHaveLength(1)
      expect(problems[0]).toMatch(new RegExp(`^src/pages/Planted\\.tsx:2 ${cls.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')} is a (hex|Tailwind palette) colour;`))
    })

    it.each([
      ['a token colour', 'text-ok-700'],
      ['a token tint with a modifier', 'bg-ink/[0.04]'],
      ['the brand navy that stays navy', 'bg-brand-navy'],
      ['a token whose name ends in a palette colour', 'bg-ok-green-100'],
      ['words in an arbitrary content value', c('before:content-[\'#', '123\']')],
    ])('passes %s', (_, cls) => {
      expect(ratchet(tree({ 'src/pages/Planted.tsx': page(cls) }), []).problems).toEqual([])
    })
  })
})

describe('the gold hex text classes are raw to the ratchet again (step 25)', () => {
  // Step 25 moved the 34 gold hex text classes to the gold tokens and took
  // their 23 entries out of the allowlist, so the list no longer allows any
  // of them: one written back fails in the very file that held it, with the
  // committed allowlist, and the gold tokens that took their place are not
  // raw. The class names are put together when the test runs, so Tailwind,
  // which reads this file, builds no CSS for them.
  const work = mkdtempSync(join(tmpdir(), 'raw-colours-gold-'))
  afterAll(() => rmSync(work, { recursive: true, force: true }))
  let n = 0
  const c = (...parts: string[]) => parts.join('')
  function tree(files: Record<string, string>): string {
    const root = join(work, `t${n++}`)
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    return root
  }
  const page = (classes: string) => `export function Planted() {\n  return <div className="p-4 ${classes}">x</div>\n}\n`
  const GOLD_HEX = /#(?:7a5c00|f0d07a|8a6d1f)\b/i

  it('no allowlist entry names a gold hex colour, in any form, and no keep entry of either map does', () => {
    expect(allowlist.filter((e) => GOLD_HEX.test(e.class))).toEqual([])
    for (const path of [DEFAULT_MAP, STATUS_MAP]) {
      const m = loadMap(path)
      expect(m.keep.filter((k) => GOLD_HEX.test(JSON.stringify(k))), path).toEqual([])
    }
    // Nor does the tree hold one: the hex colours left are the four the ratchet test above names.
    expect(rawUses(ROOT).filter((u) => GOLD_HEX.test(u.token))).toEqual([])
  })

  it.each([
    ['the audit log\'s dark gold words', 'src/areas/admin/components/AuditLogPanel.tsx', '', '7a5c00'],
    ['StatusBadge\'s light gold words', 'src/components/StatusBadge.tsx', '', '7a5c00'],
    ['the add-seat pill\'s hover words', 'src/areas/admin/components/MemberSeatsCell.tsx', 'hover:', '7a5c00'],
    ['the LCA pill on the tournaments page', 'src/pages/TournamentsPage.tsx', '', '7a5c00'],
    ['the hero eyebrow\'s light gold', 'src/components/PageHero.tsx', '', 'f0d07a'],
    ['the home page hero\'s pill', 'src/pages/HomePage.tsx', '', 'f0d07a'],
    ['the club page\'s Upcoming badge', 'src/pages/ClubDetailPage.tsx', '', '8a6d1f'],
  ])('fails on %s written back as a hex colour in its own file, with the committed allowlist', (_, file, variant, hex) => {
    const cls = c(variant, 'text-[#', hex, ']')
    const { problems } = ratchet(tree({ [file]: page(cls) }), allowlist.filter((e) => e.file === file))
    expect(problems.filter((p) => p.includes(cls))).toEqual([`${file}:2 ${cls} is a hex colour; use a token, or allow it with its reason`])
  })

  it.each([
    ['the badge words', 'text-gold-ink-badge'],
    ['the hover form of the badge words', 'hover:text-gold-ink-badge'],
    ['the club badge\'s words', 'text-gold-ink-badge-club'],
    ['the pill\'s light gold', 'text-gold-on-dark-badge'],
    ['gold-ink', 'text-gold-ink'],
  ])('passes %s, a gold token', (_, cls) => {
    expect(rawKind(parseToken(cls)), cls).toBeNull()
    expect(ratchet(tree({ 'src/pages/Planted.tsx': page(cls) }), []).problems).toEqual([])
  })
})

describe('club colours stay user data', () => {
  it('no class is built from a value at run time, so a club colour can only be an inline style', () => {
    const built: string[] = []
    for (const file of tsxFiles(ROOT)) {
      for (const s of classStrings(file, read(file))) {
        // A class that runs into a ${} substitution: "-[" or "-[#" right before it.
        if (s.joinedEnd && /-\[#?$/.test(s.text)) built.push(`${file}: ${s.text.slice(-40)}`)
      }
    }
    expect(built).toEqual([])
  })

  it('no colour class is put together around a ${} either, so the ratchet reads every colour class whole', () => {
    // The old classes still reach the built CSS (the maps and the tests name
    // them), so text-${tone}-700 would paint emerald while no scan of the
    // strings could see it. A string that ends in a colour utility's name
    // before a ${}, or starts with the rest of a colour class after one, is
    // such a class.
    const prefix = new RegExp(`(?:^|\\s)(?:[^\\s]*:)?!?${COLOUR_PREFIX}-(?:[a-z]+-)?$`)
    const rest = new RegExp(`^-?(?:(?:${FAMILIES.join('|')})-)?(?:50|[1-9]00|950)(?:/\\S*)?(?:\\s|$)`)
    const built: string[] = []
    for (const file of tsxFiles(ROOT)) {
      for (const s of classStrings(file, read(file))) {
        if (s.joinedEnd && prefix.test(s.text)) built.push(`${file}: ...${s.text.slice(-30)}\${`)
        if (s.joinedStart && rest.test(s.text)) built.push(`${file}: }${s.text.slice(0, 30)}...`)
      }
    }
    expect(built).toEqual([])
    // The two patterns find what they look for.
    expect(prefix.test('rounded text-')).toBe(true)
    expect(prefix.test('hover:bg-emerald-')).toBe(true)
    expect(prefix.test('/admin/tournaments/')).toBe(false)
    expect(rest.test('-700 font-medium')).toBe(true)
    expect(rest.test('-100/50')).toBe(true)
    expect(rest.test('-us-chess-upload.zip')).toBe(false)
  })

  it('the hex values that are not classes are inline styles or data, such as the club colour picker\'s placeholder', () => {
    // Confirmed for step 24: AdminClubPage gives the colour input placeholder="#c8a94a", and AdminPage falls back to it for a club's swatch.
    expect(read('src/pages/AdminClubPage.tsx')).toContain('placeholder="#c8a94a"')
    expect(read('src/pages/AdminPage.tsx')).toContain("style={{ backgroundColor: club.color || '#c8a94a' }}")
    // The club colour helpers turn a club's colour into inline style objects.
    expect(read('src/areas/clubs/clubColors.ts')).toMatch(/export function clubCardStyle\(color\?: string \| null\): React\.CSSProperties/)
  })
})
