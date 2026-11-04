// test/unit/build-date-edges.test.ts
//
// The build's date and the logo's sized copies at their edges (WS02 step 8),
// through the site's own plugin in real builds of a one-page site made in a
// folder of its own, whose script reads the new footer's date reader
// (src/components/layout/footerParts.ts) and imports the logo's two sized
// copies as LcaLogo does:
//
// - what the plugin writes is what the footer reads: the built page, read
//   back as a page, gives lastUpdated() the build's own instant and its
//   Louisiana day; and the plugin and the reader take the same forms of an
//   instant and refuse the same others, so the plugin never writes a date
//   the footer would leave out;
// - the instant is worked out once for each build, when the build reads its
//   settings, in UTC whatever the machine's own zone, and a later build made
//   with the same plugin gets its own;
// - two builds with the chrome on differ in index.html alone, by the meta's
//   content, every other file the same by name and by bytes; two builds
//   with the chrome off are the same byte for byte and hold no date at all;
// - the logo's two sized copies are files of their own under the site's
//   rule, where Vite's own rule would write the 56 pixel copy into the
//   script, and a small file of another kind is still written in as before;
// - nothing else carries the date: no file under src reads a constant the
//   build writes into the code, and src/vite-env.d.ts declares none.
import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { build } from 'vite'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { COVER_VIEWPORT, TODAYS_VIEWPORT, inlineAsset, prepaintPlugin, withBuildDate, withCoverViewport } from '../../vite.config'
import { lastUpdated } from '@/components/layout/footerParts'
import { formatDate } from '@/lib/format'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const SITE_PAGE = read('index.html')
const FEATURES_SOURCE = read('src/lib/features.ts')

/** The site's page with the chrome's viewport tag, as the plugin covers it before it writes the date. */
const COVERED = withCoverViewport(SITE_PAGE)

/** The day as the site writes a date with its year, "Sat, Oct 31, 2026". */
const DAY_WITH_YEAR = /^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat), (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}$/

/** The plugin's two hooks, as vite calls them. */
interface Hooks {
  configResolved: (config: { mode: string; env: Record<string, string | undefined> }) => void
  transformIndexHtml: (html: string) => unknown
}

const dirs: string[] = []
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** A folder of its own for one test's files. */
function folder(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

/** A copy of src/lib/features.ts with newLook and newNav written as given, whatever the file holds now. */
function featuresFile(look: boolean, nav: boolean): string {
  const file = join(folder('lca-date-features-'), 'features.ts')
  const text = FEATURES_SOURCE.replace(/^(\s*newLook:\s*)(?:true|false),/m, `$1${look},`).replace(/^(\s*newNav:\s*)(?:true|false),/m, `$1${nav},`)
  expect(text.match(/^\s*newLook:\s*(?:true|false),/gm), 'newLook written once').toHaveLength(1)
  expect(text.match(/^\s*newNav:\s*(?:true|false),/gm), 'newNav written once').toHaveLength(1)
  writeFileSync(file, text)
  return file
}

/** The html the plugin gives a page, or the page as it was when the plugin leaves it alone. */
function htmlOf(result: unknown, page: string): string {
  if (result && typeof result === 'object' && 'html' in result) return (result as { html: string }).html
  return page
}

/** The build-date metas a page holds, each with its content. */
const buildDates = (html: string) => [...html.matchAll(/<meta name="build-date" content="([^"]*)" \/>/g)].map((m) => m[1])

/** A page holding a build-date meta with the given content, read as a browser reads it. */
function pageWithMeta(content: string): Document {
  return new JSDOM(`<!doctype html><html><head><meta name="build-date" content="${content}"></head><body></body></html>`).window.document
}

/** What the footer's reader gives on a page. */
function readOn(doc: Document) {
  vi.stubGlobal('document', doc)
  try {
    return lastUpdated()
  } finally {
    vi.unstubAllGlobals()
  }
}

/** Whether the plugin writes an instant, or stops the build for it. */
function pluginTakes(instant: string): boolean {
  try {
    withBuildDate(COVERED, instant)
    return true
  } catch {
    return false
  }
}

// ── What the plugin writes is what the footer reads ────────────────────────

describe('the meta the plugin writes and the footer reads', () => {
  it('a page the plugin dated, read back as a page, gives the footer that instant and its Louisiana day', () => {
    for (const instant of ['2026-10-31T14:42:00.000Z', '2026-10-31T03:00:00.000Z', '2027-01-01T05:59:59.999Z']) {
      const html = withBuildDate(COVERED, instant)
      const doc = new JSDOM(html).window.document
      // Found by the selector the footer reads, in the head, once.
      expect(doc.head.querySelectorAll('meta[name="build-date"]'), instant).toHaveLength(1)
      const read = readOn(doc)
      expect(read, instant).toEqual({ instant, text: formatDate(instant, { year: true }) })
      expect(read!.text, instant).toMatch(DAY_WITH_YEAR)
    }
    // The evening before in Louisiana, and the last moment of the year there.
    expect(readOn(new JSDOM(withBuildDate(COVERED, '2026-10-31T03:00:00.000Z')).window.document)!.text).toBe('Fri, Oct 30, 2026')
    expect(readOn(new JSDOM(withBuildDate(COVERED, '2027-01-01T05:59:59.999Z')).window.document)!.text).toBe('Thu, Dec 31, 2026')
  })

  it.each([
    ['the build\'s own form', '2026-10-31T14:42:00.000Z', true],
    ['the first instant of the clock', '1970-01-01T00:00:00.000Z', true],
    ['no milliseconds', '2026-10-31T14:42:00Z', false],
    ['a tenth of a second alone', '2026-10-31T14:42:00.0Z', false],
    ['an offset for the zone', '2026-10-31T14:42:00.000+00:00', false],
    ['a small z', '2026-10-31T14:42:00.000z', false],
    ['a space for the T', '2026-10-31 14:42:00.000Z', false],
    ['a space before it', ' 2026-10-31T14:42:00.000Z', false],
    ['a space after it', '2026-10-31T14:42:00.000Z ', false],
    ['a year of six digits', '+002026-10-31T14:42:00.000Z', false],
    ['a day alone', '2026-10-31', false],
    ['the words of a date', 'Sat, Oct 31, 2026', false],
    ['nothing', '', false],
  ] as const)('%s: the plugin and the footer agree, both taking it or both refusing it (%j)', (_form, instant, taken) => {
    expect(pluginTakes(instant), 'the plugin').toBe(taken)
    expect(readOn(pageWithMeta(instant)) !== null, 'the footer').toBe(taken)
  })

  it('reads the first instant of the clock as the evening before in Louisiana, Wednesday, December 31, 1969', () => {
    expect(readOn(pageWithMeta('1970-01-01T00:00:00.000Z'))).toEqual({ instant: '1970-01-01T00:00:00.000Z', text: 'Wed, Dec 31, 1969' })
  })

  it('gives nothing on a page with no meta, or with the meta of another name, and nothing where there is no page at all', () => {
    expect(readOn(new JSDOM('<!doctype html><html><head></head><body></body></html>').window.document)).toBeNull()
    expect(readOn(new JSDOM('<!doctype html><html><head><meta name="build-time" content="2026-10-31T14:42:00.000Z"></head></html>').window.document)).toBeNull()
    expect(readOn(new JSDOM('<!doctype html><html><head><meta property="build-date" content="2026-10-31T14:42:00.000Z"></head></html>').window.document)).toBeNull()
    // This file runs with no page, as the server's code would.
    expect(typeof document).toBe('undefined')
    expect(lastUpdated()).toBeNull()
  })
})

// ── The instant, once for each build ───────────────────────────────────────

describe('the instant the plugin writes', () => {
  /** The plugin with the chrome written on in its features file. */
  const chromePlugin = () => prepaintPlugin(featuresFile(true, true)) as unknown as Hooks

  it('is worked out once, when the build reads its settings: every page the build writes later gets the same instant, and a new build with the same plugin its own', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const plugin = chromePlugin()
    vi.setSystemTime(new Date('2026-10-31T14:42:00.000Z'))
    plugin.configResolved({ mode: 'production', env: {} })
    vi.setSystemTime(new Date('2026-10-31T14:59:30.250Z'))
    const first = htmlOf(plugin.transformIndexHtml(SITE_PAGE), SITE_PAGE)
    vi.setSystemTime(new Date('2026-10-31T15:10:00.000Z'))
    const second = htmlOf(plugin.transformIndexHtml(SITE_PAGE), SITE_PAGE)
    expect(buildDates(first)).toEqual(['2026-10-31T14:42:00.000Z'])
    expect(second).toBe(first)
    // The next build, made later with the same plugin, reads its settings again and gets its own instant.
    vi.setSystemTime(new Date('2026-11-01T07:30:00.000Z'))
    plugin.configResolved({ mode: 'production', env: {} })
    expect(buildDates(htmlOf(plugin.transformIndexHtml(SITE_PAGE), SITE_PAGE))).toEqual(['2026-11-01T07:30:00.000Z'])
  })

  it.each([
    ['Pacific/Kiritimati', [20, 30]],
    ['Pacific/Pago_Pago', [19, 30]],
    ['America/Chicago', [1, 30]],
    ['Asia/Kolkata', [12, 0]],
  ] as const)('is written in UTC on a machine whose own zone is %s', (zone, wallClock) => {
    const was = process.env.TZ
    process.env.TZ = zone
    try {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-11-01T06:30:00.000Z'))
      const plugin = chromePlugin()
      plugin.configResolved({ mode: 'production', env: {} })
      const [instant] = buildDates(htmlOf(plugin.transformIndexHtml(SITE_PAGE), SITE_PAGE))
      expect(instant).toBe('2026-11-01T06:30:00.000Z')
      // The machine's own zone took: its wall clock at that instant is the zone's, not UTC's.
      vi.useRealTimers()
      const local = new Date('2026-11-01T06:30:00.000Z')
      expect([local.getHours(), local.getMinutes()]).toEqual(wallClock)
      // The footer shows it as the Louisiana day, whatever the machine's zone: 1:30 in the morning there, on Sunday, November 1, 2026.
      expect(readOn(pageWithMeta(instant))).toEqual({ instant, text: 'Sun, Nov 1, 2026' })
    } finally {
      if (was === undefined) delete process.env.TZ
      else process.env.TZ = was
    }
  })

  it('is the moment the build read its settings on the real clock, no later than the test\'s own now', () => {
    const before = Date.now()
    const plugin = chromePlugin()
    plugin.configResolved({ mode: 'production', env: {} })
    const after = Date.now()
    const [instant] = buildDates(htmlOf(plugin.transformIndexHtml(SITE_PAGE), SITE_PAGE))
    expect(Date.parse(instant)).toBeGreaterThanOrEqual(before)
    expect(Date.parse(instant)).toBeLessThanOrEqual(after)
    expect(Date.parse(instant)).toBeLessThanOrEqual(Date.now())
  })

  it('is written by no build with the chrome off, at any moment, in any mix of the two switches or with VITE_FLAGS asking for them outside the test build', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-31T14:42:00.000Z'))
    for (const [look, nav] of [[false, false], [true, false], [false, true]] as const) {
      const plugin = prepaintPlugin(featuresFile(look, nav)) as unknown as Hooks
      for (const mode of ['production', 'development', 'a11y']) {
        plugin.configResolved({ mode, env: {} })
        const html = htmlOf(plugin.transformIndexHtml(SITE_PAGE), SITE_PAGE)
        expect(html, `${mode}, newLook ${look}, newNav ${nav}`).not.toContain('build-date')
        expect(html).toContain(TODAYS_VIEWPORT)
      }
    }
    // VITE_FLAGS is read in the accessibility test build alone.
    const plugin = prepaintPlugin(featuresFile(false, false)) as unknown as Hooks
    plugin.configResolved({ mode: 'production', env: { VITE_FLAGS: 'newLook,newNav' } })
    expect(htmlOf(plugin.transformIndexHtml(SITE_PAGE), SITE_PAGE)).not.toContain('build-date')
    plugin.configResolved({ mode: 'a11y', env: { VITE_FLAGS: 'newLook,newNav' } })
    expect(buildDates(htmlOf(plugin.transformIndexHtml(SITE_PAGE), SITE_PAGE))).toEqual(['2026-10-31T14:42:00.000Z'])
  })
})

// ── Real builds ────────────────────────────────────────────────────────────

/** A small file of another kind, under Vite's line of 4,096 bytes: a one-pixel picture. */
const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==', 'base64')

/** The one-page site's script: the footer's date reader, and the logo's two sized copies as LcaLogo imports them. */
const MAIN = [
  "import { lastUpdated } from '@/components/layout/footerParts'",
  "import logo56 from '@/assets/lca-logo-56.webp'",
  "import logo112 from '@/assets/lca-logo-112.webp'",
  "import dot from './dot.png'",
  "document.getElementById('root').textContent = JSON.stringify([lastUpdated(), logo56, logo112, dot])",
  '',
].join('\n')

/** Every file of a built site, by its path in the site, with its size and its bytes' hash. */
function filesOf(dist: string): Map<string, { size: number; sha: string }> {
  const out = new Map<string, { size: number; sha: string }>()
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else out.set(relative(dist, path), { size: statSync(path).size, sha: createHash('sha256').update(readFileSync(path)).digest('hex') })
    }
  }
  walk(dist)
  return out
}

/** Builds the one-page site with the site's plugin and the given inline rule into a folder of its own, and returns that folder's dist. */
async function buildSite(features: string, inline: 'the site\'s rule' | 'Vite\'s own rule' = 'the site\'s rule'): Promise<string> {
  const root = folder('lca-date-site-')
  writeFileSync(join(root, 'index.html'), SITE_PAGE.replace('/src/main.tsx', '/main.js'))
  writeFileSync(join(root, 'main.js'), MAIN)
  writeFileSync(join(root, 'dot.png'), TINY_PNG)
  await build({
    root,
    mode: 'production',
    configFile: false,
    envFile: false,
    logLevel: 'silent',
    resolve: { alias: { '@': join(ROOT, 'src'), '@domain': join(ROOT, 'domain') } },
    plugins: [prepaintPlugin(features)],
    build: { outDir: join(root, 'dist'), emptyOutDir: true, ...(inline === 'the site\'s rule' ? { assetsInlineLimit: inlineAsset } : {}) },
  })
  return join(root, 'dist')
}

/** The paths at which two built sites differ, with what each side holds. */
function differences(a: Map<string, { size: number; sha: string }>, b: Map<string, { size: number; sha: string }>): string[] {
  const paths = new Set([...a.keys(), ...b.keys()])
  return [...paths].filter((p) => a.get(p)?.sha !== b.get(p)?.sha).sort()
}

/** Every text file of a built site, read. */
const textsOf = (dist: string) => [...filesOf(dist).keys()].filter((p) => /\.(?:js|css|html)$/.test(p)).map((p) => [p, readFileSync(join(dist, p), 'utf8')] as const)

/** An ISO instant anywhere in a text. */
const ANY_INSTANT = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g

describe('real builds of a one-page site with the site\'s plugin', () => {
  it('with the chrome on: the page carries its build\'s date, which the footer reads back, and two builds differ in index.html alone, by that date', async () => {
    const features = featuresFile(true, true)
    const started = Date.now()
    const first = await buildSite(features)
    await new Promise((done) => setTimeout(done, 5))
    const second = await buildSite(features)
    const [one, two] = [first, second].map((dist) => buildDates(readFileSync(join(dist, 'index.html'), 'utf8')))
    expect(one).toHaveLength(1)
    expect(two).toHaveLength(1)
    expect(one[0]).not.toBe(two[0])
    for (const instant of [one[0], two[0]]) {
      expect(Date.parse(instant)).toBeGreaterThanOrEqual(started - 1000)
      expect(Date.parse(instant)).toBeLessThanOrEqual(Date.now())
    }
    // The built page, read back as a page, gives the footer its build's own instant.
    const read = readOn(new JSDOM(readFileSync(join(first, 'index.html'), 'utf8')).window.document)
    expect(read).toEqual({ instant: one[0], text: formatDate(one[0], { year: true }) })
    expect(read!.text).toMatch(DAY_WITH_YEAR)
    // Only index.html differs, and only by the meta's content: every script, style and picture keeps its name and its bytes.
    const [a, b] = [filesOf(first), filesOf(second)]
    expect([...a.keys()].sort()).toEqual([...b.keys()].sort())
    expect(differences(a, b)).toEqual(['index.html'])
    expect(readFileSync(join(first, 'index.html'), 'utf8').replace(one[0], 'the instant')).toBe(readFileSync(join(second, 'index.html'), 'utf8').replace(two[0], 'the instant'))
    // No built script or style holds an instant: the date is in the page alone.
    for (const [path, text] of textsOf(first)) {
      if (path === 'index.html') continue
      expect(text.match(ANY_INSTANT) ?? [], path).toEqual([])
      expect(text, path).not.toContain(one[0])
    }
  }, 120_000)

  it('with the chrome off, in each mix of the two switches: two builds are the same byte for byte, file for file, and no file holds a date or the meta', async () => {
    for (const [look, nav] of [[false, false], [true, false], [false, true]] as const) {
      const features = featuresFile(look, nav)
      const first = await buildSite(features)
      await new Promise((done) => setTimeout(done, 5))
      const second = await buildSite(features)
      const [a, b] = [filesOf(first), filesOf(second)]
      expect(differences(a, b), `newLook ${look}, newNav ${nav}`).toEqual([])
      // The footer's reader is in the script whatever the switches, so the script names the meta it looks for; no file holds one.
      for (const [path, text] of textsOf(first)) {
        expect(text, path).not.toContain('<meta name="build-date"')
        expect(text.match(ANY_INSTANT) ?? [], path).toEqual([])
      }
      expect(readFileSync(join(first, 'index.html'), 'utf8')).not.toContain('build-date')
      expect(readFileSync(join(first, 'index.html'), 'utf8')).toContain(TODAYS_VIEWPORT)
      expect(readFileSync(join(first, 'index.html'), 'utf8')).not.toContain(COVER_VIEWPORT)
    }
  }, 180_000)

  it('keeps the logo\'s two sized copies files of their own under the site\'s rule, where Vite\'s own rule writes the 56 pixel copy into the script; a small file of another kind is written in either way', async () => {
    const features = featuresFile(true, true)
    const sized = await buildSite(features)
    const files = [...filesOf(sized).keys()]
    const script = textsOf(sized).filter(([path]) => path.endsWith('.js'))
    expect(script).toHaveLength(1)
    const [, js] = script[0]
    for (const [name, bytes] of [['lca-logo-56', 1818], ['lca-logo-112', 4596]] as const) {
      const file = files.filter((path) => new RegExp(`^assets/${name}-[\\w-]+\\.webp$`).test(path))
      expect(file, name).toHaveLength(1)
      // The file as the repository holds it, byte for byte, and the script naming it by its address.
      expect(readFileSync(join(sized, file[0])).equals(readFileSync(join(ROOT, `src/assets/${name}.webp`))), name).toBe(true)
      expect(statSync(join(sized, file[0])).size).toBe(bytes)
      expect(js, name).toContain(`/${file[0]}`)
    }
    expect(js).not.toContain('data:image/webp')
    // The one-pixel picture is under Vite's line, so it is still written into the script.
    expect(js).toContain('data:image/png;base64,')
    expect(files.filter((path) => path.endsWith('.png'))).toEqual([])
    // Under Vite's own rule the 56 pixel copy, 1,818 bytes, would ride in the script itself, fetched by every page that loads it.
    const plain = await buildSite(features, 'Vite\'s own rule')
    const plainFiles = [...filesOf(plain).keys()]
    const [[, plainJs]] = textsOf(plain).filter(([path]) => path.endsWith('.js'))
    expect(plainFiles.filter((path) => /^assets\/lca-logo-56-/.test(path))).toEqual([])
    expect(plainJs).toContain('data:image/webp;base64,')
    // The 112 pixel copy, 4,596 bytes, is over the line either way.
    expect(plainFiles.filter((path) => /^assets\/lca-logo-112-[\w-]+\.webp$/.test(path))).toHaveLength(1)
  }, 120_000)

  it('asks the site\'s rule about each picture by its whole path, so a file of the same name elsewhere is left to Vite', () => {
    expect(inlineAsset(join(ROOT, 'src/assets/lca-logo-56.webp'))).toBe(false)
    expect(inlineAsset(join(ROOT, 'src/assets/lca-logo-112.webp'))).toBe(false)
    for (const path of [join(ROOT, 'public/lca-logo-56.webp'), join(ROOT, 'src/assets/lca-logo-56.webp.map'), join(ROOT, 'src/assets/lca-logo-56.webp?url'), join(ROOT, 'src/assets/LCA-LOGO-56.webp'), 'lca-logo-56.webp']) {
      expect(inlineAsset(path), path).toBeUndefined()
    }
  })
})

/** Every file under a folder, by its path from the repository's root. */
function filesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) out.push(...filesUnder(path))
    else out.push(path)
  }
  return out
}

// ── Who draws the sized copies ─────────────────────────────────────────────

describe('who draws the logo\'s sized copies', () => {
  /** Every file under src that draws the official logo, with the props of each draw. */
  const draws = () =>
    filesUnder('src')
      .filter((path) => /\.tsx$/.test(path))
      .flatMap((path) => [...read(path).matchAll(/<LcaLogo\b([^>]*)\/>/g)].map((m) => [path, m[1].trim()] as const))

  it('is the new footer alone, at 56 by 56 with empty words; today\'s footer and the About page draw the official file as before', () => {
    const all = draws()
    const sized = all.filter(([, props]) => /\bsized\b/.test(props))
    expect(sized).toEqual([['src/components/layout/SiteFooter.tsx', 'width={56} height={56} alt="" sized']])
    // Today's footer under the new look and the About page each still draw the logo, with no sized copy.
    for (const file of ['src/components/layout/Footer.tsx', 'src/pages/AboutPage.tsx']) {
      const theirs = all.filter(([path]) => path === file)
      expect(theirs.length, file).toBeGreaterThan(0)
      for (const [, props] of theirs) expect(props, file).not.toMatch(/\bsized\b/)
    }
  })

  it('names the two sized files in LcaLogo alone, and no page names them', () => {
    const naming = filesUnder('src').filter((path) => /\.(?:ts|tsx|css)$/.test(path) && /lca-logo-(?:56|112)/.test(read(path)))
    expect(naming).toEqual(['src/components/LcaLogo.tsx'])
  })
})

// ── Nothing else carries the date ──────────────────────────────────────────

describe('nothing but the page carries the date', () => {
  const sources = filesUnder('src').filter((path) => /\.(?:ts|tsx)$/.test(path))

  it('reads it in one file under src, the footer\'s reader, and only by the meta\'s name', () => {
    expect(sources.length).toBeGreaterThan(100)
    const naming = sources.filter((path) => read(path).includes('name="build-date"'))
    expect(naming).toEqual(['src/components/layout/footerParts.ts'])
    expect(read('src/components/layout/footerParts.ts')).toContain('document.querySelector(\'meta[name="build-date"]\')')
  })

  it('reads no constant the build writes into the code, and no setting of the environment that holds a date or a build\'s time', () => {
    for (const path of sources) {
      const text = read(path)
      // A name the build would replace, such as two underscores, capitals and two underscores again; a pure-call note is not one.
      const constants = [...text.matchAll(/(?<![@\w])__[A-Z][A-Z0-9_]*__(?!\w)/g)].map((m) => m[0])
      expect(constants, path).toEqual([])
      expect(text, path).not.toMatch(/import\.meta\.env\.\w*(?:DATE|BUILD|TIME)/)
    }
  })

  it('declares no global of its own in src/vite-env.d.ts, which types the logo\'s sized copies as it types every picture', () => {
    const types = read('src/vite-env.d.ts')
    expect(types).not.toMatch(/\bdeclare\s+(?:const|let|var|global)\b/)
    expect(types).toContain("declare module '*.webp'")
  })
})
