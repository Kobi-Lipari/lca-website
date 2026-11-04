// @vitest-environment jsdom
//
// The browser bar's colour after an Appearance pick (WS02 step 3, the
// brief's AC20), at its edges. test/unit/theme-color.test.tsx holds the
// page's colour for every pick on a light and a dark device; this file holds
// what happens around it:
//
// - the meta the head script adds and the meta src/lib/colorScheme.ts adds
//   for the same pick are the same markup, so each keeps the other's, and a
//   replay (the app starting after the script, a pick made again, the device
//   changing) leaves the head as it was, down to the very element
// - a choice that changed between the script and the app (another tab, or
//   site data cleared) is the one the app follows, with the meta, its look
//   and the dark class agreeing
// - storage that will not keep a pick, or will not forget one, gives the
//   pick for the visit, and the next first paint shows what storage holds
// - a device query that throws never costs a stored pick its colour
// - a value that is not a pick acts as System
// - the meta the choice owns always says the look its colour is, stays the
//   first node of the head even when the head opens with text or a comment,
//   and leaves alone a theme-color meta something else put there
// - the page's own scheme (src/hooks/useColorScheme.ts), started as
//   src/main.tsx starts it after the script, keeps the script's meta
import { runInNewContext } from 'node:vm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APPEARANCE_KEY,
  PREPAINT_SCRIPT,
  SYSTEM_DARK_QUERY,
  THEME_COLOR_ATTRIBUTE,
  THEME_COLOR_DARK,
  THEME_COLOR_LIGHT,
  applyThemeColor,
  createColorScheme,
  isDarkScheme,
  themeColorFor,
  type Appearance,
  type MediaQueryLike,
  type StorageLike,
} from '@/lib/colorScheme'

vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return { ...real, FEATURES: { ...real.FEATURES, newLook: true } }
})

const LIGHT_QUERY = '(prefers-color-scheme: light)'
const PICKS = ['light', 'dark'] as const
const DEVICES = [false, true] as const

/** index.html's two theme-color metas, as the page holds them. */
const INDEX_METAS =
  `<meta name="theme-color" content="${THEME_COLOR_LIGHT}" media="${LIGHT_QUERY}">` +
  `<meta name="theme-color" content="${THEME_COLOR_DARK}" media="${SYSTEM_DARK_QUERY}">`

/** A storage stand-in; each of its three calls can be made to throw on its own. */
function storage(initial: Record<string, string> = {}, refuse: Partial<Record<'get' | 'set' | 'remove', boolean>> = {}) {
  const data: Record<string, string> = { ...initial }
  const guard = (call: 'get' | 'set' | 'remove') => {
    if (refuse[call]) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
  }
  const store: StorageLike & { data: Record<string, string> } = {
    data,
    getItem: (k) => (guard('get'), k in data ? data[k] : null),
    setItem: (k, v) => {
      guard('set')
      data[k] = v
    },
    removeItem: (k) => {
      guard('remove')
      delete data[k]
    },
  }
  return store
}
const holding = (appearance: Appearance, refuse: Partial<Record<'get' | 'set' | 'remove', boolean>> = {}) =>
  storage(appearance === 'system' ? {} : { [APPEARANCE_KEY]: appearance }, refuse)

/** A prefers-color-scheme stand-in whose answer can be changed. */
function deviceSetting(dark: boolean): MediaQueryLike & { set(dark: boolean): void } {
  const listeners = new Set<() => void>()
  return {
    get matches() {
      return dark
    },
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
    set(next) {
      dark = next
      for (const l of listeners) l()
    },
  }
}

/** The page's colour by the browser's rule: the first theme-color meta with a content whose media matches, or that has none. */
function pageColour(doc: Document, dark: boolean): string | null {
  for (const meta of doc.querySelectorAll('meta')) {
    if (meta.getAttribute('name')?.toLowerCase() !== 'theme-color') continue
    const content = meta.getAttribute('content')?.trim()
    if (!content) continue
    const media = meta.getAttribute('media')?.trim()
    if (media === SYSTEM_DARK_QUERY && !dark) continue
    if (media === LIGHT_QUERY && dark) continue
    if (media && media !== SYSTEM_DARK_QUERY && media !== LIGHT_QUERY) throw new Error(`a media query this test cannot read: ${media}`)
    return content
  }
  return null
}
const deviceColour = (dark: boolean) => (dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT)

/** Runs the head script as the browser would, with a document and a window of its own. */
function runScript(doc: object, read: () => StorageLike, dark: boolean, matchMedia?: (q: string) => { matches: boolean }) {
  const window: Record<string, unknown> = {}
  Object.defineProperty(window, 'localStorage', { get: read })
  window.matchMedia = matchMedia ?? ((q: string) => ({ matches: q === SYSTEM_DARK_QUERY && dark }))
  runInNewContext(PREPAINT_SCRIPT, { document: doc, window })
}

/** A first visit: the head holds only the script when it runs, then the parser adds index.html's two metas after it. */
function firstPaint(read: () => StorageLike, dark: boolean): Document {
  const doc = document.implementation.createHTMLDocument('')
  doc.head.replaceChildren(doc.createElement('script'))
  runScript(doc, read, dark)
  doc.head.insertAdjacentHTML('beforeend', INDEX_METAS)
  return doc
}

const owned = (doc: Document) => [...doc.head.querySelectorAll(`meta[name="theme-color"][${THEME_COLOR_ATTRIBUTE}]`)]
const metaMarkup = (doc: Document) => [...doc.head.querySelectorAll('meta')].map((m) => m.outerHTML)

/** The app's scheme on a page, as src/hooks/useColorScheme.ts builds it, started as src/main.tsx starts it. */
function startApp(doc: Document, read: () => StorageLike, device: MediaQueryLike) {
  const scheme = createColorScheme({ enabled: true, root: doc.documentElement, getStorage: read, systemQuery: () => device, head: () => doc.head })
  const stop = scheme.start()
  return { scheme, stop }
}

describe('the script\'s meta and the module\'s are one and the same', () => {
  it.each(PICKS)('for %s, both write the same markup, and each keeps the other\'s as it is', (pick) => {
    const fromScript = firstPaint(() => holding(pick), false)
    const fromModule = document.implementation.createHTMLDocument('')
    applyThemeColor(fromModule.head, pick)
    expect(owned(fromScript)).toHaveLength(1)
    expect(owned(fromModule)).toHaveLength(1)
    expect(owned(fromScript)[0].outerHTML).toBe(owned(fromModule)[0].outerHTML)
    expect(owned(fromScript)[0].outerHTML).toBe(`<meta name="theme-color" content="${themeColorFor(pick)}" ${THEME_COLOR_ATTRIBUTE}="${pick}">`)
    // The module, handed the script's head, changes nothing in it.
    const element = owned(fromScript)[0]
    const head = fromScript.head.innerHTML
    applyThemeColor(fromScript.head, pick)
    expect(fromScript.head.innerHTML).toBe(head)
    expect(owned(fromScript)[0]).toBe(element)
  })
})

describe('a replay changes nothing', () => {
  for (const pick of PICKS) {
    for (const dark of DEVICES) {
      it(`${pick} on a ${dark ? 'dark' : 'light'} device: the app starting, applying again, the same pick again and the device changing leave the head as the script left it`, () => {
        const store = holding(pick)
        const doc = firstPaint(() => store, dark)
        const element = owned(doc)[0]
        const head = doc.head.innerHTML
        const device = deviceSetting(dark)
        const { scheme } = startApp(doc, () => store, device)
        const same = (when: string) => {
          expect(doc.head.innerHTML, when).toBe(head)
          expect(owned(doc), when).toEqual([element])
          expect(doc.head.firstChild, when).toBe(element)
        }
        same('once started')
        for (let i = 0; i < 3; i++) scheme.apply()
        same('applied three times more')
        for (let i = 0; i < 3; i++) scheme.setAppearance(pick)
        same('the same pick three times more')
        device.set(!dark)
        device.set(dark)
        same('the device changed and changed back')
        expect(store.data).toEqual({ [APPEARANCE_KEY]: pick })
        expect(pageColour(doc, dark)).toBe(themeColorFor(pick))
      })
    }
  }
})

describe('a choice that changed between the script and the app', () => {
  it.each([
    ['Dark when the script ran, Light by the time the app starts (another tab)', 'dark', 'light'],
    ['Light when the script ran, Dark by the time the app starts', 'light', 'dark'],
    ['Dark when the script ran, then site data cleared', 'dark', 'system'],
    ['nothing when the script ran, Dark by the time the app starts', 'system', 'dark'],
  ] as const)('%s: the app follows what it reads, with one meta at most and the dark class agreeing', (_, atScript, atApp) => {
    for (const dark of DEVICES) {
      const store = holding(atScript)
      const doc = firstPaint(() => store, dark)
      expect(pageColour(doc, dark)).toBe(themeColorFor(atScript) ?? deviceColour(dark))
      if (atApp === 'system') delete store.data[APPEARANCE_KEY]
      else store.data[APPEARANCE_KEY] = atApp
      const { scheme } = startApp(doc, () => store, deviceSetting(dark))
      expect(scheme.appearance()).toBe(atApp)
      expect(owned(doc)).toHaveLength(atApp === 'system' ? 0 : 1)
      if (atApp !== 'system') {
        expect(owned(doc)[0].getAttribute(THEME_COLOR_ATTRIBUTE)).toBe(atApp)
        expect(doc.head.firstChild).toBe(owned(doc)[0])
      }
      expect(pageColour(doc, dark)).toBe(themeColorFor(atApp) ?? deviceColour(dark))
      expect(doc.documentElement.classList.contains('dark')).toBe(isDarkScheme(atApp, dark))
    }
  })
})

describe('storage that will not keep a pick, or will not forget one', () => {
  it('a pick storage refuses to keep holds for the visit, and the next first paint shows the device\'s own colour', () => {
    for (const dark of DEVICES) {
      const store = holding('system', { set: true })
      const doc = firstPaint(() => store, dark)
      const { scheme } = startApp(doc, () => store, deviceSetting(dark))
      for (const pick of PICKS) {
        expect(() => scheme.setAppearance(pick)).not.toThrow()
        expect(pageColour(doc, dark)).toBe(themeColorFor(pick))
      }
      expect(store.data).toEqual({})
      // The reload: nothing was kept, so the script adds nothing.
      const reload = firstPaint(() => store, dark)
      expect(owned(reload)).toEqual([])
      expect(pageColour(reload, dark)).toBe(deviceColour(dark))
    }
  })

  it('System picked when storage refuses to forget Dark follows the device for the visit, and the reload brings Dark back from the first paint', () => {
    for (const dark of DEVICES) {
      const store = holding('dark', { remove: true })
      const doc = firstPaint(() => store, dark)
      const { scheme } = startApp(doc, () => store, deviceSetting(dark))
      expect(() => scheme.setAppearance('system')).not.toThrow()
      expect(owned(doc)).toEqual([])
      expect(pageColour(doc, dark)).toBe(deviceColour(dark))
      expect(doc.documentElement.classList.contains('dark')).toBe(dark)
      // Storage still holds Dark, so the next visit opens on it, as the choice lasts only for the visit.
      const reload = firstPaint(() => store, dark)
      expect(pageColour(reload, dark)).toBe(THEME_COLOR_DARK)
      expect(reload.documentElement.classList.contains('dark')).toBe(true)
    }
  })
})

describe('the device query', () => {
  it.each(PICKS)('a matchMedia that throws does not cost a stored %s its colour or its class from the first paint', (pick) => {
    const doc = document.implementation.createHTMLDocument('')
    doc.head.replaceChildren(doc.createElement('script'))
    const throwing = () => {
      throw new Error('matchMedia is not available')
    }
    expect(() => runScript(doc, () => holding(pick), false, throwing)).not.toThrow()
    doc.head.insertAdjacentHTML('beforeend', INDEX_METAS)
    for (const dark of DEVICES) expect(pageColour(doc, dark)).toBe(themeColorFor(pick))
    expect(doc.documentElement.classList.contains('dark')).toBe(pick === 'dark')
    expect(doc.documentElement.getAttribute('data-look')).toBe('new')
  })

  it('a device query that throws in the app leaves a pick\'s colour in place and System on the light look\'s', () => {
    const store = holding('dark')
    const doc = firstPaint(() => store, false)
    const scheme = createColorScheme({
      enabled: true, root: doc.documentElement, getStorage: () => store, head: () => doc.head,
      systemQuery: () => {
        throw new Error('matchMedia is not available')
      },
    })
    expect(() => scheme.start()).not.toThrow()
    expect(pageColour(doc, false)).toBe(THEME_COLOR_DARK)
    scheme.setAppearance('system')
    expect(owned(doc)).toEqual([])
    expect(doc.documentElement.classList.contains('dark')).toBe(false)
  })
})

describe('a value that is not a pick', () => {
  it.each(['sepia', 'Dark', '', 'light '])('%j, set through the module, acts as System: no meta of its own and nothing kept', (value) => {
    for (const dark of DEVICES) {
      const store = holding('dark')
      const doc = firstPaint(() => store, dark)
      const { scheme } = startApp(doc, () => store, deviceSetting(dark))
      scheme.setAppearance(value as Appearance)
      expect(scheme.appearance()).toBe('system')
      expect(owned(doc)).toEqual([])
      expect(store.data).toEqual({})
      expect(pageColour(doc, dark)).toBe(deviceColour(dark))
    }
  })
})

describe('the meta the choice owns', () => {
  it('always says the look its colour is, and is always the head\'s first node, through every pick and every change of device', () => {
    const store = holding('system')
    const doc = firstPaint(() => store, false)
    const device = deviceSetting(false)
    const { scheme } = startApp(doc, () => store, device)
    const steps: Array<Appearance | 'device dark' | 'device light'> = ['dark', 'device dark', 'light', 'device light', 'light', 'system', 'device dark', 'dark', 'system', 'light', 'dark', 'device light']
    const colourOf: Record<string, string> = { light: THEME_COLOR_LIGHT, dark: THEME_COLOR_DARK }
    for (const step of steps) {
      if (step === 'device dark' || step === 'device light') device.set(step === 'device dark')
      else scheme.setAppearance(step)
      const own = owned(doc)
      expect(own.length, step).toBe(scheme.appearance() === 'system' ? 0 : 1)
      for (const meta of own) {
        expect(meta.getAttribute('content'), step).toBe(colourOf[meta.getAttribute(THEME_COLOR_ATTRIBUTE)!])
        expect(meta.hasAttribute('media'), step).toBe(false)
        expect(doc.head.firstChild, step).toBe(meta)
      }
      expect(pageColour(doc, device.matches), step).toBe(themeColorFor(scheme.appearance()) ?? deviceColour(device.matches))
      // index.html's own two are never touched.
      expect(metaMarkup(doc).filter((m) => !m.includes(THEME_COLOR_ATTRIBUTE)).join(''), step).toBe(INDEX_METAS)
    }
  })

  it('goes before text or a comment that opens the head, from the script and from the module', () => {
    for (const pick of PICKS) {
      // The script, with a line break and a comment before it in the head.
      const doc = document.implementation.createHTMLDocument('')
      doc.head.innerHTML = '\n    <!-- the site\'s head -->\n    <script></script>'
      runScript(doc, () => holding(pick), false)
      doc.head.insertAdjacentHTML('beforeend', INDEX_METAS)
      expect(doc.head.firstChild).toBe(owned(doc)[0])
      // The module, on a head that opens the same way and holds no meta of the choice's yet.
      const later = document.implementation.createHTMLDocument('')
      later.head.innerHTML = `\n    <!-- the site's head -->\n    ${INDEX_METAS}`
      applyThemeColor(later.head, pick)
      expect(later.head.firstChild).toBe(owned(later)[0])
      for (const dark of DEVICES) {
        expect(pageColour(doc, dark)).toBe(themeColorFor(pick))
        expect(pageColour(later, dark)).toBe(themeColorFor(pick))
      }
    }
  })

  it('leaves alone a theme-color meta something else put first in the head, and a pick still comes before it', () => {
    const doc = firstPaint(() => holding('system'), false)
    const other = doc.createElement('meta')
    other.setAttribute('name', 'theme-color')
    other.setAttribute('content', '#336699')
    doc.head.prepend(other)
    const before = other.outerHTML
    applyThemeColor(doc.head, 'dark')
    expect(doc.head.firstChild).toBe(owned(doc)[0])
    expect(pageColour(doc, false)).toBe(THEME_COLOR_DARK)
    applyThemeColor(doc.head, 'system')
    expect(owned(doc)).toEqual([])
    expect(doc.head.contains(other)).toBe(true)
    expect(other.outerHTML).toBe(before)
  })
})

describe('the page\'s own scheme, started as src/main.tsx starts it', () => {
  let stop = () => {}
  beforeEach(() => {
    document.head.replaceChildren()
    document.documentElement.className = ''
    window.localStorage.clear()
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  })
  afterEach(() => {
    stop()
    document.head.replaceChildren()
    document.documentElement.className = ''
    window.localStorage.clear()
  })

  it('keeps the meta the script put in the head for a stored Dark, as the one meta of the choice, first in the head', async () => {
    window.localStorage.setItem(APPEARANCE_KEY, 'dark')
    // The head as the browser has it when the script runs, then the script itself, then index.html's metas.
    document.head.append(document.createElement('script'))
    runInNewContext(PREPAINT_SCRIPT, { document, window })
    document.head.insertAdjacentHTML('beforeend', INDEX_METAS)
    const element = owned(document)[0]
    expect(element.getAttribute('content')).toBe(THEME_COLOR_DARK)
    const { startColorScheme } = await import('@/hooks/useColorScheme')
    stop = startColorScheme()
    expect(owned(document)).toEqual([element])
    expect(document.head.firstChild).toBe(element)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(pageColour(document, false)).toBe(THEME_COLOR_DARK)
  })
})
