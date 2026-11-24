// The event's line on the newsletter's own page (eventLine.ts): the day or days in every form, each weekday checked
// against the calendar, the order of the parts, each part left out, and the fields the line refuses.
import { describe, expect, it } from 'vitest'
import {
  checkEvent,
  eventDays,
  eventLine,
  eventLineText,
  type EventFields,
} from '../../src/areas/admin/newsletter/eventLine'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The weekday of a calendar day by the calendar itself, not by the formatter under test. */
function weekdayOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

const BLANK: EventFields = { name: '', firstDay: '', lastDay: '', place: '', runBy: '', link: '', linkWords: '' }

function fields(over: Partial<EventFields>): EventFields {
  return { ...BLANK, ...over }
}

describe('eventDays', () => {
  it.each([
    ['one day', '2027-01-09', '', 'Sat, Jan 9, 2027'],
    ['a last day equal to the first', '2027-01-09', '2027-01-09', 'Sat, Jan 9, 2027'],
    ['days in one month', '2027-02-06', '2027-02-07', 'Sat to Sun, Feb 6 to 7, 2027'],
    ['across two months', '2027-01-30', '2027-02-01', 'Sat to Mon, Jan 30 to Feb 1, 2027'],
    ['across two years', '2027-12-30', '2028-01-01', 'Thu to Sat, Dec 30, 2027 to Jan 1, 2028'],
    ['a leap day', '2028-02-28', '2028-02-29', 'Mon to Tue, Feb 28 to 29, 2028'],
    ['a day in the past', '2026-10-24', '', 'Sat, Oct 24, 2026'],
  ])('%s', (_name, first, last, words) => {
    expect(eventDays(first, last)).toBe(words)
  })

  it('names the weekday the calendar gives for both days', () => {
    for (const [first, last] of [
      ['2027-01-09', '2027-01-09'],
      ['2027-02-06', '2027-02-07'],
      ['2027-01-30', '2027-02-01'],
      ['2027-12-30', '2028-01-01'],
      ['2028-02-28', '2028-02-29'],
    ]) {
      const words = eventDays(first, last) ?? ''
      expect(words.startsWith(first === last ? `${weekdayOf(first)},` : `${weekdayOf(first)} to ${weekdayOf(last)},`)).toBe(true)
    }
  })

  it('reads a day as a calendar day, whatever the zone the test runs in', () => {
    // The last minutes of a year in Central time are already the next year in UTC; a bare day must not move.
    expect(eventDays('2027-12-31')).toBe('Fri, Dec 31, 2027')
    expect(eventDays('2027-01-01')).toBe('Fri, Jan 1, 2027')
  })

  it('never writes a dash', () => {
    for (const words of [eventDays('2027-02-06', '2027-02-07'), eventDays('2027-12-30', '2028-01-01')]) {
      expect(words).not.toMatch(/[\u2013\u2014-]/)
    }
  })

  it.each([
    ['a last day before the first', '2027-02-07', '2027-02-06'],
    ['an empty first day', '', '2027-02-06'],
    ['a first day that is not a date', '2027-02-30', ''],
    ['a last day that is not a date', '2027-02-06', 'soon'],
  ])('gives null for %s', (_name, first, last) => {
    expect(eventDays(first, last)).toBeNull()
  })
})

describe('eventLine', () => {
  it("writes the board's first line", () => {
    const line = eventLine(fields({
      name: 'Sample Winter Open', firstDay: '2027-01-09', place: 'Sample City',
      link: 'https://register.sample.lca/winter', linkWords: 'Register on King Registration',
    }))
    expect(line).not.toBeNull()
    expect(eventLineText(line!)).toBe('Sat, Jan 9, 2027 · Sample Winter Open · Sample City · Register on King Registration ↗')
  })

  it("writes the board's second line, run by its organizer", () => {
    const line = eventLine(fields({
      name: 'Example Memorial', firstDay: '2027-02-06', lastDay: '2027-02-07', place: 'Anytown', runBy: 'Example Chess Club',
      link: 'https://club.sample.lca/memorial', linkWords: "Registers on the organizer's site",
    }))
    expect(eventLineText(line!)).toBe(
      "Sat to Sun, Feb 6 to 7, 2027 · Example Memorial · Anytown · run by Example Chess Club · Registers on the organizer's site ↗",
    )
  })

  it('is one paragraph, with only the link words carrying the link and the arrow outside it', () => {
    const line = eventLine(fields({ name: 'Sample Winter Open', firstDay: '2027-01-09', link: 'https://register.sample.lca/a?b=1&c=2', linkWords: 'Details' }))
    expect(line).toEqual({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Sat, Jan 9, 2027 · Sample Winter Open · ' },
        { type: 'text', text: 'Details', marks: [{ type: 'link', attrs: { href: 'https://register.sample.lca/a?b=1&c=2' } }] },
        { type: 'text', text: ' ↗' },
      ],
    })
  })

  it.each([
    ['no place', { runBy: 'Example Chess Club' }, 'Sat, Jan 9, 2027 · Sample Winter Open · run by Example Chess Club · Details ↗'],
    ['no organizer', { place: 'Sample City' }, 'Sat, Jan 9, 2027 · Sample Winter Open · Sample City · Details ↗'],
    ['neither', {}, 'Sat, Jan 9, 2027 · Sample Winter Open · Details ↗'],
  ])('leaves out a part not given: %s', (_name, over, words) => {
    const line = eventLine(fields({ name: 'Sample Winter Open', firstDay: '2027-01-09', link: 'https://sample.lca', linkWords: 'Details', ...over }))
    expect(eventLineText(line!)).toBe(words)
  })

  it('ends after its last part when there is no link, with no arrow', () => {
    const line = eventLine(fields({ name: 'Sample Winter Open', firstDay: '2027-01-09', place: 'Sample City' }))
    expect(line).toEqual({ type: 'paragraph', content: [{ type: 'text', text: 'Sat, Jan 9, 2027 · Sample Winter Open · Sample City' }] })
  })

  it('trims what was typed', () => {
    const line = eventLine(fields({ name: '  Sample Winter Open ', firstDay: '2027-01-09', place: ' Sample City ', link: ' https://sample.lca ', linkWords: ' Details ' }))
    expect(eventLineText(line!)).toBe('Sat, Jan 9, 2027 · Sample Winter Open · Sample City · Details ↗')
    expect(line!.content[1].marks?.[0].attrs.href).toBe('https://sample.lca')
  })

  it('gives null when a field is refused', () => {
    expect(eventLine(fields({ firstDay: '2027-01-09' }))).toBeNull()
  })
})

describe('checkEvent', () => {
  it('refuses nothing for a whole event', () => {
    expect(checkEvent(fields({ name: 'Sample Winter Open', firstDay: '2027-01-09' }))).toEqual([])
  })

  it('refuses an empty form at the name and the first day, in the form order', () => {
    expect(checkEvent(BLANK)).toEqual([
      { field: 'name', words: "Write the event's name." },
      { field: 'firstDay', words: 'Choose the first day.' },
    ])
  })

  it('refuses a last day before the first', () => {
    expect(checkEvent(fields({ name: 'Sample Winter Open', firstDay: '2027-02-07', lastDay: '2027-02-06' }))).toEqual([
      { field: 'lastDay', words: 'The last day is before the first day.' },
    ])
  })

  it('refuses a day that is not a date', () => {
    expect(checkEvent(fields({ name: 'A', firstDay: '2027-02-30' }))).toEqual([{ field: 'firstDay', words: 'That first day is not a date.' }])
    expect(checkEvent(fields({ name: 'A', firstDay: '2027-02-06', lastDay: '2027-02-30' }))).toEqual([{ field: 'lastDay', words: 'That last day is not a date.' }])
  })

  it.each(['javascript:alert(1)', 'sample.lca', 'https://sample.lca/a b', 'https://sample.lca/"x'])('refuses an address the email cannot keep: %s', (link) => {
    expect(checkEvent(fields({ name: 'A', firstDay: '2027-01-09', link, linkWords: 'Details' }))).toEqual([
      { field: 'link', words: 'The email cannot keep that address. Start it with https://, http:// or mailto: and leave out spaces and quote marks.' },
    ])
  })

  it("needs the link's words when there is a link, with no default", () => {
    expect(checkEvent(fields({ name: 'A', firstDay: '2027-01-09', link: 'https://sample.lca', linkWords: '   ' }))).toEqual([
      { field: 'linkWords', words: "Write the link's words." },
    ])
  })

  it('refuses words for a link with no address', () => {
    expect(checkEvent(fields({ name: 'A', firstDay: '2027-01-09', linkWords: 'Details' }))).toEqual([
      { field: 'link', words: 'Add the address for these words, or clear the words.' },
    ])
  })

  it('says nothing in its words with a dash', () => {
    const all = [
      ...checkEvent(BLANK),
      ...checkEvent(fields({ name: 'A', firstDay: '2027-02-07', lastDay: '2027-02-06', link: 'x', linkWords: '' })),
      ...checkEvent(fields({ name: 'A', firstDay: '2027-02-07', linkWords: 'x' })),
    ]
    for (const refusal of all) expect(refusal.words).not.toMatch(/[\u2013\u2014]/)
  })
})

describe('the edges a calendar and a pasted link bring', () => {
  it('names the days around the clock changes in Central time as the calendar does', () => {
    // Clocks go forward on Sun, Mar 14, 2027 and back on Sun, Nov 7, 2027 in America/Chicago.
    for (const day of ['2027-03-13', '2027-03-14', '2027-03-15', '2027-11-06', '2027-11-07', '2027-11-08']) {
      expect(eventDays(day)?.slice(0, 3)).toBe(weekdayOf(day))
    }
    expect(eventDays('2027-03-13', '2027-03-14')).toBe('Sat to Sun, Mar 13 to 14, 2027')
    expect(eventDays('2027-11-06', '2027-11-07')).toBe('Sat to Sun, Nov 6 to 7, 2027')
    expect(eventDays('2028-02-28', '2028-02-29')).toBe('Mon to Tue, Feb 28 to 29, 2028')
  })

  it('refuses a day the calendar does not hold', () => {
    expect(eventDays('2027-02-29')).toBeNull()
    expect(checkEvent(fields({ name: 'A', firstDay: '2027-02-29' }))).toEqual([{ field: 'firstDay', words: 'That first day is not a date.' }])
  })

  it('keeps a mailto: address as the link', () => {
    const line = eventLine(fields({ name: 'Sample Winter Open', firstDay: '2027-01-09', link: 'mailto:td@sample.lca', linkWords: 'Write to the director' }))
    expect(line?.content[1].marks?.[0].attrs.href).toBe('mailto:td@sample.lca')
    expect(line && eventLineText(line)).toBe('Sat, Jan 9, 2027 · Sample Winter Open · Write to the director ↗')
  })

  it('refuses an address holding a space or a quote mark', () => {
    for (const link of ['https://sample.lca/a b', 'https://sample.lca/"x"']) {
      expect(checkEvent(fields({ name: 'A', firstDay: '2027-01-09', link, linkWords: 'Details' })).map((r) => r.field)).toEqual(['link'])
    }
  })

  it('keeps markup characters and a very long name as words', () => {
    const name = `<b>Sample</b> & "Co" ${'Open '.repeat(60)}♞`
    const line = eventLine(fields({ name, firstDay: '2027-01-09' }))
    expect(line && eventLineText(line)).toBe(`Sat, Jan 9, 2027 · ${name.trim()}`)
    expect(line?.content).toHaveLength(1)
  })

  it('refuses a last day typed with no first day at the first day only', () => {
    expect(checkEvent(fields({ name: 'A', lastDay: '2027-01-10' }))).toEqual([{ field: 'firstDay', words: 'Choose the first day.' }])
  })
})
