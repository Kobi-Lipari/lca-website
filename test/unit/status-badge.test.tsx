// @vitest-environment jsdom
//
// StatusBadge and StatusDot (WS01 step 26), with newLook off, the switch's
// starting state (the dot under the new look is status-dot-newlook.test.tsx).
//
// - Every status shows its words: each of the eight statuses draws the tile's
//   tag with its default words when no children are given, the children when
//   they are, and its default words for children that draw nothing; each tag
//   carries data-status and its status's pair of tokens, its words on its
//   own tint (WS01 acceptance criterion 5).
// - The live tag's dot is static: no animation class, and its animation is
//   none; nothing in src pulses, pings or bounces (acceptance criterion 14).
// - The tone path draws today's pills class for class: all ten strings, each
//   tone on each surface, pinned, so today's callers draw what they drew.
// - StatusDot with newLook off is today's dot, span, class and title.
//
// The animation class names the scan looks for are put together when the
// test runs, so Tailwind, which reads this file, builds no CSS for them.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StatusBadge, StatusDot, type BadgeSurface, type BadgeTone } from '@/components/StatusBadge'
import { BADGE_STATUSES, STATUS_LABELS } from '@/lib/badgeStatus'
import { FEATURES } from '@/lib/features'

afterEach(cleanup)

const ROOT = join(__dirname, '../..')

/** The tile's tag shape, as StatusBadge writes it. */
const TAG = 'inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs leading-none font-medium whitespace-nowrap'

/** Each status's words on its own tint, as StatusBadge writes them. */
const PAIRS: Record<string, string> = {
  open: 'bg-status-open-tint text-status-open',
  soon: 'bg-status-soon-tint text-status-soon',
  full: 'bg-status-full-tint text-status-full',
  waitlist: 'bg-status-waitlist-tint text-status-waitlist',
  closed: 'bg-status-closed-tint text-status-closed inset-ring inset-ring-hairline',
  live: 'bg-status-live-tint text-status-live',
  partner: 'bg-status-partner-tint text-status-partner',
  lca: 'bg-status-lca-tint text-status-lca',
}

/** Today's pills, the ten strings of TONE_CLASSES as they were before step 26, to the letter. */
const TODAY: Record<BadgeSurface, Record<BadgeTone, string>> = {
  navy: {
    gold: 'bg-lca-gold/20 text-lca-gold',
    emerald: 'bg-emerald-500/20 text-emerald-300',
    red: 'bg-red-500/20 text-red-300',
    blue: 'bg-blue-500/20 text-blue-200',
    muted: 'bg-white/10 text-white/60',
  },
  light: {
    gold: 'bg-lca-gold/20 text-gold-ink-badge',
    emerald: 'bg-emerald-100 text-emerald-800',
    red: 'bg-red-100 text-red-700',
    blue: 'border border-blue-200 bg-blue-50 text-blue-800',
    muted: 'bg-muted text-muted-foreground',
  },
}

describe('newLook off', () => {
  it('is the starting state of the switch', () => {
    expect(FEATURES.newLook).toBe(false)
  })
})

describe('StatusBadge: every status in words', () => {
  it('knows the eight statuses, each with default words of its own', () => {
    expect([...BADGE_STATUSES]).toEqual(['open', 'soon', 'full', 'waitlist', 'closed', 'live', 'partner', 'lca'])
    expect(STATUS_LABELS).toEqual({
      open: 'Registration open',
      soon: 'Opens soon',
      full: 'Event full',
      waitlist: 'Waitlist',
      closed: 'Registration closed',
      live: 'Live',
      partner: 'Partner event',
      lca: 'LCA event',
    })
    expect(new Set(Object.values(STATUS_LABELS)).size).toBe(8)
    for (const words of Object.values(STATUS_LABELS)) {
      expect(words).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
      expect(words).not.toMatch(/\bUSCF\b/)
    }
  })

  it.each(BADGE_STATUSES)('%s shows its default words with no children, in the tile\'s tag, with data-status', (status) => {
    const { container } = render(<StatusBadge status={status} on="light" />)
    const tag = container.firstElementChild as HTMLElement
    expect(tag.tagName).toBe('SPAN')
    expect(tag.textContent).toBe(STATUS_LABELS[status])
    expect(tag.getAttribute('data-status')).toBe(status)
    expect(tag.getAttribute('data-slot')).toBe('status-badge')
    expect(tag.className).toBe(`${TAG} ${PAIRS[status]}`)
    // Visible words: a text node of the tag itself, not a name only a screen reader hears.
    expect([...tag.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent === STATUS_LABELS[status])).toBe(true)
    expect(tag.hasAttribute('aria-label')).toBe(false)
    expect(tag.hasAttribute('title')).toBe(false)
  })

  it.each(BADGE_STATUSES)('%s shows the words it is given', (status) => {
    render(<StatusBadge status={status} on="light">Words for {status}</StatusBadge>)
    const tag = screen.getByText(`Words for ${status}`)
    expect(tag.getAttribute('data-status')).toBe(status)
    expect(tag.textContent).toBe(`Words for ${status}`)
  })

  it.each([
    ['an empty string', ''],
    ['blank text', '   '],
    ['null', null],
    ['false', false],
    ['an empty list', []],
  ])('falls back to its default words when its children are %s, so a tag is never empty', (_, children) => {
    const { container } = render(<StatusBadge status="full" on="light">{children}</StatusBadge>)
    expect(container.textContent).toBe('Event full')
  })

  it('writes each status\'s words beside its own tint, in one string, under the same variants', () => {
    for (const status of BADGE_STATUSES) {
      const classes = PAIRS[status].split(' ')
      expect(classes, status).toContain(`bg-status-${status}-tint`)
      expect(classes, status).toContain(`text-status-${status}`)
    }
  })

  it('puts the tile\'s mark before the words, a shape of its own for each status, hidden from screen readers', () => {
    const shapes: Record<string, string> = {}
    for (const status of BADGE_STATUSES) {
      cleanup()
      const { container } = render(<StatusBadge status={status} on="light" />)
      const marks = container.querySelectorAll('[data-slot="status-mark"]')
      if (status === 'lca') {
        // The rook mark is step 28's (LcaMark); the words carry the status.
        expect(marks).toHaveLength(0)
        continue
      }
      expect(marks, status).toHaveLength(1)
      const mark = marks[0]
      expect(mark.tagName.toLowerCase()).toBe('svg')
      expect(mark.getAttribute('aria-hidden')).toBe('true')
      // The partner tag's mark comes after its words; every other mark before them.
      const tag = container.firstElementChild!
      expect(status === 'partner' ? tag.lastElementChild : tag.firstElementChild, status).toBe(mark)
      // Drawn in the words' colour, never a colour of its own.
      for (const el of mark.querySelectorAll('*')) {
        for (const attr of ['fill', 'stroke']) {
          const v = el.getAttribute(attr)
          if (v !== null) expect(['currentColor', 'none'], `${status} ${attr}`).toContain(v)
        }
      }
      shapes[status] = mark.innerHTML
    }
    // Full and waitlist share the half-filled ring; every other status has a shape of its own.
    expect(Object.keys(shapes)).toHaveLength(7)
    expect(new Set(Object.values(shapes)).size).toBe(6)
    expect(shapes.full).toBe(shapes.waitlist)
  })
})

describe('StatusBadge: the live tag\'s dot is static', () => {
  it('has no animation class, and its animation is none', () => {
    const { container } = render(<StatusBadge status="live" on="light">Live · Round 3</StatusBadge>)
    const tag = container.firstElementChild as HTMLElement
    const dot = tag.querySelector('[data-slot="status-mark"]') as SVGElement
    expect(dot).not.toBeNull()
    for (const el of [tag, dot, ...dot.querySelectorAll('*')]) {
      expect(el.getAttribute('class') ?? '', el.tagName).not.toMatch(/(?:^|\s)(?:[\w-]+:)*animate-/)
    }
    expect(dot.style.animation).toBe('none')
    expect(tag.textContent).toBe('Live · Round 3')
  })

  it('nothing in src pulses, pings or bounces: no such animation class and no keyframes of its own', () => {
    const names = ['pulse', 'ping', 'bounce'].map((n) => ['animate', n].join('-'))
    const found: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(join(ROOT, dir))) {
        const path = `${dir}/${name}`
        if (statSync(join(ROOT, path)).isDirectory()) walk(path)
        else if (/\.(tsx?|css)$/.test(name)) {
          const text = readFileSync(join(ROOT, path), 'utf8')
          for (const n of names) if (new RegExp(`(?<![\\w-])${n}(?![\\w-])`).test(text)) found.push(`${path} ${n}`)
          if (/@keyframes\b/.test(text)) found.push(`${path} @keyframes`)
        }
      }
    }
    walk('src')
    expect(found).toEqual([])
  })
})

describe('StatusBadge: today\'s pills, tone and on, class for class', () => {
  const cases = (['navy', 'light'] as const).flatMap((on) => (Object.keys(TODAY[on]) as BadgeTone[]).map((tone) => [on, tone] as const))

  it('pins all ten strings', () => {
    expect(cases).toHaveLength(10)
  })

  it.each(cases)('on %s, the %s tone draws today\'s pill', (on, tone) => {
    const { container } = render(<StatusBadge tone={tone} on={on}>Words</StatusBadge>)
    const pill = container.firstElementChild as HTMLElement
    expect(pill.outerHTML).toBe(`<span class="rounded-full px-2.5 py-0.5 text-xs font-medium ${TODAY[on][tone]}">Words</span>`)
  })

  it('takes the navy surface by default, as today', () => {
    const { container } = render(<StatusBadge tone="muted">Coming soon</StatusBadge>)
    expect(container.innerHTML).toBe('<span class="rounded-full px-2.5 py-0.5 text-xs font-medium bg-white/10 text-white/60">Coming soon</span>')
  })

  it('keeps a caller\'s words and className, as the fixture page and the Scholastic page pass them', () => {
    const { container } = render(
      <StatusBadge tone="emerald" on="light" className="ml-2"><span data-status="open">Registration open</span></StatusBadge>,
    )
    expect(container.innerHTML).toBe('<span class="rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 ml-2"><span data-status="open">Registration open</span></span>')
  })

  it('keeps TONE_CLASSES on the lines the gold guard and its allowlist name', () => {
    const lines = readFileSync(join(ROOT, 'src/components/StatusBadge.tsx'), 'utf8').split('\n')
    expect(lines[25]).toBe('const TONE_CLASSES: Record<BadgeSurface, Record<BadgeTone, string>> = {')
    expect(lines[27]).toBe("    gold: 'bg-lca-gold/20 text-lca-gold',")
    expect(lines[34]).toBe("    gold: 'bg-lca-gold/20 text-gold-ink-badge',")
    expect(lines[40]).toBe('}')
    // The tone path's pill still reads its string where the light gold allowlist entry says.
    expect(lines.join('\n')).toContain('        TONE_CLASSES[on][tone],\n')
  })
})

describe('StatusDot with newLook off: today\'s dot', () => {
  it.each([
    ['open', 'bg-emerald-500', 'Registration open'],
    ['draft', 'bg-lca-gold', 'Opening soon'],
    ['closed', 'bg-border', 'Coming soon'],
    [null, 'bg-border', 'Coming soon'],
    [undefined, 'bg-border', 'Coming soon'],
  ])('%s is the dot alone, with its title', (regStatus, colour, title) => {
    const { container } = render(<StatusDot regStatus={regStatus} />)
    expect(container.innerHTML).toBe(`<span class="size-1.5 flex-shrink-0 rounded-full ${colour}" title="${title}"></span>`)
  })

  it('takes a caller\'s className on the dot, as today', () => {
    const { container } = render(<StatusDot regStatus="open" className="ml-1" />)
    expect(container.innerHTML).toBe('<span class="size-1.5 flex-shrink-0 rounded-full bg-emerald-500 ml-1" title="Registration open"></span>')
  })

  it('gives its label as the title, the only words the dot has with newLook off', () => {
    const { container } = render(<StatusDot regStatus="open" label="Registration open until Fri, Oct 23" />)
    expect(container.innerHTML).toBe('<span class="size-1.5 flex-shrink-0 rounded-full bg-emerald-500" title="Registration open until Fri, Oct 23"></span>')
  })

  it.each(['', '   '])('keeps today\'s title for a blank label (%j), never an empty one', (label) => {
    const { container } = render(<StatusDot regStatus="draft" label={label} />)
    expect(container.innerHTML).toBe('<span class="size-1.5 flex-shrink-0 rounded-full bg-lca-gold" title="Opening soon"></span>')
  })
})
