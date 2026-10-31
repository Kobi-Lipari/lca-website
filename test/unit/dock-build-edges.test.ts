// test/unit/dock-build-edges.test.ts
//
// What WS02 step 7 changed in the build, and around the tests, for the
// phone's dock, read without a browser:
//
// - the viewport plugin's two hooks, called as vite calls them, once with
//   the build's settled config and then with the page: with each mix of
//   newLook and newNav, through VITE_FLAGS in the accessibility test build
//   and through src/lib/features.ts in any build, the page is left as it
//   is, given the prepaint script alone, or given the script and
//   viewport-fit=cover, the one line of the viewport tag the only one that
//   changes;
// - the code splitting's groups: the switches' file first, and the class
//   helpers' file, which takes in src/lib/utils.ts, clsx, tailwind-merge
//   and the helper library tslib wherever npm puts them, and nothing else;
// - each test of test/unit/e2e-preview-guard.test.ts that starts
//   Playwright's command line has 20 seconds or more, none left on
//   vitest's 5 second default, under a loaded machine;
// - the decided phone board's two colours that are no token of the new
//   look, the tab bar's line #d9d8d1 and the light gold #e6cf86 of the
//   section's name, written nowhere in the site's code or its stylesheet.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { afterAll, describe, expect, it } from 'vitest'
import viteConfig, { COVER_VIEWPORT, TODAYS_VIEWPORT, prepaintPlugin } from '../../vite.config'
import { PREPAINT_SCRIPT } from '@/lib/colorScheme'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const SITE_PAGE = read('index.html')
const FEATURES_SOURCE = read('src/lib/features.ts')

/** The two hooks of the plugin, as vite calls them. */
interface Hooks {
  configResolved: (config: { mode: string; env: Record<string, string | undefined> }) => void
  transformIndexHtml: (html: string) => unknown
}

/** What the plugin makes of a page in a build of this mode and these VITE_FLAGS, its switches read from a features file. */
function transformed(mode: string, flags: string | undefined, featuresFile?: string, page = SITE_PAGE): unknown {
  const plugin = prepaintPlugin(featuresFile) as unknown as Hooks
  plugin.configResolved({ mode, env: { VITE_FLAGS: flags } })
  return plugin.transformIndexHtml(page)
}

/** The prepaint script, first in the head. */
const SCRIPT = { tag: 'script', children: PREPAINT_SCRIPT, injectTo: 'head-prepend' }
/** The site's own page with viewport-fit=cover. */
const COVERED = SITE_PAGE.replace(TODAYS_VIEWPORT, COVER_VIEWPORT)

describe('the viewport plugin\'s hooks, called as vite calls them', () => {
  const dirs: string[] = []
  afterAll(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  })
  /** A features file with the two switches written as given. */
  function featuresFile(look: boolean, nav: boolean): string {
    const dir = mkdtempSync(join(tmpdir(), 'lca-dock-features-'))
    dirs.push(dir)
    const file = join(dir, 'features.ts')
    const text = FEATURES_SOURCE.replace(/^(\s*newLook:\s*)false,/m, `$1${look},`).replace(/^(\s*newNav:\s*)false,/m, `$1${nav},`)
    expect(text.split(/^\s*newLook:\s*(?:true|false),/m)).toHaveLength(2)
    writeFileSync(file, text)
    return file
  }

  it.each([
    ['', 'the page as it is'],
    [undefined, 'the page as it is'],
    ['newNav', 'the page as it is'],
    ['newNav,siteSearch,eventStrip', 'the page as it is'],
    ['newLook', 'the script alone'],
    ['newLook,themeHeritage', 'the script alone'],
    ['newLook,newNav', 'the script and the tag'],
    [' newNav , newLook ', 'the script and the tag'],
    ['newLook,themeHeritage,newNav,siteSearch,eventStrip,eventStripLive,liveMarker', 'the script and the tag'],
  ])('in the accessibility test build with VITE_FLAGS %j, the switches written off, gives %s', (flags, gives) => {
    const result = transformed('a11y', flags)
    if (gives === 'the page as it is') expect(result).toBeUndefined()
    else if (gives === 'the script alone') expect(result).toEqual([SCRIPT])
    else expect(result).toEqual({ html: COVERED, tags: [SCRIPT] })
  })

  it.each(['production', 'development', 'test', 'A11Y'])('in the %s build, which reads no VITE_FLAGS, leaves the page as it is though VITE_FLAGS names both switches', (mode) => {
    expect(transformed(mode, 'newLook,newNav')).toBeUndefined()
  })

  it('reads both switches from the features file in any build: the tag with both written on, the script alone with newLook on alone, and the page as it is with newNav on alone', () => {
    for (const mode of ['production', 'development', 'a11y']) {
      expect(transformed(mode, undefined, featuresFile(true, true)), mode).toEqual({ html: COVERED, tags: [SCRIPT] })
      expect(transformed(mode, undefined, featuresFile(true, false)), mode).toEqual([SCRIPT])
      expect(transformed(mode, undefined, featuresFile(false, true)), mode).toBeUndefined()
      expect(transformed(mode, undefined, featuresFile(false, false)), mode).toBeUndefined()
    }
    // Written on in the file, a switch needs no VITE_FLAGS; written off, VITE_FLAGS turns it on in the accessibility test build alone.
    expect(transformed('a11y', 'newNav', featuresFile(true, false))).toEqual({ html: COVERED, tags: [SCRIPT] })
    expect(transformed('production', 'newNav', featuresFile(true, false))).toEqual([SCRIPT])
  })

  it('changes the viewport tag\'s line of the site\'s page alone, in place, and keeps the page\'s charset first', () => {
    const before = SITE_PAGE.split('\n')
    const after = COVERED.split('\n')
    expect(after).toHaveLength(before.length)
    const changed = before.map((line, i) => (line === after[i] ? -1 : i)).filter((i) => i >= 0)
    expect(changed).toHaveLength(1)
    expect(before[changed[0]].trim()).toBe(TODAYS_VIEWPORT)
    expect(after[changed[0]].trim()).toBe(COVER_VIEWPORT)
    expect(COVERED.indexOf('<meta charset="UTF-8" />')).toBeLessThan(COVERED.indexOf(COVER_VIEWPORT))
  })

  it('gives each build its own answer: one build\'s switches never carry over to the next made with the same plugin', () => {
    const plugin = prepaintPlugin() as unknown as Hooks
    plugin.configResolved({ mode: 'a11y', env: { VITE_FLAGS: 'newLook,newNav' } })
    expect(plugin.transformIndexHtml(SITE_PAGE)).toEqual({ html: COVERED, tags: [SCRIPT] })
    plugin.configResolved({ mode: 'a11y', env: { VITE_FLAGS: 'newLook' } })
    expect(plugin.transformIndexHtml(SITE_PAGE)).toEqual([SCRIPT])
    plugin.configResolved({ mode: 'a11y', env: {} })
    expect(plugin.transformIndexHtml(SITE_PAGE)).toBeUndefined()
  })
})

describe('the build\'s code splitting', () => {
  type Group = { name: string; test: RegExp }
  const groups = ((viteConfig as { build?: { rolldownOptions?: { output?: { codeSplitting?: { groups?: Group[] } } } } }).build?.rolldownOptions?.output?.codeSplitting?.groups ?? []) as Group[]
  const group = (name: string) => groups.find((g) => g.name === name)?.test ?? /$^/

  it('keeps the switches\' group first, and has the class helpers\' group, each named once', () => {
    expect(groups[0]?.name).toBe('features')
    expect(groups.filter((g) => g.name === 'features')).toHaveLength(1)
    expect(groups.filter((g) => g.name === 'utils')).toHaveLength(1)
  })

  it('puts src/lib/utils.ts, clsx, tailwind-merge and tslib in the class helpers\' file, by either kind of slash and from a package\'s own node_modules, and nothing else', () => {
    const utils = group('utils')
    const taken = [
      '/repo/src/lib/utils.ts',
      'C:\\repo\\src\\lib\\utils.ts',
      '/repo/node_modules/clsx/dist/clsx.mjs',
      '/repo/node_modules/tailwind-merge/dist/bundle-mjs.mjs',
      '/repo/node_modules/tslib/tslib.es6.mjs',
      'C:\\repo\\node_modules\\tslib\\tslib.es6.mjs',
      '/repo/node_modules/@supabase/auth-js/node_modules/tslib/tslib.es6.mjs',
    ]
    for (const path of taken) expect(utils.test(path), path).toBe(true)
    const left = [
      '/repo/src/lib/utils.test.ts',
      '/repo/src/lib/utilsExtra.ts',
      '/repo/src/components/ui/utils.ts',
      '/repo/src/lib/features.ts',
      '/repo/node_modules/tslib-extra/index.js',
      '/repo/node_modules/clsx-lite/index.js',
      '/repo/node_modules/tailwind-merge-plus/index.js',
      '/repo/node_modules/@radix-ui/react-dialog/dist/index.mjs',
      '/repo/node_modules/lucide-react/dist/esm/icons/trophy.mjs',
    ]
    for (const path of left) expect(utils.test(path), path).toBe(false)
  })

  it('keeps the two groups apart: the switches\' file is never the class helpers\', nor the other way round', () => {
    expect(group('features').test('/repo/src/lib/features.ts')).toBe(true)
    expect(group('utils').test('/repo/src/lib/features.ts')).toBe(false)
    expect(group('features').test('/repo/src/lib/utils.ts')).toBe(false)
  })
})

describe('the Playwright command line\'s tests in test/unit/e2e-preview-guard.test.ts', () => {
  /** Each test under "the Playwright command line": its title, whether it starts the command line, and its own time limit. */
  function commandLineTests(): Array<{ title: string; starts: boolean; limit: number | null }> {
    const path = 'test/unit/e2e-preview-guard.test.ts'
    const file = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const found: Array<{ title: string; starts: boolean; limit: number | null }> = []
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'describe' && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === 'the Playwright command line') {
        const tests = (child: ts.Node) => {
          if (ts.isCallExpression(child)) {
            const callee = child.expression
            const plain = ts.isIdentifier(callee) && callee.text === 'it'
            const each = ts.isCallExpression(callee) && callee.expression.getText(file) === 'it.each'
            if (plain || each) {
              const [title, body, limit] = child.arguments
              found.push({
                title: title && ts.isStringLiteral(title) ? title.text : (title?.getText(file) ?? ''),
                starts: !!body && /\bplaywright\(/.test(body.getText(file)),
                limit: limit && ts.isNumericLiteral(limit) ? Number(limit.text.replace(/_/g, '')) : null,
              })
              return
            }
          }
          ts.forEachChild(child, tests)
        }
        tests(node.arguments[1])
        return
      }
      ts.forEachChild(node, visit)
    }
    visit(file)
    return found
  }

  it('are found, each starting the command line', () => {
    const found = commandLineTests()
    expect(found.length).toBeGreaterThanOrEqual(5)
    for (const t of found) expect(t.starts, t.title).toBe(true)
  })

  it('each have 20 seconds or more, none left on vitest\'s 5 second default', () => {
    for (const t of commandLineTests()) expect(t.limit, t.title).toBeGreaterThanOrEqual(20_000)
  })
})

describe('the decided phone board\'s colours that are no token', () => {
  /** Every TypeScript, TSX and CSS file under src. */
  function sources(dir = 'src'): string[] {
    return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
      const path = `${dir}/${e.name}`
      if (e.isDirectory()) return sources(path)
      return /\.(tsx?|css)$/.test(e.name) ? [path] : []
    })
  }
  /** A file's code, without its comments: a script's strings, templates and JSX words, and a stylesheet's rules. */
  function codeOf(path: string): string {
    const text = read(path)
    if (path.endsWith('.css')) return text.replace(/\/\*[\s\S]*?\*\//g, '')
    const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const parts: string[] = []
    const visit = (node: ts.Node) => {
      if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) parts.push(node.text)
      ts.forEachChild(node, visit)
    }
    visit(file)
    return parts.join('\n')
  }

  it('reads the files it means to, the tab bar\'s and the app bar\'s among them, and finds the gold-ink line where the tab bar draws it', () => {
    const files = sources()
    expect(files).toEqual(expect.arrayContaining(['src/components/layout/BottomTabs.tsx', 'src/components/layout/MobileAppBar.tsx', 'src/index.css']))
    // The reading is not blind: the tab bar's own raw colour is found in its code.
    expect(codeOf('src/components/layout/BottomTabs.tsx')).toContain('border-t-[#866a1e]')
  })

  it('writes neither the tab bar\'s line #d9d8d1 nor the light gold #e6cf86 anywhere in the site\'s code or stylesheet: the line is the look\'s hairline and the section\'s name is white', () => {
    const found = sources().filter((path) => /#?\b(d9d8d1|e6cf86)\b/i.test(codeOf(path)))
    expect(found).toEqual([])
  })
})
