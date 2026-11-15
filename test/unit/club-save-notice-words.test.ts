// test/unit/club-save-notice-words.test.ts
//
// The save notice's words, with the one sentence K's decision 7 of Sunday,
// November 15, 2026 adds: since the notice goes at most once an hour for one
// club and one person saving, it says that a further save by the same person
// within the hour sends no second email, and that the link shows the listing
// as it stands. The sentence is in the HTML and the text alike, the saver's
// name made one line and, in the HTML, escaped, as the rest of the notice's
// names are. Everything else is as it was: the heading, the fields' names,
// the reason the person is told and the link. Every name here is made up.
import { describe, expect, it } from 'vitest'
import { clubSaveNoticeEmail } from '../../functions/utils/clubs/emails'

const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)

const notice = (saverName: string) => clubSaveNoticeEmail({
  siteUrl: 'https://example.org',
  clubId: 'example-chess-club',
  clubName: 'Example Chess Club',
  saverName,
  fields: ['One sentence about the club', 'Where'],
})

const sentence = (name: string) => `If ${name} saves again within the hour, no second email follows; the link shows the listing as it stands.`

describe('the save notice says the hour in one plain sentence', () => {
  it('holds the sentence in the HTML and in the text, with the saver\'s name', () => {
    const email = notice('Player One')
    expect(email.html).toContain(`<p style="margin:0 0 16px;">${sentence('Player One')}</p>`)
    expect(email.text).toContain(`\n\n${sentence('Player One')}\n\n`)
  })

  it('keeps a name that carries a comma whole, in the HTML and the text', () => {
    const email = notice('One, Player')
    expect(email.html).toContain(sentence('One, Player'))
    expect(email.text).toContain(sentence('One, Player'))
  })

  it('escapes a name that carries markup in the HTML, and gives it as typed in the text', () => {
    const email = notice('<b>Player</b> & "One"')
    expect(email.html).toContain(sentence('&lt;b&gt;Player&lt;/b&gt; &amp; &quot;One&quot;'))
    expect(email.html).not.toContain('<b>Player</b>')
    expect(email.text).toContain(sentence('<b>Player</b> & "One"'))
  })

  it('makes a name with line breaks one line in the sentence, as the rest of the notice does', () => {
    const email = notice('Player\n\nOne\t')
    expect(email.text).toContain(sentence('Player One'))
    expect(email.text).toContain('Saved by: Player One\n')
    expect(email.html).toContain(sentence('Player One'))
  })

  it('changes nothing else: the text is the notice as it was, with the one sentence after the reason', () => {
    expect(notice('Player One')).toMatchObject({ to: '', subject: 'Example Chess Club: its listing was updated' })
    expect(notice('Player One').text).toBe([
      'A club\'s listing in your region was updated.',
      '',
      'Club: Example Chess Club',
      'Saved by: Player One',
      'What changed: One sentence about the club; Where',
      '',
      'You are told because your board seat covers this club\'s region. Nothing needs doing unless something looks wrong.',
      '',
      sentence('Player One'),
      '',
      'See the club: https://example.org/admin/clubs/example-chess-club',
    ].join('\n'))
    const html = notice('Player One').html
    expect(html.indexOf('Nothing needs doing unless something looks wrong.')).toBeLessThan(html.indexOf(sentence('Player One')))
    expect(html).toContain('https://example.org/admin/clubs/example-chess-club')
    expect(html).toContain('See the club')
  })

  it('holds no long dash and no word of the site\'s own build', () => {
    for (const text of [notice('Player One').html, notice('Player One').text ?? '']) {
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(/club_edit|notice: |CLUB_KEEPERS_ON|clubKeepers/)
    }
  })
})
