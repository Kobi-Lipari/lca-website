// @vitest-environment jsdom
//
// The rook mark, the official logo and their places at their edges (WS01
// step 28). test/unit/lca-mark.test.tsx and brand-placements.test.tsx hold
// the main run; this file adds what they leave out.
//
// - The LCA status tag is drawn the same with newLook off and on: the status
//   path never reads the switch, so its rook is the one change of the step
//   that does not wait for it. The rook comes first and the words after,
//   however the words are given. Nothing else is added: take the rook out
//   and the tag is the tag drawn before the step, and every other status
//   draws its tag as before the step, mark for mark (the literals below were
//   rendered from src/components/StatusBadge.tsx as it was at df62ca3).
// - LcaMark and LcaLogo keep what their types promise when a caller forces
//   other props past the types: no fill, colour, style, role, label, id or
//   other path reaches the mark, and no class, style, other file, srcset or
//   loading rule reaches the logo, so neither can be recoloured or swapped.
//   Two named marks on one page carry no id, so their names cannot collide;
//   a title with spaces round it still names the mark, and a title of
//   markup characters stays words.
// - The header under the new look holds one rook and no image with the
//   phone menu open, signed out and signed in with the account links, and
//   its brand link is named once; with newLook off the open menu keeps
//   today's image.
// - In the tree: only the header and the LCA tag draw the rook, and only the
//   footer and /about the official logo (decision D1's other places are
//   recorded in REDESIGN_STATUS.md for the workstreams that build them); the
//   rook's path is written in LcaMark.tsx alone; the webp is imported by
//   LcaLogo and otherwise only where it was, and public/lca-logo.jpg is
//   named by nothing in src but the admin email preview the follow-up
//   names.
// - Every file the step touches lints clean with the site's own rules, and
//   none of the six files under src holds an eslint-disable.
// - REDESIGN_STATUS.md keeps its shape round the step: every row of the
//   acceptance table, the AC10 row's long proofs among them, has the
//   table's four cells, and the step's decisions, deviation, verify items
//   and follow-ups follow step 27's.
//
// The switch is flipped inside this one file, through a getter on the mocked
// FEATURES. Class names that would recolour the logo are put together when
// the test runs, so Tailwind, which reads this file, builds no CSS for them.
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ESLint } from 'eslint'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import lcaLogo from '@/assets/lca-logo.webp'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { LcaLogo, type LcaLogoProps } from '@/components/LcaLogo'
import { LcaMark, type LcaMarkProps } from '@/components/LcaMark'
import { BADGE_STATUSES, STATUS_LABELS, type BadgeStatus } from '@/lib/badgeStatus'

const flags = vi.hoisted(() => ({ newLook: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get newLook() {
        return flags.newLook
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { StatusBadge } = await import('@/components/StatusBadge')
const { Navbar } = await import('@/components/layout/Navbar')

afterEach(() => {
  cleanup()
  flags.newLook = false
})

const ROOT = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const NAME = 'Louisiana Chess Association'
/** The favicon's one path, as the file has it. */
const ROOK = read('public/favicon.svg').match(/<path[^>]* d="([^"]+)"/)![1]
/** A class, and a filter, that would turn the logo grey, put together here so Tailwind does not read them. */
const GREY = ['gray', 'scale'].join('')

/** What a node draws, as markup. */
function markupOf(node: ReactElement): string {
  const { container } = render(node)
  const html = container.innerHTML
  cleanup()
  return html
}

/** An element's attributes, by name, in no order. */
const attributesOf = (el: Element) => Object.fromEntries(el.getAttributeNames().map((n) => [n, el.getAttribute(n)]))

/** The one element a render draws. */
function drawn(node: ReactElement): Element {
  const { container } = render(node)
  expect(container.children).toHaveLength(1)
  return container.firstElementChild!
}

/**
 * Each status tag with its default words, as src/components/StatusBadge.tsx
 * drew it at df62ca3, before the step: rendered from that file and copied
 * here as it came out. The LCA tag had no mark.
 */
const TAGS_BEFORE: Record<BadgeStatus, string> = {
  open: '<span data-slot="status-badge" data-status="open" class="inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs leading-none font-medium whitespace-nowrap bg-status-open-tint text-status-open"><svg data-slot="status-mark" viewBox="0 0 8 8" aria-hidden="true" class="size-2 flex-none"><circle cx="4" cy="4" r="3.5" fill="currentColor"></circle></svg>Registration open</span>',
  soon: '<span data-slot="status-badge" data-status="soon" class="inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs leading-none font-medium whitespace-nowrap bg-status-soon-tint text-status-soon"><svg data-slot="status-mark" viewBox="0 0 8 8" aria-hidden="true" class="size-2 flex-none"><circle cx="4" cy="4" r="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 1.4"></circle></svg>Opens soon</span>',
  full: '<span data-slot="status-badge" data-status="full" class="inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs leading-none font-medium whitespace-nowrap bg-status-full-tint text-status-full"><svg data-slot="status-mark" viewBox="0 0 8 8" aria-hidden="true" class="size-2 flex-none"><circle cx="4" cy="4" r="3.2" fill="none" stroke="currentColor" stroke-width="1.4"></circle><path d="M4 .8a3.2 3.2 0 0 1 0 6.4z" fill="currentColor"></path></svg>Event full</span>',
  waitlist: '<span data-slot="status-badge" data-status="waitlist" class="inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs leading-none font-medium whitespace-nowrap bg-status-waitlist-tint text-status-waitlist"><svg data-slot="status-mark" viewBox="0 0 8 8" aria-hidden="true" class="size-2 flex-none"><circle cx="4" cy="4" r="3.2" fill="none" stroke="currentColor" stroke-width="1.4"></circle><path d="M4 .8a3.2 3.2 0 0 1 0 6.4z" fill="currentColor"></path></svg>Waitlist</span>',
  closed: '<span data-slot="status-badge" data-status="closed" class="inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs leading-none font-medium whitespace-nowrap bg-status-closed-tint text-status-closed inset-ring inset-ring-hairline"><svg data-slot="status-mark" viewBox="0 0 8 8" aria-hidden="true" class="size-2 flex-none"><rect x="1" y="3.2" width="6" height="1.6" fill="currentColor"></rect></svg>Registration closed</span>',
  live: '<span data-slot="status-badge" data-status="live" class="inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs leading-none font-medium whitespace-nowrap bg-status-live-tint text-status-live"><svg data-slot="status-mark" viewBox="0 0 8 8" aria-hidden="true" class="size-2 flex-none" style="animation: none;"><circle cx="4" cy="4" r="3" fill="currentColor"></circle></svg>Live</span>',
  partner: '<span data-slot="status-badge" data-status="partner" class="inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs leading-none font-medium whitespace-nowrap bg-status-partner-tint text-status-partner">Partner event<svg data-slot="status-mark" viewBox="0 0 24 24" aria-hidden="true" class="size-[11px] flex-none" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path></svg></span>',
  lca: '<span data-slot="status-badge" data-status="lca" class="inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs leading-none font-medium whitespace-nowrap bg-status-lca-tint text-status-lca">LCA event</span>',
}

describe('the LCA tag\'s rook, the one change that does not wait for the switch', () => {
  it('draws every status tag the same with newLook off and on: the status path never reads the switch', () => {
    for (const status of BADGE_STATUSES) {
      flags.newLook = false
      const off = markupOf(<StatusBadge status={status} on="light" />)
      flags.newLook = true
      const on = markupOf(<StatusBadge status={status} on="light" />)
      expect(on, status).toBe(off)
    }
    // And the LCA tag draws its rook either way.
    for (const newLook of [false, true]) {
      flags.newLook = newLook
      const tag = drawn(<StatusBadge status="lca" on="light" />)
      expect(tag.querySelector('[data-slot="status-mark"] path')?.getAttribute('d'), String(newLook)).toBe(ROOK)
      cleanup()
    }
  })

  it('every other status draws its tag as it did before the step, mark for mark', () => {
    for (const status of BADGE_STATUSES.filter((s) => s !== 'lca')) {
      expect(markupOf(<StatusBadge status={status} on="light" />), status).toBe(TAGS_BEFORE[status])
    }
  })

  it('adds the rook and nothing else to the LCA tag: take the rook out and the tag is the one drawn before the step', () => {
    const tag = drawn(<StatusBadge status="lca" on="light" />)
    const rook = tag.firstElementChild!
    expect(rook.getAttribute('data-slot')).toBe('status-mark')
    expect(tag.querySelectorAll('svg')).toHaveLength(1)
    rook.remove()
    expect(tag.outerHTML).toBe(TAGS_BEFORE.lca)
  })

  it.each<[string, ReactNode, string]>([
    ['its default words', undefined, STATUS_LABELS.lca],
    ['words of its own', 'LCA championship', 'LCA championship'],
    ['an element for words', <span key="w">LCA championship, Sat, Oct 24</span>, 'LCA championship, Sat, Oct 24'],
    ['an empty string', '', STATUS_LABELS.lca],
    ['spaces alone', '   ', STATUS_LABELS.lca],
    ['nothing (null)', null, STATUS_LABELS.lca],
    ['a condition that failed (false)', false, STATUS_LABELS.lca],
    ['an empty fragment', <></>, STATUS_LABELS.lca],
    ['a list of nothing', [null, false, ''], STATUS_LABELS.lca],
  ])('keeps the rook first and the words after it, with %s', (_, children, words) => {
    const tag = drawn(<StatusBadge status="lca" on="light">{children}</StatusBadge>)
    const marks = tag.querySelectorAll('[data-slot="status-mark"]')
    expect(marks).toHaveLength(1)
    const rook = marks[0]
    expect(tag.firstChild).toBe(rook)
    expect(rook.getAttribute('aria-hidden')).toBe('true')
    expect(rook.querySelector('title')).toBeNull()
    expect(rook.querySelector('path')?.getAttribute('d')).toBe(ROOK)
    // The words, and nothing the rook adds to them.
    expect(tag.textContent).toBe(words)
    expect(rook.textContent).toBe('')
    // No colour of its own: the tag's words colour fills it.
    expect(rook.getAttribute('fill')).toBe('currentColor')
    expect(rook.getAttribute('class')).toBe('flex-none size-[11px]')
  })

  it('keeps the rook when a caller adds a class to the tag', () => {
    const tag = drawn(<StatusBadge status="lca" on="light" className="ml-2" />)
    expect(tag.getAttribute('class')).toContain('ml-2')
    expect(tag.firstElementChild?.getAttribute('data-slot')).toBe('status-mark')
    expect(tag.firstElementChild?.querySelector('path')?.getAttribute('d')).toBe(ROOK)
  })
})

describe('LcaMark at its edges', () => {
  it('ignores what a caller forces past its type: no fill, colour, style, role, label, id, focus or other path reaches the mark', () => {
    const forced = {
      title: '',
      className: 'size-7',
      fill: '#c8a94a',
      color: '#c8a94a',
      style: { fill: '#c8a94a', color: '#c8a94a' },
      role: 'presentation',
      'aria-label': 'Home',
      'aria-hidden': false,
      id: 'rook',
      tabIndex: 0,
      d: 'M0 0H1V1Z',
      viewBox: '0 0 1 1',
    } as unknown as LcaMarkProps
    const svg = drawn(<LcaMark {...forced} />)
    expect(svg.getAttributeNames().sort()).toEqual(['aria-hidden', 'class', 'data-slot', 'fill', 'viewBox'])
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('fill')).toBe('currentColor')
    expect(svg.getAttribute('viewBox')).toBe('0 0 100 100')
    expect(svg.getAttribute('class')).toBe('flex-none size-7')
    const paths = svg.querySelectorAll('path')
    expect(paths).toHaveLength(1)
    expect(paths[0].getAttributeNames()).toEqual(['d'])
    expect(paths[0].getAttribute('d')).toBe(ROOK)
  })

  it('keeps its own role and name when a caller forces a role or a label past its type', () => {
    const forced = { role: 'presentation', 'aria-label': 'Home', 'aria-labelledby': 'elsewhere' } as unknown as LcaMarkProps
    const svg = drawn(<LcaMark {...forced} />)
    expect(svg.getAttributeNames().sort()).toEqual(['class', 'data-slot', 'fill', 'role', 'viewBox'])
    expect(svg.getAttribute('role')).toBe('img')
    expect(screen.getByRole('img', { name: NAME })).toBe(svg)
  })

  it('carries no id, so two named marks on one page each keep their own name', () => {
    const { container } = render(
      <div>
        <LcaMark />
        <LcaMark title="Louisiana Chess Association, home" />
      </div>,
    )
    expect(container.querySelectorAll('[id]')).toHaveLength(0)
    expect(container.querySelectorAll('[aria-labelledby], [aria-describedby]')).toHaveLength(0)
    const names = screen.getAllByRole('img').map((el) => el.querySelector('title')?.textContent)
    expect(names).toEqual([NAME, 'Louisiana Chess Association, home'])
    expect(screen.getByRole('img', { name: NAME })).toBe(container.querySelectorAll('svg')[0])
    expect(screen.getByRole('img', { name: 'Louisiana Chess Association, home' })).toBe(container.querySelectorAll('svg')[1])
  })

  it('is named by a title with spaces round it, and a title of markup characters stays words', () => {
    const spaced = drawn(<LcaMark title={`  ${NAME}  `} />)
    expect(spaced.getAttribute('role')).toBe('img')
    expect(screen.getByRole('img', { name: NAME })).toBe(spaced)
    cleanup()
    const words = '<b>LCA</b> & "Louisiana"'
    const marked = drawn(<LcaMark title={words} />)
    const title = marked.querySelector('title')!
    expect(title.children).toHaveLength(0)
    expect(title.textContent).toBe(words)
    expect(marked.querySelector('b')).toBeNull()
  })

  it('takes its default name when the title is left undefined, and is decoration for a title of tabs and line breaks', () => {
    expect(drawn(<LcaMark title={undefined} />).querySelector('title')?.textContent).toBe(NAME)
    cleanup()
    const blank = drawn(<LcaMark title={'\t\n '} />)
    expect(blank.getAttribute('aria-hidden')).toBe('true')
    expect(blank.hasAttribute('role')).toBe(false)
    expect(blank.querySelector('title')).toBeNull()
  })
})

describe('LcaLogo at its edges', () => {
  it('ignores what a caller forces past its type: the file, its shape, its size and its words are its own', () => {
    const forced = {
      width: 56,
      height: 56,
      alt: '',
      className: GREY,
      style: { filter: `${GREY}(1)`, opacity: 0.5, mixBlendMode: 'multiply' },
      src: '/lca-logo.jpg',
      srcSet: '/lca-logo.jpg 2x',
      sizes: '56px',
      loading: 'lazy',
      decoding: 'async',
      crossOrigin: 'anonymous',
      referrerPolicy: 'no-referrer',
      id: 'logo',
      title: 'Logo',
      role: 'presentation',
      color: '#1a2744',
    } as unknown as LcaLogoProps
    const img = drawn(<LcaLogo {...forced} />) as HTMLImageElement
    expect(img.tagName).toBe('IMG')
    expect(img.getAttributeNames().sort()).toEqual(['alt', 'class', 'data-slot', 'height', 'src', 'width'])
    expect(img.getAttribute('src')).toBe(lcaLogo)
    expect(img.getAttribute('class')).toBe('rounded-xl object-contain')
    expect([img.getAttribute('width'), img.getAttribute('height'), img.getAttribute('alt')]).toEqual(['56', '56', ''])
    expect(img.getAttribute('data-slot')).toBe('lca-logo')
  })

  it('is one img and nothing round it: no picture element, no second source and no srcset for a browser to choose', () => {
    const { container } = render(<LcaLogo width={160} height={160} />)
    expect(container.children).toHaveLength(1)
    expect(attributesOf(container.firstElementChild!)).toEqual({
      'data-slot': 'lca-logo', src: lcaLogo, width: '160', height: '160', alt: NAME, class: 'rounded-xl object-contain',
    })
    expect(container.firstElementChild!.childNodes).toHaveLength(0)
    expect(container.querySelector('picture, source, [srcset]')).toBeNull()
  })
})

/** A signed-in board member with the admin role, as the header sees one: every account link under More. */
const SIGNED_IN = {
  user: { id: 'fx-u-brand', email: 'fixture.admin@example.org' }, session: null, member: null, role: 'lca_admin',
  seats: [], managedClubs: [], isBoardMember: true, assuranceLevel: 'aal2', mfaRequired: false, loading: false,
  directedTournamentIds: [], signOut: async () => {},
} as unknown as AuthContextValue
/** A visitor who is not signed in. */
const SIGNED_OUT = { ...SIGNED_IN, user: null, role: 'member', isBoardMember: false, assuranceLevel: null } as unknown as AuthContextValue

/** The header with its phone menu opened. */
function headerWithMenuOpen(auth: AuthContextValue): HTMLElement {
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  const header = screen.getByRole('banner')
  fireEvent.click(within(header).getByRole('button', { name: 'Open menu' }))
  expect(within(header).getByRole('button', { name: 'Close menu' }).getAttribute('aria-expanded')).toBe('true')
  return header
}

describe('the header with the phone menu open', () => {
  it.each([
    ['signed out', SIGNED_OUT],
    ['signed in, with the account links', SIGNED_IN],
  ])('under the new look, %s: one rook in the brand link, no image anywhere in the header, the link named once', (who, auth) => {
    flags.newLook = true
    const header = headerWithMenuOpen(auth)
    expect(header.querySelectorAll('img')).toHaveLength(0)
    const marks = header.querySelectorAll('[data-slot="lca-mark"]')
    expect(marks).toHaveLength(1)
    const brand = marks[0].closest('a')!
    expect(brand.getAttribute('href')).toBe('/')
    expect(brand.firstElementChild).toBe(marks[0])
    expect(marks[0].getAttribute('aria-hidden')).toBe('true')
    expect(marks[0].querySelector('path')?.getAttribute('d')).toBe(ROOK)
    expect(within(header).getByRole('link', { name: NAME })).toBe(brand)
    expect(within(header).queryAllByRole('img')).toHaveLength(0)
    // The open menu draws neither the mark nor the logo again.
    const drawer = header.lastElementChild!
    expect(drawer.contains(marks[0])).toBe(false)
    expect(drawer.querySelector('svg[viewBox="0 0 100 100"], img')).toBeNull()
    if (who.startsWith('signed in')) {
      expect(within(drawer as HTMLElement).getByRole('link', { name: 'Admin panel' }).getAttribute('href')).toBe('/admin')
      expect(within(drawer as HTMLElement).getByRole('link', { name: 'Board inbox' }).getAttribute('href')).toBe('/board/inbox')
    }
  })

  it.each([
    ['signed out', SIGNED_OUT],
    ['signed in', SIGNED_IN],
  ])('with newLook off, %s: today\'s image in the brand link, and no mark', (_, auth) => {
    const header = headerWithMenuOpen(auth)
    expect(header.querySelector('[data-slot="lca-mark"], svg[viewBox="0 0 100 100"]')).toBeNull()
    const imgs = header.querySelectorAll('img')
    expect(imgs).toHaveLength(1)
    const img = imgs[0]
    expect(attributesOf(img)).toEqual({ src: lcaLogo, alt: NAME, class: 'h-11 w-11 rounded-lg object-contain' })
    expect(img.closest('a')?.getAttribute('href')).toBe('/')
    expect(img.parentElement!.firstElementChild).toBe(img)
  })
})

/** Every file under src, as a path from the root. */
function sourceFiles(dir = 'src'): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(tsx?|css|html)$/.test(entry.name) ? [path] : []
  })
}

describe('where the tree draws the rook and the official logo', () => {
  const files = sourceFiles()
  const importers = (module: string) =>
    files.filter((f) => new RegExp(`^import [^\\n]+ from '${module.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}'`, 'm').test(read(f))).sort()

  it('reads the whole of src', () => {
    expect(files.length).toBeGreaterThan(150)
    expect(files).toContain('src/components/LcaMark.tsx')
  })

  it('draws the rook in the header and the LCA tag only, and the official logo in the footer and on /about only', () => {
    // A new place is one of D1's places left for later: record it in REDESIGN_STATUS.md, then add it here.
    // The seal (step 31) draws the rook inside its own SVG, at the head of a heritage page.
    // WS02 step 5's new header leads with it too (SiteHeader.tsx, D1's place in the record), and WS02 step 6's
    // phone app bar (MobileAppBar.tsx, D1's place in the record as well); the tablet header is SiteHeader.tsx's narrower form.
    expect(importers('@/components/LcaMark')).toEqual([
      'src/components/Seal.tsx',
      'src/components/StatusBadge.tsx',
      'src/components/layout/MobileAppBar.tsx',
      'src/components/layout/Navbar.tsx',
      'src/components/layout/SiteHeader.tsx',
    ])
    expect(importers('@/components/LcaLogo')).toEqual(['src/components/layout/Footer.tsx', 'src/pages/AboutPage.tsx'])
    // D1's places that exist and are left for later draw neither yet.
    for (const page of ['ChampionsPage', 'BoardPage', 'BylawsPage', 'MinutesPage', 'AnnualMeetingPage', 'HomePage']) {
      const text = read(`src/pages/${page}.tsx`)
      expect(text, page).not.toMatch(/\bLca(?:Mark|Logo)\b|lca-logo/)
    }
  })

  it('writes the rook\'s path in LcaMark.tsx alone, so whatever else draws the rook draws LcaMark', () => {
    const start = ROOK.slice(0, 24)
    expect(files.filter((f) => read(f).includes(start))).toEqual(['src/components/LcaMark.tsx'])
  })

  it('imports the official file in LcaLogo, and otherwise only where the header and the footer drew it before the step', () => {
    const webp = importers('@/assets/lca-logo.webp')
    expect(webp).toContain('src/components/LcaLogo.tsx')
    for (const f of webp) expect(['src/components/LcaLogo.tsx', 'src/components/layout/Footer.tsx', 'src/components/layout/Navbar.tsx'], f).toContain(f)
    // The 2.4 MB source picture is named in src by the admin email preview at most (see Follow-ups).
    const jpg = files.filter((f) => /['"(]\/lca-logo\.jpg\b/.test(read(f)))
    for (const f of jpg) expect(f).toBe('src/pages/AdminEmailPage.tsx')
  })
})

describe('the step\'s files lint clean', () => {
  const SOURCES = [
    'src/components/LcaMark.tsx',
    'src/components/LcaLogo.tsx',
    'src/components/layout/Navbar.tsx',
    'src/components/layout/Footer.tsx',
    'src/pages/AboutPage.tsx',
    'src/components/StatusBadge.tsx',
  ]
  const TESTS = [
    'test/unit/lca-mark.test.tsx',
    'test/unit/brand-placements.test.tsx',
    'test/unit/fixtures/brand-today.ts',
    'test/unit/brand-edges.test.tsx',
    'test/unit/status-badge.test.tsx',
    'test/unit/redesign-status-step28.test.ts',
    'test/unit/browser-test-wiring.test.ts',
    'test/a11y/brand.spec.ts',
    'test/a11y/brand-edges.spec.ts',
  ]

  it('with the site\'s own rules: no error and no warning in any of them', async () => {
    const eslint = new ESLint({ cwd: ROOT })
    const results = await eslint.lintFiles([...SOURCES, ...TESTS])
    expect(results.map((r) => relative(ROOT, r.filePath)).sort()).toEqual([...SOURCES, ...TESTS].sort())
    const found = results.flatMap((r) => r.messages.map((m) => `${relative(ROOT, r.filePath)}:${m.line} ${m.ruleId ?? 'parse'} ${m.message}`))
    expect(found).toEqual([])
  }, 60_000)

  it('with no eslint-disable among the six files under src', () => {
    for (const file of SOURCES) expect(read(file), file).not.toMatch(/eslint-disable/)
  })
})

describe('REDESIGN_STATUS.md keeps its shape round the step', () => {
  const status = read('REDESIGN_STATUS.md')
  const lines = status.split('\n')
  /** The part of the file from a heading to the next heading of the same level. */
  const part = (heading: string) => {
    const at = status.indexOf(heading)
    const end = status.indexOf('\n### ', at + heading.length)
    return status.slice(at, end < 0 ? undefined : end).split('\n')
  }
  /** Where the first and last entries of a step fall among a part's lines. */
  const span = (entries: string[], step: number) => {
    const at = entries.flatMap((l, i) => (new RegExp(`\\(step ${step}[;)]`).test(l) ? [i] : []))
    return [at[0], at[at.length - 1]]
  }

  it('every row of the acceptance table has the table\'s four cells, so no bar in the AC10 row\'s proofs breaks the table', () => {
    const at = lines.findIndex((l) => l.startsWith('### What each acceptance criterion'))
    const rows: string[] = []
    for (let i = lines.findIndex((l, n) => n > at && l.startsWith('|')); lines[i]?.startsWith('|'); i++) rows.push(lines[i])
    expect(rows.length).toBeGreaterThan(20)
    const cells = (row: string) => row.split(/(?<!\\)\|/).length - 2
    for (const row of rows) expect(cells(row), row.slice(0, 40)).toBe(4)
    expect(rows.filter((r) => r.startsWith('| AC10 |'))).toHaveLength(1)
  })

  it('puts the step\'s decisions, verify items and follow-ups after step 27\'s, and its deviation right after step 27\'s', () => {
    for (const heading of ['### Decisions', '### Verify items resolved', '### Follow-ups']) {
      const entries = part(heading).filter((l) => l.startsWith('- '))
      const [, last27] = span(entries, 27)
      const [first28] = span(entries, 28)
      expect(first28, heading).toBeGreaterThan(last27)
    }
    const deviations = part('### Deviations from the brief').filter((l) => /^- \*\*Step \d+\.\*\*/.test(l))
    const steps = deviations.map((l) => Number(l.match(/Step (\d+)/)![1]))
    // Later steps' deviations follow step 28's.
    const at27 = steps.indexOf(27)
    expect(steps.slice(at27, at27 + 2)).toEqual([27, 28])
    expect(steps.slice(at27 + 2).every((n) => n > 28)).toBe(true)
  })
})
