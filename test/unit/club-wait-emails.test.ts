// test/unit/club-wait-emails.test.ts
//
// The three emails of a representative's club event in the LCA admins'
// wait (functions/utils/clubs/emails.ts, WS09 step 18), and the days they
// name an event by. Every name, club, person and address is made up.
// - the days carry a weekday (written Sat, Dec 12) on every date, one day or several, an end date
//   of null, a span across a year, and the two days a year the clocks change
//   in America/Chicago, none of which moves a date-only day;
// - each email names the event, its club and its days in its subject-free
//   body, its HTML and its text alike, with the right link, no long dash, not
//   US Chess's old initials and no explaining sentence beside the button;
// - what a person typed (the event's name, the club's name, the note) is
//   escaped in the HTML and one line where it must be, and the note is the
//   one place a line break may stay;
// - a club that is gone reads as one line of words, and a first name that is
//   missing reads as "there".
import { describe, expect, it } from 'vitest'
import { approvedEmail, changesAskedEmail, NO_CLUB, reviewAskedEmail, type WaitingEvent } from '../../functions/utils/clubs/emails'
import { eventDays } from '../../functions/utils/events/publishedReview'

/** An en dash or an em dash, written by code so that this file holds neither. */
const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`, 'i')
const SITE = 'https://example.org'

describe('eventDays', () => {
  it.each([
    ['one day, end date null', '2026-12-12', null, 'Sat, Dec 12, 2026'],
    ['one day, end date the same day', '2026-12-12', '2026-12-12', 'Sat, Dec 12, 2026'],
    ['two days in a month', '2026-12-12', '2026-12-13', 'Sat, Dec 12 to Sun, Dec 13, 2026'],
    ['two days across a month', '2026-01-31', '2026-02-01', 'Sat, Jan 31 to Sun, Feb 1, 2026'],
    ['two days across a year', '2026-12-31', '2027-01-01', 'Thu, Dec 31, 2026 to Fri, Jan 1, 2027'],
    ['the day the clocks go forward in America/Chicago', '2026-03-08', null, 'Sun, Mar 8, 2026'],
    ['the day the clocks go back in America/Chicago', '2026-11-01', null, 'Sun, Nov 1, 2026'],
    ['a weekend over the clocks going back', '2026-10-31', '2026-11-01', 'Sat, Oct 31 to Sun, Nov 1, 2026'],
    ['a weekend over the clocks going forward', '2026-03-07', '2026-03-08', 'Sat, Mar 7 to Sun, Mar 8, 2026'],
    ['a day in a leap year', '2028-02-29', null, 'Tue, Feb 29, 2028'],
  ])('%s', (_, date, end, words) => {
    expect(eventDays(date, end)).toBe(words)
  })

  it('never reads a date as an hour of the day before it', () => {
    // Midnight UTC is the evening before in America/Chicago; a date-only day never moves.
    for (const [date, weekday] of [['2026-11-01', 'Sun'], ['2026-03-08', 'Sun'], ['2026-06-01', 'Mon']] as const) {
      expect(eventDays(date, null)).toMatch(new RegExp(`^${weekday}, `))
    }
  })
})

const EVENT: WaitingEvent = {
  siteUrl: SITE,
  id: 'example-winter-open',
  name: 'Example Winter Open',
  clubName: 'Example Chess Club',
  when: eventDays('2026-12-12', null),
}

const CASES = [
  ['review', () => reviewAskedEmail(EVENT), `${SITE}/admin/tournaments/example-winter-open`],
  ['approved', () => approvedEmail({ ...EVENT, fullName: 'Player One' }), `${SITE}/tournaments/example-winter-open`],
  ['changes', () => changesAskedEmail({ ...EVENT, fullName: 'Player One', note: 'Add the time control.' }), `${SITE}/admin/tournaments/example-winter-open`],
] as const

/** An email's HTML read as words, its style and its tags taken out. */
const wordsOf = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&')

describe('the three emails', () => {
  it.each(CASES)('the %s email has no address of its own: the sender fills it for each person', (_, build) => {
    expect(build().to).toBe('')
  })

  it.each(CASES)('the %s email names the event, its club and its days with a weekday, in its HTML and its text', (_, build) => {
    const mail = build()
    for (const text of [wordsOf(mail.html), mail.text ?? '']) {
      expect(text).toContain('Example Winter Open')
      expect(text).toContain('Example Chess Club')
      expect(text).toContain('Sat, Dec 12, 2026')
    }
    expect(mail.subject).toContain('Example Winter Open')
  })

  it.each(CASES)('the %s email carries its one link in the HTML and the text', (_, build, link) => {
    const mail = build()
    expect(mail.html).toContain(`href="${link}"`)
    expect(mail.text).toContain(link)
  })

  it.each(CASES)('the %s email has no long dash, not US Chess\'s old initials and no raw decimal half, in any part', (_, build) => {
    const mail = build()
    for (const text of [mail.subject, mail.html, mail.text ?? '']) {
      expect(text).not.toMatch(LONG_DASH)
      expect(text).not.toMatch(OLD_INITIALS)
      expect(text).not.toMatch(/\d\.5\b/)
    }
  })

  it.each(CASES)('the %s email has no sentence that explains a control', (_, build) => {
    const mail = build()
    for (const text of [wordsOf(mail.html), mail.text ?? '']) {
      expect(text).not.toMatch(/\b(click|press|tap|use) (the |this )?(button|link)\b/i)
      expect(text).not.toMatch(/\bthe button (below|above)\b/i)
    }
  })
})

describe('what a person typed', () => {
  const hostile = { ...EVENT, name: '<img src=x onerror=alert(1)> Open\nSecond line', clubName: 'Example <b>Club</b> & Sons' }

  it.each([
    ['review', reviewAskedEmail(hostile)],
    ['approved', approvedEmail({ ...hostile, fullName: '<i>Player</i> One' })],
    ['changes', changesAskedEmail({ ...hostile, fullName: '<i>Player</i> One', note: 'Use <script>x</script> & "quotes".' })],
  ])('is escaped in the %s email\'s HTML, and the name is one line in its subject', (_, mail) => {
    expect(mail.html).not.toContain('<img src=x')
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).not.toContain('<b>Club</b>')
    expect(mail.html).toContain('&lt;img')
    expect(mail.subject).not.toMatch(/[\r\n]/)
    expect(mail.subject).toContain('<img src=x onerror=alert(1)> Open Second line')
    expect(mail.text).not.toMatch(/Open\nSecond/)
  })

  it('draws a first name that holds markup as text, and "there" when the name is empty', () => {
    expect(approvedEmail({ ...EVENT, fullName: '<i>Player</i> One' }).html).toContain('Hi &lt;i&gt;Player&lt;/i&gt;,')
    expect(approvedEmail({ ...EVENT, fullName: '   ' }).text).toMatch(/^Hi there,/)
    expect(changesAskedEmail({ ...EVENT, fullName: '', note: 'Example note' }).text).toMatch(/^Hi there,/)
  })

  it('keeps the note whole in the text and escaped in the HTML, with its own line breaks', () => {
    const note = 'First line.\nSecond line with "quotes" & <tags>.'
    const mail = changesAskedEmail({ ...EVENT, fullName: 'Player One', note })
    expect(mail.text).toContain(note)
    expect(mail.html).toContain('Second line with &quot;quotes&quot; &amp; &lt;tags&gt;.')
    expect(mail.html).toContain('First line.\nSecond line')
  })

  it('reads a club that is gone, or only spaces, as one line of words in every email', () => {
    for (const clubName of [null, '', '   ']) {
      for (const mail of [reviewAskedEmail({ ...EVENT, clubName }), approvedEmail({ ...EVENT, clubName, fullName: 'Player One' }), changesAskedEmail({ ...EVENT, clubName, fullName: 'Player One', note: 'Example note' })]) {
        expect(mail.text).toContain(`Club: ${NO_CLUB}`)
        expect(mail.html).toContain(NO_CLUB)
      }
    }
  })

  it('writes an event id that needs encoding into its links encoded', () => {
    const mail = reviewAskedEmail({ ...EVENT, id: 'example id/1?x' })
    expect(mail.text).toContain(`${SITE}/admin/tournaments/example%20id%2F1%3Fx`)
  })
})

describe('the review email names no person', () => {
  it('has no greeting and no name of anyone', () => {
    const mail = reviewAskedEmail(EVENT)
    expect(mail.text).not.toMatch(/^Hi\b/m)
    expect(mail.html).not.toMatch(/>Hi\b/)
    expect(mail.text).not.toMatch(/Player One/)
  })

  it('has the days of a two day event in its subject and body', () => {
    const mail = reviewAskedEmail({ ...EVENT, when: eventDays('2026-10-31', '2026-11-01') })
    expect(mail.subject).toBe('For LCA review: Example Winter Open (Sat, Oct 31 to Sun, Nov 1, 2026)')
    expect(mail.text).toContain('When: Sat, Oct 31 to Sun, Nov 1, 2026')
  })
})
