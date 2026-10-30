// test/unit/source-not-lines.test.ts
//
// The four @source not lines of src/index.css (WS02 step 3, WS01's follow-up
// "Classes only docs and tests name reach the CSS"), read with Tailwind's own
// compiler and its own file scanner, set up the way the build's Tailwind
// plugin sets them up: the whole project is where it looks for class names,
// less what the stylesheet's @source lines take away.
//
// - The four lines sit after the imports, one folder or pattern each, in
//   their order, Tailwind reads them as four places to leave out, and each
//   names something that is there to leave out.
// - The scanner still reads index.html and every file under src/ and
//   functions/ (the page functions among them) that it read without the
//   lines, and no file under docs/, test/ or scripts/ and no Markdown file at
//   the root.
// - Every class name Tailwind finds in a file the site builds is still found,
//   so no class a page writes leaves the stylesheet.
// - No file under src/ imports from a folder the lines leave out.
// - No template string or joined string under src/ glues a value onto the
//   front of a class name Tailwind can build: a class put together while the
//   page runs is written into the stylesheet only when some file spells it
//   whole, and with the lines a test or a document no longer counts.
// - The unit tests' plain reading of src/index.css (test/unit/helpers/
//   cssTokens.ts) keeps every rule and every statement it keeps without the
//   four lines. Its comment stripper keeps a quoted string whole, so it
//   reads the fourth line, "../*.md" and all, as a browser reads it.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { Scanner } from '@tailwindcss/oxide'
import { compile } from 'tailwindcss'
import { beforeAll, describe, expect, it } from 'vitest'
import { parseRules, read, ROOT, stripComments } from './helpers/cssTokens'

const SRC = join(ROOT, 'src')
const CSS = read('src/index.css')
const LINES = ['@source not "../docs";', '@source not "../test";', '@source not "../scripts";', '@source not "../*.md";']
/** What the four lines leave out, as paths from the project's root. */
const LEFT_OUT = (file: string) => /^(docs|test|scripts)\//.test(file) || /^[^/]+\.md$/.test(file)

/** A package's stylesheet, found the way a CSS @import names it: its "style" entry, or the file a subpath names. */
function packageStylesheet(id: string): string {
  const parts = id.split('/')
  const name = id.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
  const subpath = id.slice(name.length + 1)
  const dir = join(ROOT, 'node_modules', name)
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { exports?: Record<string, unknown>; style?: string; main?: string }
  const pick = (entry: unknown): string | undefined => {
    if (typeof entry === 'string') return entry
    if (entry && typeof entry === 'object') {
      const conditions = entry as Record<string, unknown>
      return pick(conditions.style ?? conditions.default)
    }
    return undefined
  }
  if (subpath) return join(dir, pick(pkg.exports?.[`./${subpath}`]) ?? subpath)
  return join(dir, pick(pkg.exports?.['.']) ?? pkg.style ?? pkg.main ?? 'index.css')
}

/** Every stylesheet the site's one imports that could not be read; only the font faces' may be among them. */
const unread: string[] = []

/** Tailwind's compiler over the real src/index.css, its imports read from the packages as the build reads them. */
function siteCompiler(css = CSS) {
  return compile(css, {
    base: SRC,
    loadStylesheet: async (id: string, base: string) => {
      const file = id.startsWith('.') ? resolve(base, id) : packageStylesheet(id)
      if (!file.endsWith('.css') || !existsSync(file)) {
        unread.push(id)
        return { content: '', base, path: '' }
      }
      return { content: readFileSync(file, 'utf8'), base: dirname(file), path: file }
    },
  })
}
type Compiler = Awaited<ReturnType<typeof compile>>

/**
 * The places Tailwind's build plugin hands its scanner: the project, unless
 * the stylesheet names a root of its own, then the stylesheet's @source
 * lines, as @tailwindcss/vite does.
 */
function pluginSources(compiler: Pick<Compiler, 'root' | 'sources'>) {
  const root = compiler.root === 'none' ? [] : compiler.root === null ? [{ base: ROOT, pattern: '**/*', negated: false }] : [{ ...compiler.root, negated: false }]
  return [...root, ...compiler.sources]
}

/** A scanner's files, as paths from the project's root. */
const filesOf = (scanner: Scanner) => scanner.files.map((f) => relative(ROOT, f).split(sep).join('/')).sort()

let compiler: Compiler
let withLines: Scanner
let withoutLines: Scanner
let foundWith: Set<string>
let foundWithout: string[]
beforeAll(async () => {
  compiler = await siteCompiler()
  withLines = new Scanner({ sources: pluginSources(compiler) })
  foundWith = new Set(withLines.scan())
  withoutLines = new Scanner({ sources: pluginSources({ root: compiler.root, sources: [] }) })
  foundWithout = withoutLines.scan()
})

describe('the four lines in src/index.css', () => {
  it('sit together after the imports and before any rule, one folder or pattern each, in their order, and are the only @source lines', () => {
    const lines = CSS.split('\n')
    const at = lines.flatMap((line, i) => (/^\s*@source\b/.test(line) ? [i] : []))
    expect(at.map((i) => lines[i])).toEqual(LINES)
    expect(at[3] - at[0]).toBe(3)
    const lastImport = lines.reduce((last, line, i) => (line.startsWith('@import ') ? i : last), -1)
    const firstBrace = lines.findIndex((line) => line.includes('{'))
    expect(lastImport).toBeGreaterThan(-1)
    expect(at[0]).toBeGreaterThan(lastImport)
    expect(at[3]).toBeLessThan(firstBrace)
  })

  it('are read by Tailwind as four places to leave out, each from the stylesheet\'s own folder', () => {
    expect(compiler.root).toBeNull()
    expect(compiler.sources).toEqual([
      { base: SRC, pattern: '../docs', negated: true },
      { base: SRC, pattern: '../test', negated: true },
      { base: SRC, pattern: '../scripts', negated: true },
      { base: SRC, pattern: '../*.md', negated: true },
    ])
    // Every stylesheet src/index.css imports was read but the font faces', which hold no class.
    expect(unread.filter((id) => !id.startsWith('@fontsource'))).toEqual([])
  })

  it('each name something that is there to leave out: three folders that hold files, and the Markdown records at the root', () => {
    for (const folder of ['docs', 'test', 'scripts']) {
      const path = resolve(SRC, '..', folder)
      expect(statSync(path).isDirectory(), folder).toBe(true)
      expect(readdirSync(path).length, folder).toBeGreaterThan(0)
    }
    const markdown = readdirSync(ROOT).filter((f) => f.endsWith('.md'))
    expect(markdown).toContain('REDESIGN_STATUS.md')
    // Nothing the site serves is Markdown: its page is index.html.
    expect(markdown).not.toContain('index.html')
  })
})

describe('what Tailwind\'s scanner reads with the lines', () => {
  it('still reads index.html and every file under src/ and functions/ it read without them', () => {
    const before = filesOf(withoutLines)
    const after = new Set(filesOf(withLines))
    const site = before.filter((f) => f === 'index.html' || f.startsWith('src/') || f.startsWith('functions/'))
    // A floor, so an empty list proves nothing: the site's entry, its frame and a page function.
    for (const file of ['index.html', 'src/App.tsx', 'src/main.tsx', 'functions/tournaments/[id].ts']) expect(site, file).toContain(file)
    expect(site.filter((f) => !after.has(f))).toEqual([])
  })

  it('reads no file under docs/, test/ or scripts/, and no Markdown file at the root, and leaves out nothing else', () => {
    const before = filesOf(withoutLines)
    const after = filesOf(withLines)
    expect(after.filter(LEFT_OUT)).toEqual([])
    // Without the lines it read them all, this record and this very test among them.
    expect(before).toEqual(expect.arrayContaining(['REDESIGN_STATUS.md', 'test/unit/source-not-lines.test.ts', 'docs/redesign/REDESIGN_SPEC.md']))
    const gone = before.filter((f) => !after.includes(f))
    expect(gone.length).toBeGreaterThan(0)
    expect(gone.filter((f) => !LEFT_OUT(f))).toEqual([])
  })

  it('finds every class name a file the site builds writes: src/, index.html and functions/', () => {
    const site = new Scanner({
      sources: [
        { base: SRC, pattern: '**/*', negated: false },
        { base: join(ROOT, 'functions'), pattern: '**/*', negated: false },
        { base: ROOT, pattern: 'index.html', negated: false },
      ],
    })
    const written = site.scan()
    expect(written).toEqual(expect.arrayContaining(['bg-raised', 'min-h-[calc(100vh-var(--header-h,64px))]', 'focus:not-sr-only']))
    expect(written.filter((name) => !foundWith.has(name))).toEqual([])
    // The lines do take names out: those only the documents, the tests, the scripts and the records spell.
    expect(foundWithout.filter((name) => !foundWith.has(name)).length).toBeGreaterThan(0)
  })
})

/** Every file under a folder, as paths from the project's root. */
function walk(folder: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(join(ROOT, folder), { withFileTypes: true })) {
    const path = `${folder}/${entry.name}`
    if (entry.isDirectory()) out.push(...walk(path))
    else out.push(path)
  }
  return out
}
const SITE_CODE = walk('src').filter((f) => /\.(ts|tsx|js|jsx|mjs|css)$/.test(f))

describe('the site\'s own code', () => {
  /** Where an import of `file` points, as a path from the project's root, or null for a package. */
  function target(file: string, spec: string): string | null {
    const path = spec.replace(/\?.*$/, '')
    if (path.startsWith('@/')) return `src/${path.slice(2)}`
    if (!path.startsWith('.')) return null
    return relative(ROOT, resolve(ROOT, dirname(file), path)).split(sep).join('/')
  }
  const IMPORTS = /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s+['"]([^'"]+)['"]|@import\s+['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g

  it('imports nothing from a folder the lines leave out, so no class a page draws can live only there', () => {
    expect(SITE_CODE).toContain('src/App.tsx')
    const reached: string[] = []
    for (const file of SITE_CODE) {
      for (const m of readFileSync(join(ROOT, file), 'utf8').matchAll(IMPORTS)) {
        const to = target(file, m.slice(1).find(Boolean)!)
        if (to !== null && (LEFT_OUT(to) || to.startsWith('../'))) reached.push(`${file} imports ${to}`)
      }
    }
    expect(reached).toEqual([])
  })

  /**
   * What is glued straight onto a value in a template string or a joined
   * string: the run of class characters before an interpolation, or the
   * last word of a string literal before a plus. Only a run that starts
   * with a letter and ends where a class name goes on (a hyphen, a colon
   * or an opening bracket) counts.
   */
  function gluedPrefixes(text: string): string[] {
    const prefix = /^[A-Za-z!][\w:/.![\]-]*[-:[]$/
    const out: string[] = []
    for (const m of text.matchAll(/\$\{/g)) {
      let start = m.index
      while (start > 0 && /[\w:/.![\]-]/.test(text[start - 1])) start--
      const run = text.slice(start, m.index)
      if (prefix.test(run)) out.push(run)
    }
    for (const m of text.matchAll(/(['"`])([^'"`\n]*)\1\s*\+/g)) {
      const last = m[2].split(/\s+/).pop() ?? ''
      if (prefix.test(last)) out.push(last)
    }
    return out
  }

  /** The values a prefix would take if it were a class name's start: numbers, sizes, colours, keywords and brackets. */
  const probes = (prefix: string) =>
    prefix.endsWith('[')
      ? ['1px]', 'red]', '50%]'].map((end) => prefix + end)
      : prefix.endsWith(':')
        ? ['flex', 'block', 'hidden', 'p-1'].map((end) => prefix + end)
        : ['0', '1', '2', '4', '10', 'px', 'full', 'auto', 'none', 'sm', 'lg', 'xl', 'white', 'black', 'red-500', '[1px]', '[red]'].map((end) => prefix + end)

  /** The class names a stylesheet's selectors name. */
  const classNames = (css: string) =>
    new Set([...css.matchAll(/(?<=^|[\s,(>+~])\.((?:\\.|[\w-])+)/gm)].map((m) => m[1].replace(/\\(.)/g, '$1')))

  /** The glued prefixes of `texts` that start a class name Tailwind builds from the site's own stylesheet. */
  async function classPrefixes(texts: string[]): Promise<string[]> {
    const glued = [...new Set(texts.flatMap(gluedPrefixes))]
    // A compiler of its own, since each build adds to what the one before built.
    const fresh = await siteCompiler()
    const built = [...classNames(fresh.build([...foundWithout, ...glued.flatMap(probes)]))]
    return glued.filter((prefix) => built.some((name) => name.startsWith(prefix)))
  }

  it('finds a class put together from parts when there is one, so the check below can fail', async () => {
    const samples = [
      'className={`rounded ${big ? "p-4" : "p-2"} bg-${tone}`}',
      "const ring = 'ring-' + width",
      'style={{}} className={`w-[${size}px] text-sm`}',
      'className={`${state}:underline hover:${shade}`}',
    ]
    expect(samples.flatMap(gluedPrefixes)).toEqual(['bg-', 'ring-', 'w-[', 'hover:'])
    expect((await classPrefixes(samples)).sort()).toEqual(['bg-', 'hover:', 'ring-', 'w-['])
    // An id, a key or a file name glued the same way is no class.
    expect(await classPrefixes(['id={`ann-${a.id}`} key={`e-${i}`} href={`tel:${n}`}', "'Rd' + r"])).toEqual([])
  })

  it('glues no value onto the front of a class name in a template string or a joined string', async () => {
    const texts = SITE_CODE.filter((f) => /\.(ts|tsx|js|jsx|mjs)$/.test(f)).map((f) => readFileSync(join(ROOT, f), 'utf8'))
    expect(texts.length).toBeGreaterThan(100)
    expect(await classPrefixes(texts)).toEqual([])
  })
})

describe('the unit tests\' plain reading of src/index.css', () => {
  const without = CSS.split('\n').filter((line) => !line.startsWith('@source')).join('\n')
  /** The lines that stay once comments are stripped, the four lines' leftovers aside. */
  const kept = (css: string) =>
    stripComments(css).split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('@source'))

  it('keeps every rule it keeps without the four lines, in the same order', () => {
    const shape = (css: string) => parseRules(css).map((r) => ({ selector: r.selector, decls: [...r.decls], within: r.within, order: r.order }))
    const rules = shape(CSS)
    // A floor, so an empty reading proves nothing: the token blocks, the ring rules of the new look and this step's own.
    expect(rules.length).toBeGreaterThan(30)
    for (const selector of [':root', '.dark', ':root[data-look="new"] :focus-visible', ':root[data-look="new"] [data-ring-ground="navy"]', ':root[data-look="new"] #main-content:focus-visible']) {
      expect(rules.map((r) => r.selector), selector).toContain(selector)
    }
    expect(rules).toEqual(shape(without))
  })

  it('keeps every statement and line it keeps without them, the dark variant first after the imports', () => {
    const lines = kept(CSS)
    expect(lines).toEqual(kept(without))
    const variant = lines.findIndex((line) => line.startsWith('@custom-variant dark '))
    expect(variant).toBeGreaterThan(-1)
    expect(lines.slice(0, variant).every((line) => line.startsWith('@import '))).toBe(true)
  })

  it('reads the fourth line whole, and strips a stylesheet as a browser reads it, a quoted slash and star being no comment', () => {
    // The four lines come through the stripper as they are written, in their order.
    expect(stripComments(CSS).split('\n').filter((line) => line.startsWith('@source'))).toEqual(LINES)
    // A made-up stylesheet: a quoted slash and star, a comment holding quotes, and a comment after a string on one line.
    const made = [
      '@source not "../*.md";',
      '/* a comment that says "../*" and it\'s done */',
      '.a::before { content: "/* not a comment */"; } /* a comment after it */',
      ".b::after { content: '*/'; }",
    ].join('\n')
    expect(stripComments(made)).toBe([
      '@source not "../*.md";',
      '',
      '.a::before { content: "/* not a comment */"; } ',
      ".b::after { content: '*/'; }",
    ].join('\n'))
  })
})
