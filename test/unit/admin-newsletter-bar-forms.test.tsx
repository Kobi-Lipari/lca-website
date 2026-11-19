// @vitest-environment jsdom
//
// The forms of the bar at the foot from a computer down to a tablet (WS16
// part two, page step 5, third part; K's decision 66, item 1), beside
// test/unit/admin-newsletter-bar.test.tsx. Each form is chosen by a condition
// on the bar's own row, its container, so these cases read the classes that
// choose it and the words each form draws; where each form starts is measured
// in a real browser, not here:
// - Every form's words stand on one line, but the raised-text form's: no
//   step's words and none of More options' run on to a second line.
// - "Pick a template" short: the words "to start from" are hidden by a
//   condition of the row, the space before them kept outside, so the words
//   left read "Pick a template".
// - "Options" short: More options' full words are hidden and "Options" drawn
//   by one condition of the row, its chevron kept, and its name still "More
//   options".
// Every word here is made up.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FootBar } from '@/areas/admin/newsletter/FootBar'
import { MoreOptions } from '@/areas/admin/newsletter/MoreOptions'

afterEach(cleanup)

const carry = { hold: () => () => undefined, find: () => null }

function drawWide() {
  return render(
    <FootBar
      phone={false}
      bigger={false}
      count={26}
      moreOptions={
        <MoreOptions place="bar" open={false} onOpenChange={() => {}} preheader="" onPreheaderChange={() => {}} reach={null} carry={carry} />
      }
      onSeeEmail={() => {}}
      sheetOpen={false}
      onPick={() => {}}
      chooserOpen={false}
      cue={false}
      carry={carry}
      onTest={() => {}}
      testing={false}
      onSendNotYet={() => {}}
      said={null}
    />,
  )
}

/**
 * The width conditions a class is given under, as "@max-[1000px]" in "@max-[1000px]:hidden", or null when it names
 * none. A class given under two, one in rem and one in pixels, reads as both joined by "or", the rem one first.
 */
function conditionOf(element: Element, then: string): string | null {
  const hits = [...element.classList]
    .filter((name) => /^@?max-\[/.test(name) && name.endsWith(`]:${then}`))
    .map((name) => name.slice(0, -(then.length + 1)))
    .sort((a, b) => Number(b.includes('rem')) - Number(a.includes('rem')))
  return hits.length ? hits.join(' or ') : null
}

/**
 * A wide form's condition is a width in rem with a floor of the same width in
 * pixels at a 16 pixel text size, the class given under each, as
 * "@max-[59.375rem]:hidden @max-[950px]:hidden", so a text size set under 16
 * pixels never chooses a wider form than 16 pixels would (the steps' words are
 * in pixels and do not shrink). Two plain conditions in place of one with
 * max() inside, since a browser that cannot read a math function in a
 * condition drops the whole rule. Its width in rem.
 */
const FLOORED = /^(@?max-)\[([\d.]+)rem\] or (@?max-)\[(\d+)px\]$/
function remOf(condition: string | null): number {
  const hit = FLOORED.exec(condition ?? '')
  expect(hit, condition ?? 'no condition').not.toBeNull()
  expect(hit![3]).toBe(hit![1])
  const rem = Number(hit![2])
  expect(Number(hit![4])).toBe(rem * 16)
  return rem
}

describe('every form of the bar from 768 pixels up', () => {
  it('holds Send\'s words and More options\' words to one line, lets the first two steps\' run on only where the row is too short, and makes no part of them a line of its own', () => {
    drawWide()
    const bar = document.querySelector('[data-slot="foot-bar"]') as HTMLElement
    const words = [...bar.querySelectorAll('[id$="-words"]')]
    // The words drawn: step 2's busy words wait unseen and unread in the same cell.
    const drawn = (span: Element) => [...span.childNodes].map((node) => (node instanceof Element ? (node.getAttribute('aria-hidden') === 'true' ? '' : drawn(node)) : node.textContent)).join('')
    expect(words.map(drawn)).toEqual(['1 Pick a template to start from', '2 Send a test to me', '3 Send to 26 people'])
    expect(words.map((span) => span.classList.contains('whitespace-nowrap'))).toEqual([false, false, true])
    // No condition holds the first two steps' words to one line or frees them: the row's room alone decides.
    for (const span of words.slice(0, 2)) expect([...span.classList].filter((name) => name.includes('whitespace')), span.textContent ?? '').toEqual([])
    const more = screen.getByRole('button', { name: 'More options' })
    for (const span of more.querySelectorAll('span')) expect(span.classList.contains('whitespace-nowrap'), span.textContent ?? '').toBe(true)
    // No class puts words on a line of their own but the raised-text form's, on Send's count alone.
    expect([...bar.querySelectorAll('[class*=":block"]')].map((span) => span.textContent)).toEqual(['26 people'])
  })
})

describe('"Pick a template" short', () => {
  it('hides "to start from" by a condition of the row, the space before it kept outside, so the words left read "Pick a template"', () => {
    drawWide()
    const words = document.querySelector('[id$="-1-words"]') as HTMLElement
    const rest = words.lastElementChild as HTMLElement
    expect(rest.textContent).toBe('to start from')
    remOf(conditionOf(rest, 'hidden'))
    expect(rest.previousSibling?.textContent).toBe('Pick a template ')
    // The mark is kept in this form: drawn beside the step and read in its name.
    expect(screen.getByRole('button', { name: '1 Pick a template to start from' })).toBeTruthy()
  })
})

describe('"Options" short', () => {
  it('hides "More options" and draws "Options" by one condition of the row, keeps its chevron and its name', () => {
    drawWide()
    const more = screen.getByRole('button', { name: 'More options' })
    const [full, short] = [...more.querySelectorAll('span')]
    expect(full.textContent).toBe('More options')
    expect(short.textContent).toBe('Options')
    const at = conditionOf(full, 'hidden')
    remOf(at)
    expect(short.classList.contains('hidden')).toBe(true)
    expect(conditionOf(short, 'inline')).toBe(at)
    // Its chevron is drawn in this form: hidden, if at all, only by a narrower form's condition.
    const chevron = more.querySelector('svg.lucide-chevron-up') as SVGElement
    expect(chevron).toBeTruthy()
    expect(conditionOf(chevron, 'hidden')).not.toBe(at)
  })
})

describe('K\'s narrow form', () => {
  it('hides each mark and the number its step\'s name reads by one condition, the narrowest of the forms with marks', () => {
    drawWide()
    const bar = document.querySelector('[data-slot="foot-bar"]') as HTMLElement
    const words = [...bar.querySelectorAll('[id$="-words"]')]
    const marks = [...bar.querySelectorAll('span.rounded-full[aria-hidden="true"]')]
    expect(marks.map((mark) => mark.textContent)).toEqual(['1', '2', '3'])
    const at = conditionOf(marks[0], 'hidden')
    remOf(at)
    for (const [i, span] of words.entries()) {
      expect(conditionOf(marks[i], 'hidden')).toBe(at)
      // The number the name reads is the button's own, unseen, inside the words the name is read from.
      const number = span.firstElementChild as HTMLElement
      expect(number.textContent).toBe(`${i + 1}`)
      expect(number.classList.contains('sr-only')).toBe(true)
      expect(conditionOf(number, 'hidden')).toBe(at)
      expect(span.closest('button')?.getAttribute('aria-labelledby')).toBe(span.id)
    }
    // More options takes its small form at the same width.
    const more = screen.getByRole('button', { name: 'More options' })
    expect(conditionOf(more, 'flex-col')).toBe(at)
  })

  it('is tightened on a narrow tablet: 16 pixel sides by the window, and the first step\'s words at 16 pixels by one narrower condition of the row', () => {
    drawWide()
    const bar = document.querySelector('[data-slot="foot-bar"]') as HTMLElement
    const row = bar.querySelector('.\\@container') as HTMLElement
    expect(row.classList.contains('px-6')).toBe(true)
    const sides = conditionOf(row, 'px-4')
    expect(sides?.startsWith('max-[')).toBe(true)
    remOf(sides)
    const pick = screen.getByRole('button', { name: '1 Pick a template to start from' })
    expect(pick.classList.contains('text-[17.5px]')).toBe(true)
    const at = conditionOf(pick, 'text-base')
    remOf(at)
    expect(conditionOf(pick, 'px-3')).toBe(at)
    expect(conditionOf(pick.querySelector('svg.lucide-bookmark') as SVGElement, 'size-[19px]')).toBe(at)
    expect(conditionOf(pick.querySelector('svg.lucide-chevron-up') as SVGElement, 'size-4')).toBe(at)
    // Narrower than the narrow form's own start, so the board's sizes hold first.
    const narrow = conditionOf(bar.querySelector('span.rounded-full[aria-hidden="true"]') as HTMLElement, 'hidden')
    expect(remOf(at)).toBeLessThan(remOf(narrow))
  })

  it('keeps Send\'s arrow drawn in every form, and step 2\'s busy words with their number', () => {
    const view = drawWide()
    const send = screen.getByRole('button', { name: '3 Send to 26 people' })
    const arrow = send.querySelector('svg.lucide-chevron-down')?.parentElement as HTMLElement
    expect(arrow).toBeTruthy()
    expect([...arrow.classList].some((name) => name.endsWith(':hidden'))).toBe(false)
    view.rerender(
      <FootBar phone={false} bigger={false} count={26} onSeeEmail={() => {}} sheetOpen={false} onPick={() => {}} chooserOpen={false} cue={false} carry={carry} onTest={() => {}} testing onSendNotYet={() => {}} said={null} />,
    )
    expect(screen.getByRole('button', { name: '2 Sending a test' }).getAttribute('aria-disabled')).toBe('true')
  })

  it('holds step 2 at one width while its words change: both in one cell, the ones not drawn unseen and unread', () => {
    const view = drawWide()
    const cells = () => [...document.querySelectorAll('[data-slot="test-words"]')] as HTMLElement[]
    const state = () => cells().map((cell) => [cell.textContent?.trim(), cell.classList.contains('invisible'), cell.getAttribute('aria-hidden')])
    expect(cells().map((cell) => cell.parentElement)).toEqual([cells()[0].parentElement, cells()[0].parentElement])
    expect(cells()[0].parentElement?.classList.contains('inline-grid')).toBe(true)
    for (const cell of cells()) expect(['col-start-1', 'row-start-1'].every((name) => cell.classList.contains(name))).toBe(true)
    expect(state()).toEqual([['Send a test to me', false, null], ['Sending a test', true, 'true']])
    // In the raised-text form, the one Send's count goes under, the words not drawn take no room, or their longest
    // word would hold the step wide and push Send past a 768 window at 24 pixels with the spacing raised.
    const raised = conditionOf(screen.getByRole('button', { name: '3 Send to 26 people' }).querySelector('[id$="-3-words"] > span:last-child') as HTMLElement, 'block')
    remOf(raised)
    expect(cells().map((cell) => conditionOf(cell, 'hidden'))).toEqual([null, raised])
    view.rerender(
      <FootBar phone={false} bigger={false} count={26} onSeeEmail={() => {}} sheetOpen={false} onPick={() => {}} chooserOpen={false} cue={false} carry={carry} onTest={() => {}} testing onSendNotYet={() => {}} said={null} />,
    )
    expect(state()).toEqual([['Send a test to me', true, 'true'], ['Sending a test', false, null]])
    expect(cells().map((cell) => conditionOf(cell, 'hidden'))).toEqual([raised, null])
    expect(screen.queryByRole('button', { name: /Send a test to me/ })).toBeNull()
  })

  it('draws the status line under the row in every form, with no form condition on it or its words', () => {
    render(
      <FootBar phone={false} bigger={false} count={26} onSeeEmail={() => {}} sheetOpen={false} onPick={() => {}} chooserOpen={false} cue={false} carry={carry} onTest={() => {}} testing={false} onSendNotYet={() => {}} said={{ tone: 'sent', words: 'Sent to sample@sample.lca.' }} />,
    )
    const line = screen.getByRole('status')
    expect(line.textContent).toBe('Sent to sample@sample.lca.')
    for (const element of [line, ...line.querySelectorAll('*')]) {
      expect([...element.classList].filter((name) => name.startsWith('@') || /^max-\[[^\]]+\]:/.test(name) || name === 'hidden')).toEqual([])
    }
  })
})

describe('the raised-text form', () => {
  it('puts Send\'s count under "Send to" by one condition narrower than the tightened form, the first two steps\' words free to run on', () => {
    drawWide()
    const bar = document.querySelector('[data-slot="foot-bar"]') as HTMLElement
    for (const span of bar.querySelectorAll('[id$="-1-words"], [id$="-2-words"]')) expect(span.classList.contains('whitespace-nowrap')).toBe(false)
    const send = screen.getByRole('button', { name: '3 Send to 26 people' })
    const count = send.querySelector('[id$="-3-words"] > span:last-child') as HTMLElement
    expect(count.textContent).toBe('26 people')
    const at = conditionOf(count, 'block')
    expect(count.previousSibling?.textContent).toBe('Send to ')
    // Narrower than the tightened form's own start, so the tightened form holds first at the usual text size.
    const tightened = conditionOf(screen.getByRole('button', { name: '1 Pick a template to start from' }), 'text-base')
    expect(remOf(at)).toBeLessThan(remOf(tightened))
    // Its arrow and the marks' condition are those of the narrow form: no new condition hides either.
    expect(send.querySelector('svg.lucide-chevron-down')?.parentElement?.className).not.toMatch(/:hidden/)
  })

  it('lets the row wrap, so Send takes a line of its own, only where the window is under 30rem, as text near double size makes a tablet', () => {
    drawWide()
    const row = (document.querySelector('[data-slot="foot-bar"] .\\@container') as HTMLElement)
    expect(row.classList.contains('flex-wrap')).toBe(false)
    const at = conditionOf(row, 'flex-wrap')
    expect(at).toBe('max-[30rem] or max-[480px]')
    remOf(at)
    // Its lines kept apart by the same condition, and narrower than the tablet's own sides.
    expect(conditionOf(row, 'gap-y-2')).toBe(at)
    expect(remOf(at)).toBeLessThan(remOf(conditionOf(row, 'px-4')))
  })
})

describe('what every wide form keeps', () => {
  it('keeps the first step\'s popup attributes, its turning chevron, its carry name, and one pick-step holding its mark and one pick-ring, none hidden by a form', () => {
    const held: string[] = []
    const holding = { hold: (name: string) => { held.push(name); return () => undefined }, find: () => null }
    const draw = (open: boolean) => (
      <FootBar phone={false} bigger={false} count={26} onSeeEmail={() => {}} sheetOpen={false} onPick={() => {}} chooserOpen={open} cue={false} carry={holding} onTest={() => {}} testing={false} onSendNotYet={() => {}} said={null} />
    )
    const view = render(draw(false))
    const pick = screen.getByRole('button', { name: '1 Pick a template to start from' })
    expect(pick.getAttribute('aria-haspopup')).toBe('dialog')
    expect(pick.getAttribute('aria-expanded')).toBe('false')
    expect(held).toContain('pick')
    const steps = document.querySelectorAll('[data-slot="pick-step"]')
    const rings = document.querySelectorAll('[data-slot="pick-ring"]')
    expect(steps).toHaveLength(1)
    expect(rings).toHaveLength(1)
    // The wiggle turns the step with its mark: the mark is inside the turning slot, beside the button.
    expect(steps[0].contains(pick)).toBe(true)
    expect(steps[0].querySelector('span.rounded-full[aria-hidden="true"]')?.textContent).toBe('1')
    expect(pick.contains(rings[0])).toBe(true)
    for (const slot of [steps[0], rings[0]]) expect([...slot.classList].filter((name) => /^@?max-/.test(name))).toEqual([])
    const chevron = pick.querySelector('svg.lucide-chevron-up') as SVGElement
    expect(chevron.classList.contains('rotate-180')).toBe(false)
    view.rerender(draw(true))
    expect(pick.getAttribute('aria-expanded')).toBe('true')
    expect((pick.querySelector('svg.lucide-chevron-up') as SVGElement).classList.contains('rotate-180')).toBe(true)
  })
})

describe('the phone\'s raised-text form', () => {
  it('puts each button on a row of its own, the row\'s width, by one condition of the phone bar\'s own row in rem', () => {
    render(<FootBar phone bigger={false} count={26} onSeeEmail={() => {}} sheetOpen={false} onPick={() => {}} chooserOpen={false} cue={false} carry={carry} onTest={() => {}} testing={false} onSendNotYet={() => {}} said={null} />)
    const pick = screen.getByRole('button', { name: 'Pick a template' })
    const see = screen.getByRole('button', { name: 'See the email' })
    const row = pick.parentElement as HTMLElement
    expect(see.parentElement).toBe(row)
    expect(row.classList.contains('@container')).toBe(true)
    expect(row.classList.contains('flex-wrap')).toBe(true)
    const at = conditionOf(pick, 'basis-full')
    expect(at).toMatch(/^@max-\[[\d.]+rem\]$/)
    // Measured: a 384 pixel phone at 20 pixels of text has a row of 17.45rem, and with the text spacing raised it must take
    // two rows; a 320 pixel phone at 16 pixels has a row of 18.25rem and keeps one, as the board draws it.
    const rem = Number(/[\d.]+/.exec(at ?? '')![0])
    expect(rem).toBeGreaterThanOrEqual(17.75)
    expect(rem).toBeLessThan(18.25)
    expect(conditionOf(see, 'basis-full')).toBe(at)
    // The phone's press rule, its slot and its popup attributes are kept.
    expect(pick.getAttribute('data-slot')).toBe('pick-step')
    expect(pick.getAttribute('aria-haspopup')).toBe('dialog')
    expect(see.getAttribute('aria-haspopup')).toBe('dialog')
  })

  it('keeps the phone\'s press rule, its slots and its carry names in the two-row form: the classes alone change', () => {
    const held: string[] = []
    const holding = { hold: (name: string) => { held.push(name); return () => undefined }, find: () => null }
    render(
      <>
        <input aria-label="Sample field" />
        <FootBar phone bigger={false} count={26} onSeeEmail={() => {}} sheetOpen={false} onPick={() => {}} chooserOpen={false} cue={false} carry={holding} onTest={() => {}} testing={false} onSendNotYet={() => {}} said={null} />
      </>,
    )
    expect(held).toEqual(expect.arrayContaining(['pick', 'see']))
    const pick = screen.getByRole('button', { name: 'Pick a template' })
    const see = screen.getByRole('button', { name: 'See the email' })
    expect(document.querySelectorAll('[data-slot="pick-step"]')).toHaveLength(1)
    expect(pick.querySelectorAll('[data-slot="pick-ring"]')).toHaveLength(1)
    // With no field holding the caret a press is the browser's own; with one, the press moves no focus.
    for (const button of [pick, see]) expect(fireEvent.mouseDown(button)).toBe(true)
    screen.getByRole('textbox', { name: 'Sample field' }).focus()
    for (const button of [pick, see]) expect(fireEvent.mouseDown(button)).toBe(false)
  })
})

describe('More options at a phone\'s page end', () => {
  it('gives its field the bar\'s room under the header and room below for its rows\' foot, in rem; the button keeps the desk\'s own', () => {
    const { container } = render(
      <MoreOptions place="end" open onOpenChange={() => {}} preheader="" onPreheaderChange={() => {}} reach={null} carry={carry} />,
    )
    const end = container.querySelector('[data-slot="more-options"][data-place="end"]')!
    const classes = [...end.classList]
    expect(classes).toContain('[&_input]:scroll-mt-[calc(3.25rem+var(--header-h,4rem)-var(--header-h,0px))]!')
    expect(classes).toContain('[&_input]:scroll-mb-[18rem]!')
    // The same room above as the bar's own controls take (FootBar's class), so the two never drift apart.
    const bar = drawWide().container.querySelector('[data-slot="foot-bar"]')!
    expect([...bar.classList]).toContain('[&_:is(a,button,input,textarea,[tabindex])]:scroll-mt-[calc(3.25rem+var(--header-h,4rem)-var(--header-h,0px))]!')
    // Only the field takes it: the rows hold one field, and More options' own button is left to the desk's rule.
    expect(end.querySelectorAll('input')).toHaveLength(1)
    expect(classes.filter((name) => name.includes('button'))).toEqual([])
  })
})

describe('the conditions that choose a wide form', () => {
  it('give every width condition of the bar and of More options a pixel floor, and run from the widest form down', () => {
    render(
      <FootBar
        phone={false}
        bigger={false}
        count={26}
        moreOptions={<MoreOptions place="bar" open onOpenChange={() => {}} preheader="" onPreheaderChange={() => {}} reach={null} carry={carry} />}
        onSeeEmail={() => {}}
        sheetOpen={false}
        onPick={() => {}}
        chooserOpen={false}
        cue={false}
        carry={carry}
        onTest={() => {}}
        testing={false}
        onSendNotYet={() => {}}
        said={null}
      />,
    )
    const bar = document.querySelector('[data-slot="foot-bar"]') as HTMLElement
    let given = 0
    for (const element of [bar, ...bar.querySelectorAll('*'), ...document.querySelectorAll('[data-slot="more-options"] *')]) {
      for (const name of element.classList) {
        const hit = /^@?(?:max|min)-\[[^\]]+\]:(.+)$/.exec(name)
        if (!hit) continue
        given += 1
        // A condition added without its floor would choose a wider form at a 12 pixel text size than at 16.
        remOf(conditionOf(element, hit[1]))
      }
    }
    expect(given).toBeGreaterThan(0)
    const more = screen.getByRole('button', { name: 'More options' })
    const pick = screen.getByRole('button', { name: '1 Pick a template to start from' })
    const starts = [
      conditionOf(pick.querySelector('[id$="-1-words"] > span:last-child') as HTMLElement, 'hidden'),
      conditionOf(more.querySelector('span') as HTMLElement, 'hidden'),
      conditionOf(bar.querySelector('span.rounded-full[aria-hidden="true"]') as HTMLElement, 'hidden'),
      conditionOf(pick, 'text-base'),
      conditionOf(screen.getByRole('button', { name: '3 Send to 26 people' }).querySelector('[id$="-3-words"] > span:last-child') as HTMLElement, 'block'),
    ].map(remOf)
    expect(starts).toEqual([...starts].sort((a, b) => b - a))
    expect(new Set(starts).size).toBe(starts.length)
  })

  it('hold no math function inside any condition in the bar\'s two files, so no browser drops a form for want of reading one', () => {
    const dir = join(__dirname, '..', '..', 'src', 'areas', 'admin', 'newsletter')
    for (const file of ['FootBar.tsx', 'MoreOptions.tsx']) {
      const text = readFileSync(join(dir, file), 'utf8')
      const conditions = [...text.matchAll(/(?<![\w-])@?(?:max|min)-\[([^\]\s]+)\]:/g)].map((hit) => hit[1])
      expect(conditions.length, file).toBeGreaterThan(0)
      expect(conditions.filter((value) => /(?:max|min|clamp|calc)\(/.test(value)), file).toEqual([])
    }
  })
})

describe('Send\'s words in every form', () => {
  it('read the count whole, one person, many people, or no count at all, with only a count put under "Send to"', () => {
    const draw = (count: number | null | 'failed') => (
      <FootBar phone={false} bigger={false} count={count} onSeeEmail={() => {}} sheetOpen={false} onPick={() => {}} chooserOpen={false} cue={false} carry={carry} onTest={() => {}} testing={false} onSendNotYet={() => {}} said={null} />
    )
    const view = render(draw(1))
    const words = () => document.querySelector('[id$="-3-words"]') as HTMLElement
    expect(screen.getByRole('button', { name: '3 Send to 1 person' })).toBeTruthy()
    expect((words().lastElementChild as HTMLElement).textContent).toBe('1 person')
    view.rerender(draw(12345))
    expect(screen.getByRole('button', { name: '3 Send to 12,345 people' })).toBeTruthy()
    expect((words().lastElementChild as HTMLElement).textContent).toBe('12,345 people')
    for (const count of [null, 'failed'] as const) {
      view.rerender(draw(count))
      expect(screen.getByRole('button', { name: '3 Send' })).toBeTruthy()
      // Nothing to stand on a line of its own, and the arrow still drawn.
      expect(words().querySelectorAll('[class*=":block"]')).toHaveLength(0)
      expect(words().closest('button')?.querySelector('svg.lucide-chevron-down')).toBeTruthy()
    }
  })
})
