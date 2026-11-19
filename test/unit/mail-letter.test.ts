// test/unit/mail-letter.test.ts
//
// The rules of a newsletter letter in domain/mail/letter.ts (WS16 part two,
// page step 1). Pinned here: the parts a letter's headings make, in order,
// with their names, a number on a repeat and no two names alike, "Results"
// and "Results 2" among them; a heading with no words skipped; the anchor
// written just before each part's heading and every other byte left as it
// was; the usual six headings in order and the other starters; the board's
// prompts for the empty parts; the default subject with the board's own
// middle dot; the month's words; the cap; the plain words of everything a
// person reads; and that every sample word in this file is plainly made up
// (K's decision 39). The cleaner is tested inside the Workers runtime, in
// test/integration/mail-letter-clean.test.ts. Nothing here makes a request.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  defaultSubject, LETTER_MAX_BYTES, letterParts, monthLabel, PART_PROMPTS, STARTER_IDS, STARTERS, withAnchors, type LetterPart,
} from '../../domain/mail/letter'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** Every sample word this file writes into a letter, each plainly made up (K's decision 39). */
const SAMPLE = {
  headingOne: 'Sample heading one',
  headingTwo: 'Sample heading two',
  headingThree: 'Sample heading three',
  words: 'Sample words for this part.',
  more: 'More sample words.',
  player: 'Player One',
  link: 'https://example.org/sample',
  club: 'Example Chess Club',
  accents: 'Sample Ça va, Español',
  otherScript: '示例',
  digits: '2 Sample heading',
} as const

/** A letter as the editor writes it, in the cleaner's form. */
const LETTER = [
  `<h2>${SAMPLE.headingOne}</h2>`,
  `<p>${SAMPLE.words} <a href="${SAMPLE.link}">${SAMPLE.player}</a></p>`,
  `<h2>${SAMPLE.headingTwo}</h2>`,
  `<ul><li><p>${SAMPLE.club}</p></li></ul>`,
  `<h2>${SAMPLE.headingThree}</h2>`,
  `<p>${SAMPLE.more}</p>`,
].join('')

/** The names of a letter's parts. */
const names = (html: string) => letterParts(html).map((part) => part.name)

/** A letter of h2 headings alone. */
const headed = (...titles: string[]) => titles.map((title) => `<h2>${title}</h2><p>${SAMPLE.words}</p>`).join('')

describe('the parts of a letter', () => {
  it('are its h2 headings, in order, each with a name made from its words', () => {
    expect(letterParts(LETTER)).toEqual([
      { title: 'Sample heading one', name: 'sample-heading-one' },
      { title: 'Sample heading two', name: 'sample-heading-two' },
      { title: 'Sample heading three', name: 'sample-heading-three' },
    ])
  })

  it('give a second heading with the same words "-2" and a third "-3"', () => {
    expect(names(headed(SAMPLE.headingOne, SAMPLE.headingOne, SAMPLE.headingOne))).toEqual([
      'sample-heading-one', 'sample-heading-one-2', 'sample-heading-one-3',
    ])
    // Words that differ only in capitals or marks make the same name, so they are numbered too.
    expect(names(headed('Sample heading', 'SAMPLE HEADING!', 'Sample, heading'))).toEqual(['sample-heading', 'sample-heading-2', 'sample-heading-3'])
  })

  it('never give two parts the same name, "Results" and "Results 2" in either order', () => {
    expect(names(headed('Results', 'Results 2'))).toEqual(['results', 'results-2'])
    expect(names(headed('Results', 'Results', 'Results 2'))).toEqual(['results', 'results-2', 'results-2-2'])
    expect(names(headed('Results 2', 'Results', 'Results'))).toEqual(['results-2', 'results', 'results-3'])
    for (const order of [['Results', 'Results', 'Results 2', 'Results 2'], ['Results 2', 'Results', 'Results 2', 'Results', 'Results 3']]) {
      const made = names(headed(...order))
      expect(new Set(made).size, order.join(' | ')).toBe(made.length)
    }
  })

  it('skip a heading with no words, and the numbering goes on as if it were not there', () => {
    const empty = ['<h2></h2>', '<h2> </h2>', '<h2>&nbsp;</h2>', '<h2><br></h2>', '<h2><strong></strong></h2>']
    for (const heading of empty) expect(letterParts(heading), heading).toEqual([])
    expect(names(`<h2>${SAMPLE.headingOne}</h2>${empty.join('')}<h2>${SAMPLE.headingOne}</h2>`)).toEqual([
      'sample-heading-one', 'sample-heading-one-2',
    ])
  })

  it('read the heading\'s words as plain text: tags gone, a line break a space, references read once', () => {
    expect(letterParts('<h2>Sample <em>heading</em> <strong>one</strong></h2>')[0].title).toBe('Sample heading one')
    expect(letterParts('<h2>Sample<br>heading</h2>')[0].title).toBe('Sample heading')
    expect(letterParts('<h2>  Sample \n  heading&nbsp;one  </h2>')[0].title).toBe('Sample heading one')
    expect(letterParts('<h2>Sample &amp; heading</h2>')[0]).toEqual({ title: 'Sample & heading', name: 'sample-heading' })
    expect(letterParts('<h2>Sample &amp;lt; &#60;b&#x3e;</h2>')[0].title).toBe('Sample &lt; <b>')
    expect(letterParts('<h2><a href="https://example.org/sample">Sample link</a> heading</h2>')[0].title).toBe('Sample link heading')
  })

  it('make names of lower-case letters and digits with one hyphen for any other run, accents dropped', () => {
    expect(letterParts(`<h2>${SAMPLE.accents}</h2>`)[0].name).toBe('sample-ca-va-espanol')
    expect(letterParts('<h2>  Sample: heading, one!!  </h2>')[0].name).toBe('sample-heading-one')
    for (const part of letterParts(headed(SAMPLE.headingOne, SAMPLE.accents, SAMPLE.digits, SAMPLE.otherScript, 'Results 2'))) {
      expect(part.name, part.title).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/)
    }
  })

  it('start every name with a letter: words that start with a digit, or keep none, are named as a part', () => {
    expect(letterParts(`<h2>${SAMPLE.digits}</h2>`)[0].name).toBe('part-2-sample-heading')
    expect(letterParts('<h2>2</h2>')[0].name).toBe('part-2')
    expect(letterParts(`<h2>${SAMPLE.otherScript}</h2>`)[0]).toEqual({ title: '示例', name: 'part' })
    // A heading "Part 2" after a heading "2" still gets a name of its own.
    expect(names(headed('2', 'Part 2', SAMPLE.otherScript, SAMPLE.otherScript))).toEqual(['part-2', 'part-2-2', 'part', 'part-3'])
  })

  it('end a heading where a browser ends it, at the next heading', () => {
    expect(letterParts('<h2>Sample heading one<h3>Sample</h3><p>words</p>')).toEqual([{ title: 'Sample heading one', name: 'sample-heading-one' }])
    expect(letterParts('<h2>Sample one<h2>Sample two</h2>').map((part) => part.title)).toEqual(['Sample one', 'Sample two'])
  })

  it('come from h2 headings alone', () => {
    expect(letterParts('<h3>Sample heading one</h3><p><strong>Sample words</strong></p>')).toEqual([])
    expect(letterParts('')).toEqual([])
  })
})

describe('the anchors before the parts', () => {
  it('are an empty named anchor just before each part\'s heading, in the form part one\'s notes ask for', () => {
    expect(withAnchors('<h2>Results</h2><p>Sample words.</p>', letterParts('<h2>Results</h2><p>Sample words.</p>'))).toBe(
      '<a name="results"></a><h2>Results</h2><p>Sample words.</p>',
    )
    const anchored = withAnchors(LETTER, letterParts(LETTER))
    expect(anchored.match(/<a name="[^"]*"><\/a><h2>/g)).toEqual([
      '<a name="sample-heading-one"></a><h2>', '<a name="sample-heading-two"></a><h2>', '<a name="sample-heading-three"></a><h2>',
    ])
  })

  it('change nothing else: the letter without them is the letter, byte for byte', () => {
    const letter = `<p>${SAMPLE.words}</p>${headed('Results', 'Results', 'Results 2')}<h2></h2><h3>${SAMPLE.headingOne}</h3>`
    const anchored = withAnchors(letter, letterParts(letter))
    expect(anchored.match(/<a name="/g)).toHaveLength(3)
    expect(anchored.replace(/<a name="[a-z0-9-]*"><\/a>/g, '')).toBe(letter)
    expect(withAnchors(letter, [])).toBe(letter)
    expect(withAnchors('', [])).toBe('')
  })

  it('go only where the part matches the heading, and never write a name that is not in a part\'s form', () => {
    const letter = headed(SAMPLE.headingOne, SAMPLE.headingTwo)
    const parts = letterParts(letter)
    expect(withAnchors(letter, [parts[1], parts[0]])).toBe(letter)
    const odd: LetterPart[] = [{ title: SAMPLE.headingOne, name: 'x" onclick="alert(1)' }, { title: SAMPLE.headingTwo, name: '2-sample' }]
    expect(withAnchors(letter, odd)).toBe(letter)
    expect(withAnchors(letter, [parts[0]])).toBe(`<a name="sample-heading-one"></a>${letter}`)
  })

  it('skip a heading with no words, as the parts do', () => {
    const letter = `<h2></h2><h2>${SAMPLE.headingOne}</h2>`
    expect(withAnchors(letter, letterParts(letter))).toBe('<h2></h2><a name="sample-heading-one"></a><h2>Sample heading one</h2>')
  })
})

describe('the starters', () => {
  it('are the blank letter and LCA\'s three, in the chooser\'s order, with the board\'s names', () => {
    expect(STARTER_IDS).toEqual(['blank', 'monthly', 'results-and-thanks', 'short-notice'])
    expect(Object.keys(STARTERS)).toEqual([...STARTER_IDS])
    expect(STARTER_IDS.map((id) => STARTERS[id].name)).toEqual(['Blank letter', 'Monthly newsletter', 'Results and thanks', 'Short notice'])
  })

  it('give the monthly newsletter the usual six headings, in order', () => {
    expect(STARTERS.monthly.headings).toEqual([
      'A note from the president', 'Coming up', 'Results', 'From the clubs', 'Scholastic', 'Board business',
    ])
    expect(names(headed(...STARTERS.monthly.headings))).toEqual([
      'a-note-from-the-president', 'coming-up', 'results', 'from-the-clubs', 'scholastic', 'board-business',
    ])
  })

  it('give the others the fewest headings that make sense of their names', () => {
    expect(STARTERS.blank.headings).toEqual([])
    expect(STARTERS['results-and-thanks'].headings).toEqual(['Results and thanks'])
    expect(STARTERS['short-notice'].headings).toEqual([])
  })

  it('hold headings only, never a sentence that explains a control (K\'s decision 40)', () => {
    for (const id of STARTER_IDS) {
      expect(Object.keys(STARTERS[id]).sort(), id).toEqual(['headings', 'name'])
      for (const heading of STARTERS[id].headings) {
        expect(heading, heading).not.toMatch(/[.!?:]|\b(click|type|press|button|here)\b/i)
        expect(heading.length, heading).toBeLessThanOrEqual(30)
      }
    }
  })

  it('come with the board\'s prompts for the empty parts, word for word', () => {
    expect(PART_PROMPTS).toEqual(['Write your opening here', 'Add what is coming up', 'Add results or club news'])
  })
})

describe('the subject, the month and the cap', () => {
  it('give December 2026\'s subject with the middle dot the board draws, a space each side', () => {
    const subject = defaultSubject('December 2026')
    expect(subject).toBe('LCA Newsletter \u00b7 December 2026')
    expect([...subject.slice(14, 17)].map((ch) => ch.codePointAt(0))).toEqual([0x20, 0xb7, 0x20])
    expect(defaultSubject(monthLabel(2026, 12))).toBe(subject)
  })

  it('run the month\'s spaces together, and leave the dot off when there is no month', () => {
    expect(defaultSubject('  December   2026 ')).toBe('LCA Newsletter \u00b7 December 2026')
    expect(defaultSubject('')).toBe('LCA Newsletter')
    expect(defaultSubject('   ')).toBe('LCA Newsletter')
  })

  it('write each month by name with its year, and refuse a month or a year that is not one', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => monthLabel(2027, month))).toEqual([
      'January 2027', 'February 2027', 'March 2027', 'April 2027', 'May 2027', 'June 2027',
      'July 2027', 'August 2027', 'September 2027', 'October 2027', 'November 2027', 'December 2027',
    ])
    for (const [year, month] of [[2026, 0], [2026, 13], [2026, 1.5], [2026, Number.NaN], [0, 12], [2026.5, 12], [10000, 1]]) {
      expect(() => monthLabel(year, month), `${year}, ${month}`).toThrow(RangeError)
    }
  })

  it('hold a saved letter, once cleaned, to 80,000 bytes', () => {
    expect(LETTER_MAX_BYTES).toBe(80000)
  })
})

describe('the words and the file', () => {
  const everyWord = [
    ...STARTER_IDS.flatMap((id) => [STARTERS[id].name, ...STARTERS[id].headings]),
    ...PART_PROMPTS,
    defaultSubject(monthLabel(2026, 12)),
  ]

  it('keep K\'s plain-language rules: no em or en dash, no old initials for US Chess, no time or date', () => {
    const oldInitials = new RegExp(`\\b${'US'}${'CF'}\\b`)
    for (const words of everyWord) {
      expect(words, words).not.toMatch(/[\u2013\u2014]/)
      expect(words, words).not.toMatch(oldInitials)
      expect(words, words).not.toMatch(/\d{1,2}:\d{2}|\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/)
    }
  })

  it('keep domain/mail/letter.ts pure, with no import at all', () => {
    expect(read('domain/mail/letter.ts')).not.toMatch(/^\s*import\b|\brequire\(|\bimport\(/m)
  })

  it('hold only sample words that are plainly made up (K\'s decision 39)', () => {
    const madeUp = /\b(sample|example|player one)\b|example\.org|示例/i
    for (const [key, words] of Object.entries(SAMPLE)) expect(words, key).toMatch(madeUp)
    // Nothing in this file names a real place, club or event: the names below are put together here, so the file
    // does not hold them whole.
    const source = read('test/unit/mail-letter.test.ts')
    const real = [
      ['Louis', 'iana'], ['Baton', ' Rouge'], ['New', ' Orleans'], ['Lafay', 'ette'], ['Shreve', 'port'], ['Lake', ' Charles'],
      ['Met', 'airie'], ['Hou', 'ma'], ['Champion', 'ship'], ['King', ' Registration'], ['louisiana', 'chess.org'],
    ].map((pieces) => pieces.join(''))
    for (const name of real) expect(source, name).not.toContain(name)
  })
})
