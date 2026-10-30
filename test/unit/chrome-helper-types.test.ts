// test/unit/chrome-helper-types.test.ts
//
// test/a11y sits in no project's compiler settings, so the browser run
// would be the first to meet a wrong call of test/a11y/chrome.ts, and only
// at the line that makes it. Here the TypeScript compiler reads the helper
// and every browser file that imports it, under the site's strict settings
// with the libraries of the browser and of Node the tests run in, and finds
// no error in any of them. A probe of calls, one a line, then shows what
// the helper's types let a spec write:
//
// - onlyToday takes the test's testInfo, the header or the footer, the
//   widths as a list and why, and the build to ask about when it is not the
//   test's own; ifToday the same with one width, what it marks and the
//   check to run; chromeAt answers "today" or "new", never only "today"
// - a part is the header or the footer and nothing else, a list of widths
//   is not one width, and a mark says what it marks
// - SITE, the two lists of names and the table are read-only to a spec
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { beforeAll, describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const DIR = join(ROOT, 'test/a11y')
const HELPER = join(DIR, 'chrome.ts')
/** Every browser file that imports the helper: the specs that read the chrome through it. */
const READERS = readdirSync(DIR)
  .filter((name) => name.endsWith('.ts') && name !== 'chrome.ts')
  .map((name) => join(DIR, name))
  .filter((path) => /from '\.\/chrome'/.test(readFileSync(path, 'utf8')))
/** Where the probe lives, as far as the compiler knows: beside the helper, so it imports it as the specs do. */
const PROBE = join(DIR, 'chrome-probe.ts')

const HEADER = [
  'import type { Page, TestInfo } from \'@playwright/test\'',
  'import { CHROME_NAMES, DRAWN, SITE, TODAYS_NAMES, appearanceControl, brandLink, chromeAt, footerLogo, ifToday, onlyToday, rookMark, siteFooter, siteHeader, todayAt, widthOf, type Chrome } from \'./chrome\'',
  'declare const page: Page',
  'declare const testInfo: TestInfo',
  'declare const other: { name: string }',
]

/** Calls that must compile. */
const COMPILES: Record<string, string> = {
  'onlyToday with a list of widths and why': 'onlyToday(testInfo, \'header\', [390, 768, 1280], \'today\\\'s image, 44 by 44\')',
  'onlyToday of the footer at the page\'s width': 'onlyToday(testInfo, \'footer\', [widthOf(page)], \'today\\\'s image in the footer\')',
  'onlyToday asking about another build': 'onlyToday(testInfo, \'header\', [1280], \'the other build\\\'s header\', other.name)',
  'ifToday with a check that returns': 'void ifToday(testInfo, \'header\', 1280, \'the rook mark 30 pixels square\', () => {})',
  'ifToday with a check that waits': 'void ifToday(testInfo, \'footer\', widthOf(page), \'the logo\\\'s file\', async () => { await footerLogo(page).count() })',
  'ifToday asking about another build': 'void ifToday(testInfo, \'header\', widthOf(page), \'no Profile there\', async () => {}, other.name)',
  'chromeAt answering today or new': 'export const answer: Chrome = chromeAt(\'a11y-on\', \'header\', 1280)',
  'todayAt answering yes or no': 'export const today: boolean = todayAt(\'a11y-off\', \'footer\', [320, 390])',
  'the locators, as Playwright\'s': 'void [siteHeader(page), siteFooter(page), brandLink(page), rookMark(page), appearanceControl(page)].map((l) => l.count())',
  'a name any header gives, by role': 'void siteHeader(page).getByRole(\'link\', { name: CHROME_NAMES.logIn }).click()',
  'a name today\'s header alone gives': 'export const profile: \'Profile\' = TODAYS_NAMES.profile',
  'the selectors, handed to the page': 'void page.evaluate((site) => document.querySelector(site.header)?.getBoundingClientRect().height, SITE)',
  'the table, read': 'export const pairs = DRAWN[\'a11y-on\'].header.length',
}

/** Calls that must not compile, with why. */
const REFUSED: Record<string, string> = {
  'onlyToday of a part that is neither the header nor the footer': 'onlyToday(testInfo, \'main\', [1280], \'why\')',
  'onlyToday of a part named with a capital': 'onlyToday(testInfo, \'Header\', [1280], \'why\')',
  'onlyToday given one width where it reads a list': 'onlyToday(testInfo, \'header\', 1280, \'why\')',
  'onlyToday that does not say why': 'onlyToday(testInfo, \'header\', [1280])',
  'onlyToday handed a build\'s name where the test\'s testInfo goes': 'onlyToday(\'a11y-on\', \'header\', [1280], \'why\')',
  'ifToday of a part that is neither': 'void ifToday(testInfo, \'sheet\', 1280, \'what\', () => {})',
  'ifToday given a list where it reads one width': 'void ifToday(testInfo, \'header\', [1280], \'what\', () => {})',
  'ifToday with no check to run': 'void ifToday(testInfo, \'header\', 1280, \'what\')',
  'ifToday handed a check where what it marks goes': 'void ifToday(testInfo, \'header\', 1280, () => {}, () => {})',
  'chromeAt of a part that is neither': 'void chromeAt(\'a11y-on\', \'footer-bar\', 1280)',
  'chromeAt read as today\'s alone': 'export const only: \'today\' = chromeAt(\'a11y-on\', \'header\', 1280)',
  'a selector of SITE changed': 'SITE.header = \'main header\'',
  'a name of either list changed': 'CHROME_NAMES.logIn = \'Sign in\'',
  'a name today\'s header does not give': 'export const mine = TODAYS_NAMES.myLca',
  'the table changed by a spec': 'DRAWN[\'a11y-on\'].header = [[0, \'new\']]',
}

interface Compiled {
  /** Errors in the helper and in each browser file that imports it, by file. */
  readers: Map<string, string[]>
  /** Error messages on each probe case's line, by the case's name. */
  errors: Map<string, string[]>
  /** Errors on the probe's header lines or with no place, which would make every other result meaningless. */
  stray: string[]
}

function compile(): Compiled {
  const config = ts.getParsedCommandLineOfConfigFile(join(ROOT, 'tsconfig.app.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    },
  })
  if (!config) throw new Error('tsconfig.app.json could not be read')
  const cases = [...Object.entries(COMPILES), ...Object.entries(REFUSED)]
  const lines = [...HEADER, ...cases.map(([, call]) => call)]
  const source = `${lines.join('\n')}\n`
  // The site's own settings, with what the browser tests run in: Node's types, and the newer
  // libraries of the browser and of Node that the specs use (Array.prototype.at, for one).
  const options: ts.CompilerOptions = {
    ...config.options,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    types: ['node'],
  }
  const host = ts.createCompilerHost(options)
  const { getSourceFile, fileExists, readFile } = host
  host.getSourceFile = (name, version, ...rest) =>
    name === PROBE ? ts.createSourceFile(name, source, version, true, ts.ScriptKind.TS) : getSourceFile.call(host, name, version, ...rest)
  host.fileExists = (name) => name === PROBE || fileExists.call(host, name)
  host.readFile = (name) => (name === PROBE ? source : readFile.call(host, name))
  const program = ts.createProgram({ rootNames: [HELPER, ...READERS, PROBE, join(ROOT, 'node_modules/vite/client.d.ts')], options, host })
  const readers = new Map<string, string[]>()
  for (const path of [HELPER, ...READERS]) {
    const file = program.getSourceFile(path)
    if (!file) throw new Error(`the compiler did not read ${path}`)
    readers.set(path.slice(ROOT.length + 1), ts.getPreEmitDiagnostics(program, file).map((d) => {
      const at = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : 0
      return `line ${at}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`
    }))
  }
  const probe = program.getSourceFile(PROBE)!
  const errors = new Map<string, string[]>(cases.map(([name]) => [name, []]))
  const stray: string[] = []
  for (const d of ts.getPreEmitDiagnostics(program, probe)) {
    const text = ts.flattenDiagnosticMessageText(d.messageText, ' ')
    if (!d.file || d.file.fileName !== PROBE || d.start === undefined) {
      stray.push(text)
      continue
    }
    const line = d.file.getLineAndCharacterOfPosition(d.start).line - HEADER.length
    if (line < 0 || line >= cases.length) stray.push(text)
    else errors.get(cases[line][0])!.push(text)
  }
  return { readers, errors, stray }
}

let compiled: Compiled
beforeAll(() => {
  compiled = compile()
}, 120_000)

describe('the helper and the browser files that read the chrome through it', () => {
  it('finds the files that import the helper, the nine specs that read the chrome among them', () => {
    const names = READERS.map((path) => path.slice(DIR.length + 1))
    expect(names).toEqual(expect.arrayContaining([
      'brand.spec.ts', 'brand-edges.spec.ts', 'heritage.spec.ts', 'home.spec.ts', 'tokens.spec.ts',
      'nav.spec.ts', 'nav-edges.spec.ts', 'signed-in.spec.ts', 'signed-in-edges.spec.ts',
    ]))
  })

  it('compile with no error, the helper first', () => {
    const found = [...compiled.readers.entries()].filter(([, errors]) => errors.length > 0)
    expect(Object.fromEntries(found)).toEqual({})
    expect(compiled.readers.size).toBe(READERS.length + 1)
  })
})

describe('the probe itself', () => {
  it('compiles its imports and its own lines cleanly, so each result below is about its case', () => {
    expect(compiled.stray).toEqual([])
  })
})

describe('calls that compile', () => {
  it.each(Object.keys(COMPILES))('%s', (name) => {
    expect(compiled.errors.get(name)).toEqual([])
  })
})

describe('calls that do not compile', () => {
  it.each(Object.keys(REFUSED))('%s', (name) => {
    expect(compiled.errors.get(name)!.length, REFUSED[name]).toBeGreaterThan(0)
  })
})
