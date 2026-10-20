// test/unit/semantic-colours-edges.test.ts
//
// The edges of scripts/codemods/semantic-colours.ts beyond the fixture run in
// semantic-map.test.ts. The script is reused with a second map in step 24,
// so what it refuses and what it leaves alone matter beyond this step:
//
// - the command line: an unknown flag, --dry-run with --check, a flag with
//   no value, a stray word, each print the usage and exit 1 with nothing written;
// - the map: each kind of mistake is named, all of them in one message;
// - the navy-on-gold rule needs an opaque gold with no variant or the class's
//   own variant, so a tint and a gold that shows only at md: do not count,
//   while an important gold is still an opaque gold;
// - what is not a class string (JSX text, a regular expression, a comment's
//   prose) is left alone, and neither rewritten nor reported;
// - a class joined to a ${} on either side stops the run, and a problem in
//   one file stops it before any file is written;
// - several classes in one string, arbitrary variants with colons and
//   brackets, the ! mark at either end and CRLF line endings come out right;
// - only .tsx files under src are searched, never node_modules or dist;
// - a keep entry keeps only the opacity forms it names;
// - --check on the real tree passes.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { loadMap, parseToken, planRewrite, withUtility, type ColourMap } from '../../scripts/codemods/semantic-colours'
import { ROOT } from './helpers/cssTokens'

/**
 * A class name no page uses, put together when the test runs. Tailwind reads
 * this file for class names as it reads the pages, and would otherwise build
 * CSS for each of these into the site.
 */
const c = (...parts: string[]) => parts.join('')

const work = mkdtempSync(join(tmpdir(), 'semantic-colours-edges-'))
afterAll(() => rmSync(work, { recursive: true, force: true }))
let n = 0

const MAP: ColourMap = {
  watch: ['text-lca-navy', 'bg-white', 'bg-lca-navy'],
  rules: [
    { id: 'navy-on-gold', from: 'text-lca-navy', opacity: 'none', when: { sameString: ['bg-lca-gold'] }, to: 'text-brand-navy', reason: 'navy on gold' },
    { id: 'ink', from: 'text-lca-navy', opacity: 'any', to: 'text-ink', reason: 'ink' },
    { id: 'surface', from: 'bg-white', opacity: 'none', to: 'bg-surface', reason: 'surface' },
    { id: 'navy-ground', from: 'bg-lca-navy', opacity: 'none', to: 'bg-brand-navy', reason: 'navy ground' },
    { id: 'navy-tint', from: 'bg-lca-navy', opacity: 'translucent', to: 'bg-brand-navy', reason: 'navy tint' },
  ],
  sites: [],
  keep: [],
}

/** A fresh fixture root with these files and a map; returns its folder. */
function tree(files: Record<string, string>, colourMap: unknown = MAP): string {
  const root = join(work, `t${n++}`)
  for (const [path, text] of Object.entries({ ...files, 'map.json': JSON.stringify(colourMap, null, 2) })) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return root
}

const run = (...args: string[]) =>
  spawnSync(process.execPath, ['--no-warnings', '--experimental-strip-types', 'scripts/codemods/semantic-colours.ts', ...args], { cwd: ROOT, encoding: 'utf8' })

const runOn = (root: string, ...args: string[]) => run('--root', root, '--map', join(root, 'map.json'), ...args)

/** The plan for one file's source under MAP, as "from -> to" pairs, with the problems. */
function planFor(source: string, colourMap: ColourMap = MAP) {
  const root = tree({ 'src/pages/Edge.tsx': source })
  const plan = planRewrite(root, colourMap)
  return {
    rewrites: plan.edits.map((e) => `${e.from} -> ${e.to}`),
    kept: plan.kept.map((k) => k.token),
    problems: plan.problems.map((p) => p.message),
    after: plan.contents.get('src/pages/Edge.tsx') ?? source,
  }
}

const component = (body: string) => `export function Edge({ on, x }: { on: boolean; x: string }) {\n  return (${body})\n}\n`

describe('the command line', () => {
  const USAGE = 'Usage: node --no-warnings --experimental-strip-types scripts/codemods/semantic-colours.ts'

  it.each([
    ['an unknown flag', ['--write']],
    ['--dry-run with --check', ['--dry-run', '--check']],
    ['--map with no value', ['--map']],
    ['--root followed by another flag', ['--root', '--check']],
    ['a stray word', ['src']],
  ])('%s prints the usage and exits 1', (_, args) => {
    const root = tree({ 'src/pages/Edge.tsx': component('<p className="bg-white">x</p>') })
    const r = run(...args)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain(USAGE)
    expect(readFileSync(join(root, 'src/pages/Edge.tsx'), 'utf8')).toContain('bg-white')
  })

  it('a map that is not JSON stops the run with nothing written', () => {
    const root = tree({ 'src/pages/Edge.tsx': component('<p className="bg-white">x</p>') })
    writeFileSync(join(root, 'map.json'), '{ "watch": [')
    const r = runOn(root)
    expect(r.status).toBe(1)
    expect(readFileSync(join(root, 'src/pages/Edge.tsx'), 'utf8')).toContain('bg-white')
  })

  it('--check on the real tree passes: nothing left to rewrite, every kept class covered', () => {
    const r = run('--check')
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(r.stdout).toMatch(/^Check \(nothing written\): 0 rewrites in 0 files, \d+ kept, \d+ files searched\./)
    expect(r.stdout).toContain('Problems: 0')
  })
})

describe('the map', () => {
  const problemsOf = (m: unknown) => {
    const path = join(tree({}, m), 'map.json')
    try {
      loadMap(path)
      return ''
    } catch (e) {
      return (e as Error).message
    }
  }

  it('names each kind of mistake, all of them in one message', () => {
    const message = problemsOf({
      watch: ['text-lca-navy'],
      rules: [
        { id: 'a', from: 'text-lca-navy', opacity: 'any', to: 'text-ink', reason: 'r' },
        { id: 'a', from: 'hover:text-lca-navy', opacity: 'half', to: c('bg-', 'ink', '/5'), reason: 'r' },
        { id: 'b', from: 'text-lca-navy', opacity: 'none', to: 'text-ink', when: { sameString: [] }, reason: 'r' },
      ],
      sites: [
        { file: 'src/pages/Edge.ts', contains: 'p-4', from: 'bg-white', to: 'bg-surface', reason: 'r' },
        { file: '../src/pages/Edge.tsx', contains: 'p-4', from: 'bg-white', to: 'bg-white', reason: 'r' },
        { file: 'src/pages/Edge.tsx', contains: 'p-4', from: 'bg-white extra', to: 'bg-surface', reason: 'r' },
      ],
      keep: [
        { class: 'bg-white', opacity: 'none', file: 'src/pages/Edge.tsx', reason: 'r' },
        { class: 'bg-white/10', opacity: 'none', reason: 'r' },
      ],
    })
    for (const piece of [
      'rules[1] (a): the id is used twice',
      'rules[1] (a): from and to must be utility names, without a variant or modifier',
      'rules[1] (a): opacity must be "none", "translucent", "any" or a list of modifiers',
      'rules[2] (b): when.sameString must list utility names',
      'sites[0]: file must be a .tsx path relative to the root',
      'sites[1]: file must be a .tsx path relative to the root',
      'sites[1]: from and to are the same',
      'sites[2]: from and to must be single class tokens',
      'keep[0]: give both file and contains, or neither',
      'keep[1]: class must be a utility name, without a variant or modifier',
    ]) expect(message, piece).toContain(piece)
  })

  it('needs at least one watched class, and a reason on every entry', () => {
    expect(problemsOf({ watch: [], rules: [], sites: [], keep: [] })).toContain('watch must list one or more utility names')
    expect(problemsOf({ ...MAP, keep: [{ class: 'bg-white', opacity: 'translucent', reason: '  ' }] })).toContain('keep[0]: a reason is needed')
  })

  it('the committed map loads, and every reason says why in a sentence', () => {
    const m = loadMap(join(ROOT, 'scripts/codemods/semantic-colours.map.json'))
    for (const entry of [...m.rules, ...m.sites, ...m.keep]) {
      expect(entry.reason.length, JSON.stringify(entry)).toBeGreaterThan(40)
      expect(entry.reason).toMatch(/\.$/)
      expect(entry.reason).not.toContain('\u2014')
    }
  })
})

describe('navy on gold needs an opaque gold the class can see', () => {
  it.each([
    ['an opaque gold in the string', 'bg-lca-gold text-lca-navy', 'text-lca-navy -> text-brand-navy'],
    ['a gold tint', 'bg-lca-gold/20 text-lca-navy', 'text-lca-navy -> text-ink'],
    ['a gold that shows only at md:', `${c('md:', 'bg-lca-gold')} text-lca-navy`, 'text-lca-navy -> text-ink'],
    ['the hover gold under the hover text', `${c('hover:', 'bg-lca-gold')} hover:text-lca-navy`, `hover:text-lca-navy -> ${c('hover:', 'text-brand-navy')}`],
    ['a plain gold under md: text', `bg-lca-gold ${c('md:', 'text-lca-navy')}`, `${c('md:', 'text-lca-navy')} -> ${c('md:', 'text-brand-navy')}`],
    ['a navy tint is not gold', `${c('bg-lca-navy', '/10')} text-lca-navy`, 'text-lca-navy -> text-ink'],
  ])('%s', (_, classes, expected) => {
    expect(planFor(component(`<p className="${classes}">x</p>`)).rewrites).toContain(expected)
  })

  it('an important gold is still an opaque gold, so navy text on it stays navy', () => {
    // The ! mark changes which rule wins, not the colour: the text still sits on gold.
    expect(planFor(component(`<p className="${c('!', 'bg-lca-gold')} text-lca-navy">x</p>`)).rewrites).toEqual(['text-lca-navy -> text-brand-navy'])
  })

  it('a gold in another string of the same className does not count', () => {
    const r = planFor(component(`<p className={cn('bg-lca-gold', on && 'text-lca-navy')}>x</p>`))
    expect(r.rewrites).toEqual(['text-lca-navy -> text-ink'])
  })
})

describe('what is not a class string', () => {
  it('JSX text, a regular expression and a comment in prose are left alone and not reported', () => {
    const source = [
      '// The heading used text-lca-navy before; the cards used bg-white.',
      'const pattern = /bg-white|text-lca-navy/',
      'export function Edge() {',
      '  return <p>Use <code>bg-white</code> and text-lca-navy.</p>',
      '}',
      '',
    ].join('\n')
    const r = planFor(source)
    expect(r.rewrites).toEqual([])
    expect(r.problems).toEqual([])
    expect(r.after).toBe(source)
  })

  it('a quoted class in a comment is rewritten, as commented-out code', () => {
    const r = planFor(`${component('<p>x</p>')}// <p className="text-lca-navy">old</p>\n`)
    expect(r.rewrites).toEqual(['text-lca-navy -> text-ink'])
    expect(r.after).toContain('// <p className="text-ink">old</p>')
  })
})

describe('strings that cannot be rewritten safely', () => {
  it.each([
    ['joined on the left', '`${x}bg-white p-2`'],
    ['joined on the right', '`p-2 bg-white${x}`'],
  ])('a class %s of a ${} substitution stops the run', (_, literal) => {
    const r = planFor(component(`<p className={${literal}}>x</p>`))
    expect(r.problems).toEqual(['bg-white runs into a ${} substitution, so it cannot be rewritten safely'])
    expect(r.rewrites).toEqual([])
  })

  it('with a space between them, the class is rewritten', () => {
    const r = planFor(component('<p className={`${x} bg-white p-2 ${on ? "ring-1" : ""}`}>x</p>'))
    expect(r.problems).toEqual([])
    expect(r.rewrites).toEqual(['bg-white -> bg-surface'])
  })

  it('a problem in one file stops the run before any file is written', () => {
    const good = component('<p className="bg-white">x</p>')
    const bad = component('<p className={`${x}bg-white`}>x</p>')
    const root = tree({ 'src/pages/A.tsx': good, 'src/pages/B.tsx': bad })
    const r = runOn(root)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('Nothing was written.')
    expect(readFileSync(join(root, 'src/pages/A.tsx'), 'utf8')).toBe(good)
    expect(readFileSync(join(root, 'src/pages/B.tsx'), 'utf8')).toBe(bad)
  })
})

describe('rewrites that must come out exactly', () => {
  it('several watched classes in one string, each at its own place', () => {
    const r = planFor(component(`<p className="bg-white p-2 text-lca-navy ${c('hover:', 'bg-lca-navy', '/10')} bg-lca-navy">x</p>`))
    expect(r.after).toContain(`className="bg-surface p-2 text-ink ${c('hover:', 'bg-brand-navy', '/10')} bg-brand-navy"`)
  })

  it('arbitrary variants with colons and brackets keep their variant', () => {
    const hover = '[&:hover]:'
    const grid = c('supports-[display', ':grid]:')
    expect(parseToken(c(hover, 'text-lca-navy'))).toMatchObject({ variants: hover, utility: 'text-lca-navy', modifier: '' })
    expect(parseToken(c(grid, 'bg-white', '/50'))).toMatchObject({ variants: grid, utility: 'bg-white', modifier: '50' })
    expect(parseToken('bg-lca-navy/[0.04]')).toMatchObject({ variants: '', utility: 'bg-lca-navy', modifier: '[0.04]' })
    const r = planFor(component(`<p className="${c(hover, 'text-lca-navy')} ${c(grid, 'bg-white')}">x</p>`))
    expect(r.after).toContain(`className="${c(hover, 'text-ink')} ${c(grid, 'bg-surface')}"`)
  })

  it('the ! mark stays where it was written', () => {
    expect(withUtility(parseToken(c('md:!', 'bg-white')), 'bg-surface')).toBe(c('md:!', 'bg-surface'))
    const r = planFor(component(`<p className="${c('!', 'bg-white')} ${c('text-lca-navy', '!')}">x</p>`))
    expect(r.after).toContain(`className="${c('!', 'bg-surface')} ${c('text-ink', '!')}"`)
  })

  it('a file with CRLF line endings keeps them, and the lines it reports are right', () => {
    const source = component('<div>\n  <p className="text-lca-navy">x</p>\n</div>').replace(/\n/g, '\r\n')
    const root = tree({ 'src/pages/Edge.tsx': source })
    const plan = planRewrite(root, MAP)
    expect(plan.edits.map((e) => e.line)).toEqual([3])
    expect(plan.contents.get('src/pages/Edge.tsx')).toBe(source.replace('text-lca-navy', 'text-ink'))
  })
})

describe('what is searched', () => {
  it('only .tsx files under src, never node_modules or dist, and never a .ts file', () => {
    const cls = component('<p className="bg-white">x</p>')
    const root = tree({
      'src/pages/Edge.tsx': cls,
      'src/lib/classes.ts': "export const CARD = 'bg-white p-4'\n",
      'src/node_modules/pkg/Thing.tsx': cls,
      'src/dist/Built.tsx': cls,
      'other/Outside.tsx': cls,
    })
    const plan = planRewrite(root, MAP)
    expect(plan.searched).toBe(1)
    expect([...plan.contents.keys()]).toEqual(['src/pages/Edge.tsx'])
  })

  it('a root with no src folder searches nothing and reports nothing', () => {
    const plan = planRewrite(tree({ 'other/Outside.tsx': component('<p className="bg-white">x</p>') }), MAP)
    expect(plan).toMatchObject({ searched: 0, edits: [], kept: [], problems: [] })
    expect(existsSync(join(work, 'src'))).toBe(false)
  })
})

describe('keep entries', () => {
  const scoped: ColourMap = {
    ...MAP,
    keep: [{ file: 'src/pages/Edge.tsx', contains: 'logo-mat', class: 'bg-white', opacity: 'none', reason: 'a logo mat that stays white' }],
  }

  it('a keep entry for the opaque form keeps it and nothing else in its string', () => {
    const veil = c('hover:bg-white', '/50')
    const r = planFor(component(`<div><img className="logo-mat bg-white ${veil}" alt="" /></div>`), scoped)
    expect(r.kept).toEqual(['bg-white'])
    expect(r.problems).toEqual([`${veil} has no rule or keep entry in the map`])
  })

  it('outside the string it names, the class follows the rules', () => {
    const r = planFor(component('<div><img className="logo-mat bg-white" alt="" /><p className="bg-white">x</p></div>'), scoped)
    expect(r.kept).toEqual(['bg-white'])
    expect(r.rewrites).toEqual(['bg-white -> bg-surface'])
  })

  it('a keep entry whose string has gone, or names two strings, stops the run', () => {
    expect(planFor(component('<p className="bg-surface">x</p>'), scoped).problems).toContain('0 strings contain "logo-mat"; a keep entry names exactly one')
    const twice = planFor(component('<div><img className="logo-mat bg-white" alt="" /><img className="logo-mat bg-white" alt="" /></div>'), scoped)
    expect(twice.problems).toContain('2 strings contain "logo-mat"; a keep entry names exactly one')
  })
})
