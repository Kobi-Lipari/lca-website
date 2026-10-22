// The heritage look's type at its edges (WS01 step 30).
// test/unit/heritage-css.test.ts, heritage-budget.test.ts and
// heritage-glyphs.test.ts read src/styles/themes/heritage.css and the font
// files as they are written; this file adds what they leave out.
//
// - The stylesheet as the site's own build emits it. Built with
//   vite.config.ts in the accessibility test build's mode, the file comes
//   out as one stylesheet, heritage-<hash>.css, beside exactly the files its
//   faces name, each the very file the package holds, so the bundler
//   resolves the package path the stylesheet gives Source Serif. Every url()
//   in it names an emitted file. Each face keeps its family, style, range
//   and files, the fallback faces keep their four overrides, the
//   registration of the display size (@property) keeps its descriptors at
//   the top level, and every other rule keeps its guard, its selectors and
//   its declarations, at the top level and in no cascade layer. The roman
//   files it emits come to 110,000 bytes or less. Each check fails on a
//   planted build.
// - ThemeScope's import of it, built: the chunk that holds ThemeScope names
//   the heritage stylesheet only as a file to load on demand and takes no
//   stylesheet with itself, and the heritage and live stylesheets share no
//   file.
// - The whole site, built twice as the browser tests and the deploy build
//   it: the site's own build carries no heritage stylesheet and none of its
//   faces or files; the accessibility test build carries the stylesheet as
//   a file of its own, the same bytes, beside its four font files, named
//   only by the fixture page's chunk and by nothing the home page loads.
//   The loader that build emits adds a stylesheet's link once: after the
//   stylesheet fails to load, a second import of it resolves at once and
//   adds no link, so ThemeScope's next import fetches nothing until the page
//   is reloaded, as ThemeScope.tsx says.
// - The two packages: exact at 5.3.0 under dependencies, the lock file
//   agreeing, with no dependency of their own, and the copies installed are
//   those versions.
// - The fallback faces against the metrics a browser lays each face out
//   with: each file asks for its typographic metrics, which equal its hhea
//   metrics, so every system reads the same numbers, and each override times
//   size-adjust comes to them. The arithmetic in the stylesheet's header is
//   right and gives the numbers the faces declare.
// - The figures the rules ask for are the faces' own: the reader asks for
//   tabular figures, and Source Serif has them (tnum) in roman and italic;
//   the display rule asks for no figure style, and Caslon has none to give.
// - The accent class: the stylesheet overrides the class itself, so no file
//   under src may give it a variant or the important flag, either of which
//   would reach the base look's accent face inside a heritage scope. The
//   check fails on planted cases.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseRules, read, ROOT, type CssRule } from './helpers/cssTokens'
import { declaredFaces } from './helpers/heritageFaces'
import { fontMetrics, layoutFeatures, woff2Table, woff2Tables } from './helpers/woff2'

const SHEET = 'src/styles/themes/heritage.css'
const SCOPE = 'src/components/ThemeScope.tsx'
const BUDGET = 110_000
const PACKAGES = ['@fontsource/libre-caslon-display', '@fontsource-variable/source-serif-4']
const OVERRIDES = ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override']

/** A selector or a value as a minifier may write it: no quotes, no spaces beside commas and brackets, no leading zero, one case. */
const tidy = (text: string) =>
  text
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([,()])\s*/g, '$1')
    .replace(/(^|[^\d.])0+\.(\d)/g, '$1.$2')
    .trim()
    .toLowerCase()

/** The guard every rule but a face waits for, tidied. */
const GUARD = tidy(':root[data-look="new"] [data-theme="heritage"]')

/** Splits a selector list at its top-level commas. */
function selectorList(selector: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i]
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    else if (ch === ',' && depth === 0) {
      parts.push(selector.slice(start, i))
      start = i + 1
    }
  }
  parts.push(selector.slice(start))
  return parts.map((p) => p.trim()).filter((p) => p !== '')
}

/** The code points below U+10000 a unicode-range covers, one flag each; a face with no range covers them all, and wildcards (U+4??) count. */
function coverage(range: string): Uint8Array {
  const flags = new Uint8Array(0x10000)
  if (range.trim() === '') return flags.fill(1)
  for (const part of range.split(',')) {
    const spec = part.trim().replace(/^U\+/i, '')
    const [from, to] = spec.includes('?')
      ? [parseInt(spec.replace(/\?/g, '0'), 16), parseInt(spec.replace(/\?/g, 'F'), 16)]
      : spec.split('-').map((h) => parseInt(h, 16))
    if (Number.isNaN(from)) throw new Error(`cannot read the range ${part}`)
    for (let c = from; c <= Math.min(to ?? from, 0xffff); c++) flags[c] = 1
  }
  return flags
}

const urlsIn = (text: string) => [...text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((m) => m[2])

/** What a build emits: an asset or a chunk, as Vite's output gives it. */
interface Emitted {
  type: 'asset' | 'chunk'
  fileName: string
  source?: string | Uint8Array
  code?: string
  originalFileNames?: readonly string[]
  facadeModuleId?: string | null
  viteMetadata?: { importedCss: Set<string> }
}

const bytesOf = (file: Emitted) => Buffer.from(file.source ?? '')
const textOf = (file: Emitted) => bytesOf(file).toString('utf8')
const isFont = (file: Emitted) => /\.(woff2?|ttf|otf|eot)$/.test(file.fileName)

const outDir = mkdtempSync(join(tmpdir(), 'lca-heritage-'))
afterAll(() => rmSync(outDir, { recursive: true, force: true }))

/**
 * Builds one file of the site as the input, with the site's own Vite config
 * in the accessibility test build's mode (the build the fixture page and
 * ThemeScope ship in), and returns what the build emits. Nothing is written.
 */
async function siteBuild(name: string, input: string): Promise<Emitted[]> {
  const result = await build({
    root: ROOT,
    configFile: join(ROOT, 'vite.config.ts'),
    mode: 'a11y',
    envFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      outDir,
      emptyOutDir: false,
      rolldownOptions: { input: { [name]: join(ROOT, input) }, preserveEntrySignatures: 'exports-only' },
    },
  })
  return (Array.isArray(result) ? result : [result]).flatMap((r) => (r as unknown as { output: Emitted[] }).output)
}

/** A face as a stylesheet declares it, each file it names traced back to the source file it was built from. */
interface Face {
  family: string
  style: string
  range: Uint8Array
  urls: string[]
  files: string[]
  local: string[]
  decls: Map<string, string>
}

function facesOf(rules: CssRule[], emitted: Emitted[]): Face[] {
  const byUrl = new Map(emitted.map((o) => [`/${o.fileName}`, o]))
  return rules
    .filter((rule) => rule.selector === '@font-face')
    .map((rule) => {
      const src = rule.decls.get('src') ?? ''
      const urls = urlsIn(src)
      return {
        family: tidy(rule.decls.get('font-family') ?? ''),
        style: rule.decls.get('font-style') ?? 'normal',
        range: coverage(rule.decls.get('unicode-range') ?? ''),
        urls,
        files: urls.map((url) => byUrl.get(url)?.originalFileNames?.[0] ?? `(not emitted) ${url}`),
        local: [...src.matchAll(/local\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((m) => tidy(m[2])),
        decls: rule.decls,
      }
    })
}

/** The source's faces, followed into the package stylesheet they import, as the build follows them. */
const sourceFaces = declaredFaces(read(SHEET), SHEET)
const sourceRules = parseRules(read(SHEET))
const faceKey = (face: { family: string; style: string }) => `${tidy(face.family)} ${face.style}`

/** The style rules of a stylesheet, each as its tidied selectors and its tidied declarations in a fixed order. */
const shape = (rules: CssRule[]) =>
  rules
    .filter((rule) => rule.selector !== '@font-face')
    .map((rule) => `${selectorList(rule.selector).map(tidy).join(', ')} { ${[...rule.decls].map(([prop, value]) => `${prop}: ${tidy(value)}`).sort().join('; ')} }`)

/** Everything wrong with an emitted heritage stylesheet, given what was emitted beside it, each tagged with the rule it breaks. */
function problems(css: string, emitted: Emitted[]): string[] {
  const out: string[] = []
  const rules = parseRules(css)
  const faces = facesOf(rules, emitted)
  const fonts = emitted.filter(isFont)

  // The files: exactly those the source's faces name, each the package's own bytes.
  const named = [...new Set(sourceFaces.flatMap((face) => face.files))].sort()
  const built = fonts.map((o) => o.originalFileNames?.[0] ?? o.fileName).sort()
  for (const file of built) if (!named.includes(file)) out.push(`files: ${file} is emitted but no face of the source names it`)
  for (const file of named) if (!built.includes(file)) out.push(`files: ${file} is not emitted`)
  for (const font of fonts) {
    const source = font.originalFileNames?.[0] ?? ''
    if (source && !bytesOf(font).equals(readFileSync(join(ROOT, source)))) out.push(`files: ${font.fileName} is not the bytes of ${source}`)
  }

  // Every url() an emitted file, and nothing left for the browser to resolve.
  const at = new Set(emitted.map((o) => `/${o.fileName}`))
  for (const url of urlsIn(css)) if (!at.has(url)) out.push(`url: ${url} is not an emitted file`)

  // The faces: the source's, with the same ranges and files.
  for (const face of sourceFaces) {
    const match = faces.filter((f) => faceKey(f) === faceKey(face))
    if (match.length !== 1) {
      out.push(`faces: ${match.length} faces for ${faceKey(face)}`)
      continue
    }
    const range = coverage(face.range)
    if (!match[0].range.every((flag, codePoint) => flag === range[codePoint])) out.push(`faces: ${faceKey(face)} covers another range`)
    if (match[0].files.join(' ') !== face.files.join(' ')) out.push(`faces: ${faceKey(face)} names ${match[0].files.join(', ')}`)
    if (match[0].local.join(' ') !== face.local.map(tidy).join(' ')) out.push(`faces: ${faceKey(face)} names other local faces`)
  }
  if (faces.length !== sourceFaces.length) out.push(`faces: ${faces.length} faces where the source has ${sourceFaces.length}`)

  // The fallback faces keep their four overrides.
  for (const rule of sourceRules.filter((r) => r.selector === '@font-face' && (r.decls.get('src') ?? '').includes('local('))) {
    const key = faceKey({ family: rule.decls.get('font-family') ?? '', style: rule.decls.get('font-style') ?? 'normal' })
    const face = faces.find((f) => faceKey(f) === key)
    for (const descriptor of OVERRIDES) {
      if (face?.decls.get(descriptor) !== rule.decls.get(descriptor)) out.push(`fallback: ${key} has ${descriptor} ${face?.decls.get(descriptor) ?? 'missing'}`)
    }
  }

  // Every other rule at the top level, under the guard, in no layer, meaning what the source means; the
  // registration of the display size, which matches no element, at the top level, its meaning held below.
  for (const m of css.matchAll(/@(?!font-face\b|property\b)[a-z-]+/g)) out.push(`at-rule: ${m[0]}`)
  const registrations = rules.filter((r) => /^@property\s/.test(r.selector))
  for (const rule of registrations) if (rule.within !== '') out.push(`guard: ${rule.selector} sits inside ${rule.within}`)
  for (const rule of rules.filter((r) => r.selector !== '@font-face' && !registrations.includes(r))) {
    if (rule.within !== '') out.push(`guard: ${rule.selector} sits inside ${rule.within}`)
    for (const selector of selectorList(rule.selector)) {
      const t = tidy(selector)
      if (!(t === GUARD || t.startsWith(`${GUARD} `) || t.startsWith(`${GUARD}.`) || t.startsWith(`${GUARD}[`))) out.push(`guard: ${selector} does not wait for the new look`)
    }
  }
  const want = shape(sourceRules)
  const got = shape(rules)
  if (want.join('\n') !== got.join('\n')) {
    for (const r of got.filter((g) => !want.includes(g))) out.push(`meaning: the build writes ${r}`)
    for (const r of want.filter((w) => !got.includes(w))) out.push(`meaning: the build loses ${r}`)
    if (!got.some((g) => !want.includes(g)) && !want.some((w) => !got.includes(w))) out.push('meaning: the rules are in another order')
  }

  // The budget, from the emitted files: the roman faces' woff2 files.
  const size = (url: string) => bytesOf(emitted.find((o) => `/${o.fileName}` === url) ?? { type: 'asset', fileName: '' }).length
  const roman = new Set(faces.filter((f) => f.style === 'normal' && f.urls.length > 0).map((f) => f.urls[0]))
  const sum = [...roman].reduce((total, url) => total + size(url), 0)
  if (sum > BUDGET) out.push(`budget: the roman files come to ${sum} bytes`)
  for (const face of faces.filter((f) => f.urls.length > 0)) if (!face.urls[0].endsWith('.woff2')) out.push(`budget: ${faceKey(face)} names ${face.urls[0]} before its woff2`)
  return out
}

let alone: Emitted[]
let withScope: Emitted[]
let sheet: Emitted
let css: string

beforeAll(async () => {
  alone = await siteBuild('heritage', SHEET)
  withScope = await siteBuild('scope', SCOPE)
  const sheets = alone.filter((o) => o.fileName.endsWith('.css'))
  if (sheets.length !== 1) throw new Error(`the build emitted ${sheets.length} stylesheets`)
  sheet = sheets[0]
  css = textOf(sheet)
}, 120_000)

describe('the heritage stylesheet as the site\'s own build emits it', () => {
  it('is one stylesheet of its own, heritage-<hash>.css, beside the four files its faces name and nothing else', () => {
    expect(sheet.fileName).toMatch(/^assets\/heritage-[\w-]+\.css$/)
    expect(alone.filter(isFont)).toHaveLength(4)
    expect(alone).toHaveLength(5)
    expect(alone.filter(isFont).map((o) => o.originalFileNames?.[0]).sort()).toEqual([...new Set(sourceFaces.flatMap((face) => face.files))].sort())
  })

  it('breaks none of the rules: files, urls, faces, fallback overrides, guard, layer, meaning and budget', () => {
    expect(problems(css, alone)).toEqual([])
  })

  it('names the files by the paths the build gives them, and no package path is left for the browser to find', () => {
    expect(urlsIn(css).every((url) => /^\/assets\/[\w.-]+\.(woff2?)$/.test(url))).toBe(true)
    expect(css).not.toMatch(/@fontsource|node_modules|\.\.\//)
  })

  it('names neither the base look\'s accent face nor the site\'s own faces in any face or family', () => {
    const rules = parseRules(css)
    const named = [
      ...facesOf(rules, alone).map((face) => face.family),
      ...rules.flatMap((rule) => [...rule.decls].filter(([prop]) => prop === 'font-family' || prop.startsWith('--font')).map(([, value]) => tidy(value))),
    ].join(' | ')
    expect(named).toContain('libre caslon display')
    expect(named).not.toMatch(/instrument|geist|mono/)
  })
})

describe('the checks on the built stylesheet, each on a planted build', () => {
  /** The emitted stylesheet with one rule, found by the start of its selector, wrapped in an at-rule. */
  const wrap = (start: string, prelude: string) => {
    const from = css.indexOf(start)
    const end = css.indexOf('}', from) + 1
    expect(from).toBeGreaterThanOrEqual(0)
    return `${css.slice(0, from)}${prelude}{${css.slice(from, end)}}${css.slice(end)}`
  }
  const of = (planted: string, tag: string, emitted = alone) => {
    expect(planted).not.toBe(css)
    return problems(planted, emitted).filter((p) => p.startsWith(`${tag}:`))
  }
  const caps = `${GUARD} .small-caps`

  it('a rule put in a cascade layer or a media query', () => {
    expect(of(wrap(caps, '@layer utilities'), 'at-rule')).toEqual(['at-rule: @layer'])
    expect(of(wrap(caps, '@layer utilities'), 'guard')).toEqual([`guard: ${caps} sits inside @layer utilities`])
    expect(of(wrap(caps, '@media (min-width:40rem)'), 'guard').length).toBe(1)
  })

  it('a rule that no longer waits for the new look, or that means something else', () => {
    expect(of(css.replace(caps, '[data-theme=heritage] .small-caps'), 'guard')).toEqual(['guard: [data-theme=heritage] .small-caps does not wait for the new look'])
    expect(of(css.replace(':not(table *,.font-mono,.font-mono *)', ':not(.font-mono)'), 'meaning').length).toBe(2)
    expect(of(css.replace('letter-spacing:.07em', 'letter-spacing:.1em'), 'meaning').length).toBe(2)
  })

  it('a registration of the display size that is lost, changed, put in a layer, or joined by another', () => {
    const registration = css.match(/@property --display-size\{[^}]*\}/)?.[0] ?? ''
    expect(registration).toBe('@property --display-size{syntax:"<length-percentage>";inherits:true;initial-value:36px}')
    expect(of(css.replace(registration, ''), 'meaning')).toEqual(['meaning: the build loses @property --display-size { inherits: true; initial-value: 36px; syntax: <length-percentage> }'])
    expect(of(css.replace('syntax:"<length-percentage>"', 'syntax:"*"'), 'meaning').length).toBe(2)
    expect(of(wrap('@property', '@layer utilities'), 'guard')).toEqual(['guard: @property --display-size sits inside @layer utilities'])
    const other = ['--planted', 'size'].join('-')
    expect(of(`${css}@property ${other}{syntax:"<length>";inherits:true;initial-value:0px}`, 'meaning')).toEqual([`meaning: the build writes @property ${other} { inherits: true; initial-value: 0px; syntax: <length> }`])
  })

  it('a fallback face that loses an override', () => {
    expect(of(css.replace(/size-adjust:[^;}]+;/, ''), 'fallback')).toEqual(['fallback: libre caslon display fallback normal has size-adjust missing'])
    expect(of(css.replace(/line-gap-override:0%\}/, '}'), 'fallback')).toEqual(['fallback: libre caslon display fallback normal has line-gap-override missing'])
  })

  it('a package path left in a url(), or a face that changes its range or style', () => {
    const left = css.replace(/url\(\/assets\/source-serif-4-latin-wght-normal-[\w-]+\.woff2\)/, 'url(@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2)')
    expect(of(left, 'url')).toEqual(['url: @fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2 is not an emitted file'])
    expect(of(css.replace('unicode-range:U+??,', 'unicode-range:U+0000-007F,'), 'faces')).toEqual(['faces: source serif 4 variable normal covers another range'])
    const roman = css.replace(/font-style:italic;font-display:swap/, 'font-style:normal;font-display:swap')
    expect(of(roman, 'faces')).toContain('faces: 2 faces for source serif 4 variable normal')
    expect(of(roman, 'budget').length).toBe(1)
  })

  it('a file emitted that no face names, or one whose bytes are not the package\'s', () => {
    const extra: Emitted = {
      type: 'asset',
      fileName: 'assets/source-serif-4-latin-opsz-normal-planted.woff2',
      originalFileNames: ['node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-opsz-normal.woff2'],
      source: readFileSync(join(ROOT, 'node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-opsz-normal.woff2')),
    }
    expect(problems(css, [...alone, extra]).filter((p) => p.startsWith('files:'))).toEqual([`files: ${extra.originalFileNames![0]} is emitted but no face of the source names it`])
    const changed = alone.map((o) => (isFont(o) && o.fileName.includes('caslon') && o.fileName.endsWith('.woff2') ? { ...o, source: Buffer.concat([bytesOf(o), Buffer.from([0])]) } : o))
    expect(problems(css, changed).filter((p) => p.startsWith('files:'))).toHaveLength(1)
  })
})

describe('ThemeScope\'s import of the stylesheet, built', () => {
  const scopeChunk = () => withScope.find((o) => o.type === 'chunk' && (o.facadeModuleId ?? '').endsWith(SCOPE))!
  const stylesheet = (name: string) => withScope.find((o) => new RegExp(`^assets/${name}-[\\w-]+\\.css$`).test(o.fileName))!

  it('is the same stylesheet the file builds to on its own, byte for byte', () => {
    const heritage = stylesheet('heritage')
    expect(heritage.fileName).toBe(sheet.fileName)
    expect(textOf(heritage)).toBe(css)
  })

  it('comes on demand: the chunk that holds ThemeScope names the file, takes no stylesheet with itself, and no other chunk names it', () => {
    const chunk = scopeChunk()
    expect(chunk, 'the chunk that holds ThemeScope').toBeTruthy()
    expect([...(chunk.viteMetadata?.importedCss ?? [])]).toEqual([])
    const heritage = stylesheet('heritage').fileName
    expect(chunk.code).toContain(heritage)
    expect(withScope.filter((o) => o.type === 'chunk' && (o.code ?? '').includes(heritage))).toEqual([chunk])
    // The live stylesheet is loaded the same way, as a file of its own.
    expect(chunk.code).toContain(stylesheet('live').fileName)
  })

  it('keeps the heritage and live files apart: the two stylesheets share no file', () => {
    const heritage = new Set(urlsIn(textOf(stylesheet('heritage'))))
    const live = new Set(urlsIn(textOf(stylesheet('live'))))
    expect(heritage.size).toBe(4)
    expect(live.size).toBeGreaterThan(0)
    expect([...heritage].filter((url) => live.has(url))).toEqual([])
    expect([...live].filter((url) => /caslon|serif/i.test(url))).toEqual([])
  })
})

describe('the whole site, built as it is deployed and as the browser tests build it', () => {
  /** Every file under a build folder, as a path inside it. */
  function filesIn(dir: string, base = dir): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      return statSync(path).isDirectory() ? filesIn(path, base) : [relative(base, path)]
    })
  }

  /** Builds the site with vite into a new folder, the way test/unit/feature-overrides.test.ts does, and returns the folder. */
  function buildSite(mode: 'production' | 'a11y'): string {
    const dir = mkdtempSync(join(tmpdir(), `lca-heritage-${mode}-`))
    execFileSync(process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--mode', mode, '--outDir', dir, '--emptyOutDir', '--logLevel', 'error'], {
      cwd: ROOT,
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        VITE_FLAGS: mode === 'a11y' ? 'newLook,themeHeritage' : '',
        VITE_SUPABASE_URL: 'http://127.0.0.1:9',
        VITE_SUPABASE_ANON_KEY: 'fake-anon-key',
        VITE_GOOGLE_MAPS_API_KEY: '',
      },
    })
    return dir
  }

  /** The heritage files, as any built file would name them, and the faces, as a stylesheet would declare or use them. */
  const FILE_TRACES = [/libre-caslon-display-[\w-]+\.woff2?/, /source-serif-4-[\w-]+\.woff2?/, /heritage-[\w-]+\.css/]
  const FACE_TRACES = [/Libre Caslon Display/i, /Source Serif 4/i]
  const traces = (file: string) => (file.endsWith('.css') ? [...FILE_TRACES, ...FACE_TRACES] : FILE_TRACES)
  const textFiles = (files: string[]) => files.filter((f) => /\.(js|css|html)$/.test(f))

  let production: string
  let a11y: string
  beforeAll(() => {
    production = buildSite('production')
    a11y = buildSite('a11y')
  }, 180_000)
  afterAll(() => {
    for (const dir of [production, a11y]) if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('the site\'s own build carries no heritage stylesheet or font file, no file of it names one, and its stylesheet names neither face', () => {
    const files = filesIn(production)
    expect(files.filter((f) => /heritage|caslon|source-serif/i.test(f))).toEqual([])
    expect(textFiles(files).filter((f) => f.endsWith('.css')).length).toBeGreaterThan(0)
    for (const file of textFiles(files)) {
      const text = readFileSync(join(production, file), 'utf8')
      for (const trace of traces(file)) expect(trace.test(text), `${file} ${trace}`).toBe(false)
    }
  })

  it('the accessibility test build carries the stylesheet as a file of its own, the same bytes, beside its four font files', () => {
    const files = filesIn(a11y)
    const sheets = files.filter((f) => /^assets\/heritage-[\w-]+\.css$/.test(f))
    expect(sheets).toEqual([sheet.fileName])
    expect(readFileSync(join(a11y, sheets[0]), 'utf8')).toBe(css)
    expect(files.filter((f) => /caslon|source-serif/i.test(f)).sort()).toEqual(alone.filter(isFont).map((o) => o.fileName).sort())
  })

  it('names the stylesheet only in the fixture page\'s chunk, and nothing the home page loads names it or the faces', () => {
    const files = filesIn(a11y)
    const naming = textFiles(files).filter((f) => readFileSync(join(a11y, f), 'utf8').includes(sheet.fileName))
    expect(naming).toHaveLength(1)
    expect(naming[0]).toMatch(/^assets\/ScopeFixturePage-[\w-]+\.js$/)
    const html = readFileSync(join(a11y, 'index.html'), 'utf8')
    const loaded = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1])
    expect(loaded.some((f) => /^assets\/index-[\w-]+\.js$/.test(f))).toBe(true)
    expect(loaded.some((f) => /^assets\/index-[\w-]+\.css$/.test(f))).toBe(true)
    for (const [file, text] of [['index.html', html], ...loaded.map((f) => [f, readFileSync(join(a11y, f), 'utf8')])]) {
      for (const trace of traces(file)) expect(trace.test(text), `${file} ${trace}`).toBe(false)
    }
  })

  /**
   * Drives the loader a build emits, in a page and a process of its own:
   * asks it for a stylesheet, fails that load, asks again, then asks for
   * another stylesheet and lets that one load, and prints what each request
   * came to and how many links the page holds after each.
   */
  const LOADER_PROBE = String.raw`
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
const [helper, sheet, other, root] = process.argv.slice(1)
const { JSDOM } = createRequire(root + '/package.json')('jsdom')
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>')
Object.assign(globalThis, { window: dom.window, document: dom.window.document, Event: dom.window.Event })
const exported = Object.values(await import(pathToFileURL(helper).href))
const preload = exported[0]
const links = () => document.querySelectorAll('link').length
const outcome = (p) => p.then(() => 'resolved', (e) => 'rejected: ' + e.message)
const out = { exports: exported.length }
const first = outcome(preload(() => Promise.resolve({}), [sheet]))
out.afterFirst = links()
document.querySelector('link[rel="stylesheet"]').dispatchEvent(new dom.window.Event('error'))
out.first = await first
out.second = await outcome(preload(() => Promise.resolve({}), [sheet]))
out.afterSecond = links()
const third = outcome(preload(() => Promise.resolve({}), [other]))
out.afterOther = links()
document.querySelectorAll('link[rel="stylesheet"]')[1].dispatchEvent(new dom.window.Event('load'))
out.other = await third
console.log(JSON.stringify(out))
`

  it('its loader adds a stylesheet\'s link once: after a failed load a second import resolves at once and adds no link, so the file is not fetched again', () => {
    const files = filesIn(a11y)
    const helpers = files.filter((f) => /^assets\/preload-helper-[\w-]+\.js$/.test(f))
    expect(helpers, 'the loader the build emits').toHaveLength(1)
    const live = files.filter((f) => /^assets\/live-[\w-]+\.css$/.test(f))
    expect(live).toHaveLength(1)
    const out = JSON.parse(
      execFileSync(process.execPath, ['--input-type=module', '-e', LOADER_PROBE, join(a11y, helpers[0]), sheet.fileName, live[0], ROOT], { cwd: ROOT, encoding: 'utf8' }),
    ) as Record<string, unknown>
    expect(out).toEqual({
      exports: 1,
      // The first request adds a link, and the failed load reaches the import.
      afterFirst: 1,
      first: expect.stringMatching(new RegExp(`^rejected: Unable to preload CSS for \\S*/${sheet.fileName.replace(/\./g, '\\.')}$`)),
      // The second resolves at once and adds no link: the loader remembers the address, and the failed link stays.
      second: 'resolved',
      afterSecond: 1,
      // A stylesheet it has not tried still gets a link of its own.
      afterOther: 2,
      other: 'resolved',
    })
  }, 30_000)
})

describe('the two font packages', () => {
  const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string>; devDependencies?: Record<string, string> }
  const lock = JSON.parse(read('package-lock.json')) as {
    packages: Record<string, { version?: string; resolved?: string; integrity?: string; dev?: boolean; dependencies?: Record<string, string>; license?: string }>
  }
  const root = lock.packages[''] as unknown as { dependencies: Record<string, string>; devDependencies?: Record<string, string> }

  it.each(PACKAGES)('%s is pinned exactly at 5.3.0 under dependencies, and the lock file and the installed copy agree', (name) => {
    expect(pkg.dependencies[name]).toBe('5.3.0')
    expect(pkg.devDependencies?.[name]).toBeUndefined()
    expect(root.dependencies[name]).toBe('5.3.0')
    expect(root.devDependencies?.[name]).toBeUndefined()
    const entry = lock.packages[`node_modules/${name}`]
    expect(entry.version).toBe('5.3.0')
    expect(entry.resolved).toBe(`https://registry.npmjs.org/${name}/-/${name.split('/')[1]}-5.3.0.tgz`)
    expect(entry.integrity).toMatch(/^sha512-[A-Za-z0-9+/]+=*$/)
    expect(entry.dev).toBeUndefined()
    expect(entry.dependencies).toBeUndefined()
    expect(entry.license).toBe('OFL-1.1')
    const installed = JSON.parse(read(`node_modules/${name}/package.json`)) as { name: string; version: string; dependencies?: object }
    expect(installed.name).toBe(name)
    expect(installed.version).toBe('5.3.0')
    expect(installed.dependencies).toBeUndefined()
  })

  it('nothing else in the lock file depends on them', () => {
    for (const [path, entry] of Object.entries(lock.packages)) {
      if (path === '') continue
      for (const name of PACKAGES) expect(entry.dependencies?.[name], path).toBeUndefined()
    }
  })
})

describe('the fallback faces against the metrics a browser uses', () => {
  const real = sourceFaces.filter((face) => face.woff2 !== '')
  const fallbackRule = (family: string, style: string) =>
    sourceRules.find((rule) => rule.selector === '@font-face' && faceKey({ family: rule.decls.get('font-family') ?? '', style: rule.decls.get('font-style') ?? 'normal' }) === faceKey({ family, style }))

  it.each(real.map((face) => [`${face.family} ${face.style}`, face] as const))('%s: its typographic metrics are the ones in use, equal to its hhea metrics, and the fallback comes to them', (_, face) => {
    const file = readFileSync(join(ROOT, face.woff2))
    const os2 = woff2Tables(file).get('OS/2')!.bytes
    expect(os2.readUInt16BE(0)).toBeGreaterThanOrEqual(4)
    // fsSelection bit 7 (USE_TYPO_METRICS) tells a browser to lay the face out with sTypoAscender, sTypoDescender and sTypoLineGap.
    expect(os2.readUInt16BE(62) & 0x80).toBe(0x80)
    const typo = { ascent: os2.readInt16BE(68), descent: os2.readInt16BE(70), lineGap: os2.readInt16BE(72) }
    const hhea = fontMetrics(file)
    expect(typo).toEqual({ ascent: hhea.ascent, descent: hhea.descent, lineGap: hhea.lineGap })
    const fallback = fallbackRule(`${face.family.replace(/ Variable$/, '')} Fallback`, face.style)!
    expect(fallback).toBeTruthy()
    const pct = (d: string) => parseFloat(fallback.decls.get(d)!) / 100
    const size = pct('size-adjust')
    expect(pct('ascent-override') * size).toBeCloseTo(typo.ascent / hhea.unitsPerEm, 3)
    expect(pct('descent-override') * size).toBeCloseTo(Math.abs(typo.descent) / hhea.unitsPerEm, 3)
    expect(pct('line-gap-override') * size).toBeCloseTo(typo.lineGap / hhea.unitsPerEm, 3)
  })

  it('the header\'s arithmetic is right and gives the numbers the faces declare', () => {
    const header = (read(SHEET).match(/^\/\*[\s\S]*?\*\//) ?? [''])[0].replace(/^\s*\*+\/?\s?/gm, ' ').replace(/\s+/g, ' ')
    const georgia = header.match(/(\d+) units per em, ascent \d+, descent \d+, line gap \d+, and an average width of (\d+) \((\d+) in Georgia Italic\)/)
    expect(georgia, 'Georgia\'s units and widths in the header').toBeTruthy()
    const [units, roman, italic] = georgia!.slice(1).map(Number)
    const sums = [...header.matchAll(/(\d+\.\d+) \/ (\d+\.\d+) = (\d+\.\d+)%/g)].map((m) => m.slice(1).map(Number))
    expect(sums).toHaveLength(9)
    for (const [a, b, c] of sums) expect((a / b) * 100, `${a} / ${b}`).toBeCloseTo(c, 1)
    // Three faces in the header's order, each: size-adjust over Georgia's width, then ascent and descent over that size-adjust.
    const order = [
      ['Libre Caslon Display', 'normal'],
      ['Source Serif 4 Variable', 'normal'],
      ['Source Serif 4 Variable', 'italic'],
    ] as const
    const declared = order.flatMap(([family, style]) => {
      const rule = fallbackRule(`${family.replace(/ Variable$/, '')} Fallback`, style)!
      return ['size-adjust', 'ascent-override', 'descent-override'].map((d) => parseFloat(rule.decls.get(d)!))
    })
    expect(sums.map(([, , c]) => c)).toEqual(declared)
    for (const [index, [family, style]] of order.entries()) {
      const [, divisor, sizeAdjust] = sums[index * 3]
      expect(divisor, `${family} ${style}: Georgia's width over its units`).toBeCloseTo((style === 'italic' ? italic : roman) / units, 4)
      for (const [, over] of sums.slice(index * 3 + 1, index * 3 + 3)) expect(over, `${family} ${style}: the overrides divide by its size-adjust`).toBeCloseTo(sizeAdjust / 100, 4)
      // The face's own ascent and descent in the header are its file's.
      const face = real.find((f) => f.family === family && f.style === style)!
      const metrics = fontMetrics(readFileSync(join(ROOT, face.woff2)))
      expect([sums[index * 3 + 1][0], sums[index * 3 + 2][0]], `${family} ${style}`).toEqual([metrics.ascent / metrics.unitsPerEm, Math.abs(metrics.descent) / metrics.unitsPerEm])
    }
  })
})

describe('the figures the rules ask for', () => {
  const real = sourceFaces.filter((face) => face.woff2 !== '')
  const features = (face: (typeof real)[number]) => layoutFeatures(woff2Table(readFileSync(join(ROOT, face.woff2)), 'GSUB'))
  const rule = (hook: string) => sourceRules.find((r) => r.selector.includes(`[data-heritage~="${hook}"]`) && r.decls.has('font-variant-numeric'))!

  it('the reader asks for tabular figures, and Source Serif has them in roman and italic', () => {
    expect(rule('reader').decls.get('font-variant-numeric')).toMatch(/\btabular-nums\b/)
    const serif = real.filter((face) => face.family.startsWith('Source Serif'))
    expect(serif).toHaveLength(2)
    for (const face of serif) expect(features(face).has('tnum'), `${face.family} ${face.style}`).toBe(true)
  })

  it('the display rule asks for no figure style, and Caslon has none to give', () => {
    expect(rule('display').decls.get('font-variant-numeric')).toBe('normal')
    const caslon = real.find((face) => face.family === 'Libre Caslon Display')!
    for (const tag of ['tnum', 'pnum', 'lnum', 'onum']) expect(features(caslon).has(tag), tag).toBe(false)
  })
})

describe('the accent class keeps to the form the stylesheet overrides', () => {
  /** The class, put together so the stylesheet build does not read a form of it from this file. */
  const ACCENT = ['font', 'accent'].join('-')

  /** Each place a text gives the class a variant (md:, hover:, *:) or the important flag, as written there. */
  function variantsIn(text: string): string[] {
    const found: string[] = []
    for (let at = text.indexOf(ACCENT); at >= 0; at = text.indexOf(ACCENT, at + 1)) {
      const before = text[at - 1] ?? ''
      const after = text[at + ACCENT.length] ?? ''
      // Another name that holds the class's letters: the token (--font-accent), or a longer class.
      if (before === '-' || /\w/.test(before) || after === '-' || /\w/.test(after)) continue
      if (before === ':' || before === '!' || after === '!') {
        const start = Math.max(...[' ', '"', "'", '`', '\n'].map((ch) => text.lastIndexOf(ch, at))) + 1
        found.push(text.slice(start, at + ACCENT.length + (after === '!' ? 1 : 0)))
      }
    }
    return found
  }

  /** Every file under a folder, as a path from the repository root. */
  function filesUnder(dir: string): string[] {
    return readdirSync(join(ROOT, dir)).flatMap((name) => {
      const full = join(ROOT, dir, name)
      const rel = relative(ROOT, full)
      return statSync(full).isDirectory() ? filesUnder(rel) : /\.(tsx?|jsx?|css|html)$/.test(name) ? [rel] : []
    })
  }

  it('no file under src gives the class a variant or the important flag', () => {
    const files = filesUnder('src')
    expect(files.length).toBeGreaterThan(100)
    expect(files.flatMap((file) => variantsIn(read(file)).map((form) => `${file}: ${form}`))).toEqual([])
  })

  it('the check finds a variant, a child or an important form, and lets the class itself and the token pass', () => {
    const variant = (prefix: string) => [prefix, ACCENT].join(':')
    expect(variantsIn(`<p className="text-lg ${variant('md')}">`)).toEqual([variant('md')])
    expect(variantsIn(`cn('${variant('hover')}', x)`)).toEqual([variant('hover')])
    expect(variantsIn(`<ul className="${variant('*')}">`)).toEqual([variant('*')])
    expect(variantsIn(`@apply ${variant('lg')};`)).toEqual([variant('lg')])
    expect(variantsIn(`<p className="${'!' + ACCENT}">`)).toEqual([`!${ACCENT}`])
    expect(variantsIn(`<p className="${ACCENT + '!'} text-lg">`)).toEqual([`${ACCENT}!`])
    expect(variantsIn(`<p className="${ACCENT} text-lg">`)).toEqual([])
    expect(variantsIn(`fontFamily: 'var(--${ACCENT})'`)).toEqual([])
    expect(variantsIn(`--${ACCENT}: 'Instrument Serif'; /* the accent face (${ACCENT}) */`)).toEqual([])
    expect(variantsIn(`.${ACCENT} { }`)).toEqual([])
  })
})
