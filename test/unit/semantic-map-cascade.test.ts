// test/unit/semantic-map-cascade.test.ts
//
// WS01 step 23: with newLook off, the renamed colour classes change nothing
// on the page, at the level of whole elements and not only of single pairs.
// semantic-map.test.ts proves each written class paints the colour of the
// class it replaced; three things could still change what an element shows:
//
// - a variant form (hover:, md:hover:, [&_a]:) built differently for the
//   new name than for the old one;
// - tailwind-merge (cn) reading a new name as a different kind of class
//   than the old one, and so keeping or dropping a different rival;
// - CSS order: Tailwind writes rival utilities of one property in the order
//   of their names, so a rename can move a class past a rival (bg-surface
//   sorts before bg-transparent, bg-white after it). Where two rivals can
//   apply to one element and no cn() call settles them first, the winner
//   would change.
//
// Each is checked over every className in the TSX files, read with the
// TypeScript parser (test/unit/helpers/jsxClasses.ts).
import { compile } from 'tailwindcss'
import { twMerge } from 'tailwind-merge'
import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_MAP, classStrings, loadMap, parseToken, tokensOf, tsxFiles, withUtility, type ClassToken } from '../../scripts/codemods/semantic-colours'
import { indexCssRules, read, ROOT, rootTokens, stripComments, substitute } from './helpers/cssTokens'
import { classAttributes, exclusive, goldButton, merged, type ClassAttribute, type Piece } from './helpers/jsxClasses'

const map = loadMap(DEFAULT_MAP)

/** Each utility the map writes, with the one it replaced. */
const OLD_NAME = new Map<string, string>()
for (const r of map.rules) OLD_NAME.set(r.to, r.from)
for (const s of map.sites) OLD_NAME.set(parseToken(s.to).utility, parseToken(s.from).utility)

/** A class as it was written before the step: the written utility swapped back, everything else kept. */
const before = (cls: string) => {
  const t = parseToken(cls)
  const old = OLD_NAME.get(t.utility)
  return old ? withUtility(t, old) : cls
}

const legacy = rootTokens(indexCssRules(), { look: false, dark: false })

let compiler: Awaited<ReturnType<typeof compile>>
beforeAll(async () => {
  const css = stripComments(read('src/index.css'))
  const variant = css.match(/@custom-variant dark [^;]+;/)?.[0]
  const blocks = [...css.matchAll(/^@theme(?: inline)? \{[\s\S]*?^\}/gm)].map((m) => m[0])
  if (!variant || blocks.length !== 2) throw new Error('index.css should hold one dark variant and two @theme blocks')
  compiler = await compile(`${read('node_modules/tailwindcss/theme.css')}\n${variant}\n${blocks.join('\n')}\n@tailwind utilities;`, {
    base: ROOT,
    loadStylesheet: async () => ({ content: '', base: ROOT, path: '' }),
  })
})

const escapeClass = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

interface LeafRule {
  /** The at-rules around the declarations, outermost first. */
  within: string[]
  selector: string
  /** The declarations, "property: value" joined with "; ". */
  body: string
}

/**
 * Every set of declarations in a stylesheet with its selector and the
 * at-rules around it, following Tailwind's nesting: an @supports block inside
 * a rule belongs to that rule's selector, and "&" stands for the parent.
 */
function leafRules(css: string, within: string[] = [], selector = ''): LeafRule[] {
  const out: LeafRule[] = []
  const decls: string[] = []
  let start = 0
  let i = 0
  while (i < css.length) {
    if (css[i] === ';') {
      decls.push(css.slice(start, i).trim())
      start = ++i
      continue
    }
    if (css[i] !== '{') {
      i++
      continue
    }
    const prelude = css.slice(start, i).trim()
    let depth = 1
    let j = i + 1
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++
      else if (css[j] === '}') depth--
      j++
    }
    const body = css.slice(i + 1, j - 1)
    if (prelude.startsWith('@')) {
      out.push(...leafRules(body, [...within, prelude], selector))
    } else {
      // An unescaped & stands for the parent selector; "\&" is part of a class name, as in [&_a]:.
      const parent = /(?<!\\)&/
      const inner = parent.test(prelude) ? prelude.replace(new RegExp(parent, 'g'), selector) : selector ? `${selector} ${prelude}` : prelude
      out.push(...leafRules(body, within, inner))
    }
    start = i = j
  }
  const own = [...decls, css.slice(start).trim()].filter(Boolean)
  if (own.length > 0 && selector) out.unshift({ within, selector, body: own.map((d) => d.replace(/\s+/g, ' ')).join('; ') })
  return out
}

/**
 * The rules one class compiles to, with its own name written as ".X" and
 * every var() replaced from the plain :root and the theme values Tailwind
 * emitted, so two classes can be compared by what they do.
 */
function compiled(cls: string): LeafRule[] {
  const rules = leafRules(stripComments(compiler.build([cls])))
  const vars = new Map(legacy)
  for (const r of rules) {
    if (r.selector !== ':root, :host') continue
    for (const d of r.body.split('; ')) {
      const colon = d.indexOf(':')
      vars.set(d.slice(0, colon).trim(), d.slice(colon + 1).trim())
    }
  }
  const name = `.${escapeClass(cls)}`
  const own = new RegExp(`${escapeRegExp(name)}(?![\\\\\\w-])`)
  return rules
    .filter((r) => own.test(r.selector))
    .map((r) => ({
      within: r.within,
      selector: r.selector.split(name).join('.X'),
      body: r.body
        .split('; ')
        .map((d) => {
          const colon = d.indexOf(':')
          return `${d.slice(0, colon).trim()}: ${substitute(d.slice(colon + 1).trim(), vars)}`
        })
        .join('; '),
    }))
}

/** Every class the TSX files write with a written utility, as written: variants and modifiers included. */
function writtenForms(): string[] {
  const forms = new Set<string>()
  for (const file of tsxFiles(ROOT)) {
    for (const s of classStrings(file, read(file))) {
      for (const { token } of tokensOf(s.value)) if (OLD_NAME.has(token.utility)) forms.add(token.text)
    }
  }
  return [...forms].sort()
}

describe('every written form builds the rule its old form built', () => {
  const forms = writtenForms()

  it('finds the variant forms the files use, not only the plain ones', () => {
    expect(forms).toContain('hover:text-ink')
    expect(forms).toContain('[&_a]:text-ink')
    expect(forms).toContain('hover:bg-brand-navy/90')
    expect(forms).toContain('hover:bg-surface')
    // 19 when step 23 was built; step 24 moved the seven faint navy tints
    // (bg-brand-navy/5 and the rest) on to the ink, and its map's own forms
    // are checked the same way in semantic-map.test.ts.
    expect(forms.length).toBeGreaterThanOrEqual(12)
  })

  it('the comparison tells two different colours apart, and two different variants', () => {
    expect(compiled('bg-brand-navy/5').map((r) => r.body)).not.toEqual(compiled('bg-lca-gold/5').map((r) => r.body))
    expect(compiled('hover:text-ink').map((r) => r.within)).not.toEqual(compiled('text-ink').map((r) => r.within))
    expect(compiled('[&_a]:text-ink').map((r) => r.selector)).toEqual(['.X a'])
  })

  it.each(forms.map((f) => [f, before(f)]))('%s builds the selector and at-rules %s built, and paints the same colour', (now, was) => {
    const a = compiled(was)
    const b = compiled(now)
    expect(b.length, `${now} compiled to nothing`).toBeGreaterThan(0)
    expect(b.map((r) => [r.within, r.selector])).toEqual(a.map((r) => [r.within, r.selector]))
    const tokenUtility = !parseToken(now).utility.includes('brand-')
    b.forEach((rule, i) => {
      if (parseToken(now).modifier && tokenUtility && !rule.within.some((w) => w.startsWith('@supports'))) {
        // The fallback before @supports, for browsers that cannot mix colours: a
        // token utility falls back to its token at full strength. semantic-map.test.ts
        // holds these to text-ink/80 and bg-surface/90 (recorded under step 23).
        expect(rule.body, now).toMatch(/^(color|background-color): #[0-9a-f]+$/)
        return
      }
      expect(rule.body, now).toBe(a[i].body)
    })
  })
})

// ── tailwind-merge ─────────────────────────────────────────────────────────

/** Rivals and look-alikes: colour classes the files use, and classes of other kinds that share a prefix. */
const RIVALS = [
  'text-white', 'text-white/80', 'text-lca-gold', 'text-muted-foreground', 'text-foreground', 'text-destructive', 'text-emerald-800',
  'text-sm', 'text-xs', 'text-2xl', 'text-center', 'text-left',
  'bg-lca-gold', 'bg-lca-gold/20', 'bg-muted', 'bg-card', 'bg-background', 'bg-transparent', 'bg-emerald-50', 'bg-white/10',
  'bg-cover', 'bg-center', 'bg-no-repeat', 'bg-contain', 'bg-clip-padding',
]

describe('tailwind-merge reads each written class exactly as it read the class it replaced', () => {
  it.each(writtenForms())('%s, against every rival and look-alike, in either order', (now) => {
    const was = before(now)
    for (const rival of RIVALS) {
      // A rival takes the same variants as the class, or it would not compete with it.
      const r = `${parseToken(now).variants}${rival}`
      for (const [first, second] of [[r, now], [now, r]] as const) {
        const result = twMerge(`${first} ${second}`).split(' ').map(before).join(' ')
        const old = twMerge(`${first === now ? was : first} ${second === now ? was : second}`)
        expect(result, `${first} ${second}`).toBe(old)
      }
    }
  })

  it('the rivals include classes tailwind-merge keeps beside a colour, so the check can tell the two apart', () => {
    expect(twMerge('text-ink text-sm')).toBe('text-ink text-sm')
    expect(twMerge('text-white text-ink')).toBe('text-ink')
    expect(twMerge('bg-surface bg-cover')).toBe('bg-surface bg-cover')
    expect(twMerge('bg-lca-gold bg-brand-navy')).toBe('bg-brand-navy')
    expect(twMerge('bg-muted bg-brand-navy/5')).toBe('bg-brand-navy/5')
  })
})

// ── CSS order ──────────────────────────────────────────────────────────────

const propertyCache = new Map<string, string | null>()
/** The colour property a bare utility sets, or null when it sets none. */
function colourProperty(utility: string): string | null {
  if (!propertyCache.has(utility)) {
    const rule = leafRules(stripComments(compiler.build([utility]))).find((r) => r.selector === `.${escapeClass(utility)}`)
    const prop = rule?.body.match(/^(color|background-color|border-color|outline-color|fill|stroke|text-decoration-color|--tw-ring-color):/)?.[1]
    propertyCache.set(utility, prop ?? null)
  }
  return propertyCache.get(utility)!
}

/** Where Tailwind writes a bare utility's rule; of two rivals, the later one wins. */
function position(utility: string): number {
  const at = compiler.build([utility]).indexOf(`.${escapeClass(utility)} {`)
  if (at < 0) throw new Error(`${utility} did not compile`)
  return at
}

interface Rival {
  where: string
  a: string
  b: string
  pa: Piece
  pb: Piece
}

const bare = (t: ClassToken) => withUtility({ ...t, variants: '', bang: '' }, t.utility)

/**
 * Pairs of classes in one className that set the same colour property under
 * the same variants, where at least one was renamed and the CSS order of the
 * two differs from the order of the classes they replaced.
 */
function flippedPairs(attrs: ClassAttribute[]): Rival[] {
  const out: Rival[] = []
  for (const attr of attrs) {
    const toks = attr.pieces.flatMap((piece) => tokensOf(piece.text).map(({ token }) => ({ token, piece })))
    for (let i = 0; i < toks.length; i++) {
      for (let j = i + 1; j < toks.length; j++) {
        const x = toks[i]
        const y = toks[j]
        if (x.token.text === y.token.text) continue
        if (!OLD_NAME.has(x.token.utility) && !OLD_NAME.has(y.token.utility)) continue
        if (x.token.variants !== y.token.variants || x.token.bang !== y.token.bang) continue
        const prop = colourProperty(bare(x.token))
        if (!prop || prop !== colourProperty(bare(y.token))) continue
        const now = Math.sign(position(bare(x.token)) - position(bare(y.token)))
        const was = Math.sign(position(before(bare(x.token))) - position(before(bare(y.token))))
        if (now !== was) out.push({ where: `${attr.file}:${attr.line}`, a: x.token.text, b: y.token.text, pa: x.piece, pb: y.piece })
      }
    }
  }
  return out
}

/** A changed order matters only where both classes can apply together and no cn() call settles them first. */
const unsettled = (r: Rival) => !exclusive(r.pa, r.pb) && !merged(r.pa, r.pb)

describe('no element changes its winning colour through CSS order', () => {
  it('the check finds a planted pair, and knows that cn() and exclusive branches settle one', () => {
    const planted = [
      "import { cn } from '@/lib/utils'",
      'export function Planted({ on }: { on: boolean }) {',
      '  return (',
      '    <div>',
      '      <p className="bg-transparent bg-surface">plain</p>',
      "      <p className={cn('bg-transparent', on && 'bg-surface')}>merged</p>",
      "      <p className={on ? 'bg-transparent' : 'bg-surface'}>exclusive</p>",
      "      <p className={`bg-transparent ${on ? 'bg-surface' : ''}`}>template</p>",
      '    </div>',
      '  )',
      '}',
    ].join('\n')
    const flips = flippedPairs(classAttributes('src/pages/Planted.tsx', planted))
    expect(flips.map((f) => f.where)).toEqual([5, 6, 7, 8].map((n) => `src/pages/Planted.tsx:${n}`))
    expect(flips.filter(unsettled).map((f) => f.where)).toEqual(['src/pages/Planted.tsx:5', 'src/pages/Planted.tsx:8'])
  })

  let flips: Rival[] = []
  beforeAll(() => {
    flips = tsxFiles(ROOT).flatMap((file) => flippedPairs(classAttributes(file)))
  })

  it('every rival pair whose order the rename changed is settled by cn() or never applies together', () => {
    expect(flips.filter(unsettled).map((f) => `${f.where} ${f.a} / ${f.b}`)).toEqual([])
  })

  it('dark:text-white, on the navy Buttons whose variant label is text-primary-foreground, comes later in the stylesheet, so it wins when .dark is set', () => {
    // With newLook off .dark is never set, so the label stays text-primary-foreground.
    const css = compiler.build(['text-primary-foreground', 'dark:text-white'])
    const label = css.indexOf('.text-primary-foreground {')
    const dark = css.indexOf('.dark\\:text-white:where(.dark, .dark *) {')
    expect(label).toBeGreaterThan(-1)
    expect(dark).toBeGreaterThan(label)
  })

  it('the pairs that did change order sit inside cn(), where tailwind-merge keeps the later one, as it did before', () => {
    // When the step was built these were selected and plain controls in one cn() call.
    expect(flips.length).toBeGreaterThan(0)
    for (const f of flips) {
      expect(merged(f.pa, f.pb), `${f.where} ${f.a} / ${f.b}`).toBe(true)
      expect(twMerge(`${f.a} ${f.b}`).split(' ').map(before).join(' ')).toBe(twMerge(`${before(f.a)} ${before(f.b)}`))
    }
  })
})

describe('what this test reads', () => {
  it('reads every TSX file under src, and follows GOLD_BUTTON into src/lib/brand.ts', () => {
    const files = tsxFiles(ROOT)
    expect(files.length).toBeGreaterThan(100)
    const attrs = files.flatMap((f) => classAttributes(f))
    expect(attrs.length).toBeGreaterThan(1000)
    expect(attrs.filter((a) => a.pieces.some((p) => p.text === goldButton())).length).toBeGreaterThan(10)
  })
})
