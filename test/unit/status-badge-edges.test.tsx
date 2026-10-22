// @vitest-environment jsdom
//
// StatusBadge's edges (WS01 step 26), with newLook off, the switch's
// starting state.
//
// - A status tag always shows words (acceptance criterion 5): children that
//   draw nothing, an empty fragment among them, leave it its default words;
//   words given as an element are shown as given; the words are never hidden
//   from a screen reader and never left to a title or a label alone.
// - Every status's tag is the same box (acceptance criterion 8 measures the
//   boxes): one shape, one string of colours per status, nothing else.
// - The live tag's dot has an inline animation of none, however its words
//   are given, and no part of the live tag carries an animation class
//   (acceptance criterion 14).
// - Today's callers draw what they drew: the Scholastic page's pill for each
//   tournament status TOURNAMENT_STATUS knows (and one it does not), and the
//   fixture page's three pills, class for class; the two pages that draw
//   StatusBadge and StatusDot still call them as they did.
//
// Class names the scans look for are put together when the test runs, so
// Tailwind, which reads this file, builds no CSS for them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { TOURNAMENT_STATUS } from '@/areas/events/tournamentStatus'
import { StatusBadge, StatusDot } from '@/components/StatusBadge'
import { BADGE_STATUSES, STATUS_LABELS } from '@/lib/badgeStatus'
import { FEATURES } from '@/lib/features'

afterEach(cleanup)

const ROOT = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** Today's pill, as the tone path writes it. */
const PILL = 'rounded-full px-2.5 py-0.5 text-xs font-medium'
const ANIMATION_CLASS = new RegExp(`(?:^|\\s)(?:[\\w-]+:)*${['anim', 'ate'].join('')}-`)

/** The tag a status renders, alone in its container. */
function tag(node: ReactElement): HTMLElement {
  const { container } = render(node)
  expect(container.children).toHaveLength(1)
  return container.firstElementChild as HTMLElement
}

/** The words a sighted reader sees in a tag: its text, less anything hidden from view or from a screen reader. */
function shownWords(el: Element): string {
  let out = ''
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) out += node.textContent
    else if (node instanceof Element && node.getAttribute('aria-hidden') !== 'true' && !node.classList.contains('sr-only') && node.tagName.toLowerCase() !== 'svg') {
      out += shownWords(node)
    }
  }
  return out.trim()
}

describe('newLook off', () => {
  it('is the starting state of the switch', () => {
    expect(FEATURES.newLook).toBe(false)
  })
})

describe('a status tag always shows words', () => {
  it('keeps its default words when its children are a fragment that draws nothing, for every status', () => {
    // A fragment is how a caller writes words that may come out empty, such
    // as <>{opensOn && `Opens ${opensOn}`}</>; it must not leave the tag
    // with its mark and no words.
    const empty: Array<[string, ReactElement]> = [
      ['an empty fragment', <></>],
      ['a fragment of blank text', <>{'  '}</>],
      ['a fragment holding only nothing', <>{null}{false}{undefined}</>],
    ]
    const wordless: string[] = []
    for (const status of BADGE_STATUSES) {
      for (const [kind, children] of empty) {
        cleanup()
        const words = shownWords(tag(<StatusBadge status={status} on="light">{children}</StatusBadge>))
        if (words !== STATUS_LABELS[status]) wordless.push(`${status} with ${kind} shows "${words}"`)
      }
    }
    expect(wordless).toEqual([])
  })

  it.each([
    ['nested lists of blanks', [[''], [' ', null], []]],
    ['a tab and a new line', '\t\n'],
    ['a no-break space', '\u00a0'],
  ])('falls back to its default words for %s', (_, children) => {
    const el = tag(<StatusBadge status="waitlist" on="light">{children}</StatusBadge>)
    expect(shownWords(el)).toBe('Waitlist')
  })

  it('shows words given as an element as they are, with data-status on the tag', () => {
    const el = tag(
      <StatusBadge status="soon" on="light">
        <time dateTime="2026-10-12">Opens Mon, Oct 12</time>
      </StatusBadge>,
    )
    expect(el.getAttribute('data-status')).toBe('soon')
    expect(shownWords(el)).toBe('Opens Mon, Oct 12')
    expect(el.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-12')
    expect(el.textContent).not.toContain(STATUS_LABELS.soon)
  })

  it.each(BADGE_STATUSES)('%s: its words are seen and heard, never hidden, never a title or a label alone', (status) => {
    const el = tag(<StatusBadge status={status} on="light" />)
    expect(el.getAttribute('aria-hidden')).toBeNull()
    expect(el.closest('[aria-hidden="true"]')).toBeNull()
    expect(el.querySelector('.sr-only')).toBeNull()
    for (const attr of ['title', 'aria-label', 'aria-labelledby', 'role']) expect(el.hasAttribute(attr), attr).toBe(false)
    expect(shownWords(el)).toBe(STATUS_LABELS[status])
    // Every element in the tag but the words is the hidden mark.
    for (const child of el.children) {
      expect(child.getAttribute('data-slot'), status).toBe('status-mark')
      expect(child.getAttribute('aria-hidden'), status).toBe('true')
    }
  })
})

describe('the partner tag', () => {
  it('says Partner event with the outside mark after its words, and no Register and no count', () => {
    const el = tag(<StatusBadge status="partner" on="light" />)
    expect(shownWords(el)).toBe('Partner event')
    expect(el.textContent).not.toMatch(/\d/)
    expect(el.textContent).not.toMatch(/regist/i)
    expect(el.querySelector('a, button')).toBeNull()
    expect(el.lastElementChild?.getAttribute('data-slot')).toBe('status-mark')
    expect(el.lastElementChild?.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('every status draws the same box', () => {
  it('one shape for all eight, each status adding only its own pair of colours', () => {
    const shapes = new Set<string>()
    for (const status of BADGE_STATUSES) {
      cleanup()
      const classes = tag(<StatusBadge status={status} on="light" />).className.split(' ')
      const own = classes.filter((c) => c.includes(`status-${status}`))
      expect(own.sort(), status).toEqual([`bg-status-${status}-tint`, `text-status-${status}`].sort())
      // What is left is the box, the closed tag's inset hairline aside, which draws inside it.
      const box = classes.filter((c) => !own.includes(c) && !c.startsWith('inset-ring'))
      shapes.add(box.join(' '))
    }
    expect(shapes.size).toBe(1)
    const [shape] = [...shapes]
    for (const cls of ['inline-flex', 'h-6', 'rounded-sm', 'px-2', 'gap-1.5', 'text-xs', 'whitespace-nowrap']) expect(shape.split(' '), cls).toContain(cls)
  })

  it('keeps the box when its words are its own and long', () => {
    const own = tag(<StatusBadge status="partner" on="light">Partner event: register on the organizer&apos;s site</StatusBadge>)
    cleanup()
    const plain = tag(<StatusBadge status="partner" on="light" />)
    expect(own.className).toBe(plain.className)
  })
})

describe('the live tag\'s dot is static however its words are given', () => {
  it.each([
    ['its default words', undefined],
    ['words of its own', 'Live · Round 3'],
    ['an element for words', <span key="w">Live · Round 5</span>],
    ['an empty string', ''],
  ])('with %s', (_, children) => {
    const el = tag(<StatusBadge status="live" on="light">{children}</StatusBadge>)
    const marks = el.querySelectorAll('[data-slot="status-mark"]')
    expect(marks).toHaveLength(1)
    const dot = marks[0] as SVGElement
    expect(el.firstElementChild).toBe(dot)
    expect(dot.getAttribute('style')).toBe('animation: none;')
    for (const part of [el, dot, ...dot.querySelectorAll('*')]) {
      expect(part.getAttribute('class') ?? '', part.tagName).not.toMatch(ANIMATION_CLASS)
      expect(part.getAttribute('style') ?? '', part.tagName).not.toMatch(/animation(?:-name)?:(?!\s*none\s*;?\s*$)/)
    }
    // A plain dot: one filled circle, nothing that draws or moves on its own.
    expect([...dot.children].map((c) => c.tagName.toLowerCase())).toEqual(['circle'])
    expect(dot.querySelector('animate, animateTransform, animateMotion, set')).toBeNull()
    expect(shownWords(el)).not.toBe('')
  })

  it('no other status\'s mark carries an inline animation, so the live dot is the one told to stay still', () => {
    for (const status of BADGE_STATUSES.filter((s) => s !== 'live')) {
      cleanup()
      const el = tag(<StatusBadge status={status} on="light" />)
      for (const mark of el.querySelectorAll('[data-slot="status-mark"]')) expect(mark.getAttribute('style'), status).toBeNull()
    }
  })
})

describe('today\'s callers draw what they drew, with newLook off', () => {
  it.each([
    ['upcoming', 'bg-lca-gold/20 text-gold-ink-badge', 'Upcoming'],
    ['active', 'bg-emerald-100 text-emerald-800', 'Active'],
    ['completed', 'bg-muted text-muted-foreground', 'Completed'],
  ])('the Scholastic page\'s pill for a tournament that is %s', (key, colours, words) => {
    const status = TOURNAMENT_STATUS[key] ?? TOURNAMENT_STATUS.upcoming
    const el = tag(<StatusBadge tone={status.tone} on="light">{status.label}</StatusBadge>)
    expect(el.outerHTML).toBe(`<span class="${PILL} ${colours}">${words}</span>`)
  })

  it('the Scholastic page\'s pill for a status TOURNAMENT_STATUS does not know is the upcoming one, as before', () => {
    const t = { status: 'postponed' as string | null }
    const status = TOURNAMENT_STATUS[t.status ?? 'upcoming'] ?? TOURNAMENT_STATUS.upcoming
    expect(tag(<StatusBadge tone={status.tone} on="light">{status.label}</StatusBadge>).outerHTML).toBe(
      `<span class="${PILL} bg-lca-gold/20 text-gold-ink-badge">Upcoming</span>`,
    )
    expect(Object.keys(TOURNAMENT_STATUS)).toEqual(['upcoming', 'active', 'completed'])
  })

  it.each([
    ['emerald', 'open', 'Registration open', 'bg-emerald-100 text-emerald-800'],
    ['gold', 'soon', 'Opens soon', 'bg-lca-gold/20 text-gold-ink-badge'],
    ['muted', 'closed', 'Registration closed', 'bg-muted text-muted-foreground'],
  ] as const)('the fixture page\'s %s pill, its words marked data-status=%s', (tone, status, words, colours) => {
    const el = tag(<StatusBadge tone={tone} on="light"><span data-status={status}>{words}</span></StatusBadge>)
    expect(el.outerHTML).toBe(`<span class="${PILL} ${colours}"><span data-status="${status}">${words}</span></span>`)
  })

  it('the pages that draw them call them as they did: the tone path with on="light", and the dot with no label', () => {
    const scholastic = read('src/pages/ScholasticPage.tsx')
    expect(scholastic).toContain("const status = TOURNAMENT_STATUS[t.status ?? 'upcoming'] ?? TOURNAMENT_STATUS.upcoming")
    expect(scholastic.match(/<StatusBadge\b[^>]*>/g)).toEqual(['<StatusBadge tone={status.tone} on="light">'])
    const tournaments = read('src/pages/TournamentsPage.tsx')
    expect(tournaments.match(/<StatusDot\b[^>]*>/g)).toEqual(['<StatusDot regStatus={t.registration_status} />'])
    expect(tournaments).not.toMatch(/<StatusBadge\b/)
  })

  it('StatusDot with newLook off still draws no words, only the dot and its title, for every registration status the database allows', () => {
    // tournaments.registration_status is draft, open or closed (migrations/0005).
    for (const regStatus of ['draft', 'open', 'closed']) {
      cleanup()
      const { container } = render(<StatusDot regStatus={regStatus} />)
      const dot = container.firstElementChild as HTMLElement
      expect(container.children).toHaveLength(1)
      expect(dot.tagName).toBe('SPAN')
      expect(dot.textContent).toBe('')
      expect(dot.children).toHaveLength(0)
      expect(dot.getAttribute('title')).not.toBe('')
      expect(dot.getAttribute('data-slot')).toBeNull()
    }
  })
})
