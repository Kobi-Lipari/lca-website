// domain/clubs/pageMeta.ts, the edges the first file does not walk (WS09
// step 8): the cut at every length around the limit, About cut beside a
// whole statement at every length of each, where a stop is added
// to About and pushes the text over, a long word in the middle, characters
// outside the basic plane, text that only looks like markup, and the plain
// text rule applied twice. Every club here is made up.
import { describe, expect, it } from 'vitest'
import { PAGE_DESCRIPTION_MAX, clubPageDescription, clubPageTitle, plainText } from '../../domain/clubs/pageMeta'

const CUT = '…'
const WORDS = ['club', 'games', 'Tuesday', 'beginners', 'welcome', 'rated', 'casual', 'boards', 'a', 'to', 'and', 'quick']

/** A made-up text of single-spaced words, at least as long as asked. */
function textAtLeast(n: number, seed: number): string {
  const out: string[] = []
  let length = 0
  for (let i = 0; length < n; i += 1) {
    const word = WORDS[(i * 7 + seed) % WORDS.length]
    out.push(word)
    length += word.length + 1
  }
  return out.join(' ')
}

describe('the description at every length around the limit', () => {
  it('is never longer than 155 characters, and is the whole text or a cut at a word end with the mark', () => {
    for (let seed = 0; seed < 12; seed += 1) {
      for (let n = 120; n <= 400; n += 3) {
        const about = textAtLeast(n, seed)
        const got = clubPageDescription(about, '')
        expect(got.length, `${seed} ${n}`).toBeLessThanOrEqual(PAGE_DESCRIPTION_MAX)
        if (about.length <= PAGE_DESCRIPTION_MAX) {
          expect(got).toBe(about)
          continue
        }
        expect(got.endsWith(CUT), `${seed} ${n}`).toBe(true)
        const kept = got.slice(0, -1)
        // What is kept is a prefix of the text that ends where a word ends.
        expect(about.startsWith(kept)).toBe(true)
        expect(about[kept.length]).toBe(' ')
        // Nothing that could be kept was dropped: the next word would not have fitted.
        const next = about.slice(kept.length + 1).split(' ')[0]
        expect(kept.length + 1 + next.length + CUT.length, `${seed} ${n}`).toBeGreaterThan(PAGE_DESCRIPTION_MAX)
      }
    }
  })

  it('gives the same words again when its own answer is read as About, so a page and its preview never drift', () => {
    for (let seed = 0; seed < 6; seed += 1) {
      const once = clubPageDescription(textAtLeast(300, seed), 'Tuesdays at 7:00 PM.')
      expect(clubPageDescription(once, '')).toBe(once)
    }
  })

  it('keeps a text of 155 whole and cuts one of 156, with the space exactly where the cut falls', () => {
    const body = (n: number) => 'x'.repeat(n)
    // 154 letters, a space and a word: 159 characters, and the space is the last place a mark can follow.
    const cutAtSpace = clubPageDescription(`${body(154)} tail`, '')
    expect(cutAtSpace).toBe(`${body(154)}${CUT}`)
    expect(cutAtSpace.length).toBe(PAGE_DESCRIPTION_MAX)
    // 155 letters in one word fit as they are; 156 do not, and there is no earlier word end.
    expect(clubPageDescription(body(155), '')).toBe(body(155))
    expect(clubPageDescription(body(156), '')).toBe('')
    // A space at the last place the mark fits keeps the word before it; one place later leaves no room, so the cut falls at the word before that.
    expect(clubPageDescription(`${body(10)} ${body(143)} tail`, '')).toBe(`${body(10)} ${body(143)}${CUT}`)
    expect(clubPageDescription(`${body(10)} ${body(144)} tail`, '')).toBe(`${body(10)}${CUT}`)
  })

  it('counts the full stop it adds to About, so a text that fits only without it is cut', () => {
    const statement = 'Tuesdays'
    // About of 145 letters, the stop, a space and 8 letters is exactly 155.
    const pad = (n: number) => 'x'.repeat(n)
    const fitsWithStop = clubPageDescription(pad(145), statement) // 145 + '.' + ' ' + 8 = 155
    expect(fitsWithStop).toBe(`${pad(145)}. ${statement}`)
    expect(fitsWithStop.length).toBe(PAGE_DESCRIPTION_MAX)
    const oneMore = clubPageDescription(pad(146), statement) // 156 with the stop
    expect(oneMore.length).toBeLessThanOrEqual(PAGE_DESCRIPTION_MAX)
    expect(oneMore.endsWith(CUT)).toBe(true)
  })

  it('keeps the statement whole beside a long About at every length, while it leaves 60 characters for About, and cuts the whole text otherwise', () => {
    for (let seed = 0; seed < 12; seed += 3) {
      for (const size of [8, 35, 60, 92, 93, 94, 120]) {
        const statement = textAtLeast(size, seed + 1).slice(0, size).trim()
        const room = PAGE_DESCRIPTION_MAX - CUT.length - 1 - statement.length
        for (let n = 60; n <= 400; n += 7) {
          const about = textAtLeast(n, seed)
          const got = clubPageDescription(about, statement)
          const label = `${seed} ${size} ${n}`
          expect(got.length, label).toBeLessThanOrEqual(PAGE_DESCRIPTION_MAX)
          if (`${about}. ${statement}`.length <= PAGE_DESCRIPTION_MAX) {
            expect(got, label).toBe(`${about}. ${statement}`)
            continue
          }
          if (room >= 60) {
            // About's opening, cut where a word ends, the mark, a space and the whole statement.
            expect(got.endsWith(`${CUT} ${statement}`), label).toBe(true)
            const kept = got.slice(0, got.length - statement.length - 1 - CUT.length)
            expect(about.startsWith(kept), label).toBe(true)
            expect(about[kept.length], label).toBe(' ')
            const next = about.slice(kept.length + 1).split(' ')[0]
            expect(kept.length + 1 + next.length, label).toBeGreaterThan(room)
          } else {
            // The whole text cut, as with no statement.
            expect(got.endsWith(CUT), label).toBe(true)
            expect(`${about}. ${statement}`.startsWith(got.slice(0, -1)), label).toBe(true)
          }
        }
      }
    }
  })

  it('adds no stop after About that already ends with a stop, a mark or an ellipsis', () => {
    for (const end of ['.', '!', '?', CUT]) {
      expect(clubPageDescription(`Friendly club${end}`, 'Tuesdays.')).toBe(`Friendly club${end} Tuesdays.`)
    }
  })
})

describe('the description from text that is not plain', () => {
  it('keeps text that only looks like markup: a lone less-than sign is a word, not a tag', () => {
    expect(clubPageDescription('Players under 18 get in free, ages 5 < 18', '')).toBe('Players under 18 get in free, ages 5 < 18')
    expect(clubPageDescription('', 'Boards > 4 are rated')).toBe('Boards > 4 are rated')
  })

  it('keeps every word between a less-than and a greater-than sign typed as words, not as a tag', () => {
    expect(clubPageDescription('Players rated <1200 play Mondays, players rated >1800 play Thursdays', 'Tuesdays at 7:00 PM'))
      .toBe('Players rated <1200 play Mondays, players rated >1800 play Thursdays. Tuesdays at 7:00 PM')
    expect(clubPageDescription('We <3 chess and welcome everyone > 18 years', '')).toBe('We <3 chess and welcome everyone > 18 years')
    expect(plainText('Section A < 1400 < Section B > 1000 > Section C')).toBe('Section A < 1400 < Section B > 1000 > Section C')
  })

  it('takes a tag with attributes and a comment out, and makes every kind of break and space one space', () => {
    expect(plainText('<a href="https://example.org" class="x">Example</a><!-- a note --> club meets\r\n\r\nTuesday')).toBe('Example club meets Tuesday')
    expect(clubPageDescription('<h1>Example Chess Club</h1><br/>Casual games', '<em>7:00 PM</em>')).toBe('Example Chess Club Casual games. 7:00 PM')
  })

  it('never cuts in the middle of a character outside the basic plane', () => {
    const emoji = '\u{1F3C6}'
    const about = `${`${emoji}${emoji} `.repeat(60)}end`
    const got = clubPageDescription(about, '')
    expect(got.length).toBeLessThanOrEqual(PAGE_DESCRIPTION_MAX)
    // No lone half of a pair anywhere in the answer.
    expect(got).toBe(got.toWellFormed())
    expect(got.endsWith(CUT)).toBe(true)
  })

  it('keeps accented letters and the mark of a time as they were typed', () => {
    expect(clubPageDescription('Café d’échecs for beginners', 'Meets at 7:00 PM')).toBe('Café d’échecs for beginners. Meets at 7:00 PM')
  })
})

describe('the title from text that is not plain', () => {
  it('takes markup and breaks out of the name and the town, and writes the name and town only once each', () => {
    expect(clubPageTitle('<b>Example</b>\nChess   Club', '<i>Example</i>\tCity'))
      .toBe('Example Chess Club · Chess club in Example City, Louisiana · Louisiana Chess Association')
  })

  it('leaves out an empty name rather than starting with a separator', () => {
    expect(clubPageTitle('', 'Example City')).toBe('Chess club in Example City, Louisiana · Louisiana Chess Association')
    expect(clubPageTitle(null, undefined)).toBe('Chess club in Louisiana · Louisiana Chess Association')
  })
})
