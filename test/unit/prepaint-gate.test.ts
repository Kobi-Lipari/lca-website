// The script that applies the new look and dark mode before the first paint
// (PREPAINT_SCRIPT in src/lib/colorScheme.ts), and the gate that keeps it
// out of every build without newLook (prepaintPlugin in vite.config.ts).
//
// - newLookInBuild reads the switch the way src/lib/features.ts does,
//   VITE_FLAGS counting only in the accessibility test build
// - a real vite build with newLook off injects nothing into the page; with
//   newLook on the script is the first thing in the head
// - the script and createColorScheme agree with isDarkScheme for every
//   stored value and device setting; storage that throws leaves the page on
//   the device setting; nothing adds .dark while newLook is off
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { build } from 'vite'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import viteConfig, { newLookInBuild, prepaintPlugin } from '../../vite.config'
import {
  APPEARANCE_KEY,
  createColorScheme,
  isDarkScheme,
  parseAppearance,
  PREPAINT_SCRIPT,
  SYSTEM_DARK_QUERY,
  type MediaQueryLike,
  type RootLike,
  type StorageLike,
} from '@/lib/colorScheme'
import { applyFlagOverrides, FEATURES } from '@/lib/features'
import { read } from './helpers/cssTokens'

const FEATURES_SOURCE = read('src/lib/features.ts')

describe('newLookInBuild', () => {
  it('reads the value written in src/lib/features.ts, which is off today', () => {
    expect(newLookInBuild(FEATURES_SOURCE, 'production', undefined)).toBe(false)
    expect(newLookInBuild(FEATURES_SOURCE, 'production', undefined)).toBe(FEATURES.newLook)
  })

  it.each([
    ['production', 'newLook'],
    ['development', 'newLook'],
    ['test', 'newLook'],
    ['A11Y', 'newLook'],
    ['a11y', ''],
    ['a11y', undefined],
    ['a11y', 'themeHeritage'],
    ['a11y', 'newLook'],
    ['a11y', ' newLook , themeHeritage'],
    ['a11y', 'themeHeritage,newLook'],
  ])('agrees with applyFlagOverrides in mode %s with VITE_FLAGS %j', (mode, flags) => {
    expect(newLookInBuild(FEATURES_SOURCE, mode, flags)).toBe(applyFlagOverrides(FEATURES, mode, flags).newLook)
  })

  it('is on in every mode once the switch is written as true', () => {
    const on = FEATURES_SOURCE.replace(/^(\s*newLook:\s*)false,/m, '$1true,')
    expect(on).not.toBe(FEATURES_SOURCE)
    for (const mode of ['production', 'development', 'a11y']) expect(newLookInBuild(on, mode, undefined)).toBe(true)
  })

  it('refuses a file where the switch is missing or written twice', () => {
    expect(() => newLookInBuild('const SWITCHES = {}', 'production', undefined)).toThrow(/found 0/)
    expect(() => newLookInBuild('  newLook: false,\n  newLook: true,\n', 'production', undefined)).toThrow(/found 2/)
  })
})

describe('prepaintPlugin in a real vite build', () => {
  const dirs: string[] = []
  afterAll(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  })
  afterEach(() => vi.unstubAllEnvs())

  /** Builds a one-page site with the plugin and returns its index.html. */
  async function buildPage(mode: string, flags: string | undefined, featuresFile?: string): Promise<string> {
    const root = mkdtempSync(join(tmpdir(), 'lca-prepaint-'))
    dirs.push(root)
    writeFileSync(
      join(root, 'index.html'),
      '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <title>Page</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/main.js"></script>\n  </body>\n</html>\n',
    )
    writeFileSync(join(root, 'main.js'), "document.getElementById('root').textContent = 'hello'\n")
    if (flags === undefined) vi.stubEnv('VITE_FLAGS', '')
    else vi.stubEnv('VITE_FLAGS', flags)
    await build({
      root,
      mode,
      configFile: false,
      envFile: false,
      logLevel: 'silent',
      plugins: [prepaintPlugin(featuresFile)],
      build: { outDir: join(root, 'dist'), emptyOutDir: true },
    })
    return readFileSync(join(root, 'dist', 'index.html'), 'utf8')
  }

  it('is one of the site\'s own plugins', () => {
    const plugins = (viteConfig as { plugins: Array<{ name?: string } | Array<{ name?: string }>> }).plugins.flat()
    expect(plugins.map((p) => p?.name)).toContain('lca-prepaint')
  })

  it('injects nothing when newLook is off: production, and the a11y build without the switch', async () => {
    for (const [mode, flags] of [['production', 'newLook'], ['a11y', ''], ['a11y', 'themeHeritage']] as const) {
      const html = await buildPage(mode, flags)
      expect(html, `${mode} ${flags}`).not.toContain(APPEARANCE_KEY)
      expect(html).not.toContain('data-look')
      // The only script is the site's own module.
      expect(html.match(/<script\b/g)).toHaveLength(1)
      expect(html).toMatch(/<script type="module" crossorigin src="\/assets\/index-[\w-]+\.js"><\/script>/)
    }
  }, 60_000)

  it('puts the script first in the head when newLook is on, with the charset still in the first 1024 bytes', async () => {
    const html = await buildPage('a11y', 'newLook')
    const head = html.slice(html.indexOf('<head>') + '<head>'.length).trimStart()
    expect(head.startsWith(`<script>${PREPAINT_SCRIPT}</script>`)).toBe(true)
    expect(html.indexOf('<meta charset="UTF-8" />')).toBeLessThan(1024)
    expect(html.indexOf(PREPAINT_SCRIPT)).toBeLessThan(html.indexOf('type="module"'))
  }, 60_000)

  it('puts it in every build once the switch is written as true', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lca-features-'))
    dirs.push(dir)
    mkdirSync(join(dir, 'lib'))
    const file = join(dir, 'lib', 'features.ts')
    writeFileSync(file, FEATURES_SOURCE.replace(/^(\s*newLook:\s*)false,/m, '$1true,'))
    const html = await buildPage('production', undefined, file)
    expect(html).toContain(`<script>${PREPAINT_SCRIPT}</script>`)
  }, 60_000)
})

/** A storage stand-in, optionally one that throws on every call. */
function memoryStorage(initial: Record<string, string> = {}, throws = false): StorageLike & { data: Record<string, string> } {
  const data = { ...initial }
  const guard = () => {
    if (throws) throw new Error('storage blocked')
  }
  return {
    data,
    getItem: (k) => (guard(), k in data ? data[k] : null),
    setItem: (k, v) => {
      guard()
      data[k] = v
    },
    removeItem: (k) => {
      guard()
      delete data[k]
    },
  }
}

/** A prefers-color-scheme stand-in whose answer can be changed. */
function deviceSetting(dark: boolean) {
  const listeners = new Set<() => void>()
  const mql: MediaQueryLike & { set(dark: boolean): void; count(): number } = {
    get matches() {
      return dark
    },
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
    set(next) {
      dark = next
      for (const l of listeners) l()
    },
    count: () => listeners.size,
  }
  return mql
}

/** An <html> stand-in: its attributes and classes. */
function fakeRoot(): RootLike & { attrs: Record<string, string>; classes: Set<string>; setAttribute(n: string, v: string): void } {
  const classes = new Set<string>()
  const attrs: Record<string, string> = {}
  return {
    attrs,
    classes,
    setAttribute: (n, v) => void (attrs[n] = v),
    classList: {
      toggle: (token, force) => {
        const on = force ?? !classes.has(token)
        if (on) classes.add(token)
        else classes.delete(token)
        return on
      },
      contains: (token) => classes.has(token),
    },
  }
}

describe('PREPAINT_SCRIPT', () => {
  /**
   * Runs the script as the browser would, in a fresh context with only a
   * document and a window: `storage` is what window.localStorage gives (or
   * throws), `device` is the prefers-color-scheme answer, or null for a
   * browser without matchMedia.
   */
  function run(storage: () => StorageLike, device: boolean | null) {
    const root = fakeRoot()
    const window: Record<string, unknown> = {}
    Object.defineProperty(window, 'localStorage', { get: storage })
    if (device !== null) window.matchMedia = (q: string) => ({ matches: q === SYSTEM_DARK_QUERY && device })
    runInNewContext(PREPAINT_SCRIPT, { document: { documentElement: root }, window })
    return root
  }

  it('is plain ES5 with no template, arrow function, let or const', () => {
    expect(PREPAINT_SCRIPT).not.toMatch(/=>|`|\blet\b|\bconst\b/)
    expect(PREPAINT_SCRIPT).toContain(`'${APPEARANCE_KEY}'`)
  })

  it.each([null, 'light', 'dark', 'system', 'Dark', 'nonsense'])('with %j stored, matches isDarkScheme on both device settings', (stored) => {
    for (const device of [false, true]) {
      const storage = memoryStorage(stored === null ? {} : { [APPEARANCE_KEY]: stored })
      const root = run(() => storage, device)
      expect(root.attrs['data-look']).toBe('new')
      expect(root.classes.has('dark'), `${stored} on a ${device ? 'dark' : 'light'} device`).toBe(isDarkScheme(parseAppearance(stored), device))
    }
  })

  it('follows the device when storage throws, on reading it or on reaching it', () => {
    const blocked = memoryStorage({ [APPEARANCE_KEY]: 'light' }, true)
    expect(run(() => blocked, true).classes.has('dark')).toBe(true)
    expect(run(() => blocked, false).classes.has('dark')).toBe(false)
    const unreachable = () => {
      throw new Error('SecurityError')
    }
    expect(run(unreachable, true).classes.has('dark')).toBe(true)
    expect(run(unreachable, false).classes.has('dark')).toBe(false)
  })

  it('stays light where the browser has no matchMedia, unless Dark was picked', () => {
    expect(run(() => memoryStorage(), null).classes.has('dark')).toBe(false)
    expect(run(() => memoryStorage({ [APPEARANCE_KEY]: 'dark' }), null).classes.has('dark')).toBe(true)
  })
})

describe('createColorScheme', () => {
  const root = fakeRoot

  it('follows the device by default and as it changes, and stops when asked', () => {
    const el = root()
    const device = deviceSetting(false)
    const scheme = createColorScheme({ enabled: true, root: el, getStorage: () => memoryStorage(), systemQuery: () => device })
    expect(scheme.appearance()).toBe('system')
    const stop = scheme.start()
    expect(el.classList.contains('dark')).toBe(false)
    const seen = vi.fn()
    scheme.subscribe(seen)
    device.set(true)
    expect(el.classList.contains('dark')).toBe(true)
    expect(seen).toHaveBeenCalledTimes(1)
    stop()
    expect(device.count()).toBe(0)
  })

  it('can be set to Light or Dark, keeps the choice, and System removes it', () => {
    const el = root()
    const storage = memoryStorage()
    const device = deviceSetting(true)
    const scheme = createColorScheme({ enabled: true, root: el, getStorage: () => storage, systemQuery: () => device })
    scheme.start()
    expect(el.classList.contains('dark')).toBe(true)
    scheme.setAppearance('light')
    expect(el.classList.contains('dark')).toBe(false)
    expect(storage.data[APPEARANCE_KEY]).toBe('light')
    device.set(false)
    device.set(true)
    expect(el.classList.contains('dark')).toBe(false)
    scheme.setAppearance('dark')
    expect(storage.data[APPEARANCE_KEY]).toBe('dark')
    device.set(false)
    expect(el.classList.contains('dark')).toBe(true)
    scheme.setAppearance('system')
    expect(APPEARANCE_KEY in storage.data).toBe(false)
    expect(el.classList.contains('dark')).toBe(false)
    // A new page in the same browser picks the stored choice up.
    storage.data[APPEARANCE_KEY] = 'dark'
    const next = createColorScheme({ enabled: true, root: root(), getStorage: () => storage, systemQuery: () => device })
    expect(next.appearance()).toBe('dark')
  })

  it('stays on the device setting when storage throws, and still applies a choice for the visit', () => {
    const el = root()
    const device = deviceSetting(true)
    const blocked = memoryStorage({ [APPEARANCE_KEY]: 'light' }, true)
    const scheme = createColorScheme({ enabled: true, root: el, getStorage: () => blocked, systemQuery: () => device })
    expect(scheme.appearance()).toBe('system')
    scheme.start()
    expect(el.classList.contains('dark')).toBe(true)
    expect(() => scheme.setAppearance('light')).not.toThrow()
    expect(el.classList.contains('dark')).toBe(false)
    // The getter itself may throw, as window.localStorage does when site data is blocked.
    const throwing = createColorScheme({
      enabled: true,
      root: root(),
      getStorage: () => {
        throw new Error('SecurityError')
      },
      systemQuery: () => device,
    })
    expect(throwing.appearance()).toBe('system')
    expect(() => throwing.setAppearance('dark')).not.toThrow()
  })

  it('never adds .dark while newLook is off, whatever is stored or set', () => {
    const el = root()
    const device = deviceSetting(true)
    const scheme = createColorScheme({ enabled: false, root: el, getStorage: () => memoryStorage({ [APPEARANCE_KEY]: 'dark' }), systemQuery: () => device })
    const stop = scheme.start()
    expect(el.classList.contains('dark')).toBe(false)
    expect(device.count()).toBe(0)
    scheme.setAppearance('dark')
    scheme.apply()
    expect(el.classList.contains('dark')).toBe(false)
    expect(scheme.dark()).toBe(false)
    stop()
  })

  it('treats a missing or broken device query as light', () => {
    const el = root()
    const scheme = createColorScheme({
      enabled: true,
      root: el,
      getStorage: () => memoryStorage(),
      systemQuery: () => {
        throw new Error('no matchMedia')
      },
    })
    expect(() => scheme.start()).not.toThrow()
    expect(el.classList.contains('dark')).toBe(false)
  })
})
