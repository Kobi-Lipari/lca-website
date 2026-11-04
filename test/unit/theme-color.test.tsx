// @vitest-environment jsdom
//
// The browser bar's colour (theme-color) under the new look (WS02 step 3,
// the brief's AC20). index.html gives the page two theme-color metas, one for
// a light device and one for a dark one. Once a visitor picks Light or Dark
// in the Appearance control, the page's colour is that look's, whatever the
// device says; with System the two metas follow the device, as before.
//
// What is held here is the page's colour as a browser works it out, by the
// HTML standard's rule: the first theme-color meta in the order of the page
// whose media matches the device, or that has none. The head is built in
// the order the browser builds it: PREPAINT_SCRIPT runs when the head holds
// nothing but the script itself, and the rest of index.html's head (its two
// metas among it) is added after it. Then createColorScheme, as the page
// runs it, changes the choice.
//
// - index.html's two metas hold the module's two colours, so the three
//   places cannot drift apart
// - from the first paint and after a change, for System, Light and Dark on a
//   light and on a dark device: Light's #1a2744 or Dark's #0b1220 for a
//   pick, the device's own meta for System; the meta the choice owns is
//   first in the head, never doubled, and gone for System
// - storage that throws, or a getter that throws, leaves System and adds
//   nothing; with newLook off nothing is added or removed; a head that
//   cannot be reached still leaves the dark class right
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  APPEARANCE_KEY,
  APPEARANCES,
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

const ROOT = resolve(__dirname, '../..')
const INDEX_HTML = readFileSync(join(ROOT, 'index.html'), 'utf8')

const LIGHT_QUERY = '(prefers-color-scheme: light)'
const DEVICES = [
  ['a light device', false],
  ['a dark device', true],
] as const

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

/** Storage holding a choice, or nothing for System. */
const holding = (appearance: Appearance) => memoryStorage(appearance === 'system' ? {} : { [APPEARANCE_KEY]: appearance })

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

/** Whether a media query matches a light or a dark device: the two index.html uses, and nothing else. */
function matches(media: string, dark: boolean): boolean {
  if (media === SYSTEM_DARK_QUERY) return dark
  if (media === LIGHT_QUERY) return !dark
  throw new Error(`a media query this test cannot read: ${media}`)
}

/**
 * The page's theme colour as a browser works it out: the first meta named
 * theme-color, in the order of the page, that has a content and whose media
 * matches the device or that has none.
 */
function pageColour(doc: Document, dark: boolean): string | null {
  for (const meta of doc.querySelectorAll('meta')) {
    if (meta.getAttribute('name')?.toLowerCase() !== 'theme-color') continue
    const content = meta.getAttribute('content')?.trim()
    if (!content) continue
    const media = meta.getAttribute('media')?.trim()
    if (media && !matches(media, dark)) continue
    return content
  }
  return null
}

/** index.html's head as the parser reads it, node by node. */
const indexHead = () => [...new DOMParser().parseFromString(INDEX_HTML, 'text/html').head.childNodes]

/** A page whose head holds nothing but the script, as when the browser runs it. */
function pageAtTheScript(): Document {
  const doc = document.implementation.createHTMLDocument('')
  doc.head.replaceChildren(doc.createElement('script'))
  return doc
}

/** The rest of index.html's head, added after the script as the parser reaches it. */
function parseTheRest(doc: Document): Document {
  for (const node of indexHead()) doc.head.append(doc.importNode(node, true))
  return doc
}

/** A page with index.html's head and no script: the build with newLook off. */
const pageWithoutTheScript = () => parseTheRest(document.implementation.createHTMLDocument(''))

/** Runs the script as the browser would, with only a document and a window. */
function runScript(page: object, storage: () => StorageLike, dark: boolean) {
  const window: Record<string, unknown> = {}
  Object.defineProperty(window, 'localStorage', { get: storage })
  window.matchMedia = (q: string) => ({ matches: q === SYSTEM_DARK_QUERY && dark })
  runInNewContext(PREPAINT_SCRIPT, { document: page, window })
}

/** A first visit: the script with this storage, then the rest of the head. */
function firstPaint(storage: () => StorageLike, dark: boolean): Document {
  const doc = pageAtTheScript()
  runScript(doc, storage, dark)
  return parseTheRest(doc)
}

/** The metas the choice owns. */
const owned = (doc: Document) => [...doc.head.querySelectorAll(`meta[name="theme-color"][${THEME_COLOR_ATTRIBUTE}]`)]
/** index.html's own theme-color metas, as markup. */
const indexMetas = (doc: Document) => [...doc.head.querySelectorAll(`meta[name="theme-color"]:not([${THEME_COLOR_ATTRIBUTE}])`)].map((m) => m.outerHTML)
/** What a pick asks for on this device: the pick's colour, or the device's own for System. */
const expected = (appearance: Appearance, dark: boolean) => themeColorFor(appearance) ?? (dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT)

describe('index.html and the module agree on the two colours', () => {
  it('holds two theme-color metas, Light\'s for a light device and Dark\'s for a dark one, and no other', () => {
    const metas = [...new DOMParser().parseFromString(INDEX_HTML, 'text/html').querySelectorAll('meta[name="theme-color"]')]
    expect(metas.map((m) => [m.getAttribute('media'), m.getAttribute('content')])).toEqual([
      [LIGHT_QUERY, THEME_COLOR_LIGHT],
      [SYSTEM_DARK_QUERY, THEME_COLOR_DARK],
    ])
    expect(metas.some((m) => m.hasAttribute(THEME_COLOR_ATTRIBUTE))).toBe(false)
    expect([THEME_COLOR_LIGHT, THEME_COLOR_DARK]).toEqual(['#1a2744', '#0b1220'])
  })

  it('a pick of Light or Dark asks for that look\'s colour, and System for none', () => {
    expect(APPEARANCES.map(themeColorFor)).toEqual([null, THEME_COLOR_LIGHT, THEME_COLOR_DARK])
  })

  it('reads the page\'s colour by the browser\'s rule: the first matching meta wins', () => {
    const doc = pageWithoutTheScript()
    expect(pageColour(doc, false)).toBe(THEME_COLOR_LIGHT)
    expect(pageColour(doc, true)).toBe(THEME_COLOR_DARK)
    const first = doc.createElement('meta')
    first.setAttribute('name', 'theme-color')
    first.setAttribute('content', '#123456')
    doc.head.prepend(first)
    expect(pageColour(doc, false)).toBe('#123456')
    expect(pageColour(doc, true)).toBe('#123456')
    // Put last, a meta with no media loses to the matching one before it.
    doc.head.append(first)
    expect(pageColour(doc, true)).toBe(THEME_COLOR_DARK)
  })
})

describe('from the first paint: PREPAINT_SCRIPT', () => {
  for (const appearance of APPEARANCES) {
    for (const [device, dark] of DEVICES) {
      it(`${appearance} on ${device}: the page's colour is ${appearance === 'system' ? 'the device\'s own meta' : `${appearance}'s`}, and the dark class is right`, () => {
        const doc = firstPaint(() => holding(appearance), dark)
        expect(pageColour(doc, dark)).toBe(expected(appearance, dark))
        expect(doc.documentElement.classList.contains('dark')).toBe(isDarkScheme(appearance, dark))
        expect(doc.documentElement.getAttribute('data-look')).toBe('new')
        const own = owned(doc)
        if (appearance === 'system') {
          expect(own).toEqual([])
        } else {
          expect(own).toHaveLength(1)
          // First in the head, before the script and every meta index.html gives.
          expect(doc.head.firstElementChild).toBe(own[0])
          expect(own[0].getAttribute('content')).toBe(themeColorFor(appearance))
          expect(own[0].getAttribute(THEME_COLOR_ATTRIBUTE)).toBe(appearance)
          expect(own[0].hasAttribute('media')).toBe(false)
        }
        // index.html's own two are as they were.
        expect(indexMetas(doc)).toEqual(indexMetas(pageWithoutTheScript()))
      })
    }
  }

  it.each(['System', 'nonsense', 'dark ', 'DARK', 'Light'])('treats a stored %j as System and adds nothing', (value) => {
    for (const [, dark] of DEVICES) {
      const doc = firstPaint(() => memoryStorage({ [APPEARANCE_KEY]: value }), dark)
      expect(owned(doc)).toEqual([])
      expect(pageColour(doc, dark)).toBe(dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT)
    }
  })

  it('storage that throws, or a getter that throws, leaves System and adds nothing', () => {
    const blocked = memoryStorage({ [APPEARANCE_KEY]: 'dark' }, true)
    const unreachable = () => {
      throw new Error('SecurityError')
    }
    for (const storage of [() => blocked, unreachable]) {
      for (const [, dark] of DEVICES) {
        const doc = firstPaint(storage, dark)
        expect(owned(doc)).toEqual([])
        expect(pageColour(doc, dark)).toBe(dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT)
        expect(doc.documentElement.classList.contains('dark')).toBe(dark)
      }
    }
  })

  it('a head it cannot reach leaves data-look and the dark class right, and throws nothing', () => {
    for (const appearance of APPEARANCES) {
      for (const [, dark] of DEVICES) {
        // A document with no head at all, and one whose head is missing.
        for (const make of [(root: HTMLElement) => ({ documentElement: root }), (root: HTMLElement) => ({ documentElement: root, head: null, createElement: () => ({ setAttribute() {} }) })]) {
          const root = document.implementation.createHTMLDocument('').documentElement
          expect(() => runScript(make(root), () => holding(appearance), dark)).not.toThrow()
          expect(root.getAttribute('data-look')).toBe('new')
          expect(root.classList.contains('dark'), `${appearance}, dark device ${dark}`).toBe(isDarkScheme(appearance, dark))
        }
      }
    }
  })
})

describe('after a change: createColorScheme with the page\'s head', () => {
  /** A page as a visitor gets it: the script with this choice stored, then the app's own scheme started. */
  function visit(appearance: Appearance, dark: boolean, getStorage?: () => StorageLike) {
    const storage = holding(appearance)
    const read = getStorage ?? (() => storage)
    const doc = firstPaint(read, dark)
    const device = deviceSetting(dark)
    const scheme = createColorScheme({ enabled: true, root: doc.documentElement, getStorage: read, systemQuery: () => device, head: () => doc.head })
    const stop = scheme.start()
    return { doc, scheme, device, storage, stop }
  }

  for (const [device, dark] of DEVICES) {
    it(`on ${device}, every change of choice gives the page the right colour, with one owned meta at most, first in the head`, () => {
      for (const start of APPEARANCES) {
        const { doc, scheme } = visit(start, dark)
        // Starting the scheme keeps the script's meta rather than adding a second.
        expect(owned(doc)).toHaveLength(start === 'system' ? 0 : 1)
        expect(pageColour(doc, dark)).toBe(expected(start, dark))
        for (const next of ['light', 'dark', 'system', 'dark', 'dark', 'light', 'system', 'system', 'light'] as const) {
          scheme.setAppearance(next)
          expect(pageColour(doc, dark), `${start} then ${next}`).toBe(expected(next, dark))
          const own = owned(doc)
          expect(own, `${start} then ${next}`).toHaveLength(next === 'system' ? 0 : 1)
          if (own.length) expect(doc.head.firstElementChild).toBe(own[0])
          expect(doc.documentElement.classList.contains('dark')).toBe(isDarkScheme(next, dark))
          expect(indexMetas(doc)).toEqual(indexMetas(pageWithoutTheScript()))
        }
      }
    })
  }

  it('a device that changes leaves a picked colour alone, and moves the colour on System as the two metas do', () => {
    const { doc, scheme, device } = visit('dark', false)
    device.set(true)
    device.set(false)
    expect(pageColour(doc, false)).toBe(THEME_COLOR_DARK)
    scheme.setAppearance('system')
    expect(pageColour(doc, false)).toBe(THEME_COLOR_LIGHT)
    device.set(true)
    expect(owned(doc)).toEqual([])
    expect(pageColour(doc, true)).toBe(THEME_COLOR_DARK)
  })

  it('never leaves two owned metas, whatever was in the head before', () => {
    const doc = pageWithoutTheScript()
    for (const colour of ['#111111', '#222222']) {
      const extra = doc.createElement('meta')
      extra.setAttribute('name', 'theme-color')
      extra.setAttribute('content', colour)
      extra.setAttribute(THEME_COLOR_ATTRIBUTE, 'dark')
      doc.head.append(extra)
    }
    applyThemeColor(doc.head, 'light')
    expect(owned(doc).map((m) => m.getAttribute('content'))).toEqual([THEME_COLOR_LIGHT])
    // The one it keeps is moved first in the head, so it wins on either device.
    expect(doc.head.firstElementChild).toBe(owned(doc)[0])
    expect([pageColour(doc, false), pageColour(doc, true)]).toEqual([THEME_COLOR_LIGHT, THEME_COLOR_LIGHT])
    applyThemeColor(doc.head, 'system')
    expect(owned(doc)).toEqual([])
    expect(indexMetas(doc)).toEqual(indexMetas(pageWithoutTheScript()))
  })

  it('storage that throws, or a getter that throws, leaves System and adds nothing, and a pick still applies for the visit', () => {
    const blocked = memoryStorage({ [APPEARANCE_KEY]: 'dark' }, true)
    const unreachable = () => {
      throw new Error('SecurityError')
    }
    for (const getStorage of [() => blocked, unreachable]) {
      for (const [, dark] of DEVICES) {
        const { doc, scheme } = visit('system', dark, getStorage)
        expect(scheme.appearance()).toBe('system')
        expect(owned(doc)).toEqual([])
        expect(pageColour(doc, dark)).toBe(dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT)
        expect(() => scheme.setAppearance('light')).not.toThrow()
        expect(pageColour(doc, dark)).toBe(THEME_COLOR_LIGHT)
      }
    }
  })

  it('with newLook off it adds nothing and removes nothing, whatever is stored or picked', () => {
    for (const [, dark] of DEVICES) {
      // The build without newLook has no script, so the head is index.html's.
      const doc = pageWithoutTheScript()
      const before = doc.head.innerHTML
      const scheme = createColorScheme({ enabled: false, root: doc.documentElement, getStorage: () => holding('dark'), systemQuery: () => deviceSetting(dark), head: () => doc.head })
      scheme.start()
      for (const next of ['dark', 'light', 'system'] as const) {
        scheme.setAppearance(next)
        scheme.apply()
        expect(doc.head.innerHTML).toBe(before)
      }
      // And a meta it finds there, however it came, is left as it is.
      const found = doc.createElement('meta')
      found.setAttribute('name', 'theme-color')
      found.setAttribute('content', THEME_COLOR_DARK)
      found.setAttribute(THEME_COLOR_ATTRIBUTE, 'dark')
      doc.head.prepend(found)
      const withIt = doc.head.innerHTML
      scheme.setAppearance('system')
      scheme.apply()
      expect(doc.head.innerHTML).toBe(withIt)
      expect(doc.documentElement.classList.contains('dark')).toBe(false)
    }
  })

  it('with no head given, a head that gives nothing or one that throws, the dark class still follows the choice', () => {
    const heads = [undefined, () => null, () => undefined, () => {
      throw new Error('no head')
    }]
    for (const head of heads) {
      for (const [, dark] of DEVICES) {
        const root = document.implementation.createHTMLDocument('').documentElement
        const scheme = createColorScheme({ enabled: true, root, getStorage: () => memoryStorage(), systemQuery: () => deviceSetting(dark), head })
        expect(() => scheme.start()).not.toThrow()
        expect(root.classList.contains('dark')).toBe(dark)
        for (const next of ['dark', 'light', 'system'] as const) {
          expect(() => scheme.setAppearance(next)).not.toThrow()
          expect(root.classList.contains('dark')).toBe(isDarkScheme(next, dark))
        }
      }
    }
  })
})
